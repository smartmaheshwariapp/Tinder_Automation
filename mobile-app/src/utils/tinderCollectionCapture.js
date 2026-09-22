import { scoreCandidateLocal } from './aiMatchScorer';

export function createSwipeEventFromDomMessage(message, timestamp = Date.now(), ownProfile = null, preferences = {}) {
  const name = typeof message?.name === 'string' && message.name.trim() ? message.name.trim().slice(0, 100) : 'Tinder profile';
  const id = message?.profileId || message?.id || `dom_${timestamp}_${Number(message?.swipeCount) || 0}`;
  const photoUrl = typeof message?.photoUrl === 'string' && message.photoUrl.startsWith('https://') ? message.photoUrl : null;
  const rawPhotos = Array.isArray(message?.photos) && message.photos.length > 0 ? message.photos : (photoUrl ? [photoUrl] : []);
  const photos = rawPhotos
    .map(p => (typeof p === 'string' ? { url: p } : p))
    .filter(p => typeof p?.url === 'string' && p.url.startsWith('https://'));

  const candidateProfile = {
    _id: String(id).slice(0, 100),
    id: String(id).slice(0, 100),
    name,
    age: typeof message?.age === 'number' ? message.age : null,
    bio: typeof message?.bio === 'string' ? message.bio : (message?.detail || ''),
    photos,
    interests: Array.isArray(message?.interests) ? message.interests : [],
    job: typeof message?.job === 'string' ? message.job : null,
    school: typeof message?.school === 'string' ? message.school : null,
    city: typeof message?.city === 'string' ? message.city : null,
    distanceMi: typeof message?.distanceMi === 'number' ? message.distanceMi : null,
    lookingFor: typeof message?.lookingFor === 'string' ? message.lookingFor : null,
    descriptors: Array.isArray(message?.descriptors) ? message.descriptors : [],
    questionAnswers: Array.isArray(message?.questionAnswers) ? message.questionAnswers : [],
    verified: Boolean(message?.verified),
  };

  let matchScore = typeof message?.matchScore === 'number' ? Math.round(message.matchScore) : null;
  let matchConfidence = typeof message?.matchConfidence === 'number' ? message.matchConfidence : null;
  let matchLabel = typeof message?.matchLabel === 'string' ? message.matchLabel.slice(0, 30) : null;
  let matchBreakdown = Array.isArray(message?.matchBreakdown)
    ? message.matchBreakdown.slice(0, 10).map(b => ({
        axis: String(b?.axis || '').slice(0, 30),
        earned: Number(b?.earned) || 0,
        max: Number(b?.max) || 0,
      }))
    : [];

  if (matchScore == null) {
    const scored = scoreCandidateLocal(candidateProfile, ownProfile, preferences);
    matchScore = scored.score;
    matchConfidence = scored.confidence;
    matchLabel = scored.label;
    matchBreakdown = scored.breakdown;
  }

  return {
    kind: 'swipe',
    action: message?.action === 'pass' ? 'pass' : 'like',
    timestamp,
    matched: Boolean(message?.matched),
    profile: {
      ...candidateProfile,
      matchScore,
      matchConfidence,
      matchLabel,
      matchBreakdown,
    }
  };
}
