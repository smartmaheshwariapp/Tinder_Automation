/**
 * cloud-mode.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the "Cloud Mode" toggle in the plugin popup.
 *
 * When enabled:
 *  1. Calls the Cloud Worker API to provision a session
 *  2. Opens the login URL in a new tab
 *  3. Listens for login completion via WebSocket
 *  4. Updates the plugin UI to show cloud status
 *
 * When disabled:
 *  1. Calls the Cloud Worker API to destroy the session
 *  2. Reverts plugin UI to local mode
 *
 * Storage key: cloudMode (boolean) in userSettings
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CloudMode = (() => {

  const CLOUD_API_URL = 'https://cloud.flirteasy.com'; // your cloud worker URL
  let _ws = null;
  let _statusInterval = null;

  // ── Public: init ─────────────────────────────────────────────────────────────
  async function init() {
    const toggle = document.getElementById('cloudModeToggle');
    if (!toggle) return;

    // Hide card for guests — show only for signed-in users
    const { user } = await chrome.storage.local.get('user');
    const card = document.getElementById('cloudModeCard');
    if (!user || (!user.signedIn && !user.token)) {
      if (card) card.style.display = 'none';
      return;
    }
    if (card) card.style.display = 'block';

    // Load current state
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const cloudEnabled = userSettings?.cloudMode === true;
    toggle.checked = cloudEnabled;

    _updateUI(cloudEnabled);

    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        await _enableCloudMode();
      } else {
        await _disableCloudMode();
      }
    });

    // If cloud mode is active, connect WebSocket for live status
    if (cloudEnabled) {
      _connectWebSocket();
    }
  }

  // ── Enable cloud mode ─────────────────────────────────────────────────────────
  async function _enableCloudMode() {
    const statusEl  = document.getElementById('cloudModeStatus');
    const toggle    = document.getElementById('cloudModeToggle');

    _setStatus('Connecting...', 'loading');

    try {
      const { user }     = await chrome.storage.local.get('user');
      const { userSettings } = await chrome.storage.local.get('userSettings');
      const platform     = window.CURRENT_PLATFORM?.toLowerCase() || 'tinder';
      const token        = user?.token;

      if (!token) {
        _setStatus('Please log in to FlirtEasy first', 'error');
        toggle.checked = false;
        return;
      }

      // Provision session on cloud server
      const res = await fetch(`${CLOUD_API_URL}/cloud/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ platform }),
      });

      const data = await res.json();

      if (!data.success) {
        _setStatus(data.error || 'Failed to start cloud session', 'error');
        toggle.checked = false;
        return;
      }

      // Save cloud mode setting
      await _saveCloudModeSetting(true);

      if (data.state === 'active') {
        // Already logged in from a previous session
        _setStatus('Running in cloud ☁️', 'active');
        _connectWebSocket();
        return;
      }

      // Need to log in — open the login URL in a new tab
      if (data.loginUrl) {
        _setStatus('Opening login page...', 'loading');
        chrome.tabs.create({ url: data.loginUrl });
        _setStatus('Log in to ' + platform + ' in the new tab', 'pending');

        // Listen for the login completion message from the login tab
        chrome.runtime.onMessage.addListener(function onLoginComplete(msg) {
          if (msg.type === 'FLIRTEASY_CLOUD_LOGIN_COMPLETE') {
            chrome.runtime.onMessage.removeListener(onLoginComplete);
            _setStatus('Running in cloud ☁️', 'active');
            _connectWebSocket();
          }
        });

        // Also poll as fallback
        _pollSessionStatus(user.token, userSettings?.userId || user.id, platform);
      }
    } catch (err) {
      _setStatus('Connection failed — check your internet', 'error');
      toggle.checked = false;
      await _saveCloudModeSetting(false);
    }
  }

  // ── Disable cloud mode ────────────────────────────────────────────────────────
  async function _disableCloudMode() {
    _disconnectWebSocket();

    try {
      const { user } = await chrome.storage.local.get('user');
      if (user?.token && user?.id) {
        await fetch(`${CLOUD_API_URL}/cloud/sessions/${encodeURIComponent(user.id)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${user.token}` },
        });
      }
    } catch (_) { /* non-critical */ }

    await _saveCloudModeSetting(false);
    _setStatus('', 'off');
    _updateUI(false);
  }

  // ── WebSocket connection for real-time status ─────────────────────────────────
  function _connectWebSocket() {
    _disconnectWebSocket();

    chrome.storage.local.get(['user'], ({ user }) => {
      if (!user?.token || !user?.id) return;

      const wsUrl = `${CLOUD_API_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/cloud/events?userId=${encodeURIComponent(user.id)}&token=${encodeURIComponent(user.token)}`;
      _ws = new WebSocket(wsUrl);

      _ws.onopen  = () => console.log('[CloudMode] WebSocket connected');
      _ws.onclose = () => { _ws = null; };
      _ws.onerror = () => { _ws = null; };

      _ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state') {
            _handleStateUpdate(data);
          }
        } catch (_) {}
      };
    });
  }

  function _disconnectWebSocket() {
    if (_ws) {
      _ws.close();
      _ws = null;
    }
    if (_statusInterval) {
      clearInterval(_statusInterval);
      _statusInterval = null;
    }
  }

  function _handleStateUpdate(state) {
    switch (state.state) {
      case 'active':
        _setStatus('Running in cloud ☁️', 'active');
        break;
      case 'paused':
        _setStatus('Paused', 'paused');
        break;
      case 'needs_login':
        _setStatus('Re-authentication required', 'error');
        _promptReauth(state);
        break;
      case 'needs_captcha':
        _setStatus('Captcha required — tap to solve', 'error');
        _promptCaptcha(state);
        break;
      case 'error':
        _setStatus(state.errorMessage || 'Cloud error', 'error');
        break;
    }
  }

  // ── Polling fallback (if WebSocket fails) ─────────────────────────────────────
  function _pollSessionStatus(token, userId, platform) {
    if (_statusInterval) clearInterval(_statusInterval);

    _statusInterval = setInterval(async () => {
      try {
        const res  = await fetch(`${CLOUD_API_URL}/cloud/sessions/${encodeURIComponent(userId)}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.state === 'active') {
          clearInterval(_statusInterval);
          _setStatus('Running in cloud ☁️', 'active');
          _connectWebSocket();
        }
      } catch (_) {}
    }, 5000);
  }

  // ── Re-auth / captcha prompts ─────────────────────────────────────────────────
  async function _promptReauth(state) {
    const { user } = await chrome.storage.local.get('user');
    if (!user?.token || !user?.id) return;

    const platform = state.platform || 'tinder';
    const res = await fetch(`${CLOUD_API_URL}/cloud/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ platform }),
    }).then(r => r.json()).catch(() => null);

    if (res?.loginUrl) {
      chrome.tabs.create({ url: res.loginUrl });
    }
  }

  async function _promptCaptcha(state) {
    // Same flow as re-auth — open the cloud browser tab
    await _promptReauth(state);
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────
  function _updateUI(enabled) {
    // v2 card — no separate cloudSection/localSection, the toggle itself is the indicator
    // (legacy cloudSection/localSection kept for safety in case old HTML is still present)
    const cloudSection = document.getElementById('cloudModeSection');
    const localSection = document.getElementById('localModeSection');
    if (cloudSection) cloudSection.style.display = enabled ? 'block' : 'none';
    if (localSection) localSection.style.display = enabled ? 'none'  : 'block';
  }

  function _setStatus(message, type) {
    // v2 card subtitle
    const sub = document.querySelector('#cloudModeCard .automation-v2-cloud-sub');
    if (sub) {
      sub.textContent  = message || 'Run 24/7 — no computer needed';
      sub.dataset.status = type || '';
    }
    // legacy fallback (old status-bar element, now hidden but kept safe)
    const el = document.getElementById('cloudModeStatus');
    if (el && !el.closest('#cloudModeCard')) {
      el.textContent = message;
      el.className   = `cloud-mode-status cloud-mode-status--${type}`;
    }
  }

  async function _saveCloudModeSetting(enabled) {
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const updated = { ...(userSettings || {}), cloudMode: enabled };
    await chrome.storage.local.set({ userSettings: updated });
  }

  return { init };

})();

window.CloudMode = CloudMode;
