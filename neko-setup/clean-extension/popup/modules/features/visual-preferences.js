// Visual preferences and training
function initializeSmartReactionsGuide() {
  const toggle = document.getElementById('randomHearts');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      showSmartReactionsGuide();
    }
  });
}

function initializeConsecutiveMessagesGuide() {
  // Wire to both the legacy toggle (popup.html) and the new automation UI toggle
  const wireToggle = (toggle) => {
    if (!toggle || toggle.dataset.cmGuideBound) return;
    toggle.dataset.cmGuideBound = '1';
    toggle.addEventListener('change', () => {
      if (toggle.checked) showConsecutiveMessagesGuide();
    });
  };
  wireToggle(document.getElementById('consecutiveMessagesEnabled'));
}

function initializeVisualPreferences() {
  const toggle = document.getElementById('visualPreferencesEnabled');
  const threshold = document.getElementById('visualThreshold');
  const startBtn = document.getElementById('startTrainingBtn');
  const resetBtn = document.getElementById('resetTrainingBtn');

  if (toggle) {
    toggle.addEventListener('change', () => {
      updateVisualPreferencesUI();
      markAsChanged();
    });
  }

  if (threshold) {
    threshold.addEventListener('input', () => {
      const value = threshold.value;
      const displayValue = document.getElementById('thresholdDisplayValue');
      const fill = document.getElementById('visualRangeFill');

      if (displayValue) displayValue.textContent = value;
      if (fill) {
        const percent = ((value - 50) / (95 - 50)) * 100;
        fill.style.width = percent + '%';
      }

      updateFilterImpactWarning();
      markAsChanged();
    });

    const value = threshold.value;
    const fill = document.getElementById('visualRangeFill');
    if (fill) {
      const percent = ((value - 50) / (95 - 50)) * 100;
      fill.style.width = percent + '%';
    }
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      showVPOnboardingGuide();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', handleResetTraining);
  }

  setupVisualGuideListeners();
}

function setupVisualGuideListeners() {
  const showGuideBtn = document.getElementById('showVisualGuide');
  const guideWrapper = document.getElementById('visualGuideWrapper');

  if (!showGuideBtn || !guideWrapper) return;

  const closeGuide = () => {
    if (!guideWrapper.classList.contains('expanded')) return;
    guideWrapper.classList.remove('expanded');
    setTimeout(() => {
      if (!guideWrapper.classList.contains('expanded')) {
        guideWrapper.classList.remove('show-layout');
      }
    }, 400);
  };

  const openGuide = () => {
    guideWrapper.classList.add('show-layout');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        guideWrapper.classList.add('expanded');
      });
    });
  };

  showGuideBtn.onclick = (e) => {
    e.stopPropagation();
    if (!guideWrapper.classList.contains('expanded')) {
      openGuide();
    } else {
      closeGuide();
    }
  };
}

