const WARNING_ICONS = {
  critical: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="1.8"/><path d="M12 8v4m0 4h.01" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>`,
  warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#f59e0b" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 9v4m0 4h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>`,
  moderate: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#3b82f6" stroke-width="1.8"/><path d="M12 16v-4m0-4h.01" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/></svg>`,
  safe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#10b981" stroke-width="1.8"/><path d="m9 12 2 2 4-4" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#10b981" stroke-width="1.8" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function setupCycleGuideListeners() {
  const showGuideBtn = document.getElementById('showCycleGuide');
  const guideWrapper = document.getElementById('cycleGuideWrapper');

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

function setupCycleSteppers() {
  const SLIDER_MAX = 200;

  function syncSlider(inputId, fillId, sliderId) {
    const input = document.getElementById(inputId);
    const fill = document.getElementById(fillId);
    const slider = document.getElementById(sliderId);
    if (!input || !fill || !slider) return;

    const val = Math.min(parseInt(input.value) || 0, SLIDER_MAX);
    const pct = (val / SLIDER_MAX) * 100;
    slider.value = Math.min(val, SLIDER_MAX);
    fill.style.width = pct + '%';
  }

  function syncInput(sliderId, inputId, fillId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(inputId);
    const fill = document.getElementById(fillId);
    if (!slider || !input || !fill) return;

    const val = parseInt(slider.value) || 0;
    input.value = val;
    fill.style.width = ((val / SLIDER_MAX) * 100) + '%';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Slider → input
  document.getElementById('likesSlider')?.addEventListener('input', () => syncInput('likesSlider', 'likesPerCycle', 'likesSliderFill'));
  document.getElementById('messagesSlider')?.addEventListener('input', () => syncInput('messagesSlider', 'messagesPerCycle', 'messagesSliderFill'));

  // Input → slider (typed or stepped)
  const likesInput = document.getElementById('likesPerCycle');
  const messagesInput = document.getElementById('messagesPerCycle');

  likesInput?.addEventListener('input', () => syncSlider('likesPerCycle', 'likesSliderFill', 'likesSlider'));
  messagesInput?.addEventListener('input', () => syncSlider('messagesPerCycle', 'messagesSliderFill', 'messagesSlider'));

  // Auto-clamp typed values on blur/change
  [likesInput, messagesInput].forEach(input => {
    if (!input) return;
    input.addEventListener('change', () => {
      const val = parseInt(input.value) || 0;
      if (val > SLIDER_MAX) {
        input.value = SLIDER_MAX;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });

  // Stepper buttons
  document.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const delta = parseInt(btn.dataset.delta);
      const input = document.getElementById(targetId);
      if (!input || input.disabled) return;

      const current = parseInt(input.value) || 0;
      const min = parseInt(input.getAttribute('min')) || 0;
      const max = input.getAttribute('max') ? parseInt(input.getAttribute('max')) : Infinity;
      input.value = Math.max(min, Math.min(max, current + delta));

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // Init slider positions from current input values
  syncSlider('likesPerCycle', 'likesSliderFill', 'likesSlider');
  syncSlider('messagesPerCycle', 'messagesSliderFill', 'messagesSlider');
}

// Rate Limits & Priority
function validateRateLimits() {
  const likesValue = document.getElementById('likesPerCycle').value;
  const messagesValue = document.getElementById('messagesPerCycle').value;
  const intervalValue = document.getElementById('scheduleInterval').value;

  const likes = likesValue === '' ? 10 : parseInt(likesValue);
  const messages = messagesValue === '' ? 10 : parseInt(messagesValue);
  const interval = intervalValue === '' ? 120 : parseInt(intervalValue);
  const safetyMode = document.getElementById('safetyMode').checked;

  const cyclesPerHour = 60 / interval;
  const likesPerHour = Math.round(likes * cyclesPerHour);
  const messagesPerHour = Math.round(messages * cyclesPerHour);

  const warningEl = document.getElementById('rateLimitWarning');

  if (!safetyMode) {
    if (likesPerHour > 50 || messagesPerHour > 50) {
      warningEl.className = 'rate-limit-warning critical';
      warningEl.innerHTML = `
        <div class="warning-icon">${WARNING_ICONS.critical}</div>
        <div class="warning-content">
          <strong>Safety Mode OFF - High Risk:</strong> ~${likesPerHour} likes/hour, ~${messagesPerHour} messages/hour. No limits enforced - very high shadowban risk!
        </div>
      `;
    } else if (likesPerHour > 30 || messagesPerHour > 25) {
      warningEl.className = 'rate-limit-warning moderate';
      warningEl.innerHTML = `
        <div class="warning-icon">${WARNING_ICONS.moderate}</div>
        <div class="warning-content">
          <strong>Safety Mode OFF - Moderate:</strong> ~${likesPerHour} likes/hour, ~${messagesPerHour} messages/hour. No limits enforced.
        </div>
      `;
    } else {
      warningEl.className = 'rate-limit-warning safe';
      warningEl.innerHTML = `
        <div class="warning-icon">${WARNING_ICONS.safe}</div>
        <div class="warning-content">
          <strong>Safety Mode OFF - Safe:</strong> ~${likesPerHour} likes/hour, ~${messagesPerHour} messages/hour. No limits enforced.
        </div>
      `;
    }
    warningEl.style.display = 'flex';
    return;
  }

  chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (response) => {
    if (!response) return;

    const likesLimit = response.likes.limit;
    const messagesLimit = response.messages.limit;

    if (likesPerHour > likesLimit || messagesPerHour > messagesLimit) {
      const level = (likesPerHour > likesLimit * 1.4 || messagesPerHour > messagesLimit * 1.2) ? 'critical' : 'warning';
      warningEl.className = `rate-limit-warning ${level}`;
      warningEl.innerHTML = `
        <div class="warning-icon">${level === 'critical' ? WARNING_ICONS.critical : WARNING_ICONS.warning}</div>
        <div class="warning-content">
          <strong>${level === 'critical' ? 'High Risk' : 'Warning'}:</strong>
          ~${likesPerHour} likes/hour, ~${messagesPerHour} messages/hour.
          ${level === 'critical' ? `Very high shadowban risk. Limit is ${likesLimit}/${messagesLimit} per hour.` : `Approaching limits (${likesLimit}/${messagesLimit} per hour).`}
        </div>
      `;
      warningEl.style.display = 'flex';
    } else if (likesPerHour > likesLimit * 0.6 || messagesPerHour > messagesLimit * 0.5) {
      warningEl.className = 'rate-limit-warning moderate';
      warningEl.innerHTML = `
        <div class="warning-icon">${WARNING_ICONS.moderate}</div>
        <div class="warning-content">
          <strong>Moderate:</strong> ~${likesPerHour} likes/hour, ~${messagesPerHour} messages/hour. Within safe limits (${likesLimit}/${messagesLimit} per hour).
        </div>
      `;
      warningEl.style.display = 'flex';
    } else {
      warningEl.className = 'rate-limit-warning safe';
      warningEl.innerHTML = `
        <div class="warning-icon">${WARNING_ICONS.safe}</div>
        <div class="warning-content"><strong>Safe:</strong> ~${likesPerHour} likes/hour, ~${messagesPerHour} messages/hour. Well within limits (${likesLimit}/${messagesLimit} per hour).</div>
      `;
      warningEl.style.display = 'flex';
    }
  });
}

function updatePriorityPreview() {
  const safetyMode = document.getElementById('safetyMode').checked;
  let messagesPerCycle = parseInt(document.getElementById('messagesPerCycle').value) || 50;
  const likesPerCycle = parseInt(document.getElementById('likesPerCycle').value) || 50;
  const scheduleInterval = parseInt(document.getElementById('scheduleInterval').value) || 60;
  const minReplyPercent = parseInt(document.getElementById('minReplySlots').value) || 30;
  const maxNewMatchPercent = parseInt(document.getElementById('maxNewMatchSlots').value) || 70;

  const originalMessages = messagesPerCycle;
  const cyclesPerHour = 60 / scheduleInterval;
  const messagesPerHour = messagesPerCycle * cyclesPerHour;

  if (safetyMode) {
    chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (response) => {
      if (response) {
        const messagesLimit = response.messages.limit;
        if (messagesPerHour > messagesLimit) {
          messagesPerCycle = Math.floor(messagesLimit / cyclesPerHour);
        }
        renderPriorityBreakdown(messagesPerCycle, originalMessages, likesPerCycle, messagesPerHour, minReplyPercent, maxNewMatchPercent, safetyMode);
      }
    });
    return;
  }

  renderPriorityBreakdown(messagesPerCycle, originalMessages, likesPerCycle, messagesPerHour, minReplyPercent, maxNewMatchPercent, safetyMode);
}

function renderPriorityBreakdown(messagesPerCycle, originalMessages, likesPerCycle, messagesPerHour, minReplyPercent, maxNewMatchPercent, safetyMode) {
  const minReplySlots = Math.floor(messagesPerCycle * (minReplyPercent / 100));
  const maxNewMatchSlots = Math.floor(messagesPerCycle * (maxNewMatchPercent / 100));

  const breakdownEl = document.getElementById('priorityBreakdown');
  if (breakdownEl) {
    const isLimitedBySafety = safetyMode && (messagesPerCycle < originalMessages || messagesPerHour > 50);
    const isRiskyWithoutSafety = !safetyMode && messagesPerHour > 50;
    const percentageOverlap = minReplyPercent + maxNewMatchPercent > 100;

    let warningText = '';
    if (isLimitedBySafety) {
      warningText = `<br><span style="color: var(--warning);">⚡ ${safetyMode ? 'Safety Protection active' : 'Adaptive Protection'}: Message rate adjusted for account health</span>`;
    } else if (isRiskyWithoutSafety) {
      warningText = '<br><span style="color: var(--error);">🔴 High Risk: ~' + Math.round(messagesPerHour) + ' messages/hour exceeds safe limits!</span>';
    }

    if (percentageOverlap) {
      warningText += '<br><span style="color: var(--warning);">⚠️ Priority percentages total > 100%. Slots will overlap.</span>';
    }

    let explanationText = '';
    if (likesPerCycle < messagesPerCycle) {
      const ratio = Math.floor(messagesPerCycle / likesPerCycle);
      explanationText = `<br><br><span style="color: var(--text-secondary); font-size: 12px;">💡 You're liking ${likesPerCycle} but can message ${messagesPerCycle}. Old matches from previous cycles will fill remaining slots (${ratio}:1 ratio).</span>`;
    }

    breakdownEl.innerHTML = `
      <strong>How it works:</strong><br>
      • First ${minReplySlots} slots: Old matches who replied (guaranteed)<br>
      • Next ${maxNewMatchSlots} slots: New matches from this cycle (max)<br>
      • Remaining slots: ${messagesPerCycle - minReplySlots - maxNewMatchSlots} flexible slots for all matches<br>
      ${warningText}
      ${explanationText}
    `;
  }
}

async function updateSafetyModeState(forceDefault = false) {
  const checkbox = document.getElementById('safetyMode');
  if (!checkbox) return;
  const safetyMode = checkbox.checked;

  const likesInput = document.getElementById('likesPerCycle');
  const messagesInput = document.getElementById('messagesPerCycle');
  const intervalInput = document.getElementById('scheduleInterval');
  const warningEl = document.getElementById('rateLimitWarning');

  updateSafetyModeStatusDisplay();

  const state = await getAgentState();
  const isTurbo = (state.lifetimeCycles || 0) < 4;

  if (safetyMode) {
    chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (response) => {
      if (response) {
        const likesLimit = response.likes.limit;
        const messagesLimit = response.messages.limit;

        // ADAPTIVE: Only set defaults if explicitly requested or values are missing
        if (forceDefault || !intervalInput.value) {
          if (isTurbo) {
            intervalInput.value = 30;
            likesInput.value = Math.min(likesLimit, 50);
            messagesInput.value = Math.min(messagesLimit, 50);
          } else {
            intervalInput.value = 60;
            likesInput.value = likesLimit;
            messagesInput.value = messagesLimit;
          }
          // Sync sliders if they exist
          if (typeof setupCycleSteppers === 'function') setupCycleSteppers();
        }

        likesInput.disabled = true;
        messagesInput.disabled = true;
        intervalInput.disabled = true;

        // Disable Sliders
        const likesSlider = document.getElementById('likesSlider');
        const messagesSlider = document.getElementById('messagesSlider');
        const scheduleSlider = document.getElementById('scheduleSlider');
        if (likesSlider) likesSlider.disabled = true;
        if (messagesSlider) messagesSlider.disabled = true;
        if (scheduleSlider) scheduleSlider.disabled = true;

        // Disable Stepper Buttons
        document.querySelectorAll('.stepper-btn').forEach(b => {
          b.disabled = true;
          b.style.opacity = '0.3';
          b.style.cursor = 'not-allowed';
        });

        // Disable Preset Buttons
        document.querySelectorAll('.schedule-preset-btn').forEach(b => {
          b.style.pointerEvents = 'none';
          b.style.opacity = '0.5';
        });

        likesInput.style.opacity = '0.7';
        messagesInput.style.opacity = '0.7';
        intervalInput.style.opacity = '0.7';

        likesInput.setAttribute('max', '50');
        messagesInput.setAttribute('max', '50');

        if (warningEl) {
          warningEl.className = 'rate-limit-warning safe';
          const modeName = isTurbo ? 'Turbo Start Active' : 'Safety Mode Active';
          const explanation = isTurbo
            ? `Settings optimized for new account warmup (30m intervals, ${likesLimit} likes/${messagesLimit} messages per 30m).`
            : `Cycle settings are managed automatically to stay within ${likesLimit} likes/${messagesLimit} messages per hour.`;

          warningEl.innerHTML = `
            <div class="warning-icon">${WARNING_ICONS.shield}</div>
            <div class="warning-content">
              <strong>${modeName}:</strong> ${explanation}
            </div>
          `;
          warningEl.style.display = 'flex';
        }

        updatePriorityPreview();
      }
    });
  } else {
    likesInput.disabled = false;
    messagesInput.disabled = false;
    intervalInput.disabled = false;

    // Re-enable Sliders
    const likesSlider = document.getElementById('likesSlider');
    const messagesSlider = document.getElementById('messagesSlider');
    const scheduleSlider = document.getElementById('scheduleSlider');
    if (likesSlider) likesSlider.disabled = false;
    if (messagesSlider) messagesSlider.disabled = false;
    if (scheduleSlider) scheduleSlider.disabled = false;

    // Re-enable Steppers
    document.querySelectorAll('.stepper-btn').forEach(b => {
      b.disabled = false;
      b.style.opacity = '';
      b.style.cursor = '';
    });

    // Re-enable Presets
    document.querySelectorAll('.schedule-preset-btn').forEach(b => {
      b.style.pointerEvents = 'auto';
      b.style.opacity = '1';
    });

    likesInput.style.opacity = '';
    messagesInput.style.opacity = '';
    intervalInput.style.opacity = '';

    likesInput.removeAttribute('max');
    messagesInput.removeAttribute('max');

    validateRateLimits();
  }
}

function updateSafetyModeStatusDisplay() {
  const safetyMode = document.getElementById('safetyMode')?.checked;
  const statusTitle = document.getElementById('safetyModeStatusTitle');

  if (statusTitle) {
    statusTitle.textContent = safetyMode ? 'Protection Active' : 'Protection Inactive';
    statusTitle.style.color = '';
  }
}

async function updateHourlyUsage() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (res) => {
        if (chrome.runtime.lastError) {
          return resolve(null);
        }
        resolve(res);
      });
    });

    if (response) {
      // Update ON-state text + bars
      const hourlyLikesEl = document.getElementById('hourlyLikes');
      const hourlyLikesOffEl = document.getElementById('hourlyLikesOff');
      if (hourlyLikesEl) hourlyLikesEl.textContent = `${response.likes.used}/${response.likes.limit}`;
      if (hourlyLikesOffEl) hourlyLikesOffEl.textContent = `${response.likes.used}/∞`;

      const hourlyMessagesEl = document.getElementById('hourlyMessages');
      const hourlyMessagesOffEl = document.getElementById('hourlyMessagesOff');
      if (hourlyMessagesEl) hourlyMessagesEl.textContent = `${response.messages.used}/${response.messages.limit}`;
      if (hourlyMessagesOffEl) hourlyMessagesOffEl.textContent = `${response.messages.used}/∞`;

      // Update progress bar fills (ON state)
      const likesFill = document.getElementById('hourlyLikesFill');
      const msgsFill = document.getElementById('hourlyMessagesFill');
      if (likesFill) {
        const likesPct = Math.min((response.likes.used / response.likes.limit) * 100, 100);
        likesFill.style.width = likesPct + '%';
      }
      if (msgsFill) {
        const msgsPct = Math.min((response.messages.used / response.messages.limit) * 100, 100);
        msgsFill.style.width = msgsPct + '%';
      }

      // Update progress bar fills (OFF state — cap at 50 for visual reference)
      const likesOffFill = document.getElementById('hourlyLikesOffFill');
      const msgsOffFill = document.getElementById('hourlyMessagesOffFill');
      if (likesOffFill) {
        const pct = Math.min((response.likes.used / 50) * 100, 100);
        likesOffFill.style.width = pct + '%';
      }
      if (msgsOffFill) {
        const pct = Math.min((response.messages.used / 50) * 100, 100);
        msgsOffFill.style.width = pct + '%';
      }

      // Reset timer
      const resetTimeEl = document.getElementById('resetTime');
      const resetTimeOffEl = document.getElementById('resetTimeOff');
      if ((response.likes.used > 0 || response.messages.used > 0)) {
        const resetIn = response.resetIn || 60;
        const windowMin = response.windowMinutes || 60;
        if (resetIn < windowMin) {
          const resetText = `Resets in ${resetIn}m`;
          if (resetTimeEl) {
            resetTimeEl.textContent = resetText;
            resetTimeEl.style.display = 'block';
          }
          if (resetTimeOffEl) {
            resetTimeOffEl.textContent = resetText;
            resetTimeOffEl.style.display = 'block';
          }
        } else {
          if (resetTimeEl) resetTimeEl.style.display = 'none';
          if (resetTimeOffEl) resetTimeOffEl.style.display = 'none';
        }
      } else {
        if (resetTimeEl) resetTimeEl.style.display = 'none';
        if (resetTimeOffEl) resetTimeOffEl.style.display = 'none';
      }
      return response;
    }
    return null;
  } catch (e) {
    console.warn('[Storage] Status sync paused - background inactive.');
    return null;
  }
}

// Export functions for use in main popup
if (typeof window !== 'undefined') {
  window.updateSafetyModeState = updateSafetyModeState;
  window.validateRateLimits = validateRateLimits;
  window.updatePriorityPreview = updatePriorityPreview;
  window.setupCycleSteppers = setupCycleSteppers;
  window.setupCycleGuideListeners = setupCycleGuideListeners;
  window.updateHourlyUsage = updateHourlyUsage;
}

// Global listener for safety mode toggle
document.addEventListener('DOMContentLoaded', () => {
  const sm = document.getElementById('safetyMode');
  if (sm) {
    sm.addEventListener('change', () => {
      updateSafetyModeState(true); // Suggest new defaults on toggle
      if (typeof markAsChanged === 'function') markAsChanged();
      // Force preview refresh
      if (typeof updatePriorityPreview === 'function') updatePriorityPreview();
    });
  }
});
