describe('TrackingService', () => {
  let trackingService;
  let DEFAULT_DEV_USER_ID;
  let SupabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    SupabaseService = require('../../services/supabase');
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
    expect(insertedEvents.map(e => e.event_type)).toEqual(['like_sent', 'match_found', 'message_sent']);

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
    await new Promise(r => setTimeout(r, 10));

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
});
