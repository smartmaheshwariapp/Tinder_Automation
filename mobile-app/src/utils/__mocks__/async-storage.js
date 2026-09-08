// Minimal in-memory mock for @react-native-async-storage/async-storage.
// Backing store lives on `global` so it survives `jest.resetModules()`
// (which simulates process restart while preserving persistent storage).
if (!global.__ASYNC_STORAGE_MOCK__) {
  const store = {};
  const mock = {
    _store: store,
    getItem: jest.fn((key) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key, value) => {
      store[key] = String(value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
    _reset() {
      Object.keys(store).forEach((k) => delete store[k]);
      mock.getItem.mockClear();
      mock.setItem.mockClear();
      mock.removeItem.mockClear();
      mock.clear.mockClear();
    },
  };
  global.__ASYNC_STORAGE_MOCK__ = mock;
}

module.exports = global.__ASYNC_STORAGE_MOCK__;
module.exports.default = global.__ASYNC_STORAGE_MOCK__;

