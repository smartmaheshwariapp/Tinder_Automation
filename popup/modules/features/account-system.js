function initializeAccountButton() {
  const accountBtn = document.getElementById('accountBtn');
  if (accountBtn) {
    accountBtn.addEventListener('click', handleAccountClick);
  }
}

/**
 * PRODUCTION GRADE SYNC: Verifies user plan & status with backend.
 * Automatically handles Pro upgrades post-payment.
 */
async function syncUserStatus() {
  // DEV MODE: skip all server round-trips — dev user is always valid
  if (typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE) {
    console.log('[AccountSystem] DEV_MODE active — server sync skipped.');
    return;
  }

  const userData = await chrome.storage.local.get('user');
  const user = userData.user;

  if (!user || !user.token) return;

  // Don't even try if offline to avoid "Failed to fetch" noise
  if (!navigator.onLine) {
    console.log('[AccountSystem] Offline, skipping status sync.');
    return;
  }

  console.log('[AccountSystem] Syncing user status with server...');

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.SERVER_ENDPOINTS.STATUS}`, {
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Admin flagged this specific user for forced re-login
        if (data.force_reauth) {
          console.warn('[AccountSystem] Admin flagged this account for re-login.');
          await chrome.storage.local.remove(['user', 'trial_v3', 'refreshToken']);
          chrome.storage.sync.remove(['userBackup', 'refreshTokenBackup']).catch(() => {});
          if (typeof openAuthModal === 'function') openAuthModal(true);
          return;
        }

        // Update user plan if it changed
        if (data.plan !== user.plan) {
          console.log(`[AccountSystem] Plan updated: ${user.plan} -> ${data.plan}`);
          user.plan = data.plan;
          await chrome.storage.local.set({ user });
        }

        // Sync trial data (this also updates the local TrialManager cache)
        if (typeof TrialManager !== 'undefined') {
          await TrialManager.initializeTrial();
        }

        // Trigger UI Updates
        await updateAccountButton();
        if (typeof updateTrialUI === 'function') await updateTrialUI();
        if (typeof updateStatusExtended === 'function') await updateStatusExtended();

        console.log('[AccountSystem] Sync complete.');
      }
    } else if (response.status === 401) {
      // Try silent token refresh before hard sign-out
      const refreshResult = await chrome.runtime.sendMessage({ action: 'tryRefreshToken' }).catch(() => ({ success: false }));
      if (refreshResult && refreshResult.success) {
        console.log('[AccountSystem] Token silently refreshed during status sync.');
        return;
      }
      // Refresh failed — full sign out
      console.warn('[AccountSystem] Session expired, signing out...');
      await chrome.storage.local.remove(['user', 'trial_v3', 'refreshToken']);
      chrome.storage.sync.remove(['userBackup', 'refreshTokenBackup']).catch(() => {});
      await updateAccountButton();
      if (typeof updateTrialUI === 'function') await updateTrialUI();
    }
  } catch (err) {
    // Gracefully handle network errors (Failed to fetch)
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      console.warn('[AccountSystem] Sync failed: Server unreachable or network offline.');
    } else {
      console.error('[AccountSystem] Sync failed unexpected error:', err);
    }
  }
}


async function updateAccountButton() {
  const accountBtn = document.getElementById('accountBtn');
  const accountInitial = accountBtn?.querySelector('.account-initial');

  if (!accountBtn) return;

  const userData = await chrome.storage.local.get('user');
  const user = userData.user;

  if (user && (user.signedIn || user.token)) {
    const email = user.email || '';
    const firstName = email.split('@')[0];
    const initial = firstName.charAt(0).toUpperCase();
    const displayName = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}`;

    accountBtn.classList.add('signed-in');
    accountBtn.setAttribute('title', displayName);

    if (accountInitial) {
      accountInitial.textContent = initial;
    }
  } else {
    accountBtn.classList.remove('signed-in');
    accountBtn.setAttribute('title', 'Sign In');
  }

  // Sync HeaderManager
  if (typeof HeaderManager !== 'undefined') {
    HeaderManager.syncDropdownState();
  }
}

