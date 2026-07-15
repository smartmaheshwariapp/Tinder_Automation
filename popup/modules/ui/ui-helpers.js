// UI Helper Functions
function updateSafetyModeHint() {
  const enabled = document.getElementById('safetyMode')?.checked;
  const hintOn = document.getElementById('safetyModeHintOn');
  const hintOff = document.getElementById('safetyModeHintOff');

  if (enabled) {
    if (hintOn) hintOn.style.display = 'block';
    if (hintOff) hintOff.style.display = 'none';
  } else {
    if (hintOn) hintOn.style.display = 'none';
    if (hintOff) hintOff.style.display = 'block';
  }
}

function updateActiveHoursUI() {
  const enabled = document.getElementById('activeHoursEnabled').checked;
  const settings = document.getElementById('activeHoursSettings');
  const preset = document.querySelector('input[name="activeHoursPreset"]:checked')?.value;
  const customSettings = document.getElementById('customTimeSettings');

  if (enabled) {
    if (settings) settings.style.display = 'block';
    if (preset === 'custom') {
      if (customSettings) customSettings.style.display = 'block';
    } else {
      if (customSettings) customSettings.style.display = 'none';
    }
  } else {
    if (settings) settings.style.display = 'none';
  }

  updateActiveHoursHint();
}

function handleActiveHoursPresetChange() {
  const preset = document.querySelector('input[name="activeHoursPreset"]:checked')?.value;
  const customSettings = document.getElementById('customTimeSettings');

  const presets = {
    '24/7': { start: '12:00 AM', end: '11:59 PM', start24: '00:00', end24: '23:59' },
    'business': { start: '9:00 AM', end: '5:00 PM', start24: '09:00', end24: '17:00' },
    'evening': { start: '6:00 PM', end: '11:00 PM', start24: '18:00', end24: '23:00' },
    'daytime': { start: '8:00 AM', end: '8:00 PM', start24: '08:00', end24: '20:00' }
  };

  if (preset === 'custom') {
    if (customSettings) customSettings.style.display = 'block';
  } else {
    if (customSettings) customSettings.style.display = 'none';
    if (presets[preset]) {
      const startInput = document.getElementById('startTime');
      const endInput = document.getElementById('endTime');
      if (startInput) {
        startInput.value = presets[preset].start;
        startInput.dataset.value = presets[preset].start24;
      }
      if (endInput) {
        endInput.value = presets[preset].end;
        endInput.dataset.value = presets[preset].end24;
      }
    }
  }

  updateActiveHoursHint();
  if (typeof markAsChanged === 'function') markAsChanged();
}

function updateActiveHoursHint() {
  const enabled = document.getElementById('activeHoursEnabled')?.checked;
  const hintOff = document.getElementById('activeHoursHintOff');
  const hintOn = document.getElementById('activeHoursHintOn');
  const hintTime = document.getElementById('activeHoursHintTime');
  const timelineFill = document.getElementById('activeHoursTimelineFill');
  const previewLabel = document.getElementById('activeHoursPreviewLabel');

  if (!enabled) {
    if (hintOff) hintOff.style.display = 'block';
    if (hintOn) hintOn.style.display = 'none';
    if (timelineFill) {
      timelineFill.style.left = '0%';
      timelineFill.style.width = '100%';
    }
    if (previewLabel) previewLabel.textContent = 'Active all day';
  } else {
    if (hintOff) hintOff.style.display = 'none';
    if (hintOn) hintOn.style.display = 'block';

    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const startTime = startTimeInput?.value || '12:00 AM';
    const endTime = endTimeInput?.value || '11:59 PM';

    // Get raw values for percentage calc
    const startVal = startTimeInput?.dataset.value || '00:00';
    const endVal = endTimeInput?.dataset.value || '23:59';
    const [sh, sm] = startVal.split(':').map(Number);
    const [eh, em] = endVal.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    if (timelineFill) {
      if (startMins <= endMins) {
        timelineFill.style.left = (startMins / 1440 * 100) + '%';
        timelineFill.style.width = ((endMins - startMins) / 1440 * 100) + '%';
      } else {
        // Overnight logic - highlight everything for now or improve later
        timelineFill.style.left = '0%';
        timelineFill.style.width = '100%';
      }
    }

    if (hintTime) {
      if (startMins > endMins) {
        const text = `${startTime} to ${endTime} (overnight)`;
        hintTime.textContent = `Bot will run from ${text}`;
        if (previewLabel) previewLabel.textContent = text;
      } else {
        const text = `${startTime} to ${endTime}`;
        hintTime.textContent = `Bot will run from ${text}`;
        if (previewLabel) previewLabel.textContent = text;
      }
    }
  }
}

