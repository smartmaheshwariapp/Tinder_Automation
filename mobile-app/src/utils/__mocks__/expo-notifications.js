// Jest mock for expo-notifications
const AndroidImportance = {
  MAX: 5,
  HIGH: 4,
  DEFAULT: 3,
  LOW: 2,
  MIN: 1,
  NONE: 0,
};

let _receivedListeners = [];
let _responseListeners = [];

module.exports = {
  AndroidImportance,
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'mock-expo-push-token-flirteasy' })),
  scheduleNotificationAsync: jest.fn(async (params) => `mock-scheduled-${Date.now()}`),
  addNotificationReceivedListener: jest.fn((listener) => {
    _receivedListeners.push(listener);
    return {
      remove: () => {
        _receivedListeners = _receivedListeners.filter((l) => l !== listener);
      },
    };
  }),
  addNotificationResponseReceivedListener: jest.fn((listener) => {
    _responseListeners.push(listener);
    return {
      remove: () => {
        _responseListeners = _responseListeners.filter((l) => l !== listener);
      },
    };
  }),
  __simulateReceived: (notif) => {
    _receivedListeners.forEach((l) => l(notif));
  },
  __simulateResponse: (response) => {
    _responseListeners.forEach((l) => l(response));
  },
  __clearMockListeners: () => {
    _receivedListeners = [];
    _responseListeners = [];
  },
};
