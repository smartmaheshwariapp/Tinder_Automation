// mobile-app/src/utils/__tests__/onDevicePromptParity.test.js
import { OnDeviceBackgroundWorker } from '../onDeviceBackgroundWorker';
import { normalizeGender, isNonLatinName } from '../promptConstants';

describe('OnDeviceBackgroundWorker Prompt Engine Parity', () => {
  let worker;

  beforeEach(() => {
    worker = new OnDeviceBackgroundWorker();
  });

  describe('Gender Normalizer', () => {
    it('normalizes various gender strings correctly', () => {
      expect(normalizeGender('Man')).toBe('male');
      expect(normalizeGender('male')).toBe('male');
      expect(normalizeGender('m')).toBe('male');
      expect(normalizeGender('Woman')).toBe('female');
      expect(normalizeGender('female')).toBe('female');
      expect(normalizeGender('f')).toBe('female');
      expect(normalizeGender('non-binary')).toBe('non-binary');
      expect(normalizeGender(null)).toBe('unknown');
    });

    it('detects non-Latin names correctly', () => {
      expect(isNonLatinName('ניקה')).toBe(true);
      expect(isNonLatinName('ส้ม')).toBe(true);
      expect(isNonLatinName('Sarah')).toBe(false);
      expect(isNonLatinName('Mallory')).toBe(false);
    });
  });

  describe('buildSystemPrompt Parity', () => {
    it('injects male opener personality with 8-14 word constraint and genuine curiosity', () => {
      const settings = { userGender: 'male', chattingStyle: 'freestyle' };
      const matchData = { name: 'Mallory', gender: 'female' };
      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('OPENER PERSONALITY (male sender, read first)');
      expect(prompt).toContain('8-14 words');
      expect(prompt).toContain('Mallory');
      expect(prompt).toContain('BAD (never do this)');
    });

    it('injects female opener personality with short casual greeting', () => {
      const settings = { userGender: 'female', chattingStyle: 'freestyle' };
      const matchData = { name: 'Alex', gender: 'male' };
      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('OPENER RULE (female sender)');
      expect(prompt).toContain('Max 6 words');
      expect(prompt).toContain('hey!');
    });

    it('injects male conversation personality in conversation mode', () => {
      const settings = { userGender: 'male' };
      const matchData = {
        name: 'Sarah',
        conversationHistory: [
          { sender: 'user', text: 'Hey Sarah, love your travel photos' },
          { sender: 'match', text: 'Thanks! Just got back from Italy' }
        ]
      };
      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('MALE SENDER PERSONALITY — conversation mode');
      expect(prompt).toContain('Real men text with intention');
    });

    it('injects female conversation personality in conversation mode', () => {
      const settings = { userGender: 'female' };
      const matchData = {
        name: 'David',
        conversationHistory: [
          { sender: 'user', text: 'hey!' },
          { sender: 'match', text: 'Hey there, how is your weekend?' }
        ]
      };
      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('FEMALE SENDER PERSONALITY — conversation mode');
      expect(prompt).toContain('Real women don\'t text like customer service');
    });

    it('mirrors match texting style from recent match messages', () => {
      const settings = { userGender: 'male' };
      const matchData = {
        name: 'Chloe',
        conversationHistory: [
          { sender: 'user', text: 'Hey Chloe' },
          { sender: 'match', text: 'hey haha' },
          { sender: 'user', text: 'Doing anything fun today?' },
          { sender: 'match', text: 'just chilling w coffee u?' }
        ]
      };
      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('MATCH TEXTING STYLE:');
      expect(prompt).toContain('"just chilling w coffee u?"');
      expect(prompt).toContain('Your reply must MATCH their delivery format exactly');
    });

    it('triggers anti-interview guard when last user message was a question', () => {
      const settings = { userGender: 'male' };
      const matchData = {
        name: 'Chloe',
        conversationHistory: [
          { sender: 'match', text: 'Yeah I love Italian food' },
          { sender: 'user', text: 'What is your favorite restaurant in town?' }
        ]
      };
      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('OVERRIDE: Your LAST message ended with a question');
      expect(prompt).toContain('Do NOT end this one with a question');
    });

    it('injects conversation arc stages according to message count', () => {
      // Stage: opening (<=2)
      const promptEarly = worker.buildSystemPrompt({ userGender: 'male' }, false, {
        conversationHistory: [{ sender: 'match', text: 'hey' }]
      });
      expect(promptEarly).toContain('[Stage: opening');

      // Stage: building rapport (3-6)
      const promptMid = worker.buildSystemPrompt({ userGender: 'male' }, false, {
        conversationHistory: [
          { sender: 'match', text: '1' },
          { sender: 'user', text: '2' },
          { sender: 'match', text: '3' },
          { sender: 'user', text: '4' }
        ]
      });
      expect(promptMid).toContain('[Stage: building rapport');
    });

    it('injects consecutive messages instructions when feature is enabled', () => {
      const settings = { userGender: 'male', consecutiveMessagesEnabled: true };
      const matchData = {
        name: 'Sarah',
        conversationHistory: [{ sender: 'match', text: 'hey' }]
      };
      const prompt = worker.buildSystemPrompt(settings, false, matchData);

      expect(prompt).toContain('CONSECUTIVE MESSAGES MODE:');
      expect(prompt).toContain('{"messages": ["first complete thought", "second complete thought"]}');
    });
  });

  describe('buildUserPrompt Parity', () => {
    it('formats rich profile with prompts, bio, job, school, city, and descriptors', () => {
      const matchData = {
        name: 'Mallory',
        age: 24,
        bio: 'Love puzzles, trying to get myself out there',
        questionAnswers: [
          { question: 'I can beat you in a game of...', answer: 'Sudoku' },
          { question: 'My sense of humor is basically just...', answer: 'Really dark' }
        ],
        interests: ['Foodie', 'Snowboarding'],
        job: 'Assistant Manager at Aspen Sports',
        school: 'Northglenn highschool',
        city: 'Lives in Aspen',
        descriptors: ['Workout: Never', 'Looking for: Long-term, open to short']
      };

      const prompt = worker.buildUserPrompt(matchData, {}, false);

      expect(prompt).toContain('NAME: Mallory');
      expect(prompt).toContain('AGE: 24');
      expect(prompt).toContain('BIO: Love puzzles, trying to get myself out there');
      expect(prompt).toContain('PROMPTS: "I can beat you in a game of...": Sudoku | "My sense of humor is basically just...": Really dark');
      expect(prompt).toContain('INTERESTS: Foodie, Snowboarding');
      expect(prompt).toContain('JOB: Assistant Manager at Aspen Sports');
      expect(prompt).toContain('SCHOOL: Northglenn highschool');
      expect(prompt).toContain('CITY: Lives in Aspen');
      expect(prompt).toContain('DETAILS: Workout: Never, Looking for: Long-term, open to short');
      expect(prompt).toContain('CRITICAL RULE: ONLY reference details explicitly listed above');
    });

    it('enforces anti-hallucination rule when profile has zero details', () => {
      const matchData = { name: 'BlankProfile' };
      const prompt = worker.buildUserPrompt(matchData, {}, false);

      expect(prompt).toContain('Their profile has no bio or details listed');
      expect(prompt).toContain('CRITICAL RULE: Do NOT claim you saw anything in their profile, and NEVER invent or guess any hobbies or activities');
    });

    it('suppresses non-Latin names from English opening prompt', () => {
      const matchData = { name: 'ניקה', bio: 'Living life' };
      const prompt = worker.buildUserPrompt(matchData, { conversationLanguage: 'en' }, false);

      expect(prompt).not.toContain('NAME: ניקה');
      expect(prompt).toContain('IMPORTANT: Do NOT address the match by name in your opening message');
    });
  });

  describe('generateMessage consecutive messages JSON parsing', () => {
    it('parses JSON consecutive message array and returns multi-part message', async () => {
      worker.callOpenAI = jest.fn().mockResolvedValue(
        '{"messages": ["hey Mallory", "Sudoku champion huh? bold claim"]}'
      );

      const result = await worker.generateMessage(
        { name: 'Mallory', bio: 'Puzzles' },
        { consecutiveMessagesEnabled: true },
        false
      );

      expect(result.success).toBe(true);
      expect(result.messages).toEqual(['hey Mallory', 'Sudoku champion huh? bold claim']);
      expect(result.message).toBe('hey Mallory');
    });

    it('handles normal single-string AI response seamlessly', async () => {
      worker.callOpenAI = jest.fn().mockResolvedValue('hey Mallory, what kind of puzzles do you like?');

      const result = await worker.generateMessage({ name: 'Mallory' }, {}, false);

      expect(result.success).toBe(true);
      expect(result.message).toBe('hey Mallory, what kind of puzzles do you like?');
      expect(result.messages).toBeUndefined();
    });
  });
});
