// Custom select dropdowns
function initializeCustomSelects() {
  const selects = document.querySelectorAll('.custom-select');

  selects.forEach(select => {
    const trigger = select.querySelector('.custom-select-trigger');
    const options = select.querySelectorAll('.custom-select-option');
    const optionsEl = select.querySelector('.custom-select-options');
    select._optionsEl = optionsEl;
    const isVariableDropdown = select.id === 'promptVariablesSelect' || select.id === 'aboutVariablesSelect' || select.classList.contains('mode-variables-select');

    function positionPortal() {
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const FLIP_THRESHOLD = 130;

      optionsEl.style.position = 'fixed';
      optionsEl.style.left = rect.left + 'px';
      optionsEl.style.width = rect.width + 'px';
      optionsEl.style.zIndex = '999999';

      const openUpward = spaceBelow < FLIP_THRESHOLD && spaceAbove > spaceBelow;

      if (openUpward) {
        optionsEl.style.bottom = (window.innerHeight - rect.top) + 'px';
        optionsEl.style.top = 'auto';
        optionsEl.style.maxHeight = Math.min(300, spaceAbove - 8) + 'px';
        optionsEl.style.borderRadius = '12px 12px 0 0';
        optionsEl.style.borderBottom = 'none';
        optionsEl.style.borderTop = '1.5px solid rgba(99, 102, 241, 0.3)';
      } else {
        optionsEl.style.top = rect.bottom + 'px';
        optionsEl.style.bottom = 'auto';
        optionsEl.style.maxHeight = Math.min(300, Math.max(spaceBelow - 8, 80)) + 'px';
        optionsEl.style.borderRadius = '0 0 12px 12px';
        optionsEl.style.borderTop = 'none';
        optionsEl.style.borderBottom = '1.5px solid rgba(99, 102, 241, 0.3)';
      }
    }

    function openPortal() {
      if (optionsEl._closeTimer) {
        clearTimeout(optionsEl._closeTimer);
        optionsEl._closeTimer = null;
        reattachPortal();
      }

      optionsEl._portalParent = optionsEl.parentElement;

      optionsEl.style.opacity = '0';
      optionsEl.style.transform = 'translateY(-6px)';
      optionsEl.style.transition = 'none';

      document.body.appendChild(optionsEl);
      positionPortal();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          optionsEl.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
          optionsEl.style.opacity = '1';
          optionsEl.style.transform = 'translateY(0)';
        });
      });
    }

    function reattachPortal() {
      if (optionsEl._portalParent && optionsEl.parentElement === document.body) {
        optionsEl._portalParent.appendChild(optionsEl);
        optionsEl._portalParent = null;
      }
      optionsEl.style.cssText = '';
    }

    function closePortal() {
      if (optionsEl._portalParent && optionsEl.parentElement === document.body) {
        if (optionsEl._closeTimer) clearTimeout(optionsEl._closeTimer);
        optionsEl.style.transition = 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
        optionsEl.style.opacity = '0';
        optionsEl.style.transform = 'translateY(-6px)';
        optionsEl._closeTimer = setTimeout(() => {
          optionsEl._closeTimer = null;
          reattachPortal();
        }, 210);
      }
    }

    select._closePortal = closePortal;
    select._reattachPortal = reattachPortal;

    function closeThis() {
      select.classList.remove('open');
      closePortal();
    }

    function onTabScroll() {
      if (select.classList.contains('open')) {
        closeThis();
      }
    }

    const tabContent = select.closest('.tab-content');
    if (tabContent) {
      tabContent.addEventListener('scroll', onTabScroll, { passive: true });
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();

      document.querySelectorAll('.custom-select').forEach(s => {
        if (s !== select && s.classList.contains('open')) {
          s.classList.remove('open');
          if (s._closePortal) s._closePortal();
        }
      });

      const isOpening = !select.classList.contains('open');
      select.classList.toggle('open');

      if (isOpening) {
        openPortal();
      } else {
        closePortal();
      }
    });

    options.forEach(option => {
      option.addEventListener('click', () => {
        const value = option.getAttribute('data-value');
        const text = option.textContent;

        if (isVariableDropdown) {
          insertVariableIntoTextarea(select, value);
        } else {
          updateSelectValue(select, option, value, text);
          markAsChanged();
        }

        closeThis();
      });
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select').forEach(s => {
      if (s.classList.contains('open')) {
        s.classList.remove('open');
        if (s._closePortal) s._closePortal();
      }
    });
  });
}

function insertVariableIntoTextarea(select, value) {
  let textareaId;
  if (select.id === 'promptVariablesSelect') {
    textareaId = 'customPrompt';
  } else if (select.id === 'aboutVariablesSelect') {
    textareaId = 'aboutMyself';
  } else {
    const mode = select.id.replace('VariablesSelect', '');
    textareaId = `${mode}Prompt`;
  }

  const textarea = document.getElementById(textareaId);
  if (textarea) {
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    textarea.value = textBefore + value + textAfter;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = cursorPos + value.length;
    markAsChanged();
  }
}

function updateSelectValue(select, option, value, text) {
  const container = option.closest('.custom-select-options') || select;
  container.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
  option.classList.add('selected');
  select.querySelector('.custom-select-value').textContent = text;
  select.setAttribute('data-value', value);
}

function setCustomSelectValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const option = select.querySelector(`.custom-select-option[data-value="${value}"]`);
  if (option) {
    select.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
    select.querySelector('.custom-select-value').textContent = option.textContent;
    select.setAttribute('data-value', value);
  }
}

function getCustomSelectValue(selectId) {
  const select = document.getElementById(selectId);
  return select ? select.getAttribute('data-value') : null;
}
