import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import SafeActivityIndicator from '../common/SafeActivityIndicator';
import { FadeIn } from '../common/Motion';
import { AppText, Badge, Card, ListRow, ScreenHeader, SectionHeader } from '../ui';
import useResponsive from '../../hooks/useResponsive';
import appConfig from '../../../app.json';

// Grouped settings row (iOS-settings style) built on ListRow. `busy` swaps the chevron for a spinner.
function SettingsRow({ icon, tone = 'primary', title, description, onPress, busy = false, divider = false }) {
  return (
    <ListRow
      icon={icon}
      iconTone={tone}
      title={title}
      subtitle={description}
      onPress={onPress}
      disabled={busy}
      divider={divider}
      chevron={!busy}
      right={busy ? <SafeActivityIndicator size="small" color={theme.colors.accent} /> : null}
      accessibilityLabel={`${title}. ${description}`}
    />
  );
}

function Section({ title, children, delay = 0 }) {
  return (
    <FadeIn delay={delay} style={styles.section}>
      <SectionHeader title={title} style={styles.sectionHeader} />
      <Card padding="none" style={styles.card}>{children}</Card>
    </FadeIn>
  );
}

export default function AppSettings({ settings, isLoggedIn, environment, unreadCount,
  updatingLocation, onRefreshLocation, onNotifications, onPreferences, onSession,
  onAutomation, onConnect, onBack }) {
  const { gutter } = useResponsive();
  const profileName = settings?.userProfile?.name;
  const openSystemSettings = async () => {
    try { await Linking.openSettings(); }
    catch { Alert.alert('Unable to open settings', 'Open your phone’s Settings app and select Flint to manage permissions.'); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: theme.layout.navHeight + theme.spacing.hero + theme.spacing.sm }]}>
      <ScreenHeader
        title="App settings"
        subtitle="Make Flint work for you."
        onBack={onBack}
        backLabel="Back to home"
      />

      <FadeIn>
        <Card style={styles.profile} accessible accessibilityLabel={`${profileName || 'Your Tinder account'}. ${isLoggedIn ? 'Tinder connected' : 'Tinder not connected'}`}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={26} color={theme.colors.accent} />
          </View>
          <View style={styles.profileCopy}>
            <AppText variant="section" numberOfLines={1} accessibilityRole="text">{profileName || 'Your Tinder account'}</AppText>
            <Badge
              label={isLoggedIn ? 'Tinder connected' : 'Tinder not connected'}
              tone={isLoggedIn ? 'success' : 'neutral'}
              dot
              style={styles.profileBadge}
            />
          </View>
        </Card>
      </FadeIn>

      <Section title="Account & session" delay={60}>
        {/* Open/Connect Tinder removed from App Settings (reachable from the Home dock and hero card).
        <SettingsRow icon="flame-outline" tone="primary" divider title={isLoggedIn ? 'Open Tinder' : 'Connect Tinder'}
          description={isLoggedIn ? 'View your connected account and live session' : 'Sign in to start using your dating assistant'} onPress={onConnect} />
        */}
        <SettingsRow icon="options-outline" tone="secondary" divider title="Session preferences"
          description="Choose how your next session runs" onPress={onSession} />
        <SettingsRow icon="sparkles-outline" tone="info" title="Dating assistant"
          description="Adjust your goals and conversation style" onPress={onAutomation} />
      </Section>

      <Section title="Location" delay={120}>
        <SettingsRow icon="locate-outline" tone="success" title={updatingLocation ? 'Updating location…' : 'Use current location'}
          description={settings?.locationCity ? `Current area: ${settings.locationCity}` : 'Find profiles near you using your device location'}
          busy={updatingLocation} onPress={onRefreshLocation} />
      </Section>

      <Section title="Notifications & permissions" delay={180}>
        <SettingsRow icon="notifications-outline" tone="warning" divider title="Notification inbox"
          description={unreadCount ? `${unreadCount} unread notifications` : 'View your matches and session updates'} onPress={onNotifications} />
        <SettingsRow icon="shield-checkmark-outline" tone="info" title="Device permissions"
          description="Manage notification and location access in phone settings" onPress={openSystemSettings} />
      </Section>

      <Section title="App & connection" delay={240}>
        <ListRow icon="moon-outline" iconTone="plus" divider title="Appearance"
          subtitle="Midnight plum · Flint’s signature dark theme"
          accessibilityLabel="Appearance. Midnight plum, Flint’s signature dark theme" />
        <SettingsRow icon="server-outline" tone="neutral" title="Advanced preferences"
          description={`Connection: ${{ on_device: 'On-device', hyperbeam: 'Cloud', vps: 'VPS', local: 'Local' }[environment] || 'Not configured'}. Manage your environment and server.`}
          onPress={onPreferences} />
      </Section>
      <AppText variant="caption" align="center" style={styles.footer}>Flint · Version {appConfig.expo.version}</AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', paddingTop: theme.spacing.sm, gap: theme.spacing.xxl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primaryBorder, justifyContent: 'center', alignItems: 'center' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileBadge: { marginTop: theme.spacing.sm },
  section: { gap: 0 },
  sectionHeader: { marginBottom: theme.spacing.sm },
  card: { overflow: 'hidden' },
  footer: { paddingVertical: theme.spacing.sm },
});
