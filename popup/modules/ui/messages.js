// Message display functions

function _getNotificationPortal() {
  let portal = document.getElementById('notificationPortal');
  if (!portal) {
    portal = document.createElement('div');
    portal.id = 'notificationPortal';
    document.body.appendChild(portal);
  }
  return portal;
}

function _dismissNotification(el, delay = 3700) {
  setTimeout(() => {
    if (!el.parentElement) return;
    el.style.animation = 'messageSlideOut 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    setTimeout(() => el.remove(), 300);
  }, delay);
}

function showMessage(message, type) {
  document.querySelectorAll('.message, .persistent-warning, .persistent-success').forEach(el => el.remove());

  const isError = type === 'error';
  const clean = message.replace(/^[✗✓×✔✕✖⚠️⚠\s]+/, '').trim();

  const iconSVG = isError
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`;

  let textHTML;
  if (isError && clean.includes(': ')) {
    const colonIdx = clean.indexOf(': ');
    const title = clean.slice(0, colonIdx + 1);
    const subtitle = clean.slice(colonIdx + 2);
    textHTML = `<div class="message-text"><div class="message-title">${title}</div><div class="message-subtitle">${subtitle}</div></div>`;
  } else {
    textHTML = `<span class="message-text">${clean}</span>`;
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `<div class="message-icon">${iconSVG}</div>${textHTML}`;

  _getNotificationPortal().appendChild(messageDiv);
  _dismissNotification(messageDiv, 3700);
}

function showPersistentWarning(message) {
  if (document.querySelector('.persistent-warning')) return;

  const warningDiv = document.createElement('div');
  warningDiv.className = 'persistent-warning';
  warningDiv.innerHTML = `
    <div class="persistent-warning-content">
      <span class="persistent-warning-text">${message}</span>
      <button class="persistent-warning-close">×</button>
    </div>
    <div class="persistent-warning-progress"></div>
  `;

  _getNotificationPortal().appendChild(warningDiv);

  warningDiv.querySelector('.persistent-warning-close').addEventListener('click', () => {
    warningDiv.remove();
  });

  _dismissNotification(warningDiv, 5000);
}

function showPersistentSuccess(message) {
  if (document.querySelector('.persistent-success')) return;

  const successDiv = document.createElement('div');
  successDiv.className = 'persistent-success';
  successDiv.innerHTML = `
    <div class="persistent-success-content">
      <span class="persistent-success-text">${message}</span>
      <button class="persistent-success-close">×</button>
    </div>
    <div class="persistent-success-progress"></div>
  `;

  _getNotificationPortal().appendChild(successDiv);

  successDiv.querySelector('.persistent-success-close').addEventListener('click', () => {
    successDiv.remove();
  });

  _dismissNotification(successDiv, 3000);
}

function showConfirmModal(title, message, icon, confirmText) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'risk-modal';
    modal.innerHTML = `
      <div class="confirm-modal-content">
        <div class="confirm-modal-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="risk-modal-buttons">
          <button class="risk-btn risk-btn-cancel">Cancel</button>
          <button class="risk-btn confirm-btn-primary">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.risk-btn-cancel').addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });

    modal.querySelector('.confirm-btn-primary').addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    });
  });
}
