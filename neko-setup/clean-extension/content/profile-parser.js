function getMatchName() {
  if (!window.SELECTORS) return null;
  // Try profile panel h1 first — returns "Ruxi37", strip trailing digits
  const h1 = document.querySelector('.profileContent h1');
  if (h1) {
    return h1.textContent.trim().replace(/\d+$/, '').trim() || null;
  }
  const nameEl = findElement(window.SELECTORS.profile.name);
  if (nameEl && nameEl.textContent.trim().length > 0) {
    return nameEl.textContent.trim().replace(/\d+$/, '').trim();
  }
  return null;
}

function getMatchAge() {
  // Age is in a separate span: SPAN.Whs(nw).Typs(display-2-strong) = "37"
  try {
    const ageSpan = document.querySelector('span.Whs\\(nw\\).Typs\\(display-2-strong\\)');
    if (ageSpan) {
      const age = parseInt(ageSpan.textContent.trim());
      if (!isNaN(age) && age >= 18 && age <= 99) return age;
    }
    // Fallback: extract digits from .profileContent h1 (e.g. "Ruxi37")
    const h1 = document.querySelector('.profileContent h1');
    if (h1) {
      const match = h1.textContent.trim().match(/(\d{2,3})$/);
      if (match) {
        const age = parseInt(match[1]);
        if (age >= 18 && age <= 99) return age;
      }
    }
  } catch (_) {}

  // Fallback to original selector
  if (!window.SELECTORS) return null;
  const ageEl = findElement(window.SELECTORS.profile.age);
  if (ageEl) {
    const age = parseInt(ageEl.textContent.trim());
    if (!isNaN(age) && age >= 18 && age <= 99) return age;
  }
  return null;
}

function getMatchBio() {
  if (!window.SELECTORS) return null;

  // Scope bio search to the profile panel on the right side of the chat
  // This prevents matching chat message text which uses similar class names
  const profilePanel = document.querySelector(
    'div.P\\(24px\\).W\\(100\\%\\).Bgc\\(\\$c-ds-background-primary\\), ' +
    '[data-testid="matchProfileContent"], ' +
    '.profileContent, ' +
    'div[class*="profileContent"], ' +
    'aside, ' +
    'div[class*="Sidebar"]'
  );
  const searchRoot = profilePanel || document;

  const bioSelectors = [
    'div.C\\(\\$c-ds-text-primary\\).Typs\\(body-1-regular\\)',
    '.BreakWord',
    '[class*="bio"]',
  ];

  for (const sel of bioSelectors) {
    const el = searchRoot.querySelector(sel);
    if (el) {
      const text = el.textContent.trim();
      if (text && text.length > 5) return text;
    }
  }

  // Fallback to original selectors on full document
  const bioEl = findElement(window.SELECTORS.profile.bio);
  if (bioEl) {
    const text = bioEl.textContent.trim();
    if (text && text.length > 10) return text;
  }
  return null;
}

function getMatchInterests() {
  const interests = [];

  // Current Tinder DOM structure:
  // SECTION → DIV (heading "Interests") + UL (interest chips)
  try {
    const headings = document.querySelectorAll('div, h2, span');
    for (const el of headings) {
      if (el.children.length <= 3 && el.innerText?.trim() === 'Interests') {
        const ul = el.parentElement?.querySelector('ul') || el.nextElementSibling;
        if (ul) {
          ul.querySelectorAll('li').forEach(li => {
            const text = li.innerText?.trim();
            if (text && text.length > 1 && text.length < 50 && !interests.includes(text)) {
              interests.push(text);
            }
          });
          if (interests.length > 0) return interests;
        }
      }
    }
  } catch (_) {}

  // Fallback to original selectors
  if (!window.SELECTORS) return interests;
  const interestEls = findElements(window.SELECTORS.profile.interests);
  interestEls.forEach(el => {
    const text = el.textContent.trim();
    // Filter out UI noise — real interests are 2-30 chars, not numbers or long strings
    if (text && text.length > 1 && text.length < 30 &&
        !/^\d+$/.test(text) &&
        !['Send', 'Long-term', 'Still figuring', 'Short-term', 'Relationship', 'Friendship'].some(s => text.startsWith(s)) &&
        !interests.includes(text)) {
      interests.push(text);
    }
  });

  return interests;
}

function getMatchQuestionAnswers() {
  const answers = [];
  const sections = document.querySelectorAll(
    'div.P\\(24px\\).W\\(100\\%\\).Bgc\\(\\$c-ds-background-primary\\)'
  );
  sections.forEach(section => {
    const labelEl = section.querySelector('h2, [class*="text-secondary"]');
    const answerEl = section.querySelector(
      'div.C\\(\\$c-ds-text-primary\\).Typs\\(display-2-strong\\), ' +
      '[class*="display-2-strong"]'
    );
    if (labelEl && answerEl) {
      const q = labelEl.textContent.trim();
      const a = answerEl.textContent.trim();
      // Skip emoji-only answers (no actual text content)
      const aStripped = a.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\s]/gu, '');
      if (q && a && q !== a && aStripped.length >= 2) {
        answers.push({ question: q, answer: a });
      }
    }
  });
  return answers;
}

function parseCurrentProfile() {
  return {
    name: getMatchName(),
    age: getMatchAge(),
    bio: getMatchBio(),
    interests: getMatchInterests(),
    questionAnswers: getMatchQuestionAnswers(),
    platform: 'tinder'
  };
}

