import React, { useState } from 'react';
import {
  Image,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, alpha } from '../../theme';
import { MotionTouchable } from '../common/Motion';
import AppButton from '../ui/AppButton';
import Badge from '../ui/Badge';
import IconWell from '../ui/IconWell';

const VITALS_CONFIG = [
  { key: 'lookingFor', label: 'Looking for', icon: 'heart-outline' },
  { key: 'relationshipType', label: 'Relationship', icon: 'infinite-outline' },
  { key: 'height', label: 'Height', icon: 'resize-outline' },
  { key: 'zodiac', label: 'Zodiac', icon: 'planet-outline' },
  { key: 'workout', label: 'Workout', icon: 'fitness-outline' },
  { key: 'drinking', label: 'Drinking', icon: 'wine-outline' },
  { key: 'smoking', label: 'Smoking', icon: 'cloud-outline' },
  { key: 'pets', label: 'Pets', icon: 'paw-outline' },
  { key: 'communicationStyle', label: 'Communication', icon: 'chatbubbles-outline' },
  { key: 'loveStyle', label: 'Love Style', icon: 'sparkles-outline' },
  { key: 'languages', label: 'Languages', icon: 'globe-outline' },
  { key: 'gender', label: 'Gender', icon: 'person-outline' },
];

const formatValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return '';
};

