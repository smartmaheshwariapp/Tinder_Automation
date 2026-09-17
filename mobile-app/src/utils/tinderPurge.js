/**
 * src/utils/tinderPurge.js
 * Master session purge script generation for Tinder WebView.
 * Handles server-side token revocation across api.gotinder.com and origin,
 * in-page DOM logout button clicking, storage wiping, cookie purging,
 * and immediate landing navigation to prevent 401 error boundary traps.
 */

export function buildMasterPurgeScript(explicitToken = null) {
  return `
(async function() {
  // Re-entrancy guard.
  if (window.__feLogoutInProgress) return;
  window.__feLogoutInProgress = true;

  var LANDING_URL = 'https://tinder.com/?logout=1';

  var bounded = function(promise, ms) {
    return Promise.race([
      Promise.resolve(promise).catch(function() {}),
      new Promise(function(resolve) { setTimeout(resolve, ms); })
    ]);
  };

  var reportLoggedOut = function(purged) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FE_AUTH_STEP',
          step: 'logged_out',
          purged: purged,
          url: window.location.href
        }));
      }
    } catch (_) {}
  };

  var goToLanding = function() {
    try {
      window.location.replace(LANDING_URL);
    } catch (_) {
      try { window.location.href = LANDING_URL; } catch (__) {}
    }
  };

  // 1. Resolve token from passed parameter or exhaustive DOM/storage extraction
  var readAuthToken = function() {
    var explicit = ${JSON.stringify(explicitToken || '')};
    if (explicit && explicit.length >= 16) return explicit;

    try {
      if (window.__tinderAuthToken && typeof window.__tinderAuthToken === 'string' && window.__tinderAuthToken.length >= 16) {
        return window.__tinderAuthToken;
      }

      var token = localStorage.getItem('TinderWeb/APIToken');
      if (token) return String(token).replace(/^["'](.*)["']$/, '$1').trim();

      var apiStore = localStorage.getItem('TinderWeb/APIStore');
      if (apiStore) {
        try {
          var parsed = JSON.parse(apiStore);
          var tok = parsed.token || parsed.auth_token || (parsed.user && parsed.user.api_token);
          if (tok) return String(tok).replace(/^["'](.*)["']$/, '$1').trim();
        } catch (_) {}
      }

      var persistRoot = localStorage.getItem('persist:root');
      if (persistRoot) {
        try {
          var rootObj = JSON.parse(persistRoot);
          if (rootObj && rootObj.auth) {
            var authObj = typeof rootObj.auth === 'string' ? JSON.parse(rootObj.auth) : rootObj.auth;
            var rTok = authObj && (authObj.apiToken || authObj.token || authObj.authToken || authObj.api_token);
            if (rTok) return String(rTok).replace(/^["'](.*)["']$/, '$1').trim();
          }
        } catch (_) {}
      }

      var persistAuth = localStorage.getItem('persist:auth');
      if (persistAuth) {
        try {
          var authObj2 = typeof persistAuth === 'string' ? JSON.parse(persistAuth) : persistAuth;
          var rTok2 = authObj2 && (authObj2.apiToken || authObj2.token || authObj2.authToken || authObj2.api_token);
          if (rTok2) return String(rTok2).replace(/^["'](.*)["']$/, '$1').trim();
        } catch (_) {}
      }

      var tokenKeyRegex = /(?:api|auth).*token/i;
      var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (tokenKeyRegex.test(key) || key.indexOf('APIToken') !== -1) {
          var val = localStorage.getItem(key);
          if (val) {
            var cleanVal = String(val).replace(/^["'](.*)["']$/, '$1').trim();
            if (uuidRegex.test(cleanVal) || cleanVal.length >= 20) return cleanVal;
          }
        }
      }
    } catch (_) {}
    return null;
  };

  // 2. Revoke session server-side across api.gotinder.com and origin with credentials: 'include'
  var revokeSessionServerSide = function(token) {
    var headers = {
      'Content-Type': 'application/json',
      'platform': 'web',
      'app-version': '1043200'
    };
    if (token) headers['x-auth-token'] = token;

    var endpoints = [
      'https://api.gotinder.com/v2/auth/logout',
      'https://api.gotinder.com/auth/logout',
      (window.location.origin || 'https://tinder.com') + '/v2/auth/logout',
      (window.location.origin || 'https://tinder.com') + '/auth/logout'
    ];

    var calls = endpoints.map(function(url) {
      return fetch(url, {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: '{}'
      }).catch(function() {});
    });

    return Promise.allSettled(calls);
  };

  // 3. Purge document cookies across all domains and paths
  var purgeCookies = function() {
    var names = [];
    var raw = document.cookie.split(';');
    for (var c = 0; c < raw.length; c++) {
      var cookie = raw[c].trim();
      if (!cookie) continue;
      var eq = cookie.indexOf('=');
      var name = eq > -1 ? cookie.substring(0, eq).trim() : cookie;
      if (name && names.indexOf(name) === -1) names.push(name);
    }

    var known = [
      'app_session', 'app_session_id', 'auth_token', 'tinder_web_token',
      'refresh_token', '_session', 'session_id', 'x-auth-token',
      'persistent', 'is_authenticated', '_gat', '_gid', '_ga',
      'user_id', 'tok'
    ];
    for (var k = 0; k < known.length; k++) {
      if (names.indexOf(known[k]) === -1) names.push(known[k]);
    }

    var host = window.location.hostname;
    var domains = ['', host, '.' + host, '.tinder.com', 'tinder.com', '.gotinder.com', 'gotinder.com', 'auth.gotinder.com', '.auth.gotinder.com'];
    var paths = ['/', '/app', '/app/', '/app/login', '/v2'];
    var expired = '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=';

    for (var n = 0; n < names.length; n++) {
      for (var d = 0; d < domains.length; d++) {
        for (var p = 0; p < paths.length; p++) {
          try {
            document.cookie = names[n] + expired + paths[p] + (domains[d] ? ';domain=' + domains[d] : '');
          } catch (_) {}
        }
      }
    }
  };

  // 4. In-page DOM logout attempt if native Tinder buttons are present
  var tryDomLogout = function() {
    try {
      var allButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      var logoutBtn = allButtons.find(function(b) {
        var t = (b.innerText || b.textContent || '').trim().toLowerCase();
        var a = (b.getAttribute('aria-label') || '').trim().toLowerCase();
        return t === 'log out' || t === 'logout' || a === 'log out' || a === 'logout';
      });
      if (logoutBtn) {
        logoutBtn.click();
        setTimeout(function() {
          var confirmBtns = Array.from(document.querySelectorAll('div[role="dialog"] button, [data-testid*="logout" i], [aria-label*="log out" i]'));
          var confirm = confirmBtns.find(function(b) {
            var ct = (b.innerText || b.textContent || '').trim().toLowerCase();
            return ct === 'log out' || ct === 'logout';
          });
          if (confirm) confirm.click();
        }, 100);
      }
    } catch (_) {}
  };

  var purged = false;
  try {
    tryDomLogout();

    var token = readAuthToken();
    if (token) {
      await bounded(revokeSessionServerSide(token), 2500);
    } else {
      await bounded(revokeSessionServerSide(null), 1200);
    }

    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    try {
      if (window.chrome && window.chrome.storage && window.chrome.storage.local) {
        window.chrome.storage.local.clear();
      }
    } catch (_) {}
    try { purgeCookies(); } catch (_) {}

    try {
      if (window.indexedDB) {
        ['keyval-store', 'localforage', 'tinder-web', 'tinder', 'sw-precache', 'workbox-expiration'].forEach(function(db) {
          try { indexedDB.deleteDatabase(db); } catch (_) {}
        });
      }
    } catch (_) {}

    purged = true;
  } catch (error) {
    console.warn('[FlirtEasy] Master purge failed:', error);
  }

  reportLoggedOut(purged);

  // Navigate IMMEDIATELY to clean landing URL to dismount Tinder SPA before
  // background polling triggers an "Uh Oh! Something went wrong" error boundary!
  goToLanding();

  setTimeout(function() { window.__feLogoutInProgress = false; }, 5000);
})();
true;
`;
}

export const MASTER_PURGE_SCRIPT = buildMasterPurgeScript(null);