function showVPOnboardingGuide() {
  const existing = document.getElementById('vp-onboarding-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'vp-onboarding-sheet';
  sheet.innerHTML = `
    <style>
      #vp-onboarding-sheet {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        background: rgba(15, 23, 42, 0);
        transition: background 0.3s ease;
        pointer-events: none;
      }
      #vp-onboarding-sheet.vp-sheet--visible {
        background: rgba(15, 23, 42, 0.45);
        pointer-events: all;
      }
      .vp-sheet-card {
        background: #ffffff;
        border-radius: 24px 24px 0 0;
        padding: 28px 22px 24px;
        transform: translateY(100%);
        transition: transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      #vp-onboarding-sheet.vp-sheet--visible .vp-sheet-card {
        transform: translateY(0);
      }
      .vp-sheet-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .vp-sheet-title {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.25;
        margin: 0;
        flex: 1;
      }
      .vp-sheet-close {
        background: #f1f5f9;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
      }
      .vp-sheet-desc {
        font-size: 13px;
        color: #64748b;
        line-height: 1.6;
        margin: -6px 0 0;
      }
      .vp-sheet-steps {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .vp-sheet-step {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .vp-sheet-step-num {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fc427b, #f22565);
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 3px 10px rgba(242,37,101,0.3);
      }
      .vp-sheet-step-done {
        background: #10b981;
        box-shadow: 0 3px 10px rgba(16,185,129,0.3);
      }
      .vp-sheet-step-body { flex: 1; }
      .vp-sheet-step-title {
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.3;
      }
      .vp-sheet-step-sub {
        font-size: 11.5px;
        color: #94a3b8;
        margin-top: 2px;
        line-height: 1.4;
      }
      .vp-sheet-cta {
        width: 100%;
        height: 50px;
        background: linear-gradient(135deg, #fc427b, #f22565);
        border: none;
        border-radius: 16px;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.03em;
        cursor: pointer;
        box-shadow: 0 5px 18px rgba(242,37,101,0.35);
        transition: opacity 0.2s;
        font-family: inherit;
      }
      .vp-sheet-cta:hover { opacity: 0.9; }
      .vp-sheet-skip {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: center;
        font-family: inherit;
        padding: 0;
        margin-top: -8px;
      }
    </style>
    <div class="vp-sheet-card">
      <div class="vp-sheet-header">
        <h2 class="vp-sheet-title">What is Visual Preference?</h2>
        <button class="vp-sheet-close" id="vp-sheet-close-btn" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <p class="vp-sheet-desc">Every profile you like teaches the AI your taste. Over time it gets smart enough to swipe for you, picking only people you'd actually find attractive.</p>
      <div class="vp-sheet-steps">
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num vp-sheet-step-done">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Toggle Visual Preference ON</div>
            <div class="vp-sheet-step-sub">Done! You just completed this step.</div>
          </div>
        </div>
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num">2</div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Save changes &amp; click Start Training</div>
            <div class="vp-sheet-step-sub">Opens training mode on Tinder or Bumble</div>
          </div>
        </div>
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num">3</div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Manually like 20+ profiles you find attractive</div>
            <div class="vp-sheet-step-sub">You do this yourself. Just tap Like on people you genuinely find good-looking. The more you like, the smarter it gets.</div>
          </div>
        </div>
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num">4</div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Start the Agent and let FlirtEasy swipe for you</div>
            <div class="vp-sheet-step-sub">After training, go to the Activity tab and hit Start. The agent will only like profiles that match your taste from the training.</div>
          </div>
        </div>
      </div>
      <button class="vp-sheet-cta" id="vp-sheet-cta-btn">Got it, let's start training</button>
      <button class="vp-sheet-skip" id="vp-sheet-skip-btn">I'll do this later</button>
    </div>
  `;

  document.body.appendChild(sheet);

  const dismiss = (startTraining) => {
    chrome.storage.local.set({ vpGuideShown: true });
    sheet.classList.remove('vp-sheet--visible');
    setTimeout(() => sheet.remove(), 350);
    if (startTraining) {
      const saveBtn = document.getElementById('saveChangesBtn');
      if (saveBtn) saveBtn.click();
      setTimeout(() => { handleStartTraining(); }, 600);
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => sheet.classList.add('vp-sheet--visible'));
  });

  document.getElementById('vp-sheet-close-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('vp-sheet-skip-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('vp-sheet-cta-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(true); });

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) { e.stopPropagation(); dismiss(false); }
  });

  sheet.querySelector('.vp-sheet-card').addEventListener('click', (e) => e.stopPropagation());
}

let _mpGuideSuppressed = false;

