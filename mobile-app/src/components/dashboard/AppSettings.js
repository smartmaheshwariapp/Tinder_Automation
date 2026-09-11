import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import SafeActivityIndicator from '../common/SafeActivityIndicator';
import appConfig from '../../../app.json';

function SettingsRow({ icon, title, description, onPress, busy = false }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={busy} activeOpacity={0.7}
      accessibilityRole="button" accessibilityLabel={`${title}. ${description}`}
      accessibilityState={{ disabled: busy, busy }}>
      <View style={styles.icon}><Ionicons name={icon} size={20} color={theme.colors.accent} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {busy ? <SafeActivityIndicator size="small" color={theme.colors.accent} /> :
        <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return <View style={styles.section}>
    <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>;
}

export default function AppSettings({ settings, isLoggedIn, environment, unreadCount,
  updatingLocation, onRefreshLocation, onNotifications, onPreferences, onSession,
  onAutomation, onConnect, onBack }) {
  const insets = useSafeAreaInsets();
  const profileName = settings?.userProfile?.name;
  const openSystemSettings = async () => {
    try { await Linking.openSettings(); }
    catch { Alert.alert('Unable to open settings', 'Open your phone’s Settings app and select Flint to manage permissions.'); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to home">
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.rowCopy}>
          <Text style={styles.title} accessibilityRole="header">App settings</Text>
          <Text style={styles.description}>Make Flint work for you.</Text>
        </View>
      </View>

      <View style={styles.profile}>
        <View style={styles.avatar}><Ionicons name="person-outline" size={26} color={theme.colors.accent} /></View>
        <View style={styles.rowCopy}>
          <Text style={styles.profileName}>{profileName || 'Your Tinder account'}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isLoggedIn ? theme.colors.success : theme.colors.muted }]} />
            <Text style={styles.description}>{isLoggedIn ? 'Tinder connected' : 'Tinder not connected'}</Text>
          </View>
        </View>
      </View>

      <Section title="Account & session">
        <SettingsRow icon="flame-outline" title={isLoggedIn ? 'Open Tinder' : 'Connect Tinder'}
          description={isLoggedIn ? 'View your connected account and live session' : 'Sign in to start using your dating assistant'} onPress={onConnect} />
        <SettingsRow icon="options-outline" title="Session preferences"
          description="Choose how your next session runs" onPress={onSession} />
        <SettingsRow icon="sparkles-outline" title="Dating assistant"
          description="Adjust your goals and conversation style" onPress={onAutomation} />
      </Section>

      <Section title="Location">
        <SettingsRow icon="locate-outline" title={updatingLocation ? 'Updating location…' : 'Use current location'}
          description={settings?.locationCity ? `Current area: ${settings.locationCity}` : 'Find profiles near you using your device location'}
          busy={updatingLocation} onPress={onRefreshLocation} />
      </Section>

      <Section title="Notifications & permissions">
        <SettingsRow icon="notifications-outline" title="Notification inbox"
          description={unreadCount ? `${unreadCount} unread notifications` : 'View your matches and session updates'} onPress={onNotifications} />
        <SettingsRow icon="shield-checkmark-outline" title="Device permissions"
          description="Manage notification and location access in phone settings" onPress={openSystemSettings} />
      </Section>

      <Section title="App & connection">
        <View style={styles.row}>
          <View style={styles.icon}><Ionicons name="moon-outline" size={20} color={theme.colors.accent} /></View>
          <View style={styles.rowCopy}><Text style={styles.rowTitle}>Appearance</Text>
            <Text style={styles.description}>Midnight plum · Flint’s signature dark theme</Text></View>
        </View>
        <SettingsRow icon="server-outline" title="Advanced preferences"
          description={`Connection: ${{ on_device: 'On-device', hyperbeam: 'Cloud', vps: 'VPS', local: 'Local' }[environment] || 'Not configured'}. Manage your environment and server.`}
          onPress={onPreferences} />
      </Section>
      <Text style={styles.footer}>Flint · Version {appConfig.expo.version}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: theme.layout.contentMax, alignSelf: 'center', padding: theme.spacing.xl, gap: theme.spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  back: { width: 44, height: 44, borderRadius: theme.radius.input, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  title: { ...theme.type.title, color: theme.colors.text },
  profile: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg, padding: theme.spacing.xl, backgroundColor: theme.colors.elevated, borderRadius: theme.radius.card },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  profileName: { ...theme.type.section, color: theme.colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4 },
  section: { gap: theme.spacing.md },
  sectionTitle: { ...theme.type.label, color: theme.colors.textSecondary, paddingHorizontal: theme.spacing.xs },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.lg, minHeight: 76 },
  icon: { width: 36, height: 36, borderRadius: theme.radius.small, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
  rowTitle: { ...theme.type.label, color: theme.colors.text },
  description: { ...theme.type.caption, color: theme.colors.muted, flexShrink: 1 },
  footer: { ...theme.type.caption, color: theme.colors.muted, textAlign: 'center' },
});
