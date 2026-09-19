export const COLLECTION_LIMIT = 500;
const text = (value, max = 500) => typeof value === 'string' ? value.slice(0, max) : '';
const list = value => (Array.isArray(value) ? value : []).map(item => text(typeof item === 'string' ? item : item?.name, 80)).filter(Boolean).slice(0, 30);

export function normalizeProfile(raw) {
  const profile = raw?.user || raw?.person || raw || {};
  const id = text(profile._id || profile.id, 100);
  if (!id) return null;
  const age = Number.isFinite(Number(profile.age)) ? Number(profile.age) : null;
  const distanceMi = Number.isFinite(Number(profile.distanceMi ?? profile.distance_mi)) ? Number(profile.distanceMi ?? profile.distance_mi) : null;

  return {
    id,
    name: text(profile.name, 100) || 'Tinder profile',
    age,
    bio: text(profile.bio, 2000),
    photos: (Array.isArray(profile.photos) ? profile.photos : [])
      .map(item => (typeof item === 'string' ? item : item?.url || item?.processedFiles?.[0]?.url))
      .filter(url => typeof url === 'string' && url.startsWith('https://'))
      .slice(0, 12),
    interests: list(profile.user_interests || profile.interests || profile.common_interests),
    languages: list(profile.languages),
    lookingFor: text(typeof profile.relationship_intent === 'string' ? profile.relationship_intent : profile.relationship_intent?.body_text || profile.relationship_intent?.title || profile.relationship_intent?.name || profile.lookingFor, 100),
    job: text(profile.job || (profile.jobs?.[0]?.title?.name ? `${profile.jobs[0].title.name}${profile.jobs[0].company?.name ? ` at ${profile.jobs[0].company.name}` : ''}` : ''), 120),
    school: text(profile.school || profile.schools?.[0]?.name, 120),
    city: text(typeof profile.city === 'string' ? profile.city : profile.city?.name, 80),
    distanceMi,
    descriptors: list(profile.descriptors || profile.selected_descriptors),
    questionAnswers: (Array.isArray(profile.questionAnswers || profile.question_answers || profile.teasers)
      ? (profile.questionAnswers || profile.question_answers || profile.teasers)
      : []).map(qa => ({ question: text(qa?.question || qa?.prompt || qa?.type, 120), answer: text(qa?.answer || qa?.description || qa, 500) })).filter(qa => qa.answer),
    verified: Boolean(profile.verified || profile.is_tinder_u || (Array.isArray(profile.badges) && profile.badges.length > 0))
  };
}

export function normalizeMessage(raw) {
  const id = text(raw?._id || raw?.id, 150);
  if (!id) return null;
  const sourceTime = raw.sent_date || raw.created_date || raw.timestamp;
  const sentAt = typeof sourceTime === 'number' ? sourceTime : Date.parse(sourceTime);
  return { id, text: text(raw.message || raw.text, 1000), senderId: text(raw.from || raw.sender_id, 100), sentAt: Number.isFinite(sentAt) ? sentAt : 0 };
}

export function compatibility(profile, own, preferences = {}) {
  const lower = values => new Set(list(values).map(value => value.toLowerCase()));
  const wanted = lower([...(own?.interests || []), ...(preferences.interests || [])]);
  const shared = [...new Set((profile.interests || []).filter(value => wanted.has(value.toLowerCase())))];
  const languages = lower(own?.languages || []);
  const commonLanguages = [...new Set((profile.languages || []).filter(value => languages.has(value.toLowerCase())))];
  const desiredGoal = text(preferences.lookingFor || own?.lookingFor).toLowerCase();
  const sameGoal = Boolean(desiredGoal && profile.lookingFor?.toLowerCase() === desiredGoal);
  const ownDescriptors = lower(own?.descriptors || []);
  const sharedDescriptors = [...new Set((profile.descriptors || []).filter(d => ownDescriptors.has(d.toLowerCase())))];

  const score = Math.min(100, Math.min(shared.length, 3) * 20 + (commonLanguages.length ? 20 : 0) + (sameGoal ? 20 : 0) + (sharedDescriptors.length ? 10 : 0));
  return {
    score,
    reasons: [
      ...shared.map(value => `Shared interest: ${value}`),
      ...commonLanguages.slice(0, 1).map(value => `Shared language: ${value}`),
      ...(sameGoal ? ['Same relationship intention'] : []),
      ...sharedDescriptors.slice(0, 1).map(d => `Lifestyle match: ${d}`)
    ],
    strong: score >= 60,
    estimated: true
  };
}

export const emptyCollections = ownerId => ({ version: 1, ownerId, profiles: {}, swipes: {}, conversations: {}, updatedAt: 0 });
const bound = (map, key) => Object.fromEntries(Object.entries(map).sort((a, b) => (b[1][key] || 0) - (a[1][key] || 0)).slice(0, COLLECTION_LIMIT));