function initializeMessagingPriorityGuide() {
  const bindBtn = (btn) => {
    if (btn.dataset.mpGuideBound) return;
    btn.dataset.mpGuideBound = '1';
    let capturedPrev = null;
    btn.addEventListener('mousedown', () => {
      if (_mpGuideSuppressed) return;
      capturedPrev = document.querySelector('.automation-v2-msg-priority-btn.is-active, .priority-preset-btn.active') || null;
    }, true);
    btn.addEventListener('click', () => {
      if (_mpGuideSuppressed) return;
      showMessagingPriorityGuide(capturedPrev);
    });
  };

  document.querySelectorAll('.priority-preset-btn, .automation-v2-msg-priority-btn').forEach(bindBtn);

  const observer = new MutationObserver(() => {
    document.querySelectorAll('.automation-v2-msg-priority-btn').forEach(bindBtn);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function showMessagingPriorityGuide(prevActiveBtn) {
  const existing = document.getElementById('mp-onboarding-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'mp-onboarding-sheet';
  sheet.innerHTML = `
    <style>
      #mp-onboarding-sheet {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        background: rgba(15, 23, 42, 0);
        transition: background 0.3s ease;
        pointer-events: none;
      }
      #mp-onboarding-sheet.mp-sheet--visible {
        background: rgba(15, 23, 42, 0.45);
        pointer-events: all;
      }
      #mp-onboarding-sheet .vp-sheet-card {
        background: #ffffff;
        border-radius: 24px 24px 0 0;
        padding: 28px 22px 24px;
        transform: translateY(100%);
        transition: transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      #mp-onboarding-sheet.mp-sheet--visible .vp-sheet-card {
        transform: translateY(0);
      }
      #mp-onboarding-sheet .vp-sheet-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      #mp-onboarding-sheet .vp-sheet-title {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.25;
        margin: 0;
        flex: 1;
      }
      #mp-onboarding-sheet .vp-sheet-close {
        background: #f1f5f9;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
      }
      #mp-onboarding-sheet .vp-sheet-desc {
        font-size: 13px;
        color: #64748b;
        line-height: 1.6;
        margin: -6px 0 0;
      }
      #mp-onboarding-sheet .mp-presets {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #mp-onboarding-sheet .mp-preset-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 10px 12px;
        background: #f8fafc;
        border-radius: 14px;
      }
      #mp-onboarding-sheet .mp-preset-icon {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      #mp-onboarding-sheet .mp-preset-icon--pink { background: #fce4ec; }
      #mp-onboarding-sheet .mp-preset-icon--blue { background: #e0f2fe; }
      #mp-onboarding-sheet .mp-preset-icon--orange { background: #fff3e0; }
      #mp-onboarding-sheet .mp-preset-body { flex: 1; }
      #mp-onboarding-sheet .mp-preset-label {
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.3;
      }
      #mp-onboarding-sheet .mp-preset-sub {
        font-size: 11.5px;
        color: #94a3b8;
        margin-top: 2px;
        line-height: 1.4;
      }
      #mp-onboarding-sheet .vp-sheet-step {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      #mp-onboarding-sheet .vp-sheet-step-num {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fc427b, #f22565);
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 3px 10px rgba(242,37,101,0.3);
      }
      #mp-onboarding-sheet .vp-sheet-step-body { flex: 1; }
      #mp-onboarding-sheet .vp-sheet-step-title {
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.3;
      }
      #mp-onboarding-sheet .vp-sheet-step-sub {
        font-size: 11.5px;
        color: #94a3b8;
        margin-top: 2px;
        line-height: 1.4;
      }
      #mp-onboarding-sheet .vp-sheet-cta {
        width: 100%;
        height: 50px;
        background: linear-gradient(135deg, #fc427b, #f22565);
        border: none;
        border-radius: 16px;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.03em;
        cursor: pointer;
        box-shadow: 0 5px 18px rgba(242,37,101,0.35);
        transition: opacity 0.2s;
        font-family: inherit;
      }
      #mp-onboarding-sheet .vp-sheet-cta:hover { opacity: 0.9; }
      #mp-onboarding-sheet .vp-sheet-skip {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: center;
        font-family: inherit;
        padding: 0;
        margin-top: -8px;
      }
    </style>
    <div class="vp-sheet-card">
      <div class="vp-sheet-header">
        <h2 class="vp-sheet-title">What is Messaging Priority?</h2>
        <button class="vp-sheet-close" id="mp-sheet-close-btn" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <p class="vp-sheet-desc">It controls who FlirtEasy messages first when the agent runs. Pick the ratio that fits where you are right now.</p>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;background:#f8fafc;border-radius:12px;padding:8px 12px;">
        <span style="font-size:11.5px;font-weight:700;color:#1e293b;">Your chats</span>
        <span style="font-size:11px;color:#94a3b8;font-weight:600;">vs</span>
        <span style="font-size:11.5px;font-weight:700;color:#1e293b;">New matches</span>
        <span style="font-size:10px;color:#94a3b8;margin-left:2px;">— pick your focus</span>
      </div>
      <div class="mp-presets">
        <div class="mp-preset-row">
          <div class="mp-preset-icon mp-preset-icon--pink">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </div>
          <div class="mp-preset-body">
            <div class="mp-preset-label">70 : 30</div>
            <div class="mp-preset-sub">Focuses mostly on people you are already talking to. Good when you have active chats to keep warm.</div>
          </div>
        </div>
        <div class="mp-preset-row">
          <div class="mp-preset-icon mp-preset-icon--blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
            </svg>
          </div>
          <div class="mp-preset-body">
            <div class="mp-preset-label">50 : 50</div>
            <div class="mp-preset-sub">Splits evenly between existing chats and new matches. A solid starting point for most people.</div>
          </div>
        </div>
        <div class="mp-preset-row">
          <div class="mp-preset-icon mp-preset-icon--orange">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </div>
          <div class="mp-preset-body">
            <div class="mp-preset-label">30 : 70</div>
            <div class="mp-preset-sub">Prioritises reaching out to new matches first. Best when you want to grow your conversations quickly.</div>
          </div>
        </div>
      </div>
      <div class="vp-sheet-step">
        <div class="vp-sheet-step-num">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="vp-sheet-step-body">
          <div class="vp-sheet-step-title">Pick a mode and save changes</div>
          <div class="vp-sheet-step-sub">Then start the agent from the Activity tab. FlirtEasy handles the messaging order automatically.</div>
        </div>
      </div>
      <button class="vp-sheet-cta" id="mp-sheet-cta-btn">Got it, save my settings</button>
      <button class="vp-sheet-skip" id="mp-sheet-skip-btn">I'll decide later</button>
    </div>
  `;

  document.body.appendChild(sheet);

  const dismiss = (save) => {
    chrome.storage.local.set({ mpGuideShown: true });
    sheet.classList.remove('mp-sheet--visible');
    setTimeout(() => sheet.remove(), 350);
    if (save) {
      const saveBtn = document.getElementById('saveChangesBtn');
      if (saveBtn) saveBtn.click();
    } else if (prevActiveBtn) {
      _mpGuideSuppressed = true;
      prevActiveBtn.click();
      _mpGuideSuppressed = false;
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => sheet.classList.add('mp-sheet--visible'));
  });

  document.getElementById('mp-sheet-close-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('mp-sheet-skip-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('mp-sheet-cta-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(true); });

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) { e.stopPropagation(); dismiss(false); }
  });

  sheet.querySelector('.vp-sheet-card').addEventListener('click', (e) => e.stopPropagation());
}

function showSmartReactionsGuide() {
  const existing = document.getElementById('sr-onboarding-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'sr-onboarding-sheet';
  sheet.innerHTML = `
    <style>
      #sr-onboarding-sheet {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        background: rgba(15, 23, 42, 0);
        transition: background 0.3s ease;
        pointer-events: none;
      }
      #sr-onboarding-sheet.sr-sheet--visible {
        background: rgba(15, 23, 42, 0.45);
        pointer-events: all;
      }
      #sr-onboarding-sheet .vp-sheet-card {
        background: #ffffff;
        border-radius: 24px 24px 0 0;
        padding: 28px 22px 24px;
        transform: translateY(100%);
        transition: transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      #sr-onboarding-sheet.sr-sheet--visible .vp-sheet-card {
        transform: translateY(0);
      }
      #sr-onboarding-sheet .vp-sheet-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      #sr-onboarding-sheet .vp-sheet-title {
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.25;
        margin: 0;
        flex: 1;
      }
      #sr-onboarding-sheet .vp-sheet-close {
        background: #f1f5f9;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
      }
      #sr-onboarding-sheet .vp-sheet-desc {
        font-size: 13px;
        color: #64748b;
        line-height: 1.6;
        margin: -6px 0 0;
      }
      #sr-onboarding-sheet .vp-sheet-steps {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      #sr-onboarding-sheet .vp-sheet-step {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      #sr-onboarding-sheet .vp-sheet-step-num {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: linear-gradient(135deg, #fc427b, #f22565);
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 3px 10px rgba(242,37,101,0.3);
      }
      #sr-onboarding-sheet .vp-sheet-step-done {
        background: #10b981;
        box-shadow: 0 3px 10px rgba(16,185,129,0.3);
      }
      #sr-onboarding-sheet .vp-sheet-step-body { flex: 1; }
      #sr-onboarding-sheet .vp-sheet-step-title {
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.3;
      }
      #sr-onboarding-sheet .vp-sheet-step-sub {
        font-size: 11.5px;
        color: #94a3b8;
        margin-top: 2px;
        line-height: 1.4;
      }
      #sr-onboarding-sheet .vp-sheet-note {
        font-size: 11px;
        color: #cbd5e1;
        text-align: center;
        margin-top: -6px;
      }
      #sr-onboarding-sheet .vp-sheet-cta {
        width: 100%;
        height: 50px;
        background: linear-gradient(135deg, #fc427b, #f22565);
        border: none;
        border-radius: 16px;
        color: #fff;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.03em;
        cursor: pointer;
        box-shadow: 0 5px 18px rgba(242,37,101,0.35);
        transition: opacity 0.2s;
        font-family: inherit;
      }
      #sr-onboarding-sheet .vp-sheet-cta:hover { opacity: 0.9; }
      #sr-onboarding-sheet .vp-sheet-skip {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: center;
        font-family: inherit;
        padding: 0;
        margin-top: -8px;
      }
    </style>
    <div class="vp-sheet-card">
      <div class="vp-sheet-header">
        <h2 class="vp-sheet-title">What are Smart Reactions?</h2>
        <button class="vp-sheet-close" id="sr-sheet-close-btn" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <p class="vp-sheet-desc">FlirtEasy automatically reacts with a heart to your match's messages. This keeps your chat pinned at the top of their inbox so they notice you first.</p>
      <div class="vp-sheet-steps">
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num vp-sheet-step-done">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Toggle Smart Reactions ON</div>
            <div class="vp-sheet-step-sub">Done! You just completed this step.</div>
          </div>
        </div>
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num">2</div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Save changes and start the agent</div>
            <div class="vp-sheet-step-sub">FlirtEasy takes care of reactions automatically while the agent is running. Nothing else you need to do.</div>
          </div>
        </div>
      </div>
      <p class="vp-sheet-note">Tinder only. Does not work on Bumble.</p>
      <button class="vp-sheet-cta" id="sr-sheet-cta-btn">Got it, save my settings</button>
      <button class="vp-sheet-skip" id="sr-sheet-skip-btn">I'll do this later</button>
    </div>
  `;

  document.body.appendChild(sheet);

  const dismiss = (save) => {
    chrome.storage.local.set({ srGuideShown: true });
    sheet.classList.remove('sr-sheet--visible');
    setTimeout(() => sheet.remove(), 350);
    if (!save) {
      const toggle = document.getElementById('randomHearts');
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        markAsChanged();
      }
    } else {
      const saveBtn = document.getElementById('saveChangesBtn');
      if (saveBtn) saveBtn.click();
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => sheet.classList.add('sr-sheet--visible'));
  });

  document.getElementById('sr-sheet-close-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('sr-sheet-skip-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('sr-sheet-cta-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(true); });

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) { e.stopPropagation(); dismiss(false); }
  });

  sheet.querySelector('.vp-sheet-card').addEventListener('click', (e) => e.stopPropagation());
}

