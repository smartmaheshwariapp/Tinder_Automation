/* ================================================================
   Step 1 — Meet Your Co-pilot
   Introduces the 3 core features of FlirtEasy
   ================================================================ */

const StepWelcome = {

  render(container) {
    container.innerHTML = `
      <h1 class="ob-step-title ob-stagger-item">Meet your AI-Wingman</h1>

      <p class="ob-step-subtitle ob-stagger-item">
        FlirtEasy automates the repetitive stuff so you can focus on real connections.
      </p>

      <div class="ob-modern-feature-list ob-stagger-item">
        <div class="ob-modern-feature-item">
          <div class="ob-modern-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor" shape-rendering="geometricPrecision">
              <path d="M256,56a12,12,0,0,1-12,12H201l11.51,11.51a12,12,0,1,1-17,17l-32-32a12,12,0,0,1,0-17l32-32a12,12,0,1,1,17,17L201,44h43A12,12,0,0,1,256,56Zm-68,60a31.86,31.86,0,0,0-11.22,2A32,32,0,0,0,140,101V76a32,32,0,0,0-64,0v66.83A32,32,0,0,0,24.28,180l.12.2,25.31,42A12,12,0,0,0,70.27,209.8L45,167.92A8,8,0,0,1,58.92,160l.21.34,18.68,30A12,12,0,0,0,100,184V76a8,8,0,0,1,16,0v68a12,12,0,0,0,24,0V132a8,8,0,0,1,16,0v20a12,12,0,0,0,24,0v-4a8,8,0,0,1,16,0v36c0,11.08-1.28,21.67-3.42,28.32a12,12,0,1,0,22.84,7.36c3-9.16,4.58-21.83,4.58-35.68V148A32,32,0,0,0,188,116Z"></path>
            </svg>
          </div>
          <div class="ob-modern-content">
            <h3 class="ob-modern-title">Smart auto-swiping</h3>
            <p class="ob-modern-desc">Finding matches while you sleep.</p>
          </div>
        </div>

        <div class="ob-modern-feature-item">
          <div class="ob-modern-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor" shape-rendering="geometricPrecision">
              <path d="M120,128a16,16,0,1,1-16-16A16,16,0,0,1,120,128Zm32-16a16,16,0,1,0,16,16A16,16,0,0,0,152,112Zm84,16A108,108,0,0,1,78.77,224.15L46.34,235A20,20,0,0,1,21,209.66l10.81-32.43A108,108,0,1,1,236,128Zm-24,0A84,84,0,1,0,55.27,170.06a12,12,0,0,1,1,9.81l-9.93,29.79,29.79-9.93a12.1,12.1,0,0,1,3.8-.62,12,12,0,0,1,6,1.62A84,84,0,0,0,212,128Z"></path>
            </svg>
          </div>
          <div class="ob-modern-content">
            <h3 class="ob-modern-title">AI-written messages</h3>
            <p class="ob-modern-desc">The perfect icebreaker, every time.</p>
          </div>
        </div>

        <div class="ob-modern-feature-item">
          <div class="ob-modern-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor" shape-rendering="geometricPrecision">
              <path d="M229.26,90.4a108,108,0,0,1-177.63,114A108,108,0,0,1,195.41,43.63l20.1-20.11a12,12,0,0,1,17,17l-96,96a12,12,0,1,1-17-17l24-24a36,36,0,1,0,19.76,39.65,12,12,0,0,1,23.53,4.74,60,60,0,1,1-25.73-62L178.3,60.74a84,84,0,1,0,28.46,38,12,12,0,1,1,22.5-8.35Z"></path>
            </svg>
          </div>
          <div class="ob-modern-content">
            <h3 class="ob-modern-title">Goal focused conversations</h3>
            <p class="ob-modern-desc">Moving from chat to a real date.</p>
          </div>
        </div>

        <div class="ob-modern-feature-item">
          <div class="ob-modern-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" fill="currentColor" shape-rendering="geometricPrecision">
              <path d="M208,36H48A20,20,0,0,0,28,56v56c0,54.29,26.32,87.22,48.4,105.29,23.71,19.39,47.44,26,48.44,26.29a12.1,12.1,0,0,0,6.32,0c1-.28,24.73-6.9,48.44-26.29,22.08-18.07,48.4-51,48.4-105.29V56A20,20,0,0,0,208,36Zm-4,76c0,35.71-13.09,64.69-38.91,86.15A126.28,126.28,0,0,1,128,219.38a126.14,126.14,0,0,1-37.09-21.23C65.09,176.69,52,147.71,52,112V60H204ZM79.51,144.49a12,12,0,1,1,17-17L112,143l47.51-47.52a12,12,0,0,1,17,17l-56,56a12,12,0,0,1-17,0Z"></path>
            </svg>
          </div>
          <div class="ob-modern-content">
            <h3 class="ob-modern-title">Advanced safety protocols</h3>
            <p class="ob-modern-desc">Human-like behavior to keep you safe.</p>
          </div>
        </div>
      </div>






    `;
  },

  onEnter(container) {
    const items = container.querySelectorAll('.ob-stagger-item');
    items.forEach((item, index) => {
      item.classList.remove('visible');
      setTimeout(() => {
        item.classList.add('visible');
      }, 100 + (index * 90));
    });

    // Bind Magnetic 3D Cursor Tracking for Logo
    this._bindMagneticLogo(container);
  },

  _bindMagneticLogo(container) {
    const wrapper = container.querySelector('.ob-step-icon-wrapper');
    const icon = container.querySelector('.ob-step-icon');
    
    if (!wrapper || !icon) return;

    wrapper.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      // Mouse position relative to the center of the icon
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate rotation limits (-18deg to 18deg)
      const rotateX = ((mouseY - centerY) / centerY) * -18; 
      const rotateY = ((mouseX - centerX) / centerX) * 18;
      
      // Apply 3D transform with scale
      icon.style.transform = `translateY(-6px) scale3d(1.08, 1.08, 1.08) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      
      // Reduce transition duration while moving for immediate tracking
      icon.style.transition = 'transform 0.1s linear';
      
      // Dynamically move the drop shadow opposite to the tilt for realism
      const img = icon.querySelector('img');
      if (img) {
        const shadowX = Math.round((mouseX - centerX) / 4) * -1;
        const shadowY = Math.round((mouseY - centerY) / 4) * -1 + 12; // Base 12px down
        img.style.filter = `drop-shadow(${shadowX}px ${shadowY}px 28px rgba(217, 70, 239, 0.40)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.08))`;
      }
    });

    wrapper.addEventListener('mouseleave', () => {
      // Restore spring transition on mouse leave
      icon.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      icon.style.transform = 'translateY(0px) scale3d(1, 1, 1) rotateX(0deg) rotateY(0deg)';
      
      const img = icon.querySelector('img');
      if (img) {
        img.style.filter = ''; // Reset to CSS default
      }
    });
  },

  // No validation needed — user can always proceed
  validate() {
    return true;
  }
};
