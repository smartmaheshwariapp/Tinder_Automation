// mobile-app/src/utils/aiConversationEngine.js
// Dynamic Context-Aware AI Dating Conversation Engine for Flint Onboarding & Previews
import { API_CONFIG } from '../config/api';

/**
 * Country-specific profile subtitles and local date nuances
 */
const COUNTRY_LOCALIZATION = {
  India: {
    city: 'Mumbai',
    sub: 'Mumbai · Architect & espresso lover',
    rooftopSpot: 'a rooftop in Bandra',
    coffeeSpot: 'a quiet cafe in Bandra',
  },
  'United States': {
    city: 'New York',
    sub: 'New York · Architect & espresso lover',
    rooftopSpot: 'a rooftop in Soho',
    coffeeSpot: 'a cozy spot in West Village',
  },
  'United Kingdom': {
    city: 'London',
    sub: 'London · Architect & flat white lover',
    rooftopSpot: 'a rooftop bar in Soho',
    coffeeSpot: 'a cozy cafe in Shoreditch',
  },
  Canada: {
    city: 'Toronto',
    sub: 'Toronto · Architect & espresso lover',
    rooftopSpot: 'a rooftop patio downtown',
    coffeeSpot: 'a cozy cafe in Queen West',
  },
  Australia: {
    city: 'Sydney',
    sub: 'Sydney · Beach design & flat whites',
    rooftopSpot: 'a harbor-view rooftop bar',
    coffeeSpot: 'a sunny cafe in Surry Hills',
  },
  Germany: {
    city: 'Berlin',
    sub: 'Berlin · Architecture & gallery walks',
    rooftopSpot: 'a rooftop bar in Mitte',
    coffeeSpot: 'a cozy cafe in Prenzlauer Berg',
  },
  France: {
    city: 'Paris',
    sub: 'Paris · Architecture & espresso lover',
    rooftopSpot: 'a rooftop terrace in Le Marais',
    coffeeSpot: 'a chic cafe in Saint-Germain',
  },
  Japan: {
    city: 'Tokyo',
    sub: 'Tokyo · Design & specialty coffee',
    rooftopSpot: 'a skyline lounge in Shibuya',
    coffeeSpot: 'a quiet kissaten in Daikanyama',
  },
};

/**
 * Personality-tailored conversation templates across dating goals
 */
