/**
 * Bumble Platform Configuration
 * Self-contained config for Bumble integration
 */

const BUMBLE_CONFIG = {
    PLATFORM_ID: 'bumble',
    PLATFORM_NAME: 'Bumble',
    PLATFORM_COLOR: '#FFC629',
    DOMAIN: 'bumble.com',

    // API endpoints (to be discovered during development)
    API_BASE: 'https://bumble.com/mwebapi.phtml',

    // Bumble-specific rules
    RULES: {
        // In heterosexual matches, women must message first
        WOMEN_MESSAGE_FIRST: true,
        // Matches expire after 24 hours if woman doesn't message
        MATCH_EXPIRY_HOURS: 24,
        // Extended time for one match per day
        EXTEND_AVAILABLE: true
    },

    // Default automation settings
    DEFAULTS: {
        LIKES_PER_CYCLE: 50,
        MESSAGES_PER_CYCLE: 50,
        MIN_DELAY_MS: 1500,
        MAX_DELAY_MS: 3500
    }
};

// Expose globally
if (typeof window !== 'undefined') {
    window.BUMBLE_CONFIG = BUMBLE_CONFIG;
}
