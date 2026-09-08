// Stub for SupabaseService — sessionManager calls it for Hyperbeam profile IDs.
// Not exercised by any of the persistence tests, so all methods are no-ops.
const SupabaseService = {
  getUserSnapshot: jest.fn(async () => null),
  saveUserSnapshot: jest.fn(async () => {}),
};

module.exports = SupabaseService;
module.exports.default = SupabaseService;
