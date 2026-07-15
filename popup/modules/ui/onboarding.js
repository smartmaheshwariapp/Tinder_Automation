// Onboarding modal - High Fidelity 2026 HUD Version
function showOnboardingModal() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'risk-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="risk-modal-content" style="max-width: 420px;">
        <div style="position: relative; width: 64px; height: 64px; margin: 0 auto 12px;">
          <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #6366F1, #EC4899); border-radius: 20px; animation: iconFloat 3s ease-in-out infinite;"></div>
          <div style="position: absolute; inset: 2px; background: var(--bg-dark); border-radius: 18px; display: flex; align-items: center; justify-content: center;">
            <img src="../icons/icon_128.png" alt="FlirtEasy" style="width: 42px; height: 42px; object-fit: contain;" />
          </div>
        </div>
        <h3 style="margin-bottom: 6px; font-size: 18px; background: linear-gradient(135deg, #6366F1, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800;">Your AI Wingman is Ready!</h3>
        <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 16px; line-height: 1.5;">
          Sit back while I handle the heavy lifting. Here's what I'll do:
        </p>
        
        <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05)); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 14px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
              <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 12px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);"></div>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="white" stroke="white" stroke-width="0.5" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">Intelligent Swiping</div>
              <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">Discovers your best matches on autopilot</div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
            <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
              <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 12px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);"></div>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="white" stroke="white" stroke-width="0.5" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">Smart Filtering</div>
              <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">Only like profiles that match your preferences</div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
              <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);"></div>
              <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="white" stroke="white" stroke-width="0.5" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">Human-Like Protection</div>
              <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">Smart safety limits handle your account with care</div>
            </div>
          </div>
        </div>
        
        <div style="background: linear-gradient(135deg, rgba(251, 146, 60, 0.12), rgba(251, 146, 60, 0.06)); border: 1px solid rgba(251, 146, 60, 0.3); border-radius: 10px; padding: 12px; margin-bottom: 14px; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 8px; right: 8px; background: linear-gradient(135deg, #fb923c, #f59e0b); color: white; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 8px; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(251, 146, 60, 0.4);">PREMIUM</div>
          <div style="font-size: 11px; color: #fb923c; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800;">Unlock AI-Powered Messaging</div>
          <div style="font-size: 12px; color: var(--text-primary); line-height: 1.4; margin-bottom: 8px;">
            <strong>Get 10x more matches</strong> with AI that writes perfect openers and keeps conversations flowing
          </div>
          <div style="font-size: 10px; color: var(--text-primary); opacity: 0.9; font-weight: 500;">
            Unlimited AI usage is included with FlirtEasy Pro
          </div>
        </div>
        
        <div class="risk-modal-buttons">
          <button class="risk-btn risk-btn-confirm onboarding-cta">
            <span class="cta-glow"></span>
            <span class="cta-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="cta-icon">
                <defs>
                  <linearGradient id="sparkleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
                    <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#fbbf24;stop-opacity:1" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <g filter="url(#glow)">
                  <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="url(#sparkleGradient)" stroke="#fbbf24" stroke-width="0.5"/>
                  <circle cx="19" cy="5" r="1.5" fill="#fbbf24"/>
                  <circle cx="5" cy="19" r="1" fill="#fbbf24"/>
                  <circle cx="19" cy="19" r="1" fill="#fbbf24"/>
                </g>
              </svg>
              <span class="cta-text">Let's Go!</span>
            </span>
            <span class="cta-particles">
              <span class="particle"></span>
              <span class="particle"></span>
              <span class="particle"></span>
            </span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      modal.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => {
        modal.remove();
        resolve();
      }, 200);
    };

    modal.querySelector('.risk-btn-confirm').addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const content = modal.querySelector('.risk-modal-content');
        if (content) {
          content.style.animation = 'shake 0.5s ease';
          setTimeout(() => {
            content.style.animation = '';
          }, 500);
        }
      }
    });
  });
}
