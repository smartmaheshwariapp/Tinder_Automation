/**
 * FlirtEasy Language Detection Engine
 * 
 * Detects conversation language from message text using:
 * 1. Unicode script range analysis (deterministic for non-Latin scripts)
 * 2. Word-pattern fingerprinting
 * 
 * Used by both content scripts (UI button) and background (AI prompt override).
 */

// Re-entry guard: prevent crashes from double content-script injection
if (typeof LANG_SCRIPT_MAP !== 'undefined') { /* Already loaded */ } else {

// Unicode script ranges → language mapping
var LANG_SCRIPT_MAP = [
    { name: 'Hebrew', code: 'he', ranges: [[0x0590, 0x05FF], [0xFB1D, 0xFB4F]] },
    { name: 'Arabic', code: 'ar', ranges: [[0x0600, 0x06FF], [0x0750, 0x077F], [0xFB50, 0xFDFF], [0xFE70, 0xFEFF]],
      // Persian/Farsi uses these extra chars that pure Arabic doesn't: پ چ گ ژ ک ی
      // If any of these appear, it's Persian not Arabic
      excludeIfChars: /[\u067E\u0686\u06AF\u0698\u06A9\u06CC\u06F0-\u06F9]/ },
    { name: 'Persian', code: 'fa', ranges: [[0x0600, 0x06FF]], requiredChars: /[\u067E\u0686\u06AF\u0698\u06A9\u06CC\u06F0-\u06F9]/ },
    { name: 'Hindi', code: 'hi', ranges: [[0x0900, 0x097F]] },
    { name: 'Bengali', code: 'bn', ranges: [[0x0980, 0x09FF]] },
    { name: 'Tamil', code: 'ta', ranges: [[0x0B80, 0x0BFF]] },
    { name: 'Telugu', code: 'te', ranges: [[0x0C00, 0x0C7F]] },
    { name: 'Kannada', code: 'kn', ranges: [[0x0C80, 0x0CFF]] },
    { name: 'Malayalam', code: 'ml', ranges: [[0x0D00, 0x0D7F]] },
    { name: 'Thai', code: 'th', ranges: [[0x0E00, 0x0E7F]] },
    { name: 'Korean', code: 'ko', ranges: [[0xAC00, 0xD7AF], [0x1100, 0x11FF], [0x3130, 0x318F]] },
    { name: 'Japanese', code: 'ja', ranges: [[0x3040, 0x309F], [0x30A0, 0x30FF]] },
    { name: 'Chinese', code: 'zh', ranges: [[0x4E00, 0x9FFF], [0x3400, 0x4DBF]] },
    { name: 'Russian', code: 'ru', ranges: [[0x0400, 0x04FF]] },
    { name: 'Ukrainian', code: 'uk', ranges: [[0x0400, 0x04FF]], 
      // Ukrainian-specific: і (і), ї (ї), є (є), ґ (ґ) - these DON'T exist in Russian
      specificChars: /[іїєґ]/
    },
    { name: 'Greek', code: 'el', ranges: [[0x0370, 0x03FF]] },
    { name: 'Georgian', code: 'ka', ranges: [[0x10A0, 0x10FF]] },
    { name: 'Armenian', code: 'hy', ranges: [[0x0530, 0x058F]] },
    { name: 'Gujarati', code: 'gu', ranges: [[0x0A80, 0x0AFF]] },
    { name: 'Punjabi', code: 'pa', ranges: [[0x0A00, 0x0A7F]] },
    { name: 'Sinhala', code: 'si', ranges: [[0x0D80, 0x0DFF]] },
    { name: 'Lao', code: 'lo', ranges: [[0x0E80, 0x0EFF]] },
    { name: 'Burmese', code: 'my', ranges: [[0x1000, 0x109F]] },
    { name: 'Khmer', code: 'km', ranges: [[0x1780, 0x17FF]] },
];

// Latin-script languages via common word fingerprints + character patterns
const LANG_LATIN_PATTERNS = [
    { 
        name: 'Romanian', 
        code: 'ro', 
        words: ['bună', 'buna', 'mulțumesc', 'multumesc', 'frumos', 'foarte', 'când', 'cand', 'pentru', 'acum', 'sunt', 'faci', 'iubire', 'întotdeauna', 'intotdeauna', 'și', 'si', 'tu', 'mai', 'din', 'ce', 'da', 'nu', 'salut', 'noapte', 'bine', 'stii', 'știi', 'merge', 'acolo', 'atunci', 'deci', 'esti', 'ești'],
        // Romanian-specific: uses ă, â, î, ș, ț characters frequently
        specialChars: /[ăâîșț]/i,
        // Common Romanian suffixes
        patterns: /\b\w+(ă|ește|esc|ațion|ților|ului)\b/i
    },
    { name: 'Spanish', code: 'es', words: ['hola', 'holaa', 'holaaa', 'estás', 'estas', 'qué', 'gracias', 'también', 'tambien', 'pero', 'porque', 'tengo', 'quiero', 'mucho', 'amor', 'vale', 'bueno', 'nosotros', 'otra', 'otro', 'viviendo', 'vivo', 'vivir', 'argentina', 'español', 'española', 'pasarla', 'pasarlo', 'pasando', 'estar', 'estoy', 'soy', 'somos', 'desde', 'para', 'con', 'una', 'por', 'más', 'mas', 'está', 'esta', 'son', 'fue', 'hay', 'nos', 'mis', 'del', 'muy', 'así', 'asi', 'eso', 'ese', 'ser', 'sin', 'siempre', 'todo', 'nada', 'cuando', 'ahora', 'aquí', 'aqui', 'vida', 'algo', 'tiene', 'hacer', 'mal', 'solo', 'sola', 'quieres', 'vamos', 'venga', 'claro', 'oye', 'mira', 'pues', 'igual', 'mismo', 'misma', 'cuantos', 'cuántos', 'cuanto', 'cuánto', 'distancia', 'lejos', 'cerca', 'personas', 'bonita', 'bonitas', 'bonito', 'risueña', 'carismatica', 'carismática', 'graciosa', 'empatia', 'empatía', 'tiempos', 'busco', 'abierta', 'etapa', 'aportar', 'nueva', 'nuevo', 'difícil', 'dificil', 'sustituto', 'cosas',
      // Spanish-exclusive words (do NOT exist in Portuguese)
      'buenas', 'noches', 'buenos', 'dias', 'días', 'hombre', 'chico', 'chica', 'tío', 'tia', 'venga', 'jajaja', 'jaja', 'jeje', 'genial', 'guapo', 'guapa', 'bonito', 'lindo', 'linda', 'chévere', 'órale', 'andale', 'ahorita', 'dónde', 'donde', 'cuándo', 'viejo', 'vieja', 'papi', 'mami', 'qué tal', 'qué onda', 'cómo estás', 'poco', 'noche', 'virrey', 'estación', 'metro'],
      specialChars: /[áéíóúñü]/i,
      // Strong Spanish-exclusive chars/patterns — ñ is the most reliable signal
      exclusiveChars: /[ñ]/ },
    { name: 'Portuguese', code: 'pt', words: ['olá', 'ola', 'obrigado', 'obrigada', 'também', 'muito', 'quando', 'você', 'voce', 'aqui', 'tudo', 'boa', 'gostei', 'gosto', 'ainda', 'rsrs', 'kkk', 'kkkk', 'hahaha', 'né', 'né', 'tá', 'ta', 'pra', 'pro', 'gente', 'beleza', 'legal', 'bacana', 'cara', 'saudade', 'beijos', 'abraços', 'bjss', 'nossa', 'poxa', 'caramba', 'uai', 'bora', 'valeu', 'falou', 'tchau', 'oi', 'tamo', 'mano', 'mina', 'galera', 'pessoal', 'falar', 'fazer', 'estar', 'ficar', 'viver', 'amar', 'querer', 'poder', 'dever', 'saber', 'ver', 'dar', 'vir', 'ir', 'ter', 'ser',
      // Portuguese-exclusive words (do NOT exist in Spanish)
      'você', 'vocês', 'então', 'entao', 'também', 'tbm', 'aqui', 'isso', 'esse', 'essa', 'mesmo', 'mesma', 'bastante', 'demais', 'porém', 'porem', 'porquê', 'porque', 'enquanto', 'através', 'através', 'além', 'bem', 'bom', 'boa', 'ótimo', 'otimo', 'ótima', 'otima', 'dá', 'da', 'já', 'ja', 'né', 'tô', 'to', 'tá', 'ta', 'pra', 'nessa', 'nesse', 'naquele', 'naquela', 'mora', 'morar', 'encontrar', 'curtir', 'gostar', 'adorar'],
      specialChars: /[áàâãçéêíóôõú]/i,
      // Strong Portuguese-exclusive chars — ã, õ, ê, ô are the most reliable signals
      exclusiveChars: /[ãõêô]/ },
    { name: 'German', code: 'de', words: ['hallo', 'danke', 'bitte', 'nicht', 'auch', 'aber', 'schön', 'ich', 'sehr', 'warum', 'weil', 'gerne', 'heute', 'morgen', 'freut'], specialChars: /[äöüß]/i },
    { name: 'Italian', code: 'it', words: ['ciao', 'come', 'grazie', 'anche', 'perché', 'molto', 'bene', 'buona', 'piacere', 'sempre', 'amore', 'tutto', 'niente', 'quando', 'ancora', 'meglio', 'vivo', 'sono', 'stai', 'bella', 'bello', 'mio', 'mia', 'vuoi', 'puoi', 'sai', 'hai', 'sei', 'vai', 'dai', 'poi', 'però', 'quello', 'questa', 'questo', 'davvero', 'magari', 'infatti', 'allora', 'quindi', 'oppure', 'adesso', 'subito', 'già', 'mai', 'solo', 'solo', 'forse', 'almeno', 'soprattutto'], specialChars: /[àèéìòù]/i },
    { name: 'Dutch', code: 'nl', words: ['hallo', 'dank', 'ook', 'maar', 'waarom', 'goed', 'mooi', 'vandaag', 'leuk', 'gezellig', 'welkom', 'morgen', 'altijd'] },
    { name: 'Turkish', code: 'tr', words: ['merhaba', 'teşekkür', 'evet', 'hayır', 'nasıl', 'güzel', 'çok', 'iyi', 'tamam', 'neden', 'selam', 'bugün'], specialChars: /[çğıöşü]/i },
    { name: 'Polish', code: 'pl', words: ['cześć', 'dzień', 'dobry', 'dziękuję', 'proszę', 'bardzo', 'dobrze', 'dlaczego', 'kiedy', 'miło', 'piękny'], specialChars: /[ąćęłńóśźż]/i },
    { name: 'Swedish', code: 'sv', words: ['tack', 'också', 'varför', 'vacker', 'alltid', 'underbar', 'gillar', 'gärna', 'jättefin', 'jättebra', 'mår', 'hur', 'din', 'profil', 'inte', 'från'], specialChars: /[åäö]/i },
    { name: 'Norwegian', code: 'no', words: ['hei', 'takk', 'også', 'veldig', 'vakker', 'alltid', 'ikke', 'deg', 'seg', 'profilen', 'hyggelig', 'kjempebra', 'norsk'], specialChars: /[æøå]/i },
    { name: 'Danish', code: 'da', words: ['meget', 'smuk', 'altid', 'dejlig', 'rigtig', 'hyggeligt', 'dansk', 'har'], specialChars: /[æøå]/i },
    { name: 'Finnish', code: 'fi', words: ['kiitos', 'myös', 'miksi', 'kaunis', 'aina', 'tänään', 'miten', 'kuuluu', 'profiilisi', 'todella', 'hauska', 'mukava', 'suomi', 'olen'], specialChars: /[äö]/i },
    { name: 'Czech', code: 'cs', words: ['ahoj', 'děkuji', 'prosím', 'dobře', 'proč', 'dnes', 'krásný', 'moc', 'rád', 'ráda'], specialChars: /[áčďéěíňóřšťúůýž]/i },
    { name: 'Hungarian', code: 'hu', words: ['szia', 'köszönöm', 'kérem', 'szép', 'nagyon', 'miért', 'mindig', 'holnap', 'szeretem', 'jó'], specialChars: /[áéíóöőúüű]/i },
    { name: 'Indonesian', code: 'id', words: ['halo', 'terima', 'kasih', 'bagaimana', 'bagus', 'sangat', 'kenapa', 'selalu', 'tidak', 'suka', 'kamu', 'aku', 'senang'] },
    // Hinglish — Hindi written in Roman/Latin script (most common on Indian dating apps)
    // Real examples: "kese ho", "kya haal", "kya chal raha hai", "bhai", "yaar", "acha"
    { name: 'Hindi', code: 'hi', words: ['kese', 'kaise', 'haal', 'yaar', 'bhai', 'acha', 'achha', 'bilkul', 'sahi', 'nahi', 'nhi', 'bhi', 'bas', 'kal', 'aaj', 'agar', 'toh', 'mera', 'tera', 'kya', 'chal', 'raha', 'sab'] },
    // Roman Urdu — Urdu written in Roman/Latin script (standard for Pakistani dating apps)
    // Real examples: "kya haal hai", "tum kese ho", "bilkul theek", "acha ji"
    { name: 'Urdu', code: 'ur', words: ['kya', 'kese', 'haal', 'yaar', 'bhai', 'acha', 'bilkul', 'sahi', 'nahi', 'tum', 'mujhe', 'apna', 'kitna', 'aur', 'hai', 'ho', 'haan', 'toh', 'bhi', 'theek', 'accha', 'phir', 'abhi'] },
    // Finglish — Farsi/Persian written in Roman/Latin script (common in Iran)
    // Real examples: "chetori?", "khoobi?", "mersi kheili", "bahal", "vay"
    { name: 'Persian', code: 'fa', words: ['chetori', 'khoobi', 'mamnoon', 'bahal', 'baba', 'joon', 'kheili', 'vay', 'mersi', 'salamat', 'akheh', 'vali', 'che', 'koja', 'kojai', 'khob', 'doset', 'daram', 'eshgh'] },
    { name: 'Swahili', code: 'sw', words: ['habari', 'asante', 'sana', 'nzuri', 'vipi', 'mambo', 'napenda', 'wasifu', 'sijambo', 'karibu', 'rafiki', 'kweli', 'nakupenda'] },
    { name: 'Vietnamese', code: 'vi', words: ['xin', 'chào', 'cảm', 'ơn', 'rất', 'đẹp', 'tại', 'sao', 'luôn', 'không', 'hôm', 'ngày'], specialChars: /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i },
];

/**
 * Detect language from a text string.
 * @param {string} text - Text to analyze
 * @returns {{ name: string, code: string, confidence: number, source: string }}
 */
globalThis.detectLanguage = function(text) {
    if (!text || text.trim().length === 0) {
        return { name: 'Unknown', code: 'unknown', confidence: 0, source: 'empty' };
    }

    // Strip emojis, numbers, punctuation, whitespace
    const cleaned = text
        .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u200D\uFE0F]/gu, '')
        .replace(/[0-9\s.,!?;:'"()\-–—…@#$%^&*+=<>{}[\]|\\\/~`¿¡]/g, '')
        .trim();

    if (cleaned.length === 0) {
        return { name: 'Unknown', code: 'unknown', confidence: 0, source: 'emoji_only' };
    }

    // Count characters per script
    const scriptCounts = {};
    let latinCount = 0;
    let totalCounted = 0;

    for (const char of cleaned) {
        const cp = char.codePointAt(0);
        let matched = false;

        for (const script of LANG_SCRIPT_MAP) {
            for (const [start, end] of script.ranges) {
                if (cp >= start && cp <= end) {
                    scriptCounts[script.name] = (scriptCounts[script.name] || 0) + 1;
                    matched = true;
                    totalCounted++;
                    break;
                }
            }
            if (matched) break;
        }

        // Latin characters (Basic Latin + Latin Extended)
        if (!matched && ((cp >= 0x0041 && cp <= 0x007A) || (cp >= 0x00C0 && cp <= 0x024F))) {
            latinCount++;
            totalCounted++;
        }
    }

    if (totalCounted === 0) {
        return { name: 'Unknown', code: 'unknown', confidence: 0, source: 'no_text_chars' };
    }

    // Find dominant non-Latin script (>30% threshold)
    let dominantScript = null;
    let dominantCount = 0;
    for (const [name, count] of Object.entries(scriptCounts)) {
        if (count > dominantCount) {
            dominantScript = name;
            dominantCount = count;
        }
    }

    if (dominantScript && dominantCount / totalCounted > 0.3) {
        const scriptInfo = LANG_SCRIPT_MAP.find(s => s.name === dominantScript);
        const confidence = Math.round((dominantCount / totalCounted) * 100);
        
        // Special case: Persian vs Arabic disambiguation
        // Persian uses specific chars پ چ گ ژ ک ی that pure Arabic doesn't
        if (dominantScript === 'Arabic') {
            const persianScript = LANG_SCRIPT_MAP.find(s => s.name === 'Persian');
            if (persianScript?.requiredChars && persianScript.requiredChars.test(text)) {
                return { name: 'Persian', code: 'fa', confidence, source: 'unicode_script' };
            }
        }

        // Special case: Ukrainian vs Russian disambiguation
        // Primary signal: Ukrainian-unique chars і, ї, є, ґ that Russian doesn't use
        // Secondary signal: vocabulary fingerprint — catches mixed-language speakers
        // who use Russian words (like "Хорошо") but are fundamentally Ukrainian
        if (dominantScript === 'Russian') {
            const ukrainianScript = LANG_SCRIPT_MAP.find(s => s.name === 'Ukrainian');
            if (ukrainianScript && ukrainianScript.specificChars && ukrainianScript.specificChars.test(text)) {
                return { name: 'Ukrainian', code: 'uk', confidence, source: 'unicode_script' };
            }
            // Vocabulary fallback: distinctly Ukrainian words that don't exist in Russian
            // Covers cases like "каву", "спілкування", "зустрінемось", "будь ласка", "дякую"
            const ukrainianWords = /\b(каву|каво|каф[еє]|кава|дякую|дяку|будь ласка|будьте|зустрін|зустріч|зустрітись|зустрімось|зустрінемось|спілку|спілкування|привіт|як справи|добре|добрий|добра|вечір|ранок|слухай|слухайте|звісно|звичайно|напевно|можемо|можете|хочу|хочеш|подобається|подобаєтьс|гарно|гарний|гарна|гарне|файно|чудово|чудовий|чудова|класно|окей|згода|погоджуюс|так|ні|хаха|їхати|їду|їдемо|тобто|взагалі|насправді)\b/i;
            if (ukrainianWords.test(text)) {
                return { name: 'Ukrainian', code: 'uk', confidence: Math.max(confidence - 10, 50), source: 'unicode_script_vocab' };
            }
        }
        
        return {
            name: scriptInfo.name,
            code: scriptInfo.code,
            confidence,
            source: 'unicode_script'
        };
    }

    // Latin-dominant text → word pattern matching + special character detection
    if (latinCount / totalCounted > 0.5) {
        const words = text.toLowerCase().split(/[\s.,!?;:'"()\-–—…]+/).filter(w => w.length > 1);
        let bestLang = null;
        let bestScore = 0;

        for (const lang of LANG_LATIN_PATTERNS) {
            let score = 0;
            
            // Count word matches first
            let wordMatches = 0;
            for (const w of lang.words) {
                if (words.includes(w)) wordMatches++;
            }
            score += wordMatches;
            
            // Special character bonus ONLY if:
            // 1. The language has a specialChars pattern
            // 2. At least 1 word also matched (prevents false positives from shared chars like é)
            if (lang.specialChars && lang.specialChars.test(text) && wordMatches >= 1) {
                score += 3;
            }

            // Exclusive character bonus — chars that ONLY exist in this language
            // e.g. ñ is exclusively Spanish, ã/õ/ê/ô are exclusively Portuguese
            // This is a decisive tiebreaker for Spanish vs Portuguese confusion
            if (lang.exclusiveChars && lang.exclusiveChars.test(text)) {
                score += 8; // strong signal — exclusive chars are unambiguous
            }
            
            // Check for word patterns (Romanian suffixes, etc.)
            if (lang.patterns && lang.patterns.test(text) && wordMatches >= 1) {
                score += 2;
            }
            
            const normalizedScore = score / Math.sqrt(lang.words.length);
            if (normalizedScore > bestScore) {
                bestScore = normalizedScore;
                bestLang = lang;
            }
        }

        // For very short text (1-2 words), lower the threshold — a single greeting word
        // like "Buna", "Hola", "Ciao" is a strong enough signal on its own.
        // For longer text, keep the 0.5 threshold to avoid false positives.
        const shortTextWords = text.trim().split(/\s+/).filter(Boolean);
        const threshold = shortTextWords.length <= 2 ? 0.1 : 0.5;

        if (bestLang && bestScore > threshold) {
            return {
                name: bestLang.name,
                code: bestLang.code,
                confidence: Math.min(Math.round(bestScore * 100), 95),
                source: 'word_patterns'
            };
        }

        // Fallback: Latin script with no strong word-pattern matches.
        // For SHORT text (≤4 words): treat as unknown — bio fallback should be tried first.
        // For LONGER text (>4 words): almost certainly English — no other Latin language
        // would consistently produce multi-sentence text with zero word pattern matches.
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount <= 4) {
            return { name: 'Unknown', code: 'unknown', confidence: 0, source: 'latin_fallback' };
        }
        // Long Latin text with no other language signal = English
        const confidence = Math.min(40 + Math.floor(wordCount / 3), 75);
        return { name: 'English', code: 'en', confidence, source: 'latin_english_default' };
    }

    return { name: 'Unknown', code: 'unknown', confidence: 0, source: 'unrecognized' };
}

/**
 * Detect conversation language from an array of messages.
 * Only analyzes the match's messages (the language we want to reply in).
 * @param {Array<{sender: string, text: string}>} messages
 * @returns {{ name: string, code: string, confidence: number, source: string, messagesAnalyzed: number }}
 */
globalThis.detectConversationLanguage = function(messages) {
    const matchMessages = messages.filter(m =>
        m.sender === 'match' && 
        m.text && 
        m.text.trim().length >= 2 &&
        !m.text.startsWith('[Link') &&   // Skip link previews
        !m.text.startsWith('[Voice') &&  // Skip voice notes
        !m.text.startsWith('[Video') &&  // Skip videos
        !m.text.startsWith('[GIF') &&    // Skip GIFs
        !m.text.startsWith('[Media') &&  // Skip media
        !m.text.startsWith('[Image')     // Skip images
    );

    if (matchMessages.length === 0) {
        return { name: 'Unknown', code: 'unknown', confidence: 0, source: 'no_match_messages', messagesAnalyzed: 0 };
    }

    // Primary: last 3 match messages = current conversation language
    // Trust ANY known result — expanding the window only adds older messages that can contaminate
    const recent3 = matchMessages.slice(-3);
    const recent3Text = recent3.map(m => m.text).join(' ');
    const recent3Result = detectLanguage(recent3Text);

    // For Cyrillic scripts (Russian/Ukrainian/etc.), use ALL messages for disambiguation.
    // A single Russian loanword like "Хорошо" in an otherwise Ukrainian conversation
    // should not flip the detection. More data = more accurate Cyrillic disambiguation.
    if (recent3Result.code === 'ru' || recent3Result.code === 'unknown') {
        const allText = matchMessages.map(m => m.text).join(' ');
        const allResult = detectLanguage(allText);
        // If all-messages analysis disagrees (e.g. finds Ukrainian), trust that
        if (allResult.code !== 'unknown' && allResult.code !== recent3Result.code) {
            allResult.messagesAnalyzed = matchMessages.length;
            allResult.source = `all_messages_${allResult.source}`;
            return allResult;
        }
    }

    if (recent3Result.code !== 'unknown') {
        recent3Result.messagesAnalyzed = recent3.length;
        recent3Result.source = `recent3_${recent3Result.source}`;
        return recent3Result;
    }

    // Fallback: first message only (for very short single-message conversations)
    const firstResult = detectLanguage(matchMessages[0].text);
    firstResult.messagesAnalyzed = 1;
    firstResult.source = `first_message_${firstResult.source}`;
    return firstResult;
}

// Expose globally for both content scripts (window) and background (self/service worker)
if (typeof window !== 'undefined') {
    globalThis.detectLanguage = detectLanguage;
    globalThis.detectConversationLanguage = detectConversationLanguage;
}

if (typeof self !== 'undefined') {
    self.detectLanguage = detectLanguage;
    self.detectConversationLanguage = detectConversationLanguage;
}

} // end re-entry guard
