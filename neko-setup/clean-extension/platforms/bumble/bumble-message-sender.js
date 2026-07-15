/**
 * Bumble Message Sender
 * Handles sending messages in Bumble chats
 */

const BUMBLE_DEBUG_MODE = false;
const bumbleLog = (...args) => BUMBLE_DEBUG_MODE && console.log('[Bumble]', ...args);
const bumbleError = (...args) => console.error('[Bumble]', ...args);

function insertBumbleMessage(text) {
    const input = findBumbleChatInput();

    if (!input) {
        bumbleError('Chat input not found');
        return false;
    }

    // Production Strategy: Hard-write + Event Sync
    console.log('[FlirtEasy] Inserting message via force-populate');
    input.focus();

    // Clear and Write
    input.innerText = text;

    // Trigger Input events for React/Vue listeners
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    // Fallback Verification
    if (input.innerText !== text && input.textContent !== text) {
        console.warn('[FlirtEasy] InnerText write failed, trying textContent');
        input.textContent = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return true;
}

function clickBumbleSendButton() {
    const sendBtn = findBumbleSendButton();

    if (!sendBtn) {
        bumbleError('Send button not found');
        return false;
    }

    // Force Enable (Strip disabled attribute)
    if (sendBtn.disabled || sendBtn.hasAttribute('disabled')) {
        console.log('[FlirtEasy] Force-enabling send button');
        sendBtn.removeAttribute('disabled');
        sendBtn.disabled = false;
    }

    // Dispatch Click
    console.log('[FlirtEasy] Clicking send button');
    sendBtn.click();

    return true;
}

async function sendBumbleMessage(message) {
    console.log('[FlirtEasy] Preparing message send:', message.substring(0, 30) + '...');

    if (!navigator.onLine) {
        console.warn('[FlirtEasy] Network offline — aborting send');
        return { success: false, networkOffline: true, error: 'Network offline' };
    }

    const input = findBumbleChatInput();
    const sendBtn = findBumbleSendButton();

    if (!input) return { success: false, error: 'Input box not found' };

    // 1. Clean prefixes
    let cleanMessage = message;
    const prefixPattern = /^(You|null|[A-Z][a-z]+):\s*/;
    if (prefixPattern.test(cleanMessage)) {
        cleanMessage = cleanMessage.replace(prefixPattern, '');
    }

    // 2. Batch Insert (Wakes up React with single event — avoids triggering Bumble's API per-char)
    input.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    document.execCommand('insertText', false, cleanMessage);
    input.dispatchEvent(new InputEvent('input', { data: cleanMessage, bubbles: true, inputType: 'insertText' }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Tiny delay for UI to see the text
    await bumbleWait(800);

    // 3. Trusted Hardware Click via Debugger API
    if (sendBtn) {
        console.log('[FlirtEasy] Triggering trusted debugger click');

        const rect = sendBtn.getBoundingClientRect();
        const x = Math.round(rect.left + (rect.width / 2));
        const y = Math.round(rect.top + (rect.height / 2));

        // Let the background script handle the "Physical" click via Debugger
        chrome.runtime.sendMessage({
            action: 'simulateMouseClick',
            x: x,
            y: y
        });

        // Also perform JS events as a fallback/sync measure
        const opts = { bubbles: true, view: window, clientX: x, clientY: y, buttons: 1 };
        sendBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        sendBtn.dispatchEvent(new MouseEvent('mousedown', opts));
        await bumbleWait(100);
        sendBtn.dispatchEvent(new PointerEvent('pointerup', opts));
        sendBtn.dispatchEvent(new MouseEvent('mouseup', opts));
        sendBtn.click();

        console.log('[FlirtEasy] Send sequence complete.');
        await bumbleWait(2500); // Wait long enough for Bumble's optimistic-UI revert on 403

        // Verification — check input is actually empty (not just optimistically cleared)
        const textRemaining = input.innerText.trim();
        const isEmpty = textRemaining === "" || textRemaining === "Start chatting";

        if (isEmpty) {
            return { success: true };
        }

        // Input still has text — likely a 403 revert. Try Enter key as fallback.
        console.log('[FlirtEasy] Input not cleared after send, trying Enter fallback...');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        await bumbleWait(1500);
        const afterEnter = input.innerText.trim();
        if (afterEnter === "" || afterEnter === "Start chatting") {
            return { success: true };
        }

        // Last resort: re-click send button
        console.log('[FlirtEasy] Enter fallback failed, re-clicking send button...');
        sendBtn.click();
        await bumbleWait(2000);
        const afterRetry = input.innerText.trim();
        if (afterRetry === "" || afterRetry === "Start chatting") {
            return { success: true };
        }

        // All retries exhausted and input still has text — session likely expired (403)
        console.warn('[FlirtEasy] All send attempts failed — input not cleared. Session may be expired.');
        return { success: false, sessionExpired: true, error: 'Session expired (403)' };
    }

    return { success: false, error: 'Send button not found' };
}

function bumbleWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Expose globally
if (typeof window !== 'undefined') {
    window.insertBumbleMessage = insertBumbleMessage;
    window.clickBumbleSendButton = clickBumbleSendButton;
    window.sendBumbleMessage = sendBumbleMessage;
}
