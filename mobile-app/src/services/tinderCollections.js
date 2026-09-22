import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyCollections, mergeCollectionEvent, mergeProgressFeedSwipes, normalizeProfile } from '../utils/tinderCollectionsModel';
import { getProgressFeed, registerCollectionsDisconnector } from '../utils/sessionManager';
let current = { data: null, own: null, loading: false, error: null, conversationError: null };
let token = null, generation = 0, serial = Promise.resolve(), activation = null;
const listeners = new Set(), publish = patch => { current = { ...current, ...patch }; listeners.forEach(listener => listener(current)); };
const key = id => `@flint_collections_v1:${id}`;
async function request(url, sessionToken) { const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000); try { const response = await fetch(url, { signal: controller.signal, headers: { 'Content-Type': 'application/json', 'x-auth-token': sessionToken } }); if (!response.ok) throw new Error(); return await response.json(); } finally { clearTimeout(timer); } }
export const getCollections = () => current;
export const subscribeCollections = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export function disconnectCollections() { generation++; token = null; activation = null; publish({ data: null, own: null, loading: false, error: null, conversationError: null }); }
registerCollectionsDisconnector(disconnectCollections);
export async function activateCollections(sessionToken) {
  if (!sessionToken) { disconnectCollections(); return; }
  if (token === sessionToken && activation) return activation; if (token === sessionToken && current.data) return;
  token = sessionToken; const run = ++generation; publish({ data: null, own: null, loading: true, error: null, conversationError: null });
  activation = (async () => { try {
    const payload = await request('https://api.gotinder.com/v2/profile?include=user', sessionToken), own = normalizeProfile(payload?.data?.user); if (!own) throw new Error();
    const stored = await AsyncStorage.getItem(key(own.id)); let data = emptyCollections(own.id);
    if (stored) try { const saved = JSON.parse(stored); if (saved.version === 1 && saved.ownerId === own.id) data = saved; } catch (_) {}
    data = mergeProgressFeedSwipes(data, getProgressFeed()); await AsyncStorage.setItem(key(own.id), JSON.stringify(data)); if (run !== generation) return;
    publish({ data, own, loading: false, error: null }); await refreshConversations();
  } catch (_) { if (run === generation) publish({ loading: false, error: 'Unable to load your Tinder collections. Connect Tinder and try again.' }); } finally { if (run === generation) activation = null; } })(); return activation;
}
export function ingestCollectionEvent(event, sessionToken = token) {
  const run = generation; serial = serial.catch(() => {}).then(async () => { if (!current.data || sessionToken !== token || run !== generation) return; const data = mergeCollectionEvent(current.data, event); try { await AsyncStorage.setItem(key(data.ownerId), JSON.stringify(data)); if (run === generation) publish({ data, error: null }); } catch (_) { if (run === generation) publish({ error: 'Could not save collection data on this device.' }); } }); return serial;
}
export async function refreshConversations() {
  const run = generation, sessionToken = token; if (!current.data || !sessionToken) return; publish({ loading: true, conversationError: null });
  try { let pageToken = null, pages = 0; const activeIds = [];
    do { const query = `count=60&message=1${pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''}`; const result = await request(`https://api.gotinder.com/v2/matches?${query}`, sessionToken); if (run !== generation) return; const matches = result?.data?.matches; if (!Array.isArray(matches)) throw new Error(); activeIds.push(...matches.map(match => match._id || match.id).filter(Boolean)); await ingestCollectionEvent({ kind: 'matches', matches }, sessionToken); pageToken = result?.data?.next_page_token; pages++; } while (pageToken && pages < 5);
    if (!pageToken && run === generation) await ingestCollectionEvent({ kind: 'match_index', ids: activeIds }, sessionToken);
    if (run === generation) publish({ conversationError: pageToken ? 'Showing the first 300 matches.' : null });
  } catch (_) { if (run === generation) publish({ conversationError: 'Could not refresh Tinder conversations. Saved data is still available.' }); } finally { if (run === generation) publish({ loading: false }); }
}
