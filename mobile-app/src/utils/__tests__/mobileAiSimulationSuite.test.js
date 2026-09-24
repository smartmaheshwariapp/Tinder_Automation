// mobile-app/src/utils/__tests__/mobileAiSimulationSuite.test.js
/**
 * End-to-End Simulation Suite for FlirtEasy Mobile App AI Engine
 * 
 * Exercises all possible conversation scenarios handled by OnDeviceBackgroundWorker:
 * 1. Intro: Male sender -> Female rich profile (e.g. Mallory)
 * 2. Intro: Male sender -> Female blank profile (Anti-hallucination verification)
 * 3. Intro: Female sender -> Male match (Warm casual greeting)
 * 4. Intro: Non-Latin name match in English context (Name suppression)
 * 5. Follow-Up: Unanswered first message
 * 6. Ongoing: Early conversation (Stage: opening)
 * 7. Ongoing: Anti-interview guard (Last message was a question)
 * 8. Ongoing: Match style mirroring (Short bursts / casual punctuation)
 * 9. Ongoing: Mid conversation (Stage: building rapport)
 * 10. Ongoing: Established conversation (Stage: established)
 * 11. Ongoing: Consecutive messages mode (Double texting JSON format)
 * 12. Move-Off-App: Telegram goal with contact details
 * 13. Move-Off-App: Instagram goal with contact details
 * 14. Move-Off-App: Tango goal with contact details
 * 15. Safety & Formatting: Placeholder & syntax cleaning
 * 16. Fallback: API unreachable network error handling
 */

import { OnDeviceBackgroundWorker } from '../onDeviceBackgroundWorker';

