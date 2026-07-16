// Change tracking and save bar
let saveBarTimeout = null;

function initializeChangeTracking() {
  // Note: apiKey and aiModel are now controlled by centralized config (api-config.js)
  // They are not tracked here as users cannot modify them in production
  const inputs = [
    'useEmojis', 'emojiProbability', 'randomHearts', 'randomHeartsProbability', 'aboutMyself',
    'likesPerCycle', 'messagesPerCycle', 'scheduleInterval', 'safetyMode',
    'minReplySlots', 'maxNewMatchSlots', 'activeHoursEnabled', 'startTime', 'endTime',
    'blockMessagesEnabled',
    'enable6ModeSystem', 'customizePreview', 'customPromptPreview',
    'ageFilterEnabled', 'minAge', 'maxAge',
    'distanceFilterEnabled', 'maxDistance',
    'visualPreferencesEnabled', 'visualThreshold'
  ];

  const modes = ['intro', 'followup', 'conversation', 'datesetup', 'moveoffapp', 'exit'];
  modes.forEach(mode => {
    inputs.push(`${mode}UseCustom`, `${mode}Prompt`);
  });

  inputs.push('followupDelaySelect', 'followupMaxAttemptsSelect', 'datesetupGoalSelect');
  inputs.push('moveOffAppPushAllMatches', 'moveOffAppMinMessages', 'moveOffAppMaxMessages', 'moveOffAppMaxPersuasion');

  inputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', () => {
        markAsChanged();
        
        // --- PRODUCTION UI SYNC: Handle Custom Prompt Toggling ---
        if (id === 'customizePreview') {
          const previewDefaultDisplay = document.getElementById('previewDefaultDisplay');
          const previewCustomEditor = document.getElementById('previewCustomEditor');
          
          if (element.checked) {
            if (previewDefaultDisplay) previewDefaultDisplay.style.display = 'none';
            if (previewCustomEditor) previewCustomEditor.style.display = 'block';
          } else {
            if (previewDefaultDisplay) previewDefaultDisplay.style.display = 'block';
            if (previewCustomEditor) previewCustomEditor.style.display = 'none';
            // Also refresh the auto-generated preview if turned back to default
            setTimeout(updateGeneratedPromptPreview, 50);
          }
        }
        
        if (id === 'likesPerCycle' || id === 'messagesPerCycle' || id === 'scheduleInterval') {
          validateRateLimits();
          updatePriorityPreview();
        }
        if (id === 'messagesPerCycle' || id === 'minReplySlots' || id === 'maxNewMatchSlots') {
          updatePriorityPreview();
        }
        if (id === 'safetyMode') {
          updateSafetyModeState();
          updatePriorityPreview();
          updateSafetyModeStatusDisplay();
        }
        if (id === 'ageFilterEnabled') {
          updateAgeFilterUI();
        }
        if (id === 'distanceFilterEnabled') {
          updateDistanceFilterUI();
        }
        if (id === 'useEmojis') {
          updateGeneratedPromptPreview();
        }
      });
      element.addEventListener('input', () => {
        markAsChanged();
        if (id === 'likesPerCycle' || id === 'messagesPerCycle' || id === 'scheduleInterval') {
          validateRateLimits();
          updatePriorityPreview();
        }
        if (id === 'messagesPerCycle' || id === 'minReplySlots' || id === 'maxNewMatchSlots' || id === 'scheduleInterval') {
          updatePriorityPreview();
        }
      });
    }
  });

  document.querySelectorAll('.custom-select-option').forEach(option => {
    option.addEventListener('click', () => {
      markAsChanged();
      setTimeout(updateGeneratedPromptPreview, 300);
    });
  });

  ['intentionsSelect', 'chattingStyleSelect', 'conversationLanguageSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        markAsChanged();
        setTimeout(updateGeneratedPromptPreview, 300);
      });
    }
  });
}

function markAsChanged() {
  const saveBar = document.getElementById('saveBar');
  if (saveBar) {
    saveBar.classList.add('show');
    document.body.classList.add('save-bar-open');

    const progress = saveBar.querySelector('.save-bar-progress');
    if (progress) {
      progress.style.animation = 'none';
      void progress.offsetHeight;
      progress.style.animation = 'progressShrink 5s linear forwards';
    }

    if (saveBarTimeout) clearTimeout(saveBarTimeout);

    saveBarTimeout = setTimeout(() => {
      saveBar.classList.remove('show');
      document.body.classList.remove('save-bar-open');
    }, 5000);
  }
}

function hideSaveBar() {
  const saveBar = document.getElementById('saveBar');
  if (saveBar) saveBar.classList.remove('show');
  document.body.classList.remove('save-bar-open');
  if (saveBarTimeout) {
    clearTimeout(saveBarTimeout);
    saveBarTimeout = null;
  }
}

function updateGeneratedPromptPreview() {
  const chattingStyle = getCustomSelectValue('chattingStyleSelect') || 'freestyle';
  const intentions = getCustomSelectValue('intentionsSelect') || 'short_term';
  const useEmojis = document.getElementById('useEmojis')?.checked || false;
  const conversationLanguage = getCustomSelectValue('conversationLanguageSelect') || 'en';

  const styleMap = {
    freestyle: 'casual and spontaneous',
    serious: 'thoughtful and genuine',
    gentle: 'kind and considerate',
    flirty: 'playful and charming',
    playful: 'fun and lighthearted',
    confident: 'bold and self-assured',
    witty: 'clever and quick-witted',
    charming: 'warm and naturally charming',
    bold: 'direct and unapologetically bold',
    romantic: 'romantic and emotionally expressive'
  };

  const intentionsMap = {
    long_term: 'a serious relationship',
    short_term: 'casual dating',
    just_fun: 'fun and lighthearted connections',
    casual_connection: 'casual connections without pressure',
    meaningful_conversations: 'meaningful conversations and genuine connection',
    open_to_anything: 'whatever feels right',
    lets_see: 'something real, wherever it leads'
  };

  const style = styleMap[chattingStyle] || 'friendly';
  const goal = intentionsMap[intentions] || 'meeting new people';
  const emojiGuidance = useEmojis ? 'Use emojis naturally (1-2 max).' : 'Avoid emojis.';
  const slangGuidance = (typeof LANGUAGE_SLANG_GUIDE !== 'undefined') ? (LANGUAGE_SLANG_GUIDE[conversationLanguage] || LANGUAGE_SLANG_GUIDE.default) : 'Keep it casual.';

  // Detect current platform for preview (default to Tinder if unknown)
  let platform = window.CURRENT_PLATFORM || 'Tinder';

  // Optional: Double check via URL if window.CURRENT_PLATFORM isn't set
  if (!window.CURRENT_PLATFORM) {
    try {
      // Note: In popup context, this checks the active tab from global state if redirected
      const url = window.location.href;
      if (url.includes('bumble.com')) platform = 'Bumble';
      else if (url.includes('tinder.com')) platform = 'Tinder';
      else platform = 'Tinder or Bumble';
    } catch (e) {
      platform = 'Tinder or Bumble';
    }
  }

  const generatedPrompt = `You are a ${style} person on ${platform} looking for ${goal}. ${emojiGuidance}\n\n[Gender/Grammar rules applied automatically]\n\nIMPORTANT - Write like a REAL human texting:\n- Keep it SHORT (1-2 sentences max)\n- Be natural and conversational\n- ${slangGuidance}\n- NEVER use placeholders like [your city], [location], [name]`;

  const displayEl = document.getElementById('generatedPromptDisplay');
  if (displayEl) {
    displayEl.textContent = generatedPrompt;
  }
}
