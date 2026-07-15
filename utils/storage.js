const StorageKeys = {
  USER_SETTINGS: 'userSettings',
  AGENT_STATE: 'agentState',
  STOPPED_CHATS: 'stoppedChats',
  MATCH_DATA: 'matchData',
  MATCH_LANGUAGES: 'matchLanguages',
  UPCOMING_EVENTS: 'upcomingEvents',
  MATCH_ID_MAP: 'matchIdMap'
};

async function saveSettings(settings) {
  return chrome.storage.local.set({ [StorageKeys.USER_SETTINGS]: settings });
}

async function getSettings() {
  const result = await chrome.storage.local.get([StorageKeys.USER_SETTINGS, 'safetyMode']);
  const settings = result[StorageKeys.USER_SETTINGS] || getDefaultSettings();
  settings.safetyMode = result.safetyMode !== false;
  return settings;
}

function getDefaultSettings() {
  const configIntentions = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_INTENTIONS : 'short_term';
  const configStyle = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_CHATTING_STYLE : 'freestyle';
  const configEmojis = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_USE_EMOJIS : false;
  const configCustomPrompt = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_CUSTOM_PROMPT : '';
  const configLikesPerCycle = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_LIKES_PER_CYCLE : 50;
  const configMessagesPerCycle = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_MESSAGES_PER_CYCLE : 50;
  const configScheduleInterval = typeof CONFIG !== 'undefined' ? CONFIG.DEFAULT_SCHEDULE_INTERVAL : 60;
  const configMinReplyPercent = typeof CONFIG !== 'undefined' ? CONFIG.MIN_REPLY_SLOTS_PERCENT : 30;
  const configMaxNewMatchPercent = typeof CONFIG !== 'undefined' ? CONFIG.MAX_NEW_MATCH_SLOTS_PERCENT : 70;

  return {
    apiKey: '',
    intentions: configIntentions,
    conversationLanguage: 'en',
    chattingStyle: configStyle,
    useEmojis: configEmojis,
    emojiProbability: 30,
    stopConditions: [],
    aboutMyself: '',
    customPrompt: configCustomPrompt,
    likesPerCycle: configLikesPerCycle,
    messagesPerCycle: configMessagesPerCycle,
    scheduleInterval: configScheduleInterval,
    minReplyPercent: configMinReplyPercent,
    maxNewMatchPercent: configMaxNewMatchPercent,
    ageFilter: {
      enabled: false,
      minAge: 18,
      maxAge: 99
    },
    distanceFilter: {
      enabled: false,
      maxDistance: 50
    },
    activeHours: {
      enabled: false,
      preset: '24/7',
      startTime: '09:00',
      endTime: '23:00'
    }
  };
}

async function saveAgentState(state) {
  return chrome.storage.local.set({ [StorageKeys.AGENT_STATE]: state });
}

async function getAgentState() {
  const result = await chrome.storage.local.get(StorageKeys.AGENT_STATE);
  return result[StorageKeys.AGENT_STATE] || getDefaultAgentState();
}

function getDefaultAgentState() {
  return {
    isRunning: false,
    lastRunTimestamp: null,
    nextRunTimestamp: null,
    currentPhase: null,
    currentCycle: {
      startedAt: 0,
      likesCompleted: 0,
      messagesProcessed: 0,
      followUpsSent: 0,
      errors: []
    },
    cycleProgress: null,
    lifetimeCycles: 0
  };
}

async function saveStoppedChats(stoppedChats) {
  return chrome.storage.local.set({ [StorageKeys.STOPPED_CHATS]: stoppedChats });
}

async function getStoppedChats() {
  const result = await chrome.storage.local.get(StorageKeys.STOPPED_CHATS);
  return result[StorageKeys.STOPPED_CHATS] || {};
}

async function addStoppedChat(matchId, reason) {
  const stoppedChats = await getStoppedChats();
  stoppedChats[matchId] = reason;
  await saveStoppedChats(stoppedChats);
}

