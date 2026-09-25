import React, { useState } from "react";
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  createStyles,
  theme,
  alpha,
  getActiveTheme,
  THEME_OPTIONS,
} from "../../theme";
import ThemePickerSheet from "./ThemePickerSheet";
import SafeActivityIndicator from "../common/SafeActivityIndicator";
import { FadeIn } from "../common/Motion";
import {
  AppText,
  Badge,
  BottomSheet,
  Card,
  ListRow,
  LiveDot,
  ScreenHeader,
  SectionHeader,
} from "../ui";
import LegalDocument from "../legal/LegalDocument";
import useResponsive from "../../hooks/useResponsive";
import appConfig from "../../../app.json";
import policies from "../../legal/policies.json";
import { SUPPORT_EMAIL, SUPPORT_SUBJECT } from "../../config/contact";

// Grouped settings row (iOS-settings style) built on ListRow. `busy` swaps the chevron for a spinner.
function SettingsRow({
  icon,
  tone = "primary",
  title,
  description,
  onPress,
  busy = false,
  divider = false,
}) {
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
      right={
        busy ? (
          <SafeActivityIndicator size="small" color={theme.colors.accent} />
        ) : null
      }
      accessibilityLabel={`${title}. ${description}`}
    />
  );
}

function Section({ title, children, delay = 0, style }) {
  return (
    <FadeIn delay={delay} style={[styles.section, style]}>
      <SectionHeader title={title} style={styles.sectionHeader} />
      <Card padding="none" style={styles.card}>
        {children}
      </Card>
    </FadeIn>
  );
}

