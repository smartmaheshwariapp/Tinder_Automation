import { createStyles, theme as uiTheme, alpha } from '../../theme';
// src/components/dashboard/MasterHeroController.js — Desktop V2 Master Control Center
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Easing,
} from 'react-native';
import ActivityIndicator from '../common/SafeActivityIndicator';
import { Ionicons } from '@expo/vector-icons';
import { useMotionReduced } from '../common/Motion';

const c = uiTheme.colors;
// Tinted button palette built from theme tokens (tinted fill, stronger border, readable foreground).
const tint = (color, fg = color) => ({ bgColor: alpha(color, 0.14), borderColor: alpha(color, 0.42), textColor: fg, shimmerColor: color });

// ─── Phase Telemetry & Copywriting (1:1 with Desktop V2 status-display.js) ───
const TELEMETRY_MAP = {
  checking:     { action: 'CHECKING',     detail: 'READING YOUR PROFILE',                color: uiTheme.colors.info },
  connecting:   { action: 'CONNECTING',   detail: 'YOUR WINGMAN IS COMING ONLINE',       color: uiTheme.colors.info },
  initializing: { action: 'SETTING UP',   detail: 'YOUR AI WINGMAN IS READY',            color: uiTheme.colors.info },
  starting:     { action: 'ALMOST THERE', detail: 'LAUNCHING YOUR DATING GAME',          color: uiTheme.colors.info },
  liking:       { action: 'SWIPING',      detail: 'AI TARGETING ACTIVE',                 color: uiTheme.colors.success },
  transitioning:{ action: 'COOLDOWN',     detail: 'PREPARING NEXT PHASE',                color: uiTheme.colors.success },
  processing:   { action: 'ANALYZING',    detail: 'READING BETWEEN THE LINES',           color: uiTheme.colors.info },
  lead_scan:    { action: 'SCANNING',     detail: 'FINDING POTENTIAL DATES',             color: uiTheme.colors.accent },
  messaging:    { action: 'MESSAGING',    detail: 'RIZZ LEVEL: MAXIMUM',                 color: uiTheme.colors.accent },
  polling:      { action: 'AWAITING REPLIES', detail: 'RECHECKING SOON',                 color: uiTheme.colors.info },
  network_wait: { action: 'INTERRUPTED',  detail: 'HOLDING — WILL RESUME ON RECONNECT',  color: uiTheme.colors.warning },
  waiting:      { action: 'RESTING',      detail: 'RESTING BETWEEN SESSIONS — NEXT ROUND SOON', color: uiTheme.colors.warning },
  safety_lock:    { action: 'SAFETY PAUSE', detail: 'TAKING A QUICK BREAK TO PROTECT YOUR ACCOUNT', color: uiTheme.colors.warning },
  likes_exhausted:{ action: 'LIKES REFILL', detail: 'DAILY SWIPES REFILL IN PROGRESS', color: uiTheme.colors.info },
  stopped:        { action: 'STANDBY',      detail: 'READY FOR ACTION',                    color: uiTheme.colors.muted },
};

