// Add to background.js - Session Token Capture

let sessionTokens = null;

// Listen for API requests to capture session tokens
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.url.includes('api.gotinder.com')) {
      const headers = details.requestHeaders;
      const xAuthToken = headers.find(h => h.name.toLowerCase() === 'x-auth-token');
      
      if (xAuthToken) {
        sessionTokens = {
          xAuthToken: xAuthToken.value,
          userId: extractUserIdFromToken(xAuthToken.value),
          timestamp: Date.now()
        };
        console.log('[Background] Captured session tokens');
      }
    }
  },
  { urls: ['https://api.gotinder.com/*'] },
  ['requestHeaders']
);

function extractUserIdFromToken(token) {
  // Try to extract user ID from token if possible
  // This is a placeholder - actual implementation depends on token format
  return 'user_' + Date.now();
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSessionTokens') {
    sendResponse({ tokens: sessionTokens });
    return true;
  }
  
  // ... existing message handlers ...
});