export default function AppSettings({
  settings,
  isLoggedIn,
  environment,
  unreadCount,
  updatingLocation,
  onRefreshLocation,
  onNotifications,
  onPreferences,
  onSession,
  onAutomation,
  onConnect,
  onBack,
  onDeleteAccount,
}) {
  const { gutter, contentMax, isTablet } = useResponsive();
  const [showThemes, setShowThemes] = useState(false);
  // 'privacy' | 'terms' | 'about' | null — which information sheet is open.
  const [sheet, setSheet] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const appName = appConfig.expo.name;
  const appVersion = appConfig.expo.version;

  const openSupportMail = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "No email app found",
        `Write to us at ${SUPPORT_EMAIL} and we will get back to you.`,
      );
    }
  };
  const [legalDocument, setLegalDocument] = useState(null);
  const activeTheme =
    THEME_OPTIONS.find((option) => option.id === getActiveTheme()) ||
    THEME_OPTIONS[0];
  const profileName = settings?.userProfile?.name;
  // Tinder account details for the connection card (display only).
  const [failedPhoto, setFailedPhoto] = useState(null);
  const firstPhoto = settings?.userProfile?.photos?.[0];
  const photoUri =
    typeof firstPhoto === "string"
      ? firstPhoto
      : firstPhoto?.url || firstPhoto?.processedFiles?.[0]?.url || null;
  const PLANS = {
    platinum: {
      label: "Platinum",
      icon: "diamond",
      color: theme.colors.platinum,
    },
    gold: { label: "Gold", icon: "star", color: theme.colors.gold },
    plus: { label: "Plus", icon: "flash", color: theme.colors.plus },
  };
  const plan = PLANS[settings?.userProfile?.tinderPlan] || {
    label: "Free",
    icon: "heart-outline",
    color: theme.colors.textSecondary,
  };
  const openSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Unable to open settings",
        "Open your phone’s Settings app and select FlirtEasy to manage permissions.",
      );
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: gutter,
          maxWidth: contentMax,
          paddingBottom:
            theme.layout.navHeight + theme.spacing.hero + theme.spacing.sm,
        },
      ]}
    >
      <ScreenHeader
        title="App settings"
        subtitle="Make FlirtEasy work for you."
        onBack={onBack}
        backLabel="Back to home"
      />

      <FadeIn>
        <View
          style={[styles.account, isLoggedIn && styles.accountLive]}
          accessible
          accessibilityLabel={`${profileName || "Your Tinder account"}. ${isLoggedIn ? "Connected to Tinder" : "Not connected to Tinder"}`}
        >
          <LinearGradient
            colors={theme.gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.accountTop}>
            <View>
              <LinearGradient
                colors={
                  isLoggedIn
                    ? theme.gradients.brand
                    : [theme.colors.border, theme.colors.divider]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.accountRing}
              >
                <View style={styles.accountAvatar}>
                  {photoUri && failedPhoto !== photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={styles.accountPhoto}
                      onError={() => setFailedPhoto(photoUri)}
                      accessibilityIgnoresInvertColors
                    />
                  ) : profileName ? (
                    <Text
                      style={styles.accountInitial}
                      maxFontSizeMultiplier={theme.fontScale.chrome}
                    >
                      {profileName.slice(0, 1).toUpperCase()}
                    </Text>
                  ) : (
                    <Ionicons
                      name="person"
                      size={24}
                      color={theme.colors.textSecondary}
                    />
                  )}
                </View>
              </LinearGradient>
              <LinearGradient
                colors={theme.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.accountFlame}
              >
                <Ionicons
                  name="flame"
                  size={11}
                  color={theme.colors.onPrimary}
                />
              </LinearGradient>
            </View>
            <View style={styles.accountCopy}>
              <AppText variant="section" numberOfLines={1}>
                {profileName || "Your Tinder account"}
              </AppText>
              <View style={styles.accountStatus}>
                <LiveDot
                  size={8}
                  active={isLoggedIn}
                  color={
                    isLoggedIn
                      ? theme.colors.success
                      : theme.colors.textTertiary
                  }
                />
                <AppText
                  variant="footnote"
                  color={isLoggedIn ? "success" : "muted"}
                  numberOfLines={1}
                >
                  {isLoggedIn
                    ? "Connected to Tinder"
                    : "Not connected to Tinder"}
                </AppText>
              </View>
            </View>
          </View>

          {/* Status / Plan / Area strip (commented out).
          <View style={styles.accountInfo}>
            {[
              { label: 'STATUS', value: isLoggedIn ? 'Live' : 'Offline', icon: isLoggedIn ? 'radio' : 'cloud-offline-outline', color: isLoggedIn ? theme.colors.success : theme.colors.muted },
              { label: 'PLAN', value: plan.label, icon: plan.icon, color: plan.color },
              { label: 'AREA', value: settings?.locationCity || 'Not set', icon: 'location-outline', color: theme.colors.textSecondary },
            ].map((cell, index) => (
              <React.Fragment key={cell.label}>
                {index > 0 ? <View style={styles.accountDivider} /> : null}
                <View style={styles.accountCell}>
                  <Text style={styles.accountCellLabel} maxFontSizeMultiplier={theme.fontScale.chrome}>{cell.label}</Text>
                  <View style={styles.accountCellRow}>
                    <Ionicons name={cell.icon} size={12} color={cell.color} />
                    <Text style={[styles.accountCellValue, { color: cell.color === theme.colors.textSecondary ? theme.colors.text : cell.color }]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{cell.value}</Text>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
          */}
        </View>
        {/* Previous profile card (commented out).
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
        */}
      </FadeIn>

      {/* Settings groups: one column on phones, two across once there is room. */}
      <View style={[styles.sections, isTablet && styles.sectionsRow]}>
        <Section
          title="Account & session"
          delay={60}
          style={isTablet && styles.sectionColumn}
        >
          {/* Open/Connect Tinder removed from App Settings (reachable from the Home dock and hero card).
        <SettingsRow icon="flame-outline" tone="primary" divider title={isLoggedIn ? 'Open Tinder' : 'Connect Tinder'}
          description={isLoggedIn ? 'View your connected account and live session' : 'Sign in to start using your dating assistant'} onPress={onConnect} />
        */}
          <SettingsRow
            icon="options-outline"
            tone="secondary"
            title="Session preferences"
            description="Choose how your next session runs"
            onPress={onSession}
          />
          {/* Dating assistant option (commented out).
        <SettingsRow icon="sparkles-outline" tone="info" title="Dating assistant"
          description="Adjust your goals and conversation style" onPress={onAutomation} />
        */}
        </Section>

        {/* Location section with the "Use current location" option (commented out).
      <Section title="Location" delay={120}>
        <SettingsRow icon="locate-outline" tone="success" title={updatingLocation ? 'Updating location…' : 'Use current location'}
          description={settings?.locationCity ? `Current area: ${settings.locationCity}` : 'Find profiles near you using your device location'}
          busy={updatingLocation} onPress={onRefreshLocation} />
      </Section>
      */}

        <Section
          title="Notifications & permissions"
          delay={180}
          style={isTablet && styles.sectionColumn}
        >
          <SettingsRow
            icon="notifications-outline"
            tone="warning"
            divider
            title="Notification inbox"
            description={
              unreadCount
                ? `${unreadCount} unread notifications`
                : "View your matches and session updates"
            }
            onPress={onNotifications}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            tone="info"
            title="Device permissions"
            description="Manage notification and location access in phone settings"
            onPress={openSystemSettings}
          />
        </Section>

        <Section
          title="App & connection"
          delay={240}
          style={isTablet && styles.sectionColumn}
        >
          <ListRow
            icon="color-palette-outline"
            iconTone="plus"
            divider
            title="Appearance"
            subtitle={`${activeTheme.name} · Tap to change theme`}
            onPress={() => setShowThemes(true)}
            accessibilityLabel={`Appearance. Current theme ${activeTheme.name}`}
            accessibilityHint="Opens the theme picker"
          />
          <SettingsRow
            icon="server-outline"
            tone="neutral"
            title="Advanced preferences"
            description={`Connection: ${{ on_device: "On-device", hyperbeam: "Cloud", vps: "VPS", local: "Local" }[environment] || "Not configured"}. Manage your environment and server.`}
            onPress={onPreferences}
          />
        </Section>
        <Section
          title="Legal"
          delay={300}
          style={isTablet && styles.sectionColumn}
        >
          <SettingsRow
            icon="document-text-outline"
            tone="neutral"
            divider
            title="Terms and Conditions"
            description="How the dating assistant and automation work"
            onPress={() => setLegalDocument("terms")}
          />
          <SettingsRow
            icon="lock-closed-outline"
            tone="neutral"
            title="Privacy Policy"
            description="What stays on your device and what is shared"
            onPress={() => setLegalDocument("privacy")}
          />
        </Section>
      </View>
      <AppText variant="caption" align="center" style={styles.footer}>
        {appName} · Version {appVersion}
      </AppText>
      <ThemePickerSheet
        visible={showThemes}
        onClose={() => setShowThemes(false)}
      />
      <BottomSheet
        visible={!!legalDocument}
        onClose={() => setLegalDocument(null)}
        title={
          legalDocument === "privacy"
            ? "Privacy Policy"
            : "Terms and Conditions"
        }
        subtitle="Legal information"
        maxHeightRatio={0.9}
        closeLabel="Close legal document"
      >
        <LegalDocument type={legalDocument || "terms"} />
      </BottomSheet>
    </ScrollView>
  );
}

