import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Image,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { MotionTouchable as TouchableOpacity, FadeIn, useMotionReduced } from "../common/Motion";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ActivityIndicator from "../common/SafeActivityIndicator";
import MasterControlOrb from "./MasterControlOrb";
import { getLikesReplenishStatus } from "../../utils/sessionManager";
import TinderCollections from "./TinderCollections";
import LikesYou from "./LikesYou";
// import MatchMessages from "./MatchMessages"; // separate Chats section (commented out)
import Badge from "../ui/Badge";
import LiveDot from "../ui/LiveDot";
import IconButton from "../ui/IconButton";
import useResponsive from "../../hooks/useResponsive";
import useTinderLikesCount from "../../hooks/useTinderLikesCount";
import CountUp from "../ui/CountUp";
import { createStyles, theme as uiTheme, alpha } from "../../theme";

const c = uiTheme.colors;
const t = uiTheme.type;
const sp = uiTheme.spacing;
const r = uiTheme.radius;

const titleCase = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
const GOALS = {
  date: "Dates",
  phone: "Phone",
  instagram: "Socials",
  move_to_instagram: "Instagram",
  never: "Conversation",
};

// Tinder plan → Badge tone/icon/label (tiers use the dedicated tier tokens).
const PLAN_BADGES = {
  platinum: { tone: "platinum", icon: "diamond", label: "Platinum" },
  gold: { tone: "gold", icon: "star", label: "Gold" },
  plus: { tone: "plus", icon: "flash", label: "Plus" },
};
const FREE_PLAN_BADGE = { tone: "neutral", icon: undefined, label: "Free" };

// Stagger step for section entrances (≤ 60ms per the motion guidelines).
const STAGGER = 60;

const greetingFor = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const tinderPhotoFor = (settings) => {
  const photos = settings?.userProfile?.photos;
  if (!Array.isArray(photos)) return null;
  for (const item of photos) {
    const url = typeof item === "string" ? item : item?.url || item?.processedFiles?.[0]?.url;
    if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
  }
  return null;
};

// Round/rounded photo that falls back to `fallback` when the URL is missing or fails to load.
function ProfilePhoto({ uri, style, fallback }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [uri]);
  if (!uri || failed) return fallback;
  return (
    <Image
      source={{ uri }}
      style={[style, styles.photo]}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

const displayNameFor = (settings, user) => {
  const raw =
    settings?.accountProfile?.name ||
    settings?.userProfile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? String(user.email).split("@")[0] : "");
  return String(raw || "").trim().split(/\s+/)[0] || "there";
};

