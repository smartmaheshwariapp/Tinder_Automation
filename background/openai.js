const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];
let _lastAiModelUsed = null;

async function tryRefreshToken() {
  // DEV MODE: the dev token never expires — always report success
  if (typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE) {
    console.log('[openai] DEV_MODE active — token refresh skipped, returning success.');
    return true;
  }

  try {
    const local = await chrome.storage.local.get('refreshToken');
    let refreshToken = local.refreshToken;

    if (!refreshToken) {
      const sync = await chrome.storage.sync.get('refreshTokenBackup').catch(() => ({}));
      refreshToken = sync.refreshTokenBackup;
    }

    if (!refreshToken) return false;

    const baseUrl = (typeof CONFIG !== 'undefined') ? CONFIG.API_BASE_URL : 'https://flirteasy-auth.shnaiderdm.workers.dev';
    const refreshEndpoint = (typeof CONFIG !== 'undefined' && CONFIG.SERVER_ENDPOINTS?.REFRESH) ? CONFIG.SERVER_ENDPOINTS.REFRESH : '/auth/refresh';

    const response = await fetch(`${baseUrl}${refreshEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (!data.success || !data.token) return false;

    const userStore = await chrome.storage.local.get('user');
    const user = userStore.user || {};
    user.token = data.token;
    if (data.plan) user.plan = data.plan;
    await chrome.storage.local.set({ user });

    if (data.refreshToken) {
      await chrome.storage.local.set({ refreshToken: data.refreshToken });
      chrome.storage.sync.set({ refreshTokenBackup: data.refreshToken }).catch(() => {});
    }
    chrome.storage.sync.set({ userBackup: { email: user.email, token: data.token, plan: user.plan, lastAuth: Date.now() } }).catch(() => {});

    if (typeof info === 'function') info('Silent token refresh successful');
    return true;
  } catch {
    return false;
  }
}

// ─── Per-style model parameters ───────────────────────────────────────────────
// Higher temperature = more spontaneous/varied. Lower = more controlled.
// max_tokens tuned so bolder/punchier styles stay short; warmer styles can breathe.
const STYLE_AI_PARAMS = {
  freestyle:  { temperature: 0.90, max_tokens: 100 },
  playful:    { temperature: 0.92, max_tokens: 80  },
  witty:      { temperature: 0.92, max_tokens: 85  },
  flirty:     { temperature: 0.88, max_tokens: 90  },
  confident:  { temperature: 0.85, max_tokens: 90  },
  bold:       { temperature: 0.85, max_tokens: 80  },
  charming:   { temperature: 0.83, max_tokens: 100 },
  gentle:     { temperature: 0.78, max_tokens: 120 },
  serious:    { temperature: 0.75, max_tokens: 130 },
  romantic:   { temperature: 0.78, max_tokens: 140 },
};

async function getStyleAIParams(style) {
  try {
    const storage = await chrome.storage.local.get('remoteStyleAiParams');
    if (storage.remoteStyleAiParams && storage.remoteStyleAiParams[style]) {
      return storage.remoteStyleAiParams[style];
    }
  } catch (_) {}
  return STYLE_AI_PARAMS[style] || { temperature: 0.80, max_tokens: 120 };
}

// ─── Post-processing humanizer ─────────────────────────────────────────────────
// Only applied to English output — other languages have their own native slang guidance.
// Runs after normalizeEmojiStyle(), before the message is returned.

const _CONTRACTIONS = [
  [/\bI am\b/g,       "I'm"      ],
  [/\bI would\b/g,    "I'd"      ],
  [/\bI have\b/g,     "I've"     ],
  [/\bI will\b/g,     "I'll"     ],
  [/\bdo not\b/g,     "don't"    ],
  [/\bdoes not\b/g,   "doesn't"  ],
  [/\bdid not\b/g,    "didn't"   ],
  [/\bcannot\b/g,     "can't"    ],
  [/\bcan not\b/g,    "can't"    ],
  [/\bwill not\b/g,   "won't"    ],
  [/\bshould not\b/g, "shouldn't"],
  [/\bcould not\b/g,  "couldn't" ],
  [/\bwould not\b/g,  "wouldn't" ],
  [/\bit is\b/g,      "it's"     ],
  [/\bthat is\b/g,    "that's"   ],
  [/\bthere is\b/g,   "there's"  ],
  [/\bwhat is\b/g,    "what's"   ],
  [/\byou are\b/g,    "you're"   ],
  [/\bthey are\b/g,   "they're"  ],
  [/\bwe are\b/g,     "we're"    ],
  [/\bhe is\b/g,      "he's"     ],
  [/\bshe is\b/g,     "she's"    ],
];

// Applied only for high-intensity styles (freestyle, playful, witty, bold, flirty)
const _CASUAL_TRANSFORMS = [
  [/\bgoing to\b/g, "gonna"],
  [/\bwant to\b/g,  "wanna"],
  [/\bkind of\b/g,  "kinda"],
  [/\bsort of\b/g,  "sorta"],
  [/\bgot to\b/g,   "gotta"],
];

const _STYLE_INTENSITY = {
  freestyle: 'high', playful: 'high', witty: 'high', flirty: 'high', bold: 'high',
  confident: 'medium', charming: 'medium',
  gentle: 'light', serious: 'light', romantic: 'light',
};

// ═══════════════════════════════════════════════════════════════════════════
// POST-PROCESSING SANITIZATION (Defense-in-Depth Layer)
// ═══════════════════════════════════════════════════════════════════════════
// This function runs AFTER AI generation to guarantee no inappropriate
// abbreviations leak through, regardless of what the AI generated.
// Provides 95%+ reliability by combining prompt-based guidance (70%) with
// post-processing cleanup (catches the remaining 30%).

const _ENGLISH_ABBREVIATIONS = [
  // Common text speak that should be removed in formal contexts
  [/\bur\b/gi, 'your'],
  [/\bu\b(?=\s)/gi, 'you'],  // Only match 'u' when followed by space (not in words)
  [/\bthx\b/gi, 'thanks'],
  [/\btbh\b/gi, 'to be honest'],
  [/\bidk\b/gi, "I don't know"],
  [/\bomg\b/gi, 'oh my god'],
  [/\bbtw\b/gi, 'by the way'],
  [/\bngl\b/gi, 'not gonna lie'],
  [/\bimo\b/gi, 'in my opinion'],
  [/\bfyi\b/gi, 'for your information'],
  [/\basap\b/gi, 'as soon as possible'],
  [/\bbrb\b/gi, 'be right back'],
  [/\bttyl\b/gi, 'talk to you later'],
  [/\bidc\b/gi, "I don't care"],
  [/\birl\b/gi, 'in real life'],
  [/\bwbu\b/gi, 'what about you'],
  [/\bhbu\b/gi, 'how about you']
];

const _ITALIAN_ABBREVIATIONS = [
  [/\bcmq\b/gi, 'comunque'],
  [/\bnn\b/gi, 'non'],
  [/(^|\s)xk[eé](\s|$)/gi, '$1perché$2'],  // Cyrillic-style boundaries for accented chars
  [/\bxk\b/gi, 'perché'],
  [/\bperke\b/gi, 'perché'],
  [/\bdv\b/gi, 'dove'],
  [/\bqnd\b/gi, 'quando'],
  [/\bcs\b/gi, 'cosa'],
  [/\btt\b/gi, 'tutto'],
  [/\btv\b/gi, 'ti voglio'],
  [/\btvb\b/gi, 'ti voglio bene'],
  [/\btvtb\b/gi, 'ti voglio tanto bene']
];

const _SPANISH_ABBREVIATIONS = [
  [/\bxq\b/gi, 'porque'],
  [/\bxk\b/gi, 'porque'],
  [/\btb\b/gi, 'también'],
  [/\btbn\b/gi, 'también'],
  [/\btq\b/gi, 'te quiero'],
  [/\btqm\b/gi, 'te quiero mucho'],
  [/\bq\b(?=\s)/gi, 'que'],  // Only standalone 'q'
  [/\bd\b(?=\s)/gi, 'de'],   // Only standalone 'd'
  [/\bpq\b/gi, 'porque'],
  [/\btk\b/gi, 'te quiero'],
  [/\bsalu2\b/gi, 'saludos'],
  [/\bbss\b/gi, 'besos']
];

const _PORTUGUESE_ABBREVIATIONS = [
  [/\bvc\b/gi, 'você'],
  [/\btb\b/gi, 'também'],
  [/\bpq\b/gi, 'porque'],
  [/\bblz\b/gi, 'beleza'],
  [/\bflw\b/gi, 'falou'],
  [/\btmj\b/gi, 'tamo junto'],
  [/\bvlw\b/gi, 'valeu'],
  [/\bpdc\b/gi, 'pode crer'],
  [/\btb\b/gi, 'também']
];

const _FRENCH_ABBREVIATIONS = [
  [/\bslt\b/gi, 'salut'],
  [/\bcv\b/gi, 'ça va'],
  [/\bstp\b/gi, "s'il te plaît"],
  [/\bsvp\b/gi, "s'il vous plaît"],
  [/\btlm\b/gi, 'tout le monde'],
  [/\bpq\b/gi, 'pourquoi'],
  [/\bpcq\b/gi, 'parce que'],
  [/\bbcp\b/gi, 'beaucoup'],
  [/\btjs\b/gi, 'toujours']
];

const _GERMAN_ABBREVIATIONS = [
  [/\bhdl\b/gi, 'hab dich lieb'],
  [/\bildich\b/gi, 'ich liebe dich'],
  [/\bmfg\b/gi, 'mit freundlichen Grüßen'],
  [/\blg\b/gi, 'liebe Grüße'],
  [/\bvg\b/gi, 'viele Grüße'],
  [/\bbis\b/gi, 'bis später']
];

const _RUSSIAN_ABBREVIATIONS = [
  [/(^|\s)спс(\s|$)/gi, '$1спасибо$2'],
  [/(^|\s)пжл(\s|$)/gi, '$1пожалуйста$2'],
  [/(^|\s)пжт(\s|$)/gi, '$1пожалуйста$2'],
  [/(^|\s)нзч(\s|$)/gi, '$1незачто$2'],
  [/(^|\s)нз(\s|$)/gi, '$1незачто$2'],
  [/(^|\s)оч(\s|$)/gi, '$1очень$2']
];

function sanitizeForFormality(message, settings, matchData) {
  if (!message || typeof message !== 'string') return message;

  const style = settings.chattingStyle || 'freestyle';
  const effectiveLang = (matchData && matchData.detectedLanguage && matchData.detectedLanguage.code)
    || settings.conversationLanguage || 'auto';

  // Determine formality level from style
  const formalityLevel = (typeof STYLE_FORMALITY_LEVELS !== 'undefined' && STYLE_FORMALITY_LEVELS[style])
    ? STYLE_FORMALITY_LEVELS[style]
    : 'moderate';

  let result = message;

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 1: Remove English abbreviations for NON-ENGLISH languages (ALWAYS)
  // ═══════════════════════════════════════════════════════════════════════════
  // Cultural rule: English abbreviations like 'ur', 'u' are NEVER appropriate
  // in Italian, Spanish, French, German, etc. messages
  if (effectiveLang !== 'en' && effectiveLang !== 'auto') {
    for (const [pattern, replacement] of _ENGLISH_ABBREVIATIONS) {
      result = result.replace(pattern, replacement);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 2: Remove English abbreviations for MODERATE and FORMAL styles
  // ═══════════════════════════════════════════════════════════════════════════
  // Moderate styles (flirty, confident, bold) and formal styles (romantic,
  // charming, gentle, serious) should use complete words, not text-speak
  if (effectiveLang === 'en' && (formalityLevel === 'moderate' || formalityLevel === 'formal')) {
    for (const [pattern, replacement] of _ENGLISH_ABBREVIATIONS) {
      result = result.replace(pattern, replacement);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 3: Remove language-specific abbreviations based on detected language
  // ═══════════════════════════════════════════════════════════════════════════
  // Each language has its own text-speak abbreviations that should be removed
  // for moderate and formal styles
  if (formalityLevel === 'moderate' || formalityLevel === 'formal') {
    switch (effectiveLang) {
      case 'it':
        for (const [pattern, replacement] of _ITALIAN_ABBREVIATIONS) {
          result = result.replace(pattern, replacement);
        }
        break;
      case 'es':
        for (const [pattern, replacement] of _SPANISH_ABBREVIATIONS) {
          result = result.replace(pattern, replacement);
        }
        break;
      case 'pt':
        for (const [pattern, replacement] of _PORTUGUESE_ABBREVIATIONS) {
          result = result.replace(pattern, replacement);
        }
        break;
      case 'fr':
        for (const [pattern, replacement] of _FRENCH_ABBREVIATIONS) {
          result = result.replace(pattern, replacement);
        }
        break;
      case 'de':
        for (const [pattern, replacement] of _GERMAN_ABBREVIATIONS) {
          result = result.replace(pattern, replacement);
        }
        break;
      case 'ru':
        for (const [pattern, replacement] of _RUSSIAN_ABBREVIATIONS) {
          result = result.replace(pattern, replacement);
        }
        break;
    }
  }

  return result.trim();
}

function humanizeMessage(message, settings, matchData) {
  if (!message || typeof message !== 'string') return message;

  // ─── Remove AI tells (applies to ALL languages) ───────────────────────────
  // Em dash — is one of the most recognised AI writing signatures.
  // ChatGPT uses it in 50%+ of responses. Real texters never use it.
  // Replace with: comma, space, or nothing depending on context.
  let result = message
    // "word — word" → "word, word"  (mid-sentence em dash)
    .replace(/\s—\s/g, ', ')
    // "word—word" (no spaces) → "word - word"
    .replace(/—/g, ' - ');

  // Also remove en dash (–) which is another AI tell
  result = result.replace(/\s–\s/g, ', ').replace(/–/g, ' - ');

  // Only transform English — other languages handled by their slang guides
  const effectiveLang = (matchData && matchData.detectedLanguage && matchData.detectedLanguage.code)
    || settings.conversationLanguage || 'auto';
  if (effectiveLang !== 'en' && effectiveLang !== 'auto') return result.trim();

  const style = settings.chattingStyle || 'freestyle';
  const intensity = _STYLE_INTENSITY[style] || 'medium';

  // 1. Expand contractions (all intensities)
  for (const [pattern, replacement] of _CONTRACTIONS) {
    result = result.replace(pattern, replacement);
  }

  // 2. Strip trailing period on short messages — real texters don't do this
  //    Guard: skip if ends with '...' (ellipsis) or '!.' or '?.'
  const wordCount = result.trim().split(/\s+/).length;
  if (wordCount <= 12 && /[^.!?]\.$/.test(result)) {
    result = result.slice(0, -1);
  }

  // 3. High-intensity casual transforms
  if (intensity === 'high') {
    for (const [pattern, replacement] of _CASUAL_TRANSFORMS) {
      result = result.replace(pattern, replacement);
    }
  }

  return result.trim();
}

const LANGUAGE_CODE_MAP = {
  ar: 'Arabic', bn: 'Bengali', zh: 'Chinese', cs: 'Czech', da: 'Danish',
  nl: 'Dutch', en: 'English', fi: 'Finnish', fr: 'French', de: 'German',
  el: 'Greek', he: 'Hebrew', hi: 'Hindi', hu: 'Hungarian', id: 'Indonesian',
  it: 'Italian', ja: 'Japanese', ko: 'Korean', no: 'Norwegian', fa: 'Persian',
  pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', ru: 'Russian', es: 'Spanish',
  sw: 'Swahili', sv: 'Swedish', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian',
  ur: 'Urdu', vi: 'Vietnamese'
};

const LATIN_SCRIPT_CODES = new Set([
  'en','es','fr','de','pt','it','nl','pl','ro','cs','sk','hr','fi','sv','da','no',
  'hu','id','ms','tl','vi','tr','sw'
]);

function isNonLatinName(name) {
  if (!name) return false;
  return /[^\u0000-\u024F\s'\-.]/.test(name);
}

async function generateMessage(matchData, settings, isFollowUp = false) {
  // Check Trial Status
  if (typeof TrialManager !== 'undefined') {
    const trial = await TrialManager.getTrialStatus();
    if (trial.status === 'expired') {
      const reasonStr = trial.reason === 'time' ? 'Your 3-day trial has ended.' : 'Your trial usage limit has been reached.';
      return {
        success: false,
        error: `${reasonStr} Please upgrade to Pro to continue using AI features.`,
        showUpgrade: true,
        isTrialLimit: true
      };
    }
    if (trial.messagesExhausted) {
      return {
        success: false,
        error: 'Your 30 trial AI messages have been used up. Upgrade to Pro for unlimited messaging.',
        showUpgrade: true,
        isTrialLimit: true
      };
    }
  }

  const apiKey = settings.apiKey || CONFIG.OPENAI_API_KEY;

  // Emoji probability roll — resolved once per message so both prompt & post-processor agree
  const emojiEnabled = settings.useEmojis !== false;
  const emojiProb = Math.min(100, Math.max(0, Number.isFinite(settings.emojiProbability) ? settings.emojiProbability : 30));
  const emojiThisMessage = emojiEnabled && (Math.random() * 100 < emojiProb);
  const effectiveSettings = emojiEnabled ? { ...settings, useEmojis: emojiThisMessage } : settings;

  const systemPrompt = await buildSystemPrompt(effectiveSettings, isFollowUp, matchData);
  const userPrompt = buildUserPrompt(matchData, settings, isFollowUp);

  // Log prompt details (sanitized)
  if (typeof info === 'function') {
    const userContext = getUserContext(settings);
    info(`AI Prompt for [match]`, {
      userContext: userContext ? '[context-' + userContext.length + '-chars]' : '(none)',
      systemPrompt: systemPrompt.substring(0, 100) + '...',
      userPrompt: '[prompt-' + userPrompt.length + '-chars]'
    });
  }

  try {
    const message = await callOpenAI(systemPrompt, userPrompt, apiKey, settings);

    // ── Consecutive messages: parse JSON if feature enabled ──
    const consecutiveEnabled = settings.consecutiveMessagesEnabled === true;
    if (consecutiveEnabled) {
      try {
        // AI returns JSON like {"messages": ["first", "second"]} when splitting
        const trimmed = message.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(trimmed);
        if (parsed?.messages && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          // Process each part through the same pipeline
          const processedParts = [];
          for (const part of parsed.messages.slice(0, 3)) {
            if (!part?.trim()) continue;
            if (containsPlaceholder(part)) continue;
            const norm = normalizeEmojiStyle(part.trim(), effectiveSettings);
            const hum  = humanizeMessage(norm, settings, matchData);
            const cl   = await callClaudeRewrite(hum, settings, matchData);
            const clNorm = normalizeEmojiStyle(cl || hum, effectiveSettings);
            const fin  = sanitizeForFormality(clNorm, settings, matchData);
            processedParts.push(fin);
          }
          if (processedParts.length > 0) {
            console.log(`[FlirtEasy AI] 💬 Consecutive messages: ${processedParts.length} parts`);
            return { success: true, messages: processedParts, message: processedParts[0], model: _lastAiModelUsed };
          }
        }
      } catch (_jsonErr) {
        // Not JSON — fall through to single message processing below
      }
    }

    // CRITICAL SAFEGUARD: Block any message with placeholders
    if (containsPlaceholder(message)) {
      const errorMsg = 'AI generated placeholder text - message blocked to prevent looking fake';
      if (typeof error === 'function') {
        error('Placeholder detected in AI response', { message });
      }
      throw new Error(errorMsg);
    }

    if (typeof info === 'function') {
      info(`AI Response for [match]`, '[message-' + message.length + '-chars]');
    }

    const normalizedMessage = normalizeEmojiStyle(message, effectiveSettings);
    const humanizedMessage = humanizeMessage(normalizedMessage, settings, matchData);
    const claudeMessage = await callClaudeRewrite(humanizedMessage, settings, matchData);
    const claudeNormalized = normalizeEmojiStyle(claudeMessage || humanizedMessage, effectiveSettings);
    const finalMessage = sanitizeForFormality(claudeNormalized, settings, matchData);

    return { success: true, message: finalMessage, model: _lastAiModelUsed };
  } catch (err) {
    console.error('[System] Failed to generate message:', err.message);
    if (typeof error === 'function') {
      error('Message generation failed', { error: err.message });
    }
    const isAuthError = err.message && (
      err.message.includes('log in') ||
      err.message.includes('Session expired') ||
      err.message.includes('Authentication required')
    );
    const isAccessError = err.message && (
      err.message.includes('Trial') ||
      err.message.includes('Subscription') ||
      err.message.includes('limit reached')
    );
    if (!isAccessError && !isAuthError && typeof reportError === 'function') {
      reportError({ platform: 'unknown', error_type: 'ai_error', error_message: err.message || 'AI message generation failed' });
    }
    if (isAuthError) {
      if (typeof pushProgressFeedEvent === 'function') {
        pushProgressFeedEvent('error', 'Session expired — please log out and back in to enable AI messaging', null, 0);
      }
      // DEV MODE: never wipe the dev user or set the session-expired flag
      if (!(typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE)) {
        chrome.storage.local.remove(['user', 'trial_v3', 'refreshToken']).catch(() => {});
        chrome.storage.sync.remove(['userBackup', 'refreshTokenBackup']).catch(() => {});
        chrome.storage.local.set({ sessionExpired: true }).catch(() => {});
      }
      return { success: false, error: err.message, isAuthError: true };
    }
    if (isAccessError) {
      return { success: false, error: err.message, isTrialLimit: true, showUpgrade: true };
    }
    return { success: false, message: getFallbackMessage(settings, isFollowUp), error: err.message };
  }
}

async function buildSystemPrompt(settings, isFollowUp, matchData) {
  const { conversationLanguage, chattingStyle, intentions, useEmojis, promptModes } = settings;

  const styleMap = {
    freestyle: 'casual and spontaneous',
    serious: 'thoughtful and genuine',
    gentle: 'kind and considerate',
    flirty: 'playful and charming',
    confident: 'bold and self-assured',
    playful: 'fun and lighthearted',
    witty: 'clever and quick-witted',
    charming: 'warm and naturally charming',
    bold: 'direct and unapologetically bold',
    romantic: 'romantic and emotionally expressive'
  };

  const intentionsMap = {
    long_term: 'a serious relationship',
    short_term: 'casual dating',
    just_fun: 'fun and lighthearted connections',
    casual_connection: 'casual connections without pressure',
    meaningful_conversations: 'meaningful conversations and genuine connection',
    open_to_anything: 'whatever feels right',
    lets_see: 'something real, wherever it leads'
  };

  const style = styleMap[chattingStyle] || 'friendly';
  const goal = intentionsMap[intentions] || 'meeting new people';
  const emojiGuidance = useEmojis
    ? 'Use only simple, common emojis (max 1-2), like 🙂 😊 😄 😉 😅 😌 😂 😭 😍 😘 😏 🤔 🙈 🙃 ❤️ 🔥 👍 👀 ✨. Avoid niche, symbolic, fantasy, object-heavy, or uncommon emojis.'
    : 'Avoid emojis.';
  const platformName = matchData?.platform?.toLowerCase() === 'bumble' ? 'Bumble' : 'Tinder';

  // --- PRODUCTION-GRADE LOCALIZATION: GENDER CONTEXT ---
  // Normalize raw profile gender values (e.g. 'Man' → 'male', 'Woman' → 'female')
  // to consistent lowercase terms GPT understands for gendered grammar.
  function normalizeGender(raw) {
    if (!raw) return 'unknown';
    const g = String(raw).toLowerCase().trim();
    if (g === 'man' || g === 'male' || g === 'm') return 'male';
    if (g === 'woman' || g === 'female' || g === 'f') return 'female';
    if (g.includes('non') || g.includes('binary') || g === 'nb') return 'non-binary';
    return g; // pass through anything else (e.g. 'unknown')
  }

  const userGender  = normalizeGender(
    // Manual override from plugin settings takes highest priority
    (settings.userGenderOverride && settings.userGenderOverride !== 'auto')
      ? settings.userGenderOverride
      : settings.userProfile?.gender
        // Tinder DOM parser may not capture gender directly — infer from interestedIn as fallback.
        // "Interested In: Women" → most likely male sender. "Interested In: Men" → most likely female.
        || (settings.userProfile?.interestedIn?.toLowerCase().includes('women') ? 'male' :
            settings.userProfile?.interestedIn?.toLowerCase().includes('men')   ? 'female' : null));
  const matchGender = normalizeGender(matchData?.gender);

  if (userGender === 'unknown' && typeof warn === 'function') {
    warn('Gender context missing — prompts will say "unknown sender". Sync profile to fix.');
  }
  const genderContext = `CONTEXT: You are a ${userGender} sender messaging a ${matchGender} match. Use appropriate gendered grammar for all verbs and adjectives.`;

  // Fix 5 — stronger gender context for romance languages where grammar is gendered
  // Italian/Spanish/French/Portuguese/Romanian use gender agreement on adjectives & past participles
  const romanceLanguageCodes = new Set(['it', 'es', 'fr', 'pt', 'ro']);
  // Use conversationLanguage here — effectiveLangCode is resolved later with detection confidence logic.
  // This is a best-effort early check; the slangGuidance already handles per-language nuance.
  const _earlyLangCode = matchData?.detectedLanguage?.code || conversationLanguage || '';
  const isRomanceLang = romanceLanguageCodes.has(_earlyLangCode);
  const genderContextEnhanced = isRomanceLang && userGender !== 'unknown'
    ? `${genderContext} IMPORTANT for grammar: the sender is ${userGender} — all adjectives, past participles and self-referential words must use ${userGender === 'male' ? 'masculine' : userGender === 'female' ? 'feminine' : 'neutral'} agreement (e.g. Italian: "sono stanco/stanca", Spanish: "estoy cansado/cansada").`
    : genderContext;

  const myNameLabel = settings.userProfile?.name ? `Your name is ${settings.userProfile.name}. ` : '';
  const styleEnhancement = await (async () => {
    try {
      const storage = await chrome.storage.local.get('remoteStyleEnhancements');
      if (storage.remoteStyleEnhancements && storage.remoteStyleEnhancements[chattingStyle]) {
        return `\n\n${storage.remoteStyleEnhancements[chattingStyle]}`;
      }
    } catch (_) {}
    return (typeof STYLE_ENHANCEMENTS !== 'undefined' && STYLE_ENHANCEMENTS[chattingStyle])
      ? `\n\n${STYLE_ENHANCEMENTS[chattingStyle]}`
      : '';
  })();
  // identityPrefix intentionally does NOT include the identity sentence ("You are X looking for Y on Z").
  // That sentence lives in the Supabase prompt via {{Chatting style}}, {{My intention}}, {{Platform}}
  // so admins can edit it from the admin panel without a code deploy.
  // identityPrefix only injects: name (if set) + emoji rule + style examples.
  const namePrefix = myNameLabel ? `${myNameLabel}\n\n` : '';

  // Inject trained chat style profile — per-language, example-first so AI mirrors real voice
  const styleProfileBlock = await (async () => {
    try {
      const stored = await chrome.storage.local.get(['userSettings', 'remoteStyleTrainingConfig']);

      // ── Remote injection limits (fall back to hardcoded defaults) ───────────
      const rtc = stored?.remoteStyleTrainingConfig || {};
      const maxSlangTokens           = (typeof rtc.maxSlangTokens           === 'number') ? rtc.maxSlangTokens           : 10;
      const maxExamplesToInject      = (typeof rtc.maxExamplesToInject      === 'number') ? rtc.maxExamplesToInject      : 3;
      const maxInjectionExampleChars = (typeof rtc.maxInjectionExampleChars === 'number') ? rtc.maxInjectionExampleChars : 200;
      const crossLanguageFallback    = (typeof rtc.crossLanguageFallbackEnabled === 'boolean') ? rtc.crossLanguageFallbackEnabled : true;

      // ── Resolve the best profile for this conversation ──────────────
      // Priority: exact language match → any trained profile (traits-only fallback)
      const profiles = stored?.userSettings?.chatStyleProfiles || {};

      // Legacy single-profile migration fallback (in case background runs before popup migrates)
      const legacy = stored?.userSettings?.chatStyleProfile;
      if (legacy?.trained) {
        const legacyLang = legacy.trainingLanguage || 'en';
        if (!profiles[legacyLang]) profiles[legacyLang] = legacy;
      }

      const matchLangCode = matchData?.detectedLanguage?.code || conversationLanguage || 'auto';

      // Find exact match first
      let profile = matchLangCode !== 'auto' ? profiles[matchLangCode] : null;
      let languagesMatch = !!profile?.trained;

      // If no exact match, fall back to any trained profile for traits-only injection
      if (!profile?.trained) {
        if (crossLanguageFallback) {
          const anyTrained = Object.values(profiles).find(p => p?.trained);
          if (anyTrained) {
            profile = anyTrained;
            languagesMatch = false; // traits only, no examples or slang
          }
        }
      }

      if (!profile?.trained) return '';

      const slangNote = languagesMatch && profile.slangUsed?.length
        ? `\nThey use these words naturally: ${
            profile.slangUsed
              .filter(s => typeof s === 'string' && /^[a-z]{2,12}$/i.test(s))
              .slice(0, maxSlangTokens)
              .join(', ')
          }.`
        : '';

      const traits = [
        profile.length === 'short'  ? 'very short messages (1 sentence)' :
        profile.length === 'medium' ? 'medium-length messages (1-2 sentences)' :
                                      'longer, more detailed messages',
        profile.emoji === 'none'    ? 'no emoji at all' :
        profile.emoji === 'light'   ? 'occasional emoji (1 max)' :
        profile.emoji === 'moderate'? 'moderate emoji use' : 'emoji-heavy style',
        profile.tone === 'playful-casual' ? 'playful and casual — uses lol/haha/omg' :
        profile.tone === 'formal'         ? 'slightly formal, proper punctuation'   :
                                            'casual, relaxed texting style',
        profile.asksQuestions ? 'often asks a question back' : 'mostly makes statements, rarely asks questions',
        profile.skipsPunctuation ? 'skips periods at end of sentences like real texters do' : '',
      ].filter(Boolean).join(', ');

      // Only include raw examples when languages match exactly.
      // 'auto' means we don't know the match's language yet — don't risk injecting
      // language-specific examples that could conflict with the language instruction.
      let exampleBlock = '';
      if (languagesMatch && profile.examples?.length) {
        const exampleLines = profile.examples
          .slice(0, maxExamplesToInject)
          .map(e => String(e).slice(0, maxInjectionExampleChars))
          .filter(e => e.trim().length >= 4)
          .map(e => `"${e}"`)
          .join('\n');
        if (exampleLines) {
          exampleBlock = `Study these real examples of how they text:\n${exampleLines}\n\n`;
        }
      }

      if (!traits && !exampleBlock) return '';

      return `\n\nCRITICAL — VOICE MATCHING: You must write exactly like this person. ${exampleBlock}Their style: ${traits}.${slangNote}\nMatch their rhythm, message length, punctuation habits, and energy exactly. Do NOT smooth it out or make it sound more polished.`;
    } catch (_) { return ''; }
  })();

  const identityPrefix = `${namePrefix}${emojiGuidance}${styleEnhancement}${styleProfileBlock}\n\n`;

  // ── Contact details block — injected on conversation/datesetup/moveoffapp only ──
  // Built here, applied conditionally at each return point below.
  const _isMoveToTelegramGoal  = (settings.stopConditions || []).includes('move_to_telegram');
  const _isMoveToInstagramGoal = (settings.stopConditions || []).includes('move_to_instagram');
  const _isMoveToTangoGoal     = (settings.stopConditions || []).includes('move_to_tango');
  const _moveOffAppState       = matchData?.moveOffAppState || { state: 'idle', offeredPlatforms: [], persuasionCount: 0, lastOfferedPlatform: null };
  const contactDetailsBlock = await (async () => {
    try {
      const cd = settings.contactDetails;
      if (!cd || typeof cd !== 'object') return '';
      const lines = [];
      // Instagram and Telegram and Tango are active — other fields remain disabled
      const fieldLabels = {
        instagram: 'MY_INSTAGRAM',
        // whatsapp:  'MY_WHATSAPP',   // disabled
        // phone:     'MY_PHONE',       // disabled
        telegram:  'MY_TELEGRAM',
        tango:     'MY_TANGO',
        // snapchat:  'MY_SNAPCHAT',   // disabled
      };
      for (const [field, label] of Object.entries(fieldLabels)) {
        const entry = cd[field];
        if (!entry?.enabled || !entry?.value?.trim()) continue;
        const val = entry.value.trim();
        if (field === 'phone' || field === 'whatsapp') {
          const digits = val.replace(/\D/g, '');
          if (digits.length < 6) continue;
        }
        if (field === 'instagram' || field === 'telegram' || field === 'snapchat') {
          if (val.replace(/\s/g, '').length < 3) continue;
        }
        lines.push(`${label}: ${val}`);
      }
      if (!lines.length) return '';

      // Use remote admin-configured rules if available, otherwise use hardcoded default
      let sharingRules;
      try {
        const storage = await chrome.storage.local.get('remoteContactSharingRules');
        sharingRules = storage.remoteContactSharingRules?.rules?.trim() || null;
      } catch (_) {}

      // ── State machine override — fires before goal-specific blocks ──
      // When in persuasion or escalation mode, the contact block reflects the current state
      if (!sharingRules && _moveOffAppState.state !== 'idle') {
        const lastPlatform = _moveOffAppState.lastOfferedPlatform;
        const lastHandle = lastPlatform ? lines.find(l => l.startsWith(`MY_${lastPlatform.toUpperCase()}:`))?.split(': ')[1]?.trim() : null;
        const maxPersuasion = settings.moveOffAppMaxPersuasion ?? 2;
        const persuasionCount = _moveOffAppState.persuasionCount || 0;

        if (_moveOffAppState.state === 'persuading' && lastHandle) {
          const attemptsLeft = maxPersuasion - persuasionCount;
          const persuasionRules = [
            `PERSUASION MODE: You already shared your ${lastPlatform} handle once. The match said they don't use it — but they already have the handle.`,
            `Do NOT repeat the handle again. They have it.`,
            `YOUR ONE JOB THIS MESSAGE: Nudge them toward ${lastPlatform}. This MUST be in your reply somewhere — even one short line.`,
            `If the match said "text me" or is being forward/explicit — use that energy: "sounds interesting, easier to continue on ${lastPlatform} tbh" or "this conversation needs to move to ${lastPlatform}".`,
            `If they're being neutral — weave it in warmly: "just give ${lastPlatform} a quick try, worth it".`,
            `Do NOT just chat normally without mentioning ${lastPlatform} — that defeats the purpose.`,
            `Do NOT sound like an ad. One natural line only.`,
            `Only share the handle again if they explicitly ask for it.`,
            attemptsLeft <= 1 ? `This is your last attempt — make it count, then drop it forever.` : `Keep it casual and warm.`,
          ].join(' ');
          return `\n\nMY CONTACT DETAILS:\n${lines.join('\n')}\n${persuasionRules}`;
        }

        // Escalation state — offering a different platform than the primary
        const offeringMatch = _moveOffAppState.state.match(/^offering_(.+)$/);
        if (offeringMatch) {
          const targetPlatform = offeringMatch[1];
          const targetHandle = lines.find(l => l.startsWith(`MY_${targetPlatform.toUpperCase()}:`))?.split(': ')[1]?.trim();
          if (targetHandle) {
            const escalationRules = [
              `ESCALATION: They rejected ${lastPlatform}. Now offer ${targetPlatform} as an alternative.`,
              `Slip it naturally into your reply: "if you don't use ${lastPlatform}, maybe ${targetPlatform}? I'm MY_${targetPlatform.toUpperCase()} there".`,
              `Keep it casual — one sentence, same tone.`,
              `Once they accept ${targetPlatform}, you're done.`,
            ].join(' ');
            return `\n\nMY CONTACT DETAILS:\n${lines.join('\n')}\n${escalationRules}`;
          }
        }
      }

      // ── Proactive Telegram-push mode ──
      // Active when the user's primary goal is "Move to Telegram".
      // Replaces the passive "only share when asked" rules with active steering rules.
      if (_isMoveToTelegramGoal && !sharingRules) {
        const minMessages    = settings.moveOffAppMinMessages ?? 0;
        const pushAllMatches = settings.moveOffAppPushAllMatches === true;
        const msgCount       = (matchData?.conversationHistory || []).filter(m => m.sender === 'user').length;

        // ── Randomised nudge threshold ──
        // User sets a min–max range (e.g. 5–8). We pick a per-match random threshold
        // within that range so every conversation feels different. Seeded by matchId
        // so the threshold stays consistent across cycles for the same match.
        const maxMessages = settings.moveOffAppMaxMessages ?? 0;
        let effectiveMinMessages = minMessages;
        if (minMessages > 0) {
          const _idSeed = String(matchData?.id || '').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
          const _range = (maxMessages > minMessages) ? (maxMessages - minMessages) : 3; // fallback +0–3
          effectiveMinMessages = minMessages + (Math.abs(_idSeed) % (_range + 1));
        }

        // If Telegram handle isn't filled/enabled, skip this goal entirely
        const telegramValue = lines.find(l => l.startsWith('MY_TELEGRAM:'))?.split(': ')[1]?.trim();
        if (!telegramValue) {
          // Fall through to Instagram goal check below
        } else {
        const alreadyShared = telegramValue && matchData?.conversationHistory?.some(
          m => m.sender === 'user' && m.text && m.text.includes(telegramValue)
        );

        // If already shared — don't drop the handle again, just nudge once or chat naturally
        if (alreadyShared) {
          // Check if the match has replied after we shared (any reply = they saw it)
          const sharedIdx = matchData.conversationHistory.findLastIndex(
            m => m.sender === 'user' && m.text && m.text.includes(telegramValue)
          );
          const matchRepliedAfterShare = sharedIdx >= 0 &&
            matchData.conversationHistory.slice(sharedIdx + 1).some(m => m.sender !== 'user');

          if (matchRepliedAfterShare) {
            // Check if we already sent a nudge message after sharing the handle
            const nudgePhrases = ['find me on telegram', 'did you find me', 'drop me a message there', 'message me on telegram', 'reach me on telegram'];
            const alreadyNudged = matchData.conversationHistory
              .slice(sharedIdx + 1)
              .filter(m => m.sender === 'user')
              .some(m => nudgePhrases.some(p => (m.text || '').toLowerCase().includes(p)));

            if (alreadyNudged) {
              // Already nudged — just chat normally, never mention Telegram again
              return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\nTELEGRAM HANDLE ALREADY SHARED & NUDGED: Do NOT mention Telegram again. Just reply naturally and keep the conversation going.`;
            }
            // They replied after seeing the handle — ask once if they got it, then just chat
            const nudgeRules = `TELEGRAM SHARED & MATCH REPLIED: You already shared your Telegram handle. Ask once naturally if they got it — e.g. "did you find me on Telegram?" or "drop me a message there when you get a chance". After asking once, just chat normally. Do NOT keep repeating the handle.`;
            return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${nudgeRules}`;
          } else {
            // We shared but they haven't replied yet — just chat naturally, no repeat
            const doneRules = `TELEGRAM ALREADY SHARED: You already gave them your Telegram handle. Do NOT mention it again this message. Just reply naturally and keep the conversation going.`;
            return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${doneRules}`;
          }
        }

        // If not enough messages yet, stay passive regardless of Push ON/OFF
        if (msgCount < effectiveMinMessages && effectiveMinMessages > 0) {
          const passiveRules = [
            `TELEGRAM GOAL — building rapport (${msgCount}/${effectiveMinMessages} messages):`,
            `Not enough messages yet to bring up Telegram. Keep the conversation going naturally in your usual tone.`,
            `Do NOT mention Telegram or any contact info yet. Just focus on the connection.`,
          ].join(' ');
          return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${passiveRules}`;
        }

        // Build fallback line — if Instagram or Tango is also available, offer when match rejects Telegram
        const instagramFallbackValue = lines.find(l => l.startsWith('MY_INSTAGRAM:'))?.split(': ')[1]?.trim();
        const tangoFallbackValueForTG = lines.find(l => l.startsWith('MY_TANGO:'))?.split(': ')[1]?.trim();
        const telegramFallbackLine = instagramFallbackValue || tangoFallbackValueForTG
          ? `If they say they don't have Telegram or prefer something else, offer your other handle(s): ${[instagramFallbackValue ? 'MY_INSTAGRAM' : '', tangoFallbackValueForTG ? 'MY_TANGO' : ''].filter(Boolean).join(' or ')}.`
          : `If they ask for a different platform, still give Telegram — it's your primary.`;

        const proactiveRules = pushAllMatches
          ? [
              `REPLY TO THE CONVERSATION FIRST: Whatever they said — confusion, question, joke, or silence — address it genuinely in your reply. That comes first. Do NOT skip past what they said.`,
              `THEN, at the end of your reply: casually drop your Telegram handle in one short line. e.g. "btw i'm more on Telegram — MY_TELEGRAM, easier than this app".`,
              `The handle is a footnote, not the headline. Your reply should read naturally — someone who happens to mention Telegram in passing, not someone whose only goal is to give out their handle.`,
              `If they seem confused, frustrated, or are asking a real question — answer it properly first. Then add the Telegram line after.`,
              telegramFallbackLine,
            ].join(' ')
          : [
              `You're here to genuinely connect — be curious, flirty, and real with this person.`,
              `You also happen to prefer Telegram over this app — mention it naturally when the moment feels right.`,
              `WHEN: Once there's any real warmth or interest going both ways — that's your cue. Don't overthink it.`,
              `STRONG SIGNALS to drop it immediately: match asks for your number, asks to call, mentions WhatsApp or any other platform, or shows clear interest in continuing off-app.`,
              `HOW: One casual line in your reply. e.g. "btw i'm barely on here, easier to reach me on Telegram — MY_TELEGRAM" or just drop it after something fun they said.`,
              `If they mention WhatsApp, ask for a call, or any other platform — redirect: "I'm mainly on Telegram, here: MY_TELEGRAM".`,
              telegramFallbackLine,
              `Once they have it, move on — don't keep bringing it up.`,
              `One mention per message max. Keep it natural.`,
            ].join(' ');

        return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${proactiveRules}`;
        } // end else (telegramValue exists)
      } // end if (_isMoveToTelegramGoal)
      if (_isMoveToInstagramGoal && !sharingRules) {
        const minMessages    = settings.moveOffAppMinMessages ?? 0;
        const pushAllMatches = settings.moveOffAppPushAllMatches === true;
        const msgCount       = (matchData?.conversationHistory || []).filter(m => m.sender === 'user').length;

        const instagramValue = lines.find(l => l.startsWith('MY_INSTAGRAM:'))?.split(': ')[1]?.trim();
        // If Instagram handle isn't filled/enabled, skip — fall through to passive default
        if (instagramValue) {
        const alreadySharedIG = matchData?.conversationHistory?.some(
          m => m.sender === 'user' && m.text && m.text.includes(instagramValue)
        );

        if (alreadySharedIG) {
          const igSharedIdx = matchData.conversationHistory.findLastIndex(
            m => m.sender === 'user' && m.text && m.text.includes(instagramValue)
          );
          const igMatchReplied = igSharedIdx >= 0 &&
            matchData.conversationHistory.slice(igSharedIdx + 1).some(m => m.sender !== 'user');
          if (igMatchReplied) {
            return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\nINSTAGRAM SHARED & MATCH REPLIED: Ask once naturally if they found you — e.g. "did you follow me on Instagram?" then just chat normally. Do NOT repeat the handle.`;
          } else {
            return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\nINSTAGRAM ALREADY SHARED: You already gave them your Instagram handle. Do NOT mention it again this message. Just reply naturally.`;
          }
        }

        // Per-match jitter using user-defined min–max range (same seed as Telegram)
        const _igIdSeed = String(matchData?.id || '').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
        const _igMaxMessages = settings.moveOffAppMaxMessages ?? 0;
        const _igRange = (_igMaxMessages > minMessages) ? (_igMaxMessages - minMessages) : 3;
        const effectiveMinMessagesIG = minMessages > 0 ? minMessages + (Math.abs(_igIdSeed) % (_igRange + 1)) : 0;

        if (msgCount < effectiveMinMessagesIG && effectiveMinMessagesIG > 0) {
          const passiveRules = [
            `INSTAGRAM GOAL — building rapport (${msgCount}/${effectiveMinMessagesIG} messages):`,
            `Not enough messages yet to bring up Instagram. Keep the conversation going naturally in your usual tone.`,
            `Do NOT mention Instagram or any contact info yet. Just focus on the connection.`,
          ].join(' ');
          return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${passiveRules}`;
        }

        // Build fallback line — if Telegram or Tango is also available, offer when match rejects Instagram
        const telegramFallbackForIG = lines.find(l => l.startsWith('MY_TELEGRAM:'))?.split(': ')[1]?.trim();
        const tangoFallbackValueForIG = lines.find(l => l.startsWith('MY_TANGO:'))?.split(': ')[1]?.trim();
        const instagramFallbackLine = telegramFallbackForIG || tangoFallbackValueForIG
          ? `If they say they don't have Instagram or prefer something else, offer your other handle(s): ${[telegramFallbackForIG ? 'MY_TELEGRAM' : '', tangoFallbackValueForIG ? 'MY_TANGO' : ''].filter(Boolean).join(' or ')}.`
          : `If they ask for a different platform, still give Instagram — it's your primary.`;

        const igProactiveRules = pushAllMatches
          ? [
              `REPLY TO THE CONVERSATION FIRST: Whatever they said — confusion, question, joke, or silence — address it genuinely in your reply. That comes first. Do NOT skip past what they said.`,
              `THEN, at the end of your reply: casually drop your Instagram handle in one short line. e.g. "btw find me on insta — MY_INSTAGRAM, easier than this app".`,
              `The handle is a footnote, not the headline. Your reply should read naturally — someone who happens to mention Instagram in passing, not someone whose only goal is to give out their handle.`,
              `If they seem confused, frustrated, or are asking a real question — answer it properly first. Then add the Instagram line after.`,
              instagramFallbackLine,
              `Once they have your Instagram, stop pushing — you're done.`,
            ].join(' ')
          : [
              `You're here to genuinely connect — be curious, flirty, and real with this person.`,
              `You also happen to prefer Instagram over this app — mention it naturally when the moment feels right.`,
              `WHEN: Once there's any real warmth or interest going both ways — that's your cue.`,
              `STRONG SIGNALS to drop it immediately: match asks for your number, asks to call, mentions WhatsApp or any other platform, or shows clear interest in continuing off-app.`,
              `HOW: One casual line in your reply. e.g. "find me on insta — MY_INSTAGRAM" or drop it after something fun they said.`,
              `If they mention WhatsApp, ask for a call, or any other platform — redirect: "I'm mainly on Instagram, here: MY_INSTAGRAM".`,
              instagramFallbackLine,
              `Once they have it, move on — don't keep bringing it up.`,
              `One mention per message max. Keep it natural.`,
            ].join(' ');

        return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${igProactiveRules}`;
        } // end if (instagramValue)
      } // end if (_isMoveToInstagramGoal)

      // ── Proactive Tango-push mode ──
      if (_isMoveToTangoGoal && !sharingRules) {
        const minMessages    = settings.moveOffAppMinMessages ?? 0;
        const pushAllMatches = settings.moveOffAppPushAllMatches === true;
        const msgCount       = (matchData?.conversationHistory || []).filter(m => m.sender === 'user').length;

        const tangoValue = lines.find(l => l.startsWith('MY_TANGO:'))?.split(': ')[1]?.trim();
        if (tangoValue) {
          const alreadySharedTango = matchData?.conversationHistory?.some(
            m => m.sender === 'user' && m.text && m.text.includes(tangoValue)
          );

          if (alreadySharedTango) {
            const tangoSharedIdx = matchData.conversationHistory.findLastIndex(
              m => m.sender === 'user' && m.text && m.text.includes(tangoValue)
            );
            const tangoMatchReplied = tangoSharedIdx >= 0 &&
              matchData.conversationHistory.slice(tangoSharedIdx + 1).some(m => m.sender !== 'user');
            if (tangoMatchReplied) {
              return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\nTANGO SHARED & MATCH REPLIED: Ask once naturally if they found you on Tango — then just chat normally. Do NOT repeat the handle.`;
            } else {
              return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\nTANGO ALREADY SHARED: You already gave them your Tango username. Do NOT mention it again this message. Just reply naturally.`;
            }
          }

          // Per-match jitter using user-defined min–max range (same seed as Telegram/Instagram)
          const _tgIdSeed = String(matchData?.id || '').split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
          const _tangoMaxMessages = settings.moveOffAppMaxMessages ?? 0;
          const _tangoRange = (_tangoMaxMessages > minMessages) ? (_tangoMaxMessages - minMessages) : 3;
          const effectiveMinMessagesTango = minMessages > 0 ? minMessages + (Math.abs(_tgIdSeed) % (_tangoRange + 1)) : 0;

          if (msgCount < effectiveMinMessagesTango && effectiveMinMessagesTango > 0) {
            const passiveRules = [
              `TANGO GOAL — building rapport (${msgCount}/${effectiveMinMessagesTango} messages):`,
              `Not enough messages yet to bring up Tango. Keep the conversation going naturally in your usual tone.`,
              `Do NOT mention Tango or any contact info yet. Just focus on the connection.`,
            ].join(' ');
            return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${passiveRules}`;
          }

          // Build fallback — offer Telegram or Instagram if match doesn't have Tango
          const tangoFallbacks = lines.filter(l => !l.startsWith('MY_TANGO:')).map(l => l.split(': ')[0] + ': ' + l.split(': ')[1]).join(', ');
          const tangoFallbackLine = tangoFallbacks
            ? `If they say they don't have Tango, offer your other handles: ${tangoFallbacks}.`
            : `If they ask for a different platform, still give Tango — it's your primary.`;

          const tangoProactiveRules = pushAllMatches
            ? [
                `REPLY TO THE CONVERSATION FIRST: Whatever they said — confusion, question, joke, or silence — address it genuinely in your reply. That comes first. Do NOT skip past what they said.`,
                `THEN, at the end of your reply: casually drop your Tango handle in one short line. e.g. "btw find me on Tango — MY_TANGO, easier to chat there".`,
                `The handle is a footnote, not the headline. Your reply should read naturally — someone who happens to mention Tango in passing, not someone whose only goal is to give out their handle.`,
                `If they seem confused, frustrated, or are asking a real question — answer it properly first. Then add the Tango line after.`,
                tangoFallbackLine,
                `Once they have your Tango, stop pushing — you're done.`,
              ].join(' ')
            : [
                `You're here to genuinely connect — be curious, flirty, and real with this person.`,
                `You also happen to prefer Tango over this app — mention it naturally when the moment feels right.`,
                `WHEN: Once there's any real warmth or interest going both ways — that's your cue.`,
                `STRONG SIGNALS to drop it immediately: match asks for your number, asks to call, mentions WhatsApp or any other platform, or shows clear interest in continuing off-app.`,
                `HOW: One casual line in your reply. e.g. "find me on Tango — MY_TANGO" or drop it after something fun they said.`,
                `If they mention WhatsApp, ask for a call, or any other platform — redirect: "I'm mainly on Tango, here: MY_TANGO".`,
                tangoFallbackLine,
                `Once they have it, move on — don't keep bringing it up.`,
                `One mention per message max. Keep it natural.`,
              ].join(' ');

          return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${tangoProactiveRules}`;
        } // end if (tangoValue)
      } // end if (_isMoveToTangoGoal)
      // Default: dense, imperative, covers all 7 failure modes, ~85 tokens.
      // Positioned last in the system prompt for peak end-of-prompt model attention.
      const defaultRules = [
        `CONTACT SHARING — read before replying:`,
        `Share only when: match directly asks ("what's your number/insta/snap/etc") OR a specific meetup plan is actively being confirmed.`,
        `Never share when: no meetup discussed yet, match vaguely says "maybe we'll exchange numbers", or you already shared it this conversation (if asked again, just repeat the value casually — don't re-announce it).`,
        `Always share exactly ONE detail — the platform they asked for. If they ask generically, use MY_TELEGRAM only.`,
        // Commented out old priority order: MY_WHATSAPP → MY_INSTAGRAM → MY_PHONE → MY_TELEGRAM → MY_SNAPCHAT
        `If the platform they asked for isn't available, naturally offer your Telegram instead: e.g. "not really on snap but you can reach me on Telegram — [value]".`,
        `Phrase it like a real person texting, not a form. GOOD: "yeah text me on whatsapp — [value], easier than this app" BAD: "My WhatsApp number is [value]".`,
        `Never list more than one detail per message — even if directly asked to share all of them.`,
      ].join(' ');

      return `\n\nMY CONTACT DETAILS (use per rules below):\n${lines.join('\n')}\n${sharingRules || defaultRules}`;
    } catch (_) { return ''; }
  })();

  // Per-match language override
  // Only inject a hard language instruction when we have HIGH confidence detection.
  // Low confidence or 'latin_fallback' detections are worse than letting GPT self-detect.
  const detectedLang = matchData?.detectedLanguage;
  const detectionConfidence = detectedLang?.confidence || 0;
  const detectionSource = detectedLang?.source || '';
  const isLowConfidence = detectionSource.includes('latin_fallback') ||
    detectionSource.includes('latin_english_default') ||
    // For script-based detections (Hebrew, Arabic, Cyrillic, CJK etc.) trust even low confidence
    // — the script itself is unambiguous. Only apply strict threshold to Latin-script detections.
    (detectionConfidence < 50 && detectionSource.includes('word_patterns'));

  const effectiveLangCode = (!isLowConfidence && detectedLang?.code)
    ? detectedLang.code
    : conversationLanguage || 'auto';

  // Only inject a hard language name if:
  // 1. We have a high-confidence detected language, OR
  // 2. User explicitly set a non-English default AND there's no conflicting detection
  const shouldForceLanguage = detectedLang?.code && !isLowConfidence;
  const userSetNonEnglish = conversationLanguage && conversationLanguage !== 'en' && conversationLanguage !== 'auto';

  let languageName = null;
  if (shouldForceLanguage) {
    languageName = detectedLang.name || LANGUAGE_CODE_MAP[detectedLang.code] || null;
  } else if (userSetNonEnglish && !detectedLang?.code) {
    // User explicitly chose a language and we have no detection at all — respect their choice
    languageName = LANGUAGE_CODE_MAP[conversationLanguage] || null;
  }

  // ── Language instruction strategy ──
  // Simple two-tier architecture:
  // 1. MANUAL override (user picked from dropdown) → hard-force, non-negotiable
  // 2. Everything else → SOFT HINT only
  //
  // Rationale: GPT-4o is a language model. It reads the conversation and knows what
  // language the match is writing in — far more reliably than any regex or stored result.
  // Hard-forcing a detected language (even non-Latin scripts) causes the exact bug seen:
  // bio detects Hebrew from Daniel's profile → stored as Hebrew → hard-forces Hebrew
  // → AI writes Hebrew to an English-speaking match.
  // Soft hint = AI uses the hint IF it matches the conversation, ignores it if it doesn't.
  // Manual override = user explicitly chose, AI must obey.

  const isManualOverride = detectedLang?.source === 'manual';
  const shouldHardForce = isManualOverride;

  const languageInstruction = shouldHardForce && languageName
    ? `\n\nIMPORTANT: Write your entire message in ${languageName}. Every word must be in ${languageName}.`
    : languageName
    ? `\n\nLANGUAGE HINT: The match may be writing in ${languageName} — but read the conversation above and reply in whatever language they're actually using. Always trust the conversation over this hint.`
    : `\n\nIMPORTANT: Look at the conversation history and reply in the same language the match is using. Match their language exactly — do not switch.`;

  const slangGuidance = await getSlangGuidance(effectiveLangCode, chattingStyle);
  const placeholderGuard = `\n\nSAFETY: NEVER use brackets [] or placeholders like [city], [name], [location] in your response. Real humans never text with brackets — skip the detail or be vague instead. Never use em dashes (—) or en dashes (–), use a comma instead. Do not end every sentence with a full stop — real texters skip the period at the end of a message or use minimal punctuation. Do NOT capitalize the first letter of every sentence — only capitalize proper nouns and 'I'. Write like one natural flowing message, not multiple formal sentences.`;

  // Fix 4 — conversation arc signal: tells the AI where in the conversation arc we are.
  // 8 tokens, meaningfully changes behavior — early stage stays light, late stage can push to meet.
  const msgCount = matchData?.conversationHistory?.length || 0;
  const conversationStage = msgCount <= 2
    ? `[Stage: opening — keep it light and curious, build interest]`
    : msgCount <= 6
    ? `[Stage: building rapport — deepen the conversation, show personality]`
    : msgCount <= 12
    ? `[Stage: established — can suggest meeting or escalate naturally]`
    : `[Stage: ongoing — keep momentum, push toward a meetup if not arranged yet]`;

  // Determine which mode to use
  let mode = 'intro';
  const hasConversation = matchData && matchData.conversationHistory && matchData.conversationHistory.length > 0;

  if (isFollowUp) {
    mode = 'followup';
  } else if (hasConversation) {
    mode = 'conversation';
  }

  // Contact details only injected on modes where sharing contact info makes sense.
  // For move_to_telegram goal, inject on ALL modes so the AI knows the mission from message 1.
  const _contactModes = new Set(['conversation', 'datesetup', 'moveoffapp', 'exit']);
  const effectiveContactBlock = (_contactModes.has(mode) || _isMoveToTelegramGoal || _isMoveToInstagramGoal || _isMoveToTangoGoal) ? contactDetailsBlock : '';

  // Arc signal only on conversation/datesetup/moveoffapp — not intro or followup
  const _arcModes = new Set(['conversation', 'datesetup', 'moveoffapp']);
  const effectiveArcSignal = _arcModes.has(mode) ? `\n${conversationStage}` : '';

  // ── Match Style Mirror ──
  // Industry-grade: show the AI concrete examples of HOW the match texts (show, don't tell).
  // Controls FORMAT only (length, punctuation, capitalization) — NOT personality/content.
  // Chatting style still controls personality. This controls how it's delivered.
  // Positioned late in the prompt for maximum model attention.
  const matchStyleMirror = (() => {
    try {
      if (!matchData?.conversationHistory?.length) return '';
      const matchMsgs = matchData.conversationHistory
        .filter(m => (m.sender === 'match' || (m.sender !== 'user' && m.sender !== 'me')) && m.text && m.text.trim().length >= 2)
        .slice(-4)
        .map(m => m.text.trim());

      if (typeof DEBUG_ENABLED !== 'undefined' && DEBUG_ENABLED) {
        console.log('[FlirtEasy AI] 🪞 Match Style Mirror — senders:', matchData.conversationHistory.slice(-4).map(m => m.sender + ':' + m.text?.substring(0,20)));
        console.log('[FlirtEasy AI] 🪞 Match msgs found:', matchMsgs);
      }

      if (matchMsgs.length === 0) return '';

      const examples = matchMsgs.map(m => `"${m}"`).join(', ');

      // GPT-4o native style observation — no heuristics.
      // The model reads the examples directly and mirrors them.
      // Chatting style (personality) is set in the main template above.
      // This instruction only controls delivery format.
      return `\n\nMATCH TEXTING STYLE:\nHere are the match's last messages: ${examples}\nStudy how they text — their message length, word count, whether they use slang or mix languages, how casual or punchy they are, their punctuation habits. Your reply must MATCH their delivery format exactly. If they send 3-word messages, you send 3-5 words. If they text in bursts of short lines, keep it short. Your personality stays yours — but the FORMAT and LENGTH must mirror theirs. Never write longer or more formally than they do.`;
    } catch (_) { return ''; }
  })();

  // 1. Custom prompt (Level 3) — user explicitly enabled a custom prompt for this mode in popup
  // ── DEBUG: log full prompt to background console (DEBUG_ENABLED only) ──
  const _debugPrompt = (label, prompt) => {
    if (typeof DEBUG_ENABLED !== 'undefined' && DEBUG_ENABLED) {
      console.log('[FlirtEasy AI] 📋 FULL SYSTEM PROMPT (' + label + ', mode=' + mode + ', msgCount=' + msgCount + '):\n' + prompt);
    }
    return prompt;
  };

  const modeConfig = promptModes?.[mode];
  if (modeConfig?.useCustom && modeConfig?.customPrompt && modeConfig.customPrompt.trim().length > 0) {
    return _debugPrompt('custom', identityPrefix + modeConfig.customPrompt.trim() + effectiveArcSignal + matchStyleMirror + languageInstruction + placeholderGuard + effectiveContactBlock + '\n\nIMPORTANT: Output ONLY the message text itself.');
  }

  // ── Female intro fast-path: bypass remote prompt entirely ──
  // On Bumble, female accounts send first and men respond to anything.
  // A simple warm greeting is all that's needed — no clever opener required.
  // This runs BEFORE the remote prompt so it can't be overridden by admin panel changes.
  if (mode === 'intro' && userGender === 'female') {
    const _femaleIntroPrompt = `You are ${style} looking for ${goal} on ${platformName}. ${slangGuidance}\n\nSend a short casual greeting to a new match. Keep it natural to your style. Output ONLY the greeting. Nothing else. Max 5 words.`;
    return _debugPrompt('female-intro-simple', _femaleIntroPrompt + languageInstruction);
  }

  // 2. Smart default system — always runs now (remote Supabase → local hardcoded fallback).
  const smartPrompt = await getSmartDefaultPrompt(mode);
  const isRealSmartPrompt = smartPrompt && smartPrompt !== "You are casual and friendly. Be yourself.";

  if (isRealSmartPrompt) {
    const defaultPrompt = smartPrompt
      .replace(/{{Chatting style}}/g, style)
      .replace(/{{My intention}}/g, goal)
      .replace(/{{Platform}}/g, platformName)
      .replace(/{{Gender context}}/g, genderContextEnhanced)
      .replace(/{{Slang guidance}}/g, slangGuidance);

    // Intro mode: gender-aware personality-driven opener rule
    // Female sender → teasing, her reaction > his detail, creates dynamic
    // Male sender → direct, confident, genuine curiosity, slightly bolder
    const introLengthRule = (() => {
      if (mode !== 'intro') return '';

      const senderGender = userGender; // 'male', 'female', 'non-binary', 'unknown'
      const matchName = matchData?.name || '';
      const nameHint = matchName ? `Use their name naturally — "${matchName}" — at the start.` : 'Start with "hey" if you don\'t know their name.';

      // ── FEMALE SENDER opening to a male match ──
      // On Bumble, she messages first — men will respond to almost anything.
      // Keep it dead simple: just a casual, warm greeting. No overthinking.
      if (senderGender === 'female') {
        return `\n\nCRITICAL — OPENER RULE (female sender on Bumble):\nJust send a short, casual, warm greeting. Men on Bumble respond to almost anything — you don't need to craft the perfect opener. Keep it simple and human.\n\nGOOD EXAMPLES: "hey!", "hey how's it going", "heyy", "hi there", "hey what's up"\n\nIf something in their profile is genuinely funny or catches your eye, you can mention it — but keep it to one short line max. No need to be clever. Just be warm and natural.\n\nMax 6 words. Sound like a real person saying hi.\n\n`;
      }

      // ── MALE SENDER opening to a female match ──
      // He needs to stand out from hundreds of openers she gets.
      // His energy: direct, confident, genuine curiosity — not flattery, not pickup lines.
      // He shows he actually READ her profile and has a real reaction.
      if (senderGender === 'male') {
        return `\n\nCRITICAL — OPENER PERSONALITY (male sender, read first):\n${nameHint}\n\nYou are a real man opening a conversation. She gets dozens of openers. Yours must feel like it came from someone who actually noticed something specific — not a copy-paste.\n\nYOUR ENERGY: Direct, confident, genuinely curious. Show real interest in something she said — not generic compliments. Be slightly bolder than average.\n\nHOW TO DO IT:\n- Find ONE thing in her profile that actually caught your attention\n- React with genuine curiosity or a bold take — not "love that you hike"\n- Slightly longer than a female opener is okay — you have more to prove\n- 8-14 words. Can include one natural question if it flows. No pickup lines.\n\nREAL MAN EXAMPLES (study these, don't copy):\n- "okay the Haridwar + good sleep combo tells me you've figured out something I haven't"\n- "rooftop nights and last minute flights, I'm genuinely curious what that looks like"\n- "sleep as a hobby is actually the most honest thing I've seen on here"\n- "chai and long drives, I need to know if this is a daily thing or a special occasion"\n- "a woman who knows her Sunday routine, okay that's rare and I respect it"\n- "gym plus conspiracy theories, which ones — genuinely asking"\n- "that last photo though, where was that"\n\nNOTICE: Each one shows real attention, a bit of confidence, and opens a door for her to respond naturally. Not desperate, not pickup-line-y.\n\nBAD (never do this): "hey Priya, your love for chai and long drives is amazing, what's your favourite route?" — generic summary + forced question.\n\nWrite ONE message. 8-14 words. Start with their name. Sound like a real man who noticed something.\n\n`;
      }

      // ── Fallback for unknown/non-binary ──
      return `\n\nCRITICAL OUTPUT CONSTRAINT — READ FIRST: Your ENTIRE message must be 8-14 words maximum. Structure: "hey [their name], [one short take combining 2 profile details]". RULES: (1) Pick TWO specific things from their profile and connect them in one short observation or mini-opinion. This makes it unique to them — impossible to copy-paste to someone else. (2) Have a slight opinion or playful take — not just a compliment. Create a tiny tension that makes them want to agree or disagree. (3) NO questions. NO "what\'s your favorite". (4) BAD: "hey Manan, long drives sound fun". GOOD: "hey Manan, bowling and long drives, sounds like a perfect first date blueprint". The opener must only make sense for THIS specific person.\n\n`;
    })();

    // Conversation mode: override any remote template rule that forces questions on every message
    // Check if the last user message already ended with a question — if so, this one should NOT
    const senderGender = userGender;
    const lastUserMsg = matchData?.conversationHistory?.filter(m => m.sender === 'user').slice(-1)[0]?.text || '';
    const lastWasQuestion = /\?$/.test(lastUserMsg.trim());
    const questionOverride = (mode !== 'intro' && mode !== 'followup' && lastWasQuestion)
      ? '\n\nOVERRIDE: Your LAST message ended with a question. Do NOT end this one with a question. React, comment, or make a statement. Ending every message with "?" is robotic and kills attraction.'
      : '';

    // Conversation mode: inject gender personality to keep replies natural and human
    const conversationPersonality = (() => {
      if (mode !== 'conversation') return '';
      if (senderGender === 'female') {
        return '\n\nFEMALE SENDER PERSONALITY — conversation mode: You are a real woman texting. Your replies have personality, not just politeness. Sometimes you agree, sometimes you push back lightly, sometimes you just react with a feeling. You don\'t answer every part of their message — pick what actually caught your attention. Real women don\'t text like customer service. Occasionally be slightly cheeky or tease them. If they say something unexpected, show genuine surprise or amusement. Never be flat or even-toned — that\'s what makes it feel fake.';
      }
      if (senderGender === 'male') {
        return '\n\nMALE SENDER PERSONALITY — conversation mode: You are a real man texting. Be direct and confident, not a pushover. Show genuine curiosity about what she says — not fake interest. If something she said is funny, react like it actually is. If something is interesting, show it. Don\'t over-explain yourself. Real men text with intention — not every message needs to be a perfectly crafted reply. Sometimes short is powerful. Stay warm but not desperate.';
      }
      return '';
    })();

    // Consecutive messages: inject format instruction when feature enabled
    const consecutiveEnabled = settings.consecutiveMessagesEnabled === true;
    const matchLastMessages = (matchData?.conversationHistory || [])
      .slice(-6)
      .filter(m => m.sender !== 'user');
    // Count consecutive match messages at the end of history
    let consecutiveMatchCount = 0;
    for (let i = (matchData?.conversationHistory || []).length - 1; i >= 0; i--) {
      const msg = matchData.conversationHistory[i];
      if (msg.sender !== 'user') consecutiveMatchCount++;
      else break;
    }
    const matchSentMultiple = consecutiveMatchCount >= 2;

    const consecutiveInstruction = (() => {
      if (!consecutiveEnabled || mode !== 'conversation') return '';
      // Always encourage split — regardless of whether match sent multiple or not.
      // AI decides intelligently whether to split based on the content of the reply.
      return `\n\nCONSECUTIVE MESSAGES MODE: You may respond with 2-3 short messages instead of one, like a real person firing off thoughts as they come. Each message must be a COMPLETE STANDALONE THOUGHT — not a chopped sentence.\n\nFORMAT: Return ONLY valid JSON:\n{"messages": ["first complete thought", "second complete thought"]}\nor with 3:\n{"messages": ["first", "second", "third"]}\nor single:\n{"messages": ["single message"]}\n\nRULES:\n- Each part: 3-12 words, standalone meaning\n- Max 3 messages\n- Split ONLY if your response genuinely has 2-3 separate beats — a reaction, then a follow-up thought, then maybe a question\n- If it's one flowing thought, keep it as 1: {"messages": ["single message"]}\n- NEVER chop one sentence into pieces\n- Good: ["okay chai AND long drives", "you've basically described my ideal evening"]\n- Bad: ["chai and long drives honestly", "sounds like the perfect combo"] — this is just one sentence split\n\nReturn JSON only. No other text.`;
    })();

    return _debugPrompt('smart-default', identityPrefix + introLengthRule + defaultPrompt + effectiveArcSignal + matchStyleMirror + languageInstruction + placeholderGuard + effectiveContactBlock + conversationPersonality + questionOverride + consecutiveInstruction);
  }

  // 3. Legacy custom preview prompt fallback
  if (settings.customizePreview && settings.customPromptPreview && settings.customPromptPreview.trim().length > 0) {
    return _debugPrompt('custom-preview', identityPrefix + settings.customPromptPreview.trim() + effectiveArcSignal + matchStyleMirror + languageInstruction + placeholderGuard + effectiveContactBlock + '\n\nIMPORTANT: Output ONLY the message text itself.');
  }

  // 4. Last resort: remote legacy templates, then hardcoded
  const legacyTemplates = await getRemoteLegacyTemplates();

  const autoTemplate = legacyTemplates.auto
    ? legacyTemplates.auto
        .replace(/{{Gender context}}/g, genderContext)
        .replace(/{{Slang guidance}}/g, slangGuidance) + languageInstruction + placeholderGuard
    : `CRITICAL - Only use facts explicitly shown in the MATCH PROFILE. Never address the match by YOUR own name. Focus on their details.\n\n${genderContext}\n\nIMPORTANT - Write like a REAL human texting:\n- Keep it SHORT (1-2 sentences max)\n- Be natural and conversational\n- ${slangGuidance}\n- Vary your style - don't be formulaic\n- Match their energy level\n- NEVER use placeholders like [your city], [location], [name] - use actual information from the conversation\n- Do NOT ask a question in every reply. Mix reactions, statements, and occasional questions — not every message ends with '?'${languageInstruction}${placeholderGuard}`;

  const followupTemplate = legacyTemplates.followup
    ? legacyTemplates.followup
        .replace(/{{Gender context}}/g, genderContext)
        .replace(/{{Slang guidance}}/g, slangGuidance) + languageInstruction + placeholderGuard
    : `CRITICAL: Only reference things from previous conversation. ${genderContext}\n\nGenerate a brief, natural follow-up message (1-2 sentences). ${slangGuidance}\n- Do NOT reflexively end with a question — sometimes just react, comment, or share something instead.${languageInstruction}${placeholderGuard}`;

  return _debugPrompt('legacy', identityPrefix + (isFollowUp ? followupTemplate : (autoTemplate + matchStyleMirror + effectiveContactBlock)));
}