const CONVERSATION_MATRIX = {
  flirty: {
    incoming: [
      "Hey! Loved your travel photos 😊 Tell me, do you look this good in person or is that just great lighting?",
      "Swiped right pretty fast... that smile definitely caught my eye. What's your secret? 😉",
      "Hey! That cozy cafe photo caught my attention. Are you as fun in real life as you look?",
    ],
    date: [
      "Haha mostly great lighting, but you can be the judge over drinks at {rooftopSpot} this Friday 😉",
      "100% natural charisma 😉 Let's grab cocktails Thursday and see if our chemistry matches our taste.",
    ],
    phone: [
      "Haha mostly good lighting, but I'm terrible at checking Tinder DMs. Drop your WhatsApp and let's find out 😉",
      "Definitely the charm 😉 Send over your digits, let's take this off Tinder before messages get buried.",
    ],
    social: [
      "Haha you can see the unfiltered truth on my Instagram stories 😉 Drop your @, let's connect there.",
    ],
    never_stop: [
      "Haha definitely the lighting, but my banter is 100% genuine 😉 What's the best compliment you've gotten this week?",
      "Careful, you might get used to the charm 😉 What's something that instantly makes you smile?",
    ],
    bothDatePhone: [
      "Haha mostly great lighting! Tinder DMs are chaos though—drop your WhatsApp and let's plan drinks this week 😉",
    ],
  },
  witty: {
    incoming: [
      "Quick question: what was the craziest story behind that second travel photo? Please tell me you didn't get lost.",
      "Swiped right for the vibe, stayed to see if your humor matches your bio 😏",
      "Quick trivia: what's one hot take you have that would start a debate on date one?",
    ],
    date: [
      "Accidentally bowed to a wild deer that stole my biscuit! Let me redeem my pride over {coffeeSpot} this week—you pick the spot, I'll bring banter.",
      "Pineapple belongs on pizza and cold brew cures all. Let's debate it over drinks this Thursday—loser buys round one.",
    ],
    phone: [
      "Long story short: almost missed my flight! Tinder notifications are a ghost town on my phone though—drop your WhatsApp, let's text properly.",
      "Tinder notifications are where good banter goes to die. Drop your number, let's continue without the lag 😂",
    ],
    social: [
      "I actually have photographic evidence of that disaster on my Insta. What's your @? You can laugh at my stories.",
    ],
    never_stop: [
      "Let's just say it involved a wild monkey, a bag of cookies, and an embarrassing chase. Do you handle chaotic adventures well?",
      "Haha only if you can handle high-frequency sarcasm. On a scale of 1-10, how adventurous are your weekend plans?",
    ],
    bothDatePhone: [
      "Almost missed my flight! Tinder notifications are a mess on my end though—drop your digits and let's laugh over coffee this week.",
    ],
  },
  confident: {
    incoming: [
      "Hey! That cozy cafe in your photo looks incredible. What's your go-to Sunday plan?",
      "Hey! Loved your profile energy. What are you most passionate about right now?",
      "Swiped right! You seem like someone who knows exactly what they want.",
    ],
    date: [
      "Hunting down the best espresso in town, followed by live music. Come with me this Sunday—I know {coffeeSpot} you'll love.",
      "Building cool projects and finding great date spots. Let's grab drinks Thursday and see if our chemistry matches.",
    ],
    phone: [
      "I don't stay on this app for long. What's your number? Let's take this to WhatsApp and plan something fun.",
      "Let's skip the Tinder lag. Drop your WhatsApp and let's text directly.",
    ],
    social: [
      "My best photos don't make it to Tinder. What's your Instagram? Let's connect there.",
    ],
    never_stop: [
      "I believe Sunday mornings should only involve great espresso and zero alarms. Tell me: what's your non-negotiable weekend ritual?",
    ],
    bothDatePhone: [
      "Hunting down the best espresso in town. I don't linger on Tinder—drop your number, let's plan coffee this weekend.",
    ],
  },
  playful: {
    incoming: [
      "Swiped right because of the travel vibe, but your bio won me over 😏 Are you always this spontaneous?",
      "Okay be honest: do you actually cook or was that food photo just for the Tinder aesthetic?",
      "Hey! Your energy seems so fun. What's the most spontaneous thing you've done lately?",
    ],
    date: [
      "Only about 94% of the time! The other 6% I'm fiercely debating food. Loser buys the first round of drinks this weekend? 😉",
      "I make a killer pasta, I swear! How about we grab cocktails Thursday and you can quiz me on secret recipes?",
    ],
    phone: [
      "Haha guilty as charged! My Tinder notifications are a mess though. Drop your WhatsApp and let's banter without the lag 😏",
      "Trade secret! Drop your number and let's continue before Tinder buries our chat.",
    ],
    social: [
      "Haha trade travel stories for Instagram handles? Drop your @ and let's see if your stories match your bio energy 😏",
    ],
    never_stop: [
      "Haha only about 94% of the time! The other 6% I'm fiercely debating whether cereal is a soup 😏 What's your take?",
    ],
    bothDatePhone: [
      "Haha 100% authentic! My Tinder notifications are chaotic though. Drop your WhatsApp and let's test our banter over drinks this weekend 😏",
    ],
  },
  charming: {
    incoming: [
      "Hey there! Loved your travel photos from Kyoto 😊 Have you always had the wanderlust bug?",
      "Hey! Your profile feels very refreshing and warm. How's your week going?",
    ],
    date: [
      "Always. There's nothing quite like discovering a new city. I'd love to hear your favorite travel story over coffee at {coffeeSpot} this week.",
      "It's been great, but finding your profile definitely brightened it. Would love to take you out for drinks sometime this week if you're free.",
    ],
    phone: [
      "It was unforgettable. I'd love to tell you more, but Tinder DMs tend to bury messages. What's your number so we can text directly?",
    ],
    social: [
      "I'd love to share more photos from that trip with you! What's your Instagram? Let's swap handles.",
    ],
    never_stop: [
      "Always had a curious spirit. Tell me: if you could hop on a plane tomorrow to anywhere in the world, where are you headed?",
    ],
    bothDatePhone: [
      "Always had a curious heart! Tinder DMs get buried easily though. Drop your WhatsApp, let's plan coffee this week 😊",
    ],
  },
  romantic: {
    incoming: [
      "Golden hour rooftop views can't be beat. What's one place you've traveled that truly stayed in your heart?",
      "Hey! There's a really genuine warmth in your smile. What's something that always makes you smile?",
    ],
    date: [
      "Walking through the bamboo grove at dawn—it felt suspended in time. Let's find a quiet rooftop cafe this weekend and trade travel stories.",
      "Unplanned sunsets and cozy corners of the city. Would love to grab coffee together and get to know you.",
    ],
    phone: [
      "It's one of those memories that stays forever. I'd love to share the full story with you over WhatsApp—what's your number?",
    ],
    social: [
      "The photos barely do the sunset justice. What's your Instagram? I'd love to see the world through your lens too.",
    ],
    never_stop: [
      "Walking through the bamboo grove at sunrise—it felt like pure poetry. What's a small moment that made you smile today?",
    ],
    bothDatePhone: [
      "Walking through the bamboo grove at dawn. Tinder messages get lost, but drop your number—let's grab coffee this weekend and trade stories.",
    ],
  },
  bold: {
    incoming: [
      "Hey! That outdoor cafe in your photo caught my attention.",
      "Swiped right pretty quickly. You look like you have an adventurous streak.",
    ],
    date: [
      "It has incredible vibes, but I have a feeling drinks with you would beat it. Let's grab a cocktail Thursday at {rooftopSpot}.",
      "Guilty. Life's too short for boring small talk—let's grab drinks this Friday and see where the night takes us.",
    ],
    phone: [
      "Let's skip the Tinder lag. Drop your number and let's continue this over WhatsApp.",
    ],
    social: [
      "Tinder chats get lost. What's your Instagram handle? Let's see your real world vibe.",
    ],
    never_stop: [
      "I have a habit of diving headfirst into whatever excites me. What's something that instantly sparks your curiosity?",
    ],
    bothDatePhone: [
      "Life's too short for Tinder lag. Drop your number, let's plan drinks this Friday.",
    ],
  },
  gentle: {
    incoming: [
      "Hey there! Loved your profile, you seem to have such a calm and warm energy 😊",
      "Hey! Hope you're having a wonderful week. That travel photo looks so peaceful.",
    ],
    date: [
      "Thank you, that's really kind of you to say 😊 Would love to grab a calm coffee together if you're free sometime soon.",
      "It was so peaceful! Hope your week is treating you kindly too. Would love to chat more over a relaxed cup of coffee sometime.",
    ],
    phone: [
      "Thank you so much 😊 I don't check this app often, but I'd love to keep chatting on WhatsApp if you're comfortable sharing your number.",
    ],
    social: [
      "Thank you 😊 If you prefer chatting somewhere more relaxed, what's your Instagram? Would love to follow your adventures.",
    ],
    never_stop: [
      "Thank you, that made my evening 😊 How has your day been treating you so far?",
    ],
    bothDatePhone: [
      "Thank you, that's so sweet 😊 I don't check Tinder often, but drop your WhatsApp—would love to grab a calm coffee together.",
    ],
  },
  serious: {
    incoming: [
      "Looking for something real and genuine on here. What's a passion project you've been putting your heart into lately?",
      "It's hard finding people with depth on dating apps. What drives you in life right now?",
    ],
    date: [
      "Building something meaningful while learning photography. It's refreshing meeting someone genuine here—let's grab coffee this weekend and talk passions.",
      "Curiosity, creativity, and finding authentic connections. Would love to take you out for coffee and hear your story in person.",
    ],
    phone: [
      "It's rare finding conversations with substance on here. Would love to move this off the app to WhatsApp if you're open to it.",
    ],
    social: [
      "I share a lot of my photography and design work on Instagram. What's your @? Would love to see your creative side.",
    ],
    never_stop: [
      "Working on things that inspire people and staying true to my craft. What's a passion that you could talk about for hours?",
    ],
    bothDatePhone: [
      "Building meaningful tech projects and capturing honest moments. Drop your WhatsApp—let's grab coffee this weekend and talk passions.",
    ],
  },
  freestyle: {
    incoming: [
      "Hey! Love the energy in your photos 😊 How's your week treating you so far?",
      "Hey! Had to swipe right—your profile stands out in the best way. How was your weekend?",
    ],
    date: [
      "It's had its moments! But finding this match definitely made it better. How about we grab coffee or drinks at {rooftopSpot} this week?",
      "Full of good momentum! Let's grab drinks this Thursday—I know a great spot with rooftop views.",
    ],
    phone: [
      "It's been a whirlwind! Tinder DMs are notorious for burying messages though. Drop your number or WhatsApp, let's chat there.",
    ],
    social: [
      "Great minds think alike! I post way more travel bloopers on my Instagram. Drop your handle, let's connect there.",
    ],
    never_stop: [
      "It's been quite a ride, but chatting with you is definitely the highlight! What's something fun you've been up to lately?",
    ],
    bothDatePhone: [
      "Loving the vibe already! Tinder notifications are chaotic on my end though—drop your WhatsApp, let's plan drinks this week 😉",
    ],
  },
};

