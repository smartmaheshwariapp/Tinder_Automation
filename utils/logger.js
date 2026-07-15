// Reads from the single global DEBUG_ENABLED flag in debug-config.js
// Do not change this — toggle debug-config.js instead
const CONSOLE_OUTPUT_ENABLED = (typeof DEBUG_ENABLED !== 'undefined') ? DEBUG_ENABLED : false;

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLogLevel = LOG_LEVELS.INFO;

// Get global object for history arrays created by debug-config.js
const getGlobalObj = () => {
  if (typeof window !== 'undefined') return window;
  if (typeof self !== 'undefined') return self;
  return null;
};

function log(level, message, data = null) {
  if (level >= currentLogLevel && CONSOLE_OUTPUT_ENABLED) {
    const hasModuleTag = /^\[.*?\]/.test(message);
    const displayMessage = hasModuleTag ? message : `[FlirtEasy] ${message}`;

    switch (level) {
      case LOG_LEVELS.DEBUG:
        if (data) console.debug(displayMessage, data);
        else console.debug(displayMessage);
        break;
      case LOG_LEVELS.INFO:
        if (data) console.info(displayMessage, data);
        else console.info(displayMessage);
        break;
      case LOG_LEVELS.WARN:
        if (data) console.warn(displayMessage, data);
        else console.warn(displayMessage);
        break;
      case LOG_LEVELS.ERROR:
         if (data) console.error(displayMessage, data);
         else console.error(displayMessage);
        break;
    }
  }
}

function debug(message, data) {
  log(LOG_LEVELS.DEBUG, message, data);
}

function info(message, data) {
  log(LOG_LEVELS.INFO, message, data);
}

function warn(message, data) {
  log(LOG_LEVELS.WARN, message, data);
}

function error(message, data) {
  if (data && typeof data === 'object' && data.message) {
    log(LOG_LEVELS.ERROR, message, data.message);
  } else {
    log(LOG_LEVELS.ERROR, message, data);
  }
}

function getLogs() {
  const _g = getGlobalObj();
  return (_g && _g.__flirtEasyLogHistory) ? _g.__flirtEasyLogHistory : [];
}

function exportLogs() {
  const history = getLogs();
  return history.map(entry =>
    `[${entry.timestamp}] [${entry.level}] ${entry.message} ${entry.data ? JSON.stringify(entry.data) : ''}`
  ).join('\n');
}

function clearLogs() {
  const _g = getGlobalObj();
  if (_g && _g.__flirtEasyLogHistory) {
    _g.__flirtEasyLogHistory.length = 0;
  }
}

// Expose functions globally for service worker
if (typeof self !== 'undefined') {
  self.debug = debug;
  self.info = info;
  self.warn = warn;
  self.error = error;
  self.getLogs = getLogs;
  self.exportLogs = exportLogs;
  self.clearLogs = clearLogs;
}