export function mergeCollectionEvent(state, event, now = Date.now()) {
  const next = { ...state, profiles: { ...state.profiles }, swipes: { ...state.swipes }, conversations: { ...state.conversations }, updatedAt: now };
  const addProfile = raw => {
    const profile = normalizeProfile(raw);
    if (profile) {
      const existing = next.profiles[profile.id] || {};
      const merged = { ...existing, ...profile, seenAt: now };
      if (existing.photos?.length && (!profile.photos?.length || profile.photos.length < existing.photos.length)) {
        merged.photos = existing.photos;
      }
      if (existing.bio && !profile.bio) merged.bio = existing.bio;
      if (existing.age && !profile.age) merged.age = existing.age;
      if (existing.interests?.length && !profile.interests?.length) merged.interests = existing.interests;
      if (existing.job && !profile.job) merged.job = existing.job;
      if (existing.school && !profile.school) merged.school = existing.school;
      if (existing.city && !profile.city) merged.city = existing.city;
      if (existing.lookingFor && !profile.lookingFor) merged.lookingFor = existing.lookingFor;
      if (existing.descriptors?.length && !profile.descriptors?.length) merged.descriptors = existing.descriptors;
      if (existing.questionAnswers?.length && !profile.questionAnswers?.length) merged.questionAnswers = existing.questionAnswers;
      next.profiles[profile.id] = merged;
    }
    return profile;
  };

  if (event.kind === 'swipe' && ['like', 'pass'].includes(event.action)) {
    const profile = addProfile(event.profile || { _id: event.profileId });
    if (profile) next.swipes[profile.id] = { profileId: profile.id, action: event.action, swipedAt: event.timestamp || now, matched: Boolean(event.matched) || Boolean(next.swipes[profile.id]?.matched) };
  }
  if (event.kind === 'matches') for (const match of (event.matches || []).slice(0, 100)) {
    const profile = addProfile(match.person || match.user);
    const id = text(match._id || match.id, 150);
    if (!id || !profile) continue;
    const prior = next.conversations[id] || {};
    const messages = (match.messages || []).map(normalizeMessage).filter(Boolean);
    const combined = Object.values({ ...Object.fromEntries((prior.messages || []).map(message => [message.id, message])), ...Object.fromEntries(messages.map(message => [message.id, message])) }).sort((a, b) => b.sentAt - a.sentAt).slice(0, 10);
    next.conversations[id] = { id, profileId: profile.id, archived: false, messages: combined, lastActivityAt: Math.max(Date.parse(match.last_activity_date) || 0, combined[0]?.sentAt || 0, prior.lastActivityAt || 0), observedAt: now };
  }
  if (event.kind === 'messages') {
    const id = text(event.matchId, 150), prior = next.conversations[id];
    if (prior) {
      const messages = (event.messages || []).map(normalizeMessage).filter(Boolean);
      const combined = Object.values({ ...Object.fromEntries((prior.messages || []).map(message => [message.id, message])), ...Object.fromEntries(messages.map(message => [message.id, message])) }).sort((a, b) => b.sentAt - a.sentAt).slice(0, 10);
      next.conversations[id] = { ...prior, messages: combined, lastActivityAt: Math.max(prior.lastActivityAt || 0, combined[0]?.sentAt || 0), observedAt: now };
    }
  }
  if (event.kind === 'match_index') {
    const active = new Set(event.ids || []);
    for (const [id, conversation] of Object.entries(next.conversations)) {
      if (!active.has(id)) next.conversations[id] = { ...conversation, archived: true, observedAt: now };
    }
  }
  next.profiles = bound(next.profiles, 'seenAt');
  next.swipes = bound(next.swipes, 'swipedAt');
  next.conversations = bound(next.conversations, 'lastActivityAt');
  return next;
}

export function collectionLists(state, own, preferences) {
  const profiles = state?.profiles || {};
  const swiped = Object.values(state?.swipes || {}).sort((a, b) => b.swipedAt - a.swipedAt).map(item => ({ ...item, profile: profiles[item.profileId] }));
  const chatting = Object.values(state?.conversations || {}).filter(item => !item.archived && item.messages?.length).sort((a, b) => b.lastActivityAt - a.lastActivityAt).map(item => ({ ...item, profile: profiles[item.profileId] }));
  const rejected = new Set(swiped.filter(item => item.action === 'pass').map(item => item.profileId));
  const strong = Object.values(profiles).filter(profile => !rejected.has(profile.id)).map(profile => ({ profile, ...compatibility(profile, own, preferences) })).filter(item => item.strong).sort((a, b) => b.score - a.score);
  return { swiped, strong, chatting };
}

export function mergeProgressFeedSwipes(state, feed) {
  let next = state;
  const events = (Array.isArray(feed) ? feed : []).filter(event => (event?.type === 'profile_liked' || event?.type === 'profile_passed') && typeof event.name === 'string' && event.name.trim()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  for (const event of events) {
    const timestamp = Number(event.timestamp) || Date.now(), normalized = event.name.trim().toLowerCase();
    const action = event.type === 'profile_passed' ? 'pass' : 'like';
    const duplicate = Object.values(next.swipes || {}).some(swipe => next.profiles?.[swipe.profileId]?.name?.trim().toLowerCase() === normalized && Math.abs((swipe.swipedAt || 0) - timestamp) < 20000);
    if (!duplicate) next = mergeCollectionEvent(next, { kind: 'swipe', action, timestamp, profile: { _id: `feed_${event.id || timestamp}`, name: event.name.trim(), bio: event.detail || '', photos: event.photoUrl ? [{ url: event.photoUrl }] : [] } }, timestamp);
  }
  return next;
}