// Bridge to page context using CustomEvent
function getInterceptedMessagesViaEvent(matchId) {
  let receivedMessages = null;

  // Set up one-time listener for response
  const responseHandler = function (event) {
    if (event.detail.matchId === matchId) {
      receivedMessages = event.detail.messages;
      document.removeEventListener('flirteasy:messagesResponse', responseHandler);
    }
  };

  document.addEventListener('flirteasy:messagesResponse', responseHandler);

  // Request messages from page context
  console.log(`[FlirtEasy] Requesting messages via CustomEvent for ${matchId}`);
  document.dispatchEvent(new CustomEvent('flirteasy:getMessages', {
    detail: { matchId: matchId }
  }));

  // The event should fire synchronously, so we should have the result now
  if (receivedMessages !== null) {
    console.log(`[FlirtEasy] Received ${receivedMessages.length} messages via CustomEvent`);
    return receivedMessages;
  }

  // Cleanup listener if something went wrong
  document.removeEventListener('flirteasy:messagesResponse', responseHandler);
  console.log(`[FlirtEasy] No messages received via CustomEvent`);
  return [];
}

async function getStoredMatchData(matchId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getMatchData', matchId }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[FlirtEasy] Runtime error:', chrome.runtime.lastError.message);
        resolve(null);
      } else {
        resolve(response && response.data);
      }
    });
  });
}

async function getConversationHistory(limit = 50) {
  const matchId = extractMatchIdFromURL();
  // console.log(`[FlirtEasy] getConversationHistory: matchId=${matchId}`);

  if (matchId) {
    const apiMessages = getInterceptedMessagesViaEvent(matchId);

    try {
      const storedData = await getStoredMatchData(matchId);
      const storageMessages = storedData?.conversationHistory || [];

      // MERGE: Start with API (source of truth for match replies), append storage-only messages
      if (apiMessages.length > 0) {
        const apiTexts = new Set(apiMessages.map(m => m.text));
        const storageOnlyMessages = storageMessages.filter(m => !apiTexts.has(m.text));

        if (storageOnlyMessages.length > 0) {
          console.log(`[FlirtEasy] Merging: ${apiMessages.length} API + ${storageOnlyMessages.length} storage-only`);
          return { messages: [...apiMessages, ...storageOnlyMessages].slice(-limit), apiMessages };
        }

        console.log(`[FlirtEasy] Using ${apiMessages.length} messages from API only`);
        return { messages: apiMessages.slice(-limit), apiMessages };
      }

      // Fallback to storage if API empty
      if (storageMessages.length > 0) {
        console.log(`[FlirtEasy] Using ${storageMessages.length} messages from storage (API empty)`);
        return { messages: storageMessages.slice(-limit), apiMessages: [] };
      }
    } catch (error) {
      console.warn(`[FlirtEasy] Error loading from storage:`, error);
      if (apiMessages && apiMessages.length > 0) {
        console.log(`[FlirtEasy] Using ${apiMessages.length} messages from API (storage error)`);
        return { messages: apiMessages.slice(-limit), apiMessages };
      }
    }

    console.log(`[FlirtEasy] No messages in storage or API, falling back to DOM parsing`);
  }

  // Fallback to DOM parsing
  const messageSelectors = window.SELECTORS?.messaging?.messageBubble || [".msg-text", ".message-content", ".text-ellipsis", "[class*='messageText' i]", "[data-testid*='message']", "div[dir='auto']"];

  const messages = [];
  const flatSelectors = Array.isArray(messageSelectors) ? messageSelectors : [messageSelectors];

  for (const selector of flatSelectors) {
    const messageEls = document.querySelectorAll(selector);

    if (messageEls.length > 0) {
      console.log(`[FlirtEasy] DOM Parsing: Found ${messageEls.length} elements with selector: ${selector}`);

      Array.from(messageEls).slice(-limit).forEach((msgEl) => {
        let text = msgEl.textContent.trim();

        if (!text || text.length < 1) {
          const mediaContainer = msgEl.closest('.msgHelper') || msgEl.parentElement;
          if (mediaContainer) {
            if (mediaContainer.querySelector('img[src*="giphy"], [class*="gif" i]')) {
              text = '[GIF]';
            } else if (mediaContainer.querySelector('audio, [class*="audio" i]')) {
              text = '[Voice Note]';
            } else if (mediaContainer.querySelector('video')) {
              text = '[Video]';
            } else if (mediaContainer.querySelector('img:not([class*="avatar"]):not([class*="photo"]):not([class*="profile"])')) {
              text = '[Media/Image]';
            }
          }
          if (!text || text.length < 1) return;
        }

        // Clean up common boilerplate from DOM text
        text = text.replace(/^(You|null):?\s*/i, '').trim();

        // Robust Sender Detection for Tinder's Atomic CSS:
        // 1. Ta(e) = Atomic CSS class on container (Right side, User)
        // 2. Jc(fe) = Container justify-content flex-end (Right side, User)
        // 3. Pink/Blue bubble color vs Grey
        // NOTE: element-level textAlign is intentionally excluded — RTL languages
        // (Hebrew, Arabic) render with textAlign 'right'/'end' in match bubbles,
        // which would falsely classify them as user-sent messages.
        const parent = msgEl.closest('.msgHelper') || msgEl.parentElement;
        const container = parent?.parentElement;
        const containerStyle = container ? window.getComputedStyle(container) : null;

        const isRightAligned = container?.classList.contains('Ta(e)') ||
          containerStyle?.justifyContent === 'flex-end' ||
          containerStyle?.justifyContent === 'end';

        const isUserColor = msgEl.classList.contains('C($c-ds-text-chat-bubble-send)') ||
          msgEl.closest('[class*="Bgc($c-ds-background-brand-gradient)"]') !== null;

        const isFromUser = isRightAligned || isUserColor ||
          msgEl.classList.contains('sent') ||
          msgEl.classList.contains('user');

        // Time Extraction (Tinder-specific DOM variants)
        const timeEl = parent?.querySelector('[class*="timestamp" i], [class*="time" i], .Hidden');
        const timeText = timeEl ? timeEl.textContent.trim() : "";

        messages.push({
          sender: isFromUser ? 'user' : 'match',
          text: text,
          timeText: timeText,
          timestamp: Date.now() - ((messageEls.length - Array.from(messageEls).indexOf(msgEl)) * 5000) // Fallback
        });
      });
      break;
    }
  }

  // Secondary scan: catch media-only messages (GIF/Image/Audio/Video) that have
  // no text child and are therefore invisible to all text selectors above.
  // We only check the last .msgHelper in DOM order — if it's media-only and not
  // already captured as the final message, it means the match replied with media
  // and the AI would incorrectly think the user was last to send.
  const allMsgHelpers = Array.from(document.querySelectorAll('.msgHelper'));
  if (allMsgHelpers.length > 0) {
    const lastHelper = allMsgHelpers[allMsgHelpers.length - 1];
    const helperText = lastHelper.textContent.trim().replace(/^(You|null):?\s*/i, '').trim();
    const lastCaptured = messages[messages.length - 1];

    if (!helperText || helperText.length < 1) {
      let mediaText = null;
      if (lastHelper.querySelector('img[src*="giphy"], [class*="gif" i]')) {
        mediaText = '[GIF]';
      } else if (lastHelper.querySelector('audio, [class*="audio" i]')) {
        mediaText = '[Voice Note]';
      } else if (lastHelper.querySelector('video')) {
        mediaText = '[Video]';
      } else if (lastHelper.querySelector('img:not([class*="avatar"]):not([class*="photo"]):not([class*="profile"])')) {
        mediaText = '[Media/Image]';
      }

      if (mediaText && (!lastCaptured || lastCaptured.text !== mediaText)) {
        const helperStyle = window.getComputedStyle(lastHelper.parentElement || lastHelper);
        const isRight = lastHelper.parentElement?.classList.contains('Ta(e)') ||
          helperStyle.justifyContent === 'flex-end' || helperStyle.justifyContent === 'end';
        
        // Final fallback timestamp
        const lastTimeEl = lastHelper.querySelector('[class*="timestamp" i], .Hidden');
        const lastTimeText = lastTimeEl ? lastTimeEl.textContent.trim() : "";

        messages.push({
          sender: isRight ? 'user' : 'match',
          text: mediaText,
          timeText: lastTimeText,
          timestamp: Date.now()
        });
      }
    }
  }

  return { messages, apiMessages: [] };
}

