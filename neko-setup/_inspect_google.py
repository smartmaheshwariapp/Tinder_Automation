import json, urllib.request, socket, base64, os

def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=5).read())

class WS:
    def __init__(self, url):
        from urllib.parse import urlparse
        p = urlparse(url)
        self.sock = socket.create_connection((p.hostname, p.port or 80), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode()
        hs = (f"GET {p.path} HTTP/1.1\r\nHost: {p.hostname}:{p.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
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
print("Tabs:", json.dumps(tabs, indent=2))
for t in tabs:
    if t.get('type') == 'page':
        try:
            ws = WS(t['webSocketDebuggerUrl'])
            eval_js = lambda expr: (ws.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True}).get('result') or {}).get('value')
            info = eval_js("""(function(){
                var all = Array.from(document.querySelectorAll('*'));
                var googleEls = all.filter(el => {
                    var txt = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
                    return txt.includes('google');
                }).map(el => ({
                    tagName: el.tagName,
                    id: el.id,
                    className: el.className,
                    innerText: (el.innerText || el.textContent || '').substring(0, 100),
                    ariaLabel: el.getAttribute('aria-label'),
                    rect: el.getBoundingClientRect(),
                    isIframe: el.tagName === 'IFRAME',
                    src: el.src || ''
                }));
                return { url: window.location.href, title: document.title, googleEls: googleEls };
            })()""")
            print(f"Tab {t['id']} ({t.get('url')}):", json.dumps(info, indent=2))
            ws.close()
        except Exception as e:
            print(f"Error inspecting tab {t['id']}: {e}")
