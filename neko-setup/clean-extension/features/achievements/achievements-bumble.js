// Bumble UI Overlay - Premium Badge Unlock Celebration
if (!window.hasInitializedAchievementsBumble) {
  window.hasInitializedAchievementsBumble = true;

  const SHOW_ACHIEVEMENT_POPUPS = false;

  const badgeQueue = [];
  let isBadgeShowing = false;

  function showBadgeUnlockOnBumble(badge) {
    if (!SHOW_ACHIEVEMENT_POPUPS) return;
    if (isBadgeShowing) {
      badgeQueue.push(badge);
      return;
    }

    isBadgeShowing = true;

    // Use global BADGE_ICONS if available
    let badgeSvg = (window.BADGE_ICONS && window.BADGE_ICONS[badge.id]) || (window.BADGE_ICONS && window.BADGE_ICONS.theAwakening);

    if (!badgeSvg) {
      badgeSvg = `⚡`;
    }

    // Bumble Theme Colors: Yellow (#FFCB37) and Gold (#FFB800)
    const rarityKey = badge.rarity || 'common';

    // Customize colors for Bumble branding while respecting rarity
    let c1, c2;
    if (rarityKey === 'legendary') {
      c1 = '#FFD700'; // Gold
      c2 = '#FFA000'; // Amber
    } else if (rarityKey === 'epic') {
      c1 = '#D946EF'; // Magenta/Purple
      c2 = '#7C3AED';
    } else if (rarityKey === 'rare') {
      c1 = '#FCD34D'; // Bumble Yellow
      c2 = '#D97706'; // Bumble Amber
    } else {
      c1 = '#FFCB37'; // Standard Bumble Yellow
      c2 = '#F59E0B';
    }

    const config = (window.RARITY_CONFIG && window.RARITY_CONFIG[rarityKey]) || { effect: 'sparkles' };
    const rarityTitle = rarityKey.toUpperCase();

    const overlay = document.createElement('div');
    overlay.id = 'bumble-badge-overlay';

    const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

    overlay.innerHTML = `
      <style>
        /* CSP-safe font stack — Google Fonts blocked on Bumble */

        #bumble-badge-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: rgba(0, 0, 0, 0.9) !important;
          font-family: 'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif !important;
          padding: 20px !important;
          overflow: hidden !important;
          animation: bumbleOverlayFadeIn 0.3s ease-out forwards !important;
        }

        .bumble-bg-noise {
          position: absolute;
          inset: 0;
          background-image: ${noiseBg};
          opacity: 0.4;
          pointer-events: none;
          z-index: 2;
        }

        .bumble-ambient-light {
          position: absolute;
          width: 100vw;
          height: 100vw;
          background: radial-gradient(circle at center, ${c1}30 0%, ${c2}20 40%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 1;
          animation: bumblePulseLight 4s ease-in-out infinite alternate;
        }

        .bumble-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transform: scale(0.9);
          animation: bumblePopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          max-width: 500px;
          width: 100%;
        }

        .bumble-super-title {
          font-size: 14px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: ${c1};
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-weight: 600;
          margin-bottom: 12px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        .bumble-title {
          font-size: 58px;
          font-weight: 900;
          line-height: 1;
          margin: 0 0 30px 0;
          text-transform: uppercase;
          color: ${c1};
          filter: drop-shadow(0 0 15px ${c1}80);
          text-shadow: 0 10px 40px ${c1}40;
        }

        .bumble-hero-icon {
          width: 180px;
          height: 180px;
          margin-bottom: 25px;
          position: relative;
          filter: drop-shadow(0 0 50px ${c1}60);
          animation: bumbleFloatIcon 3s ease-in-out infinite;
        }
        
        .bumble-hero-icon svg {
          width: 100%;
          height: 100%;
        }

        .bumble-badge-name {
          font-size: 32px;
          color: white;
          margin: 0 0 8px 0;
          text-shadow: 0 4px 12px rgba(0,0,0,0.8);
        }

        .bumble-badge-desc {
          font-size: 16px;
          color: #cbd5e1;
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
          opacity: 0.8;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .bumble-xp-pill {
          display: inline-flex;
          padding: 8px 24px;
          border-radius: 20px;
          background: #FFCB37;
          color: #000;
          font-weight: 900;
          font-size: 14px;
          margin-bottom: 30px;
          box-shadow: 0 5px 15px rgba(255, 203, 55, 0.4);
        }

        .bumble-btn-group {
          display: flex;
          gap: 16px;
        }

        .bumble-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        .bumble-btn:hover { transform: translateY(-2px); }
        .bumble-btn-primary { 
          background: #FFCB37; 
          color: black; 
          border: none; 
          box-shadow: 0 8px 20px rgba(255, 203, 55, 0.3);
        }
        .bumble-btn-secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); }

        @keyframes bumbleOverlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bumbleOverlayFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes bumblePopIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes bumbleFloatIcon { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
      </style>

      <div class="bumble-bg-noise"></div>
      <div class="bumble-ambient-light"></div>

      <div class="bumble-content">
        <div class="bumble-super-title">BUMBLE ACHIEVEMENT</div>
        <div class="bumble-title">${rarityTitle}</div>
        <div class="bumble-hero-icon">${badgeSvg}</div>
        <div class="bumble-badge-name">${badge.name}</div>
        <div class="bumble-badge-desc">${badge.description}</div>
        <div class="bumble-xp-pill">+${badge.xp} XP</div>
        <div class="bumble-btn-group">
          <button class="bumble-btn bumble-btn-primary" id="bumbleViewBadge">Claim Reward</button>
          <button class="bumble-btn bumble-btn-secondary" id="bumbleDismissBadge">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let interacted = false;

    // Trigger Rarity Effect (Appended to overlay)
    if (typeof triggerRarityEffect === 'function') {
      triggerRarityEffect(config.effect, { c1, c2 }, overlay);
    }

    const dismiss = () => {
      if (interacted) return;
      interacted = true;

      const content = overlay.querySelector('.bumble-content');
      if (content) {
        content.style.animation = 'bumblePopIn 0.3s reverse forwards';
      }
      overlay.style.animation = 'bumbleOverlayFadeOut 0.5s ease-out forwards';

      setTimeout(() => {
        overlay.remove();
        isBadgeShowing = false;
        if (badgeQueue.length > 0) {
          showBadgeUnlockOnBumble(badgeQueue.shift());
        }
      }, 300);
    };

    ['bumbleViewBadge', 'bumbleDismissBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', dismiss);
    });

    setTimeout(dismiss, 10000);
  }

  // Listen for badge unlocks from achievement tracker
  window.addEventListener('achievement:unlocked', (event) => {
    const DEBUG_ENABLED = false;
    if (DEBUG_ENABLED) console.log('[Bumble UI] Badge unlock event received:', event.detail.badge);
    showBadgeUnlockOnBumble(event.detail.badge);
  });

  // Test celebration relay
  window.addEventListener('achievement:testCelebration', (event) => {
    if (event.detail && event.detail.badge) {
      showBadgeUnlockOnBumble(event.detail.badge);
    }
  });
}