// Smart default prompts for each mode
async function getSmartDefaultPrompt(mode) {
  try {
    const storage = await chrome.storage.local.get('remotePrompts');
    if (storage.remotePrompts && storage.remotePrompts[mode]) {
      return storage.remotePrompts[mode];
    }
  } catch (_) {}

  if (typeof SMART_DEFAULT_PROMPTS !== 'undefined') {
    return SMART_DEFAULT_PROMPTS[mode] || SMART_DEFAULT_PROMPTS.intro;
  }
  return "You are casual and friendly. Be yourself.";
}

async function getSlangGuidance(langCode, style = 'freestyle') {
  // ═══════════════════════════════════════════════════════════════════════════
  // INDUSTRY-GRADE FORMALITY SELECTION
  // ═══════════════════════════════════════════════════════════════════════════
  // Selects appropriate formality level based on user's chatting style.
  // This ensures Gen Z gets casual abbreviations, while professionals get
  // proper spelling - all while respecting cultural norms per language.
  
  // 🧪 TESTING MODE: Skip remote fetch, use local only
  // Set to true for local testing, false for production
  const TESTING_LOCAL_ONLY = false;
  
  // ════════════════════════════════════════════════════════════════════════
  // TESTING MODE: Force local fallback immediately
  // ════════════════════════════════════════════════════════════════════════
  if (TESTING_LOCAL_ONLY) {
    console.log(`[TESTING MODE] Using local constants for ${langCode} - ${style}`);
    
    if (typeof LANGUAGE_SLANG_GUIDE !== 'undefined') {
      const languageRules = LANGUAGE_SLANG_GUIDE[langCode] || LANGUAGE_SLANG_GUIDE.default;
      
      // If rules are an object with formality levels, select appropriate one
      if (languageRules && typeof languageRules === 'object' && !Array.isArray(languageRules)) {
        const formalityLevel = (typeof STYLE_FORMALITY_LEVELS !== 'undefined' && STYLE_FORMALITY_LEVELS[style]) 
          ? STYLE_FORMALITY_LEVELS[style] 
          : 'moderate';
        
        const result = languageRules[formalityLevel] || languageRules.moderate || languageRules.casual || '';
        console.log(`[TESTING MODE] Selected formality: ${formalityLevel}, length: ${result.length}`);
        return result;
      }
      
      // Fallback: flat string (legacy)
      return languageRules || '';
    }
    
    console.log(`[TESTING MODE] No local LANGUAGE_SLANG_GUIDE found!`);
    return '';
  }
  
  // ════════════════════════════════════════════════════════════════════════
  // PRODUCTION MODE: Use Supabase remote config
  // ════════════════════════════════════════════════════════════════════════
  try {
    const storage = await chrome.storage.local.get('remoteLanguageSlang');
    if (storage.remoteLanguageSlang) {
      const languageRules = storage.remoteLanguageSlang[langCode] || storage.remoteLanguageSlang.default;
      
      // If rules are an object with formality levels, select appropriate one
      if (languageRules && typeof languageRules === 'object' && !Array.isArray(languageRules)) {
        const formalityLevel = (typeof STYLE_FORMALITY_LEVELS !== 'undefined' && STYLE_FORMALITY_LEVELS[style]) 
          ? STYLE_FORMALITY_LEVELS[style] 
          : 'moderate';
        
        return languageRules[formalityLevel] || languageRules.moderate || languageRules.casual || '';
      }
      
      // Fallback: flat string (legacy)
      return languageRules || '';
    }
  } catch (_) {}

  // Local fallback (if Supabase unavailable)
  if (typeof LANGUAGE_SLANG_GUIDE !== 'undefined') {
    const languageRules = LANGUAGE_SLANG_GUIDE[langCode] || LANGUAGE_SLANG_GUIDE.default;
    
    // If rules are an object with formality levels, select appropriate one
    if (languageRules && typeof languageRules === 'object' && !Array.isArray(languageRules)) {
      const formalityLevel = (typeof STYLE_FORMALITY_LEVELS !== 'undefined' && STYLE_FORMALITY_LEVELS[style]) 
        ? STYLE_FORMALITY_LEVELS[style] 
        : 'moderate';
      
      return languageRules[formalityLevel] || languageRules.moderate || languageRules.casual || '';
    }
    
    // Fallback: flat string (legacy)
    return languageRules || '';
  }
  
  return '';
}

