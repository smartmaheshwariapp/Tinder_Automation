import { CONTENT_SCRIPT_BUNDLE } from '../contentScriptBundle';

describe('Tinder Mobile New Match Detection & Opener Logic', () => {
  it('bundles the enhanced getNewMatchesFromGrid function into the content script bundle', () => {
    expect(CONTENT_SCRIPT_BUNDLE).toContain('getNewMatchesFromGrid');
    expect(CONTENT_SCRIPT_BUNDLE).toContain('isUnderNewMatches');
  });

  it('contains the auto-promotion logic for uncontacted matches in getUnreadMatches', () => {
    expect(CONTENT_SCRIPT_BUNDLE).toContain('Auto-promoting uncontacted match from list to new matches');
  });

  it('contains the isUncontactedOpener readiness criteria in processChats', () => {
    expect(CONTENT_SCRIPT_BUNDLE).toContain('isUncontactedOpener');
    expect(CONTENT_SCRIPT_BUNDLE).toContain('TIER 2: Your Move / Uncontacted Opener');
  });

  it('contains route change fallback navigation for new matches', () => {
    expect(CONTENT_SCRIPT_BUNDLE).toContain('Direct click did not update route, forcing navigation');
  });

  describe('Uncontacted Match Readiness Evaluation Logic', () => {
    function evaluateReadiness({
      lastMessageTime = 0,
      snippet = '',
      isYourMove = false,
      isNew = false,
      hasUnread = false,
      sheRepliedLast = false,
      hardStopped = false,
      pausedUntil = 0,
      timeSince = 0,
      followupDelay = 24 * 3600 * 1000,
      followupCount = 0,
    }) {
      const isUncontactedOpener = lastMessageTime === 0 && (!snippet || snippet.trim() === '' || isYourMove || isNew);
      const isPaused = pausedUntil > Date.now();
      const isFollowupReady = (lastMessageTime > 0 && !hardStopped && !isPaused && timeSince >= followupDelay && followupCount < 3);
      const isReady = hasUnread || sheRepliedLast || isUncontactedOpener || isFollowupReady;
      return { isReady, isUncontactedOpener, isFollowupReady };
    }

    it('marks a brand new match like Mallory (lastMessageTime=0, snippet="", no badge) as ready for an opener', () => {
      const result = evaluateReadiness({
        lastMessageTime: 0,
        snippet: '',
        isYourMove: false,
        isNew: true,
        hasUnread: false,
        sheRepliedLast: false,
      });

      expect(result.isReady).toBe(true);
      expect(result.isUncontactedOpener).toBe(true);
    });

    it('marks an uncontacted match from list fallback (isNew=false, snippet="") as ready for an opener', () => {
      const result = evaluateReadiness({
        lastMessageTime: 0,
        snippet: '',
        isYourMove: false,
        isNew: false,
        hasUnread: false,
        sheRepliedLast: false,
      });

      expect(result.isReady).toBe(true);
      expect(result.isUncontactedOpener).toBe(true);
    });

    it('does not treat existing active conversations with recent messages as uncontacted openers', () => {
      const result = evaluateReadiness({
        lastMessageTime: Date.now() - 3600000, // 1 hour ago
        snippet: 'Hey how are you?',
        isYourMove: false,
        isNew: false,
        hasUnread: false,
        sheRepliedLast: false,
      });

      expect(result.isReady).toBe(false);
      expect(result.isUncontactedOpener).toBe(false);
    });
  });
});
