/* ================================================================
   Step 3 — What Is Your Goal?
   Multi-select goal pills
   ================================================================ */

const StepGoals = {

  render(container, controller) {
    container.classList.add('ob-step-compact');
    container.innerHTML = `
      <h1 class="ob-step-title ob-stagger-item">What is your Goal?</h1>
      <p class="ob-step-subtitle ob-stagger-item">
        Choose your objectives. Your AI-Wingman will focus the conversation on these results and stop once they are reached.
      </p>

      <div class="ob-list ob-stagger-item">
        <!-- Date Goal -->
        <div class="ob-list-item selectable ob-pill-cascade" data-goal="date" role="checkbox" aria-checked="false" tabindex="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <div class="ob-item-info">
            <span class="ob-item-label">Set up a Date</span>
            <span class="ob-item-hint">Detects when it's time to meet up in person.</span>
          </div>
          <div class="ob-list-item-tick">
            <svg class="ob-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <!-- Phone Goal -->
        <div class="ob-list-item selectable ob-pill-cascade" data-goal="phone" role="checkbox" aria-checked="false" tabindex="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <div class="ob-item-info">
            <span class="ob-item-label">Get Phone Number</span>
            <span class="ob-item-hint">Know when they share their number with you.</span>
          </div>
          <div class="ob-list-item-tick">
            <svg class="ob-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <!-- Social Media Goal -->
        <div class="ob-list-item selectable ob-pill-cascade" data-goal="social" role="checkbox" aria-checked="false" tabindex="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          </svg>
          <div class="ob-item-info">
            <span class="ob-item-label">Get Social Media</span>
            <span class="ob-item-hint">Connect on Instagram, WhatsApp, or Telegram.</span>
          </div>
          <div class="ob-list-item-tick">
            <svg class="ob-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <!-- Never Stop Goal -->
        <div class="ob-list-item selectable ob-pill-cascade" data-goal="never_stop" role="checkbox" aria-checked="false" tabindex="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"></path>
          </svg>
          <div class="ob-item-info">
            <span class="ob-item-label">Keep Engaging</span>
            <span class="ob-item-hint">Auto-chat stays active without stopping.</span>
          </div>
          <div class="ob-list-item-tick">
            <svg class="ob-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>
    `;

    // Bind pill toggle handlers
    const pills = container.querySelectorAll('.ob-pill-cascade');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        this._toggleGoal(pill, controller);
      });
    });
  },

  _toggleGoal(pill, controller) {
    const goalId = pill.dataset.goal;
    const isSelected = pill.classList.contains('selected');
    const container = pill.parentElement;

    if (isSelected) {
      // Deselect
      pill.classList.remove('selected');
      pill.setAttribute('aria-checked', 'false');
      controller.selections.goals = controller.selections.goals.filter(g => g !== goalId);
    } else {
      // Logic for mutual exclusivity
      if (goalId === 'never_stop') {
        // If "Keep Engaging" is picked, clear everything else
        controller.selections.goals = [goalId];
        container.querySelectorAll('.ob-list-item').forEach(item => {
          item.classList.remove('selected');
          item.setAttribute('aria-checked', 'false');
        });
      } else {
        // If a specific goal is picked, remove "Keep Engaging"
        controller.selections.goals = controller.selections.goals.filter(g => g !== 'never_stop');
        const neverStopPill = container.querySelector('[data-goal="never_stop"]');
        if (neverStopPill) {
          neverStopPill.classList.remove('selected');
          neverStopPill.setAttribute('aria-checked', 'false');
        }

        // Max 3 limit for specific goals
        if (controller.selections.goals.length >= 3) {
          return; // Don't add more
        }
        controller.selections.goals.push(goalId);
      }

      // Select and animate
      pill.classList.add('selected');
      pill.setAttribute('aria-checked', 'true');

      // Pop animation
      pill.classList.remove('ob-selection-pop');
      requestAnimationFrame(() => {
        pill.classList.add('ob-selection-pop');
      });
    }

    controller.updateContinueState();
  },

  onEnter(container) {
    // Stagger titles
    const titleItems = container.querySelectorAll('.ob-stagger-item');
    titleItems.forEach((item, index) => {
      item.classList.remove('visible');
      setTimeout(() => {
        item.classList.add('visible');
      }, 80 + (index * 80));
    });

    // Cascade pills
    const pills = container.querySelectorAll('.ob-pill-cascade');
    pills.forEach((pill, index) => {
      pill.classList.remove('visible');
      setTimeout(() => {
        pill.classList.add('visible');
      }, 200 + (index * 60));
    });
  },

  validate(controller) {
    return controller.selections.goals.length > 0;
  }
};
