import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import AppConfirmModal from '../common/AppConfirmModal';
import { FadeIn, FocusInput } from '../common/Motion';
import { AppButton, AppText, Badge, Card, CountUp, IconButton, ListRow, ScreenHeader, SectionHeader } from '../ui';
import useResponsive from '../../hooks/useResponsive';
import TinderProfileCard from './TinderProfileCard';
import appConfig from '../../../app.json';

const c = theme.colors;
const sp = theme.spacing;

const tinderFields = [
  ['bio', 'About me on Tinder'],
  ['age', 'Age'],
  ['interests', 'Interests & Passions'],
  ['height', 'Height'],
  ['lookingFor', 'Looking for'],
  ['relationshipType', 'Relationship type'],
  ['languages', 'Languages'],
  ['gender', 'Gender'],
  ['zodiac', 'Zodiac'],
  ['drinking', 'Drinking'],
  ['smoking', 'Smoking'],
  ['workout', 'Workout'],
  ['pets', 'Pets'],
  ['communicationStyle', 'Communication style'],
  ['loveStyle', 'Love style'],
];

const display = value =>
  Array.isArray(value)
    ? value
        .map(item => (typeof item === 'string' ? item : item?.name))
        .filter(Boolean)
        .join(', ')
    : typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';

function StatCard({ icon, label, value, color }) {
  const formatted = Number.isFinite(Number(value)) ? Number(value).toLocaleString() : String(value);
  return (
    <View style={styles.statCard} accessible accessibilityLabel={`${formatted} ${label.toLowerCase()}`}>
      <Ionicons name={icon} size={20} color={color} />
      <CountUp
        value={Number.isFinite(Number(value)) ? Number(value) : formatted}
        style={[styles.statValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={theme.fontScale.chrome}
        importantForAccessibility="no"
      />
      <Text style={styles.statLabel} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>
        {label}
      </Text>
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
  onDeleteData,
}) {
  const { gutter } = useResponsive();

  // ── 1. Isolated Flint App User Profile ──
  const flintName = (
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    settings?.accountProfile?.name ||
    'Flint Member'
  ).trim();

  const flintEmail = (
    user?.email ||
    settings?.accountProfile?.email ||
    'Your Flint account'
  ).trim();

  const flintInitial = (flintName || 'F').slice(0, 1).toUpperCase();

  // ── 2. Isolated Tinder Session & Profile ──
  const tinderProfile = settings?.userProfile || {};
  const tinderName = tinderProfile?.name || (isLoggedIn ? 'Connected User' : null);
  const tinderPhoto =
    typeof tinderProfile.photos?.[0] === 'string'
      ? tinderProfile.photos[0]
      : tinderProfile.photos?.[0]?.url;
  const tinderPlan = tinderProfile?.tinderPlan || 'free';
  const likesRemaining = tinderProfile?.likesRemaining;

  // ── UI States ──
  const [editing, setEditing] = useState(false);
  const [personalName, setPersonalName] = useState(flintName);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

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
    icon: 'log-out-outline',
    iconColor: c.warning,
    iconBg: c.warningSoft,
    iconBorder: c.warningBorder,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmVariant: 'warning',
    onConfirm: null,
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, visible: false }));
  };

  const openEditor = () => {
    setPersonalName(flintName);
    setError('');
    setEditing(true);
  };

  const closeEditor = () => {
    if (saving) return;
    if (personalName.trim() !== flintName) {
      setConfirmModal({
        visible: true,
        icon: 'alert-circle-outline',
        iconColor: c.accent,
        iconBg: c.primarySoft,
        iconBorder: c.primaryBorder,
        title: 'Discard changes?',
        message: 'Your unsaved name change will be lost.',
        confirmText: 'Discard',
        cancelText: 'Keep editing',
        confirmVariant: 'destructive',
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
      setError('Please enter your name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await onSave({
        accountProfile: {
          ...settings?.accountProfile,
          name: trimmed,
        },
      });
      if (result === false) throw new Error();
      setEditing(false);
      setFeedback('Profile updated.');
    } catch {
      setError('Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setFeedback('');
    try {
      const result = await onSync();
      setFeedback(
        result?.success
          ? 'Tinder profile updated.'
          : 'Could not update Tinder details. Open Tinder and check your connection.'
      );
    } catch {
      setFeedback('Could not update Tinder details. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const confirmLogout = () => {
    setConfirmModal({
      visible: true,
      icon: 'log-out-outline',
      iconColor: c.warning,
      iconBg: c.warningSoft,
      iconBorder: c.warningBorder,
      title: 'Log out of Flint?',
      message: 'This will disconnect your Tinder session and return you to the login screen.',
      confirmText: 'Log out',
      cancelText: 'Cancel',
      confirmVariant: 'warning',
      onConfirm: () => {
        closeConfirmModal();
        onLogout();
      },
    });
  };

  const confirmDeleteData = () => {
    setConfirmModal({
      visible: true,
      icon: 'trash-outline',
      iconColor: c.error,
      iconBg: c.errorSoft,
      iconBorder: c.errorBorder,
      title: 'Delete your account?',
      message: 'This will permanently delete your Flint account, history, and preferences. This action cannot be undone.',
      confirmText: 'Delete Account',
      cancelText: 'Cancel',
      confirmVariant: 'destructive',
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
          { paddingHorizontal: gutter, paddingBottom: theme.layout.navHeight + sp.hero + sp.sm },
        ]}
      >
        {/* Header */}
        <ScreenHeader title="Profile" onBack={onBack} backLabel="Back to home" />

        {/* ── 1. Flint Account Hero Card ── */}
        <FadeIn>
          <LinearGradient
            colors={theme.gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.identity}
          >
            <View style={styles.identityTop}>
              <LinearGradient
                colors={theme.gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Text style={styles.initial} maxFontSizeMultiplier={theme.fontScale.chrome}>{flintInitial}</Text>
                </View>
              </LinearGradient>
              <View style={styles.identityCopy}>
                <AppText variant="overline" color="secondary">ACCOUNT</AppText>
                <AppText variant="title2" numberOfLines={1}>
                  {flintName}
                </AppText>
                <AppText variant="footnote" numberOfLines={1}>
                  {flintEmail}
                </AppText>
                <Badge
                  label={isLoggedIn ? 'Tinder connected' : 'Tinder not connected'}
                  tone={isLoggedIn ? 'success' : 'neutral'}
                  dot
                  size="sm"
                  style={styles.connectionBadge}
                />
              </View>
            </View>
            <AppButton
              variant="secondary"
              title="Edit profile"
              icon="create-outline"
              iconRight="arrow-forward"
              onPress={openEditor}
            />
          </LinearGradient>
        </FadeIn>

        {/* ── 2. Flint Lifetime Stats ── */}
        <FadeIn delay={60} style={styles.statsRow}>
          <StatCard
            icon="heart-outline"
            label="SWIPES"
            value={totalSwipes}
            color={c.primary}
          />
          <StatCard
            icon="people-outline"
            label="MATCHES"
            value={totalMatches}
            color={c.secondary}
          />
          <StatCard
            icon="chatbubble-outline"
            label="MESSAGES"
            value={totalMessages}
            color={c.success}
          />
        </FadeIn>

        {!!feedback && (
          <View style={[styles.feedback, feedbackIsError && styles.feedbackError]}>
            <Ionicons
              name={feedbackIsError ? 'alert-circle-outline' : 'information-circle-outline'}
              size={19}
              color={feedbackIsError ? c.error : c.accent}
            />
            <AppText variant="footnote" color="textSecondary" style={styles.flex} accessibilityLiveRegion="polite">
              {feedback}
            </AppText>
          </View>
        )}

        {/* ── 3. Connected Dating Platform (Isolated Tinder Session) ── */}
        <FadeIn delay={120} style={styles.group}>
          <SectionHeader title="Connected accounts" style={styles.sectionHeader} />
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
        <FadeIn delay={180} style={styles.group}>
          <SectionHeader title="Account & privacy" style={styles.sectionHeader} />
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
              title="Delete account"
              subtitle="Permanently erase your account and data"
              onPress={confirmDeleteData}
              destructive
              accessibilityLabel="Delete account"
            />
          </Card>
        </FadeIn>

        {/* ── 5. App Version Footer ── */}
        <AppText variant="caption" align="center" style={styles.versionFooter}>
          Flint · Version {appConfig.expo.version}
        </AppText>
      </ScrollView>

      {/* ── Edit Flint Profile Modal ── */}
      <Modal visible={editing} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modal}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.content,
              styles.modalContent,
              { paddingHorizontal: gutter, paddingTop: sp.lg, paddingBottom: sp.xxl },
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
              Update how your name appears in Flint. Your email and
              connected Tinder account stay unchanged.
            </AppText>

            <View style={styles.field}>
              <AppText variant="label" nativeID="profile-full-name-label">Full name</AppText>
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
                <AppText variant="footnote" color="error" accessibilityRole="alert" style={styles.errorText}>
                  {error}
                </AppText>
              )}
            </View>

            <View style={styles.modalActions}>
              <AppButton
                title={saving ? 'Saving…' : 'Save changes'}
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
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: theme.layout.readableMax,
    alignSelf: 'center',
    paddingTop: sp.sm,
    gap: sp.xl,
  },
  identity: {
    padding: sp.xl,
    gap: sp.xl,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.lg,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: sp.xxs,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 38,
    flexShrink: 0,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    ...theme.type.title,
    color: c.text,
  },
  connectionBadge: {
    marginTop: sp.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: sp.sm,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: sp.xs,
    paddingVertical: sp.lg,
    paddingHorizontal: sp.sm,
    backgroundColor: c.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  statValue: {
    ...theme.type.title2,
    fontFamily: theme.fonts.strong,
    fontVariant: ['tabular-nums'],
    maxWidth: '100%',
  },
  statLabel: {
    ...theme.type.overline,
    color: c.muted,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sectionHeader: {
    marginBottom: sp.sm,
  },
  list: {
    overflow: 'hidden',
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
    flexDirection: 'row',
    alignItems: 'center',
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
});
