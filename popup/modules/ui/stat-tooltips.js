(function initStatTooltips() {
  const SUPPRESS_AFTER_OPENS = 10;
  const HOVER_DELAY_MS = 1000;

  const STORAGE_KEY = 'popupOpenCount';

  const TOOLTIP_MAP = {
    cardFlirtScore:       { title: 'Flirt Score™', body: 'Your XP-based progression level (1–10). Earned automatically through swipes & messages over all time.' },
    cardFlirtingNow:      { title: 'Active Conversations', body: 'Estimated open chats based on message activity today. Updates as the AI works each session.' },
    cardSwipes:           { title: 'Swipes Right', body: 'Total right swipes performed by the AI across all sessions since you started.' },
    cardAiMessages:       { title: 'AI Messages', body: 'Total opening messages and follow-ups the AI has sent on your behalf, lifetime.' },
    cardMatches:          { title: 'Matches Created', body: 'New mutual matches created since you started using FlirtEasy.' },
    cardTimeSaved:        { title: 'Estimated Time Saved', body: '~Calculated from your automation activity. Based on avg. time per manual swipe & message.' },
    cardSessionCycle:     { title: 'Current Cycle', body: 'Which automation cycle you\'re on out of your configured total. Set in Schedule settings.' },
    cardSessionLikes:     { title: 'Likes This Session', body: 'Right swipes sent by the AI during the current active agent session.' },
    cardSessionMessages:  { title: 'Messages This Session', body: 'Opening messages sent to new matches by the AI in this session.' },
    cardSessionSkipped:   { title: 'Skipped', body: 'Conversations skipped because they didn\'t pass your active filtering criteria.' },
    cardSessionFollowups: { title: 'Follow-ups Sent', body: 'Follow-up messages sent to matches that hadn\'t replied to the first message yet.' },
    cardSessionErrors:    { title: 'Errors', body: 'Issues encountered during the last agent run. Open logs for full details.' }
  };

  let tooltipEl = null;
  let portalRoot = null;
  let hoverTimer = null;
  let suppressed = false;

  function getPortalRoot() {
    if (portalRoot) return portalRoot;
    portalRoot = document.createElement('div');
    portalRoot.id = 'sctPortalRoot';
    document.documentElement.appendChild(portalRoot);
    return portalRoot;
  }

  function buildTooltipEl() {
    const el = document.createElement('div');
    el.id = 'statCardTooltip';
    el.setAttribute('role', 'tooltip');
    el.style.display = 'none';
    getPortalRoot().appendChild(el);
    return el;
  }

  function getTooltipEl() {
    return tooltipEl || (tooltipEl = buildTooltipEl());
  }

  function positionAndShow(card, data) {
    const el = getTooltipEl();

    el.innerHTML = `<div class="sct-title">${data.title}</div><div class="sct-body">${data.body}</div>`;
    el.removeAttribute('data-dir');
    el.classList.remove('sct-visible');
    el.style.display = 'block';
    el.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      const cardRect = card.getBoundingClientRect();
      const tipRect  = el.getBoundingClientRect();
      const MARGIN   = 8;
      const GAP      = 8;

      let left = cardRect.left + cardRect.width / 2 - tipRect.width / 2;
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - tipRect.width - MARGIN));

      const spaceAbove = cardRect.top;
      const spaceBelow = window.innerHeight - cardRect.bottom;
      const fitsAbove  = spaceAbove >= tipRect.height + GAP;

      if (fitsAbove) {
        el.style.top  = (cardRect.top - tipRect.height - GAP) + 'px';
        el.setAttribute('data-dir', 'above');
      } else {
        el.style.top  = (cardRect.bottom + GAP) + 'px';
        el.setAttribute('data-dir', 'below');
      }

      el.style.left       = left + 'px';
      el.style.visibility = '';

      requestAnimationFrame(() => el.classList.add('sct-visible'));
    });
  }

  function hideTooltip() {
    clearTimeout(hoverTimer);
    hoverTimer = null;
    if (!tooltipEl) return;
    tooltipEl.classList.remove('sct-visible');
    setTimeout(() => {
      if (tooltipEl && !tooltipEl.classList.contains('sct-visible')) {
        tooltipEl.style.display = 'none';
      }
    }, 220);
  }

  function bindCards() {
    document.querySelectorAll('.stat-card').forEach(card => {
      const data = TOOLTIP_MAP[card.id];
      if (!data) return;

      card.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(async () => {
          try {
            const state = await getAgentState();
            if (state.isRunning) return;
          } catch (_) {}
          positionAndShow(card, data);
        }, HOVER_DELAY_MS);
      });

      card.addEventListener('mouseleave', hideTooltip);
      card.addEventListener('mousedown',  hideTooltip);
    });
  }

  async function init() {
    try {
      const result   = await chrome.storage.local.get(STORAGE_KEY);
      const count    = (result[STORAGE_KEY] || 0) + 1;
      await chrome.storage.local.set({ [STORAGE_KEY]: count });
      suppressed = count > SUPPRESS_AFTER_OPENS;
    } catch (_) {
      suppressed = false;
    }

    if (!suppressed) bindCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
