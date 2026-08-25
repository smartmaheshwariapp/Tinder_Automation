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

# First navigate to /app/profile/edit
ws.call('Page.navigate', {'url': 'https://tinder.com/app/profile/edit'})
time.sleep(3)

extractor_js = r"""
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
    city: null,
    gender: null
  };

  // 1. Textarea Bio
  const textareas = Array.from(document.querySelectorAll('textarea'));
  if (textareas.length > 0 && textareas[0].value) {
    profile.bio = textareas[0].value.trim();
  }

  // 2. Name from "ABOUT <NAME>" or page text
  const h2s = Array.from(document.querySelectorAll('h2, div, span'));
  for (const h of h2s) {
    const txt = (h.innerText || '').trim();
    const m = txt.match(/^ABOUT\s+([A-Za-z0-9_ -]+)$/i);
    if (m) {
      profile.name = m[1].trim();
      break;
    }
  }

  // 3. Name and Age from page header (e.g. "Sanket,\n27")
  const allEl = Array.from(document.querySelectorAll('div, span, a, h1'));
  for (const el of allEl) {
    const t = (el.innerText || '').trim();
    const m = t.match(/^([A-Za-z]+)[,\s]+(\d{2})$/);
    if (m) {
      if (!profile.name) profile.name = m[1].trim();
      if (!profile.age) profile.age = parseInt(m[2]);
      break;
    }
  }

  // 4. H2 Sections on Edit Profile Page
  const editH2s = Array.from(document.querySelectorAll('h2'));
  for (const h2 of editH2s) {
    const heading = (h2.innerText || '').trim().toUpperCase();
    
    // Find sibling container text
    let sibling = h2.nextElementSibling;
    let textAfter = sibling ? (sibling.innerText || '').trim() : '';
    if (!textAfter && h2.parentElement) {
      textAfter = (h2.parentElement.innerText || '').replace(h2.innerText, '').trim();
    }

    if (heading.includes('PASSIONS')) {
      const parent = h2.parentElement || h2.closest('div');
      const pText = parent ? (parent.innerText || '').replace('PASSIONS', '').replace('Update your passions', '').trim() : '';
      if (pText) {
        profile.interests = pText.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      }
    } else if (heading.includes('HEIGHT') && textAfter) {
      profile.height = textAfter.split('\n')[0].trim();
    } else if (heading.includes('RELATIONSHIP GOALS') && textAfter) {
      profile.lookingFor = textAfter.replace('Looking for', '').split('\n')[0].trim();
    } else if (heading.includes('JOB TITLE') && textAfter) {
      profile.job = textAfter.split('\n')[0].trim();
    } else if (heading.includes('COMPANY') && textAfter) {
      profile.job = (profile.job ? profile.job + ' at ' : '') + textAfter.split('\n')[0].trim();
    } else if (heading.includes('SCHOOL') && textAfter) {
      profile.school = textAfter.split('\n')[0].trim();
    } else if (heading.includes('LIVING IN') && textAfter) {
      profile.city = textAfter.split('\n')[0].trim();
    } else if (heading.includes('GENDER') && textAfter) {
      profile.gender = textAfter.split('\n')[0].trim();
    }
  }

  return profile;
})()
"""

res = ws.call('Runtime.evaluate', {'expression': extractor_js, 'returnByValue': True})
val = res.get('result', {}).get('value', {})
print('PARSED_SUCCESS:', json.dumps(val, indent=2))

ws.call('Page.navigate', {'url': 'https://tinder.com/app/recs'})
ws.close()
