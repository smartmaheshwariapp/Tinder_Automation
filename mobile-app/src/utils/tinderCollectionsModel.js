// Pure normalization and compatibility rules; no network or credentials.
export const COLLECTION_LIMIT = 500;
const text = (v, max = 500) => typeof v === 'string' ? v.slice(0, max) : '';
const list = v => (Array.isArray(v) ? v : []).map(x => text(typeof x === 'string' ? x : x?.name, 80)).filter(Boolean).slice(0, 30);
export function normalizeProfile(raw) {
  const p = raw?.user || raw?.person || raw || {};
  const id = text(p._id || p.id, 100);
  if (!id) return null;
  return { id, name: text(p.name, 100) || 'Tinder profile', bio: text(p.bio),
    photos: (Array.isArray(p.photos) ? p.photos : []).map(x => typeof x === 'string' ? x : x?.url || x?.processedFiles?.[0]?.url).filter(x => typeof x === 'string' && x.startsWith('https://')).slice(0, 3),
    interests: list(p.user_interests || p.interests || p.common_interests), languages: list(p.languages),
    lookingFor: text(typeof p.relationship_intent === 'string' ? p.relationship_intent : p.relationship_intent?.name || p.lookingFor, 100) };
}
export function normalizeMessage(raw) {
  const id = text(raw?._id || raw?.id, 150);
  if (!id) return null;
  const sentAt = Date.parse(raw.sent_date || raw.created_date || raw.timestamp);
  return { id, text: text(raw.message || raw.text, 1000), senderId: text(raw.from || raw.sender_id, 100), sentAt: Number.isFinite(sentAt) ? sentAt : 0 };
}
export function compatibility(profile, own, preferences = {}) {
  const lower = values => new Set(list(values).map(x => x.toLowerCase()));
  const wanted = lower([...(own?.interests || []), ...(preferences.interests || [])]);
  const shared = (profile.interests || []).filter(x => wanted.has(x.toLowerCase()));
  const langs = lower(own?.languages || []);
  const commonLanguages = (profile.languages || []).filter(x => langs.has(x.toLowerCase()));
  const desiredGoal = text(preferences.lookingFor || own?.lookingFor).toLowerCase();
  const sameGoal = Boolean(desiredGoal && profile.lookingFor?.toLowerCase() === desiredGoal);
  const score = Math.min(shared.length, 3) * 20 + (commonLanguages.length ? 20 : 0) + (sameGoal ? 20 : 0);
  const reasons = [...shared.map(x => 'Shared interest: ' + x), ...commonLanguages.slice(0, 1).map(x => 'Shared language: ' + x), ...(sameGoal ? ['Same relationship intention'] : [])];
  return { score, reasons, strong: score >= 60, estimated: true };
}
export const emptyCollections = ownerId => ({ version: 1, ownerId, profiles: {}, swipes: {}, conversations: {}, updatedAt: 0 });
function bound(map, key) { return Object.fromEntries(Object.entries(map).sort((a,b)=>(b[1][key]||0)-(a[1][key]||0)).slice(0,COLLECTION_LIMIT)); }
export function mergeCollectionEvent(state, event, now = Date.now()) {
  const next = { ...state, profiles: { ...state.profiles }, swipes: { ...state.swipes }, conversations: { ...state.conversations }, updatedAt: now };
  const addProfile = raw => { const p = normalizeProfile(raw); if (p) next.profiles[p.id] = { ...next.profiles[p.id], ...p, seenAt: now }; return p; };
  if (event.kind === 'swipe' && ['like','pass'].includes(event.action)) {
    const p = addProfile(event.profile || { _id: event.profileId });
    if (p) next.swipes[p.id] = { profileId: p.id, action: event.action, swipedAt: event.timestamp || now, matched: Boolean(event.matched) || Boolean(next.swipes[p.id]?.matched) };
  }
  if (event.kind === 'matches') for (const match of (event.matches || []).slice(0,100)) {
    const p = addProfile(match.person || match.user);
    const id = text(match._id || match.id,150); if (!id || !p) continue;
    const prior = next.conversations[id] || {};
    const messages = (match.messages || []).map(normalizeMessage).filter(Boolean);
    const combined = Object.values({ ...Object.fromEntries((prior.messages || []).map(m=>[m.id,m])), ...Object.fromEntries(messages.map(m=>[m.id,m])) }).sort((a,b)=>b.sentAt-a.sentAt).slice(0,10);
    next.conversations[id] = { id, profileId:p.id, archived:false, messages:combined, lastActivityAt: Math.max(Date.parse(match.last_activity_date)||0, combined[0]?.sentAt||0, prior.lastActivityAt||0), observedAt:now };
  }
  if (event.kind === 'messages') {
    const id=text(event.matchId,150), prior=next.conversations[id];
    if(prior) { const messages=(event.messages||[]).map(normalizeMessage).filter(Boolean);const combined=Object.values({...Object.fromEntries(prior.messages.map(m=>[m.id,m])),...Object.fromEntries(messages.map(m=>[m.id,m]))}).sort((a,b)=>b.sentAt-a.sentAt).slice(0,10);next.conversations[id]={...prior,messages:combined,lastActivityAt:Math.max(prior.lastActivityAt,combined[0]?.sentAt||0),observedAt:now}; }
  }
  if(event.kind==='match_index') { const active=new Set(event.ids||[]); for(const [id,c] of Object.entries(next.conversations)) if(!active.has(id))next.conversations[id]={...c,archived:true,observedAt:now}; }
  next.profiles=bound(next.profiles,'seenAt');next.swipes=bound(next.swipes,'swipedAt');next.conversations=bound(next.conversations,'lastActivityAt');
  return next;
}
export function collectionLists(state, own, preferences) {
  const profiles=state?.profiles||{};
  const swiped=Object.values(state?.swipes||{}).sort((a,b)=>b.swipedAt-a.swipedAt).map(s=>({...s,profile:profiles[s.profileId]}));
  const chatting=Object.values(state?.conversations||{}).filter(c=>!c.archived&&c.messages?.length).sort((a,b)=>b.lastActivityAt-a.lastActivityAt).map(c=>({...c,profile:profiles[c.profileId]}));
  const rejected=new Set(swiped.filter(s=>s.action==='pass').map(s=>s.profileId));
  const strong=Object.values(profiles).filter(p=>!rejected.has(p.id)).map(profile=>({profile,...compatibility(profile,own,preferences)})).filter(p=>p.strong).sort((a,b)=>b.score-a.score);
  return {swiped,strong,chatting};
}

export function mergeCollectionSnapshots(local, remote) {
  if(!remote || remote.ownerId !== local.ownerId || remote.version !== 1) return local;
  const result={...local,updatedAt:Math.max(local.updatedAt||0,remote.updatedAt||0)};
  for(const [field,stamp] of [['profiles','seenAt'],['swipes','swipedAt'],['conversations','observedAt']]) {
    const map={...(local[field]||{})};
    for(const [id,item] of Object.entries(remote[field]||{}))if(!map[id]||(item[stamp]||0)>(map[id][stamp]||0))map[id]=item;
    result[field]=bound(map,stamp);
  }
  return result;
}
