// 6-Mode System (SMART_DEFAULT_PROMPTS loaded from constants/prompts.js)

function initializeModeTabs() {
  const modeTabs = document.querySelectorAll('.mode-tab');
  const modeContents = document.querySelectorAll('.mode-content');

  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode');
      modeTabs.forEach(t => t.classList.remove('active'));
      modeContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const targetContent = document.querySelector(`.mode-content[data-mode="${mode}"]`);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

function initializeModeToggles() {
  const modes = ['intro', 'followup', 'conversation', 'datesetup', 'moveoffapp', 'exit'];
  modes.forEach(mode => {
    const toggle = document.getElementById(`${mode}UseCustom`);
    const defaultDisplay = document.getElementById(`${mode}DefaultDisplay`);
    const customEditor = document.getElementById(`${mode}CustomEditor`);

    if (toggle && defaultDisplay && customEditor) {
      toggle.addEventListener('change', () => {
        if (toggle.checked) {
          defaultDisplay.style.display = 'none';
          customEditor.style.display = 'block';
        } else {
          defaultDisplay.style.display = 'block';
          customEditor.style.display = 'none';
        }
        markAsChanged();
      });
    }
  });
}

function initializeModeTestButtons() {
  const modes = ['intro', 'followup', 'conversation', 'datesetup', 'moveoffapp', 'exit'];
  modes.forEach(mode => {
    const testBtn = document.getElementById(`${mode}TestBtn`);
    if (testBtn) testBtn.addEventListener('click', () => handleModeTest(mode));
  });
}

function initializePreviewButtons() {
  const modes = ['intro', 'followup', 'conversation', 'datesetup', 'moveoffapp', 'exit'];
  modes.forEach(mode => {
    const previewBtn = document.getElementById(`${mode}PreviewBtn`);
    if (previewBtn) previewBtn.addEventListener('click', () => showDefaultPromptPreview(mode));
  });
}

function handleModeTest(mode) {
  const useCustom = document.getElementById(`${mode}UseCustom`).checked;
  let promptText = useCustom ? document.getElementById(`${mode}Prompt`)?.value.trim() : getSmartDefaultPrompt(mode);

  if (!promptText) {
    showMessage('Please enter a custom prompt first', 'error');
    return;
  }

  const validator = document.getElementById(`${mode}Validator`);
  const scoreEl = document.getElementById(`${mode}Score`);
  const fillEl = document.getElementById(`${mode}Fill`);
  const feedbackEl = document.getElementById(`${mode}Feedback`);
  const testBtn = document.getElementById(`${mode}TestBtn`);

  validator.style.display = 'block';
  scoreEl.textContent = '0%';
  fillEl.style.width = '0%';
  feedbackEl.textContent = 'Analyzing prompt...';
  testBtn.disabled = true;
  testBtn.style.opacity = '0.6';
  testBtn.innerHTML = '<span class="btn-icon">⏳</span>Analyzing...';

  setTimeout(() => {
    const score = calculateHumanLikeScore(promptText, mode);
    let currentScore = 0;
    const increment = score / 30;
    const scoreInterval = setInterval(() => {
      currentScore += increment;
      if (currentScore >= score) {
        currentScore = score;
        clearInterval(scoreInterval);
      }
      scoreEl.textContent = `${Math.round(currentScore)}%`;
      fillEl.style.width = `${currentScore}%`;
    }, 20);

    setTimeout(() => {
      let feedback = score >= 85 ? '✓ Excellent! Your prompt encourages natural, human-like conversations.' :
                     score >= 70 ? '✓ Good! Your prompt has most key elements for human-like messaging.' :
                     score >= 50 ? '⚠ Decent, but could be improved. Add more guidelines for natural conversation flow and variety.' :
                     score >= 30 ? '⚠ Needs work. Include instructions for short messages, casual tone, contractions, and varied responses.' :
                     '✗ Poor. Your prompt lacks key elements for human-like conversations. Add guidelines for brevity, natural tone, and authenticity.';
      feedbackEl.textContent = feedback;
      testBtn.disabled = false;
      testBtn.style.opacity = '1';
      testBtn.innerHTML = '<span class="btn-icon">🧪</span>Test This Mode';
    }, 700);
  }, 500);
}

function getSmartDefaultPrompt(mode) {
  return SMART_DEFAULT_PROMPTS[mode] || '';
}

async function showDefaultPromptPreview(mode) {
  const settings = await getSettings();
  let defaultPrompt = getSmartDefaultPrompt(mode);

  const styleMap = { freestyle: 'casual and spontaneous', serious: 'thoughtful and genuine', gentle: 'kind and considerate', flirty: 'playful and charming', confident: 'bold and self-assured', playful: 'fun and lighthearted', witty: 'clever and quick-witted', charming: 'warm and naturally charming', bold: 'direct and unapologetically bold', romantic: 'romantic and emotionally expressive' };
  const intentionsMap = { long_term: 'a serious relationship', short_term: 'casual dating', just_fun: 'fun and lighthearted connections', casual_connection: 'casual connections without pressure', meaningful_conversations: 'meaningful conversations and genuine connection', open_to_anything: 'whatever feels right', lets_see: 'something real, wherever it leads' };

  const style = styleMap[settings.chattingStyle || 'freestyle'];
  const intention = intentionsMap[settings.intentions || 'short_term'];
  const platform = window.CURRENT_PLATFORM || 'Tinder';
  const lang = settings.conversationLanguage || 'en';
  const slang = (typeof LANGUAGE_SLANG_GUIDE !== 'undefined') ? (LANGUAGE_SLANG_GUIDE[lang] || LANGUAGE_SLANG_GUIDE.default) : 'Keep it casual.';

  const userGender = settings.userProfile?.gender || 'male';
  const genderCtx = `CONTEXT: You are a ${userGender} sender messaging a match. Use appropriate gendered grammar.`;

  defaultPrompt = defaultPrompt
    .replace(/{{Chatting style}}/g, style)
    .replace(/{{My intention}}/g, intention)
    .replace(/{{Platform}}/g, platform)
    .replace(/{{Gender context}}/g, genderCtx)
    .replace(/{{Slang guidance}}/g, slang);

  const modeNames = { intro: 'Intro / Opener', followup: 'Follow-Up', conversation: 'Conversation', datesetup: 'Date Setup', moveoffapp: 'Move Off-App', exit: 'Exit / Polite Close' };

  const modal = document.createElement('div');
  modal.className = 'risk-modal';
  modal.innerHTML = `
    <div class="risk-modal-content" style="max-width: 500px;">
      <div class="risk-modal-icon">👁</div>
      <h3>${modeNames[mode]} - Smart Default</h3>
      <div style="margin: 20px 0; padding: 16px; background: var(--bg-secondary); border-radius: 8px; text-align: left;">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600;">ACTIVE PROMPT:</div>
        <div style="font-size: 13px; color: var(--text-primary); line-height: 1.6;">${defaultPrompt}</div>
      </div>
      <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 16px;">Adapts to your Basic personality and Language settings.</p>
      <div class="risk-modal-buttons">
        <button class="risk-btn risk-btn-confirm" style="flex: 1;">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('.risk-btn-confirm').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function initializeMasterToggle() {
  const masterToggle = document.getElementById('enable6ModeSystem');
  const modeSectionContent = document.getElementById('modeSectionContent');
  const promptPreviewContent = document.getElementById('promptPreviewSectionContent');
  const generatedPromptDisplay = document.getElementById('generatedPromptDisplay');

  if (masterToggle && modeSectionContent) {
    masterToggle.addEventListener('change', () => {
      const modeSectionHeader = document.getElementById('modeSectionHeader');
      const promptPreviewSection = document.getElementById('promptPreviewSectionHeader');
      const modeHint = document.getElementById('promptPreview6ModeHint');

      if (masterToggle.checked) {
        if (modeSectionHeader) modeSectionHeader.style.opacity = '1';
        modeSectionContent.style.opacity = '1';
        modeSectionContent.style.pointerEvents = 'auto';
        modeSectionContent.style.filter = 'none';

        if (promptPreviewSection) promptPreviewSection.style.opacity = '0.7';
        if (modeHint) modeHint.style.display = 'block';
        if (promptPreviewContent) {
          promptPreviewContent.style.opacity = '0.7';
          promptPreviewContent.style.pointerEvents = 'none';
        }
        if (generatedPromptDisplay) {
          generatedPromptDisplay.style.opacity = '0.7';
          generatedPromptDisplay.style.filter = 'blur(1.5px)';
        }
      } else {
        if (modeSectionHeader) modeSectionHeader.style.opacity = '0.5';
        modeSectionContent.style.opacity = '0.5';
        modeSectionContent.style.pointerEvents = 'none';
        modeSectionContent.style.filter = 'grayscale(0.5)';

        if (promptPreviewSection) promptPreviewSection.style.opacity = '1';
        if (modeHint) modeHint.style.display = 'none';
        if (promptPreviewContent) {
          promptPreviewContent.style.opacity = '1';
          promptPreviewContent.style.pointerEvents = 'auto';
        }
        if (generatedPromptDisplay) {
          generatedPromptDisplay.style.opacity = '1';
          generatedPromptDisplay.style.filter = 'none';
        }
      }
      markAsChanged();
    });
  }
}

function calculateHumanLikeScore(prompt, mode = null) {
  let score = 0;
  const lower = prompt.toLowerCase();
  const length = prompt.length;

  const actionWords = ['write', 'respond', 'reply', 'ask', 'say', 'send', 'create', 'generate', 'make', 'use', 'be', 'sound', 'act', 'talk', 'message', 'text'];
  if (actionWords.some(word => lower.includes(word))) score += 20;

  if (length >= 50 && length <= 500) score += 20;
  else if (length >= 30 && length < 50) score += 10;
  else if (length > 500 && length <= 800) score += 10;

  const toneWords = ['casual', 'formal', 'friendly', 'flirty', 'funny', 'playful', 'professional', 'natural', 'conversational', 'relaxed', 'chill', 'warm', 'confident', 'humorous', 'witty', 'charming', 'authentic', 'genuine', 'lighthearted', 'easygoing'];
  if (toneWords.some(word => lower.includes(word))) score += 20;

  const contextWords = ['profile', 'bio', 'conversation', 'chat', 'match', 'their', 'they', 'about', 'based on', 'reference', 'mention', 'relate', 'connect', 'previous', 'earlier', 'topic'];
  if (contextWords.some(word => lower.includes(word))) score += 20;

  const constraintWords = ['short', 'brief', 'long', 'sentence', 'word', 'line', 'keep', 'avoid', 'don\'t', 'never', 'always', 'must', 'should', 'limit', 'max', 'under', 'less than', 'more than', 'between'];
  if (constraintWords.some(word => lower.includes(word))) score += 20;

  if (length < 20) score -= 30;
  if (length > 1000) score -= 20;

  const wordCount = prompt.trim().split(/\s+/).length;
  if (wordCount < 3) score -= 20;

  return Math.max(0, Math.min(score, 100));
}