function extractMatchIdFromURL() {
  const match = window.location.pathname.match(/\/app\/messages\/([^\/]+)/);
  return match ? match[1] : null;
}

async function wasUserLastToReply() {
  const result = await getConversationHistory(5);
  const messages = result.messages || result;

  if (messages.length === 0) {
    return false;
  }

  const lastMessage = messages[messages.length - 1];
  return lastMessage.sender === 'user';
}

const handledTinderLeadsDuringScan = new Set();

function getMatchesFromList() {
  const matchItems = document.querySelectorAll('a[href^="/app/messages/"]');
  const matches = [];

  matchItems.forEach((item, sidebarIndex) => {
    // 1. IMPROVED NAME DETECTION (Robust Heuristic)
    const nameEl = item.querySelector('h3, [class*="bold" i], [class*="Primary" i], .Ell');
    let name = nameEl ? nameEl.textContent.trim() : "";

    // Clean up or use innerText fallback if name is a badge or empty
    if (!name || name.toLowerCase().includes('new message') || name.length > 40) {
      name = item.innerText.split('\n')[0].trim();
    }

    // Final safety check for names
    if (!name) name = `Match ${sidebarIndex + 1}`;

    // Extract snippet (usually the div right after the name area)
    const snippetEl = item.querySelector('div[class*="snippet" i], div.text-ellipsis + div, .message-content');
    let snippet = snippetEl ? snippetEl.innerText.trim() : "";
    if (!snippet) {
      const lines = item.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) snippet = lines[1];
    }

    const unreadIndicator = item.querySelector('.unread, .badge, [data-testid="unread"], [aria-label="New Message"], .Bgc\\(\\$c-ds-background-brand\\)');
    const hasUnread = !!unreadIndicator;

    // 3. TINDER "YOUR MOVE" DETECTION (Cyan/Blue dot)
    const isYourMove = item.innerText.toLowerCase().includes('your move') ||
      !!item.querySelector('[class*="background-accent-cyan" i]');

    // 4. SHE REPLIED LAST DETECTION via span.Hidden accessibility text
    // Format: "Your last message was: ..."      → bot sent last → sheRepliedLast = false
    //         "[Name]'s last message was: ..."  → she sent last → sheRepliedLast = true
    // This is the only reliable signal — sidebar ← arrow is an SVG (not in innerText).
    const hiddenText = item.querySelector('span.Hidden')?.textContent || "";
    const hiddenLower = hiddenText.toLowerCase();
    const botSentLast = hiddenLower.includes('your last message was:');
    const sheRepliedLast = hiddenText.length > 0 && !botSentLast && hiddenLower.includes("last message was:");

    const matchId = item.getAttribute('href').split('/').pop();

    // Extract photoUrl from sidebar card
    let photoUrl = null;
    const imgEl = item.querySelector('img[src], [class*="avatar" i] img, [class*="image" i] img');
    if (imgEl && imgEl.src) {
      photoUrl = imgEl.src;
    } else {
      const thumbEl = item.querySelector('[class*="avatar" i], [class*="image" i], div[style*="background-image"]');
      if (thumbEl) {
        const bg = window.getComputedStyle(thumbEl).backgroundImage;
        const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (match) photoUrl = match[1];
      }
    }

    const matchObj = {
      matchId,
      name,
      hasUnread,
      isYourMove,
      sheRepliedLast,
      sidebarIndex,
      snippet,
      photoUrl,
      element: item,
      hiddenText: item.querySelector('span.Hidden')?.textContent || ""
    };

    // Instant Lead Detection on Tinder Sidebar (Attribution Shield)
    // Scan EVERY snippet even if idle to apply shielding/passive detection
    if (snippet) {
      checkForTinderPassiveLead(matchObj);
    }

    matches.push(matchObj);
  });

  return matches;
}

/**
 * Tinder Passive Lead Scanner
 */
