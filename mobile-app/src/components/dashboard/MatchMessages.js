// Home "Chats" section: your active Tinder conversations and who you're chatting with.
// Read-only view of the conversations the collections service already keeps on this device.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppText, BottomSheet, FadeIn, MotionTouchable, SkeletonRow } from '../ui';
import ActivityIndicator from '../common/SafeActivityIndicator';
import { getCollections, refreshConversations, subscribeCollections } from '../../services/tinderCollections';
import { createStyles, theme, alpha } from '../../theme';

const c = theme.colors;
const t = theme.type;
const sp = theme.spacing;
const r = theme.radius;

const PREVIEW_LIMIT = 4;

const timeAgo = (value) => {
  if (!value) return '';
  const age = Date.now() - value;
  if (age < 60000) return 'Now';
  if (age < 3600000) return `${Math.floor(age / 60000)}m`;
  if (age < 86400000) return `${Math.floor(age / 3600000)}h`;
  if (age < 604800000) return `${Math.floor(age / 86400000)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const clock = (value) => (value ? new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

function Avatar({ profile, size = 52, ring = false }) {
  const [failedUri, setFailedUri] = useState(null);
  const uri = profile?.photos?.[0];
  const inner = size - (ring ? 6 : 0);
  const face = uri && failedUri !== uri ? (
    <Image source={{ uri }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} onError={() => setFailedUri(uri)} accessibilityIgnoresInvertColors />
  ) : (
    <LinearGradient colors={[c.elevatedHigh, c.surface]} style={[styles.avatarFallback, { width: inner, height: inner, borderRadius: inner / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: Math.round(inner * 0.4) }]} maxFontSizeMultiplier={theme.fontScale.chrome}>
        {(profile?.name || '?').slice(0, 1).toUpperCase()}
      </Text>
    </LinearGradient>
  );
  if (!ring) return face;
  return (
    <LinearGradient colors={theme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ padding: 2, borderRadius: size / 2, backgroundColor: c.surface }}>{face}</View>
    </LinearGradient>
  );
}

function ConversationRow({ item, ownerId, onPress, divider, index }) {
  const latest = item.messages?.[0];
  const theirTurn = latest && latest.senderId !== ownerId;
  const name = item.profile?.name || 'Tinder match';
  const preview = latest ? `${latest.senderId === ownerId ? 'You: ' : ''}${latest.text || 'Sent a photo or GIF'}` : 'Open conversation';
  const row = (
    <MotionTouchable
      onPress={onPress}
      pressScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${name}${theirTurn ? ', new message' : ''}. ${preview}. ${timeAgo(item.lastActivityAt)}`}
      style={[styles.row, divider && styles.rowDivider]}
    >
      <View>
        <Avatar profile={item.profile} size={54} ring={theirTurn} />
        {theirTurn ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, theirTurn && styles.rowNameStrong]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{name}</Text>
          <Text style={[styles.rowTime, theirTurn && styles.rowTimeStrong]} maxFontSizeMultiplier={theme.fontScale.chrome}>{timeAgo(item.lastActivityAt)}</Text>
        </View>
        <Text style={[styles.rowPreview, theirTurn && styles.rowPreviewStrong]} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.body}>{preview}</Text>
        {theirTurn ? (
          <View style={styles.turnPill}>
            <Ionicons name="chatbubble-ellipses" size={11} color={c.accent} />
            <Text style={styles.turnText} maxFontSizeMultiplier={theme.fontScale.chrome}>Your turn to reply</Text>
          </View>
        ) : null}
      </View>
    </MotionTouchable>
  );
  return index < 6 ? <FadeIn delay={index * 40} offset={6}>{row}</FadeIn> : row;
}

