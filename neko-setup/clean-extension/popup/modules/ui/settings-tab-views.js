const SettingsTabViews = {
  _initialized: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this._buildSafetySection();
    this._updateSafetyLabels();
    this._reorderSafetyContent();
    this._buildManualControls();
    this._buildAiProfileSection();
    this._buildAccountSection();
  },

  syncPresetButtons() {
    const labelMap = {
      likesPerCycle:    'swipes',
      messagesPerCycle: 'messages',
      scheduleInterval: 'schedule',
    };
    Object.entries(labelMap).forEach(([id, keyword]) => {
      const input = document.getElementById(id);
      if (!input) return;
      const currentVal = parseInt(input.value);
      document.querySelectorAll('.st-manual-row').forEach(row => {
        if (!row.querySelector('.st-manual-label')?.textContent.toLowerCase().includes(keyword)) return;
        row.querySelectorAll('.st-preset-btn').forEach(btn => {
          btn.classList.toggle('st-preset-btn--active', parseInt(btn.dataset.value) === currentVal);
        });
      });
    });
  },

  async postInit() {
    this._expandSafetyContent();
    this.syncPresetButtons();

    // Production-grade: Read aboutSource directly from Chrome Storage (the single source of truth).
    // The DOM radios can be stale or desynchronized by race conditions during boot.
    const settingsCard = document.querySelector('.st-bio-card');
    if (settingsCard) {
      const settings = await getSettings();
      const storedSource = settings.aboutSource || 'tinder';
      
      // Force the hidden radio to match storage
      const radio = document.querySelector(`input[name="aboutSource"][value="${storedSource}"]`);
      if (radio) radio.checked = true;
      
      // Sync visual buttons to match
      this._syncBioSegFromRadio(settingsCard);
    }
    
    this._refreshBioSyncStatus();
  },

  _createCategoryLabel(text) {
    const el = document.createElement('div');
    el.className = 'st-category-label';
    el.textContent = text;
    return el;
  },

  _createCard() {
    const el = document.createElement('div');
    el.className = 'st-card';
    return el;
  },

  _buildSafetySection() {
    const shell = document.getElementById('settingsTab');
    const safetySection = document.getElementById('safetyModeSection');
    if (!shell || !safetySection) return;

    const card = this._createCard();
    card.appendChild(safetySection);

    shell.appendChild(this._createCategoryLabel('Safety'));
    shell.appendChild(card);
  },

  _updateSafetyLabels() {
    const relabelMeters = (stateEl) => {
      if (!stateEl) return;
      const labels = stateEl.querySelectorAll('.safety-meter-label > span:first-child');
      if (labels[0]) labels[0].textContent = 'Likes/hr';
      if (labels[1]) labels[1].textContent = 'Msgs/hr';
    };

    const onState = document.getElementById('safetyModeHintOn');
    const offState = document.getElementById('safetyModeHintOff');

    relabelMeters(onState);
    relabelMeters(offState);

    if (onState) {
      const chips = onState.querySelectorAll('.safety-feature-chip span');
      if (chips[1]) chips[1].textContent = 'Shadowban secure';
      if (chips[2]) chips[2].textContent = 'Auto-managed';
    }

    if (offState) {
      const chips = offState.querySelectorAll('.safety-feature-chip span');
      if (chips[1]) chips[1].textContent = 'Shadowban risk';
    }
  },

  _reorderSafetyContent() {
    ['safetyModeHintOn', 'safetyModeHintOff'].forEach(id => {
      const stateCard = document.getElementById(id);
      if (!stateCard) return;

      const usageCard = stateCard.querySelector('.safety-usage-card, .safety-usage-card--danger');
      const features  = stateCard.querySelector('.safety-features, .safety-features--danger');

      if (usageCard && features) {
        stateCard.insertBefore(usageCard, features);
      }

      const chips = stateCard.querySelectorAll('.safety-feature-chip');
      if (chips.length >= 3) {
        features.appendChild(chips[1]);
        features.insertBefore(chips[2], chips[1]);
      }
    });
  },

  _buildManualControls() {
    const ROWS = [
      { label: 'Swipes per cycle',       target: 'likesPerCycle',    presets: [0, 10, 50, 100, 150], fmt: v => String(v) },
      { label: 'Messages per cycle',      target: 'messagesPerCycle', presets: [0, 10, 50, 100, 150], fmt: v => String(v) },
      { label: 'Schedule AI agent every', target: 'scheduleInterval', presets: [30, 60, 120],          fmt: v => v + 'min' }
    ];

    this._appendPresetControls('safetyModeHintOn',  ROWS, true);
    this._appendPresetControls('safetyModeHintOff', ROWS, false);
  },

  _appendPresetControls(stateId, rows, locked) {
    const stateEl = document.getElementById(stateId);
    if (!stateEl) return;

    const controls = document.createElement('div');
    controls.className = locked ? 'st-manual-controls st-manual-controls--locked' : 'st-manual-controls';

    rows.forEach(({ label, target, presets, fmt }) => {
      const row = document.createElement('div');
      row.className = 'st-manual-row';

      const labelEl = document.createElement('span');
      labelEl.className = 'st-manual-label';
      labelEl.textContent = label;

      const group = document.createElement('div');
      group.className = 'st-preset-group';

      presets.forEach(val => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'st-preset-btn';
        btn.dataset.value = val;
        btn.textContent = fmt(val);

        const input = document.getElementById(target);
        if (input && parseInt(input.value) === val) btn.classList.add('st-preset-btn--active');

        if (!locked) {
          btn.addEventListener('click', () => {
            const inp = document.getElementById(target);
            if (!inp) return;
            inp.value = val;
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            group.querySelectorAll('.st-preset-btn').forEach(b => b.classList.remove('st-preset-btn--active'));
            btn.classList.add('st-preset-btn--active');
          });
        }

        group.appendChild(btn);
      });

      row.appendChild(labelEl);
      row.appendChild(group);
      controls.appendChild(row);
    });

    stateEl.appendChild(controls);
  },

  _expandSafetyContent() {
    const safetySection = document.getElementById('safetyModeSection');
    if (!safetySection) return;

    safetySection.style.padding = '0';
    safetySection.style.margin = '0';
    safetySection.style.background = 'transparent';
    safetySection.style.border = 'none';
    safetySection.style.boxShadow = 'none';

    const header = safetySection.querySelector('.section-header');
    if (header) {
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.minHeight = '52px';
      header.style.padding = '0 16px';
      header.style.margin = '0';
      header.style.gap = '0';
    }
  },

  _buildAiProfileSection() {
    const shell = document.getElementById('settingsTab');
    if (!shell) return;

    // Shared collapse state — used by title click, seg buttons, and snapClean
    const collapseState = { collapsed: true, chevron: null, wrap: null };

    const card = this._createCard();
    card.className += ' st-bio-card';

    const title = document.createElement('div');
    title.className = 'st-bio-title';
    title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;cursor:pointer;margin-bottom:14px;';

    const titleText = document.createElement('span');
    titleText.textContent = 'Your Bio (Improve it with AI)';
    title.appendChild(titleText);

    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', '#9ca3af');
    chevron.setAttribute('stroke-width', '2.4');
    chevron.setAttribute('stroke-linecap', 'round');
    chevron.setAttribute('stroke-linejoin', 'round');
    chevron.style.cssText = 'width:16px;height:16px;flex-shrink:0;transition:transform 0.3s ease;';
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '6 9 12 15 18 9');
    chevron.appendChild(poly);
    title.appendChild(chevron);

    card.appendChild(title);

    const seg = document.createElement('div');
    seg.className = 'st-seg';
    const modes = [
      { label: 'Sync',     value: 'tinder' },
      { label: 'Custom',   value: 'manual' },
      { label: 'Generate', value: 'ai'     }
    ];
    modes.forEach(({ label, value }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'st-seg-btn';
      btn.dataset.value = value;
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (collapseState.collapsed && collapseState.wrap) {
          // Highlight the button immediately for responsiveness
          card.querySelectorAll('.st-seg-btn').forEach(b => {
            b.classList.toggle('st-seg-btn--active', b.dataset.value === value);
          });
          // Expand first, then switch mode after animation so snapClean doesn't fight it
          expand();
          setTimeout(() => this._selectBioMode(value, card), 360);
        } else {
          this._selectBioMode(value, card);
        }
      });
      seg.appendChild(btn);
    });
    card.appendChild(seg);

    const panelSync = document.createElement('div');
    panelSync.className = 'st-bio-panel';
    panelSync.dataset.panel = 'tinder';
    
    const syncHint = document.createElement('p');
    syncHint.className = 'st-bio-hint';
    syncHint.textContent = 'Uses your live dating profile.';
    panelSync.appendChild(syncHint);
    
    const syncBtn = document.createElement('button');
    syncBtn.type = 'button';
    syncBtn.className = 'st-bio-sync-btn';
    syncBtn.id = 'stBioSyncBtn';
    syncBtn.textContent = 'Sync Now';
    syncBtn.addEventListener('click', () => this._triggerProfileSync(card));
    panelSync.appendChild(syncBtn);
    
    const syncStatus = document.createElement('span');
    syncStatus.className = 'st-bio-sync-link';
    syncStatus.id = 'stBioSyncStatus';
    panelSync.appendChild(syncStatus);
    
    const panelCustom = document.createElement('div');
    panelCustom.className = 'st-bio-panel';
    panelCustom.dataset.panel = 'manual';
    const textarea = document.createElement('textarea');
    textarea.className = 'st-bio-textarea';
    textarea.placeholder = 'Enter your text here';
    const legacyTextarea = document.getElementById('aboutMyself');
    if (legacyTextarea) textarea.value = legacyTextarea.value;
    textarea.addEventListener('input', () => {
      if (legacyTextarea) {
        legacyTextarea.value = textarea.value;
        legacyTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const customHint = document.createElement('p');
    customHint.className = 'st-bio-hint';
    customHint.textContent = 'AI only uses this description';
    panelCustom.appendChild(textarea);
    panelCustom.appendChild(customHint);

    const panelGenerate = this._buildGeneratePanel();

    const panelsWrap = document.createElement('div');
    panelsWrap.className = 'st-bio-panels-wrap';
    panelsWrap.appendChild(panelSync);
    panelsWrap.appendChild(panelCustom);
    panelsWrap.appendChild(panelGenerate);
    card.appendChild(panelsWrap);

    // Store refs in shared state so seg buttons and title can both use them
    collapseState.chevron = chevron;
    collapseState.wrap = panelsWrap;

    const expand = () => {
      collapseState.collapsed = false;
      chevron.style.transform = 'rotate(0deg)';
      const activePanel = panelsWrap.querySelector('.st-bio-panel.is-active');
      const h = activePanel ? activePanel.scrollHeight : panelsWrap.scrollHeight;
      panelsWrap.style.overflow = 'hidden';
      panelsWrap.style.height = '0px';
      panelsWrap.style.opacity = '0';
      panelsWrap.style.marginTop = '0px';
      void panelsWrap.offsetHeight;
      panelsWrap.style.transition = 'height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, margin-top 0.35s ease';
      panelsWrap.style.height = h + 'px';
      panelsWrap.style.opacity = '1';
      panelsWrap.style.marginTop = '4px';
      setTimeout(() => {
        panelsWrap.style.overflow = 'visible';
        panelsWrap.style.height = 'auto';
        panelsWrap.style.transition = '';
      }, 360);
    };

    const collapse = () => {
      collapseState.collapsed = true;
      chevron.style.transform = 'rotate(-90deg)';
      const h = panelsWrap.scrollHeight;
      panelsWrap.style.overflow = 'hidden';
      panelsWrap.style.height = h + 'px';
      void panelsWrap.offsetHeight;
      panelsWrap.style.transition = 'height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, margin-top 0.35s ease';
      panelsWrap.style.height = '0px';
      panelsWrap.style.opacity = '0';
      panelsWrap.style.marginTop = '0px';
      setTimeout(() => { panelsWrap.style.transition = ''; }, 360);
    };

    const applyInitialCollapse = () => {
      collapseState.collapsed = true;
      chevron.style.transform = 'rotate(-90deg)';
      panelsWrap.style.height = '0px';
      panelsWrap.style.opacity = '0';
      panelsWrap.style.marginTop = '0px';
      panelsWrap.style.overflow = 'hidden';
    };

    title.addEventListener('click', () => {
      if (collapseState.collapsed) expand(); else collapse();
    });

    shell.appendChild(this._createCategoryLabel('AI Profile'));
    shell.appendChild(card);

    this._syncBioSegFromRadio(card);
    
    // Ensure the visual UI correctly reacts to backend storage loads or legacy changes
    document.querySelectorAll('input[name="aboutSource"]').forEach(radio => {
      radio.addEventListener('change', () => this._syncBioSegFromRadio(card));
    });

    this._refreshBioSyncStatus();

    // Apply collapsed state AFTER syncBioSegFromRadio (which wipes inline styles via snapClean)
    requestAnimationFrame(() => applyInitialCollapse());
  },

  _selectBioMode(value, card) {
    const radio = document.querySelector(`input[name="aboutSource"][value="${value}"]`);
    if (radio) {
      radio.checked = true;
      this._suppressBioSync = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      this._suppressBioSync = false;
    }

    card.querySelectorAll('.st-seg-btn').forEach(b => {
      b.classList.toggle('st-seg-btn--active', b.dataset.value === value);
    });

    this._slideBioPanel(value, card);
  },

  _slideBioPanel(value, card, instant = false) {
    const ORDER = ['tinder', 'manual', 'ai'];
    const wrap = card.querySelector('.st-bio-panels-wrap');
    const panels = Array.from(card.querySelectorAll('.st-bio-panel'));

    const snapClean = (activePanel) => {
      panels.forEach(p => { p.classList.remove('is-active'); p.style.cssText = ''; });
      if (activePanel) activePanel.classList.add('is-active');
      // Preserve collapse state — only reset wrap styles that relate to sliding, not height/opacity
      const wasCollapsed = wrap.style.height === '0px';
      wrap.style.cssText = '';
      if (wasCollapsed) {
        wrap.style.height = '0px';
        wrap.style.opacity = '0';
        wrap.style.marginTop = '0px';
        wrap.style.overflow = 'hidden';
      }
    };

    const nextPanel = panels.find(p => p.dataset.panel === value) || null;
    if (!nextPanel) return;

    if (instant) {
      if (card._slideTimer) { clearTimeout(card._slideTimer); card._slideTimer = null; }
      card._slidingTo = null;
      card._slideInflightTarget = null;
      snapClean(nextPanel);
      return;
    }

    // If same target is already animating, ignore
    if (card._slidingTo === value) return;

    // Cancel any in-flight animation: snap to its target, then start fresh
    if (card._slideTimer) {
      clearTimeout(card._slideTimer);
      card._slideTimer = null;
      snapClean(card._slideInflightTarget || null);
      card._slidingTo = null;
      card._slideInflightTarget = null;
      void wrap.offsetHeight; // flush snapped state before new animation reads it
    }

    const currentPanel = panels.find(p => p.classList.contains('is-active')) || null;
    if (nextPanel === currentPanel) return;

    card._slidingTo = value;
    card._slideInflightTarget = nextPanel;

    const currentIdx = currentPanel ? ORDER.indexOf(currentPanel.dataset.panel) : -1;
    const nextIdx = ORDER.indexOf(value);
    const goingRight = nextIdx > currentIdx;

    // Lock wrap height so it doesn't collapse when panels go absolute
    const lockH = currentPanel ? currentPanel.scrollHeight : wrap.offsetHeight;
    wrap.style.transition = 'none';
    wrap.style.height = lockH + 'px';
    void wrap.offsetHeight;

    // Pin current panel absolutely (override CSS position:relative from is-active)
    if (currentPanel) {
      currentPanel.style.position = 'absolute';
      currentPanel.style.top = '0';
      currentPanel.style.left = '0';
      currentPanel.style.right = '0';
    }

    // Snap next panel to off-screen start with no transition
    nextPanel.style.transition = 'none';
    nextPanel.style.position = 'absolute';
    nextPanel.style.top = '0';
    nextPanel.style.left = '0';
    nextPanel.style.right = '0';
    nextPanel.style.transform = `translateX(${goingRight ? '100%' : '-100%'})`;
    nextPanel.style.opacity = '0';
    void nextPanel.offsetHeight; // flush: commit off-screen position without transition
    nextPanel.style.transition = '';
    wrap.style.transition = ''; // re-enable wrap height transition

    requestAnimationFrame(() => {
      // Animate wrap to next panel height
      wrap.style.height = nextPanel.scrollHeight + 'px';

      // Slide out current
      if (currentPanel) {
        currentPanel.style.opacity = '0';
        currentPanel.style.transform = `translateX(${goingRight ? '-100%' : '100%'})`;
      }

      // Slide in next
      nextPanel.style.transform = 'translateX(0)';
      nextPanel.style.opacity = '1';

      // Settle after transition: swap is-active, clear all inline styles
      card._slideTimer = setTimeout(() => {
        card._slidingTo = null;
        card._slideTimer = null;
        card._slideInflightTarget = null;
        snapClean(nextPanel);
      }, 420);
    });
  },

  _triggerProfileSync(card) {
    const platform = window.CURRENT_PLATFORM;
    const syncEl = document.getElementById('stBioSyncStatus');
    const syncBtn = document.getElementById('stBioSyncBtn');

    // Gate 1: refuse to sync if not on a supported platform page
    if (!platform || (platform !== 'Tinder' && platform !== 'Bumble')) {
      if (syncEl) {
        syncEl.textContent = 'Open Tinder or Bumble first, then sync';
        syncEl.style.color = '#ef4444';
      }
      return;
    }

    // Show loading state
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `<span class="st-sync-spinner"></span>Syncing...`;
    }
    if (syncEl) {
      syncEl.textContent = `Syncing from ${platform}...`;
      syncEl.style.color = '';
      syncEl.classList.add('st-bio-sync-link--loading');
    }

    const resetUI = () => {
      if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = 'Sync Now'; syncBtn.innerHTML = 'Sync Now'; }
      if (syncEl) syncEl.classList.remove('st-bio-sync-link--loading');
    };

    // Send the sync request directly to background and handle the response inline
    const requiredPlatform = platform === 'Bumble' ? 'bumble' : 'tinder';
    chrome.runtime.sendMessage({ action: 'refreshProfile', platform: requiredPlatform }, async (response) => {
      if (chrome.runtime.lastError) {
        resetUI();
        if (syncEl) {
          syncEl.textContent = 'Sync failed — try again';
          syncEl.style.color = '#ef4444';
        }
        return;
      }

      if (response && response.success) {
        // Profile synced — write BOTH timestamp keys for cross-module compat
        const now = Date.now();
        const platformKey = `lastProfileSync_${platform === 'Bumble' ? 'Bumble' : 'Tinder'}`;
        await chrome.storage.local.set({ lastProfileSync: now, [platformKey]: now });
        resetUI();
        this._refreshBioSyncStatus();
        if (typeof showMessage === 'function') {
          const profile = response.profile || {};
          const parts = [];
          if (profile.bio) parts.push(`Bio: ${profile.bio.substring(0, 50)}...`);
          if (profile.interests?.length) parts.push(`Interests: ${profile.interests.length}`);
          showMessage(`✓ Profile synced from ${platform}!${parts.length ? '\n' + parts.join('\n') : ''}`, 'success');
        }
      } else {
        // Gate 2: login detection — show the exact error from the background script
        resetUI();
        const errorMsg = response?.error || 'Unknown error';
        if (syncEl) {
          syncEl.textContent = errorMsg.includes('log in')
            ? `Log in to ${platform} first`
            : 'Sync failed — try again';
          syncEl.style.color = '#ef4444';
        }
      }
    });
  },

  _buildGeneratePanel() {
    const panel = document.createElement('div');
    panel.className = 'st-bio-panel';
    panel.dataset.panel = 'ai';

    const sparkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`;
    const sparkSmSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`;
    const spinSvg = `<svg class="st-gen-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

    // Step 0 — idle
    const step0 = document.createElement('div');
    step0.className = 'st-gen-step';
    step0.dataset.genStep = '0';
    step0.innerHTML = `
      <div class="st-gen-icon-wrap">${sparkSvg}</div>
      <div class="st-gen-title">Generate a Magic Bio</div>
      <p class="st-gen-desc">Let AI analyze your profile and craft the perfect bio to maximize your matches.</p>
    `;
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'st-gen-cta';
    cta.innerHTML = `${sparkSmSvg} Generate Bio Now`;
    cta.addEventListener('click', () => this._runGenerate(panel));
    step0.appendChild(cta);
    panel.appendChild(step0);

    // Step 1 — loading
    const step1 = document.createElement('div');
    step1.className = 'st-gen-step';
    step1.dataset.genStep = '1';
    step1.style.display = 'none';
    step1.innerHTML = `
      <div class="st-gen-banner">${spinSvg} ✨ Crafting your perfect bio...</div>
      <div class="st-gen-skeleton">
        <div class="st-skel-line" style="width:75%"></div>
        <div class="st-skel-line" style="width:100%"></div>
        <div class="st-skel-line" style="width:83%"></div>
        <div class="st-skel-line" style="width:50%"></div>
      </div>
      <div class="st-gen-dots">
        <div class="st-dot" style="animation-delay:0ms"></div>
        <div class="st-dot" style="animation-delay:150ms"></div>
        <div class="st-dot" style="animation-delay:300ms"></div>
        <span class="st-dot-label">Analyzing</span>
      </div>
    `;
    panel.appendChild(step1);

    // Step 2 — result
    const step2 = document.createElement('div');
    step2.className = 'st-gen-step';
    step2.dataset.genStep = '2';
    step2.style.display = 'none';
    step2.innerHTML = `
      <div class="st-gen-score-row">
        <div class="st-gen-ring">
          <svg class="st-gen-ring-svg" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="19" fill="none" stroke="#f3f4f6" stroke-width="3"/>
            <circle class="st-gen-ring-fill" cx="22" cy="22" r="19" fill="none" stroke="#f43f5e" stroke-width="3" stroke-dasharray="119" stroke-dashoffset="119" stroke-linecap="round"/>
          </svg>
          <span class="st-gen-score-num" id="stGenScoreNum">0</span>
        </div>
        <div class="st-gen-score-info">
          <div class="st-gen-score-label">Quality Score <span class="st-gen-score-badge">Active</span></div>
          <div class="st-gen-score-sub">Your bio is highly engaging. Push it now.</div>
        </div>
      </div>
      <div class="st-gen-bio-box">
        <span class="st-gen-bio-bar"></span>
        <p class="st-gen-bio-text" id="stGenBioText"></p>
      </div>
      <div class="st-gen-ready-label">Bio ready! Use below</div>
      <div class="st-gen-actions">
        <button type="button" class="st-gen-sec-btn" id="stGenRegenBtn">↺ Regen</button>
        <button type="button" class="st-gen-push-btn" id="stGenPushBtn">↓ Push Profile</button>
        <button type="button" class="st-gen-sec-btn" id="stGenCopyBtn">Copy</button>
      </div>
    `;
    step2.querySelector('#stGenRegenBtn').addEventListener('click', () => this._runGenerate(panel));
    step2.querySelector('#stGenCopyBtn').addEventListener('click', () => {
      const bio = document.getElementById('stGenBioText')?.textContent || '';
      navigator.clipboard.writeText(bio).then(() => {
        const btn = document.getElementById('stGenCopyBtn');
        if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); }
      });
    });
    step2.querySelector('#stGenPushBtn').addEventListener('click', () => {
      const bio = document.getElementById('stGenBioText')?.textContent || '';
      this._pushBio(panel, bio);
    });
    panel.appendChild(step2);

    // Step 3 — success
    const step3 = document.createElement('div');
    step3.className = 'st-gen-step';
    step3.dataset.genStep = '3';
    step3.style.display = 'none';
    step3.innerHTML = `
      <div class="st-gen-success">
        <div class="st-gen-check-wrap">${checkSvg}</div>
        <div class="st-gen-success-title" id="stGenSuccessTitle">Pushed to Tinder!</div>
        <p class="st-gen-success-sub">Your profile bio has been successfully updated in the app.</p>
      </div>
    `;
    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'st-gen-done-btn';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => this._showGenStep(panel, 0));
    step3.querySelector('.st-gen-success').appendChild(doneBtn);
    panel.appendChild(step3);

    return panel;
  },

  _showGenStep(panel, stepNum) {
    panel.querySelectorAll('.st-gen-step').forEach(s => {
      s.style.display = parseInt(s.dataset.genStep) === stepNum ? 'block' : 'none';
    });
  },

  _runGenerate(panel) {
    this._showGenStep(panel, 1);
    const resultDiv = document.getElementById('bioAiResult');
    if (resultDiv) resultDiv.classList.remove('show');

    if (typeof generateBioFromCard !== 'function') {
      this._showGenStep(panel, 0);
      return;
    }

    generateBioFromCard();

    let timeoutId;
    const observer = new MutationObserver(() => {
      if (document.getElementById('bioAiResult')?.classList.contains('show')) {
        clearTimeout(timeoutId);
        observer.disconnect();
        const bio = document.getElementById('bioGeneratedText')?.textContent || '';
        const score = parseInt(document.getElementById('bioScore')?.textContent) || 85;
        this._showGenResult(panel, bio, score);
      }
    });

    if (resultDiv) {
      observer.observe(resultDiv, { attributes: true, attributeFilter: ['class'] });
    }

    timeoutId = setTimeout(() => {
      observer.disconnect();
      this._showGenStep(panel, 0);
    }, 35000);
  },

  _showGenResult(panel, bio, score) {
    const bioTextEl = document.getElementById('stGenBioText');
    const scoreNumEl = document.getElementById('stGenScoreNum');
    const ringFill = panel.querySelector('.st-gen-ring-fill');
    const platformTitle = document.getElementById('tinderProfileOption')
      ?.querySelector('.about-option-title')?.textContent || '';
    const isBumble = platformTitle.includes('Bumble');
    const platformName = isBumble ? 'Bumble' : 'Tinder';

    if (bioTextEl) bioTextEl.textContent = bio;
    this._showGenStep(panel, 2);

    if (scoreNumEl && ringFill) {
      let current = 0;
      const target = Math.min(Math.max(score, 0), 100);
      const circumference = 119;
      const interval = setInterval(() => {
        current += target / 30;
        if (current >= target) { current = target; clearInterval(interval); }
        scoreNumEl.textContent = Math.round(current);
        ringFill.style.strokeDashoffset = circumference - (current / 100 * circumference);
      }, 20);
    }

    const pushBtn = document.getElementById('stGenPushBtn');
    if (pushBtn) pushBtn.textContent = `↓ Push to ${platformName}`;

    const successTitle = document.getElementById('stGenSuccessTitle');
    if (successTitle) successTitle.textContent = `Pushed to ${platformName}!`;
  },

  _pushBio(panel, bio) {
    if (!bio) return;
    const platformTitle = document.getElementById('tinderProfileOption')
      ?.querySelector('.about-option-title')?.textContent || '';
    const isBumble = platformTitle.includes('Bumble');
    const platformName = isBumble ? 'Bumble' : 'Tinder';
    const action = isBumble ? 'pushBioToBumble' : 'pushBioToTinder';

    const pushBtn = document.getElementById('stGenPushBtn');
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = 'Pushing...'; }

    chrome.runtime.sendMessage({ action, bio }, (response) => {
      if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = `↓ Push to ${platformName}`; }
      if (response && response.success) {
        this._showGenStep(panel, 3);
      } else {
        if (typeof showMessage === 'function') showMessage(`Failed: ${response?.error || 'Unknown error'}`, 'error');
      }
    });
  },

  _syncBioSegFromRadio(card) {
    if (this._suppressBioSync) return;
    const checked = document.querySelector('input[name="aboutSource"]:checked');
    const value = checked ? checked.value : 'tinder';
    card.querySelectorAll('.st-seg-btn').forEach(b => {
      b.classList.toggle('st-seg-btn--active', b.dataset.value === value);
    });
    this._slideBioPanel(value, card, true);
  },

  _refreshBioSyncStatus() {
    const syncStatus = document.getElementById('stBioSyncStatus');
    if (!syncStatus) return;
    const platformTitle = document.getElementById('tinderProfileOption')
      ?.querySelector('.about-option-title')?.textContent || '';
    const platform = platformTitle.includes('Bumble') ? 'Bumble' : 'Tinder';
    chrome.storage.local.get(['lastProfileSync'], (result) => {
      const lastSync = result.lastProfileSync;
      if (!lastSync) {
        syncStatus.innerHTML = '';
        syncStatus.textContent = 'Not synced yet — click to sync';
        return;
      }
      const diffMins = Math.floor((Date.now() - lastSync) / 60000);
      let ago;
      if (diffMins < 1) ago = 'just now';
      else if (diffMins < 60) ago = `${diffMins}m ago`;
      else if (diffMins < 1440) ago = `${Math.floor(diffMins / 60)}h ago`;
      else ago = `${Math.floor(diffMins / 1440)}d ago`;

      syncStatus.innerHTML = `
        <span class="st-sync-status-row">
          <span class="st-sync-status-left">
            <span class="st-sync-dot"></span>
            <span class="st-sync-status-text">Synced from ${platform} <span class="st-sync-ago">· ${ago}</span></span>
          </span>
          <button type="button" class="st-sync-eye-btn" id="stSyncEyeBtn" title="Preview what AI will use">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </span>
      `;

      const eyeBtn = syncStatus.querySelector('#stSyncEyeBtn');
      if (eyeBtn) {
        eyeBtn.addEventListener('click', () => this._openProfilePreview());
      }
    });
  },

  async _openProfilePreview() {
    const existing = document.getElementById('stProfilePreviewSheet');
    if (existing) { this._closeProfilePreview(); return; }

    const settings = await getSettings();
    const profile = settings.userProfile || {};

    const FIELDS = [
      { key: 'name',               label: 'Name',        icon: 'user'    },
      { key: 'bio',                label: 'Bio',         icon: 'file'    },
      { key: 'height',             label: 'Height',      icon: 'ruler'   },
      { key: 'job',                label: 'Job',         icon: 'brief'   },
      { key: 'school',             label: 'School',      icon: 'school'  },
      { key: 'interests',          label: 'Interests',   icon: 'star'    },
      { key: 'languages',          label: 'Languages',   icon: 'lang'    },
      { key: 'zodiac',             label: 'Zodiac',      icon: 'star'    },
      { key: 'drinking',           label: 'Drinking',    icon: 'file'    },
      { key: 'smoking',            label: 'Smoking',     icon: 'file'    },
      { key: 'kids',               label: 'Kids',        icon: 'file'    },
      { key: 'workout',            label: 'Exercise',    icon: 'file'    },
      { key: 'religion',           label: 'Religion',    icon: 'file'    },
      { key: 'lookingFor',         label: 'Looking For', icon: 'file'    },
    ];

    const ICONS = {
      user:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      file:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>`,
      ruler:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/></svg>`,
      brief:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
      school: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
      star:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      lang:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    };

    const hasData = FIELDS.some(f => {
      const v = profile[f.key];
      return v && (Array.isArray(v) ? v.length > 0 : String(v).trim());
    });

    let fieldsHtml = '';
    if (hasData) {
      FIELDS.forEach(({ key, label, icon }, i) => {
        let val = profile[key];
        if (!val || (Array.isArray(val) && val.length === 0)) return;
        if (Array.isArray(val)) val = val.join(', ');
        const delay = i * 0.06;
        fieldsHtml += `
          <div class="st-preview-field" style="animation-delay:${delay}s">
            <span class="st-preview-field-label">${ICONS[icon] || ICONS.file}${label}</span>
            <span class="st-preview-field-value">${val}</span>
          </div>`;
      });
    } else {
      fieldsHtml = `<div class="st-preview-empty">No profile data yet — sync first.</div>`;
    }

    const sheet = document.createElement('div');
    sheet.id = 'stProfilePreviewSheet';
    sheet.className = 'st-preview-sheet-wrap';
    sheet.innerHTML = `
      <div class="st-preview-backdrop"></div>
      <div class="st-preview-sheet">
        <div class="st-preview-sheet-header">
          <div>
            <div class="st-preview-sheet-title">How AI Sees You</div>
            <div class="st-preview-sheet-sub">YOUR SYNCED PROFILE</div>
          </div>
          <button type="button" class="st-preview-close-btn" id="stPreviewCloseBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="st-preview-sheet-body">${fieldsHtml}</div>
      </div>
    `;

    document.body.appendChild(sheet);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    });

    sheet.querySelector('.st-preview-backdrop').addEventListener('click', () => this._closeProfilePreview());
    sheet.querySelector('#stPreviewCloseBtn').addEventListener('click', () => this._closeProfilePreview());
  },

  _closeProfilePreview() {
    const sheet = document.getElementById('stProfilePreviewSheet');
    if (!sheet) return;
    sheet.classList.remove('is-open');
    sheet.addEventListener('transitionend', () => sheet.remove(), { once: true });
  },

  _buildAccountSection() {
    const shell = document.getElementById('settingsTab');
    if (!shell) return;

    const card = this._createCard();
    card.className += ' st-account-card';

    const platformsTitle = document.createElement('div');
    platformsTitle.className = 'st-account-row-title';
    platformsTitle.textContent = 'Connected Platforms';
    card.appendChild(platformsTitle);

    const chips = document.createElement('div');
    chips.className = 'st-platform-chips';
    chips.id = 'stPlatformChips';

    const tChip = this._makePlatformChip('tinder', 'Tinder', '#ff4458', 'icons/tinder.jpg');
    const bChip = this._makePlatformChip('bumble', 'Bumble', '#ffc629', 'icons/bumble.png');
    chips.appendChild(tChip);
    chips.appendChild(bChip);
    card.appendChild(chips);

    const divider = document.createElement('div');
    divider.className = 'st-account-divider';
    card.appendChild(divider);

    const subRow = document.createElement('div');
    subRow.className = 'st-account-sub-row';

    const subLabel = document.createElement('span');
    subLabel.className = 'st-account-sub-label';
    subLabel.textContent = 'Subscription';

    const subValue = document.createElement('span');
    subValue.className = 'st-account-sub-value';
    subValue.id = 'stSubscriptionValue';
    subValue.textContent = 'Free Plan';

    subRow.appendChild(subLabel);
    subRow.appendChild(subValue);
    card.appendChild(subRow);

    shell.appendChild(this._createCategoryLabel('Account'));
    shell.appendChild(card);

    this._detectActivePlatform();
    this._loadSubscription();

    if (!this._subStorageListener) {
      this._subStorageListener = (changes, namespace) => {
        if (namespace !== 'local') return;
        if (changes.user || changes.trial_v3) this._loadSubscription();
      };
      chrome.storage.onChanged.addListener(this._subStorageListener);
    }
  },

  _makePlatformChip(platform, name, color, iconPath) {
    const chip = document.createElement('div');
    chip.className = 'st-platform-chip';
    chip.dataset.platform = platform;

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(iconPath);
    img.className = 'st-platform-icon';
    img.alt = name;

    const label = document.createElement('span');
    label.textContent = name;

    chip.appendChild(img);
    chip.appendChild(label);
    return chip;
  },

  _detectActivePlatform() {
    const applyPlatform = (platform) => {
      const chips = document.getElementById('stPlatformChips');
      if (!chips) return;
      chips.querySelectorAll('.st-platform-chip').forEach(chip => {
        chip.classList.toggle('st-platform-chip--active', chip.dataset.platform === platform);
      });
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      if (url.includes('tinder.com')) {
        applyPlatform('tinder');
      } else if (url.includes('bumble.com')) {
        applyPlatform('bumble');
      } else {
        // Not on a dating platform tab — fall back to onboarding/stored preference
        chrome.storage.local.get('preferredPlatform', (data) => {
          applyPlatform(data.preferredPlatform || 'tinder');
        });
      }
    });
  },

  async _loadSubscription() {
    const el = document.getElementById('stSubscriptionValue');
    if (!el) return;

    const sparkleSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0"><defs><linearGradient id="stSubSparkle" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9d2383"/><stop offset="100%" stop-color="#de4cb0"/></linearGradient></defs><path stroke="url(#stSubSparkle)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>`;

    let status = 'guest';
    let trial = null;
    if (typeof TrialManager !== 'undefined') {
      try {
        trial = await TrialManager.getTrialStatus();
        status = trial?.status || 'guest';
      } catch (_) {}
    } else {
      const data = await chrome.storage.local.get('user');
      if (data?.user?.plan === 'pro') status = 'pro';
    }

    el.classList.remove('st-sub-premium', 'st-sub-trial');
    
    // Crossfade morph wrapper
    const buildHoverTime = (text, timerText) => `
      <div class="st-sub-reveal-wrap" title="Time until renewal/expiration">
        <div class="st-sub-front">
          ${sparkleSvg}<span>${text}</span>
        </div>
        <div class="st-sub-back">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
          <span>${timerText}</span>
        </div>
      </div>
    `;

    if (status === 'pro' || status === 'active') {
      let timeLeftText = 'Active';
      if (trial) {
        let msLeft = 0;
        if (status === 'pro' && trial.planExpiresAt) {
          // Pro users: planExpiresAt is included in the 'pro' return object
          msLeft = Math.max(0, new Date(trial.planExpiresAt).getTime() - Date.now());
        } else if (trial.timeLeft > 0) {
          // Active/trial users: timeLeft is already correctly calculated by TrialManager
          msLeft = trial.timeLeft;
        }
        
        const d = Math.floor(msLeft / (1000 * 60 * 60 * 24));
        const h = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        timeLeftText = `${d}D ${h}H left`;
      }

      if (status === 'pro') {
        el.innerHTML = buildHoverTime('Premium Plan', timeLeftText);
        el.classList.add('st-sub-premium');
      } else {
        el.innerHTML = buildHoverTime('Pro Trial', timeLeftText);
        el.classList.add('st-sub-trial');
      }
    } else if (status === 'expired') {
      el.textContent = trial?.reason === 'subscription' ? 'Plan Expired' : 'Trial Ended';
    } else {
      el.textContent = 'Free Plan';
    }
  }
};
