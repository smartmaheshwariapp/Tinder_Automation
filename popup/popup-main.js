// Main popup entry point - imports all modules
document.addEventListener('DOMContentLoaded', async () => {
  // Force-refresh trial status from server on every popup open so admin-granted
  // extensions (e.g. community claim) are reflected immediately without waiting
  // for the stale-cache timeout.
  chrome.runtime.sendMessage({ action: 'refreshTrialStatus' }).catch(() => {});

  // 1. Initialize Progress Feed (top priority)
  try {
    if (typeof initializeProgressFeed === 'function') initializeProgressFeed();
  } catch (e) { console.error('[ProgressFeed] Init failed:', e); }

  try {
    if (typeof initializeCalendarEvents === 'function') initializeCalendarEvents();
  } catch (e) { console.error('[CalendarEvents] Init failed:', e); }

  // Detect current platform + load cached flags in parallel (instant, no network block)
  const [tabResult, cachedFlagsResult] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.storage.local.get('remoteFeatureFlags'),
  ]);
  const [tab] = tabResult;
  if (tab && tab.url) {
    if (tab.url.includes('bumble.com')) {
      window.CURRENT_PLATFORM = 'Bumble';
    } else if (tab.url.includes('tinder.com')) {
      window.CURRENT_PLATFORM = 'Tinder';
    }
  }

  // Fire remote config refresh in background — don't block UI on network
  chrome.runtime.sendMessage({ action: 'refreshRemoteConfig' }).catch(() => {});

  // ── Feature flag / maintenance check (uses cached flags — instant render) ──
  const { remoteFeatureFlags } = cachedFlagsResult;
  if (remoteFeatureFlags) {
    const platformLC = (window.CURRENT_PLATFORM || '').toLowerCase(); // 'tinder' | 'bumble' | ''
    const flagKey = platformLC === 'tinder' ? 'tinder_enabled'
                  : platformLC === 'bumble' ? 'bumble_enabled'
                  : null;
    if (remoteFeatureFlags.force_reauth === true && remoteFeatureFlags.force_reauth_enabled_at) {
      const { user: _reauthUser } = await chrome.storage.local.get('user');
      // Sign out if user's session was created BEFORE force_reauth was triggered
      if (_reauthUser && (!_reauthUser.lastAuth || _reauthUser.lastAuth < remoteFeatureFlags.force_reauth_enabled_at)) {
        fetch(`${CONFIG.API_BASE_URL}/auth/reauth-ack`, { method: 'POST' }).catch(() => {});
        await chrome.storage.local.remove(['user', 'trial_v3', 'refreshToken']);
        chrome.storage.sync.remove(['userBackup', 'refreshTokenBackup']).catch(() => {});
        if (typeof openAuthModal === 'function') openAuthModal(true);
        return;
      }
    }

    if (flagKey && remoteFeatureFlags[flagKey] === false) {
      const name = platformLC.charAt(0).toUpperCase() + platformLC.slice(1);
      document.body.innerHTML = `
        <div style="
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          min-height:100vh; padding:32px 24px; background:#FAF9F7; text-align:center; font-family:inherit;
        ">
          <div style="font-size:42px; margin-bottom:16px;">🔧</div>
          <h2 style="margin:0 0 10px; font-size:18px; color:#2D2926; font-weight:700;">${name} is under maintenance</h2>
          <p style="margin:0 0 24px; font-size:13px; color:#888; line-height:1.6; max-width:260px;">
            We're making improvements to the ${name} integration. The plugin will be back shortly.
          </p>
          <div style="
            background:#F5F0FF; border:1px solid #DDD6FE; border-radius:8px;
            padding:10px 16px; font-size:11px; color:#7C3AED; line-height:1.5;
          ">
            If this seems wrong, please try reloading the extension.
          </div>
        </div>`;
      return;
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  initializePlatformSpecificUI();

  if (typeof FreeAccountModal !== 'undefined') {
    FreeAccountModal.init(window.CURRENT_PLATFORM);
  }

  // Restore session from sync backup if local storage was wiped
  const _localUser = await chrome.storage.local.get(['user', 'refreshToken']);
  if (!_localUser.user) {
    const _syncBackup = await chrome.storage.sync.get(['userBackup', 'refreshTokenBackup']).catch(() => ({}));
    if (_syncBackup.userBackup?.token) {
      await chrome.storage.local.set({ user: { ..._syncBackup.userBackup, signedIn: true } });
      if (_syncBackup.refreshTokenBackup) {
        await chrome.storage.local.set({ refreshToken: _syncBackup.refreshTokenBackup });
      }
    }
  } else if (!_localUser.refreshToken) {
    const _syncBackup = await chrome.storage.sync.get('refreshTokenBackup').catch(() => ({}));
    if (_syncBackup.refreshTokenBackup) {
      await chrome.storage.local.set({ refreshToken: _syncBackup.refreshTokenBackup });
    }
  }

  await Promise.all([
    loadSettings(),
    loadSettingsExtended(),
    updateStatus(),
    updateAccountButton(),
  ]);

  if (typeof HeaderManager !== 'undefined') {
    HeaderManager.init();
  }

  if (typeof AutomationViews !== 'undefined' && typeof AutomationViews.init === 'function') {
    AutomationViews.init();
  }

  if (typeof updateTrialUI === 'function') {
    await updateTrialUI();
  }
  document.getElementById('trialStatusContainer')?.classList.remove('hud-loading');

  // PRODUCTION SYNC: Always verify status on launch
  if (typeof syncUserStatus === 'function') {
    syncUserStatus(); // Run in background to not block UI
  }

  // Auto re-login prompt: if token expired during a background cycle, show login modal
  const { sessionExpired } = await chrome.storage.local.get('sessionExpired');
  if (sessionExpired) {
    await chrome.storage.local.remove('sessionExpired');
    if (typeof openAuthModal === 'function') {
      openAuthModal(true);
    }
  }


  // Check if onboarding is complete before showing main UI
  const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
  if (onboardingComplete === false) {
    // Redirect the popup to the new full-page onboarding
    window.location.href = '../onboarding/onboarding.html';
    return; // Stop popup initialization
  }

  if (typeof SettingsTabViews !== 'undefined') SettingsTabViews.init();

  migrateAdvancedContentToSettings();
  await repairLifetimeStatsTotals();
  await migrateLifetimeStatsToAchievements();

  initializeTabs();
  initializeSettingsMenu();
  initializeAchievementsModal();
  initializeCustomSelects();
  initializeChangeTracking();
  initializePreviewToggle();
  initializeAboutOptions();
  initializeBioGenerator();
  initializeVisualPreferences();
  initializeSmartReactionsGuide();
  initializeConsecutiveMessagesGuide();
  initializeAccountButton();
  initializeSwipeStats();
  initializeCollapsibleSections();
  if (typeof SettingsTabViews !== 'undefined') await SettingsTabViews.postInit();
  initializeModeTabs();
  initializeModeToggles();
  initializeModeTestButtons();
  initializePreviewButtons();
  initializeMasterToggle();
  initializeAgeSlider();
  initializeDistanceSlider();
  if (typeof initializeGeolocationDropdowns === 'function') initializeGeolocationDropdowns();
  initializeTimePickers();
  initializeAboutYouToggle();
  initializeRunBtnCarousel();
  initializePrioritySlider();
  initializeMessagingPriorityGuide();
  initializeScheduleUI();
  initializeStopAgentGuide();
  initializeAgeFilterGuide();
  setupCycleGuideListeners();
  setupCycleSteppers();
  reorderProfileSections();
  if (typeof initializeEliteInteractions === 'function') initializeEliteInteractions();
  updateGeneratedPromptPreview();
  updateLifetimeStats();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'trainingCompleted') {
      markAsChanged();
      showMessage('Training complete! Save to apply visual preferences.', 'success');
      if (typeof setTrainingButtonState === 'function') setTrainingButtonState(false);
    } else if (message.action === 'trainingExited') {
      if (typeof setTrainingButtonState === 'function') setTrainingButtonState(false);
    } else if (message.action === 'trainingProgressUpdate') {
      const count = message.count || 0;
      const profilesEl = document.getElementById('profilesTrained');
      if (profilesEl) profilesEl.textContent = `${count}/50`;
      const autoCountEl = document.getElementById('automationVisualTrainingCount');
      if (autoCountEl) autoCountEl.textContent = `${count} / 50 Likes Collected`;
      if (typeof updateVisualPreferencesStatus === 'function') updateVisualPreferencesStatus();
    } else if (message.action === 'trialStatsUpdated' || message.action === 'statsUpdated') {
      if (typeof updateTrialUI === 'function') updateTrialUI();
      if (typeof updateLifetimeStats === 'function') updateLifetimeStats();
      if (typeof updateStatusExtended === 'function') updateStatusExtended();
    } else if (message.action === 'trialMessageLimitReached') {
      showPersistentWarning('Your 30 trial AI messages are used up. Upgrade to Pro for unlimited messaging.');
      const upgradeBtn = document.getElementById('trialUpgradeBtn');
      if (upgradeBtn) upgradeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  document.getElementById('saveChangesBtn').addEventListener('click', handleSave);
  document.getElementById('discardBtn').addEventListener('click', handleDiscard);
  document.getElementById('startAgentBtn').addEventListener('click', handleStart);
  document.getElementById('stopAgentBtn').addEventListener('click', handleStop);
  document.getElementById('runNowBtn').addEventListener('click', handleRunNow);
  document.getElementById('testOpenAIBtn').addEventListener('click', handleTestOpenAI);
  document.getElementById('viewLogsBtn').addEventListener('click', handleViewLogs);
  document.getElementById('exportLogsBtn').addEventListener('click', handleExportLogs);
  document.getElementById('resetLimitsBtn').addEventListener('click', handleResetLimits);
  document.getElementById('clearDataBtn').addEventListener('click', handleClearData);

  const tinderProfileOption = document.getElementById('tinderProfileOption');
  if (tinderProfileOption) {
    tinderProfileOption.addEventListener('click', handleTinderCardClick);
  }

  const aiGenerateOption = document.getElementById('aiGenerateOption');
  if (aiGenerateOption) {
    aiGenerateOption.addEventListener('click', handleAiCardClick);
  }

  const apiKeyToggle = document.getElementById('toggleApiKey');
  if (apiKeyToggle) {
    apiKeyToggle.addEventListener('click', () => {
      const apiKeyInput = document.getElementById('apiKey');
      const eyeIcon = document.querySelector('.eye-icon');
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
      } else {
        apiKeyInput.type = 'password';
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      }
    });
  }

  document.getElementById('customLimitsBtn')?.addEventListener('click', handleCustomLimits);
  document.getElementById('menuCustomLimits')?.addEventListener('click', handleCustomLimits);

  document.getElementById('activeHoursEnabled')?.addEventListener('change', updateActiveHoursUI);
  document.querySelectorAll('input[name="activeHoursPreset"]').forEach(radio => {
    radio.addEventListener('change', handleActiveHoursPresetChange);
  });

  document.querySelectorAll('input[name="stopCondition"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const value = e.target.value;
      const isChecked = e.target.checked;

      if (isChecked) {
        if (value === 'never') {
          // Uncheck everything else if 'never' is picked
          document.querySelectorAll('input[name="stopCondition"]').forEach(cb => {
            if (cb.value !== 'never') cb.checked = false;
          });
        } else {
          // Uncheck 'never' if anything else is picked
          const never = document.querySelector('input[name="stopCondition"][value="never"]');
          if (never) never.checked = false;
        }
      } else {
        // SAFETY: If we unchecked the last box, re-check 'never' so something is always selected
        const anyChecked = document.querySelector('input[name="stopCondition"]:checked');
        if (!anyChecked) {
          const never = document.querySelector('input[name="stopCondition"][value="never"]');
          if (never) never.checked = true;
        }
      }
      markAsChanged();
    });
  });

  setInterval(updateStatus, 500);
  setInterval(updateStatusExtended, 500);
  setInterval(updateTrialUI, 1000);
  setInterval(updateLifetimeStats, 5000);

  // Handle Upgrade Button
  document.getElementById('trialUpgradeBtn')?.addEventListener('click', async () => {
    const userStore = await chrome.storage.local.get('user');
    if (!userStore.user || !userStore.user.signedIn) {
      // Guest: Open Login Modal
      if (typeof openAuthModal === 'function') openAuthModal();
    } else {
      // User: Open Pricing
      chrome.tabs.create({ url: 'https://flirteasy.io/Pricing' });
    }
  });
});