async function ischatStopped(matchId) {
  const stoppedChats = await getStoppedChats();
  return !!stoppedChats[matchId];
}

async function getChatStopEntry(matchId) {
  const stoppedChats = await getStoppedChats();
  const reason = stoppedChats[matchId] || null;
  return { isStopped: !!reason, reason };
}

async function removeStoppedChat(matchId) {
  const stoppedChats = await getStoppedChats();
  delete stoppedChats[matchId];
  await saveStoppedChats(stoppedChats);
}

// ========== MOVE OFF APP STATE MACHINE ==========
// Tracks per-match state for the platform escalation flow:
// idle → offering_telegram → offering_instagram → offering_tango → persuading → done

async function getAllMoveOffAppStates() {
  const result = await chrome.storage.local.get('matchMoveOffAppStates');
  return result.matchMoveOffAppStates || {};
}

async function getMoveOffAppState(matchId) {
  const all = await getAllMoveOffAppStates();
  return all[matchId] || { state: 'idle', offeredPlatforms: [], persuasionCount: 0, lastOfferedPlatform: null, updatedAt: 0 };
}

async function saveMoveOffAppState(matchId, stateData) {
  const all = await getAllMoveOffAppStates();
  all[matchId] = { ...stateData, updatedAt: Date.now() };
  return chrome.storage.local.set({ matchMoveOffAppStates: all });
}

async function resetMoveOffAppState(matchId) {
  const all = await getAllMoveOffAppStates();
  delete all[matchId];
  return chrome.storage.local.set({ matchMoveOffAppStates: all });
}

async function getAllMatchLanguages() {
  const result = await chrome.storage.local.get(StorageKeys.MATCH_LANGUAGES);
  return result[StorageKeys.MATCH_LANGUAGES] || {};
}

async function getMatchLanguage(matchId) {
  const all = await getAllMatchLanguages();
  return all[matchId] || null;
}

async function saveMatchLanguage(matchId, langData) {
  const all = await getAllMatchLanguages();
  all[matchId] = {
    code: langData.code,
    name: langData.name,
    confidence: langData.confidence || 0,
    source: langData.source || 'detected',
    updatedAt: Date.now()
  };
  return chrome.storage.local.set({ [StorageKeys.MATCH_LANGUAGES]: all });
}

async function saveMatchData(matchId, data) {
  const allMatches = await getMatchData();
  const existing = allMatches[matchId] || {};

  // Merge conversation history
  if (data.conversationHistory) {
    const existingHistory = existing.conversationHistory || [];
    const newHistory = data.conversationHistory;

    // Combine and deduplicate by timestamp
    const combined = [...existingHistory, ...newHistory];
    const unique = Array.from(new Map(combined.map(msg =>
      [msg.timestamp + msg.text, msg]
    )).values());

    // Keep last 100 messages
    data.conversationHistory = unique.slice(-100);
  }

  allMatches[matchId] = {
    ...existing,
    ...data,
    updatedAt: Date.now()
  };
  return chrome.storage.local.set({ [StorageKeys.MATCH_DATA]: allMatches });
}

async function getMatchData(matchId = null) {
  const result = await chrome.storage.local.get([StorageKeys.MATCH_DATA, StorageKeys.MATCH_ID_MAP]);
  const allMatches = result[StorageKeys.MATCH_DATA] || {};
  const idMap = result[StorageKeys.MATCH_ID_MAP] || {};

  if (matchId) {
    // Follow alias if it exists (Bumble resolution)
    const effectiveId = idMap[matchId] || matchId;
    return allMatches[effectiveId] || null;
  }

  return allMatches;
}

async function linkMatchIds(shortId, fullId) {
  if (!shortId || !fullId || shortId === fullId) return;
  const result = await chrome.storage.local.get(StorageKeys.MATCH_ID_MAP);
  const idMap = result[StorageKeys.MATCH_ID_MAP] || {};
  
  if (idMap[shortId] !== fullId) {
    console.log(`[Storage] Linking ID: ${shortId} -> ${fullId}`);
    idMap[shortId] = fullId;
    await chrome.storage.local.set({ [StorageKeys.MATCH_ID_MAP]: idMap });
  }
}