function updateAgeFilterUI() {
  const enabled = document.getElementById('ageFilterEnabled').checked;
  const settings = document.getElementById('ageFilterSettings');

  if (enabled) {
    if (settings) settings.style.display = 'block';
    updateRangeFill();
    updateFilterImpactWarning();
  } else {
    if (settings) settings.style.display = 'none';
    updateFilterImpactWarning();
  }
}

function updateRangeFill() {
  const minAge = parseInt(document.getElementById('minAge').value);
  const maxAge = parseInt(document.getElementById('maxAge').value);
  const minDisplay = document.getElementById('minAgeDisplay');
  const maxDisplay = document.getElementById('maxAgeDisplay');
  const rangeFill = document.getElementById('rangeFill');

  if (minDisplay) minDisplay.textContent = minAge;
  if (maxDisplay) maxDisplay.textContent = maxAge;

  if (rangeFill) {
    const min = 18;
    const max = 99;
    const leftPercent = ((minAge - min) / (max - min)) * 100;
    const rightPercent = ((maxAge - min) / (max - min)) * 100;

    rangeFill.style.left = leftPercent + '%';
    rangeFill.style.width = (rightPercent - leftPercent) + '%';
  }
}

function initializeAgeSlider() {
  const minSlider = document.getElementById('minAge');
  const maxSlider = document.getElementById('maxAge');

  if (minSlider && maxSlider) {
    minSlider.addEventListener('input', () => {
      let minVal = parseInt(minSlider.value);
      let maxVal = parseInt(maxSlider.value);

      if (minVal >= maxVal) minSlider.value = maxVal - 1;

      // Auto-enable when slider is interacted with (important for V2 where toggle is hidden)
      const toggle = document.getElementById('ageFilterEnabled');
      if (toggle && !toggle.checked) toggle.checked = true;

      updateRangeFill();
      updateFilterImpactWarning();
      markAsChanged();
    });

    maxSlider.addEventListener('input', () => {
      let minVal = parseInt(minSlider.value);
      let maxVal = parseInt(maxSlider.value);

      if (maxVal <= minVal) maxSlider.value = minVal + 1;

      // Auto-enable when slider is interacted with (important for V2 where toggle is hidden)
      const toggle = document.getElementById('ageFilterEnabled');
      if (toggle && !toggle.checked) toggle.checked = true;

      updateRangeFill();
      updateFilterImpactWarning();
      markAsChanged();
    });
  }
}

function updateDistanceFilterUI() {
  // Toggle removed — distance filter settings are always visible
  const settings = document.getElementById('distanceFilterSettings');
  if (settings) settings.style.display = 'block';
}

function updateDistanceDisplay() {
  const slider = document.getElementById('maxDistance');
  const display = document.getElementById('maxDistanceDisplay');
  const fill = document.getElementById('distanceRangeFill');
  if (!slider) return;
  const val = parseInt(slider.value) || 50;
  if (display) display.textContent = val;
  if (fill) {
    const min = parseInt(slider.min) || 2;
    const max = parseInt(slider.max) || 161;
    fill.style.left = '0%';
    fill.style.width = ((val - min) / (max - min) * 100) + '%';
  }
}

