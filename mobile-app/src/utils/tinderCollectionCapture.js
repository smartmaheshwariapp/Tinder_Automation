export function createSwipeEventFromDomMessage(message, timestamp = Date.now()) {
  const name = typeof message?.name === 'string' && message.name.trim() ? message.name.trim().slice(0, 100) : 'Tinder profile';
  const id = message?.profileId || message?.id || `dom_${timestamp}_${Number(message?.swipeCount) || 0}`;
  const photoUrl = typeof message?.photoUrl === 'string' && message.photoUrl.startsWith('https://') ? message.photoUrl : null;
  return { kind: 'swipe', action: message?.action === 'pass' ? 'pass' : 'like', timestamp, matched: Boolean(message?.matched), profile: { _id: String(id).slice(0, 100), name, bio: typeof message?.bio === 'string' ? message.bio : (message?.detail || ''), photos: photoUrl ? [{ url: photoUrl }] : [], interests: Array.isArray(message?.interests) ? message.interests : [] } };
}