function showConsecutiveMessagesGuide() {
  const existing = document.getElementById('cm-onboarding-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'cm-onboarding-sheet';
  sheet.innerHTML = `
    <style>
      #cm-onboarding-sheet {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        background: rgba(15, 23, 42, 0);
        transition: background 0.3s ease;
        pointer-events: none;
      }
      #cm-onboarding-sheet.cm-sheet--visible {
        background: rgba(15, 23, 42, 0.45);
        pointer-events: all;
      }
      #cm-onboarding-sheet .vp-sheet-card {
        background: #ffffff;
        border-radius: 24px 24px 0 0;
        padding: 28px 22px 24px;
        transform: translateY(100%);
        transition: transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      #cm-onboarding-sheet.cm-sheet--visible .vp-sheet-card { transform: translateY(0); }
      #cm-onboarding-sheet .vp-sheet-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      #cm-onboarding-sheet .vp-sheet-title { font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.25; margin: 0; flex: 1; }
      #cm-onboarding-sheet .vp-sheet-close { background: #f1f5f9; border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; padding: 0; }
      #cm-onboarding-sheet .vp-sheet-desc { font-size: 13px; color: #64748b; line-height: 1.6; margin: -6px 0 0; }
      #cm-onboarding-sheet .vp-sheet-steps { display: flex; flex-direction: column; gap: 12px; }
      #cm-onboarding-sheet .vp-sheet-step { display: flex; align-items: flex-start; gap: 12px; }
      #cm-onboarding-sheet .vp-sheet-step-num { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, #fc427b, #f22565); color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(242,37,101,0.3); }
      #cm-onboarding-sheet .vp-sheet-step-done { background: #10b981; box-shadow: 0 3px 10px rgba(16,185,129,0.3); }
      #cm-onboarding-sheet .vp-sheet-step-body { flex: 1; }
      #cm-onboarding-sheet .vp-sheet-step-title { font-size: 13px; font-weight: 700; color: #1e293b; line-height: 1.3; }
      #cm-onboarding-sheet .vp-sheet-step-sub { font-size: 11.5px; color: #94a3b8; margin-top: 2px; line-height: 1.4; }
      #cm-onboarding-sheet .vp-sheet-cta { width: 100%; height: 50px; background: linear-gradient(135deg, #fc427b, #f22565); border: none; border-radius: 16px; color: #fff; font-size: 14px; font-weight: 800; letter-spacing: 0.03em; cursor: pointer; box-shadow: 0 5px 18px rgba(242,37,101,0.35); transition: opacity 0.2s; font-family: inherit; }
      #cm-onboarding-sheet .vp-sheet-cta:hover { opacity: 0.9; }
      #cm-onboarding-sheet .vp-sheet-skip { background: none; border: none; color: #94a3b8; font-size: 12px; font-weight: 500; cursor: pointer; text-align: center; font-family: inherit; padding: 0; margin-top: -8px; }
    </style>
    <div class="vp-sheet-card">
      <div class="vp-sheet-header">
        <h2 class="vp-sheet-title">What are Consecutive Messages?</h2>
        <button class="vp-sheet-close" id="cm-sheet-close-btn" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <p class="vp-sheet-desc">When your match sends multiple messages in a row, the AI mirrors that energy and replies with 2–3 short messages back — exactly how people naturally text in real conversations.</p>
      <div class="vp-sheet-steps">
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num vp-sheet-step-done">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Toggle Consecutive Messages ON</div>
            <div class="vp-sheet-step-sub">Done! You just completed this step.</div>
          </div>
        </div>
        <div class="vp-sheet-step">
          <div class="vp-sheet-step-num">2</div>
          <div class="vp-sheet-step-body">
            <div class="vp-sheet-step-title">Save changes and start the agent</div>
            <div class="vp-sheet-step-sub">The AI handles the split automatically. Each part uses 1 message credit. Nothing else you need to do.</div>
          </div>
        </div>
      </div>
      <button class="vp-sheet-cta" id="cm-sheet-cta-btn">Got it, save my settings</button>
      <button class="vp-sheet-skip" id="cm-sheet-skip-btn">I'll do this later</button>
    </div>
  `;

  document.body.appendChild(sheet);

  const dismiss = (save) => {
    sheet.classList.remove('cm-sheet--visible');
    setTimeout(() => sheet.remove(), 350);
    if (!save) {
      const toggle = document.getElementById('consecutiveMessagesEnabled');
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof markAsChanged === 'function') markAsChanged();
      }
    } else {
      const saveBtn = document.getElementById('saveChangesBtn');
      if (saveBtn) saveBtn.click();
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => sheet.classList.add('cm-sheet--visible'));
  });

  document.getElementById('cm-sheet-close-btn').addEventListener('click', (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('cm-sheet-skip-btn').addEventListener('click',  (e) => { e.stopPropagation(); dismiss(false); });
  document.getElementById('cm-sheet-cta-btn').addEventListener('click',   (e) => { e.stopPropagation(); dismiss(true); });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) { e.stopPropagation(); dismiss(false); } });
  sheet.querySelector('.vp-sheet-card').addEventListener('click', (e) => e.stopPropagation());
}
