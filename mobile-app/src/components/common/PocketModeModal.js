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
import { theme } from "../../theme";
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
  }, [visible, pulseAnim]);

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
  const liveTickerText = useMemo(() => {
    if (latestEvent) {
      if (latestEvent.type === "match_detected") {
        return `✨ Match connected: ${latestEvent.name || "Someone New"}!`;
      }
      if (latestEvent.type === "message_replied") {
        return `💬 Sent reply to ${latestEvent.name || "Match"}`;
      }
      if (latestEvent.type === "profile_liked") {
        return `⚡ Liked ${latestEvent.name || "Profile"} · ${latestEvent.detail || "Safe Paced"}`;
      }
      if (latestEvent.type === "rate_limit") {
        return "⚡ Likes limit reached · Chatting with matches";
      }
    }

    // Hourly Safety Mode Lock
    if (waitingReason === "safety_lock" || waitingReason === "hourly_limit") {
      return minutesLeft
        ? `🛡️ Hourly safe limit reached · Resumes in ~${minutesLeft}m`
        : "🛡️ Hourly safe limit · Natural cooldown active";
    }

    // Tinder Free Tier Daily Quota Exhausted
    if (waitingReason === "likes_exhausted") {
      if (effectiveAgentState.currentPhase === "messaging") {
        return hoursLeft
          ? `⚡ Daily likes refilling (~${hoursLeft}h) · Wingman messaging active`
          : "⚡ Daily likes refilling · Wingman messaging active";
      }
      return hoursLeft
        ? `⚡ Daily likes refilling · Resumes in ~${hoursLeft}h`
        : "⚡ Daily likes refilling · Resumes automatically";
    }

    // Natural Pacing Cooldown
    if (waitingReason === "cooldown") {
      return minutesLeft
        ? `🛡️ Safe pacing break · Resumes in ~${minutesLeft}m`
        : "🛡️ Safe pacing break · Resumes shortly";
    }

    if (effectiveAgentState.currentPhase === "messaging") {
      return "💬 AI Wingman chatting with active matches";
    }
    if (effectiveAgentState.currentPhase === "transitioning") {
      return "🛡️ Natural human pause between profiles";
    }
    if (isRunning) {
      return "⚡ AI Wingman active & swiping (Safe Paced)";
    }
    return "Stealth Touch-Lock Standby";
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
          accessibilityLabel="Touch-locked stealth screen. Double tap to unlock."
        >
          <Animated.View style={[styles.hudContainer, { opacity: glanceAnim }]}>
            {/* Living Cyber Aperture with Breathing Halo & Action Bloom */}
            <View style={styles.beaconWrap}>
              <Animated.View
                style={[
                  styles.haloRing,
                  {
                    opacity: pulseAnim,
                    transform: [{ scale: actionPulseAnim }],
                  },
                ]}
              />
              <View style={styles.aperture}>
                <Ionicons name="moon" size={28} color="#FBBF24" />
              </View>
            </View>

            {/* Architectural Tracked Eyebrow */}
            <Text style={styles.eyebrow}>TOUCH LOCKED</Text>

            {/* Symmetrical Dual-Pillar Metrics: SWIPES & MESSAGES */}
            <View style={styles.dualPillarCard}>
              <View style={styles.pillar}>
                <View style={styles.pillarHeader}>
                  <Ionicons name="flame" size={14} color="#FE3C72" />
                  <Text style={styles.pillarLabel}>SWIPES</Text>
                </View>
                <Text style={styles.pillarValue}>{effectiveTotalSwipes}</Text>
              </View>

              <View style={styles.pillarDivider} />

              <View style={styles.pillar}>
                <View style={styles.pillarHeader}>
                  <Ionicons name="chatbubble-ellipses" size={13} color="#6ED2B1" />
                  <Text style={styles.pillarLabel}>MESSAGES</Text>
                </View>
                <Text style={styles.pillarValue}>{effectiveTotalMessages}</Text>
              </View>
            </View>

            {/* Subtle Match Reward Badge (Acknowledges outcome without competing with active work) */}
            {effectiveMatches > 0 && (
              <View style={styles.matchRewardBadge}>
                <Ionicons name="sparkles" size={11} color="#FFD166" />
                <Text style={styles.matchRewardText}>
                  {effectiveMatches} {effectiveMatches === 1 ? "Match" : "Matches"} Connected
                </Text>
              </View>
            )}

            {/* Live Heartbeat Whisper Ticker (Real-Time Assurance) */}
            <Animated.View style={[styles.tickerRow, { opacity: tickerAnim }]}>
              <View
                style={[
                  styles.livePulseDot,
                  { backgroundColor: isRunning ? "#10B981" : "#FBBF24" },
                ]}
              />
              <Text style={styles.tickerText} numberOfLines={1}>
                {liveTickerText}
              </Text>
            </Animated.View>

            {/* Minimalist Status Beacon (No heavy outer pill border) */}
            <View style={styles.beaconStatusLine}>
              <Text style={styles.beaconStatusText}>{displayStatus}</Text>
            </View>

            {/* Contextual Gesture Hint */}
            <Text
              style={[
                styles.interactionHint,
                glanceActive && styles.interactionHintActive,
              ]}
            >
              {glanceActive ? "Tap once more to wake" : "Double-tap anywhere to unlock"}
            </Text>

            {/* Sleek Frosted Glass Unlock Button */}
            <TouchableOpacity
              style={styles.unlockPill}
              onPress={handleDismiss}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Unlock screen"
            >
              <Ionicons name="lock-open-outline" size={13} color="#9CA3AF" />
              <Text style={styles.unlockPillText}>Unlock Screen</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: "#000000",
    width: "100%",
    height: "100%",
  },
  touchSurface: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
    paddingHorizontal: 24,
  },
  hudContainer: {
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  beaconWrap: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  haloRing: {
    position: "absolute",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.22)",
  },
  aperture: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#0D0B10",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontFamily: theme.fonts.label,
    fontSize: 10.5,
    color: "#5C5262",
    letterSpacing: 2.2,
    marginBottom: 16,
    textTransform: "uppercase",
  },

  /* Symmetrical Dual-Pillar Segment (Swipes & Messages) */
  dualPillarCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  pillar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  pillarLabel: {
    fontFamily: theme.fonts.label,
    fontSize: 10,
    color: "#83768B",
    letterSpacing: 1.2,
  },
  pillarValue: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: "#F3EBF7",
    letterSpacing: -0.4,
  },
  pillarDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },

  /* Match Reward Micro-Badge */
  matchRewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 209, 102, 0.08)",
    borderColor: "rgba(255, 209, 102, 0.22)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginBottom: 14,
  },
  matchRewardText: {
    fontFamily: theme.fonts.caption,
    fontSize: 11,
    color: "#FFD166",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  /* Live Heartbeat Whisper Ticker */
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    marginBottom: 10,
    maxWidth: 290,
  },
  livePulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tickerText: {
    fontFamily: theme.fonts.caption,
    fontSize: 11.5,
    color: "#9C8EA6",
    letterSpacing: 0.2,
  },

  /* Clean Status Line */
  beaconStatusLine: {
    marginBottom: 20,
  },
  beaconStatusText: {
    fontFamily: theme.fonts.caption,
    fontSize: 11,
    color: "#5C5262",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  /* Interaction Hint */
  interactionHint: {
    fontFamily: theme.fonts.caption,
    fontSize: 12,
    color: "#6B6071",
    letterSpacing: 0.2,
    marginBottom: 20,
    textAlign: "center",
  },
  interactionHintActive: {
    color: "#FBBF24",
    fontFamily: theme.fonts.label,
  },

  /* Unlock Affordance Button */
  unlockPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.09)",
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  unlockPillText: {
    fontFamily: theme.fonts.label,
    fontSize: 12,
    color: "#9CA3AF",
    letterSpacing: 0.2,
  },
});
