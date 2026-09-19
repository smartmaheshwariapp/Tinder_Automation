import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  BackHandler,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme, alpha } from "../../theme";
import { useMotionReduced } from "./Motion";
import {
  getSharedAgentState,
  subscribeSharedAgentState,
} from "../../utils/sessionManager";

/**
 * PocketModeModal — Ultra-refined, zero-nits OLED Touch-Lock & Stealth Overlay.
 *
 * Built to 2026 flagship luxury device standards (Apple Watch Sleep / Tesla Screen Standby).
 *
 * Core User-Centric Features:
 * - 100% #000000 pure OLED black (zero sub-pixel power emission on AMOLED).
 * - Dual-Pillar AI Metrics: Primary focus on active work (SWIPES & MESSAGES/CHATS).
 * - Live Heartbeat Ticker: Whisper-quiet real-time activity feed (who was liked, chats replied, pacing).
 * - Living Cyber Aura: Breathing 2.4s resting halo + momentary bloom pulse on each background action.
 * - Pocket Haptic Alerts: Celebratory double-pulse in pocket when a match connects.
 * - Dual-Unlock Affordance: Blind double-tap (<500ms) anywhere OR sleek frosted glass unlock button.
 */
export default function PocketModeModal({
  visible = false,
  onDismiss,
  swipes: propSwipes,
  cycleSwipes: propCycleSwipes,
  cycleTarget: propCycleTarget,
  messages: propMessages,
  cycleMessages: propCycleMessages,
  cycleMessagesTarget: propCycleMessagesTarget,
  matches: propMatches,
  isRunning: propIsRunning,
  statusText,
}) {
  const [glanceActive, setGlanceActive] = useState(false);
  const lastTapRef = useRef(0);
  const glanceTimeoutRef = useRef(null);

  // Synced real-time state from module singleton
  const [liveState, setLiveState] = useState(() => getSharedAgentState() || {});
  const lastEventIdRef = useRef(null);

  // Clean up any pending glance timers on unmount
  useEffect(() => {
    return () => {
      if (glanceTimeoutRef.current) clearTimeout(glanceTimeoutRef.current);
    };
  }, []);

  // Re-hydrate freshly when modal becomes visible; reset glance state when hidden
  useEffect(() => {
    if (visible) {
      setLiveState(getSharedAgentState() || {});
    } else {
      if (glanceTimeoutRef.current) clearTimeout(glanceTimeoutRef.current);
      setGlanceActive(false);
    }
  }, [visible]);

  // Periodic 30s tick to keep cooldown countdowns (e.g. ~38m left) accurate in real time
  const [cooldownTick, setCooldownTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setCooldownTick((t) => (t + 1) % 1000);
    }, 30000);
    return () => clearInterval(timer);
  }, [visible]);

  // Lock-screen clock (refreshes every 15s while visible)
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    if (!visible) return;
    setClockNow(new Date());
    const timer = setInterval(() => setClockNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, [visible]);

  // OLED burn-in protection: the whole HUD drifts a few pixels over a slow cycle.
  const reduced = useMotionReduced();
  const driftAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible || reduced) { driftAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, { toValue: 1, duration: 45000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftAnim, { toValue: 0, duration: 45000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduced, driftAnim]);

  // Animations
  const pulseAnim = useRef(new Animated.Value(0.35)).current; // Ambient breathing
  const actionPulseAnim = useRef(new Animated.Value(1)).current; // Action bloom
  const glanceAnim = useRef(new Animated.Value(0.7)).current; // Touch glance focus
  const tickerAnim = useRef(new Animated.Value(1)).current; // Ticker crossfade

  // Subscribe to real-time events while modal is visible
  useEffect(() => {
    if (!visible) return;
    const unsub = subscribeSharedAgentState((next) => {
      if (next) {
        setLiveState(next);

        // Check for new incoming real-time action event
        const latestEvent = next.progressFeed?.[0];
        if (latestEvent && latestEvent.id !== lastEventIdRef.current) {
          lastEventIdRef.current = latestEvent.id;

          // 1. Trigger Pocket Haptic Alert
          try {
            if (latestEvent.type === "match_detected") {
              if (Haptics?.notificationAsync) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } else if (
              latestEvent.type === "profile_liked" ||
              latestEvent.type === "message_replied"
            ) {
              if (Haptics?.impactAsync) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }
          } catch (_) {}

          // 2. Trigger Action Bloom Pulse on Halo Ring
          Animated.sequence([
            Animated.timing(actionPulseAnim, {
              toValue: 1.25,
              duration: 140,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(actionPulseAnim, {
              toValue: 1,
              duration: 260,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();

          // 3. Smoothly animate ticker text transition
          Animated.sequence([
            Animated.timing(tickerAnim, {
              toValue: 0.2,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.timing(tickerAnim, {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }),
          ]).start();
        }
      }
    });
    return () => unsub();
  }, [visible, actionPulseAnim, tickerAnim]);

  // Ambient breathing pulse (2.4s calm resting rhythm)
  useEffect(() => {
    if (!visible) return;
    if (reduced) { pulseAnim.setValue(0.6); return; }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [visible, reduced, pulseAnim]);

  // Safe dismiss that guarantees glance timer cleanup
  const handleDismiss = useCallback(() => {
    if (glanceTimeoutRef.current) clearTimeout(glanceTimeoutRef.current);
    setGlanceActive(false);
    onDismiss?.();
  }, [onDismiss]);

  // Handle touch events on the full-screen surface
  const handleSurfaceTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 500 && timeSinceLastTap > 40) {
      // Rapid double tap recognized!
      try {
        if (Haptics?.impactAsync) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch (_) {}
      handleDismiss();
    } else {
      // First tap: engage Glance State
      lastTapRef.current = now;
      setGlanceActive(true);

      try {
        if (Haptics?.impactAsync) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (_) {}

      Animated.timing(glanceAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      if (glanceTimeoutRef.current) clearTimeout(glanceTimeoutRef.current);
      glanceTimeoutRef.current = setTimeout(() => {
        setGlanceActive(false);
        Animated.timing(glanceAnim, {
          toValue: 0.7,
          duration: 350,
          useNativeDriver: true,
        }).start();
      }, 2400);
    }
  }, [handleDismiss, glanceAnim]);

  // Intercept Android hardware back button
  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      handleDismiss();
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [visible, handleDismiss]);

  // Derive consolidated live telemetry
  const effectiveAgentState = liveState.agentState || {};
  const effectiveStats = effectiveAgentState.stats || liveState.lifetimeStats || {};
  const effectiveCycle = effectiveAgentState.currentCycle || {};

  // 1. Cumulative Session Totals
  const effectiveTotalSwipes = Math.max(
    effectiveStats.swipes ?? 0,
    effectiveStats.totalSwipes ?? 0,
    effectiveStats.totalLikes ?? 0,
    propSwipes ?? 0,
  );

  const effectiveTotalMessages = Math.max(
    effectiveStats.messages ?? 0,
    effectiveStats.totalMessages ?? 0,
    effectiveStats.messagesSent ?? 0,
    propMessages ?? 0,
  );

  const effectiveMatches =
    effectiveStats.matches ??
    effectiveStats.totalMatches ??
    effectiveStats.matchesCreated ??
    propMatches ??
    0;

  // 2. Per-Cycle Progress (Decoupled from cumulative to preserve real-time incremental fidelity)
  const effectiveCycleSwipes =
    propCycleSwipes ??
    effectiveCycle.likesCompleted ??
    liveState.cycleLikes ??
    0;

  const effectiveCycleTarget =
    propCycleTarget ??
    effectiveCycle.targetLikes ??
    effectiveAgentState.cycleTarget ??
    liveState.settings?.likesPerCycle ??
    50;

  const effectiveCycleMessages =
    propCycleMessages ??
    effectiveCycle.messagesProcessed ??
    liveState.cycleMessages ??
    0;

  const effectiveCycleMessagesTarget =
    propCycleMessagesTarget ??
    effectiveCycle.targetMessages ??
    effectiveAgentState.cycleMessagesTarget ??
    liveState.settings?.messagesPerCycle ??
    50;

  const isRunning =
    propIsRunning ??
    Boolean(
      effectiveAgentState.isRunning ||
        (effectiveAgentState.currentPhase &&
          !["stopped", "idle", "paused"].includes(effectiveAgentState.currentPhase)),
    );

  // 3. Hourly Limits, Tinder Rate Limits & Cooldown Telemetry
  const waitingReason = effectiveAgentState.waitingReason;
  const nextRunTimestamp =
    effectiveAgentState.nextRunTimestamp ||
    effectiveAgentState.likesReplenishTimestamp ||
    liveState.rateLimitedUntil;

  const now = Date.now();
  const minutesLeft =
    nextRunTimestamp && nextRunTimestamp > now
      ? Math.max(1, Math.round((nextRunTimestamp - now) / 60000))
      : null;
  const hoursLeft =
    nextRunTimestamp && nextRunTimestamp > now
      ? Math.max(1, Math.round((nextRunTimestamp - now) / 3600000))
      : null;

  // Dynamic Live Heartbeat Ticker
  const latestEvent = liveState.progressFeed?.[0];
  // Live activity line: icon + text per event/state (same conditions as before, no emoji).
  const liveTicker = useMemo(() => {
    if (latestEvent) {
      if (latestEvent.type === "match_detected") {
        return { icon: "sparkles", tone: "gold", text: `Match connected: ${latestEvent.name || "Someone New"}` };
      }
      if (latestEvent.type === "message_replied") {
        return { icon: "chatbubble-ellipses", tone: "info", text: `Sent a reply to ${latestEvent.name || "a match"}` };
      }
      if (latestEvent.type === "profile_liked") {
        return { icon: "heart", tone: "accent", text: `Liked ${latestEvent.name || "a profile"} · ${latestEvent.detail || "Safe paced"}` };
      }
      if (latestEvent.type === "rate_limit") {
        return { icon: "flash", tone: "warning", text: "Likes limit reached · Chatting with matches" };
      }
    }
    if (waitingReason === "safety_lock" || waitingReason === "hourly_limit") {
      return {
        icon: "shield-checkmark",
        tone: "warning",
        text: minutesLeft ? `Hourly safe limit reached · Resumes in ~${minutesLeft}m` : "Hourly safe limit · Natural cooldown",
      };
    }
    if (waitingReason === "likes_exhausted") {
      if (effectiveAgentState.currentPhase === "messaging") {
        return {
          icon: "chatbubbles",
          tone: "info",
          text: hoursLeft ? `Daily likes refilling (~${hoursLeft}h) · Wingman messaging` : "Daily likes refilling · Wingman messaging",
        };
      }
      return {
        icon: "hourglass",
        tone: "warning",
        text: hoursLeft ? `Daily likes refilling · Resumes in ~${hoursLeft}h` : "Daily likes refilling · Resumes automatically",
      };
    }
    if (waitingReason === "cooldown") {
      return {
        icon: "shield-checkmark",
        tone: "warning",
        text: minutesLeft ? `Safe pacing break · Resumes in ~${minutesLeft}m` : "Safe pacing break · Resumes shortly",
      };
    }
    if (effectiveAgentState.currentPhase === "messaging") {
      return { icon: "chatbubbles", tone: "info", text: "Wingman chatting with your matches" };
    }
    if (effectiveAgentState.currentPhase === "transitioning") {
      return { icon: "pause-circle", tone: "muted", text: "Natural pause between profiles" };
    }
    if (isRunning) {
      return { icon: "flash", tone: "accent", text: "Wingman active and swiping · Safe paced" };
    }
    return { icon: "moon", tone: "muted", text: "Standing by" };
  }, [
    latestEvent,
    waitingReason,
    minutesLeft,
    hoursLeft,
    effectiveAgentState.currentPhase,
    isRunning,
    cooldownTick,
  ]);

  const displayStatus = useMemo(() => {
    if (statusText) return statusText;
    if (waitingReason === "safety_lock" || waitingReason === "hourly_limit") {
      return minutesLeft ? `Safe Cooldown (~${minutesLeft}m)` : "Safe Cooldown";
    }
    if (waitingReason === "likes_exhausted") {
      if (effectiveAgentState.currentPhase === "messaging") {
        return "Wingman Messaging Active";
      }
      return hoursLeft ? `Likes Refill (~${hoursLeft}h)` : "Likes Refill Standby";
    }
    if (effectiveAgentState.currentPhase === "messaging") {
      return "AI Messaging Active";
    }
    if (isRunning) {
      return "AI Wingman Active";
    }
    return "Touch Locked";
  }, [statusText, waitingReason, minutesLeft, hoursLeft, effectiveAgentState.currentPhase, isRunning, cooldownTick]);

  if (!visible) return null;

  const accent = theme.colors.accent;
  const toneColor = {
    accent,
    gold: theme.colors.gold,
    info: theme.colors.info,
    warning: theme.colors.warning,
    muted: DIM.label,
  }[liveTicker.tone] || accent;
  const statusDot = isRunning ? theme.colors.success : theme.colors.warning;
  const timeText = clockNow.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "");
  const meridiem = (clockNow.toLocaleTimeString([], { hour: "numeric" }).match(/[AP]M/i) || [""])[0];
  const dateText = clockNow.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const driftStyle = {
    transform: [
      { translateX: driftAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }) },
      { translateY: driftAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) },
    ],
  };
  const stats = [
    { icon: "flame", color: accent, label: "Swipes", value: effectiveTotalSwipes },
    { icon: "chatbubble-ellipses", color: theme.colors.info, label: "Messages", value: effectiveTotalMessages },
    { icon: "sparkles", color: theme.colors.gold, label: "Matches", value: effectiveMatches },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      hardwareAccelerated={true}
      onRequestClose={onDismiss}
    >
      <StatusBar hidden={true} backgroundColor="#000000" barStyle="light-content" />
      <View style={styles.fullscreen}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.touchSurface}
          onPress={handleSurfaceTap}
          accessibilityRole="button"
          accessibilityLabel={`Pocket mode. ${displayStatus}. ${effectiveTotalSwipes} swipes, ${effectiveTotalMessages} messages. Double tap to unlock.`}
        >
          <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>
            <Animated.View style={[styles.hud, driftStyle, { opacity: glanceAnim }]}>
              {/* Lock-screen clock */}
              <View style={styles.clockBlock}>
                <View style={styles.lockRow}>
                  <Ionicons name="lock-closed" size={11} color={DIM.faint} />
                  <Text style={styles.lockText}>TOUCH LOCKED</Text>
                </View>
                <View style={styles.clockRow}>
                  <Text style={styles.clock} maxFontSizeMultiplier={1.2}>{timeText}</Text>
                  {meridiem ? <Text style={styles.meridiem}>{meridiem}</Text> : null}
                </View>
                <Text style={styles.date} maxFontSizeMultiplier={1.3}>{dateText}</Text>
              </View>

              {/* Status ring: breathing halo + bloom on each action */}
              <View style={styles.center}>
                <View style={styles.ringWrap}>
                  <Animated.View
                    style={[
                      styles.halo,
                      { backgroundColor: alpha(accent, 0.07), borderColor: alpha(accent, 0.22), opacity: pulseAnim, transform: [{ scale: actionPulseAnim }] },
                    ]}
                  />
                  <LinearGradient
                    colors={[alpha(theme.gradients.brand[0], 0.55), alpha(theme.gradients.brand[theme.gradients.brand.length - 1], 0.35)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ring}
                  >
                    <View style={styles.ringInner}>
                      <Ionicons name={isRunning ? "flame" : "moon"} size={30} color={alpha(accent, 0.9)} />
                    </View>
                  </LinearGradient>
                </View>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusDot }]} />
                  <Text style={styles.statusText} numberOfLines={1}>{displayStatus}</Text>
                </View>

                {/* Stats strip */}
                <View style={styles.stats}>
                  {stats.map((stat, index) => (
                    <React.Fragment key={stat.label}>
                      {index > 0 ? <View style={styles.statDivider} /> : null}
                      <View style={styles.stat} accessible accessibilityLabel={`${stat.value} ${stat.label}`}>
                        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>
                          {Number(stat.value || 0).toLocaleString()}
                        </Text>
                        <View style={styles.statLabelRow}>
                          <Ionicons name={stat.icon} size={11} color={alpha(stat.color, 0.8)} />
                          <Text style={styles.statLabel}>{stat.label}</Text>
                        </View>
                      </View>
                    </React.Fragment>
                  ))}
                </View>

                {/* Live activity */}
                <Animated.View style={[styles.ticker, { opacity: tickerAnim }]}>
                  <Ionicons name={liveTicker.icon} size={13} color={alpha(toneColor, 0.85)} />
                  <Text style={styles.tickerText} numberOfLines={1}>{liveTicker.text}</Text>
                </Animated.View>
              </View>

              {/* Unlock */}
              <View style={styles.bottom}>
                <Text style={[styles.hint, glanceActive && { color: alpha(accent, 0.9) }]}>
                  {glanceActive ? "Tap once more to unlock" : "Double-tap anywhere to unlock"}
                </Text>
                <TouchableOpacity
                  style={styles.unlock}
                  onPress={handleDismiss}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock screen"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="lock-open-outline" size={14} color={DIM.label} />
                  <Text style={styles.unlockText}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </SafeAreaView>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// Dim whites on pure black: readable at a glance, easy on OLED and in the dark.
const DIM = {
  clock: "rgba(255, 255, 255, 0.86)",
  text: "rgba(255, 255, 255, 0.72)",
  label: "rgba(255, 255, 255, 0.46)",
  faint: "rgba(255, 255, 255, 0.3)",
  line: "rgba(255, 255, 255, 0.08)",
  fill: "rgba(255, 255, 255, 0.035)",
};

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: "#000000" },
  touchSurface: { flex: 1, backgroundColor: "#000000" },
  safe: { flex: 1, paddingHorizontal: 24 },
  hud: {
    flex: 1,
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    justifyContent: "space-between",
    paddingTop: 36,
    paddingBottom: 20,
  },

  clockBlock: { alignItems: "center" },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  lockText: { fontFamily: theme.fonts.strong, fontSize: 10, letterSpacing: 2, color: DIM.faint },
  clockRow: { flexDirection: "row", alignItems: "flex-start" },
  clock: {
    fontFamily: theme.fonts.display,
    fontSize: 76,
    lineHeight: 84,
    letterSpacing: -3,
    color: DIM.clock,
    fontVariant: ["tabular-nums"],
  },
  meridiem: { fontFamily: theme.fonts.label, fontSize: 15, color: DIM.label, marginTop: 14, marginLeft: 6 },
  date: { fontFamily: theme.fonts.caption, fontSize: 15, color: DIM.label, marginTop: 2 },

  center: { alignItems: "center", gap: 18 },
  ringWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 1 },
  ring: { width: 84, height: 84, borderRadius: 42, padding: 1.5 },
  ringInner: { flex: 1, borderRadius: 41, backgroundColor: "#050505", alignItems: "center", justifyContent: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  statusDot: { width: 7, height: 7, borderRadius: 4, opacity: 0.85 },
  statusText: { fontFamily: theme.fonts.label, fontSize: 15, color: DIM.text, letterSpacing: 0.2, flexShrink: 1 },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: DIM.line,
    backgroundColor: DIM.fill,
  },
  stat: { flex: 1, minWidth: 0, alignItems: "center", gap: 3, paddingHorizontal: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: DIM.line },
  statValue: { fontFamily: theme.fonts.heading, fontSize: 24, lineHeight: 30, color: DIM.clock, fontVariant: ["tabular-nums"] },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statLabel: { fontFamily: theme.fonts.caption, fontSize: 11, letterSpacing: 0.4, color: DIM.label },

  ticker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DIM.fill,
    borderWidth: 1,
    borderColor: DIM.line,
  },
  tickerText: { fontFamily: theme.fonts.caption, fontSize: 12.5, color: DIM.label, flexShrink: 1 },

  bottom: { alignItems: "center", gap: 14 },
  hint: { fontFamily: theme.fonts.caption, fontSize: 12.5, color: DIM.faint, letterSpacing: 0.2, textAlign: "center" },
  unlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DIM.line,
    backgroundColor: DIM.fill,
  },
  unlockText: { fontFamily: theme.fonts.label, fontSize: 13, color: DIM.label, letterSpacing: 0.3 },
});
