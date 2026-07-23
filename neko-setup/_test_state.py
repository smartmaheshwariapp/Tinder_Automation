import urllib.request, json

try:
    resp = urllib.request.urlopen('http://localhost:3001/check-page-state')
    print("Page State Response:", resp.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
