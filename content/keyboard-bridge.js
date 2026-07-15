// Generic Keyboard Bridge for Neko Mobile Soft Keyboard
(function() {
  console.log('[Keyboard Bridge] Initialized.');

  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true' || target.getAttribute('role') === 'textbox')) {
      console.log('[Keyboard Bridge] Input focused. Sending OPEN trigger...');
      
      navigator.clipboard.writeText('FE_KEYBOARD_TRIGGER_OPEN').catch(err => {
        // Fallback for older contexts
        const tempEl = document.createElement('textarea');
        tempEl.value = 'FE_KEYBOARD_TRIGGER_OPEN';
        document.body.appendChild(tempEl);
        tempEl.select();
        document.execCommand('copy');
        document.body.removeChild(tempEl);
      });
    }
  });

  document.addEventListener('focusout', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true' || target.getAttribute('role') === 'textbox')) {
      console.log('[Keyboard Bridge] Input blurred. Sending CLOSE trigger...');
      
      navigator.clipboard.writeText('FE_KEYBOARD_TRIGGER_CLOSE').catch(err => {
        // Fallback for older contexts
        const tempEl = document.createElement('textarea');
        tempEl.value = 'FE_KEYBOARD_TRIGGER_CLOSE';
        document.body.appendChild(tempEl);
        tempEl.select();
        document.execCommand('copy');
        document.body.removeChild(tempEl);
      });
    }
  });
})();