async function getRemoteLegacyTemplates() {
  try {
    const storage = await chrome.storage.local.get('remoteLegacyTemplates');
    if (storage.remoteLegacyTemplates) return storage.remoteLegacyTemplates;
  } catch (_) {}
  return {};
}

function buildUserPrompt(matchData, settings, isFollowUp) {
  const { name, bio, interests, conversationHistory } = matchData;

  // Per-match language override — matches buildSystemPrompt soft-hint strategy
  // Manual override = hard force. Everything else = soft hint so Claude doesn't
  // override GPT-4o's correct language judgment with a potentially wrong stored value.
  const effectiveLangCode = matchData?.detectedLanguage?.code || settings.conversationLanguage || 'auto';
  const languageName = matchData?.detectedLanguage?.name || LANGUAGE_CODE_MAP[effectiveLangCode] || null;
  const isManualLang = matchData?.detectedLanguage?.source === 'manual';
  const langEnforcement = isManualLang && languageName
    ? `\n\nLANGUAGE RULE (MANDATORY): You MUST reply in ${languageName} ONLY. Every single word of your reply must be in ${languageName}.`
    : languageName
    ? `\n\nLANGUAGE HINT: The match appears to be writing in ${languageName}. Preserve the language of the message you are rewriting — do not change it.`
    : `\n\nPreserve the language of the message you are rewriting exactly as-is.`;

  let prompt = '';

  if (isFollowUp) {
    // Follow-up after no reply
    const lastMessage = conversationHistory && conversationHistory.length > 0
      ? conversationHistory[conversationHistory.length - 1]
      : null;
    if (lastMessage) {
      prompt = `You previously sent: "${lastMessage.text}"\n\nThey haven't replied. Generate a light, natural follow-up.`;
    } else {
      prompt = `Generate a casual follow-up message.`;
    }
    prompt += langEnforcement;
  } else if (conversationHistory && conversationHistory.length > 0) {
    // Ongoing conversation - respond naturally
    const _nameNonLatinConv = isNonLatinName(name);
    const _langIsLatinConv = LATIN_SCRIPT_CODES.has(effectiveLangCode);
    const _displayName = (_nameNonLatinConv && (_langIsLatinConv || effectiveLangCode === 'auto')) ? 'Match' : (name || 'Match');
    prompt = `### CONVERSATION HISTORY with ${_displayName} ###\n\n`;
    conversationHistory.slice(-10).forEach(msg => {
      const speaker = msg.sender === 'user' ? 'You (The Sender)' : _displayName;
      prompt += `${speaker}: ${msg.text}\n`;
    });

    // Add user context
    const userContext = getUserContext(settings);
    if (userContext) {
      prompt += `\n### YOUR PROFILE (SENDER) ###\n${userContext}\n`;
    }

    prompt += `\nRespond naturally to ${_displayName}'s last message. Keep it conversational and human-like. Write ONLY your response text - do NOT include any name prefixes or "You:" in your response. Use actual information from the conversation, NOT placeholders.`;
    prompt += langEnforcement;
  } else {
    // Opening message
    prompt = `### RECIPIENT PROFILE (The Match) ###\n`;

    // If the match's name is in a non-Latin script (e.g. Hebrew, Thai), and the
    // target language is Latin-script OR auto-detected (unknown), do NOT pass the
    // name at all — the AI would embed it verbatim, producing mixed-script messages
    // like "hey ניקה,". Omit the NAME field entirely and add a hard constraint.
    const _nameNonLatin = isNonLatinName(name);
    const _langIsLatin = LATIN_SCRIPT_CODES.has(effectiveLangCode);
    const _suppressName = _nameNonLatin && (_langIsLatin || effectiveLangCode === 'auto');

    if (!_suppressName) {
      prompt += `NAME: ${name || 'Unknown'}\n`;
    }

    if (matchData.age) {
      prompt += `AGE: ${matchData.age}\n`;
    }

    if (bio) {
      prompt += `BIO: ${bio}\n`;
    }

    // Prompt answers / teasers — richest source of personality signals
    const qaList = matchData.questionAnswers || matchData.teasers || [];
    if (qaList.length > 0) {
      const qaFiltered = qaList
        .filter(qa => {
          const a = qa.answer || qa.description || qa;
          const aStr = String(a).trim();
          // Skip emoji-only entries
          return aStr.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\s]/gu, '').length >= 2;
        })
        .map(qa => {
          const q = qa.question || '';
          const a = qa.answer || qa.description || qa;
          return q ? `"${q}": ${a}` : String(a);
        });
      if (qaFiltered.length > 0) {
        prompt += `PROMPTS: ${qaFiltered.join(' | ')}\n`;
      }
    }

    if (interests && interests.length > 0) {
      prompt += `INTERESTS: ${interests.join(', ')}\n`;
    }

    // Job and school — useful conversation hooks
    if (matchData.job) prompt += `JOB: ${matchData.job}\n`;
    if (matchData.school) prompt += `SCHOOL: ${matchData.school}\n`;

    // Looking for — useful for tone calibration
    if (matchData.intentions) prompt += `LOOKING FOR: ${matchData.intentions}\n`;

    // Add user context
    const userContext = getUserContext(settings);
    if (userContext) {
      prompt += `\n### YOUR PROFILE (SENDER) ###\n${userContext}\n`;
    }

    if (_suppressName) {
      prompt += `\nIMPORTANT: Do NOT address the match by name in your opening message. Start with "hey" or a natural opener without any name.`;
    }

    prompt += '\nGenerate a natural opening message.';
    // No language enforcement needed for intros - system prompt is sufficient
  }

  return prompt;
}

