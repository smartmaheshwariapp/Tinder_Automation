// Extended settings loading
async function loadSettingsExtended() {
  const settings = await getSettings();

  // About source
  let aboutSource = settings.aboutSource || 'tinder';
  const aboutRadios = document.querySelectorAll('input[name="aboutSource"]');
  const manualContent = document.getElementById('aboutManualContent');
  const bioResult = document.getElementById('bioAiResult');
  aboutRadios.forEach(radio => { radio.checked = (radio.value === aboutSource); });
  if (manualContent) manualContent.classList.remove('active');
  if (bioResult) bioResult.classList.remove('show');
  if (aboutSource === 'manual' && manualContent) manualContent.classList.add('active');
  updateAboutPreview();

  // Preview toggle
  const customizePreview = settings.customizePreview || false;
  const customizePreviewCheckbox = document.getElementById('customizePreview');
  const customPromptPreviewTextarea = document.getElementById('customPromptPreview');
  const previewDefaultDisplay = document.getElementById('previewDefaultDisplay');
  const previewCustomEditor = document.getElementById('previewCustomEditor');

  if (customizePreviewCheckbox) customizePreviewCheckbox.checked = customizePreview;
  if (customPromptPreviewTextarea) customPromptPreviewTextarea.value = settings.customPromptPreview || '';

  if (customizePreview) {
    if (previewDefaultDisplay) previewDefaultDisplay.style.display = 'none';
    if (previewCustomEditor) previewCustomEditor.style.display = 'block';
  } else {
    if (previewDefaultDisplay) previewDefaultDisplay.style.display = 'block';
    if (previewCustomEditor) previewCustomEditor.style.display = 'none';
  }

  // 6-mode system
  const enable6Mode = settings.enable6ModeSystem !== false;
  const masterToggle = document.getElementById('enable6ModeSystem');
  const modeSectionContent = document.getElementById('modeSectionContent');
  if (masterToggle) masterToggle.checked = enable6Mode;

  const promptPreviewSection = document.getElementById('promptPreviewSectionHeader');
  const promptPreviewContent = document.getElementById('promptPreviewSectionContent');
  const generatedPromptDisplay = document.getElementById('generatedPromptDisplay');
  const apiKeySectionContent = document.getElementById('apiKeySectionContent');

  if (enable6Mode) {
    if (promptPreviewSection) {
      promptPreviewSection.style.opacity = '0.7';
      promptPreviewSection.style.cursor = 'pointer';
      promptPreviewSection.style.pointerEvents = 'auto';
    }
    const modeHint = document.getElementById('promptPreview6ModeHint');
    if (modeHint) modeHint.style.display = 'block';
    if (promptPreviewContent) {
      promptPreviewContent.style.opacity = '0.7';
      promptPreviewContent.style.pointerEvents = 'none';
    }
    if (generatedPromptDisplay) {
      generatedPromptDisplay.style.opacity = '0.7';
      generatedPromptDisplay.style.filter = 'blur(1.5px)';
    }
    if (modeSectionContent) {
      const modeSectionHeader = document.getElementById('modeSectionHeader');
      if (modeSectionHeader) modeSectionHeader.style.opacity = '1';
      modeSectionContent.style.opacity = '1';
      modeSectionContent.style.pointerEvents = 'auto';
      modeSectionContent.style.filter = 'none';
    }
    if (apiKeySectionContent) apiKeySectionContent.style.pointerEvents = 'auto';
  } else {
    if (promptPreviewSection) {
      promptPreviewSection.style.opacity = '1';
      promptPreviewSection.style.cursor = 'pointer';
      promptPreviewSection.style.pointerEvents = 'auto';
    }
    const modeHint = document.getElementById('promptPreview6ModeHint');
    if (modeHint) modeHint.style.display = 'none';
    if (promptPreviewContent) {
      promptPreviewContent.style.opacity = '1';
      promptPreviewContent.style.pointerEvents = 'auto';
    }
    if (generatedPromptDisplay) {
      generatedPromptDisplay.style.opacity = '1';
      generatedPromptDisplay.style.filter = 'none';
    }
    if (modeSectionContent) {
      const modeSectionHeader = document.getElementById('modeSectionHeader');
      if (modeSectionHeader) modeSectionHeader.style.opacity = '0.5';
      modeSectionContent.style.opacity = '0.5';
      modeSectionContent.style.pointerEvents = 'none';
      modeSectionContent.style.filter = 'grayscale(0.5)';
    }
    if (apiKeySectionContent) apiKeySectionContent.style.pointerEvents = 'auto';
  }

  // Load mode settings
  const promptModes = settings.promptModes || {};
  const modes = ['intro', 'followup', 'conversation', 'datesetup', 'moveoffapp', 'exit'];

  modes.forEach(mode => {
    const modeData = promptModes[mode] || {};
    const useCustomCheckbox = document.getElementById(`${mode}UseCustom`);
    const promptTextarea = document.getElementById(`${mode}Prompt`);
    const defaultDisplay = document.getElementById(`${mode}DefaultDisplay`);
    const customEditor = document.getElementById(`${mode}CustomEditor`);

    if (useCustomCheckbox) {
      useCustomCheckbox.checked = modeData.useCustom || false;

      if (modeData.useCustom) {
        if (defaultDisplay) defaultDisplay.style.display = 'none';
        if (customEditor) customEditor.style.display = 'block';
      } else {
        if (defaultDisplay) defaultDisplay.style.display = 'block';
        if (customEditor) customEditor.style.display = 'none';
      }
    }

    if (promptTextarea) promptTextarea.value = modeData.customPrompt || '';

    if (mode === 'followup') {
      setCustomSelectValue('followupDelaySelect', modeData.delay || '24');
      setCustomSelectValue('followupMaxAttemptsSelect', modeData.maxAttempts || '2');
    }

    if (mode === 'datesetup') {
      setCustomSelectValue('datesetupGoalSelect', modeData.goal || 'coffee');
    }
  });

  // Visual preferences
  const visualPrefs = settings.visualPreferences || { enabled: false, threshold: 75, likedPhotos: [] };
  document.getElementById('visualPreferencesEnabled').checked = visualPrefs.enabled;
  document.getElementById('visualThreshold').value = visualPrefs.threshold;
  updateVisualPreferencesUI();

  // Active hours preset
  const activeHours = settings.activeHours || { enabled: false, preset: '24/7', startTime: '00:00', endTime: '23:59' };
  const presetRadio = document.querySelector(`input[name="activeHoursPreset"][value="${activeHours.preset}"]`);
  if (presetRadio) presetRadio.checked = true;
  updateActiveHoursUI();

  // Age filter
  updateAgeFilterUI();
  updateRangeFill();

  // Distance filter
  updateDistanceFilterUI();
  updateDistanceDisplay();
  // Distance filter toggle removed — always expand the section on load
  const _distContent = document.getElementById('distanceFilterSectionContent');
  if (_distContent) {
    _distContent.style.height = 'auto';
    _distContent.style.paddingTop = '12px';
    _distContent.style.maxHeight = 'none';
    _distContent.style.opacity = '1';
    _distContent.classList.add('expanded');
  }

  // Safety mode
  const safetyMode = await chrome.storage.local.get('safetyMode');
  const isSafetyOn = safetyMode.safetyMode !== false;
  updateSafetyModeStatusDisplay();
  updateSafetyModeHint();

  chrome.runtime.sendMessage({ action: 'getRateLimitStatus' }, (response) => {
    if (response) {
      const likesLimit = response.likes.limit;
      const messagesLimit = response.messages.limit;
      const safetyLabel = document.querySelector('#safetyMode + .toggle-slider + .toggle-label');
      if (safetyLabel) safetyLabel.textContent = `Limit to ${likesLimit} likes/${messagesLimit} messages per hour`;
    }
  });

  updatePriorityPreview();

  // Stop conditions
  const stopConditions = settings.stopConditions || [];
  document.querySelectorAll('input[name="stopCondition"]').forEach(cb => { cb.checked = false; });
  if (stopConditions.length === 0) {
    const never = document.querySelector('input[name="stopCondition"][value="never"]');
    if (never) never.checked = true;
  } else {
    stopConditions.forEach(cond => {
      const cb = document.querySelector(`input[name="stopCondition"][value="${cond}"]`);
      if (cb) cb.checked = true;
    });
  }

  const stopAfterGoalToggle = document.getElementById('automationStopAfterGoal');
  if (stopAfterGoalToggle) {
    stopAfterGoalToggle.checked = stopConditions.length > 0 && settings.stopAfterGoalEnabled !== false;
  }

  if (typeof AutomationViews !== 'undefined' && typeof AutomationViews._renderGoalDropdown === 'function') {
    AutomationViews._renderGoalDropdown();
  }

  // Load contact details — delegate to shared helper so it can also be
  // called by AutomationViews._buildGoalControls() after the DOM exists.
  await populateContactDetails(settings);

  // Load Move Off App config (shared by Telegram, Instagram, Tango goals)
  const moveOffAppPushAllEl = document.getElementById('moveOffAppPushAllMatches');
  const moveOffAppMinMsgEl  = document.getElementById('moveOffAppMinMessages');
  const moveOffAppMaxMsgEl  = document.getElementById('moveOffAppMaxMessages');
  const moveOffAppMaxPersEl = document.getElementById('moveOffAppMaxPersuasion');
  if (moveOffAppPushAllEl) moveOffAppPushAllEl.checked = settings.moveOffAppPushAllMatches === true;
  if (moveOffAppMinMsgEl)  moveOffAppMinMsgEl.value    = settings.moveOffAppMinMessages ?? 0;
  if (moveOffAppMaxMsgEl)  moveOffAppMaxMsgEl.value    = settings.moveOffAppMaxMessages ?? 0;
  if (moveOffAppMaxPersEl) moveOffAppMaxPersEl.value   = settings.moveOffAppMaxPersuasion ?? 2;

  // Load consecutive messages toggle
  const consecutiveMsgsEl = document.getElementById('consecutiveMessagesEnabled');
  if (consecutiveMsgsEl) consecutiveMsgsEl.checked = settings.consecutiveMessagesEnabled === true;

  // Load gender override
  const genderOverride = settings.userGenderOverride || 'auto';
  document.querySelectorAll('.automation-v2-gender-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.value === genderOverride);
  });
  // Sync visibility of the config block based on saved goals
  if (typeof AutomationViews !== 'undefined' && typeof AutomationViews._syncMoveOffAppConfigVisibility === 'function') {
    AutomationViews._syncMoveOffAppConfigVisibility();
  }

  updateSafetyModeState();
  updateGeneratedPromptPreview();
}