async function repairLifetimeStatsTotals() {
  const result = await chrome.storage.local.get(['lifetimeStats']);
  const lt = result.lifetimeStats;
  if (!lt) return;

  const needsRepair =
    !Number.isFinite(lt.totalSwipes) ||
    !Number.isFinite(lt.totalMessages) ||
    !Number.isFinite(lt.totalMatches);

  if (!needsRepair) return;

  lt.totalSwipes   = Number.isFinite(lt.totalSwipes)   ? lt.totalSwipes   : (lt.todaySwipes   || 0);
  lt.totalMessages = Number.isFinite(lt.totalMessages) ? lt.totalMessages : (lt.todayMessages || 0);
  lt.totalMatches  = Number.isFinite(lt.totalMatches)  ? lt.totalMatches  : (lt.todayMatches  || 0);

  await chrome.storage.local.set({ lifetimeStats: lt });
  console.log('[Repair] Fixed NaN/undefined lifetime stat totals:', lt);
}

async function migrateLifetimeStatsToAchievements() {
  console.log('[Migration] Checking if lifetime stats need to be migrated to achievements...');

  const { achievementData, lifetimeStats, hasManuallyCleared } = await chrome.storage.local.get(['achievementData', 'lifetimeStats', 'hasManuallyCleared']);

  // If user manually cleared, don't re-migrate
  if (hasManuallyCleared) {
    console.log('[Migration] User has manually cleared data, skipping migration');
    return;
  }

  // Check if we need to re-process achievements (stats exist but no unlocks)
  if (achievementData && achievementData.userStats) {
    const hasStats = Object.values(achievementData.userStats).some(val => val > 0);
    const hasUnlocks = achievementData.unlockedBadges && achievementData.unlockedBadges.length > 0;

    if (hasStats && !hasUnlocks && !achievementData.checkedOnce) {
      console.log('[Migration] Stats exist but no badges unlocked - reprocessing...');
      await achievementTracker.initialize();
      await achievementTracker.checkAchievements(achievementData.userStats);

      // Mark as checked
      const updatedData = await chrome.storage.local.get(['achievementData']);
      if (updatedData.achievementData) {
        updatedData.achievementData.checkedOnce = true;
        await chrome.storage.local.set({ achievementData: updatedData.achievementData });
      }
      console.log('[Migration] Reprocessing complete');
      return;
    }
  }

  // Only migrate if we have lifetime stats and either no achievement data or it hasn't been migrated
  if (!lifetimeStats || (achievementData && achievementData.migrated)) {
    console.log('[Migration] No migration needed');
    return;
  }

  const data = achievementData || {
    userStats: {},
    unlockedBadges: [],
    totalXP: 0
  };

  // Migrate existing stats
  if (lifetimeStats.totalSwipes && !data.userStats.likesGiven) {
    data.userStats.likesGiven = lifetimeStats.totalSwipes;
    console.log(`[Migration] Migrated ${lifetimeStats.totalSwipes} swipes to likesGiven`);
  }

  if (lifetimeStats.totalMessages && !data.userStats.messagesSent) {
    data.userStats.messagesSent = lifetimeStats.totalMessages;
    console.log(`[Migration] Migrated ${lifetimeStats.totalMessages} messages to messagesSent`);
  }

  if (lifetimeStats.totalMatches && !data.userStats.matches) {
    data.userStats.matches = lifetimeStats.totalMatches;
    console.log(`[Migration] Migrated ${lifetimeStats.totalMatches} matches`);
  }

  data.migrated = true;

  await chrome.storage.local.set({ achievementData: data });
  console.log('[Migration] Migration complete, saved achievement data:', data);

  // Manually check for unlocks with migrated stats
  await achievementTracker.initialize();
  await achievementTracker.checkAchievements(data.userStats);
  console.log('[Migration] Checked achievements with migrated stats');
}

