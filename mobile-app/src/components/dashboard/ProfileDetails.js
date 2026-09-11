import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import SafeActivityIndicator from '../common/SafeActivityIndicator';

const fields = [['bio', 'About me'], ['age', 'Age'], ['interests', 'Interests'], ['height', 'Height'], ['lookingFor', 'Looking for'], ['relationshipType', 'Relationship type'], ['languages', 'Languages'], ['gender', 'Gender'], ['zodiac', 'Zodiac'], ['drinking', 'Drinking'], ['smoking', 'Smoking'], ['workout', 'Workout']];
const display = value => Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean).join(', ') : typeof value === 'string' || typeof value === 'number' ? String(value) : '';

function Action({ title, icon, onPress, busy, secondary }) {
  return <TouchableOpacity style={[styles.button, secondary && styles.secondary]} onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: !!busy, busy: !!busy }}>
    {busy ? <SafeActivityIndicator size="small" color={theme.colors.text} /> : <Ionicons name={icon} size={18} color={theme.colors.text} />}
    <Text style={styles.buttonText}>{title}</Text>
  </TouchableOpacity>;
}

export default function ProfileDetails({ settings, user, isLoggedIn, onBack, onOpenTinder, onSync, onSave }) {
  const insets = useSafeAreaInsets();
  const tinderProfile = settings?.userProfile || {};
  const profile = { ...tinderProfile, ...settings?.accountProfile };
  const [editMode, setEditMode] = useState('profile');
  const [personal, setPersonal] = useState({});
  const personalFields = [['name', 'Full name'], ['bio', 'About me']];
  const initialPersonal = () => Object.fromEntries(personalFields.map(([key]) => [key, display(profile[key]) || (key === 'name' ? user?.name || '' : '')]));
  const editProfile = () => { setPersonal(initialPersonal()); setEditMode('profile'); setError(''); setEditing(true); };
  const [showDetails, setShowDetails] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState('tinder');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const photo = typeof profile.photos?.[0] === 'string' ? profile.photos[0] : profile.photos?.[0]?.url;
  const startEditing = () => {
    setEditMode('assistant');
    setDraft(settings?.manualBio || ''); setSource(settings?.aboutSource || 'tinder'); setError(''); setEditing(true);
  };
  const closeEditor = () => {
    if (saving) return;
    const dirty = editMode === 'profile' ? JSON.stringify(personal) !== JSON.stringify(initialPersonal()) : draft !== (settings?.manualBio || '') || source !== (settings?.aboutSource || 'tinder');
    if (dirty) Alert.alert('Discard changes?', 'Your unsaved profile settings will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => setEditing(false) }]);
    else setEditing(false);
  };
  const save = async () => {
    if (editMode === 'profile' && !personal.name?.trim()) { setError('Please enter your name.'); return; }
    if (editMode === 'assistant' && source === 'manual' && !draft.trim()) { setError('Add a short bio or choose your Tinder bio.'); return; }
    setSaving(true); setError('');
    try {
      const result = await onSave(editMode === 'profile' ? { accountProfile: { ...settings?.accountProfile, ...Object.fromEntries(Object.entries(personal).map(([key, value]) => [key, value.trim()])) } } : { manualBio: draft.trim(), aboutSource: source });
      if (result === false) throw new Error();
      setEditing(false); setFeedback('Profile settings saved.');
    } catch { setError('Could not save your changes. Please try again.'); }
    finally { setSaving(false); }
  };
  const sync = async () => {
    setSyncing(true); setFeedback('');
    try { const result = await onSync(); setFeedback(result?.success ? 'Profile refreshed from Tinder.' : 'Could not refresh your profile. Open Tinder, check your connection, and try again.'); setPhotoFailed(false); }
    catch { setFeedback('Could not refresh your profile. Please try again.'); }
    finally { setSyncing(false); }
  };
  return <>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to home"><Ionicons name="arrow-back" size={21} color={theme.colors.text} /></TouchableOpacity>
        <Text style={styles.pageTitle} accessibilityRole="header">Profile</Text>
        <View style={styles.backSpacer} />
      </View>
      <LinearGradient colors={['#382036', '#211426', theme.colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.identity}>
        <View style={styles.identityTop}>
          <View style={styles.avatarRing}>
            {photo && !photoFailed ? <Image source={{ uri: photo }} style={styles.avatar} onError={() => setPhotoFailed(true)} accessibilityLabel="Profile photo" /> : <View style={[styles.avatar, styles.placeholder]}><Text style={styles.initial}>{(profile.name || user?.name || 'F').trim().slice(0, 1).toUpperCase()}</Text></View>}
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.eyebrow}>YOUR SPACE</Text>
            <Text style={styles.name}>{profile.name || user?.name || 'Your profile'}</Text>
            <Text style={styles.description}>{user?.email || 'Your Flint account'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={editProfile} accessibilityRole="button" activeOpacity={0.75}>
          <Ionicons name="create-outline" size={18} color={theme.colors.text} />
          <Text style={styles.buttonText}>Edit profile</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </LinearGradient>
      {!!feedback && <View style={styles.feedback}><Ionicons name="information-circle-outline" size={19} color={theme.colors.accent} /><Text style={[styles.description, styles.flex]} accessibilityLiveRegion="polite">{feedback}</Text></View>}
      <View style={styles.about}>
        <View style={styles.sectionHeading}><Text style={styles.section} accessibilityRole="header">About you</Text><TouchableOpacity style={styles.smallAction} onPress={editProfile} accessibilityRole="button" accessibilityLabel="Edit about you"><Ionicons name="create-outline" size={19} color={theme.colors.accent} /></TouchableOpacity></View>
        <Text style={styles.body}>{profile.bio || 'A little introduction goes a long way. Add a few words about yourself.'}</Text>
        {!!display(profile.interests) && <View style={styles.choices}>{display(profile.interests).split(', ').map((interest, index) => <View key={index} style={styles.interest}><Text style={styles.description}>{interest}</Text></View>)}</View>}
      </View>
      <View style={styles.group}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <View style={styles.list}>
          <TouchableOpacity style={styles.settingRow} onPress={editProfile} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Edit personal details">
            <View style={styles.rowIcon}><Ionicons name="person-outline" size={20} color={theme.colors.textSecondary} /></View>
            <View style={styles.flex}><Text style={styles.label}>Personal details</Text><Text style={styles.description}>Your name and introduction</Text></View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.rowIcon}><Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} /></View>
            <View style={styles.flex}><Text style={styles.label}>Email address</Text><Text style={styles.description}>{user?.email || 'Not available'}</Text></View>
            <Ionicons name="lock-closed-outline" size={15} color={theme.colors.muted} accessibilityLabel="Read only" />
          </View>
        </View>
      </View>
      <View style={styles.group}>
        <Text style={styles.eyebrow}>CONNECTIONS & PREFERENCES</Text>
        <View style={styles.list}>
          <TouchableOpacity style={styles.settingRow} onPress={onOpenTinder} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={isLoggedIn ? 'Manage connected Tinder account' : 'Connect Tinder'}>
            <View style={[styles.rowIcon, styles.tinderIcon]}><Ionicons name="flame" size={21} color={theme.colors.accent} /></View>
            <View style={styles.flex}><Text style={styles.label}>Tinder</Text><View style={styles.connectionStatus}><View style={[styles.dot, { backgroundColor: isLoggedIn ? theme.colors.success : theme.colors.muted }]} /><Text style={styles.description}>{isLoggedIn ? 'Connected account' : 'Connect your account'}</Text></View></View>
            <Ionicons name="open-outline" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={startEditing} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Edit assistant bio">
            <View style={styles.rowIcon}><Ionicons name="sparkles-outline" size={20} color={theme.colors.textSecondary} /></View>
            <View style={styles.flex}><Text style={styles.label}>Assistant bio</Text><Text style={styles.description}>{settings?.aboutSource === 'manual' ? 'Using your custom bio' : settings?.aboutSource === 'ai' ? 'Using your generated bio' : 'Using your Tinder bio'}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowDetails(!showDetails)} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: showDetails }}>
            <View style={styles.rowIcon}><Ionicons name="sync-outline" size={20} color={theme.colors.textSecondary} /></View>
            <View style={styles.flex}><Text style={styles.label}>Synced profile</Text><Text style={styles.description}>View and refresh Tinder details</Text></View>
            <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.muted} />
          </TouchableOpacity>
          {showDetails && <View style={styles.expanded}>
            {fields.filter(([key]) => display(tinderProfile[key])).map(([key, label]) => <View key={key} style={styles.detail}><Text style={styles.description}>{label}</Text><Text style={styles.body}>{display(tinderProfile[key])}</Text></View>)}
            {!fields.some(([key]) => display(tinderProfile[key])) && <Text style={styles.description}>No details synced yet. Connect Tinder, then refresh your profile.</Text>}
            <Action title="Refresh details" icon="refresh-outline" busy={syncing} secondary onPress={sync} />
          </View>}
        </View>
      </View>
      <Text style={styles.footer}>A little more you. A little more connection.</Text>
    </ScrollView>
    <Modal visible={editing} animationType="slide" onRequestClose={closeEditor}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.title} accessibilityRole="header">{editMode === 'profile' ? 'Edit profile' : 'Assistant bio'}</Text>
          {editMode === 'profile' ? <>
            <Text style={styles.description}>Update your personal details in Flint. Your email and connected Tinder account stay unchanged.</Text>
            {personalFields.map(([key, label]) => <View key={key} style={styles.detail}>
              <Text style={styles.label}>{label}{key === 'name' ? ' *' : ''}</Text>
              <TextInput style={[styles.input, key !== 'bio' && { minHeight: 52 }]} value={personal[key] || ''} onChangeText={value => setPersonal(prev => ({ ...prev, [key]: value }))} editable={!saving} accessibilityLabel={label} multiline={key === 'bio'} maxLength={key === 'bio' ? 500 : 100} autoCapitalize={key === 'bio' ? 'sentences' : 'words'} placeholder={label} placeholderTextColor={theme.colors.muted} />
            </View>)}
          </> : <>
          <Text style={styles.description}>Personalize the context your dating assistant uses.</Text>
          <Text style={styles.label}>Bio source</Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            {[['tinder', 'Tinder bio'], ['manual', 'Custom bio'], ...(source === 'ai' ? [['ai', 'Generated bio']] : [])].map(([key, label]) => <TouchableOpacity key={key} style={[styles.choice, source === key && styles.selected]} disabled={saving} onPress={() => setSource(key)} accessibilityRole="radio" accessibilityState={{ checked: source === key, disabled: saving }}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>)}
          </View>
          {source === 'tinder' ? <Text style={styles.body}>{tinderProfile.bio || 'Refresh your Tinder profile to import your bio.'}</Text> : <>
            <Text style={styles.label}>Your bio</Text>
            <TextInput style={styles.input} value={draft} onChangeText={setDraft} multiline maxLength={500} editable={!saving} accessibilityLabel="Your bio" placeholder="Share a little about yourself…" placeholderTextColor={theme.colors.muted} textAlignVertical="top" />
            <Text style={styles.description}>{draft.length}/500 characters</Text>
          </>}
          </>}
          {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          <Action title={saving ? 'Saving…' : 'Save changes'} icon="checkmark-outline" busy={saving} onPress={save} />
          <Action title="Cancel" icon="close-outline" busy={saving} secondary onPress={closeEditor} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  identity: { padding: 24, gap: 24, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityCopy: { flex: 1, minWidth: 0, gap: 6 },
  avatarRing: { padding: 4, borderRadius: 44, borderWidth: 1, borderColor: theme.colors.accent },
  initial: { ...theme.type.display, color: theme.colors.text },
  name: { ...theme.type.title, color: theme.colors.text },
  eyebrow: { ...theme.type.caption, color: theme.colors.muted, letterSpacing: 1.5 },
  pageTitle: { ...theme.type.section, color: theme.colors.text, flex: 1, textAlign: 'center' },
  backSpacer: { width: 44 },
  editButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: theme.colors.elevated, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: theme.colors.border },
  about: { paddingHorizontal: 4, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 12 },
  list: { backgroundColor: theme.colors.surface, borderRadius: 20, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 80 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevated },
  tinderIcon: { backgroundColor: '#321526' },
  divider: { marginLeft: 68, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.divider },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  expanded: { padding: 20, paddingTop: 4, gap: 16 },
  interest: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.colors.elevated, borderRadius: 20 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { ...theme.type.caption, color: theme.colors.muted, textAlign: 'center', paddingVertical: 8 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...theme.type.title, color: theme.colors.text, flexShrink: 1 },
  hero: { alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  placeholder: { backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  status: { ...theme.type.caption, color: theme.colors.textSecondary },
  card: { padding: 20, gap: 16, borderRadius: theme.radius.card, backgroundColor: theme.colors.surface },
  section: { ...theme.type.section, color: theme.colors.text },
  description: { ...theme.type.caption, color: theme.colors.muted },
  label: { ...theme.type.label, color: theme.colors.textSecondary },
  body: { ...theme.type.body, color: theme.colors.text },
  detail: { gap: 4 },
  button: { minHeight: 48, padding: 12, borderRadius: theme.radius.button, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondary: { backgroundColor: theme.colors.elevated },
  buttonText: { ...theme.type.label, color: theme.colors.text, flexShrink: 1 },
  modal: { flex: 1, backgroundColor: theme.colors.background },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { padding: 12, minHeight: 48, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  selected: { backgroundColor: theme.colors.elevated, borderColor: theme.colors.accent },
  input: { ...theme.type.body, color: theme.colors.text, minHeight: 160, padding: 16, borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  error: { ...theme.type.body, color: theme.colors.error },
});