function initializeDistanceSlider() {
  const slider = document.getElementById('maxDistance');
  if (!slider) return;
  slider.addEventListener('input', () => {
    // Auto-enable when slider is interacted with (important for V2 where toggle is hidden)
    const toggle = document.getElementById('distanceFilterEnabled');
    if (toggle && !toggle.checked) toggle.checked = true;

    updateDistanceDisplay();
    markAsChanged();
  });
  updateDistanceDisplay();
}

function updateVisualPreferencesUI() {
  const enabled = document.getElementById('visualPreferencesEnabled').checked;
  const settings = document.getElementById('visualPreferencesSettings');
  const startBtn = document.getElementById('startTrainingBtn');

  if (enabled) {
    if (settings) settings.style.display = 'block';
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      startBtn.style.cursor = 'pointer';
    }
    updateVisualPreferencesStatus();
    updateFilterImpactWarning();
  } else {
    if (settings) settings.style.display = 'none';
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.cursor = 'not-allowed';
    }
    updateFilterImpactWarning();
  }
}

function updateFilterImpactWarning() {
  const warningBox = document.getElementById('filterImpactWarning');
  const warningText = document.getElementById('filterImpactText');

  if (!warningBox || !warningText) return;

  const ageFilterEnabled = document.getElementById('ageFilterEnabled')?.checked;
  const visualPrefsEnabled = document.getElementById('visualPreferencesEnabled')?.checked;

  if (!ageFilterEnabled || !visualPrefsEnabled) {
    warningBox.style.display = 'none';
    return;
  }

  const minAge = parseInt(document.getElementById('minAge')?.value) || 18;
  const maxAge = parseInt(document.getElementById('maxAge')?.value) || 99;
  const threshold = parseInt(document.getElementById('visualThreshold')?.value) || 75;

  const ageRange = maxAge - minAge;
  const isAgeStrict = ageRange < 10;
  const isVisualStrict = threshold >= 85;

  if (isAgeStrict || isVisualStrict) {
    let impact = '';
    let percentage = '';

    if (isAgeStrict && isVisualStrict) {
      percentage = '75-90%';
      impact = 'Very strict filters active';
    } else if (isAgeStrict) {
      percentage = '50-70%';
      impact = 'Narrow age range limiting matches';
    } else if (isVisualStrict) {
      percentage = '60-80%';
      impact = 'High visual match threshold';
    }

    warningText.innerHTML = `
      <strong>⚠️ Age (${minAge}-${maxAge}) + Visual Match (${threshold}%)</strong><br>
      ${impact} - may reduce auto-likes by ~${percentage}<br>
      <span style="opacity: 0.8;">Only highly matching profiles within age range will be liked</span>
    `;

    warningBox.style.display = 'flex';
  } else {
    warningBox.style.display = 'none';
  }
}

