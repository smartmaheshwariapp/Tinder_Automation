import { useEffect, useState } from 'react';
import { getTinderAuthState, subscribeTinderAuthState } from '../utils/sessionManager';

const LIKES_COUNT_URL = 'https://api.gotinder.com/v2/fast-match/count';
const REFRESH_MS = 5 * 60 * 1000;

// Read-only: asks Tinder how many people have liked your profile ("Likes You").
// The number is kept in memory for display only — it is not stored or uploaded.
async function fetchLikesCount(token) {
  const cleanToken = String(token).replace(/^["'](.*)["']$/, '$1').trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(LIKES_COUNT_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'x-auth-token': cleanToken, platform: 'web', 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const count = json?.data?.count ?? json?.count;
    return Number.isFinite(Number(count)) ? Number(count) : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns { count, loading, error } for the logged-in Tinder account; count is null when unknown. */
export default function useTinderLikesCount() {
  const [token, setToken] = useState(() => {
    const auth = getTinderAuthState();
    return auth?.isLoggedIn && auth?.token ? auth.token : null;
  });
  const [state, setState] = useState({ count: null, loading: false, error: null });

  useEffect(() => subscribeTinderAuthState((auth) => {
    setToken(auth?.isLoggedIn && auth?.token ? auth.token : null);
  }), []);

  useEffect(() => {
    if (!token) { setState({ count: null, loading: false, error: null }); return undefined; }
    let active = true;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const count = await fetchLikesCount(token);
        if (active) setState({ count, loading: false, error: null });
      } catch (error) {
        if (active) setState((prev) => ({ ...prev, loading: false, error: error?.message || 'Unavailable' }));
      }
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(id); };
  }, [token]);

  return state;
}