function ConversationDetail({ item, ownerId, onOpenTinder, onClose }) {
  const { width } = useWindowDimensions();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failedUri, setFailedUri] = useState(null);
  const profile = item.profile || {};
  const photos = profile.photos || [];
  const uri = photos[photoIndex] || photos[0];
  const heroHeight = Math.min(380, Math.round(Math.min(width, 640) * 0.95));
  const thread = [...(item.messages || [])].reverse(); // oldest first
  const facts = [
    profile.lookingFor && { icon: 'heart-circle-outline', text: `Looking for ${profile.lookingFor}` },
    profile.languages?.length && { icon: 'language-outline', text: profile.languages.slice(0, 4).join(', ') },
  ].filter(Boolean);

  return (
    <View style={styles.detail}>
      <MotionTouchable
        onPress={() => photos.length > 1 && setPhotoIndex((i) => (i + 1) % photos.length)}
        pressScale={0.99}
        accessibilityRole="imagebutton"
        accessibilityLabel={photos.length > 1 ? `Photo ${photoIndex + 1} of ${photos.length}. Tap for next photo` : `${profile.name || 'Match'} photo`}
        style={[styles.hero, { height: heroHeight }]}
      >
        {uri && failedUri !== uri ? (
          <Image source={{ uri }} style={[StyleSheet.absoluteFill, styles.heroImage]} onError={() => setFailedUri(uri)} accessibilityIgnoresInvertColors />
        ) : (
          <LinearGradient colors={[c.elevatedHigh, c.surface]} style={[StyleSheet.absoluteFill, styles.avatarFallback]}>
            <Text style={styles.heroInitial} maxFontSizeMultiplier={theme.fontScale.chrome}>{(profile.name || '?').slice(0, 1).toUpperCase()}</Text>
          </LinearGradient>
        )}
        <LinearGradient pointerEvents="none" colors={[alpha(c.background, 0), alpha(c.background, 0.92)]} start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        {photos.length > 1 ? (
          <View style={styles.pager} pointerEvents="none">
            {photos.map((p, i) => <View key={`${p}-${i}`} style={[styles.pagerBar, i === photoIndex && styles.pagerBarActive]} />)}
          </View>
        ) : null}
        <View style={styles.heroCopy} pointerEvents="none">
          <View style={styles.matchBadge}>
            <Ionicons name="chatbubbles" size={12} color={c.onPrimary} />
            <Text style={styles.matchBadgeText} maxFontSizeMultiplier={theme.fontScale.chrome}>Your match</Text>
          </View>
          <Text style={styles.heroName} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.chrome}>{profile.name || 'Tinder match'}</Text>
          {item.lastActivityAt ? (
            <Text style={styles.heroMeta} maxFontSizeMultiplier={theme.fontScale.chrome}>{timeAgo(item.lastActivityAt) === 'Now' ? 'Active now' : `Active ${timeAgo(item.lastActivityAt)} ago`}</Text>
          ) : null}
        </View>
      </MotionTouchable>

      {profile.bio ? (
        <View style={styles.block}>
          <AppText variant="overline" color="secondary">ABOUT</AppText>
          <AppText variant="body" color="text">{profile.bio}</AppText>
        </View>
      ) : null}

      {facts.length ? (
        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact.text} style={styles.fact}>
              <Ionicons name={fact.icon} size={16} color={c.accent} />
              <AppText variant="callout" color="textSecondary" numberOfLines={2} style={styles.flex}>{fact.text}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      {profile.interests?.length ? (
        <View style={styles.block}>
          <AppText variant="overline" color="secondary">INTERESTS</AppText>
          <View style={styles.chips}>
            {profile.interests.slice(0, 10).map((interest) => (
              <View key={interest} style={styles.chip}>
                <Text style={styles.chipText} maxFontSizeMultiplier={theme.fontScale.body}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <AppText variant="overline" color="secondary">RECENT MESSAGES</AppText>
        <View style={styles.thread}>
          {thread.map((message) => {
            const mine = message.senderId === ownerId;
            return (
              <View key={message.id} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                {mine ? (
                  <LinearGradient colors={theme.gradients.brandShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}>
                    <Text style={styles.bubbleTextMine} maxFontSizeMultiplier={theme.fontScale.body}>{message.text || 'Photo or GIF'}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, styles.bubbleTheirs]}>
                    <Text style={styles.bubbleText} maxFontSizeMultiplier={theme.fontScale.body}>{message.text || 'Photo or GIF'}</Text>
                  </View>
                )}
                <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]} maxFontSizeMultiplier={theme.fontScale.chrome}>
                  {mine ? 'You' : profile.name || 'Match'} · {clock(message.sentAt)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <AppButton title="Reply in Tinder" icon="chatbubble-ellipses" onPress={() => { onClose(); onOpenTinder?.(); }} />
    </View>
  );
}

export default function MatchMessages({ settings, isLoggedIn, onOpenTinder }) {
  const [state, setState] = useState(getCollections);
  const [selected, setSelected] = useState(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => subscribeCollections(setState), []);

  const ownerId = state.data?.ownerId;
  // Every non-archived conversation saved on this device, newest first. Read directly (not via the
  // "chatting" list) so a match whose message text wasn't included by Tinder still shows up.
  const conversations = useMemo(() => {
    const data = state.data;
    if (!data) return [];
    const profiles = data.profiles || {};
    return Object.values(data.conversations || {})
      .filter((item) => !item.archived)
      .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
      .map((item) => ({ ...item, messages: item.messages || [], profile: profiles[item.profileId] }));
  }, [state.data]);

  // If the collection loaded but no chats are saved yet, ask Tinder once (existing refresh, read-only).
  const refreshedOnce = useRef(false);
  useEffect(() => {
    if (!isLoggedIn || !state.data || state.loading || conversations.length || refreshedOnce.current) return;
    refreshedOnce.current = true;
    refreshConversations().catch(() => {});
  }, [isLoggedIn, state.data, state.loading, conversations.length]);

  if (!isLoggedIn) return null;

  // Status card while there is nothing to list — shows why, instead of an empty space.
  if (!conversations.length) {
    const loading = state.loading;
    const problem = state.conversationError || state.error;
    const notConnected = !state.data && !loading;
    return (
      <View style={styles.section}>
        <View style={styles.headerCopy}>
          <AppText variant="overline" color="secondary">CHATS</AppText>
          <AppText variant="title2" accessibilityRole="header">Your chats</AppText>
        </View>
        <View style={styles.card}>
          {loading ? (
            <View accessibilityLiveRegion="polite">
              <SkeletonRow />
              <SkeletonRow />
              <View style={styles.statusLine}>
                <ActivityIndicator size={14} color={c.accent} />
                <AppText variant="footnote">Loading your Tinder chats…</AppText>
              </View>
            </View>
          ) : (
            <View style={styles.status} accessibilityLiveRegion="polite">
              <Ionicons
                name={problem ? 'cloud-offline-outline' : notConnected ? 'link-outline' : 'chatbubbles-outline'}
                size={26}
                color={problem ? c.error : c.accent}
              />
              <AppText variant="bodyStrong" align="center">
                {problem ? 'Couldn’t load your chats' : notConnected ? 'Chats aren’t connected yet' : 'No chats loaded yet'}
              </AppText>
              <AppText variant="footnote" align="center" style={styles.statusText}>
                {problem
                  || (notConnected
                    ? 'Open Tinder in the app and stay signed in — your chats will load here.'
                    : 'Tap refresh to load your conversations from Tinder.')}
              </AppText>
              <AppButton
                title={notConnected ? 'Open Tinder' : 'Refresh chats'}
                icon={notConnected ? 'flame' : 'refresh'}
                size="sm"
                variant="secondary"
                fullWidth={false}
                onPress={() => (notConnected ? onOpenTinder?.() : refreshConversations().catch(() => {}))}
                style={styles.statusButton}
              />
            </View>
          )}
        </View>
      </View>
    );
  }
  const waiting = conversations.filter((item) => item.messages?.[0] && item.messages[0].senderId !== ownerId).length;
  const preview = conversations.slice(0, PREVIEW_LIMIT);
  const open = (item) => setSelected(item);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="overline" color="secondary">CHATS</AppText>
          <AppText variant="title2" numberOfLines={1} accessibilityRole="header">
            {`You're chatting with ${conversations.length} ${conversations.length === 1 ? 'match' : 'matches'}`}
          </AppText>
          {waiting > 0 ? (
            <AppText variant="footnote" color="accent">{waiting} waiting for your reply</AppText>
          ) : null}
        </View>
        {conversations.length > PREVIEW_LIMIT ? (
          <MotionTouchable onPress={() => setShowAll(true)} accessibilityRole="button" accessibilityLabel="See all chats" hitSlop={10} style={styles.seeAll}>
            <Text style={styles.seeAllText} maxFontSizeMultiplier={theme.fontScale.chrome}>See all</Text>
            <Ionicons name="chevron-forward" size={14} color={c.accent} />
          </MotionTouchable>
        ) : null}
      </View>

      <View style={styles.card}>
        {preview.map((item, index) => (
          <ConversationRow key={item.id} item={item} ownerId={ownerId} index={index} divider={index < preview.length - 1} onPress={() => open(item)} />
        ))}
      </View>

      <BottomSheet visible={showAll} onClose={() => setShowAll(false)} title="Chats" subtitle={`${conversations.length} active ${conversations.length === 1 ? 'chat' : 'chats'}`} closeLabel="Close chats">
        <View style={styles.sheetList}>
          {conversations.map((item, index) => (
            <ConversationRow
              key={item.id}
              item={item}
              ownerId={ownerId}
              index={index}
              divider={index < conversations.length - 1}
              onPress={() => { setShowAll(false); setTimeout(() => open(item), 260); }}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)} closeLabel="Close conversation" maxHeightRatio={0.94}>
        {selected ? <ConversationDetail item={selected} ownerId={ownerId} onOpenTinder={onOpenTinder} onClose={() => setSelected(null)} /> : null}
      </BottomSheet>
    </View>
  );
}

const styles = createStyles(() => ({
  section: { gap: sp.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: sp.md },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  seeAllText: { ...t.buttonSmall, color: c.accent },

  card: { borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, overflow: 'hidden' },
  sheetList: { borderRadius: r.card, backgroundColor: c.elevated, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: sp.md, padding: sp.md + 2 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: theme.fonts.heading, color: c.textSecondary },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: c.primary, borderWidth: 2, borderColor: c.surface },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: sp.sm },
  rowName: { ...t.bodyStrong, color: c.textSecondary, flex: 1, minWidth: 0 },
  rowNameStrong: { fontFamily: theme.fonts.heading, color: c.text },
  rowTime: { ...t.footnote, color: c.muted, fontVariant: ['tabular-nums'] },
  rowTimeStrong: { color: c.accent, fontFamily: theme.fonts.label },
  rowPreview: { ...t.callout, color: c.muted },
  rowPreviewStrong: { color: c.textSecondary },
  turnPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: sp.xs, paddingHorizontal: sp.sm, paddingVertical: 3, borderRadius: r.pill, backgroundColor: c.primarySoft },
  turnText: { ...t.footnote, fontFamily: theme.fonts.label, color: c.accent },
  status: { alignItems: 'center', gap: sp.sm, padding: sp.xl },
  statusText: { maxWidth: 300 },
  statusButton: { alignSelf: 'center', marginTop: sp.xs },
  statusLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.sm, paddingBottom: sp.md },

  detail: { gap: sp.lg, paddingTop: sp.xs },
  hero: { borderRadius: r.xl, overflow: 'hidden', backgroundColor: c.elevated },
  heroImage: { resizeMode: 'cover' },
  heroInitial: { ...t.largeTitle, fontSize: 56, lineHeight: 64, color: c.textSecondary },
  pager: { position: 'absolute', top: sp.sm, left: sp.sm, right: sp.sm, flexDirection: 'row', gap: 4 },
  pagerBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: alpha(c.white, 0.35) },
  pagerBarActive: { backgroundColor: c.white },
  heroCopy: { position: 'absolute', left: sp.lg, right: sp.lg, bottom: sp.lg, gap: sp.xs },
  matchBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: r.pill, backgroundColor: c.primary },
  matchBadgeText: { ...t.overline, color: c.onPrimary, letterSpacing: 0.6 },
  heroName: { ...t.largeTitle, color: c.white },
  heroMeta: { ...t.footnote, color: alpha(c.white, 0.85) },
  block: { gap: sp.sm },
  facts: { gap: sp.md, padding: sp.lg, borderRadius: r.card, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.hairline },
  fact: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  chip: { paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: r.pill, backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.primaryBorder },
  chipText: { ...t.subhead, color: c.textSecondary },
  thread: { gap: sp.md, padding: sp.md, borderRadius: r.card, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.hairline },
  bubbleRow: { alignItems: 'flex-start', gap: 3 },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: { maxWidth: '84%', paddingHorizontal: sp.md + 2, paddingVertical: sp.sm + 2, borderRadius: 18 },
  bubbleTheirs: { backgroundColor: c.elevatedHigh, borderBottomLeftRadius: 6 },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleText: { ...t.callout, color: c.text },
  bubbleTextMine: { ...t.callout, color: c.onPrimary },
  bubbleTime: { ...t.footnote, fontSize: 11, color: c.muted, marginHorizontal: sp.xs },
  bubbleTimeMine: { textAlign: 'right' },
}));
