// Data management handlers
async function handleResetLimits() {
  const confirmed = await window.ModalSystem.confirm(
    'Reset Rate Limits',
    'This will reset your hourly like and message counters back to zero, allowing you to resume swiping and messaging immediately. Your settings and stats will not be affected.',
    'Reset Limits'
  );

  if (confirmed) {
    chrome.runtime.sendMessage({ action: 'resetLimits' }, (response) => {
      if (response && response.success) {
        showMessage('Rate limits reset!', 'success');
        updateStatus();
      }
    });
  }
}

async function handleClearData() {
  const confirmed = await window.ModalSystem.confirm(
    'Clear All Data',
    'This will permanently erase everything and cannot be undone:\n\n• All saved settings and preferences\n• Achievement progress and unlocked badges\n• Automation history and session logs\n• Lifetime stats (swipes, messages, matches)\n• Account session\n\nYou will need to log in and set up again from scratch.',
    'Erase Everything'
  );

  if (confirmed) {
    console.log('[Clear Data] User confirmed, clearing all data...');
    // Clear everything
    await clearAllData();
    // Prevent auto-migration after clear
    await chrome.storage.local.set({ hasManuallyCleared: true });
    console.log('[Clear Data] All data cleared. User must re-login.');
    showMessage('Data cleared! Please log in again.', 'success');
    // Wait a moment for message to show, then reload
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}

function showCycleRunningWarning() {
  getAgentState().then(state => {
    const modal = document.createElement('div');
    modal.className = 'risk-modal';
    modal.id = 'cycleRunningModal';

    const isBumble = window.CURRENT_PLATFORM === 'Bumble';
    const platformName = isBumble ? 'Bumble' : 'Tinder';

    const phaseText = {
      'checking': `Checking ${platformName}`,
      'connecting': 'Connecting',
      'initializing': 'Initializing',
      'starting': 'Starting cycle',
      'liking': 'Liking profiles',
      'processing': 'Processing chats',
      'messaging': 'Sending messages'
    };

    const currentPhase = phaseText[state.currentPhase] || 'Running';

    modal.innerHTML = `
      <div class="risk-modal-content">
        <div class="risk-modal-header">
          <div class="risk-modal-icon-wrap">
            <svg class="risk-clock-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h3 class="risk-modal-title">Cycle Currently Running</h3>
          <p class="risk-modal-subtitle">Cannot save settings while a cycle is active.</p>
        </div>
        <div class="risk-modal-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0 2px;">
            <div>
              <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Current Status</div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="risk-status-dot"></span>
                <span style="font-size:14px;font-weight:600;color:#e91e8c;">${currentPhase}</span>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Next Run In</div>
              <div style="font-size:16px;font-weight:800;color:#1f2937;" id="modalCountdown">—</div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;">
            <svg style="flex-shrink:0;margin-top:1px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style="font-size:12px;color:#374151;line-height:1.5;margin:0;">Please wait for the cycle to complete or <strong>stop the agent</strong>.</p>
          </div>
          <div class="risk-modal-buttons">
            <button class="risk-btn risk-btn-cancel" id="modalWaitBtn">Wait</button>
            <button class="risk-btn risk-btn-confirm" id="modalStopBtn">Stop Agent</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = (callback) => {
      modal.classList.add('closing');
      setTimeout(() => {
        modal.remove();
        if (callback) callback();
      }, 220);
    };

    // Update countdown every second
    const countdownInterval = setInterval(() => {
      getAgentState().then(updatedState => {
        const countdownEl = document.getElementById('modalCountdown');
        if (!countdownEl) {
          clearInterval(countdownInterval);
          return;
        }

        if (!updatedState.currentPhase) {
          clearInterval(countdownInterval);
          closeModal(() => showMessage('Cycle completed! You can now save settings.', 'success'));
          return;
        }

        if (updatedState.nextRunTimestamp) {
          const nextRun = new Date(updatedState.nextRunTimestamp);
          const now = new Date();
          const diffMs = nextRun - now;
          const diffMinutes = Math.floor(diffMs / 60000);
          const diffSeconds = Math.floor((diffMs % 60000) / 1000);

          if (diffMinutes > 0) {
            countdownEl.textContent = `${diffMinutes}m ${diffSeconds}s`;
          } else if (diffSeconds > 0) {
            countdownEl.textContent = `${diffSeconds}s`;
          } else {
            countdownEl.textContent = 'Soon';
          }
        }
      });
    }, 1000);

    modal.querySelector('#modalWaitBtn').addEventListener('click', () => {
      clearInterval(countdownInterval);
      closeModal();
    });

    modal.querySelector('#modalStopBtn').addEventListener('click', () => {
      clearInterval(countdownInterval);
      closeModal(() => {
        handleStop();
        setTimeout(() => showMessage('Agent stopped. You can now save settings.', 'success'), 500);
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        clearInterval(countdownInterval);
        closeModal();
      }
    });
  });
}
