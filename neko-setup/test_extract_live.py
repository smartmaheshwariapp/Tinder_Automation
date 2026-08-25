import json, urllib.request, socket, base64, sys, os, time
from urllib.parse import urlparse

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=25)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\r\nHost: {p.hostname}:{p.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(hs.encode())
        buf = b""
        while b"\r\n\r\n" not in buf: buf += self.sock.recv(4096)
        self._mid = 1
        self._buf = b""

    def send(self, data):
        if isinstance(data, str): data = data.encode()
        mask = os.urandom(4)
        n = len(data)
        if n < 126: hdr = bytes([0x81, 0x80 | n]) + mask
        elif n < 65536: hdr = bytes([0x81, 0xFE]) + n.to_bytes(2,'big') + mask
        else: hdr = bytes([0x81, 0xFF]) + n.to_bytes(8,'big') + mask
        self.sock.sendall(hdr + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

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
        self.send(json.dumps({'id': mid, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(self.recv_msg())
            if msg.get('id') == mid: return msg.get('result', {})

    def close(self):
        try: self.sock.close()
        except: pass

tabs = http_get('http://localhost:9222/json')
tinder_page = next((t for t in tabs if t.get('type') == 'page' and 'tinder.com' in t.get('url', '')), None)
ws = WS(tinder_page['webSocketDebuggerUrl'])

ws.call('Page.navigate', {'url': 'https://tinder.com/app/profile/edit'})
time.sleep(3)

extractor_js = """
(function() {
  const profile = {
    name: null,
    age: null,
    bio: null,
    interests: [],
    height: null,
    lookingFor: null,
    job: null,
    school: null,
    city: null
  };

  // 1. Textarea extraction (Bio)
  const textareas = Array.from(document.querySelectorAll('textarea'));
  if (textareas.length > 0 && textareas[0].value) {
    profile.bio = textareas[0].value.trim();
  }

  // 2. Sections scan on /app/profile/edit
  const allElements = Array.from(document.querySelectorAll('*'));
  for (let i = 0; i < allElements.length; i++) {
    const text = (allElements[i].textContent || '').trim();
    
    // ABOUT <NAME> header
    const aboutMatch = text.match(/^ABOUT\\s+([A-Z0-9_ -]+)$/i);
    if (aboutMatch && !profile.name) {
      profile.name = aboutMatch[1].trim();
    }
  }

  // 3. Structured sections scan (Passions / Height / Looking For / etc.)
  const headings = Array.from(document.querySelectorAll('div, h2, h3, h4, span')).filter(el => el.children.length === 0);
  for (const h of headings) {
    const txt = (h.textContent || '').trim().toUpperCase();
    const parent = h.parentElement;
    if (!parent) continue;
    const siblingText = (parent.textContent || '').replace(h.textContent, '').trim();

    if (txt === 'PASSIONS' && siblingText) {
      profile.interests = siblingText.split(/[,\\n]+/).map(s => s.trim()).filter(Boolean);
    } else if (txt === 'HEIGHT' && siblingText) {
      profile.height = siblingText;
    } else if (txt === 'RELATIONSHIP GOALS' && siblingText) {
      profile.lookingFor = siblingText.replace('Looking for', '').trim();
    } else if (txt === 'JOB TITLE' && siblingText) {
      profile.job = siblingText;
    } else if (txt === 'COMPANY' && siblingText) {
      profile.job = (profile.job ? profile.job + ' at ' : '') + siblingText;
    } else if (txt === 'SCHOOL' && siblingText) {
      profile.school = siblingText;
    } else if (txt === 'CITY' && siblingText) {
      profile.city = siblingText;
    }
  }

  return profile;
})()
"""

res = ws.call('Runtime.evaluate', {'expression': extractor_js, 'returnByValue': True})
print('LIVE_EXTRACTED_PROFILE:', json.dumps(res.get('result', {}).get('value', {}), indent=2))

ws.call('Page.navigate', {'url': 'https://tinder.com/app/recs'})
ws.close()
