import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Dimensions, AppState, TextInput, KeyboardAvoidingView, Platform, PanResponder } from 'react-native';
import { WebView } from 'react-native-webview';

// Neko container screen resolution (must match NEKO_DESKTOP_SCREEN in docker-compose)
// 416x912 — portrait mobile dimensions
const NEKO_WIDTH = 416;
const NEKO_HEIGHT = 912;

export default function BrowserScreen({ route, navigation }) {
  const { platform, vpsUrl, proxyIp, extensionSettings } = route.params;
  const webViewRef = useRef(null);
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  // For Bumble: start at 'navigating' so user sees a status while auto-clicks happen,
  // then transition to 'phone' once the phone input is visible.
  // For other platforms: start at 'phone' directly.
  const isBumble = platform?.toLowerCase() === 'bumble';
  const [loginStep, setLoginStep] = useState(isBumble ? 'navigating' : 'phone');
  const [showNeko, setShowNeko] = useState(true);
  const [inputText, setInputText] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [captchaText, setCaptchaText] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [dummyText, setDummyText] = useState('');
  const appState = useRef(AppState.currentState);

  const lastSwipeTime = useRef(0);

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

  // Poll orchestrator /nav-status while on navigating step.
  // Advances to phone when orchestrator signals phone input is ready.
  // Safety auto-advance after 30s even if polling fails.
  useEffect(() => {
    if (!isBumble || loginStep !== 'navigating') return;

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

    // Safety: auto-advance after 30s regardless
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoginStep('phone');
    }, 30000);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(safetyTimer);
    };
  }, [loginStep, isBumble]);

  // Poll /check-page-state while waiting for OTP screen to appear.
  // Advances to 'otp' when OTP input detected, 'done' if already logged in.
  // Safety auto-advance to 'otp' after 30s.
  useEffect(() => {
    if (loginStep !== 'waiting_otp') return;

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
          } else if (state === 'otp_screen') {
            setLoginStep('otp');
            return;
          } else if (state === 'captcha') {
            setShowNeko(true); // Automatically show live browser when puzzle appears
            setLoginStep('captcha');
            return;
          }
        }
      } catch (_) { }
      if (!cancelled) setTimeout(poll, 500);
    };

    const startTimer = setTimeout(poll, 500);
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoginStep('otp');
    }, 30000);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      clearTimeout(safetyTimer);
    };
  }, [loginStep]);

  const getOrchestratorUrl = (nekoUrl) => {
    try {
      const urlObj = new URL(nekoUrl.split('/?')[0]);
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
  }; const handleSendText = async () => {
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

    return () => {
      subscription.remove();
    };
  }, []);

  const injectConfigScript = () => {
    const settingsJson = JSON.stringify(extensionSettings || {});
    const cssCode = `
      .v-app-bar, .v-toolbar, .v-navigation-drawer, header.v-app-bar, .neko-nav, .neko-header, .v-app-bar--fixed {
        display: none !important;
        height: 0 !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
      .v-main, .neko-main, .video-container, .neko-video, video, canvas {
        padding-top: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
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

          ${listenerJs}
        } catch(e) {}
      })();
    `;
    webViewRef.current.injectJavaScript(jsCode);
  };

  const finalUrl = React.useMemo(() => {
    let clean = (vpsUrl || '').replace('http://', 'https://');
    if (clean.includes('stream.') || clean.startsWith('https://')) {
      clean = clean.replace(':8080', '');
    }
    if (!clean.startsWith('https://')) {
      clean = 'https://' + clean;
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
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>✕ Close</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{platform} Session</Text>
            <Text style={styles.subtitle} numberOfLines={1}>IP: {proxyIp}</Text>
          </View>
          {loginStep !== 'done' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.toggleNekoBtn, { marginRight: 6 }]}
                onPress={() => setShowNeko(!showNeko)}
              >
                <Text style={styles.toggleNekoBtnText}>
                  {showNeko ? '🙈 Hide Browser' : '👁️ View Browser'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={() => setLoginStep('done')}>
                <Text style={styles.skipBtnText}>
                  {loginStep === 'navigating' ? 'Skip' : 'Skip'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.menuBtn, { marginRight: 8, backgroundColor: '#3A3A4A15', borderColor: '#3A3A4A40' }]}
              onPress={() => inputRef.current.focus()}
            >
              <Text style={[styles.menuBtnText, { color: '#FFF' }]}>⌨️ Keyboard</Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          {...panResponder.panHandlers}
          style={[
            styles.webviewContainer,
            loginStep !== 'done' && (showNeko ? styles.webviewContainerSplit : styles.webviewContainerHidden)
          ]}
        >
          <WebView
            ref={webViewRef}
            source={{ uri: finalUrl }}
            style={styles.webview}
            onLoadEnd={() => {
              setLoading(false);
              injectConfigScript();
            }}
            onMessage={(event) => {
              try {
                const msg = JSON.parse(event.nativeEvent.data);
                // Extension signals phone input is ready — advance wizard automatically to phone
                if (msg.type === 'bumble:phoneInputReady' && loginStep === 'navigating') {
                  console.log('[Browser] Bumble phone input ready — advancing wizard to phone');
                  setLoginStep('phone');
                }
                // Extension signals OTP input is ready (we log it, but transition is handled by the 20s delay)
                if (msg.type === 'bumble:otpInputReady') {
                  console.log('[Browser] Bumble OTP input ready (waiting for 20s timer...)');
                }
              } catch (_) { }
            }}
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
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            keyboardDisplayRequiresUserAction={false}
            userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          />
          {loading && (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#FE3C72" />
              <Text style={styles.loaderText}>Connecting to Virtual Browser...</Text>
            </View>
          )}
        </View>

        {loginStep !== 'done' && (
          <View style={[styles.wizardPanel, !showNeko && styles.wizardPanelFull]}>
            {loginStep === 'navigating' && (
              <View style={styles.wizardStep}>
                <ActivityIndicator size="large" color="#FFCB37" style={{ marginBottom: 16 }} />
                <Text style={styles.wizardTitle}>Opening Phone Login...</Text>
                <Text style={styles.wizardDesc}>
                  Automatically navigating to the phone number screen on Bumble. Just a moment.
                </Text>
                <TouchableOpacity
                  style={[styles.wizardBtn, { backgroundColor: '#2A2A35', borderWidth: 1, borderColor: '#3A3A4A' }]}
                  onPress={() => setLoginStep('phone')}
                >
                  <Text style={[styles.wizardBtnText, { color: '#8E8E9F' }]}>Skip — I'll navigate manually</Text>
                </TouchableOpacity>
              </View>
            )}

            {loginStep === 'phone' && (
              <View style={styles.wizardStep}>
                <Text style={styles.wizardTitle}>Enter Mobile Number</Text>
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
                    setSendingText(true);

                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);

                      // Submit country code and phone number atomically to avoid race conditions
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
                      } else {
                        console.error('Failed to submit phone number');
                      }
                    } catch (e) {
                      console.error('Network error submitting phone number:', e);
                    }

                    // Immediately show OTP waiting screen, poll for OTP input to appear
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

            {loginStep === 'waiting_otp' && (
              <View style={styles.wizardStep}>
                <ActivityIndicator size="large" color="#FFCB37" style={{ marginBottom: 16 }} />
                <Text style={styles.wizardTitle}>Sending OTP...</Text>
                <Text style={styles.wizardDesc}>
                  Bumble is sending a verification code to your phone. This may take a few seconds.
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
                <Text style={styles.wizardTitle}>Enter Verification Code</Text>
                <Text style={styles.wizardDesc}>Enter the verification code (OTP) sent to your mobile device.</Text>
                <TextInput
                  style={styles.wizardInput}
                  placeholder="Enter OTP..."
                  placeholderTextColor="#6E6E7F"
                  value={inputText}
                  onChangeText={setInputText}
                  keyboardType="number-pad"
                />

                <TouchableOpacity
                  style={styles.resendBtn}
                  disabled={sendingText}
                  onPress={async () => {
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      await fetch(`${orchestratorUrl}/resend-code`, { method: 'POST' });
                    } catch (e) {
                      console.error('Error requesting resend code:', e);
                    }
                  }}
                >
                  <Text style={styles.resendBtnText}>🔄 Didn't receive code? Send code again</Text>
                </TouchableOpacity>

                <View style={[styles.wizardBtnRow, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={[styles.wizardBtnSecondary, { marginRight: 8 }]}
                    disabled={sendingText}
                    onPress={() => {
                      setInputText('');
                      setLoginStep('phone');
                    }}
                  >
                    <Text style={styles.wizardBtnSecondaryText}>↩ Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.wizardBtn, { flex: 1 }]}
                    disabled={sendingText}
                    onPress={async () => {
                      if (!inputText.trim()) return;
                      setSendingText(true);

                      // Send OTP to the browser
                      try {
                        const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                        await fetch(`${orchestratorUrl}/submit-otp`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ otp: inputText.trim() }),
                        });
                        setInputText('');
                      } catch (e) {
                        console.error('Error sending OTP:', e);
                        setSendingText(false);
                        return;
                      }

                      // Poll page state for up to 15 seconds
                      let attempts = 0;
                      const maxAttempts = 30;
                      const pollInterval = setInterval(async () => {
                        attempts++;
                        try {
                          const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                          const resp = await fetch(`${orchestratorUrl}/check-page-state`);
                          const data = await resp.json();
                          const state = data.state;

                          if (state === 'logged_in') {
                            clearInterval(pollInterval);
                            setSendingText(false);
                            setLoginStep('done');
                          } else if (state === 'captcha') {
                            clearInterval(pollInterval);
                            setSendingText(false);
                            setLoginStep('captcha');
                          } else if (attempts >= maxAttempts) {
                            clearInterval(pollInterval);
                            setSendingText(false);
                            // Unknown state — go to done so user can interact manually
                            setLoginStep('done');
                          }
                          // If 'otp_screen' or 'unknown', keep polling
                        } catch (e) {
                          if (attempts >= maxAttempts) {
                            clearInterval(pollInterval);
                            setSendingText(false);
                            setLoginStep('done');
                          }
                        }
                      }, 500);
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

        {loginStep === 'done' && (
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
    marginTop: 35,
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
});
