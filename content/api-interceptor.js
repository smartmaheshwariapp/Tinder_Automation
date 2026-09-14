// Intercept Tinder's API calls to get real message data
(function () {
  // Reads from the single global DEBUG_ENABLED flag in debug-config.js
  // Do not change this — toggle debug-config.js instead
  const _debug = (typeof DEBUG_ENABLED !== 'undefined') ? DEBUG_ENABLED : false;

  const log = _debug ? console.log.bind(console) : () => { };
  const warn = _debug ? console.warn.bind(console) : () => { };
  const error = _debug ? console.error.bind(console) : () => { };

  // Only initialize once
  if (window.__flirtEasyInterceptorLoaded) {
    log('[FlirtEasy] API Interceptor already loaded, skipping');
    return;
  }
  window.__flirtEasyInterceptorLoaded = true;
  log('[FlirtEasy] API Interceptor loaded');

  const messageCache = new Map();
  let globalBotId = null;

  function detectGlobalBotId() {
    if (globalBotId) return globalBotId;

    const idFrequency = new Map();

    for (const [matchId] of messageCache) {
      if (matchId && matchId.length >= 2 && matchId.length % 2 === 0) {
        const midpoint = Math.floor(matchId.length / 2);
        const firstHalf = matchId.substring(0, midpoint);
        const secondHalf = matchId.substring(midpoint);

        idFrequency.set(firstHalf, (idFrequency.get(firstHalf) || 0) + 1);
        idFrequency.set(secondHalf, (idFrequency.get(secondHalf) || 0) + 1);
      }
    }

    let maxCount = 0;
    let botId = null;

    for (const [id, count] of idFrequency) {
      if (count > maxCount) {
        maxCount = count;
        botId = id;
      }
    }

    if (botId && maxCount >= 2) {
      globalBotId = botId;
      log(`[FlirtEasy] Detected global bot ID: ${botId.substring(0, 8)}*** (appears in ${maxCount} matchIds)`);
    }

    return globalBotId;
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    let url = args[0];
    const method = (args[1] && args[1].method) ? args[1].method.toUpperCase() : 'GET';

    // Dispatch like event at request time so training overlay can capture photo before profile changes
    if (typeof url === 'string' && url.includes('/like/') && method === 'POST') {
      document.dispatchEvent(new CustomEvent('flirteasy:tinderLike'));
    }

    // Strip page_token from messages API to force fresh data
    if (typeof url === 'string' && url.includes('/v2/matches/') && url.includes('/messages') && url.includes('page_token=')) {
      const urlObj = new URL(url);
      urlObj.searchParams.delete('page_token');
      url = urlObj.toString();
      args[0] = url;
      log('[FlirtEasy] Stripped page_token, requesting fresh messages:', url);
    }

    return originalFetch(...args).then(async response => {
      // Intercept message API calls
      if (typeof url === 'string' && url.includes('/v2/matches/') && url.includes('/messages')) {
        const matchId = extractMatchId(url);

        try {
          const clone = response.clone();
          const data = await clone.json();

          log('[FlirtEasy] API response structure:', {
            hasData: !!data.data,
            hasMessages: !!(data.data && data.data.messages),
            messageCount: data.data?.messages?.length || 0
          });

          if (data.data && data.data.messages) {
            const sortedMessages = [...data.data.messages].sort((a, b) => {
              const timeA = new Date(a.sent_date || a.created_date).getTime();
              const timeB = new Date(b.sent_date || b.created_date).getTime();
              return timeA - timeB;
            });

            messageCache.set(matchId, {
              messages: sortedMessages,
              matchId: matchId,
              timestamp: Date.now()
            });

            log(`[FlirtEasy] Cached ${data.data.messages.length} messages for ${matchId.substring(0, 8)}***`);
          } else {
            warn('[FlirtEasy] No messages in API response for', matchId.substring(0, 8) + '***');
          }
        } catch (e) {
          error('[FlirtEasy] Error parsing:', e);
        }
      }

      // Intercept 401 Unauthorized responses to detect session expiration in-flight
      if (response.status === 401 && typeof url === 'string' && (url.includes('gotinder.com') || url.includes('/v2/') || url.includes('/recs') || url.includes('/like/'))) {
        warn('[FlirtEasy] 401 Unauthorized received from Tinder API! Session expired.');
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FE_SESSION_EXPIRED',
              status: 401,
              url: String(url),
              timestamp: Date.now()
            }));
          }
        } catch (_) {}
      }

      // Intercept profile API to extract subscription tier (ground truth)
      if (typeof url === 'string' && /api\.gotinder\.com\/v2\/profile(\?|$)/.test(url) && (!args[1] || !args[1].method || args[1].method === 'GET')) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          const tier = _extractAccountTier(data);
          if (tier) {
            window.__flirtEasyAccountTier = tier;
            document.dispatchEvent(new CustomEvent('flirteasy:accountTierDetected', { detail: { tier } }));
            log('[FlirtEasy] Account tier from API:', tier);
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'FE_PLAN_DETECTED',
                  plan: tier,
                  isPro: tier === 'platinum' || tier === 'gold' || tier === 'plus'
                }));
              }
            } catch (_) {}
          }
        } catch (e) {
          error('[FlirtEasy] Error parsing profile tier:', e);
        }
      }

      // Intercept like/pass API calls to detect matches
      if (typeof url === 'string' && (url.includes('/like/') || url.includes('/pass/'))) {
        try {
          const clone = response.clone();
          const data = await clone.json();

          // Check if it's a match
          if (data.match === true || (data.likes_you === true && data.is_match === true)) {
            log('[FlirtEasy] 🎉 Match detected via API!', data);

            // Notify content script about the match
            document.dispatchEvent(new CustomEvent('flirteasy:matchDetected', {
              detail: {
                matchId: data.match_id || data._id,
                timestamp: Date.now()
              }
            }));
          }
        } catch (e) {
          error('[FlirtEasy] Error parsing like/pass response:', e);
        }
      }

      return response;
    });
  };

  function _extractAccountTier(data) {
    try {
      const d = data?.data || data;
      if (!d) return 'free';

      const purchases = [
        ...(Array.isArray(d?.purchases) ? d.purchases : []),
        ...(Array.isArray(d?.purchase?.purchases) ? d.purchase.purchases : []),
        ...(Array.isArray(d?.account?.purchases) ? d.account.purchases : []),
        ...(Array.isArray(d?.user?.purchases) ? d.user.purchases : []),
        ...(Array.isArray(d?.products) ? d.products : []),
      ];

      for (const p of purchases) {
        const sig = String(p?.product_type || p?.product_id || p?.product_name || p?.plan || p?.name || '').toLowerCase();
        if (sig.includes('platinum')) return 'platinum';
        if (sig.includes('gold')) return 'gold';
        if (sig.includes('plus')) return 'plus';
      }

      if (d.account?.is_platinum_subscriber) return 'platinum';
      if (d.account?.is_gold_subscriber) return 'gold';

      const acctType = String(d.account?.account_type || '').toLowerCase();
      if (acctType.includes('platinum')) return 'platinum';
      if (acctType.includes('gold')) return 'gold';
      if (acctType.includes('plus')) return 'plus';

      const rawJson = JSON.stringify(d).toLowerCase();
      if (rawJson.includes('tinder platinum') || rawJson.includes('"platinum"')) return 'platinum';
      if (rawJson.includes('tinder gold') || rawJson.includes('"gold"')) return 'gold';
      if (rawJson.includes('tinder plus') || rawJson.includes('"plus"')) return 'plus';

      return 'free';
    } catch (_) {}
    return 'free';
  }

  function extractMatchId(url) {
    const match = url.match(/\/v2\/matches\/([^\/]+)/);
    return match ? match[1] : null;
  }

  // Listen for cache invalidation requests
  document.addEventListener('flirteasy:invalidateCache', function (event) {
    const matchId = event.detail.matchId;
    if (matchId) {
      messageCache.delete(matchId);
      log(`[FlirtEasy] Cache invalidated for ${matchId.substring(0, 8)}***`);
    }
  });

  // Expose function to get cached messages
  // Listen for requests from content script via CustomEvent
  document.addEventListener('flirteasy:getMessages', function (event) {
    const matchId = event.detail.matchId;
    const messages = getInterceptedMessagesInternal(matchId);

    // Respond via another CustomEvent
    document.dispatchEvent(new CustomEvent('flirteasy:messagesResponse', {
      detail: {
        matchId: matchId,
        messages: messages
      }
    }));
  });

  function getInterceptedMessagesInternal(matchId) {
    log(`[FlirtEasy] getInterceptedMessages called with matchId: ${matchId.substring(0, 8)}***`);
    log(`[FlirtEasy] Cache has ${messageCache.size} entries`);

    const cached = messageCache.get(matchId);
    if (!cached) {
      log(`[FlirtEasy] No cached messages found for matchId: ${matchId.substring(0, 8)}***`);
      return [];
    }

    log(`[FlirtEasy] Processing ${cached.messages.length} intercepted messages for matchId: ${matchId.substring(0, 8)}***`);

    if (cached.messages.length === 0) {
      log(`[FlirtEasy] No messages in cache for matchId: ${matchId.substring(0, 8)}***`);
      return [];
    }

    // Extract current user ID from matchId structure
    // matchId format: {userId}{matchUserId} or {matchUserId}{userId}
    // Strategy: Use global bot ID detection across all matches
    let currentUserId = null;

    // Try global bot ID detection first
    const detectedBotId = detectGlobalBotId();

    if (matchId && matchId.length >= 2 && matchId.length % 2 === 0) {
      const midpoint = Math.floor(matchId.length / 2);
      const firstHalf = matchId.substring(0, midpoint);
      const secondHalf = matchId.substring(midpoint);

      // Use global bot ID if available
      if (detectedBotId) {
        if (firstHalf === detectedBotId) {
          currentUserId = firstHalf;
        } else if (secondHalf === detectedBotId) {
          currentUserId = secondHalf;
        }

        if (currentUserId) {
          log(`[FlirtEasy] Bot ID from global detection: ${currentUserId.substring(0, 8)}***`);
        }
      }

      // Fallback: local detection - bot appears in BOTH 'from' AND 'to' fields
      if (!currentUserId && cached.messages.length > 1) {
        const firstHalfInFrom = cached.messages.some(msg => msg.from === firstHalf);
        const firstHalfInTo = cached.messages.some(msg => msg.to === firstHalf);
        const secondHalfInFrom = cached.messages.some(msg => msg.from === secondHalf);
        const secondHalfInTo = cached.messages.some(msg => msg.to === secondHalf);

        if (firstHalfInFrom && firstHalfInTo) {
          currentUserId = firstHalf;
          log(`[FlirtEasy] Bot ID from pattern analysis: ${currentUserId.substring(0, 8)}*** (appears in both from/to)`);
        } else if (secondHalfInFrom && secondHalfInTo) {
          currentUserId = secondHalf;
          log(`[FlirtEasy] Bot ID from pattern analysis: ${currentUserId.substring(0, 8)}*** (appears in both from/to)`);
        }
      }

      // Last resort: single message fallback
      if (!currentUserId) {
        // Check 'to' field first (receiver = bot when match messages first)
        for (const msg of cached.messages) {
          if (msg.to === firstHalf || msg.to === secondHalf) {
            currentUserId = msg.to;
            log(`[FlirtEasy] Bot ID from 'to' field: ${currentUserId.substring(0, 8)}***`);
            break;
          }
        }

        // Fallback to 'from' field (sender = bot when bot messages first)
        if (!currentUserId) {
          for (const msg of cached.messages) {
            if (msg.from === firstHalf || msg.from === secondHalf) {
              currentUserId = msg.from;
              log(`[FlirtEasy] Bot ID from 'from' field: ${currentUserId.substring(0, 8)}***`);
              break;
            }
          }
        }
      }

      // Last resort: default to second half
      if (!currentUserId) {
        currentUserId = secondHalf;
        log(`[FlirtEasy] Bot ID (default): ${currentUserId.substring(0, 8)}***`);
      }
    }

    if (!currentUserId) {
      error(`[FlirtEasy] Could not determine current user ID for matchId: ${matchId.substring(0, 8)}***`);
      return [];
    }

    log(`[FlirtEasy] Using bot ID for sender detection: ${currentUserId.substring(0, 8)}***`);

    const processedMessages = cached.messages.map((msg, index) => {
      // Message from current user if 'from' field equals current user ID
      const sender = msg.from === currentUserId ? 'user' : 'match';

      if (!msg.message) {
        warn(`[FlirtEasy] Message missing text content`);
      }

      return {
        id: msg._id || msg.id,
        text: msg.message || '',
        sender: sender,
        timestamp: new Date(msg.sent_date || msg.created_date).getTime()
      };
    });

    log(`[FlirtEasy] Processed ${processedMessages.length} messages, last sender: ${processedMessages[processedMessages.length - 1]?.sender}`);

    return processedMessages;
  }

  // Also expose as direct function for backward compatibility (won't work in content script due to isolation)
  window.getInterceptedMessages = getInterceptedMessagesInternal;

  window.clearMessageCache = function () {
    messageCache.clear();
  };

})(); // End of IIFE