function formatCountdown(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MasterHeroController({
  agentState,
  settings,
  onToggleAgent,
}) {
  const isRunning = Boolean(
    agentState?.isRunning ||
    (agentState?.currentPhase && agentState.currentPhase !== 'stopped')
  );

  const swipingEnabled = settings?.autoSwipe !== false && (settings?.likesPerCycle ?? 50) > 0;
  const messagingEnabled = settings?.autoMessage !== false && (settings?.messagesPerCycle ?? 50) > 0;

  let rawPhase = (agentState?.currentPhase || (isRunning ? (swipingEnabled ? 'liking' : 'messaging') : 'stopped')).toLowerCase();
  let phase = (!swipingEnabled && (rawPhase === 'liking' || rawPhase === 'swiping'))
    ? (messagingEnabled ? 'messaging' : 'stopped')
    : rawPhase;
  const subPhase = (agentState?.activeSubPhase || '').toLowerCase();
  const waitingReason = agentState?.waitingReason;

  if (isRunning) {
    if (subPhase.includes('scan') || subPhase.includes('decode') || subPhase.includes('parse')) {
      phase = 'lead_scan';
    } else if (subPhase.includes('like') || subPhase.includes('swipe')) {
      phase = swipingEnabled ? 'liking' : (messagingEnabled ? 'messaging' : 'stopped');
    } else if (subPhase.includes('message') || subPhase.includes('rizz') || subPhase.includes('reply')) {
      phase = 'messaging';
    } else if (waitingReason === 'searching') {
      phase = 'polling';
    }
  }

  const isSafetyLocked = waitingReason === 'safety_lock';
  const isLikesExhausted = waitingReason === 'likes_exhausted';
  const isStarting = isRunning && ['starting', 'initializing', 'checking', 'connecting'].includes(phase);
  const isWaitingCooldown = isRunning && phase === 'waiting' && !isSafetyLocked;

  const reducedMotion = useMotionReduced();

  // ─── 1. Radar Spin Animation (for checking, connecting, scanning) ───
  const radarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) { radarAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [radarAnim, reducedMotion]);
  const radarSpin = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ─── 2. Heart Beating & Ripple Animation (for liking / swiping) ───
  const heartBeatAnim = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (phase === 'liking' && !reducedMotion) {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(heartBeatAnim, { toValue: 1.22, duration: 250, useNativeDriver: true }),
            Animated.timing(heartBeatAnim, { toValue: 1.0,  duration: 250, useNativeDriver: true }),
            Animated.timing(heartBeatAnim, { toValue: 1.15, duration: 200, useNativeDriver: true }),
            Animated.timing(heartBeatAnim, { toValue: 1.0,  duration: 600, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.parallel([
              Animated.timing(rippleScale, { toValue: 1.8, duration: 800, useNativeDriver: true }),
              Animated.timing(rippleOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
            ]),
            Animated.timing(rippleScale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(rippleOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
            Animated.delay(500),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      heartBeatAnim.setValue(1);
      rippleScale.setValue(1);
      rippleOpacity.setValue(0);
    }
  }, [phase, isRunning, isStarting, isSafetyLocked, isWaitingCooldown, reducedMotion]);

  // ─── 3. Bouncing 3-Dots Messaging Animation ───
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if ((phase === 'messaging' || phase === 'lead_scan') && !reducedMotion) {
      const createDotAnim = (anim, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: -5, duration: 220, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0,  duration: 220, useNativeDriver: true }),
            Animated.delay(400),
          ])
        );
      };
      const a1 = createDotAnim(dot1, 0);
      const a2 = createDotAnim(dot2, 140);
      const a3 = createDotAnim(dot3, 280);
      a1.start(); a2.start(); a3.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); };
    }
    dot1.setValue(0); dot2.setValue(0); dot3.setValue(0);
  }, [phase, reducedMotion]);

  // ─── 4. Shimmer Progress Bar Animation ───
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    if ((isRunning || isSafetyLocked) && reducedMotion) {
      shimmerAnim.setValue(0);
    } else if (isRunning || isSafetyLocked) {
      const loop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      shimmerAnim.setValue(-1);
    }
  }, [isRunning, isSafetyLocked, shimmerAnim, reducedMotion]);
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-240, 240],
  });

  // ─── 5. Tactile Button Press Spring Scale ───
  const pressScale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    if (reducedMotion) return;
    Animated.spring(pressScale, {
      toValue: 0.95,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    if (reducedMotion) { pressScale.setValue(1); return; }
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 30,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  // ─── 6. Countdown Timer for Next Run / Cooldown ───
  const [countdown, setCountdown] = useState(null);
  useEffect(() => {
    const ts = agentState?.nextRunTimestamp;
    if (!ts) { setCountdown(null); return; }
    const tick = () => {
      const remaining = ts - Date.now();
      setCountdown(remaining > 0 ? formatCountdown(remaining) : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [agentState?.nextRunTimestamp]);

  // ─── 7. Telemetry Strings & Dynamic Content ───
  const currentLikes = agentState?.currentCycle?.likesCompleted ?? agentState?.stats?.swipes ?? agentState?.stats?.likesCompleted ?? 0;
  const currentMsgs = ((agentState?.currentCycle?.messagesProcessed || 0) + (agentState?.currentCycle?.followUpsSent || 0)) || (agentState?.stats?.messages ?? agentState?.stats?.messagesSent ?? 0);

  const telemetry = useMemo(() => {
    if (isSafetyLocked) {
      return {
        action: 'SAFETY PAUSE',
        detail: countdown ? `RESETS IN ${countdown} — SAFETY BREAK` : 'HOURLY SWIPE SAFETY PAUSE',
        color: uiTheme.colors.warning,
      };
    }
    if (isLikesExhausted) {
      return {
        action: 'LIKES REFILL',
        detail: countdown ? `FREE SWIPES REFILL IN ${countdown}` : 'DAILY SWIPES REFILL IN PROGRESS',
        color: uiTheme.colors.info,
      };
    }
    if (isStarting) {
      return {
        action: 'STARTING...',
        detail: 'INITIALIZING AI ENGINE',
        color: uiTheme.colors.info,
      };
    }
    if (isWaitingCooldown) {
      return {
        action: 'RESTING',
        detail: countdown ? `RESTING — NEXT ROUND IN ${countdown}` : 'SESSION COMPLETE — NEXT ROUND SOON',
        color: uiTheme.colors.warning,
      };
    }
    if (isRunning) {
      if (phase === 'liking') {
        return {
          action: `${currentLikes} SWIPES`,
          detail: 'AI TARGETING ACTIVE',
          color: uiTheme.colors.success,
        };
      }
      if (phase === 'messaging') {
        return {
          action: `${currentMsgs} SENT`,
          detail: 'WINGMAN MESSAGING ACTIVE',
          color: uiTheme.colors.accent,
        };
      }
      return TELEMETRY_MAP[phase] || (swipingEnabled ? TELEMETRY_MAP.liking : TELEMETRY_MAP.messaging);
    }
    return TELEMETRY_MAP.stopped;
  }, [isRunning, phase, isStarting, isSafetyLocked, isLikesExhausted, isWaitingCooldown, currentLikes, currentMsgs, countdown, swipingEnabled]);

  // ─── Dynamic Button Styling & Labels (Desktop V2 1:1 Parity) ───
  const buttonConfig = useMemo(() => {
    if (isSafetyLocked) {
      return {
        label: countdown ? `SAFETY PAUSE: ${countdown}` : 'SAFETY PAUSE',
        sublabel: 'Anti-ban safety break • Resumes automatically',
        icon: 'shield-checkmark',
        ...tint(c.warning),
      };
    }
    if (isLikesExhausted && !isRunning) {
      return {
        label: countdown ? `LIKES REFILL: ${countdown}` : 'LIKES REFILL',
        sublabel: 'Free swipes refilling • Tap to chat with existing matches',
        icon: 'hourglass-outline',
        ...tint(c.info),
      };
    }
    if (isStarting) {
      return {
        label: 'STARTING WINGMAN...',
        sublabel: 'Connecting to Tinder & calibrating...',
        icon: 'sync',
        ...tint(c.info),
        isLoading: true,
      };
    }
    if (isWaitingCooldown) {
      return {
        label: 'STOP WINGMAN',
        sublabel: countdown ? `Resting between sessions • Next round in ${countdown}` : 'Session complete • Taking a quick break',
        icon: 'square',
        ...tint(c.error),
      };
    }
    if (isRunning) {
      const sub = !swipingEnabled
        ? `${currentMsgs} DMs sent • Tap to pause`
        : (!messagingEnabled
            ? `${currentLikes} Likes • Tap to pause`
            : `${currentLikes} Likes • ${currentMsgs} DMs • Tap to pause`);
      return {
        label: !swipingEnabled ? 'STOP WINGMAN' : (!messagingEnabled ? 'STOP SWIPER' : 'STOP WINGMAN'),
        sublabel: sub,
        icon: 'square',
        ...tint(c.error),
      };
    }
    const swipingEnabled = settings?.autoSwipe !== false && (settings?.likesPerCycle ?? 50) > 0;
    const messagingEnabled = settings?.autoMessage !== false && (settings?.messagesPerCycle ?? 50) > 0;

    if (!swipingEnabled && !messagingEnabled) {
      return {
        label: 'AUTOMATION OFF',
        sublabel: 'Enable Swiping or Messaging in Automation tab',
        icon: 'pause',
        ...tint(c.muted, c.textSecondary),
      };
    }

    if (swipingEnabled && !messagingEnabled) {
      return {
        label: 'START SWIPER',
        sublabel: 'Auto-swiping on • Messaging is manual',
        icon: 'play',
        ...tint(c.primary, c.accent),
      };
    }

    if (!swipingEnabled && messagingEnabled) {
      return {
        label: 'START WINGMAN',
        sublabel: 'Auto-swiping off • Wingman chats with your matches',
        icon: 'play',
        ...tint(c.info),
      };
    }

    return {
      label: 'START WINGMAN',
      sublabel: 'Auto-likes compatible matches & chats in your style',
      icon: 'play',
      ...tint(c.success),
    };
  }, [isRunning, isStarting, isSafetyLocked, isLikesExhausted, isWaitingCooldown, countdown, currentLikes, currentMsgs, settings]);

  return (
    <View style={styles.container}>
      {/* ═════════ 1. Desktop V2 Status Banner Row ═════════ */}
      <View style={styles.statusBannerRow}>
        <View style={styles.statusBannerLeft}>
          {/* Phase Animated Icon Hub */}
          <View style={styles.iconHub}>
            {phase === 'liking' && isRunning && !isWaitingCooldown && (
              <View style={styles.heartWrapper}>
                <Animated.View
                  importantForAccessibility="no"
                  style={[
                    styles.heartRipple,
                    {
                      transform: [{ scale: rippleScale }],
                      opacity: rippleOpacity,
                    },
                  ]}
                />
                <Animated.View style={{ transform: [{ scale: heartBeatAnim }] }}>
                  <Ionicons name="heart" size={18} color={uiTheme.colors.success} />
                </Animated.View>
              </View>
            )}

            {phase === 'messaging' && isRunning && !isWaitingCooldown && (
              <View style={styles.messagingIconWrap}>
                <Ionicons name="chatbubble" size={18} color={uiTheme.colors.accent} />
                <View style={styles.dotsRow}>
                  <Animated.View style={[styles.msgDot, { transform: [{ translateY: dot1 }] }]} />
                  <Animated.View style={[styles.msgDot, { transform: [{ translateY: dot2 }] }]} />
                  <Animated.View style={[styles.msgDot, { transform: [{ translateY: dot3 }] }]} />
                </View>
              </View>
            )}

            {(isStarting || phase === 'checking' || phase === 'connecting' || phase === 'lead_scan' || phase === 'processing') && (
              <Animated.View style={{ transform: [{ rotate: radarSpin }] }}>
                <Ionicons name="sync" size={18} color={telemetry.color} />
              </Animated.View>
            )}

            {isWaitingCooldown && (
              <Ionicons name="time-outline" size={18} color={uiTheme.colors.warning} />
            )}

            {isSafetyLocked && (
              <Ionicons name="lock-closed" size={18} color={uiTheme.colors.warning} />
            )}

            {!isRunning && !isSafetyLocked && (
              <View style={styles.breathingDot} />
            )}
          </View>

          {/* Status Label & Divider Telemetry */}
          <View style={styles.telemetryTextWrap}>
            <View style={styles.telemetryHeaderLine}>
              <Text style={[styles.telemetryAction, { color: telemetry.color }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                {telemetry.action}
              </Text>
              <Text style={styles.statusDivider} importantForAccessibility="no" maxFontSizeMultiplier={uiTheme.fontScale.chrome}>//</Text>
              <Text style={styles.telemetryDetail} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                {telemetry.detail}
              </Text>
            </View>
          </View>
        </View>

        {/* Next Run Countdown Badge (1:1 with desktop next-run-badge) */}
        {countdown && isRunning && (
          <View style={styles.nextRunBadge} accessible accessibilityLabel={`Next run in ${countdown}`}>
            <Ionicons name="time" size={12} color={uiTheme.colors.warning} />
            <Text style={styles.nextRunText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>{countdown}</Text>
          </View>
        )}
      </View>

      {/* ═════════ 2. The Master Desktop V2 Button ═════════ */}
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity accessibilityRole="button"
          accessibilityLabel={`${buttonConfig.label}. ${buttonConfig.sublabel}`}
          accessibilityState={{ busy: Boolean(buttonConfig.isLoading) }}
          style={[
            styles.masterBtn,
            {
              backgroundColor: buttonConfig.bgColor,
              borderColor: buttonConfig.borderColor,
            },
          ]}
          onPress={onToggleAgent}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.88}
        >
          {/* Button Content Row */}
          <View style={styles.btnRow}>
            {buttonConfig.isLoading ? (
              <View style={styles.btnIconContainer}><ActivityIndicator size="small" color={buttonConfig.textColor} /></View>
            ) : (
              <View style={[styles.btnIconContainer, { backgroundColor: buttonConfig.bgColor, borderColor: buttonConfig.borderColor }]}>
                <Ionicons name={buttonConfig.icon} size={16} color={buttonConfig.textColor} />
              </View>
            )}

            <View style={styles.btnTextContent}>
              <Text style={[styles.btnMainTitle, { color: buttonConfig.textColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                {buttonConfig.label}
              </Text>
              <Text style={styles.btnSubTitle} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                {buttonConfig.sublabel}
              </Text>
            </View>

            <Ionicons
              name={buttonConfig.icon === 'square' ? 'stop-circle-outline' : 'chevron-forward'}
              size={18}
              color={buttonConfig.textColor}
            />
          </View>

          {/* Shimmering Flowing Progress Bar on the bottom border */}
          <View style={styles.shimmerContainer} importantForAccessibility="no-hide-descendants">
            <Animated.View
              style={[
                styles.shimmerBar,
                {
                  backgroundColor: buttonConfig.shimmerColor,
                  transform: [{ translateX: shimmerTranslateX }],
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ═════════ 3. Bottom Quick Persona Metadata ═════════ */}
      <View style={styles.metaRow}>
        <View style={styles.metaBadge}>
          <Ionicons name="flag-outline" size={12} color={uiTheme.colors.info} />
          <Text style={styles.metaLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Goal: <Text style={styles.metaVal}>{settings?.optimizingFor || 'Date Setup'}</Text></Text>
        </View>

        <View style={styles.metaBadge}>
          <Ionicons name="color-wand-outline" size={12} color={uiTheme.colors.accent} />
          <Text style={styles.metaLabel} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Tone: <Text style={styles.metaVal}>{settings?.tone || 'Playful'}</Text></Text>
        </View>

        <View style={styles.metaBadge}>
          <Ionicons name="shield-checkmark-outline" size={12} color={uiTheme.colors.success} />
          <Text style={[styles.metaLabel, { color: uiTheme.colors.success }]} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
            {settings?.safetyMode !== false ? 'Safe Paced' : 'Uncapped'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = createStyles(() => ({
  container: {
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    padding: uiTheme.spacing.lg,
    marginBottom: uiTheme.spacing.md,
  },

  // ─── Status Banner Row ───
  statusBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.md,
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  iconHub: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: uiTheme.colors.muted,
  },
  heartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartRipple: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: uiTheme.colors.success,
  },
  messagingIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 1.5,
    top: 5.5,
  },
  msgDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: uiTheme.colors.onPrimary,
  },
  telemetryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  telemetryHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
  },
  telemetryAction: {
    ...uiTheme.type.overline,
    fontFamily: uiTheme.fonts.heavy,
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 16,
    letterSpacing: 0.5,
    flexShrink: 0,
    maxWidth: '60%',
  },
  statusDivider: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.strong,
    color: uiTheme.colors.textTertiary,
  },
  telemetryDetail: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.label,
    color: uiTheme.colors.textSecondary,
    letterSpacing: 0.2,
    flex: 1,
    minWidth: 0,
  },
  nextRunBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    backgroundColor: uiTheme.colors.warningSoft,
    borderWidth: 1,
    borderColor: uiTheme.colors.warningBorder,
    borderRadius: uiTheme.radius.pill,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3,
  },
  nextRunText: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.heavy,
    fontVariant: ['tabular-nums'],
    color: uiTheme.colors.warning,
    letterSpacing: 0.3,
  },

  // ─── Master Button (Desktop V2 Parity) ───
  masterBtn: {
    minHeight: 64,
    justifyContent: 'center',
    borderRadius: uiTheme.radius.lg,
    borderWidth: 1,
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.md,
    position: 'relative',
    overflow: 'hidden',
    ...uiTheme.shadows.md,
    marginBottom: uiTheme.spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
  },
  btnIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextContent: {
    flex: 1,
    minWidth: 0,
  },
  btnMainTitle: {
    ...uiTheme.type.label,
    fontFamily: uiTheme.fonts.display,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  btnSubTitle: {
    ...uiTheme.type.footnote,
    color: uiTheme.colors.muted,
    marginTop: 2,
  },

  // ─── Shimmer Progress Bar ───
  shimmerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: uiTheme.colors.neutralSoft,
    overflow: 'hidden',
  },
  shimmerBar: {
    width: 120,
    height: 2.5,
    borderRadius: 1.5,
    opacity: 0.85,
  },

  // ─── Meta Row ───
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaBadge: {
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.xs,
    backgroundColor: uiTheme.colors.elevated,
    paddingVertical: 6,
    paddingHorizontal: uiTheme.spacing.sm,
    borderRadius: uiTheme.radius.pill,
    borderWidth: 1,
    borderColor: uiTheme.colors.borderSubtle,
  },
  metaLabel: {
    ...uiTheme.type.footnote,
    fontFamily: uiTheme.fonts.label,
    color: uiTheme.colors.muted,
    flexShrink: 1,
  },
  metaVal: {
    fontFamily: uiTheme.fonts.strong,
    color: uiTheme.colors.textSecondary,
  },
}));
