/**
 * Modular Modal System
 * Provides high-fidelity alternatives to window.alert and window.confirm
 */

const ModalSystem = {
  /**
   * Shows a premium confirmation modal
   * @param {string} title - Modal title
   * @param {string} message - Modal body message (supports \n for line breaks)
   * @param {string} confirmText - Label for confirm button
   * @returns {Promise<boolean>}
   */
  confirm: async (title, message, confirmText = 'Confirm') => {
    return new Promise((resolve) => {
      const portal = document.createElement('div');
      portal.className = 'modal-portal';

      // Convert \n to <br> so structured messages render properly
      const formattedMessage = message.replace(/\n/g, '<br>');

      portal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-container">
          <div class="modal-header">
            <div class="modal-icon-box">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="modal-title">${title}</div>
          </div>
          <div class="modal-body">
            <div class="modal-message">${formattedMessage}</div>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn-cancel" id="modalCancel">Cancel</button>
            <button class="modal-btn modal-btn-confirm" id="modalConfirm">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(portal);

      // Trigger animation
      requestAnimationFrame(() => portal.classList.add('active'));

      const cleanUp = (result) => {
        portal.classList.remove('active');
        setTimeout(() => {
          portal.remove();
          resolve(result);
        }, 400);
      };

      portal.querySelector('#modalConfirm').addEventListener('click', () => cleanUp(true));
      portal.querySelector('#modalCancel').addEventListener('click', () => cleanUp(false));
      portal.querySelector('.modal-overlay').addEventListener('click', () => cleanUp(false));
    });
  }
};

window.ModalSystem = ModalSystem;
