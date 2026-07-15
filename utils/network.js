// Network utility functions

async function checkNetworkConnectivity() {
  try {
    // Use chrome.tabs to check if we can access Tinder (no CORS issues)
    const tabs = await chrome.tabs.query({ url: 'https://tinder.com/*' });
    if (tabs.length > 0) {
      // If Tinder tab exists and is loaded, we have network
      return true;
    }
    
    // Fallback: try to query any active tab (if this works, we have network)
    const allTabs = await chrome.tabs.query({ active: true });
    return allTabs.length > 0;
  } catch (err) {
    console.warn('[Network] Connectivity check failed:', err.message);
    return false;
  }
}

async function waitForNetwork(maxWaitMs = 60000) {
  const startTime = Date.now();
  
  while (true) {
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= maxWaitMs) {
      console.warn('[Network] Network wait timeout');
      return false;
    }
    
    console.log('[Network] Waiting for connection...', Number(Math.round(elapsed / 1000)), 's /', Number(Math.round(maxWaitMs/1000)), 's');
    
    if (await checkNetworkConnectivity()) {
      console.log('[Network] Connection restored');
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

function isNetworkError(error) {
  if (!error) return false;
  const msg = error.message || error.toString();
  return msg.includes('network') || 
         msg.includes('fetch') || 
         msg.includes('Failed to fetch') ||
         msg.includes('NetworkError') ||
         msg.includes('ERR_INTERNET_DISCONNECTED') ||
         msg.includes('ERR_NETWORK_CHANGED');
}

async function retryWithBackoff(fn, maxRetries = 5, baseDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      
      if (isNetworkError(err)) {
        console.log(`[Network] Network error detected, checking connectivity...`);
        const hasNetwork = await checkNetworkConnectivity();
        
        if (!hasNetwork) {
          console.log('[Network] No connection, waiting for network...');
          const restored = await waitForNetwork();
          if (!restored) throw new Error('Network recovery timeout');
        }
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log('[Network] Retry attempt', Number(attempt), 'of', Number(maxRetries), 'after', Number(delay), 'ms');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

if (typeof self !== 'undefined') {
  self.checkNetworkConnectivity = checkNetworkConnectivity;
  self.waitForNetwork = waitForNetwork;
  self.isNetworkError = isNetworkError;
  self.retryWithBackoff = retryWithBackoff;
}