export default function TinderProfileCard({
  profile,
  settings,
  stats,
  user,
  isLoggedIn,
  syncing,
  onSync,
  onOpenTinder,
  defaultCollapsed = true,
  compact = false,
}) {
  const [collapsed, setCollapsed] = useState(!compact && defaultCollapsed);
  const [photoError, setPhotoError] = useState(false);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  const tinderProfile = profile || {};
  const name = tinderProfile.name || (isLoggedIn ? 'Tinder Member' : null);
  const age = tinderProfile.age;
  const bio = (tinderProfile.bio || '').trim();
  const photos = Array.isArray(tinderProfile.photos) ? tinderProfile.photos : [];
  const heroPhoto = photos[selectedPhotoIdx] || photos[0] || null;

  // ── 1. Tinder Platform Details ──
  const tinderPlan = tinderProfile.tinderPlan || 'free';
  const tinderPlanLabel =
    tinderPlan === 'platinum'
      ? 'Platinum'
      : tinderPlan === 'gold'
        ? 'Gold'
        : tinderPlan === 'plus'
          ? 'Plus'
          : 'Free';

  // ── 2. Tinder Plan & Swiping Limits ──
  const isTinderPaid = tinderPlan === 'platinum' || tinderPlan === 'gold' || tinderPlan === 'plus';
  const activePlanBadge = isTinderPaid ? `Tinder ${tinderPlanLabel}` : 'Tinder Free';

  // Swiping limits based on settings and Tinder tier
  const flintLikesBudget =
    typeof settings?.likesPerCycle === 'number' && settings.likesPerCycle > 0
      ? settings.likesPerCycle
      : 50;
  const flintLikesUsed =
    stats?.agentState?.currentCycle?.likesCompleted ??
    stats?.agentState?.stats?.swipes ??
    stats?.stats?.todaySwipes ??
    stats?.todayLikes ??
    0;
  const flintLikesRemaining = isTinderPaid
    ? 'Unlimited'
    : Math.max(0, flintLikesBudget - flintLikesUsed);

  // Messaging limits based on settings
  const flintMsgsBudget =
    typeof settings?.messagesPerCycle === 'number' && settings.messagesPerCycle > 0
      ? settings.messagesPerCycle
      : 20;
  const flintMsgsUsed =
    stats?.agentState?.currentCycle?.messagesProcessed ??
    stats?.agentState?.stats?.messages ??
    stats?.stats?.todayMessages ??
    0;
  const flintMsgsRemaining = Math.max(0, flintMsgsBudget - flintMsgsUsed);

  const isAgentRunning = Boolean(stats?.agentState?.isRunning);
  const interests = Array.isArray(tinderProfile.interests)
    ? tinderProfile.interests
    : [];

  const job = tinderProfile.job;
  const school = tinderProfile.school;
  const city = tinderProfile.city;

  const activeVitals = VITALS_CONFIG.filter((item) => {
    const val = formatValue(tinderProfile[item.key]);
    return Boolean(val);
  });

  const toggleCollapse = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(!collapsed);
  };

  // Pure-UI helpers: initials fallback when a photo is missing or fails to load.
  const initials = (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const tierTone = tinderPlan === 'platinum' || tinderPlan === 'gold' || tinderPlan === 'plus' ? tinderPlan : 'neutral';
  const likesLeftLabel = typeof flintLikesRemaining === 'number' ? `${flintLikesRemaining} left` : flintLikesRemaining;
  const msgsLeftLabel = typeof flintMsgsRemaining === 'number' ? `${flintMsgsRemaining} left` : flintMsgsRemaining;

  const renderPlaceholder = (size, style) => (
    <View style={[styles.photoPlaceholder, style]} accessibilityLabel="Profile photo unavailable">
      {initials ? (
        <Text style={[styles.placeholderInitials, size === 'lg' && styles.placeholderInitialsLg]} maxFontSizeMultiplier={1}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="flame" size={size === 'lg' ? 30 : 20} color={theme.colors.tinder} />
      )}
    </View>
  );

  const renderTelemetry = (likesLabel, msgsLabel) => (
    <>
      <View style={styles.telemetryPill}>
        <Ionicons name="heart" size={13} color={theme.colors.accent} />
        <Text style={styles.telemetryText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>
          {likesLabel}{' '}
          <Text style={styles.telemetryValue}>{likesLeftLabel}</Text>
        </Text>
      </View>
      <View style={styles.telemetryPill}>
        <Ionicons name="chatbubbles" size={13} color={theme.colors.info} />
        <Text style={styles.telemetryText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>
          {msgsLabel}{' '}
          <Text style={styles.telemetryValue}>{msgsLeftLabel}</Text>
        </Text>
      </View>
    </>
  );

  if (!isLoggedIn) {
    return (
      <View style={styles.cardContainer}>
        <LinearGradient
          colors={theme.gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.emptyCard}
        >
          {/* Header Row: Flame Icon + Title + Real Status */}
          <View style={styles.emptyHeaderRow}>
            <LinearGradient
              colors={theme.gradients.brandShort}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconBadge}
            >
              <Ionicons name="flame" size={22} color={theme.colors.onPrimary} />
            </LinearGradient>

            <View style={styles.emptyHeaderTextWrap}>
              <View style={styles.emptyTitleRow}>
                <Text style={styles.emptyTitle} accessibilityRole="header" numberOfLines={1}>Tinder Account</Text>
                <Badge label="CONNECT TO ACTIVATE" tone="primary" icon="sparkles" size="sm" />
              </View>
              <Text style={styles.emptySubtitle}>
                Connect your account to enable AI swiping, icebreakers, and live profile preview.
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Feature Highlights — Full-width, clean, and 100% accurate */}
          <View style={styles.benefitList}>
            <View style={styles.benefitItem}>
              <IconWell icon="person" tone="primary" size={32} iconSize={15} />
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>Profile Sync & Preview</Text>
                <Text style={styles.benefitDesc}>
                  Imports your photos, bio, interests, and Tinder tier into Flint
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <IconWell icon="heart" tone="secondary" size={32} iconSize={15} />
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>AI-Powered Swiping</Text>
                <Text style={styles.benefitDesc}>
                  Automates likes and passes based on your age, distance, and bio filters
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <IconWell icon="chatbubbles" tone="info" size={32} iconSize={15} />
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>Smart Openers & Replies</Text>
                <Text style={styles.benefitDesc}>
                  Starts conversations and chats with matches using your selected tone
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <IconWell icon="stats-chart" tone="success" size={32} iconSize={15} />
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>Live Match & Activity Stats</Text>
                <Text style={styles.benefitDesc}>
                  Tracks your daily swipes, new matches, and active chat responses
                </Text>
              </View>
            </View>
          </View>

          {/* CTA Button */}
          {onOpenTinder && (
            <AppButton
              title="Connect Tinder Account"
              icon="flame"
              iconRight="chevron-forward"
              onPress={onOpenTinder}
              accessibilityLabel="Connect Tinder Account"
            />
          )}

          {/* Honest, Clear Trust Note */}
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.muted} />
            <Text style={styles.trustText}>
              Official Tinder web login · Disconnect anytime
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ── Collapsed View (Summary Bar with Active Plan & Flint Automation Telemetry) ──
  if (collapsed) {
    return (
      <View style={styles.cardContainer}>
        <MotionTouchable
          activeOpacity={0.85}
          pressScale={0.985}
          onPress={toggleCollapse}
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          accessibilityLabel={`Tinder connected as ${name || 'user'}. Tap to preview full profile.`}
        >
          <LinearGradient
            colors={theme.gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.collapsedCard}
          >
            <View style={styles.collapsedHeaderRow}>
              {/* Avatar + Active Status Dot */}
              <View style={styles.collapsedAvatarWrap}>
                {heroPhoto && !photoError ? (
                  <Image
                    source={{ uri: typeof heroPhoto === 'string' ? heroPhoto : heroPhoto?.url }}
                    style={styles.collapsedAvatar}
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  renderPlaceholder('sm', styles.collapsedAvatar)
                )}
                <View style={styles.collapsedLiveDot} />
              </View>

              {/* Name & Subtitle */}
              <View style={styles.collapsedIdentity}>
                <View style={styles.nameRow}>
                  <Text style={styles.collapsedName} numberOfLines={1}>
                    {name || 'Tinder Account'}
                  </Text>
                  {age ? <Text style={styles.collapsedAge}>, {age}</Text> : null}
                  <Ionicons name="checkmark-circle" size={14} color={theme.colors.info} style={styles.verifiedIconSm} />
                </View>
                <Text style={styles.collapsedSubtitle} numberOfLines={2}>
                  Connected Tinder account · Tap to view details
                </Text>
              </View>

              {/* Right Side: Plan Badge + Chevron */}
              <View style={styles.collapsedRightAction}>
                <Badge label={activePlanBadge} tone={tierTone} size="sm" />
                <Ionicons name="chevron-down" size={18} color={theme.colors.muted} />
              </View>
            </View>

            {/* Telemetry Strip: Flint Automation Likes & Messages Remaining */}
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryStrip}>
              {renderTelemetry('Likes:', 'Messages:')}

              {isAgentRunning && (
                <Badge label="Automating" tone="success" dot size="sm" style={styles.sessionBadge} />
              )}
            </View>
          </LinearGradient>
        </MotionTouchable>
      </View>
    );
  }

  // ── Expanded View (Hero Dating Profile Card) ──
  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={theme.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.heroCard}
      >
        {/* Top Header Badge Row */}
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={0.7}
          onPress={toggleCollapse}
          accessibilityRole="button"
          accessibilityLabel={compact ? 'Tinder profile' : 'Collapse Tinder profile'}
          accessibilityState={{ expanded: true }}
        >
          <View style={styles.headerBrand}>
            <View style={styles.flameIconBadge}>
              <Ionicons name="flame" size={14} color={theme.colors.tinder} />
            </View>
            <Text style={styles.headerBrandText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>TINDER PROFILE</Text>
          </View>

          <View style={styles.headerBadges}>
            {/* Live Session Pill — only when agent is active */}
            {isAgentRunning && (
              <Badge label="Automating" tone="success" dot size="sm" />
            )}

            {/* Active Plan Pill */}
            <Badge label={activePlanBadge} tone={tierTone} size="sm" />

            {!compact && (
              <Ionicons name="chevron-up" size={18} color={theme.colors.muted} />
            )}
          </View>
        </TouchableOpacity>

        {/* Telemetry Strip: Flint Automation Likes & Messages Remaining */}
        <View style={styles.telemetryStrip}>
          {renderTelemetry('AI Likes:', 'AI Messages:')}
        </View>

        {/* Hero Identity: Avatar + Name + Age + Taglines */}
        <View style={styles.identityRow}>
          <View style={styles.avatarWrapper}>
            {heroPhoto && !photoError ? (
              <Image
                source={{ uri: typeof heroPhoto === 'string' ? heroPhoto : heroPhoto?.url }}
                style={styles.avatarImage}
                onError={() => setPhotoError(true)}
                accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
              />
            ) : (
              renderPlaceholder('lg', styles.avatarImage)
            )}
            <View style={styles.avatarFlameIcon}>
              <Ionicons name="flame" size={12} color={theme.colors.onPrimary} />
            </View>
          </View>

          <View style={styles.identityContent}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1} accessibilityRole="header">
                {name || 'Tinder Profile'}
              </Text>
              {age ? <Text style={styles.profileAge}>, {age}</Text> : null}
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={theme.colors.info}
                style={styles.verifiedIcon}
              />
            </View>

            {city ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-sharp" size={13} color={theme.colors.secondary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {city}
                </Text>
              </View>
            ) : null}

            {job ? (
              <View style={styles.metaRow}>
                <Ionicons name="briefcase-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {job}
                </Text>
              </View>
            ) : null}

            {school ? (
              <View style={styles.metaRow}>
                <Ionicons name="school-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {school}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Multi-Photo Carousel Strip */}
        {photos.length > 1 && (
          <View style={styles.photosSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionMiniTitle} accessibilityRole="header">PHOTOS</Text>
              <Text style={styles.sectionCounter}>{photos.length} synced</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStripContainer}
            >
              {photos.map((p, idx) => {
                const photoUrl = typeof p === 'string' ? p : p?.url;
                const isSelected = idx === selectedPhotoIdx;
                return (
                  <TouchableOpacity
                    key={`${photoUrl}-${idx}`}
                    onPress={() => setSelectedPhotoIdx(idx)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Photo ${idx + 1} of ${photos.length}`}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.photoThumbWrapper,
                      isSelected && styles.photoThumbSelected,
                    ]}
                  >
                    <View style={styles.photoThumbFallback}>
                      <Ionicons name="image-outline" size={18} color={theme.colors.textTertiary} />
                    </View>
                    <Image source={{ uri: photoUrl }} style={styles.photoThumbImage} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Bio Quote Card */}
        {bio ? (
          <View style={styles.bioCard}>
            <Ionicons
              name="chatbox-ellipses-outline"
              size={16}
              color={theme.colors.accent}
              style={styles.bioIcon}
            />
            <Text style={styles.bioText}>"{bio}"</Text>
          </View>
        ) : null}

        {/* Passions & Interests Chips Cloud */}
        {interests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text style={styles.sectionMiniTitle} accessibilityRole="header">PASSIONS & INTERESTS</Text>
            <View style={styles.chipsCloud}>
              {interests.map((interest, idx) => {
                const label = typeof interest === 'string' ? interest : interest?.name || '';
                if (!label) return null;
                return (
                  <View key={`${label}-${idx}`} style={styles.interestChip}>
                    <Text style={styles.interestChipText} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Vitals & Lifestyle 2-Column Grid */}
        {activeVitals.length > 0 && (
          <View style={styles.vitalsSection}>
            <Text style={styles.sectionMiniTitle} accessibilityRole="header">LIFESTYLE & DETAILS</Text>
            <View style={styles.vitalsGrid}>
              {activeVitals.map((item) => {
                const value = formatValue(tinderProfile[item.key]);
                return (
                  <View key={item.key} style={styles.vitalCell} accessible accessibilityLabel={`${item.label}: ${value}`}>
                    <IconWell icon={item.icon} tone="primary" size={28} iconSize={14} />
                    <View style={styles.vitalTextWrap}>
                      <Text style={styles.vitalLabel} numberOfLines={1} maxFontSizeMultiplier={theme.fontScale.chrome}>{item.label}</Text>
                      <Text style={styles.vitalValue} numberOfLines={2}>
                        {value}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Actions Dock */}
        <View style={styles.actionsDock}>
          {onSync && (
            <AppButton
              title={syncing ? 'Syncing...' : 'Sync latest details'}
              icon="refresh-outline"
              size="sm"
              onPress={onSync}
              loading={syncing}
              style={styles.dockButton}
            />
          )}

          {onOpenTinder && (
            <AppButton
              title="Open Tinder"
              icon="flame"
              size="sm"
              variant="secondary"
              onPress={onOpenTinder}
              style={styles.dockButton}
            />
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    marginVertical: theme.spacing.xs,
  },
  heroCard: {
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    ...theme.shadows.md,
    gap: theme.spacing.lg,
  },
  collapsedCard: {
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    ...theme.shadows.sm,
    gap: theme.spacing.md,
  },
  collapsedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  collapsedAvatarWrap: {
    position: 'relative',
  },
  collapsedAvatar: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: c.elevated,
    borderWidth: 1.5,
    borderColor: c.primaryBorder,
  },
  collapsedLiveDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: c.success,
    borderWidth: 2,
    borderColor: c.surface,
  },
  collapsedIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  collapsedName: {
    ...theme.type.headline,
    fontFamily: theme.fonts.heading,
    color: c.text,
    flexShrink: 1,
  },
  collapsedAge: {
    ...theme.type.headline,
    fontFamily: theme.fonts.body,
    color: c.textSecondary,
  },
  collapsedSubtitle: {
    ...theme.type.footnote,
    color: c.muted,
  },
  collapsedRightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexShrink: 0,
  },
  telemetryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.divider,
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  telemetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: c.neutralSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: c.neutralBorder,
  },
  telemetryText: {
    ...theme.type.footnote,
    color: c.muted,
    flexShrink: 1,
  },
  telemetryValue: {
    fontFamily: theme.fonts.label,
    color: c.text,
  },
  sessionBadge: {
    alignSelf: 'center',
  },
  emptyCard: {
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    ...theme.shadows.sm,
    gap: theme.spacing.lg,
  },
  emptyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  emptyIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  emptyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  emptyTitle: {
    ...theme.type.headline,
    fontFamily: theme.fonts.heading,
    color: c.text,
    flexShrink: 1,
  },
  emptySubtitle: {
    ...theme.type.footnote,
    color: c.muted,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.divider,
  },
  benefitList: {
    gap: theme.spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  benefitTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  benefitTitle: {
    ...theme.type.subhead,
    fontFamily: theme.fonts.label,
    color: c.text,
  },
  benefitDesc: {
    ...theme.type.footnote,
    color: c.muted,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -theme.spacing.xs,
  },
  trustText: {
    ...theme.type.footnote,
    color: c.muted,
    flexShrink: 1,
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    minHeight: theme.layout.touchTarget - 8,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexShrink: 1,
    minWidth: 0,
  },
  flameIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: alpha(c.tinder, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandText: {
    ...theme.type.overline,
    color: c.secondary,
    flexShrink: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.xl,
    backgroundColor: c.elevated,
    borderWidth: 2,
    borderColor: c.primaryBorder,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.elevatedHigh,
  },
  placeholderInitials: {
    ...theme.type.headline,
    fontFamily: theme.fonts.heading,
    color: c.textSecondary,
  },
  placeholderInitialsLg: {
    ...theme.type.title,
  },
  avatarFlameIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.tinder,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surface,
  },
  identityContent: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  profileName: {
    ...theme.type.title2,
    color: c.text,
    flexShrink: 1,
  },
  profileAge: {
    ...theme.type.title2,
    fontFamily: theme.fonts.body,
    color: c.textSecondary,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  verifiedIconSm: {
    marginLeft: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    ...theme.type.footnote,
    color: c.muted,
    flex: 1,
  },
  photosSection: {
    gap: theme.spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionMiniTitle: {
    ...theme.type.overline,
    color: c.muted,
  },
  sectionCounter: {
    ...theme.type.footnote,
    color: c.muted,
  },
  photoStripContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingVertical: 2,
  },
  photoThumbWrapper: {
    width: 60,
    height: 80,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: c.elevated,
  },
  photoThumbSelected: {
    borderColor: c.primary,
  },
  photoThumbFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.sm - 2,
  },
  bioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: alpha(c.black, 0.25),
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  bioIcon: {
    marginTop: 2,
  },
  bioText: {
    ...theme.type.callout,
    color: c.text,
    flex: 1,
    fontStyle: 'italic',
  },
  interestsSection: {
    gap: theme.spacing.sm,
  },
  chipsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestChip: {
    maxWidth: '100%',
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  interestChipText: {
    ...theme.type.subhead,
    color: c.text,
  },
  vitalsSection: {
    gap: theme.spacing.sm,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  vitalCell: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: c.neutralSoft,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  vitalTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  vitalLabel: {
    ...theme.type.overline,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    color: c.muted,
    textTransform: 'uppercase',
  },
  vitalValue: {
    ...theme.type.footnote,
    fontFamily: theme.fonts.caption,
    color: c.text,
  },
  actionsDock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  dockButton: {
    flexGrow: 1,
    flexBasis: 150,
  },
});
