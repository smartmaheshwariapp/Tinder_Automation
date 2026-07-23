
import json, urllib.request, socket, base64, sys, os

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=15)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\r\n"
              f"Host: {p.hostname}:{p.port}\r\n"
              f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
              f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(hs.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        self._mid = 1
        self._buf = b""

    def send(self, data):
        if isinstance(data, str): data = data.encode()
        mask = os.urandom(4)
        n = len(data)
        if n < 126: hdr = bytes([0x81, 0x80 | n]) + mask
        elif n < 65536: hdr = bytes([0x81, 0xFE]) + n.to_bytes(2,'big') + mask
        else: hdr = bytes([0x81, 0xFF]) + n.to_bytes(8,'big') + mask
        self.sock.sendall(hdr + bytes(b ^ mask[i%4] for i,b in enumerate(data)))

    def recv_msg(self):
        def read(n):
            while len(self._buf) < n: self._buf += self.sock.recv(4096)
            out, self._buf = self._buf[:n], self._buf[n:]
            return out
        b0,b1 = read(2); n = b1&0x7F
        if n==126: n=int.from_bytes(read(2),'big')
        elif n==127: n=int.from_bytes(read(8),'big')
        return read(n).decode()

    def call(self, method, params=None):
        mid = self._mid; self._mid += 1
        self.send(json.dumps({'id':mid,'method':method,'params':params or {}}))
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get('id') == mid: return msg.get('result', {})

    def close(self):
        try: self.sock.close()
        except: pass

try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type')=='page'), None)
    if not page: print('unknown'); sys.exit(0)
    ws = WS(page['webSocketDebuggerUrl'])
    script = """
    (function() {
        var url = window.location.href;
        var isLoggedIn = (
          document.querySelector('[data-qa-role="encounters-cards-area"]') !== null ||
          document.querySelector('.encounters-main') !== null ||
          document.querySelector('button[aria-label="Like"]') !== null ||
          document.querySelector('button[aria-label="Pass"]') !== null ||
          document.querySelector('a[href="/app/recs"]') !== null ||
          document.querySelector('a[href="/app/messages"]') !== null ||
          url.indexOf('/app/recs') !== -1 ||
          url.indexOf('/app/messages') !== -1 ||
          (url.indexOf('/app/') !== -1 && url.indexOf('/app/login') === -1)
        );
        var hasCaptcha = (
          document.querySelector('iframe[src*="captcha"]') !== null ||
          document.querySelector('iframe[src*="recaptcha"]') !== null ||
          document.querySelector('iframe[src*="arkose"]') !== null ||
          document.querySelector('iframe[src*="funcaptcha"]') !== null ||
          document.querySelector('.g-recaptcha') !== null ||
          document.querySelector('[class*="captcha"]') !== null ||
          document.title.toLowerCase().indexOf('captcha') !== -1
        );
        var hasOtpInput = (
          url.indexOf('confirm-phone') !== -1 ||
          document.querySelectorAll('input').length >= 4 ||
          document.querySelector('input[autocomplete="one-time-code"]') !== null ||
          document.querySelector('input[name="code"]') !== null ||
          document.querySelector('input[id="code"]') !== null ||
          (function() {
            var elements = document.querySelectorAll('h1, h2, h3, p, span, label, div');
            for (var i = 0; i < elements.length; i++) {
              var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
              if (txt.indexOf('my code is') !== -1 || txt.indexOf('one-time passcode') !== -1 || txt.indexOf('enter the 6-digit code') !== -1 || txt.indexOf('verification code') !== -1 || txt.indexOf('code we sent') !== -1 || txt.indexOf('enter code') !== -1 || txt.indexOf('passcode') !== -1 || txt.indexOf('resend via email') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );
        var hasPhoneInput = !hasOtpInput && (
          document.querySelector('input[name="phone_number"]') !== null ||
          document.querySelector('input[id="phone_number"]') !== null ||
          document.querySelector('input[id="phone-number"]') !== null ||
          (document.querySelectorAll('input').length === 1 && document.querySelector('input[type="tel"]') !== null) ||
          (function() {
            var elements = document.querySelectorAll('h1, h2, h3, p, span');
            for (var i = 0; i < elements.length; i++) {
              var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
              if (txt.indexOf("what's your number") !== -1 || txt.indexOf('my number is') !== -1 || txt.indexOf('enter your phone number') !== -1 || txt.indexOf('get your number') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );
        var hasEmailInput = (
          document.querySelector('input[type="email"]') !== null ||
          document.getElementById('email') !== null
        );
        var hasEmailWaiting = (
          (function() {
            var elements = document.querySelectorAll('h1, h2, h3, p, span, div');
            for (var i = 0; i < elements.length; i++) {
              var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
              if (txt.indexOf('check your email') !== -1 || txt.indexOf("didn't receive a link") !== -1 || txt.indexOf('email sent') !== -1) {
                return true;
              }
            }
            return false;
          })()
        );
        if (isLoggedIn) return 'logged_in';
        if (hasCaptcha) return 'captcha';
        if (hasOtpInput) return 'otp_screen';
        if (hasEmailWaiting) return 'waiting_email';
        if (hasEmailInput) return 'email_screen';
        if (hasPhoneInput) return 'phone_screen';
        if (hasLoginOptions) return 'login_options';
        return 'unknown';
    })()
    """
    result = ws.call('Runtime.evaluate', {'expression': script.strip(), 'returnByValue': True})
    state = (result.get('result') or {}).get('value', 'unknown')
    if state == 'unknown':
        debug_script = """
        (function() {
            var inputs = Array.from(document.querySelectorAll('input')).map(function(i) {
                return {
                    tag: i.tagName,
                    type: i.type,
                    id: i.id,
                    name: i.name,
                    placeholder: i.placeholder,
                    autocomplete: i.getAttribute('autocomplete'),
                    className: i.className
                };
            });
            var headings = Array.from(document.querySelectorAll('h1, h2, h3, label')).map(function(h) {
                return (h.innerText || h.textContent || '').trim().substring(0, 100);
            });
            return JSON.stringify({
                url: window.location.href,
                title: document.title,
                inputs: inputs,
                headings: headings
            });
        })()
        """
        dbg_res = ws.call('Runtime.evaluate', {'expression': debug_script, 'returnByValue': True})
        dbg_val = (dbg_res.get('result') or {}).get('value', '{}')
        print("DEBUG_INFO:" + dbg_val)
    print(state)
    ws.close()
except Exception as e:
    print('unknown')
