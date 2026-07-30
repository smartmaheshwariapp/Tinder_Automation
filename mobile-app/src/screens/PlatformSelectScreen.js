import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, TextInput } from 'react-native';
import { getAutoDetectedLocalIp, resolveLocalUrl } from '../utils/network';

const PLATFORMS = [
  { id: 'tinder', name: 'Tinder', color: '#FE3C72', desc: 'Auto-swiping & AI replies' },
  { id: 'bumble', name: 'Bumble', color: '#FFCB37', desc: 'Female-first automation' },
  { id: 'hinge', name: 'Hinge', color: '#1B1A1F', desc: 'Profile likes & comments' },
  { id: 'aisle', name: 'Aisle', color: '#8E2DE2', desc: 'Premium local auto-match' },
];

export default function PlatformSelectScreen({ navigation }) {
  const [appMode, setAppMode] = useState('user'); // 'user' | 'dev'
  const [env, setEnv] = useState('server'); // 'server' | 'local'

  // Settings when running on the remote VPS
  const [serverUrl, setServerUrl] = useState('https://stream.smartmaheshwari.com/?usr=User&pwd=admin');
  const [serverProxy, setServerProxy] = useState('http://*****:*****@46.203.181.164:43343');

  // Settings when running locally (Auto-detected PC LAN IP)
  const autoIp = getAutoDetectedLocalIp();
  const [localUrl, setLocalUrl] = useState(`http://${autoIp}:8080/?usr=User&pwd=admin`);
  const [localProxy, setLocalProxy] = useState('');

  // Automatically update localUrl if autoIp changes or is detected
  useEffect(() => {
    const detected = getAutoDetectedLocalIp();
    if (detected && detected !== 'localhost' && localUrl.includes('localhost')) {
      setLocalUrl(`http://${detected}:8080/?usr=User&pwd=admin`);
    }
  }, []);

  // User Mode Region Selection
  const [userRegion, setUserRegion] = useState('Israel'); // 'Israel' | 'India'

  const activeUrl = appMode === 'user' ? serverUrl : (env === 'server' ? serverUrl : localUrl);
  const activeProxy = appMode === 'user'
    ? (userRegion === 'Israel' ? 'http://*****:*****@46.203.181.164:43343' : '')
    : (env === 'server' ? serverProxy : localProxy);

  const handleSelect = (platform) => {
    const realProxy = activeProxy === 'http://*****:*****@46.203.181.164:43343'
      ? 'http://9gcULQm9X1JxWAZ:zuMSfDYAHi3zJFv@46.203.181.164:43343'
      : activeProxy;

    const resolvedUrl = resolveLocalUrl(activeUrl);

    navigation.navigate('PlatformConfig', {
      platform: platform.name,
      vpsUrl: resolvedUrl,
      proxyIp: realProxy,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FlirtEasy</Text>
          <Text style={styles.subtitle}>Virtual Browser & AI swiper control panel</Text>
        </View>


        {/* App Mode Selection */}
        <Text style={styles.sectionTitle}>App Mode</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, appMode === 'user' && styles.toggleBtnActive]}
            onPress={() => setAppMode('user')}
          >
            <Text style={[styles.toggleBtnText, appMode === 'user' && styles.toggleBtnTextActive]}>👤 User Mode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, appMode === 'dev' && styles.toggleBtnActive]}
            onPress={() => setAppMode('dev')}
          >
            <Text style={[styles.toggleBtnText, appMode === 'dev' && styles.toggleBtnTextActive]}>🛠️ Developer Mode</Text>
          </TouchableOpacity>
        </View>

        {/* Connection Settings (Developer Mode Only) */}
        {appMode === 'dev' && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>Connection Settings</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, env === 'server' && styles.toggleBtnActive]}
                onPress={() => setEnv('server')}
              >
                <Text style={[styles.toggleBtnText, env === 'server' && styles.toggleBtnTextActive]}>🌐 Server (VPS)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, env === 'local' && styles.toggleBtnActive]}
                onPress={() => setEnv('local')}
              >
                <Text style={[styles.toggleBtnText, env === 'local' && styles.toggleBtnTextActive]}>💻 Local (Dev)</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.configCard}>
              <Text style={styles.inputLabel}>Stream Server URL {env === 'local' && '(Use PC LAN IP on mobile phone)'}</Text>
              <TextInput
                style={styles.textInput}
                value={env === 'server' ? serverUrl : localUrl}
                onChangeText={env === 'server' ? setServerUrl : setLocalUrl}
                placeholder={env === 'server' ? "Production URL" : "http://192.168.x.x:8080/?usr=User&pwd=admin"}
                placeholderTextColor="#6E6E7F"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Proxy Server (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={env === 'server' ? serverProxy : localProxy}
                onChangeText={env === 'server' ? setServerProxy : setLocalProxy}
                placeholder="socks5://user:pass@host:port  or  http://host:port"
                placeholderTextColor="#6E6E7F"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {(env === 'server' ? serverProxy : localProxy) ? (
                <Text style={{ color: '#4CAF50', fontSize: 11, marginTop: 6, marginLeft: 2 }}>
                  🛡️ Chrome will open through this proxy
                </Text>
              ) : (
                <Text style={{ color: '#6E6E7F', fontSize: 11, marginTop: 6, marginLeft: 2 }}>
                  Leave blank for direct connection
                </Text>
              )}
            </View>
          </View>
        )}
        {/* Connection Region (User Mode Only) */}
        {appMode === 'user' && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>Connection Region</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, userRegion === 'Israel' && styles.toggleBtnActive]}
                onPress={() => setUserRegion('Israel')}
              >
                <Text style={[styles.toggleBtnText, userRegion === 'Israel' && styles.toggleBtnTextActive]}>🇮🇱 Israel (Proxy)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, userRegion === 'India' && styles.toggleBtnActive]}
                onPress={() => setUserRegion('India')}
              >
                <Text style={[styles.toggleBtnText, userRegion === 'India' && styles.toggleBtnTextActive]}>🇮🇳 India (Direct)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Platform Selection */}
        <Text style={styles.sectionTitle}>Select Active Platform</Text>
        <View style={styles.grid}>
          {PLATFORMS.map((platform) => (
            <TouchableOpacity
              key={platform.id}
              style={[styles.card, { borderLeftColor: platform.color }]}
              onPress={() => handleSelect(platform)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{platform.name}</Text>
                <View style={[styles.badge, { backgroundColor: platform.color + '20' }]}>
                  <Text style={[styles.badgeText, { color: platform.color }]}>Ready</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{platform.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F13',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E9F',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'column',
    gap: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#181820',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FE3C72',
  },
  toggleBtnText: {
    color: '#8E8E9F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  toggleBtnTextActive: {
    color: '#FFF',
  },
  configCard: {
    backgroundColor: '#181820',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8E8E9F',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#0F0F13',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A35',
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#181820',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderLeftWidth: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 13,
    color: '#8E8E9F',
    lineHeight: 18,
  },
});

