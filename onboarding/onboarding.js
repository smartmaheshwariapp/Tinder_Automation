/* ================================================================
   FlirtEasy Onboarding — Main Controller
   Manages step navigation, progress, transitions, and lifecycle
   ================================================================ */

class OnboardingController {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 6;
    this.isAnimating = false;

    // User selections (in-memory only — visual redesign, no persistence yet)
    this.selections = {
      platform: null,
      location: { country: '', city: '', languages: [] },
      goals: [],
      limits: {
        dailySwipes: 50,
        messagesPerSession: 15,
        safeMode: true
      }
    };

    // Step module registry (populated after DOM scripts load)
    this.stepModules = {
      1: StepWelcome,
      2: StepPlatform,
      3: StepLocation,
      4: StepGoals,
      5: StepLimits,
      6: StepComplete
    };

    // Cached DOM references
    this.dom = {};
  }


  /* -------- Initialization -------- */

  init() {
    this.cacheDom();
    this.renderStep(1);
    this.updateProgress();
    this.updateNavigation();
    this.bindEvents();

    // Start Intro Sequence
    this.handleIntroSequence();

    // Trigger entrance animation for Step 1
    requestAnimationFrame(() => {
      const container = document.getElementById('step-1');
      if (this.stepModules[1].onEnter) {
        this.stepModules[1].onEnter(container, this);
      }
    });
  }

  handleIntroSequence() {
    const splash = document.getElementById('obSplash');
    const app = document.getElementById('onboardingApp');
    const overlay = document.getElementById('obRevealOverlay');

    if (!splash || !app || !overlay) return;

    // Cinematic delay: Even snappier for "Modern" feel
    setTimeout(() => {
      // 1. Fire the wave reveal overlay
      overlay.classList.add('active');

      // 2. Fade out splash screen
      setTimeout(() => {
        splash.classList.add('dismissed');

        // 3. Smoothly reveal (unblur) the page + Fade wave
        setTimeout(() => {
          app.classList.remove('blurred');
          overlay.classList.add('fade-out'); // Start fading the wave as page reveals

          // 4. Final Cleanup
          setTimeout(() => {
            overlay.style.display = 'none';
            splash.style.display = 'none';
          }, 800);
        }, 150);
      }, 350);
    }, 1200);
  }

  cacheDom() {
    this.dom.progressFill = document.getElementById('obProgressFill');
    this.dom.backBtn = document.getElementById('obBackBtn');
    this.dom.stepCounter = document.getElementById('obStepCounter');
    this.dom.stepsViewport = document.getElementById('obStepsViewport');
    this.dom.backBtnBottom = document.getElementById('obBackBtnBottom');
    this.dom.continueBtn = document.getElementById('obContinueBtn');
    this.dom.continueBtnText = document.getElementById('obContinueBtnText');
    this.dom.continueArrow = this.dom.continueBtn.querySelector('.ob-continue-arrow');
    this.dom.splash = document.getElementById('obSplash');
    this.dom.revealOverlay = document.getElementById('obRevealOverlay');
    this.dom.app = document.getElementById('onboardingApp');
  }

  bindEvents() {
    this.dom.backBtn.addEventListener('click', () => this.back());
    this.dom.backBtnBottom.addEventListener('click', () => this.back());
    this.dom.continueBtn.addEventListener('click', () => this.next());

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (this.isAnimating) return;
      if (e.key === 'Enter') this.next();
      if (e.key === 'Backspace' && this.currentStep > 1) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        this.back();
      }
    });
  }


  /* -------- Step Rendering -------- */

  renderStep(stepNum) {
    const container = document.getElementById(`step-${stepNum}`);

    if (container.hasAttribute('data-rendered')) return;

    const module = this.stepModules[stepNum];
    if (module && module.render) {
      module.render(container, this);
      container.setAttribute('data-rendered', 'true');
    }
  }


  /* -------- Navigation -------- */

  next() {
    if (this.isAnimating) return;
    if (this.dom.continueBtn.disabled) return;

    // Validate current step before advancing
    const currentModule = this.stepModules[this.currentStep];
    if (currentModule.validate && !currentModule.validate(this)) {
      this.shakeButton();
      return;
    }

    if (this.currentStep >= this.totalSteps) {
      this.complete();
      return;
    }

    this.goToStep(this.currentStep + 1, 'forward');
  }

  back() {
    if (this.isAnimating) return;
    if (this.currentStep <= 1) return;

    this.goToStep(this.currentStep - 1, 'back');
  }

  goToStep(stepNum, direction) {
    if (this.isAnimating) return;
    if (stepNum < 1 || stepNum > this.totalSteps) return;
    if (stepNum === this.currentStep) return;

    this.isAnimating = true;

    const currentContainer = document.getElementById(`step-${this.currentStep}`);
    const nextContainer = document.getElementById(`step-${stepNum}`);

    // Pre-render next step if not already done
    this.renderStep(stepNum);

    // Determine animation classes
    const outClass = direction === 'forward' ? 'slide-out-left' : 'slide-out-right';
    const inClass = direction === 'forward' ? 'slide-in-right' : 'slide-in-left';

    // Begin exit animation
    currentContainer.classList.remove('active');
    currentContainer.classList.add(outClass);

    // Begin entrance animation
    nextContainer.classList.add(inClass, 'active');
    nextContainer.style.pointerEvents = 'none'; // Prevent interaction during animation

    // Update state
    const previousStep = this.currentStep;
    this.currentStep = stepNum;
    this.updateProgress();
    this.updateNavigation();

    // Cleanup after transition completes
    const transitionDuration = 420; // matches CSS transition: 0.4s + small buffer
    setTimeout(() => {
      // Clean up old step
      currentContainer.classList.remove(outClass, 'active');
      currentContainer.style.pointerEvents = '';

      // Clean up new step
      nextContainer.classList.remove(inClass);
      nextContainer.style.pointerEvents = '';

      // Reset scroll position
      nextContainer.scrollTop = 0;

      this.isAnimating = false;

      // Fire onEnter lifecycle hook
      const module = this.stepModules[stepNum];
      if (module && module.onEnter) {
        module.onEnter(nextContainer, this);
      }
    }, transitionDuration);
  }


  /* -------- Completion -------- */

  complete() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // Map onboarding goal IDs to settings stopConditions format
      const GOAL_MAP = { date: 'date', phone: 'phone', social: 'instagram' };
      const rawGoals = this.selections.goals || [];
      const stopConditions = rawGoals.includes('never_stop')
        ? []
        : rawGoals.map(g => GOAL_MAP[g] || g).filter(Boolean);

      // Merge into existing userSettings so we don't overwrite other fields
      chrome.storage.local.get('userSettings', (data) => {
        const existing = data.userSettings || {};
        const loc = this.selections.location || {};
        const merged = {
          ...existing,
          stopConditions,
          ...(this.selections.style       ? { chattingStyle: this.selections.style }                         : {}),
          ...(this.selections.limits?.frequency ? { scheduleInterval: this.selections.limits.frequency }     : {}),
          ...(loc.country    ? { nativeCountry: loc.country }       : {}),
          ...(loc.city       ? { nativeCity: loc.city }             : {}),
          ...(loc.languages?.length ? { nativeLanguages: loc.languages } : {}),
          ...(loc.whatsappFull ? { whatsappNumber: loc.whatsappFull } : loc.whatsapp ? { whatsappNumber: loc.whatsapp } : {})
        };
        chrome.storage.local.set({
          userSettings: merged,
          safetyMode: this.selections.limits?.safeMode !== false,
          onboardingComplete: true,
          hasSeenOnboarding: true
        }, () => {
          window.location.href = '../popup/popup.html';
        });
      });
    } else {
      console.log('[Onboarding] Complete! Selections:', this.selections);
      alert('Onboarding complete! In production, this closes the tab.');
    }
  }


  /* -------- UI Updates -------- */

  updateProgress() {
    const progress = (this.currentStep / this.totalSteps) * 100;
    this.dom.progressFill.style.width = `${progress}%`;
    this.dom.stepCounter.textContent = `${this.currentStep} of ${this.totalSteps}`;
  }

  updateNavigation() {
    // Back button visibility
    if (this.currentStep === 1) {
      this.dom.backBtn.classList.add('hidden');
      this.dom.backBtnBottom.classList.add('hidden');
    } else {
      this.dom.backBtn.classList.remove('hidden');
      this.dom.backBtnBottom.classList.remove('hidden');
    }

    // Continue button text
    if (this.currentStep === this.totalSteps) {
      this.dom.continueBtnText.textContent = 'Ready!';
      this.dom.continueArrow.style.display = 'none';
    } else {
      this.dom.continueBtnText.textContent = 'Continue';
      this.dom.continueArrow.style.display = '';
    }

    // Continue button enabled/disabled state
    this.updateContinueState();
  }

  updateContinueState() {
    const currentModule = this.stepModules[this.currentStep];
    if (currentModule && currentModule.validate) {
      this.dom.continueBtn.disabled = !currentModule.validate(this);
    } else {
      this.dom.continueBtn.disabled = false;
    }
  }

  shakeButton() {
    this.dom.continueBtn.style.animation = 'none';
    this.dom.continueBtn.offsetHeight; // Force reflow
    this.dom.continueBtn.style.animation = 'selectionPop 0.3s var(--ob-spring)';
  }
}


/* -------- Bootstrap -------- */
document.addEventListener('DOMContentLoaded', () => {
  window.onboardingApp = new OnboardingController();
  window.onboardingApp.init();
});
