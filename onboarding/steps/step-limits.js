/* ================================================================
   Step 4 — Set Your Limits
   Slider controls for daily swipes and messages per session
   ================================================================ */

const StepLimits = {

  render(container, controller) {
    container.classList.add('ob-step-compact');
    
    // Helper to get initial display values
    const currentFreq = controller.selections.limits.frequency;
    const currentTone = controller.selections.style;
    
    const freqLabel = { 30: 'Every 30m', 60: 'Every Hour', 120: 'Every 2 Hours' }[currentFreq] || 'Every 30m';
    const toneLabel = { 
      'freestyle': 'Freestyle', 
      'serious': 'Serious', 
      'flirty': 'Flirty', 
      'confident': 'Confident', 
      'gentle': 'Gentle' 
    }[currentTone] || 'Freestyle';

    container.innerHTML = `
      <h1 class="ob-step-title ob-stagger-item">Behavior & Style</h1>
      <p class="ob-step-subtitle ob-stagger-item">
        Set the personality and pace for your AI-Wingman to ensure every chat feels natural and safe.
      </p>
      
      <div class="ob-settings-group ob-stagger-item">
        <!-- Frequency Select -->
        <div class="ob-settings-row">
          <div class="ob-settings-info">
            <span class="ob-settings-label">Activity Frequency</span>
            <span class="ob-settings-hint">How often the AI likes profiles and checks for new replies.</span>
          </div>
          <div class="ob-dropdown" id="freqDropdown" data-type="frequency">
            <div class="ob-dropdown-trigger">
              <span class="ob-dropdown-text">${freqLabel}</span>
              <svg class="ob-dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            <div class="ob-dropdown-menu">
              <div class="ob-dropdown-option ${currentFreq === 30 ? 'selected' : ''}" data-value="30">Every 30m</div>
              <div class="ob-dropdown-option ${currentFreq === 60 ? 'selected' : ''}" data-value="60">Every Hour</div>
              <div class="ob-dropdown-option ${currentFreq === 120 ? 'selected' : ''}" data-value="120">Every 2 Hours</div>
            </div>
          </div>
        </div>

        <!-- Personality Select -->
        <div class="ob-settings-row">
          <div class="ob-settings-info">
            <span class="ob-settings-label">AI Personality</span>
            <span class="ob-settings-hint">Ensures every message matches your chosen "vibe."</span>
          </div>
          <div class="ob-dropdown" id="toneDropdown" data-type="style">
            <div class="ob-dropdown-trigger">
              <span class="ob-dropdown-text">${toneLabel}</span>
              <svg class="ob-dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            <div class="ob-dropdown-menu">
              <div class="ob-dropdown-option ${currentTone === 'freestyle' ? 'selected' : ''}" data-value="freestyle">Freestyle</div>
              <div class="ob-dropdown-option ${currentTone === 'serious' ? 'selected' : ''}" data-value="serious">Serious</div>
              <div class="ob-dropdown-option ${currentTone === 'flirty' ? 'selected' : ''}" data-value="flirty">Flirty</div>
              <div class="ob-dropdown-option ${currentTone === 'confident' ? 'selected' : ''}" data-value="confident">Confident</div>
              <div class="ob-dropdown-option ${currentTone === 'gentle' ? 'selected' : ''}" data-value="gentle">Gentle</div>
            </div>
          </div>
        </div>

        <!-- Safe Mode Toggle -->
        <div class="ob-settings-row">
          <div class="ob-settings-info">
            <span class="ob-settings-label">Smart Protection</span>
            <span class="ob-settings-hint" id="safeModeHint">Reduces detection risk by enforcing safe, human-like activity limits.</span>
          </div>
          <label class="ob-toggle-switch">
            <input type="checkbox" id="safeModeToggle" ${controller.selections.limits.safeMode ? 'checked' : ''}>
            <span class="ob-toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="ob-limits-footer-text ob-stagger-item">
        You can fine-tune these anytime in the Settings.
      </div>
    `;


    // Initialize Dropdown Logic
    this._initDropdowns(container, controller);

    // Bind Toggle Switch logic
    const safeEl = document.getElementById('safeModeToggle');
    const safeHint = document.getElementById('safeModeHint');
    
    safeEl.addEventListener('change', () => {
      controller.selections.limits.safeMode = safeEl.checked;
      
      if (safeEl.checked) {
        safeHint.innerHTML = 'Reduces detection risk by enforcing safe, human-like activity limits.';
        safeHint.style.color = 'var(--ob-text-secondary)';
      } else {
        safeHint.innerHTML = '<strong>Warning:</strong> Limits disabled. Highly recommended for maximum account safety.';
        safeHint.style.color = '#FE3C72'; // Tinder red for warning
      }
    });

    // Close dropdowns on background click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ob-dropdown')) {
        container.querySelectorAll('.ob-dropdown').forEach(d => d.classList.remove('open'));
      }
    }, { once: true });
  },

  _initDropdowns(container, controller) {
    const dropdowns = container.querySelectorAll('.ob-dropdown');
    
    dropdowns.forEach(dropdown => {
      const trigger = dropdown.querySelector('.ob-dropdown-trigger');
      const text = dropdown.querySelector('.ob-dropdown-text');
      const options = dropdown.querySelectorAll('.ob-dropdown-option');
      const type = dropdown.dataset.type;

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        
        // Close others
        dropdowns.forEach(d => d.classList.remove('open'));
        
        if (!isOpen) {
          dropdown.classList.add('open');
        }
      });

      options.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = option.dataset.value;
          
          // Update visual
          text.textContent = option.textContent;
          options.forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          
          // Update controller
          if (type === 'frequency') {
            controller.selections.limits.frequency = parseInt(val, 10);
          } else {
            controller.selections.style = val;
          }

          dropdown.classList.remove('open');
        });
      });
    });
  },

  onEnter(container) {
    const items = container.querySelectorAll('.ob-stagger-item');
    items.forEach((item, index) => {
      item.classList.remove('visible');
      setTimeout(() => {
        item.classList.add('visible');
      }, 50 + (index * 100)); // Snappier entry
    });
  },

  validate() {
    return true;
  }
};

