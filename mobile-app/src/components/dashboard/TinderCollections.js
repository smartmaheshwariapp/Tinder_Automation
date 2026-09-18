import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentTransition, MotionTouchable as Button } from '../common/Motion';
import FeedbackState from '../common/FeedbackState';
import { AppButton, AppText, Badge, IconButton, IconWell } from '../ui';
import { theme, alpha } from '../../theme';
import { getTinderAuthState, subscribeTinderAuthState } from '../../utils/sessionManager';
import { collectionLists } from '../../utils/tinderCollectionsModel';
import { activateCollections, disconnectCollections, getCollections, refreshConversations, subscribeCollections } from '../../services/tinderCollections';

const c = theme.colors;
const t = theme.type;
const sp = theme.spacing;
const r = theme.radius;

const TABS = {
  swiped: { label: 'Swiped', full: 'Swiped profiles', icon: 'heart', tone: 'primary', color: c.accent, tint: c.primarySoft },
  strong: { label: 'Strong', full: 'Strong matches', icon: 'sparkles', tone: 'secondary', color: c.secondary, tint: c.secondarySoft },
  chatting: { label: 'Chats', full: 'Conversations', icon: 'chatbubbles', tone: 'success', color: c.success, tint: c.successSoft },
};
const relativeTime = value => {
  if (!value) return '';
  const age = Date.now() - value;
  if (age < 60000) return 'Now';
  if (age < 3600000) return `${Math.floor(age / 60000)}m`;
  if (age < 86400000) return `${Math.floor(age / 3600000)}h`;
  if (age < 604800000) return `${Math.floor(age / 86400000)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function Avatar({ profile, large = false }) {
  const [failed, setFailed] = useState(false);
  const size = large ? styles.avatarLarge : styles.avatar;
  return profile?.photos?.[0] && !failed
    ? <View style={[styles.avatarFrame, size]}><Image source={{ uri: profile.photos[0] }} style={[size, styles.avatarImage]} onError={() => setFailed(true)} accessibilityIgnoresInvertColors /></View>
    : <LinearGradient colors={[c.elevatedHigh, c.surface]} style={[styles.avatarFrame, size, styles.placeholder]}><Ionicons name="person-outline" size={large ? 38 : 24} color={c.textSecondary} /></LinearGradient>;
}
function Score({ value }) {
  const color = value >= 80 ? TABS.chatting.color : TABS.strong.color;
  return (
    <View style={[styles.score, { borderColor: color }]} accessible accessibilityLabel={`Estimated fit ${value} percent`}>
      <Text style={[styles.scoreValue, { color }]} maxFontSizeMultiplier={theme.fontScale.chrome}>{value}</Text>
      <Text style={styles.scoreUnit} maxFontSizeMultiplier={theme.fontScale.chrome}>%</Text>
    </View>
  );
}
function Summary({ type, count, active, onPress }) {
  const item = TABS[type];
  return (
    <Button
      style={[styles.summary, active && { borderColor: item.color, backgroundColor: item.tint }]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={`${item.full}, ${Number(count).toLocaleString()}`}
      accessibilityState={{ selected: active }}
    >
      <IconWell icon={item.icon} tone={item.tone} size={32} iconSize={16} />
      <Text style={styles.summaryCount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={theme.fontScale.chrome}>
        {Number(count).toLocaleString()}
      </Text>
      <Text style={styles.summaryLabel} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.label}</Text>
    </Button>
  );
}
function ProfileRow({ item, tab, ownerId, onPress }) {
  const profile = item.profile, config = TABS[tab], latest = item.messages?.[0];
  const subtitle = tab === 'swiped'
    ? item.action === 'like' ? (item.matched ? 'Liked · It’s a match' : 'You liked this profile') : 'You passed this profile'
    : tab === 'strong' ? item.reasons?.[0] || 'High estimated compatibility'
      : `${latest?.senderId === ownerId ? 'You: ' : ''}${latest?.text || 'Open conversation'}`;
  return (
    <Button style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${profile?.name || 'Tinder profile'}. ${subtitle}`} pressScale={0.985}>
      <Avatar profile={profile} />
      <View style={styles.rowCopy}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{profile?.name || 'Tinder profile'}</Text>
          {tab === 'chatting' && <Text style={styles.time} maxFontSizeMultiplier={theme.fontScale.chrome}>{relativeTime(item.lastActivityAt)}</Text>}
        </View>
        <Text style={styles.subtitle} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.body}>{subtitle}</Text>
        <View style={styles.meta}>
          {tab === 'swiped' && <Badge label={item.action === 'like' ? 'LIKED' : 'PASSED'} icon={item.action === 'like' ? 'heart' : 'close'} tone={item.action === 'like' ? config.tone : 'neutral'} size="sm" />}
          {tab === 'strong' && <Text style={styles.metaText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.reasons?.[1] || 'Compatibility estimate'}</Text>}
          {tab === 'chatting' && <><View style={[styles.onlineDot, { backgroundColor: config.color }]} /><Text style={styles.metaText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>Active conversation</Text></>}
        </View>
      </View>
      {tab === 'strong' ? <Score value={item.score} /> : <View style={styles.chevron}><Ionicons name="chevron-forward" size={16} color={c.textSecondary} /></View>}
    </Button>
  );
}
function Empty({ tab, loading }) {
  const config = TABS[tab];
  const body = tab === 'swiped' ? 'New likes and passes will appear here.' : tab === 'strong' ? 'Insights appear as profile interests and intentions are collected.' : 'Refresh Tinder to import active conversations and recent messages.';
  return (
    <FeedbackState
      kind={loading ? 'loading' : 'empty'}
      icon={`${config.icon}-outline`}
      title={loading ? 'Updating connections' : `No ${config.full.toLowerCase()} yet`}
      message={body}
      compact
      style={styles.empty}
    />
  );
}