async function checkForTinderPassiveLead(match) {
  if (!match.snippet || !match.matchId) return;

  const text = match.snippet.toLowerCase();
  let leadType = null;

  // PHONE NUMBERS ONLY — Social handles are left to AI stop condition
  // Regex on social keywords causes false positives: "I use Insta for reference" ≠ lead
  // Digit-count validation prevents conversational numbers ("15 07 1994", large sums) from triggering
  const _ph = text.match(/(\+?[\d][\d\s\-\(\).]{5,}[\d])/);
  if (_ph) {
    const _digits = _ph[0].replace(/\D/g, '');
    const _ctx = text.substring(Math.max(0, _ph.index - 25), Math.min(text.length, _ph.index + _ph[0].length + 25));
    const _isDate = /\b\d{1,2}[\s\/\-]\d{1,2}[\s\/\-]\d{2,4}\b/.test(_ph[0]);
    const _isCurrency = /\b(?:dollars?|euros?|pounds?|yen|millions?|billions?|thousands?)\b/.test(_ctx);
    if (_digits.length >= 9 && !_isDate && !_isCurrency) leadType = 'phone';
  }
  if (!leadType && text.match(/(?:whatsapp|wa\b)/i)) {
    const _wa = text.match(/(\+?[\d][\d\s\-]{5,}[\d])/);
    if (_wa && _wa[0].replace(/\D/g, '').length >= 7) leadType = 'phone';
  }

  if (leadType) {
    const matchId = match.matchId;

    // 1. Session-based deduplication
    if (handledTinderLeadsDuringScan.has(matchId)) return;
    handledTinderLeadsDuringScan.add(matchId);

    console.log(`[FlirtEasy] ✨ TINDER PASSIVE LEAD: ${match.name} ("${match.snippet.substring(0, 30)}...")`);

    // 2. Permanent Photo Check
    let finalPhoto = match.photoUrl;
    if (match.photoUrl && match.photoUrl.startsWith('http')) {
      try {
        finalPhoto = await tinderImageToBase64(match.photoUrl);
      } catch (e) {
        console.warn('[FlirtEasy] Photo conversion failed', e);
      }
    }

    // Check if we've already handled this lead
    chrome.runtime.sendMessage({ action: 'isChatStopped', matchId }, async (response) => {
      if (response?.isStopped) return;

      // --- ATTRIBUTION SHIELD ---
      // 1. Check hidden accessibility text (most accurate)
      // 2. Fallback to unread/yourMove logic
      const hiddenText = match.hiddenText?.toLowerCase() || "";
      const isUserLast = hiddenText.includes('your last message') ||
        (!match.hasUnread && !match.isYourMove);

      if (isUserLast) {
        console.log(`[FlirtEasy] 🛡️ Tinder Attribution Shield: User sent contact info to ${match.name}. Shielding...`);
        chrome.runtime.sendMessage({
          action: 'markChatStopped',
          matchId: match.matchId,
          reason: '🚫 SHIELD (User Lead)',
          matchName: match.name,
          platform: 'tinder'
        });
        return;
      }

      console.log(`[FlirtEasy] ✨ TINDER PASSIVE LEAD: ${match.name} ("${match.snippet.substring(0, 30)}...")`);

      // 1. Alert user
      if (typeof window.UIAlerts !== 'undefined' && typeof window.UIAlerts.showHandoff === 'function') {
        window.UIAlerts.showHandoff(match.name, leadType);
      }

      // 2. Mark as stopped + add to Calendar
      chrome.runtime.sendMessage({
        action: 'markChatStopped',
        matchId: matchId,
        reason: leadType,
        matchName: match.name,
        platform: 'tinder',
        snippet: match.snippet,
        photoUrl: finalPhoto
      });
    });
  }
}

/**
 * Converts Tinder photos to permanent Base64
 * Uses fetch + FileReader for maximum robustness against CORS
 */
async function tinderImageToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('[FlirtEasy] Base64 conversion failed:', e);
    return null;
  }
}

function getNewMatchesFromGrid() {
  const matchCards = document.querySelectorAll('a.matchListItem');
  const matches = [];

  matchCards.forEach((card, index) => {
    const nameEl = card.querySelector('[aria-label]');
    const name = nameEl ? nameEl.getAttribute('aria-label') : `Match ${index + 1}`;

    const href = card.getAttribute('href');
    if (name === '99+ likes' || href === '/app/likes-you' || href === '/app/my-likes' || (href && !href.includes('/app/messages/'))) {
      return;
    }

    const matchId = href && href.includes('/app/messages/') ? href.split('/').pop() : null;

    matches.push({
      matchId,
      name,
      element: card,
      isNew: true
    });
  });

  return matches;
}

function navigateToMatch(matchId) {
  const selectors = [
    `a[href="/app/messages/${matchId}"]`,
    `a[href^="/app/messages/${matchId}"]`,
    `a[href*="${matchId}"]`
  ];

  for (const selector of selectors) {
    const matchLink = document.querySelector(selector);
    if (matchLink) {
      console.log(`[FlirtEasy] Found match link with selector: ${selector}`);
      matchLink.click();
      return true;
    }
  }

  console.log(`[FlirtEasy] Link not found for matchId: ${matchId}`);
  return false;
}

function isOnMatchesPage() {
  return window.location.pathname.includes('/app/messages') ||
    window.location.pathname.includes('/app/recs');
}

function isOnChatPage() {
  return window.location.pathname.includes('/app/messages/') &&
    window.location.pathname.split('/').length > 4;
}

