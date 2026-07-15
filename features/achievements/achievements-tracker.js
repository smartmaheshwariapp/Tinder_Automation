// Achievement Tracker - Progress monitoring and unlock detection
if (typeof window.AchievementTracker === 'undefined') {
  window.AchievementTracker = class AchievementTracker {
    constructor() {
      this.DEBUG_ENABLED = false;
      this.userStats = {};
      this.unlockedBadges = [];
      this.totalXP = 0;
      this.newBadges = [];
      this.initialized = false;
    }

    log(...args) {
      if (this.DEBUG_ENABLED) console.log(...args);
    }

    async initialize() {

      if (this.initialized) return;

      this.log('[AchievementTracker] Initializing...');

      let data = null;

      // PRODUCTION FIX: If we have direct access to chrome storage (Popup context), use it!
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        data = await chrome.storage.local.get(['achievementData']);
      } else {
        // Fallback for page context (Tinder)
        data = await new Promise((resolve) => {
          const handler = (event) => {
            window.removeEventListener('achievement:dataResponse', handler);
            this.log('[AchievementTracker] Received data:', event.detail);
            resolve(event.detail);
          };
          window.addEventListener('achievement:dataResponse', handler);
          window.dispatchEvent(new CustomEvent('achievement:getData'));
        });
      }


      if (data && data.achievementData) {
        this.userStats = data.achievementData.userStats || {};
        this.unlockedBadges = data.achievementData.unlockedBadges || [];
        this.totalXP = data.achievementData.totalXP || 0;
        this.log('[AchievementTracker] Loaded existing data:', {
          userStats: this.userStats,
          unlockedBadges: this.unlockedBadges,
          totalXP: this.totalXP
        });
      } else {
        this.log('[AchievementTracker] No existing data, initializing defaults');
        this.userStats = {
          cyclesRun: 0,
          messagesSent: 0,
          matches: 0,
          likesGiven: 0,
          daysActive: 0,
          replyRate: 0,
          activeThreads: 0,
          consecutiveDays: 0,
          datesArranged: 0,
          longChats: 0,
          reports: 0
        };
        await this.save();
      }

      this.initialized = true;
      this.log('[AchievementTracker] Initialization complete'); // Changed from console.log
    }

    async checkAchievements(stats) {
      await this.initialize();

      // Update all stats
      this.log('[AchievementTracker] Checking achievements with stats:', stats); // Changed from console.log
      Object.assign(this.userStats, stats);
      this.log('[AchievementTracker] Updated userStats:', this.userStats); // Changed from console.log

      await this.checkForUnlocks();
      await this.save();
    }

    async checkForUnlocks() {
      const newUnlocks = [];

      Object.keys(BADGE_CATALOG).forEach(badgeId => {
        if (!this.unlockedBadges.includes(badgeId)) {
          if (checkBadgeUnlock(badgeId, this.userStats)) {
            this.log(`[AchievementTracker] 🎉 Badge unlocked: ${badgeId} `); // Changed from console.log
            this.unlockedBadges.push(badgeId);
            this.totalXP += BADGE_CATALOG[badgeId].xp;
            newUnlocks.push(BADGE_CATALOG[badgeId]);
          }
        }
      });

      if (newUnlocks.length > 0) {
        this.log(`[AchievementTracker] Total new unlocks: ${newUnlocks.length} `, newUnlocks);
        this.newBadges.push(...newUnlocks);
        await this.notifyUnlocks(newUnlocks);
      } else {
        this.log('[AchievementTracker] No new badges unlocked');
      }
    }

    async notifyUnlocks(badges) {
      for (const badge of badges) {
        window.dispatchEvent(new CustomEvent('achievement:unlocked', {
          detail: { badge }
        }));
      }
    }

    async clearNewBadges() {
      this.newBadges = [];
      await this.save();
    }

    getProgress() {
      return {
        level: calculateLevel(this.totalXP),
        xp: this.totalXP,
        xpProgress: getXPForNextLevel(this.totalXP),
        unlockedCount: this.unlockedBadges.length,
        totalCount: Object.keys(BADGE_CATALOG).length,
        nextBadge: getNextBadgeProgress(this.userStats, this.unlockedBadges)
      };
    }

    getBadgesByRarity() {
      const badges = { common: [], rare: [], epic: [], legendary: [] };

      Object.values(BADGE_CATALOG).forEach(badge => {
        const unlocked = this.unlockedBadges.includes(badge.id);
        badges[badge.rarity].push({ ...badge, unlocked });
      });

      return badges;
    }

    async save() {
      const data = {
        achievementData: {
          userStats: this.userStats,
          unlockedBadges: this.unlockedBadges,
          totalXP: this.totalXP
        }
      };

      this.log('[AchievementTracker] Saving data:', data);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set(data);
      }

      window.dispatchEvent(new CustomEvent('achievement:saveData', {
        detail: data
      }));
      return Promise.resolve({ success: true });
    }
  }

  // Create and expose tracker instance immediately
  if (typeof window !== 'undefined' && !window.achievementTracker) {
    window.achievementTracker = new AchievementTracker();
    const l = (...args) => { if (window.achievementTracker.DEBUG_ENABLED) console.log(...args); };
    l('[AchievementTracker] Exposed to window:', window.achievementTracker);

    // Listen for check requests from content script
    window.addEventListener('achievement:check', async (event) => {
      l('[AchievementTracker] Received check request:', event.detail.stats);
      try {
        await window.achievementTracker.checkAchievements(event.detail.stats);
        l('[AchievementTracker] Check completed');
      } catch (err) {
        console.error('[AchievementTracker] Check failed:', err);
      }
    });

    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('achievement:trackerReady'));
    l('[AchievementTracker] Ready event dispatched');
  }
}


