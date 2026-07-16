const AutomationViews = {
  _boundSummaryListeners: false,
  _isSyncingGoalControls: false,
  _goalDropdownOpen: false,

  goalOptions: {
    phone: 'Get Phone Number',
    date: 'Set up a Date',
    instagram: 'Get Social Media',
    move_to_telegram: 'Move to Telegram',
    move_to_instagram: 'Move to Instagram',
    move_to_tango: 'Move to Tango',
    never: 'Keep Engaging'
  },

  getShellTemplate() {
    return `
      <div class="automation-v2-shell">

        <div class="automation-v2-card automation-v2-card--cloud" id="cloudModeCard" data-automation-card="cloud" style="display:none;">
          <div class="automation-v2-cloud-header">
            <div class="automation-v2-cloud-left">
              <span class="automation-v2-cloud-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="automation-v2-cloud-text">
                <span class="automation-v2-card-title">Cloud Mode</span>
                <span class="automation-v2-cloud-sub" data-status="">Run 24/7 — no computer needed</span>
              </div>
            </div>
            <label class="automation-v2-cloud-switch" aria-label="Enable Cloud Mode">
              <input type="checkbox" id="cloudModeToggle">
              <span class="automation-v2-cloud-switch-slider"></span>
            </label>
          </div>
        </div>

        <div class="automation-v2-card" data-automation-card="goal">
          <button class="automation-v2-card-header" type="button" aria-expanded="false">
            <span class="automation-v2-card-title">Your Dating Goal</span>
            <svg class="automation-v2-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="automation-v2-collapsed-row"></div>
          <div class="automation-v2-card-body" data-legacy-body="goal"></div>
        </div>

        <div class="automation-v2-card" data-automation-card="swiping">
          <button class="automation-v2-card-header" type="button" aria-expanded="false">
            <span class="automation-v2-card-title">Swiping</span>
            <svg class="automation-v2-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="automation-v2-collapsed-row"></div>
          <div class="automation-v2-card-body" data-legacy-body="swiping"></div>
        </div>

        <div class="automation-v2-card" data-automation-card="messaging">
          <button class="automation-v2-card-header" type="button" aria-expanded="false">
            <span class="automation-v2-card-title">Messaging</span>
            <svg class="automation-v2-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="automation-v2-collapsed-row"></div>
          <div class="automation-v2-card-body" data-legacy-body="messaging"></div>
        </div>

        <div class="automation-v2-card" data-automation-card="style">
          <button class="automation-v2-card-header" type="button" aria-expanded="false">
            <span class="automation-v2-card-title">Your Chat Style</span>
            <svg class="automation-v2-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="automation-v2-collapsed-row"></div>
          <div class="automation-v2-card-body"></div>
        </div>

        <div class="automation-v2-card automation-v2-card--active-time" data-automation-card="active-time">
          <div class="at-card-header">
            <span class="automation-v2-card-title">AI Active Time</span>
            <label class="toggle-switch at-toggle-label" id="atToggleLabel">
              <input type="checkbox" id="atToggleInput">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="automation-v2-collapsed-row" id="atCollapsedRow" style="display:none;">
            <span class="automation-v2-chip" id="atRangeDisplay">–</span>
          </div>
          <div class="at-card-body" id="atCardBody" style="display:none;"></div>
        </div>
      </div>
    `;
  },

  _getLegacySections() {
    return {
      goal: [document.getElementById('stopConditionSection')].filter(Boolean),
      swiping: [
        document.getElementById('cycleSettingsSection'),
        document.getElementById('ageFilterSectionHeader')?.closest('.section'),
        document.getElementById('distanceFilterSectionHeader')?.closest('.section'),
        document.getElementById('visualPreferencesSectionHeader')?.closest('.section')
      ].filter(Boolean),
      messaging: [
        document.getElementById('messagePrioritySection'),
        document.getElementById('aiPersonalitySection')
      ].filter(Boolean)
    };
  },

  _mountLegacySections() {
    const sectionMap = this._getLegacySections();

    Object.entries(sectionMap).forEach(([cardKey, sections]) => {
      const body = document.querySelector(`.automation-v2-card-body[data-legacy-body="${cardKey}"]`);
      if (!body) return;

      sections.forEach((section) => {
        section.classList.add('automation-v2-legacy-section');
        body.appendChild(section);
      });
    });
  },

  _syncMoveOffAppConfigVisibility() {
    const configEl = document.getElementById('automationMoveOffAppConfig');
    if (!configEl) return;
    const activeGoals = this._getActiveGoalValues();
    const isMoveOffApp = activeGoals.some(g => g.startsWith('move_to_'));
    configEl.classList.toggle('is-visible', isMoveOffApp);

    const recalcCardHeight = () => {
      const goalCard = document.querySelector('.automation-v2-card[data-automation-card="goal"]');
      const body = goalCard?.querySelector('.automation-v2-card-body');
      if (!body) return;
      if (body.style.maxHeight === 'none' || body.style.maxHeight === '') {
        void body.offsetHeight;
      } else if (body.style.maxHeight && body.style.maxHeight !== '0px') {
        body.style.maxHeight = body.scrollHeight + 'px';
        setTimeout(() => { body.style.maxHeight = 'none'; }, 350);
      }
    };

    if (isMoveOffApp) {
      // Do NOT auto-open the contact section — user opens it manually.
      // It being collapsed is the desired default even when a move-to goal is active.
      setTimeout(recalcCardHeight, 50);
      setTimeout(recalcCardHeight, 350);
    } else {
      setTimeout(recalcCardHeight, 50);
    }
  },

  // Legacy aliases kept for backwards compat with any external calls
  _syncTelegramConfigVisibility()  { this._syncMoveOffAppConfigVisibility(); },
  _syncInstagramConfigVisibility() { this._syncMoveOffAppConfigVisibility(); },
  _syncTangoConfigVisibility()     { this._syncMoveOffAppConfigVisibility(); },

  _getStopConditionCheckboxes() {
    return Array.from(document.querySelectorAll('input[name="stopCondition"]'));
  },

  _getCheckedStopConditions() {
    return this._getStopConditionCheckboxes().filter((cb) => cb.checked).map((cb) => cb.value);
  },

  _getActiveGoalValues() {
    return this._getCheckedStopConditions().filter((value) => value !== 'never');
  },

  _setStopConditions(selectedGoals, shouldStop) {
    const checkboxes = this._getStopConditionCheckboxes();
    if (!checkboxes.length) return;

    const validGoals = Array.from(new Set((selectedGoals || []).filter((value) => value in this.goalOptions && value !== 'never')));
    const shouldUseGoals = shouldStop && validGoals.length > 0;

    this._isSyncingGoalControls = true;

    checkboxes.forEach((cb) => {
      if (cb.value === 'never') {
        cb.checked = !shouldUseGoals;
      } else {
        cb.checked = shouldUseGoals && validGoals.includes(cb.value);
      }
    });

    const target = shouldUseGoals
      ? checkboxes.find((cb) => validGoals.includes(cb.value))
      : checkboxes.find((cb) => cb.value === 'never');

    if (target) {
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }

    this._isSyncingGoalControls = false;
    this._syncGoalHiddenInput();
    this._renderGoalDropdown();
  },

  _setGoalDropdownOpen(isOpen) {
    this._goalDropdownOpen = isOpen;
    const dropdown = document.getElementById('automationPrimaryGoalDropdown');
    if (!dropdown) return;

    dropdown.classList.toggle('is-open', isOpen);
    const trigger = dropdown.querySelector('.automation-v2-goal-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', String(isOpen));

    const goalCard = document.querySelector('.automation-v2-card[data-automation-card="goal"]');
    const body = goalCard ? goalCard.querySelector('.automation-v2-card-body') : null;
    if (body && body.style.maxHeight && body.style.maxHeight !== 'none') {
      setTimeout(() => {
        body.style.maxHeight = body.scrollHeight + 'px';
      }, 260);
    }
  },

  _syncGoalHiddenInput() {
    const goalInput = document.getElementById('automationPrimaryGoal');
    if (!goalInput) return;

    const activeGoals = this._getActiveGoalValues();
    goalInput.value = activeGoals[0] || 'never';
  },

  _renderGoalDropdown() {
    const valueEl = document.getElementById('automationPrimaryGoalValue');
    const optionEls = document.querySelectorAll('#automationPrimaryGoalDropdown .automation-v2-goal-option');
    if (!valueEl) return;

    const checked = this._getCheckedStopConditions();
    const activeGoals = checked.filter((value) => value !== 'never');

    if (!activeGoals.length) {
      valueEl.textContent = this.goalOptions.never;
    } else if (activeGoals.length === 1) {
      valueEl.textContent = this.goalOptions[activeGoals[0]] || this.goalOptions.phone;
    } else {
      valueEl.textContent = `${activeGoals.length} goals selected`;
    }

    optionEls.forEach((el) => {
      el.classList.toggle('is-selected', checked.includes(el.dataset.value));
    });

    this._syncGoalHiddenInput();
  },

  _buildGoalControls() {
    const section = document.getElementById('stopConditionSection');
    if (!section || section.querySelector('.automation-v2-goal-controls')) return;

    section.querySelector('.chip-group')?.classList.add('automation-v2-hidden-goal-group');

    const optionsHTML = Object.entries(this.goalOptions)
      .map(([value, label]) => `<button type="button" class="automation-v2-goal-option" data-value="${value}">${label}</button>`)
      .join('');

    const controls = document.createElement('div');
    controls.className = 'automation-v2-goal-controls';
    controls.innerHTML = `
      <div class="automation-v2-goal-field">
        <label class="automation-v2-goal-label">Primary Goal</label>
        <div class="automation-v2-goal-dropdown" id="automationPrimaryGoalDropdown">
          <input type="hidden" id="automationPrimaryGoal" value="never">
          <button type="button" class="automation-v2-goal-trigger" id="automationPrimaryGoalTrigger" aria-haspopup="listbox" aria-expanded="false">
            <span id="automationPrimaryGoalValue">Keep Engaging</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="automation-v2-goal-options" role="listbox">
            ${optionsHTML}
          </div>
        </div>
      </div>
      <div class="automation-v2-goal-divider"></div>
      <div class="automation-v2-goal-toggle-row">
        <span class="automation-v2-goal-toggle-text">Stop After Goal</span>
        <label class="automation-v2-goal-switch" aria-label="Stop After Goal">
          <input type="checkbox" id="automationStopAfterGoal">
          <span class="automation-v2-goal-switch-slider"></span>
        </label>
      </div>

      <div class="automation-v2-goal-divider"></div>

      <div class="automation-v2-contact-section" id="automationContactSection">
        <button type="button" class="automation-v2-contact-header" id="automationContactToggle" aria-expanded="false">
          <span class="automation-v2-goal-toggle-text">Your Contact Details</span>
          <svg class="automation-v2-contact-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="automation-v2-contact-body" id="automationContactBody">
          ${[
            { id: 'contactInstagram', label: 'Instagram', placeholder: '@yourhandle',    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig)" stroke-width="2"/><circle cx="12" cy="12" r="4.5" stroke="url(#ig)" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig)"/><defs><linearGradient id="ig" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse"><stop stop-color="#f09433"/><stop offset=".25" stop-color="#e6683c"/><stop offset=".5" stop-color="#dc2743"/><stop offset=".75" stop-color="#cc2366"/><stop offset="1" stop-color="#bc1888"/></linearGradient></defs></svg>` },
            // { id: 'contactWhatsapp',  label: 'WhatsApp',  placeholder: '+1 555 000 0000', svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.09-1.35A9.95 9.95 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#25D366"/><path d="M16.72 14.72c-.26.72-1.29 1.32-1.81 1.4-.48.08-1.08.11-1.74-.11-.4-.13-.91-.3-1.57-.59-2.75-1.19-4.55-3.95-4.69-4.13-.14-.18-1.12-1.49-1.12-2.84 0-1.35.71-2.01 1-2.3.26-.27.57-.34.76-.34h.55c.18 0 .43.07.67.51.26.46.89 2.15.97 2.31.08.16.13.34.03.55-.1.2-.15.33-.3.51-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.28.75 1.23 1.61 1.99.7.63 1.56 1.03 1.84 1.15.27.11.43.09.59-.05.16-.14.69-.81.87-1.09.18-.28.36-.23.61-.14.25.09 1.57.74 1.84.88.27.14.45.2.52.32.06.12.06.7-.2 1.43z" fill="#fff"/></svg>` },
            // { id: 'contactPhone',     label: 'Phone',     placeholder: '+1 555 000 0000', svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.08 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>` },
            { id: 'contactTelegram',  label: 'Telegram',  placeholder: '@yourhandle',    svg: `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#26A5E4"/><path d="M17.5 7.5l-2.75 9.5-3.5-3 2-2.25L9.5 14l-3-1 10.5-5.5z" fill="#fff"/></svg>` },
            { id: 'contactTango',     label: 'Tango',     placeholder: '@yourusername',  svg: `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#FF5C5C"/><text x="12" y="16" text-anchor="middle" fill="#fff" font-size="10" font-family="Arial" font-weight="bold">T</text></svg>` },
            // { id: 'contactSnapchat',  label: 'Snapchat',  placeholder: 'yourusername',   svg: `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c-2.8 0-5 2.2-5 5v1.5c-.6.1-1.2.5-1.5 1-.3.6-.2 1.2.2 1.7.3.4.7.6 1.1.7-.3.5-.7 1-1.3 1.3-.4.2-.5.6-.3 1 .5 1.1 2 1.4 3.3 1.5.4.5.9.8 1.5.8s1.1-.3 1.5-.8c1.3-.1 2.8-.4 3.3-1.5.2-.4.1-.8-.3-1-.6-.3-1-.8-1.3-1.3.4-.1.8-.3 1.1-.7.4-.5.5-1.1.2-1.7-.3-.5-.9-.9-1.5-1V7c0-2.8-2.2-5-5-5z" fill="#FFFC00" stroke="#d4d400" stroke-width=".5"/></svg>` },
          ].map(f => `
            <div class="automation-v2-contact-row" data-contact-platform="${f.id.replace('contact', '').toLowerCase()}">
              <span class="automation-v2-contact-icon">${f.svg}</span>
              <span class="automation-v2-contact-label">${f.label}</span>
              <input type="text" id="${f.id}Value" class="automation-v2-contact-input" placeholder="${f.placeholder}" autocomplete="off" spellcheck="false">
              <label class="automation-v2-goal-switch automation-v2-contact-toggle" aria-label="Enable ${f.label}">
                <input type="checkbox" id="${f.id}Enabled">
                <span class="automation-v2-goal-switch-slider"></span>
              </label>
            </div>
            <div class="automation-v2-handle-stat" id="handleStat_${f.id.replace('contact', '').toLowerCase()}">
              <span class="automation-v2-handle-stat-icon">✉</span>
              <span class="automation-v2-handle-stat-label">Sent to</span>
              <span class="automation-v2-handle-stat-count" id="handleCount_${f.id.replace('contact', '').toLowerCase()}">0</span>
              <span class="automation-v2-handle-stat-label">matches</span>
            </div>`).join('')}
          <p class="automation-v2-contact-privacy">Toggle on the details you want the AI to share when a match asks for your contact.</p>
          <div class="automation-v2-contact-divider"></div>
          <div class="automation-v2-contact-config-row" style="margin-top:4px;">
            <span class="automation-v2-contact-config-label">Your gender</span>
            <div class="automation-v2-gender-selector" id="automationGenderSelector">
              <button type="button" class="automation-v2-gender-btn" data-value="male" id="genderBtnMale">Male</button>
              <button type="button" class="automation-v2-gender-btn" data-value="female" id="genderBtnFemale">Female</button>
              <button type="button" class="automation-v2-gender-btn" data-value="auto" id="genderBtnAuto">Auto</button>
            </div>
          </div>
          <p class="automation-v2-contact-privacy" style="margin-top:2px;">Used for grammar in AI messages. Auto = detected from your profile. Set manually if Auto is wrong.</p>
          <div class="automation-v2-contact-telegram-config" id="automationMoveOffAppConfig">
            <div class="automation-v2-contact-config-row">
              <span class="automation-v2-contact-config-label">Push on all matches</span>
              <label class="automation-v2-goal-switch automation-v2-contact-toggle" aria-label="Push on all matches">
                <input type="checkbox" id="moveOffAppPushAllMatches">
                <span class="automation-v2-goal-switch-slider"></span>
              </label>
            </div>
            <p class="automation-v2-contact-privacy" style="margin-top:2px;">
              <b style="color:#6b7280;">ON</b> — AI must drop your handle in every message. No discretion.<br>
              <b style="color:#6b7280;">OFF</b> — AI waits for the right moment to bring it up.
            </p>
            <div class="automation-v2-contact-config-row" style="margin-top:8px;">
              <span class="automation-v2-contact-config-label">Messages before nudge</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <input type="number" id="moveOffAppMinMessages" class="automation-v2-contact-num-input" min="0" max="30" value="0" placeholder="Min" style="width:52px;">
                <span style="color:#9ca3af;font-size:12px;">to</span>
                <input type="number" id="moveOffAppMaxMessages" class="automation-v2-contact-num-input" min="0" max="30" value="0" placeholder="Max" style="width:52px;">
              </div>
            </div>
            <p class="automation-v2-contact-privacy" style="margin-top:2px;">
              AI will mention your handle at a random point between Min and Max messages.<br>
              Example: 5–8 = AI chats for 5–8 messages first, then brings it up naturally.<br>
              0–0 = AI picks the best moment on its own.
            </p>
            <div class="automation-v2-contact-config-row" style="margin-top:8px;">
              <span class="automation-v2-contact-config-label">Max persuasion attempts</span>
              <input type="number" id="moveOffAppMaxPersuasion" class="automation-v2-contact-num-input" min="1" max="5" value="2" placeholder="2">
            </div>
            <p class="automation-v2-contact-privacy" style="margin-top:2px;">
              How many times the AI tries to convince a match who rejects your handle.<br>
              After this many attempts, the AI stops messaging them.
            </p>
          </div>
        </div>
      </div>
    `;

    section.appendChild(controls);

    const trigger = document.getElementById('automationPrimaryGoalTrigger');
    const toggle = document.getElementById('automationStopAfterGoal');
    const contactToggleBtn = document.getElementById('automationContactToggle');
    const contactBody = document.getElementById('automationContactBody');

    if (!trigger || !toggle) return;

    // Contact Details collapse/expand — matches card CSS max-height pattern
    if (contactToggleBtn && contactBody) {
      contactToggleBtn.addEventListener('click', () => {
        const section = document.getElementById('automationContactSection');
        const isOpen = section?.classList.contains('is-open');
        section?.classList.toggle('is-open', !isOpen);
        contactToggleBtn.setAttribute('aria-expanded', String(!isOpen));
        // Recalculate parent card body height — run twice:
        // 1. At 50ms to catch immediate layout shift
        // 2. At 400ms after all CSS transitions complete (contact body 300ms + telegram config)
        const goalCard = document.querySelector('.automation-v2-card[data-automation-card="goal"]');
        const body = goalCard?.querySelector('.automation-v2-card-body');
        const recalc = () => {
          if (!body) return;
          if (body.style.maxHeight === 'none' || body.style.maxHeight === '') {
            void body.offsetHeight;
          } else if (body.style.maxHeight && body.style.maxHeight !== '0px') {
            body.style.maxHeight = body.scrollHeight + 'px';
            setTimeout(() => { body.style.maxHeight = 'none'; }, 350);
          }
        };
        setTimeout(recalc, 50);
        setTimeout(recalc, 400);
        this.refreshCollapsedChips();
      });
    }

    // Wire each contact toggle to enable/disable its input
    const contactFieldIds = [/*'contactWhatsapp', 'contactPhone',*/ 'contactInstagram', 'contactTelegram', 'contactTango', /*'contactSnapchat'*/];

    // Validation rules per field — used for real-time hint and prompt-side guard parity
    const CONTACT_VALIDATION = {
      contactWhatsapp: {
        validate: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 6; },
        hint: 'Include your country code, e.g. +1 555 000 0000',
        errorHint: 'Number looks too short — include your country code.',
      },
      contactPhone: {
        validate: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 6; },
        hint: 'Include your country code, e.g. +1 555 000 0000',
        errorHint: 'Number looks too short — include your country code.',
      },
      contactInstagram: {
        validate: (v) => v.replace(/\s/g, '').length >= 3,
        hint: 'Your handle, e.g. @yourname',
        errorHint: 'Handle must be at least 3 characters.',
      },
      contactTelegram: {
        validate: (v) => v.replace(/\s/g, '').length >= 3,
        hint: 'Your handle, e.g. @yourname',
        errorHint: 'Handle must be at least 3 characters.',
      },
      contactSnapchat: {
        validate: (v) => v.replace(/\s/g, '').length >= 3,
        hint: 'Your username, e.g. yourname',
        errorHint: 'Username must be at least 3 characters.',
      },
      contactTango: {
        validate: (v) => v.replace(/\s/g, '').length >= 3,
        hint: 'Your Tango username, e.g. @yourname',
        errorHint: 'Username must be at least 3 characters.',
      },
    };

    contactFieldIds.forEach(fieldId => {
      const enabledEl = document.getElementById(`${fieldId}Enabled`);
      const valueEl   = document.getElementById(`${fieldId}Value`);
      if (!enabledEl || !valueEl) return;

      const row       = valueEl.closest('.automation-v2-contact-row');
      const rules     = CONTACT_VALIDATION[fieldId];

      // ── Inline validation hint ──
      // Insert a hint element directly after the row (not inside it, to avoid layout shift).
      let hintEl = row?.nextElementSibling;
      if (rules && row && (!hintEl || !hintEl.classList.contains('automation-v2-contact-hint'))) {
        hintEl = document.createElement('p');
        hintEl.className = 'automation-v2-contact-hint';
        row.insertAdjacentElement('afterend', hintEl);
      }

      const updateHint = () => {
        if (!hintEl || !rules) return;
        const val = valueEl.value.trim();
        if (!enabledEl.checked || val === '') {
          // Disabled or empty — show neutral placeholder hint
          hintEl.textContent = enabledEl.checked ? rules.hint : '';
          hintEl.style.color = '#9ca3af';
          valueEl.style.borderColor = '';
          return;
        }
        if (rules.validate(val)) {
          hintEl.textContent = '';
          valueEl.style.borderColor = '#6366F1';
        } else {
          hintEl.textContent = rules.errorHint;
          hintEl.style.color = '#ef4444';
          valueEl.style.borderColor = '#ef4444';
        }
      };

      const syncInputState = (triggerSave = false) => {
        valueEl.disabled = !enabledEl.checked;
        valueEl.style.opacity = enabledEl.checked ? '1' : '0.7';
        valueEl.style.cursor  = enabledEl.checked ? 'text' : 'pointer';
        updateHint();
        this.refreshCollapsedChips();
        this.refreshHandleSentCounters();
        if (triggerSave && typeof markAsChanged === 'function') markAsChanged();
      };

      enabledEl.addEventListener('change', () => syncInputState(true));

      valueEl.addEventListener('input', () => {
        updateHint();
        this.refreshHandleSentCounters();
        if (typeof markAsChanged === 'function') markAsChanged();
      });

      valueEl.addEventListener('blur', () => updateHint());

      // When disabled input is clicked, shake it to draw attention to the toggle
      if (row) {
        row.addEventListener('pointerdown', (e) => {
          if (!enabledEl.checked && (e.target === valueEl || e.target.closest('.automation-v2-contact-input'))) {
            valueEl.classList.remove('automation-v2-contact-toggle-nudge');
            void valueEl.offsetWidth;
            valueEl.classList.add('automation-v2-contact-toggle-nudge');
            setTimeout(() => valueEl.classList.remove('automation-v2-contact-toggle-nudge'), 500);
          }
        });
      }

      syncInputState(false); // init — no save bar, just apply visual state
    });

    // ── Gender selector wiring ──
    document.querySelectorAll('.automation-v2-gender-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.automation-v2-gender-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        if (typeof markAsChanged === 'function') markAsChanged();
      });
    });

    // ── Populate contact fields from storage now that DOM exists ──
    // loadSettingsExtended() ran before this DOM was built, so we re-run
    // the population here to catch the onboarding migration and any saved values.
    if (typeof populateContactDetails === 'function') {
      populateContactDetails();
    }

    // ── Restore gender override selection after DOM is built ──
    chrome.storage.local.get(['userSettings'], (r) => {
      const s = r?.userSettings || {};

      // Restore gender override
      const genderOverride = s.userGenderOverride || 'auto';
      document.querySelectorAll('.automation-v2-gender-btn').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.value === genderOverride);
      });

      // Restore Move Off App config fields (shared by Telegram, Instagram, Tango goals)
      const moveOffAppPushAllEl = document.getElementById('moveOffAppPushAllMatches');
      const moveOffAppMinMsgEl  = document.getElementById('moveOffAppMinMessages');
      const moveOffAppMaxMsgEl  = document.getElementById('moveOffAppMaxMessages');
      const moveOffAppMaxPersEl = document.getElementById('moveOffAppMaxPersuasion');
      if (moveOffAppPushAllEl) moveOffAppPushAllEl.checked = s.moveOffAppPushAllMatches === true;
      if (moveOffAppMinMsgEl)  moveOffAppMinMsgEl.value    = s.moveOffAppMinMessages ?? 0;
      if (moveOffAppMaxMsgEl)  moveOffAppMaxMsgEl.value    = s.moveOffAppMaxMessages ?? 0;
      if (moveOffAppMaxPersEl) moveOffAppMaxPersEl.value   = s.moveOffAppMaxPersuasion ?? 2;
    });

    // Show/hide Move Off App config block based on current goal selection
    this._syncMoveOffAppConfigVisibility();

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !this._goalDropdownOpen;
      this._setGoalDropdownOpen(next);
      trigger.setAttribute('aria-expanded', String(next));
    });

    controls.querySelectorAll('.automation-v2-goal-option').forEach((option) => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();

        const selectedValue = option.dataset.value;
        const activeGoals = this._getActiveGoalValues();

        if (selectedValue === 'never') {
          this._setStopConditions([], false);
          toggle.checked = false;
        } else {
          const isSelected = activeGoals.includes(selectedValue);
          const nextGoals = isSelected
            ? activeGoals.filter((value) => value !== selectedValue)
            : [...activeGoals, selectedValue];

          this._setStopConditions(nextGoals, nextGoals.length > 0);
          if (nextGoals.length === 0) toggle.checked = false;
        }

        this._syncTelegramConfigVisibility();
        this._syncInstagramConfigVisibility();
        this._syncTangoConfigVisibility();
        this.refreshCollapsedChips();        if (typeof markAsChanged === 'function') markAsChanged();
      });
    });

    document.addEventListener('click', (e) => {
      if (!controls.contains(e.target)) {
        this._setGoalDropdownOpen(false);
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    toggle.addEventListener('change', () => {
      if (this._isSyncingGoalControls) return;

      if (toggle.checked && this._getActiveGoalValues().length === 0) {
        setTimeout(() => {
          toggle.checked = false;
          this.refreshCollapsedChips();
        }, 350);
        return;
      }

      this.refreshCollapsedChips();
      if (typeof markAsChanged === 'function') markAsChanged();
    });

    document.querySelectorAll('input[name="stopCondition"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (this._isSyncingGoalControls) return;
        this._syncGoalControlsFromLegacy();
        if (typeof markAsChanged === 'function') markAsChanged();
      });
    });

    // ── Load handle sent counters after DOM is ready ──
    this.refreshHandleSentCounters();

    // Listen for real-time updates from background when a handle is sent
    if (!this._handleSentListener) {
      this._handleSentListener = (message) => {
        if (message.action === 'handleSentStatsUpdated') {
          this._applyHandleSentStats(message.stats);
        }
      };
      chrome.runtime.onMessage.addListener(this._handleSentListener);
    }

    this._renderGoalDropdown();
  },

  // ── Handle Sent Counters ──
  refreshHandleSentCounters() {
    chrome.storage.local.get(['handleSentStats'], (data) => {
      const stats = data.handleSentStats || {};
      this._applyHandleSentStats(stats);
    });
  },

  _applyHandleSentStats(stats) {
    // platform key maps: contactInstagram→instagram, contactTelegram→telegram, contactTango→tango
    const platforms = ['instagram', 'telegram', 'tango'];
    platforms.forEach(platform => {
      const statEl  = document.getElementById(`handleStat_${platform}`);
      const countEl = document.getElementById(`handleCount_${platform}`);
      if (!statEl || !countEl) return;

      const count = stats[platform] || 0;
      countEl.textContent = count.toLocaleString();
      statEl.style.display = 'flex';
    });
  },

  _syncGoalControlsFromLegacy() {
    const toggle = document.getElementById('automationStopAfterGoal');
    if (!toggle) return;

    this._isSyncingGoalControls = true;
    toggle.checked = this._getActiveGoalValues().length > 0;
    this._renderGoalDropdown();
    this._isSyncingGoalControls = false;
  },

  _emitInputChange(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },

  _openAdaptiveDropdown(trigger, optionsEl, closeFn) {
    if (optionsEl._dropdownTimer) {
      clearTimeout(optionsEl._dropdownTimer);
      optionsEl._dropdownTimer = null;
    }
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;

    optionsEl.style.position = 'fixed';
    optionsEl.style.left = rect.left + 'px';
    optionsEl.style.width = rect.width + 'px';
    optionsEl.style.zIndex = '999999';
    optionsEl.style.display = 'block';
    optionsEl.style.overflowY = 'auto';
    optionsEl.style.top = openUpward ? 'auto' : (rect.bottom + 4) + 'px';
    optionsEl.style.bottom = openUpward ? (window.innerHeight - rect.top + 4) + 'px' : 'auto';
    optionsEl.style.maxHeight = openUpward
      ? Math.min(240, spaceAbove - 8) + 'px'
      : Math.min(240, Math.max(spaceBelow - 8, 80)) + 'px';

    optionsEl.style.opacity = '0';
    optionsEl.style.transform = 'translateY(-4px)';
    optionsEl.style.transition = 'none';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        optionsEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
        optionsEl.style.opacity = '1';
        optionsEl.style.transform = 'translateY(0)';
      });
    });

    if (typeof closeFn === 'function') {
      const scrollTarget = document.querySelector('.tab-content') || document.querySelector('.popup-body') || document.documentElement;
      const onScroll = () => closeFn();
      scrollTarget.addEventListener('scroll', onScroll, { passive: true, once: true });
      optionsEl._scrollCloseTarget = scrollTarget;
      optionsEl._scrollCloseHandler = onScroll;
    }
  },

  _closeAdaptiveDropdown(optionsEl) {
    if (!optionsEl) return;
    if (optionsEl._scrollCloseTarget && optionsEl._scrollCloseHandler) {
      optionsEl._scrollCloseTarget.removeEventListener('scroll', optionsEl._scrollCloseHandler);
      optionsEl._scrollCloseTarget = null;
      optionsEl._scrollCloseHandler = null;
    }
    if (optionsEl._dropdownTimer) clearTimeout(optionsEl._dropdownTimer);
    optionsEl.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    optionsEl.style.opacity = '0';
    optionsEl.style.transform = 'translateY(-4px)';
    optionsEl._dropdownTimer = setTimeout(() => {
      optionsEl._dropdownTimer = null;
      optionsEl.style.display = 'none';
      optionsEl.style.position = '';
      optionsEl.style.left = '';
      optionsEl.style.width = '';
      optionsEl.style.top = '';
      optionsEl.style.bottom = '';
      optionsEl.style.maxHeight = '';
      optionsEl.style.zIndex = '';
      optionsEl.style.overflowY = '';
      optionsEl.style.opacity = '';
      optionsEl.style.transform = '';
      optionsEl.style.transition = '';
    }, 160);
  },

  _initSwipingCoreControlsUI() {
    const swipingCardBody = document.querySelector('.automation-v2-card[data-automation-card="swiping"] .automation-v2-card-body');
    const likesInput = document.getElementById('likesPerCycle');
    const scheduleInput = document.getElementById('scheduleInterval');
    if (!swipingCardBody || !likesInput || !scheduleInput) return;

    const SPEED_PRESETS = [
      { minutes: 30, label: 'Every 30 min' },
      { minutes: 60, label: 'Every Hour' },
      { minutes: 120, label: 'Every 2 Hours' }
    ];

    const getSpeedLabel = (minutes) => {
      const preset = SPEED_PRESETS.find((p) => p.minutes === minutes);
      return preset ? preset.label : `Every ${minutes} min`;
    };

    if (!swipingCardBody.querySelector('.automation-v2-swiping-core')) {
      const optionsHTML = SPEED_PRESETS.map(
        (p) => `<button type="button" class="automation-v2-activity-speed-option" data-minutes="${p.minutes}">${p.label}</button>`
      ).join('');

      const core = document.createElement('div');
      core.className = 'automation-v2-swiping-core';
      core.innerHTML = `
        <div class="automation-v2-swiping-row automation-v2-swiping-row--toggle">
          <span class="automation-v2-swiping-label">Auto Swipe</span>
          <label class="automation-v2-goal-switch" aria-label="Auto Swipe">
            <input type="checkbox" id="automationAutoSwipeToggle">
            <span class="automation-v2-goal-switch-slider"></span>
          </label>
        </div>
        <div class="automation-v2-swiping-divider"></div>
        <div class="automation-v2-swiping-row automation-v2-swiping-row--dailycap">
          <span class="automation-v2-swiping-label">Activity Speed</span>
        </div>
        <div class="automation-v2-activity-speed-wrap" id="automationActivitySpeedWrap">
          <button type="button" class="automation-v2-daily-cap-trigger" id="automationActivitySpeedTrigger" aria-haspopup="listbox" aria-expanded="false">
            <span id="automationActivitySpeedValue">Every 30 min</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div class="automation-v2-activity-speed-options" id="automationActivitySpeedOptions" role="listbox">
            ${optionsHTML}
          </div>
        </div>
      `;
      swipingCardBody.prepend(core);
    }

    const toggle = document.getElementById('automationAutoSwipeToggle');
    const speedValueEl = document.getElementById('automationActivitySpeedValue');
    const speedTrigger = document.getElementById('automationActivitySpeedTrigger');
    const speedOptions = document.getElementById('automationActivitySpeedOptions');
    if (!toggle || !speedValueEl || !speedTrigger || !speedOptions) return;

    const normalizeSchedule = () => {
      const val = parseInt(scheduleInput.value, 10);
      return Number.isFinite(val) && val > 0 ? val : 60;
    };

    const normalizeLikes = () => {
      const likes = parseInt(likesInput.value, 10);
      return Number.isFinite(likes) ? likes : 50;
    };

    const syncSpeedFromSchedule = () => {
      const minutes = normalizeSchedule();
      speedValueEl.textContent = getSpeedLabel(minutes);
      speedOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
        opt.classList.toggle('is-selected', parseInt(opt.dataset.minutes, 10) === minutes);
      });
    };

    const syncToggleFromLikes = () => {
      toggle.checked = normalizeLikes() > 0;
    };

    let _speedDropdownOpen = false;
    const setSpeedDropdownOpen = (open) => {
      _speedDropdownOpen = open;
      const wrap = document.getElementById('automationActivitySpeedWrap');
      if (wrap) wrap.classList.toggle('is-open', open);
      speedTrigger.setAttribute('aria-expanded', String(open));

      const swipingCard = document.querySelector('.automation-v2-card[data-automation-card="swiping"]');
      const body = swipingCard ? swipingCard.querySelector('.automation-v2-card-body') : null;
      if (body && body.style.maxHeight && body.style.maxHeight !== 'none') {
        setTimeout(() => { body.style.maxHeight = body.scrollHeight + 'px'; }, 260);
      }
    };

    syncSpeedFromSchedule();
    syncToggleFromLikes();

    speedTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      setSpeedDropdownOpen(!_speedDropdownOpen);
    });

    speedOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        scheduleInput.value = opt.dataset.minutes;
        this._emitInputChange(scheduleInput);
        syncSpeedFromSchedule();
        setSpeedDropdownOpen(false);
        this.refreshCollapsedChips();
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#automationActivitySpeedWrap') && !e.target.closest('#automationActivitySpeedOptions')) {
        setSpeedDropdownOpen(false);
      }
    });

    toggle.addEventListener('change', () => {
      const likes = normalizeLikes();
      if (!toggle.checked) {
        likesInput.dataset.lastNonZero = String(Math.max(likes, 50));
        likesInput.value = '0';
      } else {
        const fallback = parseInt(likesInput.dataset.lastNonZero || '50', 10);
        likesInput.value = String(Number.isFinite(fallback) && fallback > 0 ? fallback : 50);
      }
      this._emitInputChange(likesInput);
      syncToggleFromLikes();
      this.refreshCollapsedChips();
    });

    scheduleInput.addEventListener('input', syncSpeedFromSchedule);
    scheduleInput.addEventListener('change', syncSpeedFromSchedule);
    likesInput.addEventListener('input', syncToggleFromLikes);
    likesInput.addEventListener('change', syncToggleFromLikes);

    // Safety Mode Master Override
    const safetyModeToggle = document.getElementById('safetyMode');
    let _safetyInitComplete = false;

    const applySafetyVisuals = (isSafetyOn) => {
      toggle.disabled = isSafetyOn;
      const slider = toggle.nextElementSibling;
      if (slider) {
        slider.style.opacity = isSafetyOn ? '0.5' : '1';
        slider.style.cursor = isSafetyOn ? 'not-allowed' : 'pointer';
      }
      if (isSafetyOn) {
        speedTrigger.style.pointerEvents = 'none';
        speedTrigger.style.opacity = '0.5';
        toggle.checked = true;
        // Silently set values — no events, no save bar
        likesInput.value = '50';
        scheduleInput.value = '30';
        syncSpeedFromSchedule();
      } else {
        speedTrigger.style.pointerEvents = 'auto';
        speedTrigger.style.opacity = '1';
        syncToggleFromLikes();
      }
    };

    if (safetyModeToggle) {
      // User-initiated toggle: emit changes so they can be saved
      safetyModeToggle.addEventListener('change', () => {
        const isSafetyOn = safetyModeToggle.checked;
        applySafetyVisuals(isSafetyOn);
        if (_safetyInitComplete) {
          this._emitInputChange(likesInput);
          this._emitInputChange(scheduleInput);
        }
      });
      // Boot sync: silent visual-only, no events
      setTimeout(() => {
        applySafetyVisuals(safetyModeToggle.checked);
        _safetyInitComplete = true;
      }, 300);
    }
  },

  _initSwipingAgeRangeUI() {
    const ageSection = document.getElementById('ageFilterSectionContent')?.closest('.section');
    const ageSettings = document.getElementById('ageFilterSettings');
    const minAgeInput = document.getElementById('minAge');
    const maxAgeInput = document.getElementById('maxAge');

    if (!ageSection || !ageSettings || !minAgeInput || !maxAgeInput) return;

    if (!ageSettings.querySelector('.automation-v2-age-row')) {
      const ageRow = document.createElement('div');
      ageRow.className = 'automation-v2-age-row';
      ageRow.innerHTML = `
        <span class="automation-v2-age-label">Age Range</span>
        <span class="automation-v2-age-current" id="automationAgeRangeValue">18–99</span>
      `;
      ageSettings.insertBefore(ageRow, ageSettings.firstChild);
    }

    ageSettings.querySelector('.age-range-display')?.classList.add('automation-v2-age-legacy-display');

    const updateAgeValue = () => {
      const minAge = parseInt(minAgeInput.value, 10);
      const maxAge = parseInt(maxAgeInput.value, 10);
      const safeMin = Number.isFinite(minAge) ? minAge : 18;
      const safeMax = Number.isFinite(maxAge) ? maxAge : 99;
      const valueEl = document.getElementById('automationAgeRangeValue');
      if (valueEl) valueEl.textContent = `${safeMin}–${safeMax}`;
    };

    updateAgeValue();
    minAgeInput.addEventListener('input', updateAgeValue);
    minAgeInput.addEventListener('change', updateAgeValue);
    maxAgeInput.addEventListener('input', updateAgeValue);
    maxAgeInput.addEventListener('change', updateAgeValue);
  },

  _initSwipingDistanceUI() {
    // Delegated to DistanceFilterV2 module (distance-filter-v2.js)
    if (window.DistanceFilterV2) DistanceFilterV2.init();
  },

  _initSwipingVisualPreferenceUI() {
    const cardBody = document.querySelector('.automation-v2-card[data-automation-card="swiping"] .automation-v2-card-body');
    const visualSettings = document.getElementById('visualPreferencesSettings');
    const startBtn = document.getElementById('startTrainingBtn');
    const resetBtn = document.getElementById('resetTrainingBtn');

    if (!cardBody || !visualSettings || !startBtn) return;

    startBtn.className = 'automation-v2-train-btn';
    startBtn.innerHTML = 'Start Training';
    if (resetBtn) resetBtn.style.display = 'none';

    // Restore button state if training overlay is still active on the page
    chrome.tabs.query({ url: ['https://tinder.com/*', 'https://bumble.com/*', 'https://*.bumble.com/*'] }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const tab = tabs.find(t => t.active) || tabs[0];
      chrome.tabs.sendMessage(tab.id, { action: 'isTrainingActive' }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res && res.active) {
          if (typeof setTrainingButtonState === 'function') {
            setTrainingButtonState(true);
          } else {
            startBtn.textContent = 'Stop Training';
            startBtn.dataset.trainingActive = '1';
          }
        }
      });
    });

    const visualTitle = document.querySelector('#visualPreferencesSectionHeader h2');
    if (visualTitle) {
      const INFO_SVG_VP = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:14px;height:14px;opacity:0.5;"><path d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
      const vpLines = JSON.stringify([
        '① Enable the toggle',
        '② Tap <b>Start Training</b> below',
        '③ Like 20+ profiles you find attractive',
        '<span style="color:#6b7280;font-size:11px;">20 likes = good · 50 likes = 95% accuracy</span>'
      ]);
      visualTitle.innerHTML = `Visual Preference <span class="tooltip-trigger" data-tooltip="placeholder" data-tooltip-title="How it works" data-tooltip-lines='${vpLines}' style="display:inline-flex;align-items:center;cursor:default;">${INFO_SVG_VP}</span>`;
    }

    if (!cardBody.querySelector('.automation-v2-vp-footer')) {
      const footer = document.createElement('div');
      footer.className = 'automation-v2-vp-footer';

      const summary = document.createElement('div');
      summary.className = 'automation-v2-visual-summary';
      summary.innerHTML = `
        <span class="automation-v2-visual-summary-label">Training Required <span id="automationVPStatusBadge" class="automation-v2-vp-status-badge off">OFF</span></span>
        <span class="automation-v2-visual-summary-value" id="automationVisualTrainingCount">0 / 50 Likes Collected</span>
      `;
      footer.appendChild(summary);

      const actionsGrid = visualSettings.querySelector('.vision-actions-grid');
      if (actionsGrid) footer.appendChild(actionsGrid);

      cardBody.appendChild(footer);
    }

    const syncVPStatus = () => {
      const vpToggle = document.getElementById('visualPreferencesEnabled');
      const badge = document.getElementById('automationVPStatusBadge');
      if (badge && vpToggle) {
        const isOn = vpToggle.checked;
        badge.textContent = isOn ? 'ON' : 'OFF';
        badge.classList.toggle('on', isOn);
        badge.classList.toggle('off', !isOn);
      }
    };

    const syncCountEl = (count) => {
      const countEl = document.getElementById('automationVisualTrainingCount');
      if (countEl) countEl.textContent = `${count} / 50 Likes Collected`;
      const resetBtn = document.getElementById('resetTrainingBtn');
      if (resetBtn) resetBtn.style.display = 'none';
      syncVPStatus();
    };

    chrome.storage.local.get('userSettings', (data) => {
      const count = data?.userSettings?.visualPreferences?.likedPhotos?.length || 0;
      syncCountEl(count);
    });

    if (!AutomationViews._visualCountSyncBound) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.userSettings) {
          const newSettings = changes.userSettings.newValue;
          if (newSettings && newSettings.visualPreferences) {
            const count = newSettings.visualPreferences.likedPhotos?.length || 0;
            syncCountEl(count);
          }
        }
      });
      AutomationViews._visualCountSyncBound = true;
    }
    
    const visualToggle = document.getElementById('visualPreferencesEnabled');

    // Wire toggle to collapse/expand the vp-footer (same animation pattern as distance section)
    const getVpFooter = () => cardBody.querySelector('.automation-v2-vp-footer');

    const updateVPState = (isEnabled) => {
      const footer = getVpFooter();
      if (!footer) return;
      if (isEnabled) {
        footer.style.overflow = 'hidden';
        footer.style.opacity = '0';
        footer.style.transition = 'none';
        footer.style.paddingTop = '12px';
        footer.style.paddingBottom = '16px';
        footer.style.height = 'auto';
        const targetHeight = footer.scrollHeight + 'px';
        footer.style.height = '0px';
        footer.style.paddingTop = '0px';
        footer.style.paddingBottom = '0px';
        void footer.offsetHeight;
        footer.style.transition = 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, padding 0.35s ease';
        footer.style.height = targetHeight;
        footer.style.paddingTop = '12px';
        footer.style.paddingBottom = '16px';
        footer.style.opacity = '1';
        setTimeout(() => {
          footer.style.transition = '';
          footer.style.overflow = 'visible';
        }, 360);
      } else {
        footer.style.overflow = 'hidden';
        footer.style.height = footer.scrollHeight + 'px';
        void footer.offsetHeight;
        footer.style.transition = 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, padding 0.35s ease';
        footer.style.height = '0px';
        footer.style.paddingTop = '0px';
        footer.style.paddingBottom = '0px';
        footer.style.opacity = '0';
        setTimeout(() => { footer.style.transition = ''; }, 360);
      }
    };

    const syncButtonState = () => {
      if (!visualToggle || !startBtn) return;
      startBtn.disabled = !visualToggle.checked;
      startBtn.style.opacity = visualToggle.checked ? '1' : '0.5';
      startBtn.style.cursor = visualToggle.checked ? 'pointer' : 'not-allowed';
      syncVPStatus();
    };

    if (visualToggle && !visualToggle.dataset.vpCollapseWired) {
      visualToggle.dataset.vpCollapseWired = '1';
      visualToggle.addEventListener('change', () => {
        updateVPState(visualToggle.checked);
        syncButtonState();
      });
      // Defer initial state so vp-footer is already in the DOM
      setTimeout(() => {
        const footer = getVpFooter();
        if (footer && !visualToggle.checked) {
          footer.style.height = '0px';
          footer.style.paddingTop = '0px';
          footer.style.paddingBottom = '0px';
          footer.style.opacity = '0';
          footer.style.overflow = 'hidden';
        }
        syncButtonState();
      }, 0);
    }
  },

  _titleCase(text) {
    return String(text || '')
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  _getCustomSelectText(selectId, fallback) {
    const el = document.querySelector(`#${selectId} .custom-select-value`);
    const text = el?.textContent?.trim();
    return text || fallback;
  },

  _setChips(cardKey, chips) {
    const row = document.querySelector(`.automation-v2-card[data-automation-card="${cardKey}"] .automation-v2-collapsed-row`);
    if (!row) return;

    row.innerHTML = chips
      .filter(Boolean)
      .map((chip) => `<span class="automation-v2-chip">${chip}</span>`)
      .join('');
  },

  refreshCollapsedChips() {
    const activeGoals = this._getActiveGoalValues();
    const stopEnabled = activeGoals.length > 0;
    const goalSummary = !activeGoals.length
      ? this.goalOptions.never
      : activeGoals.length === 1
        ? (this.goalOptions[activeGoals[0]] || this.goalOptions.phone)
        : `${activeGoals.length} Goals`;

    this._setChips('goal', [
      goalSummary,
      stopEnabled ? 'Stop After Goal' : 'Stop Off'
    ]);

    const likesPerCycle = parseInt(document.getElementById('likesPerCycle')?.value, 10);
    const scheduleMinutes = parseInt(document.getElementById('scheduleInterval')?.value, 10);
    const minAge = parseInt(document.getElementById('minAge')?.value, 10);
    const maxAge = parseInt(document.getElementById('maxAge')?.value, 10);
    const visualEnabled = !!document.getElementById('visualPreferencesEnabled')?.checked;
    const likesSafe = Number.isFinite(likesPerCycle) ? likesPerCycle : 50;
    const speedMinutes = Number.isFinite(scheduleMinutes) && scheduleMinutes > 0 ? scheduleMinutes : 60;
    const speedChipLabels = { 30: 'Every 30 min', 60: 'Every Hour', 120: 'Every 2 Hrs' };
    const speedChip = speedChipLabels[speedMinutes] || `Every ${speedMinutes} min`;
    const minAgeSafe = Number.isFinite(minAge) ? minAge : 18;
    const maxAgeSafe = Number.isFinite(maxAge) ? maxAge : 99;
    const distanceEnabled = !!document.getElementById('distanceFilterEnabled')?.checked;
    const maxDistance = parseInt(document.getElementById('maxDistance')?.value, 10);
    const distanceSafe = Number.isFinite(maxDistance) ? maxDistance : 50;
    const distanceChip = distanceEnabled ? `< ${distanceSafe} km` : 'Distance Off';

    this._setChips('swiping', [
      likesSafe > 0 ? 'Swiping On' : 'Swiping Off',
      speedChip,
      `${minAgeSafe}-${maxAgeSafe}`,
      distanceChip,
      visualEnabled ? 'Visual Preference ON' : 'Visual Preference OFF'
    ]);

    const minReply = parseInt(document.getElementById('minReplySlots')?.value, 10);
    const maxNew = parseInt(document.getElementById('maxNewMatchSlots')?.value, 10);
    const ratioLeft = Number.isFinite(minReply) ? minReply : 50;
    const ratioRight = Number.isFinite(maxNew) ? maxNew : 50;
    const tone = this._titleCase(this._getCustomSelectText('chattingStyleSelect', 'Freestyle'));
    const language = this._getCustomSelectText('conversationLanguageSelect', 'English').replace(/^\S+\s+/, '');
    const useEmojis = !!document.getElementById('useEmojis')?.checked;
    const emojiProb = parseInt(document.getElementById('emojiProbability')?.value, 10);
    const emojiChip = useEmojis
      ? `Emojis ${Number.isFinite(emojiProb) ? emojiProb : 30}%`
      : 'No Emojis';
    const intentionsText = this._getCustomSelectText('intentionsSelect', 'Short term');
    const intentionsChip = intentionsText.replace(/\s*\(.*?\)/, '').split(' ').slice(0, 3).join(' ');
    const consecutiveEnabled = !!document.getElementById('consecutiveMessagesEnabled')?.checked;

    this._setChips('messaging', [
      intentionsChip,
      `${ratioLeft} : ${ratioRight}`,
      tone,
      language,
      emojiChip,
      ...(consecutiveEnabled ? ['Multi-text'] : [])
    ]);

    // Style training chip — delegate to ChatStyleTraining so label stays consistent
    chrome.storage.local.get(['userSettings', '_cstSessionState'], (data) => {
      const profiles = data?.userSettings?.chatStyleProfiles || {};
      // Legacy fallback
      const legacy = data?.userSettings?.chatStyleProfile;
      if (legacy?.trained) {
        const legacyLang = legacy.trainingLanguage || 'en';
        if (!profiles[legacyLang]) profiles[legacyLang] = legacy;
      }
      const trainedLangs = Object.keys(profiles).filter(k => profiles[k]?.trained);
      const sessionState = data?._cstSessionState;
      const row = document.querySelector('.automation-v2-card[data-automation-card="style"] .automation-v2-collapsed-row');
      if (!row) return;

      const LANGUAGES = (typeof ChatStyleTraining !== 'undefined' && ChatStyleTraining.LANGUAGES) || [];
      const TARGET = (typeof ChatStyleTraining !== 'undefined' && ChatStyleTraining.TARGET_MESSAGES) || 12;
      const chips = [];

      // ✓ trained chips (full) or count chips (partial)
      for (const code of trainedLangs) {
        const p = profiles[code];
        const label = LANGUAGES.find(l => l.code === code)?.label || code;
        if (p.partial) {
          chips.push(`<span class="automation-v2-chip">${label} ${p.messageCount || '?'} / ${TARGET}</span>`);
        } else {
          chips.push(`<span class="automation-v2-chip">✓ ${label}</span>`);
        }
      }

      // in-progress chip (only if lang not already trained)
      if (sessionState?.messages?.length) {
        const lang = sessionState.persona?.language || sessionState.language || 'en';
        if (!trainedLangs.includes(lang)) {
          const label = LANGUAGES.find(l => l.code === lang)?.label || lang;
          const userCount = sessionState.messages.filter(m => m.role === 'user' && !m.garbage).length;
          chips.push(`<span class="automation-v2-chip">${label} ${userCount} / ${TARGET}</span>`);
        }
      }

      row.innerHTML = chips.join('');
    });

    // Contact details chip in goal card collapsed row
    const goalCollapsedRow = document.querySelector('.automation-v2-card[data-automation-card="goal"] .automation-v2-collapsed-row');
    if (goalCollapsedRow) {
      // Remove existing contact chip if any
      goalCollapsedRow.querySelectorAll('.automation-v2-chip--contact').forEach(c => c.remove());
      const contactFieldIds = [/*'contactWhatsapp', 'contactPhone',*/ 'contactInstagram', 'contactTelegram', 'contactTango', /*'contactSnapchat'*/];
      const enabledCount = contactFieldIds.filter(id => {
        const el = document.getElementById(`${id}Enabled`);
        const valEl = document.getElementById(`${id}Value`);
        return el?.checked && valEl?.value?.trim();
      }).length;
      if (enabledCount > 0) {
        const chip = document.createElement('span');
        chip.className = 'automation-v2-chip automation-v2-chip--contact';
        chip.textContent = `${enabledCount} contact${enabledCount > 1 ? 's' : ''} shared`;
        goalCollapsedRow.appendChild(chip);
      }
    }
  },

  _bindSummarySync() {
    if (this._boundSummaryListeners) return;

    const selectors = [
      '#automationPrimaryGoal',
      '#automationStopAfterGoal',
      'input[name="stopCondition"]',
      '#likesPerCycle',
      '#scheduleInterval',
      '#minAge',
      '#maxAge',
      '#visualPreferencesEnabled',
      '#distanceFilterEnabled',
      '#automationDistanceFilterToggle',
      '#maxDistance',
      '#minReplySlots',
      '#maxNewMatchSlots',
      '#useEmojis',
      '#emojiProbability',
      '#intentionsSelect',
      // Contact detail toggles — chip must update when any contact is toggled or typed
      '#contactInstagramEnabled',
      '#contactWhatsappEnabled',
      '#contactPhoneEnabled',
      '#contactTelegramEnabled',
      '#contactSnapchatEnabled',
      '#contactInstagramValue',
      '#contactWhatsappValue',
      '#contactPhoneValue',
      '#contactTelegramValue',
      '#contactSnapchatValue',
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener('change', () => this.refreshCollapsedChips());
        el.addEventListener('input', () => this.refreshCollapsedChips());
      });
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('.custom-select-option')) {
        setTimeout(() => this.refreshCollapsedChips(), 0);
      }
    });

    this._boundSummaryListeners = true;
  },

  _bindAccordions(shell) {
    shell.querySelectorAll('[data-automation-card]').forEach((card) => {
      const header = card.querySelector('.automation-v2-card-header');
      if (!header) return;

      header.addEventListener('click', () => {
        clearTimeout(card._openTimer);
        clearTimeout(card._finalizeTimer);
        clearTimeout(card._chipsShowTimer);
        clearTimeout(card._chipsResetTimer);
        card._openTimer = card._finalizeTimer = card._chipsShowTimer = card._chipsResetTimer = null;

        const body = card.querySelector('.automation-v2-card-body');
        if (body && body._transitionHandler) {
          body.removeEventListener('transitionend', body._transitionHandler);
          body._transitionHandler = null;
          body.style.transition = '';
          body.style.height     = '';
          body.style.maxHeight  = '';
          body.style.opacity    = '';
          body.style.overflow   = '';
        }

        const isOpen  = card.classList.contains('is-open');
        const chips   = card.querySelector('.automation-v2-collapsed-row');

        const snapHeight = (el) => {
          el.style.transition = 'none';
          el.style.maxHeight   = el.scrollHeight + 'px';
          void el.offsetHeight;
          el.style.transition  = '';
        };

        const snapZero = (el) => {
          el.style.transition    = 'none';
          el.style.maxHeight     = '0px';
          el.style.opacity       = '0';
          el.style.paddingBottom = '0';
          void el.offsetHeight;
          el.style.transition    = '';
        };

        if (isOpen) {
          card.classList.remove('is-open');
          header.setAttribute('aria-expanded', 'false');

          if (body) {
            if (body._transitionHandler) {
              body.removeEventListener('transitionend', body._transitionHandler);
              body._transitionHandler = null;
            }
            const startH = body.getBoundingClientRect().height;
            body.style.overflow   = 'hidden';
            body.style.transition = 'none';
            body.style.height     = startH + 'px';
            body.style.maxHeight  = 'none';
            void body.offsetHeight;
            body.style.transition = 'height 0.3s ease, opacity 0.3s ease';
            requestAnimationFrame(() => {
              body.style.height  = '0px';
              body.style.opacity = '0';
            });
            body._transitionHandler = function handler(e) {
              if (e.propertyName !== 'height') return;
              body.removeEventListener('transitionend', handler);
              body._transitionHandler = null;
              body.style.transition = '';
              body.style.height     = '';
              body.style.maxHeight  = '';
              body.style.opacity    = '';
              body.style.overflow   = '';
            };
            body.addEventListener('transitionend', body._transitionHandler);
          }

          if (chips) {
            snapZero(chips);
            card._chipsShowTimer = setTimeout(() => {
              chips.style.maxHeight     = chips.scrollHeight + 16 + 'px';
              chips.style.opacity       = '1';
              chips.style.paddingBottom = '16px';
            }, 240);
            card._chipsResetTimer = setTimeout(() => {
              chips.style.maxHeight = '';
            }, 520);
          }
        } else {
          if (chips) {
            snapHeight(chips);
            requestAnimationFrame(() => {
              chips.style.maxHeight    = '0px';
              chips.style.opacity      = '0';
              chips.style.paddingBottom = '0';
            });
          }

          card._openTimer = setTimeout(() => {
            card.classList.add('is-open');
            header.setAttribute('aria-expanded', 'true');
            if (body) {
              body.style.overflow = 'hidden';
              snapZero(body);
              requestAnimationFrame(() => {
                body.style.maxHeight = body.scrollHeight + 'px';
                body.style.opacity   = '1';
              });
              card._finalizeTimer = setTimeout(() => {
                if (card.classList.contains('is-open')) {
                  body.style.maxHeight = 'none';
                  body.style.overflow  = 'visible';
                }
              }, 340);
            }
          }, 180);
        }

        this.refreshCollapsedChips();
      });
    });
  },

  _initMessagingTogglesUI() {
    const cardBody = document.querySelector('.automation-v2-card[data-automation-card="messaging"] .automation-v2-card-body');
    const legacySmartReactionsToggle = document.getElementById('randomHearts');
    const legacyUseEmojisToggle = document.getElementById('useEmojis');

    if (!cardBody || !legacySmartReactionsToggle || !legacyUseEmojisToggle) return;

    const CHEVRON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    const INFO_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:14px;height:14px;opacity:0.5;"><path d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

    const LANG_FLAGS = {
      ar: '🇸🇦', bn: '🇧🇩', zh: '🇨🇳', cs: '🇨🇿', da: '🇩🇰', nl: '🇳🇱',
      en: '🇺🇸', fi: '🇫🇮', fr: '🇫🇷', de: '🇩🇪', el: '🇬🇷', he: '🇮🇱',
      hi: '🇮🇳', hu: '🇭🇺', id: '🇮🇩', it: '🇮🇹', ja: '🇯🇵', ko: '🇰🇷',
      no: '🇳🇴', fa: '🇮🇷', pl: '🇵🇱', pt: '🇧🇷', ro: '🇷🇴', ru: '🇷🇺',
      es: '🇪🇸', sw: '🇰🇪', sv: '🇸🇪', th: '🇹🇭', tr: '🇹🇷', uk: '🇺🇦',
      ur: '🇵🇰', vi: '🇻🇳'
    };

    if (!cardBody.querySelector('.automation-v2-messaging-toggles')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <div class="automation-v2-messaging-toggles">
          <div class="automation-v2-swiping-row automation-v2-swiping-row--toggle">
            <span class="automation-v2-swiping-label" style="display:flex;align-items:center;gap:8px;">
              Smart Reactions
              <span class="tooltip-trigger" data-tooltip="placeholder" data-tooltip-title="How it works" data-tooltip-lines='["① AI randomly likes (❤️) messages from matches","② Pushes your chat to the top of their inbox","③ Increases the chance they reply to you"]' style="display:flex;align-items:center;">${INFO_SVG}</span>
            </span>
            <label class="automation-v2-goal-switch" aria-label="Smart Reactions">
              <input type="checkbox" id="automationSmartReactionsToggle">
              <span class="automation-v2-goal-switch-slider"></span>
            </label>
          </div>
          <div class="automation-v2-swiping-divider"></div>
          <div class="automation-v2-swiping-row automation-v2-swiping-row--toggle">
            <span class="automation-v2-swiping-label">Use Emoji's</span>
            <label class="automation-v2-goal-switch" aria-label="Use Emoji's">
              <input type="checkbox" id="automationUseEmojisToggle">
              <span class="automation-v2-goal-switch-slider"></span>
            </label>
          </div>
          <div class="automation-v2-swiping-divider"></div>
          <div class="automation-v2-swiping-row automation-v2-swiping-row--toggle" id="consecutiveMessagesToggleRow">
            <span class="automation-v2-swiping-label" style="display:flex;align-items:center;gap:8px;">
              Consecutive Messages
              <span class="tooltip-trigger" data-tooltip="placeholder" data-tooltip-title="How it works" data-tooltip-lines='["① Match sends multiple messages in a row","② AI mirrors their energy with 2–3 replies back","③ Each part uses 1 message credit"]' style="display:flex;align-items:center;">${INFO_SVG}</span>
            </span>
            <label class="automation-v2-goal-switch" aria-label="Consecutive Messages">
              <input type="checkbox" id="consecutiveMessagesEnabled">
              <span class="automation-v2-goal-switch-slider"></span>
            </label>
          </div>
        </div>
      `;
      cardBody.insertBefore(tempDiv.firstElementChild, cardBody.firstChild);
    }

    const newSmartToggle = document.getElementById('automationSmartReactionsToggle');
    const newEmojiToggle = document.getElementById('automationUseEmojisToggle');

    if (newSmartToggle && !newSmartToggle.dataset.bound) {
      newSmartToggle.dataset.bound = '1';
      newSmartToggle.checked = legacySmartReactionsToggle.checked;
      newSmartToggle.addEventListener('change', () => {
        if (legacySmartReactionsToggle.checked !== newSmartToggle.checked) {
          legacySmartReactionsToggle.checked = newSmartToggle.checked;
          this._emitInputChange(legacySmartReactionsToggle);
          this.refreshCollapsedChips();
        }
      });
      legacySmartReactionsToggle.addEventListener('change', () => { newSmartToggle.checked = legacySmartReactionsToggle.checked; });
    }

    if (newEmojiToggle && !newEmojiToggle.dataset.bound) {
      newEmojiToggle.dataset.bound = '1';
      newEmojiToggle.checked = legacyUseEmojisToggle.checked;
      newEmojiToggle.addEventListener('change', () => {
        if (legacyUseEmojisToggle.checked !== newEmojiToggle.checked) {
          legacyUseEmojisToggle.checked = newEmojiToggle.checked;
          this._emitInputChange(legacyUseEmojisToggle);
          this.refreshCollapsedChips();
        }
      });
      legacyUseEmojisToggle.addEventListener('change', () => { newEmojiToggle.checked = legacyUseEmojisToggle.checked; });
    }

    // Wire Consecutive Messages toggle (lives in the same template block)
    const consecutiveToggle = document.getElementById('consecutiveMessagesEnabled');
    if (consecutiveToggle && !consecutiveToggle.dataset.bound) {
      consecutiveToggle.dataset.bound = '1';
      // Sync initial state from settings
      chrome.storage.local.get('userSettings', (data) => {
        const s = data.userSettings || {};
        consecutiveToggle.checked = s.consecutiveMessagesEnabled === true;
      });
      consecutiveToggle.addEventListener('change', () => {
        if (consecutiveToggle.checked && typeof showConsecutiveMessagesGuide === 'function') {
          showConsecutiveMessagesGuide();
        }
        if (typeof markAsChanged === 'function') markAsChanged();
        this.refreshCollapsedChips();
      });
    }

    if (!cardBody.querySelector('.automation-v2-messaging-extras')) {
      const extrasDiv = document.createElement('div');
      extrasDiv.className = 'automation-v2-messaging-extras';
      extrasDiv.innerHTML = `
        <div class="automation-v2-swiping-divider"></div>
        <div class="automation-v2-swiping-row automation-v2-swiping-row--dailycap">
          <span class="automation-v2-swiping-label">Your Intentions</span>
        </div>
        <div class="automation-v2-activity-speed-wrap" id="automationIntentionsWrap">
          <button type="button" class="automation-v2-daily-cap-trigger" id="automationIntentionsTrigger" aria-haspopup="listbox" aria-expanded="false">
            <span id="automationIntentionsValue">Short term dating</span>
            ${CHEVRON_SVG}
          </button>
          <div class="automation-v2-activity-speed-options" id="automationIntentionsOptions" role="listbox"></div>
        </div>
        <div class="automation-v2-swiping-divider"></div>
        <div class="automation-v2-swiping-row automation-v2-swiping-row--dailycap">
          <span class="automation-v2-swiping-label">Conversation Tone</span>
        </div>
        <div class="automation-v2-activity-speed-wrap" id="automationToneWrap">
          <button type="button" class="automation-v2-daily-cap-trigger" id="automationToneTrigger" aria-haspopup="listbox" aria-expanded="false">
            <span id="automationToneValue">Freestyle</span>
            ${CHEVRON_SVG}
          </button>
          <div class="automation-v2-activity-speed-options" id="automationToneOptions" role="listbox"></div>
        </div>
        <div class="automation-v2-swiping-divider"></div>
        <div class="automation-v2-swiping-row automation-v2-swiping-row--dailycap">
          <span class="automation-v2-swiping-label">Default Language <span class="automation-v2-msg-sublabel">(Editable per match)</span></span>
        </div>
        <div class="automation-v2-activity-speed-wrap" id="automationLangWrap">
          <button type="button" class="automation-v2-daily-cap-trigger" id="automationLangTrigger" aria-haspopup="listbox" aria-expanded="false">
            <span id="automationLangValue">🇺🇸 English</span>
            ${CHEVRON_SVG}
          </button>
          <div class="automation-v2-activity-speed-options automation-v2-msg-lang-options" id="automationLangOptions" role="listbox"></div>
        </div>
        <div class="automation-v2-swiping-divider"></div>
        <div class="automation-v2-swiping-row automation-v2-swiping-row--dailycap">
          <span class="automation-v2-swiping-label" style="display:flex;align-items:center;gap:8px;">
            Messaging Priority
            <span class="tooltip-trigger" data-tooltip="placeholder" data-tooltip-title="How it works" data-tooltip-lines='["Splits AI time between replies &amp; new outreach","⬅ 70:30 → mostly replies to current chats","⬛ 50:50 → balanced (recommended)","➡ 30:70 → aggressively messages new matches"]' style="display:flex;align-items:center;">${INFO_SVG}</span>
          </span>
        </div>
        <div class="automation-v2-msg-priority-seg" id="automationPrioritySeg">
          <button type="button" class="automation-v2-msg-priority-btn" data-value="30">70 : 30</button>
          <button type="button" class="automation-v2-msg-priority-btn" data-value="50">50 : 50</button>
          <button type="button" class="automation-v2-msg-priority-btn" data-value="70">30 : 70</button>
        </div>
      `;
      cardBody.appendChild(extrasDiv);

      const intentionsOptionsEl = document.getElementById('automationIntentionsOptions');
      document.querySelectorAll('#intentionsSelect .custom-select-option').forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'automation-v2-activity-speed-option';
        btn.dataset.value = opt.dataset.value;
        btn.textContent = opt.textContent.trim();
        intentionsOptionsEl.appendChild(btn);
      });

      const toneOptionsEl = document.getElementById('automationToneOptions');
      document.querySelectorAll('#chattingStyleSelect .custom-select-option').forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'automation-v2-activity-speed-option';
        btn.dataset.value = opt.dataset.value;
        btn.textContent = opt.textContent.trim();
        toneOptionsEl.appendChild(btn);
      });

      const langOptionsEl = document.getElementById('automationLangOptions');
      document.querySelectorAll('#conversationLanguageSelect .custom-select-option').forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'automation-v2-activity-speed-option';
        btn.dataset.value = opt.dataset.value;
        const flag = LANG_FLAGS[opt.dataset.value] || '';
        btn.textContent = (flag ? flag + ' ' : '') + opt.textContent.trim();
        langOptionsEl.appendChild(btn);
      });
    }

    const getLegacySelectValue = (id) => {
      const selected = document.querySelector(`#${id} .custom-select-option.selected`);
      return selected ? selected.dataset.value : null;
    };

    const setLegacySelectValue = (id, value) => {
      document.querySelectorAll(`#${id} .custom-select-option`).forEach((opt) => {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
      const trigger = document.querySelector(`#${id} .custom-select-value`);
      const selected = document.querySelector(`#${id} .custom-select-option.selected`);
      if (trigger && selected) trigger.textContent = selected.textContent.trim();
      const container = document.getElementById(id);
      if (container) {
        container.setAttribute('data-value', value);
        container.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const intentionsTrigger = document.getElementById('automationIntentionsTrigger');
    const intentionsOptions = document.getElementById('automationIntentionsOptions');
    const intentionsValueEl = document.getElementById('automationIntentionsValue');
    const _msgCard = document.querySelector('.automation-v2-card[data-automation-card="messaging"]');
    const _msgBody = _msgCard ? _msgCard.querySelector('.automation-v2-card-body') : null;
    const _updateMsgBody = () => {
      if (_msgBody && _msgBody.style.maxHeight && _msgBody.style.maxHeight !== 'none') {
        setTimeout(() => { _msgBody.style.maxHeight = _msgBody.scrollHeight + 'px'; }, 260);
      }
    };

    if (intentionsTrigger && intentionsOptions && intentionsValueEl && !intentionsTrigger.dataset.bound) {
      intentionsTrigger.dataset.bound = '1';
      const syncIntentions = () => {
        const value = getLegacySelectValue('intentionsSelect');
        const btn = intentionsOptions.querySelector(`[data-value="${value}"]`);
        intentionsValueEl.textContent = btn ? btn.textContent : 'Short term dating';
        intentionsOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
          opt.classList.toggle('is-selected', opt.dataset.value === value);
        });
      };

      let _intentionsOpen = false;
      const setIntentionsOpen = (open) => {
        _intentionsOpen = open;
        const wrap = document.getElementById('automationIntentionsWrap');
        if (wrap) wrap.classList.toggle('is-open', open);
        intentionsTrigger.setAttribute('aria-expanded', String(open));
        _updateMsgBody();
      };
      syncIntentions();
      intentionsTrigger.addEventListener('click', (e) => { e.stopPropagation(); setIntentionsOpen(!_intentionsOpen); });
      intentionsOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          setLegacySelectValue('intentionsSelect', opt.dataset.value);
          syncIntentions();
          setIntentionsOpen(false);
          this.refreshCollapsedChips();
        });
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#automationIntentionsWrap') && !e.target.closest('#automationIntentionsOptions')) setIntentionsOpen(false);
      });
    }

    const toneTrigger = document.getElementById('automationToneTrigger');
    const toneOptions = document.getElementById('automationToneOptions');
    const toneValueEl = document.getElementById('automationToneValue');
    if (toneTrigger && toneOptions && toneValueEl && !toneTrigger.dataset.bound) {
      toneTrigger.dataset.bound = '1';
      const syncTone = () => {
        const value = getLegacySelectValue('chattingStyleSelect');
        const btn = toneOptions.querySelector(`[data-value="${value}"]`);
        toneValueEl.textContent = btn ? btn.textContent : 'Freestyle';
        toneOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
          opt.classList.toggle('is-selected', opt.dataset.value === value);
        });
      };
      let _toneOpen = false;
      const setToneOpen = (open) => {
        _toneOpen = open;
        const wrap = document.getElementById('automationToneWrap');
        if (wrap) wrap.classList.toggle('is-open', open);
        toneTrigger.setAttribute('aria-expanded', String(open));
        _updateMsgBody();
      };
      syncTone();
      toneTrigger.addEventListener('click', (e) => { e.stopPropagation(); setToneOpen(!_toneOpen); });
      toneOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          setLegacySelectValue('chattingStyleSelect', opt.dataset.value);
          syncTone();
          setToneOpen(false);
          this.refreshCollapsedChips();
        });
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#automationToneWrap') && !e.target.closest('#automationToneOptions')) setToneOpen(false);
      });
    }

    const langTrigger = document.getElementById('automationLangTrigger');
    const langOptions = document.getElementById('automationLangOptions');
    const langValueEl = document.getElementById('automationLangValue');
    if (langTrigger && langOptions && langValueEl && !langTrigger.dataset.bound) {
      langTrigger.dataset.bound = '1';
      const syncLang = () => {
        const value = getLegacySelectValue('conversationLanguageSelect');
        const btn = langOptions.querySelector(`[data-value="${value}"]`);
        langValueEl.textContent = btn ? btn.textContent : '🇺🇸 English';
        langOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
          opt.classList.toggle('is-selected', opt.dataset.value === value);
        });
      };
      let _langOpen = false;
      const setLangOpen = (open) => {
        _langOpen = open;
        const wrap = document.getElementById('automationLangWrap');
        if (wrap) wrap.classList.toggle('is-open', open);
        langTrigger.setAttribute('aria-expanded', String(open));
        _updateMsgBody();
      };
      syncLang();
      langTrigger.addEventListener('click', (e) => { e.stopPropagation(); setLangOpen(!_langOpen); });
      langOptions.querySelectorAll('.automation-v2-activity-speed-option').forEach((opt) => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          setLegacySelectValue('conversationLanguageSelect', opt.dataset.value);
          syncLang();
          setLangOpen(false);
          this.refreshCollapsedChips();
        });
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#automationLangWrap') && !e.target.closest('#automationLangOptions')) setLangOpen(false);
      });
    }

    const prioritySlider = document.getElementById('prioritySlider');
    const prioritySeg = document.getElementById('automationPrioritySeg');
    if (prioritySlider && prioritySeg && !prioritySeg.dataset.bound) {
      prioritySeg.dataset.bound = '1';
      const syncPriority = () => {
        const val = parseInt(prioritySlider.value, 10);
        const closest = [30, 50, 70].reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a);
        prioritySeg.querySelectorAll('.automation-v2-msg-priority-btn').forEach((btn) => {
          btn.classList.toggle('is-active', parseInt(btn.dataset.value, 10) === closest);
        });
      };
      syncPriority();
      prioritySeg.querySelectorAll('.automation-v2-msg-priority-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          prioritySlider.value = btn.dataset.value;
          this._emitInputChange(prioritySlider);
          syncPriority();
          this.refreshCollapsedChips();
        });
      });
      prioritySlider.addEventListener('input', syncPriority);
      prioritySlider.addEventListener('change', syncPriority);
    }
  },

  _initStyleTrainingCard() {
    // Delegated entirely to ChatStyleTraining module (chat-style-training.js)
    if (window.ChatStyleTraining) ChatStyleTraining.init();
  },

  _initCloudModeCard() {
    // Show the card unconditionally — CloudMode.init() handles guest-gating internally
    const card = document.getElementById('cloudModeCard');
    if (card) card.style.display = 'block';
    if (window.CloudMode) CloudMode.init();
  },

  _initActiveTimeCard() {
    const body = document.getElementById('atCardBody');
    if (!body) return;

    const timeToMins = (str) => {
      if (!str) return 0;
      const parts = str.trim().split(' ');
      const [h, m] = (parts[0] || '0:0').split(':').map(Number);
      if (!parts[1]) return h * 60 + (m || 0);
      const period = parts[1].toUpperCase();
      let hours = h % 12;
      if (period === 'PM') hours += 12;
      return hours * 60 + (m || 0);
    };

    const minsToDisplay = (mins) => {
      mins = Math.min(Math.max(mins, 0), 1439);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const period = h >= 12 ? 'PM' : 'AM';
      const dh = h % 12 || 12;
      return `${dh}:${String(m).padStart(2, '0')} ${period}`;
    };

    const minsTo24 = (mins) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const startInput  = document.getElementById('startTime');
    const endInput    = document.getElementById('endTime');
    const legacyToggle = document.getElementById('activeHoursEnabled');
    const atToggle     = document.getElementById('atToggleInput');
    const atBody       = document.getElementById('atCardBody');
    const atCollapsed  = document.getElementById('atCollapsedRow');
    const rangeDisplay = document.getElementById('atRangeDisplay');

    const isEnabled = legacyToggle ? legacyToggle.checked : false;
    if (atToggle) atToggle.checked = isEnabled;
    if (atBody)      atBody.style.display      = isEnabled ? 'block' : 'none';
    if (atCollapsed) atCollapsed.style.display = 'none';

    const syncToggle = (enabled) => {
      if (atBody)      atBody.style.display      = enabled ? 'block' : 'none';
      if (atCollapsed) atCollapsed.style.display = 'none';
      if (legacyToggle && legacyToggle.checked !== enabled) {
        legacyToggle.checked = enabled;
        legacyToggle.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    if (atToggle) {
      atToggle.addEventListener('change', () => {
        syncToggle(atToggle.checked);
        if (typeof markAsChanged === 'function') markAsChanged();
      });
    }

    if (legacyToggle) {
      legacyToggle.addEventListener('change', () => {
        if (atToggle && atToggle.checked !== legacyToggle.checked) {
          atToggle.checked = legacyToggle.checked;
          syncToggle(legacyToggle.checked);
        }
      });
    }

    const startMins = startInput ? timeToMins(startInput.value) : 0;
    const endMins   = endInput   ? timeToMins(endInput.value)   : 1439;

    body.innerHTML = `
      <div class="at-track-row">
        <span class="at-edge-label" id="atStartLabel">${minsToDisplay(startMins)}</span>
        <div class="at-range-wrap">
          <div class="at-range-bg"></div>
          <div class="at-range-fill" id="atRangeFill"></div>
          <input type="range" class="at-range-input" id="atStartSlider" min="0" max="1440" step="15" value="${startMins}">
          <input type="range" class="at-range-input" id="atEndSlider"   min="0" max="1440" step="15" value="${endMins}">
        </div>
        <span class="at-edge-label at-edge-label--end" id="atEndLabel">${minsToDisplay(endMins)}</span>
      </div>
    `;

    const startSlider = document.getElementById('atStartSlider');
    const endSlider   = document.getElementById('atEndSlider');
    const fill        = document.getElementById('atRangeFill');
    const startLabel  = document.getElementById('atStartLabel');
    const endLabel    = document.getElementById('atEndLabel');

    const updateFill = () => {
      const s = parseInt(startSlider.value);
      const e = parseInt(endSlider.value);
      fill.style.left  = (s / 1440 * 100) + '%';
      fill.style.width = ((e - s) / 1440 * 100) + '%';
      startLabel.textContent = minsToDisplay(s);
      endLabel.textContent   = minsToDisplay(e);
      if (rangeDisplay) rangeDisplay.textContent = `${minsToDisplay(s)} – ${minsToDisplay(e)}`;
    };

    const commit = () => {
      const s = parseInt(startSlider.value);
      const e = parseInt(endSlider.value);
      if (startInput) { startInput.value = minsToDisplay(s); startInput.dataset.value = minsTo24(s); }
      if (endInput)   { endInput.value   = minsToDisplay(e); endInput.dataset.value   = minsTo24(e); }
      const enabled = document.getElementById('activeHoursEnabled');
      if (enabled && !enabled.checked) {
        enabled.checked = true;
        enabled.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof updateActiveHoursHint === 'function') updateActiveHoursHint();
      if (typeof markAsChanged === 'function') markAsChanged();
    };

    startSlider.addEventListener('input', () => {
      if (parseInt(startSlider.value) >= parseInt(endSlider.value)) startSlider.value = parseInt(endSlider.value) - 15;
      updateFill();
    });
    endSlider.addEventListener('input', () => {
      if (parseInt(endSlider.value) <= parseInt(startSlider.value)) endSlider.value = parseInt(startSlider.value) + 15;
      updateFill();
    });
    startSlider.addEventListener('change', commit);
    endSlider.addEventListener('change', commit);

    updateFill();
  },

  _initTooltips() {
    let _tipEl = null;
    let _hideTimer = null;

    const getTip = () => {
      if (_tipEl) return _tipEl;
      _tipEl = document.createElement('div');
      _tipEl.className = 'automation-v2-tooltip';
      document.documentElement.appendChild(_tipEl);
      return _tipEl;
    };

    const renderTipHTML = (trigger) => {
      const raw = trigger.dataset.tooltip || '';
      const title = trigger.dataset.tooltipTitle || '';
      const lines = trigger.dataset.tooltipLines ? JSON.parse(trigger.dataset.tooltipLines) : null;
      if (title || lines) {
        const linesHTML = lines
          ? lines.map((l) => `<div class="atv2-tip-line">${l}</div>`).join('')
          : `<div class="atv2-tip-body">${raw}</div>`;
        return `<div class="atv2-tip-title">${title}</div>${linesHTML}`;
      }
      return `<div class="atv2-tip-body">${raw}</div>`;
    };

    const showTip = (trigger) => {
      clearTimeout(_hideTimer);
      const tip = getTip();
      tip.innerHTML = renderTipHTML(trigger);
      tip.removeAttribute('data-dir');
      tip.style.display = 'block';
      tip.style.opacity = '0';
      tip.style.transform = 'translateY(6px)';

      requestAnimationFrame(() => {
        const r = trigger.getBoundingClientRect();
        const t = tip.getBoundingClientRect();
        const GAP = 10;
        const MARGIN = 8;
        let left = r.left + r.width / 2 - t.width / 2;
        left = Math.max(MARGIN, Math.min(left, window.innerWidth - t.width - MARGIN));
        const fitsAbove = r.top >= t.height + GAP;
        tip.setAttribute('data-dir', fitsAbove ? 'above' : 'below');
        tip.style.top = fitsAbove ? (r.top - t.height - GAP) + 'px' : (r.bottom + GAP) + 'px';
        tip.style.left = left + 'px';
        const caretLeft = Math.round(r.left + r.width / 2 - left);
        tip.style.setProperty('--caret-left', caretLeft + 'px');
        requestAnimationFrame(() => {
          tip.style.opacity = '1';
          tip.style.transform = 'translateY(0)';
        });
      });
    };

    const hideTip = () => {
      clearTimeout(_hideTimer);
      if (_tipEl) {
        _tipEl.style.opacity = '0';
        _tipEl.style.transform = 'translateY(4px)';
      }
      _hideTimer = setTimeout(() => {
        if (_tipEl) _tipEl.style.display = 'none';
      }, 220);
    };

    document.addEventListener('mouseover', (e) => {
      const trigger = e.target.closest('.tooltip-trigger[data-tooltip]');
      if (!trigger) return;
      showTip(trigger);
    });

    document.addEventListener('mouseout', (e) => {
      if (!e.target.closest('.tooltip-trigger[data-tooltip]')) return;
      hideTip();
    });
  },

  init() {
    const shell = document.getElementById('automationV2Shell');
    if (!shell) return;

    shell.innerHTML = this.getShellTemplate();
    this._bindAccordions(shell);
    this._mountLegacySections();
    this._buildGoalControls();
    this._syncGoalControlsFromLegacy();
    this._initSwipingCoreControlsUI();
    this._initSwipingAgeRangeUI();
    this._initSwipingDistanceUI();
    this._initSwipingVisualPreferenceUI();
    this._initMessagingTogglesUI();
    this._initStyleTrainingCard();
    this._initCloudModeCard();
    this._initActiveTimeCard();
    this._initTooltips();
    this.refreshCollapsedChips();
    this._bindSummarySync();
  }
};

window.AutomationViews = AutomationViews;
