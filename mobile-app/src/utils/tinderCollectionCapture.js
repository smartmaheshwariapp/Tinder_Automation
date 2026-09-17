// Observe successful Tinder requests in the on-device WebView. This never triggers actions.
export function installCollectionCapture() {
  if (window.__flintCollectionCapture) return;
  window.__flintCollectionCapture = true;
  const profiles = new Map();
  const emit = (event, sessionToken) => { try { window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'FE_COLLECTION_EVENT', event, sessionToken })); } catch (_) {} };
  const remember = raw => { const profile = raw?.user || raw?.person || raw; if (profile?._id) { profiles.set(profile._id, profile); if (profiles.size > 500) profiles.delete(profiles.keys().next().value); } };
  const inspect = (url, data, sessionToken) => {
    try {
      const parsed = new URL(url, location.href);
      if (parsed.hostname !== 'api.gotinder.com') return;
      const path = parsed.pathname;
      if (path.includes('/recs')) (data?.data?.results || data?.results || []).forEach(remember);
      if (path === '/v2/matches') { const matches = data?.data?.matches || []; matches.forEach(match => remember(match.person)); emit({ kind: 'matches', matches }, sessionToken); }
      const messages = path.match(/^\/v2\/matches\/([^/]+)\/messages/);
      if (messages) emit({ kind: 'messages', matchId: messages[1], messages: data?.data?.messages || data?.messages || (data?._id ? [data] : []) }, sessionToken);
      const swipe = path.match(/^\/(like|pass)\/([^/]+)/);
      if (swipe && data?.error == null && data?.status !== 429 && data?.rate_limited !== true) emit({ kind: 'swipe', action: swipe[1], profileId: swipe[2], profile: profiles.get(swipe[2]) || { _id: swipe[2] }, matched: Boolean(data.match), timestamp: Date.now() }, sessionToken);
    } catch (_) {}
  };
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const headers = new Headers(init?.headers || input?.headers || {});
    const sessionToken = headers.get('x-auth-token') || window.__tinderAuthToken;
    const response = await originalFetch.apply(this, arguments);
    const url = typeof input === 'string' ? input : input?.url;
    if (response.ok && url) response.clone().json().then(data => inspect(url, data, sessionToken)).catch(() => {});
    return response;
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) { this.__flintCollectionRequest = { method, url }; return originalOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function() {
    const sessionToken = window.__tinderAuthToken;
    this.addEventListener('load', () => { try { if (this.status >= 200 && this.status < 300) { const data = this.responseType === 'json' ? this.response : JSON.parse(this.responseText); inspect(this.__flintCollectionRequest?.url, data, sessionToken); } } catch (_) {} });
    return originalSend.apply(this, arguments);
  };
}

export const collectionCaptureScript = `(${installCollectionCapture.toString()})();true;`;

export function createSwipeEventFromDomMessage(message, timestamp = Date.now()) {
  const name = typeof message?.name === 'string' && message.name.trim() ? message.name.trim().slice(0, 100) : 'Tinder profile';
  const id = message?.profileId || message?.id || `dom_${timestamp}_${Number(message?.swipeCount) || 0}`;
  const photoUrl = typeof message?.photoUrl === 'string' && message.photoUrl.startsWith('https://') ? message.photoUrl : null;
  return {
    kind: 'swipe', action: message?.action === 'pass' ? 'pass' : 'like', timestamp, matched: Boolean(message?.matched),
    profile: { _id: String(id).slice(0, 100), name, bio: typeof message?.bio === 'string' ? message.bio : (message?.detail || ''), photos: photoUrl ? [{ url: photoUrl }] : [], interests: Array.isArray(message?.interests) ? message.interests : [] },
  };
}
