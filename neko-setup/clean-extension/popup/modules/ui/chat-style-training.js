/**
 * chat-style-training.js
 * ─────────────────────────────────────────────────────────────────
 * Modular handler for the "Your Chat Style" V2 accordion card.
 *
 * Responsibilities:
 *  - Render training chat UI inside the card body
 *  - Simulate a match persona with openers + typed replies
 *  - Collect user messages as style data points
 *  - Analyse session and extract a StyleProfile per language
 *  - Persist StyleProfiles → userSettings.chatStyleProfiles (keyed by lang code)
 *  - Expose profiles to buildSystemPrompt via userSettings
 *
 * Called by: AutomationViews._initStyleTrainingCard()
 * Storage key: userSettings.chatStyleProfiles  { en: {...}, es: {...}, ... }
 * Legacy migration: userSettings.chatStyleProfile → chatStyleProfiles[lang] on init
 * ─────────────────────────────────────────────────────────────────
 */

const ChatStyleTraining = {

  // ── Constants ──────────────────────────────────────────────────
  MIN_MESSAGES:         8,
  TARGET_MESSAGES:      12,
  MAX_PROFILES:         3,    // max trained language profiles per user
  MIN_QUALITY_RATIO:    0.5,   // ≥50% of messages must pass quality gate
  MAX_EXAMPLE_LENGTH:   200,   // chars — prevents prompt bloat
  MIN_MESSAGE_CHARS:    4,     // below this we reject the message entirely

  OPENER_SEED_PROMPT: '(send a fun, flirty opening message to someone you find interesting on a dating app — short, casual, makes them want to reply)',

  PERSONAS: [
    { name: 'Mia',   opener: "hey! your profile actually made me stop scrolling 👀 what do you do for fun?" },
    { name: 'Zara',  opener: "ok i have to ask — is that actually you in that hiking photo or did you borrow someone's life 😂" },
    { name: 'Priya', opener: "hi! you seem interesting. what's the most spontaneous thing you've done recently?" },
    { name: 'Emma',  opener: "your bio got me lol. so what's the story behind it?" },
    { name: 'Ava',   opener: "okay serious question — coffee or matcha? this determines everything 😌" },
  ],

  FOLLOW_UPS: [
    "haha that's so funny, i never would've guessed that about you",
    "okay wait that's actually really interesting, tell me more",
    "lol i feel that. so do you do that often?",
    "no way, i've been thinking about that too! what made you start?",
    "that's cute honestly 😊 what else should i know about you?",
    "okay i like your vibe. what are you usually doing on weekends?",
    "haha fair enough. are you more of a spontaneous or planner type?",
    "that's a solid answer. what's something most people don't know about you?",
    "okay you're interesting. where's somewhere you'd want to travel?",
    "i respect that honestly. what's the last thing that genuinely made you laugh?",
    "love that. so what's the ideal first date for you?",
    "that's such a you answer lol. what kind of music are you into?",
  ],

  // ── Module-level state ─────────────────────────────────────────
  _session: null,
  _pendingReplyTimer: null,
  _sessionStarting: false,

  // ── Apply remote config overrides ─────────────────────────────
  // Called once at the start of init(). Reads remoteStyleTrainingConfig from
  // chrome.storage.local and overwrites hardcoded constants when present.
  // Falls back silently to hardcoded values if the key is absent or malformed.
  async _applyRemoteConfig() {
    try {
      const stored = await new Promise(r => chrome.storage.local.get('remoteStyleTrainingConfig', r));
      const rtc = stored?.remoteStyleTrainingConfig;
      if (!rtc || typeof rtc !== 'object') return;

      // Session Rules
      if (typeof rtc.minMessages      === 'number' && rtc.minMessages      >= 1)  this.MIN_MESSAGES      = rtc.minMessages;
      if (typeof rtc.targetMessages   === 'number' && rtc.targetMessages   >= 1)  this.TARGET_MESSAGES   = rtc.targetMessages;
      if (typeof rtc.maxProfiles      === 'number' && rtc.maxProfiles      >= 1)  this.MAX_PROFILES      = rtc.maxProfiles;
      if (typeof rtc.minQualityRatio  === 'number' && rtc.minQualityRatio  >= 0)  this.MIN_QUALITY_RATIO = rtc.minQualityRatio;
      if (typeof rtc.maxExampleLength === 'number' && rtc.maxExampleLength >= 10) this.MAX_EXAMPLE_LENGTH = rtc.maxExampleLength;
      if (typeof rtc.minMessageChars  === 'number' && rtc.minMessageChars  >= 1)  this.MIN_MESSAGE_CHARS = rtc.minMessageChars;

      // Personas — only override if it's a non-empty array of valid objects
      if (Array.isArray(rtc.personas) && rtc.personas.length > 0 &&
          rtc.personas.every(p => p && typeof p.name === 'string' && typeof p.opener === 'string')) {
        this.PERSONAS = rtc.personas;
      }

      // Strip emojis from persona openers when emoji is disabled
      if (rtc.personaEmojiEnabled === false) {
        this.PERSONAS = this.PERSONAS.map(p => ({
          ...p,
          opener: p.opener.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim(),
        }));
      }

      // Follow-ups pool — only override if it's a non-empty array of strings
      if (Array.isArray(rtc.followUps) && rtc.followUps.length > 0 &&
          rtc.followUps.every(f => typeof f === 'string')) {
        this.FOLLOW_UPS = rtc.followUps;
      }

      // Opener seed prompt
      if (typeof rtc.openerSeedPrompt === 'string' && rtc.openerSeedPrompt.trim().length > 0) {
        this.OPENER_SEED_PROMPT = rtc.openerSeedPrompt.trim();
      }
    } catch (_) {
      // Silent fail — hardcoded defaults remain in place
    }
  },

  // ── Sync the automation "Default Language" trigger display ────
  // automation-views.js has a local syncLang() closure we can't call directly,
  // so we replicate its logic: find the matching option in #automationLangOptions
  // and update #automationLangValue text + selected state.
  _syncAutomationLangDisplay(code) {
    try {
      const langValueEl  = document.getElementById('automationLangValue');
      const langOptionsEl = document.getElementById('automationLangOptions');
      if (!langValueEl || !langOptionsEl) return;
      const btn = langOptionsEl.querySelector(`[data-value="${code}"]`);
      if (btn) {
        langValueEl.textContent = btn.textContent;
        langOptionsEl.querySelectorAll('[data-value]').forEach(o => {
          o.classList.toggle('is-selected', o.dataset.value === code);
        });
      }
    } catch (_) {}
  },

  // ── Shared language pill dropdown builder ─────────────────────
  // Creates a pill button + animated dropdown panel.
  // onChange(code) is called with the new language code when user picks.
  _buildLangPill(currentCode, onChange) {
    const currentLabel = this.LANGUAGES.find(l => l.code === currentCode)?.label || 'English';

    const container = document.createElement('div');
    container.className = 'cst-header-lang-container';

    // ── Pill trigger ──
    container.innerHTML = `
      <button type="button" class="cst-lang-pill" id="cstLangPillBtn" aria-haspopup="listbox" aria-expanded="false">
        <svg class="cst-lang-pill-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/>
          <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" stroke-width="1.8"/>
          <path d="M3 12h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M5.5 7.5h13M5.5 16.5h13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="cst-lang-pill-text" id="cstLangPillText">${this._escapeHtml(currentLabel)}</span>
        <svg class="cst-lang-pill-chevron" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="cst-lang-dropdown" id="cstLangDropdown" role="listbox">
        ${this.LANGUAGES.map(l => `
          <div class="cst-lang-option${l.code === currentCode ? ' is-selected' : ''}"
               data-value="${l.code}"
               role="option"
               aria-selected="${l.code === currentCode}">
            ${this._escapeHtml(l.label)}
          </div>`).join('')}
      </div>
    `;

    const pill     = container.querySelector('#cstLangPillBtn');
    const dropdown = container.querySelector('#cstLangDropdown');
    const pillText = container.querySelector('#cstLangPillText');
    let isOpen = false;

    const open = () => {
      isOpen = true;
      pill.classList.add('is-open');
      dropdown.classList.add('is-open');
      pill.setAttribute('aria-expanded', 'true');
      // Scroll selected option into view
      const sel = dropdown.querySelector('.is-selected');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    };

    const close = () => {
      isOpen = false;
      pill.classList.remove('is-open');
      dropdown.classList.remove('is-open');
      pill.setAttribute('aria-expanded', 'false');
    };

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen ? close() : open();
    });

    dropdown.addEventListener('click', (e) => {
      const opt = e.target.closest('.cst-lang-option');
      if (!opt) return;
      const newCode = opt.dataset.value;
      const newLabel = this.LANGUAGES.find(l => l.code === newCode)?.label || newCode;

      // Update pill UI
      dropdown.querySelectorAll('.cst-lang-option').forEach(o => {
        o.classList.toggle('is-selected', o.dataset.value === newCode);
        o.setAttribute('aria-selected', o.dataset.value === newCode ? 'true' : 'false');
      });
      pillText.textContent = newLabel;
      close();

      // Let the caller (onChange) decide what to do — no direct storage write here
      onChange(newCode);
    });

    // Close on outside click
    const outsideClose = (e) => {
      if (isOpen && !container.contains(e.target)) close();
    };
    document.addEventListener('click', outsideClose);
    // Clean up listener when container is removed from DOM
    new MutationObserver((_, obs) => {
      if (!document.contains(container)) {
        document.removeEventListener('click', outsideClose);
        obs.disconnect();
      }
    }).observe(document.body, { childList: true, subtree: true });

    return container;
  },

  // ── Public: init card ──────────────────────────────────────────
  async init() {
    const card = document.querySelector('.automation-v2-card[data-automation-card="style"]');
    if (!card) return;

    const body = card.querySelector('.automation-v2-card-body');
    if (!body) return;

    this._cancelPendingTimers();

    // ── Apply remote config overrides (personas, follow-ups, session rules) ──
    await this._applyRemoteConfig();

    // ── One-time migration: chatStyleProfile → chatStyleProfiles ──
    await this._migrateLeacyProfile();

    // Resolve active language
    const stored = await new Promise(r => chrome.storage.local.get('userSettings', r));
    const activeLang = stored?.userSettings?.conversationLanguage || 'en';

    const profile = await this._loadProfile(activeLang);
    this._updateChip(activeLang);

    // Only restore a session if there is no fully-trained profile for this language
    if (!profile?.trained) {
      const savedSession = await this._loadSessionState();
      if (savedSession?.messages?.length && savedSession?.persona) {
        // If session was completed but popup closed before _completeSession ran, finish it now
        if (savedSession.completed) {
          this._session = { ...savedSession, analysisTimer: null };
          await this._completeSession(body);
          return;
        }
        this._session = { ...savedSession, analysisTimer: null, completed: false };
        this._renderCard(body, null, activeLang);
        return;
      }
    }
    this._renderCard(body, profile, activeLang);
  },

  // ── Cancel all in-flight timers ────────────────────────────────
  _cancelPendingTimers() {
    if (this._pendingReplyTimer) {
      clearTimeout(this._pendingReplyTimer);
      this._pendingReplyTimer = null;
    }
  },

  // ── Chip ───────────────────────────────────────────────────────
  async _updateChip(activeLang) {
    const row = document.querySelector(
      '.automation-v2-card[data-automation-card="style"] .automation-v2-collapsed-row'
    );
    if (!row) return;

    const profiles = await this._loadAllProfiles();
    const trainedLangs = Object.keys(profiles).filter(k => profiles[k]?.trained);

    const chips = [];

    // Trained languages — ✓ English (full) or English 3/12 (partial)
    for (const code of trainedLangs) {
      const p = profiles[code];
      const label = this.LANGUAGES.find(l => l.code === code)?.label || code;
      if (p.partial) {
        // Partial save — show count, no tick
        chips.push(`<span class="automation-v2-chip">${label} ${p.messageCount || '?'} / ${this.TARGET_MESSAGES}</span>`);
      } else {
        chips.push(`<span class="automation-v2-chip">✓ ${label}</span>`);
      }
    }

    // Active in-progress session (not yet saved for this language)
    if (this._session && !this._session.completed) {
      const lang = this._session.language || activeLang || 'en';
      if (!trainedLangs.includes(lang)) {
        const label = this.LANGUAGES.find(l => l.code === lang)?.label || lang;
        const userCount = this._session.messages.filter(m => m.role === 'user' && !m.garbage).length;
        chips.push(`<span class="automation-v2-chip">${label} ${userCount} / ${this.TARGET_MESSAGES}</span>`);
      }
    }

    row.innerHTML = chips.join('');
  },

  // ── Render card body ───────────────────────────────────────────
  async _renderCard(body, profile, activeLang) {
    body.innerHTML = '';
    if (profile?.trained) {
      this._renderCompletionScreen(body, profile, profile.aiSummary || null, activeLang);
    } else if (this._session) {
      await this._renderChatUI(body);
      // Re-render saved messages without re-pushing to _session.messages
      for (const msg of this._session.messages) {
        if (msg.role === 'match')     this._renderMatchBubble(msg.text, body);
        else if (msg.role === 'user') this._renderUserBubble(msg.text, body);
      }
      this._updateProgress(body);
      // Show save button if there's already at least one match reply
      const hasMatchReply = this._session.messages.some(m => m.role === 'match');
      if (hasMatchReply) {
        const saveBtn = body.querySelector('#cstSaveInlineBtn') ||
                        document.querySelector('.automation-v2-card[data-automation-card="style"] #cstSaveInlineBtn');
        if (saveBtn) saveBtn.style.display = 'inline-flex';
      }
      const userCount = this._session.messages.filter(m => m.role === 'user').length;
      // Only resume with an AI reply if the last message was from user (mid-turn close)
      const lastMsg = this._session.messages[this._session.messages.length - 1];
      if (this._session.completed) {
        this._showFinishBanner(body);
      } else if (lastMsg?.role === 'user') {
        this._showTypingIndicator(body);
        this._pendingReplyTimer = setTimeout(async () => {
          if (!this._session) return;
          const reply = await this._getAIMatchReply();
          this._hideTypingIndicator(body);
          this._session.messages.push({ role: 'match', text: reply, ts: Date.now() });
          this._renderMatchBubble(reply, body);
          await this._saveSessionState(this._session);
        }, 900);
      }
    } else {
      await this._renderIntroScreen(body, activeLang);
    }
  },

  // ── Language options (mirrors popup.html conversationLanguageSelect) ──
  LANGUAGES: [
    { code: 'ar', label: 'Arabic' },
    { code: 'bn', label: 'Bengali' },
    { code: 'zh', label: 'Chinese' },
    { code: 'cs', label: 'Czech' },
    { code: 'da', label: 'Danish' },
    { code: 'nl', label: 'Dutch' },
    { code: 'en', label: 'English' },
    { code: 'fi', label: 'Finnish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'el', label: 'Greek' },
    { code: 'he', label: 'Hebrew' },
    { code: 'hi', label: 'Hindi' },
    { code: 'hu', label: 'Hungarian' },
    { code: 'id', label: 'Indonesian' },
    { code: 'it', label: 'Italian' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'no', label: 'Norwegian' },
    { code: 'fa', label: 'Persian' },
    { code: 'pl', label: 'Polish' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'ro', label: 'Romanian' },
    { code: 'ru', label: 'Russian' },
    { code: 'es', label: 'Spanish' },
    { code: 'sw', label: 'Swahili' },
    { code: 'sv', label: 'Swedish' },
    { code: 'th', label: 'Thai' },
    { code: 'tr', label: 'Turkish' },
    { code: 'uk', label: 'Ukrainian' },
    { code: 'ur', label: 'Urdu' },
    { code: 'vi', label: 'Vietnamese' },
  ],

  // ── Intro screen ───────────────────────────────────────────────
  async _renderIntroScreen(body, activeLang) {
    const currentLang = activeLang || 'en';
    const existingProfile = await this._loadProfile(currentLang);
    const allProfiles = await this._loadAllProfiles();
    const trainedLangs = Object.keys(allProfiles).filter(k => allProfiles[k]?.trained);

    const _render = async (lang) => {
      const profile = await this._loadProfile(lang);
      const langLabel = this.LANGUAGES.find(l => l.code === lang)?.label || lang;
      const isRetrain = profile?.trained;           // any save counts — full or partial
      const isFullTrain = profile?.trained && !profile?.partial;
      const atCap = !isRetrain && trainedLangs.length >= this.MAX_PROFILES;

      const intro = document.createElement('div');
      intro.className = 'cst-intro';

      // Trained-languages summary bar — show ✓ only for full trains, count for partial
      const trainedBar = trainedLangs.length
        ? `<div class="cst-trained-langs">
            ${trainedLangs.map(code => {
              const p = allProfiles[code];
              const label = this.LANGUAGES.find(l => l.code === code)?.label || code;
              const isActive = code === lang;
              const chipText = p?.partial
                ? `${label} ${p.messageCount || '?'}/${this.TARGET_MESSAGES}`
                : `✓ ${label}`;
              return `<span class="cst-trained-lang-chip${isActive ? ' cst-trained-lang-chip--active' : ''}" data-lang="${code}">${chipText}</span>`;
            }).join('')}
           </div>`
        : '';

      intro.innerHTML = `
        <div class="cst-intro-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p class="cst-intro-title">${isRetrain ? (isFullTrain ? `Retrain for ${langLabel}` : `Continue training ${langLabel}`) : 'Train Your Chat Style'}</p>
        <p class="cst-intro-desc">${isFullTrain
          ? `You already have a complete style profile for ${langLabel}. Start a new session to update it.`
          : isRetrain
            ? `Your ${langLabel} profile has ${profile.messageCount || '?'} messages — more training makes it more accurate.`
            : atCap
              ? `You have ${this.MAX_PROFILES} trained profiles (the maximum). Delete one to train a new language.`
              : 'Reply to a few messages from a practice match. The AI learns how you write so when it messages your matches, it uses your tone, your words and your rhythm.'
        }</p>
        ${trainedBar}
        <div class="cst-lang-row" id="cstIntroLangRow">
          <span class="cst-lang-label">Training language</span>
        </div>
        <button class="cst-start-btn${atCap ? ' cst-start-btn--disabled' : ''}" id="cstStartBtn"${atCap ? ' disabled' : ''}>${
          isFullTrain ? `Retrain ${langLabel}` :
          isRetrain   ? `Continue Training ${langLabel}` :
          atCap       ? 'Profile limit reached' :
                        'Start Training'
        }</button>
        ${isRetrain ? `<button class="cst-view-trained-btn" id="cstViewTrainedBtn">View trained style</button>` : ''}
      `;
      body.innerHTML = '';
      body.appendChild(intro);

      // ── Language pill ──
      const langRow = intro.querySelector('#cstIntroLangRow');
      const pill = this._buildLangPill(lang, async (newCode) => {
        // Update messaging section DOM + save bar (same as picking from messaging dropdown)
        try {
          if (typeof setCustomSelectValue === 'function') setCustomSelectValue('conversationLanguageSelect', newCode);
          this._syncAutomationLangDisplay(newCode);
          if (typeof AutomationViews !== 'undefined' && typeof AutomationViews.refreshCollapsedChips === 'function') AutomationViews.refreshCollapsedChips();
          if (typeof markAsChanged === 'function') markAsChanged();
        } catch (_) {}
        // Re-render intro for the new language
        await _render(newCode);
      });
      langRow.appendChild(pill);

      // ── Live sync with messaging section dropdown ──
      const langSelectEl = document.getElementById('conversationLanguageSelect');
      if (langSelectEl) {
        const domObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'data-value') {
              const newLang = langSelectEl.getAttribute('data-value');
              if (!newLang || newLang === lang) return;
              _render(newLang);
            }
          }
        });
        domObserver.observe(langSelectEl, { attributes: true, attributeFilter: ['data-value'] });
        new MutationObserver((_, obs) => {
          if (!document.contains(langRow)) { domObserver.disconnect(); obs.disconnect(); }
        }).observe(document.body, { childList: true, subtree: true });
      }

      // ── Trained lang chips — click to view that language's profile directly ──
      intro.querySelectorAll('.cst-trained-lang-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
          const p = await this._loadProfile(chip.dataset.lang);
          if (p) this._renderCompletionScreen(body, p, p.aiSummary || null, chip.dataset.lang);
          else _render(chip.dataset.lang);
        });
      });

      // Start / Continue / Retrain
      intro.querySelector('#cstStartBtn').addEventListener('click', async () => {
        if (isRetrain && !isFullTrain && profile?.savedMessages?.length) {
          // ── Continue: restore existing session from saved messages ──
          this._cancelPendingTimers();
          await this._clearSessionState();
          const persona = this.PERSONAS[Math.floor(Math.random() * this.PERSONAS.length)];
          this._session = {
            messages: profile.savedMessages.map(m => ({ ...m })),
            persona: { name: profile.personaName || persona.name, opener: '' },
            followUpIndex: 0,
            completed: false,
            language: lang,
          };
          await this._saveSessionState(this._session);
          await this._renderCard(body, null, lang);
        } else {
          this._startSession(body, lang);
        }
      });

      // View existing trained profile
      intro.querySelector('#cstViewTrainedBtn')?.addEventListener('click', async () => {
        const p = await this._loadProfile(lang);
        if (p) this._renderCompletionScreen(body, p, p.aiSummary || null, lang);
      });
    };

    await _render(currentLang);

    // ── Auto re-render intro on Save Changes ──
    const storageListener = (changes, area) => {
      if (area !== 'local' || !changes.userSettings) return;
      const newLang = changes.userSettings.newValue?.conversationLanguage;
      const oldLang = changes.userSettings.oldValue?.conversationLanguage;
      if (newLang && newLang !== oldLang) _render(newLang);
    };
    chrome.storage.onChanged.addListener(storageListener);
    new MutationObserver((_, obs) => {
      if (!document.contains(body)) { chrome.storage.onChanged.removeListener(storageListener); obs.disconnect(); }
    }).observe(document.body, { childList: true, subtree: true });
  },

  // ── Start session ──────────────────────────────────────────────
  async _startSession(body, lang) {
    // Guard against concurrent calls — only one session start at a time
    if (this._sessionStarting) return;
    this._sessionStarting = true;

    // Guard: block if automation cycle is currently running
    if (typeof getAgentState === 'function') {
      const state = await getAgentState().catch(() => ({}));
      if (state.isRunning && state.currentPhase) {
        this._sessionStarting = false;
        if (typeof showCycleRunningWarning === 'function') showCycleRunningWarning();
        return;
      }
    }

    this._cancelPendingTimers();
    this._clearSessionState();
    const existingProfile = await this._loadProfile(lang || 'en');
    if (!existingProfile?.partial) {
      await this._saveProfile(null, lang || 'en');
    }
    await this._updateChip(lang);

    const persona = this.PERSONAS[Math.floor(Math.random() * this.PERSONAS.length)];
    let resolvedLang = lang;
    if (!resolvedLang) {
      const stored = await new Promise(r => chrome.storage.local.get('userSettings', r));
      resolvedLang = stored?.userSettings?.conversationLanguage || 'en';
    }

    const allProfiles = await this._loadAllProfiles();
    const trainedLangs = Object.keys(allProfiles).filter(k => allProfiles[k]?.trained);
    const isNewSlot = !allProfiles[resolvedLang]?.trained;
    if (isNewSlot && trainedLangs.length >= this.MAX_PROFILES) {
      this._sessionStarting = false;
      this._renderProfileCapScreen(body, resolvedLang);
      return;
    }

    this._session = {
      messages: [],
      persona,
      followUpIndex: 0,
      completed: false,
      language: resolvedLang,
    };

    await this._renderChatUI(body);
    this._showTypingIndicator(body);

    this._pendingReplyTimer = setTimeout(async () => {
      // Release the guard once the opener is actually delivered
      this._sessionStarting = false;
      if (!this._session) return;

      let opener = persona.opener;
      try {
        const seed = [{ role: 'match', text: this.OPENER_SEED_PROMPT }];
        const res = await new Promise(resolve =>
          chrome.runtime.sendMessage({
            action: 'generateStyleTrainingReply',
            conversation: seed,
            personaName: persona.name,
            language: this._session.language,
          }, resolve)
        );
        if (res?.reply && !chrome.runtime.lastError) {
          opener = res.reply.trim()
            .replace(/^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d]+$/g, '')
            .trim() || opener;
        }
      } catch (_) { /* use fallback opener */ }
      this._hideTypingIndicator(body);
      if (!this._session) return; // session may have been cancelled while waiting
      this._session.messages.push({ role: 'match', text: opener, ts: Date.now() });
      this._renderMatchBubble(opener, body);
      await this._saveSessionState(this._session);
    }, 800);
  },

  // ── Chat UI ────────────────────────────────────────────────────
  async _renderChatUI(body) {
    // Read current language so the header pill shows the right value
    const stored = await new Promise(r => chrome.storage.local.get('userSettings', r));
    const currentLang = this._session?.language || stored?.userSettings?.conversationLanguage || 'en';

    body.innerHTML = `
      <div class="cst-chat-wrap">
        <div class="cst-chat-header">
          <div class="cst-header-left">
            <div class="cst-header-avatar-wrap">
              <span class="cst-header-avatar" id="cstHeaderAvatar"></span>
              <span class="cst-online-dot"></span>
            </div>
            <div class="cst-header-info">
              <span class="cst-chat-persona-name" id="cstPersonaName"></span>
              <span class="cst-header-status">Online now</span>
            </div>
          </div>
          <div class="cst-header-right">
            <div class="cst-progress-wrap">
              <div class="cst-progress-bar"><div class="cst-progress-fill" id="cstProgressFill"></div></div>
              <span class="cst-progress-label" id="cstProgressLabel">0 / ${this.TARGET_MESSAGES}</span>
            </div>
            <button class="cst-restart-btn" id="cstRestartBtn" title="Start over">&#8635;</button>
          </div>
        </div>
        <div class="cst-messages" id="cstMessages">
          <div class="cst-date-sep">Today</div>
        </div>
        <div class="cst-footer">
          <div class="cst-footer-action-row" id="cstFooterActionRow">
            <div id="cstProfilesBtnMount"></div>
            <div id="cstFooterLangMount"></div>
            <button class="cst-save-inline-btn" id="cstSaveInlineBtn" style="display:none;">Save style</button>
          </div>
          <div class="cst-input-row">
            <input type="text" class="cst-input" id="cstInput" placeholder="Type your reply..." autocomplete="off" maxlength="500" />
            <button class="cst-send-btn" id="cstSendBtn" aria-label="Send">
              <span class="cst-send-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>
          </div>
          <div class="cst-input-hint" id="cstInputHint"></div>
        </div>
      </div>
    `;

    body.querySelector('#cstPersonaName').textContent = this._session.persona.name;
    body.querySelector('#cstHeaderAvatar').textContent = this._session.persona.name[0];
    this._updateProgress(body);

    // ── Language pill ──
    const langMount = body.querySelector('#cstFooterLangMount');
    if (langMount) {
      const pill = this._buildLangPill(currentLang, (newCode) => {
        try {
          if (typeof setCustomSelectValue === 'function') setCustomSelectValue('conversationLanguageSelect', newCode);
          this._syncAutomationLangDisplay(newCode);
          if (typeof AutomationViews !== 'undefined' && typeof AutomationViews.refreshCollapsedChips === 'function') AutomationViews.refreshCollapsedChips();
          if (typeof markAsChanged === 'function') markAsChanged();
        } catch (_) {}

        const userCount = this._session?.messages?.filter(m => m.role === 'user' && !m.garbage).length || 0;
        const doSwitch = () => {
          _storageRestartPending = true; // prevent storageListener from also firing
          this._cancelPendingTimers();
          this._clearSessionState();
          this._session = null;
          this._startSession(body, newCode);
        };
        // If meaningful progress exists, confirm before switching
        if (userCount >= 3) {
          this._showConfirm(
            `Switch to ${this.LANGUAGES.find(l => l.code === newCode)?.label || newCode}?`,
            `You've sent ${userCount} message${userCount !== 1 ? 's' : ''} in this session. Switching language will start a new session.`,
            'Switch',
            doSwitch
          );
        } else {
          doSwitch();
        }
      });
      langMount.appendChild(pill);

      // Live sync with messaging section dropdown
      const langSelectEl = document.getElementById('conversationLanguageSelect');
      let domObserver = null;
      if (langSelectEl) {
        domObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'data-value') {
              const newLang = langSelectEl.getAttribute('data-value');
              if (!newLang) return;
              const pillTextEl = pill.querySelector('.cst-lang-pill-text');
              const newLabel = this.LANGUAGES.find(l => l.code === newLang)?.label || newLang;
              if (pillTextEl) pillTextEl.textContent = newLabel;
              pill.querySelectorAll('.cst-lang-option').forEach(o => {
                const sel = o.dataset.value === newLang;
                o.classList.toggle('is-selected', sel);
                o.setAttribute('aria-selected', sel ? 'true' : 'false');
              });
              if (this._session) this._session.language = newLang;
            }
          }
        });
        domObserver.observe(langSelectEl, { attributes: true, attributeFilter: ['data-value'] });
      }

      // Auto-restart when Save Changes is clicked with a different language
      // Guard flag prevents double-start if pill onChange already restarted
      let _storageRestartPending = false;
      const storageListener = (changes, area) => {
        if (area !== 'local' || !changes.userSettings) return;
        const newLang = changes.userSettings.newValue?.conversationLanguage;
        const oldLang = changes.userSettings.oldValue?.conversationLanguage;
        if (!newLang || newLang === oldLang) return;
        if (_storageRestartPending) return;
        _storageRestartPending = true;
        this._cancelPendingTimers();
        this._clearSessionState();
        this._session = null;
        this._startSession(body, newLang);
      };
      chrome.storage.onChanged.addListener(storageListener);

      new MutationObserver((_, obs) => {
        if (!document.contains(langMount)) {
          if (domObserver) domObserver.disconnect();
          chrome.storage.onChanged.removeListener(storageListener);
          obs.disconnect();
        }
      }).observe(document.body, { childList: true, subtree: true });
    }

    // ── Profiles button — left of language pill, appears after first save ──
    const profilesBtnMount = body.querySelector('#cstProfilesBtnMount');
    const _refreshProfilesBtn = async () => {
      if (!profilesBtnMount) return;
      const profiles = await this._loadAllProfiles();
      const trainedLangs = Object.keys(profiles).filter(k => profiles[k]?.trained);
      profilesBtnMount.innerHTML = '';
      if (!trainedLangs.length) return;
      const btn = document.createElement('button');
      btn.className = 'cst-profiles-btn';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="12" height="12"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Profiles <span class="cst-profiles-count">${trainedLangs.length}</span>`;
      profilesBtnMount.appendChild(btn);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showProfilesPanel(body, profiles, trainedLangs);
      });
    };
    await _refreshProfilesBtn();
    // Expose refresh so save can update it
    this._refreshProfilesBtn = _refreshProfilesBtn;

    // ── Save style — shown after every AI reply once MIN_MESSAGES reached ──
    const saveInlineBtn = body.querySelector('#cstSaveInlineBtn');
    if (saveInlineBtn) {
      saveInlineBtn.addEventListener('click', async () => {
        if (!this._session || saveInlineBtn.disabled) return;
        const userMessages = this._session.messages.filter(m => m.role === 'user' && !m.garbage).map(m => m.text);
        const { valid } = this._qualityCheck(userMessages);
        if (!valid) {
          saveInlineBtn.textContent = 'Keep chatting…';
          setTimeout(() => { saveInlineBtn.textContent = 'Save style'; }, 2000);
          return;
        }
        saveInlineBtn.disabled = true;
        saveInlineBtn.textContent = 'Saving…';
        const profile = this._buildProfile(userMessages);
        // Attach conversation data so replay + summary work
        profile.savedMessages = this._session.messages.filter(m => m.role === 'match' || m.role === 'user');
        profile.personaName   = this._session.persona?.name || null;
        const sessionLang = this._session.language || 'en';
        try {
          await this._saveProfile(profile, sessionLang);
        } catch (err) {
          if (err?.message?.startsWith('MAX_PROFILES')) {
            saveInlineBtn.disabled = false;
            saveInlineBtn.textContent = `Max ${this.MAX_PROFILES} profiles — delete one first`;
            saveInlineBtn.classList.remove('cst-save-inline-btn--saved');
            setTimeout(() => {
              if (saveInlineBtn) saveInlineBtn.textContent = 'Save style';
            }, 3000);
            return;
          }
          throw err;
        }
        await this._updateChip(sessionLang);
        await _refreshProfilesBtn();
        saveInlineBtn.textContent = '✓ Saved';
        saveInlineBtn.classList.add('cst-save-inline-btn--saved');

        // Fire AI summary in background — update profile when ready
        const sessionMessages = this._session.messages;
        chrome.runtime.sendMessage({
          action: 'generateStyleSummary',
          userMessages,
          fullConversation: sessionMessages,
        }, async (res) => {
          if (res?.summary) {
            profile.aiSummary = res.summary;
            await this._saveProfile(profile, sessionLang);
          }
        });

        // Re-enable after 3s so user can re-save after more messages
        setTimeout(() => {
          if (saveInlineBtn) {
            saveInlineBtn.disabled = false;
            saveInlineBtn.textContent = 'Save style';
            saveInlineBtn.classList.remove('cst-save-inline-btn--saved');
          }
        }, 3000);
      });
    }

    const input   = body.querySelector('#cstInput');
    const sendBtn = body.querySelector('#cstSendBtn');

    const send = () => {
      const text = input.value.trim();
      if (!text || this._session?.completed) return;
      if (text.length < this.MIN_MESSAGE_CHARS) {
        this._shakeInput(input);
        return;
      }
      input.value = '';

      if (this._isGarbageMessage(text)) {
        this._renderUserBubble(text, body);
        this._renderSystemHint("That doesn't look like a real reply. Write something you'd actually send to someone you're interested in.", body);
        this._session.messages.push({ role: 'user', text, ts: Date.now(), garbage: true });
        this._session.garbageCount = (this._session.garbageCount || 0) + 1;
        this._saveSessionState(this._session);
        this._showTypingIndicator(body);
        this._pendingReplyTimer = setTimeout(async () => {
          if (!this._session) return;
          const reply = await this._getAIMatchReply(true);
          this._hideTypingIndicator(body);
          this._session.messages.push({ role: 'match', text: reply, ts: Date.now() });
          this._renderMatchBubble(reply, body);
          await this._saveSessionState(this._session);
        }, 900);
        return;
      }

      this._handleUserMessage(body, text);
    };

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

    body.querySelector('#cstRestartBtn')?.addEventListener('click', () => {
      const lang = this._session?.language;
      const userCount = this._session?.messages?.filter(m => m.role === 'user' && !m.garbage).length || 0;
      const doRestart = () => {
        this._cancelPendingTimers();
        this._clearSessionState();
        this._session = null;
        this._startSession(body, lang);
      };
      // Only confirm if meaningful progress would be lost
      if (userCount >= 3) {
        this._showConfirm(
          'Start over?',
          `You've sent ${userCount} message${userCount !== 1 ? 's' : ''}. Restarting will clear this session.`,
          'Start over',
          doRestart
        );
      } else {
        doRestart();
      }
    });
  },
  // ── Handle user message ────────────────────────────────────────
  async _handleUserMessage(body, text) {
    if (!this._session) return;
    if (text.length < this.MIN_MESSAGE_CHARS) return;

    this._session.messages.push({ role: 'user', text, ts: Date.now() });
    this._renderUserBubble(text, body);
    this._updateProgress(body);
    this._saveSessionState(this._session);
    this._updateChip(this._session.language);

    const userCount = this._session.messages.filter(m => m.role === 'user' && !m.garbage).length;

    // Complete at target
    if (userCount >= this.TARGET_MESSAGES) {
      this._session.completed = true;
      await this._saveSessionState(this._session);
      // Hide save button — session is done
      const saveBtn = body.querySelector('#cstSaveInlineBtn');
      if (saveBtn) saveBtn.style.display = 'none';
      const input   = body.querySelector('#cstInput');
      const sendBtn = body.querySelector('#cstSendBtn');
      if (input)   { input.disabled = true; input.placeholder = 'Training complete'; }
      if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.4'; }
      this._showTypingIndicator(body);
      this._pendingReplyTimer = setTimeout(async () => {
        if (!this._session) return;
        const reply = await this._getAIMatchReply(false, true);
        this._hideTypingIndicator(body);
        this._session.messages.push({ role: 'match', text: reply, ts: Date.now() });
        this._renderMatchBubble(reply, body);
        await this._saveSessionState(this._session);
        this._showFinishBanner(body);
      }, 800 + Math.random() * 400);
      return;
    }

    // AI reply
    this._cancelPendingTimers();
    this._showTypingIndicator(body);
    this._pendingReplyTimer = setTimeout(async () => {
      if (!this._session) return;
      const reply = await this._getAIMatchReply();
      this._hideTypingIndicator(body);
      this._session.messages.push({ role: 'match', text: reply, ts: Date.now() });
      this._renderMatchBubble(reply, body);
      await this._saveSessionState(this._session);
      // Show "Save style" after every AI reply — from the very first one
      const saveBtn = body.querySelector('#cstSaveInlineBtn');
      if (saveBtn && !saveBtn.disabled && !saveBtn.classList.contains('cst-save-inline-btn--saved')) {
        saveBtn.style.display = 'inline-flex';
      }
    }, 800 + Math.random() * 600);
  },

  // ── Custom confirm dialog — matches plugin design ─────────────
  _showConfirm(title, message, confirmLabel, onConfirm) {
    // Remove any existing confirm
    document.querySelector('.cst-confirm-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'cst-confirm-overlay';
    overlay.innerHTML = `
      <div class="cst-confirm-panel">
        <p class="cst-confirm-title">${this._escapeHtml(title)}</p>
        <p class="cst-confirm-msg">${this._escapeHtml(message)}</p>
        <div class="cst-confirm-actions">
          <button class="cst-confirm-cancel" id="cstConfirmCancel">Cancel</button>
          <button class="cst-confirm-ok" id="cstConfirmOk">${this._escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    // Mount at document body level so it sits above everything and isn't clipped
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('is-open'));

    const close = () => {
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector('#cstConfirmOk').addEventListener('click', () => {
      close();
      onConfirm();
    });
    overlay.querySelector('#cstConfirmCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  },

  // ── Profiles panel — shows all trained language profiles ──────
  _showProfilesPanel(body, profiles, trainedLangs) {
    // Remove existing panel if open
    body.querySelector('.cst-profiles-panel')?.remove();

    const panel = document.createElement('div');
    panel.className = 'cst-profiles-panel';

    const items = trainedLangs.map(code => {
      const p = profiles[code];
      const label = this.LANGUAGES.find(l => l.code === code)?.label || code;
      const date = p.trainedAt
        ? new Date(p.trainedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '';
      const summary = p.aiSummary ? `<p class="cst-pp-summary">${this._escapeHtml(p.aiSummary)}</p>` : '';
      return `
        <div class="cst-pp-item" data-lang="${code}">
          <div class="cst-pp-item-header">
            <span class="cst-pp-lang">${this._escapeHtml(label)}</span>
            <span class="cst-pp-meta">${date ? `Trained ${date} · ${p.messageCount || 0} msgs` : ''}</span>
          </div>
          ${summary}
          <div class="cst-pp-actions">
            <button class="cst-pp-view-btn" data-lang="${code}">View</button>
            <button class="cst-pp-delete-btn" data-lang="${code}" title="Delete ${label} profile">✕</button>
          </div>
        </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="cst-pp-header">
        <span class="cst-pp-title">Trained Profiles</span>
        <button class="cst-pp-close" id="cstPpClose">✕</button>
      </div>
      <div class="cst-pp-list">${items}</div>
      <button class="cst-pp-train-another" id="cstPpTrainAnother">+ Train Another Language</button>
    `;

    body.querySelector('.cst-chat-wrap')?.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('is-open'));

    panel.querySelector('#cstPpClose').addEventListener('click', () => {
      panel.classList.remove('is-open');
      setTimeout(() => panel.remove(), 220);
    });

    panel.querySelectorAll('.cst-pp-view-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        panel.remove();
        const p = await this._loadProfile(btn.dataset.lang);
        if (p) this._renderCompletionScreen(body, p, p.aiSummary || null, btn.dataset.lang);
      });
    });

    panel.querySelectorAll('.cst-pp-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lang = btn.dataset.lang;
        const label = this.LANGUAGES.find(l => l.code === lang)?.label || lang;
        this._showConfirm(
          `Delete ${label} style?`,
          `This will permanently remove your trained ${label} profile. This cannot be undone.`,
          'Delete',
          async () => {
            await this._saveProfile(null, lang);
            await this._updateChip(this._session?.language);
            if (typeof this._refreshProfilesBtn === 'function') await this._refreshProfilesBtn();
            panel.remove();
          }
        );
      });
    });

    panel.querySelector('#cstPpTrainAnother').addEventListener('click', async () => {
      panel.remove();
      const allProfiles = await this._loadAllProfiles();
      const untrained = this.LANGUAGES.find(l => !allProfiles[l.code]);
      const partial = this.LANGUAGES.find(l => allProfiles[l.code]?.partial);
      const target = untrained || partial || this.LANGUAGES[0];
      this._cancelPendingTimers();
      this._clearSessionState();
      this._session = null;
      await this._renderIntroScreen(body, target.code);
    });

    // Close on outside click — delay so the button click that opened it doesn't immediately close it
    const outside = (e) => {
      if (!panel.contains(e.target)) {
        panel.classList.remove('is-open');
        setTimeout(() => panel.remove(), 220);
        document.removeEventListener('click', outside);
      }
    };
    panel.addEventListener('click', (e) => e.stopPropagation());
    setTimeout(() => document.addEventListener('click', outside), 50);
  },

  // ── Finish banner ──────────────────────────────────────────────
  _showFinishBanner(body) {
    const container = this._getMessagesContainer(body);
    if (!container) return;

    const banner = document.createElement('div');
    banner.className = 'cst-finish-banner';
    banner.innerHTML = `
      <div class="cst-finish-banner-inner">
        <span class="cst-finish-icon">🎉</span>
        <p class="cst-finish-title">Training complete!</p>
        <p class="cst-finish-sub">Your style has been captured. Tap below to see what the AI learned.</p>
        <button class="cst-finish-btn" id="cstFinishBtn">See Results</button>
      </div>
    `;
    container.appendChild(banner);
    this._scrollToBottom(container);

    banner.querySelector('#cstFinishBtn').addEventListener('click', () => {
      this._completeSession(body);
    });
  },

  // ── Quality gate ───────────────────────────────────────────────
  // Returns { valid: bool, ratio: number, validMessages: string[] }
  _qualityCheck(messages) {
    const validMessages = messages.filter(m => !this._isGarbageMessage(m));
    const ratio = messages.length > 0 ? validMessages.length / messages.length : 0;
    return { valid: ratio >= this.MIN_QUALITY_RATIO, ratio, validMessages };
  },

  // ── Garbage detection ──────────────────────────────────────────
  _isGarbageMessage(text) {
    const t = (text || '').trim();
    if (t.length < this.MIN_MESSAGE_CHARS) return true;

    const words  = t.split(/\s+/).filter(Boolean);

    // Non-Latin scripts — skip vowel/consonant checks
    const hasNonLatin = /[^\u0000-\u024F\s\d\p{P}]/u.test(t);
    if (hasNonLatin) {
      if (words.length === 1 && t.length < 3) return true;
      if (/^(.)\1{4,}$/.test(t)) return true;
      return false;
    }

    const letters = (t.match(/[a-zA-Z]/g) || []).length;
    const vowels  = (t.match(/[aeiouáéíóúàèìòùäëïöü]/gi) || []).length;

    // No letters at all
    if (letters === 0) return true;

    // Single word checks
    if (words.length === 1) {
      if (vowels === 0) return true;                        // no vowels = definitely garbage
      if (/^(.{1,3})\1{2,}$/.test(t)) return true;        // repeating n-gram: "fgfg"
      if (t.length >= 4) {
        const rev = t.split('').reverse().join('');
        if (rev === t && vowels / letters < 0.4) return true;              // palindrome with low vowels
        if (rev.startsWith(t.slice(0, Math.floor(t.length / 2))) && vowels / letters < 0.3) return true;
      }
      // Short single words with vowels are valid ("paris", "cool", "haha", "yes")
      // Only block if truly no signal: all consonants, very short
      if (t.length < 3) return true;
    }

    // No vowels in latin text
    if (letters >= 3 && vowels === 0) return true;

    // Vowel ratio too low
    if (letters >= 4 && vowels / letters < 0.15) return true;

    // Repeating char: "aaaa"
    if (/^(.)\1{3,}$/.test(t)) return true;

    // Repeating n-gram across whole string: "fgfgfg", "abcabc"
    if (/^(.{1,4})\1{2,}$/.test(t)) return true;

    // Repeated word spam: "ok ok ok ok"
    if (words.length >= 4) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1) return true;
      if (uniqueWords.size / words.length < 0.35) return true;
    }

    return false;
  },

  // ── Complete session ───────────────────────────────────────────
  async _completeSession(body) {
    this._cancelPendingTimers();
    if (!this._session) return;

    const userMessages = this._session.messages.filter(m => m.role === 'user' && !m.garbage).map(m => m.text);
    if (userMessages.length < 1) return;

    const { valid } = this._qualityCheck(userMessages);
    if (!valid) {
      await this._clearSessionState();
      const failedLang = this._session.language || 'en';
      this._session = null;
      this._renderLowQualityScreen(body, failedLang);
      return;
    }

    const profile = this._buildProfile(userMessages);
    // Save full conversation for replay view
    profile.savedMessages = this._session.messages.filter(m => m.role === 'match' || m.role === 'user');
    profile.personaName   = this._session.persona?.name || null;
    const sessionLang = this._session.language || 'en';

    try {
      await this._saveProfile(profile, sessionLang);
    } catch (err) {
      if (err?.message?.startsWith('MAX_PROFILES')) {
        await this._clearSessionState();
        this._session = null;
        this._renderProfileCapScreen(body, sessionLang);
        return;
      }
      throw err;
    }

    await this._clearSessionState();
    await this._updateChip(sessionLang);

    const sessionMessages = this._session.messages;
    this._session = null;

    // Render completion screen immediately, then fetch AI summary async
    this._renderCompletionScreen(body, profile, null, sessionLang);

    // Fire AI summary in background — update the screen when ready
    try {
      const res = await new Promise(resolve =>
        chrome.runtime.sendMessage({
          action: 'generateStyleSummary',
          userMessages,
          fullConversation: sessionMessages,
        }, resolve)
      );
      if (res?.summary) {
        // Update profile with summary and re-save
        profile.aiSummary = res.summary;
        await this._saveProfile(profile, sessionLang);
        // Update the summary element in DOM if still visible
        const summaryEl = body.querySelector('#cstAiSummary');
        if (summaryEl) {
          summaryEl.textContent = res.summary;
          summaryEl.classList.add('cst-ai-summary--loaded');
        }
      }
    } catch (_) { /* summary is optional — fail silently */ }
  },

  // ── Profile cap screen ─────────────────────────────────────────
  _renderProfileCapScreen(body, lang) {
    const langLabel = this.LANGUAGES.find(l => l.code === lang)?.label || lang;
    this._updateChip(lang);
    body.innerHTML = `
      <div class="cst-complete">
        <div class="cst-complete-check cst-complete-check--warn">
          <svg viewBox="0 0 24 24">
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
        </div>
        <p class="cst-complete-title">Profile limit reached</p>
        <p class="cst-complete-sub">You already have ${this.MAX_PROFILES} trained profiles. Delete one to save your ${langLabel} style.</p>
        <button class="cst-retrain-btn" id="cstManageProfilesBtn">Manage Profiles</button>
      </div>
    `;
    body.querySelector('#cstManageProfilesBtn').addEventListener('click', async () => {
      const profiles = await this._loadAllProfiles();
      const trainedLangs = Object.keys(profiles).filter(k => profiles[k]?.trained);
      this._showProfilesPanel(body, profiles, trainedLangs);
    });
  },

  // ── Low quality screen ─────────────────────────────────────────
  _renderLowQualityScreen(body, lang) {
    this._updateChip(lang);
    body.innerHTML = `
      <div class="cst-complete">
        <div class="cst-complete-check cst-complete-check--warn">
          <svg viewBox="0 0 24 24">
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
        </div>
        <p class="cst-complete-title">Replies too short to learn from</p>
        <p class="cst-complete-sub">The AI needs real sentences to pick up your style. Single words or random characters don't give it enough to work with. Try again and reply the way you'd actually text someone.</p>
        <button class="cst-retrain-btn" id="cstRetrainBtn">Try Again</button>
      </div>
    `;
    body.querySelector('#cstRetrainBtn').addEventListener('click', () => {
      this._clearSessionState();
      this._startSession(body, lang);
    });
  },

  // ── Typing indicator ───────────────────────────────────────────
  _showTypingIndicator(body) {
    const container = this._getMessagesContainer(body);
    if (!container || container.querySelector('.cst-typing')) return;
    const typing = document.createElement('div');
    typing.className = 'cst-bubble cst-bubble--match cst-typing';
    typing.innerHTML = `
      <span class="cst-avatar">${this._session?.persona?.name?.[0] || '?'}</span>
      <span class="cst-bubble-text cst-typing-dots">
        <span></span><span></span><span></span>
      </span>
    `;
    container.appendChild(typing);
    this._scrollToBottom(container);
  },

  _hideTypingIndicator(body) {
    const container = this._getMessagesContainer(body);
    container?.querySelector('.cst-typing')?.remove();
  },

  // ── Get AI match reply ─────────────────────────────────────────
  async _getAIMatchReply(lastWasGarbage = false, isFinal = false) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({
        action: 'generateStyleTrainingReply',
        conversation: this._session.messages,
        personaName: this._session.persona.name,
        language: this._session.language || 'en',
        lastWasGarbage,
        isFinal,
      }, response => {
        if (chrome.runtime.lastError || !response?.reply) {
          const idx = this._session.followUpIndex % this.FOLLOW_UPS.length;
          this._session.followUpIndex++;
          resolve(this.FOLLOW_UPS[idx]);
        } else {
          let clean = response.reply.trim()
            .replace(/^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d]+$/g, '')
            .replace(new RegExp(`^${this._session.persona.name}\\s*:\\s*`, 'i'), '')
            .trim();
          resolve(clean || response.reply);
        }
      });
    });
  },

  // ── Render bubbles (pure DOM, no state mutation) ───────────────
  _renderMatchBubble(text, body) {
    const container = this._getMessagesContainer(body);
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = 'cst-bubble cst-bubble--match';
    bubble.innerHTML = `<span class="cst-avatar">${this._session.persona.name[0]}</span><span class="cst-bubble-text">${this._escapeHtml(text)}</span>`;
    container.appendChild(bubble);
    this._scrollToBottom(container);
  },

  _renderUserBubble(text, body) {
    const container = this._getMessagesContainer(body);
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = 'cst-bubble cst-bubble--user';
    bubble.innerHTML = `<span class="cst-bubble-text">${this._escapeHtml(text)}</span>`;
    container.appendChild(bubble);
    this._scrollToBottom(container);
  },

  // System hint — shown below a garbage message, not counted as a real reply
  _renderSystemHint(text, body) {
    const container = this._getMessagesContainer(body);
    if (!container) return;
    const hint = document.createElement('div');
    hint.className = 'cst-system-hint';
    hint.textContent = text;
    container.appendChild(hint);
    this._scrollToBottom(container);
  },

  // Kept for back-compat only — callers should use _renderMatchBubble / _renderUserBubble directly
  _appendMatchMessage(text, body) { this._renderMatchBubble(text, body); },
  _appendUserMessage(body, text)  { this._renderUserBubble(text, body); },

  // ── Progress ───────────────────────────────────────────────────
  _updateProgress(body) {
    const count = this._session?.messages.filter(m => m.role === 'user' && !m.garbage).length || 0;
    const fill  = body.querySelector('#cstProgressFill');
    const label = body.querySelector('#cstProgressLabel');
    if (fill)  fill.style.width  = `${Math.min((count / this.TARGET_MESSAGES) * 100, 100)}%`;
    if (label) label.textContent = `${count} / ${this.TARGET_MESSAGES}`;
  },

  // ── Style analyser ─────────────────────────────────────────────
  _buildProfile(messages) {
    try {
      // Work only with quality-passing messages for analysis
      const { validMessages } = this._qualityCheck(messages);
      const source = validMessages.length >= 4 ? validMessages : messages;

      const avgLen = source.reduce((s, m) => s + m.length, 0) / source.length;

      let totalEmojis = 0;
      try {
        const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
        totalEmojis = source.reduce((s, m) => s + (m.match(emojiRegex) || []).length, 0);
      } catch (_) {
        totalEmojis = source.reduce((s, m) => s + (m.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length, 0);
      }

      const emojiRate     = totalEmojis / source.length;
      const questionCount = source.filter(m => m.includes('?')).length;
      const lowerCount    = source.filter(m => m.length > 3 && m[0] === m[0].toLowerCase()).length;
      const lowerRatio    = lowerCount / source.length;
      const hahaCount     = source.filter(m => /\b(haha|lol|lmao|hehe|omg|ngl|fr|imo|tbh|lowkey)\b/i.test(m)).length;
      const noPeriodCount = source.filter(m => m.trim().length > 3 && !m.trim().endsWith('.')).length;

      const length = avgLen < 40 ? 'short' : avgLen < 100 ? 'medium' : 'long';
      const emoji  = emojiRate === 0 ? 'none'
                   : emojiRate < 0.5 ? 'light'
                   : emojiRate < 1.5 ? 'moderate' : 'heavy';

      let tone = 'casual';
      if (lowerRatio > 0.65 && hahaCount >= 2) tone = 'playful-casual';
      else if (lowerRatio <= 0.4)              tone = 'formal';

      const asksQuestions    = questionCount >= Math.floor(source.length * 0.35);
      const skipsPunctuation = noPeriodCount / source.length > 0.6;

      const slangTokens = ['tbh','ngl','fr','lowkey','highkey','lol','lmao','haha','omg','imo','rn','idk','idc','nvm','smh','ik','ikr'];
      const slangUsed = slangTokens.filter(s =>
        source.some(m => new RegExp(`\\b${s}\\b`, 'i').test(m))
      );

      // Pick 3 diverse examples — short, medium, long — capped at MAX_EXAMPLE_LENGTH
      const byLen = [...source].sort((a, b) => a.length - b.length);
      const candidates = [
        byLen[0],
        byLen[Math.floor(byLen.length / 2)],
        byLen[byLen.length - 1],
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      const examples = candidates
        .map(e => e.length > this.MAX_EXAMPLE_LENGTH ? e.slice(0, this.MAX_EXAMPLE_LENGTH) : e)
        .slice(0, 3);

      return {
        trained:          true,
        partial:          messages.length < this.TARGET_MESSAGES,
        length,
        emoji,
        tone,
        asksQuestions,
        skipsPunctuation,
        slangUsed,
        examples,
        trainingLanguage: this._session?.language || 'en',
        trainedAt:        new Date().toISOString(),
        messageCount:     messages.length,
        qualityRatio:     Math.round((validMessages.length / messages.length) * 100),
      };
    } catch (err) {
      console.error('[ChatStyleTraining] Profile build failed:', err);
      // On unexpected error — return trained:false so the block is skipped in openai.js
      return {
        trained: false, partial: false,
        length: 'medium', emoji: 'light', tone: 'casual',
        asksQuestions: true, skipsPunctuation: true,
        slangUsed: [], examples: [],
        trainedAt: new Date().toISOString(), messageCount: messages.length,
        qualityRatio: 0,
      };
    }
  },

  // ── Completion screen ──────────────────────────────────────────
  _renderCompletionScreen(body, profile, summary, lang) {
    const traitMap = {
      length: { short: 'Short messages', medium: 'Medium messages', long: 'Detailed messages' },
      emoji:  { none: 'No emoji', light: 'Light emoji', moderate: 'Moderate emoji', heavy: 'Heavy emoji' },
      tone:   { casual: 'Casual tone', 'playful-casual': 'Playful & casual', formal: 'Formal tone' },
    };

    const traits = [
      traitMap.length[profile.length] || 'Natural length',
      traitMap.emoji[profile.emoji]   || 'Some emoji',
      traitMap.tone[profile.tone]     || 'Natural tone',
      profile.asksQuestions ? 'Asks follow-ups' : 'Statement style',
    ];

    const trainedDate = profile.trainedAt
      ? new Date(profile.trainedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';

    const langLabel = this.LANGUAGES.find(l => l.code === (lang || profile.trainingLanguage || 'en'))?.label || 'English';
    const existingSummary = summary || profile.aiSummary || null;
    const isPartial = !!profile.partial;
    const msgCount = profile.messageCount || 0;

    body.innerHTML = `
      <div class="cst-complete">
        <div class="cst-complete-check${isPartial ? ' cst-complete-check--partial' : ''}">
          ${isPartial
            ? `<svg class="cst-clock-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="4" x2="12" y2="12"/><line x1="12" y1="12" x2="17" y2="15"/></svg>`
            : `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
          }
        </div>
        <p class="cst-complete-title">${isPartial ? 'Partial Style Saved' : 'Style Captured'}</p>
        <p class="cst-complete-lang-badge">${langLabel}</p>
        <p class="cst-complete-date">${isPartial
          ? `${msgCount} of ${this.TARGET_MESSAGES} messages · more improves accuracy`
          : trainedDate ? `Trained ${trainedDate} · ${msgCount} messages` : 'Style profile saved'
        }</p>
        <div class="cst-traits">
          ${traits.map(t => `<span class="cst-trait-chip">${t}</span>`).join('')}
        </div>
        ${!isPartial ? `
        <div class="cst-ai-summary-wrap">
          <p class="cst-ai-summary-label">What the AI noticed</p>
          <p class="cst-ai-summary ${existingSummary ? 'cst-ai-summary--loaded' : ''}" id="cstAiSummary">${existingSummary ? this._escapeHtml(existingSummary) : '<span class="cst-ai-summary-loading"><span></span><span></span><span></span></span>'}</p>
        </div>` : ''}
        <p class="cst-complete-sub">${isPartial
          ? `This partial profile is already active for ${langLabel} conversations. Continue training to improve accuracy.`
          : `When the automation sends messages to your matches in ${langLabel}, it will write them in your style — same length, tone, emoji habits, and vocabulary.`
        }</p>
        <div class="cst-complete-actions">
          ${isPartial
            ? `<button class="cst-retrain-btn" id="cstContinueBtn">Continue Training</button>`
            : `<button class="cst-retrain-btn" id="cstRetrainBtn">Retrain ${langLabel}</button>`
          }
          <button class="cst-train-another-btn" id="cstTrainAnotherBtn">+ Train Another Language</button>
        </div>
        ${profile.savedMessages?.length ? `<button class="cst-view-chat-btn" id="cstViewChatBtn">View training chat</button>` : ''}
      </div>
    `;

    // Continue training (partial) — resumes existing session with saved messages
    body.querySelector('#cstContinueBtn')?.addEventListener('click', async () => {
      this._cancelPendingTimers();
      await this._clearSessionState();
      const persona = this.PERSONAS[Math.floor(Math.random() * this.PERSONAS.length)];
      this._session = {
        messages: profile.savedMessages ? profile.savedMessages.map(m => ({ ...m })) : [],
        persona: { name: profile.personaName || persona.name, opener: '' },
        followUpIndex: 0,
        completed: false,
        language: lang || profile.trainingLanguage || 'en',
      };
      await this._saveSessionState(this._session);
      await this._renderCard(body, null, this._session.language);
    });

    // Retrain (full profile) — fresh session
    body.querySelector('#cstRetrainBtn')?.addEventListener('click', () => {
      this._clearSessionState();
      this._startSession(body, lang || profile.trainingLanguage || 'en');
    });

    body.querySelector('#cstTrainAnotherBtn').addEventListener('click', async () => {
      const allProfiles = await this._loadAllProfiles();
      const untrained = this.LANGUAGES.find(l => !allProfiles[l.code]);
      const partial = this.LANGUAGES.find(l => allProfiles[l.code]?.partial);
      const target = untrained || partial || this.LANGUAGES[0];
      await this._renderIntroScreen(body, target.code);
    });

    body.querySelector('#cstViewChatBtn')?.addEventListener('click', () => {
      this._renderChatReplay(body, profile, lang);
    });
  },

  // ── Chat replay (read-only) ────────────────────────────────────
  _renderChatReplay(body, profile, lang) {
    if (!profile?.savedMessages?.length) {
      // No saved messages — nothing to show
      return;
    }
    const trainedDate = profile.trainedAt
      ? new Date(profile.trainedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';
    body.innerHTML = `
      <div class="cst-replay-wrap">
        <div class="cst-replay-header">
          <button class="cst-replay-back" id="cstReplayBack">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M19 12H5M5 12L11 18M5 12L11 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Back
          </button>
          <span class="cst-replay-title">Training conversation</span>
        </div>
        <div class="cst-messages cst-messages--replay" id="cstReplayMessages">
          <div class="cst-date-sep">${trainedDate ? `Trained ${trainedDate}` : 'Training chat'}</div>
          ${profile.savedMessages.map(m => {
            if (m.role === 'match') {
              const initial = profile.personaName?.[0] || '?';
              return `<div class="cst-bubble cst-bubble--match"><span class="cst-avatar">${this._escapeHtml(initial)}</span><span class="cst-bubble-text">${this._escapeHtml(m.text)}</span></div>`;
            }
            if (m.role === 'user') {
              return `<div class="cst-bubble cst-bubble--user${m.garbage ? ' cst-bubble--garbage' : ''}"><span class="cst-bubble-text">${this._escapeHtml(m.text)}</span></div>`;
            }
            return '';
          }).join('')}
        </div>
      </div>
    `;
    body.querySelector('#cstReplayBack').addEventListener('click', () => {
      this._renderCompletionScreen(body, profile, profile.aiSummary || null, lang);
    });
    requestAnimationFrame(() => {
      const msgs = body.querySelector('#cstReplayMessages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    });
  },

  // ── Storage ────────────────────────────────────────────────────

  // Load all per-language profiles
  async _loadAllProfiles() {
    return new Promise(resolve => {
      chrome.storage.local.get('userSettings', data => {
        resolve(data?.userSettings?.chatStyleProfiles || {});
      });
    });
  },

  // Load profile for a specific language code
  async _loadProfile(lang) {
    const code = lang || 'en';
    return new Promise(resolve => {
      chrome.storage.local.get('userSettings', data => {
        const profiles = data?.userSettings?.chatStyleProfiles || {};
        resolve(profiles[code] || null);
      });
    });
  },

  // Save or delete profile for a specific language code
  async _saveProfile(profile, lang) {
    const code = lang || 'en';
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('userSettings', data => {
        const settings = data?.userSettings || {};
        if (!settings.chatStyleProfiles) settings.chatStyleProfiles = {};

        if (profile === null) {
          // Deletion — always allowed
          delete settings.chatStyleProfiles[code];
          chrome.storage.local.set({ userSettings: settings }, resolve);
          return;
        }

        const existing = settings.chatStyleProfiles;
        const trainedLangs = Object.keys(existing).filter(k => existing[k]?.trained);
        const isUpdate = !!existing[code]?.trained; // updating an existing slot

        if (!isUpdate && trainedLangs.length >= this.MAX_PROFILES) {
          // Cap reached — reject so callers can surface the error
          reject(new Error(`MAX_PROFILES:${this.MAX_PROFILES}`));
          return;
        }

        settings.chatStyleProfiles[code] = profile;
        chrome.storage.local.set({ userSettings: settings }, resolve);
      });
    });
  },

  // One-time migration: old single chatStyleProfile → chatStyleProfiles[lang]
  async _migrateLeacyProfile() {
    return new Promise(resolve => {
      chrome.storage.local.get('userSettings', data => {
        const settings = data?.userSettings || {};
        const legacy = settings.chatStyleProfile;
        if (!legacy) return resolve();
        const lang = legacy.trainingLanguage || 'en';
        if (!settings.chatStyleProfiles) settings.chatStyleProfiles = {};
        // Only migrate if this language slot is empty
        if (!settings.chatStyleProfiles[lang]) {
          settings.chatStyleProfiles[lang] = legacy;
        }
        delete settings.chatStyleProfile;
        chrome.storage.local.set({ userSettings: settings }, resolve);
      });
    });
  },

  async _saveSessionState(session) {
    return new Promise(resolve => {
      chrome.storage.local.set({
        _cstSessionState: {
          messages:     session.messages,
          persona:      session.persona,
          followUpIndex: session.followUpIndex,
        },
      }, resolve);
    });
  },

  async _loadSessionState() {
    return new Promise(resolve => {
      chrome.storage.local.get('_cstSessionState', data => {
        resolve(data?._cstSessionState || null);
      });
    });
  },

  async _clearSessionState() {
    return new Promise(resolve => {
      chrome.storage.local.remove('_cstSessionState', resolve);
    });
  },

  // ── DOM helpers ────────────────────────────────────────────────
  _getMessagesContainer(body) {
    return body?.querySelector('#cstMessages')
      ?? document.querySelector('.automation-v2-card[data-automation-card="style"] #cstMessages');
  },

  _scrollToBottom(el) {
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  },

  _shakeInput(input) {
    input.classList.remove('cst-input--shake');
    void input.offsetWidth;
    input.classList.add('cst-input--shake');

    // Show hint below the input
    const hint = input.closest('.cst-footer')?.querySelector('#cstInputHint');
    if (hint) {
      hint.textContent = "Write at least a few words, like you'd actually text someone.";
      hint.classList.add('cst-input-hint--visible');
    }

    setTimeout(() => {
      input.classList.remove('cst-input--shake');
      if (hint) hint.classList.remove('cst-input-hint--visible');
    }, 2200);
  },

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

window.ChatStyleTraining = ChatStyleTraining;
