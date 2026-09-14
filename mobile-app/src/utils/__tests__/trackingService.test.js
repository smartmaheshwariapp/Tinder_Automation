describe('TrackingService', () => {
  let trackingService;
  let DEFAULT_DEV_USER_ID;
  let SupabaseService;
  let AsyncStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    AsyncStorage = require('../__mocks__/async-storage');
    AsyncStorage._reset();
    SupabaseService = require('../../services/supabase');
    SupabaseService.insertUserEvents.mockResolvedValue({ ok: true, status: 201 });
    SupabaseService.syncSnapshotWithEvents.mockResolvedValue({ ok: true, status: 200 });

    const mod = require('../../services/trackingService');
    trackingService = mod.trackingService;
    DEFAULT_DEV_USER_ID = mod.DEFAULT_DEV_USER_ID;
  });

  afterEach(() => {
    if (trackingService) {
      trackingService.destroy();
    }
  });

  it('initializes with default dev user UUID when no userId or non-UUID is provided', () => {
    trackingService.init(null, 'tinder');
    expect(trackingService.userId).toBe(DEFAULT_DEV_USER_ID);

    trackingService.init('not-a-uuid', 'tinder');
    expect(trackingService.userId).toBe(DEFAULT_DEV_USER_ID);
  });

  it('accepts and preserves a valid UUID user ID', () => {
    const validUuid = '514707fc-3124-47fd-a6c4-6f8e311bbd22';
    trackingService.init(validUuid, 'tinder');
    expect(trackingService.userId).toBe(validUuid);
  });

  it('enqueues like_sent event with proper structure', () => {
    trackingService.init(null, 'tinder');
    trackingService.trackLike(3);

    expect(trackingService._queue.length).toBe(1);
    const event = trackingService._queue[0];
    expect(event.event_type).toBe('like_sent');
    expect(event.platform).toBe('tinder');
    expect(event.payload.count).toBe(3);
    expect(event.user_id).toBe(DEFAULT_DEV_USER_ID);
    expect(event.client_ts).toBeDefined();
  });

  it('enqueues handoff event with contact details', () => {
    trackingService.init(null, 'tinder');
    trackingService.trackHandoff({
      handoff_type: 'whatsapp',
      match_name: 'Emma',
      contact_value: '+123456789',
    });

    expect(trackingService._queue.length).toBe(1);
    const event = trackingService._queue[0];
    expect(event.event_type).toBe('handoff');
    expect(event.payload.handoff_type).toBe('whatsapp');
    expect(event.payload.match_name).toBe('Emma');
    expect(event.payload.contact_value).toBe('+123456789');
  });

  it('manually flushes queue to Supabase insertUserEvents and syncSnapshotWithEvents', async () => {
    const validUuid = '514707fc-3124-47fd-a6c4-6f8e311bbd22';
    trackingService.init(validUuid, 'tinder');

    trackingService.trackLike(1);
    trackingService.trackMatch({ matchName: 'Sophia' });
    trackingService.trackMessage({ count: 1, matchName: 'Sophia' });

    expect(trackingService._queue.length).toBe(3);

    await trackingService.flush();

    expect(trackingService._queue.length).toBe(0);
    expect(SupabaseService.insertUserEvents).toHaveBeenCalledTimes(1);
    const insertedEvents = SupabaseService.insertUserEvents.mock.calls[0][0];
    expect(insertedEvents.length).toBe(3);
    expect(insertedEvents.map((e) => e.event_type)).toEqual(['like_sent', 'match_found', 'message_sent']);

    expect(SupabaseService.syncSnapshotWithEvents).toHaveBeenCalledTimes(1);
    expect(SupabaseService.syncSnapshotWithEvents).toHaveBeenCalledWith(validUuid, expect.any(Array));
  });

  it('automatically triggers flush when queue reaches MAX_QUEUE_SIZE (10)', async () => {
    trackingService.init(null, 'tinder');

    for (let i = 0; i < 9; i++) {
      trackingService.trackLike(1);
    }
    expect(SupabaseService.insertUserEvents).not.toHaveBeenCalled();

    // 10th event triggers flush
    trackingService.trackLike(1);

    // Wait a tick for async flush to execute
    await new Promise((r) => setTimeout(r, 10));

    expect(SupabaseService.insertUserEvents).toHaveBeenCalledTimes(1);
  });

  it('re-queues batch if Supabase flush throws an error', async () => {
    SupabaseService.insertUserEvents.mockRejectedValueOnce(new Error('Network offline'));
    trackingService.init(null, 'tinder');

    trackingService.trackLike(1);
    expect(trackingService._queue.length).toBe(1);

    await trackingService.flush();

    // Event should be re-queued so metrics are never lost
    expect(trackingService._queue.length).toBe(1);
  });

  it('re-queues batch if Supabase insertUserEvents returns ok: false (non-throwing HTTP error)', async () => {
    SupabaseService.insertUserEvents.mockResolvedValueOnce({ ok: false, status: 500, error: 'Network request failed' });
    trackingService.init(null, 'tinder');

    trackingService.trackLike(2);
    trackingService.trackMatch({ matchName: 'Jessica' });
    expect(trackingService._queue.length).toBe(2);

    await trackingService.flush();

    // Both events must be preserved in the queue
    expect(trackingService._queue.length).toBe(2);
    // syncSnapshotWithEvents must NOT be called on a dead connection
    expect(SupabaseService.syncSnapshotWithEvents).not.toHaveBeenCalled();
  });

  it('persists queue to AsyncStorage on enqueuing and clears on successful flush', async () => {
    trackingService.init(null, 'tinder');

    trackingService.trackLike(5);
    await new Promise((r) => setTimeout(r, 10));

    // Verify written to storage
    const raw = await AsyncStorage.getItem('@linksy_tracking_event_queue');
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw);
    expect(stored.length).toBe(1);
    expect(stored[0].event_type).toBe('like_sent');

    // After successful flush, storage should be cleared
    await trackingService.flush();
    const afterFlush = await AsyncStorage.getItem('@linksy_tracking_event_queue');
    expect(afterFlush).toBeNull();
  });

  it('restores persisted queue on initialization across simulated app restart', async () => {
    // Seed persistent storage with unflushed events from prior run
    const priorEvents = [
      { user_id: DEFAULT_DEV_USER_ID, event_type: 'like_sent', platform: 'tinder', payload: { count: 4 }, client_ts: '2026-09-12T10:00:00.000Z' },
      { user_id: DEFAULT_DEV_USER_ID, event_type: 'match_found', platform: 'tinder', payload: { matchName: 'Chloe' }, client_ts: '2026-09-12T10:01:00.000Z' },
    ];
    await AsyncStorage.setItem('@linksy_tracking_event_queue', JSON.stringify(priorEvents));

    // Simulate new process initialization
    jest.resetModules();
    const mod = require('../../services/trackingService');
    const freshTrackingService = mod.trackingService;

    // Await restoration tick
    await new Promise((r) => setTimeout(r, 10));

    expect(freshTrackingService._queue.length).toBe(2);
    expect(freshTrackingService._queue[0].event_type).toBe('like_sent');
    expect(freshTrackingService._queue[1].event_type).toBe('match_found');

    freshTrackingService.destroy();
  });

  it('applies exponential backoff on consecutive flush failures', async () => {
    SupabaseService.insertUserEvents.mockResolvedValue({ ok: false, status: 500, error: 'Offline' });
    trackingService.init(null, 'tinder');
    trackingService.trackLike(1);

    expect(trackingService._consecutiveFailures).toBe(0);

    await trackingService.flush();
    expect(trackingService._consecutiveFailures).toBe(1);

    await trackingService.flush();
    expect(trackingService._consecutiveFailures).toBe(2);

    // Now simulate network recovery
    SupabaseService.insertUserEvents.mockResolvedValueOnce({ ok: true, status: 201 });
    await trackingService.flush();
    expect(trackingService._consecutiveFailures).toBe(0);
    expect(trackingService._queue.length).toBe(0);
  });
});
