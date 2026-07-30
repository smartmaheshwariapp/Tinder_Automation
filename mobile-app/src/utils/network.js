import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

/**
 * Dynamically resolves the host computer's local network IP address (LAN IP)
 * when running the mobile app in Expo / React Native development mode on a phone.
 */
export const getAutoDetectedLocalIp = () => {
  try {
    // 1. Try NativeModules.SourceCode.scriptURL (Metro bundle server URL)
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1];
      }
    }
  } catch (_) {}

  try {
    // 2. Try Expo Constants hostUri (Expo Go / debugger host)
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch (_) {}

  return 'localhost';
};

/**
 * Replaces localhost / 127.0.0.1 in any URL with the auto-detected LAN IP if running on physical device
 */
export const resolveLocalUrl = (url) => {
  if (!url) return url;
  const localIp = getAutoDetectedLocalIp();
  if (localIp === 'localhost') return url;
  return url.replace(/localhost|127\.0\.0\.1/g, localIp);
};