export default function TinderCollections({ settings, onConnect }) {
  const [state, setState] = useState(getCollections);
  const [tab, setTab] = useState('swiped');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const update = auth => auth?.isLoggedIn && auth?.token ? activateCollections(auth.token) : disconnectCollections();
    const stop = subscribeCollections(setState); update(getTinderAuthState());
    const stopAuth = subscribeTinderAuthState(update); return () => { stop(); stopAuth(); };
  }, []);
  const lists = useMemo(() => collectionLists(state.data, state.own, settings), [state.data, state.own, settings]);
  const entries = lists[tab], config = TABS[tab], limit = tab === 'swiped' ? 10 : 3;
  const openItem = item => { setSelected(item); setOpen(true); };
  const close = () => { setSelected(null); setOpen(false); };

  return <View style={styles.section}>
    <View style={styles.header}>
      <IconWell icon="people" tone="primary" size={44} iconSize={20} />
      <View style={styles.headerCopy}>
        <AppText variant="overline" color="secondary" numberOfLines={1}>CONNECTION INTELLIGENCE</AppText>
        <AppText variant="title2" numberOfLines={1}>Your connections</AppText>
      </View>
      {state.data && <Badge label="LIVE" tone="success" dot />}
    </View>
    {!state.data ? <LinearGradient colors={[alpha(c.primary, 0.18), alpha(c.secondary, 0.08), c.elevated]} style={styles.connect}>
      <View style={styles.peopleArt} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.artPerson}><Ionicons name="person" size={17} color={c.textSecondary} /></View>
        <LinearGradient colors={[c.primary, c.secondary]} style={styles.artHeart}><Ionicons name="heart" size={27} color={c.onPrimary} /></LinearGradient>
        <View style={styles.artPerson}><Ionicons name="person" size={17} color={c.textSecondary} /></View>
      </View>
      <AppText variant="title2" align="center">{state.loading ? 'Connecting your Tinder data…' : 'See every connection clearly'}</AppText>
      <AppText variant="callout" color="muted" align="center" style={styles.connectText}>Track swipes, find promising profiles and continue active conversations from one beautiful dashboard.</AppText>
      <AppButton
        title={state.loading ? 'Connecting…' : 'Connect Tinder'}
        icon="link"
        onPress={onConnect}
        loading={state.loading}
        style={styles.connectButton}
      />
      {!!state.error && <AppText variant="footnote" color="error" align="center" style={styles.error} accessibilityRole="alert">{state.error}</AppText>}
    </LinearGradient> : <>
      <View style={styles.summaries} accessibilityRole="tablist">{Object.keys(TABS).map(type => <Summary key={type} type={type} count={lists[type].length} active={type === tab} onPress={() => setTab(type)} />)}</View>
      <View style={styles.card}>
        <View style={styles.tabs} accessibilityRole="tablist">{Object.entries(TABS).map(([type, item]) => <Button key={type} style={[styles.tab, tab === type && styles.tabActive]} onPress={() => setTab(type)} accessibilityRole="tab" accessibilityLabel={item.full} accessibilityState={{ selected: tab === type }}><Ionicons name={tab === type ? item.icon : `${item.icon}-outline`} size={15} color={tab === type ? item.color : c.muted} /><Text style={[styles.tabText, tab === type && styles.tabTextActive]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.label}</Text></Button>)}</View>
        <ContentTransition transitionKey={tab} style={styles.content}>
          <View style={styles.listHeader}>
            <View style={styles.listHeaderCopy}>
              <AppText variant="section" numberOfLines={1} accessibilityRole="header">{config.full}</AppText>
              <AppText variant="footnote" numberOfLines={1}>{entries.length} {entries.length === 1 ? 'profile' : 'profiles'}</AppText>
            </View>
            {entries.length > limit && <Button style={styles.viewAll} onPress={() => { setSelected(null); setOpen(true); }} accessibilityRole="button" accessibilityLabel={`View all ${config.full.toLowerCase()}`} hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}><Text style={[styles.viewAllText, { color: config.color }]} maxFontSizeMultiplier={theme.fontScale.chrome}>View all</Text><Ionicons name="arrow-forward" size={14} color={config.color} /></Button>}
          </View>
          {tab === 'strong' && <View style={styles.note}><Ionicons name="information-circle-outline" size={16} color={c.info} /><Text style={styles.noteText} maxFontSizeMultiplier={theme.fontScale.body}>Estimated from shared profile details. This is not a Tinder score.</Text></View>}
          {!!state.error && <AppText variant="footnote" color="error" align="center" style={styles.error}>{state.error}</AppText>}{tab === 'chatting' && !!state.conversationError && <AppText variant="footnote" color="error" align="center" style={styles.error}>{state.conversationError}</AppText>}
          {entries.slice(0, limit).map((item, index) => <ProfileRow key={item.id || item.profileId || item.profile?.id || index} item={item} tab={tab} ownerId={state.data?.ownerId} onPress={() => openItem(item)} />)}
          {!entries.length && <Empty tab={tab} loading={state.loading} />}
        </ContentTransition>
        {tab === 'chatting' && <AppButton variant="secondary" icon="refresh" loading={state.loading} onPress={refreshConversations} title={state.loading ? 'Refreshing conversations…' : 'Refresh conversations'} />}
      </View>
      <View style={styles.sync}><Ionicons name="shield-checkmark-outline" size={14} color={c.success} /><Text style={styles.syncText} maxFontSizeMultiplier={theme.fontScale.body}>Private and saved on this device</Text></View>
    </>}
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modal}>
        <View style={styles.modalHeader}>
          <IconButton icon={selected ? 'arrow-back' : 'close'} onPress={selected ? () => setSelected(null) : close} accessibilityLabel={selected ? 'Back to list' : 'Close connections'} />
          <View style={styles.modalHeading}>
            <AppText variant="overline" numberOfLines={1}>{selected ? config.label.toUpperCase() : 'YOUR CONNECTIONS'}</AppText>
            <AppText variant="section" numberOfLines={1}>{selected?.profile?.name || config.full}</AppText>
          </View>
          <IconWell icon={config.icon} tone={config.tone} size={40} iconSize={18} />
        </View>
        {selected ? <ScrollView contentContainerStyle={[styles.details, { paddingBottom: sp.section }]} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[alpha(c.primary, 0.16), alpha(c.secondary, 0.04), 'transparent']} style={styles.hero}>
            <Avatar profile={selected.profile} large />
            <AppText variant="title" align="center" numberOfLines={2} style={styles.detailName}>{selected.profile?.name || 'Tinder profile'}</AppText>
            {selected.score != null && <Score value={selected.score} />}
            {!!selected.profile?.bio && <AppText variant="callout" color="textSecondary" align="center" style={styles.bio}>{selected.profile.bio}</AppText>}
          </LinearGradient>
          {!!selected.reasons?.length && <View style={styles.detailCard}><AppText variant="overline" color="secondary" accessibilityRole="header">WHY YOU MAY CONNECT</AppText><View style={styles.chips}>{selected.reasons.map(reason => <View key={reason} style={styles.reason}><Ionicons name="sparkles" size={12} color={TABS.strong.color} /><Text style={styles.reasonText} maxFontSizeMultiplier={theme.fontScale.body}>{reason}</Text></View>)}</View><AppText variant="caption">Estimated fit: {selected.score}/100. Missing profile data does not increase the score.</AppText></View>}
          {!!selected.profile?.interests?.length && <View style={styles.detailCard}><AppText variant="overline" color="secondary" accessibilityRole="header">INTERESTS</AppText><View style={styles.chips}>{selected.profile.interests.map(value => <View key={value} style={styles.interest}><Text style={styles.interestText} maxFontSizeMultiplier={theme.fontScale.body}>{value}</Text></View>)}</View></View>}
          {!!selected.action && <View style={styles.actionDetail}><IconWell icon={selected.action === 'like' ? 'heart' : 'close'} tone={config.tone} size={44} iconSize={18} /><View style={styles.actionCopy}><AppText variant="bodyStrong">{selected.action === 'like' ? 'You liked this profile' : 'You passed this profile'}</AppText><AppText variant="footnote">{new Date(selected.swipedAt).toLocaleString()}</AppText></View></View>}
          {!!selected.messages?.length && <View style={styles.detailCard}><AppText variant="overline" color="secondary" accessibilityRole="header">RECENT MESSAGES</AppText>{selected.messages.map(message => { const mine = message.senderId === state.data?.ownerId; return <View key={message.id} style={[styles.message, mine && styles.mine]}><Text style={styles.sender} maxFontSizeMultiplier={theme.fontScale.chrome}>{mine ? 'YOU' : selected.profile?.name?.toUpperCase() || 'MATCH'}</Text><Text style={styles.messageText} maxFontSizeMultiplier={theme.fontScale.body}>{message.text || 'Media message'}</Text></View>; })}</View>}
        </ScrollView> : <FlatList data={entries} keyExtractor={(item, index) => String(item.id || item.profileId || item.profile?.id || index)} renderItem={({ item }) => <ProfileRow item={item} tab={tab} ownerId={state.data?.ownerId} onPress={() => setSelected(item)} />} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={<Empty tab={tab} loading={state.loading} />} contentContainerStyle={[styles.modalList, { paddingBottom: sp.section }]} />}
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: sp.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  headerCopy: { flex: 1, minWidth: 0 },

  // Connect (no data yet)
  connect: { padding: sp.xxl, borderRadius: r.xl, borderWidth: 1, borderColor: c.primaryBorder, alignItems: 'center' },
  peopleArt: { height: 70, flexDirection: 'row', alignItems: 'center', gap: sp.lg, marginBottom: sp.md },
  artPerson: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.elevatedHigh, borderWidth: 1, borderColor: c.border },
  artHeart: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...theme.shadows.glow },
  connectText: { marginTop: sp.sm },
  connectButton: { marginTop: sp.xl },
  error: { marginTop: sp.sm },

  // Summary tiles
  summaries: { flexDirection: 'row', gap: sp.sm },
  summary: { flex: 1, minWidth: 0, minHeight: 112, borderRadius: r.card, padding: sp.md, gap: sp.xs, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryCount: { ...t.title, fontFamily: theme.fonts.strong, color: c.text, fontVariant: ['tabular-nums'], maxWidth: '100%' },
  summaryLabel: { ...t.caption, color: c.muted },

  // List card
  card: { borderRadius: r.xl, padding: sp.md, gap: sp.lg, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.hairline },
  tabs: { flexDirection: 'row', gap: sp.xs, padding: sp.xs, borderRadius: r.lg, backgroundColor: c.background },
  tab: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: sp.xs, borderRadius: r.md, borderWidth: 1, borderColor: 'transparent' },
  tabActive: { backgroundColor: c.surface, borderColor: c.border },
  tabText: { ...t.buttonSmall, color: c.muted, flexShrink: 1 },
  tabTextActive: { color: c.text },
  content: { gap: sp.sm },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.md, paddingHorizontal: sp.xs },
  listHeaderCopy: { flex: 1, minWidth: 0 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: sp.xs, minHeight: 44 },
  viewAllText: { ...t.buttonSmall },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: sp.sm, padding: sp.md, borderRadius: r.md, backgroundColor: c.infoSoft, borderWidth: 1, borderColor: c.infoBorder },
  noteText: { ...t.footnote, color: c.textSecondary, flex: 1 },

  // Profile rows
  row: { flexDirection: 'row', alignItems: 'center', gap: sp.md, minHeight: 86, padding: sp.md, borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  avatarFrame: { borderRadius: r.md, overflow: 'hidden', borderWidth: 1, borderColor: c.hairline },
  avatar: { width: 54, height: 64 },
  avatarLarge: { width: 108, height: 126, borderRadius: r.xl },
  avatarImage: { resizeMode: 'cover' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  name: { ...t.headline, fontFamily: theme.fonts.heading, color: c.text, flex: 1, minWidth: 0 },
  time: { ...t.caption, color: c.muted, fontVariant: ['tabular-nums'] },
  subtitle: { ...t.footnote, color: c.textSecondary, marginTop: sp.xxs },
  meta: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: sp.xs },
  metaText: { ...t.caption, color: c.muted, flexShrink: 1 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  chevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.elevated },
  score: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: c.background },
  scoreValue: { ...t.label, fontFamily: theme.fonts.strong, fontVariant: ['tabular-nums'] },
  scoreUnit: { ...t.caption, fontSize: 10, lineHeight: 13, color: c.muted },

  // Empty state container (FeedbackState inside a dashed well)
  empty: { borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border },

  sync: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  syncText: { ...t.caption, color: c.muted },

  // Full-screen list / detail modal
  modal: { flex: 1, backgroundColor: c.background },
  modalHeader: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: sp.md, paddingHorizontal: sp.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider },
  modalHeading: { flex: 1, minWidth: 0 },
  modalList: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', padding: sp.lg },
  separator: { height: sp.sm },
  details: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', paddingHorizontal: sp.lg, gap: sp.lg },
  hero: { alignItems: 'center', paddingTop: sp.section - 4, paddingBottom: sp.xl, borderRadius: r.xl },
  detailName: { marginTop: sp.md, marginBottom: sp.sm },
  bio: { marginTop: sp.md },
  detailCard: { gap: sp.md, padding: sp.lg, borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: r.pill, backgroundColor: c.secondarySoft, maxWidth: '100%' },
  reasonText: { ...t.subhead, color: c.textSecondary, flexShrink: 1 },
  interest: { paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: r.pill, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.borderSubtle },
  interestText: { ...t.subhead, color: c.textSecondary },
  actionDetail: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.lg, borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  actionCopy: { flex: 1, minWidth: 0 },
  message: { alignSelf: 'flex-start', maxWidth: '88%', gap: sp.xs, padding: sp.md, borderRadius: r.lg, backgroundColor: c.elevated },
  mine: { alignSelf: 'flex-end', backgroundColor: c.primarySoft },
  sender: { ...t.overline, fontSize: 10, color: c.secondary },
  messageText: { ...t.callout, color: c.text },
});
