/* ================================================================
   Step 2 — Which App Are You On?
   Single-select platform picker (Tinder / Bumble)
   ================================================================ */

const StepPlatform = {

  render(container, controller) {
    container.innerHTML = `
      <h1 class="ob-step-title ob-stagger-item">Which app are you on?</h1>
      <p class="ob-step-subtitle ob-stagger-item">
        FlirtEasy works directly inside these apps.
      </p>

      <div class="ob-list ob-stagger-item">
        <!-- Tinder Option -->
        <div class="ob-list-item selectable" data-platform="tinder" role="radio" aria-checked="false" tabindex="0">
          <img src="../icons/tinder.jpg" alt="Tinder">
          <span>Tinder</span>
          <div class="ob-list-item-tick">
            <svg class="ob-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <!-- Bumble Option -->
        <div class="ob-list-item selectable" data-platform="bumble" role="radio" aria-checked="false" tabindex="0">
          <img src="../icons/bumble.png" alt="Bumble">
          <span>Bumble</span>
          <div class="ob-list-item-tick">
            <svg class="ob-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>
    `;

    // Bind selection handlers
    const items = container.querySelectorAll('.ob-list-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        this._selectPlatform(item, items, controller);
      });

      // Keyboard accessibility
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._selectPlatform(item, items, controller);
        }
      });
    });
  },

  _selectPlatform(selectedCard, allCards, controller) {
    const platform = selectedCard.dataset.platform;

    // Deselect all
    allCards.forEach(card => {
      card.classList.remove('selected', 'ob-selection-pop');
      card.setAttribute('aria-checked', 'false');
    });

    // Select clicked
    selectedCard.classList.add('selected');
    selectedCard.setAttribute('aria-checked', 'true');

    // Trigger pop animation
    requestAnimationFrame(() => {
      selectedCard.classList.add('ob-selection-pop');
    });

    // Update controller state
    controller.selections.platform = platform;
    controller.updateContinueState();

    // Persist immediately so Connected Platforms in Settings reflects the choice
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ preferredPlatform: platform });
    }
  },

  onEnter(container) {
    const items = container.querySelectorAll('.ob-stagger-item');
    items.forEach((item, index) => {
      item.classList.remove('visible');
      setTimeout(() => {
        item.classList.add('visible');
      }, 80 + (index * 100));
    });
  },

  validate(controller) {
    return controller.selections.platform !== null;
  }
};
