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

parser_js = r"""
(function() {
  const profile = {
    name: null,
    age: null,
    bio: null,
    interests: [],
    height: null,
    lookingFor: null,
    relationshipType: null,
    languages: [],
    zodiac: null,
    education: null,
    familyPlans: null,
    communicationStyle: null,
    loveStyle: null,
    pets: null,
    drinking: null,
    smoking: null,
    workout: null,
    socialMedia: null,
    gender: null,
    job: null,
    school: null,
    city: null
  };

  // 1. Textareas for Bio
  const textareas = Array.from(document.querySelectorAll('textarea'));
  if (textareas.length > 0 && textareas[0].value) {
    profile.bio = textareas[0].value.trim();
  }

  // 2. Full edit page text content
  const pageText = (document.body.innerText || '');

  // Name from "ABOUT <NAME>"
  const nameMatch = pageText.match(/ABOUT\s+([A-Za-z0-9_ -]+)\s*\n/i);
  if (nameMatch) {
    profile.name = nameMatch[1].trim();
  }

  // Passions
  const passionsMatch = pageText.match(/PASSIONS\s*\n([^\n]+)/i);
  if (passionsMatch && !passionsMatch[1].includes('Update your passions')) {
    profile.interests = passionsMatch[1].split(/[,]+/).map(s => s.trim()).filter(Boolean);
  }

  // Height
  const heightMatch = pageText.match(/HEIGHT\s*\n([^\n]+)/i);
  if (heightMatch) {
    profile.height = heightMatch[1].trim();
  }

  // Relationship Goals
  const relGoalsMatch = pageText.match(/RELATIONSHIP GOALS\s*\n(?:Looking for\s*\n)?([^\n]+)/i);
  if (relGoalsMatch) {
    profile.lookingFor = relGoalsMatch[1].trim();
  }

  // Relationship Type
  const relTypeMatch = pageText.match(/RELATIONSHIP TYPE\s*\n(?:Open to\.\.\.\s*\n)?([^\n]+)/i);
  if (relTypeMatch) {
    profile.relationshipType = relTypeMatch[1].trim();
  }

  // Languages
  const langMatch = pageText.match(/LANGUAGES I KNOW\s*\n(?:Add languages\s*\n)?([^\n]+)/i);
  if (langMatch && !langMatch[1].includes('BASICS')) {
    profile.languages = langMatch[1].split(/[,]+/).map(s => s.trim()).filter(Boolean);
  }

  // Basics: Zodiac, Education, Family Plans, Communication Style, Love Style
  const basicsMatch = pageText.match(/BASICS\s*\n([\s\S]*?)LIFESTYLE/i);
  if (basicsMatch) {
    const bText = basicsMatch[1];
    const zodiacM = bText.match(/Zodiac\s*\n([^\n]+)/i);
    if (zodiacM) profile.zodiac = zodiacM[1].trim();
    const eduM = bText.match(/Education\s*\n([^\n]+)/i);
    if (eduM) profile.education = eduM[1].trim();
    const familyM = bText.match(/Family Plans\s*\n([^\n]+)/i);
    if (familyM) profile.familyPlans = familyM[1].trim();
    const commM = bText.match(/Communication Style\s*\n([^\n]+)/i);
    if (commM) profile.communicationStyle = commM[1].trim();
    const loveM = bText.match(/Love Style\s*\n([^\n]+)/i);
    if (loveM) profile.loveStyle = loveM[1].trim();
  }

  // Lifestyle: Pets, Drinking, Smoking, Workout, Social Media
  const lifeMatch = pageText.match(/LIFESTYLE\s*\n([\s\S]*?)JOB TITLE/i);
  if (lifeMatch) {
    const lText = lifeMatch[1];
    const petsM = lText.match(/Pets\s*\n([^\n]+)/i);
    if (petsM) profile.pets = petsM[1].trim();
    const drinkM = lText.match(/Drinking\s*\n([^\n]+)/i);
    if (drinkM) profile.drinking = drinkM[1].trim();
    const smokeM = lText.match(/Smoking\s*\n([^\n]+)/i);
    if (smokeM) profile.smoking = smokeM[1].trim();
    const workoutM = lText.match(/Workout\s*\n([^\n]+)/i);
    if (workoutM) profile.workout = workoutM[1].trim();
    const socialM = lText.match(/Social Media\s*\n([^\n]+)/i);
    if (socialM) profile.socialMedia = socialM[1].trim();
  }

  // Gender
  const genderMatch = pageText.match(/GENDER\s*\n([^\n]+)/i);
  if (genderMatch && !genderMatch[1].includes('Update your gender')) {
    profile.gender = genderMatch[1].trim();
  }

  return profile;
})()
"""

res = ws.call('Runtime.evaluate', {'expression': parser_js, 'returnByValue': True})
print('PARSED_PERFECT_PROFILE:', json.dumps(res.get('result', {}).get('value', {}), indent=2))

ws.call('Page.navigate', {'url': 'https://tinder.com/app/recs'})
ws.close()
