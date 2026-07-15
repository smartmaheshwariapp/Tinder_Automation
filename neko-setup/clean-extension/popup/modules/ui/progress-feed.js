/* ============================================
   PROGRESS FEED — 2026 Focal Snap-Scroll
   Chat-Style Logic: History Scrolled UP
   ============================================ */

const FEED_ICONS = {
  opener_sent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>`,
  message_replied: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"></path></svg>`,
  profile_liked: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"></path></svg>`,
  swipe_progress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>`,
  msg_progress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path><line x1="9" y1="10" x2="15" y2="10"></line></svg>`,
  match_detected: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="20 4 3 12 10 14 12 21 20 4"></polygon></svg>`,
  persona_update: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  cycle_complete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  handoff_detected: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
  rate_limit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  trial_ended: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h14l2-9-4 3-3-6-3 6-4-3 2 9z"/><path d="M5 18a1 1 0 0 0 0 2h14a1 1 0 0 0 0-2H5z"/></svg>`
};

const FEED_LABELS = {
  opener_sent: 'Opener Sent',
  message_replied: 'Reply Sent',
  profile_liked: 'Profile Liked',
  match_detected: 'New Match',
  persona_update: 'AI Update',
  cycle_complete: 'Cycle Complete',
  handoff_detected: 'High Interest Detected',
  error: 'Action Needed'
};

const FEED_DETAILS = {
  opener_sent: 'First message delivered',
  message_replied: 'Response delivered to match',
  profile_liked: 'Profile matched your targeting rules',
  match_detected: 'Added to messaging queue',
  persona_update: 'AI model updated for better results',
  cycle_complete: 'All tasks completed for this cycle',
  handoff_detected: 'This conversation may benefit from a personal touch',
  error: 'Something requires your attention'
};

function formatFeedTime(ts) {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 30) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function formatClockTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function truncateFeedText(text, maxLen = 56) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

function parseReplyTargetName(event) {
  if (event?.name && String(event.name).trim()) return String(event.name).trim();
  const detail = String(event?.detail || '');
  const match = detail.match(/replied\s+to\s+([^:]+)$/i) || detail.match(/reply\s+sent\s+to\s+([^:]+)$/i);
  return match ? match[1].trim() : '';
}

