// Settings save/load/discard
async function loadSettings() {
  const settings = await getSettings();

  // API Key handling - respect centralized config
  const apiKeyInput = document.getElementById('apiKey');
  if (apiKeyInput) {
    if (window.API_CONFIG?.FEATURES?.HIDE_USER_API_KEY) {
      apiKeyInput.value = '';
      apiKeyInput.closest('.section')?.classList.add('hidden-by-config');
    } else {
      apiKeyInput.value = settings.apiKey || '';
    }
  }

  setCustomSelectValue('intentionsSelect', settings.intentions || 'short_term');
  setCustomSelectValue('conversationLanguageSelect', settings.conversationLanguage || 'en');
  setCustomSelectValue('chattingStyleSelect', settings.chattingStyle || 'freestyle');

  // AI Model handling - respect centralized config
  if (window.API_CONFIG?.FEATURES?.HIDE_MODEL_SELECTION) {
    const aiModelSection = document.getElementById('aiModelSection');
    if (aiModelSection) aiModelSection.classList.add('hidden-by-config');
    setCustomSelectValue('aiModelSelect', window.API_CONFIG?.DEFAULT_MODEL || 'gpt-4o-mini');
  } else {
    setCustomSelectValue('aiModelSelect', settings.aiModel || 'gpt-4o-mini');
  }

  document.getElementById('useEmojis').checked = settings.useEmojis === true;
  document.getElementById('emojiProbability').value = Number.isFinite(settings.emojiProbability) ? settings.emojiProbability : 30;
  document.getElementById('randomHearts').checked = settings.randomHearts || false;
  document.getElementById('randomHeartsProbability').value = settings.randomHeartsProbability || 30;
  document.getElementById('aboutMyself').value = settings.aboutMyself || '';

  document.getElementById('likesPerCycle').value = settings.likesPerCycle !== undefined ? settings.likesPerCycle : 50;
  document.getElementById('messagesPerCycle').value = settings.messagesPerCycle !== undefined ? settings.messagesPerCycle : 50;
  document.getElementById('scheduleInterval').value = settings.scheduleInterval || 60;
  document.getElementById('minReplySlots').value = settings.minReplyPercent || 30;
  document.getElementById('maxNewMatchSlots').value = settings.maxNewMatchPercent || 70;

  const ageFilter = settings.ageFilter || { enabled: false, minAge: 18, maxAge: 99 };
  document.getElementById('ageFilterEnabled').checked = ageFilter.enabled;
  document.getElementById('minAge').value = ageFilter.minAge;
  document.getElementById('maxAge').value = ageFilter.maxAge;

  const distanceFilter = settings.distanceFilter || { enabled: false, maxDistance: 50 };
  document.getElementById('distanceFilterEnabled').checked = distanceFilter.enabled;
  document.getElementById('maxDistance').value = distanceFilter.maxDistance;

  const activeHours = settings.activeHours || { enabled: false, preset: '24/7', startTime: '00:00', endTime: '23:59' };
  document.getElementById('activeHoursEnabled').checked = activeHours.enabled;
  document.getElementById('startTime').value = activeHours.startTime;
  document.getElementById('endTime').value = activeHours.endTime;

  document.getElementById('blockMessagesEnabled').checked = settings.blockMessages || false;

  const safetyMode = await chrome.storage.local.get('safetyMode');
  document.getElementById('safetyMode').checked = safetyMode.safetyMode !== false;

  updateSafetyModeState();
  updateGeneratedPromptPreview();
  if (typeof SettingsTabViews !== 'undefined' && typeof SettingsTabViews.syncPresetButtons === 'function') {
    SettingsTabViews.syncPresetButtons();
  }
}

