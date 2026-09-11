import { theme as uiTheme } from '../theme';
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
      <StatusBar barStyle="light-content" backgroundColor={uiTheme.colors.background} />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity accessibilityRole="button" style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={uiTheme.colors.text} />
          </TouchableOpacity>
          <Image source={LOGO_IMG} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle}>Flint Assistant</Text>
              <View style={styles.proTag}>
                <Text style={styles.proTagText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>Dating Assistant & Live Dashboard</Text>
          </View>
        </View>

        {vpsUrl ? (
          <TouchableOpacity accessibilityRole="button"
            style={styles.streamBtn}
            onPress={() => navigation.navigate('Browser', { vpsUrl, platform, proxyIp: '' })}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam-outline" size={14} color={uiTheme.colors.primary} />
            <Text style={styles.streamBtnText}>Live Screen</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Ready</Text>
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
        onLogout={() => navigation.navigate('PlatformSelect')}
        onConnect={vpsUrl ? () => navigation.navigate('Browser', { vpsUrl, platform, proxyIp: '' }) : undefined}
        isLoggedIn={Boolean(stats?.tinderAccount?.isLoggedIn ?? true)}
        controlsContent={
          <View style={styles.infoBox}>
            <View style={styles.infoTitleRow}>
              <Ionicons name="sparkles" size={18} color={uiTheme.colors.primary} />
              <Text style={styles.infoTitle}>Tinder Assistant Active</Text>
            </View>
            <Text style={styles.infoText}>
              Flint is actively finding compatible matches and chatting in your unique personal style.
            </Text>
            {vpsUrl && (
              <TouchableOpacity accessibilityRole="button"
                style={styles.openStreamBtn}
                onPress={() => navigation.navigate('Browser', { vpsUrl, platform, proxyIp: '' })}
                activeOpacity={0.85}
              >
                <Ionicons name="phone-portrait-outline" size={16} color="#FFF" />
                <Text style={styles.openStreamBtnText}>View Live Tinder Screen</Text>
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
    backgroundColor: uiTheme.colors.background,
  },
  header: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: uiTheme.colors.elevated,
    backgroundColor: uiTheme.colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: uiTheme.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: uiTheme.radius.small,
  },
  headerTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFF',
    fontSize: 15.5,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  proTag: {
    backgroundColor: uiTheme.colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  proTagText: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  headerSub: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginTop: 1,
  },
  streamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: uiTheme.radius.small,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  streamBtnText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: uiTheme.spacing.xs,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: uiTheme.colors.success,
  },
  liveText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.success,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  infoBox: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: uiTheme.colors.elevated,
    padding: uiTheme.spacing.lg,
    margin: 14,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.sm,
  },
  infoTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
  },
  infoText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  openStreamBtn: {
    marginTop: uiTheme.spacing.lg,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: 10,
    paddingVertical: uiTheme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
  },
  openStreamBtnText: { fontFamily: 'Inter_700Bold',
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: 'normal',
  },
});
