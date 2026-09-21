import { theme as uiTheme } from '../theme';
import React from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Image,
} from 'react-native';
import useExtensionStats from '../hooks/useExtensionStats';
import useResponsive from '../hooks/useResponsive';
import { DashboardPanel } from '../components/dashboard';
import { AppText, AppButton, IconButton, IconWell, Badge, Card } from '../components/ui';
import { resolveLocalUrl } from '../utils/network';

const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');

export default function CloudDashboardScreen({ route, navigation }) {
  const { orchestratorUrl: rawOrchestratorUrl = 'https://api.smartmaheshwari.com', vpsUrl, platform = 'Tinder' } = route.params || {};
  const orchestratorUrl = resolveLocalUrl(rawOrchestratorUrl);
  const { gutter, isCompact } = useResponsive();

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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={uiTheme.colors.background} />

      {/* Header Bar */}
      <View style={styles.headerBand}>
        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
          <Image source={LOGO_IMG} style={styles.headerLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
          <View style={styles.headerCopy}>
            <View style={styles.headerTitleRow}>
              <AppText variant="headline" numberOfLines={1} style={styles.headerTitle} accessibilityRole="header">Flint Assistant</AppText>
              <Badge label="LIVE" tone="primary" size="sm" dot />
            </View>
            {!isCompact ? (
              <AppText variant="caption" numberOfLines={1}>Dating Assistant & Live Dashboard</AppText>
            ) : null}
          </View>

          {vpsUrl ? (
            <AppButton
              title={isCompact ? 'Live' : 'Live Screen'}
              icon="videocam-outline"
              variant="secondary"
              size="sm"
              fullWidth={false}
              haptic={false}
              accessibilityLabel="Open live screen"
              onPress={() => navigation.navigate('Browser', { vpsUrl, platform, proxyIp: '' })}
            />
          ) : (
            <Badge label="Ready" tone="success" dot />
          )}
        </View>
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
          <Card style={styles.infoBox}>
            <View style={styles.infoTitleRow}>
              <IconWell icon="sparkles" tone="primary" size={36} />
              <AppText variant="section" style={styles.infoTitle} numberOfLines={2}>Tinder Assistant Active</AppText>
            </View>
            <AppText variant="callout" color="textSecondary">
              Flint is actively finding compatible matches and chatting in your unique personal style.
            </AppText>
            {vpsUrl && (
              <AppButton
                title="View Live Tinder Screen"
                icon="phone-portrait-outline"
                style={styles.openStreamBtn}
                onPress={() => navigation.navigate('Browser', { vpsUrl, platform, proxyIp: '' })}
              />
            )}
          </Card>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
  },
  headerBand: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: uiTheme.colors.divider,
    backgroundColor: uiTheme.colors.surface,
  },
  header: {
    width: '100%',
    maxWidth: uiTheme.layout.contentMax,
    alignSelf: 'center',
    gap: uiTheme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: uiTheme.spacing.sm,
    minHeight: 60,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: uiTheme.radius.small,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  headerTitle: {
    flexShrink: 1,
  },
  infoBox: {
    margin: uiTheme.spacing.md,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.md,
  },
  infoTitle: {
    flex: 1,
    minWidth: 0,
  },
  openStreamBtn: {
    marginTop: uiTheme.spacing.lg,
  },
});