async function handleSave() {
  const state = await getAgentState();
  if (state.isRunning && state.currentPhase) {
    showCycleRunningWarning();
    return;
  }

  // API Key handling - respect centralized config
  let apiKey = '';
  if (!window.API_CONFIG?.FEATURES?.HIDE_USER_API_KEY) {
    apiKey = document.getElementById('apiKey')?.value?.trim() || '';
    if (apiKey && !validateApiKeyFormat(apiKey)) {
      showMessage('Invalid API key format. Must start with "sk-" or "sk-proj-"', 'error');
      return;
    }
  }

  // AI Model handling - respect centralized config
  let aiModel = window.API_CONFIG?.DEFAULT_MODEL || 'gpt-4o-mini';
  if (!window.API_CONFIG?.FEATURES?.HIDE_MODEL_SELECTION) {
    aiModel = getCustomSelectValue('aiModelSelect') || aiModel;
  }

  const extendedSettings = await handleSaveExtended();
  if (!extendedSettings) return;

  const existingSettings = await getSettings();

  const settings = {
    ...existingSettings,
    apiKey: apiKey,
    intentions: getCustomSelectValue('intentionsSelect'),
    conversationLanguage: getCustomSelectValue('conversationLanguageSelect'),
    chattingStyle: getCustomSelectValue('chattingStyleSelect'),
    aiModel: aiModel,
    useEmojis: document.getElementById('useEmojis').checked,
    emojiProbability: Math.min(100, Math.max(0, parseInt(document.getElementById('emojiProbability').value) || 30)),
    randomHearts: document.getElementById('randomHearts').checked,
    randomHeartsProbability: parseInt(document.getElementById('randomHeartsProbability').value) || 30,
    aboutMyself: document.getElementById('aboutMyself').value.trim(),
    likesPerCycle: (() => {
      const val = parseInt(document.getElementById('likesPerCycle').value);
      return isNaN(val) ? 50 : val;
    })(),
    messagesPerCycle: (() => {
      const val = parseInt(document.getElementById('messagesPerCycle').value);
      return isNaN(val) ? 50 : val;
    })(),
    scheduleInterval: parseInt(document.getElementById('scheduleInterval').value) || 60,
    scheduleIntervalCustomized: true,
    minReplyPercent: (() => {
      const val = parseInt(document.getElementById('minReplySlots').value);
      return isNaN(val) ? 30 : val;
    })(),
    maxNewMatchPercent: (() => {
      const val = parseInt(document.getElementById('maxNewMatchSlots').value);
      return isNaN(val) ? 70 : val;
    })(),
    ageFilter: {
      enabled: document.getElementById('automationV2Shell') ? true : document.getElementById('ageFilterEnabled').checked,
      minAge: parseInt(document.getElementById('minAge').value) || 18,
      maxAge: parseInt(document.getElementById('maxAge').value) || 99
    },
    distanceFilter: {
      enabled: document.getElementById('distanceFilterEnabled')?.checked || false,
      maxDistance: parseInt(document.getElementById('maxDistance').value) || 50
    },
    activeHours: {
      enabled: document.getElementById('activeHoursEnabled').checked,
      preset: document.querySelector('input[name="activeHoursPreset"]:checked')?.value || '24/7',
      startTime: document.getElementById('startTime').value,
      endTime: document.getElementById('endTime').value
    },
    blockMessages: document.getElementById('blockMessagesEnabled').checked,
    ...extendedSettings
  };

  const safetyMode = document.getElementById('safetyMode').checked;

  // When toggling safety mode from OFF → ON, wipe any rate-limit data accumulated
  // while safety was off. Those timestamps were recorded without enforcement and would
  // falsely cap the very next safety-ON cycle (e.g. "only 14 swipes remain").
  const _prevSafetyRaw = await chrome.storage.local.get('safetyMode');
  const _prevSafety = _prevSafetyRaw.safetyMode !== false; // default true
  if (safetyMode && !_prevSafety) {
    await chrome.storage.local.remove('rateLimitData');
    console.log('[FlirtEasy] Safety mode re-enabled — rate-limit history cleared for fresh window.');
  }

  // Change saveChangesBtn state to loading/disabled to avoid double-clicks
  const saveBtn = document.getElementById('saveChangesBtn');
  const discardBtn = document.getElementById('discardBtn');
  let originalSaveText = 'Save Changes';
  if (saveBtn) {
    originalSaveText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    saveBtn.style.opacity = '0.7';
    saveBtn.style.cursor = 'not-allowed';
  }
  if (discardBtn) {
    discardBtn.disabled = true;
    discardBtn.style.opacity = '0.7';
    discardBtn.style.cursor = 'not-allowed';
  }

  // Determine if the ACTIVE tab is Tinder/Bumble and distance filter needs to be applied.
  // We deliberately only apply when the platform is the current tab — applying to a
  // background tab requires a reload which would be disruptive.
  let willApplyDistance = false;
  let activePlatform = null;
  if (settings.distanceFilter?.enabled) {
    try {
      // Only apply if the distance value actually changed since last apply
      const stored = await chrome.storage.local.get('lastAppliedDistance');
      const lastApplied = stored?.lastAppliedDistance ?? null;
      const currentDistance = settings.distanceFilter.maxDistance;
      if (lastApplied !== currentDistance) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.url?.includes('tinder.com')) {
          willApplyDistance = true;
          activePlatform = 'tinder';
        } else if (activeTab?.url?.includes('bumble.com')) {
          willApplyDistance = true;
          activePlatform = 'bumble';
        }
      }
    } catch (_) {}
  }

  if (willApplyDistance) {
    const platformName = activePlatform === 'tinder' ? 'Tinder' : 'Bumble';
    showMessage(`Saving settings & applying distance to ${platformName}...`, 'success');
  } else {
    showMessage('Saving settings...', 'success');
  }

  await chrome.storage.local.set({ safetyMode });
  await saveSettings(settings);

  let distanceMessage = '';
  if (willApplyDistance) {
    try {
      console.log(`[Settings] Applying distance to ${activePlatform}, maxDistance:`, settings.distanceFilter.maxDistance);
      let res;
      if (activePlatform === 'tinder' && typeof _applyDistanceToTinderSilently === 'function') {
        console.log('[Settings] Calling _applyDistanceToTinderSilently');
        res = await _applyDistanceToTinderSilently(settings.distanceFilter.maxDistance);
      } else if (activePlatform === 'bumble' && typeof _applyDistanceToBumbleSilently === 'function') {
        console.log('[Settings] Calling _applyDistanceToBumbleSilently');
        res = await _applyDistanceToBumbleSilently(settings.distanceFilter.maxDistance);
      }
      
      console.log('[Settings] Distance automation result:', res);
      if (res && res.success) {
        const platformName = activePlatform === 'tinder' ? 'Tinder' : 'Bumble';
        const requested = settings.distanceFilter.maxDistance;
        const applied = res.valueSet;
        const unit = res.unit || 'km';
        if (applied < requested) {
          // Platform capped the distance (e.g. max 161 km) but plugin will still filter at requested value
          distanceMessage = ` · Swiping distance set to ${applied} ${unit} · Message filter: ${requested} km`;
        } else {
          distanceMessage = ` & ${platformName} distance set to ${applied} ${unit}`;
        }
        console.log('[Settings] Distance message:', distanceMessage);
      } else if (!res || !res.success) {
        // Platform slider not found — plugin still filters at the requested value
        const requested = settings.distanceFilter.maxDistance;
        distanceMessage = ` · Message filter distance: ${requested} km`;
      }
      // Always cache the attempted value — prevents re-firing on every save when the
      // platform doesn't have the distance slider (e.g. non-premium Bumble account).
      // Cache clears automatically when the user moves the slider (see distance-filter-v2.js).
      chrome.storage.local.set({ lastAppliedDistance: settings.distanceFilter.maxDistance });
    } catch (err) {
      console.error('[Settings] Failed to apply distance:', err);
      // Still cache so we don't retry on every subsequent save
      chrome.storage.local.set({ lastAppliedDistance: settings.distanceFilter.maxDistance });
    }
  }

  hideSaveBar();

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = originalSaveText;
    saveBtn.style.opacity = '';
    saveBtn.style.cursor = '';
  }
  if (discardBtn) {
    discardBtn.disabled = false;
    discardBtn.style.opacity = '';
    discardBtn.style.cursor = '';
  }

  showMessage(`Settings saved successfully${distanceMessage}!`, 'success');

  _pushSettingsSnapshot(settings, safetyMode).catch(() => {});
}

