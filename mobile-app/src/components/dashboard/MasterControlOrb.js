import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme as uiTheme } from '../../theme';

function formatCountdown(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MasterControlOrb({
  stats,
  settings,
  isLoggedIn = false,
  busy = false,
  onToggleAgent,
  onOpenBrowser,
}) {
  const agentState = stats?.agentState || stats || {};
  const isRunning = Boolean(
    isLoggedIn &&
    (agentState?.isRunning ||
      (agentState?.currentPhase && !['stopped', 'idle'].includes(agentState.currentPhase)))
  );

  // ── 1. Phase Determination (1:1 with desktop activity-tab-bridge.js) ──
  const currentPhase = (agentState?.currentPhase || (isRunning ? 'swiping' : 'idle')).toLowerCase();
  const subPhase = (agentState?.activeSubPhase || '').toLowerCase();
  const waitingReason = agentState?.waitingReason || '';

  const isSafetyLocked = waitingReason === 'safety_lock';
  const isPartialLimit = waitingReason === 'like_limit' || waitingReason === 'message_limit';
  const isStarting = busy || (!isRunning && agentState?.currentPhase === 'starting') || (isRunning && ['starting', 'initializing', 'checking', 'connecting'].includes(currentPhase));

  // Determine active orb state
  const orbState = useMemo(() => {
    if (!isLoggedIn) return 'disconnected';
    if (isSafetyLocked) return 'locked';
    if (isStarting) return 'initializing';
    if (isPartialLimit) return 'exhausted';

    if (isRunning) {
      // Subphase takes priority (most specific signal from automation)
      if (subPhase.includes('scan') || subPhase.includes('decode') || subPhase.includes('parse')) {
        return 'lead_scan';
      }
      if (subPhase.includes('like') || subPhase.includes('swipe')) {
        return 'swiping';
      }
      if (subPhase.includes('message') || subPhase.includes('rizz') || subPhase.includes('reply')) {
        return 'messaging';
      }

      // Phase fallbacks
      if (currentPhase === 'liking' || currentPhase === 'swiping') return 'swiping';
      if (currentPhase === 'messaging') return 'messaging';
      if (currentPhase === 'transitioning') return 'transitioning';
      if (currentPhase === 'waiting') return waitingReason === 'searching' ? 'polling' : 'waiting';
      if (currentPhase === 'polling') return 'polling';
      if (['checking', 'connecting', 'initializing', 'starting'].includes(currentPhase)) return 'initializing';

      // Default running phase fallback
      if ((agentState?.currentCycle?.messagesProcessed || 0) > 0) return 'messaging';
      return 'swiping';
    }

    return 'idle';
  }, [isLoggedIn, isSafetyLocked, isStarting, isPartialLimit, isRunning, subPhase, currentPhase, waitingReason, agentState]);

  // ── 2. Live Countdown Timer ──
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

  // ── 3. Staggered Triple Pulse Rings Animation ──
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isRunning || isStarting) {
      const createPulse = (anim, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(anim, {
                toValue: 1,
                duration: 2800,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      };

      const a1 = createPulse(pulse1, 0);
      const a2 = createPulse(pulse2, 900);
      const a3 = createPulse(pulse3, 1800);

      a1.start(); a2.start(); a3.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); };
    } else {
      pulse1.setValue(0);
      pulse2.setValue(0);
      pulse3.setValue(0);
    }
  }, [isRunning, isStarting]);

  const getPulseStyle = (anim) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1.0, 1.42],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0.55, 0.35, 0],
    }),
  });

  // ── 4. Continuous Spin Animation (Initializing & Transitioning) ──
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (orbState === 'initializing' || orbState === 'transitioning') {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [orbState]);
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── 5. Heartbeat Pulse Animation (Swiping State) ──
  const heartAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (orbState === 'swiping') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(heartAnim, { toValue: 1.2, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(heartAnim, { toValue: 1.0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(heartAnim, { toValue: 1.12, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(heartAnim, { toValue: 1.0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      heartAnim.setValue(1);
    }
  }, [orbState]);

  // ── 6. Bouncing 3-Dot Typing Animation (Messaging State) ──
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (orbState === 'messaging') {
      const createDot = (anim, delay) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: -4, duration: 200, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.delay(350),
          ])
        );
      };
      const d1 = createDot(dot1, 0);
      const d2 = createDot(dot2, 130);
      const d3 = createDot(dot3, 260);
      d1.start(); d2.start(); d3.start();
      return () => { d1.stop(); d2.stop(); d3.stop(); };
    }
  }, [orbState]);

  // ── 7. Tactile Spring Press In/Out ──
  const pressScale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.94,
      speed: 45,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 35,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  // ── 8. Orb Theme Configuration per State ──
  const currentLikes = agentState?.currentCycle?.likesCompleted ?? agentState?.stats?.swipes ?? 0;
  const targetLikes = settings?.likesPerCycle || 50;
  const currentMsgs = ((agentState?.currentCycle?.messagesProcessed || 0) + (agentState?.currentCycle?.followUpsSent || 0)) || (agentState?.stats?.messages ?? 0);
  const matchName = agentState?.currentCycle?.currentName || '';
  const transitionTimeLeft = agentState?.cycleProgress?.timeLeft ?? 12;

  const config = useMemo(() => {
    switch (orbState) {
      case 'disconnected':
        return {
          gradient: ['#FE3C72', '#FF655B', '#FF8E53'],
          ringColor: 'rgba(254, 60, 114, 0.2)',
          pulseColor: 'rgba(254, 60, 114, 0.3)',
          icon: <Ionicons name="flame" size={38} color="#FFFFFF" />,
          label: 'CONNECT',
          sublabel: 'Tap to start',
          hint: 'Connect Tinder to get started',
        };

      case 'initializing':
        return {
          gradient: ['#4F46E5', '#7C3AED', '#9333EA'],
          ringColor: 'rgba(129, 140, 248, 0.25)',
          pulseColor: 'rgba(129, 140, 248, 0.35)',
          icon: (
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="sync" size={36} color="#FFFFFF" />
            </Animated.View>
          ),
          label: 'Starting...',
          sublabel: 'Connecting session',
          hint: 'Launching your dating game',
        };

      case 'swiping':
        return {
          gradient: ['#E11D48', '#BE185D', '#9D174D'],
          ringColor: 'rgba(244, 63, 94, 0.28)',
          pulseColor: 'rgba(244, 63, 94, 0.38)',
          icon: (
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Ionicons name="heart" size={38} color="#FFFFFF" />
            </Animated.View>
          ),
          label: 'Swiping',
          sublabel: `${currentLikes} / ${targetLikes}`,
          hint: 'AI targeting active · Tap to pause',
        };

      case 'messaging':
        return {
          gradient: ['#7C3AED', '#9333EA', '#A855F7'],
          ringColor: 'rgba(168, 85, 247, 0.28)',
          pulseColor: 'rgba(168, 85, 247, 0.38)',
          icon: (
            <View style={styles.chatIconWrapper}>
              <Ionicons name="chatbubble" size={34} color="#FFFFFF" />
              <View style={styles.typingDotsRow}>
                <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
                <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
                <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
              </View>
            </View>
          ),
          label: 'Messaging',
          sublabel: matchName ? `M: ${matchName}` : `${currentMsgs} chats`,
          hint: 'Generating personalized wingman rizz',
        };

      case 'lead_scan':
        return {
          gradient: ['#DB2777', '#BE185D', '#9D174D'],
          ringColor: 'rgba(236, 72, 153, 0.25)',
          pulseColor: 'rgba(236, 72, 153, 0.35)',
          icon: <Ionicons name="sparkles" size={34} color="#FFFFFF" />,
          label: 'Scanning',
          sublabel: 'Finding Dates',
          hint: 'Analyzing bios and conversation signals',
        };

      case 'transitioning':
        return {
          gradient: ['#059669', '#10B981', '#34D399'],
          ringColor: 'rgba(16, 185, 129, 0.25)',
          pulseColor: 'rgba(16, 185, 129, 0.35)',
          icon: (
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="refresh" size={34} color="#FFFFFF" />
            </Animated.View>
          ),
          label: 'Cooldown',
          sublabel: `${transitionTimeLeft}s`,
          hint: 'Resting between batches to protect account',
        };

      case 'polling':
      case 'waiting':
        return {
          gradient: ['#0891B2', '#06B6D4', '#22D3EE'],
          ringColor: 'rgba(6, 182, 212, 0.25)',
          pulseColor: 'rgba(6, 182, 212, 0.35)',
          icon: <Ionicons name="radio" size={34} color="#FFFFFF" />,
          label: 'Awaiting Replies',
          sublabel: countdown ? countdown : 'Rechecking soon',
          hint: 'Monitoring active conversations for new replies',
        };

      case 'locked':
        return {
          gradient: ['#D97706', '#B45309', '#92400E'],
          ringColor: 'rgba(245, 158, 11, 0.25)',
          pulseColor: 'rgba(245, 158, 11, 0.35)',
          icon: <Ionicons name="lock-closed" size={34} color="#FFFFFF" />,
          label: 'Safety Lock',
          sublabel: countdown ? `Resumes in ${countdown}` : 'Hourly limit',
          hint: 'Hourly rate limit reached · Pacing automation',
        };

      case 'exhausted':
        return {
          gradient: ['#EA580C', '#C2410C', '#9A3412'],
          ringColor: 'rgba(234, 88, 12, 0.25)',
          pulseColor: 'rgba(234, 88, 12, 0.35)',
          icon: <Ionicons name="swap-horizontal" size={36} color="#FFFFFF" />,
          label: 'Likes Done',
          sublabel: 'Switching to chat',
          hint: 'Daily like quota reached · Continuing messages',
        };

      case 'idle':
      default:
        return {
          gradient: ['#FE3C72', '#FF655B', '#FF8E53'],
          ringColor: 'rgba(254, 60, 114, 0.2)',
          pulseColor: 'rgba(254, 60, 114, 0.3)',
          icon: <Ionicons name="play" size={38} color="#FFFFFF" style={{ marginLeft: 4 }} />,
          label: 'START',
          sublabel: 'Tap to launch',
          hint: 'Your next connection starts here',
        };
    }
  }, [orbState, spinInterpolate, heartAnim, dot1, dot2, dot3, currentLikes, targetLikes, currentMsgs, matchName, transitionTimeLeft, countdown]);

  // ── 9. Interactive Action Handler ──
  const handlePress = () => {
    if (isSafetyLocked) return;
    if (!isLoggedIn) {
      if (onOpenBrowser) onOpenBrowser();
      return;
    }
    // If running in any active phase -> click acts as stop/pause (1:1 with desktop plugin)
    if (onToggleAgent) {
      onToggleAgent();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.orbCenterWrapper}>
        {/* Concentric Decorative Rings */}
        <View style={[styles.ringOuter, { borderColor: config.ringColor }]} pointerEvents="none" />
        <View style={[styles.ringMid, { borderColor: config.ringColor }]} pointerEvents="none" />
        <View style={[styles.ringInner, { borderColor: config.ringColor }]} pointerEvents="none" />

        {/* Triple Staggered Pulse Rings (Active when running) */}
        {(isRunning || isStarting) && (
          <>
            <Animated.View style={[styles.pulseRing, { borderColor: config.pulseColor }, getPulseStyle(pulse1)]} pointerEvents="none" />
            <Animated.View style={[styles.pulseRing, { borderColor: config.pulseColor }, getPulseStyle(pulse2)]} pointerEvents="none" />
            <Animated.View style={[styles.pulseRing, { borderColor: config.pulseColor }, getPulseStyle(pulse3)]} pointerEvents="none" />
          </>
        )}

        {/* Master Orb Button */}
        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${config.label}: ${config.sublabel}`}
            disabled={busy || isSafetyLocked}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.88}
            style={styles.masterOrb}
          >
            <LinearGradient
              colors={config.gradient}
              start={{ x: 0.9, y: 0.1 }}
              end={{ x: 0.1, y: 0.95 }}
              style={styles.orbGradient}
            >
              <View style={styles.iconContainer}>
                {config.icon}
              </View>

              <View style={styles.labelGroup}>
                <Text style={styles.orbLabel} numberOfLines={1}>
                  {config.label}
                </Text>
                <Text style={styles.orbSublabel} numberOfLines={1}>
                  {config.sublabel}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Dynamic Status Hint Subtitle */}
      <Text style={styles.statusHint}>
        {config.hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  orbCenterWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Concentric decorative rings (mirrors .orb-rings .ring)
  ringOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
  },
  ringMid: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1,
  },
  ringInner: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1.5,
  },
  // Triple pulse rings (mirrors .orb-pulse-ring)
  pulseRing: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 1.5,
  },
  // Main Interactive Orb (mirrors .master-orb)
  masterOrb: {
    width: 152,
    height: 152,
    borderRadius: 76,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  orbGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  labelGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  orbSublabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  chatIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingDotsRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    top: 13,
  },
  typingDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#7C3AED',
  },
  statusHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: uiTheme.colors.muted,
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: 0.1,
    paddingHorizontal: 20,
  },
});