async function updateVisualPreferencesStatus() {
  const settings = await getSettings();
  const visualPrefs = settings.visualPreferences || { likedPhotos: [] };
  const count = visualPrefs.likedPhotos?.length || 0;

  // Define tiers (matches logic in visual-preference.js)
  const isTrained = count >= 20;
  const isGood = count >= 30;
  const isExcellent = count >= 50;

  const profilesTrainedEl = document.getElementById('profilesTrained');
  const trainingBarFill = document.getElementById('trainingBarFill');
  const statusDot = document.getElementById('trainingStatusDot');
  const trainingStatusEl = document.getElementById('trainingStatus');
  const accuracyContainer = document.getElementById('accuracyEstimateContainer');
  const accuracyValue = document.getElementById('accuracyEstimate');
  const tierMessage = document.getElementById('tierMessage');

  if (profilesTrainedEl) profilesTrainedEl.textContent = `${count}/50`;
  if (trainingBarFill) {
    const percent = Math.min((count / 50) * 100, 100);
    trainingBarFill.style.width = percent + '%';
  }

  // Status Indicator & Text
  if (statusDot) {
    if (isTrained) statusDot.classList.add('active');
    else statusDot.classList.remove('active');
  }

  if (trainingStatusEl) {
    if (isExcellent) trainingStatusEl.textContent = 'Elite Calibration';
    else if (isGood) trainingStatusEl.textContent = 'Pro Accuracy';
    else if (isTrained) trainingStatusEl.textContent = 'Basic Calibration';
    else trainingStatusEl.textContent = 'Awaiting Data';

    trainingStatusEl.style.color = isTrained ? '#10b981' : '#6b7280';
  }

  // Calibration Label State
  const labels = document.querySelectorAll('.meter-label');
  labels.forEach(l => l.classList.remove('active'));

  if (isExcellent) document.querySelector('.l-pro')?.classList.add('active');
  else if (isGood) document.querySelector('.l-basic')?.classList.add('active');
  else if (isTrained) document.querySelector('.l-basic')?.classList.add('active');
  else document.querySelector('.l-start')?.classList.add('active');

  // Accuracy Box
  if (accuracyContainer && isTrained) {
    accuracyContainer.style.display = 'flex';
    let estimate = '70%';
    if (isExcellent) estimate = '95%';
    else if (isGood) estimate = '85%';
    if (accuracyValue) accuracyValue.textContent = estimate;
  } else if (accuracyContainer) {
    accuracyContainer.style.display = 'none';
  }

  // Calibration Narrative
  if (tierMessage) {
    if (isExcellent) tierMessage.textContent = 'AI is fully calibrated to your taste. High-fidelity filtering active.';
    else if (isGood) tierMessage.textContent = 'Great calibration progress. 20 more profiles for Elite precision.';
    else if (isTrained) tierMessage.textContent = 'Basic training confirmed. Vision system now filtering matches.';
    else tierMessage.textContent = 'Manually like 20+ profiles to initiate AI taste calibration.';
  }

  const thresholdDisplay = document.getElementById('thresholdDisplayValue');
  if (thresholdDisplay) thresholdDisplay.textContent = (visualPrefs.threshold || 75);

  const threshold = document.getElementById('visualThreshold');
  if (threshold) {
    threshold.value = visualPrefs.threshold || 75;
    const fill = document.getElementById('visualRangeFill');
    if (fill) {
      const value = threshold.value;
      const percent = ((value - 50) / (95 - 50)) * 100;
      fill.style.width = percent + '%';
    }
  }

  const startBtn = document.getElementById('startTrainingBtn');
  const resetBtn = document.getElementById('resetTrainingBtn');

  if (startBtn && resetBtn) {
    const btnText = startBtn.querySelector('.btn-text');
    if (btnText) {
      if (isTrained) {
        btnText.textContent = 'Retrain AI Vision';
        resetBtn.style.display = 'flex';
      } else {
        btnText.textContent = 'Train AI Vision';
        resetBtn.style.display = 'none';
      }
    }
  }
}

