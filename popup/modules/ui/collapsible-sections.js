// Collapsible sections
function initializeCollapsibleSections() {
  // Build list of collapsible sections dynamically based on config
  const collapsibleSections = [];

  // Only include API Key and Model sections if not hidden by config
  if (!window.API_CONFIG?.FEATURES?.HIDE_USER_API_KEY) {
    collapsibleSections.push({ headerId: 'apiKeySectionHeader', contentId: 'apiKeySectionContent' });
  }
  if (!window.API_CONFIG?.FEATURES?.HIDE_MODEL_SELECTION) {
    collapsibleSections.push({ headerId: 'aiModelSectionHeader', contentId: 'aiModelSectionContent' });
  }

  // Standard sections (always included)
  collapsibleSections.push(
    { headerId: 'modeSectionHeader', contentId: 'modeSectionContent' },
    { headerId: 'smartReactionsSectionHeader', contentId: 'smartReactionsSectionContent' },
    { headerId: 'profileSectionHeader', contentId: 'profileSectionContent' },
    { headerId: 'promptPreviewSectionHeader', contentId: 'promptPreviewSectionContent' },
    { headerId: 'ageFilterSectionHeader', contentId: 'ageFilterSectionContent' },
    // distanceFilterSection uses its own internal collapse (distance-inner-wrap), skip here
    // visualPreferencesSection uses its own internal collapse (vp-inner-wrap), skip here
    { headerId: 'aiPersonalitySectionHeader', contentId: 'aiPersonalitySection', isSimple: true },
    { headerId: 'stopConditionSectionHeader', contentId: 'stopConditionSection', isSimple: true },
    { headerId: 'cycleSettingsSectionHeader', contentId: 'cycleSettingsSection', isSimple: true },
    { headerId: 'messagePrioritySectionHeader', contentId: 'messagePrioritySection', isSimple: true },
    { headerId: 'scheduleSectionHeader', contentId: 'scheduleSection', isSimple: true },
    { headerId: 'activeHoursSectionHeader', contentId: 'activeHoursSection', isSimple: true },
    { headerId: 'messagePrivacySectionHeader', contentId: 'messagePrivacySectionContent', isSimple: true },
    { headerId: 'safetyModeSectionHeader', contentId: 'safetyModeSection', isSimple: true },
    { headerId: 'toolsSectionHeader', contentId: 'toolsSection', isSimple: true }
  );

  collapsibleSections.forEach(({ contentId, isSimple }) => {
    const content = isSimple ? document.getElementById(contentId) : document.getElementById(contentId);
    const isToolsSection = contentId === 'toolsSection';

    if (content && !isSimple) {
      content.style.maxHeight = '0px';
      content.style.opacity = '0';
      content.style.paddingTop = '0';
      content.style.overflow = 'hidden';
      content.style.height = '0';
    } else if (content && isSimple) {
      if (!content.querySelector('.section-content-wrapper')) {
        if (content.children.length > 1) {
          const wrapper = document.createElement('div');
          wrapper.className = 'section-content-wrapper';

          wrapper.style.maxHeight = '0px';
          wrapper.style.opacity = '0';
          wrapper.style.overflow = 'hidden';
          wrapper.style.transition = 'all 0.3s ease';

          while (content.children.length > 1) {
            wrapper.appendChild(content.children[1]);
          }
          content.appendChild(wrapper);
        }
      }
    }
  });

  collapsibleSections.forEach(({ headerId, contentId, isSimple }) => {
    const header = document.getElementById(headerId);
    const content = isSimple ? document.getElementById(contentId)?.querySelector('.section-content-wrapper') : document.getElementById(contentId);
    if (header && content) {
      const arrow = header.querySelector('.collapse-arrow');
      if (arrow) arrow.style.transform = 'rotate(-90deg)';

      const toggleLabel = header.querySelector('.toggle-switch');
      if (toggleLabel) {
        toggleLabel.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        const toggleInput = toggleLabel.querySelector('input[type="checkbox"]');
        if (toggleInput) {
          toggleInput.addEventListener('change', () => {
            const isChecked = toggleInput.checked;

            if (toggleInput.id === 'safetyMode') {
              updateSafetyModeHint();
              content.style.height = 'auto';
              content.style.padding = '0';
              content.style.maxHeight = content.scrollHeight + 'px';
              content.style.opacity = '1';
              content.style.overflow = 'visible';
              setTimeout(() => {
                content.style.maxHeight = 'none';
                content.classList.add('expanded');
              }, 310);
              return;
            }

            if (toggleInput.id === 'activeHoursEnabled') {
              updateActiveHoursUI();
            }

            if (isChecked) {
              content.style.height = 'auto';
              content.style.paddingTop = '12px';
              setTimeout(() => {
                content.style.maxHeight = content.scrollHeight + 'px';
                content.style.opacity = '1';
                if (arrow) arrow.style.transform = 'rotate(0deg)';
              }, 50);
              setTimeout(() => {
                if (content.style.maxHeight !== '0px') {
                  content.style.maxHeight = 'none';
                  content.classList.add('expanded');
                }
              }, 310);
            } else {
              content.style.maxHeight = content.scrollHeight + 'px';
              content.classList.remove('expanded');
              void content.offsetHeight;
              setTimeout(() => {
                content.style.maxHeight = '0px';
                content.style.opacity = '0';
                content.style.paddingTop = '0';
                if (arrow) arrow.style.transform = 'rotate(-90deg)';
              }, 10);
              setTimeout(() => {
                content.style.height = '0';
              }, 410);
            }
          });
        }
      }

      header.addEventListener('click', () => {
        const isCollapsed = content.style.maxHeight === '0px' || content.style.maxHeight === '';

        if (isCollapsed) {
          content.style.height = 'auto';
          content.style.paddingTop = '12px';
          content.style.maxHeight = content.scrollHeight + 'px';
          content.style.opacity = '1';
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          setTimeout(() => {
            if (content.style.maxHeight !== '0px') {
              content.style.maxHeight = 'none';
              content.classList.add('expanded');
            }
          }, 300);
        } else {
          content.style.maxHeight = content.scrollHeight + 'px';
          content.classList.remove('expanded');
          void content.offsetHeight;
          setTimeout(() => {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.style.paddingTop = '0';
            if (arrow) arrow.style.transform = 'rotate(-90deg)';
          }, 10);
          setTimeout(() => {
            content.style.height = '0';
          }, 400);
        }
      });
    }
  });
}