/**
 * Initializes UI elements based on the current platform (Tinder/Bumble)
 */
function initializePlatformSpecificUI() {
  const platform = window.CURRENT_PLATFORM;
  console.log(`[Popup] Initializing UI for platform: ${platform}`);

  if (platform === 'Bumble') {
    // Hide Smart Reactions for Bumble (Tinder-only feature)
    const smartReactionsSection = document.getElementById('smartReactionsSection');
    if (smartReactionsSection) {
      smartReactionsSection.style.display = 'none';
      console.log('[Popup] Hiding Smart Reactions section (Bumble)');
    }

    // Update divider text
    const identityDivider = document.getElementById('identityReactionDivider');
    if (identityDivider) {
      const span = identityDivider.querySelector('span');
      if (span) span.textContent = 'IDENTITY';
    }

    // Update "About You" section texts
    const tinderProfileTitle = document.querySelector('#tinderProfileOption .about-option-title');
    if (tinderProfileTitle) {
      tinderProfileTitle.textContent = 'Use Bumble Profile';
    }

    const tinderSyncStatus = document.getElementById('tinderSyncStatus');
    if (tinderSyncStatus) {
      tinderSyncStatus.textContent = 'Automatically syncs your Bumble bio and details';
    }

    // Shadowban hint
    const shadowbanHint = Array.from(document.querySelectorAll('li')).find(li => li.textContent.includes('Tinder shadowban'));
    if (shadowbanHint) {
      shadowbanHint.textContent = shadowbanHint.textContent.replace('Tinder', 'Bumble');
    }

    // About You Variable hint
    const variableHint = document.getElementById('variableHint');
    if (variableHint) {
      variableHint.innerHTML = variableHint.innerHTML.replace('Tinder', 'Bumble');
    }

    const useBioBtn = document.getElementById('useBioBtn');
    if (useBioBtn) {
      // Find the text node after the SVG
      const textNode = Array.from(useBioBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().includes('Tinder'));
      if (textNode) {
        textNode.textContent = textNode.textContent.replace('Tinder', 'Bumble');
      }
    }
  }
}

