// mobile-app/src/utils/chromeShim.js
// Chrome Extension Runtime Shim for On-Device Mode
// Polyfills window.chrome so that original FlirtEasy content scripts run
// unmodified inside a React Native WebView.

/**
 * Generates the Chrome Runtime Shim JavaScript to inject into the WebView
 * BEFORE any content scripts load. This creates:
 *   - chrome.runtime.sendMessage  → postMessage bridge to React Native
 *   - chrome.runtime.onMessage    → listener array triggered via injectJavaScript
 *   - chrome.runtime.connect      → mock Port for background ↔ content communication
 *   - chrome.runtime.getURL       → inlined selectors.json, stub for others
 *   - chrome.runtime.id           → truthy string (passes all context checks)
 *   - chrome.storage.local        → localStorage adapter with __fe_ prefix
 *   - chrome.storage.onChanged    → in-memory event emitter
 *
 * @param {Object} selectorsJson - The parsed config/selectors.json object
 * @returns {string} JavaScript source to inject via injectedJavaScriptBeforeContentLoaded
 */
export const generateChromeShim = (selectorsJson, locationOptions = {}) => {
  const selectorsStr = JSON.stringify(selectorsJson);
  const targetLat = typeof locationOptions?.latitude === 'number' ? locationOptions.latitude : 40.7128;
  const targetLon = typeof locationOptions?.longitude === 'number' ? locationOptions.longitude : -74.0060;

  return `
(function() {
  'use strict';
  if (window.__chromeShimLoaded) return;
  window.__chromeShimLoaded = true;

  // Initialize selectors synchronously for instant access
  window.SELECTORS = ${selectorsStr};

  // ── Touch & Cookie Overlay Defense ──
  // Immediately disables touch-blocking OneTrust backdrops and enables smooth scrolling
  try {
    var _antiOverlayStyle = document.createElement('style');
    _antiOverlayStyle.id = '__fe_touch_defense';
    _antiOverlayStyle.textContent = [
      '#onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter, .ot-fade-in {',
      '  display: none !important;',
      '  opacity: 0 !important;',
      '  pointer-events: none !important;',
      '  visibility: hidden !important;',
      '  z-index: -9999 !important;',
      '  height: 0 !important;',
      '  width: 0 !important;',
      '}',
      '#onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter, .ot-fade-in {',
      '  display: none !important;',
      '  opacity: 0 !important;',
      '  pointer-events: none !important;',
      '  visibility: hidden !important;',
      '  z-index: -9999 !important;',
      '  height: 0 !important;',
      '  width: 0 !important;',
      '}',
      'body.fe-login-modal-active #rebrand-mobile-menu,',
      'body:has([aria-labelledby="MODAL_LOGIN"]) #rebrand-mobile-menu {',
      '  display: none !important;',
      '  pointer-events: none !important;',
      '  visibility: hidden !important;',
      '  z-index: -9999 !important;',
      '}',
      '/* Class-based fallback for :has() — added by JS when login modal is detected */',
      '#rebrand-mobile-menu[aria-modal] {',
      '  pointer-events: none !important;',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '}',
      '.fe-login-ancestor {',
      '  z-index: 9999999 !important;',
      '  pointer-events: auto !important;',
      '}',
      '.StretchedBox:has([aria-labelledby="MODAL_LOGIN"]),',
      '[aria-labelledby="MODAL_LOGIN"],',
      '#modal-manager, .modal-manager-portal, .modal-wrapper {',
      '  z-index: 9999999 !important;',
      '  pointer-events: auto !important;',
      '}',
      '[aria-labelledby="MODAL_LOGIN"] button,',
      '[aria-labelledby="MODAL_LOGIN"] a,',
      '[aria-labelledby="MODAL_LOGIN"] input,',
      '[aria-labelledby="MODAL_LOGIN"] iframe {',
      '  pointer-events: auto !important;',
      '  touch-action: manipulation !important;',
      '  cursor: pointer !important;',
      '}',
      'html, body {',
      '  touch-action: auto !important;',
      '  -webkit-overflow-scrolling: touch !important;',
      '  overflow-y: auto !important;',
      '  pointer-events: auto !important;',
      '}'
    ].join('\\n');
    (document.head || document.documentElement).appendChild(_antiOverlayStyle);

    var _ensureModalInteractive = function() {
      try {
        var loginModal = document.querySelector('[aria-labelledby="MODAL_LOGIN"], [role="dialog"]:not(#rebrand-mobile-menu)');
        if (loginModal) {
          if (document.body && !document.body.classList.contains('fe-login-modal-active')) {
            document.body.classList.add('fe-login-modal-active');
          }
          var menu = document.getElementById('rebrand-mobile-menu');
          if (menu) {
            menu.style.setProperty('display', 'none', 'important');
            menu.style.setProperty('pointer-events', 'none', 'important');
            menu.removeAttribute('aria-modal');
          }
          var box = loginModal.closest('.StretchedBox') || loginModal.parentElement;
          if (box) {
            box.style.setProperty('z-index', '9999999', 'important');
            box.style.setProperty('pointer-events', 'auto', 'important');
          }
          loginModal.style.setProperty('z-index', '9999999', 'important');
          loginModal.style.setProperty('pointer-events', 'auto', 'important');
        } else {
          if (document.body && document.body.classList.contains('fe-login-modal-active')) {
            document.body.classList.remove('fe-login-modal-active');
          }
        }
      } catch(_) {}
    };

    // Our CSS only display:none's #onetrust-consent-sdk, it does not remove it,
    // so this button stays queryable forever. Clicking it on every mutation
    // creates a click -> mutation -> click feedback loop that pegs the main
    // thread and makes the page unresponsive to taps. Click at most once.
    var _consentDone = false;
    var _dismissConsentFast = function() {
      try {
        if (!_consentDone) {
          var btn = document.getElementById('onetrust-accept-btn-handler') ||
                    document.querySelector('#onetrust-consent-sdk button') ||
                    document.querySelector('[data-testid="cookie-accept"]') ||
                    document.querySelector('[aria-label="Accept all"]');
          if (btn) {
            btn.click();
            _consentDone = true;
          }
          var filters = document.querySelectorAll('.onetrust-pc-dark-filter');
          for (var i = 0; i < filters.length; i++) {
            filters[i].style.pointerEvents = 'none';
            filters[i].style.display = 'none';
          }
        }
      } catch(_) {}
      _ensureModalInteractive();
    };
    _dismissConsentFast();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _dismissConsentFast);
    }
    // Throttled: Tinder is a React app that mutates continuously. Running this
    // synchronously per mutation record starves the WebView main thread.
    var _consentTick = null;
    var _consentObs = new MutationObserver(function() {
      if (_consentTick) return;
      _consentTick = setTimeout(function() {
        _consentTick = null;
        _dismissConsentFast();
      }, 300);
    });
    _consentObs.observe(document.documentElement, { childList: true, subtree: true });
  } catch(_) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. CALLBACK REGISTRY — Async bridge for sendMessage responses
  // ═══════════════════════════════════════════════════════════════
  var _nextCallbackId = 1;
  var _pendingCallbacks = {};

  window.__chromeCallbacks = {
    resolve: function(callbackId, data) {
      var cb = _pendingCallbacks[callbackId];
      if (cb) {
        delete _pendingCallbacks[callbackId];
        try { cb(data); } catch(e) { console.warn('[ChromeShim] Callback error:', e); }
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 2. CHROME STORAGE LOCAL — localStorage adapter
  // ═══════════════════════════════════════════════════════════════
  var STORAGE_PREFIX = '__fe_';
  var _storageChangeListeners = [];

  var chromeStorageLocal = {
    get: function(keys, callback) {
      var result = {};
      try {
        var keyList = [];
        if (typeof keys === 'string') keyList = [keys];
        else if (Array.isArray(keys)) keyList = keys;
        else if (keys && typeof keys === 'object') keyList = Object.keys(keys);
        else {
          // null/undefined — return all stored items
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.startsWith(STORAGE_PREFIX)) {
              var realKey = k.substring(STORAGE_PREFIX.length);
              try { result[realKey] = JSON.parse(localStorage.getItem(k)); }
              catch(_) { result[realKey] = localStorage.getItem(k); }
            }
          }
          if (typeof callback === 'function') callback(result);
          return Promise.resolve(result);
        }

        for (var j = 0; j < keyList.length; j++) {
          var raw = localStorage.getItem(STORAGE_PREFIX + keyList[j]);
          if (raw !== null) {
            try { result[keyList[j]] = JSON.parse(raw); }
            catch(_) { result[keyList[j]] = raw; }
          } else if (keys && typeof keys === 'object' && keys[keyList[j]] !== undefined) {
            result[keyList[j]] = keys[keyList[j]]; // default value
          }
        }
      } catch(e) {
        console.warn('[ChromeShim] storage.local.get error:', e);
      }
      if (typeof callback === 'function') callback(result);
      return Promise.resolve(result);
    },

    set: function(items, callback) {
      try {
        var changes = {};
        var keys = Object.keys(items);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var oldRaw = localStorage.getItem(STORAGE_PREFIX + key);
          var oldValue = oldRaw !== null ? JSON.parse(oldRaw) : undefined;
          localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(items[key]));
          changes[key] = { oldValue: oldValue, newValue: items[key] };
        }
        // Fire change listeners
        for (var j = 0; j < _storageChangeListeners.length; j++) {
          try { _storageChangeListeners[j](changes, 'local'); } catch(_) {}
        }
      } catch(e) {
        console.warn('[ChromeShim] storage.local.set error:', e);
      }
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    },

    remove: function(keys, callback) {
      var keyList = typeof keys === 'string' ? [keys] : keys;
      for (var i = 0; i < keyList.length; i++) {
        localStorage.removeItem(STORAGE_PREFIX + keyList[i]);
      }
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    },

    clear: function(callback) {
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
      }
      for (var j = 0; j < toRemove.length; j++) localStorage.removeItem(toRemove[j]);
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 3. CHROME RUNTIME — Core message passing bridge
  // ═══════════════════════════════════════════════════════════════
  var _onMessageListeners = [];
  var _portMessageListeners = [];
  var _portDisconnectListeners = [];

  // Selectors JSON inlined for chrome.runtime.getURL('config/selectors.json')
  var _inlinedSelectors = ${selectorsStr};
  var _selectorsBlobUrl = null;

  var chromeRuntime = {
    id: 'flirteasy-on-device',
    lastError: null,

    sendMessage: function(message, callback) {
      var callbackId = _nextCallbackId++;
      if (typeof callback === 'function') {
        _pendingCallbacks[callbackId] = callback;
      }

      var p = new Promise(function(resolve) {
        if (typeof callback !== 'function') {
          _pendingCallbacks[callbackId] = resolve;
        }
      });

      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FE_CHROME_MSG',
            _callbackId: callbackId,
            action: message.action,
            payload: message
          }));
        } else {
          // No bridge — resolve with empty
          if (_pendingCallbacks[callbackId]) {
            var cb = _pendingCallbacks[callbackId];
            delete _pendingCallbacks[callbackId];
            cb(null);
          }
        }
      } catch(e) {
        console.warn('[ChromeShim] sendMessage error:', e);
        if (_pendingCallbacks[callbackId]) {
          var cb2 = _pendingCallbacks[callbackId];
          delete _pendingCallbacks[callbackId];
          cb2(null);
        }
      }

      // If caller used callback pattern, return true (MV2 async)
      // If no callback, return Promise (MV3 pattern)
      return typeof callback === 'function' ? true : p;
    },

    getURL: function(path) {
      if (path === 'config/selectors.json') {
        if (!_selectorsBlobUrl) {
          try {
            var blob = new Blob([JSON.stringify(_inlinedSelectors)], { type: 'application/json' });
            _selectorsBlobUrl = URL.createObjectURL(blob);
          } catch(_) {
            _selectorsBlobUrl = 'data:application/json,' + encodeURIComponent(JSON.stringify(_inlinedSelectors));
          }
        }
        return _selectorsBlobUrl;
      }
      // CSS and achievement scripts — return empty data URI
      if (path.endsWith('.css')) {
        return 'data:text/css,';
      }
      if (path.endsWith('.js')) {
        return 'data:text/javascript,';
      }
      return '';
    },

    onMessage: {
      addListener: function(fn) {
        _onMessageListeners.push(fn);
      },
      removeListener: function(fn) {
        _onMessageListeners = _onMessageListeners.filter(function(l) { return l !== fn; });
      },
      hasListener: function(fn) {
        return _onMessageListeners.indexOf(fn) !== -1;
      }
    },

    connect: function(connectInfo) {
      var port = {
        name: (connectInfo && connectInfo.name) || 'flirtEasy',
        onMessage: {
          addListener: function(fn) { _portMessageListeners.push(fn); },
          removeListener: function(fn) {
            _portMessageListeners = _portMessageListeners.filter(function(l) { return l !== fn; });
          }
        },
        onDisconnect: {
          addListener: function(fn) { _portDisconnectListeners.push(fn); },
          removeListener: function(fn) {
            _portDisconnectListeners = _portDisconnectListeners.filter(function(l) { return l !== fn; });
          }
        },
        postMessage: function(msg) {
          // Port messages from content → background
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'FE_PORT_MSG',
                payload: msg
              }));
            }
          } catch(_) {}
        },
        disconnect: function() {
          // no-op — port stays alive
        }
      };

      return port;
    }
  };

  // Dispatch a message to content script onMessage listeners (called from React Native)
  window.__chromeDispatchMessage = function(request, sendResponseFn) {
    for (var i = 0; i < _onMessageListeners.length; i++) {
      try {
        _onMessageListeners[i](request, { id: 'flirteasy-on-device' }, sendResponseFn || function(){});
      } catch(e) {
        console.warn('[ChromeShim] onMessage listener error:', e);
      }
    }
  };

  // Dispatch a port message to content script port listeners (called from React Native)
  window.__chromeDispatchPortMessage = function(message) {
    for (var i = 0; i < _portMessageListeners.length; i++) {
      try { _portMessageListeners[i](message); } catch(e) {
        console.warn('[ChromeShim] port message listener error:', e);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 4. ASSEMBLE window.chrome
  // ═══════════════════════════════════════════════════════════════
  var chromeObj = window.chrome || {};
  chromeObj.app = {
    isInstalled: false,
    InstallState: { DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
    RunningState: { CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" },
    getDetails: function() { return null; },
    getIsInstalled: function() { return false; },
    installState: function(cb) { if (cb) cb("not_installed"); }
  };
  chromeObj.csi = function() {
    return { startE: Date.now(), onloadT: Date.now(), pageT: 1, tran: 15 };
  };
  chromeObj.loadTimes = function() {
    return {
      requestTime: Date.now() / 1000,
      startLoadTime: Date.now() / 1000,
      commitLoadTime: Date.now() / 1000,
      finishDocumentLoadTime: Date.now() / 1000,
      finishLoadTime: Date.now() / 1000,
      firstPaintTime: Date.now() / 1000,
      firstPaintAfterLoadTime: 0,
      navigationType: "Other",
      wasFetchedViaSpdy: false,
      wasNpnNegotiated: false,
      npnNegotiatedProtocol: "",
      wasAlternateProtocolAvailable: false,
      connectionInfo: "http/1.1"
    };
  };
  chromeObj.runtime = chromeRuntime;
  chromeObj.storage = {
    local: chromeStorageLocal,
    sync: chromeStorageLocal, // Alias sync → local (on-device has no sync)
    onChanged: {
      addListener: function(fn) { _storageChangeListeners.push(fn); },
      removeListener: function(fn) {
        _storageChangeListeners = _storageChangeListeners.filter(function(l) { return l !== fn; });
      }
    }
  };

  try {
    window.chrome = chromeObj;
  } catch(_) {
    try {
      Object.defineProperty(window, 'chrome', {
        value: chromeObj,
        configurable: true,
        writable: true,
        enumerable: true
      });
    } catch(_) {}
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. W3C GEOLOCATION & PERMISSIONS POLYFILL
  // ═══════════════════════════════════════════════════════════════
  var _geoCoords = {
    latitude: ${targetLat},
    longitude: ${targetLon},
    altitude: 10.0,
    accuracy: 15.0,
    altitudeAccuracy: 5.0,
    heading: null,
    speed: null
  };

  window.__feSetLocation = function(newLat, newLon, cityName) {
    if (typeof newLat === 'number') _geoCoords.latitude = newLat;
    else if (!isNaN(parseFloat(newLat))) _geoCoords.latitude = parseFloat(newLat);

    if (typeof newLon === 'number') _geoCoords.longitude = newLon;
    else if (!isNaN(parseFloat(newLon))) _geoCoords.longitude = parseFloat(newLon);

    console.log('[FlirtEasy] Geolocation coords updated to:', _geoCoords.latitude, _geoCoords.longitude, cityName || '');

    // 1. Immediately trigger all active watchPosition callbacks with new position
    var newPos = _buildPosition();
    for (var key in _geoWatchers) {
      if (_geoWatchers[key] && typeof _geoWatchers[key].callback === 'function') {
        try { _geoWatchers[key].callback(newPos); } catch(_) {}
      }
    }

    // 2. Dispatch custom event for content scripts / page listeners
    try {
      window.dispatchEvent(new CustomEvent('flirteasy-location-change', {
        detail: {
          latitude: _geoCoords.latitude,
          longitude: _geoCoords.longitude,
          city: cityName || 'Custom'
        }
      }));
    } catch(_) {}

    // 3. Inform React Native HUD
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'FE_LOG',
        text: '📍 Geolocation synced: ' + (cityName ? cityName + ' ' : '') + '(' + _geoCoords.latitude.toFixed(4) + ', ' + _geoCoords.longitude.toFixed(4) + ')',
        logType: 'success'
      }));
    }
  };

  var _geoWatchers = {};
  var _nextGeoWatchId = 1;

  function _buildPosition() {
    var coords = {
      latitude: _geoCoords.latitude,
      longitude: _geoCoords.longitude,
      altitude: null,
      accuracy: 20.0,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    };
    if (typeof GeolocationCoordinates !== 'undefined' && GeolocationCoordinates.prototype) {
      try { Object.setPrototypeOf(coords, GeolocationCoordinates.prototype); } catch(_) {}
    }
    var pos = {
      coords: coords,
      timestamp: Date.now()
    };
    if (typeof GeolocationPosition !== 'undefined' && GeolocationPosition.prototype) {
      try { Object.setPrototypeOf(pos, GeolocationPosition.prototype); } catch(_) {}
    }
    return pos;
  }

  var mockGeolocation = {
    getCurrentPosition: function(success, error, options) {
      if (typeof success !== 'function') return;
      var execute = function() {
        try {
          var pos = _buildPosition();
          success(pos);
        } catch(e) {
          console.warn('[ChromeShim] getCurrentPosition callback error:', e);
          if (typeof error === 'function') {
            try { error({ code: 2, message: e.message || 'Position unavailable', POSITION_UNAVAILABLE: 2 }); } catch(_) {}
          }
        }
      };
      setTimeout(execute, 0);
    },

    watchPosition: function(success, error, options) {
      var wid = _nextGeoWatchId++;
      if (typeof success === 'function') {
        setTimeout(function() {
          try { success(_buildPosition()); } catch(_) {}
        }, 10);
        var timerId = setInterval(function() {
          try { success(_buildPosition()); } catch(_) {}
        }, 10000);
        _geoWatchers[wid] = {
          callback: success,
          timer: timerId
        };
      }
      return wid;
    },

    clearWatch: function(wid) {
      if (_geoWatchers[wid]) {
        if (_geoWatchers[wid].timer) {
          clearInterval(_geoWatchers[wid].timer);
        }
        delete _geoWatchers[wid];
      }
    }
  };

  try {
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch(e) {
    try {
      if (window.Navigator && window.Navigator.prototype) {
        Object.defineProperty(window.Navigator.prototype, 'geolocation', {
          get: function() { return mockGeolocation; },
          configurable: true,
          enumerable: true
        });
      }
    } catch(e2) {
      navigator.geolocation = mockGeolocation;
    }
  }

  // ── W3C Permissions Query Polyfill (Auto-grant Geolocation & Notifications) ──
  try {
    var _createPermissionStatus = function(name, state) {
      var status = {
        state: state || 'granted',
        name: name,
        onchange: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return false; }
      };
      if (typeof PermissionStatus !== 'undefined' && PermissionStatus.prototype) {
        try { Object.setPrototypeOf(status, PermissionStatus.prototype); } catch(_) {}
      }
      return status;
    };

    var _customQuery = function(queryObj) {
      var name = (queryObj && queryObj.name) || '';
      if (name === 'geolocation' || name === 'notifications') {
        return Promise.resolve(_createPermissionStatus(name, 'granted'));
      }
      if (navigator.permissions && typeof navigator.permissions._origQuery === 'function') {
        try {
          return navigator.permissions._origQuery(queryObj);
        } catch(_) {}
      }
      return Promise.resolve(_createPermissionStatus(name, 'prompt'));
    };

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      var _origQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions._origQuery = _origQuery;
      try {
        navigator.permissions.query = _customQuery;
      } catch(e) {
        try {
          Object.defineProperty(navigator.permissions, 'query', {
            value: _customQuery,
            configurable: true,
            writable: true
          });
        } catch(_) {}
      }
    } else {
      var mockPermissions = {
        query: _customQuery
      };
      try {
        Object.defineProperty(navigator, 'permissions', {
          value: mockPermissions,
          configurable: true,
          writable: true,
          enumerable: true
        });
      } catch(_) {
        navigator.permissions = mockPermissions;
      }
    }
  } catch(e) {
    console.warn('[ChromeShim] navigator.permissions mock error:', e);
  }

  // ── Stealth Anti-Bot Safeguard ──
  try {
    if (navigator.webdriver !== undefined) {
      try { delete navigator.__proto__.webdriver; } catch(_) {}
      try {
        Object.defineProperty(navigator, 'webdriver', {
          get: function() { return undefined; },
          configurable: true
        });
      } catch(_) {}
    }
  } catch(_) {}

  // ═══════════════════════════════════════════════════════════════
  // 6. TINDER LOCATION ROADBLOCK AUTO-RESOLVER
  // ═══════════════════════════════════════════════════════════════
  (function() {
    var _dismissCheckCount = 0;
    var _locationDismissInterval = setInterval(function() {
      _dismissCheckCount++;
      if (_dismissCheckCount > 40) { // Run for first 20 seconds
        clearInterval(_locationDismissInterval);
        return;
      }
      try {
        var dialogs = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="overlay"]');
        for (var d = 0; d < dialogs.length; d++) {
          var dlg = dialogs[d];
          var dlgText = (dlg.innerText || '').toLowerCase();
          // ONLY target location permission modals — ignore login, terms, account modals
          if (
            (dlgText.includes('location') || dlgText.includes('nearby') || dlgText.includes('where you are')) &&
            !dlgText.includes('log in') &&
            !dlgText.includes('terms') &&
            !dlgText.includes('get started') &&
            !dlgText.includes('trouble logging')
          ) {
            var buttons = dlg.querySelectorAll('button, [role="button"]');
            for (var i = 0; i < buttons.length; i++) {
              var btn = buttons[i];
              var txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
              var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              if (
                txt === 'allow' ||
                txt === 'enable location' ||
                txt === 'share location' ||
                txt === 'allow location' ||
                txt === 'continue' ||
                txt === 'i understand' ||
                aria.includes('enable location') ||
                aria.includes('share location') ||
                aria.includes('allow location')
              ) {
                console.log('[FlirtEasy] Auto-dismissing Tinder location roadblock button:', txt || aria);
                btn.click();
                clearInterval(_locationDismissInterval);
                return;
              }
            }
          }
        }
      } catch(_) {}
    }, 500);
  })();

  // ═══════════════════════════════════════════════════════════════
  // 7. DEFAULT TO 3-BUTTON LOGIN SCREEN (Mobile Landing Automation)
  // ═══════════════════════════════════════════════════════════════
  (function() {
    if (window.__feTinderLandingHelperRunning) return;
    window.__feTinderLandingHelperRunning = true;

    var _loginTries = 0;

    var isVisible = function(element) {
      if (!element) return false;
      try {
        var rect = element.getBoundingClientRect();
        var style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (rect.width > 0 || rect.height > 0);
      } catch (_) {
        return (element.offsetWidth > 0 || element.offsetHeight > 0);
      }
    };

    var clickEl = function(el) {
      if (!el) return;
      try { if (typeof el.focus === 'function') el.focus(); } catch(_) {}
      try {
        var r = el.getBoundingClientRect();
        var x = r.left + r.width / 2;
        var y = r.top + r.height / 2;
        var evOpts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y };
        try { el.dispatchEvent(new PointerEvent('pointerdown', evOpts)); } catch(_) {}
        try { el.dispatchEvent(new MouseEvent('mousedown', evOpts)); } catch(_) {}
        try { el.dispatchEvent(new PointerEvent('pointerup', evOpts)); } catch(_) {}
        try { el.dispatchEvent(new MouseEvent('mouseup', evOpts)); } catch(_) {}
        try { el.dispatchEvent(new MouseEvent('click', evOpts)); } catch(_) {}
        var child = el.firstElementChild;
        if (child) {
          try { child.dispatchEvent(new MouseEvent('click', evOpts)); } catch(_) {}
          try { child.click(); } catch(_) {}
        }
      } catch(_) {}
      try { el.click(); } catch(_) {}
    };

    var isLoginModalReady = function() {
      try {
        var input = document.querySelector('input[type="tel"], input[name="phone_number"], input[type="email"], input[autocomplete="one-time-code"]');
        if (input && isVisible(input)) return true;

        var dialogs = Array.from(document.querySelectorAll('[role="dialog"], div[aria-modal="true"], .modal, [aria-labelledby="MODAL_LOGIN"]'));
        var loginDialog = dialogs.find(function(d) {
          if (d.id === 'rebrand-mobile-menu') return false;
          var t = (d.innerText || d.textContent || '').toLowerCase();
          return t.indexOf('get started') !== -1 || t.indexOf('log in with') !== -1 || t.indexOf('trouble') !== -1;
        });

        if (loginDialog && isVisible(loginDialog)) {
          var menu = document.getElementById('rebrand-mobile-menu');
          if (menu) {
            menu.style.setProperty('display', 'none', 'important');
            menu.style.setProperty('pointer-events', 'none', 'important');
            menu.removeAttribute('aria-modal');
          }
          var box = loginDialog.closest('.StretchedBox') || loginDialog.parentElement;
          if (box) {
            box.style.setProperty('z-index', '9999999', 'important');
            box.style.setProperty('pointer-events', 'auto', 'important');
          }
          loginDialog.style.setProperty('z-index', '9999999', 'important');
          loginDialog.style.setProperty('pointer-events', 'auto', 'important');
          return true;
        }

        var allBtns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        var has3Buttons = allBtns.some(function(b) {
          if (!isVisible(b)) return false;
          var t = (b.innerText || b.textContent || '').trim().toLowerCase();
          var a = (b.getAttribute('aria-label') || '').toLowerCase();
          return (
            t === 'log in with email' || a === 'log in with email' ||
            t.indexOf('trouble logging') !== -1 || a.indexOf('trouble logging') !== -1 ||
            t.indexOf('continue with google') !== -1 || a.indexOf('continue with google') !== -1
          );
        });
        if (has3Buttons) {
          var menu2 = document.getElementById('rebrand-mobile-menu');
          if (menu2) {
            menu2.style.setProperty('display', 'none', 'important');
            menu2.style.setProperty('pointer-events', 'none', 'important');
            menu2.removeAttribute('aria-modal');
          }
          return true;
        }

        var gsi = document.querySelector('iframe[src*="accounts.google.com"]');
        if (gsi && isVisible(gsi)) return true;
      } catch(_) {}
      return false;
    };

    var _landingNavTimer = setInterval(function() {
      _loginTries++;
      if (_loginTries > 60) {
        clearInterval(_landingNavTimer);
        return;
      }
      try {
        // If already inside app or logged in, stop
        if (window.location.pathname.indexOf('/app') !== -1 || localStorage.getItem('TinderWeb/APIToken')) {
          clearInterval(_landingNavTimer);
          return;
        }

        // Check if 3-button modal or login input is already open
        if (isLoginModalReady()) {
          console.log('[ChromeShim] 3-button login screen is active and ready.');
          clearInterval(_landingNavTimer);
          return;
        }

        // Dismiss language modal if open
        try {
          var langModal = document.querySelector('.language-select-modal, [class*="language-select"]');
          if (langModal) {
            var closeBtn = langModal.querySelector('button, [aria-label*="close" i]');
            if (closeBtn) { clickEl(closeBtn); return; }
          }
        } catch(_) {}

        // Look for visible "Log in" button anywhere (e.g. inside opened drawer or header)
        var allClickables = Array.from(document.querySelectorAll('a, button, [role="button"]'));
        var loginBtn = allClickables.find(function(el) {
          if (!isVisible(el)) return false;
          // STRICT EXCLUSION: Never match buttons inside the login modal or modal options
          if (el.closest('[aria-labelledby="MODAL_LOGIN"]') || el.closest('.StretchedBox')) return false;
          var txt = (el.innerText || el.textContent || '').trim().toLowerCase();
          var aria = (el.getAttribute('aria-label') || '').toLowerCase();
          if (txt.indexOf('language') !== -1 || aria.indexOf('language') !== -1) return false;
          if (txt.indexOf('email') !== -1 || txt.indexOf('google') !== -1 || txt.indexOf('phone') !== -1 || txt.indexOf('trouble') !== -1) return false;
          if (aria.indexOf('email') !== -1 || aria.indexOf('google') !== -1 || aria.indexOf('phone') !== -1 || aria.indexOf('trouble') !== -1) return false;
          
          var isLogin = txt === 'log in' || txt === 'login' || txt === 'sign in' || aria === 'log in' || aria === 'login';
          if (isLogin) {
            var href = (el.getAttribute('href') || '').toLowerCase();
            if (href.indexOf('play.google.com') !== -1 || href.indexOf('apps.apple.com') !== -1) return false;
            return true;
          }
          return false;
        });

        if (loginBtn) {
          console.log('[ChromeShim] Found visible "Log in" button. Clicking it to open modal...');
          clickEl(loginBtn);
          return;
        }

        // If drawer menu is already open, do not re-click hamburger
        var isCloseMenuVisible = Boolean(document.querySelector('button.mobile-header-hamburger-button[aria-label="Close menu"], button[aria-label="Close menu"]'));
        if (isCloseMenuVisible) {
          return;
        }

        // Look for mobile hamburger button to open drawer
        var hamburger = document.querySelector('button.mobile-header-hamburger-button[aria-label="Open menu"]') ||
          document.querySelector('button.mobile-header-hamburger-button') ||
          document.querySelector('button[aria-label*="menu" i]');

        if (hamburger) {
          console.log('[ChromeShim] Opening mobile hamburger menu...');
          clickEl(hamburger);

          // Fast-path: check for "Log in" button inside drawer
          [150, 300, 500].forEach(function(delay) {
            setTimeout(function() {
              try {
                if (isLoginModalReady()) return;
                var btns = Array.from(document.querySelectorAll('a, button, [role="button"]'));
                var l = btns.find(function(b) {
                  if (!isVisible(b)) return false;
                  if (b.closest('[aria-labelledby="MODAL_LOGIN"]') || b.closest('.StretchedBox')) return false;
                  var t = (b.innerText || b.textContent || '').trim().toLowerCase();
                  var a = (b.getAttribute('aria-label') || '').toLowerCase();
                  if (t.indexOf('language') !== -1 || a.indexOf('language') !== -1) return false;
                  if (t.indexOf('email') !== -1 || t.indexOf('google') !== -1 || t.indexOf('phone') !== -1 || t.indexOf('trouble') !== -1) return false;
                  if (a.indexOf('email') !== -1 || a.indexOf('google') !== -1 || a.indexOf('phone') !== -1 || a.indexOf('trouble') !== -1) return false;
                  return t === 'log in' || t === 'login' || t === 'sign in' || a === 'log in' || a === 'login';
                });
                if (l) {
                  console.log('[ChromeShim] Fast-path: clicking drawer "Log in"...');
                  clickEl(l);
                }
              } catch(_) {}
            }, delay);
          });
        }
      } catch(_) {}
    }, 400);
  })();

  console.log('[FlirtEasy] Chrome Runtime Shim loaded (On-Device Mode)');
})();
true;
`;
};

