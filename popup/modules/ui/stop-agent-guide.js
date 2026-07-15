/**
 * Stop Agent Modular Guide
 * Handles dynamic injection of 'How it works?' help panel for Stop Agent section.
 * Synchronized with standard Dashboard Help System.
 */
function initializeStopAgentGuide() {
  const section = document.getElementById('stopConditionSection');
  if (!section) return;

  const header = document.getElementById('stopConditionSectionHeader');
  if (!header) return;

  // 1. Create the Toggle Button Container
  const toggleContainer = document.createElement('div');
  toggleContainer.style.display = 'flex';
  toggleContainer.style.justifyContent = 'flex-end';
  toggleContainer.style.marginBottom = '6px'; // Tighter spacing
  toggleContainer.style.marginTop = '0px';

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'showStopAgentGuide';
  toggleBtn.className = 'guide-toggle-btn';
  toggleBtn.title = 'How it works?';
  toggleBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;">
      <path d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span>How it works?</span>
  `;

  toggleContainer.appendChild(toggleBtn);

  // 2. Create the Guide Panel (Using Standard Achievements Classes)
  const wrapper = document.createElement('div');
  wrapper.id = 'stopAgentGuideWrapper';
  wrapper.className = 'achievements-guide-wrapper';

  const panel = document.createElement('div');
  panel.id = 'stopAgentGuidePanel';
  panel.className = 'achievements-guide-panel';

  panel.innerHTML = `
    <div class="achievements-guide-content" style="margin-top: 8px; padding: 16px;">
      <div class="guide-section" style="margin-bottom: 12px;">
        <h4 style="color: #8b5cf6;"><span class="guide-icon">🛡️</span>PLATFORM SAFETY PROTOCOL</h4>
        <p style="font-size: 11px; opacity: 0.8; line-height: 1.4;">Automated systems monitor interaction patterns to ensure account longevity.</p>
      </div>
      
      <div class="guide-section" style="margin-bottom: 10px;">
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 16px;">📞</span>
          <div>
            <h4 style="margin-bottom: 2px; font-size: 11px;">PHONE/INSTAGRAM GRAB</h4>
            <p style="font-size: 10px; line-height: 1.3;">AI stops immediately once contact info is detected. Take over for the final close.</p>
          </div>
        </div>
      </div>

      <div class="guide-section" style="margin-bottom: 10px;">
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 16px;">📅</span>
          <div>
            <h4 style="margin-bottom: 2px; font-size: 11px;">DATE CONFIRMATION</h4>
            <p style="font-size: 10px; line-height: 1.3;">Triggers when meetup plans are made. Prevents AI from looping back to high-value leads.</p>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 16px;">∞</span>
          <div>
            <h4 style="margin-bottom: 2px; font-size: 11px;">NEVER STOP (AUTO-PILOT)</h4>
            <p style="font-size: 10px; line-height: 1.3;">Agent maintains engagement. Best paired with 'AI Personality' for deep rapport.</p>
          </div>
        </div>
      </div>

      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); font-style: italic; font-size: 9px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
        <span>💡</span> <span>Maintains human-like response cycles to reduce platform flagging.</span>
      </div>
    </div>
  `;

  wrapper.appendChild(panel);

  // 3. Precision Injection
  const contentWrapper = section.querySelector('.section-content-wrapper');
  if (contentWrapper) {
    contentWrapper.prepend(wrapper);
    contentWrapper.prepend(toggleContainer);
  } else {
    header.after(wrapper);
    header.after(toggleContainer);
  }

  // 4. Standard Animation Logic
  const closeGuide = () => {
    if (!wrapper.classList.contains('expanded')) return;
    wrapper.classList.remove('expanded');
    setTimeout(() => {
      if (!wrapper.classList.contains('expanded')) {
        wrapper.classList.remove('show-layout');
      }
    }, 400);
  };

  const openGuide = () => {
    wrapper.classList.add('show-layout');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wrapper.classList.add('expanded');
      });
    });
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!wrapper.classList.contains('expanded')) {
      openGuide();
      toggleBtn.classList.add('active');
    } else {
      closeGuide();
      toggleBtn.classList.remove('active');
    }
  });
}

window.initializeStopAgentGuide = initializeStopAgentGuide;
