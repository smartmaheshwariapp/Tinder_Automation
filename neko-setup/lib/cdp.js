// lib/cdp.js — CDP (Chrome DevTools Protocol) Python bridge utilities
'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Shared Python WS (WebSocket) class template ───
// This eliminates the 12+ duplicated WS class definitions across the codebase
const PYTHON_WS_CLASS = String.raw`
import json, urllib.request, socket, base64, sys, os, time

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
`;

// ─── Run a Python script inside the Neko container ───
function runPythonInContainer(pyScript, opts = {}) {
  const { prefix = '_cdp', timeout = 30000 } = opts;
  return new Promise((resolve, reject) => {
    const uniqueId = Date.now() + '_' + Math.floor(Math.random() * 10000);
    const tmpPath = path.join(__dirname, '..', `${prefix}_${uniqueId}.py`);
    fs.writeFileSync(tmpPath, pyScript, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/${prefix}_${uniqueId}.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) {
        resolve({ error: cpErr.message, stdout: '', stderr: '' });
        return;
      }
      exec(`docker exec neko python3 /tmp/${prefix}_${uniqueId}.py`, { timeout }, (err, stdout, stderr) => {
        exec(`docker exec neko rm -f /tmp/${prefix}_${uniqueId}.py`, () => {});
        resolve({ error: err ? err.message : null, stdout: stdout || '', stderr: stderr || '' });
      });
    });
  });
}

// ─── Execute JS in Container via CDP ───
function executeJSInContainer(jsCode) {
  return new Promise((resolve) => {
    const pyScript = PYTHON_WS_CLASS + `
try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type')=='page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        ws.call('Runtime.evaluate', {'expression': ${JSON.stringify(jsCode)}, 'returnByValue': True})
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const tmpPath = path.join(__dirname, '..', '_focus_tmp.py');
    fs.writeFileSync(tmpPath, pyScript, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/focus.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) { resolve(); return; }
      exec(`docker exec neko python3 /tmp/focus.py`, () => {
        resolve();
      });
    });
  });
}

// ─── Click Element in Container via CDP (Physical Click) ───
function clickElementInContainer(selector) {
  return new Promise((resolve) => {
    const pyScript = PYTHON_WS_CLASS + `
try:
    tabs = http_get('http://localhost:9222/json')
    page = next((t for t in tabs if t.get('type')=='page'), None)
    if page:
        ws = WS(page['webSocketDebuggerUrl'])
        
        # Get document and selector nodeId
        doc = ws.call('DOM.getDocument')
        root_node_id = doc['root']['nodeId']
        
        res = ws.call('DOM.querySelector', {'nodeId': root_node_id, 'selector': ${JSON.stringify(selector)}})
        node_id = res.get('nodeId')
        if node_id:
            box = ws.call('DOM.getBoxModel', {'nodeId': node_id})
            if 'model' in box and 'content' in box['model']:
                content = box['model']['content']
                x = (content[0] + content[2] + content[4] + content[6]) / 4
                y = (content[1] + content[3] + content[5] + content[7]) / 4
                
                # physical click
                ws.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
                time.sleep(0.05)
                ws.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1})
                print('CLICKED')
        ws.close()
except Exception as e:
    print('ERROR:' + str(e))
`;
    const tmpPath = path.join(__dirname, '..', '_click_tmp.py');
    fs.writeFileSync(tmpPath, pyScript, 'utf8');
    exec(`docker cp "${tmpPath}" neko:/tmp/click_el.py`, (cpErr) => {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      if (cpErr) { resolve(); return; }
      exec(`docker exec neko python3 /tmp/click_el.py`, () => {
        resolve();
      });
    });
  });
}

module.exports = {
  PYTHON_WS_CLASS,
  runPythonInContainer,
  executeJSInContainer,
  clickElementInContainer,
};