function createFeedItemElement(event) {
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.dataset.type = event.type;
  item.dataset.ts = event.timestamp;

  const main = document.createElement('div');
  main.className = 'feed-item-main';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'feed-item-icon-wrap';
  iconWrap.innerHTML = FEED_ICONS[event.type] || FEED_ICONS.error;

  const content = document.createElement('div');
  content.className = 'feed-item-content';

  const header = document.createElement('div');
  header.className = 'feed-item-header';

  const title = document.createElement('div');
  title.className = 'feed-item-title';

  const clockTime = document.createElement('div');
  clockTime.className = 'feed-item-clock';
  clockTime.textContent = formatClockTime(event.timestamp);

  const detail = document.createElement('div');
  detail.className = 'feed-item-detail';

  const ago = document.createElement('div');
  ago.className = 'feed-item-ago';
  ago.textContent = formatFeedTime(event.timestamp);

  const name = (event.name && !['tinder','bumble','hinge'].includes(String(event.name).trim().toLowerCase()))
    ? String(event.name).trim() : '';
  const snippet = truncateFeedText(event.detail, 64);

  switch (event.type) {
    case 'profile_liked':
      title.textContent = name ? `Liked ${name}'s Profile` : 'Profile Liked';
      detail.textContent = snippet || (name ? `${name}'s profile matched your preferences` : 'Profile matched your targeting rules');
      break;
    case 'opener_sent':
      title.textContent = name ? `Opener Sent to ${name}` : 'Opener Sent';
      detail.textContent = snippet ? `"${snippet}"` : (name ? `First message delivered to ${name}` : 'Personalized opener delivered');
      detail.classList.add('feed-item-detail--reply');
      break;
    case 'message_replied': {
      const targetName = parseReplyTargetName(event) || name;
      title.textContent = targetName ? `Reply Sent to ${targetName}` : 'Reply Sent';
      detail.textContent = snippet ? `"${snippet}"` : (targetName ? `Response delivered to ${targetName}` : 'Response delivered');
      detail.classList.add('feed-item-detail--reply');
      break;
    }
    case 'follow_up_sent':
      title.textContent = name ? `Follow-up Sent to ${name}` : 'Follow-up Sent';
      detail.textContent = snippet ? `"${snippet}"` : (name ? `Follow-up delivered to ${name}` : 'Follow-up message delivered');
      detail.classList.add('feed-item-detail--reply');
      break;
    case 'match_detected':
      title.textContent = name ? `New Match — ${name}` : 'New Match';
      detail.textContent = snippet || (name ? `${name} matched — added to messaging queue` : 'Added to messaging queue');
      break;
    case 'handoff_detected':
      title.textContent = name ? `High Interest: ${name}` : 'High Interest Detected';
      detail.textContent = snippet || (name ? `${name} is highly engaged — consider taking over` : 'This conversation may benefit from a personal touch');
      detail.classList.add('feed-item-detail--match');
      break;
    case 'cycle_complete':
      title.textContent = event.name ? `Session Cycle #${event.name} Complete` : 'Session Cycle Complete';
      detail.textContent = snippet || event.detail || 'All tasks completed for this cycle';
      break;
    case 'rate_limit': {
      const limitTitles = {
        safety_lock: 'All Limits Reached',
        message_limit: 'Message Limit Hit',
        like_limit: 'Swipe Limit Hit',
        caught_up: "You're All Caught Up!"
      };
      title.textContent = limitTitles[event.name] || 'Limit Reached';
      detail.textContent = snippet || event.detail || 'Paused — will resume automatically';
      break;
    }
    case 'swipe_progress':
      title.textContent = 'Swipe Progress';
      detail.textContent = snippet || event.detail || 'Swiping in progress';
      break;
    case 'msg_progress':
      title.textContent = 'Message Progress';
      detail.textContent = snippet || event.detail || 'Messaging in progress';
      break;
    case 'error':
      title.textContent = 'Action Needed';
      detail.textContent = snippet || 'Something requires your attention';
      detail.classList.add('feed-item-detail--alert');
      break;
    case 'trial_limit':
      title.textContent = 'Trial Messages Exhausted';
      detail.textContent = snippet || 'Trial msg limit reached — swipes continue';
      break;
    case 'trial_ended':
      title.textContent = 'Trial Ended';
      detail.textContent = snippet || 'All trial swipes & messages used — tap to upgrade ✦';
      detail.classList.add('feed-item-detail--trial-ended');
      break;
    default:
      return null;
  }

  header.appendChild(title);
  header.appendChild(clockTime);
  content.appendChild(header);
  content.appendChild(detail);
  content.appendChild(ago);
  main.appendChild(iconWrap);
  main.appendChild(content);
  item.appendChild(main);

  return item;
}

const MAX_HISTORY = 20;
let focalObserver = null;

function setupFocalObserver() {
  const list = document.getElementById('progressFeedList');
  if (!list) return;

  if (focalObserver) focalObserver.disconnect();

  // Enforce strictly ONE feed item per scroll tick to prevent Windows double-skipping
  if (!list._wheelBound) {
    let isScrolling = false;
    list.addEventListener('wheel', (e) => {
      // Allow horizontal scrolls to pass through (just in case)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      
      e.preventDefault();
      if (isScrolling) return;

      const firstItem = list.querySelector('.feed-item');
      if (!firstItem) return;

      isScrolling = true;
      const direction = Math.sign(e.deltaY);
      const style = window.getComputedStyle(list);
      const gap = parseInt(style.gap) || 10;
      const itemHeight = firstItem.offsetHeight + gap;

      list.scrollBy({ top: direction * itemHeight, behavior: 'smooth' });

      // Timeout slightly longer than smooth scroll animation
      setTimeout(() => { isScrolling = false; }, 350);
    }, { passive: false });
    
    list._wheelBound = true;
  }

  focalObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
        entry.target.classList.add('in-focus');
      } else {
        entry.target.classList.remove('in-focus');
      }
    });
  }, {
    root: list,
    threshold: [0.6],
    rootMargin: '-10% 0% -10% 0%'
  });

  document.querySelectorAll('.feed-item').forEach(item => focalObserver.observe(item));
}

function pushFeedItem(event) {
  const list = document.getElementById('progressFeedList');
  const empty = document.getElementById('progressFeedEmpty');
  if (!list) return;

  if (empty) empty.classList.add('hidden');
  list.style.display = 'flex';

  const newItem = createFeedItemElement(event);
  if (!newItem) return;

  // Back to Standard: Newest at TOP
  list.insertBefore(newItem, list.firstChild);

  while (list.children.length > MAX_HISTORY) {
    list.lastChild.remove();
  }

  // Snap to TOP instantly for new item
  setTimeout(() => {
    list.scrollTo({ top: 0, behavior: 'smooth' });
    if (focalObserver) focalObserver.observe(newItem);

    // Force focus the top item
    document.querySelectorAll('.feed-item').forEach(it => it.classList.remove('in-focus'));
    newItem.classList.add('in-focus');
  }, 50);
}