// ========== UPCOMING EVENTS ==========

async function getUpcomingEvents() {
  const result = await chrome.storage.local.get(StorageKeys.UPCOMING_EVENTS);
  return result[StorageKeys.UPCOMING_EVENTS] || [];
}

async function addUpcomingEvent(event) {
  const events = await getUpcomingEvents();
  const now = Date.now();

  // Robust Deduplication: Check for ID match OR Name matches on the same platform
  const existingIndex = events.findIndex(e => 
    e.matchId === event.matchId || 
    (event.matchName && e.matchName === event.matchName && e.platform === event.platform)
  );

  if (existingIndex !== -1) {
    const existing = events[existingIndex];
    console.log(`[Storage] Updating existing handoff event for ${event.matchName || event.matchId}`);
    
    // Update existing entry (Refresh timestamp and reason)
    existing.reason = event.reason;
    existing.createdAt = now;
    existing.read = false; // Mark as unread so user sees the update
    if (event.photoUrl) existing.photoUrl = event.photoUrl;

    // Move to top
    events.splice(existingIndex, 1);
    events.unshift(existing);

    return chrome.storage.local.set({ [StorageKeys.UPCOMING_EVENTS]: events });
  }

  // New Event
  events.unshift({
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    matchId: event.matchId,
    matchName: event.matchName,
    photoUrl: event.photoUrl || null,
    reason: event.reason,
    platform: event.platform || 'unknown',
    createdAt: now,
    read: false
  });

  if (events.length > 500) events.length = 500;
  return chrome.storage.local.set({ [StorageKeys.UPCOMING_EVENTS]: events });
}

async function markUpcomingEventRead(eventId) {
  const events = await getUpcomingEvents();
  const evt = events.find(e => e.id === eventId);
  if (evt) {
    evt.read = true;
    await chrome.storage.local.set({ [StorageKeys.UPCOMING_EVENTS]: events });
  }
}

async function dismissUpcomingEvent(eventId) {
  const events = await getUpcomingEvents();
  const filtered = events.filter(e => e.id !== eventId);
  return chrome.storage.local.set({ [StorageKeys.UPCOMING_EVENTS]: filtered });
}

async function clearUpcomingEvents() {
  return chrome.storage.local.set({ [StorageKeys.UPCOMING_EVENTS]: [] });
}

async function clearAllData() {
  await chrome.storage.local.clear();
  await chrome.storage.sync.clear();
  return true;
}

// Expose functions globally for service worker
if (typeof self !== 'undefined') {
  self.saveSettings = saveSettings;
  self.getSettings = getSettings;
  self.saveAgentState = saveAgentState;
  self.getAgentState = getAgentState;
  self.saveStoppedChats = saveStoppedChats;
  self.getStoppedChats = getStoppedChats;
  self.addStoppedChat = addStoppedChat;
  self.ischatStopped = ischatStopped;
  self.getChatStopEntry = getChatStopEntry;
  self.removeStoppedChat = removeStoppedChat;
  self.saveMatchData = saveMatchData;
  self.getMatchData = getMatchData;
  self.clearAllData = clearAllData;
  self.getAllMatchLanguages = getAllMatchLanguages;
  self.getMatchLanguage = getMatchLanguage;
  self.saveMatchLanguage = saveMatchLanguage;
  self.getMoveOffAppState = getMoveOffAppState;
  self.saveMoveOffAppState = saveMoveOffAppState;
  self.resetMoveOffAppState = resetMoveOffAppState;
  self.getUpcomingEvents = getUpcomingEvents;
  self.addUpcomingEvent = addUpcomingEvent;
  self.markUpcomingEventRead = markUpcomingEventRead;
  self.dismissUpcomingEvent = dismissUpcomingEvent;
  self.clearUpcomingEvents = clearUpcomingEvents;
  self.linkMatchIds = linkMatchIds;
}