const styles = createStyles(() => ({
  // Phone baseline; the screen overrides maxWidth with useResponsive().contentMax.
  content: {
    width: "100%",
    maxWidth: theme.layout.readableMax,
    alignSelf: "center",
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.xxl,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  account: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    ...theme.shadows.md,
  },
  accountLive: { borderColor: theme.colors.successBorder },
  accountTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  accountRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5 },
  accountAvatar: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: theme.colors.surface,
    backgroundColor: theme.colors.elevated,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  accountPhoto: { width: "100%", height: "100%" },
  accountInitial: { ...theme.type.title2, color: theme.colors.text },
  accountFlame: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  accountCopy: { flex: 1, minWidth: 0, gap: 4 },
  accountStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: alpha(theme.colors.background, 0.5),
    borderWidth: 1,
    borderColor: theme.colors.hairline,
  },
  accountCell: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: theme.spacing.xs,
  },
  accountDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: theme.colors.divider,
  },
  accountCellLabel: {
    ...theme.type.overline,
    fontSize: 10,
    color: theme.colors.muted,
  },
  accountCellRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  accountCellValue: {
    ...theme.type.subhead,
    fontFamily: theme.fonts.label,
    flexShrink: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  profileCopy: { flex: 1, minWidth: 0 },
  profileBadge: { marginTop: theme.spacing.sm },
  section: { gap: 0 },
  sections: { gap: theme.spacing.xxl },
  sectionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  sectionColumn: { flexGrow: 1, flexBasis: 300, minWidth: 280 },
  sectionHeader: { marginBottom: theme.spacing.sm },
  card: { overflow: "hidden" },
  footer: { paddingVertical: theme.spacing.sm },
  about: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  aboutMeta: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
}));
