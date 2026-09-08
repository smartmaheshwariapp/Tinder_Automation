// Minimal React Native mock for Jest (node environment).
// Only includes what sessionManager.js and onDeviceBackgroundWorker.js actually import.
const Platform = { OS: 'android', select: (spec) => spec.android ?? spec.default };
const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

module.exports = { Platform, AppState };
