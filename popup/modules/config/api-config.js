// Centralized API Configuration
// This file manages API settings for the FlirtEasy extension.
// For production, the API key should be managed by your backend proxy.

const API_CONFIG = {
  // Default AI model for message generation
  DEFAULT_MODEL: 'gpt-4o',

  // Whether to use the backend proxy for API calls (recommended for production)
  USE_BACKEND_PROXY: true,

  // Backend proxy endpoint for OpenAI calls
  // This should handle authentication and rate limiting on your server
  PROXY_ENDPOINT: 'https://flirteasy-auth.shnaiderdm.workers.dev/api/ai/chat',

  // Fallback: Direct OpenAI endpoint (only used if USE_BACKEND_PROXY is false)
  OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',

  // Feature flags
  FEATURES: {
    // When true, users cannot enter their own API key
    HIDE_USER_API_KEY: true,

    // When true, users cannot select AI model
    HIDE_MODEL_SELECTION: true,

    // Allow power users to use their own key (future Pro feature)
    ALLOW_BYOK_FOR_PRO: false
  }
};

// Expose to window for other scripts
if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
}