function renderProgressFeed() {
  const list = document.getElementById('progressFeedList');
  const empty = document.getElementById('progressFeedEmpty');
  if (!list || !empty) return;

  chrome.storage.local.get(['progressFeedEvents'], (storage) => {
    const events = storage.progressFeedEvents || [];
    list.innerHTML = '';

    if (events.length === 0) {
      empty.classList.remove('hidden');
      list.style.display = 'none';
      return;
    }

    empty.classList.add('hidden');
    list.style.display = 'flex';

    // Latest First
    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_HISTORY);
    sorted.forEach(evt => { const el = createFeedItemElement(evt); if (el) list.appendChild(el); });

    setupFocalObserver();
    // Default focus top
    if (list.children[0]) {
      list.children[0].classList.add('in-focus');
      list.scrollTo({ top: 0 });
    }
  });
}

function openFeedExpand() {
  if (document.getElementById('pfExpandSheet')) return;

  chrome.storage.local.get(['progressFeedEvents'], (storage) => {
    const events = storage.progressFeedEvents || [];
    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

    const wrap = document.createElement('div');
    wrap.id = 'pfExpandSheet';
    wrap.className = 'pf-sheet-wrap';
    wrap.innerHTML = `
      <div class="pf-sheet-backdrop"></div>
      <div class="pf-sheet">
        <div class="pf-sheet-header">
          <div>
            <div class="pf-sheet-title">Live Activity</div>
            <div class="pf-sheet-sub">ALL RECENT ACTIONS</div>
          </div>
          <button type="button" class="pf-sheet-close-btn" id="pfSheetCloseBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="pf-sheet-body" id="pfSheetBody"></div>
      </div>
    `;

    document.body.appendChild(wrap);

    const body = wrap.querySelector('#pfSheetBody');
    if (sorted.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pf-sheet-empty';
      empty.textContent = 'No activity yet — start the agent to see live actions here.';
      body.appendChild(empty);
    } else {
      sorted.forEach(evt => { const el = createFeedItemElement(evt); if (el) body.appendChild(el); });
    }

    const closeBtn = wrap.querySelector('#pfSheetCloseBtn');
    const backdrop = wrap.querySelector('.pf-sheet-backdrop');
    const sheet = wrap.querySelector('.pf-sheet');

    const closeSheet = () => {
      wrap.classList.remove('is-open');
      // Listen on the ACTUAL sliding sheet for the end of the transform transition
      sheet.addEventListener('transitionend', () => {
        wrap.remove();
      }, { once: true });
      // Fail-safe: remove after 400ms if transitionend somehow fails
      setTimeout(() => { if (wrap.parentNode) wrap.remove(); }, 400);
    };

    closeBtn.addEventListener('click', closeSheet);
    backdrop.addEventListener('click', closeSheet);

    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('is-open')));
  });
}

function closeFeedExpand() {
  const wrap = document.getElementById('pfExpandSheet');
  if (!wrap) return;
  wrap.classList.remove('is-open');
  wrap.addEventListener('transitionend', () => wrap.remove(), { once: true });
}

function initializeProgressFeed() {
  renderProgressFeed();

  const expandBtn = document.getElementById('pfExpandBtn');
  if (expandBtn && !expandBtn._pfBound) {
    expandBtn._pfBound = true;
    expandBtn.addEventListener('click', openFeedExpand);
  }

  // We intentionally do NOT listen to the runtime message 'progressFeedUpdate' here
  // because chrome.storage.onChanged naturally captures the exact same events 
  // with a clean diff, preventing duplicate UI renders.

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local' || !changes.progressFeedEvents) return;
    const newEvents = changes.progressFeedEvents.newValue || [];
    const oldEvents = changes.progressFeedEvents.oldValue || [];
    const oldTs = new Set(oldEvents.map(e => e.timestamp));
    const added = newEvents.filter(e => !oldTs.has(e.timestamp));
    added.forEach(event => pushFeedItem(event));
  });

  setInterval(() => {
    document.querySelectorAll('.feed-item[data-ts]').forEach(item => {
      const agoEl = item.querySelector('.feed-item-ago');
      if (agoEl) agoEl.textContent = formatFeedTime(parseInt(item.dataset.ts));
    });
  }, 30000);
}
