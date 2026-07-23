import urllib.request, json

req = urllib.request.Request(
    'http://localhost:3001/click-text',
    data=json.dumps({'text': 'google'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    resp = urllib.request.urlopen(req)
    print("Response:", resp.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
