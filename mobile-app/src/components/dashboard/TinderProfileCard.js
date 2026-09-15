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
import { theme } from '../../theme';
import SafeActivityIndicator from '../common/SafeActivityIndicator';

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

  if (!isLoggedIn) {
    return (
      <View style={styles.cardContainer}>
        <LinearGradient
          colors={['#251220', '#180B15']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.emptyCard}
        >
          {/* Header Row: Flame Icon + Title + Real Status */}
          <View style={styles.emptyHeaderRow}>
            <LinearGradient
              colors={['#FE3C72', '#FF655B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconBadge}
            >
              <Ionicons name="flame" size={22} color="#FFFFFF" />
            </LinearGradient>

            <View style={styles.emptyHeaderTextWrap}>
              <View style={styles.emptyTitleRow}>
                <Text style={styles.emptyTitle}>Tinder Account</Text>
                <View style={styles.emptyStatusBadge}>
                  <Ionicons name="sparkles" size={10} color="#FE3C72" />
                  <Text style={styles.emptyStatusBadgeText}>CONNECT TO ACTIVATE</Text>
                </View>
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
              <View style={[styles.benefitIconWrap, { backgroundColor: 'rgba(254, 60, 114, 0.12)' }]}>
                <Ionicons name="person" size={14} color="#FE3C72" />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>Profile Sync & Preview</Text>
                <Text style={styles.benefitDesc}>
                  Imports your photos, bio, interests, and Tinder tier into Flint
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIconWrap, { backgroundColor: 'rgba(255, 101, 91, 0.12)' }]}>
                <Ionicons name="heart" size={14} color="#FF655B" />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>AI-Powered Swiping</Text>
                <Text style={styles.benefitDesc}>
                  Automates likes and passes based on your age, distance, and bio filters
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIconWrap, { backgroundColor: 'rgba(0, 208, 255, 0.12)' }]}>
                <Ionicons name="chatbubbles" size={14} color="#00D0FF" />
              </View>
              <View style={styles.benefitTextWrap}>
                <Text style={styles.benefitTitle}>Smart Openers & Replies</Text>
                <Text style={styles.benefitDesc}>
                  Starts conversations and chats with matches using your selected tone
                </Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={[styles.benefitIconWrap, { backgroundColor: 'rgba(97, 214, 163, 0.12)' }]}>
                <Ionicons name="stats-chart" size={14} color="#61D6A3" />
              </View>
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
            <TouchableOpacity
              style={styles.connectButton}
              onPress={onOpenTinder}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Connect Tinder Account"
            >
              <LinearGradient
                colors={['#FE3C72', '#FF655B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.connectButtonGradient}
              >
                <Ionicons name="flame" size={18} color="#FFFFFF" />
                <Text style={styles.connectButtonText}>Connect Tinder Account</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
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
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={toggleCollapse}
          accessibilityRole="button"
          accessibilityLabel={`Tinder connected as ${name || 'user'}. Tap to preview full profile.`}
        >
          <LinearGradient
            colors={['#241221', '#170C16']}
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
                  <View style={styles.collapsedPlaceholder}>
                    <Ionicons name="flame" size={20} color="#FE3C72" />
                  </View>
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
                  <Ionicons name="checkmark-circle" size={14} color="#00D0FF" style={{ marginLeft: 4 }} />
                </View>
                <Text style={styles.collapsedSubtitle}>
                  Connected Tinder account · Tap to view details
                </Text>
              </View>

              {/* Right Side: Plan Badge + Chevron */}
              <View style={styles.collapsedRightAction}>
                <View
                  style={[
                    styles.tierPill,
                    tinderPlan === 'platinum'
                      ? styles.tierPlatinum
                      : tinderPlan === 'gold'
                        ? styles.tierGold
                        : tinderPlan === 'plus'
                          ? styles.tierPlus
                          : styles.tierFree,
                  ]}
                >
                  <Text style={styles.tierText}>{activePlanBadge}</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={theme.colors.muted} />
              </View>
            </View>

            {/* Telemetry Strip: Flint Automation Likes & Messages Remaining */}
            <View style={styles.telemetryDivider} />
            <View style={styles.telemetryStrip}>
              <View style={styles.telemetryPill}>
                <Ionicons name="heart" size={13} color="#FE3C72" />
                <Text style={styles.telemetryText}>
                  Likes:{' '}
                  <Text style={styles.telemetryValue}>
                    {typeof flintLikesRemaining === 'number'
                      ? `${flintLikesRemaining} left`
                      : flintLikesRemaining}
                  </Text>
                </Text>
              </View>

              <View style={styles.telemetryPill}>
                <Ionicons name="chatbubbles" size={13} color="#00D0FF" />
                <Text style={styles.telemetryText}>
                  Messages:{' '}
                  <Text style={styles.telemetryValue}>
                    {typeof flintMsgsRemaining === 'number'
                      ? `${flintMsgsRemaining} left`
                      : flintMsgsRemaining}
                  </Text>
                </Text>
              </View>

              {isAgentRunning && (
                <View style={styles.sessionPill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.sessionText}>Automating</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Expanded View (Hero Dating Profile Card) ──
  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={['#241221', '#170C16']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.heroCard}
      >
        {/* Top Header Badge Row */}
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={0.7}
          onPress={toggleCollapse}
        >
          <View style={styles.headerBrand}>
            <View style={styles.flameIconBadge}>
              <Ionicons name="flame" size={14} color="#FE3C72" />
            </View>
            <Text style={styles.headerBrandText}>TINDER PROFILE</Text>
          </View>

          <View style={styles.headerBadges}>
            {/* Live Session Pill — only when agent is active */}
            {isAgentRunning && (
              <View style={styles.sessionPill}>
                <View style={styles.liveDot} />
                <Text style={styles.sessionText}>Automating</Text>
              </View>
            )}

            {/* Active Plan Pill */}
            <View
              style={[
                styles.tierPill,
                tinderPlan === 'platinum'
                  ? styles.tierPlatinum
                  : tinderPlan === 'gold'
                    ? styles.tierGold
                    : tinderPlan === 'plus'
                      ? styles.tierPlus
                      : styles.tierFree,
              ]}
            >
              <Text style={styles.tierText}>{activePlanBadge}</Text>
            </View>

            {!compact && (
              <Ionicons name="chevron-up" size={18} color={theme.colors.muted} />
            )}
          </View>
        </TouchableOpacity>

        {/* Telemetry Strip: Flint Automation Likes & Messages Remaining */}
        <View style={styles.telemetryStrip}>
          <View style={styles.telemetryPill}>
            <Ionicons name="heart" size={13} color="#FE3C72" />
            <Text style={styles.telemetryText}>
              AI Likes:{' '}
              <Text style={styles.telemetryValue}>
                {typeof flintLikesRemaining === 'number'
                  ? `${flintLikesRemaining} left`
                  : flintLikesRemaining}
              </Text>
            </Text>
          </View>

          <View style={styles.telemetryPill}>
            <Ionicons name="chatbubbles" size={13} color="#00D0FF" />
            <Text style={styles.telemetryText}>
              AI Messages:{' '}
              <Text style={styles.telemetryValue}>
                {typeof flintMsgsRemaining === 'number'
                  ? `${flintMsgsRemaining} left`
                  : flintMsgsRemaining}
              </Text>
            </Text>
          </View>
        </View>

        {/* Hero Identity: Avatar + Name + Age + Taglines */}
        <View style={styles.identityRow}>
          <View style={styles.avatarWrapper}>
            {heroPhoto && !photoError ? (
              <Image
                source={{ uri: typeof heroPhoto === 'string' ? heroPhoto : heroPhoto?.url }}
                style={styles.avatarImage}
                onError={() => setPhotoError(true)}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="flame" size={32} color="#FE3C72" />
              </View>
            )}
            <View style={styles.avatarFlameIcon}>
              <Ionicons name="flame" size={12} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.identityContent}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {name || 'Tinder Profile'}
              </Text>
              {age ? <Text style={styles.profileAge}>, {age}</Text> : null}
              <Ionicons
                name="checkmark-circle"
                size={18}
                color="#00D0FF"
                style={styles.verifiedIcon}
              />
            </View>

            {city ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-sharp" size={13} color="#FF655B" />
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
              <Text style={styles.sectionMiniTitle}>PHOTOS</Text>
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
                    style={[
                      styles.photoThumbWrapper,
                      isSelected && styles.photoThumbSelected,
                    ]}
                  >
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
              color="#FE3C72"
              style={styles.bioIcon}
            />
            <Text style={styles.bioText}>"{bio}"</Text>
          </View>
        ) : null}

        {/* Passions & Interests Chips Cloud */}
        {interests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text style={styles.sectionMiniTitle}>PASSIONS & INTERESTS</Text>
            <View style={styles.chipsCloud}>
              {interests.map((interest, idx) => {
                const label = typeof interest === 'string' ? interest : interest?.name || '';
                if (!label) return null;
                return (
                  <View key={`${label}-${idx}`} style={styles.interestChip}>
                    <Text style={styles.interestChipText}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Vitals & Lifestyle 2-Column Grid */}
        {activeVitals.length > 0 && (
          <View style={styles.vitalsSection}>
            <Text style={styles.sectionMiniTitle}>LIFESTYLE & DETAILS</Text>
            <View style={styles.vitalsGrid}>
              {activeVitals.map((item) => {
                const value = formatValue(tinderProfile[item.key]);
                return (
                  <View key={item.key} style={styles.vitalCell}>
                    <View style={styles.vitalIconWrap}>
                      <Ionicons name={item.icon} size={15} color="#FE3C72" />
                    </View>
                    <View style={styles.vitalTextWrap}>
                      <Text style={styles.vitalLabel}>{item.label}</Text>
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
            <TouchableOpacity
              style={styles.syncButton}
              onPress={onSync}
              disabled={syncing}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {syncing ? (
                <SafeActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.syncButtonText}>
                {syncing ? 'Syncing...' : 'Sync latest details'}
              </Text>
            </TouchableOpacity>
          )}

          {onOpenTinder && (
            <TouchableOpacity
              style={styles.openTinderBtn}
              onPress={onOpenTinder}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Ionicons name="flame" size={16} color="#FE3C72" />
              <Text style={styles.openTinderText}>Open Tinder</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    marginVertical: 4,
  },
  heroCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.22)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
    gap: 14,
  },
  collapsedCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.22)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
    gap: 10,
  },
  collapsedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  collapsedAvatarWrap: {
    position: 'relative',
  },
  collapsedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: '#FE3C72',
  },
  collapsedPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2D1425',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FE3C72',
  },
  collapsedLiveDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#61D6A3',
    borderWidth: 1.5,
    borderColor: '#170C16',
  },
  collapsedIdentity: {
    flex: 1,
    gap: 2,
  },
  collapsedName: {
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '700',
  },
  collapsedAge: {
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  collapsedSubtitle: {
    ...theme.type.caption,
    color: theme.colors.muted,
    fontSize: 11,
  },
  collapsedRightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  telemetryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  telemetryText: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  telemetryValue: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.22)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
    gap: 12,
  },
  emptyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeaderTextWrap: {
    flex: 1,
    gap: 3,
  },
  emptyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.28)',
  },
  emptyStatusBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FE3C72',
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    ...theme.type.caption,
    color: theme.colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  benefitList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  benefitIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextWrap: {
    flex: 1,
    gap: 1,
  },
  benefitTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: theme.colors.text,
  },
  benefitDesc: {
    fontSize: 11,
    color: theme.colors.muted,
    lineHeight: 15,
  },
  connectButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  connectButtonText: {
    ...theme.type.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trustText: {
    fontSize: 11,
    color: theme.colors.muted,
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flameIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(254, 60, 114, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandText: {
    ...theme.type.caption,
    color: '#FF655B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(97, 214, 163, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(97, 214, 163, 0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#61D6A3',
  },
  sessionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#61D6A3',
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tierPlatinum: {
    backgroundColor: 'rgba(229, 228, 226, 0.15)',
    borderColor: 'rgba(229, 228, 226, 0.4)',
  },
  tierGold: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  tierPlus: {
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
    borderColor: 'rgba(254, 60, 114, 0.4)',
  },
  tierFree: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: '#FE3C72',
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2D1425',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FE3C72',
  },
  avatarFlameIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FE3C72',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#170C16',
  },
  identityContent: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  profileName: {
    fontFamily: theme.fonts.heading,
    fontSize: 19,
    color: theme.colors.text,
    fontWeight: '700',
  },
  profileAge: {
    fontFamily: theme.fonts.heading,
    fontSize: 19,
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    ...theme.type.caption,
    color: theme.colors.muted,
    fontSize: 12,
    flex: 1,
  },
  photosSection: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionMiniTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.muted,
    letterSpacing: 0.8,
  },
  sectionCounter: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  photoStripContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  photoThumbWrapper: {
    width: 60,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  photoThumbSelected: {
    borderColor: '#FE3C72',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  bioCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.15)',
  },
  bioIcon: {
    marginTop: 2,
  },
  bioText: {
    ...theme.type.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.text,
    flex: 1,
    fontStyle: 'italic',
  },
  interestsSection: {
    gap: 8,
  },
  chipsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestChip: {
    backgroundColor: 'rgba(254, 60, 114, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  interestChipText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  vitalsSection: {
    gap: 8,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vitalCell: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  vitalIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalTextWrap: {
    flex: 1,
  },
  vitalLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  vitalValue: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  actionsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  syncButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FE3C72',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  syncButtonText: {
    ...theme.type.label,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  openTinderBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  openTinderText: {
    ...theme.type.label,
    color: '#FE3C72',
    fontWeight: '600',
    fontSize: 13,
  },
});
