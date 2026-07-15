/**
 * Auth UI Views Module
 * Encapsulates the HTML templates for the different auth screens
 */

const AuthViews = {
  /**
   * Returns the Gateway (Initial) screen template
   */
  getGatewayTemplate() {
    return `
      <div id="authGatewayView" class="auth-view active">
        <div class="auth-gateway-branding">
          <img src="../icons/icon_128.png" alt="Logo" class="auth-gateway-logo">
          <img src="../icons/Text_logo.png" alt="FlirtEasy" class="auth-gateway-text-logo">
          <p class="auth-gateway-subtitle">Your Personal AI Wingman</p>
        </div>
        
        <button id="gatewaySignupBtn" class="auth-modern-btn auth-btn-magenta">Sign Up</button>
        
        <div class="auth-switch-footer" style="margin-top: 12px; font-size: 13px; color: #64748B;">
          Already have an account? <a href="#" id="gatewaySigninBtn" class="auth-switch-link">Sign In</a>
        </div>
        
        <div class="auth-terms-text">
          By Continuing you agree to our 
          <a href="https://flirteasy.io/TermsOfService" target="_blank" style="color: #64748B; text-decoration: underline;">Terms & Policy</a>
        </div>
      </div>
    `;
  },

  /**
   * Returns the Login form template
   */
  getLoginTemplate() {
    return `
      <div id="authLoginView" class="auth-view hidden-right">
        <button id="authBackBtn" class="auth-back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </button>
        
        <div class="auth-back-divider"></div>

        <div class="auth-header">
          <h1 class="auth-title">Welcome Back</h1>
        </div>

        <div class="auth-input-group">
          <label class="auth-label">Email Address</label>
          <input type="email" id="signinEmail" class="auth-input-modern" placeholder="alex.kof@gmail.com">
        </div>

        <div class="auth-input-group">
          <label class="auth-label">Password</label>
          <div style="position: relative; width: 100%;">
            <input type="password" id="signinPassword" class="auth-input-modern" placeholder="Enter your password">
            <button type="button" class="password-toggle" data-target="signinPassword" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; color: #94A3B8;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
                <line class="eye-slash" x1="1" y1="1" x2="23" y2="23" style="opacity: 1;"></line>
              </svg>
            </button>
          </div>
        </div>

        <a href="#" class="auth-forgot-link">Forgot Password?</a>

        <button id="signinBtn" class="auth-modern-btn auth-btn-magenta">Log In</button>

        <div class="auth-divider-modern">
          <span>Or</span>
        </div>

        <div class="auth-switch-footer">
          Don't have an account? <a href="#" id="authSignupLink" class="auth-switch-link">Sign Up</a>
        </div>
      </div>
    `;
  }
};

window.AuthViews = AuthViews;
