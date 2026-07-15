// Toggle console output (set to false for production)
const DEBUG_MODE = false;
const log = (...args) => DEBUG_MODE && console.log(...args);
const warn = (...args) => console.warn(...args);
const error = (...args) => console.error(...args);

function findChatInput() {
  if (!window.SELECTORS) {
    warn('[FlirtEasy] Selectors not loaded for findChatInput');
    return null;
  }
  const el = findElement(window.SELECTORS.messaging.input);
  if (!el) {
    try { chrome.runtime.sendMessage({ action: 'reportDomError', payload: { platform: 'tinder', error_type: 'selector_miss', selector_key: 'messaging.input', error_message: 'Chat input field not found — Tinder may have changed its messaging UI', page_url: location.href } }); } catch (_) {}
  }
  return el;
}

function findSendButton() {
  if (!window.SELECTORS) {
    warn('[FlirtEasy] Selectors not loaded for findSendButton');
    return null;
  }
  const el = findElement(window.SELECTORS.messaging.sendButton);
  if (!el) {
    try { chrome.runtime.sendMessage({ action: 'reportDomError', payload: { platform: 'tinder', error_type: 'selector_miss', selector_key: 'messaging.sendButton', error_message: 'Send button not found — Tinder may have changed its messaging UI', page_url: location.href } }); } catch (_) {}
  }
  return el;
}

function insertMessage(text) {
  const input = findChatInput();

  if (!input) {
    error('[FlirtEasy] Chat input not found');
    return false;
  }

  if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeInputSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeInputSetter) {
      nativeInputSetter.call(input, text);
    } else {
      input.value = text;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

  } else if (input.hasAttribute('contenteditable') || input.getAttribute('role') === 'textbox') {
    input.focus();
    input.textContent = '';
    const inserted = document.execCommand('insertText', false, text);
    if (!inserted) {
      input.textContent = text;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return true;
}

function clickSendButton() {
  const sendBtn = findSendButton();

  if (!sendBtn) {
    console.error('[FlirtEasy] Send button not found');
    return false;
  }

  if (sendBtn.disabled) {
    console.warn('[FlirtEasy] Send button is disabled');
    return false;
  }

  sendBtn.click();
  return true;
}

async function sendMessage(message) {
  console.log('[FlirtEasy] Attempting to send message:', message);

  if (!navigator.onLine) {
    console.warn('[FlirtEasy] Network offline — aborting send');
    return { success: false, networkOffline: true, error: 'Network offline' };
  }

  // Strip prefixes like "You:", "null:", "Name:" from the message
  let cleanMessage = message;
  const prefixPattern = /^(You|null|[A-Z][a-z]+):\s*/;
  if (prefixPattern.test(cleanMessage)) {
    cleanMessage = cleanMessage.replace(prefixPattern, '');
    console.log('[FlirtEasy] Stripped prefix, clean message:', cleanMessage);
  }

  const inserted = insertMessage(cleanMessage);
  if (!inserted) {
    return { success: false, error: 'Failed to insert message into input field' };
  }

  await wait(1000); // Increased from 500

  const sent = clickSendButton();
  if (!sent) {
    return { success: false, error: 'Failed to click send button' };
  }

  await wait(1500);

  console.log('[FlirtEasy] Message sent successfully');
  return { success: true };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


