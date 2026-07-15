// Priority Slider System
function setupPriorityGuideListeners() {
  const showGuideBtn = document.getElementById('showPriorityGuide');
  const guideWrapper = document.getElementById('priorityGuideWrapper');

  if (!showGuideBtn || !guideWrapper) return;

  const closeGuide = () => {
    if (!guideWrapper.classList.contains('expanded')) return;
    guideWrapper.classList.remove('expanded');
    setTimeout(() => {
      if (!guideWrapper.classList.contains('expanded')) {
        guideWrapper.classList.remove('show-layout');
      }
    }, 400);
  };

  const openGuide = () => {
    guideWrapper.classList.add('show-layout');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        guideWrapper.classList.add('expanded');
      });
    });
  };

  showGuideBtn.onclick = (e) => {
    e.stopPropagation();
    if (!guideWrapper.classList.contains('expanded')) {
      openGuide();
    } else {
      closeGuide();
    }
  };
}

function initializePrioritySlider() {
  const slider = document.getElementById('prioritySlider');
  const presetBtns = document.querySelectorAll('.priority-preset-btn');
  const sliderFill = document.getElementById('prioritySliderFill');
  const minReplyInput = document.getElementById('minReplySlots');
  const maxNewMatchInput = document.getElementById('maxNewMatchSlots');
  const legendExisting = document.getElementById('legendExisting');
  const legendNew = document.getElementById('legendNew');
  const legendFlexible = document.getElementById('legendFlexible');
  const distBarReplies = document.getElementById('distBarReplies');
  const distBarNew = document.getElementById('distBarNew');
  const distBarFill = document.getElementById('distBarFill');
  const msgCycleLabel = document.getElementById('msgCycleLabel');

  if (!slider) return;

  // Preset configurations
  const presets = {
    nurture: { value: 30, minReply: 70, maxNew: 30 },
    balanced: { value: 50, minReply: 50, maxNew: 50 },
    explorer: { value: 70, minReply: 30, maxNew: 70 }
  };

  // Update queue visualization
  function updateQueueVisualization(sliderValue) {
    const messagesPerCycle = parseInt(document.getElementById('messagesPerCycle')?.value) || 50;

    const newPercent = sliderValue;
    const existingPercent = 100 - sliderValue;

    // Actual message counts with 70% committed cap
    const COMMITTED_MAX = 0.7;
    const existingCount = Math.round((existingPercent / 100) * COMMITTED_MAX * messagesPerCycle);
    const newCount = Math.round((newPercent / 100) * COMMITTED_MAX * messagesPerCycle);
    const flexibleCount = messagesPerCycle - existingCount - newCount;
    const total = existingCount + newCount + flexibleCount;

    // Update stat chips
    if (legendExisting) legendExisting.textContent = existingCount;
    if (legendNew) legendNew.textContent = newCount;
    if (legendFlexible) legendFlexible.textContent = flexibleCount;

    // Update cycle label
    if (msgCycleLabel) msgCycleLabel.textContent = messagesPerCycle;

    // Update segmented bar widths
    if (distBarReplies) distBarReplies.style.width = `${(existingCount / total) * 100}%`;
    if (distBarNew) distBarNew.style.width = `${(newCount / total) * 100}%`;
    if (distBarFill) distBarFill.style.width = `${(flexibleCount / total) * 100}%`;

    // Update slider fill
    if (sliderFill) sliderFill.style.width = `${sliderValue}%`;

    // Update hidden inputs for backward compatibility
    if (minReplyInput) minReplyInput.value = existingPercent;
    if (maxNewMatchInput) maxNewMatchInput.value = newPercent;
  }

  // Handle preset clicks
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (!presets[preset]) return;

      // Update active state
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update slider
      slider.value = presets[preset].value;
      updateQueueVisualization(presets[preset].value);

      // Trigger change tracking
      if (typeof markAsChanged === 'function') {
        markAsChanged();
      }
    });
  });

  // Handle slider input
  slider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    updateQueueVisualization(value);

    // Remove active state from presets if manually adjusted
    const matchingPreset = Object.entries(presets).find(([_, config]) => config.value === value);
    presetBtns.forEach(btn => {
      if (matchingPreset && btn.dataset.preset === matchingPreset[0]) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  });

  // Handle slider change (when user releases)
  slider.addEventListener('change', () => {
    if (typeof markAsChanged === 'function') {
      markAsChanged();
    }
  });

  // Re-render when messages per cycle changes
  document.getElementById('messagesPerCycle')?.addEventListener('input', () => {
    updateQueueVisualization(parseInt(slider.value));
  });

  // Initialize
  setupPriorityGuideListeners();

  // Load saved value or default to balanced
  const rawSavedMin = parseInt(minReplyInput?.value);
  const rawSavedMax = parseInt(maxNewMatchInput?.value);
  const savedMinReply = isNaN(rawSavedMin) ? 30 : rawSavedMin;
  const savedMaxNew = isNaN(rawSavedMax) ? 70 : rawSavedMax;

  // Calculate slider value from saved percentages
  // If minReply is high, slider should be low (more existing)
  // If maxNew is high, slider should be high (more new)
  const sliderValue = savedMaxNew;
  slider.value = sliderValue;

  // Set active preset if it matches
  const matchingPreset = Object.entries(presets).find(([_, config]) =>
    config.minReply === savedMinReply && config.maxNew === savedMaxNew
  );
  if (matchingPreset) {
    const presetBtn = document.querySelector(`[data-preset="${matchingPreset[0]}"]`);
    if (presetBtn) presetBtn.classList.add('active');
  }

  updateQueueVisualization(sliderValue);
}

// Export for use in main popup
if (typeof window !== 'undefined') {
  window.initializePrioritySlider = initializePrioritySlider;
}
