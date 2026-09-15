# Tinder connection and homepage data audit

Scope: Tinder_Automation/mobile-app, extension background/content/platform modules, and active neko-setup orchestrator/lib routes. Read-only application audit; no automation session was started and no account data was modified. Historical orchestrator.original.js is not the active entrypoint.

## Current flow

1. Homepage Connect invokes PlatformSelectScreen.handleOpenLiveFeed. On-device opens BrowserScreen; remote modes use cloud/VPS session infrastructure.
2. chromeShim captures the active Tinder token and sends bridge messages. BrowserScreen handles FE_TOKEN_CAPTURED and FE_AUTH_STEP logged_in, calls probeTinderSession, and saves the parsed profile through handleSaveOnDeviceSettings.
3. probeTinderSession calls Tinder v2/profile and parses account/profile/subscription information. The auth state and extracted profile are separate stores.
4. Browser settings propagate to the shared in-memory bus, the on-device worker and WebView chrome.storage.local shim (backed by origin localStorage). Worker.updateSettings itself is memory-only.
5. WebView progress and worker events update the shared state; saveOnDeviceSessionState persists counters in AsyncStorage. The homepage subscribes to shared state and probes the profile on focus.
6. Remote /extension-stats reads chrome.storage.local from the Neko extension through CDP. /get-settings, /update-settings and /sync-profile provide separate bridges.
7. trackingService queues events in AsyncStorage, flushes to Supabase user_events and aggregates snapshots. Profile/settings snapshots are also saved by selected frontend actions.

## Verified gaps

| Priority | Finding | Evidence |
| --- | --- | --- |
| High | Remote stats omit userProfile but later attempt to derive account name and login state from it. | neko-setup/lib/routes/extension-stats.js returns only optimizingFor/tone/aiCalibration under settings, then reads result.settings.userProfile. |
| High | Remote login inference trusts historical swipe/like counts. These do not prove the current Tinder session is authenticated. | extension-stats.js isAuthed = hasProfileName OR hasSwipes OR hasLikes. |
| High | Remote bridge is tied to the named neko container, with no account selector in the stats request. Multi-account/cloud parity is not established. | useExtensionStats.js GET /extension-stats; backend docker exec neko. |
| High | Durable account ownership is not consistent: on-device counters use one global storage key; invalid analytics user IDs fall back to a shared development UUID. | sessionManager.js STORAGE_KEY_ON_DEVICE_SESSION; trackingService.js getValidUserId. |
| High | Snapshot saving is described as upsert but uses ordinary POST without merge-duplicates/on_conflict. Repeated saves depend on database constraints; successful replacement is not proven. | supabase.js apiRequest Prefer return=representation and saveUserSnapshot POST /user_snapshots. |
| Medium | Profile is saved in WebView-origin storage and memory, but native homepage refresh only updates shared/local React state. There is no single confirmed native account-scoped profile snapshot write/read in that path. | BrowserScreen.handleSaveOnDeviceSettings; worker.updateSettings; PlatformSelectScreen focus probe. |
| Medium | Cumulative session counters are also exposed as today counters; matches are exposed as active chats. These have different meanings. | sessionManager.js syncOnDeviceSessionToShared. |
| Medium | A changed photo URL at the same photo count, interests, and other metadata may not trigger homepage profile updates. | PlatformSelectScreen hasChanged compares name/bio/age/plan/photo length only. |
| Medium | Backend read failures return default zero stats, making failure indistinguishable from a real empty session. | extension-stats.js sendDefaults and CDP failure branches. |
| Medium | Frontend event insertion may succeed while snapshot aggregation fails silently: its returned success flag is not checked. | trackingService.flush awaits syncSnapshotWithEvents without checking result. |
| Medium | /login-success writes under lib/routes/sessions while session creation uses a different root. Path reconciliation needs verification. | routes/misc.js vs lib/session.js. |

## Useful homepage data

- Connected Tinder name/photo and connection status, validated independently of old activity.
- Subscription tier and likes remaining only when returned by Tinder; show unavailable rather than inferred zero.
- Last successful profile sync and data freshness/error state.
- Session status: idle/running/paused, current phase, cooldown or safety limit.
- Session likes/swipes, detected matches and sent messages, explicitly labelled as automation-session data. These are not necessarily complete Tinder account totals.
- Recent meaningful events and connection milestones from explicit event types.
- Daily counters only after date-bucket logic is consistent across native and remote modes.

The previously commented homepage cards remain commented. Do not simply restore them with their old labels; first normalize the source data.

## Recommended implementation order

1. Define one account-scoped session snapshot contract with profile, connection state, source, timestamps, counters and errors. Keep credentials outside presentation snapshots.
2. Normalize both on-device and remote payloads to it. Correct authenticated account detection and backend user/session selection.
3. Persist snapshots reliably; restore before rendering and reconcile after connect/focus. Verify database constraints and real upsert semantics.
4. Fix counter meanings, refresh comparisons and failure states; add targeted regression tests.
5. Render a homepage account/session summary and recent activity using verified fields and explicit missing-data states.
6. Live checks: connect, return Home, restart app, offline reconnect, expiry, account switch, and repeat in each supported session mode.

## Validation and limits

- Existing frontend suite: 10 suites / 110 tests passed, including profile parsing, data integrity, plan handling and on-device persistence tests.
- These are mocked regression tests, not proof of a real Tinder session or Supabase writes.
- Backend package has no implemented test script.
- No live Tinder login, database schema/RLS inspection, cloud VM, container/CDP session or end-to-end persistence verification was performed. Existing credentials were not used for external account actions.
- Application code was not changed during this audit.
