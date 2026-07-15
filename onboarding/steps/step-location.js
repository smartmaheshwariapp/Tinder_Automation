/* ================================================================
   Step 3 — About You
   Country, native languages, and WhatsApp number
   ================================================================ */

const StepLocation = {

  _LANGUAGES: [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
    'Russian', 'Arabic', 'Hindi', 'Chinese', 'Japanese', 'Korean',
    'Turkish', 'Dutch', 'Polish', 'Swedish', 'Ukrainian', 'Hebrew',
    'Persian', 'Romanian', 'Greek', 'Czech', 'Hungarian', 'Thai',
  ],

  // len: [min, max] local digits (excluding dial code)
  _DIAL_CODES: [
    { code: 'AF', dial: '+93',  name: 'Afghanistan',            len: [9,  9]  },
    { code: 'AL', dial: '+355', name: 'Albania',                len: [9,  9]  },
    { code: 'DZ', dial: '+213', name: 'Algeria',                len: [9,  9]  },
    { code: 'AR', dial: '+54',  name: 'Argentina',              len: [10, 10] },
    { code: 'AM', dial: '+374', name: 'Armenia',                len: [8,  8]  },
    { code: 'AU', dial: '+61',  name: 'Australia',              len: [9,  9]  },
    { code: 'AT', dial: '+43',  name: 'Austria',                len: [10, 11] },
    { code: 'AZ', dial: '+994', name: 'Azerbaijan',             len: [9,  9]  },
    { code: 'BD', dial: '+880', name: 'Bangladesh',             len: [10, 10] },
    { code: 'BY', dial: '+375', name: 'Belarus',                len: [9,  9]  },
    { code: 'BE', dial: '+32',  name: 'Belgium',                len: [9,  9]  },
    { code: 'BO', dial: '+591', name: 'Bolivia',                len: [8,  8]  },
    { code: 'BA', dial: '+387', name: 'Bosnia and Herzegovina', len: [8,  8]  },
    { code: 'BR', dial: '+55',  name: 'Brazil',                 len: [10, 11] },
    { code: 'BG', dial: '+359', name: 'Bulgaria',               len: [9,  9]  },
    { code: 'KH', dial: '+855', name: 'Cambodia',               len: [8,  9]  },
    { code: 'CA', dial: '+1',   name: 'Canada',                 len: [10, 10] },
    { code: 'CL', dial: '+56',  name: 'Chile',                  len: [9,  9]  },
    { code: 'CN', dial: '+86',  name: 'China',                  len: [11, 11] },
    { code: 'CO', dial: '+57',  name: 'Colombia',               len: [10, 10] },
    { code: 'HR', dial: '+385', name: 'Croatia',                len: [8,  9]  },
    { code: 'CZ', dial: '+420', name: 'Czech Republic',         len: [9,  9]  },
    { code: 'DK', dial: '+45',  name: 'Denmark',                len: [8,  8]  },
    { code: 'EC', dial: '+593', name: 'Ecuador',                len: [9,  9]  },
    { code: 'EG', dial: '+20',  name: 'Egypt',                  len: [10, 10] },
    { code: 'EE', dial: '+372', name: 'Estonia',                len: [7,  8]  },
    { code: 'ET', dial: '+251', name: 'Ethiopia',               len: [9,  9]  },
    { code: 'FI', dial: '+358', name: 'Finland',                len: [9,  10] },
    { code: 'FR', dial: '+33',  name: 'France',                 len: [9,  9]  },
    { code: 'GE', dial: '+995', name: 'Georgia',                len: [9,  9]  },
    { code: 'DE', dial: '+49',  name: 'Germany',                len: [10, 11] },
    { code: 'GH', dial: '+233', name: 'Ghana',                  len: [9,  9]  },
    { code: 'GR', dial: '+30',  name: 'Greece',                 len: [10, 10] },
    { code: 'GT', dial: '+502', name: 'Guatemala',              len: [8,  8]  },
    { code: 'HU', dial: '+36',  name: 'Hungary',                len: [9,  9]  },
    { code: 'IN', dial: '+91',  name: 'India',                  len: [10, 10] },
    { code: 'ID', dial: '+62',  name: 'Indonesia',              len: [9,  12] },
    { code: 'IR', dial: '+98',  name: 'Iran',                   len: [10, 10] },
    { code: 'IQ', dial: '+964', name: 'Iraq',                   len: [10, 10] },
    { code: 'IE', dial: '+353', name: 'Ireland',                len: [9,  9]  },
    { code: 'IL', dial: '+972', name: 'Israel',                 len: [9,  9]  },
    { code: 'IT', dial: '+39',  name: 'Italy',                  len: [9,  10] },
    { code: 'JP', dial: '+81',  name: 'Japan',                  len: [10, 10] },
    { code: 'JO', dial: '+962', name: 'Jordan',                 len: [9,  9]  },
    { code: 'KZ', dial: '+7',   name: 'Kazakhstan',             len: [10, 10] },
    { code: 'KE', dial: '+254', name: 'Kenya',                  len: [9,  9]  },
    { code: 'XK', dial: '+383', name: 'Kosovo',                 len: [8,  8]  },
    { code: 'KW', dial: '+965', name: 'Kuwait',                 len: [8,  8]  },
    { code: 'LV', dial: '+371', name: 'Latvia',                 len: [8,  8]  },
    { code: 'LB', dial: '+961', name: 'Lebanon',                len: [7,  8]  },
    { code: 'LY', dial: '+218', name: 'Libya',                  len: [9,  9]  },
    { code: 'LT', dial: '+370', name: 'Lithuania',              len: [8,  8]  },
    { code: 'MY', dial: '+60',  name: 'Malaysia',               len: [9,  10] },
    { code: 'MX', dial: '+52',  name: 'Mexico',                 len: [10, 10] },
    { code: 'MD', dial: '+373', name: 'Moldova',                len: [8,  8]  },
    { code: 'MN', dial: '+976', name: 'Mongolia',               len: [8,  8]  },
    { code: 'MA', dial: '+212', name: 'Morocco',                len: [9,  9]  },
    { code: 'NL', dial: '+31',  name: 'Netherlands',            len: [9,  9]  },
    { code: 'NZ', dial: '+64',  name: 'New Zealand',            len: [8,  9]  },
    { code: 'NG', dial: '+234', name: 'Nigeria',                len: [10, 10] },
    { code: 'MK', dial: '+389', name: 'North Macedonia',        len: [8,  8]  },
    { code: 'NO', dial: '+47',  name: 'Norway',                 len: [8,  8]  },
    { code: 'PK', dial: '+92',  name: 'Pakistan',               len: [10, 10] },
    { code: 'PY', dial: '+595', name: 'Paraguay',               len: [9,  9]  },
    { code: 'PE', dial: '+51',  name: 'Peru',                   len: [9,  9]  },
    { code: 'PH', dial: '+63',  name: 'Philippines',            len: [10, 10] },
    { code: 'PL', dial: '+48',  name: 'Poland',                 len: [9,  9]  },
    { code: 'PT', dial: '+351', name: 'Portugal',               len: [9,  9]  },
    { code: 'QA', dial: '+974', name: 'Qatar',                  len: [8,  8]  },
    { code: 'RO', dial: '+40',  name: 'Romania',                len: [9,  9]  },
    { code: 'RU', dial: '+7',   name: 'Russia',                 len: [10, 10] },
    { code: 'SA', dial: '+966', name: 'Saudi Arabia',           len: [9,  9]  },
    { code: 'RS', dial: '+381', name: 'Serbia',                 len: [8,  9]  },
    { code: 'SK', dial: '+421', name: 'Slovakia',               len: [9,  9]  },
    { code: 'SI', dial: '+386', name: 'Slovenia',               len: [8,  8]  },
    { code: 'ZA', dial: '+27',  name: 'South Africa',           len: [9,  9]  },
    { code: 'KR', dial: '+82',  name: 'South Korea',            len: [9,  10] },
    { code: 'ES', dial: '+34',  name: 'Spain',                  len: [9,  9]  },
    { code: 'LK', dial: '+94',  name: 'Sri Lanka',              len: [9,  9]  },
    { code: 'SE', dial: '+46',  name: 'Sweden',                 len: [9,  9]  },
    { code: 'CH', dial: '+41',  name: 'Switzerland',            len: [9,  9]  },
    { code: 'SY', dial: '+963', name: 'Syria',                  len: [9,  9]  },
    { code: 'TW', dial: '+886', name: 'Taiwan',                 len: [9,  9]  },
    { code: 'TH', dial: '+66',  name: 'Thailand',               len: [9,  9]  },
    { code: 'TN', dial: '+216', name: 'Tunisia',                len: [8,  8]  },
    { code: 'TR', dial: '+90',  name: 'Turkey',                 len: [10, 10] },
    { code: 'UA', dial: '+380', name: 'Ukraine',                len: [9,  9]  },
    { code: 'AE', dial: '+971', name: 'United Arab Emirates',   len: [9,  9]  },
    { code: 'GB', dial: '+44',  name: 'United Kingdom',         len: [10, 10] },
    { code: 'US', dial: '+1',   name: 'United States',          len: [10, 10] },
    { code: 'UY', dial: '+598', name: 'Uruguay',                len: [8,  8]  },
    { code: 'UZ', dial: '+998', name: 'Uzbekistan',             len: [9,  9]  },
    { code: 'VE', dial: '+58',  name: 'Venezuela',              len: [10, 10] },
    { code: 'VN', dial: '+84',  name: 'Vietnam',                len: [9,  10] },
    { code: 'YE', dial: '+967', name: 'Yemen',                  len: [9,  9]  },
  ],

  // Example local numbers per dial code (shown as placeholder)
  _DIAL_EXAMPLES: {
    '+93': '701234567',   '+355': '661234567',  '+213': '551234567',
    '+54': '1123456789',  '+374': '77123456',   '+61': '412345678',
    '+43': '6641234567',  '+994': '501234567',  '+880': '1712345678',
    '+375': '291234567',  '+32': '470123456',   '+591': '71234567',
    '+387': '61123456',   '+55': '11912345678', '+359': '881234567',
    '+855': '12345678',   '+1':  '2015551234',  '+56': '912345678',
    '+86': '13812345678', '+57': '3001234567',  '+385': '91234567',
    '+420': '601123456',  '+45': '20123456',    '+593': '991234567',
    '+20': '1001234567',  '+372': '51234567',   '+251': '911234567',
    '+358': '412345678',  '+33': '612345678',   '+995': '555123456',
    '+49': '15123456789', '+233': '201234567',  '+30': '6912345678',
    '+502': '51234567',   '+36': '201234567',   '+91': '9123456789',
    '+62': '81234567890', '+98': '9123456789',  '+964': '7901234567',
    '+353': '851234567',  '+972': '501234567',  '+39': '3123456789',
    '+81': '9012345678',  '+962': '791234567',  '+7':  '9161234567',
    '+254': '712345678',  '+383': '43123456',   '+965': '51234567',
    '+371': '21234567',   '+961': '3123456',    '+218': '912345678',
    '+370': '61234567',   '+60': '123456789',   '+52': '5512345678',
    '+373': '69123456',   '+976': '88123456',   '+212': '612345678',
    '+31': '612345678',   '+64': '21123456',    '+234': '8012345678',
    '+389': '71234567',   '+47': '41234567',    '+92': '3001234567',
    '+595': '961234567',  '+51': '912345678',   '+63': '9171234567',
    '+48': '512345678',   '+351': '912345678',  '+974': '33123456',
    '+40': '712345678',   '+966': '512345678',  '+381': '641234567',
    '+421': '901234567',  '+386': '31234567',   '+27': '711234567',
    '+82': '1012345678',  '+34': '612345678',   '+94': '712345678',
    '+46': '701234567',   '+41': '791234567',   '+963': '944123456',
    '+886': '912345678',  '+66': '812345678',   '+216': '20123456',
    '+90': '5321234567',  '+380': '501234567',  '+971': '501234567',
    '+44': '7911123456',  '+598': '91234567',   '+998': '901234567',
    '+58': '4121234567',  '+84': '912345678',   '+967': '712345678',
  },

  _COUNTRIES: [
    'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
    'Azerbaijan','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina',
    'Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia','Croatia',
    'Czech Republic','Denmark','Ecuador','Egypt','Estonia','Ethiopia','Finland',
    'France','Georgia','Germany','Ghana','Greece','Guatemala','Hungary','India',
    'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan',
    'Kazakhstan','Kenya','Kosovo','Kuwait','Latvia','Lebanon','Libya','Lithuania',
    'Malaysia','Mexico','Moldova','Mongolia','Morocco','Netherlands','New Zealand',
    'Nigeria','North Macedonia','Norway','Pakistan','Paraguay','Peru','Philippines',
    'Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia',
    'Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka',
    'Sweden','Switzerland','Syria','Taiwan','Thailand','Tunisia','Turkey',
    'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
    'Uzbekistan','Venezuela','Vietnam','Yemen',
  ],

  render(container, controller) {
    container.classList.add('ob-step-compact');

    const sel = controller.selections.location || {};
    const savedCountry  = sel.country    || '';
    const savedLangs    = sel.languages  || [];
    const savedWhatsapp = sel.whatsapp   || '';
    const savedDialCode = sel.dialCode || (
      // Smart default: match dial code to already-selected country
      sel.country
        ? (this._DIAL_CODES.find(d => d.name === sel.country)?.dial || '+1')
        : '+1'
    );

    container.innerHTML = `
      <h1 class="ob-step-title ob-stagger-item">About you</h1>
      <p class="ob-step-subtitle ob-stagger-item">
        Your country, languages, and contact info help your AI Wingman write messages that feel authentic — and let matches reach you directly.
      </p>

      <div class="ob-loc-fields">

        <!-- Country -->
        <div class="ob-loc-field ob-pill-cascade">
          <label class="ob-loc-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Country
          </label>

          <!-- Custom dropdown trigger — styled like ob-list-item -->
          <div class="ob-loc-dropdown" id="obCountryDropdown">
            <button type="button" class="ob-list-item selectable ob-loc-trigger" id="obCountryTrigger" aria-haspopup="listbox" aria-expanded="false">
              <svg class="ob-loc-trigger-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span class="ob-loc-trigger-text" id="obCountryText">${savedCountry || 'Select your country…'}</span>
              <div class="ob-list-item-tick" id="obCountryTick">
                <svg class="ob-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <svg class="ob-loc-caret" id="obCountryCaret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            <!-- Dropdown panel -->
            <div class="ob-loc-dropdown-panel" id="obCountryPanel" role="listbox" aria-label="Select country">
              <div class="ob-loc-search-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input class="ob-loc-search" id="obCountrySearch" type="text" placeholder="Search country…" autocomplete="off">
              </div>
              <div class="ob-loc-options" id="obCountryOptions">
                ${this._COUNTRIES.map(c => `
                  <div class="ob-loc-option${c === savedCountry ? ' selected' : ''}" data-value="${c}" role="option" aria-selected="${c === savedCountry}">
                    <span>${c}</span>
                    <svg class="ob-loc-option-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Languages -->
        <div class="ob-loc-field ob-pill-cascade">
          <label class="ob-loc-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Native Languages
          </label>

          <!-- Selected tags -->
          <div class="ob-lang-tags" id="obLangTags">
            <span class="ob-lang-placeholder" id="obLangPlaceholder" style="${savedLangs.length ? 'display:none' : ''}">Pick one or more…</span>
          </div>

          <!-- Multi-select dropdown -->
          <div class="ob-loc-dropdown" id="obLangDropdown">
            <button type="button" class="ob-list-item selectable ob-loc-trigger" id="obLangTrigger" aria-haspopup="listbox" aria-expanded="false">
              <svg class="ob-loc-trigger-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span class="ob-loc-trigger-text" id="obLangTriggerText">Select languages…</span>
              <svg class="ob-loc-caret" id="obLangCaret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="ob-loc-dropdown-panel" id="obLangPanel" role="listbox" aria-multiselectable="true" aria-label="Select languages">
              <div class="ob-loc-search-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input class="ob-loc-search" id="obLangSearch" type="text" placeholder="Search language…" autocomplete="off">
              </div>
              <div class="ob-loc-options" id="obLangOptions">
                ${this._LANGUAGES.map(lang => `
                  <div class="ob-loc-option${savedLangs.includes(lang) ? ' selected' : ''}" data-value="${lang}" role="option" aria-selected="${savedLangs.includes(lang)}">
                    <span>${lang}</span>
                    <svg class="ob-loc-option-tick" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- WhatsApp Number (optional) -->
        <div class="ob-loc-field ob-pill-cascade" id="obWhatsappField">
          <label class="ob-loc-label" for="obWhatsappInput">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            WhatsApp Number
            <span class="ob-loc-label-optional">(optional)</span>
          </label>
          <div class="ob-whatsapp-input-wrap">
            <!-- Dial code dropdown -->
            <div class="ob-dial-dropdown" id="obDialDropdown">
              <button type="button" class="ob-dial-trigger" id="obDialTrigger" aria-haspopup="listbox" aria-expanded="false">
                <span id="obDialSelected">${savedDialCode}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="ob-dial-panel" id="obDialPanel" role="listbox" aria-label="Select country code">
                <div class="ob-dial-search-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input class="ob-dial-search" id="obDialSearch" type="text" placeholder="Search…" autocomplete="off">
                </div>
                <div class="ob-dial-options" id="obDialOptions">
                  ${this._DIAL_CODES.map(d => `
                    <div class="ob-dial-option${d.dial === savedDialCode ? ' selected' : ''}" data-dial="${d.dial}" data-name="${d.name}" role="option">
                      <span class="ob-dial-option-name">${d.name}</span>
                      <span class="ob-dial-option-code">${d.dial}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="ob-dial-divider"></div>
            <input
              type="tel"
              id="obWhatsappInput"
              class="ob-whatsapp-input"
              placeholder="501234567"
              autocomplete="tel"
              maxlength="15"
              value="${savedWhatsapp}"
            />
          </div>
          <p class="ob-whatsapp-hint">No spaces or dashes — just the digits after your country code.</p>
        </div>

      </div>
    `;

    this._initCountryDropdown(container, controller, savedCountry);
    this._initLangs(container, controller, savedLangs);
    this._initWhatsapp(container, controller, savedWhatsapp);
  },

  _initWhatsapp(container, controller, savedWhatsapp) {
    const input        = container.querySelector('#obWhatsappInput');
    const dialTrigger  = container.querySelector('#obDialTrigger');
    const dialPanel    = container.querySelector('#obDialPanel');
    const dialSelected = container.querySelector('#obDialSelected');
    const dialSearch   = container.querySelector('#obDialSearch');
    const dialOptions  = container.querySelector('#obDialOptions');
    const hintEl       = container.querySelector('.ob-whatsapp-hint');
    if (!input || !dialTrigger) return;

    const savedDialCode = controller.selections.location?.dialCode || '+1';
    // Use what's actually rendered in the trigger as source of truth
    let currentDial  = dialSelected ? dialSelected.textContent.trim() : savedDialCode;
    let currentEntry = this._DIAL_CODES.find(d => d.dial === currentDial) || { len: [7, 15] };

    // ── Helpers ──

    const getExample = (dial) => this._DIAL_EXAMPLES[dial] || '501234567';

    const updatePlaceholder = () => {
      input.placeholder = getExample(currentDial);
      input.maxLength   = currentEntry.len[1];
    };

    // Strip leading zero (WhatsApp E.164 format never has leading 0 after dial code)
    const cleanInput = (raw) => {
      let d = raw.replace(/[^\d]/g, '');
      if (d.startsWith('0')) d = d.slice(1);
      return d.slice(0, currentEntry.len[1]);
    };

    const validate = () => {
      const digits = input.value;
      if (digits.length === 0) return true; // optional
      return digits.length >= currentEntry.len[0] && digits.length <= currentEntry.len[1];
    };

    const updateHint = () => {
      const digits = input.value;
      const [min] = currentEntry.len;
      if (digits.length === 0) {
        hintEl.textContent = `No spaces or dashes — just the digits after your country code.`;
        hintEl.style.color = '';
        input.classList.remove('ob-whatsapp-input--error', 'ob-whatsapp-input--ok');
        return;
      }
      if (digits.length < min) {
        hintEl.textContent = `Number looks too short — double check it.`;
        hintEl.style.color = '#ef4444';
        input.classList.add('ob-whatsapp-input--error');
        input.classList.remove('ob-whatsapp-input--ok');
      } else {
        hintEl.textContent = '';
        input.classList.remove('ob-whatsapp-input--error');
        input.classList.add('ob-whatsapp-input--ok');
      }
    };

    const persist = () => {
      if (!controller.selections.location) controller.selections.location = {};
      const digits = input.value;
      controller.selections.location.whatsapp      = digits;
      controller.selections.location.dialCode       = currentDial;
      controller.selections.location.whatsappFull   = digits ? (currentDial + digits) : '';
      controller.selections.location.whatsappValid  = validate();
      controller.updateContinueState();
    };

    updatePlaceholder();
    // Persist immediately so dialCode is stored from the rendered value
    persist();

    // ── Dial code dropdown ──
    const openDial = () => {
      dialPanel.classList.add('open');
      dialTrigger.setAttribute('aria-expanded', 'true');
      dialSearch.value = '';
      filterDial('');
      setTimeout(() => dialSearch.focus(), 60);
    };

    const closeDial = () => {
      dialPanel.classList.remove('open');
      dialTrigger.setAttribute('aria-expanded', 'false');
    };

    const filterDial = (q) => {
      const lq = q.toLowerCase();
      dialOptions.querySelectorAll('.ob-dial-option').forEach(opt => {
        const match = opt.dataset.name.toLowerCase().includes(lq) || opt.dataset.dial.includes(q);
        opt.style.display = match ? '' : 'none';
      });
    };

    dialTrigger.addEventListener('click', () => {
      dialPanel.classList.contains('open') ? closeDial() : openDial();
    });

    dialSearch.addEventListener('input', () => filterDial(dialSearch.value));

    dialOptions.addEventListener('click', (e) => {
      const opt = e.target.closest('.ob-dial-option');
      if (!opt) return;
      currentDial  = opt.dataset.dial;
      currentEntry = this._DIAL_CODES.find(d => d.dial === opt.dataset.dial && d.name === opt.dataset.name)
                     || this._DIAL_CODES.find(d => d.dial === opt.dataset.dial)
                     || { len: [7, 15] };
      dialSelected.textContent = currentDial;
      dialOptions.querySelectorAll('.ob-dial-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      updatePlaceholder();
      // Re-clean existing value against new country rules
      if (input.value) input.value = cleanInput(input.value);
      updateHint();
      persist();
      closeDial();
      input.focus();
    });

    document.addEventListener('click', (e) => {
      const wrap = container.querySelector('#obDialDropdown');
      if (wrap && !wrap.contains(e.target)) closeDial();
    }, { capture: true });

    // ── Number input — handles typing AND paste ──
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      const cleaned = cleanInput(input.value);
      if (input.value !== cleaned) {
        input.value = cleaned;
        // Restore cursor, accounting for stripped chars
        const newPos = Math.min(pos, cleaned.length);
        input.setSelectionRange(newPos, newPos);
      }
      updateHint();
      persist();
    });

    // Handle paste explicitly — strip spaces, dashes, +, leading zeros
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      // Strip dial code if pasted with it (e.g. +972501234567 → 501234567)
      let stripped = pasted.replace(/[^\d]/g, '');
      const dialDigits = currentDial.replace('+', '');
      if (stripped.startsWith(dialDigits)) stripped = stripped.slice(dialDigits.length);
      input.value = cleanInput(stripped);
      updateHint();
      persist();
    });

    input.addEventListener('blur', () => { updateHint(); persist(); });
    // Init: run hint + persist so everything is correct from first render
    updateHint();
    persist();
  },

  _initCountryDropdown(container, controller, savedCountry) {
    const trigger  = container.querySelector('#obCountryTrigger');
    const panel    = container.querySelector('#obCountryPanel');
    const textEl   = container.querySelector('#obCountryText');
    const tick     = container.querySelector('#obCountryTick');
    const caret    = container.querySelector('#obCountryCaret');
    const searchEl = container.querySelector('#obCountrySearch');
    const options  = container.querySelector('#obCountryOptions');

    let selected = savedCountry;

    if (savedCountry) {
      trigger.classList.add('selected');
      tick.style.display = '';
      caret.style.display = 'none';
    } else {
      tick.style.display = 'none';
    }

    const openPanel = () => {
      panel.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      caret.classList.add('open');
      searchEl.value = '';
      _filterOptions('');
      setTimeout(() => { searchEl.focus(); }, 60);
    };

    const closePanel = () => {
      panel.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      caret.classList.remove('open');
    };

    const _filterOptions = (q) => {
      const lq = q.toLowerCase();
      options.querySelectorAll('.ob-loc-option').forEach(opt => {
        opt.style.display = opt.dataset.value.toLowerCase().includes(lq) ? '' : 'none';
      });
    };

    trigger.addEventListener('click', () => {
      panel.classList.contains('open') ? closePanel() : openPanel();
    });

    searchEl.addEventListener('input', () => _filterOptions(searchEl.value));

    options.addEventListener('click', (e) => {
      const opt = e.target.closest('.ob-loc-option');
      if (!opt) return;

      selected = opt.dataset.value;
      options.querySelectorAll('.ob-loc-option').forEach(o => {
        o.classList.remove('selected');
        o.setAttribute('aria-selected', 'false');
      });
      opt.classList.add('selected');
      opt.setAttribute('aria-selected', 'true');

      textEl.textContent = selected;
      textEl.classList.add('ob-loc-trigger-text--selected');
      trigger.classList.add('selected', 'ob-selection-pop');
      tick.style.display = '';
      caret.style.display = 'none';
      setTimeout(() => trigger.classList.remove('ob-selection-pop'), 350);

      if (!controller.selections.location) controller.selections.location = {};
      controller.selections.location.country = selected;

      // Auto-select matching dial code when country is picked
      const matchingDial = this._DIAL_CODES.find(d => d.name === selected);
      if (matchingDial) {
        const dialSelectedEl = container.querySelector('#obDialSelected');
        const dialOptionsEl  = container.querySelector('#obDialOptions');
        if (dialSelectedEl) dialSelectedEl.textContent = matchingDial.dial;
        if (dialOptionsEl) {
          dialOptionsEl.querySelectorAll('.ob-dial-option').forEach(o => o.classList.remove('selected'));
          const matchOpt = dialOptionsEl.querySelector(`[data-dial="${matchingDial.dial}"][data-name="${matchingDial.name}"]`);
          if (matchOpt) matchOpt.classList.add('selected');
        }
        controller.selections.location.dialCode = matchingDial.dial;
        controller.selections.location.whatsappFull =
          matchingDial.dial + (controller.selections.location.whatsapp || '');
      }

      controller.updateContinueState();
      closePanel();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!container.querySelector('#obCountryDropdown').contains(e.target)) {
        closePanel();
      }
    }, { capture: true });
  },

  _initLangs(container, controller, initialLangs) {
    const tagsEl      = container.querySelector('#obLangTags');
    const placeholder = container.querySelector('#obLangPlaceholder');
    const trigger     = container.querySelector('#obLangTrigger');
    const panel       = container.querySelector('#obLangPanel');
    const triggerText = container.querySelector('#obLangTriggerText');
    const caret       = container.querySelector('#obLangCaret');
    const searchEl    = container.querySelector('#obLangSearch');
    const options     = container.querySelector('#obLangOptions');

    const selectedLangs = new Set(initialLangs);
    initialLangs.forEach(lang => this._addTag(lang, tagsEl, placeholder, selectedLangs, controller, container));

    const persist = () => {
      if (!controller.selections.location) controller.selections.location = {};
      controller.selections.location.languages = [...selectedLangs];
      const count = selectedLangs.size;
      triggerText.textContent = count ? `${count} language${count > 1 ? 's' : ''} selected` : 'Select languages…';
      triggerText.classList.toggle('ob-loc-trigger-text--selected', count > 0);
      controller.updateContinueState();
    };

    const openPanel = () => {
      panel.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      caret.classList.add('open');
      searchEl.value = '';
      _filterOptions('');
      setTimeout(() => searchEl.focus(), 60);
    };

    const closePanel = () => {
      panel.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      caret.classList.remove('open');
    };

    const _filterOptions = (q) => {
      const lq = q.toLowerCase();
      options.querySelectorAll('.ob-loc-option').forEach(opt => {
        opt.style.display = opt.dataset.value.toLowerCase().includes(lq) ? '' : 'none';
      });
    };

    trigger.addEventListener('click', () => {
      panel.classList.contains('open') ? closePanel() : openPanel();
    });

    searchEl.addEventListener('input', () => _filterOptions(searchEl.value));

    options.addEventListener('click', (e) => {
      const opt = e.target.closest('.ob-loc-option');
      if (!opt) return;
      const lang = opt.dataset.value;
      if (selectedLangs.has(lang)) {
        selectedLangs.delete(lang);
        opt.classList.remove('selected');
        opt.setAttribute('aria-selected', 'false');
        const tag = tagsEl.querySelector(`[data-tag="${CSS.escape(lang)}"]`);
        if (tag) tag.remove();
      } else {
        selectedLangs.add(lang);
        opt.classList.add('selected');
        opt.setAttribute('aria-selected', 'true');
        this._addTag(lang, tagsEl, placeholder, selectedLangs, controller, container);
      }
      this._syncPlaceholder(placeholder, selectedLangs);
      persist();
    });

    document.addEventListener('click', (e) => {
      if (!container.querySelector('#obLangDropdown').contains(e.target)) closePanel();
    }, { capture: true });

    persist();
  },

  _addTag(lang, tagsEl, placeholder, selectedLangs, controller, container) {
    if (tagsEl.querySelector(`[data-tag="${CSS.escape(lang)}"]`)) return;
    const tag = document.createElement('span');
    tag.className = 'ob-lang-tag';
    tag.dataset.tag = lang;
    tag.innerHTML = `${lang}<button class="ob-lang-tag-remove" aria-label="Remove ${lang}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
    tag.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      selectedLangs.delete(lang);
      tag.remove();
      this._syncPlaceholder(placeholder, selectedLangs);
      const opt = container.querySelector(`.ob-loc-option[data-value="${CSS.escape(lang)}"]`);
      if (opt) { opt.classList.remove('selected'); opt.setAttribute('aria-selected', 'false'); }
      if (!controller.selections.location) controller.selections.location = {};
      controller.selections.location.languages = [...selectedLangs];
      controller.updateContinueState();
    });
    tagsEl.insertBefore(tag, placeholder);
  },

  _syncPlaceholder(placeholder, selectedLangs) {
    placeholder.style.display = selectedLangs.size ? 'none' : '';
  },

  onEnter(container) {
    const stagger = container.querySelectorAll('.ob-stagger-item');
    stagger.forEach((item, i) => {
      item.classList.remove('visible');
      setTimeout(() => item.classList.add('visible'), 80 + i * 100);
    });
    const cascade = container.querySelectorAll('.ob-pill-cascade');
    cascade.forEach((item, i) => {
      item.classList.remove('visible');
      setTimeout(() => item.classList.add('visible'), 180 + i * 80);
    });
  },

  validate(controller) {
    const loc = controller.selections.location;
    if (!loc) return false;
    if (!loc.country || !loc.languages || loc.languages.length === 0) return false;
    // If a WhatsApp number was started, it must be valid before continuing
    if (loc.whatsapp && loc.whatsapp.length > 0 && !loc.whatsappValid) return false;
    return true;
  }
};
