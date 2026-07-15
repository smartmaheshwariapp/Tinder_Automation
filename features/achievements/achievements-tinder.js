// Tinder UI Overlay - Premium Badge Unlock Celebration
if (!window.hasInitializedAchievementsTinder) {
  window.hasInitializedAchievementsTinder = true;

  const SHOW_ACHIEVEMENT_POPUPS = false;

  const badgeQueue = [];
  let isBadgeShowing = false;

  function showBadgeUnlockOnTinder(badge) {
    if (!SHOW_ACHIEVEMENT_POPUPS) return;
    if (isBadgeShowing) {
      badgeQueue.push(badge);
      return;
    }

    isBadgeShowing = true;

    // Use global BADGE_ICONS if available, fallback to theAwakening icon
    let badgeSvg = (window.BADGE_ICONS && window.BADGE_ICONS[badge.id]) || (window.BADGE_ICONS && window.BADGE_ICONS.theAwakening);

    if (!badgeSvg) {
      // Ultimate fallback just in case
      badgeSvg = `⚡`;
    }

    // Get Rarity Configuration (with safe fallbacks)
    const rarityKey = badge.rarity || 'common';
    const config = (window.RARITY_CONFIG && window.RARITY_CONFIG[rarityKey]) || { color1: '#FFD700', color2: '#FFA000', effect: 'sparkles' };
    const c1 = config.color1;
    const c2 = config.color2;
    const rarityTitle = rarityKey.toUpperCase();

    const overlay = document.createElement('div');
    overlay.id = 'tind-badge-overlay';

    // Adding noise texture via data URI for grain effect
    const noiseBg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E")`;

    overlay.innerHTML = `
      <style>
        /* CSP-safe font stack — Google Fonts may be blocked by site CSP */

        /* --- CORE LAYOUT --- */
        #tind-badge-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          /* High-Contrast Clear Background */
          background: rgba(0, 0, 0, 0.88) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          font-family: 'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif !important;
          padding: 20px !important;
          overflow: hidden !important;
          animation: overlayFadeIn 0.3s ease-out forwards !important;
        }

        /* --- BACKGROUND FX --- */
        .tind-bg-noise {
          position: absolute;
          inset: 0;
          background-image: ${noiseBg};
          opacity: 0.4;
          pointer-events: none;
          z-index: 2;
        }

        .tind-ambient-light {
          position: absolute;
          width: 100vw;
          height: 100vw;
          background: radial-gradient(circle at center, ${c1}30 0%, ${c2}20 40%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 1;
          animation: pulseLight 4s ease-in-out infinite alternate;
        }

        /* --- CONTENT CONTAINER --- */
        .tind-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transform: scale(0.9);
          animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          max-width: 500px;
          width: 100%;
        }

        /* --- HEADER TITLE --- */
        .tind-super-title {
          font-size: 14px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: ${c2}; /* Use accent color for super title */
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
          font-weight: 600;
          margin-bottom: 12px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }

        .tind-title {
          font-size: 58px;
          font-weight: 900;
          line-height: 1;
          margin: 0 0 30px 0;
          text-transform: uppercase;
          ${rarityKey === 'legendary'
        ? `background: linear-gradient(to bottom, #FFF59D 0%, #FFD700 40%, #FF8F00 100%);
             -webkit-background-clip: text;
             -webkit-text-fill-color: transparent;
             background-size: 200% auto;
             animation: shineText 3s linear infinite;`
        : `color: ${c1};
             filter: drop-shadow(0 0 15px ${c1}) drop-shadow(0 0 2px rgba(255,255,255,0.7));`}
          text-shadow: 0 10px 40px ${rarityKey === 'legendary' ? 'rgba(255, 143, 0, 0.6)' : `${c1}80`};
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
        }

        /* --- MAIN ICON --- */
        .tind-hero-icon {
          width: 180px;
          height: 180px;
          margin-bottom: 25px;
          position: relative;
          filter: drop-shadow(0 0 60px ${c2}90); /* Warmer Golden Glow */
          animation: floatIcon 3s ease-in-out infinite;
        }
        
        .tind-hero-icon svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        /* --- BADGE INFO --- */
        .tind-badge-name {
          font-size: 32px;
          color: white;
          margin: 0 0 8px 0;
          text-shadow: 0 4px 12px rgba(0,0,0,0.8);
        }

        .tind-badge-desc {
          font-size: 16px;
          color: #cbd5e1;
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
          opacity: 0.8;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        /* --- XP PILL --- */
        .tind-xp {
          display: inline-flex;
          padding: 8px 24px;
          border-radius: 20px;
          background: linear-gradient(90deg, ${c1}20, ${c2}20);
          color: white;
          border: 1px solid ${c2};
          font-weight: 800;
          font-size: 14px;
          box-shadow: 0 0 20px ${c1}40;
          margin-bottom: 30px;
          backdrop-filter: blur(5px);
        }

        /* --- BUTTONS --- */
        .tind-btn-group {
          display: flex;
          gap: 16px;
        }

        .tind-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        .tind-btn:hover { transform: translateY(-2px); }
        .tind-btn-primary { 
          background: white; 
          color: black; 
          border: none; 
          box-shadow: 0 0 40px ${c2}60; /* Color matched glow */
        }
        .tind-btn-secondary { background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); }

        /* --- ANIMATIONS --- */
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes overlayFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes scaleOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.2); filter: blur(20px); } }
        @keyframes pulseLight { 0% { scale: 1; opacity: 0.3; } 100% { scale: 1.2; opacity: 0.5; } }
        @keyframes floatIcon { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-15px) rotate(2deg); } }
        @keyframes shineText { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
      </style>

      <div class="tind-bg-noise"></div>
      <div class="tind-ambient-light"></div>

      <div class="tind-content">
        <div class="tind-super-title">ACHIEVEMENT UNLOCKED</div>
        <div class="tind-title">${rarityTitle}</div>
        <div class="tind-hero-icon">${badgeSvg}</div>
        <div class="tind-badge-name">${badge.name}</div>
        <div class="tind-badge-desc">${badge.description}</div>
        <div class="tind-xp">+${badge.xp} XP</div>
        <div class="tind-btn-group">
          <button class="tind-btn tind-btn-primary" id="tindViewBadge">Claim Reward</button>
          <button class="tind-btn tind-btn-secondary" id="tindDismissBadge">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let interacted = false;

    // Trigger Rarity Effect (Appended to overlay to stay behind content)
    triggerRarityEffect(config.effect, { c1, c2 }, overlay, () => {
      // If no interaction occurred and it was high-tier, start the meteor celebration
      if (!interacted && (rarityKey === 'legendary' || rarityKey === 'epic')) {
        const DEBUG_ENABLED = false;
        if (DEBUG_ENABLED) console.log(`[Tinder UI] Celebration phase 1 ended. Launching ${rarityKey} Meteor Shower...`);
        // Use legendary-specific gold or standard rarity colors (e.g. Epic Purple)
        const meteorColors = rarityKey === 'legendary'
          ? { c1: '#FFD700', c2: '#FFA000' }
          : { c1, c2 };
        triggerRarityEffect('meteor', meteorColors, overlay);
      }
    });

    const dismiss = () => {
      if (interacted) return;
      interacted = true;

      const content = overlay.querySelector('.tind-content');
      if (content) {
        content.style.animation = 'scaleOut 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards';
      }
      overlay.style.animation = 'overlayFadeOut 0.5s ease-out forwards';

      setTimeout(() => {
        overlay.remove();
        // Clean up any remaining canvases
        document.querySelectorAll('[id^="rarity-canvas-"]').forEach(c => c.remove());
        isBadgeShowing = false;
        // Process next badge in queue if any
        if (badgeQueue.length > 0) {
          const nextBadge = badgeQueue.shift();
          showBadgeUnlockOnTinder(nextBadge);
        }
      }, 300);
    };

    // Simple dismiss handlers
    ['tindViewBadge', 'tindDismissBadge'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', dismiss);
    });

    // Auto-dismiss after 15 seconds
    const autoDismissTimer = setTimeout(dismiss, 15000);
  }

  /**
   * High-Performance Particle Engine for Hyper-Luxury Effects
   */
  function triggerRarityEffect(type, colors, parentElement, onComplete) {
    const canvas = document.createElement('canvas');
    canvas.id = 'rarity-canvas-' + Math.random().toString(36).substr(2, 9);
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    // Below the content (which is 10), but above the ambient light (1)
    canvas.style.setProperty('z-index', '5', 'important');
    // Boost brilliance via CSS filter too
    canvas.style.filter = 'saturate(1.5) brightness(1.2)';
    (parentElement || document.body).appendChild(canvas);

    const ctx = canvas.getContext('2d');
    // Ensure we have real dimensions
    let width = canvas.width = window.innerWidth || 1920;
    let height = canvas.height = window.innerHeight || 1080;

    // Re-check sizing after a tiny delay for safety
    setTimeout(() => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }, 100);

    const particles = [];
    const isLegendary = type === 'explosion';
    const isMeteor = type === 'meteor';
    const particleCount = isLegendary ? 450 : (isMeteor ? 40 : (type === 'fireworks' ? 120 : 80));

    class Particle {
      constructor(x, y, isVelocity = false) {
        this.x = x || (isMeteor ? Math.random() * width + 200 : Math.random() * width);
        this.y = y || (isMeteor ? -100 : (type === 'confetti' ? -20 : Math.random() * height));

        const angle = isMeteor ? Math.PI * 0.75 : Math.random() * Math.PI * 2;
        const speed = isMeteor ? Math.random() * 15 + 10 : (Math.random() * (isLegendary ? 18 : (type === 'explosion' ? 15 : 5)) + 2);

        this.vx = isVelocity || isMeteor ? Math.cos(angle) * speed : (Math.random() - 0.5) * 4;
        this.vy = isVelocity || isMeteor ? Math.sin(angle) * speed : (type === 'confetti' ? Math.random() * 3 + 2 : (Math.random() - 0.5) * 4);

        // BOOSTED SIZE for maximum impact
        this.size = isMeteor ? Math.random() * 3 + 2 : (Math.random() * (type === 'explosion' ? 12 : 5) + 2.5);

        // Multi-color spark system
        this.color = Math.random() > 0.4 ? colors.c1 : colors.c2;

        this.opacity = 1;
        this.gravity = type === 'confetti' ? 0.1 : (isLegendary ? 0.12 : 0);
        this.drag = (isLegendary && !isMeteor) ? 0.96 : (isMeteor ? 1 : 0.98);
        this.life = 1;
        this.decay = isMeteor ? 0.005 : (Math.random() * (isLegendary ? 0.008 : 0.02) + 0.005);

        this.history = []; // For meteor trails
      }
      update() {
        if (isMeteor) {
          this.history.push({ x: this.x, y: this.y });
          if (this.history.length > 20) this.history.shift();
        }
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= this.decay;
        this.opacity = this.life;
      }
      draw() {
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;

        if (isMeteor) {
          // Draw meteor trail with much higher brilliance
          ctx.shadowBlur = 10;
          ctx.shadowColor = this.color;

          ctx.beginPath();
          ctx.moveTo(this.x, this.y);
          for (let i = this.history.length - 1; i >= 0; i--) {
            ctx.lineTo(this.history[i].x, this.history[i].y);
          }
          ctx.strokeStyle = this.color;
          ctx.lineWidth = this.size;
          ctx.lineCap = 'round';
          ctx.globalAlpha = this.opacity * 0.7; // Brighter trails
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2); // Larger head
          ctx.fill();
        } else {
          if (isLegendary) {
            ctx.shadowBlur = 20; // Increased glow for legendaries
            ctx.shadowColor = this.color;
          }
          if (type === 'sparkles') {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) ctx.lineTo(this.x + this.size * Math.cos(i * Math.PI * 0.8), this.y + this.size * Math.sin(i * Math.PI * 0.8));
            ctx.closePath(); ctx.fill();
          } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }
    }

    if (type === 'explosion' || type === 'fireworks') {
      const centerX = width / 2; const centerY = height / 2;
      for (let i = 0; i < particleCount; i++) particles.push(new Particle(centerX, centerY, true));

      // Legendaries still get the physical screen shake, but NO FLASH
      if (isLegendary) {
        // Screen Shake
        const content = document.querySelector('.tind-content');
        if (content) {
          content.style.transition = 'none';
          let shakeCount = 0;
          const shake = setInterval(() => {
            const x = (Math.random() - 0.5) * 20;
            const y = (Math.random() - 0.5) * 20;
            content.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
            if (++shakeCount > 10) {
              clearInterval(shake);
              content.style.transform = 'translate(0,0) scale(1)';
            }
          }, 30);
        }
      }
    }

    // Pre-spawn at least one for continuous types to ensure the loop starts
    if (isMeteor || type === 'confetti' || type === 'sparkles') {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Spawning logic
      if (type === 'confetti' && particles.length < particleCount && Math.random() > 0.5) particles.push(new Particle());
      if (type === 'sparkles' && particles.length < particleCount) particles.push(new Particle());
      if (isMeteor && particles.length < particleCount && Math.random() > 0.8) particles.push(new Particle());

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(); particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
      }

      if ((particles.length > 0 || isMeteor || type === 'confetti' || type === 'sparkles') && document.contains(canvas)) {
        // For continuous types, we check if we still want to spawn
        if (isMeteor || type === 'confetti' || type === 'sparkles') {
          requestAnimationFrame(animate);
        } else if (particles.length > 0) {
          requestAnimationFrame(animate);
        } else {
          canvas.remove();
          if (onComplete) onComplete();
        }
      } else {
        if (canvas.parentNode) canvas.remove();
        if (onComplete) onComplete();
      }
    }
    animate();
  }

  // Listen for badge unlocks from achievement tracker
  window.addEventListener('achievement:unlocked', (event) => {
    const DEBUG_ENABLED = false;
    if (DEBUG_ENABLED) console.log('[Tinder UI] Badge unlock event received:', event.detail.badge);
    showBadgeUnlockOnTinder(event.detail.badge);
  });

  // Listen for test requests from the popup modal (Showcase Mode relay)
  window.addEventListener('achievement:testCelebration', (event) => {
    if (event.detail && event.detail.badge) {
      const DEBUG_ENABLED = false;
      if (DEBUG_ENABLED) console.log('[Tinder UI] Received test celebration request for:', event.detail.badge.id);
      showBadgeUnlockOnTinder(event.detail.badge);
    }
  });

}
