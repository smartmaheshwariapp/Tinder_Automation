/**
 * FlirtEasy Configuration File
 * 
 * After changing settings, reload the Chrome extension:
 * 1. Go to chrome://extensions/
 * 2. Click the reload button on FlirtEasy extension
 */

if (typeof CONFIG !== 'undefined') { /* Already loaded — skip re-declaration */ } else {

var CONFIG = {
  // ========================================
  // System Configuration (PHASE 2)
  // ========================================
  API_BASE_URL: 'https://flirteasy-auth.shnaiderdm.workers.dev',
  SERVER_ENDPOINTS: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    VERIFY: '/auth/verify',
    STATUS: '/user/status',
    UPGRADE: '/user/upgrade',
    REFRESH: '/auth/refresh'
  },

  // ========================================
  // Core Configuration
  // ========================================
  OPENAI_API_KEY: '',

  // ========================================
  // Prompt Templates (Advanced Customization)
  // ========================================

  // Custom AI System Prompt (Advanced)
  // Leave empty to use auto-generated prompts based on settings below
  // If provided, this overrides all auto-generated prompt logic
  DEFAULT_CUSTOM_PROMPT: '',

  // Auto-generated prompt template (used when custom prompt is empty)
  // Variables available: {style}, {goal}, {emojiGuidance}
  AUTO_PROMPT_TEMPLATE: `You are a {style} person on Tinder looking for {goal}. {emojiGuidance}

IMPORTANT - Write like a REAL human texting:
- Keep it SHORT (1-2 sentences max)
- Be natural and conversational
- Vary your style - don't be formulaic
- Sometimes ask questions, sometimes make statements
- Use casual language, contractions (I'm, you're, that's)
- Don't be overly enthusiastic or try-hard
- Match their energy level
- Be authentic, not robotic`,

  // Follow-up message prompt template
  // Variables available: {style}, {goal}, {emojiGuidance}
  FOLLOWUP_PROMPT_TEMPLATE: `You are a {style} person on Tinder looking for {goal}. {emojiGuidance} Generate a brief, natural follow-up message (1-2 sentences) that doesn't seem pushy. Keep it light and conversational, like a real person would text.`,

  // ========================================
  // Default Bot Behavior Settings
  // ========================================

  // Dating intentions (ignored if custom prompt is provided)
  // Options: 'long_term', 'short_term', 'just_fun'
  DEFAULT_INTENTIONS: 'short_term',

  // Conversation style (ignored if custom prompt is provided)
  // Options: 'freestyle', 'serious', 'gentle', 'flirty', 'confident'
  DEFAULT_CHATTING_STYLE: 'freestyle',

  // Use emojis in messages (ignored if custom prompt is provided)
  // Options: true or false
  DEFAULT_USE_EMOJIS: false,

  // ========================================
  // Cycle Settings
  // ========================================

  // Number of profiles to like per cycle
  DEFAULT_LIKES_PER_CYCLE: 50,

  // Number of messages to send per cycle
  DEFAULT_MESSAGES_PER_CYCLE: 50,

  // Schedule interval in minutes (how often the bot runs)
  DEFAULT_SCHEDULE_INTERVAL: 30,

  // ========================================
  // Message Priority Settings (Hybrid System)
  // ========================================

  // Minimum guaranteed replies to old matches per cycle (as percentage)
  // These matches always get priority (people who replied to you)
  MIN_REPLY_SLOTS_PERCENT: 30,

  // Maximum new match messages per cycle (as percentage)
  // Caps how many opening messages are sent to prevent overwhelming backlog
  MAX_NEW_MATCH_SLOTS_PERCENT: 70
};

} // end re-entry guard