async function handleAccountClick() {
  if (typeof HeaderManager !== 'undefined') {
    // HeaderManager.attachListeners() owns the click handler via node clone.
    // toggleDropdown() must NOT be called here — it would double-fire and
    // immediately close the dropdown that the onclick handler just opened.
    return;
  }
  
  const userData = await chrome.storage.local.get('user');
  const user = userData.user;

  if (user && (user.signedIn || user.token)) {
    showAccountMenu();
  } else {
    openAuthModal();
  }
}

function openAuthModal(directToLogin = false) {
  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-overlay"></div>
    <div class="auth-modal-panel">
      <button id="closeAuthModalBtn" class="close-auth-btn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      ${AuthViews.getGatewayTemplate()}
      ${AuthViews.getLoginTemplate()}
    </div>
  `;

  document.body.appendChild(modal);

  const gatewayView = modal.querySelector('#authGatewayView');
  const loginView = modal.querySelector('#authLoginView');

  if (directToLogin) {
    gatewayView.className = 'auth-view hidden-left';
    loginView.className = 'auth-view active';
  }
  
  // Navigation: Gateway -> Login
  modal.querySelector('#gatewaySigninBtn').addEventListener('click', () => {
    gatewayView.className = 'auth-view hidden-left';
    loginView.className = 'auth-view active';
  });

  // Navigation: Login -> Gateway
  const backBtn = modal.querySelector('#authBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      loginView.className = 'auth-view hidden-right';
      gatewayView.className = 'auth-view active';
    });
  }

  // Sign Up Links (External)
  const openSignup = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://flirteasy.io/UserSignup' });
    modal.remove();
  };
  modal.querySelector('#gatewaySignupBtn').addEventListener('click', openSignup);
  modal.querySelector('#authSignupLink').addEventListener('click', openSignup);

  // Close Logic
  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 400);
  };
  modal.querySelector('#closeAuthModalBtn').addEventListener('click', closeModal);
  modal.querySelector('.auth-modal-overlay').addEventListener('click', closeModal);

  // Forgot Password
  const forgotLink = modal.querySelector('.auth-forgot-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://flirteasy.io/UserLogin?forgot=1' });
    });
  }

  // Auth Submission
  const signinBtn = modal.querySelector('#signinBtn');
  if (signinBtn) {
    signinBtn.addEventListener('click', () => handleAuthSubmit('signin', modal));
  }

  // Password Toggle
  const toggleBtn = modal.querySelector('.password-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = modal.querySelector('#signinPassword');
      const slash = toggleBtn.querySelector('.eye-slash');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      slash.style.opacity = isPassword ? '0' : '1';
    });
  }

  // Enter Key
  const passwordInput = modal.querySelector('#signinPassword');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAuthSubmit('signin', modal);
    });
  }

  // Animate in
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });
}

async function handleAuthSubmit(type, modal) {
  const email = modal.querySelector('#signinEmail').value.trim();
  const password = modal.querySelector('#signinPassword').value;
  const btn = modal.querySelector('#signinBtn');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showMessage('Please enter a valid email address', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('Password must be at least 6 characters', 'error');
    return;
  }

  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.SERVER_ENDPOINTS.LOGIN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success && data.token) {
      const userData = {
        email: email,
        token: data.token,
        signedIn: true,
        plan: data.plan || 'free',
        lastAuth: Date.now()
      };
      await chrome.storage.local.set({ user: userData });
      if (data.refreshToken) {
        await chrome.storage.local.set({ refreshToken: data.refreshToken });
        chrome.storage.sync.set({ refreshTokenBackup: data.refreshToken }).catch(() => {});
      }
      chrome.storage.sync.set({ userBackup: { email: userData.email, token: userData.token, plan: userData.plan, lastAuth: userData.lastAuth } }).catch(() => {});

      // Always sync trial data on login (clears stale cache from previous session)
      if (typeof TrialManager !== 'undefined') {
        await TrialManager.initializeTrial();
      }

      showMessage('Signed in successfully!', 'success');
      modal.remove();
      await updateAccountButton();
      if (typeof updateTrialUI === 'function') await updateTrialUI();
      if (typeof updateStatusExtended === 'function') await updateStatusExtended();
    } else {
      showMessage(data.error || 'Invalid credentials. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[Auth] Login Error:', error);
    showMessage('Connection failed. Server might be offline.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function showAccountMenu() {
  const modal = document.createElement('div');
  modal.className = 'risk-modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="account-modal-content">
      <div class="account-glow-orb"></div>
      <div class="account-glow-orb account-glow-orb-2"></div>
      
      <div class="account-header">
        <div class="account-avatar" id="modalAvatar">
          <span id="modalInitial" style="font-size: 24px; font-weight: 800; color: white;"></span>
          <div class="avatar-ring"></div>
        </div>
        <div class="account-info">
          <div id="accountEmail" class="account-email"></div>
          <div class="account-plan">
            <span class="plan-badge">Free Plan</span>
            <button class="plan-upgrade-mini" id="upgradeMiniBtnInline">Upgrade →</button>
          </div>
        </div>
      </div>

      <div class="account-actions">
        <button class="account-action-btn" id="accountSettingsBtn">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" fill="currentColor" opacity="0.9"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" fill="currentColor" opacity="0.9"/>
            </svg>
          </div>
          <div class="action-content">
            <div class="action-title">Account Settings</div>
            <div class="action-subtitle">Manage preferences</div>
          </div>
          <div class="action-arrow">→</div>
        </button>
        
        <button class="account-action-btn premium-action" id="upgradePremiumBtn">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15 8L21 9L16.5 13.5L18 20L12 16.5L6 20L7.5 13.5L3 9L9 8L12 2Z" fill="currentColor" opacity="0.2"/>
              <path d="M5 21h14M7 21v-5l5-3 5 3v5M12 2l2 6 6 1-4.5 4.5L17 20l-5-3-5 3 1.5-6.5L4 9l6-1 2-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="action-content">
            <div class="action-title">Upgrade to Premium</div>
            <div class="action-subtitle">Unlock all features</div>
          </div>
          <div class="action-arrow">→</div>
        </button>
        
        <div class="account-divider"></div>
        
        <button class="account-action-btn danger-action" id="signOutBtn">
          <div class="action-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
            </svg>
          </div>
          <div class="action-content">
            <div class="action-title">Sign Out</div>
            <div class="action-subtitle">See you soon</div>
          </div>
          <div class="action-arrow">→</div>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  chrome.storage.local.get('user', (data) => {
    const emailEl = document.getElementById('accountEmail');
    const avatarSvg = document.getElementById('accountInitial');
    const planBadge = modal.querySelector('.plan-badge');
    const upgradeMiniBytn = modal.querySelector('#upgradeMiniBtnInline');
    const upgradeBigBtn = modal.querySelector('#upgradePremiumBtn');

    if (data.user) {
      if (emailEl) emailEl.textContent = data.user.email;

      const modalInitialEl = modal.querySelector('#modalInitial');
      if (modalInitialEl && data.user.email) {
        const initial = data.user.email.charAt(0).toUpperCase();
        modalInitialEl.textContent = initial;
      }
      if (data.user.plan === 'pro') {
        if (planBadge) {
          planBadge.textContent = 'Pro Plan';
          planBadge.classList.add('pro-badge');
          planBadge.style.background = 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)';
          planBadge.style.color = 'white';
          planBadge.style.border = 'none';
        }
        if (upgradeMiniBytn) upgradeMiniBytn.style.display = 'none';
        if (upgradeBigBtn) upgradeBigBtn.style.display = 'none';
      }
    }
  });

  modal.querySelector('#accountSettingsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://flirteasy.io/Pricing' });
  });

  modal.querySelector('#upgradePremiumBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://flirteasy.io/Pricing' });
  });

  modal.querySelector('#upgradeMiniBtnInline')?.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.create({ url: 'https://flirteasy.io/Pricing' });
  });

  modal.querySelector('#signOutBtn').addEventListener('click', async () => {
    await handleSignOut();
    modal.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => modal.remove(), 200);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => modal.remove(), 200);
    }
  });
}

/**
 * PRODUCTION LOGOUT LOGIC
 * Shared between HeaderManager and old AccountModal
 */
async function handleSignOut() {
  // 1. Stop Agent if running
  if (typeof handleStop === 'function') {
    await handleStop();
  }

  // 2. Clear user data + refresh tokens
  await chrome.storage.local.remove(['user', 'refreshToken']);
  chrome.storage.sync.remove(['userBackup', 'refreshTokenBackup']).catch(() => {});

  // 3. Clear trial local cache to force guest mode
  await chrome.storage.local.remove('trial_v3');

  // 4. Update all UI components immediately
  await updateAccountButton();
  if (typeof updateStatus === 'function') await updateStatus();
  if (typeof updateStatusExtended === 'function') await updateStatusExtended();
  if (typeof updateTrialUI === 'function') await updateTrialUI();
  
  // Refresh Header if exists
  if (typeof HeaderManager !== 'undefined') {
    HeaderManager.syncDropdownState();
  }

  showMessage('Signed out successfully', 'success');
}
window.handleSignOut = handleSignOut;

function showComingSoonModal(title, message, iconSvg) {
  const modal = document.createElement('div');
  modal.className = 'risk-modal overlay-mode';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="confirm-modal-content" style="max-width: 320px;">
      <div class="confirm-modal-icon-svg">${iconSvg}</div>
      <h3>${title}</h3>
      <p style="font-size: 13px; color: var(--text-secondary); margin: 16px 0;">${message}</p>
      <div class="risk-modal-buttons">
        <button class="risk-btn confirm-btn-primary" style="flex: 1;">Got it</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.confirm-btn-primary').addEventListener('click', () => {
    modal.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => modal.remove(), 200);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => modal.remove(), 200);
    }
  });
}

function showProfileSyncModal() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'risk-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="risk-modal-content" style="max-width: 380px;">
        <div class="risk-modal-icon">🔄</div>
        <h3>Syncing Your Profile</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin: 16px 0;">Fetching your ${window.CURRENT_PLATFORM || 'Tinder'} profile data for personalized messaging...</p>
        <div style="margin: 20px 0;">
          <div class="loading-spinner" style="margin: 0 auto; width: 40px; height: 40px; border: 3px solid var(--bg-secondary); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    chrome.runtime.sendMessage({ action: 'refreshProfile' }, async (response) => {
      if (response && response.success) {
        const now = Date.now();
        // Write BOTH timestamp keys for cross-module compat
        const platformKey = `lastProfileSync_${(window.CURRENT_PLATFORM || 'Tinder')}`;
        await chrome.storage.local.set({ lastProfileSync: now, [platformKey]: now });
        setTimeout(() => updateTinderSyncStatus(), 100);

        modal.querySelector('h3').textContent = '✓ Profile Synced!';
        modal.querySelector('p').textContent = 'Your profile data has been loaded successfully.';
        modal.querySelector('.loading-spinner').remove();

        setTimeout(() => {
          modal.remove();
          resolve();
        }, 1500);
      } else {
        modal.querySelector('h3').textContent = '⚠️ Sync Failed';
        modal.querySelector('p').textContent = 'Could not sync profile, but you can continue.';
        modal.querySelector('.loading-spinner').remove();

        setTimeout(() => {
          modal.remove();
          resolve();
        }, 2000);
      }
    });
  });
}




