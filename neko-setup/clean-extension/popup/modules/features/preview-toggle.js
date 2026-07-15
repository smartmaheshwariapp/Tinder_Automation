// Preview toggle functionality
function initializePreviewToggle() {
  const previewToggle = document.getElementById('previewToggle');
  if (!previewToggle) return;

  previewToggle.addEventListener('change', (e) => {
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
      previewSection.style.display = e.target.checked ? 'block' : 'none';
    }
  });
}