/**
 * Populate the "Your Contact Details" fields from storage.
 * Safe to call multiple times — skips fields whose DOM elements don't exist yet.
 * Also handles the one-time migration of onboarding whatsappNumber → contactDetails.
 *
 * Called from:
 *   1. loadSettingsExtended() — covers the normal reload/discard flow
 *   2. AutomationViews._buildGoalControls() — covers first popup open where
 *      the DOM is built AFTER loadSettingsExtended() already ran.
 */
async function populateContactDetails(settingsOverride) {
  const settings = settingsOverride || await getSettings();

  // ── Migration: onboarding whatsappNumber → contactDetails.whatsapp ──
  // Runs once: as soon as contactDetails.whatsapp.value is set it won't run again.
  if (
    settings.whatsappNumber &&
    typeof settings.whatsappNumber === 'string' &&
    settings.whatsappNumber.trim() &&
    !settings.contactDetails?.whatsapp?.value?.trim()
  ) {
    if (!settings.contactDetails) settings.contactDetails = {};
    if (!settings.contactDetails.whatsapp) settings.contactDetails.whatsapp = {};
    settings.contactDetails.whatsapp.value   = settings.whatsappNumber.trim();
    settings.contactDetails.whatsapp.enabled = settings.contactDetails.whatsapp.enabled === true;
    // Persist so it survives popup close
    chrome.storage.local.get('userSettings', (data) => {
      const existing = data.userSettings || {};
      if (!existing.contactDetails?.whatsapp?.value?.trim()) {
        chrome.storage.local.set({
          userSettings: {
            ...existing,
            contactDetails: {
              ...(existing.contactDetails || {}),
              whatsapp: {
                value:   settings.whatsappNumber.trim(),
                enabled: existing.contactDetails?.whatsapp?.enabled === true,
              },
            },
          },
        });
      }
    });
  }

  const cd = settings.contactDetails || {};
  const contactFields = ['instagram', 'whatsapp', 'phone', 'telegram', 'tango', 'snapchat'];
  let anyContactActive = false;

  contactFields.forEach(field => {
    const key       = field.charAt(0).toUpperCase() + field.slice(1);
    const valueEl   = document.getElementById(`contact${key}Value`);
    const enabledEl = document.getElementById(`contact${key}Enabled`);
    if (!valueEl || !enabledEl) return; // DOM not ready yet — skip silently

    valueEl.value     = cd[field]?.value   || '';
    enabledEl.checked = cd[field]?.enabled === true;
    valueEl.disabled  = !enabledEl.checked;
    valueEl.style.opacity = enabledEl.checked ? '1' : '0.7';
    valueEl.style.cursor  = enabledEl.checked ? 'text' : 'default';

    if (cd[field]?.value?.trim() || cd[field]?.enabled) anyContactActive = true;
  });

  // Do NOT auto-expand the contact section on load — it should be collapsed by default.
  // The user can open it manually. It auto-expands when a move-to goal is selected (automation-views.js).
  // Previously this auto-expanded whenever any contact was filled, which was jarring on every popup open.
}
