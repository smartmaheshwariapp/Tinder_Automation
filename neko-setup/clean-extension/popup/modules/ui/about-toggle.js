function initializeAboutYouToggle() {
  const toggle = document.getElementById('customizeAbout');
  const defaultDisplay = document.getElementById('aboutDefaultDisplay');
  const customEditor = document.getElementById('aboutCustomEditor');

  if (toggle && defaultDisplay && customEditor) {
    toggle.addEventListener('change', () => {
      if (toggle.checked) {
        defaultDisplay.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
        defaultDisplay.style.opacity = '0';
        defaultDisplay.style.maxHeight = '0';
        setTimeout(() => {
          defaultDisplay.style.display = 'none';
          customEditor.style.display = 'block';
          customEditor.style.opacity = '0';
          customEditor.style.maxHeight = '0';
          setTimeout(() => {
            customEditor.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
            customEditor.style.opacity = '1';
            customEditor.style.maxHeight = customEditor.scrollHeight + 'px';
          }, 10);
        }, 300);
      } else {
        customEditor.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
        customEditor.style.opacity = '0';
        customEditor.style.maxHeight = '0';
        setTimeout(() => {
          customEditor.style.display = 'none';
          defaultDisplay.style.display = 'block';
          defaultDisplay.style.opacity = '0';
          defaultDisplay.style.maxHeight = '0';
          setTimeout(() => {
            defaultDisplay.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
            defaultDisplay.style.opacity = '1';
            defaultDisplay.style.maxHeight = defaultDisplay.scrollHeight + 'px';
          }, 10);
        }, 300);
      }
      markAsChanged();
    });
  }
}
