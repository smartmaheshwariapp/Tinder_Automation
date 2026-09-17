// Stub for SupabaseService — sessionManager calls it for Hyperbeam profile IDs.
// Not exercised by any of the persistence tests, so all methods are no-ops.
const SupabaseService = {
  getUserSnapshot: jest.fn(async () => null),
  saveUserSnapshot: jest.fn(async () => {}),
  insertUserEvents: jest.fn(async () => ({ ok: true, status: 201 })),
  syncSnapshotWithEvents: jest.fn(async () => ({ ok: true, status: 200 })),
  syncCloudTinderRateLimit: jest.fn(async () => ({ success: true })),
  checkCloudTinderRateLimit: jest.fn(async () => ({ isLocked: false, rateLimitedUntil: null })),
};

module.exports = SupabaseService;
module.exports.default = SupabaseService;
