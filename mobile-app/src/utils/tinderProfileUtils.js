/**
 * tinderProfileUtils.js — Unified Tinder Profile & Media Resolver
 *
 * Provides a single, clean source of truth for extracting Tinder profile photos,
 * display names, and subscription telemetry across the Flint application.
 */

/**
 * Resolves the primary Tinder photo URL from any settings, profile, auth state, or photo collection.
 * Robust across:
 * - Direct HTTPS string URLs
 * - Photo objects with .url
 * - Photo objects with .processedFiles array (picks highest resolution)
 * - settings.userProfile.photos
 * - settings.accountPhoto / auth.accountPhoto / user.photos
 *
 * @param {any} source Any object containing Tinder user/settings/photo data
 * @returns {string|null} Resolved image URL or null
 */
export const resolveTinderPhoto = (source) => {
  if (!source) return null;

  // 1. Direct URL string
  if (typeof source === 'string' && /^https?:\/\//i.test(source.trim())) {
    return source.trim();
  }

  // 2. Array of photo items
  if (Array.isArray(source)) {
    for (const item of source) {
      const u = resolveTinderPhoto(item);
      if (u) return u;
    }
    return null;
  }

  // 3. Object-based schemas
  if (typeof source === 'object') {
    // Direct .url property
    if (typeof source.url === 'string' && /^https?:\/\//i.test(source.url.trim())) {
      return source.url.trim();
    }

    // Processed CDN files (Tinder Web format: array of { url, width, height })
    if (Array.isArray(source.processedFiles) && source.processedFiles.length > 0) {
      const sorted = [...source.processedFiles].sort((a, b) => (b.width || 0) - (a.width || 0));
      for (const pf of sorted) {
        if (pf && typeof pf.url === 'string' && /^https?:\/\//i.test(pf.url.trim())) {
          return pf.url.trim();
        }
      }
    }

    // Processed videos (animated avatars)
    if (Array.isArray(source.processedVideos) && source.processedVideos.length > 0) {
      const v = source.processedVideos[0]?.url;
      if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) {
        return v.trim();
      }
    }

    // Nested properties in order of specificity
    if (source.accountPhoto) {
      const u = resolveTinderPhoto(source.accountPhoto);
      if (u) return u;
    }

    if (source.photoUrl) {
      const u = resolveTinderPhoto(source.photoUrl);
      if (u) return u;
    }

    if (source.userProfile) {
      const u = resolveTinderPhoto(source.userProfile);
      if (u) return u;
    }

    if (source.accountProfile) {
      const u = resolveTinderPhoto(source.accountProfile);
      if (u) return u;
    }

    if (source.profile) {
      const u = resolveTinderPhoto(source.profile);
      if (u) return u;
    }

    if (source.user) {
      const u = resolveTinderPhoto(source.user);
      if (u) return u;
    }

    if (Array.isArray(source.photos)) {
      return resolveTinderPhoto(source.photos);
    }
  }

  return null;
};

/**
 * Resolves an array of all valid CDN photo URLs from a Tinder profile/settings payload.
 *
 * @param {any} source
 * @returns {string[]} Array of image URLs
 */
export const resolveTinderPhotos = (source) => {
  if (!source) return [];

  const rawPhotos = Array.isArray(source)
    ? source
    : (source?.userProfile?.photos || source?.photos || source?.user?.photos || []);

  if (!Array.isArray(rawPhotos)) return [];

  const result = [];
  for (const item of rawPhotos) {
    const u = resolveTinderPhoto(item);
    if (u && !result.includes(u)) {
      result.push(u);
    }
  }
  return result;
};

/**
 * Resolves the user's Tinder display name from any profile or settings structure.
 *
 * @param {any} source
 * @param {string} fallback
 * @returns {string}
 */
export const resolveTinderDisplayName = (source, fallback = 'Tinder Account') => {
  if (!source) return fallback;
  const raw =
    source?.userProfile?.name ||
    source?.profile?.name ||
    source?.accountProfile?.name ||
    source?.name ||
    source?.accountName ||
    source?.user?.name ||
    null;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback;
};

/**
 * Production-grade profile staleness threshold: 7 days in milliseconds.
 */
export const TINDER_PROFILE_SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Checks whether a Tinder profile needs to be refreshed.
 * Returns true if:
 * 1. No profile exists
 * 2. Profile has no timestamp (lastSyncedAt / syncedAt)
 * 3. The sync timestamp is older than ttlMs (defaults to 7 days)
 *
 * @param {any} source Settings or profile object
 * @param {number} ttlMs Maximum age in milliseconds before profile is considered stale
 * @returns {boolean} True if profile needs re-syncing
 */
export const isTinderProfileStale = (source, ttlMs = TINDER_PROFILE_SYNC_TTL_MS) => {
  if (!source) return true;
  const profile = source?.userProfile || source?.profile || source;
  if (!profile || typeof profile !== 'object') return true;

  const rawTime = profile.lastSyncedAt || profile.syncedAt || source.lastSyncedAt || source.syncedAt;
  if (!rawTime) return true;

  const syncTime = typeof rawTime === 'number' ? (rawTime < 1e11 ? rawTime * 1000 : rawTime) : Date.parse(rawTime);
  if (!syncTime || isNaN(syncTime) || syncTime <= 0) return true;

  return (Date.now() - syncTime) >= ttlMs;
};

/**
 * Formats a profile sync timestamp into a clean, human-readable relative string.
 * Examples:
 * - null/undefined -> "Not synced yet"
 * - < 1 min -> "Just now"
 * - 15 mins -> "15m ago"
 * - 4 hours -> "4h ago"
 * - 28 hours -> "Yesterday"
 * - 3 days -> "3d ago"
 * - >= 7 days -> "7d ago (Refresh recommended)"
 *
 * @param {number|string|null} timestamp Epoch milliseconds or ISO date string
 * @returns {string} Human-readable relative time string
 */
export const formatRelativeSyncTime = (timestamp) => {
  if (!timestamp) return 'Not synced yet';

  let time = null;
  if (typeof timestamp === 'number') {
    time = timestamp < 1e11 ? timestamp * 1000 : timestamp;
  } else if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp);
    if (!isNaN(parsed)) time = parsed;
    else if (!isNaN(Number(timestamp))) {
      const num = Number(timestamp);
      time = num < 1e11 ? num * 1000 : num;
    }
  }

  if (!time || isNaN(time) || time <= 0) {
    return 'Not synced yet';
  }

  const diffMs = Math.max(0, Date.now() - time);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) {
    return 'Just now';
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return `${diffDays}d ago (Refresh recommended)`;
};

