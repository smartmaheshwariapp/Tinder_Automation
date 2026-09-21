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
import { createStyles, theme as uiTheme, alpha } from '../../theme';
import * as Haptics from 'expo-haptics';
import { useMotionReduced, ContentTransition } from '../common/Motion';
import useResponsive from '../../hooks/useResponsive';

const c = uiTheme.colors;
const t = uiTheme.type;
// Orb palette helpers: every state colour comes from a theme token.
const ring = color => alpha(color, 0.22);
const pulse = color => alpha(color, 0.34);

function formatCountdown(ms, includeSeconds = false) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return includeSeconds
      ? `${h}h ${m}m ${String(s).padStart(2, '0')}s`
      : `${h}h ${m}m`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MasterControlOrb({
  stats,
  settings,
  isLoggedIn = false,
  busy = false,
  onToggleAgent,
  onOpenBrowser,
  wellColor = c.surface, // colour of the recessed dial behind the orb; match the parent surface
  showHint = true,
}) {
  const reduced = useMotionReduced();
  // Hero sizing: the 220pt ring block shrinks when the viewport is short or landscape (so the
  // whole hero still fits) and grows modestly on tablets. Every ring below is derived from it.
  const { isTablet, isXL, isShort, isLandscape } = useResponsive();
  const orbScale = isShort || isLandscape ? (isTablet ? 0.9 : 0.8) : isXL ? 1.16 : isTablet ? 1.08 : 1;
  const px = (base) => Math.round(base * orbScale);
  const circle = (base) => ({ width: px(base), height: px(base), borderRadius: px(base) / 2 });
  const agentState = stats?.agentState || stats || {};
  const isRunning = Boolean(
    (isLoggedIn || agentState?.isRunning === true) &&
    (agentState?.isRunning === true ||
      (agentState?.isRunning !== false &&
        agentState?.currentPhase &&
        !['stopped', 'idle', 'waiting', 'paused'].includes(agentState.currentPhase)))
  );

  const swipingEnabled = settings?.autoSwipe !== false && (settings?.likesPerCycle ?? 50) > 0;
  const messagingEnabled = settings?.autoMessage !== false && (settings?.messagesPerCycle ?? 50) > 0;

  // ── 1. Phase Determination (1:1 with desktop activity-tab-bridge.js) ──
  const rawPhase = (agentState?.currentPhase || (isRunning ? (swipingEnabled ? 'swiping' : 'messaging') : 'idle')).toLowerCase();
  const currentPhase = (!swipingEnabled && (rawPhase === 'swiping' || rawPhase === 'liking'))
    ? (messagingEnabled ? 'messaging' : 'idle')
    : rawPhase;
  const subPhase = (agentState?.activeSubPhase || '').toLowerCase();
  const waitingReason = agentState?.waitingReason || '';
  const likesReplenishTimestamp = agentState?.likesReplenishTimestamp;
  const isLikesReplenished = Boolean(likesReplenishTimestamp && Date.now() >= likesReplenishTimestamp);

  const isSafetyLocked = waitingReason === 'safety_lock';
  const isPartialLimit = (
    waitingReason === 'like_limit' ||
    waitingReason === 'message_limit' ||
    (waitingReason === 'likes_exhausted' && !isLikesReplenished)
  );
  const isStarting = busy || (!isRunning && agentState?.currentPhase === 'starting') || (isRunning && ['starting', 'initializing', 'checking', 'connecting'].includes(currentPhase));

  // Determine active orb state
  const orbState = useMemo(() => {
    if (!isLoggedIn && !isRunning) return 'disconnected';
    if (isSafetyLocked) return 'locked';
    if (isStarting) return 'initializing';
    if (isPartialLimit) return 'exhausted';

    if (isRunning) {
      // Subphase takes priority (most specific signal from automation)
      if (subPhase.includes('scan') || subPhase.includes('decode') || subPhase.includes('parse')) {
        return 'lead_scan';
      }
      if (subPhase.includes('like') || subPhase.includes('swipe')) {
        return swipingEnabled ? 'swiping' : (messagingEnabled ? 'messaging' : 'idle');
      }
      if (subPhase.includes('message') || subPhase.includes('rizz') || subPhase.includes('reply')) {
        return 'messaging';
      }

      // Phase fallbacks
      if (currentPhase === 'liking' || currentPhase === 'swiping') {
        return swipingEnabled ? 'swiping' : (messagingEnabled ? 'messaging' : 'idle');
      }
      if (currentPhase === 'messaging') return 'messaging';
      if (currentPhase === 'transitioning') return 'transitioning';
      if (currentPhase === 'waiting') return waitingReason === 'searching' ? 'polling' : 'waiting';
      if (currentPhase === 'polling') return 'polling';
      if (['checking', 'connecting', 'initializing', 'starting'].includes(currentPhase)) return 'initializing';

      // Default running phase fallback
      if (!swipingEnabled && messagingEnabled) return 'messaging';
      if (swipingEnabled && !messagingEnabled) return 'swiping';
      if ((agentState?.currentCycle?.messagesProcessed || 0) > 0) return 'messaging';
      return swipingEnabled ? 'swiping' : 'messaging';
    }

    return 'idle';
  }, [isLoggedIn, isSafetyLocked, isStarting, isPartialLimit, isRunning, subPhase, currentPhase, waitingReason, agentState, swipingEnabled, messagingEnabled]);

  // ── 2. Live Countdown Timer ──
  const [countdown, setCountdown] = useState(null);
  const [countdownLong, setCountdownLong] = useState(null);
  useEffect(() => {
    const ts = agentState?.likesReplenishTimestamp || agentState?.nextRunTimestamp;
    if (!ts) {
      setCountdown(null);
      setCountdownLong(null);
      return;
    }
    const tick = () => {
      const remaining = ts - Date.now();
      if (remaining > 0) {
        setCountdown(formatCountdown(remaining, false));
        setCountdownLong(formatCountdown(remaining, true));
      } else {
        setCountdown(null);
        setCountdownLong(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [agentState?.likesReplenishTimestamp, agentState?.nextRunTimestamp]);

  // ── 3. Staggered Triple Pulse Rings Animation ──
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if ((isRunning || isStarting) && !reduced) {
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
  }, [isRunning, isStarting, reduced]);

  const getPulseStyle = (anim) => ({
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1.0, 1.55],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0.7, 0.35, 0],
    }),
  });

  // ── 4. Continuous Spin Animation (Initializing & Transitioning) ──
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if ((orbState === 'initializing' || orbState === 'transitioning') && !reduced) {
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
  }, [orbState, reduced]);
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── 5. Heartbeat Pulse Animation (Swiping State) ──
  const heartAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (orbState === 'swiping' && !reduced) {
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
  }, [orbState, reduced]);

  // ── 6. Bouncing 3-Dot Typing Animation (Messaging State) ──
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (orbState === 'messaging' && !reduced) {
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
    dot1.setValue(0); dot2.setValue(0); dot3.setValue(0);
  }, [orbState, reduced]);

  // ── 7. Tactile Spring Press In/Out ──
  const pressScale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    if (reduced) return;
    Animated.spring(pressScale, {
      toValue: 0.94,
      speed: 45,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    if (reduced) { pressScale.setValue(1); return; }
    Animated.spring(pressScale, {
      toValue: 1,
      speed: 35,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  // ── 7b. Ambient Glow + Rotating Sweep Ring (Siri-orb breathing / Instagram story ring) ──
  const breathe = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const sweepSpeed = isRunning || isStarting ? 3200 : 9000;
  useEffect(() => {
    if (reduced) { breathe.setValue(0.5); sweep.setValue(0); return; }
    const breatheLoop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(breathe, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    sweep.setValue(0);
    const sweepLoop = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: sweepSpeed, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    breatheLoop.start(); sweepLoop.start();
    return () => { breatheLoop.stop(); sweepLoop.stop(); };
  }, [reduced, sweepSpeed]);
  const sweepRotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowStyle = {
    opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
    transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }],
  };

  // ── 8. Visual State Configurations (1:1 with desktop activity-tab-bridge.js) ──
  const currentLikes = agentState?.currentCycle?.likesCompleted ?? agentState?.stats?.swipes ?? 0;
  const targetLikes = settings?.likesPerCycle || 50;
  const currentMsgs = ((agentState?.currentCycle?.messagesProcessed || 0) + (agentState?.currentCycle?.followUpsSent || 0)) || (agentState?.stats?.messages ?? 0);
  const matchName = agentState?.currentCycle?.currentName || '';
  const transitionTimeLeft = agentState?.cycleProgress?.timeLeft ?? 12;

  // ── 7. Pulsing Stop Button Animation (Active in ANY running state) ──
  const stopPulseAnim = useRef(new Animated.Value(1)).current;
  const stopGlowAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (isRunning && !isSafetyLocked && !reduced) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(stopPulseAnim, {
              toValue: 1.06,
              duration: 750,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(stopGlowAnim, {
              toValue: 1.0,
              duration: 750,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(stopPulseAnim, {
              toValue: 1.0,
              duration: 750,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(stopGlowAnim, {
              toValue: 0.5,
              duration: 750,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      stopPulseAnim.setValue(1);
      stopGlowAnim.setValue(0.5);
    }
  }, [isRunning, isSafetyLocked, reduced]);

  const config = useMemo(() => {
    switch (orbState) {
      case 'disconnected':
        return {
          gradient: uiTheme.gradients.brand,
          ringColor: ring(c.primary),
          pulseColor: pulse(c.primary),
          icon: <Ionicons name="flame" size={38} color={c.onPrimary} />,
          label: 'CONNECT',
          sublabel: 'Tap to start',
          hint: 'Connect Tinder to get started',
        };

      case 'initializing':
        return {
          gradient: [c.info, c.plus],
          ringColor: ring(c.info),
          pulseColor: pulse(c.info),
          icon: (
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="sync" size={36} color={c.onPrimary} />
            </Animated.View>
          ),
          label: 'Starting...',
          sublabel: 'Connecting session',
          hint: 'Launching your dating game',
        };

      case 'swiping':
        return {
          gradient: uiTheme.gradients.brandShort,
          ringColor: ring(c.primary),
          pulseColor: pulse(c.primary),
          icon: (
            <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
              <Ionicons name="heart" size={38} color={c.onPrimary} />
            </Animated.View>
          ),
          label: 'Swiping',
          sublabel: `${currentLikes} / ${targetLikes}`,
          hint: 'AI targeting active · Tap to stop',
        };

      case 'messaging': {
        const targetMsgs = typeof settings?.messagesPerCycle === 'number' && settings.messagesPerCycle > 0 ? settings.messagesPerCycle : 50;
        return {
          gradient: [c.info, c.plus],
          ringColor: ring(c.info),
          pulseColor: pulse(c.info),
          icon: (
            <View style={styles.chatIconWrapper}>
              <Ionicons name="chatbubble" size={34} color={c.onPrimary} />
              <View style={styles.typingDotsRow}>
                <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
                <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
                <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
              </View>
            </View>
          ),
          label: 'Messaging',
          sublabel: matchName
            ? `M: ${matchName}`
            : (currentMsgs > 0 ? `${currentMsgs} / ${targetMsgs} chats` : 'Active'),
          hint: matchName
            ? `Chatting with ${matchName} · Tap to stop`
            : 'AI Wingman chatting with matches · Tap to stop',
        };
      }

      case 'lead_scan':
        return {
          gradient: [c.accent, c.primary],
          ringColor: ring(c.accent),
          pulseColor: pulse(c.accent),
          icon: <Ionicons name="sparkles" size={34} color={c.onPrimary} />,
          label: 'Scanning',
          sublabel: 'Finding Dates',
          hint: 'Analyzing bios and conversation signals · Tap to stop',
        };

      case 'transitioning':
        return {
          gradient: [c.success, c.platinum],
          ringColor: ring(c.success),
          pulseColor: pulse(c.success),
          icon: (
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="refresh" size={34} color={c.onPrimary} />
            </Animated.View>
          ),
          label: 'Cooldown',
          sublabel: `${transitionTimeLeft}s`,
          hint: 'Resting between batches · Tap to stop',
        };

      case 'polling':
      case 'waiting':
        return {
          gradient: [c.platinum, c.info],
          ringColor: ring(c.platinum),
          pulseColor: pulse(c.platinum),
          icon: <Ionicons name="radio" size={34} color={c.onPrimary} />,
          label: 'Awaiting Replies',
          sublabel: countdown ? countdown : 'Rechecking soon',
          hint: 'Monitoring active conversations · Tap to stop',
        };

      case 'locked':
        return {
          gradient: [c.warning, c.secondary],
          ringColor: ring(c.warning),
          pulseColor: pulse(c.warning),
          icon: <Ionicons name="shield-checkmark" size={34} color={c.onPrimary} />,
          label: 'Safety Pause',
          sublabel: countdown ? `Resumes in ${countdown}` : 'Safety break',
          hint: 'Hourly swipe safety limit · Taking a short break to protect your profile',
        };

      case 'exhausted':
        return {
          gradient: isRunning
            ? [c.warning, c.info]
            : [c.info, c.plus],
          ringColor: isRunning ? ring(c.warning) : ring(c.info),
          pulseColor: isRunning ? pulse(c.warning) : pulse(c.info),
          icon: isRunning
            ? <Ionicons name="chatbubbles" size={36} color={c.onPrimary} />
            : <Ionicons name="hourglass-outline" size={36} color={c.onPrimary} />,
          label: isRunning ? 'WINGMAN' : 'LIKES REFILL',
          sublabel: countdown ? `Refills in ${countdown}` : (isRunning ? 'Chatting' : '12h Refill'),
          hint: isRunning
            ? (countdownLong
                ? `Swipes refilling in ${countdownLong} · Wingman is chatting with matches! Tap to stop`
                : 'Swipes refilling · Wingman is chatting with matches! Tap to stop')
            : (countdownLong
                ? `Daily swipes refill in ${countdownLong} · Tap to chat with existing matches`
                : 'Daily swipes refilling · Tap to chat with existing matches'),
        };

      case 'idle':
      default: {
        const swipingEnabled = settings?.autoSwipe !== false && (settings?.likesPerCycle ?? 50) > 0;
        const messagingEnabled = settings?.autoMessage !== false && (settings?.messagesPerCycle ?? 50) > 0;
        const hasPausedLikesProgress = swipingEnabled && currentLikes > 0 && currentLikes < targetLikes;

        if (!swipingEnabled && !messagingEnabled) {
          return {
            gradient: [c.textTertiary, c.muted],
            ringColor: ring(c.muted),
            pulseColor: pulse(c.muted),
            icon: <Ionicons name="pause" size={38} color={c.onPrimary} />,
            label: 'OFF',
            sublabel: 'Turn on in Settings',
            hint: 'Swiping & Messaging are both disabled · Turn one on in Automation tab',
          };
        }

        if (!swipingEnabled && messagingEnabled) {
          return {
            gradient: uiTheme.gradients.brand,
            ringColor: ring(c.primary),
            pulseColor: pulse(c.primary),
            icon: <Ionicons name="chatbubbles" size={38} color={c.onPrimary} />,
            label: 'START',
            sublabel: 'Messaging Only',
            hint: 'Swiping disabled · Tap to chat with existing matches',
          };
        }

        if (swipingEnabled && !messagingEnabled) {
          return {
            gradient: uiTheme.gradients.brand,
            ringColor: ring(c.primary),
            pulseColor: pulse(c.primary),
            icon: <Ionicons name="heart" size={38} color={c.onPrimary} />,
            label: hasPausedLikesProgress ? 'RESUME' : 'START',
            sublabel: hasPausedLikesProgress ? `${currentLikes} / ${targetLikes}` : 'Swiping Only',
            hint: hasPausedLikesProgress
              ? `Paused at ${currentLikes}/${targetLikes} likes · Tap to resume`
              : 'Auto-messaging disabled · Tap to swipe profiles',
          };
        }

        return {
          gradient: uiTheme.gradients.brand,
          ringColor: ring(c.primary),
          pulseColor: pulse(c.primary),
          icon: <Ionicons name="play" size={38} color={c.onPrimary} style={{ marginLeft: 4 }} />,
          label: hasPausedLikesProgress ? 'RESUME' : 'START',
          sublabel: hasPausedLikesProgress ? `${currentLikes} / ${targetLikes}` : 'Full Auto',
          hint: hasPausedLikesProgress
            ? `Paused at ${currentLikes}/${targetLikes} likes · Tap to resume`
            : 'Your next connection starts here · Swiping & Messaging',
        };
      }
    }
  }, [orbState, spinInterpolate, heartAnim, dot1, dot2, dot3, currentLikes, targetLikes, currentMsgs, matchName, transitionTimeLeft, countdown, countdownLong, isRunning, settings]);

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

  const tintStart = config.gradient[0];
  const tintEnd = config.gradient[config.gradient.length - 1];
  const tapHaptic = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); };

  return (
    <View style={[styles.container, (isShort || isLandscape) && styles.containerTight]}>
      <View style={[styles.orbCenterWrapper, { width: px(220), height: px(220) }]}>
        {/* Concentric Decorative Rings */}
        {/* Static outer rings removed to declutter (glow, sweep ring and ripples remain).
        <View style={[styles.ringOuter, { borderColor: config.ringColor }]} pointerEvents="none" />
        <View style={[styles.ringMid, { borderColor: config.ringColor }]} pointerEvents="none" />
        */}
        <Animated.View style={[styles.glowOuter, circle(214), { backgroundColor: alpha(tintStart, 0.08) }, glowStyle]} pointerEvents="none" />
        <Animated.View style={[styles.glowInner, circle(188), { backgroundColor: alpha(tintStart, 0.14) }, glowStyle]} pointerEvents="none" />
        <Animated.View style={[styles.sweepRing, circle(172), { transform: [{ rotate: sweepRotate }] }]} pointerEvents="none">
          <LinearGradient
            colors={[tintStart, alpha(tintEnd, 0), tintEnd, alpha(tintStart, 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={[styles.sweepMask, circle(166), { backgroundColor: wellColor }]} pointerEvents="none" />

        {/* Triple Staggered Pulse Rings (Active when running) */}
        {(isRunning || isStarting) && (
          <>
            <Animated.View style={[styles.pulseRing, circle(154), { borderColor: config.pulseColor, backgroundColor: alpha(tintStart, 0.1) }, getPulseStyle(pulse1)]} pointerEvents="none" />
            <Animated.View style={[styles.pulseRing, circle(154), { borderColor: config.pulseColor, backgroundColor: alpha(tintStart, 0.1) }, getPulseStyle(pulse2)]} pointerEvents="none" />
            <Animated.View style={[styles.pulseRing, circle(154), { borderColor: config.pulseColor, backgroundColor: alpha(tintStart, 0.1) }, getPulseStyle(pulse3)]} pointerEvents="none" />
          </>
        )}

        {/* Master Orb Button */}
        <Animated.View style={{ transform: [{ scale: pressScale }] }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${config.label}: ${config.sublabel}`}
            accessibilityHint={config.hint}
            accessibilityState={{ disabled: Boolean(busy || isSafetyLocked), busy: Boolean(isStarting) }}
            disabled={busy || isSafetyLocked}
            onPress={() => { tapHaptic(); handlePress(); }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.88}
            style={[styles.masterOrb, circle(152)]}
          >
            <LinearGradient
              colors={config.gradient}
              start={{ x: 0.9, y: 0.1 }}
              end={{ x: 0.1, y: 0.95 }}
              style={styles.orbGradient}
            >
              {/* Tonal shade keeps white labels legible on the lighter token colours. */}
              <LinearGradient
                pointerEvents="none"
                colors={[alpha(c.black, 0.12), alpha(c.black, 0.46)]}
                start={{ x: 0.9, y: 0.1 }}
                end={{ x: 0.1, y: 0.95 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Glass highlight across the top of the orb */}
              <LinearGradient
                pointerEvents="none"
                colors={[alpha(c.white, 0.32), alpha(c.white, 0)]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.55 }}
                style={styles.orbGloss}
              />
              <ContentTransition transitionKey={orbState} style={styles.orbContent}>
              <View style={styles.iconContainer}>
                {config.icon}
              </View>

              <View style={styles.labelGroup}>
                <Text
                  style={styles.orbLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                >
                  {config.label}
                </Text>
                <Text
                  style={styles.orbSublabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                >
                  {config.sublabel}
                </Text>
              </View>
              </ContentTransition>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

      </View>

        {/* Floating Pulsing Stop Pill (Anchored under the Orb in any running state) */}
        {isRunning && !isSafetyLocked && (
          <Animated.View
            style={[
              styles.stopPillWrapper,
              {
                transform: [{ scale: stopPulseAnim }],
                opacity: stopGlowAnim.interpolate({
                  inputRange: [0.5, 1],
                  outputRange: [0.92, 1.0],
                }),
              },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Stop Automation"
              onPress={() => { tapHaptic(); handlePress(); }}
              activeOpacity={0.82}
              hitSlop={PILL_HIT_SLOP}
              style={styles.stopButton}
            >
              <View style={styles.stopButtonInner}>
                <View style={styles.stopIconSquare} />
                <Text style={styles.stopButtonText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Stop wingman</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Floating Start Wingman Pill when paused/stopped during likes refill period */}
        {!isRunning && !isSafetyLocked && orbState === 'exhausted' && (
          <View style={styles.stopPillWrapper}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Start Wingman"
              onPress={handlePress}
              activeOpacity={0.82}
              hitSlop={PILL_HIT_SLOP}
              style={styles.stopPill}
            >
              <LinearGradient
                colors={[c.warning, c.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stopPillGradient}
              >
                <Ionicons name="play" size={13} color={c.background} />
                <Text style={[styles.stopPillText, styles.startPillText]} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>START WINGMAN</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

      {/* Dynamic Status Hint Subtitle */}
      {showHint ? (
        <Text style={styles.statusHint} accessibilityLiveRegion="polite" maxFontSizeMultiplier={uiTheme.fontScale.body}>
          {isRunning && !isSafetyLocked ? String(config.hint).replace(/\s*·\s*Tap to stop\s*$/i, '') : config.hint}
        </Text>
      ) : null}
    </View>
  );
}

// Extends the compact floating pills to a 44pt touch target.
const PILL_HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

const styles = createStyles(() => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: uiTheme.spacing.md,
  },
  // Short viewports / landscape: the orb already shrinks, so trim the block's own padding too.
  containerTight: {
    paddingVertical: uiTheme.spacing.xs,
  },
  // The ring/orb sizes below are the phone baseline; MasterControlOrb overrides width/height/
  // borderRadius at render from useResponsive() so the hero fits short and landscape windows
  // and can grow a little on tablets.
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
  glowOuter: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 107,
  },
  glowInner: {
    position: 'absolute',
    width: 188,
    height: 188,
    borderRadius: 94,
  },
  // Rotating gradient ring: a gradient disc masked by a surface-coloured disc.
  sweepRing: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    overflow: 'hidden',
  },
  sweepMask: {
    position: 'absolute',
    width: 166,
    height: 166,
    borderRadius: 83,
    backgroundColor: c.surface,
  },
  orbGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  orbContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
      ios: uiTheme.shadows.lg,
      android: { elevation: 12 },
    }),
  },
  orbGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: uiTheme.spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.xs,
  },
  labelGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: uiTheme.spacing.sm,
  },
  orbLabel: {
    ...t.headline,
    fontFamily: uiTheme.fonts.heavy,
    color: c.onPrimary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: '100%',
    textShadowColor: alpha(c.black, 0.35),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  orbSublabel: {
    ...t.caption,
    fontFamily: uiTheme.fonts.label,
    color: alpha(c.white, 0.92),
    marginTop: uiTheme.spacing.xxs,
    textAlign: 'center',
    maxWidth: '100%',
    fontVariant: ['tabular-nums'],
    textShadowColor: alpha(c.black, 0.35),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    backgroundColor: c.primary,
  },
  statusHint: {
    ...t.subhead,
    color: c.muted,
    textAlign: 'center',
    marginTop: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.xl,
  },
  stopPillWrapper: {
    marginTop: uiTheme.spacing.md,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: c.danger,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  stopPill: {
    borderRadius: uiTheme.radius.pill,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: alpha(c.white, 0.4),
  },
  stopPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    paddingVertical: uiTheme.spacing.xs,
    paddingHorizontal: uiTheme.spacing.md + 2,
    gap: uiTheme.spacing.sm - 2,
  },
  stopIconSquare: {
    width: 9,
    height: 9,
    backgroundColor: c.error,
    borderRadius: 2,
  },
  stopButton: {
    borderRadius: uiTheme.radius.pill,
    borderWidth: 1,
    borderColor: alpha(c.error, 0.45),
    backgroundColor: alpha(c.error, 0.12),
  },
  stopButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    minHeight: 40,
    paddingHorizontal: uiTheme.spacing.xl,
  },
  stopButtonText: {
    ...t.buttonSmall,
    color: c.error,
  },
  stopPillText: {
    ...t.overline,
    letterSpacing: 0.8,
    color: c.onPrimary,
  },
  startPillText: {
    color: c.background,
  },
}));
