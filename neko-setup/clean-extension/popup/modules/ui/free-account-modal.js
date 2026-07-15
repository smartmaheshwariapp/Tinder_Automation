const FreeAccountModal = (() => {
  const STORAGE_KEY = 'freeAccountWarningDismissed';
  const COUNTDOWN_MS = 20000;

  let rafId = null;
  let countdownTimer = null;
  let secondTimer = null;

  const PLATFORM_CONFIG = {
    Bumble: {
      badge: 'Bumble',
      badgeColor: '#F5A623',
      bullets: [
        'This is a Bumble account limitation — not a FlirtEasy issue',
        'Bumble blocks automated actions on free accounts',
        'The plugin may appear stuck because Bumble is silently rejecting swipes',
      ],
      upgradePrefix: 'To fix this, upgrade your ',
      upgradeHighlight: 'Bumble account to Boost or Premium',
      upgradeSuffix: '. FlirtEasy will work fully once your Bumble plan allows it.',
    },
    Tinder: {
      badge: 'Tinder',
      badgeColor: '#d91679',
      bullets: [
        'This is a Tinder account limitation — not a FlirtEasy issue',
        'Free Tinder accounts have a hard daily swipe cap set by Tinder',
        'Once the limit is hit, automation stops — the plugin is working correctly',
      ],
      upgradePrefix: 'To fix this, upgrade your ',
      upgradeHighlight: 'Tinder account to Gold or Platinum',
      upgradeSuffix: '. FlirtEasy will run without interruption after that.',
    },
  };

  function getConfig(platform) {
    return PLATFORM_CONFIG[platform] || PLATFORM_CONFIG['Tinder'];
  }

  async function shouldShow() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return !result[STORAGE_KEY];
  }

  async function markDismissed(permanently) {
    if (permanently) {
      await chrome.storage.local.set({ [STORAGE_KEY]: true });
    }
  }

  function closeModal(modal) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null; }
    if (secondTimer) { clearInterval(secondTimer); secondTimer = null; }
    modal.classList.remove('faw-visible');
    setTimeout(() => { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 300);
  }

  function showModal(platform) {
    const cfg = getConfig(platform);

    const bulletsHTML = cfg.bullets
      .map(b => `
        <li class="faw-bullet">
          <div class="faw-dot"></div>
          <span>${b}</span>
        </li>`)
      .join('');

    const modal = document.createElement('div');
    modal.id = 'freeAccountWarningModal';
    modal.className = 'faw-overlay';
    modal.innerHTML = `
      <div class="faw-card">

        <button class="faw-close" id="fawCloseBtn" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        <div class="faw-header">
          <div class="faw-icon-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d91679" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
          </div>
          <div class="faw-header-text">
            <div class="faw-badge-pill" style="background:${cfg.badgeColor};">
              <span class="faw-badge-text">${cfg.badge}</span>
            </div>
            <h2 class="faw-title">Free Account Detected</h2>
          </div>
        </div>

        <div class="faw-divider"></div>

        <div class="faw-body-section">
          <p class="faw-section-label">What this means for you</p>
          <ul class="faw-bullets">${bulletsHTML}</ul>
          <div class="faw-upgrade-note">
            <div class="faw-upgrade-bar"></div>
            <div class="faw-upgrade-glow"></div>
            <p class="faw-upgrade-text">
              ${cfg.upgradePrefix}<strong class="faw-upgrade-highlight">${cfg.upgradeHighlight}</strong>${cfg.upgradeSuffix}
            </p>
          </div>
        </div>

        <div class="faw-footer">
          <div class="faw-countdown-row">
            <div class="faw-progress-track">
              <div class="faw-progress-bar" id="fawProgressBar"></div>
            </div>
            <span class="faw-countdown-text" id="fawCountdownText">20s</span>
          </div>

          <label class="faw-dont-show" id="fawDontShowLabel">
            <div class="faw-checkbox-visual" id="fawCheckboxVisual">
              <svg class="faw-check-svg" id="fawCheckSvg" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d91679" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <input type="checkbox" id="fawDontShow" class="faw-checkbox-input">
            <span class="faw-checkbox-label">Don't show again</span>
          </label>

          <button class="faw-confirm-btn" id="fawConfirmBtn">
            <span class="faw-btn-text">
              Got it, Continue
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="faw-btn-arrow">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </span>
            <div class="faw-btn-shine"></div>
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('faw-visible'));

    const bar = modal.querySelector('#fawProgressBar');
    const countdownText = modal.querySelector('#fawCountdownText');
    const checkVisual = modal.querySelector('#fawCheckboxVisual');
    const checkInput = modal.querySelector('#fawDontShow');
    const checkSvg = modal.querySelector('#fawCheckSvg');
    const start = Date.now();

    function tick() {
      const pct = Math.min(((Date.now() - start) / COUNTDOWN_MS) * 100, 100);
      bar.style.width = `${pct}%`;
      if (pct < 100) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    let secondsLeft = COUNTDOWN_MS / 1000;
    secondTimer = setInterval(() => {
      secondsLeft = Math.max(0, secondsLeft - 1);
      countdownText.textContent = `${secondsLeft}s`;
    }, 1000);

    const dontShowLabel = modal.querySelector('#fawDontShowLabel');
    dontShowLabel.addEventListener('click', (e) => {
      e.preventDefault();
      checkInput.checked = !checkInput.checked;
      checkVisual.classList.toggle('faw-checkbox-checked', checkInput.checked);
      checkSvg.style.transform = checkInput.checked ? 'scale(1)' : 'scale(0)';
    });

    async function dismiss() {
      const permanently = checkInput.checked;
      await markDismissed(permanently);
      closeModal(modal);
    }

    countdownTimer = setTimeout(dismiss, COUNTDOWN_MS);
    modal.querySelector('#fawCloseBtn').addEventListener('click', dismiss);
    modal.querySelector('#fawConfirmBtn').addEventListener('click', dismiss);
  }

  async function init(platform, { force = false } = {}) {
    if (!platform) return;
    if (!force && !(await shouldShow())) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (force || !tab?.id) {
      showModal(platform);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'checkAccountTier' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.tier === 'free') showModal(platform);
    });
  }

  return { init };
})();

window.FreeAccountModal = FreeAccountModal;
