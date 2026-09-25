import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { createStyles, theme, alpha } from "../../theme";
import AppConfirmModal from "../common/AppConfirmModal";
import { FadeIn, FocusInput, MotionTouchable } from "../common/Motion";
import {
  AppButton,
  AppText,
  Badge,
  CountUp,
  IconButton,
  SectionHeader,
} from "../ui";
import useResponsive from "../../hooks/useResponsive";
import TinderProfileCard from "./TinderProfileCard";
import appConfig from "../../../app.json";

const c = theme.colors;
const sp = theme.spacing;

const tinderFields = [
  ["bio", "About me on Tinder"],
  ["age", "Age"],
  ["interests", "Interests & Passions"],
  ["height", "Height"],
  ["lookingFor", "Looking for"],
  ["relationshipType", "Relationship type"],
  ["languages", "Languages"],
  ["gender", "Gender"],
  ["zodiac", "Zodiac"],
  ["drinking", "Drinking"],
  ["smoking", "Smoking"],
  ["workout", "Workout"],
  ["pets", "Pets"],
  ["communicationStyle", "Communication style"],
  ["loveStyle", "Love style"],
];

const display = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item : item?.name))
        .filter(Boolean)
        .join(", ")
    : typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";

function Stat({ icon, label, value, color }) {
  const formatted = Number.isFinite(Number(value))
    ? Number(value).toLocaleString()
    : String(value);
  return (
    <View
      style={styles.stat}
      accessible
      accessibilityLabel={`${formatted} ${label.toLowerCase()}`}
    >
      <CountUp
        value={Number.isFinite(Number(value)) ? Number(value) : formatted}
        style={styles.statValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={theme.fontScale.chrome}
        importantForAccessibility="no"
      />
      <View style={styles.statLabelRow}>
        <Ionicons name={icon} size={13} color={color} />
        <Text
          style={styles.statLabel}
          numberOfLines={1}
          maxFontSizeMultiplier={theme.fontScale.chrome}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileDetails({
  settings,
  user,
  isLoggedIn,
  stats,
  onBack,
  onOpenTinder,
  onSync,
  onSave,
  onLogout,
}) {
  const { gutter, contentMax, formMax, isTablet } = useResponsive();

  // ── 1. Isolated Flint App User Profile ──
  const flintName = (
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    settings?.accountProfile?.name ||
    "Flirteasy Member"
  ).trim();

  const flintEmail = (
    user?.email ||
    settings?.accountProfile?.email ||
    "Your Flirteasy account"
  ).trim();

  const flintInitial = (flintName || "F").slice(0, 1).toUpperCase();

  // ── 2. Isolated Tinder Session & Profile ──
  const tinderProfile = settings?.userProfile || {};
  const tinderName =
    tinderProfile?.name || (isLoggedIn ? "Connected User" : null);
  const tinderPhoto =
    typeof tinderProfile.photos?.[0] === "string"
      ? tinderProfile.photos[0]
      : tinderProfile.photos?.[0]?.url;
  const tinderPlan = tinderProfile?.tinderPlan || "free";
  const likesRemaining = tinderProfile?.likesRemaining;

  // ── UI States ──
  const [editing, setEditing] = useState(false);
  const [personalName, setPersonalName] = useState(flintName);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  // ── Lifetime Stats from Flint Agent State ──
  const agentStats = stats?.agentState?.stats || stats?.stats || {};
  const lifetime = stats?.lifetimeStats || {};
  const totalSwipes =
    lifetime.totalLikes ??
    lifetime.totalSwipes ??
    agentStats.swipes ??
    agentStats.totalLikes ??
    0;
  const totalMatches =
    lifetime.matchesCreated ??
    lifetime.totalMatches ??
    agentStats.matches ??
    agentStats.matchesCreated ??
    0;
  const totalMessages =
    lifetime.messagesSent ??
    lifetime.totalMessages ??
    agentStats.messages ??
    agentStats.messagesSent ??
    0;

  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    icon: "log-out-outline",
    iconColor: c.warning,
    iconBg: c.warningSoft,
    iconBorder: c.warningBorder,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    confirmVariant: "warning",
    onConfirm: null,
  });

  const closeConfirmModal = () => {
    setConfirmModal((prev) => ({ ...prev, visible: false }));
  };

  const openEditor = () => {
    setPersonalName(flintName);
    setError("");
    setEditing(true);
  };

  const closeEditor = () => {
    if (saving) return;
    if (personalName.trim() !== flintName) {
      setConfirmModal({
        visible: true,
        icon: "alert-circle-outline",
        iconColor: c.accent,
        iconBg: c.primarySoft,
        iconBorder: c.primaryBorder,
        title: "Discard changes?",
        message: "Your unsaved name change will be lost.",
        confirmText: "Discard",
        cancelText: "Keep editing",
        confirmVariant: "destructive",
        onConfirm: () => {
          closeConfirmModal();
          setEditing(false);
        },
      });
    } else {
      setEditing(false);
    }
  };

  const save = async () => {
    const trimmed = personalName.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await onSave({
        accountProfile: {
          ...settings?.accountProfile,
          name: trimmed,
        },
      });
      if (result === false) throw new Error();
      setEditing(false);
      setFeedback("Profile updated.");
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setFeedback("");
    try {
      const result = await onSync();
      setFeedback(
        result?.success
          ? "Tinder profile updated."
          : "Could not update Tinder details. Open Tinder and check your connection.",
      );
    } catch {
      setFeedback("Could not update Tinder details. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const confirmLogout = () => {
    setConfirmModal({
      visible: true,
      icon: "log-out-outline",
      iconColor: c.accent,
      iconBg: c.primarySoft,
      iconBorder: c.primaryBorder,
      title: "Log out of Flirteasy?",
      message:
        "This will disconnect your Tinder session and return you to the login screen.",
      detail: { title: flintName, subtitle: flintEmail, initial: flintInitial },
      confirmText: "Log out",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: () => {
        closeConfirmModal();
        onLogout();
      },
    });
  };

  const confirmDeleteData = () => {
    setConfirmModal({
      visible: true,
      icon: "trash-outline",
      iconColor: c.error,
      iconBg: c.errorSoft,
      iconBorder: c.errorBorder,
      title: "Clear data on this device?",
      message:
        "This signs you out and clears local app data. It does not delete cloud records or your connected dating account. See the Privacy Policy for how to request cloud-data deletion.",
      confirmText: "Clear Device Data",
      cancelText: "Cancel",
      confirmVariant: "destructive",
      onConfirm: () => {
        closeConfirmModal();
        onDeleteData();
      },
    });
  };

  const feedbackIsError = /could not/i.test(feedback);

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: gutter,
            maxWidth: contentMax,
            paddingBottom: theme.layout.navHeight + sp.hero + sp.sm,
          },
        ]}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <IconButton
            icon="chevron-back"
            variant="plain"
            iconSize={26}
            onPress={onBack}
            accessibilityLabel="Back to home"
            style={styles.backButton}
          />
          <AppText
            variant="headline"
            accessibilityRole="header"
            style={styles.topTitle}
          >
            Profile
          </AppText>
          <IconButton
            icon="create-outline"
            onPress={openEditor}
            accessibilityLabel="Edit profile"
            size={40}
            iconSize={19}
            style={styles.roundButton}
          />
        </View>

        {/* ── 1. Identity: cover banner with overlapping avatar ── */}
        <FadeIn style={styles.identity}>
          <LinearGradient
            colors={[
              alpha(c.primary, 0.55),
              alpha(c.accent, 0.35),
              alpha(c.secondary, 0.25),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[alpha(c.background, 0), alpha(c.surface, 0.9)]}
              start={{ x: 0.5, y: 0.2 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons
              name="flame"
              size={120}
              color={alpha(c.white, 0.07)}
              style={styles.coverMark}
            />
          </LinearGradient>

          <MotionTouchable
            onPress={openEditor}
            pressScale={0.95}
            accessibilityRole="button"
            accessibilityLabel={`${flintName}. Edit profile`}
            style={styles.avatarWrap}
          >
            <LinearGradient
              colors={theme.gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatar}>
                <Text
                  style={styles.initial}
                  maxFontSizeMultiplier={theme.fontScale.chrome}
                >
                  {flintInitial}
                </Text>
              </View>
            </LinearGradient>
            <View style={styles.avatarEdit}>
              <Ionicons name="pencil" size={13} color={c.onPrimary} />
            </View>
          </MotionTouchable>

          <View style={styles.identityCopy}>
            <AppText variant="title" align="center" numberOfLines={2}>
              {flintName}
            </AppText>
            <AppText
              variant="callout"
              color="muted"
              align="center"
              numberOfLines={1}
            >
              {flintEmail}
            </AppText>
            <Badge
              label={isLoggedIn ? "Tinder connected" : "Tinder not connected"}
              tone={isLoggedIn ? "success" : "neutral"}
              dot
              style={styles.connectionBadge}
            />
          </View>

          {/* ── 2. Lifetime stats ── */}
          <View style={styles.statsRow}>
            <Stat
              icon="heart"
              label="Swipes"
              value={totalSwipes}
              color={c.accent}
            />
            <View style={styles.statDivider} />
            <Stat
              icon="people"
              label="Matches"
              value={totalMatches}
              color={c.secondary}
            />
            <View style={styles.statDivider} />
            <Stat
              icon="chatbubble"
              label="Messages"
              value={totalMessages}
              color={c.info}
            />
          </View>
        </FadeIn>

        {!!feedback && (
          <View
            style={[styles.feedback, feedbackIsError && styles.feedbackError]}
          >
            <Ionicons
              name={
                feedbackIsError
                  ? "alert-circle-outline"
                  : "information-circle-outline"
              }
              size={19}
              color={feedbackIsError ? c.error : c.accent}
            />
            <AppText
              variant="footnote"
              color="textSecondary"
              style={styles.flex}
              accessibilityLiveRegion="polite"
            >
              {feedback}
            </AppText>
          </View>
        )}

        {/* ── 3 + 4. Groups: stacked on phones, side by side once there is room ── */}
        <View style={[styles.groups, isTablet && styles.groupsRow]}>
          {/* ── 3. Connected Dating Platform (Isolated Tinder Session) ── */}
          <FadeIn
            delay={120}
            style={[styles.group, isTablet && styles.groupColumn]}
          >
            <SectionHeader
              title="Connected accounts"
              style={styles.sectionHeader}
            />
            <TinderProfileCard
              profile={tinderProfile}
              settings={settings}
              stats={stats}
              user={user}
              isLoggedIn={isLoggedIn}
              syncing={syncing}
              onSync={sync}
              onOpenTinder={onOpenTinder}
            />
          </FadeIn>

          {/* ── 4. Account Actions ── */}
          {/* Delete Account lives in App settings → Legal & support. */}
          <FadeIn
            delay={180}
            style={[styles.group, isTablet && styles.groupColumn]}
          >
            <SectionHeader
              title="Account & privacy"
              style={styles.sectionHeader}
            />
            <Card padding="none" style={styles.list}>
              <ListRow
                icon="log-out-outline"
                iconTone="neutral"
                title="Log out"
                subtitle="Sign out of your Flint account"
                onPress={confirmLogout}
                divider
                accessibilityLabel="Log out of Flint"
              />
              <ListRow
                icon="trash-outline"
                title="Clear app data"
                subtitle="Sign out and erase data on this device"
                onPress={confirmDeleteData}
                destructive
                accessibilityLabel="Clear app data on this device"
              />
            </Card>
          </FadeIn>
        </View>

        {/* ── 5. App Version Footer ── */}
        <AppText variant="caption" align="center" style={styles.versionFooter}>
          Flirteasy · Version {appConfig.expo.version}
        </AppText>
      </ScrollView>

      {/* ── Edit Flirteasy Profile Modal ── */}
      <Modal
        visible={editing}
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <SafeAreaView
          edges={["top", "left", "right", "bottom"]}
          style={styles.modal}
        >
          <KeyboardAvoidingView
            style={styles.modal}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.content,
                styles.modalContent,
                {
                  paddingHorizontal: gutter,
                  maxWidth: formMax,
                  paddingTop: sp.lg,
                  paddingBottom: sp.xxl,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <AppText variant="title" style={styles.flex} numberOfLines={1}>
                  Edit Profile
                </AppText>
                <IconButton
                  icon="close"
                  onPress={closeEditor}
                  disabled={saving}
                  accessibilityLabel="Close editor"
                />
              </View>
              <AppText variant="callout" color="muted">
                Update how your name appears in Flirteasy. Your email and
                connected Tinder account stay unchanged.
              </AppText>

              <View style={styles.field}>
                <AppText variant="label" nativeID="profile-full-name-label">
                  Full name
                </AppText>
                <FocusInput
                  style={styles.input}
                  value={personalName}
                  onChangeText={setPersonalName}
                  editable={!saving}
                  accessibilityLabel="Full name"
                  accessibilityLabelledBy="profile-full-name-label"
                  maxLength={80}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  placeholder="Your full name"
                  error={!!error}
                />
                {!!error && (
                  <AppText
                    variant="footnote"
                    color="error"
                    accessibilityRole="alert"
                    style={styles.errorText}
                  >
                    {error}
                  </AppText>
                )}
              </View>

              <View style={styles.modalActions}>
                <AppButton
                  title={saving ? "Saving…" : "Save changes"}
                  icon="checkmark-outline"
                  loading={saving}
                  onPress={save}
                />
                <AppButton
                  title="Cancel"
                  icon="close-outline"
                  variant="secondary"
                  disabled={saving}
                  onPress={closeEditor}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Custom Branded 2026 Confirmation Modal (Logout, Delete, Discard) ── */}
      <AppConfirmModal
        visible={confirmModal.visible}
        icon={confirmModal.icon}
        iconColor={confirmModal.iconColor}
        iconBg={confirmModal.iconBg}
        iconBorder={confirmModal.iconBorder}
        title={confirmModal.title}
        message={confirmModal.message}
        detail={confirmModal.detail}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </>
  );
}

const styles = createStyles(() => ({
  content: {
    width: "100%",
    // Phone baseline; the screen overrides maxWidth with useResponsive().contentMax (page) or
    // formMax (edit sheet).
    maxWidth: theme.layout.readableMax,
    alignSelf: "center",
    paddingTop: sp.sm,
    gap: sp.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
  },
  backButton: {
    marginLeft: -sp.md,
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
  },
  roundButton: {
    borderRadius: theme.radius.pill,
  },
  identity: {
    borderRadius: theme.radius.xxl,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.hairline,
    overflow: "hidden",
    alignItems: "center",
    paddingBottom: sp.lg,
    ...theme.shadows.md,
  },
  cover: {
    alignSelf: "stretch",
    height: 112,
    overflow: "hidden",
  },
  coverMark: {
    position: "absolute",
    right: -18,
    top: -14,
    transform: [{ rotate: "12deg" }],
  },
  avatarWrap: {
    marginTop: -56,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 56,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: c.elevated,
    borderWidth: 3,
    borderColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    ...theme.type.largeTitle,
    color: c.text,
  },
  avatarEdit: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.primary,
    borderWidth: 3,
    borderColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  identityCopy: {
    alignItems: "center",
    gap: sp.xs,
    paddingHorizontal: sp.xl,
    marginTop: sp.md,
    alignSelf: "stretch",
  },
  connectionBadge: {
    alignSelf: "center",
    marginTop: sp.sm,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: sp.xl,
    marginHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderRadius: theme.radius.lg,
    backgroundColor: alpha(c.background, 0.55),
    borderWidth: 1,
    borderColor: c.hairline,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
    paddingHorizontal: sp.xs,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: c.divider,
  },
  statValue: {
    ...theme.type.title2,
    fontFamily: theme.fonts.strong,
    color: c.text,
    maxWidth: "100%",
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    ...theme.type.footnote,
    color: c.muted,
  },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    padding: sp.md,
    borderRadius: theme.radius.md,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  feedbackError: {
    backgroundColor: c.errorSoft,
    borderColor: c.errorBorder,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  group: {
    gap: 0,
  },
  // Groups stack on phones and sit two across on tablets.
  groups: {
    gap: sp.xl,
  },
  groupsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  groupColumn: {
    flexGrow: 1,
    flexBasis: 300,
    minWidth: 280,
  },
  sectionHeader: {
    marginBottom: sp.sm,
  },
  list: {
    overflow: "hidden",
  },
  versionFooter: {
    paddingVertical: sp.sm,
  },
  modal: {
    flex: 1,
    backgroundColor: c.background,
  },
  modalContent: {
    maxWidth: theme.layout.formMax,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
  },
  field: {
    gap: sp.sm,
  },
  input: {
    ...theme.type.body,
    color: c.text,
    minHeight: theme.layout.inputHeight,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderRadius: theme.radius.input,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.border,
  },
  errorText: {
    marginTop: sp.xxs,
  },
  modalActions: {
    gap: sp.md,
    marginTop: sp.sm,
  },
}));
