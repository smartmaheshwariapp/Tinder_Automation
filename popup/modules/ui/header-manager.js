/**
 * Header Manager
 * Handles interactions and state for the Premium Header
 * Orchestrates the "One by One" modular UI transition.
 */

const HeaderManager = {
    init() {
        console.log('[HeaderManager] Initializing modular header...');
        this.render();
        this.attachListeners();
        
        // Re-initialize legacy modules that depend on header elements
        if (typeof initializeAchievementsModal === 'function') {
            initializeAchievementsModal();
        }
        if (typeof CalendarEvents !== 'undefined' && CalendarEvents.init) {
            CalendarEvents.init();
        }
        
        this.syncDropdownState();
        this._checkCommunityBadge();
    },

    render() {
        const headerActions = document.getElementById('headerActionsContent');
        if (headerActions) {
            // Only inject the header buttons here
            const template = HeaderViews.getHeaderActionsTemplate();
            headerActions.innerHTML = template.split('<!-- Account Dropdown Menu -->')[0];
        }

        // Move Dropdown to Body to avoid clipping/overflow issues in the small popup container
        let dropdown = document.getElementById('accountDropdown');
        if (!dropdown) {
            const template = HeaderViews.getHeaderActionsTemplate();
            const dropdownHTML = template.split('<!-- Account Dropdown Menu -->')[1];
            const div = document.createElement('div');
            div.innerHTML = dropdownHTML.trim();
            dropdown = div.firstElementChild;
            dropdown.style.display = ''; // Clear inline styles since CSS handles it
            document.body.appendChild(dropdown);
        }

        const logoText = document.querySelector('.logo-brand-text');
        if (logoText) {
            logoText.style.filter = 'none';
        }
    },

    attachListeners() {
        const accountBtn = document.getElementById('accountBtn');
        const overlay = document.getElementById('dropdownOverlay');
        const goPremiumBtn = document.getElementById('headerGoPremiumBtn');

        if (accountBtn) {
            // Strip all pre-existing addEventListener listeners (e.g. handleAccountClick
            // in account-system.js) by replacing the node with a clean clone, then
            // bind our single authoritative handler via onclick.
            const freshBtn = accountBtn.cloneNode(true);
            accountBtn.parentNode.replaceChild(freshBtn, accountBtn);
            freshBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleDropdown();
            };
        }

        if (overlay) {
            overlay.addEventListener('click', () => this.closeDropdown());
        }

        if (goPremiumBtn) {
            goPremiumBtn.onclick = () => this.goToPricing();
        }

        // Achievements toggle (Moved to dropdown)
        const achievementsBtn = document.getElementById('achievementsBtn');
        if (achievementsBtn) {
            achievementsBtn.onclick = () => {
                this.closeDropdown();
                // Call global achievement opener
                if (typeof openAchievements === 'function') openAchievements();
                else {
                    // Fallback to searching for the binding in achievements-modal.js if needed
                    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                    achievementsBtn.dispatchEvent(clickEvent);
                }
            };
        }

        const contactBtn = document.getElementById('dropdownContactBtn');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                this.closeDropdown();
                chrome.tabs.create({ url: 'https://flirteasy.io/ContactUs' });
            });
        }

        const featureRequestBtn = document.getElementById('dropdownFeatureRequestBtn');
        if (featureRequestBtn) {
            featureRequestBtn.addEventListener('click', () => {
                this.closeDropdown();
                chrome.tabs.create({ url: 'https://flirteasy.io/ContactUs' });
            });
        }

        const communityBtn = document.getElementById('dropdownCommunityBtn');
        if (communityBtn) {
            communityBtn.addEventListener('click', () => {
                this.closeDropdown();
                this._openCommunityModal();
            });
        }

        // Sign Out handling (Moved to dropdown)
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                this.closeDropdown();
                if (typeof handleSignOut === 'function') {
                    await handleSignOut();
                }
            });
        }
        
        // Account Settings (Image 3 Style)
        const accSettings = document.getElementById('dropdownAccountSettings');
        if (accSettings) {
           accSettings.addEventListener('click', () => {
               this.closeDropdown();
               chrome.tabs.create({ url: 'https://flirteasy.io/Pricing' });
           });
        }
    },

    toggleDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        if (dropdown) {
            const isVisible = dropdown.classList.contains('dropdown-open') || dropdown.style.display === 'block';
            
            if (isVisible) {
                this.closeDropdown();
            } else {
                dropdown.classList.remove('dropdown-closing');
                dropdown.classList.add('dropdown-open');
                dropdown.style.display = ''; // Clear legacy inline style just in case
                this.syncDropdownState();
            }
        }
    },

    closeDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        if (!dropdown || (!dropdown.classList.contains('dropdown-open') && dropdown.style.display !== 'block')) return;
        
        dropdown.classList.add('dropdown-closing');
        setTimeout(() => {
            dropdown.classList.remove('dropdown-open');
            dropdown.classList.remove('dropdown-closing');
            dropdown.style.display = ''; // Clear inline styles
        }, 180);
    },

    _getPlanHTML(status, reason) {
        const sparkle = `<svg class="plan-sparkle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3C10.6 7.3 12.7 9.4 17 10C12.7 10.6 10.6 12.7 10 17C9.4 12.7 7.3 10.6 3 10C7.3 9.4 9.4 7.3 10 3Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 4.5C17.72 6 18.5 6.78 20 7C18.5 7.22 17.72 8 17.5 9.5C17.28 8 16.5 7.22 15 7C16.5 6.78 17.28 6 17.5 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        if (status === 'pro') {
            return `<span class="profile-plan-label plan-pro">${sparkle} Premium Plan</span>`;
        }
        if (status === 'active') {
            return `<span class="profile-plan-label plan-trial">${sparkle} Pro Trial</span>`;
        }
        if (status === 'expired') {
            const label = reason === 'subscription' ? 'Plan Expired' : 'Trial Ended';
            return `<span class="profile-plan-label plan-expired">${label}</span>`;
        }
        return `<span class="profile-plan-label plan-guest">Guest Mode</span>`;
    },

    _getUsageDisplay(trialStatus) {
        if (trialStatus?.status === 'pro') {
            return { messages: '(Unlimited)', swipes: '(Unlimited)' };
        }
        if (trialStatus?.status === 'expired') {
            return { messages: '(Expired)', swipes: '(Expired)' };
        }

        const messagesRemaining = Number.isFinite(trialStatus?.messagesRemaining)
            ? Math.max(0, trialStatus.messagesRemaining) : 0;
        const likesRemaining = Number.isFinite(trialStatus?.likesRemaining)
            ? Math.max(0, trialStatus.likesRemaining) : 0;

        return {
            messages: `(${messagesRemaining} left)`,
            swipes: `(${likesRemaining} left)`
        };
    },

    _syncUsageCounters(trialStatus) {
        const usage = this._getUsageDisplay(trialStatus);
        const aiMeta = document.getElementById('dropdownAiMessagesMeta');
        const swipesMeta = document.getElementById('dropdownSwipesMeta');

        if (aiMeta) aiMeta.textContent = usage.messages;
        if (swipesMeta) swipesMeta.textContent = usage.swipes;
    },

    async syncDropdownState() {
        const userData = await chrome.storage.local.get(['user']);
        const user = userData.user;
        
        let trialStatus = { status: 'guest' };
        if (typeof TrialManager !== 'undefined') {
            trialStatus = await TrialManager.getTrialStatus();
        }

        const isPro = trialStatus.status === 'pro';
        const isTrial = trialStatus.status === 'active';
        const isExpired = trialStatus.status === 'expired';
        const isGuest = !user || (!user.signedIn && !user.token);

        this._syncUsageCounters(trialStatus);

        const nameEl = document.getElementById('dropdownUserName');
        const planContainer = document.getElementById('dropdownPlanContainer');
        const initialEl = document.getElementById('dropdownProfileInitial');
        const accountInitial = document.querySelector('.account-toggle-btn .account-initial');
        const accountIcon = document.querySelector('.account-toggle-btn .account-icon-svg');
        const goBtn = document.getElementById('headerGoPremiumBtn');

        if (!isGuest) {
            const email = user.email || 'User';
            const name = email.split('@')[0];
            const initial = name.charAt(0).toUpperCase();

            if (nameEl) nameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
            if (initialEl) initialEl.textContent = initial;

            if (accountInitial) {
                accountInitial.textContent = initial;
                accountInitial.style.display = 'block';
                accountInitial.style.fontSize = '11px';
                accountInitial.style.fontWeight = '800';
            }
            if (accountIcon) accountIcon.style.display = 'none';

            if (isPro || isTrial) {
                if (planContainer) planContainer.innerHTML = this._getPlanHTML(trialStatus.status, trialStatus.reason);
                if (goBtn) goBtn.style.display = 'none';
            } else if (isExpired) {
                if (planContainer) planContainer.innerHTML = this._getPlanHTML('expired', trialStatus.reason);
                if (goBtn) {
                    goBtn.style.display = 'flex';
                    goBtn.onclick = () => this.goToPricing();
                }
            } else {
                if (goBtn) {
                    goBtn.style.display = 'flex';
                    goBtn.onclick = () => this.goToPricing();
                }
                if (planContainer) {
                    planContainer.innerHTML = '<button class="dropdown-plan-btn" id="dropdownPremiumBtn"><svg class="btn-sparkle-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gpSparkleGradDropdown" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9d2383"></stop><stop offset="100%" stop-color="#de4cb0"></stop></linearGradient></defs><path stroke="url(#gpSparkleGradDropdown)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09l2.846.813-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"></path></svg><span>Go Premium</span></button>';
                    const dBtn = document.getElementById('dropdownPremiumBtn');
                    if (dBtn) dBtn.onclick = () => this.goToPricing();
                }
            }

            const accSettings = document.getElementById('dropdownAccountSettings');
            const signOutBtn = document.getElementById('signOutBtn');
            const signInBtn = document.getElementById('dropdownSignInBtn');
            const bottomDivider = document.querySelectorAll('.dropdown-divider')[1];

            if (accSettings) accSettings.style.display = 'flex';
            if (signOutBtn) signOutBtn.style.display = 'flex';
            if (signInBtn) signInBtn.style.display = 'none';
            if (bottomDivider) bottomDivider.style.display = 'block';
        } else {
            if (nameEl) nameEl.textContent = 'Guest';
            if (planContainer) planContainer.innerHTML = this._getPlanHTML('guest');
            if (initialEl) initialEl.textContent = 'G';

            if (accountInitial) accountInitial.style.display = 'none';
            if (accountIcon) accountIcon.style.display = 'block';
            if (goBtn) goBtn.style.display = 'flex';

            const accSettings = document.getElementById('dropdownAccountSettings');
            const signOutBtn = document.getElementById('signOutBtn');
            const signInBtn = document.getElementById('dropdownSignInBtn');
            const bottomDivider = document.querySelectorAll('.dropdown-divider')[1];

            if (accSettings) accSettings.style.display = 'none';
            if (signOutBtn) signOutBtn.style.display = 'none';
            if (signInBtn) {
                signInBtn.style.display = 'flex';
                signInBtn.onclick = () => {
                    this.closeDropdown();
                    if (typeof openAuthModal === 'function') openAuthModal();
                };
            }
            if (bottomDivider) bottomDivider.style.display = 'block';
        }
    },

    async _checkCommunityBadge() {
        try {
            const resp = await chrome.runtime.sendMessage({ action: 'getCommunityCode' });
            if (resp && resp.claimed) {
                const badge = document.querySelector('.community-free-badge');
                if (badge) badge.style.display = 'none';
            }
        } catch (_) {}
    },

    async _openCommunityModal() {
        const modal = document.getElementById('communityModal');
        const codeEl = document.getElementById('communityCode');
        const copyBtn = document.getElementById('communityCopyBtn');
        const joinBtn = document.getElementById('communityJoinBtn');
        const closeBtn = document.getElementById('communityModalClose');
        const overlay = document.getElementById('communityModalOverlay');
        const claimedBanner = document.getElementById('communityClaimedBanner');
        const stepsEl = document.getElementById('communitySteps');
        const codeRow = codeEl ? codeEl.closest('.community-code-row') : null;
        if (!modal || !codeEl) return;

        // Reset copy button text from any prior open
        if (copyBtn) copyBtn.textContent = 'Copy';

        // Fetch code data BEFORE opening modal to avoid flash of wrong state
        let resp = null;
        try {
            resp = await chrome.runtime.sendMessage({ action: 'getCommunityCode' });
        } catch (_) {}

        // Set up correct initial state based on fetched data, then open
        if (!resp || resp.success === false) {
            codeEl.textContent = resp?.error === 'Not signed in' ? 'Sign in first' : 'Error — retry';
            if (codeRow) codeRow.style.display = '';
            if (copyBtn) copyBtn.style.display = 'none';
            if (claimedBanner) claimedBanner.style.display = 'none';
            if (stepsEl) stepsEl.style.display = 'flex';
        } else if (resp.claimed) {
            if (codeRow) codeRow.style.display = 'none';
            if (copyBtn) copyBtn.style.display = 'none';
            if (stepsEl) stepsEl.style.display = 'none';
            if (claimedBanner) {
                const claimedDate = resp.claimedAt
                    ? new Date(resp.claimedAt).toLocaleDateString()
                    : '';
                claimedBanner.textContent = `✓ Code redeemed${claimedDate ? ' on ' + claimedDate : ''} — enjoy your free month!`;
                claimedBanner.style.display = 'block';
            }
            const badge = document.querySelector('.community-free-badge');
            if (badge) badge.style.display = 'none';
        } else {
            codeEl.textContent = resp.code;
            if (codeRow) codeRow.style.display = '';
            if (copyBtn) copyBtn.style.display = 'inline-block';
            if (claimedBanner) claimedBanner.style.display = 'none';
            if (stepsEl) stepsEl.style.display = 'flex';
        }

        modal.classList.add('active');

        const close = () => modal.classList.remove('active');
        if (closeBtn) closeBtn.onclick = close;
        if (overlay) overlay.onclick = close;

        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(codeEl.textContent).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
                });
            };
        }

        if (joinBtn) {
            joinBtn.onclick = () => {
                chrome.tabs.create({ url: 'https://chat.whatsapp.com/E3Pi0wBW0BZGWmiebu79U4' });
            };
        }
    },

    goToPricing() {
        chrome.tabs.create({ url: 'https://flirteasy.io/Pricing' });
    }
};

window.HeaderManager = HeaderManager;
