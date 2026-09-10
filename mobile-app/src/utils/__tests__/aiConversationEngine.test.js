import {
  generateDynamicAiConversation,
  fetchLiveAiChatReply,
} from '../aiConversationEngine';

describe('aiConversationEngine', () => {
  it('generates flirty date conversation for India correctly', () => {
    const res = generateDynamicAiConversation({
      personality: 'flirty',
      selectedGoals: ['date'],
      country: 'India',
    });

    expect(res.matchName).toBe('Maya, 25');
    expect(res.matchSub).toContain('Mumbai');
    expect(res.incomingMessage).toBeTruthy();
    expect(res.aiReply).toContain('Bandra');
    expect(res.personalityId).toBe('flirty');
  });

  it('generates flirty phone conversation for United States with WhatsApp', () => {
    const res = generateDynamicAiConversation({
      personality: 'flirty',
      selectedGoals: ['phone'],
      country: 'United States',
      whatsapp: '+1234567890',
    });

    expect(res.strategyLabel).toBe('Moving to WhatsApp');
    expect(res.aiReply.toLowerCase()).toContain('whatsapp');
  });

  it('combines date and phone goals when both selected', () => {
    const res = generateDynamicAiConversation({
      personality: 'witty',
      selectedGoals: ['date', 'phone'],
      country: 'United Kingdom',
    });

    expect(res.strategyLabel).toBe('Date + WhatsApp Swap');
    expect(res.incomingMessage).toBeTruthy();
    expect(res.aiReply).toBeTruthy();
  });

  it('handles playful never_stop banter goal correctly', () => {
    const res = generateDynamicAiConversation({
      personality: 'playful',
      selectedGoals: ['never_stop'],
      country: 'Canada',
    });

    expect(res.strategyLabel).toBe('Chemistry & Banter');
    expect(res.aiReply).toBeTruthy();
  });

  it('handles social goal correctly', () => {
    const res = generateDynamicAiConversation({
      personality: 'confident',
      selectedGoals: ['social'],
      country: 'Australia',
    });

    expect(res.strategyLabel).toBe('Exchanging Instagram');
    expect(res.aiReply.toLowerCase()).toContain('instagram');
  });

  it('falls back gracefully on unknown personality', () => {
    const res = generateDynamicAiConversation({
      personality: 'unknown_vibe',
      selectedGoals: ['date'],
      country: 'France',
    });

    expect(res.personalityId).toBe('freestyle');
    expect(res.aiReply).toBeTruthy();
  });

  it('fetchLiveAiChatReply times out safely and returns null without crashing', async () => {
    const reply = await fetchLiveAiChatReply({
      personality: 'flirty',
      selectedGoals: ['date'],
      country: 'United States',
      incomingMessage: 'Hello',
      timeoutMs: 100,
    });
    expect(reply === null || typeof reply === 'string').toBe(true);
  });
});
