import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAutoDetectedLocalIp, resolveLocalUrl } from '../utils/network';

// Official FlirtEasy Brand Assets
const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const TINDER_IMG = require('../../assets/flirteasy/tinder.jpg');
const BUMBLE_IMG = require('../../assets/flirteasy/bumble.png');

export default function PlatformSelectScreen({ navigation }) {
  const [environment, setEnvironment] = useState('vps'); // 'vps' | 'local'
  const [userRegion, setUserRegion] = useState('israel'); // 'israel' | 'direct'
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Connection endpoints
  const [vpsUrl, setVpsUrl] = useState('https://stream.smartmaheshwari.com/?usr=User&pwd=admin');
  const [vpsProxy, setVpsProxy] = useState('http://*****:*****@46.203.181.164:43343');

  const autoIp = getAutoDetectedLocalIp();
  const [localUrl, setLocalUrl] = useState(`http://${autoIp}:8080/?usr=User&pwd=admin`);
  const [localProxy, setLocalProxy] = useState('');

  useEffect(() => {
    const detected = getAutoDetectedLocalIp();
    if (detected && detected !== 'localhost' && localUrl.includes('localhost')) {
      setLocalUrl(`http://${detected}:8080/?usr=User&pwd=admin`);
    }
  }, []);

  const activeStreamUrl = environment === 'vps' ? vpsUrl : localUrl;
  const activeProxy = environment === 'vps'
    ? (userRegion === 'israel' ? 'http://*****:*****@46.203.181.164:43343' : '')
    : localProxy;

  const handleLaunch = (platformName) => {
    const realProxy = activeProxy === 'http://*****:*****@46.203.181.164:43343'
      ? 'http://9gcULQm9X1JxWAZ:zuMSfDYAHi3zJFv@46.203.181.164:43343'
      : activeProxy;

    const resolvedUrl = resolveLocalUrl(activeStreamUrl);

    navigation.navigate('PlatformConfig', {
      platform: platformName,
      vpsUrl: resolvedUrl,
      proxyIp: realProxy,
    });
  };

  const handleOpenCloudHub = () => {
    const apiHost = environment === 'vps'
      ? 'https://api.smartmaheshwari.com'
      : resolveLocalUrl('http://localhost:3001');

    navigation.navigate('CloudDashboard', {
      orchestratorUrl: apiHost,
      vpsUrl: resolveLocalUrl(activeStreamUrl),
      platform: 'Tinder',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0B14" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ─── Smart Brand Header ─── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={LOGO_IMG} style={styles.officialLogo} resizeMode="contain" />
            <View>
              <View style={styles.brandTitleRow}>
                <Text style={styles.brandTitle}>FlirtEasy</Text>
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>V2 PRO</Text>
                </View>
              </View>
              <Text style={styles.brandSubtitle}>AI Dating Wingman & Automation</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.headerSettingsBtn}
            onPress={handleOpenCloudHub}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={18} color="#FE3C72" />
          </TouchableOpacity>
        </View>

        {/* ─── 24/7 Cloud Auto-Pilot Live Hub ─── */}
        <TouchableOpacity
          style={styles.cloudHubCard}
          onPress={handleOpenCloudHub}
          activeOpacity={0.85}
        >
          <View style={styles.cloudHubTop}>
            <View style={styles.cloudStatusWrap}>
              <View style={styles.liveDot} />
              <View>
                <Text style={styles.cloudTitle}>24/7 Cloud Auto-Pilot</Text>
                <Text style={styles.cloudSub}>Continuous autonomous background operation</Text>
              </View>
            </View>
            <View style={styles.cloudActionPill}>
              <Text style={styles.cloudActionText}>Control Center</Text>
              <Ionicons name="chevron-forward" size={14} color="#FE3C72" />
            </View>
          </View>

          <View style={styles.cloudMetricsRow}>
            <View style={styles.metricItem}>
              <Ionicons name="flash" size={12} color="#FE3C72" />
              <Text style={styles.metricLabel}>Smart Swiping 2.0</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="chatbubbles" size={12} color="#FE3C72" />
              <Text style={styles.metricLabel}>6-Tone Engine</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Ionicons name="shield-checkmark" size={12} color="#10B981" />
              <Text style={styles.metricLabel}>Anti-Ban Shield</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* ─── Platform Launch Cards ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Active Platform</Text>
          <Text style={styles.sectionDesc}>Launch automated virtual browser session</Text>
        </View>

        <View style={styles.platformList}>
          {/* Tinder */}
          <TouchableOpacity
            style={[styles.platformCard, styles.tinderBorder]}
            onPress={() => handleLaunch('Tinder')}
            activeOpacity={0.85}
          >
            <View style={styles.platformBody}>
              <View style={styles.platformTopRow}>
                <Image source={TINDER_IMG} style={styles.platformLogo} />
                <View style={styles.platformInfo}>
                  <View style={styles.platformNameRow}>
                    <Text style={styles.platformName}>Tinder</Text>
                    <View style={styles.readyBadgeTinder}>
                      <Text style={styles.readyBadgeTextTinder}>Verified Ready</Text>
                    </View>
                  </View>
                  <Text style={styles.platformSub}>
                    Smart Swiping, goal-oriented conversions & conversational replies
                  </Text>
                </View>
              </View>

              <View style={styles.tagsContainer}>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>Smart Filters</Text>
                </View>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>Move Off-App</Text>
                </View>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>Auto Follow-Ups</Text>
                </View>
              </View>

              <View style={styles.platformActionRow}>
                <Text style={styles.sessionType}>Direct Cloud Container</Text>
                <View style={[styles.launchBtn, { backgroundColor: '#FE3C72' }]}>
                  <Text style={styles.launchBtnText}>Launch Session</Text>
                  <Ionicons name="arrow-forward" size={13} color="#FFF" />
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Bumble */}
          <TouchableOpacity
            style={[styles.platformCard, styles.bumbleBorder]}
            onPress={() => handleLaunch('Bumble')}
            activeOpacity={0.85}
          >
            <View style={styles.platformBody}>
              <View style={styles.platformTopRow}>
                <Image source={BUMBLE_IMG} style={styles.platformLogo} />
                <View style={styles.platformInfo}>
                  <View style={styles.platformNameRow}>
                    <Text style={styles.platformName}>Bumble</Text>
                    <View style={styles.readyBadgeBumble}>
                      <Text style={styles.readyBadgeTextBumble}>Verified Ready</Text>
                    </View>
                  </View>
                  <Text style={styles.platformSub}>
                    Female-first engagement, opening moves & smart matchmaking
                  </Text>
                </View>
              </View>

              <View style={styles.tagsContainer}>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>Opening Moves</Text>
                </View>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>Instant Reply</Text>
                </View>
                <View style={styles.featureTag}>
                  <Text style={styles.featureTagText}>Safe Limits</Text>
                </View>
              </View>

              <View style={styles.platformActionRow}>
                <Text style={styles.sessionType}>Direct Cloud Container</Text>
                <View style={[styles.launchBtn, { backgroundColor: '#FFB800' }]}>
                  <Text style={[styles.launchBtnText, { color: '#000' }]}>Launch Session</Text>
                  <Ionicons name="arrow-forward" size={13} color="#000" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ─── Environment & Routing Settings ─── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Routing & Environment</Text>
            <TouchableOpacity onPress={() => setShowAdvanced(!showAdvanced)}>
              <Text style={styles.advancedToggle}>
                {showAdvanced ? 'Hide Config' : 'Configure Ports'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.envSelector}>
          <TouchableOpacity
            style={[styles.envOption, environment === 'vps' && styles.envOptionActive]}
            onPress={() => setEnvironment('vps')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cloud-done-outline"
              size={15}
              color={environment === 'vps' ? '#FFF' : '#716E89'}
            />
            <Text style={[styles.envOptionText, environment === 'vps' && styles.envOptionTextActive]}>
              Cloud Server (VPS)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.envOption, environment === 'local' && styles.envOptionActive]}
            onPress={() => setEnvironment('local')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="laptop-outline"
              size={15}
              color={environment === 'local' ? '#FFF' : '#716E89'}
            />
            <Text style={[styles.envOptionText, environment === 'local' && styles.envOptionTextActive]}>
              Local Machine
            </Text>
          </TouchableOpacity>
        </View>

        {environment === 'vps' && (
          <View style={styles.regionCardRow}>
            <TouchableOpacity
              style={[styles.regionPill, userRegion === 'israel' && styles.regionPillActive]}
              onPress={() => setUserRegion('israel')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={userRegion === 'israel' ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={userRegion === 'israel' ? '#FE3C72' : '#716E89'}
              />
              <Text style={[styles.regionPillText, userRegion === 'israel' && styles.regionPillTextActive]}>
                Israel Proxy (Tel Aviv)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.regionPill, userRegion === 'direct' && styles.regionPillActive]}
              onPress={() => setUserRegion('direct')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={userRegion === 'direct' ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={userRegion === 'direct' ? '#FE3C72' : '#716E89'}
              />
              <Text style={[styles.regionPillText, userRegion === 'direct' && styles.regionPillTextActive]}>
                Direct VPS Connection
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showAdvanced && (
          <View style={styles.advancedDrawer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Stream Server URL</Text>
              <TextInput
                style={styles.textInput}
                value={environment === 'vps' ? vpsUrl : localUrl}
                onChangeText={environment === 'vps' ? setVpsUrl : setLocalUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#55526B"
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <Text style={styles.inputLabel}>Proxy Endpoint (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={environment === 'vps' ? vpsProxy : localProxy}
                onChangeText={environment === 'vps' ? setVpsProxy : setLocalProxy}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#55526B"
                placeholder="socks5://user:pass@host:port"
              />
            </View>
          </View>
        )}

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>FlirtEasy Engine v2.4 PRO</Text>
          <Text style={styles.footerSub}>Secure Virtual Container Orchestration</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B14',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  officialLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.4,
  },
  proBadge: {
    backgroundColor: '#FE3C72',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  proBadgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#8E8DA3',
    marginTop: 1,
    fontWeight: '500',
  },
  headerSettingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(254, 60, 114, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Cloud Hub ───
  cloudHubCard: {
    backgroundColor: '#161424',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.35)',
    padding: 16,
    marginBottom: 24,
  },
  cloudHubTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cloudStatusWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 5,
  },
  cloudTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cloudSub: {
    color: '#8E8DA3',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  cloudActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  cloudActionText: {
    color: '#FE3C72',
    fontSize: 11,
    fontWeight: '700',
  },
  cloudMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1C192E',
    borderRadius: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    color: '#D8D6E8',
    fontSize: 11,
    fontWeight: '600',
  },
  metricDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#2D2944',
  },

  // ─── Section Header ───
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  sectionDesc: {
    fontSize: 11.5,
    color: '#716E89',
    marginTop: 1,
  },
  advancedToggle: {
    fontSize: 11.5,
    color: '#FE3C72',
    fontWeight: '700',
  },

  // ─── Platform Cards ───
  platformList: {
    gap: 14,
    marginBottom: 24,
  },
  platformCard: {
    backgroundColor: '#161424',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tinderBorder: {
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  bumbleBorder: {
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  platformBody: {
    padding: 16,
  },
  platformTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  platformLogo: {
    width: 42,
    height: 42,
    borderRadius: 11,
  },
  platformInfo: {
    flex: 1,
  },
  platformNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  platformName: {
    color: '#FFF',
    fontSize: 16.5,
    fontWeight: '800',
  },
  platformSub: {
    color: '#8E8DA3',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  readyBadgeTinder: {
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  readyBadgeTextTinder: {
    color: '#FE3C72',
    fontSize: 10,
    fontWeight: '800',
  },
  readyBadgeBumble: {
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  readyBadgeTextBumble: {
    color: '#FFB800',
    fontSize: 10,
    fontWeight: '800',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  featureTag: {
    backgroundColor: '#1C192E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  featureTagText: {
    color: '#C7C5D9',
    fontSize: 10.5,
    fontWeight: '600',
  },
  platformActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#221E33',
    paddingTop: 12,
  },
  sessionType: {
    color: '#716E89',
    fontSize: 11,
    fontWeight: '500',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 8,
  },
  launchBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // ─── Environment Selector ───
  envSelector: {
    flexDirection: 'row',
    backgroundColor: '#161424',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#26223B',
    marginBottom: 10,
  },
  envOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  envOptionActive: {
    backgroundColor: '#26223B',
  },
  envOptionText: {
    color: '#716E89',
    fontSize: 12,
    fontWeight: '600',
  },
  envOptionTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  regionCardRow: {
    gap: 8,
    marginBottom: 14,
  },
  regionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161424',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  regionPillActive: {
    borderColor: 'rgba(254, 60, 114, 0.4)',
    backgroundColor: 'rgba(254, 60, 114, 0.05)',
  },
  regionPillText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '500',
  },
  regionPillTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  advancedDrawer: {
    backgroundColor: '#161424',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 12,
    marginBottom: 14,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    color: '#8E8DA3',
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#0D0B14',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26223B',
    color: '#FFF',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  // ─── Footer ───
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingBottom: 10,
  },
  footerText: {
    color: '#55526B',
    fontSize: 11,
    fontWeight: '600',
  },
  footerSub: {
    color: '#3F3D52',
    fontSize: 10,
    marginTop: 2,
  },
});
