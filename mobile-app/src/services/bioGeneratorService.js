// mobile-app/src/services/bioGeneratorService.js
// Hybrid GPT-4o-mini & Resilient Local Algorithmic Dating Bio Generator
import { resolveLocalUrl } from '../utils/network';
import { API_CONFIG } from '../config/api';

export const DEFAULT_OPENAI_KEY = '';

export const CURATED_MAGIC_BIOS = [
  {
    score: 96,
    text: "Tech explorer by day, rooftop cocktail enthusiast by night. Looking for someone who doesn't take themselves too seriously and can keep up with rapid-fire banter.",
  },
  {
    score: 94,
    text: "Ambitious, spontaneous, and always hunting for the city's best hidden coffee spots. Swipe right if you have great music taste and love unplanned road trips.",
  },
  {
    score: 97,
    text: "Part-time chef, full-time adventure seeker. Tell me your most controversial opinion and let's see if we survive the first drink.",
  },
  {
    score: 95,
    text: "Here for good banter, better appetizers, and finding someone who can recommend music I haven't heard yet. Bonus points if you can out-trivia me.",
  },
  {
    score: 98,
    text: "Equal parts ambition and spontaneous Sunday plans. Looking for someone driven, funny, and ready to debate whether pineapple belongs on pizza (it does).",
  },
  {
    score: 93,
    text: "Golden retriever energy wrapped in good style and dry humor. Tell me your favorite travel story and let's plan the sequel.",
  },
  {
    score: 96,
    text: "Two truths and a lie: I make killer pasta, I've never lost a game of darts, and I'll remember the small details you mention on date one. You guess which.",
  },
];

export function generateSmartBioFallback(userProfile, currentBioText) {
  const bios = [...CURATED_MAGIC_BIOS];

  if (userProfile && typeof userProfile === 'object') {
    const job = (userProfile.job || '').trim();
    const city = (userProfile.city || '').trim();
    const interests = Array.isArray(userProfile.interests) ? userProfile.interests.filter(Boolean) : [];
    const lookingFor = (userProfile.lookingFor || '').trim();

    const p1 = interests[0] || 'cocktails';
    const p2 = interests[1] || 'travel';

    if (job && interests.length >= 2) {
      bios.unshift({
        score: 98,
        text: `${job} by weekday, ${p1} & ${p2} enthusiast by weekend. Looking for someone who can keep up with rapid-fire banter and knows the city's best hidden gems.`,
      });
    }

    if (interests.length >= 2) {
      bios.unshift({
        score: 97,
        text: `Fluent in sarcasm, ${p1}, and ordering way too many appetizers. Swipe right if you love ${p2}, spontaneous evening plans, and good conversation.`,
      });
    }

    if (city && interests.length >= 1) {
      bios.unshift({
        score: 96,
        text: `Exploring the best of ${city} one ${p1} spot at a time. Looking for an accomplice with great music taste and zero fear of being playful.`,
      });
    }

    if (job) {
      bios.unshift({
        score: 95,
        text: `Working in ${job}, but my real talent is picking top-tier date spots and surviving lively debates. Let's grab drinks and see who laughs first.`,
      });
    }

    if (lookingFor && interests.length >= 1) {
      bios.unshift({
        score: 97,
        text: `Looking for ${lookingFor.toLowerCase()} with someone who loves ${p1} and doesn't take themselves too seriously. Tell me your most controversial hot take.`,
      });
    }
  }

  const candidates = bios.filter(b => b.text !== currentBioText);
  const pool = candidates.length > 0 ? candidates : bios;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return { ...picked, source: 'smart_local' };
}

export function calculateBioScore(text) {
  let score = 94;
  if (!text) return score;
  const len = text.length;
  // Sweet spot for Tinder bios is 100-240 chars
  if (len >= 100 && len <= 260) score += 2;
  // Conversation starter hook
  if (text.includes('?') || text.includes("Let's") || text.includes("Tell me")) score += 2;
  return Math.min(99, Math.max(92, score));
}

/**
 * End-to-end AI Bio Generator (GPT-4o-mini with multi-tier fallback)
 */
export async function generateBioWithAI({ userProfile, apiKey, currentBioText, orchestratorUrl }) {
  const activeKey = apiKey || DEFAULT_OPENAI_KEY;

  // 1. Direct OpenAI call (GPT-4o-mini)
  if (activeKey && activeKey.startsWith('sk-')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const systemPrompt = `You are an elite modern dating coach and wingman. Write a charismatic, authentic, witty Tinder bio under 200 characters based on the user's profile.
Rules:
- Strictly under 220 characters.
- Natural, confident, conversational banter.
- NO clichés (never say "partner in crime", "fluent in sarcasm", "loves to laugh", "work hard play hard").
- Include a playful banter hook or conversation starter.
- Output ONLY the bio text. Do NOT wrap in quotes. No explanations.`;

      const parts = [];
      if (userProfile?.name) parts.push(`Name: ${userProfile.name}`);
      if (userProfile?.age) parts.push(`Age: ${userProfile.age}`);
      if (userProfile?.job) parts.push(`Job: ${userProfile.job}`);
      if (userProfile?.interests?.length) parts.push(`Passions: ${userProfile.interests.join(', ')}`);
      if (userProfile?.city) parts.push(`City: ${userProfile.city}`);
      if (userProfile?.height) parts.push(`Height: ${userProfile.height}`);
      if (userProfile?.lookingFor) parts.push(`Looking for: ${userProfile.lookingFor}`);

      const userPrompt = parts.length > 0
        ? `Profile attributes:\n${parts.join('\n')}\n\nCraft a catchy, high-converting bio that matches will want to reply to.`
        : `Craft a witty, confident, modern dating bio for a fun and spontaneous person.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 80,
          temperature: 0.9,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        let generatedText = data.choices?.[0]?.message?.content?.trim() || '';
        generatedText = generatedText.replace(/^["'](.*)["']$/, '$1').trim();
        if (generatedText && generatedText.length > 15 && generatedText !== currentBioText) {
          const score = calculateBioScore(generatedText);
          return {
            score,
            text: generatedText,
            source: 'gpt',
          };
        }
      }
    } catch (err) {
      console.warn('[BioGenerator] Direct OpenAI attempt warning:', err.message);
    }
  }

  // 2. Cloudflare Worker AI Bio Proxy
  try {
    const endpoints = API_CONFIG.getEndpoints();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const workerRes = await fetch(endpoints.AI_BIO, {
      method: 'POST',
      headers: API_CONFIG.getHeaders(),
      body: JSON.stringify({ userProfile, currentBioText }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (workerRes.ok) {
      const data = await workerRes.json();
      if (data && data.success && data.bio && data.bio !== currentBioText) {
        return {
          score: calculateBioScore(data.bio),
          text: data.bio,
          source: 'cloudflare_proxy',
        };
      }
    }
  } catch (_) {}

  // 3. Orchestrator fallback (/generate-bio)
  const effectiveOrchUrl = orchestratorUrl || resolveLocalUrl('http://localhost:3001');
  if (effectiveOrchUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`${effectiveOrchUrl}/generate-bio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userProfile, currentBioText }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.bio && data.bio !== currentBioText) {
          return {
            score: data.score || calculateBioScore(data.bio),
            text: data.bio,
            source: data.source || 'gpt',
          };
        }
      }
    } catch (_) {}
  }

  // 3. Guaranteed Local Algorithmic Fallback
  return generateSmartBioFallback(userProfile, currentBioText);
}
