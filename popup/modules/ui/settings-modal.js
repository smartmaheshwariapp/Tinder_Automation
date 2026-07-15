// Settings modal management
function initializeSettingsMenu() {
  const settingsMenuBtn = document.getElementById('settingsMenuBtn');
  const settingsMenuBtnInside = document.getElementById('settingsMenuBtnInside');
  const settingsMenu = document.getElementById('settingsMenu');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsOverlay = document.querySelector('.settings-menu-overlay');
  let closeTimeout = null;

  function openSettings() {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
    if (settingsMenu.classList.contains('show')) return;

    settingsMenu.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    settingsMenuBtn?.classList.add('active');
    settingsMenuBtnInside?.classList.add('active');

    const settingsIcon = settingsMenuBtn?.querySelector('.settings-icon');
    const closeIcon = settingsMenuBtn?.querySelector('.close-icon');
    if (settingsIcon) settingsIcon.style.display = 'none';
    if (closeIcon) closeIcon.style.display = 'block';
    settingsMenuBtn?.setAttribute('title', 'Close Settings');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        settingsMenu.classList.add('show');
      });
    });
  }

  function closeSettings() {
    if (!settingsMenu.classList.contains('show')) return;

    settingsMenu.classList.remove('show');
    settingsMenuBtn?.classList.remove('active');
    settingsMenuBtnInside?.classList.remove('active');

    const settingsIcon = settingsMenuBtn?.querySelector('.settings-icon');
    const closeIcon = settingsMenuBtn?.querySelector('.close-icon');
    if (settingsIcon) settingsIcon.style.display = 'block';
    if (closeIcon) closeIcon.style.display = 'none';
    settingsMenuBtn?.setAttribute('title', 'Settings');

    closeTimeout = setTimeout(() => {
      settingsMenu.style.display = 'none';
      document.body.style.overflow = '';
      closeTimeout = null;
    }, 600);
  }

  function toggleSettings() {
    if (settingsMenu.classList.contains('show')) {
      closeSettings();
    } else {
      openSettings();
    }
  }

  settingsMenuBtn?.addEventListener('click', toggleSettings);
  settingsMenuBtnInside?.addEventListener('click', toggleSettings);
  closeSettingsBtn?.addEventListener('click', closeSettings);
  settingsOverlay?.addEventListener('click', closeSettings);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsMenu.classList.contains('show')) {
      closeSettings();
    }
  });
}

function migrateAdvancedContentToSettings() {
  const myProfileTab = document.getElementById('myprofileTab');
  const advancedWrapper = document.getElementById('advancedSectionsWrapper');
  const settingsContent = document.getElementById('settingsMenuContent');

  if (!myProfileTab || !advancedWrapper || !settingsContent) return;

  const sectionsToMoveToSettings = [
    'cycleSettingsSection',
    'messagePrioritySection',
    'scheduleSection',
    'activeHoursSection'
  ];

  const activityTab = document.getElementById('activityTab');
  const toolsSection = Array.from(activityTab?.querySelectorAll('.section') || []).find(section => {
    const header = section.querySelector('.section-header h2');
    return header && header.textContent.trim() === 'Tools';
  });

  const createDivider = (text) => {
    const div = document.createElement('div');
    div.className = 'settings-divider';
    div.innerHTML = `<span>${text}</span>`;
    return div;
  };

  const aiSettingsDivider = createDivider('AI SETTINGS');
  const automationDivider = createDivider('AUTOMATION RULES');
  const toolsDivider = createDivider('SYSTEM & LOGS');

  advancedWrapper.querySelectorAll('.settings-divider').forEach(d => d.remove());
  advancedWrapper.prepend(aiSettingsDivider);

  // Only migrate sections that are not hidden by centralized config
  const apiKeySection = document.getElementById('apiKeySectionHeader')?.closest('.section');
  const aiModelSection = document.getElementById('aiModelSectionHeader')?.closest('.section');
  const modeSection = document.getElementById('modeSectionHeader')?.closest('.section');

  // API Key and Model sections are now controlled by centralized config
  if (apiKeySection && !window.API_CONFIG?.FEATURES?.HIDE_USER_API_KEY) {
    advancedWrapper.appendChild(apiKeySection);
  } else if (apiKeySection) {
    apiKeySection.remove(); // Remove from DOM entirely when hidden
  }

  if (aiModelSection && !window.API_CONFIG?.FEATURES?.HIDE_MODEL_SELECTION) {
    advancedWrapper.appendChild(aiModelSection);
  } else if (aiModelSection) {
    aiModelSection.remove(); // Remove from DOM entirely when hidden
  }

  if (modeSection) advancedWrapper.appendChild(modeSection);

  advancedWrapper.appendChild(automationDivider);
  sectionsToMoveToSettings.forEach(id => {
    const section = document.getElementById(id);
    if (section) advancedWrapper.appendChild(section);
  });

  if (toolsSection) {
    advancedWrapper.appendChild(toolsDivider);
    advancedWrapper.appendChild(toolsSection);
  }

  const sectionsToMoveToProfile = [];
  const aboutSection = document.querySelector('#profileSectionHeader')?.closest('.section');
  if (aboutSection) sectionsToMoveToProfile.push(aboutSection);

  const smartSection = document.querySelector('#smartReactionsSectionHeader')?.closest('.section');
  if (smartSection) sectionsToMoveToProfile.push(smartSection);

  const identityDivider = createDivider('IDENTITY & REACTION');
  const myProfileTabContainer = document.getElementById('myprofileTab');

  sectionsToMoveToProfile.forEach((section, index) => {
    if (section && section.parentElement === advancedWrapper) {
      if (index === 0 && myProfileTabContainer) {
        myProfileTabContainer.appendChild(identityDivider);
      }
      myProfileTabContainer.appendChild(section);
    }
  });

  const allWrapperSections = Array.from(advancedWrapper.children);
  allWrapperSections.forEach(section => {
    settingsContent.appendChild(section);
  });

  advancedWrapper.remove();
}
