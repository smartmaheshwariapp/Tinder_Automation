import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, AppState, TextInput, KeyboardAvoidingView, Platform, PanResponder, Keyboard, Modal, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { resolveLocalUrl } from '../utils/network';
import { cleanupCurrentSession, startHyperbeamCloudSession } from '../utils/sessionManager';
import { DashboardPanel } from '../components/dashboard';
import { useExtensionStats } from '../hooks/useExtensionStats';


// Neko container screen resolution (must match NEKO_DESKTOP_SCREEN in docker-compose)
// 414x896 — Modern mobile phone portrait aspect ratio (iPhone / Pixel)
const NEKO_WIDTH = 414;
const NEKO_HEIGHT = 896;

const maskProxy = (proxy) => {
  if (!proxy) return '';
  const match = proxy.match(/^(https?|socks5?|socks):\/\/([^:]+):([^@]+)@(.+)$/);
  if (match) {
    const [_, protocol, user, pass, hostPort] = match;
    return `${protocol}://*****:*****@${hostPort}`;
  }
  return proxy;
};

export default function BrowserScreen({ route, navigation }) {
  const { platform, vpsUrl: rawVpsUrl, proxyIp, extensionSettings, orchestratorUrl: paramOrchestratorUrl } = route.params;
  const isHyperbeam = Boolean((rawVpsUrl && rawVpsUrl.includes('hyperbeam.com')) || route.params?.isHyperbeam || rawVpsUrl === 'hyperbeam');
  const vpsUrl = isHyperbeam ? rawVpsUrl : resolveLocalUrl(rawVpsUrl);
  const webViewRef = useRef(null);
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const isBumble = platform?.toLowerCase() === 'bumble';
  const [loginStep, setLoginStep] = useState(isBumble ? 'navigating' : 'options');
  const [showNeko, setShowNeko] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [captchaText, setCaptchaText] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendStatusText, setResendStatusText] = useState('');
  const [otpSubtype, setOtpSubtype] = useState('email'); // 'email' or 'sms'
  const [emailErrorText, setEmailErrorText] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [rateLimitTimer, setRateLimitTimer] = useState(0);
  const [dummyText, setDummyText] = useState('');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [hyperbeamEmbedUrl, setHyperbeamEmbedUrl] = useState(
    vpsUrl && vpsUrl.includes('hyperbeam.com') ? vpsUrl : ''
  );
  const [startingHyperbeam, setStartingHyperbeam] = useState(false);
  const [lastCoord, setLastCoord] = useState(null);
  const [lastToast, setLastToast] = useState('🟢 Linksy In-Page Engine Ready');
  const [logs, setLogs] = useState([
    { id: '1', time: new Date().toLocaleTimeString(), text: 'Linksy Automation Engine initialized.', type: 'info' },
    { id: '2', time: new Date().toLocaleTimeString(), text: 'Desktop Web View (1280x720) ready for interaction.', type: 'info' }
  ]);

  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    console.log(`[FE-LOG ${time}] [${type.toUpperCase()}] ${text}`);
    setLastToast(`${type === 'action' ? '⚡' : type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${text}`);
    setLogs(prev => [{ id: String(Date.now() + Math.random()), time, text, type }, ...prev].slice(0, 80));
  };
  const appState = useRef(AppState.currentState);

  const lastSwipeTime = useRef(0);

  // 60-second countdown timer for email rate limit
  useEffect(() => {
    if (rateLimitTimer <= 0) return;
    const interval = setInterval(() => {
      setRateLimitTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [rateLimitTimer]);

  // Safety timeout to dismiss loading overlay after 3 seconds max
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleSwipe = (direction) => {
    const now = Date.now();
    if (now - lastSwipeTime.current < 120) return;
    lastSwipeTime.current = now;

    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      fetch(`${orchestratorUrl}/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: direction }),
      }).catch(() => { });
    } catch (e) { }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 25 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        if (dx > 25) {
          console.log('[Mobile] Swiped Right -> Triggering Left arrow key');
          handleSwipe('Left');
        } else if (dx < -25) {
          console.log('[Mobile] Swiped Left -> Triggering Right arrow key');
          handleSwipe('Right');
        }
      },
    })
  ).current;

  // Poll orchestrator /nav-status while on navigating step (Neko only).
  useEffect(() => {
    if (isHyperbeam || !isBumble || loginStep !== 'navigating') return;

    let cancelled = false;
    const orchestratorUrl = getOrchestratorUrl(vpsUrl);

    const poll = async () => {
      if (cancelled) return;
      try {
        const resp = await fetch(`${orchestratorUrl}/nav-status`);
        const data = await resp.json();
        if (data.ready && !cancelled) {
          setLoginStep('phone');
          return;
        }
      } catch (_) { }
      if (!cancelled) setTimeout(poll, 500);
    };

    // Start polling after 500ms
    const startTimer = setTimeout(poll, 500);

    // Safety: auto-advance after 10s regardless
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoginStep('phone');
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(safetyTimer);
    };
  }, [loginStep, isBumble, isHyperbeam]);

  // Poll /check-page-state while we are in the login process (Neko only)
  useEffect(() => {
    if (isHyperbeam || loginStep === 'done') return;

    let cancelled = false;
    const orchestratorUrl = getOrchestratorUrl(vpsUrl);

    const poll = async () => {
      if (cancelled) return;
      try {
        const resp = await fetch(`${orchestratorUrl}/check-page-state`);
        const data = await resp.json();
        const state = data.state;
        if (!cancelled) {
          if (state === 'logged_in') {
            if (loginStep !== 'done') {
              setLoginStep('done');
            }
          } else {
            // Not logged in! If we are in 'done' state, reset back to login wizard
            if (loginStep === 'done') {
              console.log('[Browser] Logout or logged-out state detected -> resetting to login options');
              setLoginStep('options');
              setShowDashboard(false);
              setInputText('');
            } else if (state === 'captcha') {
              setShowNeko(true); // Automatically show live browser when puzzle appears
              setLoginStep('captcha');
            } else if (state === 'email_rate_limited') {
              setEmailErrorText('⚠️ You\'ve made too many attempts. Please try again later.');
              setRateLimitTimer(60);
              if (loginStep !== 'email') {
                setLoginStep('email');
              }
            } else if (state === 'email_screen' && loginStep !== 'email') {
              setInputText('');
              setEmailErrorText('');
              setLoginStep('email');
            } else if (state === 'waiting_email' && loginStep !== 'waiting_email') {
              setLoginStep('waiting_email');
            } else if (state === 'phone_screen' && loginStep !== 'phone') {
              setInputText('');
              setLoginStep('phone');
            } else if (state === 'google_email_screen' && loginStep !== 'google_email') {
              setInputText('');
              setLoginStep('google_email');
            } else if (state === 'google_password_screen' && loginStep !== 'google_password') {
              setInputText('');
              setLoginStep('google_password');
            } else if (state === 'email_otp_screen') {
              setOtpSubtype('email');
              if (data && data.email) setSubmittedEmail(data.email);
              if (loginStep !== 'otp') {
                setInputText('');
                setLoginStep('otp');
              }
            } else if (state === 'sms_otp_screen') {
              setOtpSubtype('sms');
              if (data && data.phone) setSubmittedPhone(data.phone);
              if (loginStep !== 'otp') {
                setInputText('');
                setLoginStep('otp');
              }
            } else if (state === 'otp_screen') {
              if (loginStep !== 'otp') {
                setInputText('');
                setLoginStep('otp');
              }
            }
          }
        }
      } catch (_) { }
      if (!cancelled) {
        setTimeout(poll, loginStep === 'done' ? 2500 : 1000);
      }
    };

    const pollTimer = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [loginStep, vpsUrl]);

  // When loginStep reaches 'done', automatically dismiss post-login Privacy / Consent modal (1263, 478)
  useEffect(() => {
    if (loginStep === 'done') {
      const timer = setTimeout(() => {
        dispatchCoordClick(1263, 478, 'Auto-close Privacy / Consent Dialog');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loginStep]);

  const getOrchestratorUrl = (nekoUrl) => {
    if (paramOrchestratorUrl) return paramOrchestratorUrl;
    try {
      const resolvedNekoUrl = resolveLocalUrl(nekoUrl);
      const urlObj = new URL(resolvedNekoUrl.split('/?')[0]);
      if (urlObj.hostname.startsWith('stream.')) {
        return urlObj.protocol + '//' + urlObj.hostname.replace('stream.', 'api.');
      }
      urlObj.protocol = 'http:';
      urlObj.port = '3001';
      return urlObj.origin;
    } catch (e) {
      return 'https://api.smartmaheshwari.com';
    }
  };

  // ─── Extension stats polling (always active — accessible before and after login) ───
  const orchestratorUrl = getOrchestratorUrl(vpsUrl);
  const { stats: extensionStats, loading: statsLoading, error: statsError } = useExtensionStats(
    orchestratorUrl,
    true  // Always poll — dashboard is accessible at any loginStep
  );

  // Remotely start / stop FlirtEasy AI swiping & messaging agent via Orchestrator CDP bridge
  const handleToggleAgent = async () => {
    try {
      const isRunning = Boolean(
        extensionStats?.agentState?.isRunning ||
        (extensionStats?.agentState?.currentPhase && extensionStats.agentState.currentPhase !== 'stopped')
      );
      const endpoint = isRunning ? '/stop-agent' : '/start-agent';
      console.log(`[Browser] Remote agent toggle -> ${endpoint}`);
      await fetch(`${orchestratorUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'Tinder' }),
      });
    } catch (e) {
      console.error('[Browser] handleToggleAgent error:', e);
    }
  };

  // Helper to execute coordinate-based click on WebRTC player and Orchestrator backend
  const dispatchCoordClick = async (x, y, label = '') => {
    try {
      if (label) addLog(`🖱️ Clicking ${label} at (${x}, ${y})`, 'action');

      // 1. In-WebView synthetic pointer & mouse dispatch at normalized 1280x720
      const coordJs = `(function() {
        var el = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.video-container') || document.body;
        if (!el) return;
        var r = el.getBoundingClientRect();
        var cx = r.left + (${x} / 1280) * r.width;
        var cy = r.top + (${y} / 720) * r.height;

        var p = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, screenX: cx, screenY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
        el.dispatchEvent(new PointerEvent('pointerdown', p));
        el.dispatchEvent(new MouseEvent('mousedown', p));
        setTimeout(function() {
          el.dispatchEvent(new PointerEvent('pointerup', p));
          el.dispatchEvent(new MouseEvent('mouseup', p));
          el.dispatchEvent(new MouseEvent('click', p));
          window.__logToApp && window.__logToApp('Clicked coordinate (${x}, ${y})', 'success');
        }, 50);
      })(); true;`;

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(coordJs);
      }

      // 2. Orchestrator xdotool fallback (for Neko Docker)
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      fetch(`${orchestratorUrl}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      }).catch(() => { });
    } catch (e) {
      console.warn('[Browser] dispatchCoordClick error:', e);
    }
  };

  // Helper to type text into virtual browser at coordinate
  const dispatchCoordType = async (x, y, text, label = '') => {
    try {
      if (label) addLog(`✍️ Focusing (${x}, ${y}) & typing: "${text}"`, 'action');

      // First click the input field at (x, y) to focus
      await dispatchCoordClick(x, y);
      await new Promise(r => setTimeout(r, 200));

      const safeText = JSON.stringify(String(text || ''));
      const typeJs = `(async function() {
        var str = ${safeText};
        var active = document.activeElement || document.querySelector('video') || document.querySelector('canvas') || document.body;
        
        for (var i = 0; i < str.length; i++) {
          var ch = str[i];
          var kc = ch === '\\n' ? 13 : ch.charCodeAt(0);
          var code = ch === '\\n' ? 'Enter' : (ch >= '0' && ch <= '9' ? 'Digit' + ch : 'Key' + ch.toUpperCase());
          
          var kd = new KeyboardEvent('keydown', { key: ch, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true });
          var kp = new KeyboardEvent('keypress', { key: ch, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true });
          var ku = new KeyboardEvent('keyup', { key: ch, code: code, keyCode: kc, which: kc, bubbles: true, cancelable: true });
          
          active.dispatchEvent(kd);
          active.dispatchEvent(kp);
          active.dispatchEvent(ku);
          await new Promise(function(res) { setTimeout(res, 50); });
        }
        window.__logToApp && window.__logToApp('Typed text via keyboard events', 'success');
      })(); true;`;

      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(typeJs);
      }

      // Backend typing endpoint fallback
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      fetch(`${orchestratorUrl}/type-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).catch(() => { });
    } catch (e) {
      console.warn('[Browser] dispatchCoordType error:', e);
    }
  };

  // Sends coordinate-based (x, y) clicks, typing, and OTP commands directly into Hyperbeam & Neko
  const sendBrowserCommand = async (action, payload = {}) => {
    try {
      console.log(`[Browser] Executing coordinate command: ${action}`, payload);

      if (action === 'CLICK_LOGIN') {
        // 1. Click Accept Cookies / Consent banner (845, 526)
        await dispatchCoordClick(845, 526, 'Accept Cookies');
        await new Promise(r => setTimeout(r, 400));
        // 2. Click Header "Log In" button (1190, 220)
        await dispatchCoordClick(1190, 220, 'Header Log In Button');
      } else if (action === 'CLICK_EMAIL_LOGIN') {
        // 1. Dismiss Cookies / Banner
        await dispatchCoordClick(845, 526, 'Accept Cookies');
        await new Promise(r => setTimeout(r, 300));
        // 2. Click Header Log in button in case modal isn't open yet
        await dispatchCoordClick(1190, 220, 'Header Log In');
        await new Promise(r => setTimeout(r, 500));
        // 3. Click "Log in with Email" option at (700, 358)
        await dispatchCoordClick(700, 358, 'Log in with Email');
        await new Promise(r => setTimeout(r, 300));
        // 4. Fallback "Trouble Logging In / Email" option (640, 510)
        await dispatchCoordClick(640, 510, '"Trouble Logging In"');
      } else if (action === 'DISMISS_PRIVACY') {
        // Close / Dismiss Privacy Policy or Welcome Banner (1263, 478)
        await dispatchCoordClick(1263, 478, 'Close Privacy Dialog');
      } else if (action === 'CLICK_PHONE_LOGIN') {
        // 1. Dismiss Cookies / Banner
        await dispatchCoordClick(845, 526, 'Accept Cookies');
        await new Promise(r => setTimeout(r, 300));
        // 2. Click Header Log in button
        await dispatchCoordClick(1190, 220, 'Header Log In');
        await new Promise(r => setTimeout(r, 500));
        // 3. Click "Log in with phone number" option (640, 440)
        await dispatchCoordClick(640, 440, '"Log in with Phone"');
      } else if (action === 'CLICK_GOOGLE_LOGIN') {
        // 1. Dismiss Cookies / Banner
        await dispatchCoordClick(845, 526, 'Accept Cookies');
        await new Promise(r => setTimeout(r, 300));
        // 2. Click Header Log in button
        await dispatchCoordClick(1190, 220, 'Header Log In');
        await new Promise(r => setTimeout(r, 500));
        // 3. Click "Continue with Google" option (640, 330)
        await dispatchCoordClick(640, 330, '"Continue with Google"');
      } else if (action === 'CLICK_TROUBLE') {
        await dispatchCoordClick(640, 510, 'Trouble Logging In');
      } else if (action === 'SUBMIT_EMAIL') {
        // 1. Focus & type email into input box (640, 350)
        await dispatchCoordType(640, 350, payload.email || '', 'Email Field');
        await new Promise(r => setTimeout(r, 400));
        // 2. Click "Next / Submit" button (640, 430)
        await dispatchCoordClick(640, 430, 'Email Submit (Next)');
      } else if (action === 'SUBMIT_PHONE') {
        const digits = String(payload.phone || '').replace(/\D/g, '');
        // 1. Focus & type phone digits into input box (640, 350)
        await dispatchCoordType(640, 350, digits, 'Phone Field');
        await new Promise(r => setTimeout(r, 400));
        // 2. Click "Next / Send Code" button (640, 430)
        await dispatchCoordClick(640, 430, 'Phone Submit (Next)');
      } else if (action === 'SUBMIT_OTP') {
        const otpDigits = String(payload.otp || '').replace(/\D/g, '');
        // 1. Focus & type OTP digits into input box (640, 360)
        await dispatchCoordType(640, 360, otpDigits, 'OTP Passcode Field');
        await new Promise(r => setTimeout(r, 400));
        // 2. Click "Verify / Next" button (640, 440)
        await dispatchCoordClick(640, 440, 'Verify & Log In');
      } else if (action === 'RESEND_OTP') {
        await dispatchCoordClick(640, 490, 'Resend Code');
      }

      // Also trigger orchestrator CDP text search fallback if available
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      if (action === 'CLICK_EMAIL_LOGIN') {
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'email' }) }).catch(() => { });
      } else if (action === 'CLICK_PHONE_LOGIN') {
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'phone' }) }).catch(() => { });
      } else if (action === 'SUBMIT_EMAIL') {
        fetch(`${orchestratorUrl}/submit-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: payload.email }) }).catch(() => { });
      } else if (action === 'SUBMIT_PHONE') {
        fetch(`${orchestratorUrl}/submit-phone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ countryCode: payload.countryCode, phoneNumber: payload.phone }) }).catch(() => { });
      } else if (action === 'SUBMIT_OTP') {
        fetch(`${orchestratorUrl}/submit-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp: payload.otp }) }).catch(() => { });
      } else if (action === 'RESEND_OTP') {
        fetch(`${orchestratorUrl}/resend-code`, { method: 'POST' }).catch(() => { });
      }
    } catch (e) {
      console.warn('[Browser] sendBrowserCommand error:', e);
      addLog(`Command error: ${e.message}`, 'error');
    }
  };

  // Sends a mouse click at absolute (x, y) inside the Neko container via xdotool.
  const clickAt = async (x, y) => {
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });
    } catch (e) {
      console.error('[Browser] clickAt error:', e);
    }
  };



  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      setShowDashboard(false);
      setLoginStep('options');
      setInputText('');
      setSubmittedEmail('');
      setSubmittedPhone('');
      setEmailErrorText('');
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'tinder' }),
      });
    } catch (_) { }
    setLoggingOut(false);
    setShowLogoutConfirm(false);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleGoBack = async () => {
    setSendingText(false);
    setInputText('');
    setLoginStep('options');
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/go-back`, { method: 'POST' });
    } catch (e) { }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    setSendingText(true);
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      const response = await fetch(`${orchestratorUrl}/type-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      if (response.ok) {
        setInputText(''); // Clear input on success
        await handlePressEnter();
      } else {
        console.error('Failed to send text to virtual browser');
      }
    } catch (e) {
      console.error('Network error sending text:', e);
    } finally {
      setSendingText(false);
    }
  };

  const handlePressEnter = async () => {
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/press-enter`, {
        method: 'POST',
      });
    } catch (e) {
      console.error('Network error pressing Enter:', e);
    }
  };

  const injectKeyEvent = (key) => {
    let normalizedKey = key;
    if (key === '\n') normalizedKey = 'Enter';

    const charCode = normalizedKey.length === 1 ? normalizedKey.charCodeAt(0) : 0;
    let keyCode = charCode;
    if (normalizedKey === 'Backspace') keyCode = 8;
    if (normalizedKey === 'Enter') keyCode = 13;

    const jsCode = `
      (function() {
        const target = document.activeElement || document.body;
        const createEvent = (type) => {
          const e = new KeyboardEvent(type, {
            key: ${JSON.stringify(normalizedKey)},
            code: ${JSON.stringify(normalizedKey === 'Backspace' ? 'Backspace' : normalizedKey === 'Enter' ? 'Enter' : '')},
            keyCode: ${keyCode},
            which: ${keyCode},
            charCode: ${charCode},
            bubbles: true,
            cancelable: true
          });
          return e;
        };
        target.dispatchEvent(createEvent('keydown'));
        target.dispatchEvent(createEvent('keypress'));
        target.dispatchEvent(createEvent('keyup'));
      })();
    `;
    webViewRef.current.injectJavaScript(jsCode);
  };

  const handleTextChange = (text) => {
    if (text.length < dummyText.length) {
      injectKeyEvent('Backspace');
    } else {
      const addedChar = text.slice(dummyText.length);
      for (let i = 0; i < addedChar.length; i++) {
        injectKeyEvent(addedChar[i]);
      }
    }
    setDummyText(text);
  };

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[Browser] App returned to foreground. Reloading WebView to refresh Neko connection...');
        if (webViewRef.current) {
          webViewRef.current.reload();
        }
      }
      appState.current = nextAppState;
    });

    // Auto-reset Neko video scale and scroll position whenever native keyboard hides
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function() {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            var v = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.neko-video');
            if (v) {
              v.style.transform = 'none';
              v.style.zoom = '1';
            }
          })();
        `);
      }
    });

    return () => {
      subscription.remove();
      hideSub.remove();
    };
  }, []);

  const injectConfigScript = () => {
    if (isHyperbeam) return; // Hyperbeam manages its own touch/WebRTC viewport natively
    const settingsJson = JSON.stringify(extensionSettings || {});
    const cssCode = `
      html, body, #app, #neko, .v-application, .v-main, .neko-main, .video-container, .neko-video, video, canvas {
        padding-top: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        transform: none !important;
        zoom: 1 !important;
        overflow: hidden !important;
        background: #0F0F13 !important;
      }
      .v-app-bar, .v-toolbar, .v-navigation-drawer, header.v-app-bar, .neko-nav, .neko-header, .neko-sidebar, .neko-chat, .neko-menu, .neko-controls, .neko-topbar, .v-app-bar--fixed {
        display: none !important;
        height: 0 !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `;



    const jsCode = `
      (function() {
        try {
          localStorage.setItem('flirteasy_settings_sync', '${settingsJson}');
          
          if (!document.getElementById('flirteasy-mobile-layout')) {
            const style = document.createElement('style');
            style.id = 'flirteasy-mobile-layout';
            style.innerHTML = \`${cssCode}\`;
            (document.head || document.documentElement).appendChild(style);
          }

          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            (document.head || document.documentElement).appendChild(meta);
          }
          meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';

          window.addEventListener('resize', function() {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            var v = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.neko-video');
            if (v) {
              v.style.transform = 'none';
              v.style.zoom = '1';
            }
          });
        } catch(e) {}
      })();
    `;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  // Auto-start Hyperbeam Cloud VM if navigated with generic 'hyperbeam' endpoint
  useEffect(() => {
    if (isHyperbeam && (!hyperbeamEmbedUrl || vpsUrl === 'hyperbeam')) {
      let isCancelled = false;
      setStartingHyperbeam(true);
      setConnectionError(null);
      console.log('[Browser] Initiating Hyperbeam Cloud VM session fallback...');

      startHyperbeamCloudSession({
        platform: platform || 'tinder',
        proxyIp: proxyIp || '',
        orchestratorUrl: paramOrchestratorUrl || getOrchestratorUrl(vpsUrl),
      })
        .then(({ embedUrl }) => {
          if (!isCancelled) {
            console.log('[Browser] Hyperbeam Cloud VM session ready:', embedUrl);
            setHyperbeamEmbedUrl(embedUrl);
            setStartingHyperbeam(false);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error('[Browser] Hyperbeam startup error:', err);
            setStartingHyperbeam(false);
            setConnectionError({ description: `Hyperbeam error: ${err.message}` });
          }
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [isHyperbeam, vpsUrl, platform, proxyIp]);

  const finalUrl = React.useMemo(() => {
    if (isHyperbeam) {
      if (hyperbeamEmbedUrl) return hyperbeamEmbedUrl;
      if (vpsUrl && vpsUrl.includes('hyperbeam.com')) return vpsUrl;
      return '';
    }
    let clean = vpsUrl || '';
    if (clean === 'hyperbeam' || clean.startsWith('https://hyperbeam') || clean.startsWith('http://hyperbeam')) {
      return '';
    }
    if (clean.includes('hyperbeam.com')) {
      return clean;
    }
    const isLocal = clean.includes('localhost') ||
      clean.includes('127.0.0.1') ||
      clean.includes('10.0.2.2') ||
      clean.includes('10.') ||
      clean.includes('192.168.') ||
      clean.includes('172.');

    if (!isLocal) {
      clean = clean.replace('http://', 'https://');
      if (clean.includes('stream.') || clean.startsWith('https://')) {
        clean = clean.replace(':8080', '');
      }
      if (!clean.startsWith('https://')) {
        clean = 'https://' + clean;
      }
    } else {
      if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        clean = 'http://' + clean;
      }
    }
    return `${clean}${clean.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, [vpsUrl, isHyperbeam, hyperbeamEmbedUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ─── Upgraded Modern Glass Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              cleanupCurrentSession();
              navigation.goBack();
            }}
          >
            <Ionicons name="close" size={18} color="#D8D6E8" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{platform} Session</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {isHyperbeam ? '⚡ Hyperbeam Cloud Stream' : (proxyIp ? `IP: ${maskProxy(proxyIp)}` : 'Direct Connection')}
            </Text>
          </View>
          {loginStep !== 'done' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.toggleNekoBtn, { marginRight: 4 }]}
                onPress={() => setIsExpanded(!isExpanded)}
              >
                <Ionicons name={isExpanded ? "contract-outline" : "expand-outline"} size={13} color="#D8D6E8" />
                <Text style={styles.toggleNekoBtnText}>
                  {isExpanded ? 'Split' : 'Expand'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleNekoBtn, { marginRight: 4 }]}
                onPress={() => setShowNeko(!showNeko)}
              >
                <Ionicons name={showNeko ? "eye-off-outline" : "eye-outline"} size={13} color="#D8D6E8" />
                <Text style={styles.toggleNekoBtnText}>
                  {showNeko ? 'Hide' : 'View'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dashboardBtn, { marginRight: 4, backgroundColor: '#10B98115', borderColor: '#10B98140' }]}
                onPress={() => setShowLogsModal(true)}
              >
                <Ionicons name="terminal-outline" size={14} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dashboardBtn, { marginRight: 4 }]}
                onPress={() => setShowDashboard(true)}
              >
                <Ionicons name="stats-chart-outline" size={15} color="#FE3C72" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={() => setLoginStep('done')}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.dashboardBtn, { marginRight: 6, backgroundColor: '#10B98115', borderColor: '#10B98140' }]}
                onPress={() => setShowLogsModal(true)}
              >
                <Ionicons name="terminal-outline" size={14} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dashboardBtn, { marginRight: 6 }]}
                onPress={() => setShowDashboard(true)}
              >
                <Ionicons name="stats-chart-outline" size={15} color="#FE3C72" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuBtn, { marginRight: 8, backgroundColor: '#3A3A4A15', borderColor: '#3A3A4A40' }]}
                onPress={() => inputRef.current.focus()}
              >
                <Ionicons name="keypad-outline" size={13} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={[styles.menuBtnText, { color: '#FFF' }]}>Keyboard</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── Live Activity Log Toast Banner ─── */}
        <TouchableOpacity
          style={styles.liveLogBanner}
          onPress={() => setShowLogsModal(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.liveLogDot, { backgroundColor: lastToast.includes('❌') ? '#EF4444' : '#10B981' }]} />
          <Text style={styles.liveLogText} numberOfLines={1}>{lastToast}</Text>
          <View style={styles.liveLogBadge}>
            <Text style={styles.liveLogBadgeText}>Logs ({logs.length}) ➔</Text>
          </View>
        </TouchableOpacity>

        {/* ─── Full-screen Live Logs Modal ─── */}
        <Modal
          visible={showLogsModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowLogsModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="terminal" size={16} color="#10B981" />
                <Text style={styles.modalTitle}>Linksy Automation Logs</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, { backgroundColor: '#3A3A4A20', borderColor: '#3A3A4A50' }]}
                  onPress={() => setLogs([])}
                >
                  <Text style={[styles.modalCloseBtnText, { color: '#A0A0B0' }]}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowLogsModal(false)}
                >
                  <Ionicons name="close" size={16} color="#D8D6E8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Status Info Card */}
            <View style={styles.logsStatusCard}>
              <View style={styles.logsStatusRow}>
                <Text style={styles.logsStatusLabel}>Engine Status:</Text>
                <Text style={styles.logsStatusValue}>🟢 Connected & Active</Text>
              </View>
              <View style={styles.logsStatusRow}>
                <Text style={styles.logsStatusLabel}>Packaging Speed:</Text>
                <Text style={styles.logsStatusValue}>⚡ ~40ms (In-Memory Buffer)</Text>
              </View>
              <View style={styles.logsStatusRow}>
                <Text style={styles.logsStatusLabel}>Mode:</Text>
                <Text style={styles.logsStatusValue}>{isHyperbeam ? 'Hyperbeam Cloud + In-Page DOM' : 'Local / VPS Docker CDP'}</Text>
              </View>
            </View>

            {/* Scrollable Logs List */}
            <View style={{ flex: 1, paddingHorizontal: 14 }}>
              {logs.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#6E6E7F', fontSize: 14 }}>No logs yet. Actions will appear here live.</Text>
                </View>
              ) : (
                logs.map((item) => (
                  <View key={item.id} style={styles.logRow}>
                    <View style={styles.logMetaRow}>
                      <Text style={styles.logTime}>{item.time}</Text>
                      <View style={[
                        styles.logTypeTag,
                        item.type === 'action' && styles.logTagAction,
                        item.type === 'success' && styles.logTagSuccess,
                        item.type === 'error' && styles.logTagError,
                      ]}>
                        <Text style={styles.logTypeText}>{(item.type || 'INFO').toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.logMessage}>{item.text}</Text>
                  </View>
                ))
              )}
            </View>
          </SafeAreaView>
        </Modal>

        {/* ─── Full-screen Dashboard Modal (accessible at any loginStep) ─── */}
        <Modal
          visible={showDashboard}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDashboard(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="stats-chart" size={16} color="#FD297B" />
                <Text style={styles.modalTitle}>Linksy Dashboard</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowDashboard(false)}
              >
                <Ionicons name="close" size={16} color="#D8D6E8" />
              </TouchableOpacity>
            </View>
            <DashboardPanel
              stats={extensionStats}
              loading={statsLoading}
              error={statsError}
              orchestratorUrl={orchestratorUrl}
              onToggleAgent={handleToggleAgent}
              onLogout={handleLogout}
              controlsContent={
                <View style={styles.inputPanel}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Paste Phone No. or OTP code here..."
                    placeholderTextColor="#8E8E9F"
                    value={inputText}
                    onChangeText={setInputText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.sendBtn}
                    onPress={handleSendText}
                    disabled={sendingText}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.sendBtnText}>Send</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.enterBtn} onPress={handlePressEnter}>
                    <Text style={styles.enterBtnText}>⏎ Enter</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>

        {/* ─── Custom Logout Confirmation Modal ─── */}
        <Modal
          visible={showLogoutConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => !loggingOut && setShowLogoutConfirm(false)}
          statusBarTranslucent
        >
          <View style={styles.logoutModalOverlay}>
            <View style={styles.logoutModalCard}>
              <View style={styles.logoutIconBadge}>
                <Ionicons name="log-out" size={28} color="#EF4444" />
              </View>

              <Text style={styles.logoutModalTitle}>Log Out of Tinder?</Text>
              <Text style={styles.logoutModalSubtitle}>
                This will terminate the active session, clear browser state, and return you to the login screen.
              </Text>

              <View style={styles.logoutModalBtnRow}>
                <TouchableOpacity
                  style={styles.logoutModalCancelBtn}
                  onPress={() => setShowLogoutConfirm(false)}
                  disabled={loggingOut}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.logoutModalConfirmBtn}
                  onPress={handleLogout}
                  disabled={loggingOut}
                  activeOpacity={0.85}
                >
                  {loggingOut ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="log-out-outline" size={16} color="#FFF" />
                      <Text style={styles.logoutModalConfirmText}>Log Out</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── Rounded Glass Browser Container ─── */}
        <View
          {...(isHyperbeam ? {} : panResponder.panHandlers)}
          style={[
            styles.webviewContainer,
            loginStep === 'done'
              ? styles.webviewContainerFull
              : (showNeko
                ? (isExpanded || loginStep === 'captcha' ? styles.webviewContainerFull : styles.webviewContainerSplit)
                : styles.webviewContainerHidden)
          ]}
        >
          {Boolean(finalUrl) && (
            <WebView
              ref={webViewRef}
              source={{ uri: finalUrl }}
              style={styles.webview}
              scrollEnabled={true}
              bounces={false}
              scalesPageToFit={true}
              setBuiltInZoomControls={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              cacheEnabled={true}
              geolocationEnabled={true}
              allowsBackForwardNavigationGestures={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              androidHardwareAccelerationDisabled={false}
              originWhitelist={['*']}
              onLoadStart={() => {
                setConnectionError(null);
              }}
              onLoadEnd={() => {
                setLoading(false);
                injectConfigScript();
              }}
              onMessage={(event) => {
                try {
                  const msg = JSON.parse(event.nativeEvent.data);
                  if (msg.type === 'FE_LOG') {
                    addLog(msg.text, msg.logType || 'info');
                  }
                  if (msg.type === 'FE_COORD') {
                    setLastCoord({ x: msg.x, y: msg.y });
                    addLog(`📍 Tap Coordinate: X=${msg.x}, Y=${msg.y}`, 'action');
                  }
                  // Extension signals phone input is ready — advance wizard automatically to phone
                  if (msg.type === 'bumble:phoneInputReady' && loginStep === 'navigating') {
                    console.log('[Browser] Bumble phone input ready — advancing wizard to phone');
                    addLog('Bumble phone input ready', 'success');
                    setLoginStep('phone');
                  }
                  // Extension signals OTP input is ready
                  if (msg.type === 'bumble:otpInputReady') {
                    console.log('[Browser] Bumble OTP input ready');
                    addLog('Bumble OTP input ready', 'success');
                  }
                } catch (_) { }
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('[Browser] WebView connection error:', nativeEvent);
                addLog(`WebView connection warning: ${nativeEvent?.description || 'Code ' + nativeEvent?.code}`, 'error');
                setLoading(false);
                setConnectionError(nativeEvent);
              }}
              mediaCapturePermissionGrantType="grant"
              mixedContentMode="always"
              injectedJavaScript={`
              (function() {
                window.__logToApp = function(txt, t) {
                  try {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FE_LOG', text: txt, logType: t || 'info' }));
                    }
                  } catch(_) {}
                };
                window.__logToApp('In-Page Automation Engine active in DOM', 'info');

                const css = "header, nav, #nav, .nav, .navbar, .header, .neko-nav, .neko-header, .neko-sidebar, .neko-chat, .neko-menu, .neko-controls, .neko-topbar, .v-app-bar, .v-toolbar, [class*='v-toolbar'], [class*='v-app-bar'], [class*='header'], [class*='nav'], .v-navigation-drawer, .v-app-bar--fixed { display: none !important; height: 0 !important; opacity: 0 !important; visibility: hidden !important; } html, body, #neko, #app, .v-application, .neko-main, .video-container, .neko-video, video, canvas { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; top: 0 !important; left: 0 !important; position: absolute !important; object-fit: contain !important; background: #0F0F13 !important; } ::-webkit-scrollbar { display: none !important; }";
                const s = document.createElement('style');
                s.innerHTML = css;
                (document.head || document.documentElement).appendChild(s);

                var meta = document.querySelector('meta[name="viewport"]');
                if (!meta) {
                  meta = document.createElement('meta');
                  meta.name = 'viewport';
                  (document.head || document.documentElement).appendChild(meta);
                }
                meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';

                setInterval(function() {
                  document.querySelectorAll('div, header, nav').forEach(function(el) {
                    const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                    if (t.includes('n.eko') || t.includes('neko')) {
                      const r = el.getBoundingClientRect();
                      if (r.top < 120 && r.height < 120 && r.height > 0) { el.style.display = 'none'; }
                    }
                  });
                  // Auto-dismiss any privacy/terms/consent modal close buttons
                  document.querySelectorAll('button, [role="button"], a').forEach(function(btn) {
                    var txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                    var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                    if (aria.includes('close') || aria.includes('dismiss') || txt === 'i accept' || txt === 'agree' || txt === 'got it') {
                      if (btn.closest('[role="dialog"], [class*="modal"], [class*="overlay"], [class*="privacy"]')) {
                        btn.click();
                      }
                    }
                  });
                }, 250);

                document.addEventListener('pointerdown', function(e) {
                  var el = document.querySelector('video') || document.querySelector('canvas') || document.querySelector('.video-container') || document.body;
                  var r = el.getBoundingClientRect();
                  if (r.width > 0 && r.height > 0) {
                    var normX = Math.round(((e.clientX - r.left) / r.width) * 1280);
                    var normY = Math.round(((e.clientY - r.top) / r.height) * 720);
                    if (normX >= 0 && normX <= 1280 && normY >= 0 && normY <= 720) {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'FE_COORD',
                          x: normX,
                          y: normY
                        }));
                      }
                    }
                  }
                }, true);
              })();
              true;
            `}
              overScrollMode="never"
              keyboardDisplayRequiresUserAction={false}
              userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            />
          )}
          {lastCoord && (
            <View style={styles.coordHudBadge}>
              <Ionicons name="locate" size={13} color="#10B981" />
              <Text style={styles.coordHudText}>
                X: {lastCoord.x}  |  Y: {lastCoord.y}
              </Text>
              <TouchableOpacity
                onPress={() => setLastCoord(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={14} color="#8E8DA3" />
              </TouchableOpacity>
            </View>
          )}
          {startingHyperbeam && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={styles.loaderText}>Starting Hyperbeam Cloud Browser...</Text>
            </View>
          )}
          {loading && !startingHyperbeam && !connectionError && Boolean(finalUrl) && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={styles.loaderText}>Connecting to Virtual Browser...</Text>
            </View>
          )}
          {!startingHyperbeam && (!finalUrl || connectionError) && (
            <View style={styles.errorOverlay}>
              <Ionicons name="cloud-offline-outline" size={44} color="#FE3C72" />
              <Text style={styles.errorTitle}>Cannot Connect to Virtual Browser</Text>
              <Text style={styles.errorDetail}>
                {!finalUrl
                  ? 'Hyperbeam cloud session could not be established. Please check your Hyperbeam API key or switch to VPS / Local mode in Connection Settings.'
                  : (connectionError?.code === -2 || connectionError?.description?.includes('ERR_NAME_NOT_RESOLVED')
                    ? 'DNS / Host Lookup Failed (Error -2)\nThe phone could not resolve the server address.'
                    : (connectionError?.description || `Connection failed (Error code: ${connectionError?.code || -2})`))}
              </Text>
              {Boolean(finalUrl) && <Text style={styles.errorUrl} numberOfLines={2}>Target: {finalUrl}</Text>}
              <View style={styles.errorActions}>
                {Boolean(finalUrl) && (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => {
                      setConnectionError(null);
                      setLoading(true);
                      if (webViewRef.current) webViewRef.current.reload();
                    }}
                  >
                    <Ionicons name="refresh" size={15} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.backToSetupBtn}
                  onPress={() => {
                    cleanupCurrentSession();
                    navigation.goBack();
                  }}
                >
                  <Text style={styles.backToSetupBtnText}>Change Host / Mode</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ─── Bottom Controls / Wizard Section ─── */}
        {loginStep !== 'done' && (
          <View style={[styles.wizardPanel, !showNeko && styles.wizardPanelFull]}>
            {loginStep === 'options' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardOptionsHeader}>
                  <Text style={styles.wizardOptionsTitle}>Choose Login Method</Text>
                  <Text style={styles.wizardOptionsSubtitle}>
                    Select how you want to log into your Tinder account
                  </Text>
                </View>

                {/* Primary Tinder Pink Gradient Card */}
                <TouchableOpacity
                  style={styles.tinderPrimaryCard}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_EMAIL_LOGIN');
                    setSendingText(false);
                    setLoginStep('email');
                  }}
                >
                  <View style={styles.cardLeftGroup}>
                    <View style={styles.tinderIconSquare}>
                      <Ionicons name="mail" size={20} color="#FFF" />
                    </View>
                    <Text style={styles.tinderPrimaryCardText}>Log in with Email</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>

                {/* Secondary Google Glass Card */}
                <TouchableOpacity
                  style={styles.googleGlassCard}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_GOOGLE_LOGIN');
                    setSendingText(false);
                    setLoginStep('google_email');
                  }}
                >
                  <View style={styles.cardLeftGroup}>
                    <View style={styles.glassIconSquare}>
                      <Ionicons name="logo-google" size={18} color="rgba(255, 255, 255, 0.9)" />
                    </View>
                    <Text style={styles.googleCardText}>Log in with Google</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.3)" />
                </TouchableOpacity>

                {/* Tertiary Trouble Logging In Link */}
                <TouchableOpacity
                  style={styles.troubleLinkBtn}
                  disabled={sendingText}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_PHONE_LOGIN');
                    setSendingText(false);
                    setLoginStep('phone');
                  }}
                >
                  <Text style={styles.wizardBtnSecondaryText}>📱 Log in with Phone Number</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'google_email' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Google Sign-In 🌐</Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Email Address or Phone Number to log into Tinder.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Email or Phone..."
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    if (!inputText.trim()) return;
                    setSendingText(true);
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/submit-google-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: inputText.trim() }),
                      });
                      setInputText('');
                    } catch (e) {
                      console.error('Error submitting Google email:', e);
                    }
                    setSendingText(false);
                  }}
                >
                  {sendingText ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.wizardBtnText}>Next ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'google_password' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Google Password 🔒</Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Account Password to complete sign-in.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Google Password..."
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={setInputText}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    if (!inputText.trim()) return;
                    setSendingText(true);
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/submit-google-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: inputText.trim() }),
                      });
                      setInputText('');
                    } catch (e) {
                      console.error('Error submitting Google password:', e);
                    }
                    setSendingText(false);
                  }}
                >
                  {sendingText ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.wizardBtnText}>Sign In ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'navigating' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Opening Phone Login...</Text>
                </View>
                <ActivityIndicator size="large" color="#FFCB37" style={{ marginVertical: 10 }} />
                <Text style={styles.wizardDesc}>
                  Automatically navigating to the phone number screen. Just a moment.
                </Text>
                <TouchableOpacity
                  style={styles.wizardGhostBtn}
                  onPress={() => setLoginStep('phone')}
                >
                  <Text style={styles.wizardGhostBtnText}>Skip — I'll navigate manually</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'email' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Email Address</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter the email address associated with your account to receive your login code.
                </Text>

                {emailErrorText ? (
                  <View style={styles.wizardErrorBox}>
                    <Text style={styles.wizardErrorText}>
                      {emailErrorText}
                    </Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.wizardInput}
                  placeholder="email@example.com"
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={(txt) => {
                    setInputText(txt);
                    if (emailErrorText) setEmailErrorText('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />

                {/* Domain Quick Fill Chips */}
                <View style={{ marginBottom: 14 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com'].map((domain) => (
                      <TouchableOpacity
                        key={domain}
                        style={styles.wizardDomainChip}
                        onPress={() => {
                          let base = inputText.trim();
                          if (base.includes('@')) base = base.split('@')[0];
                          if (!base) base = 'user';
                          setInputText(`${base}${domain}`);
                          if (emailErrorText) setEmailErrorText('');
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.wizardDomainChipText}>{domain}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.wizardActionRow}>
                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { flex: 1 }]}
                    onPress={() => {
                      setInputText('');
                      setEmailErrorText('');
                    }}
                  >
                    <Text style={[styles.wizardBtnSecondaryText, { color: '#8E8DA3' }]}>🧹 Clear</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.wizardBtn, { flex: 1, marginTop: 0 }]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSubmittedEmail(inputText.trim());
                      setSendingText(true);
                      await sendBrowserCommand('SUBMIT_EMAIL', { email: inputText.trim() });
                      setSendingText(false);
                    }}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : rateLimitTimer > 0 ? (
                      <Text style={styles.wizardBtnText}>
                        ⏳ Retry in {rateLimitTimer}s
                      </Text>
                    ) : (
                      <Text style={styles.wizardBtnText}>
                        {emailErrorText ? '🔄 Retry Next' : 'Submit Email ➔'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === 'phone' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Mobile Number</Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your country code and mobile number to log into your account.
                </Text>

                <View style={styles.phoneInputRow}>
                  <TextInput
                    style={styles.countryCodeInput}
                    placeholder="+91"
                    placeholderTextColor="#8E8DA3"
                    value={countryCode}
                    onChangeText={setCountryCode}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.phoneNumberInput}
                    placeholder="Mobile Number"
                    placeholderTextColor="#8E8DA3"
                    value={inputText}
                    onChangeText={setInputText}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
                  activeOpacity={0.88}
                  onPress={async () => {
                    if (!inputText.trim()) return;
                    setSubmittedPhone(`${countryCode.trim()} ${inputText.trim()}`);
                    setSendingText(true);
                    await sendBrowserCommand('SUBMIT_PHONE', {
                      phone: inputText.trim(),
                      countryCode: countryCode.trim()
                    });
                    setInputText('');
                    setSendingText(false);
                    setLoginStep('waiting_otp');
                  }}
                >
                  {sendingText ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.wizardBtnText}>Send & Continue ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'waiting_email' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Check Your Email! 📩</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  If we found an account with your email, an email has been sent. Please check your email inbox to log in.
                </Text>

                <View style={styles.wizardHelpBox}>
                  <Text style={styles.wizardHelpLabel}>Didn't receive a link?</Text>

                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { marginBottom: 10 }]}
                    disabled={sendingText}
                    onPress={async () => {
                      setSendingText(true);
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/click-text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: 'different email' }),
                        });
                      } catch (e) { }
                      setSendingText(false);
                      setLoginStep('email');
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>✉️ Use a different email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.wizardBtnSecondary}
                    disabled={sendingText}
                    onPress={async () => {
                      setSendingText(true);
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/click-text`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ text: 'phone' }),
                        });
                      } catch (e) { }
                      setSendingText(false);
                      setLoginStep('phone');
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>📱 Log in with phone number</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === 'waiting_otp' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Sending OTP...</Text>
                </View>
                <ActivityIndicator size="large" color="#FFCB37" style={{ marginVertical: 10 }} />
                <Text style={styles.wizardDesc}>
                  A verification code is being sent to your phone. This may take a few seconds.
                </Text>
                <TouchableOpacity
                  style={styles.wizardGhostBtn}
                  onPress={() => setLoginStep('otp')}
                >
                  <Text style={styles.wizardGhostBtnText}>I already got the code →</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'otp' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>
                    {otpSubtype === 'sms' ? 'Device Verification 📱' : 'Email Verification 📧'}
                  </Text>
                  <TouchableOpacity style={styles.wizardDoneBtn} onPress={() => setLoginStep('done')} activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                    <Text style={styles.wizardDoneBtnText}>Logged In</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.wizardDesc}>
                  {otpSubtype === 'sms'
                    ? (submittedPhone
                      ? `We don't recognize your device. Enter the 6-digit passcode sent to ${submittedPhone} (SMS).`
                      : "We don't recognize your device. Enter the 6-digit passcode sent to your phone (SMS).")
                    : (submittedEmail
                      ? `Enter the 6-digit passcode sent to ${submittedEmail}.`
                      : "Enter the 6-digit passcode sent to your email address.")}
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Enter 6-digit OTP..."
                  placeholderTextColor="#8E8DA3"
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <View style={styles.wizardActionRow}>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    disabled={sendingText || resendingCode}
                    onPress={async () => {
                      setResendingCode(true);
                      setResendStatusText('Requesting new code...');
                      await sendBrowserCommand('RESEND_OTP');
                      setResendingCode(false);
                      setResendStatusText(`✅ New ${otpSubtype === 'sms' ? 'SMS' : 'email'} code requested! Check your inbox.`);
                      setTimeout(() => setResendStatusText(''), 6000);
                    }}
                  >
                    <Text style={styles.resendBtnText}>
                      {resendingCode ? '🔄 Resending...' : (otpSubtype === 'sms' ? '📩 Resend via SMS' : '📩 Resend via Email')}
                    </Text>
                  </TouchableOpacity>

                  {otpSubtype === 'sms' && (
                    <TouchableOpacity
                      style={styles.wizardTroubleBtn}
                      disabled={sendingText}
                      onPress={async () => {
                        setSendingText(true);
                        setInputText('');
                        await sendBrowserCommand('CLICK_TROUBLE');
                        setSendingText(false);
                        setLoginStep('email');
                      }}
                    >
                      <Text style={styles.wizardTroubleBtnText}>❓ Trouble Logging In?</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {resendStatusText ? (
                  <Text style={[styles.resendStatusText, { color: resendStatusText.includes('✅') ? '#10B981' : '#FFCB37' }]}>
                    {resendStatusText}
                  </Text>
                ) : null}

                <View style={styles.wizardBtnRow}>
                  <TouchableOpacity
                    style={[styles.wizardBtnPrimary, { flex: 1 }]}
                    disabled={sendingText || !inputText.trim()}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSendingText(true);
                      await sendBrowserCommand('SUBMIT_OTP', { otp: inputText.trim() });
                      setSendingText(false);
                    }}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.wizardBtnText}>Verify & Log In ✓</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loginStep === 'captcha' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Ionicons name="arrow-back" size={15} color="#E0E0E6" />
                    <Text style={styles.wizardBackBtnText}>Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Solve Security Puzzle</Text>
                </View>
                <View style={styles.puzzleWarningBox}>
                  <Text style={styles.puzzleWarningTitle}>🧩 Please Solve Puzzle First</Text>
                  <Text style={styles.puzzleWarningDesc}>
                    Security verification detected ("Protecting your account" / "Start Puzzle").
                  </Text>
                  <Text style={styles.puzzleInstructionText}>
                    👉 The live browser screen is visible above. Tap "Start Puzzle" on the browser screen above to solve it manually.
                  </Text>
                </View>

                <View style={{ marginBottom: 8 }}>
                  <TextInput
                    style={styles.wizardInput}
                    placeholder="Enter captcha text (if text-based)..."
                    placeholderTextColor="#8E8DA3"
                    value={captchaText}
                    onChangeText={setCaptchaText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.wizardBtnRow}>
                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { flex: 1 }]}
                    disabled={sendingText}
                    onPress={() => {
                      setCaptchaText('');
                      setLoginStep('otp');
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>Skip to OTP ➔</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.wizardBtn, { flex: 1 }]}
                    disabled={sendingText}
                    activeOpacity={0.88}
                    onPress={async () => {
                      if (captchaText.trim()) {
                        setSendingText(true);
                        try {
                          const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                          await fetch(`${orchestratorUrl}/type-text`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: captchaText.trim() }),
                          });
                          await fetch(`${orchestratorUrl}/press-enter`, { method: 'POST' });
                          setCaptchaText('');
                        } catch (e) {
                          console.error('Error sending captcha:', e);
                        } finally {
                          setSendingText(false);
                        }
                      }
                      setLoginStep('otp');
                    }}
                  >
                    {sendingText ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.wizardBtnText}>I Solved the Puzzle ✓</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}


        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={dummyText}
          onChangeText={handleTextChange}
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          onSubmitEditing={() => injectKeyEvent('\n')}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  header: {
    height: 56,
    marginTop: Platform.OS === 'android' ? 6 : 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 38 : 6,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusDotPulse: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  statusIndicatorText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.32)',
    borderRadius: 19,
    paddingHorizontal: 12,
    height: 38,
    justifyContent: 'center',
  },
  headerLogoutBtnText: {
    color: '#EF4444',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtnCircular: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBarGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  actionBtn: {
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnExpand: {
    flex: 2,
  },
  actionBtnIconOnly: {
    flex: 1,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(253, 41, 123, 0.12)',
    borderColor: 'rgba(253, 41, 123, 0.3)',
  },
  actionBtnText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  webviewContainer: {
    marginHorizontal: 16,
    position: 'relative',
  },
  webviewContainerSplit: {
    flex: 0.62,
  },
  webviewContainerFull: {
    flex: 1,
  },
  webviewContainerHidden: {
    height: 0,
    flex: 0,
    opacity: 0,
  },
  browserFrame: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  webviewInnerContainer: {
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#8E8DA3',
    marginTop: 15,
    fontSize: 13.5,
    fontWeight: '600',
  },
  wizardPanel: {
    flex: 0.38,
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  wizardPanelFull: {
    flex: 1,
  },
  wizardStep: {
    width: '100%',
  },
  wizardOptionsHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  wizardOptionsTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  wizardOptionsSubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12.5,
    marginTop: 3,
    textAlign: 'center',
  },
  tinderPrimaryCard: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    backgroundColor: '#FD297B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 10,
    shadowColor: '#FD297B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 7,
  },
  cardLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tinderIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinderPrimaryCardText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  googleGlassCard: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  glassIconSquare: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleCardText: {
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  troubleLinkBtn: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  troubleLinkText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  wizardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  wizardDoneBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  wizardDoneBtnText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  wizardBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardBackBtnText: {
    color: '#E0E0E6',
    fontSize: 12,
    fontWeight: '700',
  },
  wizardTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.15,
    flexShrink: 1,
  },
  wizardDesc: {
    color: '#8E8DA3',
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16.5,
  },
  wizardInput: {
    height: 46,
    backgroundColor: '#161424',
    borderRadius: 14,
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  wizardDomainChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  wizardDomainChipText: {
    color: '#D8D6E8',
    fontSize: 11,
    fontWeight: '700',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  countryCodeInput: {
    width: 72,
    height: 46,
    backgroundColor: '#161424',
    borderRadius: 14,
    paddingHorizontal: 10,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
  },
  phoneNumberInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#161424',
    borderRadius: 14,
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardBtn: {
    height: 48,
    backgroundColor: '#FD297B',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD297B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  wizardBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  wizardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wizardBtnSecondary: {
    height: 48,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardBtnSecondaryText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  wizardBtnPrimary: {
    height: 48,
    backgroundColor: '#FD297B',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FD297B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  wizardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  wizardErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.30)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  wizardErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  wizardHelpBox: {
    backgroundColor: '#0D0B14',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  wizardHelpLabel: {
    color: '#8E8DA3',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  wizardGhostBtn: {
    height: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  wizardGhostBtnText: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '600',
  },
  wizardTroubleBtn: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 203, 55, 0.20)',
  },
  wizardTroubleBtnText: {
    color: '#FFCB37',
    fontSize: 11.5,
    fontWeight: '700',
  },
  // ── Dashboard Modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F0F13',
  },
  modalHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
    backgroundColor: '#16161E',
  },
  modalTitle: {
    color: '#F1F1F5',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(253, 41, 123, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(253, 41, 123, 0.25)',
  },
  puzzleWarningBox: {
    backgroundColor: 'rgba(255, 203, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 203, 55, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  puzzleWarningTitle: {
    color: '#FFCB37',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  puzzleWarningDesc: {
    color: '#C8C8D0',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 6,
  },
  puzzleInstructionText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  resendBtn: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resendBtnText: {
    color: '#FFCB37',
    fontSize: 12,
    fontWeight: '700',
  },
  resendStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F0F13F5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    zIndex: 100,
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#9E9EB0',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorUrl: {
    color: '#65657A',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorActions: {
    width: '100%',
    maxWidth: 280,
    gap: 10,
  },
  retryBtn: {
    backgroundColor: '#FE3C72',
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  backToSetupBtn: {
    backgroundColor: '#222230',
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#343448',
  },
  backToSetupBtnText: {
    color: '#C4C4D6',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Live Log Toast Banner ──
  liveLogBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161622',
    borderBottomWidth: 1,
    borderBottomColor: '#252535',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  liveLogDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  liveLogText: {
    flex: 1,
    color: '#D1D1DF',
    fontSize: 12,
    fontWeight: '500',
  },
  liveLogBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  liveLogBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Logs Modal Component Styles ──
  logsStatusCard: {
    backgroundColor: '#181824',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262638',
  },
  logsStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  logsStatusLabel: {
    color: '#8E8E9F',
    fontSize: 12,
  },
  logsStatusValue: {
    color: '#E0E0EC',
    fontSize: 12,
    fontWeight: '600',
  },
  logRow: {
    backgroundColor: '#14141E',
    borderWidth: 1,
    borderColor: '#222230',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logTime: {
    color: '#6E6E7F',
    fontSize: 11,
  },
  logTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#818CF820',
  },
  logTagAction: {
    backgroundColor: '#38BDF820',
  },
  logTagSuccess: {
    backgroundColor: '#10B98120',
  },
  logTagError: {
    backgroundColor: '#EF444420',
  },
  logTypeText: {
    color: '#E0E0EC',
    fontSize: 10,
    fontWeight: '700',
  },
  logMessage: {
    color: '#F0F0F5',
    fontSize: 12.5,
    lineHeight: 17,
  },
  coordHudBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(18, 16, 28, 0.95)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  coordHudText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