describe('FlirtEasy Mobile AI Simulation Suite (All Scenarios)', () => {
  let worker;
  const logs = [];

  beforeEach(() => {
    logs.length = 0;
    worker = new OnDeviceBackgroundWorker(
      {},
      null,
      (msg) => logs.push(msg)
    );
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. INTRO / OPENER SCENARIOS
  // ════════════════════════════════════════════════════════════════════════════
  describe('1. Intro / Opener Scenarios', () => {
    test('Scenario 1: Male Sender -> Female Rich Profile (Mallory Case)', async () => {
      const matchData = {
        name: 'Mallory',
        age: 24,
        bio: 'Love puzzles, trying to get myself out there',
        questionAnswers: [
          { question: 'I can beat you in a game of...', answer: 'Sudoku' },
          { question: 'My latest hyperfixation is...', answer: 'Learning how to write in cursive' }
        ],
        interests: ['Foodie', 'Snowboarding'],
        descriptors: ['Workout: Never', 'Looking for: Long-term, open to short']
      };
      const settings = { userGender: 'male', chattingStyle: 'freestyle' };

      const sysPrompt = worker.buildSystemPrompt(settings, false, matchData);
      const userPrompt = worker.buildUserPrompt(matchData, settings, false);

      // Verify prompt construction
      expect(sysPrompt).toContain('OPENER PERSONALITY (male sender, read first)');
      expect(sysPrompt).toContain('8-14 words');
      expect(userPrompt).toContain('NAME: Mallory');
      expect(userPrompt).toContain('Sudoku');
      expect(userPrompt).toContain('Workout: Never');
      expect(userPrompt).toContain('CRITICAL RULE: ONLY reference details explicitly listed above');

      // Simulate AI response
      worker.callOpenAI = jest.fn().mockResolvedValue(
        'Mallory, Sudoku and cursive writing? ok I need to know the story there'
      );

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Mallory, Sudoku and cursive writing? ok I need to know the story there');
      expect(result.message.toLowerCase()).not.toContain('hiking');
      expect(worker.callOpenAI).toHaveBeenCalledWith(sysPrompt, userPrompt, expect.anything());
    });

    test('Scenario 2: Male Sender -> Female Blank Profile (Anti-Hallucination Guard)', async () => {
      const matchData = { name: 'Jessica' };
      const settings = { userGender: 'male', chattingStyle: 'freestyle' };

      const userPrompt = worker.buildUserPrompt(matchData, settings, false);

      expect(userPrompt).toContain('Their profile has no bio or details listed');
      expect(userPrompt).toContain('CRITICAL RULE: Do NOT claim you saw anything in their profile, and NEVER invent or guess any hobbies or activities');

      // Simulate AI generating a natural, non-hallucinated opener
      worker.callOpenAI = jest.fn().mockResolvedValue(
        'hey Jessica, your profile gave me zero clues so you get full mystery points'
      );

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).toContain('mystery points');
      expect(result.message.toLowerCase()).not.toContain('hiking');
    });

    test('Scenario 3: Female Sender -> Male Match (Casual Warm Greeting)', async () => {
      const matchData = { name: 'Liam', gender: 'male' };
      const settings = { userGender: 'female', chattingStyle: 'freestyle' };

      const sysPrompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(sysPrompt).toContain('CRITICAL — OPENER RULE (female sender)');
      expect(sysPrompt).toContain('Max 6 words');

      worker.callOpenAI = jest.fn().mockResolvedValue('hey! how is your week going?');

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).toBe('hey! how is your week going?');
    });

    test('Scenario 4: Non-Latin Name Match in English Context (Name Suppression)', async () => {
      const matchData = { name: 'ניקה', bio: 'Architecture and coffee' };
      const settings = { userGender: 'male', conversationLanguage: 'en' };

      const userPrompt = worker.buildUserPrompt(matchData, settings, false);

      expect(userPrompt).not.toContain('NAME: ניקה');
      expect(userPrompt).toContain('IMPORTANT: Do NOT address the match by name in your opening message');

      worker.callOpenAI = jest.fn().mockResolvedValue(
        'an architect who survives on coffee, sounds like a dangerous combo'
      );

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('ניקה');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. FOLLOW-UP SCENARIOS
  // ════════════════════════════════════════════════════════════════════════════
  describe('2. Follow-Up Scenarios', () => {
    test('Scenario 5: Follow-Up Message After No Reply', async () => {
      const matchData = {
        name: 'Mallory',
        conversationHistory: [
          { sender: 'user', text: 'Mallory, Sudoku and cursive writing? ok I need to know the story there' }
        ]
      };
      const settings = { userGender: 'male' };

      const sysPrompt = worker.buildSystemPrompt(settings, true, matchData);
      const userPrompt = worker.buildUserPrompt(matchData, settings, true);

      expect(sysPrompt).toContain('RULE: Do NOT end with a question');
      expect(userPrompt).toContain('We haven\'t received a reply yet after sending: "Mallory, Sudoku and cursive writing? ok I need to know the story there"');
      expect(userPrompt).toContain('Generate a light, casual follow-up message (1 sentence)');

      worker.callOpenAI = jest.fn().mockResolvedValue(
        'hope the cursive writing practice is going well this week 🙂'
      );

      const result = await worker.generateMessage(matchData, settings, true);

      expect(result.success).toBe(true);
      expect(result.message).toBe('hope the cursive writing practice is going well this week 🙂');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. ONGOING CONVERSATION SCENARIOS
  // ════════════════════════════════════════════════════════════════════════════
  describe('3. Ongoing Conversation Scenarios', () => {
    test('Scenario 6: Early Conversation (Stage: Opening, msgCount <= 2)', async () => {
      const matchData = {
        name: 'Mallory',
        conversationHistory: [
          { sender: 'user', text: 'Mallory, Sudoku and cursive writing? ok I need to know the story there' },
          { sender: 'match', text: 'hahaha I swear they are both therapeutic in very weird ways' }
        ]
      };
      const settings = { userGender: 'male' };

      const sysPrompt = worker.buildSystemPrompt(settings, false, matchData);
      const userPrompt = worker.buildUserPrompt(matchData, settings, false);

      expect(sysPrompt).toContain('[Stage: opening — keep it light and curious, build interest]');
      expect(sysPrompt).toContain('MALE SENDER PERSONALITY — conversation mode');
      expect(userPrompt).toContain('Mallory: hahaha I swear they are both therapeutic in very weird ways');

      worker.callOpenAI = jest.fn().mockResolvedValue(
        'therapeutic until you get completely stuck on a puzzle for three hours'
      );

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).toBe('therapeutic until you get completely stuck on a puzzle for three hours');
    });

    test('Scenario 7: Anti-Interview Guard (Prevent Back-to-Back Questions)', async () => {
      const matchData = {
        name: 'Mallory',
        conversationHistory: [
          { sender: 'user', text: 'what is your best record on an expert puzzle?' }, // Ended with '?'
          { sender: 'match', text: 'about 6 minutes on a good day!' }
        ]
      };
      const settings = { userGender: 'male' };

      const sysPrompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(sysPrompt).toContain('OVERRIDE: Your LAST message ended with a question. Do NOT end this one with a question. React, comment, or make a statement.');

      worker.callOpenAI = jest.fn().mockResolvedValue(
        '6 minutes is honestly absurd, I was expecting 20 minimum'
      );

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('?');
    });

    test('Scenario 8: Match Style Mirroring (Matching Short Bursts)', async () => {
      const matchData = {
        name: 'Chloe',
        conversationHistory: [
          { sender: 'user', text: 'how was your weekend?' },
          { sender: 'match', text: 'lol' },
          { sender: 'match', text: 'super lazy' },
          { sender: 'match', text: 'just coffee and netflix u?' }
        ]
      };
      const settings = { userGender: 'male' };

      const sysPrompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(sysPrompt).toContain('MATCH TEXTING STYLE:');
      expect(sysPrompt).toContain('"just coffee and netflix u?"');
      expect(sysPrompt).toContain('Your reply must MATCH their delivery format exactly');

      worker.callOpenAI = jest.fn().mockResolvedValue('same here honestly, did not leave my couch');

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).toBe('same here honestly, did not leave my couch');
    });

    test('Scenario 9: Mid-Conversation Arc (Stage: Building Rapport, msgCount 4-6)', () => {
      const matchData = {
        name: 'Sarah',
        conversationHistory: [
          { sender: 'user', text: '1' },
          { sender: 'match', text: '2' },
          { sender: 'user', text: '3' },
          { sender: 'match', text: '4' }
        ]
      };
      const prompt = worker.buildSystemPrompt({ userGender: 'male' }, false, matchData);
      expect(prompt).toContain('[Stage: building rapport — deepen the conversation, show personality]');
    });

    test('Scenario 10: Established Arc (Stage: Established, msgCount 7-12)', () => {
      const matchData = {
        name: 'Sarah',
        conversationHistory: Array(8).fill({ sender: 'match', text: 'chat' })
      };
      const prompt = worker.buildSystemPrompt({ userGender: 'male' }, false, matchData);
      expect(prompt).toContain('[Stage: established — can suggest meeting or escalate naturally]');
    });

    test('Scenario 11: Consecutive Messages Mode (Double-Texting Enabled)', async () => {
      const matchData = {
        name: 'Mallory',
        conversationHistory: [
          { sender: 'user', text: 'Any cool coffee spots you recommend in Aspen?' },
          { sender: 'match', text: 'Oh yeah quite a few depending on what you like!' }
        ]
      };
      const settings = { userGender: 'male', consecutiveMessagesEnabled: true };

      const sysPrompt = worker.buildSystemPrompt(settings, false, matchData);
      expect(sysPrompt).toContain('CONSECUTIVE MESSAGES MODE:');
      expect(sysPrompt).toContain('Return ONLY valid JSON:');

      worker.callOpenAI = jest.fn().mockResolvedValue(
        '{"messages": ["somewhere with good cold brew and no screaming kids", "tell me you have a secret favorite spot"]}'
      );

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toBe('somewhere with good cold brew and no screaming kids');
      expect(result.messages[1]).toBe('tell me you have a secret favorite spot');
      expect(result.message).toBe(result.messages[0]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. MOVE-OFF-APP & CONTACT SHARING SCENARIOS
  // ════════════════════════════════════════════════════════════════════════════
  describe('4. Move-Off-App & Contact Sharing Scenarios', () => {
    test('Scenario 12: Move to Telegram Goal with Contact Details', () => {
      const settings = {
        stopConditions: ['move_to_telegram'],
        contactDetails: {
          telegram: { enabled: true, value: 'cool_sanket' }
        }
      };
      const matchData = {
        name: 'Elena',
        conversationHistory: [{ sender: 'match', text: 'I am barely on here' }]
      };

      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('MY_TELEGRAM: @cool_sanket');
      expect(prompt).toContain('Share ONLY when naturally asked or when moving conversation off Tinder');
    });

    test('Scenario 13: Move to Instagram Goal with Contact Details', () => {
      const settings = {
        stopConditions: ['move_to_instagram'],
        contactDetails: {
          instagram: { enabled: true, value: 'travel_guy' }
        }
      };
      const matchData = {
        name: 'Elena',
        conversationHistory: [{ sender: 'match', text: 'what is your ig?' }]
      };

      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('MY_INSTAGRAM: @travel_guy');
    });

    test('Scenario 14: Move to Tango Goal with Contact Details', () => {
      const settings = {
        stopConditions: ['move_to_tango'],
        contactDetails: {
          tango: { enabled: true, value: 'tango_user_99' }
        }
      };
      const matchData = {
        name: 'Elena',
        conversationHistory: [{ sender: 'match', text: 'hey!' }]
      };

      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('MY_TANGO: tango_user_99');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. SAFETY & FALLBACK SCENARIOS
  // ════════════════════════════════════════════════════════════════════════════
  describe('5. Safety, Formatting & Fallback Scenarios', () => {
    test('Scenario 15: Safety Guard Removes Placeholders and Em-Dashes', async () => {
      const rawAIResponse = '"[Mallory] — love the vibe — definitely caught my eye [Denver]"';
      worker.callOpenAI = jest.fn().mockResolvedValue(rawAIResponse);

      const result = await worker.generateMessage({ name: 'Mallory' }, {}, false);

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('[');
      expect(result.message).not.toContain(']');
      expect(result.message).not.toContain('—');
      expect(result.message).toBe('love the vibe, definitely caught my eye');
    });

    test('Scenario 16: API Network Failure Triggers Graceful Fallback', async () => {
      worker.callOpenAI = jest.fn().mockRejectedValue(new Error('Network request failed 502 Bad Gateway'));

      const result = await worker.generateMessage(
        { name: 'Mallory' },
        { chattingStyle: 'flirty' },
        false
      );

      expect(result.success).toBe(true);
      expect(result.isFallback).toBe(true);
      expect(result.message).toContain('Mallory');
      expect(logs.some(l => l.includes('AI generation failed'))).toBe(true);
    });

    test('Scenario 17: Match Texts in Hindi/Hinglish with English App Default', async () => {
      const matchData = {
        name: 'Pooja',
        detectedLanguage: { code: 'hi', name: 'Hindi' },
        conversationHistory: [
          { sender: 'user', text: 'hey Pooja, chai and long drives, tell me that is a daily thing' },
          { sender: 'match', text: 'haha bilkul! kya kar rahe ho aajkal?' }
        ]
      };
      // App settings default to English
      const settings = { conversationLanguage: 'en', chattingStyle: 'casual' };

      const sysPrompt = worker.buildSystemPrompt(settings, false, matchData);

      // Verify Hindi/Hinglish slang guidance is injected even with English default settings
      expect(sysPrompt).toContain('Hinglish');
      expect(sysPrompt).toContain('MATCH TEXTING STYLE');
      expect(sysPrompt).toContain('haha bilkul! kya kar rahe ho aajkal?');

      worker.callOpenAI = jest.fn().mockResolvedValue(
        'bas office se break leke chai pi raha hu, tum batao kya chal raha hai?'
      );

      const result = await worker.generateMessage(matchData, settings, false);

      expect(result.success).toBe(true);
      expect(result.message).toContain('chai');
      expect(result.message).toContain('kya chal raha hai');
    });
  });
});

