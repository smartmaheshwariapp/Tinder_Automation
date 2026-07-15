// Extended settings saving
async function handleSaveExtended() {
  const checkedStops = document.querySelectorAll('input[name="stopCondition"]:checked');
  const stopConditions = Array.from(checkedStops).map(cb => cb.value).filter(v => v !== 'never');

  const likesValue = document.getElementById('likesPerCycle').value.trim();
  const messagesValue = document.getElementById('messagesPerCycle').value.trim();
  const intervalValue = document.getElementById('scheduleInterval').value.trim();

  if (likesValue === '' || messagesValue === '' || intervalValue === '') {
    showMessage('Please fill all cycle settings', 'error');
    return false;
  }

  const parsedLikes = parseInt(likesValue);
  const parsedMessages = parseInt(messagesValue);
  const parsedInterval = parseInt(intervalValue);

  if (isNaN(parsedLikes) || isNaN(parsedMessages) || isNaN(parsedInterval)) {
    showMessage('Cycle settings must be valid numbers', 'error');
    return false;
  }

  if (parsedLikes < 0 || parsedLikes > 200 || parsedMessages < 0 || parsedMessages > 200 || parsedInterval < 1 || parsedInterval > 1440) {
    showMessage('Cycle settings out of range', 'error');
    return false;
  }

  if (parsedLikes === 0 && parsedMessages === 0) {
    showMessage('Cannot set both Likes and Messages to 0', 'error');
    return false;
  }

  const existingSettings = await getSettings();

  // Build prompt modes
  const promptModes = {};
  const modes = ['intro', 'followup', 'conversation', 'datesetup', 'moveoffapp', 'exit'];

  modes.forEach(mode => {
    const useCustom = document.getElementById(`${mode}UseCustom`)?.checked || false;
    const customPrompt = document.getElementById(`${mode}Prompt`)?.value.trim() || '';

    promptModes[mode] = { useCustom, customPrompt };

    if (mode === 'followup') {
      promptModes[mode].delay = getCustomSelectValue('followupDelaySelect') || '24';
      promptModes[mode].maxAttempts = getCustomSelectValue('followupMaxAttemptsSelect') || '2';
    }

    if (mode === 'datesetup') {
      promptModes[mode].goal = getCustomSelectValue('datesetupGoalSelect') || 'coffee';
    }
  });

  const extendedSettings = {
    stopConditions,
    stopAfterGoalEnabled: document.getElementById('automationStopAfterGoal')?.checked === true,
    contactDetails: {
      instagram: { value: document.getElementById('contactInstagramValue')?.value.trim() || '', enabled: document.getElementById('contactInstagramEnabled')?.checked === true },
      whatsapp:  { value: document.getElementById('contactWhatsappValue')?.value.trim()  || '', enabled: document.getElementById('contactWhatsappEnabled')?.checked  === true },
      phone:     { value: document.getElementById('contactPhoneValue')?.value.trim()     || '', enabled: document.getElementById('contactPhoneEnabled')?.checked     === true },
      telegram:  { value: document.getElementById('contactTelegramValue')?.value.trim()  || '', enabled: document.getElementById('contactTelegramEnabled')?.checked  === true },
      snapchat:  { value: document.getElementById('contactSnapchatValue')?.value.trim()  || '', enabled: document.getElementById('contactSnapchatEnabled')?.checked  === true },
    },
    moveOffAppPushAllMatches: document.getElementById('moveOffAppPushAllMatches')?.checked === true,
    moveOffAppMinMessages: parseInt(document.getElementById('moveOffAppMinMessages')?.value) || 0,
    moveOffAppMaxMessages: parseInt(document.getElementById('moveOffAppMaxMessages')?.value) || 0,
    moveOffAppMaxPersuasion: parseInt(document.getElementById('moveOffAppMaxPersuasion')?.value) || 2,
    userGenderOverride: document.querySelector('.automation-v2-gender-btn.is-active')?.dataset.value || 'auto',
    aboutSource: document.querySelector('input[name="aboutSource"]:checked')?.value || 'tinder',
    customizePreview: document.getElementById('customizePreview')?.checked || false,
    customPromptPreview: document.getElementById('customPromptPreview')?.value.trim() || '',
    promptModes,
    enable6ModeSystem: document.getElementById('enable6ModeSystem')?.checked !== false,
    consecutiveMessagesEnabled: document.getElementById('consecutiveMessagesEnabled')?.checked === true,
    visualPreferences: {
      enabled: document.getElementById('visualPreferencesEnabled').checked,
      threshold: parseInt(document.getElementById('visualThreshold').value) || 75,
      likedPhotos: existingSettings.visualPreferences?.likedPhotos || []
    }
  };

  // Validate priority
  const rawMinReply = parseInt(document.getElementById('minReplySlots').value);
  const rawMaxNew = parseInt(document.getElementById('maxNewMatchSlots').value);
  const minReplyPercent = isNaN(rawMinReply) ? 30 : rawMinReply;
  const maxNewMatchPercent = isNaN(rawMaxNew) ? 70 : rawMaxNew;
  if (minReplyPercent + maxNewMatchPercent > 100) {
    showMessage('Min replies % + Max new matches % cannot exceed 100%', 'error');
    return false;
  }

  const safetyMode = document.getElementById('safetyMode').checked;

  if (!safetyMode) {
    const cyclesPerHour = 60 / parsedInterval;
    const likesPerHour = Math.round(parsedLikes * cyclesPerHour);
    const messagesPerHour = Math.round(parsedMessages * cyclesPerHour);

    const oldSettings = await getSettings();
    const rateSettingsChanged =
      oldSettings.likesPerCycle !== parsedLikes ||
      oldSettings.messagesPerCycle !== parsedMessages ||
      oldSettings.scheduleInterval !== parsedInterval;

    if ((likesPerHour > 50 || messagesPerHour > 50) && rateSettingsChanged) {
      const confirmed = await showRiskConfirmation(likesPerHour, messagesPerHour);
      if (!confirmed) return false;
    }
  }

  return extendedSettings;
}

function showRiskConfirmation(likesPerHour, messagesPerHour) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'risk-modal';
    modal.innerHTML = `
      <div class="risk-modal-content">
        <div class="risk-modal-header">
          <div class="risk-modal-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3 class="risk-modal-title">High Risk Warning</h3>
          <p class="risk-modal-subtitle">Your settings will result in:</p>
        </div>
        <div class="risk-modal-body">
          <div class="risk-stats-row">
            <div class="risk-stat-card">
              <span class="risk-stat-number">~${likesPerHour}</span>
              <span class="risk-stat-label">LIKES / HR</span>
            </div>
            <div class="risk-stat-card">
              <span class="risk-stat-number">~${messagesPerHour}</span>
              <span class="risk-stat-label">MSGS / HR</span>
            </div>
          </div>
          <div class="risk-warning-row">
            <div class="risk-warning-icon">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="#e91e8c" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="#e91e8c" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <p class="risk-warning-text">This exceeds safe limits. Proceeding may result in your account being <strong>shadowbanned</strong>.</p>
          </div>
          <div class="risk-modal-buttons">
            <button class="risk-btn risk-btn-cancel">Cancel</button>
            <button class="risk-btn risk-btn-confirm">Accept Risk</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = (result) => {
      modal.classList.add('closing');
      setTimeout(() => {
        modal.remove();
        resolve(result);
      }, 220);
    };

    modal.querySelector('.risk-btn-cancel').addEventListener('click', () => closeModal(false));
    modal.querySelector('.risk-btn-confirm').addEventListener('click', () => closeModal(true));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(false);
    });
  });
}
