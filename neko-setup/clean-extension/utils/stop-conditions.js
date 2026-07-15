/**
 * Advanced Stop Conditions & Lead Detection Engine (Production Grade)
 * Handles high-accuracy detection of leads (Moving Off-App)
 */

async function checkStopConditions(conversationHistory, stopConditions, apiKey, aiCaller = null) {
  if (!conversationHistory || conversationHistory.length === 0) {
    return { shouldStop: false, reason: null };
  }

  // Configuration check
  if (!stopConditions || stopConditions.length === 0 || stopConditions.includes('never')) {
    return { shouldStop: false, reason: null };
  }

  // ── Move-Off-App Goal Gate ──
  // If a move_to_X goal is active, the AI handles redirecting — don't stop on
  // the match mentioning OTHER platforms (WhatsApp, phone, etc.).
  // Only let the MoveOffApp state machine handle the stop via its own mechanism.
  const moveOffGoals = ['move_to_telegram', 'move_to_instagram', 'move_to_tango'];
  const activeMoveGoal = stopConditions.find(s => moveOffGoals.includes(s));
  if (activeMoveGoal) {
    // Only stop on goal platform accepted — handled by the move-off-app state machine
    // Don't fire here on WhatsApp/phone mentions from the match
    return { shouldStop: false, reason: null };
  }

  // Phase 1: Context Sanitization
  // We only care about the last 8 messages for context, but focus leads on the last 3 MATCH messages.
  const contextWindow = conversationHistory.slice(-8);
  const matchMessages = contextWindow.filter(m => m.sender !== 'user');

  if (matchMessages.length === 0) {
    return { shouldStop: false, reason: null };
  }

  // Prepare structured context for LLM
  // We label speakers clearly to prevent the "Daniel Loop" (where user's mentions trigger leads)
  const conversationText = contextWindow.map(m => {
    const speaker = m.sender === 'user' ? 'ME (SENDER)' : 'MATCH (RECIPIENT)';
    return `[${speaker}]: ${m.text}`;
  }).join('\n');

  const systemPrompt = `You are a high-accuracy Lead Extraction Engine for a dating assistant.
    Your task: Determine if the MATCH (not ME) has provided a concrete lead, requested a date, or expressed explicit intent.

    STRICT CLASSIFICATION RULES:
    1. INTENT: 
       - "PROVIDING": Match shared a handle, number, address, or explicit desire.
       - "REQUESTING": Match asked for my handle/number or a specific meeting.
       - "MENTIONING": Match talked about a platform or meeting generally (e.g. "I saw it on Insta", "we should meet sometime").
    
    2. EXTRACTION:
       - Only "shouldStop" if INTENT is "PROVIDING" or "REQUESTING".
       - IGNORE "MENTIONING" (False Positives).
       - IGNORE anything said by "ME (SENDER)".

    3. PLATFORM SPECIFICS:
       - Phone: Look for digit patterns, "WhatsApp", "my number", "text me".
       - Social: Look for @handles, or explicit handle text like "my ig is...", "add me on snap". Mentioning the app name without a handle is a MENTION, not a lead.
       - Date: Look for specific logistics ("Meet at 8", "Let's go to [Place]", "come over tonight").
       - Explicit: Match expresses direct sexual intent ("drunk sex", "hook up", "lick me", "come to my place").
       - Location: Match shares a maps link or specific address.

    OUTPUT FORMAT (JSON ONLY):
    {
      "shouldStop": boolean,
      "intent": "PROVIDING" | "REQUESTING" | "MENTIONING",
      "category": "phone" | "date" | "instagram" | "explicit" | "location" | "none",
      "extractedValue": "the handle, number, date logistics, or explicit phrase",
      "snippet": "the match's specific sentence"
    }`;

  const userPrompt = `Analyze this conversation:\n\n${conversationText}`;

  try {
    let resultText;

    if (aiCaller && typeof aiCaller === 'function') {
      // Use provided caller (e.g. background proxy)
      resultText = await aiCaller(systemPrompt, userPrompt);
    } else {
      // Fallback: Direct OpenAI Call (Legacy)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0,
          max_tokens: 150,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (!data.choices?.[0]?.message?.content) throw new Error('Invalid AI response');
      resultText = data.choices[0].message.content;
    }

    const result = JSON.parse(resultText);

    // Final Validation Gate
    if (result.shouldStop) {
      // Ensure it was a provision or request, not a casual mention
      if (result.intent === 'MENTIONING') return { shouldStop: false, reason: null };

      return {
        shouldStop: true,
        reason: result.category,
        snippet: result.extractedValue || result.snippet,
        intent: result.intent
      };
    }

    return { shouldStop: false, reason: null };

  } catch (error) {
    console.warn('[LeadEngine] AI Analysis failed, falling back to Hard-Regex:', error.message);
    return checkStopConditionsFallback(conversationHistory, stopConditions);
  }
}

