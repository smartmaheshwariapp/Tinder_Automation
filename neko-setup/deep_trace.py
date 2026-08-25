import json, urllib.request, socket, base64, sys, os, time
from urllib.parse import urlparse

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=35)
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

targets = http_get('http://localhost:9222/json')
sw = next((t for t in targets if t.get('type') == 'service_worker' and 'kpmmkcndeankkhfljfbaflhiogkfmhnk' in t.get('url', '')), None)
ws = WS(sw['webSocketDebuggerUrl'])

test_js = """
(async function() {
  const trace = [];
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.tinder.com/*' });
    const tabId = tabs[0].id;
    trace.push('Tab id: ' + tabId);

    // Call fetchUserProfile and also get its internal logs
    trace.push('Before fetchUserProfile call');
    const result = await fetchUserProfile(tabId);
    trace.push('After fetchUserProfile call: ' + JSON.stringify(result));

    return { trace, result };
  } catch(e) {
    trace.push('Catch error: ' + e.message + ' stack: ' + e.stack);
    return { trace, error: e.message };
  }
})()
"""

res = ws.call('Runtime.evaluate', {'expression': test_js, 'awaitPromise': True, 'returnByValue': True})
print('FETCH_TRACE:', json.dumps(res, indent=2))
ws.close()
