// lib/pageState.js — Page state & navigation status detection
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getNavReady } = require('./utils');

// ─── /nav-status Handler ───
function handleNavStatus(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: getNavReady() }));
}

// ─── /check-page-state Handler ───
function handleCheckPageState(req, res) {
    const pyCheck = String.raw`
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
    g_page = next((t for t in tabs if t.get('type')=='page' and 'accounts.google.com' in t.get('url','').lower()), None)
    page = g_page or next((t for t in tabs if t.get('type')=='page' and 'devtools://' not in t.get('url','')), None)
    if not page: print('unknown'); sys.exit(0)
    ws = WS(page['webSocketDebuggerUrl'])
    script = """
    (function() {
        var url = window.location.href;
        
        var isVisible = function(el) {
            return el && el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0 && el.getAttribute('aria-hidden') !== 'true';
        };

        // 1. Google Sign-In Detection
        if (url.indexOf('accounts.google.com') !== -1) {
            var pwdInp = document.querySelector('input[type="password"]') || document.querySelector('input[name="Passwd"]');
            if (pwdInp && isVisible(pwdInp)) return 'google_password_screen';

            var idInp = document.querySelector('#identifierId') || document.querySelector('input[type="email"]') || document.querySelector('input[name="identifier"]');
            if (idInp && isVisible(idInp)) return 'google_email_screen';

            return 'google_loading';
        }

        // 2. Logged In Check
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
        if (isLoggedIn) return 'logged_in';

        // 3. Captcha Check
        var hasCaptcha = (
            document.querySelector('iframe[src*="captcha"]') !== null ||
            document.querySelector('iframe[src*="recaptcha"]') !== null ||
            document.querySelector('iframe[src*="arkose"]') !== null ||
            document.querySelector('iframe[src*="funcaptcha"]') !== null ||
            document.querySelector('.g-recaptcha') !== null ||
            document.querySelector('[class*="captcha"]') !== null ||
            document.title.toLowerCase().indexOf('captcha') !== -1
        );
        if (hasCaptcha) return 'captcha';

        // 4. Phone Screen Check (HIGH PRIORITY: "What's your number?")
        var hasExplicitPhoneHeading = (function() {
            var els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, label, legend'));
            return els.some(function(el) {
                if (!isVisible(el)) return false;
                var txt = (el.innerText || el.textContent || '').toLowerCase();
                return txt.indexOf("what's your number") !== -1 ||
                       txt.indexOf('my number is') !== -1 ||
                       txt.indexOf('enter your phone number') !== -1 ||
                       txt.indexOf('get your number') !== -1;
            });
        })();
        if (hasExplicitPhoneHeading) return 'phone_screen';

        // 5. Email OTP vs SMS OTP Check (HIGH PRIORITY: "My code is" / OTP screen)
        var emailAddress = '';
        var hasEmailOtpInput = (function() {
            var els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, label, div'));
            return els.some(function(el) {
                if (!isVisible(el)) return false;
                var txt = (el.innerText || el.textContent || '').toLowerCase();
                var rawTxt = (el.innerText || el.textContent || '');
                if (rawTxt.indexOf('@') !== -1) {
                    var m = rawTxt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (m) emailAddress = m[0];
                }
                return txt.indexOf('my code is') !== -1 ||
                       txt.indexOf('resend via email') !== -1 ||
                       (txt.indexOf('passcode to') !== -1 && txt.indexOf('@') !== -1);
            });
        })();
        if (hasEmailOtpInput) return JSON.stringify({ state: 'email_otp_screen', email: emailAddress });

        var phoneAddress = '';
        var hasSmsOtpInput = (function() {
            var els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, label, div, button'));
            return els.some(function(el) {
                if (!isVisible(el)) return false;
                var txt = (el.innerText || el.textContent || '').toLowerCase();
                var rawTxt = (el.innerText || el.textContent || '');
                if (rawTxt.indexOf('+') !== -1 || rawTxt.indexOf('****') !== -1) {
                    var m = rawTxt.match(/(\+\d{1,4}\s*\d{6,12}|\*{4}\s*\d{2,4})/);
                    if (m) phoneAddress = m[0];
                }
                return txt.indexOf('recognize your device') !== -1 ||
                       txt.indexOf('resend via sms') !== -1 ||
                       txt.indexOf('passcode to ****') !== -1 ||
                       txt.indexOf('passcode to +') !== -1 ||
                       (txt.indexOf('trouble logging in') !== -1 && document.querySelectorAll('input').length >= 4);
            });
        })();
        if (hasSmsOtpInput) return JSON.stringify({ state: 'sms_otp_screen', phone: phoneAddress });

        // 6. Email Rate Limit Check (on Email Input screen)
        var hasEmailRateLimit = (function() {
            var els = Array.from(document.querySelectorAll('div, p, span, h1, h2, h3'));
            return els.some(function(e) {
                if (!isVisible(e)) return false;
                var txt = (e.innerText || e.textContent || '').toLowerCase();
                return txt.indexOf('too many attempts') !== -1 ||
                       txt.indexOf('wait up to one minute') !== -1 ||
                       txt.indexOf('wait a minute') !== -1 ||
                       txt.indexOf('please wait') !== -1 ||
                       txt.indexOf('try again later') !== -1;
            });
        })();
        if (hasEmailRateLimit) return 'email_rate_limited';

        // 7. Email Screen Check (HIGH PRIORITY: "What's your email?")
        var hasExplicitEmailHeading = (function() {
            var els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, label, legend'));
            return els.some(function(el) {
                if (!isVisible(el)) return false;
                var txt = (el.innerText || el.textContent || '').toLowerCase();
                return txt.indexOf("what's your email") !== -1 ||
                       txt.indexOf('enter email') !== -1 ||
                       txt.indexOf('verify your email') !== -1 ||
                       txt.indexOf('account recovery') !== -1 ||
                       txt.indexOf("we'll email you a link") !== -1;
            });
        })();
        if (hasExplicitEmailHeading) return 'email_screen';

        // 8. General OTP Check
        var hasOtpInput = (
            url.indexOf('confirm-phone') !== -1 ||
            document.querySelector('input[autocomplete="one-time-code"]') !== null ||
            document.querySelector('input[name="code"]') !== null ||
            document.querySelector('input[id="code"]') !== null ||
            (document.querySelectorAll('input').length >= 4 && (function() {
                var els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, label'));
                return els.some(function(e) {
                    if (!isVisible(e)) return false;
                    var txt = (e.innerText || e.textContent || '').toLowerCase();
                    return txt.indexOf('passcode') !== -1 || txt.indexOf('verification code') !== -1 || txt.indexOf('code we sent') !== -1 || txt.indexOf('enter code') !== -1;
                });
            })())
        );
        if (hasOtpInput) return 'otp_screen';

        // 9. Email Waiting Check ("Check your email")
        var hasEmailWaiting = (function() {
            var els = Array.from(document.querySelectorAll('h1, h2, h3, p, span, div'));
            return els.some(function(el) {
                if (!isVisible(el)) return false;
                var txt = (el.innerText || el.textContent || '').toLowerCase();
                return txt.indexOf('check your email') !== -1 || txt.indexOf("didn't receive a link") !== -1 || txt.indexOf('email sent') !== -1;
            });
        })();
        if (hasEmailWaiting) return 'waiting_email';

        // 10. Phone Input Check (by input field)
        var hasPhoneInput = (
            document.querySelector('input[name="phone_number"]') !== null ||
            document.querySelector('input[id="phone_number"]') !== null ||
            document.querySelector('input[id="phone-number"]') !== null ||
            (document.querySelectorAll('input').length === 1 && document.querySelector('input[type="tel"]') !== null)
        );
        if (hasPhoneInput) return 'phone_screen';

        // 11. Email Input Check (by input field)
        var hasEmailInput = (
            document.querySelector('input[type="email"]') !== null ||
            document.getElementById('email') !== null ||
            document.querySelector('input[name="email"]') !== null
        );
        if (hasEmailInput) return 'email_screen';

        // 12. Login Options Check
        var hasLoginOptions = (function() {
            var btns = Array.from(document.querySelectorAll('button, a, [role="button"], h1, h2, h3'));
            return btns.some(function(b) {
                if (!isVisible(b)) return false;
                var txt = (b.innerText || b.textContent || '').toLowerCase();
                return txt.indexOf('trouble logging in') !== -1 || txt.indexOf('log in with email') !== -1 || txt.indexOf('log in with phone') !== -1 || txt.indexOf('log in with google') !== -1 || txt.indexOf('log in with facebook') !== -1 || (txt.indexOf('create account') !== -1 && document.querySelector('div[role="dialog"]') !== null);
            });
        })();
        if (hasLoginOptions) return 'login_options';

        return 'unknown';
    })()
    """
    result = ws.call('Runtime.evaluate', {'expression': script.strip(), 'returnByValue': True})
    state = (result.get('result') or {}).get('value', 'unknown')
    print(state)
    ws.close()
except Exception as e:
    print('unknown')
`;
    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tmpPath = path.join(__dirname, '..', `_state_check_${uniqueId}.py`);
    fs.writeFileSync(tmpPath, pyCheck, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/state_check_${uniqueId}.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ state: 'unknown' }));
        return;
      }
      exec(`docker exec neko python3 /tmp/state_check_${uniqueId}.py`, (err, stdout) => {
        exec(`docker exec neko rm -f /tmp/state_check_${uniqueId}.py`, () => {});
        const lines = (stdout || '').split('\n').filter(Boolean);
        let stateObj = { state: 'unknown', email: '' };
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed.startsWith('DEBUG_INFO:')) {
            try {
              if (trimmed.startsWith('{')) {
                stateObj = JSON.parse(trimmed);
              } else {
                stateObj = { state: trimmed, email: '' };
              }
            } catch (_) {
              stateObj = { state: trimmed, email: '' };
            }
          }
        });
        console.log(`[Orchestrator] Page state check: ${stateObj.state} ${stateObj.email ? '(' + stateObj.email + ')' : ''}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stateObj));
      });
    });
}

module.exports = {
  handleNavStatus,
  handleCheckPageState,
};