async function _pushSettingsSnapshot(settings, safetyMode) {
  const userData = await chrome.storage.local.get('user');
  const token = userData?.user?.token;
  if (!token) return;

  let platform = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    if (url.includes('tinder.com')) platform = 'tinder';
    else if (url.includes('bumble.com')) platform = 'bumble';
  } catch (_) {}

  const payload = {
    safeMode: safetyMode,
    likesPerCycle: settings.likesPerCycle,
    messagesPerCycle: settings.messagesPerCycle,
    scheduleInterval: settings.scheduleInterval,
    intentions: settings.intentions,
    chattingStyle: settings.chattingStyle,
    aiModel: settings.aiModel,
    useEmojis: settings.useEmojis,
    randomHearts: settings.randomHearts,
    ageFilter: settings.ageFilter,
    distanceFilter: settings.distanceFilter,
    activeHours: settings.activeHours,
    blockMessages: settings.blockMessages,
    minReplyPercent: settings.minReplyPercent,
    maxNewMatchPercent: settings.maxNewMatchPercent,
    enable6ModeSystem: settings.enable6ModeSystem,
    stopConditions: settings.stopConditions,
    ...(settings.contactDetails ? { contactDetails: settings.contactDetails } : {}),
    ...(settings.moveOffAppPushAllMatches !== undefined ? { moveOffAppPushAllMatches: settings.moveOffAppPushAllMatches } : {}),
    ...(settings.moveOffAppMinMessages   !== undefined ? { moveOffAppMinMessages:   settings.moveOffAppMinMessages }   : {}),
    ...(settings.moveOffAppMaxMessages   !== undefined ? { moveOffAppMaxMessages:   settings.moveOffAppMaxMessages }   : {}),
    ...(settings.moveOffAppMaxPersuasion !== undefined ? { moveOffAppMaxPersuasion: settings.moveOffAppMaxPersuasion } : {}),
    ...(settings.userGenderOverride    ? { userGenderOverride: settings.userGenderOverride }                     : {}),
  };

  await fetch(`${CONFIG.API_BASE_URL}/api/track/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      event_type: 'settings_change',
      platform: platform,
      payload,
      client_ts: new Date().toISOString(),
    }),
  });
}

async function handleDiscard() {
  await loadSettings();
  await loadSettingsExtended();
  // Resync the visual bio segment to match the restored storage state
  const settingsCard = document.querySelector('.st-bio-card');
  if (settingsCard && typeof SettingsTabViews !== 'undefined') {
    SettingsTabViews._syncBioSegFromRadio(settingsCard);
  }
  hideSaveBar();
  showMessage('Changes discarded', 'success');
}

function validateApiKeyFormat(apiKey) {
  if (!apiKey || apiKey.length === 0) return true;
  const isLegacy = /^sk-[A-Za-z0-9]{48}$/.test(apiKey);
  const isProject = /^sk-proj-[A-Za-z0-9_-]{48,}$/.test(apiKey);
  return isLegacy || isProject;
}
