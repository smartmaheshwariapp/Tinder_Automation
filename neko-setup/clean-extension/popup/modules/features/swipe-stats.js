// Swipeable Stats Navigation
async function initializeSwipeStats() {
  const wrapper = document.querySelector('.swipeable-wrapper');
  const container = document.getElementById('statsSwipeContainer');
  const dots = document.querySelectorAll('.swipe-dot');
  const toggleOptions = document.querySelectorAll('.stats-toggle-option');
  if (!wrapper || !container) return;

  const storage = await chrome.storage.local.get('hasLearnedSwipe');
  if (!storage.hasLearnedSwipe) {
    const hint = document.createElement('div');
    hint.id = 'swipeHint';
    hint.className = 'swipe-hint';
    hint.innerHTML = `
      <div class="swipe-hint-hand">👆</div>
      <div class="swipe-hint-text">Swipe for more stats</div>
    `;
    wrapper.appendChild(hint);
  }

  let currentIndex = 0;
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let isScrolling = false;
  let startTime = 0;

  function updateSlide(index) {
    currentIndex = index;
    container.style.transition = 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)';
    container.style.transform = `translateX(-${index * 50}%)`;
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
    toggleOptions.forEach((opt, i) => {
      opt.classList.toggle('active', i === index);
    });

    // Update Slider Handle Position
    const toggleContainer = document.querySelector('.stats-timeline-container');
    if (toggleContainer) {
      toggleContainer.setAttribute('data-active-index', index);
    }

    if (index === 1) {
      chrome.storage.local.set({ hasLearnedSwipe: true });
    }
  }

  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(dot.getAttribute('data-index'));
      updateSlide(index);
    });
  });

  toggleOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(opt.getAttribute('data-target'));
      updateSlide(index);
    });
  });

  function dragStart(e) {
    const hint = document.getElementById('swipeHint');
    if (hint) hint.remove();

    isDragging = true;
    isScrolling = false;
    startTime = Date.now();
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    container.style.transition = 'none';
  }

  function dragMove(e) {
    if (!isDragging || isScrolling) return;

    const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const y = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    const diffX = x - startX;
    const diffY = y - startY;

    if (!isScrolling && Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
      isScrolling = true;
      isDragging = false;
      updateSlide(currentIndex);
      return;
    }

    if (Math.abs(diffX) > 5) {
      if (e.cancelable) e.preventDefault();
      const walkPercent = (diffX / wrapper.clientWidth) * 50;
      const baseTranslate = -currentIndex * 50;
      container.style.transform = `translateX(${baseTranslate + walkPercent}%)`;
    }
  }

  function dragEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    const endX = e.type.includes('touch') ? e.changedTouches[0].clientX : e.clientX;
    const diffX = endX - startX;
    const time = Date.now() - startTime;

    if (Math.abs(diffX) > 80 || (Math.abs(diffX) > 30 && time < 250)) {
      if (diffX < 0 && currentIndex < 1) {
        updateSlide(1);
      } else if (diffX > 0 && currentIndex > 0) {
        updateSlide(0);
      } else {
        updateSlide(currentIndex);
      }
    } else {
      updateSlide(currentIndex);
    }
  }

  container.addEventListener('touchstart', dragStart, { passive: true });
  container.addEventListener('touchmove', dragMove, { passive: false });
  container.addEventListener('touchend', dragEnd, { passive: true });

  container.addEventListener('mousedown', dragStart);
  window.addEventListener('mousemove', dragMove);
  window.addEventListener('mouseup', dragEnd);

  container.querySelectorAll('img').forEach(img => {
    img.addEventListener('dragstart', (e) => e.preventDefault());
  });

  container.style.cursor = 'grab';
}
