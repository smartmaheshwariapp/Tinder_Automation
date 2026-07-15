/**
 * distance-filter-v2.js
 * Modular handler for the V2 Distance Range Filter section.
 * Owns: UI injection, floating label, toggle-driven collapse animation,
 *       and sync with the legacy distanceFilterEnabled checkbox.
 *
 * Called by: AutomationViews.init() → DistanceFilterV2.init()
 */

const DistanceFilterV2 = {

  init() {
    const distanceSection = document.getElementById('distanceFilterSectionContent')?.closest('.section');
    const distanceSettings = document.getElementById('distanceFilterSettings');
    const distanceInput = document.getElementById('maxDistance');
    const legacyToggle = document.getElementById('distanceFilterEnabled');

    if (!distanceSection || !distanceSettings || !distanceInput || !legacyToggle) return;

    this._injectRow(distanceSettings);
    this._injectFloatingLabel(distanceSettings);
    this._bindSlider(distanceSettings, distanceInput);
    this._cleanLimitsDiv(distanceSettings);
    this._bindToggle(distanceSettings, distanceInput, legacyToggle);
  },

  // ── Row: "Distance Range  [toggle]" ───────────────────────────────────────
  _injectRow(distanceSettings) {
    if (distanceSettings.querySelector('.automation-v2-distance-row')) return;
    const row = document.createElement('div');
    row.className = 'automation-v2-distance-row';
    row.innerHTML = `
      <span class="automation-v2-distance-label">Distance Range</span>
      <label class="automation-v2-goal-switch" aria-label="Enable Distance Filter">
        <input type="checkbox" id="automationDistanceFilterToggle">
        <span class="automation-v2-goal-switch-slider"></span>
      </label>
    `;
    distanceSettings.insertBefore(row, distanceSettings.firstChild);
  },

  // ── Floating "Up to X km" bubble above the slider thumb ───────────────────
  _injectFloatingLabel(distanceSettings) {
    const sliderContainer = distanceSettings.querySelector('.range-slider-container');
    if (!sliderContainer || sliderContainer.querySelector('.automation-v2-distance-floating-label')) return;
    const label = document.createElement('div');
    label.className = 'automation-v2-distance-floating-label';
    label.id = 'automationDistanceValue';
    label.textContent = 'Up to 50 km';
    sliderContainer.appendChild(label);
  },

  // ── Slider value + clamped label position ─────────────────────────────────
  _bindSlider(distanceSettings, distanceInput) {
    const slider = distanceSettings.querySelector('.range-slider');

    const updateValue = () => {
      const distance = parseInt(distanceInput.value, 10);
      const safeDistance = Number.isFinite(distance) ? distance : 50;
      const valueEl = document.getElementById('automationDistanceValue');
      if (!valueEl) return;

      valueEl.textContent = `Up to ${safeDistance} km`;

      // Clear the cached applied value so the next save re-applies the new distance
      chrome.storage.local.remove('lastAppliedDistance');

      const sliderEl = distanceSettings.querySelector('.range-slider');
      const min = parseFloat(sliderEl?.min) || 2;
      const max = parseFloat(sliderEl?.max) || 10000;
      const rawPct = ((safeDistance - min) / (max - min)) * 100;
      const containerWidth = sliderEl?.offsetWidth || valueEl.parentElement?.offsetWidth || 200;
      const labelWidth = valueEl.offsetWidth || 70;
      const halfLabelPct = (labelWidth / 2 / containerWidth) * 100;
      valueEl.style.left = `${Math.min(Math.max(rawPct, halfLabelPct), 100 - halfLabelPct)}%`;
    };

    const showLabel = () => document.getElementById('automationDistanceValue')?.classList.add('visible');
    const hideLabel = () => document.getElementById('automationDistanceValue')?.classList.remove('visible');

    updateValue();

    if (slider) {
      slider.addEventListener('mousedown', showLabel);
      slider.addEventListener('touchstart', showLabel);
      slider.addEventListener('mouseup', hideLabel);
      slider.addEventListener('touchend', hideLabel);
      slider.addEventListener('input', updateValue);
    }

    distanceInput.addEventListener('input', updateValue);
    distanceInput.addEventListener('change', updateValue);
  },

  // ── Clean up legacy inline-styled limits div ───────────────────────────────
  _cleanLimitsDiv(distanceSettings) {
    const limitsDiv = distanceSettings.querySelector('div[style*="justify-content:space-between"]');
    if (limitsDiv) {
      limitsDiv.className = 'automation-v2-distance-limits';
      limitsDiv.removeAttribute('style');
    }
    const applyButton = document.getElementById('applyDistanceBtn');
    if (applyButton) {
      applyButton.removeAttribute('style');
      applyButton.className = 'automation-v2-apply-btn';
    }
  },

  // ── Toggle: syncs with legacy checkbox + animates inner wrap ──────────────
  _bindToggle(distanceSettings, distanceInput, legacyToggle) {
    const newToggle = document.getElementById('automationDistanceFilterToggle');
    if (!newToggle || newToggle.dataset.bound) return;
    newToggle.dataset.bound = '1';
    newToggle.checked = legacyToggle.checked;

    // Wrap slider content (everything below the row) in distance-inner-wrap
    if (!distanceSettings.querySelector('.distance-inner-wrap')) {
      const innerWrap = document.createElement('div');
      innerWrap.className = 'distance-inner-wrap';
      const row = distanceSettings.querySelector('.automation-v2-distance-row');
      Array.from(distanceSettings.childNodes)
        .filter(n => n !== row)
        .forEach(n => innerWrap.appendChild(n));
      distanceSettings.appendChild(innerWrap);
    }

    const innerWrap = distanceSettings.querySelector('.distance-inner-wrap');

    const animate = (isEnabled) => {
      if (!innerWrap) return;
      if (isEnabled) {
        innerWrap.style.overflow = 'hidden';
        innerWrap.style.opacity = '0';
        innerWrap.style.transition = 'none';
        innerWrap.style.marginTop = '8px';
        innerWrap.style.paddingBottom = '8px';
        innerWrap.style.height = 'auto';
        const target = innerWrap.scrollHeight + 'px';
        innerWrap.style.height = '0px';
        innerWrap.style.marginTop = '0px';
        innerWrap.style.paddingBottom = '0px';
        void innerWrap.offsetHeight;
        innerWrap.style.transition = 'height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, margin 0.35s ease, padding 0.35s ease';
        innerWrap.style.height = target;
        innerWrap.style.marginTop = '8px';
        innerWrap.style.paddingBottom = '8px';
        innerWrap.style.opacity = '1';
        setTimeout(() => {
          innerWrap.style.transition = '';
          innerWrap.style.overflow = 'visible';
        }, 360);
      } else {
        innerWrap.style.overflow = 'hidden';
        innerWrap.style.height = innerWrap.scrollHeight + 'px';
        void innerWrap.offsetHeight;
        innerWrap.style.transition = 'height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, margin 0.35s ease, padding 0.35s ease';
        innerWrap.style.height = '0px';
        innerWrap.style.marginTop = '0px';
        innerWrap.style.paddingBottom = '0px';
        innerWrap.style.opacity = '0';
        setTimeout(() => { innerWrap.style.transition = ''; }, 360);
      }
    };

    // Set initial collapsed state
    if (innerWrap && !newToggle.checked) {
      innerWrap.style.height = '0px';
      innerWrap.style.marginTop = '0px';
      innerWrap.style.paddingBottom = '0px';
      innerWrap.style.opacity = '0';
      innerWrap.style.overflow = 'hidden';
    }

    newToggle.addEventListener('change', () => {
      if (legacyToggle.checked !== newToggle.checked) {
        legacyToggle.checked = newToggle.checked;
        legacyToggle.dispatchEvent(new Event('change', { bubbles: true }));
        // Notify AutomationViews if available
        if (window.AutomationViews?._emitInputChange) AutomationViews._emitInputChange(legacyToggle);
        if (window.AutomationViews?.refreshCollapsedChips) AutomationViews.refreshCollapsedChips();
      }
      animate(newToggle.checked);
    });

    legacyToggle.addEventListener('change', () => {
      newToggle.checked = legacyToggle.checked;
      animate(legacyToggle.checked);
      if (window.AutomationViews?.refreshCollapsedChips) AutomationViews.refreshCollapsedChips();
    });
  },
};

window.DistanceFilterV2 = DistanceFilterV2;
