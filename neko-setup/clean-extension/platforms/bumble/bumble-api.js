/**
 * Bumble API Interceptor
 * Intercepts Bumble's API calls to capture match and message data
 * Injected into page context via script tag
 * 
 * IMPORTANT: Bumble uses a SINGLE RPC endpoint (mwebapi.pyi) for ALL requests.
 * The method/action is in the request BODY, not the URL. So we must sniff
 * every response body for encounter data, not match on URL patterns.
 */

(function () {
    // Debug configuration
    const DEBUG_ENABLED = false;
    const log = DEBUG_ENABLED ? console.log.bind(console) : () => { };
    const warn = DEBUG_ENABLED ? console.warn.bind(console) : () => { };
    const error = DEBUG_ENABLED ? console.error.bind(console) : () => { };

    // Only initialize once
    if (window.__bumbleInterceptorLoaded) {
        log('[Bumble] API Interceptor already loaded, skipping');
        return;
    }
    window.__bumbleInterceptorLoaded = true;
    log('[Bumble] API Interceptor loaded');

    // Cache for intercepted data
    const messageCache = new Map();
    const matchCache = new Map();
    let currentUserId = null;

    // Cache for encounter profile photos to avoid DOM-based hidden URLs
    const encounterPhotoCache = new Map(); // personId -> photoUrl

    // ========== SMART BODY-BASED RESPONSE ROUTER ==========
    // Bumble uses mwebapi.pyi for ALL calls. We detect the type from the response body.

    function routeResponse(data, url) {
        if (!data) return;

        // Strategy: Check for encounter data in ANY response
        // This is the critical fix - encounter data comes from mwebapi.pyi,
        // the URL never contains 'encounter' or 'get_encounters'
        if (hasEncounterData(data)) {
            handleEncounterResponse(data);
        }

        // Check for message data
        if (hasMessageData(data)) {
            handleMessagesResponse(data, url);
        }

        // Check for connection/match list data
        if (hasConnectionData(data)) {
            handleConnectionsResponse(data);
        }

        // Check for user profile data
        if (hasUserData(data)) {
            handleUserResponse(data);
        }
    }

    // ========== DATA DETECTION HELPERS ==========

    function hasEncounterData(data) {
        // Bumble encounter responses have client_encounters in body array
        if (Array.isArray(data.body)) {
            for (const section of data.body) {
                if (section.client_encounters && section.client_encounters.length > 0) return true;
            }
        }
        // Also check flat structures
        if (data.client_encounters?.length > 0) return true;
        if (data.results && Array.isArray(data.results)) {
            // Check if results contain user objects with photos (encounter-like)
            const hasUsers = data.results.some(r => r.user && (r.user.albums || r.user.photos));
            if (hasUsers) return true;
        }
        return false;
    }

    function hasMessageData(data) {
        if (data.messages && Array.isArray(data.messages)) return true;
        if (data.body?.messages) return true;
        if (data.chat?.messages) return true;
        if (Array.isArray(data.body)) {
            return data.body.some(s => s.messages || s.chat_messages);
        }
        return false;
    }

    function hasConnectionData(data) {
        if (data.connections && Array.isArray(data.connections)) return true;
        if (data.body?.connections) return true;
        return false;
    }

    function hasUserData(data) {
        if (data.user?.id) return true;
        if (data.userId) return true;
        if (data.body?.user?.id) return true;
        return false;
    }

    // ========== FETCH INTERCEPTOR ==========

    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        let url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

        // Optimization: Only process Bumble APIs.
        // Return original fetch immediately for third-party tracking/ads (like LinkedIn)
        // to avoid our interceptor appearing in stack traces for unrelated CSP/Network errors.
        if (!url.includes('bumble.com') && !url.includes('mwebapi')) {
            return originalFetch.apply(this, args);
        }

        return originalFetch.apply(this, args).then(async response => {
            try {
                const clone = response.clone();
                const data = await clone.json().catch(() => null);

                if (data) {
                    routeResponse(data, url);
                }

            } catch (e) {
                // Ignore errors: routeResponse handles its own errors
            }

            return response;
        });
    };

    // ========== XHR INTERCEPTOR ==========

    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._bumbleUrl = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        const self = this;
        this.addEventListener('load', function () {
            try {
                if (!self._bumbleUrl?.includes('bumble.com') && !self._bumbleUrl?.includes('mwebapi')) return;

                const data = JSON.parse(this.responseText);
                routeResponse(data, self._bumbleUrl);
            } catch (e) {
                // Ignore parse errors for non-JSON responses
            }
        });
        return originalXHRSend.apply(this, args);
    };

    // ========== RESPONSE HANDLERS ==========

    function handleMessagesResponse(data, url) {
        try {
            const conversationId = extractConversationId(url, data);
            if (!conversationId) return;

            const messages = extractMessages(data);
            if (messages.length === 0) return;

            messageCache.set(conversationId, {
                messages: messages,
                timestamp: Date.now()
            });

            log(`[Bumble] Cached ${messages.length} messages for conversation ${conversationId}`);
        } catch (e) {
            error('[Bumble] Error handling messages:', e);
        }
    }

    function handleConnectionsResponse(data) {
        try {
            const connections = extractConnections(data);
            connections.forEach(conn => {
                matchCache.set(conn.id, conn);
            });
            log(`[Bumble] Cached ${connections.length} connections`);
        } catch (e) {
            error('[Bumble] Error handling connections:', e);
        }
    }

    function handleUserResponse(data) {
        try {
            if (data.user?.id || data.userId || data.body?.user?.id) {
                currentUserId = data.user?.id || data.userId || data.body?.user?.id;
                log(`[Bumble] Current user ID: ${currentUserId}`);
            }
        } catch (e) {
            error('[Bumble] Error handling user response:', e);
        }
    }

    function handleEncounterResponse(data) {
        try {
            // Collect encounters from all possible locations in the response
            let allEncounters = [];

            // 1. body[].client_encounters (most common Bumble format)
            if (Array.isArray(data.body)) {
                for (const section of data.body) {
                    if (section.client_encounters) {
                        allEncounters = allEncounters.concat(section.client_encounters);
                    }
                }
            }

            // 2. Flat structures
            if (data.client_encounters) {
                allEncounters = allEncounters.concat(data.client_encounters);
            }
            if (data.results && Array.isArray(data.results)) {
                allEncounters = allEncounters.concat(data.results);
            }

            log(`[Bumble] 🔍 Processing ${allEncounters.length} encounter(s)...`);

            let cached = 0;
            allEncounters.forEach(item => {
                const user = item.user;
                if (!user) return;

                const userId = user.user_id || user.id;
                if (!userId) return;

                // Try EVERY possible photo path in Bumble's response
                const primaryPhoto = findBestPhoto(user);

                if (primaryPhoto && !primaryPhoto.includes('hidden?euri=')) {
                    // Cache by internal user ID
                    encounterPhotoCache.set(userId, primaryPhoto);

                    // Also cache by human-readable Name-Age
                    // (must match getBumbleProfileIdentifier's clean format exactly)
                    const name = user.name || '';
                    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').trim();
                    const age = user.age || (user.age_label ? user.age_label.replace(/[^0-9]/g, '') : '');

                    if (cleanName && age) {
                        encounterPhotoCache.set(`${cleanName}-${age}`, primaryPhoto);
                        log(`[Bumble] 📸 Cached CDN photo: ${cleanName}-${age} → ${primaryPhoto.substring(0, 60)}...`);
                    } else {
                        log(`[Bumble] 📸 Cached CDN photo: ID ${userId} → ${primaryPhoto.substring(0, 60)}...`);
                    }
                    cached++;
                }
            });

            if (cached > 0) {
                log(`[Bumble] 📸 Photo cache updated: ${cached} new photos (total: ${encounterPhotoCache.size})`);
            }

            // Check if it's a match response
            if (data.match || data.is_match || data.body?.match) {
                log('[Bumble] 🎉 Match detected!');
                window.dispatchEvent(new CustomEvent('bumble:matchDetected', {
                    detail: {
                        matchId: data.match_id || data.matchId || data.body?.match_id,
                        timestamp: Date.now()
                    }
                }));
            }
        } catch (e) {
            error('[Bumble] Error handling encounter response:', e);
        }
    }

    /**
     * Exhaustively search for the best (largest/clearest) photo URL from a user object.
     * Bumble's response format can vary, so we check many paths.
     */
    function findBestPhoto(user) {
        // Priority 1: albums[0].photos[0] large_url (highest quality)
        try {
            if (user.albums && user.albums.length > 0) {
                for (const album of user.albums) {
                    if (album.photos && album.photos.length > 0) {
                        const photo = album.photos[0];
                        // Try largest first
                        if (photo.large_url) return photo.large_url;
                        if (photo.original_url) return photo.original_url;
                        if (photo.preview_url) return photo.preview_url;
                        if (photo.url) return photo.url;
                        if (photo.large_photo_url) return photo.large_photo_url;
                    }
                }
            }
        } catch (e) { /* continue */ }

        // Priority 2: photos array directly on user
        try {
            if (user.photos && user.photos.length > 0) {
                const photo = user.photos[0];
                if (typeof photo === 'string') return photo;
                return photo.large_url || photo.original_url || photo.preview_url || photo.url || null;
            }
        } catch (e) { /* continue */ }

        // Priority 3: Direct photo object
        try {
            if (user.photo) {
                if (typeof user.photo === 'string') return user.photo;
                return user.photo.large_url || user.photo.url || user.photo.original_url || null;
            }
        } catch (e) { /* continue */ }

        // Priority 4: profile_photo
        try {
            if (user.profile_photo) {
                if (typeof user.profile_photo === 'string') return user.profile_photo;
                return user.profile_photo.large_url || user.profile_photo.url || null;
            }
        } catch (e) { /* continue */ }

        return null;
    }

    // ========== EXTRACTION HELPERS ==========

    function extractConversationId(url, data) {
        // Try URL first
        const urlMatch = url.match(/conversations?[\/=]([a-zA-Z0-9_-]+)/);
        if (urlMatch) return urlMatch[1];

        // Try response data
        if (data.conversation_id) return data.conversation_id;
        if (data.body?.conversation_id) return data.body.conversation_id;
        if (data.chatId) return data.chatId;

        return null;
    }

    function extractMessages(data) {
        const messages = [];

        // Handle various response formats
        let messageArray = data.messages ||
            data.body?.messages ||
            data.chat?.messages ||
            [];

        // Also check body array sections
        if (messageArray.length === 0 && Array.isArray(data.body)) {
            for (const section of data.body) {
                if (section.messages) {
                    messageArray = section.messages;
                    break;
                }
                if (section.chat_messages) {
                    messageArray = section.chat_messages;
                    break;
                }
            }
        }

        messageArray.forEach(msg => {
            messages.push({
                id: msg.id || msg.message_id || msg._id,
                text: msg.text || msg.message || msg.content || '',
                sender: msg.from_person_id === currentUserId ? 'user' : 'match',
                fromUserId: msg.from_person_id || msg.fromId || msg.sender_id,
                timestamp: new Date(msg.created_at || msg.timestamp || msg.sent_date).getTime()
            });
        });

        // Sort by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);

        return messages;
    }

    function extractConnections(data) {
        const connections = [];

        const connArray = data.connections ||
            data.body?.connections ||
            data.results ||
            [];

        connArray.forEach(conn => {
            connections.push({
                id: conn.user_id || conn.id || conn.match_id,
                name: conn.name || conn.user?.name,
                hasUnread: conn.unread_count > 0 || conn.has_unread,
                lastMessage: conn.last_message?.text,
                expiresAt: conn.expires_at,
                photo: conn.photo?.url || conn.user?.photo
            });
        });

        return connections;
    }

    // ========== PUBLIC API ==========

    // Listen for requests from content script
    window.addEventListener('bumble:getMessages', function (event) {
        const conversationId = event.detail.conversationId;
        const cached = messageCache.get(conversationId);

        window.dispatchEvent(new CustomEvent('bumble:messagesResponse', {
            detail: {
                conversationId: conversationId,
                messages: cached?.messages || [],
                cached: !!cached
            }
        }));
    });

    window.addEventListener('bumble:getConnections', function (event) {
        window.dispatchEvent(new CustomEvent('bumble:connectionsResponse', {
            detail: {
                connections: Array.from(matchCache.values())
            }
        }));
    });

    window.addEventListener('bumble:getEncounterPhoto', function (event) {
        // Parse detail - could be JSON string (from content script) or object (from page context)
        let requestData;
        try {
            requestData = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
        } catch (e) {
            requestData = event.detail;
        }

        const personId = requestData?.personId;
        if (!personId) return;

        const cached = encounterPhotoCache.get(personId);

        log(`[Bumble] 🔎 Photo lookup for "${personId}": ${cached ? 'HIT ✓' : 'MISS ✗'} (cache size: ${encounterPhotoCache.size})`);

        // Respond with JSON string to survive the isolation boundary
        window.dispatchEvent(new CustomEvent('bumble:encounterPhotoResponse', {
            detail: JSON.stringify({
                personId: personId,
                photoUrl: cached || null
            })
        }));
    });

    // ========== BASE64 PHOTO FETCH SERVICE ==========
    // Bumble uses session-locked 'hidden?euri=' URLs for ALL images.
    // These return 403 when accessed outside the browser session.
    // This service fetches them FROM the page context (which has cookies)
    // and converts to base64 so they can be sent to OpenAI for analysis.

    window.addEventListener('bumble:fetchPhotoAsBase64', async function (event) {
        let requestData;
        try {
            requestData = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
        } catch (e) {
            requestData = event.detail;
        }

        const imageUrl = requestData?.imageUrl;
        const requestId = requestData?.requestId || 'unknown';
        if (!imageUrl) return;

        log(`[Bumble] 📥 Fetching photo as base64 (request: ${requestId})...`);

        const respond = (base64) => {
            window.dispatchEvent(new CustomEvent('bumble:photoBase64Response', {
                detail: JSON.stringify({ requestId, base64, success: !!base64 })
            }));
        };

        const canvasFetch = () => new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                } catch (_) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
        });

        try {
            const response = await fetch(imageUrl, { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            const reader = new FileReader();
            reader.onload = () => {
                log(`[Bumble] ✅ Photo converted to base64: ${reader.result.length} chars`);
                respond(reader.result);
            };
            reader.onerror = async () => {
                log('[Bumble] FileReader failed, trying canvas fallback');
                respond(await canvasFetch());
            };
            reader.readAsDataURL(blob);
        } catch (e) {
            log(`[Bumble] Fetch failed (${e.message}), trying canvas fallback`);
            const b64 = await canvasFetch();
            if (b64) {
                log(`[Bumble] ✅ Canvas fallback succeeded`);
                respond(b64);
            } else {
                error('[Bumble] ❌ All base64 methods failed');
                respond(null);
            }
        }
    });

    // Expose for direct access (within page context)
    window.getBumbleMessages = (conversationId) => messageCache.get(conversationId)?.messages || [];
    window.getBumbleConnections = () => Array.from(matchCache.values());
    window.getBumbleEncounterPhoto = (personId) => encounterPhotoCache.get(personId);
    window.clearBumbleCache = () => {
        messageCache.clear();
        matchCache.clear();
        encounterPhotoCache.clear();
    };

})();
