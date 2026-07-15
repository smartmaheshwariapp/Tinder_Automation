
// Achievements Modal - Plugin UI Management

function setupGuideListeners() {
  const showGuideBtn = document.getElementById('showAchievementsGuide');
  const guideWrapper = document.getElementById('achievementsGuideWrapper');
  const closeGuideBtn = document.getElementById('closeGuideBtn');

  if (!showGuideBtn || !guideWrapper) return;

  const closeGuide = () => {
    if (!guideWrapper.classList.contains('expanded')) return;

    guideWrapper.classList.remove('expanded');
    // Wait for the height transition to finish before removing from display flow
    setTimeout(() => {
      if (!guideWrapper.classList.contains('expanded')) {
        guideWrapper.classList.remove('show-layout');
      }
    }, 400); // Matches the 0.4s CSS transition
  };

  const openGuide = () => {
    guideWrapper.classList.add('show-layout');
    // Trigger layout before animating height
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        guideWrapper.classList.add('expanded');
      });
    });
  };

  showGuideBtn.onclick = (e) => {
    e.stopPropagation();
    if (!guideWrapper.classList.contains('expanded')) {
      openGuide();
    } else {
      closeGuide();
    }
  };

  if (closeGuideBtn) {
    closeGuideBtn.onclick = closeGuide;
  }
}

function initializeAchievementsModal() {
  // Initialize guide click listeners
  setupGuideListeners();

  const achievementsBtn = document.getElementById('achievementsBtn');
  const achievementsModal = document.getElementById('achievementsModal');
  const closeAchievementsBtn = document.getElementById('closeAchievementsBtn');
  const achievementsOverlay = document.querySelector('.achievements-modal-overlay');
  let closeTimeout = null;

  function openAchievements() {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
    if (achievementsModal.classList.contains('show')) return;

    achievementsModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        achievementsModal.classList.add('show');
        renderAchievements();
      });
    });
  }

  function closeAchievements() {
    if (!achievementsModal.classList.contains('show')) return;

    achievementsModal.classList.remove('show');

    closeTimeout = setTimeout(() => {
      achievementsModal.style.display = 'none';
      document.body.style.overflow = '';
      closeTimeout = null;
    }, 600);
  }

  achievementsBtn?.addEventListener('click', openAchievements);
  closeAchievementsBtn?.addEventListener('click', closeAchievements);
  achievementsOverlay?.addEventListener('click', closeAchievements);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && achievementsModal.classList.contains('show')) {
      closeAchievements();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'openAchievements') {
      openAchievements();
    } else if (message.action === 'badgeUnlocked') {
      updateNotificationBadge();
      // Refresh achievements if modal is open
      if (achievementsModal.classList.contains('show')) {
        renderAchievements();
      }
    } else if (message.action === 'achievementStatsUpdated') {
      // Refresh progress bar in real-time if modal is open
      if (achievementsModal.classList.contains('show')) {
        renderAchievements();
      }
    }
  });

  // Initialize notification badge on load
  updateNotificationBadge();
}

