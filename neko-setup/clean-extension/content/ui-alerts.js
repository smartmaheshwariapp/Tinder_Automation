/**
 * UI Alerts Module - Production Grade
 * Handles "Time to Shine" (Handoff) Takeover Toasts
 */

// Re-entry guard: prevent crashes from double content-script injection
if (typeof UIAlerts !== 'undefined') { /* Already loaded */ } else {

window.UIAlerts = {
    injectStyles() {
        if (document.getElementById('flirteasy-alerts-style')) return;

        const style = document.createElement('style');
        style.id = 'flirteasy-alerts-style';
        style.textContent = `
            .fe-alerts-wrapper {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
                width: 100%;
                max-width: 400px;
                align-items: center;
            }
            .fe-toast-item {
                pointer-events: auto;
                transform: translateY(-20px);
                opacity: 0;
                transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                width: fit-content;
            }
            .fe-toast-item.show {
                transform: translateY(0);
                opacity: 1;
            }
            .fe-toast-content {
                background: rgba(13, 15, 24, 0.9);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(251, 191, 36, 0.3);
                border-radius: 16px;
                padding: 12px 20px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(251, 191, 36, 0.1);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                min-width: 280px;
            }
            .fe-toast-icon {
                font-size: 20px;
                background: rgba(251, 191, 36, 0.1);
                width: 36px;
                height: 36px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fbbf24;
            }
            .fe-toast-text {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .fe-toast-title {
                font-weight: 800;
                font-size: 13px;
                color: #fbbf24;
                letter-spacing: 0.02em;
            }
            .fe-toast-detail {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 500;
            }
            .fe-toast-close {
                margin-left: auto;
                cursor: pointer;
                opacity: 0.5;
                transition: opacity 0.2s;
                font-size: 18px;
                padding: 4px;
            }
            .fe-toast-close:hover { opacity: 1; }
            
            @keyframes fe-shine {
                0% { border-color: rgba(251, 191, 36, 0.3); box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
                50% { border-color: rgba(251, 191, 36, 0.6); box-shadow: 0 10px 40px rgba(0,0,0,0.5), 0 0 30px rgba(251, 191, 36, 0.2); }
                100% { border-color: rgba(251, 191, 36, 0.3); box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
            }
            .fe-toast-content.vip { animation: fe-shine 2s infinite; }
        `;
        document.head.appendChild(style);
    },

    getWrapper() {
        let wrapper = document.querySelector('.fe-alerts-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'fe-alerts-wrapper';
            document.body.appendChild(wrapper);
        }
        return wrapper;
    },

    showHandoff(matchName, reason) {
        // Disabled - status bar v2 handles all lead/handoff notifications
        return;
    }
};

window.UIAlerts = UIAlerts;

} // end re-entry guard
