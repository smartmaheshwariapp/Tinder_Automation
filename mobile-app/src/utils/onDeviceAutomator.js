// mobile-app/src/utils/onDeviceAutomator.js
// On-Device Automation Engine
// Delegates to the full FlirtEasy Content Script Bundle

import { CONTENT_SCRIPT_BUNDLE } from './contentScriptBundle';

export const generateOnDeviceScript = () => {
  return CONTENT_SCRIPT_BUNDLE;
};

export default generateOnDeviceScript;