async function renderAchievements() {
  console.log('[Achievements Modal] Rendering achievements...');

  // Get achievement data from storage
  const result = await chrome.storage.local.get(['achievementData']);
  const achievementData = result.achievementData || {
    userStats: {},
    unlockedBadges: [],
    totalXP: 0
  };

  console.log('[Achievements Modal] Achievement data:', achievementData);

  // Calculate progress using core functions
  const levelData = (window.calculateLevel && window.calculateLevel(achievementData.totalXP)) || { number: 1, name: 'GHOSTED' };
  const level = levelData.number;
  const rankName = levelData.name;
  const xpProgress = (window.getXPForNextLevel && window.getXPForNextLevel(achievementData.totalXP)) || { required: 1000, progress: 0 };
  const nextBadge = (window.getNextBadgeProgress && window.getNextBadgeProgress(achievementData.userStats, achievementData.unlockedBadges)) || null;

  // Organize badges by rarity
  const badgesByRarity = { common: [], rare: [], epic: [], legendary: [] };
  const catalog = window.BADGE_CATALOG || {};
  Object.values(catalog).forEach(badge => {
    const unlocked = achievementData.unlockedBadges.includes(badge.id);
    badgesByRarity[badge.rarity].push({ ...badge, unlocked });
  });

  console.log('[Achievements Modal] Progress stats calculated');

  // Calculate Unified Score (0.0 - 10.0)
  const unifiedScore = (level - 1 + (xpProgress.progress / 100)).toFixed(1);

  // Prestige Rank Icon (Luxury Shield)
  const prestigeIcon = `
    <svg class="prestige-rank-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 2L4 7v7c0 7.4 5.1 14.3 12 16 6.9-1.7 12-8.6 12-16V7L16 2z" fill="url(#rankGrad)" stroke="#FBBF24" stroke-width="2"/>
      <defs>
        <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FBBF24" />
          <stop offset="100%" stop-color="#D97706" />
        </linearGradient>
      </defs>
      <path d="M16 8l2 4h4l-3 3 1 5-4-2-4 2 1-5-3-3h4l2-4z" fill="white" />
    </svg>
  `;

  // Update Header with Prestige Display
  const headerOverview = document.querySelector('.achievement-progress-overview');
  if (headerOverview) {
    headerOverview.innerHTML = `
      <div class="overview-header-row">
        <div class="rank-label">Social Status</div>
        <button id="showAchievementsGuide" class="guide-toggle-btn" title="How it works?">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;">
            <path d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>How it works?</span>
        </button>
      </div>
      <div class="achievement-level-display">
        <div class="level-badge-container">
          ${prestigeIcon}
          <div class="achievement-level-text">${rankName.replace(/[\u{1F300}-\u{1F6FF}]/gu, '').trim()} <span class="achievement-level-number">LVL ${level}</span></div>
        </div>
        <div class="achievement-xp-text">${achievementData.totalXP} / ${xpProgress.required} XP</div>
      </div>
      <div class="achievement-progress-bar">
        <div class="achievement-progress-fill" id="achievementProgress" style="width: ${xpProgress.progress}%"></div>
      </div>
    `;

    // Re-attach guide listeners since we just replaced the HTML
    setupGuideListeners();
  }

  // Update Next Badge with "Encrypted" Preview
  const nextBadgeSection = document.getElementById('nextBadgeSection');
  if (nextBadge && nextBadgeSection) {
    const badgeIcon = (window.BADGE_ICONS && window.BADGE_ICONS[nextBadge.id]) || '❓';

    nextBadgeSection.innerHTML = `
      <div class="next-badge-icon-preview">${badgeIcon}</div>
      <div class="next-badge-content">
        <div class="next-badge-label">Active Objective</div>
        <div class="next-badge-details">
          <div class="next-badge-name">${nextBadge.name}</div>
          <div class="next-badge-progress-text">${nextBadge.current} / ${nextBadge.required}</div>
        </div>
        <div class="achievement-progress-bar" style="height: 6px; margin-top: 8px;">
          <div class="achievement-progress-fill" id="nextBadgeBar" style="width: ${nextBadge.progress}%"></div>
        </div>
      </div>
    `;
    nextBadgeSection.style.display = 'flex';
  } else if (nextBadgeSection) {
    nextBadgeSection.style.display = 'none';
  }

  renderBadgeGrid('commonBadges', badgesByRarity.common);
  renderBadgeGrid('rareBadges', badgesByRarity.rare);
  renderBadgeGrid('epicBadges', badgesByRarity.epic);
  renderBadgeGrid('legendaryBadges', badgesByRarity.legendary);

  // PREVIEW SYSTEM: Allow clicking badges in showcase mode to see the full tinder-side celebration
  document.querySelectorAll('.badge-item').forEach(card => {
    card.addEventListener('click', () => {
      const badgeId = card.getAttribute('data-badge-id');
      const catalog = window.BADGE_CATALOG || {};
      const badge = catalog[badgeId];
      if (badge) {
        // Send message to Tinder content script to show the celebration
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].url?.includes('tinder.com')) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'testCelebration',
              badge: badge
            }, () => {
              // Catching the "Receiving end does not exist" error gracefully
              if (chrome.runtime.lastError) {
                console.log('[Achievements] Preview failed: Content script not ready on this tab.');
              }
            });
          } else {
            console.log('[Achievements] Preview skipped: Active tab is not Tinder.');
          }
        });
      }
    });
  });
}

function renderBadgeGrid(containerId, badges) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = badges.map(badge => {
    // Determine the icon to show
    let iconContent = '🔒';
    if (badge.unlocked) {
      iconContent = (window.BADGE_ICONS && window.BADGE_ICONS[badge.id]) || badge.icon;
    } else if (badge.hidden) {
      iconContent = '❓';
    }

    return `
      <div class="badge-item ${badge.rarity} ${badge.unlocked ? 'unlocked' : 'locked'} ${badge.hidden && !badge.unlocked ? 'hidden' : ''}" 
           data-badge-id="${badge.id}" title="Click to preview celebration">
        <div class="badge-icon">${iconContent}</div>
        <div class="badge-name">${badge.unlocked || !badge.hidden ? badge.name : '???'}</div>
        <div class="badge-desc">${badge.unlocked || !badge.hidden ? badge.description : 'Hidden'}</div>
        ${badge.unlocked ? '<div class="badge-check">✓</div>' : ''}
      </div>
    `;
  }).join('');
}

async function updateNotificationBadge() {
  const result = await chrome.storage.local.get(['achievementData']);
  const achievementData = result.achievementData || { newBadges: [] };
  const newCount = achievementData.newBadges?.length || 0;
  const notifBadge = document.getElementById('achievementsNotifBadge');

  if (newCount > 0) {
    notifBadge.textContent = newCount;
    notifBadge.style.display = 'flex';
  } else {
    notifBadge.style.display = 'none';
  }
}
