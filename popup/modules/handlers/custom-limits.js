async function handleCustomLimits() {
  const current = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getCustomRateLimits' }, resolve);
  });

  return new Promise((resolve) => {
    const portal = document.createElement('div');
    portal.className = 'modal-portal';

    portal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-container">
        <div class="modal-header">
          <div class="modal-icon-box" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); color: #f59e0b;">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="modal-title">Custom Rate Limits</div>
        </div>
        <div class="modal-body">
          <div class="modal-message" style="margin-bottom: 16px;">Set how many likes and messages the agent can send per hour. Default is 50 each.</div>
          <div class="modal-input-group">
            <label class="modal-input-label">Likes per hour</label>
            <input type="number" id="customLikesLimit" class="modal-input" min="1" max="999" value="${current.likesPerHour}">
          </div>
          <div class="modal-input-group">
            <label class="modal-input-label">Messages per hour</label>
            <input type="number" id="customMessagesLimit" class="modal-input" min="1" max="999" value="${current.messagesPerHour}">
          </div>
          <div class="modal-warning">
            <svg viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px; flex-shrink: 0;">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Setting values too high may trigger a shadowban on your account.
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-cancel" id="modalCancel">Cancel</button>
          <button class="modal-btn modal-btn-confirm" id="modalConfirm" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">Save Limits</button>
        </div>
      </div>
    `;

    document.body.appendChild(portal);
    requestAnimationFrame(() => portal.classList.add('active'));

    const cleanUp = () => {
      portal.classList.remove('active');
      setTimeout(() => portal.remove(), 400);
    };

    portal.querySelector('#modalCancel').addEventListener('click', () => {
      cleanUp();
      resolve();
    });

    portal.querySelector('#modalConfirm').addEventListener('click', async () => {
      const likes = parseInt(document.getElementById('customLikesLimit').value) || 50;
      const messages = parseInt(document.getElementById('customMessagesLimit').value) || 50;

      await new Promise((res) => {
        chrome.runtime.sendMessage({
          action: 'setCustomRateLimits',
          likesPerHour: likes,
          messagesPerHour: messages
        }, res);
      });

      cleanUp();
      showMessage(`Custom limits set: ${likes} likes / ${messages} messages per hour`, 'success');
      await loadSettings();
      await updateStatus();
      updatePriorityPreview();
      resolve();
    });

    portal.querySelector('.modal-overlay').addEventListener('click', () => {
      cleanUp();
      resolve();
    });
  });
}
