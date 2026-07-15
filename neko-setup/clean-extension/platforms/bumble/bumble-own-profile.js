
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getBumbleOwnProfile() {
    console.log('[Bumble] Starting Final Sequential Sync...');

    const onEditProfile = window.location.href.includes('/app/edit-profile');
    const hasOverlay = () => !!document.querySelector('.date-profile, [class*="date-profile"], .encounters-album');

    if (!onEditProfile) {
        // Not on edit-profile at all — navigate there fresh
        console.log('[Bumble] Navigating to edit-profile...');
        window.location.href = 'https://bumble.com/app/edit-profile';
        await wait(3500);
    } else if (hasOverlay()) {
        // Already on edit-profile but a dialog/overlay is blocking — dismiss it
        console.log('[Bumble] Dismissing overlay on edit-profile...');
        const closeBtn = document.querySelector(
            '[data-qa-role="date-profile-close"], .date-profile__close, ' +
            '[aria-label="Close"], button.close, [class*="close-btn"]'
        );
        if (closeBtn) {
            closeBtn.click();
        } else {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
        await wait(1000);
    }

    // Wait for headers to appear (increased patience for slow loads)
    console.log('[Bumble] Waiting for profile components to render...');
    const headerSelectors = '.settings-section__header, section h2, section h3, .profile-edit__section-header, [class*="accordion__title"], [class*="section-header"]';
    let attempts = 0;
    while (attempts < 30) { // 30 * 500ms = 15s wait
        if (document.querySelectorAll(headerSelectors).length > 0) break;
        await wait(500);
        attempts++;
    }

    const result = { platform: 'bumble' };
    const getAllHeaders = () => Array.from(document.querySelectorAll(headerSelectors));
    const findHeader = (text) => getAllHeaders().find(h => {
        const hText = h.innerText || h.textContent || '';
        return hText.toLowerCase().includes(text.toLowerCase());
    });

    // A. Internal Helper to open a section and wait
    const openSection = async (title) => {
        const h = findHeader(title);
        if (h) {
            h.scrollIntoView({ block: 'center' });
            
            // Find the clickable container (Bumble moved the click event listener sometimes)
            const clickable = h.closest('button, [role="button"], .settings-section, section') || h;
            
            const isClosed = clickable.querySelector('[data-qa-icon-name="generic-chevron-down"], [class*="chevron-down"]') || 
                             clickable.getAttribute('aria-expanded') === 'false';
                             
            if (isClosed) {
                console.log(`[Bumble] Opening ${title}...`);
                h.click(); // Standard click target is usually the header
                await wait(1500); // Wait for open animation
            }
            return true;
        }
        console.warn(`[Bumble] Could not find header for: ${title}`);
        return false;
    };

    // B. Internal Helper to find a value by label
    const getBasicsVal = (label) => {
        const cell = Array.from(document.querySelectorAll('.settings-cell, .settings-fieldset__field, li, .profile-detail, [class*="cell"]'))
            .find(c => (c.innerText || '').includes(label));
        return cell?.querySelector('.settings-cell__value, .text-color-gray-dark, span.value, [class*="value"]')?.innerText || '';
    };

    // 2. Sequential Extraction
    // Name (Always visible)
    result.name = document.querySelector('.sidebar-profile__name .header-2, .sidebar-profile__info .header-2, h1.name, [class*="name"]')?.innerText || '';

    // Step 1: Bio
    if (await openSection('About')) {
        result.bio = document.querySelector('textarea.textarea__input, textarea[name="about"]')?.value || '';
    }

    // Step 2: Work & Education
    if (await openSection('Work')) {
        result.job = document.querySelector('[data-qa-role="settings-occupation-entry-0-title"], input[name="job"]')?.innerText || '';
        result.school = document.querySelector('[data-qa-role="settings-education-entry-0-title"], input[name="school"]')?.innerText || '';
    }

    // Step 3: Basics (All fields)
    if (await openSection('Basics')) {
        result.height = getBasicsVal('Height');
        result.exercise = getBasicsVal('Exercise');
        result.educationLevel = getBasicsVal('Education level');
        result.drinking = getBasicsVal('Drinking');
        result.smoking = getBasicsVal('Smoking');
        result.lookingFor = getBasicsVal('Looking for');
        result.kids = getBasicsVal('Kids');
        result.starSign = getBasicsVal('Star sign');
        result.politics = getBasicsVal('Politics');
        result.religion = getBasicsVal('Religion');
        result.city = getBasicsVal('Living in');
        result.gender = getBasicsVal('Gender');
        // Bumble renders gender as a radio group under "Your gender" heading, not a settings-cell.
        // Each option is a [data-qa-role="settings-cell-gender-entry"] with a radio
        // [data-qa-role="radio"] whose data-qa-state="true" marks the selected one.
        if (!result.gender) {
            const fieldset = document.querySelector('[data-qa-role="gender-fieldset-title"]')?.closest('.settings-fieldset');
            const selected = fieldset?.querySelector('[data-qa-role="settings-cell-gender-entry"]:has([data-qa-role="radio"][data-qa-state="true"])');
            result.gender = selected?.innerText?.trim() || '';
        }
    }

    // Filter trash/placeholders
    const isTrash = (t) => !t || t.toLowerCase().includes('add a') || t.toLowerCase().includes('your job') || t.toLowerCase().includes('institution');
    if (isTrash(result.job)) result.job = '';
    if (isTrash(result.school)) result.school = '';

    console.log('[Bumble] FINAL SYNC SUCCESS:', result);
    return result;
}

async function pushBioToBumble(newBio) {
    console.log('[Bumble] Starting visual bio push sequence...');
    try {
        // 1. Wait for page to be ready
        let headers = [];
        const headerSelectors = '.settings-section__header, section h2, section h3, .profile-edit__section-header, [class*="accordion__title"], [class*="section-header"]';
        
        for (let i = 0; i < 15; i++) {
            headers = Array.from(document.querySelectorAll(headerSelectors));
            if (headers.length > 0) break;
            await wait(500);
        }

        // 2. Find and open the 'About' section
        const aboutHeader = headers.find(h => {
             const hText = h.innerText || h.textContent || '';
             return hText.toLowerCase().includes('about');
        });
        if (aboutHeader) {
            // Scroll it to center so user sees it
            aboutHeader.scrollIntoView({ block: 'center', behavior: 'smooth' });
            await wait(800);

            // Force open if closed
            const clickable = aboutHeader.closest('button, [role="button"], .settings-section, section') || aboutHeader;
            const isClosed = clickable.querySelector('[data-qa-icon-name="generic-chevron-down"], [class*="chevron-down"]') || 
                             clickable.getAttribute('aria-expanded') === 'false';
                             
            if (isClosed) {
                console.log('[Bumble] Section closed, opening...');
                aboutHeader.click();
                await wait(1500);
            }
        }

        let ta = document.querySelector('textarea.textarea__input');
        if (ta) {
            console.log('[Bumble] Found textarea, activating field...');

            // 3. Physically click the box to trigger Bumble's 'Save' button visibility
            ta.scrollIntoView({ block: 'center' });
            ta.click();
            ta.focus();
            await wait(600);

            // Clear
            ta.select();
            document.execCommand('delete');
            ta.value = '';
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await wait(300);

            // 4. Visual typing simulation
            console.log('[Bumble] Typing...');
            for (let i = 0; i < newBio.length; i++) {
                document.execCommand('insertText', false, newBio[i]);
                await wait(12);
            }

            // 5. THE "MAGIC" REVEAL: Use Debugger API for a trusted click
            // Users report that standard clicks aren't enough to show the Save button
            console.log('[Bumble] Typing complete, performing TRUSTED click to reveal Save...');
            const rect = ta.getBoundingClientRect();
            const centerX = Math.round(rect.left + rect.width / 2);
            const centerY = Math.round(rect.top + rect.height / 2);

            try {
                // Call background script which uses chrome.debugger
                await new Promise(resolve => {
                    chrome.runtime.sendMessage({
                        action: 'simulateMouseClick',
                        x: centerX,
                        y: centerY
                    }, resolve);
                });
            } catch (e) {
                console.warn('[Bumble] Debugger click failed, falling back to standard click');
                ta.click();
            }

            await wait(800);
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
            await wait(800);

            // 6. Find the Save button with persistence (Bumble UI can be slow)
            const findSaveBtnPersistent = async () => {
                console.log('[Bumble] Searching for Save button...');
                for (let i = 0; i < 10; i++) {
                    // Method A: Specific data-qa-role
                    let btn = document.querySelector('[data-qa-role="profile-edit-about-save"]');

                    // Method B: Text search fallback
                    if (!btn) {
                        btn = Array.from(document.querySelectorAll('button, .button'))
                            .find(b => (b.innerText || '').includes('Save') && b.offsetParent !== null);
                    }

                    if (btn && btn.offsetParent !== null) {
                        return btn;
                    }

                    await wait(300);
                }
                return null;
            };

            const saveBtn = await findSaveBtnPersistent();

            if (saveBtn) {
                console.log('[Bumble] Clicking Save button:', saveBtn);
                saveBtn.click();
                await wait(1500);
                return { success: true };
            } else {
                console.warn('[Bumble] Save button not found after retries.');
                ta.blur();
                return { success: true, message: 'Bio typed! Please click Save manually.' };
            }
        }
        return { success: false, error: 'About Me text area not found' };
    } catch (e) {
        console.error('[Bumble] Visual push failed:', e);
        return { success: false, error: e.message };
    }
}

if (typeof window !== 'undefined') {
    window.getBumbleOwnProfile = getBumbleOwnProfile;
    window.pushBioToBumble = pushBioToBumble;
}