function reorderProfileSections() {
  const basicSettings = document.getElementById('basicSettings');
  if (!basicSettings) return;

  const myprofileTab = document.getElementById('myprofileTab');

  const identityDivider = myprofileTab ? Array.from(myprofileTab.children).find(
    el => el.classList.contains('settings-divider') && el.textContent.includes('IDENTITY')
  ) : null;

  const smartReactionsSection = document.getElementById('smartReactionsSection');
  const aboutYouSection = document.getElementById('profileSectionHeader')?.closest('.section');
  const aiPersonalitySection = document.getElementById('aiPersonalitySection');
  const promptPreviewSection = document.getElementById('promptPreviewSectionHeader')?.closest('.section');
  const aiChatDivider = Array.from(basicSettings.children).find(
    el => el.classList.contains('settings-divider') && el.textContent.trim() === 'AI CHAT STYLE'
  );

  if (aboutYouSection) basicSettings.insertBefore(aboutYouSection, basicSettings.firstChild);
  if (smartReactionsSection) basicSettings.insertBefore(smartReactionsSection, basicSettings.firstChild);
  if (identityDivider) basicSettings.insertBefore(identityDivider, basicSettings.firstChild);

  if (aiChatDivider) basicSettings.appendChild(aiChatDivider);
  if (promptPreviewSection) basicSettings.appendChild(promptPreviewSection);
  if (aiPersonalitySection) basicSettings.appendChild(aiPersonalitySection);
}

