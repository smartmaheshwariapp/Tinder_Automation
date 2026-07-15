/* ================================================================
   Step 5 — You're All Set!
   Completion screen with animated checkmark, confetti, and summary
   ================================================================ */

const StepComplete = {

  render(container, controller) {
    container.innerHTML = `
      <h1 class="ob-step-title" id="completeTitle">You're All Set!</h1>
      <p class="ob-step-subtitle" id="completeSubtitle">
        Your AI-Wingman is calibrated and ready to start scaling your dating success.
      </p>

      <div class="ob-timeline" id="completeTimeline">
        <div class="ob-timeline-line-wrapper">
          <div class="ob-timeline-line"></div>
        </div>
        
        <div class="ob-timeline-list">
          <div class="ob-timeline-item">
            <div class="ob-timeline-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span class="ob-timeline-label">Platform Connected</span>
          </div>

          <div class="ob-timeline-item">
            <div class="ob-timeline-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span class="ob-timeline-label">Goals Defined</span>
          </div>

          <div class="ob-timeline-item">
            <div class="ob-timeline-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span class="ob-timeline-label">Profile Configured</span>
          </div>
        </div>
      </div>
    `;
  },

  onEnter(container, controller) {
    // Trigger the timeline animations immediately (static header)
    setTimeout(() => {
      const timeline = document.getElementById('completeTimeline');
      if (timeline) {
        timeline.classList.add('visible');
      }
    }, 50);
  },



  validate() {
    return true;
  }
};
