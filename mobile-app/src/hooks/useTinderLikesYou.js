import { useCallback, useEffect, useState } from 'react';
import { getTinderAuthState, subscribeTinderAuthState } from '../utils/sessionManager';

// Tinder "Likes You". Full profiles are only returned for accounts whose Tinder plan
// includes Likes You (Gold / Platinum). Other accounts get Tinder's blurred teasers,
// which are shown as-is (locked). Data is held in memory for display only — never stored or uploaded.
const LIST_URL = 'https://api.gotinder.com/v2/fast-match?count=60';
const TEASERS_URL = 'https://api.gotinder.com/v2/fast-match/teasers';
const REFRESH_MS = 5 * 60 * 1000;

const cleanToken = (token) => String(token).replace(/^["'](.*)["']$/, '$1').trim();

async function get(url, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'x-auth-token': cleanToken(token), platform: 'web', 'Content-Type': 'application/json' },
    });
    return { ok: res.ok, status: res.status, json: res.ok ? await res.json().catch(() => null) : null };
  } finally {
    clearTimeout(timer);
  }
}

const photoOf = (photo) => {
  if (!photo) return null;
  if (typeof photo === 'string') return photo;
  // Prefer a mid-size processed file; fall back to the original URL.
  const files = Array.isArray(photo.processedFiles) ? photo.processedFiles : [];
  const mid = files.find((f) => f?.width >= 320 && f?.width <= 640) || files[0];
  return mid?.url || photo.url || null;
};

const ageOf = (birthDate) => {
  const date = birthDate ? new Date(birthDate) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 18 && age < 100 ? age : null;
};

const names = (list) => (Array.isArray(list) ? list : [])
  .map((item) => (typeof item === 'string' ? item : item?.name || item?.title?.name || item?.company?.name))
  .filter(Boolean);

function normalizePerson(raw, index) {
  const user = raw?.user || raw || {};
  const photos = (Array.isArray(user.photos) ? user.photos : []).map(photoOf).filter((u) => typeof u === 'string' && u.startsWith('https://'));
  const job = user.jobs?.[0];
  return {
    id: String(user._id || user.id || `like_${index}`),
    name: typeof user.name === 'string' ? user.name : null,
    age: ageOf(user.birth_date),
    photos,
    bio: typeof user.bio === 'string' ? user.bio.trim() : '',
    distanceMi: Number.isFinite(Number(raw?.distance_mi)) ? Number(raw.distance_mi) : null,
    city: user.city?.name || null,
    job: [job?.title?.name, job?.company?.name].filter(Boolean).join(' · ') || null,
    school: names(user.schools)[0] || null,
    interests: names(user.user_interests?.selected_interests || user.interests).slice(0, 8),
  };
}

/** { people, locked, loading, error, refresh } for the logged-in Tinder account. */
export default function useTinderLikesYou() {
  const [token, setToken] = useState(() => {
    const auth = getTinderAuthState();
    return auth?.isLoggedIn && auth?.token ? auth.token : null;
  });
  const [state, setState] = useState({ people: [], locked: false, loading: false, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeTinderAuthState((auth) => {
    setToken(auth?.isLoggedIn && auth?.token ? auth.token : null);
  }), []);

  useEffect(() => {
    if (!token) { setState({ people: [], locked: false, loading: false, error: null }); return undefined; }
    let active = true;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const full = await get(LIST_URL, token);
        const results = full.json?.data?.results;
        if (full.ok && Array.isArray(results)) {
          if (active) setState({ people: results.map(normalizePerson), locked: false, loading: false, error: null });
          return;
        }
        // Not entitled to the full list: show Tinder's own blurred teasers.
        const teasers = await get(TEASERS_URL, token);
        const teaserResults = teasers.json?.data?.results;
        if (active) {
          setState({
            people: Array.isArray(teaserResults) ? teaserResults.map(normalizePerson) : [],
            locked: true,
            loading: false,
            error: teasers.ok ? null : `HTTP ${teasers.status}`,
          });
        }
      } catch (error) {
        if (active) setState((prev) => ({ ...prev, loading: false, error: error?.message || 'Unavailable' }));
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(id); };
  }, [token, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, refresh };
}
