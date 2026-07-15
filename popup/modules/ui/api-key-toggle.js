// API key visibility toggle
function initializeApiKeyToggle() {
  const toggleBtn = document.getElementById('toggleApiKey');
  const apiKeyInput = document.getElementById('apiKey');
  
  if (!toggleBtn || !apiKeyInput) {
    console.log('API key toggle elements not found');
    return;
  }

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const eyeIcon = toggleBtn.querySelector('.eye-icon');
    
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>';
    } else {
      apiKeyInput.type = 'password';
      eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3" stroke="currentColor" fill="none" stroke-width="2"></circle>';
    }
  });
}

function handleToggleApiKey() {
  const input = document.getElementById('apiKeyInput');
  const eyeIcon = document.querySelector('.eye-icon');

  if (input.type === 'password') {
    input.type = 'text';
    eyeIcon.textContent = '👁️🗨️';
  } else {
    input.type = 'password';
    eyeIcon.textContent = '👁️';
  }
}

function handleApiKeyInput(e) {
  const input = e.target;
  const value = input.value.trim();

  if (value.length === 0) {
    input.classList.remove('valid', 'invalid');
    updateApiKeyStatus('');
    return;
  }

  if (validateApiKeyFormat(value)) {
    input.classList.remove('invalid');
    input.classList.add('valid');
  } else {
    input.classList.remove('valid');
    input.classList.add('invalid');
  }
}

async function testApiKeyWithOpenAI(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.status === 401) {
      return { success: false, error: 'Invalid API key - authentication failed' };
    }

    if (response.status === 403) {
      return { success: false, error: 'API key does not have required permissions' };
    }

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Network error' };
  }
}

function updateApiKeyStatus(status) {
  const statusEl = document.getElementById('apiKeyStatus');
  statusEl.className = 'api-key-status';

  if (status === 'valid') {
    statusEl.classList.add('valid');
    statusEl.textContent = 'Valid';
  } else if (status === 'invalid') {
    statusEl.classList.add('invalid');
    statusEl.textContent = 'Invalid';
  }
}
