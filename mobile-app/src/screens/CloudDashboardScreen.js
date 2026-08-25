import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useExtensionStats from '../hooks/useExtensionStats';
import { DashboardPanel } from '../components/dashboard';
import { resolveLocalUrl } from '../utils/network';

const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');

export default function CloudDashboardScreen({ route, navigation }) {
  const { orchestratorUrl: rawOrchestratorUrl = 'https://api.smartmaheshwari.com', vpsUrl, platform = 'Tinder' } = route.params || {};
  const orchestratorUrl = resolveLocalUrl(rawOrchestratorUrl);

  // Always poll live stats from the cloud VPS or local orchestrator
  const { stats, loading, error } = useExtensionStats(orchestratorUrl, true);

  // Toggle remote agent
  const handleToggleAgent = async () => {
    try {
      const isRunning = Boolean(
        stats?.agentState?.isRunning ||
        (stats?.agentState?.currentPhase && stats.agentState.currentPhase !== 'stopped')
      );
      const endpoint = isRunning ? '/stop-agent' : '/start-agent';
      await fetch(`${orchestratorUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
    } catch (_) {}
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0B14" />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#D8D6E8" />
          </TouchableOpacity>
          <Image source={LOGO_IMG} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle}>FlirtEasy Cloud</Text>
              <View style={styles.proTag}>
                <Text style={styles.proTagText}>24/7</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>Autonomous Auto-Pilot Hub</Text>
          </View>
        </View>

        {vpsUrl ? (
          <TouchableOpacity
            style={styles.streamBtn}
            onPress={() => navigation.navigate('Browser', { vpsUrl, platform, proxyIp: '' })}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam-outline" size={14} color="#FE3C72" />
            <Text style={styles.streamBtnText}>Live Feed</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Connected</Text>
          </View>
        )}
      </View>

      {/* Main Dashboard & Automation V2 Panel */}
      <DashboardPanel
        stats={stats}
        loading={loading}
        error={error}
        orchestratorUrl={orchestratorUrl}
        onToggleAgent={handleToggleAgent}
        controlsContent={
          <View style={styles.infoBox}>
            <View style={styles.infoTitleRow}>
              <Ionicons name="cloud-done-outline" size={18} color="#FE3C72" />
              <Text style={styles.infoTitle}>Cloud Auto-Pilot Session Active</Text>
            </View>
            <Text style={styles.infoText}>
              Your FlirtEasy AI Wingman is executing smart swiping algorithms, goal-oriented conversions, and 6-tone conversational messaging 24/7 in the cloud.
            </Text>
            {vpsUrl && (
              <TouchableOpacity
                style={styles.openStreamBtn}
                onPress={() => navigation.navigate('Browser', { vpsUrl, platform, proxyIp: '' })}
                activeOpacity={0.85}
              >
                <Ionicons name="desktop-outline" size={16} color="#FFF" />
                <Text style={styles.openStreamBtnText}>Open Live Virtual Browser Stream</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#26223B',
    backgroundColor: '#161424',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#26223B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  proTag: {
    backgroundColor: '#FE3C72',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  proTagText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  headerSub: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },
  streamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  streamBtnText: {
    color: '#FE3C72',
    fontSize: 12,
    fontWeight: '700',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: '#161424',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#26223B',
    padding: 16,
    margin: 14,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  infoText: {
    color: '#9E9DB5',
    fontSize: 12.5,
    lineHeight: 18,
  },
  openStreamBtn: {
    marginTop: 16,
    backgroundColor: '#FE3C72',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openStreamBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
