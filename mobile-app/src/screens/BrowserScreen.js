import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Dimensions, AppState, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
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
  const [loginStep, setLoginStep] = useState(isBumble ? 'navigating' : 'country_code');
  const [inputText, setInputText] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [sendingText, setSendingText] = useState(false);
  const [dummyText, setDummyText] = useState('');
  const appState = useRef(AppState.currentState);

  const getOrchestratorUrl = (nekoUrl) => {
    try {
      const urlObj = new URL(nekoUrl.split('/?')[0]);
      urlObj.port = '3000';
      return urlObj.origin;
    } catch (e) {
      let base = nekoUrl.split('/?')[0];
      if (base.includes(':8080')) {
        return base.replace(/:8080/, ':3000');
      }
      return base + ':3000';
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
  };  const handleSendText = async () => {
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
      html, body, #neko, .neko-main, .video-container, .neko-video, video, canvas {
        width: 100% !important;
        height: 100% !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }
      .neko-sidebar, .neko-chat {
        display: none !important;
      }
    `;

    // Listen for the extension's signal that Bumble's phone input is ready.
    // The bumble-content.js extension posts window.postMessage({ type: 'bumble:phoneInputReady' })
    // once it has auto-clicked through "Continue with other methods" → "Use cell phone number".
    // Neko's WebRTC client relays postMessages from the container page to the host WebView.
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
          const style = document.createElement('style');
          style.id = 'flirteasy-mobile-layout';
          style.innerHTML = \`${cssCode}\`;
          document.head.appendChild(style);
          ${listenerJs}
        } catch(e) {}
      })();
    `;
    webViewRef.current.injectJavaScript(jsCode);
  };

  const finalUrl = React.useMemo(() => {
    return `${vpsUrl}${vpsUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
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
          <TouchableOpacity style={styles.skipBtn} onPress={() => setLoginStep('done')}>
            <Text style={styles.skipBtnText}>
              {loginStep === 'navigating' ? 'Skip ➔' : 'Skip Wizard ➔'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.menuBtn, { marginRight: 8, backgroundColor: '#3A3A4A15', borderColor: '#3A3A4A40' }]} 
            onPress={() => inputRef.current.focus()}
          >
            <Text style={[styles.menuBtnText, { color: '#FFF' }]}>⌨️ Keyboard</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.webviewContainer, loginStep !== 'done' && styles.webviewContainerSplit]}>
        <WebView
          ref={webViewRef}
          source={{ uri: finalUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            injectConfigScript();
          }}
          onMessage={(event) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data);
              // Extension signals phone input is ready — advance wizard automatically to country code
              if (msg.type === 'bumble:phoneInputReady' && loginStep === 'navigating') {
                console.log('[Browser] Bumble phone input ready — advancing wizard to country code');
                setLoginStep('country_code');
              }
              // Extension signals OTP input is ready (we log it, but transition is handled by the 20s delay)
              if (msg.type === 'bumble:otpInputReady') {
                console.log('[Browser] Bumble OTP input ready (waiting for 20s timer...)');
              }
            } catch (_) {}
          }}
          onError={() => {
            setTimeout(() => {
              if (webViewRef.current) webViewRef.current.reload();
            }, 3000);
          }}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
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
        <View style={styles.wizardPanel}>
          {loginStep === 'navigating' && (
            <View style={styles.wizardStep}>
              <ActivityIndicator size="large" color="#FFCB37" style={{ marginBottom: 16 }} />
              <Text style={styles.wizardTitle}>Opening Phone Login...</Text>
              <Text style={styles.wizardDesc}>
                Automatically navigating to the phone number screen on Bumble. Just a moment.
              </Text>
              <TouchableOpacity
                style={[styles.wizardBtn, { backgroundColor: '#2A2A35', borderWidth: 1, borderColor: '#3A3A4A' }]}
                onPress={() => setLoginStep('country_code')}
              >
                <Text style={[styles.wizardBtnText, { color: '#8E8E9F' }]}>Skip — I'll navigate manually</Text>
              </TouchableOpacity>
            </View>
          )}

          {loginStep === 'country_code' && (
            <View style={styles.wizardStep}>
              <Text style={styles.wizardTitle}>Select Country Code</Text>
              <Text style={styles.wizardDesc}>
                Enter the dialing country code for your phone number.
              </Text>
              <TextInput
                style={styles.wizardInput}
                placeholder="e.g. +91"
                placeholderTextColor="#6E6E7F"
                value={countryCode}
                onChangeText={setCountryCode}
                keyboardType="phone-pad"
              />
              <TouchableOpacity 
                style={styles.wizardBtn}
                disabled={sendingText}
                onPress={async () => {
                  if (!countryCode.trim()) return;
                  setSendingText(true);
                  try {
                    const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                    await fetch(`${orchestratorUrl}/type-text`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: countryCode, field: 'country-code' }),
                    });
                  } catch (e) {
                    console.error('Network error sending country code:', e);
                  } finally {
                    setSendingText(false);
                    setLoginStep('phone');
                  }
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

          {loginStep === 'phone' && (
            <View style={styles.wizardStep}>
              <Text style={styles.wizardTitle}>Enter Mobile Number</Text>
              <Text style={styles.wizardDesc}>
                {isBumble
                  ? 'Enter your mobile number below, then tap Send.'
                  : `Enter your mobile number to log into your ${platform} account.`}
              </Text>
              <TextInput
                style={styles.wizardInput}
                placeholder="Mobile Number"
                placeholderTextColor="#6E6E7F"
                value={inputText}
                onChangeText={setInputText}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <View style={styles.wizardBtnRow}>
                <TouchableOpacity 
                  style={[styles.wizardBtnSecondary, { marginRight: 8 }]}
                  disabled={sendingText}
                  onPress={() => {
                    setLoginStep('country_code');
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
                    
                    try {
                      const orchestratorUrl = getOrchestratorUrl(vpsUrl);
                      const response = await fetch(`${orchestratorUrl}/type-text`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: inputText, field: 'phone-number' }),
                      });
                      if (response.ok) {
                        setInputText(''); // Clear input on success
                      } else {
                        console.error('Failed to send text to virtual browser');
                      }
                    } catch (e) {
                      console.error('Network error sending text:', e);
                    }
                    
                    await handlePressEnter();
                    
                    // Wait 20 seconds to allow the page to submit, load the OTP screen, and the SMS to arrive
                    setTimeout(() => {
                      setSendingText(false);
                      setLoginStep('otp');
                    }, 20000);
                  }}
                >
                  {sendingText ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.wizardBtnText}>Send & Continue ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loginStep === 'otp' && (
            <View style={styles.wizardStep}>
              <Text style={styles.wizardTitle}>Guided Login - Step 3</Text>
              <Text style={styles.wizardDesc}>Enter the verification code (OTP) sent to your mobile device.</Text>
              <TextInput
                style={styles.wizardInput}
                placeholder="Enter OTP..."
                placeholderTextColor="#6E6E7F"
                value={inputText}
                onChangeText={setInputText}
                keyboardType="number-pad"
              />
              <View style={styles.wizardBtnRow}>
                <TouchableOpacity 
                  style={[styles.wizardBtnSecondary, { marginRight: 8 }]}
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
                    await handleSendText();
                    await handlePressEnter();
                    setLoginStep('done');
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
    flex: 0.45,
    borderBottomWidth: 1,
    borderColor: '#2A2A35',
  },
  wizardPanel: {
    flex: 0.55,
    backgroundColor: '#181820',
    padding: 20,
    justifyContent: 'center',
  },
  wizardStep: {
    width: '100%',
  },
  wizardTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  wizardDesc: {
    color: '#8E8E9F',
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  wizardInput: {
    height: 48,
    backgroundColor: '#0F0F13',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3A3A4A',
    marginBottom: 16,
  },
  wizardBtn: {
    height: 48,
    backgroundColor: '#FE3C72',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wizardBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  wizardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wizardBtnSecondary: {
    height: 48,
    paddingHorizontal: 20,
    backgroundColor: '#2A2A35',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A4A',
  },
  wizardBtnSecondaryText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FE3C7215',
    borderWidth: 1,
    borderColor: '#FE3C7240',
  },
  skipBtnText: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