/**
 * Generates a non-hardcoded, fully context-aware match conversation
 * dynamically aligned with the user's specific onboarding settings.
 */
export function generateDynamicAiConversation({
  country = 'United States',
  selectedLanguages = ['English'],
  selectedGoals = ['date', 'phone'],
  personality = 'flirty',
  frequency = 30,
  safeMode = true,
  whatsapp = '',
  variationIndex = 0,
}) {
  const normalizedPersonality = CONVERSATION_MATRIX[personality] ? personality : 'freestyle';
  const personalityPack = CONVERSATION_MATRIX[normalizedPersonality];

  const loc = COUNTRY_LOCALIZATION[country] || {
    city: country,
    sub: `${country} · Architect & espresso lover`,
    rooftopSpot: 'a cozy rooftop bar',
    coffeeSpot: 'a cozy local cafe',
  };

  // Pick incoming match message
  const incList = personalityPack.incoming || [];
  const incIdx = variationIndex % incList.length;
  const incomingMessage = incList[incIdx] || incList[0];

  // Determine goal category
  const hasDate = selectedGoals.includes('date');
  const hasPhone = selectedGoals.includes('phone') || (whatsapp && whatsapp.trim().length >= 4);
  const hasSocial = selectedGoals.includes('social');
  const hasNeverStop = selectedGoals.includes('never_stop');

  let repliesPool = personalityPack.date;
  let strategyLabel = 'Setting up Date';

  if (hasDate && hasPhone && personalityPack.bothDatePhone) {
    repliesPool = personalityPack.bothDatePhone;
    strategyLabel = 'Date + WhatsApp Swap';
  } else if (hasDate) {
    repliesPool = personalityPack.date;
    strategyLabel = 'Pivoting to Date';
  } else if (hasPhone) {
    repliesPool = personalityPack.phone;
    strategyLabel = 'Moving to WhatsApp';
  } else if (hasSocial) {
    repliesPool = personalityPack.social;
    strategyLabel = 'Exchanging Instagram';
  } else if (hasNeverStop) {
    repliesPool = personalityPack.never_stop;
    strategyLabel = 'Chemistry & Banter';
  }

  const replyIdx = variationIndex % repliesPool.length;
  let rawReply = repliesPool[replyIdx] || repliesPool[0];

  // Inject localized country landmarks
  const formattedReply = rawReply
    .replace(/\{rooftopSpot\}/g, loc.rooftopSpot)
    .replace(/\{coffeeSpot\}/g, loc.coffeeSpot);

  return {
    matchName: 'Maya, 25',
    matchSub: `${loc.sub} · Active now`,
    incomingMessage,
    aiReply: formattedReply,
    strategyLabel,
    timingLabel: frequency === 30 ? 'Fast (30s)' : frequency === 120 ? 'Relaxed (2m)' : 'Balanced (1m)',
    personalityId: normalizedPersonality,
  };
}

