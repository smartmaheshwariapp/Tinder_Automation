import json, urllib.request, socket, base64, os

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\r\n"
              f"Host: {p.hostname}:{p.port}\r\n"
              f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
              f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(hs.encode())
        buf = b""
        while b"\r\n\r\n" not in buf: buf += self.sock.recv(4096)
        self._mid = 1; self._buf = b""

    def send(self, data):
        if isinstance(data, str): data = data.encode()
        mask = os.urandom(4); n = len(data)
        if n < 126: hdr = bytes([0x81, 0x80 | n]) + mask
        elif n < 65536: hdr = bytes([0x81, 0xFE]) + n.to_bytes(2,'big') + mask
        else: hdr = bytes([0x81, 0xFF]) + n.to_bytes(8,'big') + mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(hdr + masked)

    def recv_msg(self):
        def read(n):
            while len(self._buf) < n: self._buf += self.sock.recv(4096)
            out, self._buf = self._buf[:n], self._buf[n:]
            return out
        b0, b1 = read(2); n = b1 & 0x7F
        if n == 126: n = int.from_bytes(read(2),'big')
        elif n == 127: n = int.from_bytes(read(8),'big')
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

tabs = http_get('http://localhost:9222/json')
page = next((t for t in tabs if t.get('type')=='page'), None)
ws = WS(page['webSocketDebuggerUrl'])

eval_js = lambda expr: (ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result') or {}).get('value')

classifier = eval_js("""(function(){
    var url = window.location.href;
    var inputs = document.querySelectorAll('input');
    var isMultipleInputs = inputs.length >= 4;
    
    var hasOtpText = (function() {
        var elements = document.querySelectorAll('h1, h2, h3, p, span, label, div');
        for (var i = 0; i < elements.length; i++) {
            var txt = (elements[i].innerText || elements[i].textContent || '').toLowerCase();
            if (txt.indexOf('my code is') !== -1 || 
                txt.indexOf('one-time passcode') !== -1 || 
                txt.indexOf('enter the 6-digit code') !== -1 || 
                txt.indexOf('verification code') !== -1 || 
                txt.indexOf('passcode') !== -1 || 
                txt.indexOf('code we sent') !== -1 || 
                txt.indexOf('resend via email') !== -1 || 
                txt.indexOf('resend') !== -1) {
                return true;
            }
        }
        return false;
    })();

    var hasOtpInput = isMultipleInputs || hasOtpText || url.indexOf('confirm-phone') !== -1 || document.querySelector('input[autocomplete="one-time-code"]') !== null;
    
    var hasPhoneInput = !hasOtpInput && (
        document.querySelector('input[name="phone_number"]') !== null ||
        document.querySelector('input[id="phone_number"]') !== null ||
        document.querySelector('input[id="phone-number"]') !== null ||
        (inputs.length === 1 && document.querySelector('input[type="tel"]') !== null) ||
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

    if (hasOtpInput) return 'otp_screen';
    if (hasPhoneInput) return 'phone_screen';
    return 'unknown';
})()""")

print("Tested Classifier Output:", classifier)
ws.close()