export default function HomeOverview({
  stats,
  agentState,
  settings,
  user,
  isLoggedIn,
  starting,
  checking,
  checkingAuth,
  latencyMs,
  unreadCount = 0,
  onOpenBrowser,
  onToggleAgent,
  onAutomation,
  onSettings,
  onActivity,
  onNotifications,
  onProfile,
  onEnterPocketMode,
  onMenu,
  onAppSettings,
}) {
  const { gutter, isCompact, contentMax, isLandscape } = useResponsive();
  const effectiveStats = stats || agentState || {};
  const state = effectiveStats?.agentState || effectiveStats || {};
  const totals = effectiveStats?.lifetimeStats || state?.stats || {};
  const isChecking = checking ?? checkingAuth ?? false;
  const isStarting = Boolean(starting);
  const busy = isStarting || isChecking;

  const [likesStatus, setLikesStatus] = React.useState(() => getLikesReplenishStatus(state));
  React.useEffect(() => {
    const update = () => setLikesStatus(getLikesReplenishStatus(state));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [state?.likesReplenishTimestamp, state?.likesExhaustedAt, state?.waitingReason, effectiveStats]);

  const plan = settings?.userProfile?.tinderPlan || settings?.tinderPlan;
  const isPaidPlan = plan === "platinum" || plan === "gold" || plan === "plus" || settings?.userProfile?.isTinderPro;

  const running = Boolean(
    (isLoggedIn || state?.isRunning === true) &&
    (state?.isRunning === true ||
      (state?.isRunning !== false &&
        state?.currentPhase &&
        !["stopped", "idle", "waiting", "paused"].includes(state.currentPhase))),
  );
  const goal =
    settings?.goal ||
    settings?.primaryGoal ||
    settings?.selectedGoal ||
    settings?.primaryGoals?.[0] ||
    "never";
  const tone =
    settings?.tone ||
    settings?.chattingStyle ||
    settings?.personalityStyle ||
    "freestyle";
  const safe = settings?.safetyMode ?? settings?.safeModeEnabled ?? true;
  const metrics = [
    {
      label: "SWIPES",
      value: Math.max(
        totals.totalSwipes ?? totals.totalLikes ?? totals.swipes ?? 0,
        state?.currentCycle?.likesCompleted ?? 0
      ),
      icon: "heart-outline",
      color: c.primary,
    },
    {
      label: "MATCHES",
      value:
        totals.totalMatches ?? totals.matchesCreated ?? totals.matches ?? 0,
      icon: "people-outline",
      color: c.secondary,
    },
    {
      label: "REPLIES",
      value:
        totals.totalMessages ?? totals.messagesSent ?? totals.messages ?? 0,
      icon: "chatbubble-outline",
      color: c.success,
    },
  ];

  const planBadge = PLAN_BADGES[settings?.userProfile?.tinderPlan] || FREE_PLAN_BADGE;
  const latencyLabel =
    isLoggedIn && Number.isFinite(latencyMs)
      ? `${Math.round(latencyMs)}ms`
      : "—";

  const stateTitle = busy
    ? "Connecting"
    : !isLoggedIn
      ? "Not connected"
      : state?.waitingReason === "safety_lock"
        ? "Safety pause"
        : state?.waitingReason === "likes_exhausted"
          ? (running ? "Wingman chatting" : "Daily likes refill")
        : running
          ? (state?.currentPhase === "messaging"
              ? "Wingman messaging"
              : state?.currentPhase === "transitioning"
                ? "Wingman resting"
                : state?.currentPhase === "waiting" || state?.currentPhase === "polling"
                  ? "Awaiting replies"
                  : "Wingman active")
          : "Wingman standby";
  const statusLabel = busy
    ? "Starting"
    : !isLoggedIn
      ? "Connect to start"
      : state?.waitingReason === "safety_lock"
        ? "Safety pause"
        : state?.waitingReason === "likes_exhausted"
          ? (running ? "Messaging" : "Refilling")
        : running
          ? (state?.currentPhase === "messaging"
              ? "Replying"
              : state?.currentPhase === "transitioning"
                ? "Resting"
                : state?.currentPhase === "waiting" || state?.currentPhase === "polling"
                  ? "Checking"
                  : (settings?.autoSwipe === false || settings?.likesPerCycle <= 0 ? "Messaging" : "Swiping"))
          : (settings?.autoSwipe === false || settings?.likesPerCycle <= 0 ? "Ready to chat" : "Ready to swipe");
  // Status tone mirrors the previous dot colours: live → success, offline → neutral,
  // likes refill → info, otherwise brand.
  const statusTone = running
    ? "success"
    : !isLoggedIn
      ? "neutral"
      : state?.waitingReason === "likes_exhausted"
        ? "info"
        : "primary";
  const statusColor = { success: c.success, neutral: c.textTertiary, info: c.info, primary: c.accent }[statusTone];

  // Cycle progress (presentation of the same likes counters the orb shows).
  const cycleLikes = state?.currentCycle?.likesCompleted ?? 0;
  const cycleTarget = settings?.likesPerCycle || 50;
  const showCycle = isLoggedIn && running && cycleLikes > 0 && settings?.autoSwipe !== false;

  const name = displayNameFor(settings, user);
  const photoUri = tinderPhotoFor(settings);
  const likesYou = useTinderLikesCount();
  const showLikes = isLoggedIn && likesYou.count != null;
  const initials = name === "there" ? "" : name.slice(0, 1).toUpperCase();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: contentMax }]}
    >
      <AmbientGlow />

      {/* ── Personal header ── */}
      <FadeIn style={styles.topBar}>
        {/* Only the avatar opens Profile; the greeting and name are plain text. */}
        <View style={styles.identity}>
          <TouchableOpacity
            onPress={onProfile}
            disabled={!onProfile}
            pressScale={0.92}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
          <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
            <View style={styles.avatar}>
              <ProfilePhoto
                uri={photoUri}
                style={styles.avatarPhoto}
                fallback={initials ? (
                  <Text style={styles.avatarText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{initials}</Text>
                ) : (
                  <Ionicons name="person" size={20} color={c.textSecondary} />
                )}
              />
            </View>
          </LinearGradient>
          </TouchableOpacity>
          <View style={styles.greetingCopy} accessible accessibilityLabel={`${greetingFor()}, ${name === "there" ? "welcome back" : name}`}>
            <Text style={styles.greetingLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
              {greetingFor()}
            </Text>
            <Text style={styles.greetingName} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
              {name === "there" ? "Welcome back" : name}
            </Text>
          </View>
        </View>
        <View style={styles.topBarActions}>
          {onNotifications ? (
            <IconButton
              icon="notifications-outline"
              onPress={onNotifications}
              accessibilityLabel={`Notifications, ${unreadCount} unread`}
              badge={unreadCount > 0}
              style={styles.roundButton}
            />
          ) : null}
          {onAppSettings ? (
            <IconButton
              icon="settings-outline"
              onPress={onAppSettings}
              accessibilityLabel="App settings"
              style={styles.roundButton}
            />
          ) : null}
          {/* Three-line quick menu (commented out; Pocket mode moved into the wingman card).
          {onMenu ? (
            <IconButton
              icon="menu-outline"
              onPress={onMenu}
              accessibilityLabel="Quick actions menu"
              color={running ? "#FBBF24" : undefined}
              badge={running}
              style={[
                styles.roundButton,
                running && styles.roundButtonActive,
              ]}
            />
          ) : null}
          */}
        </View>
      </FadeIn>

      {/* ── Control center hero ── */}
      <FadeIn delay={STAGGER}>
        <View style={styles.hero}>
          <LinearGradient
            pointerEvents="none"
            colors={uiTheme.gradients.hero}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[alpha(c.primary, 0.18), alpha(c.primary, 0)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={styles.heroGlow}
          />

          {/* Connection strip: Tinder session, location, plan, latency */}
          <TouchableOpacity
            style={styles.connection}
            onPress={onOpenBrowser}
            disabled={starting}
            activeOpacity={0.8}
            pressScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={
              `${isLoggedIn ? "Open Tinder account" : "Connect Tinder account"}. ${isLoggedIn ? "Live" : "Offline"}` +
              `${settings?.locationCity ? `, ${settings.locationCity}` : ""}${isLoggedIn ? `, ${planBadge.label} plan, latency ${latencyLabel === "—" ? "unavailable" : latencyLabel}` : ""}`
            }
            accessibilityState={{ disabled: Boolean(starting), busy: Boolean(starting) }}
          >
            <View style={styles.flameWrap}>
              <ProfilePhoto
                uri={isLoggedIn ? photoUri : null}
                style={styles.flame}
                fallback={
                  <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flame}>
                    <Ionicons name="flame" size={18} color={c.onPrimary} />
                  </LinearGradient>
                }
              />
              {isLoggedIn && photoUri ? (
                <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flameBadge}>
                  <Ionicons name="flame" size={10} color={c.onPrimary} />
                </LinearGradient>
              ) : null}
              <LiveDot style={styles.onlineDot} size={10} active={isLoggedIn} color={isLoggedIn ? c.success : c.textTertiary} ringColor={c.elevated} />
            </View>
            <View style={styles.connectionCopy}>
              {/* Plan badge sits with the title, not pushed to the far edge of the row. */}
              <View style={styles.connectionTitleRow}>
                <Text style={styles.connectionTitle} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  {isLoggedIn ? "Tinder connected" : "Connect Tinder"}
                </Text>
                {isLoggedIn && !isCompact ? (
                  <Badge label={planBadge.label} tone={planBadge.tone} icon={planBadge.icon} size="sm" />
                ) : null}
              </View>
              <View style={styles.connectionMeta}>
                <Ionicons name="location-outline" size={12} color={c.muted} />
                <Text style={styles.metaText} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  {settings?.locationCity || "Choose your location"}
                </Text>
                {isLoggedIn ? (
                  <>
                    <View style={styles.metaDivider} />
                    <Text style={styles.metaNumber} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{latencyLabel}</Text>
                  </>
                ) : null}
              </View>
            </View>
            {starting ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            )}
          </TouchableOpacity>

          {/* Likes You pill — replaced by the LikesYou section below the hero.
          {showLikes ? (
            <TouchableOpacity
              style={styles.likes}
              onPress={onOpenBrowser}
              pressScale={0.98}
              accessibilityRole="button"
              accessibilityLabel={`${likesYou.count} ${likesYou.count === 1 ? "person likes" : "people like"} your Tinder profile. Open Tinder`}
            >
              <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likesIcon}>
                <Ionicons name="heart" size={18} color={c.onPrimary} />
              </LinearGradient>
              <View style={styles.likesCopy}>
                <View style={styles.likesLine}>
                  <CountUp
                    value={likesYou.count}
                    format={(v) => (Math.round(v) > 99 ? "99+" : String(Math.round(v)))}
                    style={styles.likesCount}
                    maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.likesLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    {likesYou.count === 1 ? "person likes you" : "people like you"}
                  </Text>
                </View>
                <Text style={styles.likesHint} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  {likesYou.count > 0 ? "Waiting in Likes You on Tinder" : "New likes will show up here"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.muted} />
            </TouchableOpacity>
          ) : null}
          */}

          {/* Live status */}
          <View style={[styles.statusBlock, isLandscape && styles.statusBlockTight]} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${stateTitle}. ${statusLabel}`}>
            {/* One capsule: live dot, the state, and what it is doing right now. */}
            <View style={[styles.statusCapsule, { borderColor: alpha(statusColor, 0.4), backgroundColor: alpha(statusColor, 0.12) }]}>
              <LiveDot size={8} active={running || busy} color={statusColor} />
              <Text style={styles.statusTitle} numberOfLines={1} accessibilityRole="header" maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                {stateTitle}
              </Text>
              <View style={[styles.statusCapsuleDivider, { backgroundColor: alpha(statusColor, 0.35) }]} />
              <Text style={[styles.statusCapsuleLabel, { color: statusColor }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                {statusLabel}
              </Text>
            </View>
            {/* Refill countdown lives on the orb and its hint line, so it is not repeated here. */}
          </View>

          <MasterControlOrb
            stats={effectiveStats}
            settings={settings}
            isLoggedIn={isLoggedIn}
            busy={busy}
            onToggleAgent={onToggleAgent}
            onOpenBrowser={onOpenBrowser}
            wellColor={c.background}
          />

          {/* Pocket mode: permanent footer row of the wingman card */}
          <View style={styles.pocketDivider} />
          <TouchableOpacity
            style={styles.pocketRow}
            onPress={onEnterPocketMode}
            disabled={!onEnterPocketMode}
            activeOpacity={0.85}
            pressScale={0.98}
            accessibilityRole="button"
            accessibilityLabel={running ? "Pocket mode. Wingman running. Lock the screen" : "Pocket mode. Dim, touch-locked screen"}
          >
            <LinearGradient
              colors={[alpha(uiTheme.gradients.brand[0], 0.35), alpha(uiTheme.gradients.brand[uiTheme.gradients.brand.length - 1], 0.2)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pocketIcon}
            >
              <Ionicons name="moon" size={18} color={c.text} />
            </LinearGradient>
            <View style={styles.pocketCopy}>
              <Text style={styles.pocketTitle} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Pocket mode</Text>
              <Text style={styles.pocketHint} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                {running ? "Lock the screen while the wingman runs" : "Dim, touch-locked screen for your pocket"}
              </Text>
            </View>
            {/* "Running" chip removed — the row always ends with a chevron.
            {running ? (
              <View style={styles.pocketLive}>
                <LiveDot size={6} color={c.success} />
                <Text style={styles.pocketLiveText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Running</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            )}
            */}
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </TouchableOpacity>
          {/* Previous pocket-mode pill (only while running) — replaced by the row above.
          {running && (
            <TouchableOpacity
              style={styles.contextualPocketBtn}
              onPress={onEnterPocketMode}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Enter Pocket Mode"
            >
              <View style={styles.contextualPocketIconWrap}>
                <Ionicons name="moon" size={14} color={c.accent} />
              </View>
              <View style={styles.contextualPocketCopy}>
                <Text style={styles.contextualPocketText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  Pocket mode
                </Text>
                <Text style={styles.contextualPocketHint} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  Lock the screen while it runs
                </Text>
              </View>
              <LiveDot size={7} color={c.success} />
            </TouchableOpacity>
          )}
          */}

          {/* "Likes this cycle" progress bar removed from the home page.
          {showCycle ? (
            <CycleProgress value={cycleLikes} total={cycleTarget} />
          ) : null}
          */}
        </View>
      </FadeIn>

      <FadeIn delay={STAGGER * 2}>
        <LikesYou count={likesYou.count} isLoggedIn={isLoggedIn} onOpenTinder={onOpenBrowser} />
      </FadeIn>

      {settings?.aiMatchEnabled && (
        <FadeIn delay={STAGGER * 3}>
          <SmartMatchRateCard settings={settings} stats={effectiveStats} onAutomation={onAutomation} />
        </FadeIn>
      )}

      <FadeIn delay={STAGGER * 4}>
        <TinderCollections settings={settings} onConnect={onOpenBrowser} />
      </FadeIn>
    </ScrollView>
  );
}

// Smart Match Compatibility Filter Stat Card
function SmartMatchRateCard({ settings, stats, onAutomation }) {
  const currentThreshold = typeof settings?.aiMatchThreshold === 'number' ? settings.aiMatchThreshold : 60;
  const strictGoals = settings?.aiMatchStrictGoals !== false;
  const useLLM = Boolean(settings?.aiMatchUseLLM);

  // Summary chips follow the pattern used by the Automation cards.
  const chips = [
    { icon: 'speedometer-outline', label: `Min score ${currentThreshold}%` },
    { icon: 'flag-outline', label: strictGoals ? 'Strict goals' : 'Flexible goals' },
    { icon: useLLM ? 'sparkles-outline' : 'flash-outline', label: useLLM ? 'Deep AI' : 'Fast match' },
  ];

  return (
    <TouchableOpacity
      style={styles.smartMatchCard}
      onPress={onAutomation}
      disabled={!onAutomation}
      activeOpacity={0.85}
      pressScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={`Smart Match is active. Minimum score ${currentThreshold} percent, ${strictGoals ? 'strict' : 'flexible'} goals filter, ${useLLM ? 'deep AI' : 'fast match'} scoring. Open automation settings`}
    >
      <LinearGradient
        colors={[alpha(c.primary, 0.12), alpha(c.secondary, 0.04), c.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* The whole card opens automation, so the row carries a chevron instead of a
          separate button that competed with the title for width. */}
      <View style={styles.smartMatchHeader}>
        <View style={styles.smartMatchIconWrap}>
          <Ionicons name="sparkles" size={16} color={c.accent} />
        </View>
        <View style={styles.smartMatchHeaderCopy}>
          <View style={styles.smartMatchTitleRow}>
            <Text style={styles.smartMatchTitle} numberOfLines={1}>Smart Match</Text>
            <Badge tone="primary" label="ACTIVE" size="sm" />
          </View>
          <Text style={styles.smartMatchSub} numberOfLines={2}>
            Auto-likes matches with {currentThreshold}%+ compatibility
          </Text>
        </View>
        {onAutomation ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
      </View>

      <View style={styles.smartMatchChips}>
        {chips.map(chip => (
          <View key={chip.label} style={styles.smartMatchChip}>
            <Ionicons name={chip.icon} size={12} color={c.accent} />
            <Text style={styles.smartMatchChipText} numberOfLines={1}>{chip.label}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

// Animated cycle progress bar (grows with native-driven scaleX).
function CycleProgress({ value, total }) {
  const reduced = useMotionReduced();
  const ratio = Math.max(0, Math.min(1, total > 0 ? value / total : 0));
  const progress = React.useRef(new Animated.Value(reduced ? ratio : 0)).current;
  React.useEffect(() => {
    if (reduced) { progress.setValue(ratio); return; }
    Animated.timing(progress, { toValue: ratio, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [ratio, reduced, progress]);
  return (
    <View
      style={styles.cycle}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Likes this cycle"
      accessibilityValue={{ min: 0, max: total, now: Math.min(value, total) }}
    >
      <View style={styles.cycleHeader}>
        <Text style={styles.cycleLabel} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>LIKES THIS CYCLE</Text>
        <Text style={styles.cycleValue} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
          {value}<Text style={styles.cycleTotal}> / {total}</Text>
        </Text>
      </View>
      <View style={styles.cycleTrack}>
        <Animated.View style={[styles.cycleFill, { transform: [{ scaleX: progress }] }]}>
          <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
}

// Soft drifting brand glow behind the header (Revolut / Arc style ambient backdrop).
function AmbientGlow() {
  const reduced = useMotionReduced();
  const drift = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduced) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, drift]);
  const move = (x, y) => ({
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
    ],
  });
  return (
    <View pointerEvents="none" style={styles.ambient} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.blob, styles.blobPink, move(-24, 14)]}>
        <LinearGradient colors={[alpha(c.primary, 0.22), alpha(c.primary, 0)]} start={{ x: 0.5, y: 0.2 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.blob, styles.blobPeach, move(20, -10)]}>
        <LinearGradient colors={[alpha(c.secondary, 0.16), alpha(c.secondary, 0)]} start={{ x: 0.5, y: 0.2 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

// ── Bottom dock ─────────────────────────────────────────────────────────────
// Same four tabs, ids and handlers as before; `short` is the visible caption,
// `label` stays the accessibility label. The raised centre action opens Tinder
// through the existing "browser" tab route.
const NAV_TABS = [
  { id: "home", icon: "home-outline", activeIcon: "home", label: "Home", short: "Home" },
  { id: "automation", icon: "compass-outline", activeIcon: "compass", label: "Automation", short: "Automate" },
  { id: "activity", icon: "analytics-outline", activeIcon: "analytics", label: "Activity", short: "Activity" },
  // App settings moved to the top bar (gear next to notifications); Controls takes its dock slot.
  // { id: "appSettings", icon: "settings-outline", activeIcon: "settings", label: "App settings", short: "Settings" },
  { id: "settings", icon: "options-outline", activeIcon: "options", label: "Controls", short: "Controls" },
];
// Slot layout: two tabs, centre action, two tabs.
const NAV_SLOTS = [0, 1, null, 2, 3];
const NAV_PAD = 6;
const FAB_SIZE = 58;

export function HomeBottomNavigation({ activeTab, onSelect }) {
  // The dock stays centred and capped: a little wider on tablets so the five slots keep
  // comfortable spacing, but never edge-to-edge on a large display.
  const { gutter, pick } = useResponsive();
  const dockMax = pick({ phone: 520, tablet: 600, xl: 640 });
  const reduced = useMotionReduced();
  const [barWidth, setBarWidth] = React.useState(0);
  const tabIndex = NAV_TABS.findIndex((tab) => tab.id === activeTab);
  const slotIndex = Math.max(0, NAV_SLOTS.indexOf(tabIndex));
  const slotWidth = barWidth ? (barWidth - NAV_PAD * 2) / NAV_SLOTS.length : 0;
  const slide = React.useRef(new Animated.Value(slotIndex)).current;
  React.useEffect(() => {
    if (reduced) { slide.setValue(slotIndex); return; }
    Animated.spring(slide, { toValue: slotIndex, damping: 18, stiffness: 220, mass: 0.9, useNativeDriver: true }).start();
  }, [slotIndex, reduced, slide]);

  const select = (id) => {
    if (activeTab !== id) Haptics.selectionAsync().catch(() => {});
    onSelect(id);
  };

  return (
    <View
      style={[styles.navigationWrap, { bottom: 10, left: gutter, right: gutter }]}
      pointerEvents="box-none"
    >
      <View style={[styles.navigationShadow, { maxWidth: dockMax }]}>
        <View
          style={styles.navigation}
          accessibilityRole="tablist"
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        >
          {Platform.OS === "ios" ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={Platform.OS === "ios" ? [alpha(c.elevated, 0.55), alpha(c.surface, 0.72)] : uiTheme.gradients.nav}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {slotWidth > 0 && tabIndex >= 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.navIndicator, { width: slotWidth, transform: [{ translateX: Animated.multiply(slide, slotWidth) }] }]}
            >
              <LinearGradient colors={uiTheme.gradients.brandShort} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navIndicatorBar} />
              <View style={styles.navIndicatorGlow} />
            </Animated.View>
          ) : null}
          {NAV_SLOTS.map((index) =>
            index === null ? (
              <View key="fab-slot" style={styles.navSlot} pointerEvents="none" />
            ) : (
              <NavTab
                key={NAV_TABS[index].id}
                tab={NAV_TABS[index]}
                active={activeTab === NAV_TABS[index].id}
                reduced={reduced}
                onPress={() => select(NAV_TABS[index].id)}
              />
            )
          )}
        </View>
      </View>
      <CenterAction onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onSelect("browser"); }} />
    </View>
  );
}

function NavTab({ tab, active, reduced, onPress }) {
  const pop = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!active || reduced) { pop.setValue(1); return; }
    pop.setValue(0.72);
    Animated.spring(pop, { toValue: 1, speed: 16, bounciness: 14, useNativeDriver: true }).start();
  }, [active, reduced, pop]);
  return (
    <TouchableOpacity
      style={styles.navSlot}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      activeOpacity={0.75}
      pressScale={0.9}
    >
      <Animated.View style={[styles.navIcon, { transform: [{ scale: pop }] }]}>
        <Ionicons name={active ? tab.activeIcon : tab.icon} size={22} color={active ? c.text : c.muted} />
      </Animated.View>
      <Text
        style={[styles.navLabel, active && styles.navLabelActive]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
        importantForAccessibility="no"
      >
        {tab.short}
      </Text>
    </TouchableOpacity>
  );
}

// Raised gradient action in the middle of the dock (Instagram / Venmo style centre action).
function CenterAction({ onPress }) {
  return (
    <View style={styles.fabAnchor} pointerEvents="box-none">
      <TouchableOpacity
        onPress={onPress}
        pressScale={0.9}
        accessibilityRole="button"
        accessibilityLabel="Open Tinder"
        accessibilityHint="Opens your live Tinder session"
        style={styles.fabRing}
      >
        <LinearGradient colors={uiTheme.gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <LinearGradient
            pointerEvents="none"
            colors={[alpha(c.white, 0.35), alpha(c.white, 0)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={styles.fabGloss}
          />
          <Ionicons name="flame" size={26} color={c.onPrimary} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = createStyles(() => ({
  content: {
    width: "100%",
    // Phone baseline; HomeOverview overrides maxWidth with useResponsive().contentMax so
    // tablets get the wider reading column.
    maxWidth: uiTheme.layout.readableMax,
    alignSelf: "center",
    paddingTop: sp.sm,
    // Clears the floating dock and its raised centre action.
    paddingBottom: uiTheme.layout.navHeight + sp.hero + sp.xxl,
    gap: sp.xxl,
  },

  // ── Personal header ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: sp.md,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
  },
  avatar: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: c.elevated,
    borderWidth: 2,
    borderColor: c.background,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  photo: {
    resizeMode: "cover",
    backgroundColor: c.elevated,
  },
  flameBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: c.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...t.section,
    color: c.text,
  },
  greetingCopy: { flex: 1, minWidth: 0 },
  greetingLabel: {
    ...t.subhead,
    color: c.muted,
  },
  greetingName: {
    ...t.title,
    color: c.text,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  roundButton: { borderRadius: r.pill },
  roundButtonActive: {
    borderColor: "rgba(251, 191, 36, 0.35)",
    backgroundColor: "rgba(251, 191, 36, 0.08)",
  },

  // ── Hero ──
  hero: {
    borderRadius: r.xxl,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: sp.lg,
    paddingBottom: sp.xl,
    overflow: "hidden",
    backgroundColor: c.surface,
    ...uiTheme.shadows.md,
  },
  heroGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  connection: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    padding: sp.md,
    borderRadius: r.lg,
    backgroundColor: alpha(c.elevated, 0.7),
    borderWidth: 1,
    borderColor: c.hairline,
  },
  flameWrap: { position: "relative", flexShrink: 0 },
  flame: {
    width: 38,
    height: 38,
    borderRadius: r.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: -3,
    right: -3,
  },
  connectionCopy: { flex: 1, minWidth: 0 },
  connectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    minWidth: 0,
  },
  connectionTitle: {
    ...t.headline,
    fontSize: 15,
    color: c.text,
    flexShrink: 1,
    minWidth: 0,
  },
  connectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    marginTop: 2,
  },
  metaText: {
    ...t.footnote,
    color: c.muted,
    flexShrink: 1,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.textTertiary,
    marginHorizontal: 2,
  },
  metaNumber: {
    ...t.footnote,
    fontFamily: uiTheme.fonts.strong,
    color: c.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  likes: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    marginTop: sp.sm,
    padding: sp.md,
    borderRadius: r.lg,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  likesIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    ...uiTheme.shadows.glow,
  },
  likesCopy: { flex: 1, minWidth: 0 },
  likesLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  likesCount: {
    ...t.title2,
    fontFamily: uiTheme.fonts.strong,
    color: c.text,
  },
  likesLabel: {
    ...t.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.textSecondary,
    flexShrink: 1,
  },
  likesHint: {
    ...t.footnote,
    color: c.muted,
  },
  // Dot, state and activity read as one capsule instead of elements pushed to
  // opposite edges of the hero.
  statusCapsule: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    maxWidth: "100%",
    gap: sp.sm,
    paddingLeft: sp.md,
    paddingRight: sp.md + 2,
    paddingVertical: 9,
    borderRadius: r.pill,
    borderWidth: 1,
  },
  statusCapsuleDivider: {
    width: 1,
    height: 14,
    borderRadius: 1,
  },
  statusCapsuleLabel: {
    ...t.footnote,
    fontFamily: uiTheme.fonts.strong,
    flexShrink: 1,
    minWidth: 0,
  },
  statusTitle: {
    ...t.headline,
    fontFamily: uiTheme.fonts.heading,
    fontSize: 15,
    color: c.text,
    flexShrink: 1,
    minWidth: 0,
  },
  statusBlock: {
    alignItems: "center",
    marginTop: sp.xl,
    gap: sp.xs,
  },
  // Landscape: the hero has far less vertical room, so the status block hugs the orb.
  statusBlockTight: {
    marginTop: sp.md,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  statusLabel: {
    ...t.overline,
  },
  stateTitle: {
    ...t.title,
    color: c.text,
    textAlign: "center",
  },

  cycle: {
    marginTop: sp.lg,
    padding: sp.md,
    borderRadius: r.lg,
    backgroundColor: alpha(c.background, 0.5),
    borderWidth: 1,
    borderColor: c.hairline,
    gap: sp.sm,
  },
  cycleHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  cycleLabel: { ...t.overline, color: c.muted },
  cycleValue: {
    ...t.headline,
    fontFamily: uiTheme.fonts.strong,
    color: c.text,
    fontVariant: ["tabular-nums"],
  },
  cycleTotal: { color: c.muted, fontFamily: uiTheme.fonts.caption },
  cycleTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.elevatedHigh,
    overflow: "hidden",
  },
  cycleFill: {
    height: "100%",
    width: "100%",
    borderRadius: 3,
    overflow: "hidden",
    transformOrigin: "left",
  },

  // ── Ambient backdrop ──
  ambient: {
    position: "absolute",
    top: -60,
    left: -60,
    right: -60,
    height: 360,
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    overflow: "hidden",
  },
  blobPink: { width: 300, height: 300, top: -60, right: 0 },
  blobPeach: { width: 240, height: 240, top: 30, left: 10 },

  // Hidden tiles/metrics (gated with `false &&`); kept token-based for when they return.
  tiles: { flexDirection: "row", gap: sp.sm },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: c.elevated,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    borderRadius: r.lg,
    alignItems: "center",
    paddingVertical: sp.md,
    paddingHorizontal: sp.xs,
    gap: sp.sm,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.xs,
  },
  tileLabel: { ...t.overline, color: c.muted },
  tileValue: { ...t.caption, fontFamily: uiTheme.fonts.label, color: c.text },
  metrics: { flexDirection: "row", gap: sp.sm },
  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    borderRadius: r.lg,
    padding: sp.lg,
    gap: sp.xs,
  },
  metricLabel: { ...t.overline, color: c.muted },
  metricValueRow: { flexDirection: "row", alignItems: "center", gap: sp.sm },
  metricValue: { ...t.number, color: c.text, fontVariant: ["tabular-nums"] },

  // ── Bottom dock ──
  navigationWrap: {
    position: "absolute",
    left: sp.xl,
    right: sp.xl,
    bottom: 10,
    zIndex: 10,
    alignItems: "center",
  },
  navigationShadow: {
    width: "100%",
    // Phone baseline; HomeBottomNavigation widens the cap on tablets/XL.
    maxWidth: 520,
    borderRadius: r.sheet,
    ...uiTheme.shadows.lg,
  },
  navigation: {
    width: "100%",
    minHeight: uiTheme.layout.navHeight,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: r.sheet,
    borderWidth: 1,
    borderColor: alpha(c.white, 0.1),
    padding: NAV_PAD,
    overflow: "hidden",
  },
  navIndicator: {
    position: "absolute",
    left: NAV_PAD,
    top: 0,
    alignItems: "center",
  },
  navIndicatorBar: {
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  navIndicatorGlow: {
    width: 44,
    height: 26,
    marginTop: -3,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    backgroundColor: alpha(c.primary, 0.12),
  },
  navSlot: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: sp.xxs,
  },
  navIcon: {
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    ...t.caption,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: uiTheme.fonts.label,
    color: c.muted,
    textAlign: "center",
  },
  navLabelActive: {
    color: c.text,
  },
  fabAnchor: {
    position: "absolute",
    top: -(FAB_SIZE / 2) + 4,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fabRing: {
    width: FAB_SIZE + 10,
    height: FAB_SIZE + 10,
    borderRadius: (FAB_SIZE + 10) / 2,
    padding: 5,
    backgroundColor: c.background,
    ...uiTheme.shadows.glow,
  },
  fab: {
    flex: 1,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fabGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
  pocketDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.divider,
    marginTop: sp.xl,
    marginHorizontal: -sp.lg,
  },
  pocketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    minHeight: 56,
    paddingTop: sp.lg,
    paddingHorizontal: sp.xs,
  },
  pocketIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  pocketCopy: { flex: 1, minWidth: 0 },
  pocketTitle: {
    ...t.headline,
    fontFamily: uiTheme.fonts.heading,
    fontSize: 15,
    color: c.text,
  },
  pocketHint: {
    ...t.footnote,
    color: c.muted,
  },
  pocketLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: r.pill,
    backgroundColor: c.successSoft,
    borderWidth: 1,
    borderColor: c.successBorder,
  },
  pocketLiveText: {
    ...t.footnote,
    fontFamily: uiTheme.fonts.label,
    color: c.success,
  },
  contextualPocketBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: sp.md,
    minHeight: 48,
    paddingVertical: sp.sm,
    paddingLeft: sp.sm,
    paddingRight: sp.lg,
    marginTop: sp.xs,
    marginBottom: sp.sm,
    borderRadius: r.pill,
    backgroundColor: alpha(c.background, 0.6),
    borderWidth: 1,
    borderColor: c.primaryBorder,
  },
  contextualPocketIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  contextualPocketCopy: { minWidth: 0 },
  contextualPocketText: {
    ...t.subhead,
    fontFamily: uiTheme.fonts.label,
    color: c.text,
  },
  contextualPocketHint: {
    ...t.footnote,
    fontSize: 11,
    lineHeight: 14,
    color: c.muted,
  },
  smartMatchCard: {
    borderRadius: r.card,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    overflow: 'hidden',
    padding: sp.lg,
    marginBottom: sp.xl,
  },
  smartMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
  },
  smartMatchHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  smartMatchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Summary chips: same language as the Automation page's collapsed cards.
  smartMatchChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: sp.sm,
    rowGap: sp.sm - 2,
    marginTop: sp.md,
    paddingTop: sp.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(c.white, 0.1),
  },
  smartMatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: sp.md - 2,
    paddingVertical: 6,
    borderRadius: r.pill,
    backgroundColor: alpha(c.background, 0.45),
    borderWidth: 1,
    borderColor: c.hairline,
  },
  smartMatchChipText: {
    ...t.caption,
    fontFamily: uiTheme.fonts.label,
    color: c.text,
    flexShrink: 1,
    minWidth: 0,
  },
  smartMatchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartMatchTitle: {
    ...t.bodyStrong,
    color: c.text,
    flexShrink: 1,
    minWidth: 0,
  },
  smartMatchSub: {
    ...t.caption,
    color: c.textSecondary,
  },
}));
