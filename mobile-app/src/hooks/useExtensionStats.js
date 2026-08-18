// src/hooks/useExtensionStats.js
// Polling hook that fetches GET /extension-stats every POLL_INTERVAL_MS when enabled.
// Encapsulates all fetch / interval / cleanup logic so dashboard components stay pure.
import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 2000;

/**
 * @param {string|null} orchestratorUrl  Base URL of the orchestrator (e.g. "http://10.0.2.2:3001")
 * @param {boolean}     enabled          Poll only when true (e.g. loginStep === 'done')
 * @returns {{ stats: StatsPayload|null, loading: boolean, error: string|null, refresh: () => void }}
 */
export default function useExtensionStats(orchestratorUrl, enabled) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep a stable abort controller ref so we can cancel in-flight requests on cleanup
  const abortRef = useRef(null);
  const intervalRef = useRef(null);
  // Track mount state to prevent setState after unmount
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    if (!orchestratorUrl) return;

    // Cancel any previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${orchestratorUrl}/extension-stats`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (mountedRef.current) {
        setStats(data);
        setError(null);
        // Only show loading on the very first successful fetch
        if (loading) setLoading(false);
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // Cancelled — not an error
      if (mountedRef.current) {
        setError(err.message);
        // Don't clear existing stats on transient errors — show stale data
      }
    }
  }, [orchestratorUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Clear any running interval when enabled/url changes
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled || !orchestratorUrl) {
      setStats(null);
      setError(null);
      return;
    }

    // Show loading spinner only on the first fetch for this session
    setLoading(true);

    // Immediate first fetch, then poll
    fetchStats().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    intervalRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [enabled, orchestratorUrl, fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}

export { useExtensionStats };

