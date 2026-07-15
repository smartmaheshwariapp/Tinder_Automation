/* =====================================================
   CALENDAR EVENTS MODULE — Premium Grade
   Handoff events panel with badge, 3-dot menu, live sync
   ===================================================== */

const CalendarEvents = (() => {
  const PANEL_ID = 'calendarEventsPanel';
  const BTN_ID = 'calendarEventsBtn';
  const BADGE_ID = 'calendarEventsBadge';

  const SVG = {
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    ghost: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  };

  const REASON_META = {
    phone:     { svg: SVG.phone,    description: 'Shared her number with you',  color: '#10b981' },
    number:    { svg: SVG.phone,    description: 'Shared her number with you',  color: '#10b981' },
    whatsapp:  { svg: SVG.message,  description: 'Shared WhatsApp contact',     color: '#25d366' },
    insta:     { svg: SVG.camera,   description: 'Shared Instagram handle',     color: '#8B5CF6' },
    instagram: { svg: SVG.camera,   description: 'Shared Instagram handle',     color: '#8B5CF6' },
    snap:      { svg: SVG.ghost,    description: 'Shared Snapchat with you',    color: '#D97706' },
    social:    { svg: SVG.link,     description: 'Shared a social handle',      color: '#6366F1' },
    telegram:  { svg: SVG.send,     description: 'Shared Telegram contact',     color: '#29b6f6' },
    location:  { svg: SVG.pin,      description: 'Shared her location',         color: '#ef4444' },
    explicit:  { svg: SVG.zap,      description: 'Expressed strong interest',   color: '#f97316' },
    date:      { svg: SVG.calendar, description: 'Wants to meet up with you',   color: '#f59e0b' },
    meet:      { svg: SVG.calendar, description: 'Wants to meet up with you',   color: '#f59e0b' },
    coffee:    { svg: SVG.calendar, description: 'Wants to meet up with you',   color: '#f59e0b' },
    drink:     { svg: SVG.calendar, description: 'Wants to meet up with you',   color: '#f59e0b' },
  };

  function getReasonMeta(reason) {
    if (!reason) return { svg: SVG.bell, description: 'New notification', color: '#6366F1' };
    const r = reason.toLowerCase();
    for (const [key, meta] of Object.entries(REASON_META)) {
      if (r.includes(key)) return meta;
    }
    return { svg: SVG.bell, description: 'New notification', color: '#6366F1' };
  }

  function getPlatformText(platform) {
    if (!platform) return '';
    const p = platform.toLowerCase();
    const dot = `<span class="ce-platform-dot"></span>`;
    if (p === 'tinder') return `<span class="ce-platform-text ce-pt-tinder">${dot} Tinder</span>`;
    if (p === 'bumble') return `<span class="ce-platform-text ce-pt-bumble">${dot} Bumble</span>`;
    return `<span class="ce-platform-text">${dot} ${platform}</span>`;
  }

  function formatRelativeTime(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  /**
   * Extacts ONLY the phone number or social handle from a snippet
   * e.g. 'IG: elena.travels 📸' -> 'elena.travels'
   * e.g. '+1 234-567-8900 📱' -> '+1 234-567-8900'
   */
  function extractCleanValue(text) {
    if (!text) return '';

    // 1. Remove Emojis first
    let clean = text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

    // 2. Detect Specific Social Patterns (IG:, Insta:, Snap:, etc.)
    // Matches the word following the label
    const socialMatch = clean.match(/(?:IG|Insta|Snap|Snapchat|WhatsApp|WA|Number)[:\s]+([^\s]+)/i);
    if (socialMatch && socialMatch[1]) {
      return socialMatch[1].trim().replace(/[.,!]$/, ''); // Remove trailing punctuation
    }

    // 3. Detect Phone Number Patterns
    // Look for a sequence that looks like a number (+, digits, spaces, hyphens, parens)
    const phoneMatch = clean.match(/(\+?\d[\d\s\-\(\).]{8,}\d)/);
    if (phoneMatch && phoneMatch[0]) {
      return phoneMatch[0].trim();
    }

    // 4. Fallback: If no pattern is found, just return basic cleaned text
    return clean;
  }

  const AVATAR_PALETTES = [
    { bg: 'linear-gradient(135deg, #c7d2fe, #ddd6fe)', color: '#4338ca' },
    { bg: '#6366f1',                                   color: '#fff'    },
    { bg: 'linear-gradient(135deg, #1e293b, #334155)', color: '#fff'    },
    { bg: '#8b5cf6',                                   color: '#fff'    },
    { bg: '#0ea5e9',                                   color: '#fff'    },
    { bg: '#10b981',                                   color: '#fff'    },
    { bg: 'linear-gradient(135deg, #f43f5e, #e91e8c)', color: '#fff'    },
  ];

  function getAvatarStyle(name) {
    const idx = ((name || '?').charCodeAt(0) || 0) % AVATAR_PALETTES.length;
    const p = AVATAR_PALETTES[idx];
    return `background:${p.bg};color:${p.color};`;
  }

  function getAvatar(name, photoUrl, read) {
    const initial = (name || '?')[0].toUpperCase();
    const unreadDot = !read ? `<span class="ce-unread-dot"></span>` : '';

    if (photoUrl) {
      return `<div class="ce-avatar-wrap">
        <div class="ce-avatar ce-avatar-img">
          <img src="${photoUrl}" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
          <span style="display:none;">${initial}</span>
        </div>
        ${unreadDot}
      </div>`;
    }
    return `<div class="ce-avatar-wrap">
      <div class="ce-avatar" style="${getAvatarStyle(name)}">${initial}</div>
      ${unreadDot}
    </div>`;
  }

  function buildEventCard(event) {
    const meta = getReasonMeta(event.reason);
    const card = document.createElement('div');
    card.className = `ce-card${event.read ? ' ce-card-read' : ''}`;
    card.dataset.eventId = event.id;

    const reasonParts = (event.reason || '').split(': "');
    const msgSnippet = reasonParts[1] ? reasonParts[1].replace('"', '') : '';

    card.innerHTML = `
      <button class="ce-dismiss-btn" title="Dismiss" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="ce-card-top">
        ${getAvatar(event.matchName, event.photoUrl, event.read)}
        <div class="ce-card-meta">
          <div class="ce-card-name-row">
            <span class="ce-card-name">${sanitizeName(event.matchName)}</span>
            <span class="ce-card-time">${formatRelativeTime(event.createdAt)}</span>
          </div>
          <div class="ce-event-desc">
            <span class="ce-event-icon" style="color:${meta.color}">${meta.svg}</span>
            <span class="ce-event-label">${meta.description}</span>
          </div>
        </div>
      </div>
      ${msgSnippet ? `
      <div class="ce-card-snippet-row">
        <span class="ce-card-snippet">"${msgSnippet}"</span>
        <button class="ce-copy-btn" title="Copy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>` : ''}
      <div class="ce-card-footer">
        <button class="ce-chat-btn" title="Open Chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Open Chat
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        ${getPlatformText(event.platform)}
      </div>
    `;

    const dismissBtn = card.querySelector('.ce-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissEvent(event.id, card);
      });
    }

    const copyBtn = card.querySelector('.ce-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const valueToCopy = extractCleanValue(msgSnippet);
        navigator.clipboard.writeText(valueToCopy).then(() => {
          const original = copyBtn.innerHTML;
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          setTimeout(() => copyBtn.innerHTML = original, 1500);
        });
      });
    }

    const chatBtn = card.querySelector('.ce-chat-btn');
    if (chatBtn) {
      chatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: 'goToChat', platform: event.platform, matchId: event.matchId, matchName: event.matchName });
        if (!event.read) markRead(event.id);
      });
    }

    return card;
  }

  function sanitizeName(name) {
    if (!name) return 'Match';
    return name.replace(/[<>]/g, '');
  }

  async function refreshList() {
    const listEl = document.getElementById('ceList');
    const emptyEl = document.getElementById('ceEmpty');
    if (!listEl) return;

    let events = [];
    try {
      const result = await chrome.storage.local.get('upcomingEvents');
      events = result.upcomingEvents || [];
    } catch (e) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getUpcomingEvents' });
        events = (response && response.events) ? response.events : [];
      } catch (e2) { events = []; }
    }
    const sorted = [...events].sort((a, b) => b.createdAt - a.createdAt);

    listEl.innerHTML = '';
    updateBadge(sorted.filter(e => !e.read).length);

    if (sorted.length === 0) {
      listEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    listEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';

    sorted.forEach(evt => {
      listEl.appendChild(buildEventCard(evt));
    });
  }

  function updateBadge(count) {
    const badge = document.getElementById(BADGE_ID);
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'flex';
      badge.removeAttribute('hidden');
    } else {
      badge.style.display = 'none';
      badge.setAttribute('hidden', '');
    }
  }

  async function dismissEvent(id, cardEl) {
    cardEl.classList.add('ce-card-removing');
    setTimeout(async () => {
      await chrome.runtime.sendMessage({ action: 'dismissUpcomingEvent', eventId: id });
      refreshList();
    }, 300);
  }

  async function markRead(id) {
    await chrome.runtime.sendMessage({ action: 'markUpcomingEventRead', eventId: id });
    refreshList();
  }

  async function clearAll() {
    await chrome.runtime.sendMessage({ action: 'clearUpcomingEvents' });
    refreshList();
  }

  function closePanel(panel) {
    if (!panel || !panel.classList.contains('ce-panel-open')) return;
    panel.classList.add('ce-panel-closing');
    setTimeout(() => {
      panel.classList.remove('ce-panel-open');
      panel.classList.remove('ce-panel-closing');
    }, 180);
  }

  function togglePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const isOpen = panel.classList.contains('ce-panel-open');

    if (!isOpen) {
      panel.classList.remove('ce-panel-closing'); // Safety
      panel.classList.add('ce-panel-open');
      refreshList();
    } else {
      closePanel(panel);
    }
  }

  function init() {
    const btn = document.getElementById(BTN_ID);
    const clearBtn = document.getElementById('ceClearAll');
    const closeBtn = document.getElementById('cePanelClose');
    if (btn) btn.addEventListener('click', togglePanel);
    if (clearBtn) clearBtn.addEventListener('click', clearAll);
    if (closeBtn) closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById(PANEL_ID);
      closePanel(panel);
    });

    // Initial load
    refreshList();

    // Listen for changes via message (backup) and direct storage watch (primary)
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'upcomingEventsChanged') refreshList();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.upcomingEvents) refreshList();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      const panel = document.getElementById(PANEL_ID);
      const btn = document.getElementById(BTN_ID);
      if (panel && panel.classList.contains('ce-panel-open') && !document.querySelector('.ce-panel-closing')) {
        if (!panel.contains(e.target) && !btn.contains(e.target)) {
          closePanel(panel);
        }
      }
    });
  }

  return { init, refreshList, initialize: init };
})();

// Re-export for common naming conventions
const initializeCalendarEvents = CalendarEvents.initialize;

document.addEventListener('DOMContentLoaded', CalendarEvents.init);
