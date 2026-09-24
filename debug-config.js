/**
 * Global Debug Configuration
 * 
 * IMPORTANT: Set DEBUG_ENABLED to true ONLY during development
 * Set to false before distributing to users to disable all console logs
 */

const DEBUG_ENABLED = false;


const getGlobal = () => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof self !== 'undefined') return self;
  if (typeof global !== 'undefined') return global;
  return null;
};

const _global = getGlobal();

if (_global && _global.console) {
  const originalLog = _global.console.log.bind(_global.console);
  const originalWarn = _global.console.warn.bind(_global.console);
  const originalError = _global.console.error.bind(_global.console);
  const originalInfo = _global.console.info.bind(_global.console);
  const originalDebug = _global.console.debug.bind(_global.console);

  _global.__flirtEasyLogHistory = _global.__flirtEasyLogHistory || [];
  const logHistoryArray = _global.__flirtEasyLogHistory;

  const pushToHistory = (level, args) => {
    let messageStr = '';
    let dataObj = null;

    if (args.length > 0) {
      messageStr = (typeof args[0] === 'string') ? args[0] : JSON.stringify(args[0]);
    }
    if (args.length > 1) {
      if (args.length === 2) {
        dataObj = args[1];
      } else {
        dataObj = args.slice(1);
      }
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: messageStr,
      data: (dataObj !== null && typeof dataObj === 'object') ? dataObj : (dataObj !== null ? { value: dataObj } : null)
    };

    logHistoryArray.push(logEntry);
    if (logHistoryArray.length > 1000) {
      logHistoryArray.shift();
    }
  };

  // Rate-limit remote log forwarding (max 1000 per session) — runs in BOTH dev and prod
  let _remoteLogCount = 0;
  const MAX_REMOTE_LOGS = 2000;

  const _FORWARD_PATTERN = /^\[FlirtEasy|^\[Background|^\[Content|^\[Message|^\[Bumble|^\[Tinder|^\[AI|^\[Storage|^\[Network|^\[Profile|^\[Scanner|^\[Achievement|^\[Stripe|^\[Account|^\[Error|^\[Warn|^->|^\[FLIRTEASY/i;

  let _lbatch = [];
  let _lflushTimer = null;

  const _storeLogsToStorage = (payloads) => {
    try {
      chrome.storage.local.get(['_lbuf'], (r) => {
        const buf = r._lbuf || [];
        buf.push(...payloads);
        if (buf.length > 500) buf.splice(0, buf.length - 500);
        chrome.storage.local.set({ _lbuf: buf });
      });
    } catch (_) { }
  };

  const _flushLogBatch = () => {
    _lflushTimer = null;
    if (_lbatch.length === 0) return;
    if (typeof trackEvent === 'function') return;
    const batch = _lbatch.splice(0);
    try {
      chrome.runtime.sendMessage({ action: 'remoteLogBatch', payloads: batch })
        .catch(() => { _storeLogsToStorage(batch); });
    } catch (_) {
      _storeLogsToStorage(batch);
    }
  };

  const forwardLog = (level, args) => {
    if (level === 'DEBUG') return;
    if (_remoteLogCount >= MAX_REMOTE_LOGS) return;
    if (!args || args.length === 0) return;

    const formatArg = (a) => {
      if (a === null || a === undefined) return '';
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch (_) { return String(a); }
      }
      return String(a);
    };

    const fullMsg = args.length === 1 ? formatArg(args[0]) : args.map(formatArg).filter(Boolean).join(' ');
    if (!fullMsg || fullMsg.trim() === '') return;
    if (level === 'INFO' && !_FORWARD_PATTERN.test(fullMsg)) return;
    _remoteLogCount++;
    const raw1 = args.length > 1 ? args[1] : null;
    const extra = raw1 != null ? (typeof raw1 === 'object' ? (() => { try { return JSON.stringify(raw1).slice(0, 300); } catch (_) { return String(raw1); } })() : String(raw1).slice(0, 300)) : null;
    const payload = { level, message: fullMsg.slice(0, 500), extra };
    try {
      if (typeof trackEvent === 'function') {
        return;
      }
      _lbatch.push(payload);
      if (!_lflushTimer) _lflushTimer = setTimeout(_flushLogBatch, 500);
    } catch (_) { }
  };

  if (!DEBUG_ENABLED) {
    _global.console.log = (...args) => forwardLog('INFO', args);
    _global.console.info = (...args) => forwardLog('INFO', args);
    _global.console.debug = (...args) => forwardLog('DEBUG', args);
    _global.console.warn = (...args) => forwardLog('WARN', args);
    _global.console.error = (...args) => forwardLog('ERROR', args);
  } else {
    const formatMessage = (args, type) => {
      // ... keep the CSS formatting exactly as it is ...
      if (args.length > 0 && typeof args[0] === 'string') {
        const msg = args[0];
        const match = msg.match(/^\[(.*?)\]/);

        if (match) {
          const module = match[1];
          let bg = '#374151';
          let text = '#f3f4f6';
          let icon = '';
          const moduleUpper = module.toUpperCase();
          if (moduleUpper.includes('TINDER')) { bg = '#e11d48'; icon = ''; }
          else if (moduleUpper.includes('BUMBLE')) { bg = '#f59e0b'; text = '#000000'; icon = ''; }
          else if (moduleUpper.includes('AI') || moduleUpper.includes('OPENAI') || moduleUpper.includes('FLIRTEASY')) { bg = '#4f46e5'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('STORAGE') || moduleUpper.includes('DB')) { bg = '#0f766e'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('NETWORK') || moduleUpper.includes('API')) { bg = '#0369a1'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('BACKGROUND') || moduleUpper.includes('WORKER')) { bg = '#334155'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('ACHIEVEMENT') || moduleUpper.includes('MIGRATION')) { bg = '#b45309'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('POPUP') || moduleUpper.includes('UI')) { bg = '#be185d'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('STRIPE') || moduleUpper.includes('ACCOUNT')) { bg = '#4338ca'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('PROFILE') || moduleUpper.includes('PARSER') || moduleUpper.includes('CONTENT')) { bg = '#0f766e'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('MESSAGE') || moduleUpper.includes('CHAT')) { bg = '#1d4ed8'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('ERROR') || moduleUpper.includes('FAIL')) { bg = '#be123c'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('SCANNER') || moduleUpper.includes('TRACKER')) { bg = '#4d7c0f'; text = '#ffffff'; icon = ''; }
          else if (moduleUpper.includes('HEADER') || moduleUpper.includes('PHASE')) { bg = '#1e293b'; text = '#ffffff'; icon = ''; }

          let typeText = '';
          let typeColor = 'inherit';

          if (type === 'WARN') {


            typeText = ' [WARN]';
            typeColor = '#d97706';
            bg = '#fffbeb';
            text = '#92400e';
          } else if (type === 'ERROR') {
            typeText = ' [ERROR]';
            typeColor = '#dc2626';
            bg = '#fef2f2';
            text = '#991b1b';
          } else if (type === 'HEADER') {
            bg = '#1e293b';
            text = '#ffffff';
            typeText = '';
          }

          const badgeCss = `background: ${bg}; color: ${text}; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 10px; margin-right: 6px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(0,0,0,0.1);`;
          const textCss = (type === 'WARN' || type === 'ERROR') ? `color: ${typeColor}; font-weight: 600;` : (type === 'HEADER' ? `color: #1e293b; font-weight: 800; font-size: 1.1em; text-decoration: underline;` : `color: inherit;`);

          const plainMsg = msg.substring(match[0].length).trim();

          args[0] = `%c${match[0]}%c${typeText} ${plainMsg}`;
          args.splice(1, 0, badgeCss, textCss);
        } else {
          if (type === 'WARN') {
            args[0] = `%c[WARN] ${args[0]}`;
            args.splice(1, 0, `color: #d97706; font-weight: 600;`);
          } else if (type === 'ERROR') {
            args[0] = `%c[ERROR] ${args[0]}`;
            args.splice(1, 0, `color: #dc2626; font-weight: 600;`);
          } else if (type === 'INFO') {
            args[0] = `%c[INFO] ${args[0]}`;
            args.splice(1, 0, `color: #2563eb; font-weight: 500;`);
          } else if (type === 'HEADER') {
            args[0] = `%c${args[0]}`;
            args.splice(1, 0, `color: #1e293b; font-weight: 800; font-size: 1.2em;`);
          }
        }
      }
      return args;
    };

    const cloneArgs = (args) => {
      // Need to deeply copy objects if possible, but shallow array clone is fine for isolating formatMessage mutations
      return [...args];
    };

    const _safeOriginalLog = (fn, args) => {
      try {
        fn.apply(null, args);
      } catch (_) { }
    };

    _global.console.log = function (...args) {
      pushToHistory('INFO', args);
      forwardLog('INFO', args);
      _safeOriginalLog(originalLog, formatMessage(cloneArgs(args), 'LOG'));
    };
    _global.console.info = function (...args) {
      pushToHistory('INFO', args);
      forwardLog('INFO', args);
      _safeOriginalLog(originalInfo, formatMessage(cloneArgs(args), 'INFO'));
    };
    _global.console.warn = function (...args) {
      pushToHistory('WARN', args);
      forwardLog('WARN', args);
      _safeOriginalLog(originalWarn, formatMessage(cloneArgs(args), 'WARN'));
    };
    _global.console.error = function (...args) {
      pushToHistory('ERROR', args);
      forwardLog('ERROR', args);
      _safeOriginalLog(originalError, formatMessage(cloneArgs(args), 'ERROR'));
    };
    _global.console.debug = function (...args) {
      pushToHistory('DEBUG', args);
      forwardLog('DEBUG', args);
      _safeOriginalLog(originalDebug, formatMessage(cloneArgs(args), 'DEBUG'));
    };
    _global.console.header = function (...args) {
      pushToHistory('INFO', args);
      _safeOriginalLog(originalLog, formatMessage(cloneArgs(args), 'HEADER'));
    };

    originalLog('%c[FlirtEasy] 🔥 Debug ON — content script console active', 'color:#e8197d;font-weight:700;font-size:13px');

    // Global error listeners to ensure every error is logged and stylized appropriately
    if (typeof _global.addEventListener === 'function') {
      _global.addEventListener('error', (e) => {
        // Prevent infinite loops if error logging causes an error
        if (e && e.filename && e.filename.includes('debug-config.js')) return;
        _global.console.error(`[Unhandled Error]`, e.filename ? `in ${e.filename}:${e.lineno} -` : '', e.message || e.error);
      });

      _global.addEventListener('unhandledrejection', (e) => {
        _global.console.error(`[Promise Rejection]`, e.reason || 'No reason provided');
      });
    }
  }
}
