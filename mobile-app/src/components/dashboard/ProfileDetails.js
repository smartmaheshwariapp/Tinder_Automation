import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import SafeActivityIndicator from '../common/SafeActivityIndicator';
import AppConfirmModal from '../common/AppConfirmModal';
import TinderProfileCard from './TinderProfileCard';
import appConfig from '../../../app.json';

const tinderFields = [
  ['bio', 'About me on Tinder'],
  ['age', 'Age'],
  ['interests', 'Interests & Passions'],
  ['job', 'Work'],
  ['school', 'Education'],
  ['city', 'City'],
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

function Action({ title, icon, onPress, busy, secondary }) {
  return (
    <TouchableOpacity
      style={[styles.button, secondary && styles.secondary]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
    >
      {busy ? (
        <SafeActivityIndicator size="small" color={theme.colors.text} />
      ) : (
        <Ionicons name={icon} size={18} color={theme.colors.text} />
      )}
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  const insets = useSafeAreaInsets();

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
    iconColor: '#F59E0B',
    iconBg: 'rgba(245, 158, 11, 0.12)',
    iconBorder: 'rgba(245, 158, 11, 0.3)',
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
        iconColor: theme.colors.accent,
        iconBg: 'rgba(254, 60, 114, 0.12)',
        iconBorder: 'rgba(254, 60, 114, 0.3)',
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
      setTinderPhotoFailed(false);
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
      iconColor: '#F59E0B',
      iconBg: 'rgba(245, 158, 11, 0.12)',
      iconBorder: 'rgba(245, 158, 11, 0.3)',
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
      iconColor: '#EF4444',
      iconBg: 'rgba(239, 68, 68, 0.12)',
      iconBorder: 'rgba(239, 68, 68, 0.3)',
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

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.back}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to home"
          >
            <Ionicons name="arrow-back" size={21} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.pageTitle} accessibilityRole="header">
            Profile
          </Text>
          <View style={styles.backSpacer} />
        </View>

        {/* ── 1. Flint Account Hero Card ── */}
        <LinearGradient
          colors={['#382036', '#211426', theme.colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.identity}
        >
          <View style={styles.identityTop}>
            <View style={styles.avatarRing}>
              <View style={[styles.avatar, styles.placeholder]}>
                <Text style={styles.initial}>{flintInitial}</Text>
              </View>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.eyebrow}>ACCOUNT</Text>
              <Text style={styles.name} numberOfLines={1}>
                {flintName}
              </Text>
              <Text style={styles.description} numberOfLines={1}>
                {flintEmail}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={openEditor}
            accessibilityRole="button"
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={18} color={theme.colors.text} />
            <Text style={styles.buttonText}>Edit profile</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </LinearGradient>

        {/* ── 2. Flint Lifetime Stats ── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="heart-outline"
            label="SWIPES"
            value={totalSwipes}
            color={theme.colors.primary}
          />
          <StatCard
            icon="people-outline"
            label="MATCHES"
            value={totalMatches}
            color={theme.colors.secondary}
          />
          <StatCard
            icon="chatbubble-outline"
            label="MESSAGES"
            value={totalMessages}
            color="#6ED2B1"
          />
        </View>

        {!!feedback && (
          <View style={styles.feedback}>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color={theme.colors.accent}
            />
            <Text style={[styles.description, styles.flex]} accessibilityLiveRegion="polite">
              {feedback}
            </Text>
          </View>
        )}

        {/* ── 3. Connected Dating Platform (Isolated Tinder Session) ── */}
        <View style={styles.group}>
          <Text style={styles.eyebrow}>CONNECTED ACCOUNTS</Text>
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
        </View>

        {/* ── 4. Account Actions ── */}
        <View style={styles.group}>
          <Text style={styles.eyebrow}>ACCOUNT & PRIVACY</Text>
          <View style={styles.list}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={confirmLogout}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Log out of Flint"
            >
              <View style={styles.rowIcon}>
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Log out</Text>
                <Text style={styles.description}>
                  Sign out of your Flint account
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRow}
              onPress={confirmDeleteData}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <View style={[styles.rowIcon, styles.destructiveIcon]}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.label, { color: theme.colors.error }]}>
                  Delete account
                </Text>
                <Text style={styles.description}>
                  Permanently erase your account and data
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5. App Version Footer ── */}
        <Text style={styles.versionFooter}>
          Flint · Version {appConfig.expo.version}
        </Text>
      </ScrollView>

      {/* ── Edit Flint Profile Modal ── */}
      <Modal visible={editing} animationType="slide" onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.content,
              { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
            ]}
          >
            <Text style={styles.title} accessibilityRole="header">
              Edit Profile
            </Text>
            <Text style={styles.description}>
              Update how your name appears in Flint. Your email and
              connected Tinder account stay unchanged.
            </Text>

            <View style={styles.detail}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={[styles.input, { minHeight: 52 }]}
                value={personalName}
                onChangeText={setPersonalName}
                editable={!saving}
                accessibilityLabel="Full name"
                maxLength={80}
                autoCapitalize="words"
                placeholder="Your full name"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            {!!error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            <Action
              title={saving ? 'Saving…' : 'Save changes'}
              icon="checkmark-outline"
              busy={saving}
              onPress={save}
            />
            <Action
              title="Cancel"
              icon="close-outline"
              busy={saving}
              secondary
              onPress={closeEditor}
            />
          </ScrollView>
        </KeyboardAvoidingView>
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
  identity: {
    padding: 24,
    gap: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  initial: {
    ...theme.type.display,
    fontSize: 26,
    color: theme.colors.text,
    fontWeight: '700',
  },
  name: {
    ...theme.type.title,
    fontSize: 20,
    color: theme.colors.text,
  },
  eyebrow: {
    ...theme.type.caption,
    color: theme.colors.muted,
    letterSpacing: 1.5,
    fontSize: 10,
    fontWeight: '700',
  },
  pageTitle: {
    ...theme.type.section,
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  backSpacer: {
    width: 44,
  },
  editButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.elevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  group: {
    gap: 12,
  },
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    minHeight: 76,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.elevated,
  },
  tinderIcon: {
    backgroundColor: '#321526',
  },
  destructiveIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  divider: {
    marginLeft: 68,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.divider,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  expanded: {
    padding: 18,
    paddingTop: 8,
    gap: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  tinderPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  tinderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  tinderPreviewName: {
    ...theme.type.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tinderNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tinderActionsRow: {
    gap: 10,
  },
  galleryStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  galleryThumb: {
    width: 52,
    height: 70,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  openTinderBtn: {
    minHeight: 44,
    borderRadius: theme.radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#281423',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  versionFooter: {
    ...theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.type.title,
    color: theme.colors.text,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  placeholder: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    ...theme.type.caption,
    color: theme.colors.muted,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
  },
  fieldLabel: {
    ...theme.type.caption,
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.text,
  },
  detail: {
    gap: 4,
  },
  button: {
    minHeight: 48,
    padding: 12,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondary: {
    backgroundColor: theme.colors.elevated,
  },
  buttonText: {
    ...theme.type.label,
    color: theme.colors.text,
  },
  modal: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  input: {
    ...theme.type.body,
    color: theme.colors.text,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  error: {
    ...theme.type.body,
    color: theme.colors.error,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
  },
  statValue: {
    ...theme.type.title,
    fontSize: 22,
  },
  statLabel: {
    ...theme.type.caption,
    color: theme.colors.muted,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tierPlatinum: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  tierGold: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.45)',
  },
  tierPlus: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  tierText: {
    ...theme.type.caption,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
  },
  tierTextPlatinum: {
    color: '#38BDF8',
  },
  tierTextGold: {
    color: '#FACC15',
  },
  tierTextPlus: {
    color: '#C084FC',
  },
});
