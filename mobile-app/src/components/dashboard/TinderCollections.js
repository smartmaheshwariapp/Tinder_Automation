import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentTransition, FadeIn, MotionTouchable as Button, useMotionReduced } from '../common/Motion';
import FeedbackState from '../common/FeedbackState';
import { AppButton, AppText, Badge, CountUp, IconButton, IconWell, LiveDot } from '../ui';
import { createStyles, theme, alpha } from '../../theme';
import useResponsive from '../../hooks/useResponsive';
import { getTinderAuthState, subscribeTinderAuthState } from '../../utils/sessionManager';
import { collectionLists } from '../../utils/tinderCollectionsModel';
import { activateCollections, disconnectCollections, getCollections, refreshConversations, subscribeCollections } from '../../services/tinderCollections';

const c = theme.colors;
const t = theme.type;
const sp = theme.spacing;
const r = theme.radius;

// Colours are read on access so an Appearance change applies without restarting.
const TAB_META = {
  swiped: { label: 'Swiped', full: 'Swiped profiles', icon: 'heart', tone: 'primary', key: 'accent', soft: 'primarySoft', line: 'primaryBorder' },
  strong: { label: 'Strong', full: 'Strong matches', icon: 'sparkles', tone: 'secondary', key: 'secondary', soft: 'secondarySoft', line: 'secondaryBorder' },
  chatting: { label: 'Chats', full: 'Messaged you', icon: 'chatbubbles', tone: 'success', key: 'success', soft: 'successSoft', line: 'successBorder' },
};
const buildTab = (id) => {
  const meta = TAB_META[id];
  if (!meta) return undefined;
  return { ...meta, color: theme.colors[meta.key], tint: theme.colors[meta.soft], border: theme.colors[meta.line] };
};
const TABS = new Proxy({}, {
  get: (_, key) => (typeof key === 'string' ? buildTab(key) : undefined),
  has: (_, key) => key in TAB_META,
  ownKeys: () => Object.keys(TAB_META),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true, value: undefined }),
});
const STAGGER = 35; // FadeIn step for rail items (≤ 40ms)
const shadeFn = () => ['transparent', alpha(theme.colors.background, 0.35), alpha(theme.colors.background, 0.94)];
const relativeTime = value => {
  if (!value) return '';
  const age = Date.now() - value;
  if (age < 60000) return 'Now';
  if (age < 3600000) return `${Math.floor(age / 60000)}m`;
  if (age < 86400000) return `${Math.floor(age / 3600000)}h`;
  if (age < 604800000) return `${Math.floor(age / 86400000)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const initialsOf = name => {
  const value = String(name || '').trim();
  if (!value || value === 'Tinder profile') return '';
  return value.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
};
const swipeSubtitle = item => item.action === 'like' ? (item.matched ? 'Liked · It’s a match' : 'You liked this profile') : 'You passed this profile';
const itemKey = (item, index) => String(item.id || item.profileId || item.profile?.id || index);

// Photo that fills its parent; falls back to initials (or a person glyph) on a soft gradient when missing or broken.
function Photo({ profile, index = 0, iconSize = 26, textStyle, dim = false }) {
  const [failed, setFailed] = useState(false);
  const raw = profile?.photos?.[index] || profile?.photos?.[0];
  const uri = typeof raw === 'string' ? raw : raw?.url || null;
  if (uri && !failed) return <Image source={{ uri }} resizeMode="cover" style={[styles.photoFill, dim && styles.photoDim]} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  const initials = initialsOf(profile?.name);
  return (
    <LinearGradient colors={[c.elevatedHigh, c.surface]} style={[styles.photoFill, styles.placeholder]}>
      {initials
        ? <Text style={[styles.initials, textStyle]} maxFontSizeMultiplier={theme.fontScale.chrome}>{initials}</Text>
        : <Ionicons name="person-outline" size={iconSize} color={c.textSecondary} />}
    </LinearGradient>
  );
}
function Avatar({ profile, round = false }) {
  return <View style={[styles.avatarFrame, round ? styles.avatarRound : styles.avatar]}><Photo profile={profile} iconSize={22} textStyle={styles.initialsSmall} /></View>;
}
// Previous avatar (kept for reference).
// function Avatar({ profile, large = false }) {
//   const [failed, setFailed] = useState(false);
//   const size = large ? styles.avatarLarge : styles.avatar;
//   return profile?.photos?.[0] && !failed
//     ? <View style={[styles.avatarFrame, size]}><Image source={{ uri: profile.photos[0] }} style={[size, styles.avatarImage]} onError={() => setFailed(true)} accessibilityIgnoresInvertColors /></View>
//     : <LinearGradient colors={[c.elevatedHigh, c.surface]} style={[styles.avatarFrame, size, styles.placeholder]}><Ionicons name="person-outline" size={large ? 38 : 24} color={c.textSecondary} /></LinearGradient>;
// }

// Fit score as a segmented dial (20 ticks — scores move in steps of 20, so every step is visible).
const TICKS = 20;
function ScoreRing({ value, size = 48, big = false, onPhoto = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const color = pct >= 80 ? TABS.chatting.color : TABS.strong.color;
  const filled = Math.round((pct / 100) * TICKS);
  const tickHeight = Math.max(5, Math.round(size * 0.13));
  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, onPhoto && styles.ringOnPhoto]} accessible accessibilityLabel={`Estimated fit ${pct} percent`}>
      {Array.from({ length: TICKS }, (_, i) => (
        <View key={i} pointerEvents="none" style={[styles.tickArm, { transform: [{ rotate: `${(i * 360) / TICKS}deg` }] }]}>
          <View style={[styles.tick, { height: tickHeight, backgroundColor: i < filled ? color : alpha(c.white, 0.14) }]} />
        </View>
      ))}
      <View style={styles.ringCenter}>
        <Text style={[big ? styles.ringValueBig : styles.ringValue, { color }]} maxFontSizeMultiplier={theme.fontScale.chrome}>{pct}</Text>
        <Text style={styles.ringUnit} maxFontSizeMultiplier={theme.fontScale.chrome}>%</Text>
      </View>
    </View>
  );
}
// Previous flat score circle (replaced by ScoreRing).
// function Score({ value }) {
//   const color = value >= 80 ? TABS.chatting.color : TABS.strong.color;
//   return (
//     <View style={[styles.score, { borderColor: color }]} accessible accessibilityLabel={`Estimated fit ${value} percent`}>
//       <Text style={[styles.scoreValue, { color }]} maxFontSizeMultiplier={theme.fontScale.chrome}>{value}</Text>
//       <Text style={styles.scoreUnit} maxFontSizeMultiplier={theme.fontScale.chrome}>%</Text>
//     </View>
//   );
// }

// Summary tiles were merged into the single segmented switcher below (kept for reference).
// function Summary({ type, count, active, onPress }) {
//   const item = TABS[type];
//   return (
//     <Button style={[styles.summary, active && { borderColor: item.color, backgroundColor: item.tint }]} onPress={onPress} accessibilityRole="tab" accessibilityLabel={`${item.full}, ${Number(count).toLocaleString()}`} accessibilityState={{ selected: active }}>
//       <IconWell icon={item.icon} tone={item.tone} size={32} iconSize={16} />
//       <Text style={styles.summaryCount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={theme.fontScale.chrome}>{Number(count).toLocaleString()}</Text>
//       <Text style={styles.summaryLabel} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.label}</Text>
//     </Button>
//   );
// }

// One pill switcher: icon + rolling count on top, tab label below.
function Segments({ tab, lists, onChange }) {
  return (
    <View style={styles.segments} accessibilityRole="tablist">
      {Object.entries(TABS).map(([type, item]) => {
        const active = type === tab, count = lists[type].length;
        return (
          <Button
            key={type}
            style={[styles.segment, active && { backgroundColor: item.tint, borderColor: item.border }]}
            onPress={() => onChange(type)}
            pressScale={0.97}
            accessibilityRole="tab"
            accessibilityLabel={`${item.full}, ${Number(count).toLocaleString()}`}
            accessibilityState={{ selected: active }}
          >
            <View style={styles.segmentTop}>
              <Ionicons name={active ? item.icon : `${item.icon}-outline`} size={14} color={active ? item.color : c.muted} />
              <CountUp value={count} style={[styles.segmentCount, active && styles.segmentCountActive]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome} />
            </View>
            <Text style={[styles.segmentLabel, active && { color: item.color }]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.label}</Text>
          </Button>
        );
      })}
    </View>
  );
}

// Horizontal rail that bleeds to the screen edges while its first card lines up with the page gutter.
function Rail({ gutter, children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={[styles.rail, { paddingHorizontal: gutter }]} decelerationRate="fast">
      {children}
    </ScrollView>
  );
}
function SwipeCard({ item, width, index, onPress }) {
  const profile = item.profile, liked = item.action === 'like', name = profile?.name || 'Tinder profile';
  return (
    <FadeIn delay={Math.min(index, 8) * STAGGER} offset={8}>
      <Button style={[styles.photoCard, { width, height: Math.round(width * 1.36) }]} onPress={onPress} pressScale={0.97} accessibilityRole="button" accessibilityLabel={`${name}. ${swipeSubtitle(item)}`}>
        <Photo profile={profile} dim={!liked} iconSize={30} />
        <LinearGradient colors={shadeFn()} locations={[0.35, 0.6, 1]} style={styles.photoShade} pointerEvents="none" />
        <View style={styles.cardTop} pointerEvents="none">
          <Badge label={liked ? 'LIKED' : 'PASSED'} icon={liked ? 'heart' : 'close'} tone={liked ? TABS.swiped.tone : 'neutral'} size="sm" style={styles.badgeOnPhoto} />
          {liked && item.matched && <LinearGradient colors={theme.gradients.brandShort} style={styles.matchMark}><Ionicons name="heart" size={12} color={c.onPrimary} /></LinearGradient>}
        </View>
        <View style={styles.cardCopy} pointerEvents="none">
          <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{name}</Text>
          <Text style={styles.cardMeta} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.chrome}>{swipeSubtitle(item)}</Text>
        </View>
      </Button>
    </FadeIn>
  );
}
function StrongCard({ item, width, index, onPress }) {
  const profile = item.profile, name = profile?.name || 'Tinder profile', reason = item.reasons?.[0] || 'High estimated compatibility';
  return (
    <FadeIn delay={Math.min(index, 8) * STAGGER} offset={8}>
      <Button style={[styles.strongCard, { width }]} onPress={onPress} pressScale={0.97} accessibilityRole="button" accessibilityLabel={`${name}. Estimated fit ${item.score} percent. ${reason}`}>
        <View style={[styles.strongPhoto, { height: Math.round(width * 0.7) }]}>
          <Photo profile={profile} iconSize={34} />
          <LinearGradient colors={shadeFn()} locations={[0.3, 0.6, 1]} style={styles.photoShade} pointerEvents="none" />
          <View style={styles.strongRing} pointerEvents="none"><ScoreRing value={item.score} size={46} onPhoto /></View>
          <View style={styles.cardCopy} pointerEvents="none">
            <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{name}</Text>
          </View>
        </View>
        <View style={styles.strongBody}>
          <View style={styles.reasonLine}>
            <Ionicons name="sparkles" size={13} color={TABS.strong.color} style={styles.reasonIcon} />
            <Text style={styles.reasonLead} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.body}>{reason}</Text>
          </View>
          <Text style={styles.metaText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.reasons?.[1] || 'Compatibility estimate'}</Text>
        </View>
      </Button>
    </FadeIn>
  );
}
// Rail tail that opens the full list.
function MoreCard({ count, config, index, width, onPress }) {
  return (
    <FadeIn delay={Math.min(index, 8) * STAGGER} offset={8} style={styles.moreWrap}>
      <Button style={[styles.moreCard, { width }]} onPress={onPress} pressScale={0.97} accessibilityRole="button" accessibilityLabel={`View all ${config.full.toLowerCase()}`}>
        <View style={[styles.moreIcon, { backgroundColor: config.tint, borderColor: config.border }]}><Ionicons name="arrow-forward" size={18} color={config.color} /></View>
        <Text style={styles.moreCount} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>+{Number(count).toLocaleString()}</Text>
        <Text style={[styles.moreText, { color: config.color }]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>View all</Text>
      </Button>
    </FadeIn>
  );
}

function ProfileRow({ item, tab, ownerId, onPress }) {
  const profile = item.profile, config = TABS[tab], latest = item.messages?.[0];
  const subtitle = tab === 'swiped'
    ? swipeSubtitle(item)
    : tab === 'strong' ? item.reasons?.[0] || 'High estimated compatibility'
      : `${latest?.senderId === ownerId ? 'You: ' : ''}${latest?.text || 'Open conversation'}`;
  // Chats: the other person spoke last, so it is "your turn" — shown as an unread-style dot.
  const awaiting = tab === 'chatting' && !!latest && latest.senderId !== ownerId;
  const name = profile?.name || 'Tinder profile';
  if (tab === 'chatting') return (
    <Button style={styles.chatRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}. ${subtitle}${awaiting ? '. Awaiting your reply' : ''}`} pressScale={0.985}>
      <View>
        <Avatar profile={profile} round />
        <View style={[styles.presence, { backgroundColor: config.color }]} />
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{name}</Text>
          <Text style={[styles.time, awaiting && { color: config.color }]} maxFontSizeMultiplier={theme.fontScale.chrome}>{relativeTime(item.lastActivityAt)}</Text>
        </View>
        <View style={styles.nameLine}>
          <Text style={[styles.chatPreview, awaiting && styles.chatPreviewUnread]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.body}>{subtitle}</Text>
          {awaiting && <View style={[styles.unreadDot, { backgroundColor: config.color }]} />}
        </View>
        <Text style={styles.metaText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>Active conversation</Text>
      </View>
    </Button>
  );
  return (
    <Button style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}. ${subtitle}`} pressScale={0.985}>
      <Avatar profile={profile} />
      <View style={styles.rowCopy}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{name}</Text>
          {tab === 'swiped' && !!item.swipedAt && <Text style={styles.time} maxFontSizeMultiplier={theme.fontScale.chrome}>{relativeTime(item.swipedAt)}</Text>}
        </View>
        <Text style={styles.subtitle} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.body}>{subtitle}</Text>
        <View style={styles.meta}>
          {tab === 'swiped' && <Badge label={item.action === 'like' ? 'LIKED' : 'PASSED'} icon={item.action === 'like' ? 'heart' : 'close'} tone={item.action === 'like' ? config.tone : 'neutral'} size="sm" />}
          {tab === 'strong' && <Text style={styles.metaText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.reasons?.[1] || 'Compatibility estimate'}</Text>}
        </View>
      </View>
      {tab === 'strong' ? <ScoreRing value={item.score} size={50} /> : <Ionicons name="chevron-forward" size={18} color={c.muted} />}
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
function StrongNote() {
  return <View style={styles.note}><Ionicons name="information-circle-outline" size={16} color={c.info} /><Text style={styles.noteText} maxFontSizeMultiplier={theme.fontScale.body}>Estimated from shared profile details. This is not a Tinder score.</Text></View>;
}

// No-data hero: fanned profile cards around a heart, benefits and the connect CTA.
const BENEFITS = [
  { icon: 'heart', tone: 'primary', text: 'Track every like and pass' },
  { icon: 'sparkles', tone: 'secondary', text: 'Spot strong matches from shared details' },
  { icon: 'chatbubbles', tone: 'success', text: 'Continue active conversations' },
];
function ConnectHero({ loading, error, onConnect }) {
  return (
    <LinearGradient colors={[alpha(c.primary, 0.2), alpha(c.secondary, 0.07), c.surface]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={styles.connect}>
      <View style={styles.connectArt} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <LinearGradient colors={[c.elevatedHigh, c.elevated]} style={[styles.artCard, styles.artCardLeft]}>
          <Ionicons name="person" size={22} color={c.muted} /><View style={styles.artLine} /><View style={[styles.artLine, styles.artLineShort]} />
        </LinearGradient>
        <LinearGradient colors={theme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.artCardCenter}>
          <Ionicons name="heart" size={34} color={c.onPrimary} />
        </LinearGradient>
        <LinearGradient colors={[c.elevatedHigh, c.elevated]} style={[styles.artCard, styles.artCardRight]}>
          <Ionicons name="person" size={22} color={c.muted} /><View style={styles.artLine} /><View style={[styles.artLine, styles.artLineShort]} />
        </LinearGradient>
      </View>
      {/* Previous art: two small person dots around a heart tile.
      <View style={styles.peopleArt} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={styles.artPerson}><Ionicons name="person" size={17} color={c.textSecondary} /></View>
        <LinearGradient colors={[c.primary, c.secondary]} style={styles.artHeart}><Ionicons name="heart" size={27} color={c.onPrimary} /></LinearGradient>
        <View style={styles.artPerson}><Ionicons name="person" size={17} color={c.textSecondary} /></View>
      </View> */}
      <AppText variant="title2" align="center">{loading ? 'Connecting your Tinder data…' : 'See every connection clearly'}</AppText>
      <AppText variant="callout" color="muted" align="center" style={styles.connectText}>Track swipes, find promising profiles and continue active conversations from one beautiful dashboard.</AppText>
      <View style={styles.benefits}>
        {BENEFITS.map(item => (
          <View key={item.text} style={styles.benefit}>
            <IconWell icon={item.icon} tone={item.tone} size={30} iconSize={14} />
            <AppText variant="subhead" color="textSecondary" style={styles.benefitText}>{item.text}</AppText>
          </View>
        ))}
      </View>
      <AppButton
        title={loading ? 'Connecting…' : 'Connect Tinder'}
        icon="link"
        onPress={onConnect}
        loading={loading}
        style={styles.connectButton}
      />
      {!!error && <AppText variant="footnote" color="error" align="center" style={styles.error} accessibilityRole="alert">{error}</AppText>}
      {/* "Private and saved on this device" line removed.
      <View style={styles.connectPrivacy}><Ionicons name="lock-closed-outline" size={12} color={c.muted} /><AppText variant="caption">Private and saved on this device</AppText></View>
      */}
    </LinearGradient>
  );
}

// Large swipeable-by-tap photo header for the profile detail view.
function DetailHero({ item, tab, height }) {
  const profile = item.profile || {};
  const photos = profile.photos || [];
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const name = profile.name || 'Tinder profile';
  const age = profile.age;
  const verified = profile.verified;
  const city = profile.city;
  const distanceMi = profile.distanceMi;
  const locationText = [city, distanceMi != null ? `${distanceMi} mi away` : null].filter(Boolean).join(' · ');

  const status = tab === 'swiped'
    ? <Badge label={item.action === 'like' ? (item.matched ? 'MATCH' : 'LIKED') : 'PASSED'} icon={item.action === 'like' ? 'heart' : 'close'} tone={item.action === 'like' ? TABS.swiped.tone : 'neutral'} size="sm" style={styles.badgeOnPhoto} />
    : tab === 'strong' ? <Badge label="STRONG MATCH" icon="sparkles" tone="secondary" size="sm" style={styles.badgeOnPhoto} />
      : <Badge label="ACTIVE CHAT" dot tone="success" size="sm" style={styles.badgeOnPhoto} />;
  return (
    <View style={[styles.detailHero, { height }]}>
      <Photo key={index} profile={profile} index={index} iconSize={56} textStyle={styles.initialsLarge} />
      {count > 1 && <Button style={StyleSheet.absoluteFill} onPress={() => setIndex((index + 1) % count)} activeOpacity={1} pressScale={1} accessibilityRole="button" accessibilityLabel={`Show photo ${((index + 1) % count) + 1} of ${count}`} />}
      {count > 1 && <View style={styles.pager} pointerEvents="none">{photos.map((uri, i) => <View key={`${uri}-${i}`} style={[styles.pagerBar, i === index && styles.pagerBarActive]} />)}</View>}
      <LinearGradient colors={['transparent', alpha(c.background, 0.5), c.background]} locations={[0.45, 0.72, 1]} style={styles.photoShade} pointerEvents="none" />
      <View style={styles.detailHeroCopy} pointerEvents="none">
        <View style={styles.detailHeroText}>
          <View style={styles.heroBadgeRow}>
            {status}
            {verified && <Badge label="VERIFIED" icon="checkmark-circle" tone="secondary" size="sm" style={styles.badgeOnPhoto} />}
          </View>
          <AppText variant="title" numberOfLines={2} style={styles.detailName}>{name}{age ? `, ${age}` : ''}</AppText>
          {!!locationText && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={alpha(c.white, 0.85)} />
              <Text style={styles.locationText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{locationText}</Text>
            </View>
          )}
        </View>
        {item.score != null && <ScoreRing value={item.score} size={66} big onPhoto />}
      </View>
    </View>
  );
}

export default function TinderCollections({ settings, onConnect }) {
  const [state, setState] = useState(getCollections);
  const [tab, setTab] = useState('swiped');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const reduced = useMotionReduced();
  const { gutter, isCompact, isTablet, isLandscape, columns, contentWidth, contentMax, width: windowWidth, height: windowHeight, pick } = useResponsive();
  useEffect(() => {
    const update = auth => auth?.isLoggedIn && auth?.token ? activateCollections(auth.token) : disconnectCollections();
    const stop = subscribeCollections(setState); update(getTinderAuthState());
    const stopAuth = subscribeTinderAuthState(update); return () => { stop(); stopAuth(); };
  }, []);
  const lists = useMemo(() => {
    const base = collectionLists(state.data, state.own, settings);
    const profiles = state.data?.profiles || {};
    const chatting = Object.values(state.data?.conversations || {})
      .filter(item => !item.archived)
      .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
      .map(item => ({ ...item, profile: profiles[item.profileId] || item.profile || { name: 'Tinder match' } }));
    return { ...base, chatting: chatting.length > 0 ? chatting : base.chatting };
  }, [state.data, state.own, settings]);
  const config = TABS[tab];
  const entries = lists[tab];
  // Rails and the chats preview show more before the "view all" tail once there is room.
  const limit = tab === 'swiped' ? (isTablet ? 16 : 10) : (isTablet ? 6 : 3);
  const openItem = item => { setSelected(item); setOpen(true); };
  const openList = () => { setSelected(null); setOpen(true); };
  const close = () => { setSelected(null); setOpen(false); };
  const swipeWidth = pick({ phone: isCompact ? 118 : 132, tablet: 150, xl: 164 });
  // Strong-match cards: one comfortable card on phones, `columns` across the reading column on tablets.
  const strongWidth = isTablet
    ? Math.round((contentWidth - sp.md * (columns - 1)) / columns)
    : Math.min(236, Math.round(contentWidth * 0.74));
  // Chats preview and the full list go multi-column once the reading column is wide enough.
  const rowColumns = isTablet ? Math.min(columns, 2) : 1;
  const heroHeight = Math.min(
    Math.round((Math.min(windowWidth, contentMax) - sp.lg * 2) * 1.12),
    Math.round(windowHeight * (isLandscape ? 0.6 : 0.68)),
    480,
  );
  const ownerId = state.data?.ownerId;

  return <View style={styles.section}>
    <View style={styles.header}>
      {/* <IconWell icon="people" tone="primary" size={44} iconSize={20} /> */}
      <View style={styles.headerCopy}>
        <View style={styles.eyebrow}>
          {state.data && <LiveDot size={7} />}
          <AppText variant="overline" color="secondary" numberOfLines={1} style={styles.eyebrowText}>CONNECTION INTELLIGENCE</AppText>
        </View>
        <AppText variant="title2" numberOfLines={1}>Your connections</AppText>
      </View>
      {/* {state.data && <Badge label="LIVE" tone="success" dot />} */}
      {state.data && !!entries.length && tab !== 'chatting' && <Button style={styles.seeAll} onPress={openList} accessibilityRole="button" accessibilityLabel={`View all ${config.full.toLowerCase()}`} hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}>
        <Text style={styles.seeAllText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>See all</Text>
        <Ionicons name="chevron-forward" size={15} color={c.accent} />
      </Button>}
    </View>
    {!state.data ? <ConnectHero loading={state.loading} error={state.error} onConnect={onConnect} /> : <>
      {/* <View style={styles.summaries} accessibilityRole="tablist">{Object.keys(TABS).map(type => <Summary key={type} type={type} count={lists[type].length} active={type === tab} onPress={() => setTab(type)} />)}</View> */}
      {/* Inner tabs merged into Segments:
      <View style={styles.tabs} accessibilityRole="tablist">{Object.entries(TABS).map(([type, item]) => <Button key={type} style={[styles.tab, tab === type && styles.tabActive]} onPress={() => setTab(type)} accessibilityRole="tab" accessibilityLabel={item.full} accessibilityState={{ selected: tab === type }}><Ionicons name={tab === type ? item.icon : `${item.icon}-outline`} size={15} color={tab === type ? item.color : c.muted} /><Text style={[styles.tabText, tab === type && styles.tabTextActive]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.label}</Text></Button>)}</View> */}
      <Segments tab={tab} lists={lists} onChange={setTab} />
      <ContentTransition transitionKey={tab} style={styles.content}>
        <View style={styles.listHeader}>
          <AppText variant="headline" numberOfLines={1} accessibilityRole="header" style={styles.listHeaderTitle}>{config.full}</AppText>
          <AppText variant="footnote" numberOfLines={1}>{entries.length} {tab === 'chatting' ? (entries.length === 1 ? 'person' : 'people') : (entries.length === 1 ? 'profile' : 'profiles')}</AppText>
        </View>
        {!!state.error && <AppText variant="footnote" color="error" align="center" style={styles.error}>{state.error}</AppText>}{/* Chat refresh error text ("Could not refresh Tinder conversations…") hidden.
        {tab === 'chatting' && !!state.conversationError && <AppText variant="footnote" color="error" align="center" style={styles.error}>{state.conversationError}</AppText>} */}
        {!!entries.length && tab === 'swiped' && <Rail gutter={gutter}>
          {entries.slice(0, limit).map((item, index) => <SwipeCard key={itemKey(item, index)} item={item} index={index} width={swipeWidth} onPress={() => openItem(item)} />)}
          {entries.length > limit && <MoreCard count={entries.length - limit} config={config} index={limit} width={Math.round(swipeWidth * 0.72)} onPress={openList} />}
        </Rail>}
        {!!entries.length && tab === 'strong' && <Rail gutter={gutter}>
          {entries.slice(0, limit).map((item, index) => <StrongCard key={itemKey(item, index)} item={item} index={index} width={strongWidth} onPress={() => openItem(item)} />)}
          {entries.length > limit && <MoreCard count={entries.length - limit} config={config} index={limit} width={96} onPress={openList} />}
        </Rail>}
        {tab === 'strong' && <StrongNote />}
        {!!entries.length && tab === 'chatting' && <View style={[styles.chatList, rowColumns > 1 && styles.chatGrid]}>
          {entries.slice(0, limit).map((item, index) => <FadeIn key={itemKey(item, index)} delay={index * STAGGER} offset={6} style={rowColumns > 1 ? styles.chatCell : undefined}>
            {rowColumns === 1 && index > 0 && <View style={styles.chatDivider} />}
            <ProfileRow item={item} tab={tab} ownerId={ownerId} onPress={() => openItem(item)} />
          </FadeIn>)}
          {entries.length > limit && <Button style={[styles.chatMore, rowColumns > 1 && styles.chatMoreGrid]} onPress={openList} accessibilityRole="button" accessibilityLabel={`View all ${config.full.toLowerCase()}`}>
            <Text style={[styles.moreText, { color: config.color }]} maxFontSizeMultiplier={theme.fontScale.chrome}>View all {entries.length} conversations</Text>
            <Ionicons name="arrow-forward" size={14} color={config.color} />
          </Button>}
        </View>}
        {!entries.length && <Empty tab={tab} loading={state.loading} />}
      </ContentTransition>
      {tab === 'chatting' && <AppButton variant="secondary" size="sm" icon="refresh" loading={state.loading} onPress={refreshConversations} title={state.loading ? 'Refreshing conversations…' : 'Refresh conversations'} />}
      {/* "Private and saved on this device" line removed.
      <View style={styles.sync}><Ionicons name="shield-checkmark-outline" size={14} color={c.success} /><Text style={styles.syncText} maxFontSizeMultiplier={theme.fontScale.body}>Private and saved on this device</Text></View>
      */}
    </>}
    <Modal visible={open} animationType={reduced ? 'fade' : 'slide'} presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modal}>
        <View style={[styles.modalHeader, { maxWidth: contentMax }]}>
          <IconButton variant="plain" icon="chevron-back" iconSize={26} onPress={selected ? () => setSelected(null) : close} accessibilityLabel={selected ? 'Back to list' : 'Close connections'} />
          <View style={styles.modalHeading}>
            <AppText variant="overline" numberOfLines={1} align="center">{selected ? config.label.toUpperCase() : 'YOUR CONNECTIONS'}</AppText>
            <AppText variant="section" numberOfLines={1} align="center">{selected?.profile?.name || config.full}</AppText>
          </View>
          <IconWell icon={config.icon} tone={config.tone} size={36} iconSize={16} style={styles.modalIcon} />
        </View>
        {selected ? <ScrollView contentContainerStyle={[styles.details, { maxWidth: contentMax, paddingBottom: sp.section }]} showsVerticalScrollIndicator={false}>
          <FadeIn><DetailHero key={itemKey(selected, 0)} item={selected} tab={tab} height={heroHeight} /></FadeIn>
          {/* Previous hero: small avatar + centered name/score on a soft gradient.
          <LinearGradient colors={[alpha(c.primary, 0.16), alpha(c.secondary, 0.04), 'transparent']} style={styles.hero}>
            <Avatar profile={selected.profile} large />
            <AppText variant="title" align="center" numberOfLines={2} style={styles.detailName}>{selected.profile?.name || 'Tinder profile'}</AppText>
            {selected.score != null && <Score value={selected.score} />}
            {!!selected.profile?.bio && <AppText variant="callout" color="textSecondary" align="center" style={styles.bio}>{selected.profile.bio}</AppText>}
          </LinearGradient> */}
          {!!selected.profile?.lookingFor && (
            <View style={styles.detailCard}>
              <AppText variant="overline" color="secondary" accessibilityRole="header">LOOKING FOR</AppText>
              <View style={styles.vitalsRow}>
                <Ionicons name="heart-outline" size={17} color={c.accent} />
                <AppText variant="bodyStrong" color="text">{selected.profile.lookingFor}</AppText>
              </View>
            </View>
          )}
          {(!!selected.profile?.job || !!selected.profile?.school) && (
            <View style={styles.detailCard}>
              <AppText variant="overline" color="secondary" accessibilityRole="header">WORK & EDUCATION</AppText>
              {!!selected.profile?.job && (
                <View style={styles.vitalsRow}>
                  <Ionicons name="briefcase-outline" size={16} color={c.muted} />
                  <AppText variant="subhead" color="text">{selected.profile.job}</AppText>
                </View>
              )}
              {!!selected.profile?.school && (
                <View style={[styles.vitalsRow, !!selected.profile?.job && { marginTop: 2 }]}>
                  <Ionicons name="school-outline" size={16} color={c.muted} />
                  <AppText variant="subhead" color="text">{selected.profile.school}</AppText>
                </View>
              )}
            </View>
          )}
          {!!selected.profile?.bio && <View style={styles.detailCard}><AppText variant="overline" color="secondary" accessibilityRole="header">ABOUT</AppText><AppText variant="callout" color="textSecondary">{selected.profile.bio}</AppText></View>}
          {!!selected.profile?.questionAnswers?.length && (
            <View style={styles.detailCard}>
              <AppText variant="overline" color="secondary" accessibilityRole="header">PROMPTS & CONVERSATION STARTERS</AppText>
              {selected.profile.questionAnswers.map((qa, i) => (
                <View key={i} style={[styles.promptBubble, i > 0 && { marginTop: sp.sm }]}>
                  {!!qa.question && <Text style={styles.promptQuestion} maxFontSizeMultiplier={theme.fontScale.chrome}>{qa.question}</Text>}
                  <Text style={styles.promptAnswer} maxFontSizeMultiplier={theme.fontScale.body}>{qa.answer}</Text>
                </View>
              ))}
            </View>
          )}
          {!!selected.reasons?.length && <View style={styles.detailCard}><AppText variant="overline" color="secondary" accessibilityRole="header">WHY YOU MAY CONNECT</AppText><View style={styles.chips}>{selected.reasons.map(reason => <View key={reason} style={styles.reason}><Ionicons name="sparkles" size={12} color={TABS.strong.color} /><Text style={styles.reasonText} maxFontSizeMultiplier={theme.fontScale.body}>{reason}</Text></View>)}</View><AppText variant="caption">Estimated fit: {selected.score}/100. Missing profile data does not increase the score.</AppText></View>}
          {!!selected.profile?.descriptors?.length && (
            <View style={styles.detailCard}>
              <AppText variant="overline" color="secondary" accessibilityRole="header">LIFESTYLE & BASICS</AppText>
              <View style={styles.chips}>
                {selected.profile.descriptors.map(item => (
                  <View key={item} style={styles.descriptor}>
                    <Text style={styles.descriptorText} maxFontSizeMultiplier={theme.fontScale.body}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {!!selected.profile?.interests?.length && <View style={styles.detailCard}><AppText variant="overline" color="secondary" accessibilityRole="header">INTERESTS</AppText><View style={styles.chips}>{selected.profile.interests.map(value => <View key={value} style={styles.interest}><Text style={styles.interestText} maxFontSizeMultiplier={theme.fontScale.body}>{value}</Text></View>)}</View></View>}
          {!!selected.action && <View style={styles.actionDetail}><IconWell icon={selected.action === 'like' ? 'heart' : 'close'} tone={selected.action === 'like' ? config.tone : 'neutral'} size={44} iconSize={18} /><View style={styles.actionCopy}><AppText variant="bodyStrong">{selected.action === 'like' ? 'You liked this profile' : 'You passed this profile'}</AppText><AppText variant="footnote">{new Date(selected.swipedAt).toLocaleString()}</AppText></View>{selected.action === 'like' && selected.matched && <Badge label="MATCH" icon="heart" tone="primary" size="sm" />}</View>}
          {!!selected.messages?.length && <View style={styles.detailCard}>
            <AppText variant="overline" color="secondary" accessibilityRole="header">RECENT MESSAGES</AppText>
            {/* Chat order: oldest at the top, newest at the bottom. */}
            {[...selected.messages].reverse().map(message => {
              const mine = message.senderId === ownerId;
              const sender = mine ? 'You' : selected.profile?.name || 'Match';
              const when = relativeTime(message.sentAt);
              return <View key={message.id} style={[styles.bubbleWrap, mine && styles.bubbleWrapMine]} accessible accessibilityLabel={`${sender}: ${message.text || 'Media message'}${when ? `, ${when}` : ''}`}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={styles.messageText} maxFontSizeMultiplier={theme.fontScale.body}>{message.text || 'Media message'}</Text>
                </View>
                <Text style={[styles.sender, mine && styles.senderMine]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{mine ? 'YOU' : selected.profile?.name?.toUpperCase() || 'MATCH'}{when ? ` · ${when}` : ''}</Text>
              </View>;
            })}
          </View>}
        </ScrollView> : <FlatList
          // numColumns cannot change on a mounted list, so the column count is part of the key.
          key={`cols-${rowColumns}`}
          data={entries}
          keyExtractor={itemKey}
          numColumns={rowColumns}
          columnWrapperStyle={rowColumns > 1 ? styles.listRow : undefined}
          renderItem={({ item }) => (
            <View style={rowColumns > 1 ? styles.listCell : undefined}>
              <ProfileRow item={item} tab={tab} ownerId={ownerId} onPress={() => setSelected(item)} />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={<View style={styles.modalListHeader}>
            <AppText variant="footnote">{entries.length} {entries.length === 1 ? 'profile' : 'profiles'}</AppText>
            {tab === 'strong' && <StrongNote />}
          </View>}
          ListEmptyComponent={<Empty tab={tab} loading={state.loading} />}
          contentContainerStyle={[styles.modalList, { maxWidth: contentMax, paddingBottom: sp.section }]}
          showsVerticalScrollIndicator={false}
        />}
      </SafeAreaView>
    </Modal>
  </View>;
}

const styles = createStyles(() => ({
  // Names-only "Messaged you" list
  nameList: { borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, minHeight: 56, paddingHorizontal: sp.lg, paddingVertical: sp.sm },
  nameDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginLeft: sp.lg + 36 + sp.md },
  nameInitial: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  nameInitialText: { ...t.headline, fontFamily: theme.fonts.heading, color: c.onPrimary },
  nameText: { ...t.bodyStrong, color: c.text, flex: 1, minWidth: 0 },
  section: { gap: sp.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: sp.md },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  eyebrowText: { flexShrink: 1, minWidth: 0 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingLeft: sp.sm, flexShrink: 0 },
  seeAllText: { ...t.buttonSmall, color: c.accent },

  // Connect (no data yet)
  connect: { padding: sp.xxl, paddingTop: sp.section, borderRadius: r.xl, borderWidth: 1, borderColor: c.primaryBorder, alignItems: 'center', overflow: 'hidden' },
  connectArt: { height: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: sp.lg },
  artCard: { width: 64, height: 86, borderRadius: r.md, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: c.border },
  artCardLeft: { marginRight: -14, transform: [{ rotate: '-10deg' }, { translateY: 6 }] },
  artCardRight: { marginLeft: -14, transform: [{ rotate: '10deg' }, { translateY: 6 }] },
  artCardCenter: { zIndex: 2, width: 80, height: 108, borderRadius: r.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: alpha(c.white, 0.2), ...theme.shadows.glow },
  artLine: { width: 34, height: 4, borderRadius: 2, backgroundColor: c.border },
  artLineShort: { width: 22 },
  connectText: { marginTop: sp.sm },
  benefits: { alignSelf: 'stretch', gap: sp.sm, marginTop: sp.xl },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: sp.md, minWidth: 0 },
  benefitText: { flex: 1, minWidth: 0 },
  connectButton: { marginTop: sp.xl },
  connectPrivacy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: sp.md },
  error: { marginTop: sp.sm },
  // Previous connect art (commented out in JSX).
  // peopleArt: { height: 70, flexDirection: 'row', alignItems: 'center', gap: sp.lg, marginBottom: sp.md },
  // artPerson: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.elevatedHigh, borderWidth: 1, borderColor: c.border },
  // artHeart: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...theme.shadows.glow },

  // Segmented switcher (replaces summary tiles + inner tabs)
  segments: { flexDirection: 'row', gap: sp.xs, padding: sp.xs, borderRadius: r.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  segment: { flex: 1, minWidth: 0, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 1, paddingHorizontal: sp.xs, paddingVertical: sp.sm - 2, borderRadius: r.lg, borderWidth: 1, borderColor: 'transparent' },
  segmentTop: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  segmentCount: { ...t.headline, fontFamily: theme.fonts.strong, color: c.textSecondary, flexShrink: 1, minWidth: 0 },
  segmentCountActive: { color: c.text },
  segmentLabel: { ...t.caption, fontFamily: theme.fonts.label, color: c.muted, maxWidth: '100%' },
  // Previous summary tiles / tabs (commented out in JSX).
  // summaries: { flexDirection: 'row', gap: sp.sm },
  // summary: { flex: 1, minWidth: 0, minHeight: 112, borderRadius: r.card, padding: sp.md, gap: sp.xs, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, alignItems: 'flex-start', justifyContent: 'space-between' },
  // summaryCount: { ...t.title, fontFamily: theme.fonts.strong, color: c.text, fontVariant: ['tabular-nums'], maxWidth: '100%' },
  // summaryLabel: { ...t.caption, color: c.muted },
  // tabs: { flexDirection: 'row', gap: sp.xs, padding: sp.xs, borderRadius: r.lg, backgroundColor: c.background },
  // tab: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: sp.xs, borderRadius: r.md, borderWidth: 1, borderColor: 'transparent' },
  // tabActive: { backgroundColor: c.surface, borderColor: c.border },
  // tabText: { ...t.buttonSmall, color: c.muted, flexShrink: 1 },
  // tabTextActive: { color: c.text },

  content: { gap: sp.md },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: sp.md },
  listHeaderTitle: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: sp.sm, padding: sp.md, borderRadius: r.md, backgroundColor: c.infoSoft, borderWidth: 1, borderColor: c.infoBorder },
  noteText: { ...t.footnote, color: c.textSecondary, flex: 1, minWidth: 0 },

  // Rails + photo cards
  rail: { gap: sp.md, paddingVertical: sp.xxs },
  photoFill: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  photoDim: { opacity: 0.62 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { ...t.title, fontFamily: theme.fonts.display, color: c.textSecondary },
  initialsSmall: { ...t.headline, fontFamily: theme.fonts.heading },
  initialsLarge: { ...t.largeTitle },
  photoShade: { ...StyleSheet.absoluteFillObject },
  photoCard: { borderRadius: r.lg, overflow: 'hidden', backgroundColor: c.elevated, borderWidth: 1, borderColor: c.hairline },
  cardTop: { position: 'absolute', top: sp.sm, left: sp.sm, right: sp.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeOnPhoto: { backgroundColor: alpha(c.background, 0.72) },
  matchMark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(c.white, 0.3) },
  cardCopy: { position: 'absolute', left: sp.md, right: sp.md, bottom: sp.md, minWidth: 0 },
  cardName: { ...t.headline, fontFamily: theme.fonts.heading, color: c.text, minWidth: 0 },
  cardMeta: { ...t.caption, color: c.textSecondary, minWidth: 0 },
  strongCard: { borderRadius: r.card, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  strongPhoto: { width: '100%', backgroundColor: c.elevated },
  strongRing: { position: 'absolute', top: sp.sm, right: sp.sm },
  strongBody: { padding: sp.md, gap: sp.xs },
  reasonLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  reasonIcon: { marginTop: 3 },
  reasonLead: { ...t.subhead, fontFamily: theme.fonts.label, color: c.text, flex: 1, minWidth: 0 },
  moreWrap: { alignSelf: 'stretch' },
  moreCard: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: sp.xs, padding: sp.sm, borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border },
  moreIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: sp.xs },
  moreCount: { ...t.headline, fontFamily: theme.fonts.strong, color: c.text, fontVariant: ['tabular-nums'] },
  moreText: { ...t.buttonSmall },

  // Chats preview
  chatList: { borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, overflow: 'hidden' },
  // Tablets: the single grouped card becomes a two-across grid of self-contained cards.
  chatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, overflow: 'visible' },
  chatCell: { flexGrow: 1, flexBasis: 280, minWidth: 260, borderRadius: r.card, borderWidth: 1, borderColor: c.borderSubtle, overflow: 'hidden' },
  chatDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.divider, marginLeft: 52 + sp.md * 2 },
  chatMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sp.xs, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
  chatMoreGrid: { width: '100%', borderTopWidth: 0, borderRadius: r.card, borderWidth: 1, borderColor: c.borderSubtle, backgroundColor: c.surface },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: sp.md, minHeight: 76, paddingHorizontal: sp.md, paddingVertical: sp.md, backgroundColor: c.surface },
  presence: { position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: c.surface },
  chatPreview: { ...t.callout, color: c.muted, flex: 1, minWidth: 0 },
  chatPreviewUnread: { color: c.text, fontFamily: theme.fonts.label },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },

  // Profile rows (full list)
  row: { flexDirection: 'row', alignItems: 'center', gap: sp.md, minHeight: 86, padding: sp.md, borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  avatarFrame: { overflow: 'hidden', borderWidth: 1, borderColor: c.hairline, backgroundColor: c.elevated },
  avatar: { width: 56, height: 68, borderRadius: r.md },
  avatarRound: { width: 52, height: 52, borderRadius: 26 },
  // avatarLarge: { width: 108, height: 126, borderRadius: r.xl },
  // avatarImage: { resizeMode: 'cover' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: sp.sm, minWidth: 0 },
  name: { ...t.headline, fontFamily: theme.fonts.heading, color: c.text, flex: 1, minWidth: 0 },
  time: { ...t.caption, color: c.muted, fontVariant: ['tabular-nums'] },
  subtitle: { ...t.footnote, color: c.textSecondary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: sp.xxs },
  metaText: { ...t.caption, color: c.muted, flexShrink: 1, minWidth: 0 },
  // score: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: c.background },
  // scoreValue: { ...t.label, fontFamily: theme.fonts.strong, fontVariant: ['tabular-nums'] },
  // scoreUnit: { ...t.caption, fontSize: 10, lineHeight: 13, color: c.muted },

  // Score ring
  ring: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  ringOnPhoto: { backgroundColor: alpha(c.background, 0.8) },
  tickArm: { ...StyleSheet.absoluteFillObject, alignItems: 'center', paddingTop: 3 },
  tick: { width: 3, borderRadius: 2 },
  ringCenter: { flexDirection: 'row', alignItems: 'baseline' },
  ringValue: { ...t.label, fontFamily: theme.fonts.strong, fontVariant: ['tabular-nums'] },
  ringValueBig: { ...t.title2, fontFamily: theme.fonts.strong, fontVariant: ['tabular-nums'] },
  ringUnit: { ...t.caption, fontSize: 10, lineHeight: 13, color: c.muted },

  // Empty state container (FeedbackState inside a dashed well)
  empty: { borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border },

  sync: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  syncText: { ...t.caption, color: c.muted },

  // Full-screen list / detail modal
  modal: { flex: 1, backgroundColor: c.background },
  modalHeader: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: sp.sm, paddingHorizontal: sp.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider },
  modalHeading: { flex: 1, minWidth: 0 },
  modalIcon: { marginRight: sp.xs },
  // The three maxWidths below are the phone baseline; the modal overrides them with
  // useResponsive().contentMax so tablets use the wider column.
  modalList: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', padding: sp.lg },
  modalListHeader: { gap: sp.sm, marginBottom: sp.md },
  separator: { height: sp.sm },
  // Multi-column full list (tablets).
  listRow: { gap: sp.sm },
  listCell: { flex: 1, minWidth: 0 },
  details: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', paddingHorizontal: sp.lg, paddingTop: sp.lg, gap: sp.lg },
  detailHero: { width: '100%', borderRadius: r.xl, overflow: 'hidden', backgroundColor: c.elevated, borderWidth: 1, borderColor: c.hairline },
  pager: { position: 'absolute', top: sp.sm, left: sp.md, right: sp.md, flexDirection: 'row', gap: sp.xs },
  pagerBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: alpha(c.white, 0.3) },
  pagerBarActive: { backgroundColor: c.white },
  detailHeroCopy: { position: 'absolute', left: sp.lg, right: sp.lg, bottom: sp.lg, flexDirection: 'row', alignItems: 'flex-end', gap: sp.md },
  detailHeroText: { flex: 1, minWidth: 0, gap: sp.xs },
  detailName: { minWidth: 0 },
  // hero: { alignItems: 'center', paddingTop: sp.section - 4, paddingBottom: sp.xl, borderRadius: r.xl },
  // bio: { marginTop: sp.md },
  detailCard: { gap: sp.md, padding: sp.lg, borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: r.pill, backgroundColor: c.secondarySoft, borderWidth: 1, borderColor: c.secondaryBorder, maxWidth: '100%' },
  reasonText: { ...t.subhead, color: c.textSecondary, flexShrink: 1 },
  interest: { paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: r.pill, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.borderSubtle, maxWidth: '100%' },
  interestText: { ...t.subhead, color: c.textSecondary },
  actionDetail: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.lg, borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  actionCopy: { flex: 1, minWidth: 0 },
  bubbleWrap: { alignSelf: 'flex-start', maxWidth: '84%', gap: sp.xxs },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { paddingVertical: sp.sm + 2, paddingHorizontal: sp.md, borderRadius: r.lg },
  bubbleTheirs: { backgroundColor: c.elevated, borderBottomLeftRadius: sp.xs },
  bubbleMine: { backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.primaryBorder, borderBottomRightRadius: sp.xs },
  sender: { ...t.overline, fontSize: 10, color: c.muted, paddingHorizontal: sp.xs },
  senderMine: { color: c.secondary },
  messageText: { ...t.callout, color: c.text },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: sp.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  locationText: { ...t.caption, color: alpha(c.white, 0.85) },
  vitalsRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  promptBubble: { padding: sp.md, borderRadius: r.lg, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.borderSubtle, gap: sp.xs },
  promptQuestion: { ...t.caption, color: c.secondary, fontFamily: theme.fonts.label },
  promptAnswer: { ...t.callout, color: c.text },
  descriptor: { paddingVertical: sp.xs + 2, paddingHorizontal: sp.sm + 2, borderRadius: r.pill, backgroundColor: alpha(c.elevatedHigh, 0.6), borderWidth: 1, borderColor: c.borderSubtle, maxWidth: '100%' },
  descriptorText: { ...t.footnote, color: c.textSecondary },
}));
