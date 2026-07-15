/**
 * Age Filter Modular Guide
 * Handles dynamic injection of 'How it works?' help panel for Age Filter section.
 * Synchronized with standard Dashboard Help System.
 */
function initializeAgeFilterGuide() {
    const section = document.getElementById('ageFilterSectionContent')?.closest('.section');
    if (!section) return;

    const header = document.getElementById('ageFilterSectionHeader');
    if (!header) return;

    // 1. Create the Toggle Button Container
    const toggleContainer = document.createElement('div');
    toggleContainer.style.display = 'flex';
    toggleContainer.style.justifyContent = 'flex-end';
    toggleContainer.style.marginBottom = '6px';
    toggleContainer.style.marginTop = '0px';

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'showAgeFilterGuide';
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
    wrapper.id = 'ageFilterGuideWrapper';
    wrapper.className = 'achievements-guide-wrapper';

    const panel = document.createElement('div');
    panel.id = 'ageFilterGuidePanel';
    panel.className = 'achievements-guide-panel age-filter-guide-panel';

    panel.innerHTML = `
    <div class="achievements-guide-content" style="margin-top: 8px; padding: 16px;">
      <div class="guide-section" style="margin-bottom: 12px;">
        <h4 style="color: #f59e0b;"><span class="guide-icon">🎯</span>TARGET DEMOGRAPHIC SYNC</h4>
        <p style="font-size: 11px; opacity: 0.8; line-height: 1.4;">Filters prospective matches before the AI Analysis stage to optimize resource usage.</p>
      </div>
      
      <div class="guide-section" style="margin-bottom: 10px;">
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 16px;">⚖️</span>
          <div>
            <h4 style="margin-bottom: 2px; font-size: 11px;">AUTO-PASS SYSTEM</h4>
            <p style="font-size: 10px; line-height: 1.3;">Profiles outside your selected range (e.g., < 18 or > 99) are instantly bypassed WITHOUT using AI tokens.</p>
          </div>
        </div>
      </div>

      <div class="guide-section" style="margin-bottom: 10px;">
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 16px;">🚀</span>
          <div>
            <h4 style="margin-bottom: 2px; font-size: 11px;">EFFICIENCY BOOST</h4>
            <p style="font-size: 10px; line-height: 1.3;">By filtering by age first, the agent skips unnecessary deep-profile scans, increasing swipes per hour.</p>
          </div>
        </div>
      </div>

      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); font-style: italic; font-size: 9px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
        <span>💡</span> <span>Narrower age ranges significantly speed up the agent's cycle time.</span>
      </div>
    </div>
  `;

    wrapper.appendChild(panel);

    // 3. Precision Injection: Target the content div to ensure visibility is tied to expansion
    const content = document.getElementById('ageFilterSectionContent');
    const contentWrapper = section.querySelector('.section-content-wrapper');

    if (contentWrapper) {
        contentWrapper.prepend(wrapper);
        contentWrapper.prepend(toggleContainer);
    } else if (content) {
        content.prepend(wrapper);
        content.prepend(toggleContainer);
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

window.initializeAgeFilterGuide = initializeAgeFilterGuide;
