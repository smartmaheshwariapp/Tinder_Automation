// Tab navigation
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabsContainer = document.querySelector('.tabs');
  const TAB_ORDER = ['activity', 'myprofile', 'settings']; // matches actual data-tab values in HTML

  let currentIndex = TAB_ORDER.indexOf(
    (document.querySelector('.tab-content.active')?.id || 'activityTab').replace('Tab', '')
  );
  if (currentIndex === -1) currentIndex = 0;

  // ── Inject Fluid Slider ──
  let slider = document.getElementById('tabSlider');
  if (!slider && tabsContainer) {
    slider = document.createElement('div');
    slider.id = 'tabSlider';
    slider.className = 'tab-slider';
    tabsContainer.appendChild(slider);
  }

  function updateSlider(btn, isInitial = false) {
    if (!btn || !slider || !tabsContainer) return;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = tabsContainer.getBoundingClientRect();
    
    // Calculate precise center underneath the active text
    const leftOffset = btnRect.left - containerRect.left;
    const centerPos = leftOffset + (btnRect.width / 2) - 20; // 40px wide slider = 20px offset

    if (isInitial) {
      slider.style.transition = 'none';
      slider.style.opacity = '1';
    } else {
      // Water-like spring slide
      slider.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
    }
    slider.style.transform = `translateX(${centerPos}px)`;
  }

  // Init slider on first load
  setTimeout(() => {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn) updateSlider(activeBtn, true);
  }, 50);

  let isAnimating = false;

  const EXIT_DURATION  = 170; // ms — outgoing slides away
  const ENTER_DURATION = 240; // ms — incoming springs in (matches auth cubic-bezier)
  const EXIT_EASE      = 'cubic-bezier(0.4, 0, 0.2, 1)';
  const ENTER_EASE     = 'cubic-bezier(0.16, 1, 0.3, 1)'; // same spring as auth-view

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isAnimating) return;
      
      // Update fluid slider immediately
      updateSlider(btn);

      const targetTab   = btn.getAttribute('data-tab');
      const targetIndex = TAB_ORDER.indexOf(targetTab);
      const currentEl   = document.querySelector('.tab-content.active');
      const targetEl    = document.getElementById(targetTab + 'Tab');

      if (!targetEl || currentEl === targetEl) return;

      const goingRight = targetIndex > currentIndex;
      isAnimating = true;

      // Update nav state immediately
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (tabsContainer) tabsContainer.setAttribute('data-active', targetTab);

      // ── Phase 1: exit current tab (slide + fade out) ──
      currentEl.style.transition = `opacity ${EXIT_DURATION}ms ${EXIT_EASE}, transform ${EXIT_DURATION}ms ${EXIT_EASE}`;
      currentEl.style.opacity    = '0';
      currentEl.style.transform  = goingRight ? 'translateX(-24px)' : 'translateX(24px)';

      setTimeout(() => {
        // Hide all, clear inline styles
        document.querySelectorAll('.tab-content').forEach(c => {
          c.classList.remove('active');
          c.style.cssText = '';
        });

        // ── Phase 2: pre-position incoming tab off-screen ──
        targetEl.style.transition = 'none';
        targetEl.style.opacity    = '0';
        targetEl.style.transform  = goingRight ? 'translateX(24px)' : 'translateX(-24px)';
        targetEl.classList.add('active');

        // Force reflow so the pre-position is painted before we animate
        void targetEl.offsetWidth;

        // ── Phase 3: spring incoming tab to center ──
        targetEl.style.transition = `opacity ${ENTER_DURATION}ms ${ENTER_EASE}, transform ${ENTER_DURATION}ms ${ENTER_EASE}`;
        targetEl.style.opacity    = '1';
        targetEl.style.transform  = 'translateX(0)';

        document.querySelector('.content')?.scrollTo(0, 0);

        setTimeout(() => {
          targetEl.style.cssText = '';
          isAnimating = false;
        }, ENTER_DURATION + 20);
      }, EXIT_DURATION);

      currentIndex = targetIndex;
    });
  });
}