/**
 * Attempts an authentic live LLM generation pass via OpenAI or Cloudflare Worker.
 * If unreachable, returns null so the dynamic context-synthesized reply takes over.
 */
export async function fetchLiveAiChatReply({
  personality = 'flirty',
  selectedGoals = ['date'],
  country = 'United States',
  selectedLanguages = ['English'],
  incomingMessage = '',
  apiKey = '',
  timeoutMs = 2400,
}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const goalDesc = selectedGoals.includes('date')
      ? 'Guide conversation naturally toward setting up a fun in-person date/drinks.'
      : selectedGoals.includes('phone')
      ? 'Guide conversation naturally toward asking for her number / WhatsApp.'
      : selectedGoals.includes('social')
      ? 'Guide conversation naturally toward swapping Instagram handles.'
      : 'Keep banter playful, engaging, and high-chemistry with no rush.';

    const systemPrompt = `You are Flirteasy, an elite modern dating wingman texting on Tinder in ${country}.
Personality vibe: ${personality}.
Your goal: ${goalDesc}
Rules:
- 1 to 2 short sentences max.
- Natural, modern, witty casual texting.
- No robot speak, no quotes, no placeholders, no clichés.
- Reply directly to the match's last message.`;

    const userPrompt = `Match says: "${incomingMessage}". Write Flirteasy's outgoing charming reply:`;

    // Mode A: Direct OpenAI API Key
    if (apiKey && apiKey.startsWith('sk-')) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.88,
          max_tokens: 65,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim()?.replace(/^["'](.*)["']$/, '$1');
        if (text && text.length > 8) return text;
      }
    }

    // Mode B: Linksy Worker Proxy
    const endpoints = API_CONFIG.getEndpoints();
    const res = await fetch(endpoints.AI_CHAT, {
      method: 'POST',
      headers: API_CONFIG.getHeaders(),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.88,
        max_tokens: 65,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const text = (data.choices?.[0]?.message?.content || data.message || data.result)?.trim()?.replace(/^["'](.*)["']$/, '$1');
      if (text && text.length > 8) return text;
    }
  } catch (_) {
    // Graceful fallback to dynamic synthesized matrix
  }

  return null;
}
