import React, { useRef, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Animated, Dimensions, AppState, TextInput } from 'react-native';
import { WebView } from 'react-native-webview';

export default function BrowserScreen({ route, navigation }) {
  const { platform, vpsUrl, proxyIp, extensionSettings, cloudApiUrl } = route.params;
  const webViewRef = useRef(null);
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dummyText, setDummyText] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current; // Bottom sheet initial offset
  const appState = useRef(AppState.currentState);

  const injectKeyEvent = (key) => {
    let normalizedKey = key;
    if (key === '\n') normalizedKey = 'Enter';
    
    const charCode = normalizedKey.length === 1 ? normalizedKey.charCodeAt(0) : 0;
    let keyCode = charCode;
    if (normalizedKey === 'Backspace') keyCode = 8;
    if (normalizedKey === 'Enter') keyCode = 13;

    // Inject event to active element so Neko WebRTC player captures it
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
      // User pressed backspace
      injectKeyEvent('Backspace');
    } else {
      // Get the last added character
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

  React.useEffect(() => {
    const { width, height } = Dimensions.get('window');
    const scale = Dimensions.get('window').scale;
    const pixelWidth = Math.round(width * scale);
    const pixelHeight = Math.round(height * scale);
    
    // Calculate nearest dimensions divisible by 16 for GStreamer encoder stability
    const safeNekoWidth = Math.round(width / 16) * 16;
    const safeNekoHeight = Math.round(height / 16) * 16;

    console.log(`\n======================================================`);
    console.log(`📱 DEVICE SCREEN METRICS (Use these to match Neko!):`);
    console.log(`------------------------------------------------------`);
    console.log(`- Logical Screen Size: ${width}x${height} pt`);
    console.log(`- Screen Scale / Density: ${scale}x`);
    console.log(`- Physical Resolution: ${pixelWidth}x${pixelHeight} px`);
    console.log(`- Divisible-by-16 Size (GStreamer safe): ${safeNekoWidth}x${safeNekoHeight}`);
    console.log(`- Suggested Neko config: NEKO_DESKTOP_SCREEN="${safeNekoWidth}x${safeNekoHeight}@30"`);
    console.log(`======================================================\n`);
  }, []);

  // Extract host dynamically
  let host = '127.0.0.1';
  try {
    const cleanUrl = vpsUrl.includes('://') ? vpsUrl : 'http://' + vpsUrl;
    const match = cleanUrl.match(/\/\/([^:/]+)/);
    if (match) host = match[1];
  } catch (e) {}

  const cloudApiBase = `http://${host}:3001/cloud/sessions/dev_user_1_session`;

  React.useEffect(() => {
    let activePoll = setInterval(async () => {
      try {
        const response = await fetch(cloudApiBase, {
          headers: { 'Authorization': 'Bearer dev_testing_token' }
        });
        const data = await response.json();
        if (data.success && data.state === 'active') {
          console.log('[Browser] Login detected as ACTIVE in Cloud Worker!');
          clearInterval(activePoll);

          // 1. Keep Neko running in the background as the active automation engine
          console.log('[Browser] Neko will stay active in the background.');

          // 2. Redirect user to the Native Active Dashboard (Disabled for now)
          // navigation.replace('PlatformActive', { platform, vpsUrl });
        }
      } catch (err) {
        // Silently ignore connection errors during Neko boot/login
      }
    }, 3000);

    return () => clearInterval(activePoll);
  }, [vpsUrl]);

  const toggleMenu = () => {
    if (menuOpen) {
      // Close sheet
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setMenuOpen(false));
    } else {
      // Open sheet
      setMenuOpen(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const injectConfigScript = () => {
    const settingsJson = JSON.stringify(extensionSettings || {});
    
    // CSS to force Neko player elements to fit mobile screens perfectly without scrollbars
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

    const jsCode = `
      (function() {
        try {
          // 1. Sync settings
          localStorage.setItem('flirteasy_settings_sync', '${settingsJson}');
          
          // 2. Inject mobile layout styling
          const style = document.createElement('style');
          style.id = 'flirteasy-mobile-layout';
          style.innerHTML = \`${cssCode}\`;
          document.head.appendChild(style);
          
          console.log('FlirtEasy Mobile: Synced settings and forced full-viewport scaling.');
        } catch(e) {
          console.error('FlirtEasy Mobile: Injection error', e);
        }
      })();
    `;
    webViewRef.current.injectJavaScript(jsCode);
  };

  const sendExtensionInstruction = async (action) => {
    let endpoint = '';
    let body = {};
    if (action === 'START_AUTO_SWIPE') {
      endpoint = 'start';
      body = { platform };
    } else if (action === 'STOP_AUTO_SWIPE') {
      endpoint = 'stop';
    } else if (action === 'SEND_AI_INTRO') {
      endpoint = 'run-now';
      body = { platform };
    }

    if (endpoint) {
      try {
        console.log(`[Browser] Dispatching action ${action} to cloud worker API...`);
        const res = await fetch(`http://${host}:3001/cloud/sessions/dev_user_1/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer dev_testing_token'
          },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        console.log(`[Browser] Action dispatch response:`, data);
      } catch (err) {
        console.warn(`[Browser] Action dispatch failed:`, err);
      }
    }
    toggleMenu();
  };

  const finalUrl = React.useMemo(() => {
    return `${vpsUrl}${vpsUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  }, [vpsUrl]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>✕ Close</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{platform} Session</Text>
          <Text style={styles.subtitle} numberOfLines={1}>IP: {proxyIp}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.menuBtn, { marginRight: 8, backgroundColor: '#3A3A4A15', borderColor: '#3A3A4A40' }]} 
          onPress={() => inputRef.current.focus()}
        >
          <Text style={[styles.menuBtnText, { color: '#FFF' }]}>⌨️ Keyboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuBtn} onPress={toggleMenu}>
          <Text style={styles.menuBtnText}>⚙️ Control</Text>
        </TouchableOpacity>
      </View>

      {/* WebView Container */}
      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: finalUrl }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => {
            setLoading(false);
            injectConfigScript();
          }}
          onError={() => {
            // Neko might not be ready yet — retry after 3 seconds
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

      {/* Hidden Native Input Bridge for mobile soft keyboard triggers */}
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

      {/* Extension Automation Sheet */}
      {menuOpen && (
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.overlayTap} activeOpacity={1} onPress={toggleMenu} />
          <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetKnob} />
              <Text style={styles.sheetTitle}>FlirtEasy Automation Agent</Text>
            </View>

            <View style={styles.sheetContent}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#FE3C72' }]} 
                onPress={() => sendExtensionInstruction('START_AUTO_SWIPE')}
              >
                <Text style={styles.actionBtnText}>▶ Start Auto-Swiper</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#2A2A35' }]} 
                onPress={() => sendExtensionInstruction('STOP_AUTO_SWIPE')}
              >
                <Text style={styles.actionBtnText}>⏸ Stop Auto-Swiper</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#8E2DE2' }]} 
                onPress={() => sendExtensionInstruction('SEND_AI_INTRO')}
              >
                <Text style={styles.actionBtnText}>💬 Send AI Introductions</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={toggleMenu}
              >
                <Text style={styles.cancelBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  overlayTap: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#181820',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetKnob: {
    width: 40,
    height: 4,
    backgroundColor: '#3A3A4A',
    borderRadius: 2,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  sheetContent: {
    gap: 12,
  },
  actionBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cancelBtn: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    color: '#8E8E9F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
});