function ensureVisualTrainingModal() {
  let modal = document.getElementById('visualTrainingModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'visualTrainingModal';
  modal.className = 'visual-training-modal';
  modal.innerHTML = `
    <div class="visual-training-modal-overlay" data-close="1"></div>
    <div class="visual-training-modal-card" role="dialog" aria-modal="true" aria-labelledby="visualTrainingModalTitle">
      <h3 id="visualTrainingModalTitle" class="visual-training-modal-title">Training Visual Preference</h3>
      <p class="visual-training-modal-subtitle">Like Profiles manually to help AI learn your taste</p>
      <div class="visual-training-modal-count-row">
        <span id="visualTrainingModalCount" class="visual-training-modal-count">0</span>
        <span class="visual-training-modal-count-meta">/ 50 Profiles Liked</span>
      </div>
      <div class="visual-training-modal-progress-track">
        <div id="visualTrainingModalProgress" class="visual-training-modal-progress-fill" style="width:0%"></div>
      </div>
      <div class="visual-training-modal-tier">20 Likes → Basic Calibration</div>
      <div class="visual-training-modal-tier">50 Likes → High Precision Calibration</div>
      <button type="button" id="visualTrainingModalContinue" class="visual-training-modal-continue">Continue</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close="1"]')) {
      modal.classList.remove('show');
    }
  });

  const continueBtn = modal.querySelector('#visualTrainingModalContinue');
  if (continueBtn) {
    continueBtn.addEventListener('click', async () => {
      modal.classList.remove('show');
      await startTrainingModeNow();
    });
  }

  return modal;
}

async function openVisualTrainingModal() {
  const modal = ensureVisualTrainingModal();
  const settings = await getSettings();
  const count = settings?.visualPreferences?.likedPhotos?.length || 0;
  const countEl = document.getElementById('visualTrainingModalCount');
  const progressEl = document.getElementById('visualTrainingModalProgress');

  if (countEl) countEl.textContent = String(count);
  if (progressEl) progressEl.style.width = `${Math.max(0, Math.min((count / 50) * 100, 100))}%`;

  modal.classList.add('show');
}

async function startTrainingModeNow() {
  const tabs = await chrome.tabs.query({
    url: [
      'https://tinder.com/*',
      'https://bumble.com/*',
      'https://*.bumble.com/*'
    ]
  });

  if (tabs.length === 0) {
    showMessage('Please open Tinder or Bumble first', 'error');
    return;
  }

  const activeTab = tabs.find(t => t.active) || tabs[0];
  const isBumble = activeTab.url.includes('bumble.com');

  showMessage(`Starting training mode on ${isBumble ? 'Bumble' : 'Tinder'}... (this may reload the page)`, 'success');

  chrome.runtime.sendMessage({
    action: 'startVisualTraining',
    tabId: activeTab.id
  }, (response) => {
    if (chrome.runtime.lastError) {
      showMessage('Error: ' + chrome.runtime.lastError.message, 'error');
      return;
    }

    if (response && response.success) {
      showMessage('Training mode started! Like 20+ profiles to train AI', 'success');
      setTrainingButtonState(true);
    } else {
      const errorMsg = response?.error || 'Connection failed';
      showMessage(errorMsg.includes('Content script') ? 'Please refresh the page and try again' : `Failed: ${errorMsg}`, 'error');
    }
  });
}

function setTrainingButtonState(isActive) {
  const btn = document.getElementById('startTrainingBtn');
  if (!btn) return;
  if (isActive) {
    btn.textContent = 'Stop Training';
    btn.dataset.trainingActive = '1';
  } else {
    btn.textContent = 'Start Training';
    delete btn.dataset.trainingActive;
  }
}

async function stopTrainingModeNow() {
  const tabs = await chrome.tabs.query({
    url: ['https://tinder.com/*', 'https://bumble.com/*', 'https://*.bumble.com/*']
  });
  if (tabs.length === 0) return;
  const activeTab = tabs.find(t => t.active) || tabs[0];
  chrome.tabs.sendMessage(activeTab.id, { action: 'stopVisualTraining' }, () => {
    if (chrome.runtime.lastError) { }
  });
  setTrainingButtonState(false);
}

async function handleStartTraining() {
  const savedSettings = await getSettings();
  if (!savedSettings.visualPreferences?.enabled) {
    showMessage('Enable Visual Preferences and save changes first.', 'error');
    return;
  }
  const btn = document.getElementById('startTrainingBtn');
  if (btn && btn.dataset.trainingActive === '1') {
    await stopTrainingModeNow();
  } else {
    await startTrainingModeNow();
  }
}

async function handleResetTraining() {
  const confirmed = await window.ModalSystem.confirm(
    'Reset AI Vision',
    'This will permanently delete all learned visual preferences and training data. The AI will no longer know your type and you\'ll need to retrain it from scratch.\n\nThis cannot be undone.',
    'Reset Training'
  );
  if (!confirmed) return;

  const settings = await getSettings();
  settings.visualPreferences = { enabled: false, threshold: 75, likedPhotos: [] };
  await saveSettings(settings);

  updateVisualPreferencesStatus();
  showMessage('Training data reset', 'success');
}
