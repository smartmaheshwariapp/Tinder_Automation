/**
 * Header UI Views Module
 * Encapsulates the HTML templates for the Premium Header and Account Dropdown
 */

const HeaderViews = {
  /**
   * Returns the main Header Action Row template
   */
  getHeaderActionsTemplate() {
    return `
      <div class="header-actions-premium">
        <!-- Go Premium Button -->
        <button id="headerGoPremiumBtn" class="btn-go-premium">
          <svg class="btn-sparkle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gpSparkleGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#9d2383"></stop>
                <stop offset="100%" stop-color="#de4cb0"></stop>
              </linearGradient>
            </defs>
            <path stroke="url(#gpSparkleGradMain)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"></path>
          </svg>
          <span class="btn-text">Go Premium</span>
        </button>

        <!-- Notifications -->
        <button id="calendarEventsBtn" class="header-icon-tile" title="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span id="calendarEventsBadge" class="header-badge" hidden>0</span>
        </button>

        <!-- Account / Settings Toggle -->
        <button id="accountBtn" class="header-icon-tile account-toggle-btn" title="My Account">
          <svg class="account-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="account-initial" style="display: none;"></span>
        </button>
      </div>

      <!-- Account Dropdown Menu -->
      <div id="accountDropdown" class="account-dropdown-panel" style="display: none;">
        <div class="dropdown-overlay" id="dropdownOverlay"></div>
        <div class="dropdown-content">
          <!-- Profile Section (Image 3/4 Style) -->
          <div class="dropdown-profile-card">
            <div class="profile-avatar-wrapper">
              <div class="profile-avatar-ring"></div>
              <div class="profile-avatar-core">
                <span id="dropdownProfileInitial">F</span>
              </div>
            </div>
            <div class="profile-info-stack">
              <span id="dropdownUserName" class="profile-name">Guest Mode</span>
              <div id="dropdownPlanContainer" class="profile-plan-container">
                <!-- Injected by HeaderManager: Button or Plan Text -->
              </div>
            </div>
          </div>

          <div class="dropdown-divider"></div>

          <!-- Menu Options -->
          <div class="dropdown-menu-list">
            <button id="dropdownAiMessagesBtn" class="dropdown-item dropdown-item-static" tabindex="-1" aria-disabled="true">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-10 7L2 7"/>
                </svg>
              </div>
              <span class="item-text">AI Messages <span class="item-meta-usage" id="dropdownAiMessagesMeta">(0 left)</span></span>
            </button>

            <button id="dropdownSwipesBtn" class="dropdown-item dropdown-item-static" tabindex="-1" aria-disabled="true">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M7 11V5a2 2 0 0 1 4 0v6" />
                  <path d="M11 11V4a2 2 0 1 1 4 0v7" />
                  <path d="M15 11V6a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-1.5A7.5 7.5 0 0 1 4 12.5V11h3" />
                </svg>
              </div>
              <span class="item-text">Swipes <span class="item-meta-usage" id="dropdownSwipesMeta">(0 left)</span></span>
            </button>

            <button id="dropdownAccountSettings" class="dropdown-item">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 3.5l2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.8 6.8 19.2l1-5.7-4.1-4 5.7-.8L12 3.5z" />
                </svg>
              </div>
              <span class="item-text">Manage plan</span>
            </button>

            <!-- Achievements (Moved here from header) -->
            <button id="achievementsBtn" class="dropdown-item" style="display:none;">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 15c3.314 0 6-2.686 6-6V4H6v5c0 3.314 2.686 6 6 6z" />
                  <path d="M18 6h1.5a2.5 2.5 0 010 5H18M6 6H4.5a2.5 2.5 0 000 5H6" />
                  <path d="M12 15v4m-4 2h8" />
                </svg>
              </div>
              <span class="item-text">Achievements</span>
              <span id="achievementsNotifBadge" class="item-badge" style="display: none;">0</span>
            </button>

            <button id="dropdownContactBtn" class="dropdown-item">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <path d="M8 10h8"/>
                  <path d="M8 14h5"/>
                </svg>
              </div>
              <span class="item-text">Contact us</span>
            </button>

            <button id="dropdownFeatureRequestBtn" class="dropdown-item">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/>
                  <path d="m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95"/>
                  <path d="m2 15 6 6"/>
                  <path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91"/>
                </svg>
              </div>
              <span class="item-text">Feature request</span>
            </button>

            <button id="dropdownCommunityBtn" class="dropdown-item dropdown-community-item">
              <div class="item-icon community-icon-wrap">
                <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.121 1.523 5.854L.057 23.215a.75.75 0 0 0 .921.921l5.361-1.466A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.512-5.228-1.404l-.375-.217-3.882 1.062 1.062-3.882-.217-.375A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
              </div>
              <span class="item-text">Join Community <span class="community-free-badge">1 Month Free</span></span>
            </button>

            <div class="dropdown-divider"></div>

            <button id="signOutBtn" class="dropdown-item logout-item">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <span class="item-text">Logout</span>
            </button>

            <!-- Sign In (Only for Guests) -->
            <button id="dropdownSignInBtn" class="dropdown-item">
              <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                </svg>
              </div>
              <span class="item-text">Sign Up / Login</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
};

window.HeaderViews = HeaderViews;
