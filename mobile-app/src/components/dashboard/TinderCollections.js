import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentTransition, FadeIn, MotionTouchable as Button, useMotionReduced } from '../common/Motion';
import FeedbackState from '../common/FeedbackState';
import { AppButton, AppText, Badge, CountUp, IconButton, IconWell } from '../ui';
import { createStyles, theme, alpha } from '../../theme';
import useResponsive from '../../hooks/useResponsive';
import { getTinderAuthState, subscribeTinderAuthState, getSharedExtensionSettings } from '../../utils/sessionManager';
import { collectionLists, getCommonGround } from '../../utils/tinderCollectionsModel';
import { checkHardFilters, scoreCandidateLocal } from '../../utils/aiMatchScorer';
import { activateCollections, clearSwipes, disconnectCollections, getCollections, refreshConversations, removeSwipe, subscribeCollections } from '../../services/tinderCollections';
import SmartClearModal from './SmartClearModal';

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

const AXIS_DISPLAY_NAMES = {
  'Shared Interests': 'Shared Interests',
  'Lifestyle': 'Lifestyle & Habits',
  'Bio Keywords': 'Bio & Conversation Topics',
  'Career & Education': 'Work & Education',
  'Location': 'Distance & Area',
  'Goal Harmony': 'Dating Intentions',
  'Completeness': 'Profile Quality',
};
const axisDisplayName = (axis) => AXIS_DISPLAY_NAMES[axis] || axis;

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

// Fit score ring as a modern circular gauge (matches Screen 2 & 3).
function ScoreRing({ value, size = 48, big = false, onPhoto = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  // Emerald / Green for >= 75% like reference Screen 2 & 3, Accent for >= 50%, Amber for < 50%
  const color = pct >= 75 ? '#10B981' : pct >= 50 ? (c.accent || '#FF5E7E') : '#F59E0B';
  const borderWidth = big ? 3.5 : 2.5;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
          backgroundColor: onPhoto ? 'rgba(0, 0, 0, 0.78)' : alpha(color, 0.12),
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        onPhoto && theme.shadows.md,
      ]}
      accessible
      accessibilityLabel={`Estimated fit ${pct} percent`}
    >
      <Text
        style={{
          fontFamily: theme.fonts.strong,
          fontVariant: ['tabular-nums'],
          fontSize: big ? Math.round(size * 0.28) : Math.round(size * 0.32),
          lineHeight: big ? Math.round(size * 0.32) : Math.round(size * 0.36),
          color: onPhoto ? '#FFFFFF' : color,
          fontWeight: '700',
        }}
        maxFontSizeMultiplier={theme.fontScale.chrome}
      >
        {pct}
      </Text>
      <Text
        style={{
          fontFamily: theme.fonts.body,
          fontSize: big ? Math.round(size * 0.16) : Math.round(size * 0.18),
          lineHeight: big ? Math.round(size * 0.2) : Math.round(size * 0.22),
          color: onPhoto ? 'rgba(255, 255, 255, 0.85)' : color,
          fontWeight: '600',
          marginLeft: 1,
        }}
        maxFontSizeMultiplier={theme.fontScale.chrome}
      >
        %
      </Text>
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
function SwipeCard({ item, width, index, onPress, showScores = true }) {
  const profile = item.profile, liked = item.action === 'like', name = profile?.name || 'Tinder profile';
  const hasScore = showScores && typeof profile?.matchScore === 'number';
  const matchScore = profile?.matchScore;
  const isLowInfo = (profile?.matchConfidence != null && profile.matchConfidence < 0.3) || profile?.matchLabel === 'Low Info';
  const topTrait = showScores && Array.isArray(profile?.matchBreakdown) && profile.matchBreakdown.length > 0
    ? profile.matchBreakdown[0]?.axis
    : null;

  return (
    <FadeIn delay={Math.min(index, 8) * STAGGER} offset={8}>
      <Button style={[styles.photoCard, { width, height: Math.round(width * 1.36) }]} onPress={onPress} pressScale={0.97} accessibilityRole="button" accessibilityLabel={`${name}. ${hasScore ? `${profile.matchLabel || 'Match'} ${matchScore}%` : swipeSubtitle(item)}`}>
        <Photo profile={profile} dim={!liked} iconSize={30} />
        <LinearGradient colors={shadeFn()} locations={[0.35, 0.6, 1]} style={styles.photoShade} pointerEvents="none" />
        <View style={styles.cardTop} pointerEvents="none">
          <Badge label={liked ? 'LIKED' : 'PASSED'} icon={liked ? 'heart' : 'close'} tone={liked ? TABS.swiped.tone : 'neutral'} size="sm" style={styles.badgeOnPhoto} />
          {hasScore && (
            <View style={[
              styles.scoreBadgeOnCard,
              {
                backgroundColor: isLowInfo
                  ? alpha(c.textSecondary, 0.85)
                  : matchScore >= 70
                    ? alpha(c.success, 0.85)
                    : matchScore >= 40
                      ? alpha(c.warning, 0.85)
                      : alpha(c.error, 0.85),
              }
            ]}>
              <Text style={styles.scoreBadgeText}>
                {isLowInfo ? '?' : `${matchScore}%`}
              </Text>
            </View>
          )}
          {liked && item.matched && <LinearGradient colors={theme.gradients.brandShort} style={styles.matchMark}><Ionicons name="heart" size={12} color={c.onPrimary} /></LinearGradient>}
        </View>
        <View style={styles.cardCopy} pointerEvents="none">
          <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{name}{profile?.age ? `, ${profile.age}` : ''}</Text>
          <Text style={styles.cardMeta} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>
            {hasScore && !isLowInfo ? `${profile.matchLabel || 'Compatibility'} · ${matchScore}%` : swipeSubtitle(item)}
          </Text>
          {topTrait && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <Ionicons name="sparkles" size={10} color={c.accent} />
              <Text style={[styles.cardMeta, { color: c.accent, fontSize: 10 }]} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>
                {axisDisplayName(topTrait)}
              </Text>
            </View>
          )}
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

function ProfileRow({ item, tab, ownerId, onPress, showScores = true }) {
  const profile = item.profile, config = TABS[tab], latest = item.messages?.[0];
  const hasScore = showScores && typeof profile?.matchScore === 'number';
  const isLowInfo = (profile?.matchConfidence != null && profile.matchConfidence < 0.3) || profile?.matchLabel === 'Low Info';
  const topTrait = showScores && Array.isArray(profile?.matchBreakdown) && profile.matchBreakdown.length > 0
    ? profile.matchBreakdown[0]?.axis
    : null;
  // Quality and strongest signal read as one quiet line, so the row keeps its
  // detail without adding more tinted chips.
  const qualityLine = [
    isLowInfo ? 'Brief bio' : profile?.matchLabel,
    topTrait ? axisDisplayName(topTrait) : null,
  ].filter(Boolean).join(' · ');

  const subtitle = tab === 'swiped'
    ? (profile?.bio ? profile.bio.slice(0, 56).trim() : ([profile?.job, profile?.school, profile?.city].filter(Boolean).join(' · ') || swipeSubtitle(item)))
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
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{name}{profile?.age ? `, ${profile.age}` : ''}</Text>
          {tab === 'swiped' && !!item.swipedAt && <Text style={styles.time} maxFontSizeMultiplier={theme.fontScale.chrome}>{relativeTime(item.swipedAt)}</Text>}
        </View>
        <Text style={styles.subtitle} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.body}>{subtitle}</Text>
        <View style={styles.meta}>
          {tab === 'swiped' && (
            <View style={styles.swipedMeta}>
              {/* Status is the row's only tinted element; the ring carries the number and
                  the quality line gets its own full-width line so it is never clipped. */}
              <View style={styles.rowBadges}>
                <Badge label={item.action === 'like' ? 'LIKED' : 'PASSED'} icon={item.action === 'like' ? 'heart' : 'close'} tone={item.action === 'like' ? config.tone : 'neutral'} size="sm" />
              </View>
              {hasScore && !!qualityLine && (
                <View style={styles.qualityLine}>
                  <Ionicons name="sparkles-outline" size={12} color={c.muted} />
                  <Text style={styles.qualityText} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.chrome}>{qualityLine}</Text>
                </View>
              )}
            </View>
          )}
          {tab === 'strong' && <Text style={styles.metaText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.reasons?.[1] || 'Compatibility estimate'}</Text>}
        </View>
      </View>
      {tab === 'strong' ? <ScoreRing value={item.score} size={50} /> : (hasScore ? <ScoreRing value={profile.matchScore} size={42} /> : <Ionicons name="chevron-forward" size={18} color={c.muted} />)}
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
      <LinearGradient colors={['transparent', alpha(c.background, 0.65), c.background]} locations={[0.35, 0.68, 1]} style={styles.photoShade} pointerEvents="none" />
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
      </View>
    </View>
  );
}

