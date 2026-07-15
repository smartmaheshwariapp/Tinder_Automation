// About options handlers
function initializeAboutOptions() {
  const radioButtons = document.querySelectorAll('input[name="aboutSource"]');
  const manualContent = document.getElementById('aboutManualContent');
  const bioResult = document.getElementById('bioAiResult');

  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      const selectedValue = radio.value;

      if (manualContent) manualContent.classList.remove('active');
      if (bioResult) bioResult.classList.remove('show');

      if (selectedValue === 'manual' && manualContent) {
        manualContent.classList.add('active');
      }

      markAsChanged();
    });
  });

  const aboutTextarea = document.getElementById('aboutMyself');
  if (aboutTextarea) {
    aboutTextarea.addEventListener('input', updateAboutPreview);
  }

  const tinderProfileOption = document.getElementById('tinderProfileOption');
  if (tinderProfileOption) {
    tinderProfileOption.addEventListener('click', handleTinderCardClick);

    // Dynamic UI update for Bumble users
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || '';
      if (currentUrl.includes('bumble.com')) {
        const title = tinderProfileOption.querySelector('.about-option-title');
        if (title) title.textContent = 'Use Bumble Profile';

        const status = document.getElementById('tinderSyncStatus');
        if (status && status.textContent.includes('Tinder')) {
          status.textContent = status.textContent.replace('Tinder', 'Bumble');
        }

        const useBioBtn = document.getElementById('useBioBtn');
        if (useBioBtn) {
          useBioBtn.innerHTML = useBioBtn.innerHTML.replace('Tinder', 'Bumble');
        }

        const variableHint = document.querySelector('#aboutManualContent .hint');
        if (variableHint) {
          variableHint.innerHTML = variableHint.innerHTML.replace('Tinder', 'Bumble');
        }
      }
    });
  }

  const aiGenerateOption = document.getElementById('aiGenerateOption');
  if (aiGenerateOption) {
    aiGenerateOption.addEventListener('click', handleAiCardClick);
  }
}

async function handleTinderCardClick(e) {
  const state = await getAgentState();
  if (state.isRunning) {
    showMessage('⚠️ Stop the agent before syncing your profile', 'error');
    return;
  }

  const card = document.getElementById('tinderProfileOption');
  const radio = card.querySelector('input[type="radio"]');

  e.preventDefault();
  radio.checked = true;
  const manualContent = document.getElementById('aboutManualContent');
  if (manualContent) {
    manualContent.classList.remove('active');
  }
  const bioResult = document.getElementById('bioAiResult');
  if (bioResult) bioResult.classList.remove('show');
  markAsChanged();

  await syncTinderProfile();
}

async function syncTinderProfile() {
  const card = document.getElementById('tinderProfileOption');
  const statusText = document.getElementById('tinderSyncStatus');

  card.classList.add('syncing');
  const isBumble = card.querySelector('.about-option-title')?.textContent.includes('Bumble');
  statusText.textContent = isBumble ? 'Syncing with Bumble...' : 'Syncing with Tinder...';

  const requiredPlatform = isBumble ? 'bumble' : 'tinder';

  chrome.runtime.sendMessage({ action: 'refreshProfile', platform: requiredPlatform }, async (response) => {
    if (chrome.runtime.lastError) {
      card.classList.remove('syncing');
      statusText.textContent = 'Failed to sync. Click to try again.';
      return;
    }

    card.classList.remove('syncing');

    if (response && response.success) {
      const profile = response.profile || {};
      const parts = [];
      if (profile.city) parts.push(`City: ${profile.city}`);
      if (profile.job) parts.push(`Job: ${profile.job}`);
      if (profile.school) parts.push(`School: ${profile.school}`);
      if (profile.bio) parts.push(`Bio: ${profile.bio.substring(0, 50)}...`);
      if (profile.interests?.length) parts.push(`Interests: ${profile.interests.length}`);

      // Write BOTH timestamp keys for cross-module compat
      const now = Date.now();
      const platformKey = `lastProfileSync_${isBumble ? 'Bumble' : 'Tinder'}`;
      await chrome.storage.local.set({ lastProfileSync: now, [platformKey]: now });

      const tinderRadio = card.querySelector('input[type="radio"]');
      if (tinderRadio) {
        tinderRadio.checked = true;
        const manualContent = document.getElementById('aboutManualContent');
        if (manualContent) manualContent.classList.remove('active');
      }

      card.classList.add('sync-success');
      setTimeout(() => updateTinderSyncStatus(), 100);
      updateAboutPreview();
      markAsChanged();

      setTimeout(() => {
        card.classList.remove('sync-success');
      }, 2000);

      showMessage(`✓ Profile synced successfully!\n${parts.join('\n')}`, 'success');
    } else {
      statusText.textContent = 'Failed to sync. Click to try again.';
      showMessage('✗ Failed to sync profile: ' + (response?.error || 'Unknown error'), 'error');
    }
  });
}

