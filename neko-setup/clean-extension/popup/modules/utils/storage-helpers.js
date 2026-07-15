// Storage helper functions
async function getSettings() {
  const result = await chrome.storage.local.get('userSettings');
  return result.userSettings || getDefaultSettings();
}

async function saveSettings(settings) {
  return chrome.storage.local.set({ userSettings: settings });
}

async function getAgentState() {
  const result = await chrome.storage.local.get('agentState');
  return result.agentState || { isRunning: false, currentPhase: null };
}

function getDefaultSettings() {
  const configIntentions = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_INTENTIONS : 'short_term';
  const configStyle = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_CHATTING_STYLE : 'freestyle';
  const configEmojis = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_USE_EMOJIS : false;

  const defaults = {
    intentions: configIntentions,
    conversationLanguage: 'en',
    chattingStyle: configStyle,
    useEmojis: configEmojis,
    emojiProbability: 30,
    likesPerCycle: 50,
    messagesPerCycle: 50,
    scheduleInterval: 60,
    scheduleIntervalCustomized: false,
    minReplyPercent: 30,
    maxNewMatchPercent: 70,
    ageFilter: { enabled: false, minAge: 18, maxAge: 99 },
    distanceFilter: { enabled: false, maxDistance: 50 },
    activeHours: { enabled: false, preset: '24/7', startTime: '00:00', endTime: '23:59' },
    chatStyleProfiles: {}, // populated by ChatStyleTraining module, keyed by language code
    // AI model is now controlled by centralized config
    aiModel: window.API_CONFIG?.DEFAULT_MODEL || 'gpt-4o-mini'
  };

  // Only include apiKey in defaults if not using backend proxy (legacy support)
  if (!window.API_CONFIG?.USE_BACKEND_PROXY) {
    defaults.apiKey = '';
  }

  return defaults;
}

async function clearAllData() {
  await chrome.storage.local.clear();
  await chrome.storage.sync.clear();
  return true;
}
