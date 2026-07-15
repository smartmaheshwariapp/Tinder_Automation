/**
 * Schedule UI Module
 * Handles the frequency slider, presets, and timeline visualization
 */
function initializeScheduleUI() {
    const input = document.getElementById('scheduleInterval');
    const slider = document.getElementById('scheduleSlider');
    const fill = document.getElementById('scheduleSliderFill');
    const presetBtns = document.querySelectorAll('.schedule-preset-btn');
    const timeline = document.getElementById('scheduleTimeline');
    const runsLabel = document.getElementById('runsPerDayLabel');

    if (!input || !slider || !fill) return;

    const SLIDER_MIN = 10;
    const SLIDER_MAX = 1440;

    function updateTimeline(minutes) {
        if (!timeline) return;
        timeline.innerHTML = '';

        const runsPerDay = Math.floor(1440 / minutes);
        if (runsLabel) runsLabel.textContent = runsPerDay;

        // Limit markers to prevent DOM bloat if someone sets a very small interval
        const displayCount = Math.min(runsPerDay, 48);

        // Add markers for each run in a 24h window
        for (let i = 0; i < displayCount; i++) {
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            const position = (i * minutes / 1440) * 100;
            marker.style.left = `${position}%`;
            timeline.appendChild(marker);
        }
    }

    function syncUI(value, triggerChange = true) {
        const val = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, parseInt(value) || 120));
        input.value = val;
        slider.value = val;

        const pct = ((val - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
        fill.style.width = `${pct}%`;

        // Update presets
        presetBtns.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.value) === val);
        });

        updateTimeline(val);

        // Trigger validation and dependencies
        if (typeof validateRateLimits === 'function') validateRateLimits();
        if (typeof updatePriorityPreview === 'function') updatePriorityPreview();

        if (triggerChange && typeof markAsChanged === 'function') {
            markAsChanged();
        }
    }

    slider.addEventListener('input', () => {
        syncUI(slider.value);
    });

    input.addEventListener('change', () => {
        syncUI(input.value);
    });

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            syncUI(btn.dataset.value);
        });
    });

    // Guide toggle (matching standard pattern)
    setupGuideToggle('showScheduleGuide', 'scheduleGuideWrapper');
    setupGuideToggle('showActiveHoursGuide', 'activeHoursGuideWrapper');

    // Initial syncs
    setTimeout(() => {
        syncUI(input.value, false);
        if (typeof updateActiveHoursHint === 'function') updateActiveHoursHint();
    }, 50);
}

function setupGuideToggle(btnId, wrapperId) {
    const btn = document.getElementById(btnId);
    const wrapper = document.getElementById(wrapperId);

    if (!btn || !wrapper) return;

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

    btn.onclick = (e) => {
        e.stopPropagation();
        if (!wrapper.classList.contains('expanded')) {
            openGuide();
        } else {
            closeGuide();
        }
    };
}

// Export to window
window.initializeScheduleUI = initializeScheduleUI;