async function _applyDistanceToTinderSilently(maxDistance) {
  const tabs = await chrome.tabs.query({ url: ['https://tinder.com/*'] });
  if (tabs.length === 0) return { success: false, reason: 'tinder_not_open' }; // Tinder not open — skip silently

  const activeTab = tabs.find(t => t.active) || tabs[0];

  const trySend = (tabId) => new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'setTinderDistance', maxDistanceKm: maxDistance }, (response) => {
      resolve({ response, error: chrome.runtime.lastError });
    });
  });

  let { response, error } = await trySend(activeTab.id);

  if (error) {
    // Page stale — reload and retry once
    try {
      await chrome.tabs.reload(activeTab.id);
      let loaded = false;
      for (let i = 0; i < 24; i++) {
        await new Promise(r => setTimeout(r, 500));
        const [updatedTab] = await chrome.tabs.query({ url: ['https://tinder.com/*'] });
        if (updatedTab && updatedTab.status === 'complete') { loaded = true; break; }
      }
      if (loaded) {
        await new Promise(r => setTimeout(r, 3000));
        const retry = await trySend(activeTab.id);
        response = retry.response;
        error = retry.error;
      }
    } catch (_) {}
  }

  if (!error && response?.success) {
    return { success: true, valueSet: response.valueSet, unit: response.unit };
  }
  return { success: false, reason: 'error_or_fail' };
}

async function _applyDistanceToBumbleSilently(maxDistance) {
  console.log('[Bumble Distance] Starting distance automation for maxDistance:', maxDistance);
  const tabs = await chrome.tabs.query({ url: '*://*.bumble.com/*' });
  console.log('[Bumble Distance] Found tabs:', tabs.length, tabs.map(t => ({ id: t.id, url: t.url, active: t.active })));
  if (tabs.length === 0) return { success: false, reason: 'bumble_not_open' }; // Bumble not open — skip silently

  const activeTab = tabs.find(t => t.active) || tabs[0];

  const trySend = (tabId) => new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'setBumbleDistance', maxDistanceKm: maxDistance }, (response) => {
      resolve({ response, error: chrome.runtime.lastError });
    });
  });

  let { response, error } = await trySend(activeTab.id);

  if (error) {
    // Page stale — reload and retry once
    try {
      await chrome.tabs.reload(activeTab.id);
      let loaded = false;
      for (let i = 0; i < 24; i++) {
        await new Promise(r => setTimeout(r, 500));
        const [updatedTab] = await chrome.tabs.query({ url: '*://*.bumble.com/*' });
        if (updatedTab && updatedTab.status === 'complete') { loaded = true; break; }
      }
      if (loaded) {
        await new Promise(r => setTimeout(r, 3000));
        const retry = await trySend(activeTab.id);
        response = retry.response;
        error = retry.error;
      }
    } catch (_) {}
  }

  if (!error && response?.success) {
    return { success: true, valueSet: response.actualValue, unit: response.unit };
  }
  return { success: false, reason: 'error_or_fail' };
}

