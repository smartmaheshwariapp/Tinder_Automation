// Home "Likes You" section: people who liked your Tinder profile.
// Full details only when Tinder returns them for your plan; otherwise Tinder's blurred teasers (locked).
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppText, BottomSheet, FadeIn, LiveDot, MotionTouchable, Skeleton } from '../ui';
import useResponsive from '../../hooks/useResponsive';
import useTinderLikesYou from '../../hooks/useTinderLikesYou';
import { theme, alpha } from '../../theme';

const c = theme.colors;
const t = theme.type;
const sp = theme.spacing;
const r = theme.radius;

const RAIL_LIMIT = 12;

const titleFor = (person, locked) => (locked || !person.name ? 'Someone new' : person.age ? `${person.name}, ${person.age}` : person.name);
const distanceFor = (person) => {
  if (person.distanceMi == null) return person.city || null;
  const km = Math.max(1, Math.round(person.distanceMi * 1.609));
  return `${km} km away`;
};

// Photo with blur for locked teasers and an initials/heart fallback.
function PersonPhoto({ person, locked, style, index = 0, iconSize = 28 }) {
  const [failedUri, setFailedUri] = useState(null);
  const uri = person.photos[index] || person.photos[0];
  if (!uri || failedUri === uri) {
    return (
      <LinearGradient colors={[c.elevatedHigh, c.surface]} style={[style, styles.photoFallback]}>
        {locked || !person.name
          ? <Ionicons name="heart" size={iconSize} color={alpha(c.accent, 0.7)} />
          : <Text style={styles.initial} maxFontSizeMultiplier={theme.fontScale.chrome}>{person.name.slice(0, 1).toUpperCase()}</Text>}
      </LinearGradient>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[style, styles.photo]}
      blurRadius={locked ? 4 : 0}
      onError={() => setFailedUri(uri)}
      accessibilityIgnoresInvertColors
    />
  );
}

function PersonCard({ person, locked, width, onPress, index }) {
  const distance = !locked ? distanceFor(person) : null;
  const card = (
    <MotionTouchable
      onPress={onPress}
      pressScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={locked ? 'Someone liked you. Open Tinder to see who' : `${titleFor(person)} liked you${distance ? `, ${distance}` : ''}. View profile`}
      style={[styles.card, { width, height: Math.round(width * 1.36) }]}
    >
      <PersonPhoto person={person} locked={locked} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(c.background, 0), alpha(c.background, 0.88)]}
        start={{ x: 0.5, y: 0.45 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardHeart}>
        <Ionicons name={locked ? 'lock-closed' : 'heart'} size={12} color={c.onPrimary} />
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{titleFor(person, locked)}</Text>
        {distance ? (
          <View style={styles.cardMetaRow}>
            <Ionicons name="location" size={11} color={alpha(c.white, 0.8)} />
            <Text style={styles.cardMeta} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{distance}</Text>
          </View>
        ) : locked ? (
          <Text style={styles.cardMeta} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>Liked you</Text>
        ) : null}
      </View>
    </MotionTouchable>
  );
  return index < 8 ? <FadeIn delay={index * 35} offset={8}>{card}</FadeIn> : card;
}