export default function TinderCollections({ settings, onConnect }) {
  const c = theme.colors;
  const showScores = settings?.aiMatchShowScores !== false;
  const [state, setState] = useState(getCollections);
  const [tab, setTab] = useState('swiped');
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [showFullLLMReasoning, setShowFullLLMReasoning] = useState(false);
  const [breakdownExpanded, setBreakdownExpanded] = useState(true);
  const [openerMode, setOpenerMode] = useState('fun');
  const [openerCopied, setOpenerCopied] = useState(false);
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
  const openItem = item => {
    setSelected(item);
    setOpen(true);
    setShowFullLLMReasoning(false);
    setOpenerCopied(false);
    setOpenerMode('fun');
  };
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

  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const swipedList = lists.swiped || [];
  const isPassed = item =>
    item?.action === 'pass' ||
    item?.action === 'dislike' ||
    item?.action === 'nope' ||
    item?.profile?.matchLabel === 'Dealbreaker' ||
    item?.profile?.matchLabel === 'Filtered Out';
  const passedCount = useMemo(() => swipedList.filter(isPassed).length, [swipedList]);
  const likedCount = useMemo(() => swipedList.filter(item => !isPassed(item)).length, [swipedList]);
  const swipedTotalCount = swipedList.length;
  // Average of the estimated match scores present in the open list (display only).
  const listAvgScore = useMemo(() => {
    const scores = (entries || [])
      .map(entry => entry?.profile?.matchScore)
      .filter(score => typeof score === 'number');
    if (!scores.length) return null;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [entries]);

  const handleClearPassed = async () => {
    setClearBusy(true);
    try {
      await clearSwipes({ passedOnly: true });
      setClearModalVisible(false);
      if (selected && isPassed(selected)) setSelected(null);
    } finally {
      setClearBusy(false);
    }
  };

  const handleClearAll = async () => {
    setClearBusy(true);
    try {
      await clearSwipes({ passedOnly: false });
      setClearModalVisible(false);
      if (selected) setSelected(null);
    } finally {
      setClearBusy(false);
    }
  };

  const handleRemoveSingle = async item => {
    const profileId = item?.profileId || item?.id || item?.profile?.id;
    if (!profileId) return;
    try {
      await removeSwipe(profileId);
      setSelected(null);
    } catch (_) {}
  };

  const handleCopyOpener = text => {
    if (!text) return;
    try {
      Clipboard.setString(text);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
      setOpenerCopied(true);
      setTimeout(() => setOpenerCopied(false), 2200);
    } catch (_) {}
  };

  const commonGround = useMemo(() => {
    if (!selected?.profile || !showScores) return null;
    if (selected.action === 'pass') return null; // Only show Shared Sparks for liked profiles & matches
    const own = state.own || settings?.userProfile || getSharedExtensionSettings()?.userProfile;
    const prefs = settings || getSharedExtensionSettings() || {};
    return getCommonGround(selected.profile, own, prefs);
  }, [selected, state.own, settings, showScores]);

  const selectedScoreData = useMemo(() => {
    if (!selected?.profile || !showScores) return null;
    const p = selected.profile;
    const own = state.own || settings?.userProfile || getSharedExtensionSettings()?.userProfile;
    const prefs = settings || getSharedExtensionSettings() || {};
    const isSmartMatchOn = Boolean(prefs?.aiMatchEnabled);

    // 1. If profile was marked as Filtered Out / Dealbreaker in swipe action or detail
    // Only apply if Smart Match was actually enabled and made that automated decision
    const isFilteredAction = selected.action === 'pass' && isSmartMatchOn && (
      p.matchLabel === 'Filtered Out' ||
      p.matchLabel === 'Dealbreaker' ||
      (typeof selected.detail === 'string' && (selected.detail.toLowerCase().includes('filter') || selected.detail.toLowerCase().includes('dealbreaker') || selected.detail.toLowerCase().includes('mismatch')))
    );
    if (isFilteredAction) {
      const reason = selected.detail?.replace(/^Passed · /, '') || 'Dealbreaker filter applied';
      return {
        score: 0,
        confidence: 1.0,
        label: 'Dealbreaker',
        reason,
        passed: false,
        tier: 'filter',
        breakdown: [],
        own,
        prefs,
      };
    }

    // 2. Dealbreaker hard filter check (ONLY if profile was passed AND Smart Match is active)
    if (selected.action === 'pass' && isSmartMatchOn) {
      const hardCheck = checkHardFilters(p, own, prefs);
      if (!hardCheck.passed) {
        return {
          score: 0,
          confidence: 1.0,
          label: 'Dealbreaker',
          reason: hardCheck.reason,
          passed: false,
          tier: 'filter',
          breakdown: [],
          own,
          prefs,
        };
      }
    }

    // If candidate was passed while Smart Match was OFF, do not show dealbreaker cards or artificial scoring
    if (selected.action === 'pass' && !isSmartMatchOn) {
      return null;
    }

    // 3. Pre-calculated valid score from capture
    const hasValidScore =
      p.matchScore != null &&
      p.matchScore > 0 &&
      Array.isArray(p.matchBreakdown) &&
      p.matchBreakdown.length > 0;
    if (hasValidScore) {
      return {
        score: p.matchScore,
        confidence: p.matchConfidence,
        label: p.matchLabel || (p.matchScore >= 75 ? 'Strong Match' : p.matchScore >= 50 ? 'Good Potential' : 'Moderate'),
        breakdown: p.matchBreakdown,
        tier: p.matchTier || 'local',
        localScore: p.matchLocalScore,
        reasons: p.matchReasons || [],
        passed: true,
        own,
        prefs,
      };
    }

    // 4. Deterministic local scoring fallback
    const scored = scoreCandidateLocal(p, own, prefs);
    return {
      ...scored,
      passed: true,
      tier: 'local',
      own,
      prefs,
    };
  }, [selected, state.own, settings, showScores]);


  return <View style={styles.section}>
    <View style={styles.header}>
      {/* <IconWell icon="people" tone="primary" size={44} iconSize={20} /> */}
      <View style={styles.headerCopy}>
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
          <View style={styles.listHeaderMeta}>
            <AppText variant="footnote" numberOfLines={1}>{entries.length} {tab === 'chatting' ? (entries.length === 1 ? 'person' : 'people') : (entries.length === 1 ? 'profile' : 'profiles')}</AppText>
            {tab === 'swiped' && !!entries.length && (
              <Button style={styles.clearHeaderBtn} onPress={() => setClearModalVisible(true)} accessibilityRole="button" accessibilityLabel="Clear swiped history" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={12} color={c.textSecondary} />
                <Text style={styles.clearHeaderBtnText} maxFontSizeMultiplier={theme.fontScale.chrome}>Clear</Text>
              </Button>
            )}
          </View>
        </View>
        {!!state.error && <AppText variant="footnote" color="error" align="center" style={styles.error}>{state.error}</AppText>}{/* Chat refresh error text ("Could not refresh Tinder conversations…") hidden.
        {tab === 'chatting' && !!state.conversationError && <AppText variant="footnote" color="error" align="center" style={styles.error}>{state.conversationError}</AppText>} */}
        {!!entries.length && tab === 'swiped' && <Rail gutter={gutter}>
          {entries.slice(0, limit).map((item, index) => <SwipeCard key={itemKey(item, index)} item={item} index={index} width={swipeWidth} showScores={showScores} onPress={() => openItem(item)} />)}
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
            <ProfileRow item={item} tab={tab} ownerId={ownerId} showScores={showScores} onPress={() => openItem(item)} />
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
    <Modal visible={open} animationType={reduced ? 'fade' : 'slide'} transparent statusBarTranslucent onRequestClose={close}>
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
          <FadeIn><DetailHero key={itemKey(selected, 0)} item={selectedScoreData ? { ...selected, profile: { ...selected.profile, matchScore: selectedScoreData.score } } : selected} tab={tab} height={heroHeight} /></FadeIn>

          {/* ═══════════ CONTEXT-AWARE SCORING & COMMON GROUND ═══════════ */}
          {selectedScoreData != null && (() => {
            const sd = selectedScoreData;
            const profile = selected.profile || {};
            const own = sd.own || {};
            const isDealbreaker = sd.tier === 'filter' || sd.passed === false;
            const isLowInfo = sd.label === 'Low Info' || (typeof sd.confidence === 'number' && sd.confidence < 0.3);
            const isBlended = sd.tier === 'blended';
            const axesCount = Array.isArray(sd.breakdown) ? sd.breakdown.length : 0;
            const totalMax = Array.isArray(sd.breakdown) ? sd.breakdown.reduce((s, b) => s + (b.max || 0), 0) : 100;
            const totalEarned = Array.isArray(sd.breakdown) ? sd.breakdown.reduce((s, b) => s + (b.earned || 0), 0) : 0;
            const missingAxesCount = Math.max(0, 7 - axesCount);

            // Axis icon & color mapping (matches design tokens)
            const axisIcon = (axis) => {
              const map = {
                'Shared Interests': { name: 'heart', color: '#FF6B9D' },
                'Lifestyle': { name: 'leaf', color: '#4ADE80' },
                'Bio Keywords': { name: 'chatbubble-ellipses', color: '#60A5FA' },
                'Career & Education': { name: 'briefcase', color: '#F59E0B' },
                'Location': { name: 'location', color: '#A78BFA' },
                'Goal Harmony': { name: 'compass', color: '#F472B6' },
                'Completeness': { name: 'checkmark-circle', color: '#34D399' },
              };
              return map[axis] || { name: 'ellipse', color: c.muted };
            };

            const scoreColor = (score) =>
              score >= 75 ? '#10B981' : score >= 50 ? (c.accent || '#FF5E7E') : '#F59E0B';

            // ── DEALBREAKER CARD (Hard Filters in Action) ──
            if (isDealbreaker) {
              const isGoalMismatch = profile.lookingFor && own.lookingFor && profile.lookingFor.toLowerCase() !== own.lookingFor.toLowerCase();
              const isDistanceTooFar = typeof profile.distanceMi === 'number' && sd.prefs?.aiMatchMaxDistance > 0 && profile.distanceMi > sd.prefs.aiMatchMaxDistance;

              return (
                <View style={[styles.detailCard, { borderColor: alpha(c.error || '#EF4444', 0.3), backgroundColor: alpha(c.error || '#EF4444', 0.05) }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: alpha(c.error || '#EF4444', 0.15), alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close-circle" size={26} color={c.error || '#EF4444'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="headline" style={{ color: c.error || '#EF4444', fontWeight: '700' }}>Not a Match</AppText>
                      <AppText variant="caption" color="textSecondary">Passed based on your dealbreakers</AppText>
                    </View>
                  </View>

                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: alpha(c.error || '#EF4444', 0.15), gap: 10 }}>
                    <AppText variant="overline" style={{ color: alpha(c.error || '#EF4444', 0.9) }}>DEALBREAKERS FOUND</AppText>

                    {/* Relationship goal mismatch */}
                    {(isGoalMismatch || profile.lookingFor) && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <Ionicons name="heart-dislike" size={17} color={c.error || '#EF4444'} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="subhead" style={{ color: c.text, fontWeight: '600' }}>Different Dating Intentions</AppText>
                          <AppText variant="footnote" color="textSecondary">
                            You want {own.lookingFor || 'Long-term'}, but they're looking for {profile.lookingFor || 'Short-term'}
                          </AppText>
                        </View>
                      </View>
                    )}

                    {/* Distance too far */}
                    {(isDistanceTooFar || typeof profile.distanceMi === 'number') && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <Ionicons name="navigate" size={17} color={c.error || '#EF4444'} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <AppText variant="subhead" style={{ color: c.text, fontWeight: '600' }}>Outside Your Preferred Area</AppText>
                          <AppText variant="footnote" color="textSecondary">
                            {profile.distanceMi} mi away {sd.prefs?.aiMatchMaxDistance ? `(your max is ${sd.prefs.aiMatchMaxDistance} mi)` : ''}
                          </AppText>
                        </View>
                      </View>
                    )}

                    {/* Custom reason bullet if not covered above */}
                    {sd.reason && !isGoalMismatch && !isDistanceTooFar && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <Ionicons name="alert-circle" size={17} color={c.error || '#EF4444'} style={{ marginTop: 2 }} />
                        <AppText variant="footnote" style={{ color: c.text, flex: 1 }}>{sd.reason}</AppText>
                      </View>
                    )}
                  </View>

                  <View style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: r.md, backgroundColor: alpha(c.error || '#EF4444', 0.1), alignItems: 'center' }}>
                    <AppText variant="caption" style={{ color: c.error || '#EF4444', fontWeight: '600', letterSpacing: 0.3 }}>
                      Passed automatically to save your likes for better matches.
                    </AppText>
                  </View>
                </View>
              );
            }

            // ── LOW INFO CARD ──
            if (isLowInfo) {
              const availableAxes = Array.isArray(sd.breakdown) ? sd.breakdown : [];
              return (
                <View style={[styles.detailCard, { borderColor: alpha(c.warning || '#F59E0B', 0.3), backgroundColor: alpha(c.warning || '#F59E0B', 0.05) }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: alpha(c.warning || '#F59E0B', 0.18), alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="star-half" size={24} color={c.warning || '#F59E0B'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AppText variant="headline" style={{ color: c.warning || '#F59E0B', fontWeight: '700' }}>Minimal Bio</AppText>
                        <Badge label={`Only ${axesCount} details found`} tone="warning" size="sm" />
                      </View>
                      <AppText variant="caption" color="textSecondary">
                        Not enough bio or interest info for an accurate score
                      </AppText>
                    </View>
                  </View>

                  {availableAxes.length > 0 && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: alpha(c.warning || '#F59E0B', 0.15), gap: 8 }}>
                      <AppText variant="caption" color="muted" style={{ marginBottom: 2 }}>PROFILE HIGHLIGHTS FOUND</AppText>
                      {availableAxes.map((b, idx) => {
                        const icon = axisIcon(b.axis);
                        return (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name={icon.name} size={15} color={icon.color} />
                            <AppText variant="subhead" color="text" style={{ flex: 1 }}>{axisDisplayName(b.axis)}</AppText>
                            <AppText variant="subhead" style={{ fontVariant: ['tabular-nums'], fontWeight: '600', color: c.text }}>
                              {b.earned} / {b.max}
                            </AppText>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <View style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: r.md, backgroundColor: alpha(c.warning || '#F59E0B', 0.1), alignItems: 'center' }}>
                    <AppText variant="caption" style={{ color: c.warning || '#F59E0B', fontWeight: '600', letterSpacing: 0.3 }}>
                      Swiped conservatively because this profile has very little info.
                    </AppText>
                  </View>
                </View>
              );
            }

            // ── DEEP AI REVIEW CARD (for blended tier) ──
            const llmCard = isBlended ? (
              <View style={[styles.detailCard, { borderColor: alpha(c.info || '#3B82F6', 0.3), backgroundColor: alpha(c.info || '#3B82F6', 0.04) }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: alpha(c.info || '#3B82F6', 0.15), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="sparkles" size={18} color={c.info || '#3B82F6'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="overline" color="info" accessibilityRole="header">DEEP AI MATCH REVIEW</AppText>
                    <AppText variant="caption" color="textSecondary">Smart double-check for close calls</AppText>
                  </View>
                </View>

                {/* Dual-score comparison box */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: r.lg, backgroundColor: alpha(c.info || '#3B82F6', 0.08) }}>
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <AppText variant="caption" color="muted">Initial Fit</AppText>
                    <AppText variant="title2" style={{ fontVariant: ['tabular-nums'], color: c.textSecondary }}>
                      {sd.localScore != null ? `${sd.localScore}%` : `${sd.score}%`}
                    </AppText>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={c.info || '#3B82F6'} />
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <AppText variant="caption" color="info">Final Match</AppText>
                    <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: r.pill, backgroundColor: alpha(scoreColor(sd.score), 0.18) }}>
                      <AppText variant="title" style={{ fontVariant: ['tabular-nums'], color: scoreColor(sd.score), fontWeight: '700' }}>
                        {sd.score}%
                      </AppText>
                    </View>
                  </View>
                </View>

                {/* AI Compatibility Insights */}
                {Array.isArray(sd.reasons) && sd.reasons.length > 0 && (
                  <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: alpha(c.info || '#3B82F6', 0.15), gap: 8 }}>
                    <AppText variant="caption" color="muted">AI COMPATIBILITY INSIGHTS</AppText>
                    <View style={{ padding: 10, borderRadius: r.md, backgroundColor: alpha(c.surface, 0.6), borderLeftWidth: 3, borderLeftColor: c.info || '#3B82F6' }}>
                      <AppText variant="footnote" color="textSecondary" style={{ fontStyle: 'italic', lineHeight: 18 }}>
                        "{sd.reasons[0]}"
                      </AppText>
                    </View>

                    {sd.reasons.length > 1 && showFullLLMReasoning && (
                      <View style={{ gap: 6, marginTop: 4 }}>
                        {sd.reasons.slice(1).map((r, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                            <Ionicons name="chatbubble-outline" size={13} color={c.info || '#3B82F6'} style={{ marginTop: 3 }} />
                            <AppText variant="footnote" color="textSecondary" style={{ flex: 1 }}>{r}</AppText>
                          </View>
                        ))}
                      </View>
                    )}

                    {sd.reasons.length > 1 && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => setShowFullLLMReasoning(v => !v)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2 }}
                      >
                        <AppText variant="caption" color="info">{showFullLLMReasoning ? 'Hide AI insights ∧' : 'Read full AI insights ∨'}</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ) : null;

            const sc = scoreColor(sd.score);
            const confidenceLabel = sd.confidence >= 0.7 ? 'High Confidence' : sd.confidence >= 0.4 ? 'Moderate' : 'Low Confidence';
            const candGoal = profile.lookingFor || 'Long-term';
            const distMi = typeof profile.distanceMi === 'number' ? profile.distanceMi : null;

            // ── UNIFIED FLINT CHEMISTRY & COMMON GROUND HUB (When commonGround is available) ──
            if (commonGround != null) {
              const activeOpener =
                openerMode === 'deep'
                  ? (commonGround.openers?.deep || commonGround.icebreaker)
                  : (commonGround.openers?.fun || commonGround.icebreaker);

              return (
                <>
                  <View style={styles.sparksCard}>
                    <LinearGradient
                      colors={[alpha(c.accent || '#FF5E7E', 0.16), alpha('#7928CA', 0.1), alpha(c.surface, 0.98)]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.sparksWash}
                    />

                    {/* Top Bar */}
                    <View style={styles.sparksHeader}>
                      <View style={styles.sparksIconHalo}>
                        <Ionicons name="sparkles" size={18} color={c.accent || '#FF5E7E'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <AppText variant="overline" style={{ color: c.accent || '#FF5E7E', fontWeight: '700', letterSpacing: 0.8 }}>
                            CHEMISTRY & COMMON GROUND
                          </AppText>
                          <Badge
                            label={commonGround.chemistryDetails?.label || commonGround.chemistryTier}
                            tone={commonGround.chemistryTier === 'Electric Connection' ? 'secondary' : commonGround.chemistryTier === 'Strong Chemistry' ? 'primary' : 'success'}
                            size="sm"
                          />
                        </View>
                        <AppText variant="caption" color="textSecondary">
                          {commonGround.totalSharedCount > 0
                            ? `${commonGround.totalSharedCount} direct mutual connections · ${axesCount} profile areas compared`
                            : 'Explore mutual sparks, intentions & conversation cues'}
                        </AppText>
                      </View>
                    </View>

                    {/* Score Dial & Resonance Row */}
                    <View style={styles.sparksHeroRow}>
                      <ScoreRing value={sd.score} size={76} big />
                      <View style={styles.sparksHeroInfo}>
                        <Text style={styles.sparksTierTitle} maxFontSizeMultiplier={theme.fontScale.chrome}>
                          {commonGround.chemistryDetails?.label || commonGround.chemistryTier}
                        </Text>
                        <Text style={styles.sparksTierBlurb} maxFontSizeMultiplier={theme.fontScale.body}>
                          {commonGround.chemistryDetails?.blurb || 'Strong natural resonance with exciting common ground.'}
                        </Text>
                        <View style={styles.sparksMetaRow}>
                          <Badge
                            label={confidenceLabel}
                            tone={sd.confidence >= 0.7 ? 'success' : sd.confidence >= 0.4 ? 'primary' : 'warning'}
                            size="sm"
                          />
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                            <AppText variant="caption" color="textSecondary">
                              Verified Match
                            </AppText>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* ── WHAT CLICKS BETWEEN YOU ── */}
                    <View style={styles.synergyGrid}>
                      <AppText variant="overline" style={styles.synergySectionTitle}>
                        WHAT CLICKS BETWEEN YOU
                      </AppText>

                      {/* 1. Dating Intent Match */}
                      {commonGround.matchingGoal && (
                        <View style={[styles.synergyCard, styles.synergyCardIntent]}>
                          <View style={styles.synergyCardHeader}>
                            <View style={styles.synergyCardCategory}>
                              <Ionicons name="heart" size={14} color="#10B981" />
                              <Text style={[styles.synergyCategoryText, { color: '#10B981' }]} maxFontSizeMultiplier={theme.fontScale.chrome}>
                                DATING INTENT MATCH
                              </Text>
                            </View>
                            <Badge label="100% Aligned" tone="success" size="sm" />
                          </View>
                          <Text style={styles.synergyMainText} maxFontSizeMultiplier={theme.fontScale.body}>
                            Both looking for {commonGround.candGoal}
                          </Text>
                          <Text style={styles.synergySubText} maxFontSizeMultiplier={theme.fontScale.body}>
                            Aligned intentions mean you both want the same kind of connection.
                          </Text>
                        </View>
                      )}

                      {/* 2. Shared Passions */}
                      {commonGround.sharedInterests.length > 0 && (
                        <View style={[styles.synergyCard, styles.synergyCardPassions]}>
                          <View style={styles.synergyCardHeader}>
                            <View style={styles.synergyCardCategory}>
                              <Ionicons name="flame" size={14} color={c.accent || '#FF5E7E'} />
                              <Text style={[styles.synergyCategoryText, { color: c.accent || '#FF5E7E' }]} maxFontSizeMultiplier={theme.fontScale.chrome}>
                                SHARED PASSIONS ({commonGround.sharedInterests.length})
                              </Text>
                            </View>
                            <Badge label={`+${commonGround.sharedInterests.length * 10} pts`} tone="secondary" size="sm" />
                          </View>
                          <View style={styles.sparksBadgesRow}>
                            {commonGround.sharedInterests.map((interest, idx) => (
                              <View key={`shared-interest-${idx}`} style={styles.sparkInterestBadge}>
                                <Ionicons name="flame" size={12} color={c.accent || '#FF5E7E'} />
                                <Text style={styles.sparkInterestText} maxFontSizeMultiplier={theme.fontScale.chrome}>
                                  {interest}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* 3. Lifestyle & Habits in Sync */}
                      {commonGround.sharedDesc.length > 0 && (
                        <View style={[styles.synergyCard, styles.synergyCardLifestyle]}>
                          <View style={styles.synergyCardHeader}>
                            <View style={styles.synergyCardCategory}>
                              <Ionicons name="leaf" size={14} color="#34D399" />
                              <Text style={[styles.synergyCategoryText, { color: '#34D399' }]} maxFontSizeMultiplier={theme.fontScale.chrome}>
                                LIFESTYLE & HABITS IN SYNC ({commonGround.sharedDesc.length})
                              </Text>
                            </View>
                            <Badge label="Harmonious" tone="success" size="sm" />
                          </View>
                          <View style={styles.sparksBadgesRow}>
                            {commonGround.sharedDesc.map((desc, idx) => (
                              <View key={`shared-desc-${idx}`} style={styles.sparkDescBadge}>
                                <Ionicons name="leaf" size={11} color="#34D399" />
                                <Text style={styles.sparkDescText} maxFontSizeMultiplier={theme.fontScale.chrome}>
                                  {desc}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* 4. Proximity & Neighborhood */}
                      {distMi != null && (
                        <View style={[styles.synergyCard, { borderColor: alpha('#60A5FA', 0.25), backgroundColor: alpha('#60A5FA', 0.06) }]}>
                          <View style={styles.synergyCardHeader}>
                            <View style={styles.synergyCardCategory}>
                              <Ionicons name="navigate" size={14} color="#60A5FA" />
                              <Text style={[styles.synergyCategoryText, { color: '#60A5FA' }]} maxFontSizeMultiplier={theme.fontScale.chrome}>
                                PROXIMITY
                              </Text>
                            </View>
                            <Badge label="In Range" tone="primary" size="sm" />
                          </View>
                          <Text style={styles.synergyMainText} maxFontSizeMultiplier={theme.fontScale.body}>
                            {distMi} miles away {profile.city ? `· ${profile.city}` : ''}
                          </Text>
                          <Text style={styles.synergySubText} maxFontSizeMultiplier={theme.fontScale.body}>
                            {distMi <= 5 ? 'Close neighbor — effortless to meet for a casual coffee.' : 'Within your preferred local travel radius.'}
                          </Text>
                        </View>
                      )}

                      {/* 5. Shared Languages */}
                      {commonGround.sharedLangs.length > 0 && (
                        <View style={[styles.synergyCard, { borderColor: alpha('#A78BFA', 0.25), backgroundColor: alpha('#A78BFA', 0.06) }]}>
                          <View style={styles.synergyCardHeader}>
                            <View style={styles.synergyCardCategory}>
                              <Ionicons name="chatbubbles" size={14} color="#A78BFA" />
                              <Text style={[styles.synergyCategoryText, { color: '#A78BFA' }]} maxFontSizeMultiplier={theme.fontScale.chrome}>
                                COMMUNICATION
                              </Text>
                            </View>
                            <Badge label="Fluent" tone="secondary" size="sm" />
                          </View>
                          <Text style={styles.synergyMainText} maxFontSizeMultiplier={theme.fontScale.body}>
                            Both speak {commonGround.sharedLangs.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* ── FLINT CONVERSATION ICEBREAKER ── */}
                    {!!activeOpener && (
                      <View style={styles.icebreakerContainer}>
                        <View style={styles.icebreakerHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Ionicons name="chatbox-ellipses" size={15} color={c.accent || '#FF5E7E'} />
                            <AppText variant="overline" style={{ color: c.accent || '#FF5E7E', letterSpacing: 0.5 }}>
                              CONVERSATION ICEBREAKER
                            </AppText>
                          </View>
                          <View style={styles.icebreakerModeTabs}>
                            <TouchableOpacity
                              onPress={() => setOpenerMode('fun')}
                              style={[styles.icebreakerModeTab, openerMode === 'fun' && styles.icebreakerModeTabActive]}
                              accessibilityRole="button"
                              accessibilityLabel="Playful icebreaker"
                            >
                              <Text style={[styles.icebreakerModeTabText, openerMode === 'fun' && styles.icebreakerModeTabTextActive]}>
                                Playful 🌶️
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setOpenerMode('deep')}
                              style={[styles.icebreakerModeTab, openerMode === 'deep' && styles.icebreakerModeTabActive]}
                              accessibilityRole="button"
                              accessibilityLabel="Deep icebreaker"
                            >
                              <Text style={[styles.icebreakerModeTabText, openerMode === 'deep' && styles.icebreakerModeTabTextActive]}>
                                Deep ☕
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.icebreakerQuoteBox}>
                          <Text style={styles.icebreakerQuoteText} maxFontSizeMultiplier={theme.fontScale.body}>
                            "{activeOpener}"
                          </Text>
                        </View>

                        <View style={styles.icebreakerActionRow}>
                          <Button
                            style={[styles.copyOpenerBtn, openerCopied && styles.copyOpenerBtnSuccess]}
                            onPress={() => handleCopyOpener(activeOpener)}
                            accessibilityRole="button"
                            accessibilityLabel={openerCopied ? 'Copied to clipboard' : 'Copy conversation opener'}
                          >
                            <Ionicons
                              name={openerCopied ? 'checkmark-circle' : 'copy-outline'}
                              size={14}
                              color={openerCopied ? '#10B981' : (c.accent || '#FF5E7E')}
                            />
                            <Text
                              style={openerCopied ? styles.copyOpenerTextSuccess : styles.copyOpenerText}
                              maxFontSizeMultiplier={theme.fontScale.chrome}
                            >
                              {openerCopied ? 'Copied to Clipboard! 📋' : 'Copy Opener'}
                            </Text>
                          </Button>
                          <AppText variant="caption" color="textTertiary" style={{ flex: 1, textAlign: 'right' }}>
                            💡 Shared passions boost replies by 82%
                          </AppText>
                        </View>
                      </View>
                    )}

                    {/* ── EXPANDABLE TECHNICAL 7-AXIS BREAKDOWN DRAWER ── */}
                    {axesCount > 0 && (
                      <View style={{ borderTopWidth: 1, borderColor: alpha(c.white, 0.08), paddingTop: sp.sm, marginTop: sp.xs }}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => setBreakdownExpanded(v => !v)}
                          style={styles.technicalBreakdownToggle}
                        >
                          <Ionicons name={breakdownExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={c.secondary} />
                          <Text style={styles.technicalBreakdownToggleText}>
                            {breakdownExpanded ? 'Hide Technical 7-Axis Breakdown ∧' : 'Show Technical 7-Axis Breakdown ∨'}
                          </Text>
                        </TouchableOpacity>

                        {breakdownExpanded && (
                          <View style={{ marginTop: 12, gap: 10 }}>
                            {sd.breakdown.map((b, idx) => {
                              const icon = axisIcon(b.axis);
                              const axisPct = b.max > 0 ? Math.round((b.earned / b.max) * 100) : 0;
                              const barColor = axisPct >= 70 ? '#10B981' : axisPct >= 40 ? '#F59E0B' : '#EF4444';
                              return (
                                <View key={idx}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: alpha(icon.color, 0.15), alignItems: 'center', justifyContent: 'center' }}>
                                      <Ionicons name={icon.name} size={13} color={icon.color} />
                                    </View>
                                    <AppText variant="subhead" color="text" style={{ flex: 1 }}>{axisDisplayName(b.axis)}</AppText>
                                    <AppText variant="subhead" style={{ fontVariant: ['tabular-nums'], fontFamily: theme.fonts.strong, color: c.text }}>
                                      {b.earned} / {b.max}
                                    </AppText>
                                  </View>
                                  <View style={{ height: 3.5, borderRadius: 2, backgroundColor: alpha(c.white, 0.06), marginTop: 4, marginLeft: 34 }}>
                                    <View style={{ width: `${Math.min(100, axisPct)}%`, height: '100%', borderRadius: 2, backgroundColor: barColor }} />
                                  </View>
                                </View>
                              );
                            })}
                            <View style={{ marginTop: 6, padding: 8, borderRadius: r.sm, backgroundColor: alpha(c.white, 0.03) }}>
                              <AppText variant="caption" color="muted">
                                {missingAxesCount > 0
                                  ? `Score calibrated across ${axesCount} profile areas they shared. Missing profile details never penalize compatibility.`
                                  : 'All 7 profile dimensions evaluated for a comprehensive compatibility rating.'}
                              </AppText>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* LLM Refinement Card (Screen 4 - only for blended tier) */}
                  {llmCard}
                </>
              );
            }

            // ── FALLBACK STANDARD COMPATIBILITY BREAKDOWN (When commonGround is null) ──
            return (
              <>
                <View style={styles.detailCard}>
                  {/* Ring, title, tier and confidence read as one block: the eyebrow and the
                      repeated confidence line were saying the same thing three times. */}
                  <View style={styles.scoreHead}>
                    <ScoreRing value={sd.score} size={76} big />
                    <View style={styles.scoreHeadCopy}>
                      <AppText variant="title2" accessibilityRole="header">Compatibility score</AppText>
                      <View style={styles.scoreHeadBadges}>
                        <Badge
                          label={sd.label || (sd.score >= 75 ? 'Strong Match' : sd.score >= 50 ? 'Good Potential' : 'Moderate')}
                          tone={sd.score >= 75 ? 'secondary' : sd.score >= 50 ? 'primary' : 'neutral'}
                          size="sm"
                        />
                        <Badge
                          label={confidenceLabel}
                          tone={sd.confidence >= 0.7 ? 'success' : sd.confidence >= 0.4 ? 'primary' : 'warning'}
                          size="sm"
                        />
                      </View>
                      <AppText variant="footnote" color="textSecondary">
                        Estimated from {axesCount} profile {axesCount === 1 ? 'area' : 'areas'}
                      </AppText>
                    </View>
                  </View>

                  {axesCount > 0 && (
                    <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: alpha(c.white, 0.08), gap: 8 }}>
                      <View style={styles.breakdownHead}>
                        <AppText variant="overline" color="muted" numberOfLines={1} style={styles.breakdownHeadTitle}>
                          AREA SCORES · {axesCount} OF 7
                        </AppText>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={breakdownExpanded ? 'Hide area scores' : 'Show area scores'}
                          accessibilityState={{ expanded: breakdownExpanded }}
                          onPress={() => setBreakdownExpanded(v => !v)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.breakdownToggle}
                        >
                          <AppText variant="caption" color="secondary">{breakdownExpanded ? 'Hide' : 'Show'}</AppText>
                          <Ionicons name={breakdownExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={c.secondary} />
                        </TouchableOpacity>
                      </View>

                      {breakdownExpanded ? (
                        sd.breakdown.map((b, idx) => {
                          const icon = axisIcon(b.axis);
                          const axisPct = b.max > 0 ? Math.round((b.earned / b.max) * 100) : 0;
                          const barColor = axisPct >= 70 ? '#10B981' : axisPct >= 40 ? '#F59E0B' : '#EF4444';
                          return (
                            <View key={idx}>
                              {/* Neutral icon wells: the progress bar is the only colour that
                                  carries meaning, so seven tinted circles do not compete with it. */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={styles.axisIconWell}>
                                  <Ionicons name={icon.name} size={14} color={c.textSecondary} />
                                </View>
                                <AppText variant="subhead" color="text" style={{ flex: 1 }}>{axisDisplayName(b.axis)}</AppText>
                                <AppText variant="subhead" style={{ fontVariant: ['tabular-nums'], fontFamily: theme.fonts.strong, color: c.text }}>
                                  {b.earned} / {b.max}
                                </AppText>
                              </View>
                              <View style={styles.axisTrack}>
                                <View style={{ width: `${Math.min(100, axisPct)}%`, height: '100%', borderRadius: 3, backgroundColor: barColor }} />
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <View style={{ gap: 6 }}>
                          {sd.breakdown.slice(0, 4).map((b, idx) => {
                            const icon = axisIcon(b.axis);
                            return (
                              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name={icon.name} size={13} color={icon.color} />
                                <AppText variant="footnote" color="textSecondary" style={{ flex: 1 }}>{axisDisplayName(b.axis)}</AppText>
                                <AppText variant="footnote" style={{ fontVariant: ['tabular-nums'], color: c.text }}>
                                  {b.earned}/{b.max}
                                </AppText>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {/* The ring at the top already states the score; this footer only explains it. */}
                  <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: alpha(c.white, 0.08), gap: 4 }}>
                    <AppText variant="caption" color="muted">
                      {missingAxesCount > 0
                        ? `Score calculated from ${axesCount} profile areas they shared. Missing bio details do not lower their rating.`
                        : 'All 7 profile areas evaluated for a complete compatibility match.'}
                    </AppText>
                  </View>
                </View>

                {/* LLM Refinement Card (Screen 4 - only for blended tier) */}
                {llmCard}
              </>
            );
          })()}
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
                {selected.profile.descriptors.map(item => {
                  const isSharedDesc = commonGround?.sharedDesc?.some(sd => sd.toLowerCase() === item.toLowerCase());
                  return (
                    <View key={item} style={[styles.descriptor, isSharedDesc && styles.descriptorShared]}>
                      {isSharedDesc && <Ionicons name="leaf" size={12} color="#34D399" style={{ marginRight: 4 }} />}
                      <Text style={[styles.descriptorText, isSharedDesc && styles.descriptorTextShared]} maxFontSizeMultiplier={theme.fontScale.body}>{item}</Text>
                      {isSharedDesc && (
                        <View style={styles.sharedDescTagPill}>
                          <Text style={styles.sharedDescTagText}>IN SYNC</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          {!!selected.profile?.interests?.length && (
            <View style={styles.detailCard}>
              <AppText variant="overline" color="secondary" accessibilityRole="header">INTERESTS</AppText>
              <View style={styles.chips}>
                {selected.profile.interests.map(value => {
                  const isSharedInterest = commonGround?.sharedInterests?.some(si => si.toLowerCase() === value.toLowerCase());
                  return (
                    <View key={value} style={[styles.interest, isSharedInterest && styles.interestShared]}>
                      {isSharedInterest && <Ionicons name="flame" size={13} color={c.accent || '#FF5E7E'} style={{ marginRight: 4 }} />}
                      <Text style={[styles.interestText, isSharedInterest && styles.interestTextShared]} maxFontSizeMultiplier={theme.fontScale.body}>{value}</Text>
                      {isSharedInterest && (
                        <View style={styles.sharedTagPill}>
                          <Text style={styles.sharedTagText}>YOU BOTH</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          {!!selected.action && <View style={styles.actionDetail}><IconWell icon={selected.action === 'like' ? 'heart' : 'close'} tone={selected.action === 'like' ? config.tone : 'neutral'} size={44} iconSize={18} /><View style={styles.actionCopy}><AppText variant="bodyStrong">{selected.action === 'like' ? 'You liked this profile' : 'You passed this profile'}</AppText><AppText variant="footnote">{new Date(selected.swipedAt).toLocaleString()}</AppText></View>{selected.action === 'like' && selected.matched && <Badge label="MATCH" icon="heart" tone="primary" size="sm" />}{tab === 'swiped' && <Button style={styles.removeHistoryItemBtn} onPress={() => handleRemoveSingle(selected)} accessibilityRole="button" accessibilityLabel="Remove from history" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="trash-outline" size={16} color={c.error || '#EF4444'} /></Button>}</View>}
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
              <ProfileRow item={item} tab={tab} ownerId={ownerId} showScores={showScores} onPress={() => setSelected(item)} />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={<View style={styles.modalListHeader}>
            {tab === 'swiped' && !!entries.length && (
              <View style={styles.listSummary}>
                <View style={styles.listSummaryCell}>
                  <Text style={styles.listSummaryValue} maxFontSizeMultiplier={theme.fontScale.chrome}>{likedCount}</Text>
                  <Text style={styles.listSummaryLabel} maxFontSizeMultiplier={theme.fontScale.chrome}>Liked</Text>
                </View>
                <View style={styles.listSummaryDivider} />
                <View style={styles.listSummaryCell}>
                  <Text style={styles.listSummaryValue} maxFontSizeMultiplier={theme.fontScale.chrome}>{passedCount}</Text>
                  <Text style={styles.listSummaryLabel} maxFontSizeMultiplier={theme.fontScale.chrome}>Passed</Text>
                </View>
                <View style={styles.listSummaryDivider} />
                <View style={styles.listSummaryCell}>
                  <Text style={styles.listSummaryValue} maxFontSizeMultiplier={theme.fontScale.chrome}>{listAvgScore != null ? `${listAvgScore}%` : '—'}</Text>
                  <Text style={styles.listSummaryLabel} maxFontSizeMultiplier={theme.fontScale.chrome}>Avg match</Text>
                </View>
              </View>
            )}
            <View style={styles.modalListHeaderRow}>
              <AppText variant="footnote">{entries.length} {entries.length === 1 ? 'profile' : 'profiles'}</AppText>
              {tab === 'swiped' && !!entries.length && (
                <Button style={styles.clearHeaderBtn} onPress={() => setClearModalVisible(true)} accessibilityRole="button" accessibilityLabel="Clear swiped history" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={12} color={c.textSecondary} />
                  <Text style={styles.clearHeaderBtnText} maxFontSizeMultiplier={theme.fontScale.chrome}>Clear history</Text>
                </Button>
              )}
            </View>
            {tab === 'strong' && <StrongNote />}
          </View>}
          ListEmptyComponent={<Empty tab={tab} loading={state.loading} />}
          contentContainerStyle={[styles.modalList, { maxWidth: contentMax, paddingBottom: sp.section }]}
          showsVerticalScrollIndicator={false}
        />}
        <SmartClearModal
          visible={clearModalVisible}
          inModal
          passedCount={passedCount}
          likedCount={likedCount}
          totalCount={swipedTotalCount}
          busy={clearBusy}
          onClearPassed={handleClearPassed}
          onClearAll={handleClearAll}
          onCancel={() => setClearModalVisible(false)}
        />
      </SafeAreaView>
    </Modal>
    {!open && (
      <SmartClearModal
        visible={clearModalVisible}
        passedCount={passedCount}
        likedCount={likedCount}
        totalCount={swipedTotalCount}
        busy={clearBusy}
        onClearPassed={handleClearPassed}
        onClearAll={handleClearAll}
        onCancel={() => setClearModalVisible(false)}
      />
    )}
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
  // Title and "See all" centre on each other: the button keeps its 44pt touch target
  // without pushing its label off the single-line title's optical centre.
  header: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  headerCopy: { flex: 1, minWidth: 0 },
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
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.md },
  listHeaderTitle: { flex: 1, minWidth: 0 },
  listHeaderMeta: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  clearHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: sp.sm + 2, borderRadius: r.full || 999, backgroundColor: alpha(c.surface, 0.9), borderWidth: 1, borderColor: c.borderSubtle },
  clearHeaderBtnText: { ...t.caption, fontFamily: theme.fonts.label, color: c.textSecondary },
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
  rowBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  // Compatibility card head and the expandable area-score header.
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: sp.lg, marginBottom: sp.xs },
  scoreHeadCopy: { flex: 1, minWidth: 0, gap: 6 },
  scoreHeadBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  breakdownHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp.md, marginBottom: sp.xs },
  breakdownHeadTitle: { flexShrink: 1, minWidth: 0 },
  breakdownToggle: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  axisIconWell: { width: 28, height: 28, borderRadius: 14, backgroundColor: alpha(c.white, 0.06), alignItems: 'center', justifyContent: 'center' },
  axisTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: alpha(c.white, 0.06), marginTop: 6, marginLeft: 36 },
  swipedMeta: { gap: 4, marginTop: 4, minWidth: 0 },
  qualityLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, minWidth: 0 },
  qualityText: { ...t.caption, color: c.muted, flex: 1, minWidth: 0, lineHeight: 16 },
  // Summary strip above the list: liked / passed / average match.
  listSummary: { flexDirection: 'row', alignItems: 'center', paddingVertical: sp.md, paddingHorizontal: sp.sm, borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle, marginBottom: sp.md },
  listSummaryCell: { flex: 1, alignItems: 'center', gap: 2, minWidth: 0 },
  listSummaryValue: { ...t.title2, fontFamily: theme.fonts.heading, color: c.text, fontVariant: ['tabular-nums'] },
  listSummaryLabel: { ...t.caption, color: c.muted },
  listSummaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: c.divider },
  metaText: { ...t.caption, color: c.muted, flexShrink: 1, minWidth: 0 },
  // score: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: c.background },
  // scoreValue: { ...t.label, fontFamily: theme.fonts.strong, fontVariant: ['tabular-nums'] },
  // scoreUnit: { ...t.caption, fontSize: 10, lineHeight: 13, color: c.muted },

  // Score ring
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ringOnPhoto: {
    ...theme.shadows.md,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    ...t.label,
    fontFamily: theme.fonts.strong,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    lineHeight: 16,
  },
  ringValueBig: {
    ...t.title2,
    fontFamily: theme.fonts.strong,
    fontVariant: ['tabular-nums'],
    fontSize: 17,
    lineHeight: 21,
  },
  ringUnit: {
    ...t.caption,
    fontSize: 10,
    lineHeight: 13,
    marginLeft: 1,
    marginTop: 2,
  },

  // Empty state container (FeedbackState inside a dashed well)
  empty: { borderRadius: r.lg, backgroundColor: c.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border },

  sync: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  syncText: { ...t.caption, color: c.muted },

  // Full-screen list / detail modal
  modal: { flex: 1, backgroundColor: c.background, position: 'relative' },
  modalHeader: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: sp.sm, paddingHorizontal: sp.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider },
  modalHeading: { flex: 1, minWidth: 0 },
  modalIcon: { marginRight: sp.xs },
  // The three maxWidths below are the phone baseline; the modal overrides them with
  // useResponsive().contentMax so tablets use the wider column.
  modalList: { width: '100%', maxWidth: theme.layout.readableMax, alignSelf: 'center', padding: sp.lg },
  modalListHeader: { gap: sp.sm, marginBottom: sp.md },
  modalListHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
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
  // Shared Sparks & Common Ground Card
  sparksCard: {
    borderRadius: r.xl,
    padding: sp.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: alpha(c.accent || '#FF5E7E', 0.28),
    position: 'relative',
    overflow: 'hidden',
    gap: sp.md,
  },
  sparksWash: {
    ...StyleSheet.absoluteFillObject,
  },
  sparksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  sparksIconHalo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.15),
    borderWidth: 1,
    borderColor: alpha(c.accent || '#FF5E7E', 0.35),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparksHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    marginTop: 2,
    marginBottom: 4,
  },
  sparksHeroInfo: {
    flex: 1,
    gap: 4,
  },
  sparksTierTitle: {
    fontFamily: theme.fonts.strong,
    fontSize: 18,
    color: c.text,
    fontWeight: '700',
  },
  sparksTierBlurb: {
    ...t.caption,
    color: c.textSecondary,
    lineHeight: 18,
  },
  sparksMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  synergyGrid: {
    gap: sp.sm,
    marginTop: sp.xs,
  },
  synergySectionTitle: {
    ...t.overline,
    color: c.secondary,
    letterSpacing: 0.8,
  },
  synergyCard: {
    padding: sp.md,
    borderRadius: r.lg,
    backgroundColor: alpha(c.elevatedHigh, 0.5),
    borderWidth: 1,
    borderColor: c.borderSubtle,
    gap: 6,
  },
  synergyCardIntent: {
    backgroundColor: alpha('#10B981', 0.08),
    borderColor: alpha('#10B981', 0.25),
  },
  synergyCardPassions: {
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.08),
    borderColor: alpha(c.accent || '#FF5E7E', 0.25),
  },
  synergyCardLifestyle: {
    backgroundColor: alpha('#34D399', 0.08),
    borderColor: alpha('#34D399', 0.25),
  },
  synergyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  synergyCardCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synergyCategoryText: {
    ...t.overline,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  synergyMainText: {
    ...t.subhead,
    fontFamily: theme.fonts.strong,
    color: c.text,
    fontWeight: '600',
  },
  synergySubText: {
    ...t.caption,
    color: c.textSecondary,
  },
  sparksBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.xs + 2,
  },
  sparkHighlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: r.pill,
    backgroundColor: alpha('#10B981', 0.12),
    borderWidth: 1,
    borderColor: alpha('#10B981', 0.3),
  },
  sparkHighlightText: {
    ...t.caption,
    fontFamily: theme.fonts.strong,
    color: '#10B981',
    fontWeight: '600',
  },
  sparkInterestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: r.pill,
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.12),
    borderWidth: 1,
    borderColor: alpha(c.accent || '#FF5E7E', 0.3),
  },
  sparkInterestText: {
    ...t.caption,
    fontFamily: theme.fonts.strong,
    color: c.accent || '#FF5E7E',
    fontWeight: '600',
  },
  sparkDescBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: r.pill,
    backgroundColor: alpha(c.elevatedHigh, 0.6),
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  sparkDescText: {
    ...t.caption,
    color: c.textSecondary,
  },
  icebreakerContainer: {
    padding: sp.md,
    borderRadius: r.lg,
    backgroundColor: alpha(c.elevatedHigh, 0.65),
    borderWidth: 1,
    borderColor: alpha(c.accent || '#FF5E7E', 0.18),
    gap: 8,
  },
  icebreakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  icebreakerModeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icebreakerModeTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: r.pill,
    backgroundColor: alpha(c.white, 0.06),
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  icebreakerModeTabActive: {
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.15),
    borderColor: alpha(c.accent || '#FF5E7E', 0.4),
  },
  icebreakerModeTabText: {
    ...t.caption,
    fontSize: 11,
    color: c.textSecondary,
  },
  icebreakerModeTabTextActive: {
    color: c.accent || '#FF5E7E',
    fontWeight: '600',
  },
  icebreakerQuoteBox: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderLeftWidth: 3,
    borderLeftColor: alpha(c.accent || '#FF5E7E', 0.6),
    paddingLeft: 10,
    backgroundColor: alpha(c.surface, 0.4),
    borderRadius: r.sm,
  },
  icebreakerQuoteText: {
    ...t.callout,
    color: c.text,
    fontStyle: 'italic',
    lineHeight: 21,
    fontWeight: '500',
  },
  icebreakerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    flexWrap: 'wrap',
    gap: 8,
  },
  copyOpenerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: r.pill,
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.12),
    borderWidth: 1,
    borderColor: alpha(c.accent || '#FF5E7E', 0.3),
  },
  copyOpenerBtnSuccess: {
    backgroundColor: alpha('#10B981', 0.14),
    borderColor: alpha('#10B981', 0.4),
  },
  copyOpenerText: {
    ...t.caption,
    fontFamily: theme.fonts.strong,
    color: c.accent || '#FF5E7E',
    fontWeight: '600',
  },
  copyOpenerTextSuccess: {
    ...t.caption,
    fontFamily: theme.fonts.strong,
    color: '#10B981',
    fontWeight: '600',
  },
  technicalBreakdownToggle: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: r.pill,
    backgroundColor: alpha(c.white, 0.05),
    borderWidth: 1,
    borderColor: c.borderSubtle,
    marginTop: 4,
  },
  technicalBreakdownToggleText: {
    ...t.caption,
    color: c.secondary,
    fontWeight: '600',
  },
  interestShared: {
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.14),
    borderWidth: 1.5,
    borderColor: alpha(c.accent || '#FF5E7E', 0.5),
  },
  interestTextShared: {
    color: c.text,
    fontWeight: '600',
  },
  sharedTagPill: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: r.pill,
    backgroundColor: alpha(c.accent || '#FF5E7E', 0.25),
  },
  sharedTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: c.accent || '#FF5E7E',
    letterSpacing: 0.5,
  },
  descriptorShared: {
    backgroundColor: alpha('#10B981', 0.12),
    borderWidth: 1.5,
    borderColor: alpha('#10B981', 0.45),
  },
  descriptorTextShared: {
    color: c.text,
    fontWeight: '600',
  },
  sharedDescTagPill: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: r.pill,
    backgroundColor: alpha('#10B981', 0.22),
  },
  sharedDescTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  detailCard: { gap: sp.md, padding: sp.lg, borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: r.pill, backgroundColor: c.secondarySoft, borderWidth: 1, borderColor: c.secondaryBorder, maxWidth: '100%' },
  reasonText: { ...t.subhead, color: c.textSecondary, flexShrink: 1 },
  interest: { paddingVertical: sp.sm, paddingHorizontal: sp.md, borderRadius: r.pill, backgroundColor: c.elevated, borderWidth: 1, borderColor: c.borderSubtle, maxWidth: '100%' },
  interestText: { ...t.subhead, color: c.textSecondary },
  actionDetail: { flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.lg, borderRadius: r.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderSubtle },
  removeHistoryItemBtn: { padding: sp.sm, borderRadius: r.md, backgroundColor: alpha(c.error || '#EF4444', 0.1), borderWidth: 1, borderColor: alpha(c.error || '#EF4444', 0.25), alignItems: 'center', justifyContent: 'center' },
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
  scoreBadgeOnCard: {
    paddingHorizontal: sp.xs + 2,
    paddingVertical: 2,
    borderRadius: r.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeText: {
    color: c.white,
    fontFamily: theme.fonts.strong,
    fontSize: 10,
    letterSpacing: 0.2,
  },
}));
