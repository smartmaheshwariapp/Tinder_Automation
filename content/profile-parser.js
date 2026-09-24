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

function getInterceptedProfileViaEvent(matchId) {
  let receivedPerson = null;
  const responseHandler = function (event) {
    if (event.detail.matchId === matchId) {
      receivedPerson = event.detail.person;
      document.removeEventListener('flirteasy:matchProfileResponse', responseHandler);
    }
  };
  document.addEventListener('flirteasy:matchProfileResponse', responseHandler);
  document.dispatchEvent(new CustomEvent('flirteasy:getMatchProfile', {
    detail: { matchId }
  }));
  if (receivedPerson) {
    return _formatPersonObjectToProfile(receivedPerson);
  }
  document.removeEventListener('flirteasy:matchProfileResponse', responseHandler);
  return null;
}

function _formatPersonObjectToProfile(person) {
  if (!person) return null;

  let age = null;
  if (person.birth_date) {
    const bDate = new Date(person.birth_date);
    const diff = Date.now() - bDate.getTime();
    age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  }

  const questionAnswers = (person.question_answers || []).map(qa => ({
    question: qa.question || '',
    answer: qa.answer || ''
  }));

  const interests = (person.user_interests || []).map(i => i.name || '').filter(Boolean);

  const job = person.jobs?.[0]?.title?.name
    ? (person.jobs[0].title.name + (person.jobs[0].company?.name ? ` at ${person.jobs[0].company.name}` : ''))
    : null;
  const school = person.schools?.[0]?.name || null;
  const city = person.city?.name || null;

  const descriptors = (person.selected_descriptors || []).map(d => {
    const choices = (d.choice_selections || []).map(c => c.name).join(', ');
    return choices ? `${d.name}: ${choices}` : null;
  }).filter(Boolean);

  return {
    name: person.name,
    age: age || null,
    bio: (person.bio || '').trim() || null,
    interests,
    questionAnswers,
    job,
    school,
    city,
    descriptors,
    platform: 'tinder'
  };
}

async function fetchMatchProfileFromApi(matchId) {
  if (!matchId) return null;

  // 1. Check CustomEvent bridge to api-interceptor first
  const cached = getInterceptedProfileViaEvent(matchId);
  if (cached && (cached.bio || cached.interests?.length > 0 || cached.questionAnswers?.length > 0)) {
    return cached;
  }

  // 2. Direct fetch using captured token
  let token = null;
  try {
    token = localStorage.getItem('TinderWeb/APIToken');
    if (!token) {
      const s = localStorage.getItem('TinderWeb/APIStore');
      if (s) {
        const p = JSON.parse(s);
        token = p?.token || p?.auth_token || p?.user?.api_token;
      }
    }
  } catch (_) {}

  if (!token && typeof window !== 'undefined' && window.__tinderAuthToken) {
    token = window.__tinderAuthToken;
  }

  if (!token) return null;

  try {
    console.log(`[FlirtEasy] Fetching full profile from Tinder API for matchId ${matchId}...`);
    const res = await fetch(`https://api.gotinder.com/v2/matches/${matchId}?locale=en`, {
      method: 'GET',
      headers: {
        'x-auth-token': token,
        'app-version': '1064501',
        'platform': 'web',
        'tinder-version': '6.45.1'
      }
    });

    if (!res.ok) {
      console.warn(`[FlirtEasy] Match API returned status ${res.status}`);
      return null;
    }

    const json = await res.json();
    const person = json?.data?.person;
    if (!person) return null;

    return _formatPersonObjectToProfile(person);
  } catch (err) {
    console.warn('[FlirtEasy] fetchMatchProfileFromApi error:', err);
    return null;
  }
}