async function getUserOwnProfile() {
  const currentUrl = window.location.href;
  const isOnProfilePage = window.location.pathname.includes('/app/profile');

  console.log(`[FlirtEasy] getUserOwnProfile called, isOnProfilePage: ${isOnProfilePage}, url: ${currentUrl}`);

  if (!isOnProfilePage) {
    console.warn('[FlirtEasy] Not on profile page, cannot read profile');
    return null;
  }

  // Wait up to 4 seconds for React to hydrate and render profile components
  for (let attempt = 0; attempt < 12; attempt++) {
    const hasContent = document.querySelector('textarea') || 
                       document.querySelector('h2') || 
                       (document.body.innerText && (document.body.innerText.includes('ABOUT') || document.body.innerText.includes('PASSIONS')));
    if (hasContent) break;
    await new Promise(r => setTimeout(r, 300));
  }

  const profile = {
    name: null,
    age: null,
    bio: null,
    interests: [],
    height: null,
    job: null,
    school: null,
    city: null,
    gender: null,
    sexualOrientation: null,
    location: null,
    distancePreference: null,
    interestedIn: null,
    lookingFor: null,
    relationshipType: null,
    languages: [],
    preferredLanguages: [],
    zodiac: null,
    education: null,
    familyPlans: null,
    communicationStyle: null,
    loveStyle: null,
    pets: null,
    userPets: null,
    drinking: null,
    smoking: null,
    workout: null,
    sleepingHabits: null,
    dietaryPreference: null,
    socialMedia: null
  };

  // ── LAYER 1: Parse modern Tinder /app/profile/edit page directly ──
  const isEditPage = window.location.pathname.includes('/app/profile/edit');
  if (isEditPage || document.querySelector('textarea') || (document.body.innerText && document.body.innerText.includes('ABOUT'))) {
    // 1. Bio from textarea
    const textareas = Array.from(document.querySelectorAll('textarea'));
    if (textareas.length > 0 && textareas[0].value) {
      profile.bio = textareas[0].value.trim();
      console.log(`[FlirtEasy] Found bio from textarea: ${profile.bio.substring(0, 40)}...`);
    }

    const pageText = document.body.innerText || '';

    // 2. Name from "ABOUT <NAME>"
    const nameMatch = pageText.match(/ABOUT\s+([A-Za-z0-9_ -]+)\s*\n/i);
    if (nameMatch) {
      profile.name = nameMatch[1].trim();
      console.log(`[FlirtEasy] Found name from ABOUT header: ${profile.name}`);
    }

    // 3. Name & Age from page text (e.g. "Sanket,\n27")
    const nameAgeMatch = pageText.match(/([A-Z][a-z]+),\s*\n?\s*(\d{2})/);
    if (nameAgeMatch) {
      if (!profile.name) profile.name = nameAgeMatch[1].trim();
      if (!profile.age) profile.age = parseInt(nameAgeMatch[2]);
      console.log(`[FlirtEasy] Found name/age from text: ${profile.name}, ${profile.age}`);
    }

    // 4. Passions
    const passionsMatch = pageText.match(/PASSIONS\s*\n([^\n]+)/i);
    if (passionsMatch && !passionsMatch[1].includes('Update your passions')) {
      profile.interests = passionsMatch[1].split(/[,]+/).map(s => s.trim()).filter(Boolean);
      console.log(`[FlirtEasy] Found passions: ${profile.interests.join(', ')}`);
    }

    // 5. Height
    const heightMatch = pageText.match(/HEIGHT\s*\n([^\n]+)/i);
    if (heightMatch && !heightMatch[1].includes('RELATIONSHIP')) {
      profile.height = heightMatch[1].trim();
    }

    // 6. Relationship Goals & Type
    const relGoalsMatch = pageText.match(/RELATIONSHIP GOALS\s*\n(?:Looking for\s*\n)?([^\n]+)/i);
    if (relGoalsMatch) {
      profile.lookingFor = relGoalsMatch[1].trim();
    }
    const relTypeMatch = pageText.match(/RELATIONSHIP TYPE\s*\n(?:Open to\.\.\.\s*\n)?([^\n]+)/i);
    if (relTypeMatch) {
      profile.relationshipType = relTypeMatch[1].trim();
    }

    // 7. Languages
    const langMatch = pageText.match(/LANGUAGES I KNOW\s*\n(?:Add languages\s*\n)?([^\n]+)/i);
    if (langMatch && !langMatch[1].includes('BASICS')) {
      profile.languages = langMatch[1].split(/[,]+/).map(s => s.trim()).filter(Boolean);
    }

    // 8. Basics
    const basicsMatch = pageText.match(/BASICS\s*\n([\s\S]*?)LIFESTYLE/i);
    if (basicsMatch) {
      const bText = basicsMatch[1];
      const zodiacM = bText.match(/Zodiac\s*\n([^\n]+)/i);
      if (zodiacM) profile.zodiac = zodiacM[1].trim();
      const eduM = bText.match(/Education\s*\n([^\n]+)/i);
      if (eduM) profile.education = eduM[1].trim();
      const familyM = bText.match(/Family Plans\s*\n([^\n]+)/i);
      if (familyM) profile.familyPlans = familyM[1].trim();
      const commM = bText.match(/Communication Style\s*\n([^\n]+)/i);
      if (commM) profile.communicationStyle = commM[1].trim();
      const loveM = bText.match(/Love Style\s*\n([^\n]+)/i);
      if (loveM) profile.loveStyle = loveM[1].trim();
    }

    // 9. Lifestyle
    const lifeMatch = pageText.match(/LIFESTYLE\s*\n([\s\S]*?)JOB TITLE/i);
    if (lifeMatch) {
      const lText = lifeMatch[1];
      const petsM = lText.match(/Pets\s*\n([^\n]+)/i);
      if (petsM) { profile.pets = petsM[1].trim(); profile.userPets = profile.pets; }
      const drinkM = lText.match(/Drinking\s*\n([^\n]+)/i);
      if (drinkM) profile.drinking = drinkM[1].trim();
      const smokeM = lText.match(/Smoking\s*\n([^\n]+)/i);
      if (smokeM) profile.smoking = smokeM[1].trim();
      const workoutM = lText.match(/Workout\s*\n([^\n]+)/i);
      if (workoutM) profile.workout = workoutM[1].trim();
      const socialM = lText.match(/Social Media\s*\n([^\n]+)/i);
      if (socialM) profile.socialMedia = socialM[1].trim();
    }

    // 10. Gender
    const genderMatch = pageText.match(/GENDER\s*\n([^\n]+)/i);
    if (genderMatch && !genderMatch[1].includes('Update your gender')) {
      profile.gender = genderMatch[1].trim();
    }

    // 11. Living In / City
    const cityMatch = pageText.match(/LIVING IN\s*\n([^\n]+)/i);
    if (cityMatch && !cityMatch[1].includes('Add City')) {
      profile.city = cityMatch[1].trim();
    }

    // If we got valid bio/name from the edit page, return immediately
    if (profile.bio || profile.name || profile.interests.length > 0) {
      console.log('[FlirtEasy] Successfully extracted profile from edit page:', profile);
      return profile;
    }
  }

  // ── LAYER 2: Auto-click Edit button and switch to Preview tab (legacy fallback) ──
  let editButton = null;
  for (let i = 0; i < 6; i++) {
    editButton = document.querySelector('button[aria-label="Edit profile"]') ||
      Array.from(document.querySelectorAll('button, a')).find(btn => btn.textContent.trim() === 'Edit' || btn.textContent.trim() === 'Edit Profile');
    if (editButton) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (editButton) {
    console.log('[FlirtEasy] Clicking Edit button to open profile editor');
    editButton.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click Preview tab using role="tab" selector
    let previewTab = null;
    for (let i = 0; i < 6; i++) {
      previewTab = document.querySelector('button[role="tab"][aria-selected="false"]') ||
        Array.from(document.querySelectorAll('button[role="tab"]')).find(btn =>
          btn.textContent.trim() === 'Preview'
        );
      if (previewTab) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (previewTab) {
      console.log('[FlirtEasy] Clicking Preview tab');
      previewTab.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const viewAllButtons = document.querySelectorAll('button');
      const expandButtons = Array.from(viewAllButtons).filter(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('view all') || text.includes('view more');
      });

      for (const btn of expandButtons) {
        btn.click();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  // Extract name and age from profile preview
  const nameAgeSection = document.querySelector('h1');
  if (nameAgeSection) {
    const text = nameAgeSection.textContent.trim();
    const match = text.match(/^(.+?)(\d+)$/);
    if (match) {
      profile.name = match[1].trim();
      profile.age = parseInt(match[2]);
      console.log(`[FlirtEasy] Found name: ${profile.name}, age: ${profile.age}`);
    }
  }

  // Extract bio from Preview panel - look for "About me" section
  const aboutMeSection = Array.from(document.querySelectorAll('div')).find(el =>
    el.textContent.startsWith('About me') && el.children.length > 0
  );
  if (aboutMeSection) {
    const bioText = aboutMeSection.textContent.replace('About me', '').trim();
    if (bioText && bioText.length > 10) {
      profile.bio = bioText;
      console.log(`[FlirtEasy] Found bio: ${profile.bio.substring(0, 50)}...`);
    }
  } else {
    console.log('[FlirtEasy] About me section not found');
  }

  // Extract interests - look for section with h2 containing "Interests"
  const interestsSection = Array.from(document.querySelectorAll('section')).find(section => {
    const h2 = section.querySelector('h2');
    return h2 && h2.textContent.trim() === 'Interests';
  });

  if (interestsSection) {
    // Get all span elements with the passion text class
    const interestSpans = interestsSection.querySelectorAll('span[class*="passions"]');
    profile.interests = Array.from(interestSpans).map(span => span.textContent.trim()).filter(t => t.length > 0);
    console.log(`[FlirtEasy] Found interests: ${profile.interests.join(', ')}`);
  } else {
    console.log('[FlirtEasy] Interests section not found');
  }

  // Extract essentials (height, job, school) from Preview panel OR profile card
  let essentialsSection = Array.from(document.querySelectorAll('div')).find(el =>
    el.textContent.startsWith('Essentials')
  );

  if (!essentialsSection) {
    // Try from profile card
    const profileCard = document.querySelector('[class*="profileCard"]');
    if (profileCard) {
      essentialsSection = Array.from(profileCard.querySelectorAll('div')).find(el =>
        el.textContent.includes('Essentials')
      );
    }
  }

  if (essentialsSection) {
    // Get all child divs that contain actual data
    const childDivs = Array.from(essentialsSection.querySelectorAll('div'))
      .map(div => div.textContent.trim())
      .filter(text => text.length > 2 && text.length < 150 && text !== 'Essentials');

    console.log(`[FlirtEasy] Essentials child divs:`, childDivs);

    // Extract height
    const heightDiv = childDivs.find(text => text.match(/^\d+\s*cm$/));
    if (heightDiv) {
      profile.height = heightDiv;
      console.log(`[FlirtEasy] Found height: ${profile.height}`);
    }

    // Extract job - usually comes after height, doesn't contain keywords
    const jobDiv = childDivs.find(text =>
      !text.includes('cm') &&
      !text.includes('English') &&
      !text.includes('Hebrew') &&
      !text.includes('Russian') &&
      !text.includes('Persian') &&
      !text.includes('School') &&
      !text.includes('University') &&
      !text.includes('College') &&
      text.length > 5
    );
    if (jobDiv) {
      profile.job = jobDiv;
      console.log(`[FlirtEasy] Found job: ${profile.job}`);
    }

    // Extract school - contains School/University/College keywords
    const schoolDiv = childDivs.find(text =>
      (text.includes('School') || text.includes('University') || text.includes('College')) &&
      text !== profile.job
    );
    if (schoolDiv) {
      profile.school = schoolDiv;
      console.log(`[FlirtEasy] Found school: ${profile.school}`);
    }

    // Extract languages from Essentials (user's own languages)
    const languagesDiv = childDivs.find(text =>
      (text.includes('English') || text.includes('Hebrew') || text.includes('Russian') ||
        text.includes('Spanish') || text.includes('French') || text.includes('German')) &&
      !text.includes('cm') && text !== profile.job && text !== profile.school
    );
    if (languagesDiv) {
      profile.languages = languagesDiv.split(',').map(l => l.trim()).filter(l => l.length > 0);
      console.log(`[FlirtEasy] Found languages: ${profile.languages.join(', ')}`);
    }
  } else {
    console.log('[FlirtEasy] Essentials section not found');
  }

  // Extract Basics and Lifestyle sections from Preview panel
  const sections = document.querySelectorAll('section');
  console.log(`[FlirtEasy] Found ${sections.length} sections in Preview panel`);
  sections.forEach(section => {
    const h2 = section.querySelector('h2');
    if (!h2) return;

    const sectionName = h2.textContent.trim();
    console.log(`[FlirtEasy] Processing section: ${sectionName}`);
    if (sectionName === 'Basics' || sectionName === 'Lifestyle') {
      const items = section.querySelectorAll('li');
      console.log(`[FlirtEasy] Found ${items.length} items in ${sectionName} section`);
      items.forEach(item => {
        const h3 = item.querySelector('h3');
        const valueDiv = item.querySelector('div.Typs\\(body-1-regular\\).C\\(\\$c-ds-text-primary\\)');

        console.log(`[FlirtEasy] Item h3: ${h3 ? h3.textContent.trim() : 'null'}, valueDiv: ${valueDiv ? valueDiv.textContent.trim() : 'null'}`);

        if (h3 && valueDiv) {
          const fieldName = h3.textContent.trim();
          const fieldValue = valueDiv.textContent.trim();

          // Map to profile fields
          if (fieldName === 'Education' && !profile.education) {
            profile.education = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          } else if (fieldName === 'Communication Style' && !profile.communicationStyle) {
            profile.communicationStyle = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          } else if (fieldName === 'Zodiac' && !profile.zodiac) {
            profile.zodiac = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          } else if (fieldName === 'Workout' && !profile.workout) {
            profile.workout = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          } else if (fieldName === 'Drinking' && !profile.drinking) {
            profile.drinking = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          } else if (fieldName === 'Smoking' && !profile.smoking) {
            profile.smoking = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          } else if (fieldName === 'Sleeping Habits' && !profile.sleepingHabits) {
            profile.sleepingHabits = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          } else if (fieldName === 'Pets' && !profile.userPets) {
            profile.userPets = fieldValue;
            console.log(`[FlirtEasy] Found from ${sectionName}: ${fieldName} = ${fieldValue}`);
          }
        }
      });
    }
  });

  // Extract all menu items with values
  // Use centralized selector from config
  let menuItems = [];
  if (window.SELECTORS && window.SELECTORS.profile.menuItems) {
    menuItems = findElements(window.SELECTORS.profile.menuItems);
  } else {
    // Fallback if selectors not loaded
    menuItems = document.querySelectorAll('.menuItem__contents');
  }

  console.log(`[FlirtEasy] Found ${menuItems.length} menu items`);

  menuItems.forEach(item => {
    const ariaLabel = item.getAttribute('aria-label') || '';

    // Extract height
    if (ariaLabel.includes('cm') && ariaLabel.includes('Height')) {
      const heightMatch = ariaLabel.match(/(\d+)\s*cm/);
      if (heightMatch) {
        profile.height = heightMatch[1] + ' cm';
        console.log(`[FlirtEasy] Found height: ${profile.height}`);
      }
    }

    // Extract city
    const labelEl = item.querySelector('span.Maw\\(80\\%\\)');
    if (labelEl && labelEl.textContent.includes('Add City')) {
      // City not set, skip
    } else if (labelEl && item.querySelector('#living_in')) {
      const cityText = labelEl.textContent.trim();
      if (cityText && !cityText.includes('Add City')) {
        profile.city = cityText;
        console.log(`[FlirtEasy] Found city: ${profile.city}`);
      }
    }

    // Extract gender
    if (ariaLabel.includes('gender') || item.querySelector('#gender')) {
      const genderEl = item.querySelector('span.Maw\\(80\\%\\)');
      if (genderEl) {
        const genderText = genderEl.textContent.replace('Update your gender', '').trim();
        if (genderText) {
          profile.gender = genderText;
          console.log(`[FlirtEasy] Found gender: ${profile.gender}`);
        }
      }
    }

    // Fallback: extract gender from the dedicated gender edit link (current Tinder UI)
    if (!profile.gender) {
      const genderLink = document.querySelector('a[href="/app/profile/edit/gender"]');
      if (genderLink) {
        const raw = genderLink.innerText?.trim() || '';
        const genderText = raw.replace(/update your gender/i, '').trim();
        if (genderText) {
          profile.gender = genderText;
          console.log(`[FlirtEasy] Found gender (link fallback): ${profile.gender}`);
        }
      }
    }

    // Extract sexual orientation
    if (ariaLabel.includes('sexual orientation') || item.querySelector('#sexual_orientation')) {
      const orientationEl = item.querySelector('span.Maw\\(80\\%\\)');
      if (orientationEl) {
        const orientationText = orientationEl.textContent.replace('Update your sexual orientation', '').trim();
        if (orientationText) {
          profile.sexualOrientation = orientationText;
          console.log(`[FlirtEasy] Found sexual orientation: ${profile.sexualOrientation}`);
        }
      }
    }

    // Get label - try multiple selectors
    let label = '';
    const labelEl1 = item.querySelector('span.Maw\\(80\\%\\)');
    const labelEl2 = item.querySelector('span.Ov\\(h\\)');

    if (labelEl1) {
      label = labelEl1.textContent.trim();
    } else if (labelEl2) {
      label = labelEl2.textContent.trim();
    }

    if (!label) {
      return;
    }

    // Get value from menuItem__select span
    const valueEl = item.querySelector('.menuItem__select span[aria-hidden="true"]');
    if (!valueEl) return;

    const value = valueEl.textContent.trim();

    // Skip if value is "Select" or "Add" (not filled)
    if (value === 'Select' || value === 'Add' || !value) return;

    console.log(`[FlirtEasy] Found: ${label} = ${value}`);

    // Map to profile fields
    if (label.includes('Location')) {
      profile.location = value;
    } else if (label.includes('Distance Preference')) {
      if (value && value.trim() && value !== 'km.' && value !== 'km') {
        profile.distancePreference = value;
        console.log(`[FlirtEasy] Saved distancePreference: ${value}`);
      } else {
        console.log(`[FlirtEasy] Skipped invalid distance value: ${value}`);
      }
    } else if (label.includes('Interested In') || (label.includes('Looking for') && value === 'Women')) {
      profile.interestedIn = value;
    } else if (label.includes('Looking for') && value !== 'Women') {
      profile.lookingFor = value;
    } else if (label.includes('language')) {
      profile.preferredLanguages = value.split(',').map(l => l.trim());
    } else if (label.includes('Zodiac')) {
      profile.zodiac = value;
    } else if (label.includes('Education')) {
      profile.education = value;
    } else if (label.includes('Family')) {
      profile.familyPlans = value;
    } else if (label.includes('Communication')) {
      profile.communicationStyle = value;
    } else if (label.includes('Love')) {
      profile.loveStyle = value;
    } else if (label.includes('Pets')) {
      profile.pets = value;
    } else if (label.includes('Drinking')) {
      profile.drinking = value;
    } else if (label.includes('Smoking')) {
      profile.smoking = value;
    } else if (label.includes('Workout')) {
      profile.workout = value;
    } else if (label.includes('Sleeping')) {
      profile.sleepingHabits = value;
    } else if (label.includes('Dietary')) {
      profile.dietaryPreference = value;
    } else if (label.includes('Social')) {
      profile.socialMedia = value;
    }
  });

  // Gender fallback: the Edit tab has a direct link to the gender edit page
  // with the current value as its text content. This works even when the
  // Preview tab sections don't expose gender explicitly.
  if (!profile.gender) {
    const genderLink = document.querySelector('a[href="/app/profile/edit/gender"]');
    if (genderLink) {
      const raw = genderLink.innerText?.trim() || '';
      const genderText = raw.replace(/update your gender/i, '').trim();
      if (genderText) {
        profile.gender = genderText;
        console.log('[FlirtEasy] Found gender (link fallback):', profile.gender);
      }
    }
  }

  console.log('[FlirtEasy] Profile extraction result:', profile);
  return profile;
}

async function updateTinderBio(newBio) {
  try {
    console.log('[FlirtEasy] updateTinderBio called with bio:', newBio);
    console.log('[FlirtEasy] Current URL:', window.location.href);

    // 1. Ensure on edit profile page
    if (!window.location.pathname.includes('/app/profile/edit')) {
      console.log('[FlirtEasy] Navigating to /app/profile/edit...');
      window.location.href = 'https://tinder.com/app/profile/edit';
      await new Promise(r => setTimeout(r, 2500));
    }

    // 2. Wait for bio textarea to load
    console.log('[FlirtEasy] Looking for bio textarea...');
    let bioTextarea = null;
    for (let i = 0; i < 20; i++) {
      bioTextarea = document.querySelector('textarea[maxlength="500"]') || document.querySelector('textarea');
      if (bioTextarea) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (!bioTextarea) {
      console.error('[FlirtEasy] Bio textarea not found after retries');
      return { success: false, error: 'Bio field not found' };
    }

    console.log('[FlirtEasy] Found bio textarea, updating value...');

    // 3. React-compatible native value setter
    bioTextarea.focus();
    const proto = window.HTMLTextAreaElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(bioTextarea, newBio);
    } else {
      bioTextarea.value = newBio;
    }

    bioTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    bioTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    bioTextarea.blur();

    // 4. Save via Tinder Web API
    console.log('[FlirtEasy] Visual update complete, saving via API...');
    let authToken = null;
    try {
      authToken = localStorage.getItem('TinderWeb/APIToken');
      if (!authToken) {
        const tinderData = localStorage.getItem('TinderWeb/APIStore');
        if (tinderData) {
          const parsed = JSON.parse(tinderData);
          authToken = parsed?.token || parsed?.auth_token || parsed?.user?.api_token;
        }
      }
    } catch (e) { }

    if (!authToken) {
      try {
        authToken = sessionStorage.getItem('authToken') || sessionStorage.getItem('x-auth-token');
      } catch (e) { }
    }

    if (!authToken) {
      authToken = document.cookie.split('; ').find(row => row.startsWith('x-auth-token='))?.split('=')[1];
    }

    let apiSuccess = false;
    if (authToken) {
      try {
        console.log('[FlirtEasy] Making profile API update call...');
        const response = await fetch('https://api.gotinder.com/v2/profile?locale=en', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authToken,
            'app-version': '1064501',
            'platform': 'web',
            'tinder-version': '6.45.1'
          },
          body: JSON.stringify({ user: { bio: newBio } })
        });
        const data = await response.json();
        apiSuccess = data?.meta?.status === 200;
        console.log('[FlirtEasy] API update result:', apiSuccess);
      } catch (apiErr) {
        console.warn('[FlirtEasy] API update warning:', apiErr.message);
      }
    }

    // 5. Commit UI by clicking 'Done' button
    const doneBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.trim() === 'Done');
    if (doneBtn) {
      console.log('[FlirtEasy] Clicking Done button to commit...');
      doneBtn.click();
    }

    // 6. Update local extension storage
    try {
      const s = (await chrome.storage.local.get('settings')).settings || {};
      s.userProfile = s.userProfile || {};
      s.userProfile.bio = newBio;
      await chrome.storage.local.set({ settings: s });
    } catch (_) {}

    return { success: true, apiSuccess, bio: newBio };
  } catch (e) {
    console.error('[FlirtEasy] updateTinderBio error:', e);
    return { success: false, error: e.message };
  }
}
