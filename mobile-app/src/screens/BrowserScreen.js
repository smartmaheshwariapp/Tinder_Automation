import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, AppState, TextInput, KeyboardAvoidingView, Platform, PanResponder, Keyboard, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { resolveLocalUrl } from '../utils/network';
import { DashboardPanel } from '../components/dashboard';
import { useExtensionStats } from '../hooks/useExtensionStats';


// Neko container screen resolution (must match NEKO_DESKTOP_SCREEN in docker-compose)
// 768x1024 — HD tablet/desktop portrait aspect ratio for zero captcha cutoff
const NEKO_WIDTH = 768;
const NEKO_HEIGHT = 1024;

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
  const { platform, vpsUrl: rawVpsUrl, proxyIp, extensionSettings } = route.params;
  const vpsUrl = resolveLocalUrl(rawVpsUrl);
  const webViewRef = useRef(null);
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loginStep, setLoginStep] = useState('options');
  const [showNeko, setShowNeko] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false); // Fullscreen video toggle
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
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        if (dx > 15) {
          console.log('[Mobile] Swiped Right -> Triggering Left arrow key');
          handleSwipe('Left');
        } else if (dx < -15) {
          console.log('[Mobile] Swiped Left -> Triggering Right arrow key');
          handleSwipe('Right');
        }
      },
    })
  ).current;



  // Continuous /check-page-state polling (fast during login, slower when done)
  useEffect(() => {
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
              if (data && data.phone) setSubmittedPhone(data.phone);
              if (otpSubtype !== 'sms') {
                setOtpSubtype('sms');
                setInputText(''); // Clear email OTP from input when transitioning to SMS OTP
              }
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

  const getOrchestratorUrl = (nekoUrl) => {
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
    } catch (_) {}
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
    const settingsJson = JSON.stringify(extensionSettings || {});
    const cssCode = `
      html, body, #app, .v-application, .v-main, .neko-main, .video-container, .neko-video, video, canvas {
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
      }
      .v-app-bar, .v-toolbar, .v-navigation-drawer, header.v-app-bar, .neko-nav, .neko-header, .v-app-bar--fixed {
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
    webViewRef.current.injectJavaScript(jsCode);
  };

  const finalUrl = React.useMemo(() => {
    let clean = vpsUrl || '';
    const isLocal = clean.includes('localhost') || 
                    clean.includes('127.0.0.1') || 
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
        {/* ─── Upgraded Modern Glass Header ─── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.statusIndicatorRow}>
              <View style={styles.statusDotPulse} />
              <Text style={styles.statusIndicatorText}>
                {proxyIp ? 'ENCRYPTED TUNNEL ACTIVE' : 'DIRECT CONNECT ACTIVE'}
              </Text>
            </View>
            <Text style={styles.headerTitle}>Tinder Session</Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtnCircular}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.75)" />
          </TouchableOpacity>
        </View>

        {/* ─── Top Action Bar (Dedicated Glass 4-Button Grid) ─── */}
        <View style={styles.actionBarGrid}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnExpand, isExpanded && styles.actionBtnActive]}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isExpanded ? 'contract-outline' : 'scan-outline'}
              size={17}
              color={isExpanded ? '#FD297B' : 'rgba(255, 255, 255, 0.85)'}
            />
            <Text style={[styles.actionBtnText, isExpanded && { color: '#FD297B' }]}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnIconOnly, !showNeko && styles.actionBtnActive]}
            onPress={() => setShowNeko(!showNeko)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showNeko ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={!showNeko ? '#FFCB37' : 'rgba(255, 255, 255, 0.85)'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnIconOnly]}
            onPress={() => setShowDashboard(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="stats-chart-outline" size={17} color="#FD297B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnIconOnly]}
            onPress={() => setLoginStep('done')}
            activeOpacity={0.8}
          >
            <Ionicons name="play-forward-outline" size={17} color="rgba(255, 255, 255, 0.85)" />
          </TouchableOpacity>
        </View>

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

        {/* ─── Rounded Glass Browser Container ─── */}
        <View
          {...panResponder.panHandlers}
          style={[
            styles.webviewContainer,
            loginStep !== 'done' && (
              showNeko
                ? (isExpanded || loginStep === 'captcha' ? styles.webviewContainerFull : styles.webviewContainerSplit)
                : styles.webviewContainerHidden
            )
          ]}
        >
          <View style={styles.browserFrame}>
            <WebView
              ref={webViewRef}
              source={{ uri: finalUrl }}
              style={styles.webview}
              containerStyle={styles.webviewInnerContainer}
              scrollEnabled={false}
              bounces={false}
              scalesPageToFit={false}
              setBuiltInZoomControls={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onLoadEnd={() => {
                setLoading(false);
                injectConfigScript();
              }}
              onMessage={() => {}}
              onError={() => {
                setTimeout(() => {
                  if (webViewRef.current) webViewRef.current.reload();
                }, 3000);
              }}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              mediaCapturePermissionGrantType="grant"
              originWhitelist={['*']}
              mixedContentMode="always"
              javaScriptEnabled={true}
              domStorageEnabled={true}
              injectedJavaScript={`
              (function() {
                const css = "header, nav, #nav, .nav, .navbar, .header, .neko-nav, .neko-header, .neko-sidebar, .neko-chat, .neko-menu, .neko-controls, .neko-topbar, .v-app-bar, .v-toolbar, [class*='v-toolbar'], [class*='v-app-bar'], [class*='header'], [class*='nav'] { display: none !important; height: 0 !important; opacity: 0 !important; visibility: hidden !important; } html, body, #neko, #app, .v-application, .neko-main, .video-container, .neko-video, video, canvas { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; top: 0 !important; left: 0 !important; position: absolute !important; }";
                const s = document.createElement('style');
                s.innerHTML = css;
                (document.head || document.documentElement).appendChild(s);
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
            {loading && (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#FD297B" />
                <Text style={styles.loaderText}>Connecting to Virtual Browser...</Text>
              </View>
            )}
          </View>
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
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/click-text`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: 'email' }),
                      });
                    } catch (e) {}
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
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/click-text`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: 'google' }),
                      });
                    } catch (e) {}
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
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/click-text`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: 'trouble logging in' }),
                      });
                    } catch (e) {}
                    setSendingText(false);
                    setLoginStep('phone');
                  }}
                >
                  <Text style={styles.troubleLinkText}>Trouble Logging In?</Text>
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

                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/submit-email`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: inputText.trim() }),
                        });
                      } catch (e) {
                        console.error('Network error submitting email address:', e);
                      }

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

                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      const response = await fetch(`${orchestratorUrl}/submit-phone`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          countryCode: countryCode.trim(),
                          phoneNumber: inputText.trim()
                        }),
                      });

                      if (response.ok) {
                        setInputText('');
                      }
                    } catch (e) {
                      console.error('Network error submitting phone number:', e);
                    }

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
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        const res = await fetch(`${orchestratorUrl}/resend-code`, { method: 'POST' });
                        if (res.ok) {
                          setResendStatusText(`✅ New ${otpSubtype === 'sms' ? 'SMS' : 'email'} code requested! Check your inbox.`);
                        } else {
                          setResendStatusText('❌ Resend request sent.');
                        }
                      } catch (e) {
                        console.error('Error requesting resend code:', e);
                        setResendStatusText('❌ Network error requesting code.');
                      } finally {
                        setResendingCode(false);
                        setTimeout(() => setResendStatusText(''), 6000);
                      }
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
                        try {
                          const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                          await fetch(`${orchestratorUrl}/click-text`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: 'trouble logging in' }),
                          });
                          setLoginStep('email');
                        } catch (e) {
                          console.error('Error clicking trouble logging in:', e);
                        } finally {
                          setSendingText(false);
                        }
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
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/submit-otp`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ otp: inputText.trim() }),
                        });
                        // Accelerated check cycles to catch logged-in transition immediately
                        [600, 1200, 2000, 3500, 5000].forEach(delay => {
                          setTimeout(async () => {
                            try {
                              const r = await fetch(`${orchestratorUrl}/check-page-state`);
                              const d = await r.json();
                              if (d.state === 'logged_in') {
                                setLoginStep('done');
                              }
                            } catch (_) {}
                          }, delay);
                        });
                      } catch (e) {
                        console.error('Error submitting OTP:', e);
                      } finally {
                        setSendingText(false);
                      }
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

        {loginStep === 'done' && (
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
    marginBottom: 6,
    marginLeft: 2,
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
    backgroundColor: '#FD297B',
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
});
