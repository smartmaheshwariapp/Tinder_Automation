function initializeRunBtnCarousel() {
  const btn = document.getElementById('runNowBtn');
  if (!btn) return;
  
  const slides = btn.querySelectorAll('.btn-slide');
  const dots = btn.querySelectorAll('.btn-carousel-indicators .dot');
  let currentSlide = 0;
  let interval;

  function showSlide(index) {
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    slides[index].classList.add('active');
    dots[index].classList.add('active');
    currentSlide = index;
  }

  function startRotation() {
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      const next = (currentSlide + 1) % slides.length;
      showSlide(next);
    }, 4000);
  }

  function stopRotation() {
    if (interval) clearInterval(interval);
  }

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      showSlide(idx);
      startRotation();
    });
  });

  startRotation();
}
