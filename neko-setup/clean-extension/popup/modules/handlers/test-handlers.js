// Test and validation handlers
async function handleTestOpenAI() {
  const settings = await getSettings();

  // When using backend proxy, we don't need user's API key
  const useBackendProxy = window.API_CONFIG?.USE_BACKEND_PROXY ?? true;

  if (!useBackendProxy && (!settings.apiKey || !settings.apiKey.startsWith('sk-'))) {
    showMessage('API configuration error. Please contact support.', 'error');
    return;
  }

  const testBtn = document.getElementById('testOpenAIBtn');
  const originalHTML = testBtn.innerHTML;
  testBtn.disabled = true;
  testBtn.innerHTML = '<span class="tool-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: spin 1s linear infinite;"><defs><linearGradient id="testSpinner" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#8b5cf6"/><stop offset="100%" style="stop-color:#6366f1"/></linearGradient></defs><circle cx="12" cy="12" r="10" stroke="url(#testSpinner)" stroke-width="3" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="15" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="url(#testSpinner)" stroke-width="3" stroke-linecap="round"/></svg></span>Testing...';

  chrome.runtime.sendMessage({
    action: 'testOpenAI',
    testData: {
      name: 'Alex',
      bio: 'Love hiking and dogs. Looking for adventure partners!',
      interests: ['Travel', 'Photography', 'Cooking']
    }
  }, (response) => {
    testBtn.disabled = false;
    testBtn.innerHTML = originalHTML;

    if (response && response.success) {
      showMessage(`✓ Connection Successful! AI is ready.`, 'success');
    } else {
      showMessage(`✗ Connection Failed: ${response?.error || 'Unknown error'}`, 'error');
    }
  });
}