async function handleAiCardClick(e) {
  const state = await getAgentState();
  if (state.isRunning) {
    showMessage('⚠️ Stop the agent before generating a bio', 'error');
    return;
  }

  const card = document.getElementById('aiGenerateOption');
  const radio = card.querySelector('input[type="radio"]');

  radio.checked = true;
  const manualContent = document.getElementById('aboutManualContent');
  if (manualContent) manualContent.classList.remove('active');
  markAsChanged();

  e.preventDefault();
  await generateBioFromCard();
}

async function generateBioFromCard() {
  const settings = await getSettings();

  // When using backend proxy, we don't need user's API key
  const useBackendProxy = window.API_CONFIG?.USE_BACKEND_PROXY ?? true;

  if (!useBackendProxy && (!settings.apiKey || !settings.apiKey.startsWith('sk-'))) {
    showMessage('⚠️ AI feature unavailable. Please contact support.', 'error');
    return;
  }

  const card = document.getElementById('aiGenerateOption');
  const statusText = document.getElementById('aiGenerateStatus');
  const resultDiv = document.getElementById('bioAiResult');

  card.classList.add('generating');
  statusText.textContent = '✨ AI is crafting your perfect bio...';
  if (resultDiv) resultDiv.classList.remove('show');

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'generateBio',
        userContext: {
          intentions: settings.intentions,
          chattingStyle: settings.chattingStyle
        }
      }, resolve);
    });

    if (response && response.success) {
      card.classList.remove('generating');
      card.classList.add('generated');
      statusText.textContent = '✓ Bio ready! Review and use it below';
      displayBioResult(response.bio, response.score);
      updateAboutPreview();
      showMessage('✓ Bio generated successfully!', 'success');

      setTimeout(() => {
        card.classList.remove('generated');
      }, 2000);
    } else {
      card.classList.remove('generating');
      statusText.textContent = '❌ Generation failed • Click to retry';
      showMessage(`Failed to generate bio: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    card.classList.remove('generating');
    statusText.textContent = '❌ Error occurred • Click to retry';
    showMessage('Error: ' + error.message, 'error');
  }
}

function displayBioResult(bio, score) {
  const resultDiv = document.getElementById('bioAiResult');
  const bioText = document.getElementById('bioGeneratedText');
  const scoreValue = document.getElementById('bioScore');
  const scoreFill = document.getElementById('bioScoreFill');

  bioText.textContent = bio;
  resultDiv.style.display = 'block';
  resultDiv.classList.add('show');

  // Update button text for current platform
  const useBioBtn = document.getElementById('useBioBtn');
  if (useBioBtn) {
    const isBumble = document.getElementById('tinderProfileOption')?.querySelector('.about-option-title')?.textContent.includes('Bumble');
    useBioBtn.innerHTML = useBioBtn.innerHTML.replace(isBumble ? 'Tinder' : 'Bumble', isBumble ? 'Bumble' : 'Tinder');
  }

  let currentScore = 0;
  const targetScore = score || 85;
  const increment = targetScore / 30;

  const scoreInterval = setInterval(() => {
    currentScore += increment;
    if (currentScore >= targetScore) {
      currentScore = targetScore;
      clearInterval(scoreInterval);
    }
    scoreValue.textContent = Math.round(currentScore);
    scoreFill.style.width = `${currentScore}%`;
  }, 20);
}

function updateTinderSyncStatus() {
  const statusText = document.getElementById('tinderSyncStatus');
  if (!statusText) return;

  chrome.storage.local.get('lastProfileSync').then(result => {
    const lastSync = result.lastProfileSync;

    if (!lastSync) {
      statusText.textContent = 'Not synced yet • Click to sync now';
      return;
    }

    const now = Date.now();
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let timeAgo;
    if (diffMins < 1) timeAgo = 'just now';
    else if (diffMins < 60) timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    else if (diffHours < 24) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    statusText.textContent = `Synced ${timeAgo} • Click to re-sync`;
  });
}

async function updateAboutPreview() {
  const preview = document.getElementById('aboutPreview');
  const previewContent = document.getElementById('aboutPreviewContent');
  const selectedSource = document.querySelector('input[name="aboutSource"]:checked')?.value;

  if (!preview || !previewContent) return;

  if (selectedSource === 'tinder') {
    const settings = await getSettings();
    const profile = settings.userProfile;

    if (profile && Object.keys(profile).length > 0) {
      let html = '<div class="preview-header" style="color: var(--primary); font-weight: 600; margin-bottom: 12px; font-size: 13px;">👤 YOUR PROFILE</div>';

      if (profile.name) html += `<div class="preview-item"><span class="preview-label">Name:</span><span class="preview-value">${profile.name}, ${profile.age || ''}</span></div>`;
      if (profile.bio) html += `<div class="preview-item"><span class="preview-label">Bio:</span><span class="preview-value">${profile.bio}</span></div>`;
      if (profile.interests?.length) html += `<div class="preview-item"><span class="preview-label">Interests:</span><span class="preview-value">${profile.interests.join(', ')}</span></div>`;
      if (profile.height) html += `<div class="preview-item"><span class="preview-label">Height:</span><span class="preview-value">${profile.height}</span></div>`;
      if (profile.job) html += `<div class="preview-item"><span class="preview-label">Job:</span><span class="preview-value">${profile.job}</span></div>`;
      if (profile.school) html += `<div class="preview-item"><span class="preview-label">School:</span><span class="preview-value">${profile.school}</span></div>`;
      if (profile.education) html += `<div class="preview-item"><span class="preview-label">Education:</span><span class="preview-value">${profile.education}</span></div>`;
      if (profile.educationLevel) html += `<div class="preview-item"><span class="preview-label">Education Level:</span><span class="preview-value">${profile.educationLevel}</span></div>`;
      if (profile.languages?.length) html += `<div class="preview-item"><span class="preview-label">Languages:</span><span class="preview-value">${Array.isArray(profile.languages) ? profile.languages.join(', ') : profile.languages}</span></div>`;
      if (profile.communicationStyle) html += `<div class="preview-item"><span class="preview-label">Communication:</span><span class="preview-value">${profile.communicationStyle}</span></div>`;
      if (profile.zodiac || profile.starSign) html += `<div class="preview-item"><span class="preview-label">Zodiac:</span><span class="preview-value">${profile.zodiac || profile.starSign}</span></div>`;
      if (profile.workout || profile.exercise) html += `<div class="preview-item"><span class="preview-label">Exercise:</span><span class="preview-value">${profile.workout || profile.exercise}</span></div>`;
      if (profile.drinking) html += `<div class="preview-item"><span class="preview-label">Drinking:</span><span class="preview-value">${profile.drinking}</span></div>`;
      if (profile.smoking) html += `<div class="preview-item"><span class="preview-label">Smoking:</span><span class="preview-value">${profile.smoking}</span></div>`;
      if (profile.religion) html += `<div class="preview-item"><span class="preview-label">Religion:</span><span class="preview-value">${profile.religion}</span></div>`;
      if (profile.politics) html += `<div class="preview-item"><span class="preview-label">Politics:</span><span class="preview-value">${profile.politics}</span></div>`;
      if (profile.kids) html += `<div class="preview-item"><span class="preview-label">Kids:</span><span class="preview-value">${profile.kids}</span></div>`;
      if (profile.sleepingHabits) html += `<div class="preview-item"><span class="preview-label">Sleeping:</span><span class="preview-value">${profile.sleepingHabits}</span></div>`;
      if (profile.userPets) html += `<div class="preview-item"><span class="preview-label">Pets:</span><span class="preview-value">${profile.userPets}</span></div>`;
      if (profile.dietaryPreference) html += `<div class="preview-item"><span class="preview-label">Diet:</span><span class="preview-value">${profile.dietaryPreference}</span></div>`;

      const hasPreferences = profile.lookingFor || profile.interestedIn || profile.distancePreference || profile.preferredLanguages?.length;
      if (hasPreferences) {
        html += '<div class="preview-header" style="color: var(--warning); font-weight: 600; margin-top: 16px; margin-bottom: 12px; font-size: 13px;">⚙️ YOUR PREFERENCES</div>';

        if (profile.lookingFor) html += `<div class="preview-item"><span class="preview-label">Looking for:</span><span class="preview-value">${profile.lookingFor}</span></div>`;
        if (profile.interestedIn) html += `<div class="preview-item"><span class="preview-label">Interested in:</span><span class="preview-value">${profile.interestedIn}</span></div>`;
        if (profile.distancePreference) html += `<div class="preview-item"><span class="preview-label">Distance:</span><span class="preview-value">${profile.distancePreference}</span></div>`;
        if (profile.preferredLanguages?.length) html += `<div class="preview-item"><span class="preview-label">Preferred languages:</span><span class="preview-value">${profile.preferredLanguages.join(', ')}</span></div>`;
      }

      if (html) {
        previewContent.innerHTML = html;
        preview.style.display = 'block';
      } else {
        const platformName = document.getElementById('tinderProfileOption')?.querySelector('.about-option-title')?.textContent.includes('Bumble') ? 'Bumble' : 'Tinder';
        previewContent.innerHTML = `<div class="preview-empty">Profile synced but no displayable data. Add bio, job, or interests in ${platformName}.</div>`;
        preview.style.display = 'block';
      }
    } else {
      previewContent.innerHTML = '<div class="preview-empty">No profile data synced yet. Click the card above to sync.</div>';
      preview.style.display = 'block';
    }
  } else if (selectedSource === 'manual') {
    const manualText = document.getElementById('aboutMyself')?.value.trim();
    if (manualText) {
      previewContent.innerHTML = `<div class="preview-item"><span class="preview-label">Your Bio:</span><span class="preview-value">${manualText}</span></div>`;
      preview.style.display = 'block';
    } else {
      previewContent.innerHTML = '<div class="preview-empty">Type your bio above to see preview</div>';
      preview.style.display = 'block';
    }
  } else if (selectedSource === 'ai') {
    const bioText = document.getElementById('bioGeneratedText')?.textContent;
    if (bioText) {
      previewContent.innerHTML = `<div class="preview-item"><span class="preview-label">AI Bio:</span><span class="preview-value">${bioText}</span></div>`;
      preview.style.display = 'block';
    } else {
      previewContent.innerHTML = '<div class="preview-empty">Click the card above to generate your AI bio</div>';
      preview.style.display = 'block';
    }
  } else {
    preview.style.display = 'none';
  }
}

function initializeBioGenerator() {
  const regenerateBtn = document.getElementById('regenerateBioBtn');
  const copyBtn = document.getElementById('copyBioBtn');
  const useBtn = document.getElementById('useBioBtn');

  if (regenerateBtn) regenerateBtn.addEventListener('click', handleRegenerateBio);
  if (copyBtn) copyBtn.addEventListener('click', handleCopyBio);
  if (useBtn) useBtn.addEventListener('click', handleUseBio);
}

async function handleRegenerateBio() {
  const btn = document.getElementById('regenerateBioBtn');
  const originalHTML = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: syncRotate 1s linear infinite;"><path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 3v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Regenerating...';

  await generateBioFromCard();

  btn.disabled = false;
  btn.innerHTML = originalHTML;
}

function handleCopyBio() {
  const bioText = document.getElementById('bioGeneratedText').textContent;

  navigator.clipboard.writeText(bioText).then(() => {
    const btn = document.getElementById('copyBioBtn');
    const originalHTML = btn.innerHTML;

    btn.classList.add('copied');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Copied!';

    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalHTML;
    }, 2000);

    showMessage('Bio copied to clipboard!', 'success');
  }).catch(() => {
    showMessage('Failed to copy bio', 'error');
  });
}

function handleUseBio() {
  const bioText = document.getElementById('bioGeneratedText').textContent;

  if (!bioText) {
    showMessage('No bio to use. Generate one first!', 'error');
    return;
  }

  const card = document.getElementById('tinderProfileOption');
  const isBumble = card?.querySelector('.about-option-title')?.textContent.includes('Bumble');
  const platformName = isBumble ? 'Bumble' : 'Tinder';

  const modal = document.createElement('div');
  modal.className = 'risk-modal';
  modal.innerHTML = `
    <div class="risk-modal-content" style="max-width: 380px;">
      <div class="risk-modal-icon">⚠️</div>
      <h3>Push Bio to ${platformName}?</h3>
      <div style="margin: 16px 0; padding: 14px; background: var(--bg-secondary); border-radius: 8px; text-align: left;">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">NEW BIO:</div>
        <div style="font-size: 13px; color: var(--text-primary); line-height: 1.6;">${bioText}</div>
      </div>
      <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">This will replace your current ${platformName} bio. You can always change it back manually.</p>
      <div class="risk-modal-buttons">
        <button class="risk-btn risk-btn-cancel">Cancel</button>
        <button class="risk-btn risk-btn-confirm">Yes, Push to ${platformName}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.risk-btn-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('.risk-btn-confirm').addEventListener('click', async () => {
    modal.remove();
    await pushBioToPlatform(bioText, isBumble);
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function pushBioToPlatform(bioText, isBumble) {
  const btn = document.getElementById('useBioBtn');
  const originalHTML = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: syncRotate 1s linear infinite;"><path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 3v5h-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Pushing...';

  try {
    const action = isBumble ? 'pushBioToBumble' : 'pushBioToTinder';
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: action, bio: bioText }, resolve);
    });

    if (response && response.success) {
      btn.classList.add('success');
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Bio Pushed!';

      setTimeout(() => {
        btn.classList.remove('success');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }, 2000);

      const platformName = isBumble ? 'Bumble' : 'Tinder';
      showMessage(`✓ Bio successfully pushed to your ${platformName} profile!`, 'success');
    } else {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      showMessage(`Failed: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
    showMessage('Error: ' + error.message, 'error');
  }
}

function updateAboutSectionState(isRunning) {
  const tinderCard = document.getElementById('tinderProfileOption');
  const aiCard = document.getElementById('aiGenerateOption');

  if (isRunning) {
    if (tinderCard) tinderCard.style.opacity = '0.5';
    if (aiCard) aiCard.style.opacity = '0.5';
  } else {
    if (tinderCard) tinderCard.style.opacity = '';
    if (aiCard) aiCard.style.opacity = '';
  }
}