function PersonDetail({ person, onOpenTinder, onClose }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const { width } = useWindowDimensions();
  const photoHeight = Math.min(460, Math.round(Math.min(width, 640) * 1.15));
  const count = person.photos.length;
  const distance = distanceFor(person);
  const facts = [
    distance && { icon: 'location-outline', text: distance },
    person.job && { icon: 'briefcase-outline', text: person.job },
    person.school && { icon: 'school-outline', text: person.school },
  ].filter(Boolean);
  return (
    <View style={styles.detail}>
      <MotionTouchable
        onPress={() => count > 1 && setPhotoIndex((i) => (i + 1) % count)}
        pressScale={0.99}
        accessibilityRole="imagebutton"
        accessibilityLabel={count > 1 ? `Photo ${photoIndex + 1} of ${count}. Tap for next photo` : `${titleFor(person)} photo`}
        style={[styles.detailPhotoWrap, { height: photoHeight }]}
      >
        <PersonPhoto person={person} locked={false} index={photoIndex} style={StyleSheet.absoluteFill} iconSize={48} />
        <LinearGradient
          pointerEvents="none"
          colors={[alpha(c.background, 0), alpha(c.background, 0.92)]}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {count > 1 ? (
          <View style={styles.pager} pointerEvents="none">
            {person.photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={[styles.pagerBar, i === photoIndex && styles.pagerBarActive]} />
            ))}
          </View>
        ) : null}
        <View style={styles.detailHeading} pointerEvents="none">
          <View style={styles.likedBadge}>
            <Ionicons name="heart" size={12} color={c.onPrimary} />
            <Text style={styles.likedBadgeText} maxFontSizeMultiplier={theme.fontScale.chrome}>Liked you</Text>
          </View>
          <Text style={styles.detailName} numberOfLines={2} maxFontSizeMultiplier={theme.fontScale.chrome}>{titleFor(person)}</Text>
        </View>
      </MotionTouchable>

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

      {person.bio ? (
        <View style={styles.block}>
          <AppText variant="overline" color="secondary">ABOUT</AppText>
          <AppText variant="body" color="text" style={styles.blockBody}>{person.bio}</AppText>
        </View>
      ) : null}

      {person.interests.length ? (
        <View style={styles.block}>
          <AppText variant="overline" color="secondary">INTERESTS</AppText>
          <View style={styles.chips}>
            {person.interests.map((interest) => (
              <View key={interest} style={styles.chip}>
                <Text style={styles.chipText} maxFontSizeMultiplier={theme.fontScale.body}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <AppButton
        title="Open Tinder to like back"
        icon="heart"
        onPress={() => { onClose(); onOpenTinder?.(); }}
        style={styles.detailCta}
      />
    </View>
  );
}

export default function LikesYou({ count, isLoggedIn, onOpenTinder }) {
  const { gutter, isCompact, width } = useResponsive();
  const { people, locked, loading } = useTinderLikesYou();
  const [selected, setSelected] = useState(null);
  const [showAll, setShowAll] = useState(false);

  if (!isLoggedIn) return null;
  const total = Number.isFinite(count) ? Math.max(count, people.length) : people.length;
  if (!loading && !people.length && !total) return null;

  const cardWidth = isCompact ? 118 : 134;
  // Two columns inside the bottom sheet (max width 640, xl side padding).
  const gridWidth = Math.floor((Math.min(width, 640) - sp.xl * 2 - sp.md) / 2);
  const openPerson = (person) => (locked ? onOpenTinder?.() : setSelected(person));
  const visible = people.slice(0, RAIL_LIMIT);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.overlineRow}>
            <LiveDot size={7} color={c.accent} active={total > 0} />
            <AppText variant="overline" color="secondary">LIKES YOU</AppText>
          </View>
          <AppText variant="title2" numberOfLines={1} accessibilityRole="header">
            {total > 99 ? '99+' : total} {total === 1 ? 'person likes you' : 'people like you'}
          </AppText>
        </View>
        {people.length > 0 ? (
          <MotionTouchable
            onPress={() => (locked ? onOpenTinder?.() : setShowAll(true))}
            accessibilityRole="button"
            accessibilityLabel={locked ? 'Open Tinder to see who likes you' : 'See everyone who likes you'}
            hitSlop={10}
            style={styles.seeAll}
          >
            <Text style={styles.seeAllText} maxFontSizeMultiplier={theme.fontScale.chrome}>{locked ? 'Open Tinder' : 'See all'}</Text>
            <Ionicons name="chevron-forward" size={14} color={c.accent} />
          </MotionTouchable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.rail, { marginHorizontal: -gutter }]}
        contentContainerStyle={[styles.railContent, { paddingHorizontal: gutter }]}
      >
        {loading && !people.length
          ? [0, 1, 2].map((i) => <Skeleton key={i} width={cardWidth} height={Math.round(cardWidth * 1.36)} radius={r.lg} />)
          : visible.map((person, index) => (
            <PersonCard key={person.id} person={person} locked={locked} width={cardWidth} index={index} onPress={() => openPerson(person)} />
          ))}
      </ScrollView>

      {locked ? (
        <View style={styles.lockNote}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={16} color={c.gold} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">See who likes you</AppText>
            <AppText variant="footnote">Tinder only reveals these profiles with Tinder Gold or Platinum.</AppText>
          </View>
        </View>
      ) : null}

      {/* Everyone who liked you */}
      <BottomSheet
        visible={showAll}
        onClose={() => setShowAll(false)}
        title="Likes you"
        subtitle={`${total} ${total === 1 ? 'person' : 'people'} liked your profile`}
        closeLabel="Close likes"
      >
        <View style={styles.grid}>
          {people.map((person, index) => (
            <PersonCard
              key={person.id}
              person={person}
              locked={locked}
              width={gridWidth}
              index={index}
              onPress={() => { setShowAll(false); setTimeout(() => setSelected(person), 260); }}
            />
          ))}
        </View>
      </BottomSheet>

      {/* Profile detail */}
      <BottomSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        closeLabel="Close profile"
        maxHeightRatio={0.94}
      >
        {selected ? <PersonDetail person={selected} onOpenTinder={onOpenTinder} onClose={() => setSelected(null)} /> : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: sp.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: sp.md },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: sp.sm },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  seeAllText: { ...t.buttonSmall, color: c.accent },

  rail: { flexGrow: 0 },
  railContent: { gap: sp.md, paddingVertical: sp.xs },
  card: {
    borderRadius: r.lg,
    overflow: 'hidden',
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  photo: { resizeMode: 'cover', backgroundColor: c.elevated },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { ...t.largeTitle, color: c.textSecondary },
  cardHeart: {
    position: 'absolute',
    top: sp.sm,
    right: sp.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    borderWidth: 2,
    borderColor: alpha(c.white, 0.85),
  },
  cardCopy: { position: 'absolute', left: sp.md, right: sp.md, bottom: sp.md, gap: 2 },
  cardName: { ...t.headline, fontFamily: theme.fonts.heading, color: c.white },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardMeta: { ...t.footnote, color: alpha(c.white, 0.85), flexShrink: 1 },

  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    padding: sp.md,
    borderRadius: r.lg,
    backgroundColor: alpha(c.gold, 0.08),
    borderWidth: 1,
    borderColor: alpha(c.gold, 0.3),
  },
  lockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(c.gold, 0.14),
  },
  flex: { flex: 1, minWidth: 0 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.md, paddingTop: sp.xs },

  detail: { gap: sp.lg, paddingTop: sp.xs },
  detailPhotoWrap: { borderRadius: r.xl, overflow: 'hidden', backgroundColor: c.elevated },
  pager: { position: 'absolute', top: sp.sm, left: sp.sm, right: sp.sm, flexDirection: 'row', gap: 4 },
  pagerBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: alpha(c.white, 0.35) },
  pagerBarActive: { backgroundColor: c.white },
  detailHeading: { position: 'absolute', left: sp.lg, right: sp.lg, bottom: sp.lg, gap: sp.sm },
  likedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: r.pill,
    backgroundColor: c.primary,
  },
  likedBadgeText: { ...t.overline, color: c.onPrimary, letterSpacing: 0.6 },
  detailName: { ...t.largeTitle, color: c.white },
  facts: {
    gap: sp.md,
    padding: sp.lg,
    borderRadius: r.card,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  fact: { flexDirection: 'row', alignItems: 'center', gap: sp.md },
  block: { gap: sp.sm },
  blockBody: { lineHeight: 23 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm },
  chip: {
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: r.pill,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  chipText: { ...t.subhead, color: c.textSecondary },
  detailCta: { marginTop: sp.xs },
});