/**
 * Hardened Regex Fallback (Production Grade)
 * Uses word boundaries, entity validation, and negative lookaheads.
 */
function checkStopConditionsFallback(conversationHistory, stopConditions) {
  // Only process the last 3 MATCH messages for triggers to minimize noise
  const matchMessages = conversationHistory
    .slice(-5)
    .filter(m => m.sender !== 'user')
    .map(m => m.text.toLowerCase());

  const allText = matchMessages.join(' | ');

  if (!allText.trim()) return { shouldStop: false, reason: null };

  // 1. PHONE / WHATSAPP (Resilient to spacing: "0 5 4 ...")
  if (stopConditions.includes('phone')) {
    const rawDigits = allText.replace(/[\s.-]/g, '');
    const phonePattern = /\b(\+?\d{8,15})\b/; // 8-15 digits
    const whatsappPattern = /\b(whatsapp|wa\.me|telegram|signal|viber|call me|text me|my number)\b/i;

    if (phonePattern.test(rawDigits) && !allText.includes('year')) { // Avoid years like 2026
      return { shouldStop: true, reason: 'phone', snippet: 'phone/whatsapp detected' };
    }
    if (whatsappPattern.test(allText)) {
      return { shouldStop: true, reason: 'phone', snippet: allText.match(whatsappPattern)[0] };
    }
  }

  // 2. SOCIAL HANDLES (Handle vs Reference detection)
  if (stopConditions.includes('instagram')) {
    // Negative lookahead: Trigger on handle context, ignore "on insta", "saw on snap"
    const socialPatterns = [
      /\b(ig\s*[:@]|insta\s*[:@]|instagram\s*[:@]|snap\s*[:@]|snapchat\s*[:@])\b/i,
      /@[\w.]{3,20}\b/ // Actual handle @user
    ];

    for (const pattern of socialPatterns) {
      const match = allText.match(pattern);
      if (match) {
        // Context Check: exclude common referential phrases
        const context = allText.toLowerCase();
        const isReference = context.includes('on insta') || context.includes('on snap') || context.includes('on instagram');
        if (isReference && !context.includes('@')) continue;

        return { shouldStop: true, reason: 'instagram', snippet: match[0] };
      }
    }
  }

  // 3. DATE LOGISTICS (Explicit vs Vague)
  if (stopConditions.includes('date')) {
    const explicitDatePattern = /\b(meet at|meet you at|grab (a )?coffee at|dinner at|lunch at|see you then|around [0-9]+|come over tonight|come to my (place|flat|apartment|house))\b/i;
    const match = allText.match(explicitDatePattern);
    if (match) {
      return { shouldStop: true, reason: 'date', snippet: match[0] };
    }
  }

  // 4. EXPLICIT SEXUAL CONTENT — only when Stop After Goal is active
  if (stopConditions.length > 0) {
    const explicitPattern = /\b(drunk sex|have sex|wanna fuck|want to fuck|lets? fuck|f[*u]ck me|lick me|suck me|sleep with me|hook ?up tonight|can we have sex|up for sex|dtf\b|down to f[*u]ck)\b/i;
    const explicitMatch = allText.match(explicitPattern);
    if (explicitMatch) {
      return { shouldStop: true, reason: 'explicit', snippet: explicitMatch[0] };
    }

    // 5. LOCATION SHARING (URL-based)
    const locationPattern = /maps\.app\.goo\.gl\/|goo\.gl\/maps|maps\.google\.com\//i;
    if (locationPattern.test(allText)) {
      return { shouldStop: true, reason: 'location', snippet: 'Location shared' };
    }
  }

  return { shouldStop: false, reason: null };
}

// Global Export
if (typeof self !== 'undefined') {
  self.checkStopConditions = checkStopConditions;
  self.checkStopConditionsFallback = checkStopConditionsFallback;
}
