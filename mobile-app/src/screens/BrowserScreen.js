import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, AppState, TextInput, KeyboardAvoidingView, Platform, PanResponder, Keyboard, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { resolveLocalUrl } from '../utils/network';
import { cleanupCurrentSession } from '../utils/sessionManager';
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
  const [lastToast, setLastToast] = useState('🟢 FlirtEasy In-Page Engine Ready');
  const [logs, setLogs] = useState([
    { id: '1', time: new Date().toLocaleTimeString(), text: 'FlirtEasy Automation Engine initialized.', type: 'info' },
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
            setLoginStep('done');
            return;
          } else if (state === 'captcha') {
            setShowNeko(true); // Automatically show live browser when puzzle appears
            setLoginStep('captcha');
            return;
          } else if (state === 'email_rate_limited') {
            setEmailErrorText('⚠️ You\'ve made too many attempts. Please try again later.');
            setRateLimitTimer(60);
            if (loginStep !== 'email') {
              setLoginStep('email');
            }
            return;
          } else if (state === 'email_screen' && loginStep !== 'email') {
            // Found email input textbox! Clear inputText and set step to email.
            setInputText('');
            setEmailErrorText('');
            setLoginStep('email');
            return;
          } else if (state === 'waiting_email' && loginStep !== 'waiting_email') {
            setLoginStep('waiting_email');
            return;
          } else if (state === 'phone_screen' && loginStep !== 'phone') {
            setInputText('');
            setLoginStep('phone');
            return;
          } else if (state === 'google_email_screen' && loginStep !== 'google_email') {
            setInputText('');
            setLoginStep('google_email');
            return;
          } else if (state === 'google_password_screen' && loginStep !== 'google_password') {
            setInputText('');
            setLoginStep('google_password');
            return;
          } else if (state === 'email_otp_screen') {
            setOtpSubtype('email');
            if (data && data.email) setSubmittedEmail(data.email);
            if (loginStep !== 'otp') {
              setInputText('');
              setLoginStep('otp');
            }
            return;
          } else if (state === 'sms_otp_screen') {
            if (data && data.phone) setSubmittedPhone(data.phone);
            if (otpSubtype !== 'sms') {
              setOtpSubtype('sms');
              setInputText(''); // Clear email OTP from input when transitioning to SMS OTP
            }
            if (loginStep !== 'otp') {
              setInputText('');
              setLoginStep('otp');
            }
            return;
          } else if (state === 'otp_screen') {
            if (loginStep !== 'otp') {
              setInputText('');
              setLoginStep('otp');
            }
            return;
          } else if (state === 'login_options' && loginStep !== 'options') {
            setInputText('');
            setLoginStep('options');
            return;
          }
        }
      } catch (_) { }
      if (!cancelled) setTimeout(poll, 1000); // Poll every 1 second
    };

    const pollTimer = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [loginStep, vpsUrl]);

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
        body: JSON.stringify({ platform: isBumble ? 'Bumble' : 'Tinder' }),
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
      }).catch(() => {});
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
      }).catch(() => {});
    } catch (e) {
      console.warn('[Browser] dispatchCoordType error:', e);
    }
  };

  // Sends coordinate-based (x, y) clicks, typing, and OTP commands directly into Hyperbeam & Neko
  const sendBrowserCommand = async (action, payload = {}) => {
    try {
      console.log(`[Browser] Executing coordinate command: ${action}`, payload);

      if (action === 'CLICK_LOGIN') {
        // Click Header "Log In" button (1180, 35) + Accept cookies (640, 660)
        await dispatchCoordClick(640, 660, 'Accept Cookies');
        await new Promise(r => setTimeout(r, 200));
        await dispatchCoordClick(1180, 35, 'Header Log In Button');
      } else if (action === 'CLICK_EMAIL_LOGIN') {
        // 1. Click Header Log in button in case modal isn't open yet
        await dispatchCoordClick(1180, 35, 'Header Log In');
        await new Promise(r => setTimeout(r, 500));
        // 2. Click "Trouble Logging In / Email" option (640, 510)
        await dispatchCoordClick(640, 510, '"Log in with Email"');
      } else if (action === 'CLICK_PHONE_LOGIN') {
        // 1. Click Header Log in button
        await dispatchCoordClick(1180, 35, 'Header Log In');
        await new Promise(r => setTimeout(r, 500));
        // 2. Click "Log in with phone number" option (640, 440)
        await dispatchCoordClick(640, 440, '"Log in with Phone"');
      } else if (action === 'CLICK_GOOGLE_LOGIN') {
        // 1. Click Header Log in button
        await dispatchCoordClick(1180, 35, 'Header Log In');
        await new Promise(r => setTimeout(r, 500));
        // 2. Click "Continue with Google" option (640, 330)
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
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'email' }) }).catch(() => {});
      } else if (action === 'CLICK_PHONE_LOGIN') {
        fetch(`${orchestratorUrl}/click-text`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'phone' }) }).catch(() => {});
      } else if (action === 'SUBMIT_EMAIL') {
        fetch(`${orchestratorUrl}/submit-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: payload.email }) }).catch(() => {});
      } else if (action === 'SUBMIT_PHONE') {
        fetch(`${orchestratorUrl}/submit-phone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ countryCode: payload.countryCode, phoneNumber: payload.phone }) }).catch(() => {});
      } else if (action === 'SUBMIT_OTP') {
        fetch(`${orchestratorUrl}/submit-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp: payload.otp }) }).catch(() => {});
      } else if (action === 'RESEND_OTP') {
        fetch(`${orchestratorUrl}/resend-code`, { method: 'POST' }).catch(() => {});
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

  // For Bumble: automatically clicks through the two-step method selection
  // so the user lands directly on the phone number input screen.
  // Sequence:
  //   1. Wait 2s for Bumble's JS to finish rendering
  //   2. Click "Continue with other methods"
  //   3. Wait 1.5s for the next screen to render
  //   4. Click "Use cell phone number"
  //   5. Wait 1s for the phone input to appear
  //   6. Advance wizard to 'phone' step
  const autoNavigateBumbleLogin = async () => {
    // Step 1 — let Bumble's page fully render before clicking
    await new Promise(r => setTimeout(r, 2000));
    await clickAt(BUMBLE_BTN_OTHER_METHODS.x, BUMBLE_BTN_OTHER_METHODS.y);

    // Step 2 — wait for "Continue with other methods" screen to load
    await new Promise(r => setTimeout(r, 1500));
    await clickAt(BUMBLE_BTN_CELL_PHONE.x, BUMBLE_BTN_CELL_PHONE.y);

    // Step 3 — wait for phone number input to appear, then show wizard
    await new Promise(r => setTimeout(r, 1000));
    setLoginStep('phone');
  };

  const handleGoBack = async () => {
    setSendingText(false);
    setInputText('');
    setLoginStep('options');
    try {
      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
      await fetch(`${orchestratorUrl}/go-back`, { method: 'POST' });
    } catch (e) {}
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

    // Listen for the extension's signal that Bumble's phone input is ready.
    const listenerJs = isBumble ? `
      (function() {
        if (window.__flirteasyPhoneReadyListening) return;
        window.__flirteasyPhoneReadyListening = true;
        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'bumble:phoneInputReady') {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'bumble:phoneInputReady' })
            );
          }
          if (e.data && e.data.type === 'bumble:otpInputReady') {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'bumble:otpInputReady' })
            );
          }
        });
      })();
    ` : '';

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

          ${listenerJs}
        } catch(e) {}
      })();
    `;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  const finalUrl = React.useMemo(() => {
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
  }, [vpsUrl]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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
                <Text style={styles.modalTitle}>FlirtEasy Automation Logs</Text>
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
                <Ionicons name="stats-chart" size={16} color="#FE3C72" />
                <Text style={styles.modalTitle}>FlirtEasy Dashboard</Text>
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
                }, 150);
              })();
              true;
            `}
              overScrollMode="never"
              keyboardDisplayRequiresUserAction={false}
              userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            />
          )}
          {loading && !connectionError && Boolean(finalUrl) && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={styles.loaderText}>Connecting to Virtual Browser...</Text>
            </View>
          )}
          {(!finalUrl || connectionError) && (
            <View style={styles.errorOverlay}>
              <Ionicons name="cloud-offline-outline" size={44} color="#FE3C72" />
              <Text style={styles.errorTitle}>Cannot Connect to Virtual Browser</Text>
              <Text style={styles.errorDetail}>
                {!finalUrl
                  ? 'Hyperbeam cloud session could not be established. Please check your Hyperbeam API key or switch to Local Docker mode in Setup.'
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

        {loginStep !== 'done' && (
          <View style={[styles.wizardPanel, !showNeko && styles.wizardPanelFull]}>
            {loginStep === 'options' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <Text style={styles.wizardTitle}>Choose Login Method</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Select how you want to log into your {platform} account:
                </Text>

                <TouchableOpacity
                  style={[styles.wizardBtn, { marginBottom: 10 }]}
                  disabled={sendingText}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_EMAIL_LOGIN');
                    setSendingText(false);
                    setLoginStep('email');
                  }}
                >
                  <Text style={styles.wizardBtnText}>📧 Log in with Email Address</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.wizardBtnSecondary, { marginBottom: 10 }]}
                  disabled={sendingText}
                  onPress={async () => {
                    setSendingText(true);
                    await sendBrowserCommand('CLICK_GOOGLE_LOGIN');
                    setSendingText(false);
                    setLoginStep('google_email');
                  }}
                >
                  <Text style={styles.wizardBtnSecondaryText}>🌐 Log in with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.wizardBtnSecondary, { marginBottom: 10 }]}
                  disabled={sendingText}
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
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Google Sign-In 🌐</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Email Address or Phone Number to log into Tinder.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Email or Phone..."
                  placeholderTextColor="#6E6E7F"
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
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
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Google Password 🔒</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your Google Account Password to complete sign-in.
                </Text>

                <TextInput
                  style={styles.wizardInput}
                  placeholder="Google Password..."
                  placeholderTextColor="#6E6E7F"
                  value={inputText}
                  onChangeText={setInputText}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
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
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Opening Phone Login...</Text>
                </View>
                <ActivityIndicator size="large" color="#FFCB37" style={{ marginVertical: 12 }} />
                <Text style={styles.wizardDesc}>
                  Automatically navigating to the phone number screen. Just a moment.
                </Text>
                <TouchableOpacity
                  style={[styles.wizardBtn, { backgroundColor: '#2A2A35', borderWidth: 1, borderColor: '#3A3A4A' }]}
                  onPress={() => setLoginStep('phone')}
                >
                  <Text style={[styles.wizardBtnText, { color: '#8E8E9F' }]}>Skip — I'll navigate manually</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'email' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Email Address</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter the email address associated with your account to receive your login code.
                </Text>

                {emailErrorText ? (
                  <View style={{ backgroundColor: 'rgba(255, 75, 75, 0.15)', borderWidth: 1, borderColor: '#FF4B4B', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                    <Text style={{ color: '#FF6B6B', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                      {emailErrorText}
                    </Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.wizardInput}
                  placeholder="email@example.com"
                  placeholderTextColor="#6E6E7F"
                  value={inputText}
                  onChangeText={(txt) => {
                    setInputText(txt);
                    if (emailErrorText) setEmailErrorText('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.resendBtn, { flex: 1, marginVertical: 0, paddingVertical: 12, backgroundColor: '#2A2A3A', borderColor: '#3A3A4D' }]}
                    onPress={() => {
                      setInputText('');
                      setEmailErrorText('');
                    }}
                  >
                    <Text style={[styles.resendBtnText, { color: '#B0B0C0' }]}>🧹 Clear Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.wizardBtn, { flex: 1, marginTop: 0 }]}
                    disabled={sendingText}
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
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Enter Mobile Number</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  Enter your country code and mobile number to log into your account.
                </Text>

                <View style={styles.phoneInputRow}>
                  <TextInput
                    style={styles.countryCodeInput}
                    placeholder="+91"
                    placeholderTextColor="#6E6E7F"
                    value={countryCode}
                    onChangeText={setCountryCode}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.phoneNumberInput}
                    placeholder="Mobile Number"
                    placeholderTextColor="#6E6E7F"
                    value={inputText}
                    onChangeText={setInputText}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </View>

                <TouchableOpacity
                  style={styles.wizardBtn}
                  disabled={sendingText}
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
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Check Your Email! 📩</Text>
                </View>
                <Text style={styles.wizardDesc}>
                  If we found an account with your email, an email has been sent. Please check your email inbox to log in.
                </Text>

                <View style={{ marginTop: 10, padding: 12, backgroundColor: '#1E1E28', borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ color: '#8E8E9F', fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Didn't receive a link?</Text>
                  
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
                      } catch (e) {}
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
                      } catch (e) {}
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
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>Sending OTP...</Text>
                </View>
                <ActivityIndicator size="large" color="#FFCB37" style={{ marginVertical: 12 }} />
                <Text style={styles.wizardDesc}>
                  A verification code is being sent to your phone. This may take a few seconds.
                </Text>
                <TouchableOpacity
                  style={[styles.wizardBtn, { backgroundColor: '#2A2A35', borderWidth: 1, borderColor: '#3A3A4A', marginTop: 8 }]}
                  onPress={() => setLoginStep('otp')}
                >
                  <Text style={[styles.wizardBtnText, { color: '#8E8E9F' }]}>I already got the code →</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'otp' && (
              <View style={styles.wizardStep}>
                <View style={styles.wizardHeaderRow}>
                  <TouchableOpacity style={styles.wizardBackBtn} onPress={handleGoBack}>
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.wizardTitle}>
                    {otpSubtype === 'sms' ? 'Device Verification (SMS) 📱' : 'Email Verification 📧'}
                  </Text>
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
                  placeholderTextColor="#6E6E7F"
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
                  <TouchableOpacity
                    style={[styles.resendBtn, { flex: 1, marginVertical: 0, paddingVertical: 10 }]}
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
                      style={{
                        flex: 1,
                        backgroundColor: '#2A2A3A',
                        borderRadius: 10,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#3A3A4D',
                      }}
                      disabled={sendingText}
                      onPress={async () => {
                        setSendingText(true);
                        setInputText('');
                        await sendBrowserCommand('CLICK_TROUBLE');
                        setSendingText(false);
                        setLoginStep('email');
                      }}
                    >
                      <Text style={{ color: '#FFCB37', fontSize: 12, fontWeight: '600' }}>❓ Trouble Logging In?</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {resendStatusText ? (
                  <Text style={{ color: resendStatusText.includes('✅') ? '#4CAF50' : '#FF9800', fontSize: 12, marginBottom: 8, fontWeight: '600', marginLeft: 2 }}>
                    {resendStatusText}
                  </Text>
                ) : null}

                <View style={[styles.wizardBtnRow, { marginTop: 8 }]}>
                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { marginRight: 8 }]}
                    disabled={sendingText}
                    onPress={handleGoBack}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>↩ Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.wizardBtnPrimary, { flex: 1 }]}
                    disabled={sendingText || !inputText.trim()}
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
                    <Text style={styles.wizardBackBtnText}>⬅️ Back</Text>
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

                <View style={{ marginBottom: 12 }}>
                  <TextInput
                    style={styles.wizardInput}
                    placeholder="Enter captcha text (if text-based)..."
                    placeholderTextColor="#6E6E7F"
                    value={captchaText}
                    onChangeText={setCaptchaText}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.wizardBtnRow}>
                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { marginRight: 8 }]}
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
    backgroundColor: '#0F0F13',
  },
  header: {
    height: 56,
    marginTop: Platform.OS === 'android' ? 6 : 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: '#2A2A35',
    backgroundColor: '#181820',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#2A2A35',
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8E8E9F',
    fontSize: 11,
    marginTop: 2,
  },
  menuBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FE3C7215',
    borderWidth: 1,
    borderColor: '#FE3C7240',
  },
  menuBtnText: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: 'bold',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0F0F13',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F0F13',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#8E8E9F',
    marginTop: 15,
    fontSize: 14,
  },
  inputPanel: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: '#2A2A35',
    backgroundColor: '#181820',
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#0F0F13',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3A3A4A',
    marginRight: 8,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 14,
    backgroundColor: '#FE3C72',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  sendBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  enterBtn: {
    height: 40,
    paddingHorizontal: 12,
    backgroundColor: '#2A2A35',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A4A',
  },
  enterBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  webviewContainerSplit: {
    flex: 0.65,
    borderBottomWidth: 1,
    borderColor: '#232332',
  },
  webviewContainerFull: {
    flex: 1,
  },
  wizardPanel: {
    flex: 0.35,
    backgroundColor: '#13131C',
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  wizardStep: {
    width: '100%',
  },
  wizardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  wizardBackBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#262636',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#36364A',
  },
  wizardBackBtnText: {
    color: '#E0E0E6',
    fontSize: 12,
    fontWeight: 'bold',
  },
  wizardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  wizardDesc: {
    color: '#9A9AB0',
    fontSize: 12.5,
    marginBottom: 12,
    lineHeight: 16,
  },
  wizardInput: {
    height: 44,
    backgroundColor: '#0A0A0F',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2D2D3E',
    marginBottom: 12,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  countryCodeInput: {
    width: 76,
    height: 44,
    backgroundColor: '#0A0A0F',
    borderRadius: 10,
    paddingHorizontal: 10,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#2D2D3E',
    marginRight: 8,
    textAlign: 'center',
  },
  phoneNumberInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#0A0A0F',
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2D2D3E',
  },
  wizardBtn: {
    height: 44,
    backgroundColor: '#FE3C72',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  wizardBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  wizardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wizardBtnSecondary: {
    height: 52,
    paddingHorizontal: 20,
    backgroundColor: '#20202C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D3E',
  },
  wizardBtnSecondaryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  skipBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FE3C7215',
    borderWidth: 1,
    borderColor: '#FE3C7240',
  },
  skipBtnText: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: 'bold',
  },
  toggleNekoBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFCB3715',
    borderWidth: 1,
    borderColor: '#FFCB3740',
  },
  toggleNekoBtnText: {
    color: '#FFCB37',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dashboardBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#818CF815',
    borderWidth: 1,
    borderColor: '#818CF840',
  },
  dashboardBtnText: {
    fontSize: 15,
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
    backgroundColor: '#FE3C7215',
    borderWidth: 1,
    borderColor: '#FE3C7240',
  },
  modalCloseBtnText: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: '700',
  },

  webviewContainerHidden: {
    height: 0,
    flex: 0,
    opacity: 0,
  },
  wizardPanelFull: {
    flex: 1,
  },
  puzzleWarningBox: {
    backgroundColor: '#FFCB3715',
    borderWidth: 1,
    borderColor: '#FFCB3740',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  puzzleWarningTitle: {
    color: '#FFCB37',
    fontSize: 17.5,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  puzzleWarningDesc: {
    color: '#E0E0E5',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 8,
  },
  puzzleInstructionText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  resendBtn: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  resendBtnText: {
    color: '#FFCB37',
    fontSize: 13.5,
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
});