function parseMobileProfileSheet() {
  const profile = {
    name: null,
    age: null,
    bio: null,
    interests: [],
    questionAnswers: [],
    job: null,
    school: null,
    city: null,
    descriptors: [],
    platform: 'tinder'
  };

  const bodyText = document.body.innerText || '';

  // 1. Name & Age from top of sheet (e.g. "Mallory 24")
  const nameAgeMatch = bodyText.match(/([A-Z][a-zA-Z\s'-]+)\s+(\d{2})\b/);
  if (nameAgeMatch && !nameAgeMatch[1].toLowerCase().includes('tinder')) {
    profile.name = nameAgeMatch[1].trim();
    profile.age = parseInt(nameAgeMatch[2]);
  }
  if (!profile.name) {
    profile.name = getMatchName();
  }

  // 2. Bio from "About me"
  const allElements = Array.from(document.querySelectorAll('div, h2, h3, h4, span, p'));
  const aboutMeEl = allElements.find(el => (el.textContent || '').trim().toLowerCase() === 'about me' && el.children.length === 0);
  if (aboutMeEl) {
    const nextEl = aboutMeEl.parentElement?.querySelector('p, span, div:not(:first-child)') || aboutMeEl.nextElementSibling;
    if (nextEl) {
      const bioText = (nextEl.textContent || '').trim();
      if (bioText && bioText.length > 2 && !bioText.toLowerCase().includes('about me')) {
        profile.bio = bioText;
      }
    }
  }
  if (!profile.bio) {
    const bioRegexMatch = bodyText.match(/About me\s*\n+([^\n]+)/i);
    if (bioRegexMatch && bioRegexMatch[1].trim().length > 2) {
      profile.bio = bioRegexMatch[1].trim();
    }
  }

  // 3. Question Prompts
  const promptRegex = /(?:My sense of humor is basically just\.\.\.|I can beat you in a game of\.\.\.|My latest hyperfixation is\.\.\.|The best way to ask me out is\.\.\.|I'm looking for\.\.\.|A life goal of mine\.\.\.|Two truths and a lie\.\.\.|I geek out on\.\.\.|Together people could\.\.\.|My simple pleasures\.\.\.|Teach me something about\.\.\.)\s*\n+([^\n]+)/gi;
  let pMatch;
  while ((pMatch = promptRegex.exec(bodyText)) !== null) {
    const fullMatch = pMatch[0].split('\n').map(s => s.trim()).filter(Boolean);
    if (fullMatch.length >= 2) {
      const q = fullMatch[0];
      const a = fullMatch[1];
      if (q && a && !profile.questionAnswers.some(item => item.question === q)) {
        profile.questionAnswers.push({ question: q, answer: a });
      }
    }
  }

  const promptContainers = document.querySelectorAll('[class*="prompt" i], [class*="Prompt" i], [class*="card" i]');
  promptContainers.forEach(card => {
    const lines = (card.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2 && lines[0].includes('...')) {
      const q = lines[0];
      const a = lines[1];
      if (q && a && !profile.questionAnswers.some(item => item.question === q)) {
        profile.questionAnswers.push({ question: q, answer: a });
      }
    }
  });

  // 4. Interests
  const interestsEl = allElements.find(el => (el.textContent || '').trim().toLowerCase() === 'interests' && el.children.length === 0);
  if (interestsEl) {
    const container = interestsEl.parentElement || interestsEl.closest('section') || interestsEl.closest('div');
    if (container) {
      const chips = container.querySelectorAll('button, [role="button"], [class*="pill" i], [class*="chip" i], [class*="passions" i], span, li');
      chips.forEach(chip => {
        const txt = (chip.textContent || '').trim();
        if (txt && txt.length >= 2 && txt.length <= 35 && txt.toLowerCase() !== 'interests' && !profile.interests.includes(txt)) {
          if (!txt.toLowerCase().includes('unmatch') && !txt.toLowerCase().includes('block')) {
            profile.interests.push(txt);
          }
        }
      });
    }
  }

  // 5. Essentials
  const jobMatch = bodyText.match(/(?:Assistant Manager|Manager|Director|Engineer|Designer|Developer|Specialist|Teacher|Nurse|Doctor|Consultant|Founder|Student|Barista|Chef|Artist|Coordinator|Associate)[^\n,]+/i);
  if (jobMatch) {
    profile.job = jobMatch[0].trim();
  }

  const schoolMatch = bodyText.match(/([A-Z][a-zA-Z\s'-]+(?:highschool|high school|university|college|academy))\b/i);
  if (schoolMatch) {
    profile.school = schoolMatch[1].trim();
  }

  const cityMatch = bodyText.match(/Lives in\s+([^\n]+)/i);
  if (cityMatch) {
    profile.city = cityMatch[1].trim();
  }

  // 6. Descriptors
  const descriptors = [];
  if (bodyText.includes('Workout\nNever') || bodyText.match(/Workout\s*\n\s*Never/i)) {
    descriptors.push('Workout: Never');
  }
  if (bodyText.includes('Long-term, open to short')) {
    descriptors.push('Looking for: Long-term, open to short');
  }
  profile.descriptors = descriptors;

  return profile;
}

async function fetchOrParseMatchProfile(matchId) {
  // 1. Try API first (highest accuracy, zero DOM scraping error)
  if (matchId) {
    const apiProfile = await fetchMatchProfileFromApi(matchId);
    if (apiProfile && (apiProfile.bio || apiProfile.interests?.length > 0 || apiProfile.questionAnswers?.length > 0 || apiProfile.job)) {
      console.log('[FlirtEasy] ✅ Successfully retrieved rich profile via API:', apiProfile);
      return apiProfile;
    }
  }

  // 2. Try desktop profile panel DOM (if available)
  const domProfile = parseCurrentProfile();
  if (domProfile && (domProfile.bio || domProfile.interests?.length > 0 || domProfile.questionAnswers?.length > 0)) {
    console.log('[FlirtEasy] ✅ Successfully retrieved profile via desktop DOM panel:', domProfile);
    return domProfile;
  }

  // 3. Mobile fallback: expand profile sheet from chat header to read profile in DOM
  try {
    const headerTrigger = document.querySelector(
      'header [class*="avatar" i], header img, header [class*="Avatar" i], header h2, header h3, header [class*="bold" i], [data-testid="chatHeader"]'
    );
    if (headerTrigger) {
      console.log('[FlirtEasy] Mobile view: Expanding profile sheet from chat header to inspect profile details...');
      headerTrigger.click();
      await new Promise(r => setTimeout(r, 600));

      const sheetProfile = parseMobileProfileSheet();

      // Close profile sheet (tap down arrow / back / close button)
      const closeBtn = document.querySelector(
        'button[aria-label*="close" i], button[aria-label*="back" i], [class*="close" i], header button'
      );
      if (closeBtn) {
        closeBtn.click();
        await new Promise(r => setTimeout(r, 400));
      } else {
        headerTrigger.click();
        await new Promise(r => setTimeout(r, 400));
      }

      if (sheetProfile && (sheetProfile.bio || sheetProfile.interests?.length > 0 || sheetProfile.questionAnswers?.length > 0)) {
        console.log('[FlirtEasy] ✅ Successfully retrieved rich profile via mobile sheet DOM:', sheetProfile);
        return sheetProfile;
      }
    }
  } catch (sheetErr) {
    console.warn('[FlirtEasy] Mobile profile sheet inspection failed:', sheetErr);
  }

  return domProfile || { name: getMatchName(), platform: 'tinder' };
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

      // (Note: Live DOM parsing takes precedence over stale storage messages)
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

  if (messages.length > 0) {
    if (matchId) {
      saveMatchMetadata(matchId, { conversationHistory: messages.slice(-100) }).catch(() => {});
    }
    return { messages, apiMessages: [] };
  }

  // Fallback to storage only if live DOM yielded no messages (e.g. DOM still rendering)
  if (storageMessages && storageMessages.length > 0) {
    console.log(`[FlirtEasy] Using ${storageMessages.length} messages from storage (DOM empty)`);
    return { messages: storageMessages.slice(-limit), apiMessages: [] };
  }

  return { messages: [], apiMessages: [] };
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

    // Unread Indicator Detection (classes, atomic CSS, attributes, and visual badge dots)
    const unreadIndicator = item.querySelector(
      '.unread, .badge, [data-testid*="unread" i], [data-testid*="badge" i], [aria-label*="New Message" i], [aria-label*="unread" i], ' +
      '.Bgc\\(\\$c-ds-background-brand\\), .Bgc\\(\\$c-ds-background-accent-red\\), [class*="background-brand" i], [class*="background-accent" i], ' +
      'div[class*="Bdrs(50%)"][class*="Bgc("], span[class*="Bdrs(50%)"][class*="Bgc("]'
    );
    let hasUnread = !!unreadIndicator;
    if (!hasUnread) {
      // Visual inspection for small circular red/coral badge dots next to avatar
      const dots = item.querySelectorAll('div, span');
      for (const d of dots) {
        const r = d.getBoundingClientRect();
        if (r.width > 0 && r.width <= 18 && r.height > 0 && r.height <= 18) {
          const style = window.getComputedStyle(d);
          const bg = style.backgroundColor || '';
          if (bg && (bg.includes('254') || bg.includes('255') || bg.includes('238') || bg.includes('rgb(25') || bg.includes('rgb(24') || bg.includes('rgb(23'))) {
            if (style.borderRadius.includes('50%') || style.borderRadius.includes('9999px') || style.borderRadius.includes('8px')) {
              hasUnread = true;
              break;
            }
          }
        }
      }
    }

    // 3. TINDER "YOUR MOVE" DETECTION (Cyan/Blue dot)
    const isYourMove = item.innerText.toLowerCase().includes('your move') ||
      !!item.querySelector('[class*="background-accent-cyan" i]');

    // 4. SENDER DETECTION (User Reply Arrow vs Match Reply)
    // On Tinder Web, if the user was the last sender, a reply arrow icon (SVG or ↩ / ←) is rendered in the snippet row.
    // If the match replied, there is NO reply arrow and the text begins directly with her message.
    const replySvg = item.querySelector('div[class*="snippet" i] svg, .message-content svg, svg[aria-label*="reply" i]');
    const hasReplyArrow = Boolean(replySvg) || snippet.startsWith('↩') || snippet.startsWith('←') || snippet.startsWith('↵');

    const hiddenText = item.querySelector('span.Hidden')?.textContent || "";
    const hiddenLower = hiddenText.toLowerCase();
    const hiddenSaysBotSent = hiddenLower.includes('your last message was:');
    const hiddenSaysSheReplied = hiddenText.length > 0 && !hiddenSaysBotSent && hiddenLower.includes("last message was:");

    const botSentLast = hasReplyArrow || hiddenSaysBotSent;
    // Match replied last if: unread badge exists, OR accessibility says so, OR snippet has text without user reply arrow (and not uncontacted / your move)
    const sheRepliedLast = hasUnread || hiddenSaysSheReplied || (!botSentLast && snippet.length > 0 && !isYourMove);

    const rawHref = item.getAttribute('href') || '';
    const matchId = rawHref.split('?')[0].replace(/\/+$/, '').split('/').pop();

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
  const matches = [];
  const seenIds = new Set();

  // 1. Gather all candidate links across both desktop and mobile selectors
  const candidateLinks = Array.from(document.querySelectorAll(
    'a.matchListItem, [data-testid*="matchListItem"], a[href*="/app/messages/"], a[href*="/app/my-matches/"]'
  ));

  // 2. Identify "New matches" and "Messages" section boundaries
  const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, div, span'));
  const newMatchesHeading = allHeadings.find(el => {
    const txt = (el.textContent || '').trim().toLowerCase();
    return (txt === 'new matches' || txt === 'new match') && (!el.firstElementChild || el.children.length <= 1);
  });
  const messagesHeading = allHeadings.find(el => {
    const txt = (el.textContent || '').trim().toLowerCase();
    return (txt === 'messages' || txt === 'conversations') && (!el.firstElementChild || el.children.length <= 1);
  });

  candidateLinks.forEach((card, index) => {
    const href = card.getAttribute('href') || '';
    const isMsgLink = href.includes('/app/messages/') || href.includes('/app/my-matches/');
    if (!isMsgLink) return;

    // Filter out likes you / gold links
    if (href.includes('/app/likes-you') || href.includes('/app/my-likes') || href.includes('/app/gold-home')) {
      return;
    }

    const pathParts = href.split('?')[0].split('/').filter(Boolean);
    const matchId = pathParts.length > 0 ? pathParts[pathParts.length - 1] : null;
    if (!matchId || matchId === 'messages' || matchId === 'my-matches') return;

    if (seenIds.has(matchId)) return;

    // Extract name robustly
    let name = '';
    const nameEl = card.querySelector('h3, [class*="bold" i], [class*="Primary" i], .Ell');
    if (nameEl) {
      name = nameEl.textContent.trim();
    }
    if (!name) {
      const aria = card.getAttribute('aria-label') || card.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
      if (aria && !aria.toLowerCase().includes('like') && !aria.toLowerCase().includes('message')) {
        name = aria.trim();
      }
    }
    if (!name) {
      const lines = (card.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) name = lines[0];
    }
    name = (name || '').trim();

    // Filter out non-match cards like "1 Like", "99+ likes", "LIVE", etc.
    const nameLower = name.toLowerCase();
    if (
      nameLower.includes('like') ||
      nameLower.includes('likes') ||
      nameLower.includes('live') ||
      nameLower === 'say hello' ||
      nameLower.includes('tap on a new match')
    ) {
      return;
    }

    if (!name) name = `Match ${index + 1}`;

    // On mobile, distinguish new matches from existing conversation list rows:
    // 1) Position before the "Messages" heading
    // 2) Or has no conversation snippet
    const snippetEl = card.querySelector('div[class*="snippet" i], div.text-ellipsis + div, .message-content');
    const snippet = snippetEl ? snippetEl.innerText.trim() : '';

    let isUnderNewMatches = false;
    if (newMatchesHeading && messagesHeading) {
      const compare = card.compareDocumentPosition(messagesHeading);
      if (compare & Node.DOCUMENT_POSITION_FOLLOWING) {
        // card appears before messagesHeading in DOM order
        isUnderNewMatches = true;
      }
    } else if (newMatchesHeading) {
      isUnderNewMatches = true;
    }

    // A card is a New Match if it is under the "New matches" section, has .matchListItem, or has no message snippet:
    const isNewMatchCard = isUnderNewMatches || card.classList.contains('matchListItem') || !snippet;
    if (isNewMatchCard) {
      seenIds.add(matchId);
      matches.push({
        matchId,
        name,
        element: card,
        isNew: true,
      });
    }
  });

  return matches;
}

function navigateToMatch(matchId) {
  const selectors = [
    `a[href="/app/messages/${matchId}"]`,
    `a[href^="/app/messages/${matchId}"]`,
    `a[href*="/app/my-matches/${matchId}"]`,
    `a[href*="${matchId}"]`
  ];

  for (const selector of selectors) {
    const matchLink = document.querySelector(selector);
    if (matchLink) {
      console.log(`[FlirtEasy] Found match link with selector: ${selector}`);
      try { matchLink.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (_) {}
      matchLink.click();
      return true;
    }
  }

  console.log(`[FlirtEasy] Link not found for matchId: ${matchId}`);
  return false;
}

function isOnMatchesPage() {
  return window.location.pathname.includes('/app/messages') ||
    window.location.pathname.includes('/app/my-matches') ||
    window.location.pathname.includes('/app/matches') ||
    window.location.pathname.includes('/app/recs');
}

function isOnChatPage() {
  return (window.location.pathname.includes('/app/messages/') || window.location.pathname.includes('/app/my-matches/')) &&
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