function getUserContext(settings) {
  const aboutSource = settings.aboutSource || 'tinder';

  // Respect user's choice of "About You" source
  if (aboutSource === 'tinder') {
    // Use Tinder profile (AUTO mode)
    if (settings.userProfile) {
      const parts = [];
      const p = settings.userProfile;

      if (p.name) parts.push(`MY_NAME: ${p.name}`);
      if (p.bio) parts.push(`MY_BIO: ${p.bio}`);
      if (p.job) parts.push(`MY_JOB: ${p.job}`);
      if (p.school) parts.push(`MY_SCHOOL: ${p.school}`);
      if (p.location || p.city) parts.push(`MY_LOCATION: ${p.location || p.city}`);
      if (p.distancePreference) parts.push(`MY_DISTANCE_PREF: ${p.distancePreference}`);
      if (p.interestedIn) parts.push(`MY_INTERESTED_IN: ${p.interestedIn}`);
      if (p.lookingFor) parts.push(`MY_LOOKING_FOR: ${p.lookingFor}`);

      // Bumble specific basics and consolidated fields
      if (p.exercise || p.workout) parts.push(`MY_EXERCISE: ${p.exercise || p.workout}`);
      if (p.starSign || p.zodiac) parts.push(`MY_ZODIAC: ${p.starSign || p.zodiac}`);
      if (p.religion) parts.push(`MY_RELIGION: ${p.religion}`);
      if (p.politics) parts.push(`MY_POLITICS: ${p.politics}`);
      if (p.educationLevel || p.education) parts.push(`MY_EDUCATION: ${p.educationLevel || p.education}`);
      if (p.kids) parts.push(`MY_KIDS: ${p.kids}`);
      if (p.height) parts.push(`MY_HEIGHT: ${p.height}`);
      if (p.drinking) parts.push(`MY_DRINKING: ${p.drinking}`);
      if (p.smoking) parts.push(`MY_SMOKING: ${p.smoking}`);
      if (p.languages?.length) parts.push(`MY_LANGUAGES: ${Array.isArray(p.languages) ? p.languages.join(', ') : p.languages}`);
      if (p.communicationStyle) parts.push(`MY_COMMUNICATION: ${p.communicationStyle}`);
      if (p.loveStyle) parts.push(`MY_LOVE_STYLE: ${p.loveStyle}`);
      if (p.pets || p.userPets) parts.push(`MY_PETS: ${p.pets || p.userPets}`);
      if (p.socialMedia) parts.push(`MY_SOCIAL_MEDIA: ${p.socialMedia}`);

      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } else if (aboutSource === 'manual' || aboutSource === 'ai') {
    // Use manual text or AI-generated bio (both stored in aboutMyself)
    if (settings.aboutMyself && settings.aboutMyself.trim()) {
      return settings.aboutMyself.trim();
    }
  }

  // Fallback: Nothing available
  return null;
}

async function callOpenAI(systemPrompt, userPrompt, apiKey, settings, options = {}, retryCount = 0) {
  try {
    const hasNetwork = await checkNetworkConnectivity();
    if (!hasNetwork) {
      console.log('[Connection] No network, waiting...');
      if (typeof warn === 'function') warn('⚠️ Network lost - waiting to recover...');
      await waitForNetwork();
      if (typeof info === 'function') info('✓ Network restored - continuing...');
    }

    // --- PROXY MODE (DEFAULT) ---
    // Use centralized config to determine endpoint
    const useProxy = (typeof API_CONFIG !== 'undefined') ? API_CONFIG.USE_BACKEND_PROXY : true;
    const proxyUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG.PROXY_ENDPOINT) ? API_CONFIG.PROXY_ENDPOINT : 'https://flirteasy-auth.shnaiderdm.workers.dev/api/ai/chat';

    // If using proxy, we need the Auth Token, not the OpenAI Key
    let authToken = null;
    if (useProxy) {
      const storage = await chrome.storage.local.get('user');
      authToken = storage.user?.token;

      if (!authToken) {
        // DEV MODE: fall back to the dev bypass token so AI calls still work
        if (typeof CONFIG !== 'undefined' && CONFIG.DEV_MODE) {
          authToken = CONFIG.DEV_USER.token;
          console.log('[openai] DEV_MODE — using dev bypass token for AI proxy call.');
        } else {
          if (typeof error === 'function') error('Authentication required', 'Please log in to use AI features');
          throw new Error('Please log in to use AI features');
        }
      }
    }

    const styleParams = await getStyleAIParams(settings && settings.chattingStyle);
    const payload = {
      model: options.model || settings.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: options.max_tokens || styleParams.max_tokens,
      temperature: options.temperature !== undefined ? options.temperature : styleParams.temperature,
      ...(options.response_format ? { response_format: options.response_format } : {})
    };

    // Prepare request based on mode
    const url = useProxy ? proxyUrl : OPENAI_API_URL;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${useProxy ? authToken : apiKey}`
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s limit

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));


      // Handle Proxy/Worker specific errors
      if (useProxy) {
        if (response.status === 401) {
          if (!options._refreshAttempted) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
              return callOpenAI(systemPrompt, userPrompt, apiKey, settings, { ...options, _refreshAttempted: true }, 0);
            }
          }
          throw new Error('Session expired. Please log in again.');
        }
        if (response.status === 403) {
          const reason = errorData.error || 'Subscription required';
          if (typeof error === 'function') error('Access Denied', reason);
          throw new Error(reason);
        }
      }
      // Handle Direct OpenAI errors (Legacy)
      else if (response.status === 401) {
        throw new Error('Invalid API configuration');
      }

      // Rate limiting (Both)
      if (response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount];
          console.warn(`[AI] Rate limited, retrying in ${delay}ms...`);
          await wait(delay);
          return callOpenAI(systemPrompt, userPrompt, apiKey, settings, retryCount + 1);
        }
        throw new Error('System busy, please try again later');
      }

      throw new Error(errorData.error || errorData.message || `Connection error: ${response.status}`);
    }

    const data = await response.json();

    // Catch any error-like response even if status was 200
    const serverError = data.error || data.message || data.err || data.errorMessage;
    if (data.success === false || (serverError && !data.choices)) {
      throw new Error(serverError || 'Server failed to provide a response');
    }

    // Try multiple common nesting patterns (direct, .data, or .result)
    const choices = data.choices ||
      (data.data && data.data.choices) ||
      (data.result && data.result.choices);

    if (!choices || !choices[0] || !choices[0].message) {
      const debugInfo = JSON.stringify(data).substring(0, 100);
      console.error('[AI] Invalid structure:', data);
      throw new Error(`Unexpected AI response structure: ${debugInfo}...`);
    }

    _lastAiModelUsed = data.model || null;
    return choices[0].message.content.trim();

  } catch (err) {
    const noRetryMessages = ['Invalid API configuration', 'Please log in to use AI features', 'Session expired. Please log in again.', 'Trial message limit reached', 'Trial expired', 'Subscription required', 'Subscription expired. Please renew your plan.'];
    if (retryCount < MAX_RETRIES && !noRetryMessages.includes(err.message)) {
      const delay = RETRY_DELAYS[retryCount];
      console.warn(`[AI] Error: ${err.message}, retrying in ${delay}ms...`);
      await wait(delay);
      return callOpenAI(systemPrompt, userPrompt, apiKey, settings, retryCount + 1);
    }
    throw err;
  }
}

function getFallbackMessage(settings, isFollowUp) {
  if (isFollowUp) {
    const followUps = [
      "Hey! How's your week going?",
      "Still up for a chat?",
      "Hope you're having a great day!"
    ];
    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  const { chattingStyle } = settings;

  const fallbacks = {
    freestyle: ["Hey! What's good?", "Yo! How's it going?"],
    serious: ["Hi there! I'd love to get to know you better.", "Hello! Your profile caught my attention."],
    gentle: ["Hi! Hope you're having a lovely day.", "Hey there! Nice to match with you."],
    flirty: ["Well hello there 😏", "Hey gorgeous! How's your day?"],
    confident: ["Hey! We should grab a drink sometime.", "Hi! Let's skip the small talk - coffee this week?"],
    playful: ["Okay but your profile just made me smile 😄", "Hey! Quick question — cats or dogs? Very important."],
    witty: ["So I did some research and apparently we matched. Bold move on your part 😄", "Alright, I'll bite — what's the most interesting thing about you?"],
    charming: ["Hey! Something about your vibe stood out to me. How's your day going?", "Hi! I have a feeling this could be a good conversation 😊"],
    bold: ["Hey — I think we'd actually get along. Let's find out.", "Hi! I don't usually message first but here we are."],
    romantic: ["Hey! Your profile genuinely caught my eye. Hope you're having a wonderful day 🌸", "Hi there — something about you just felt worth reaching out to 😊"]
  };

  const options = fallbacks[chattingStyle] || ["Hey! How's it going?"];
  return options[Math.floor(Math.random() * options.length)];
}

const SIMPLE_EMOJI_ALLOWLIST = new Set([
  '🙂', '😊', '😄', '😉', '😅', '😌', '😂', '😭', '😍', '😘', '😏',
  '🤔', '🙈', '🙃', '❤️', '❤', '🔥', '👍', '👀', '✨'
]);

// Comprehensive emoji regex — covers every emoji category so nothing leaks through:
// 1. Flag pairs (Regional Indicators): 🇺🇸 🇫🇷
// 2. Keycap sequences: #️⃣ 1️⃣
// 3. Standard emoji with optional skin tone (U+1F3FB–U+1F3FF), variation selector, and ZWJ chains
const EMOJI_REGEX = /\p{Regional_Indicator}{2}|(?:\d|[#*])\uFE0F?\u20E3|\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}])?(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:[\u{1F3FB}-\u{1F3FF}])?(?:\uFE0F)?)*/gu;

function _emojiAllowed(emoji) {
  return SIMPLE_EMOJI_ALLOWLIST.has(emoji)
    || SIMPLE_EMOJI_ALLOWLIST.has(emoji.replace(/\uFE0F/g, ''))
    || SIMPLE_EMOJI_ALLOWLIST.has(emoji + '\uFE0F');
}

function normalizeEmojiStyle(message, settings) {
  if (!message || typeof message !== 'string') return message;
  const text = message.trim();
  if (!text) return text;

  if (!settings?.useEmojis) {
    return text.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
  }

  let emojiCount = 0;
  const cleaned = text
    .replace(EMOJI_REGEX, (emoji) => {
      if (!_emojiAllowed(emoji)) return '';
      if (emojiCount >= 2) return '';
      emojiCount += 1;
      return emoji;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (cleaned.length > 0) return cleaned;
  return text.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
}

async function callClaudeRewrite(message, settings, matchData) {
  if (!message || typeof message !== 'string') return message;

  const effectiveLang = (matchData && matchData.detectedLanguage && matchData.detectedLanguage.code)
    || settings.conversationLanguage || 'auto';

  try {
    const storage = await chrome.storage.local.get(['user', 'remoteClaudeRewriteConfig']);
    const remoteClaudeCfg = storage.remoteClaudeRewriteConfig;
    if (remoteClaudeCfg && remoteClaudeCfg.enabled === false) {
      console.log('[Claude] Rewrite disabled via remote config — skipping');
      return message;
    }
    const authToken = storage.user?.token;
    if (!authToken) return message;

    const proxyUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG.PROXY_ENDPOINT)
      ? API_CONFIG.PROXY_ENDPOINT.replace('/api/ai/chat', '')
      : 'https://flirteasy-auth.shnaiderdm.workers.dev';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${proxyUrl}/api/ai/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        message,
        style: settings.chattingStyle || 'freestyle',
        language: LANGUAGE_CODE_MAP[effectiveLang] || null,
        matchGender: matchData?.gender || null,
        senderGender: settings.userProfile?.gender || null,
        useEmojis: settings.useEmojis === true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('[Claude] Rewrite skipped — Worker returned', res.status);
      return message;
    }
    const data = await res.json();
    if (data.success && data.message && data.message.trim().length > 0) {
      const rewritten = data.message.trim();
      const changed = rewritten !== message;
      if (changed) {
        console.log('[Claude] Rewrite applied:\n  BEFORE:', message, '\n  AFTER: ', rewritten);
      } else {
        console.log('[Claude] Rewrite returned identical message — no change');
      }
      if (typeof trackEvent === 'function') {
        const _agSt = await (typeof getAgentState === 'function' ? getAgentState().catch(() => ({})) : Promise.resolve({}));
        trackEvent('claude_rewrite', _agSt.lockedPlatform || null, { changed, model: data.model || null });
      }
      return rewritten;
    }
    console.warn('[Claude] Rewrite returned empty — using original');
    return message;
  } catch (err) {
    console.warn('[Claude] Rewrite failed (silent fallback):', err.message || err);
    return message;
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function containsPlaceholder(message) {
  // Detect common placeholder patterns that make the bot look fake
  const placeholderPatterns = [
    /\[your\s+\w+\]/gi,           // [your number], [your city], [your name]
    /\[my\s+\w+\]/gi,             // [my number], [my city]
    /\[\w+\s+here\]/gi,           // [number here], [city here]
    /\[insert\s+\w+\]/gi,         // [insert number]
    /\[location\]/gi,             // [location]
    /\[name\]/gi,                 // [name]
    /\[phone\]/gi,                // [phone]
    /\[number\]/gi,               // [number]
    /\[city\]/gi,                 // [city]
    /\[sua\s+\w+\]/gi,            // [sua cidade]
    /\[seu\s+\w+\]/gi,            // [seu nome]
    /\[\w+\s+name\]/gi,           // [first name], [last name]
    /\{\{\w+\}\}/g,               // {{variable}}
    /\[[\s\w]+\]/g                // Any general [bracketed text]
  ];

  return placeholderPatterns.some(pattern => pattern.test(message));
}

// Expose functions globally for service worker
if (typeof self !== 'undefined') {
  self.generateMessage = generateMessage;
}
