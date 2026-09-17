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
}) {
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
    if (isRunning && !isSafetyLocked) {
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
  }, [isRunning, isSafetyLocked]);

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
          hint: 'AI targeting active · Tap to stop',
        };

      case 'messaging': {
        const targetMsgs = typeof settings?.messagesPerCycle === 'number' && settings.messagesPerCycle > 0 ? settings.messagesPerCycle : 50;
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
          gradient: ['#DB2777', '#BE185D', '#9D174D'],
          ringColor: 'rgba(236, 72, 153, 0.25)',
          pulseColor: 'rgba(236, 72, 153, 0.35)',
          icon: <Ionicons name="sparkles" size={34} color="#FFFFFF" />,
          label: 'Scanning',
          sublabel: 'Finding Dates',
          hint: 'Analyzing bios and conversation signals · Tap to stop',
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
          hint: 'Resting between batches · Tap to stop',
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
          hint: 'Monitoring active conversations · Tap to stop',
        };

      case 'locked':
        return {
          gradient: ['#D97706', '#B45309', '#92400E'],
          ringColor: 'rgba(245, 158, 11, 0.25)',
          pulseColor: 'rgba(245, 158, 11, 0.35)',
          icon: <Ionicons name="shield-checkmark" size={34} color="#FFFFFF" />,
          label: 'Safety Pause',
          sublabel: countdown ? `Resumes in ${countdown}` : 'Safety break',
          hint: 'Hourly swipe safety limit · Taking a short break to protect your profile',
        };

      case 'exhausted':
        return {
          gradient: isRunning
            ? ['#F97316', '#EA580C', '#8B5CF6']
            : ['#4F46E5', '#6366F1', '#4338CA'],
          ringColor: isRunning ? 'rgba(249, 115, 22, 0.28)' : 'rgba(99, 102, 241, 0.28)',
          pulseColor: isRunning ? 'rgba(249, 115, 22, 0.38)' : 'rgba(99, 102, 241, 0.38)',
          icon: isRunning
            ? <Ionicons name="chatbubbles" size={36} color="#FFFFFF" />
            : <Ionicons name="hourglass-outline" size={36} color="#FFFFFF" />,
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
            gradient: ['#4B5563', '#6B7280', '#9CA3AF'],
            ringColor: 'rgba(107, 114, 128, 0.25)',
            pulseColor: 'rgba(107, 114, 128, 0.35)',
            icon: <Ionicons name="pause" size={38} color="#FFFFFF" />,
            label: 'OFF',
            sublabel: 'Turn on in Settings',
            hint: 'Swiping & Messaging are both disabled · Turn one on in Automation tab',
          };
        }

        if (!swipingEnabled && messagingEnabled) {
          return {
            gradient: ['#7C3AED', '#8B5CF6', '#A855F7'],
            ringColor: 'rgba(139, 92, 246, 0.25)',
            pulseColor: 'rgba(139, 92, 246, 0.35)',
            icon: <Ionicons name="chatbubbles" size={38} color="#FFFFFF" />,
            label: 'START',
            sublabel: 'Messaging Only',
            hint: 'Swiping disabled · Tap to chat with existing matches',
          };
        }

        if (swipingEnabled && !messagingEnabled) {
          return {
            gradient: ['#FE3C72', '#FF655B', '#FF8E53'],
            ringColor: 'rgba(254, 60, 114, 0.2)',
            pulseColor: 'rgba(254, 60, 114, 0.3)',
            icon: <Ionicons name="heart" size={38} color="#FFFFFF" />,
            label: hasPausedLikesProgress ? 'RESUME' : 'START',
            sublabel: hasPausedLikesProgress ? `${currentLikes} / ${targetLikes}` : 'Swiping Only',
            hint: hasPausedLikesProgress
              ? `Paused at ${currentLikes}/${targetLikes} likes · Tap to resume`
              : 'Auto-messaging disabled · Tap to swipe profiles',
          };
        }

        return {
          gradient: ['#10B981', '#059669', '#047857'],
          ringColor: 'rgba(16, 185, 129, 0.2)',
          pulseColor: 'rgba(16, 185, 129, 0.3)',
          icon: <Ionicons name="play" size={38} color="#FFFFFF" style={{ marginLeft: 4 }} />,
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
                <Text
                  style={styles.orbLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {config.label}
                </Text>
                <Text
                  style={styles.orbSublabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {config.sublabel}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

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
              onPress={handlePress}
              activeOpacity={0.82}
              style={styles.stopPill}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626', '#991B1B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stopPillGradient}
              >
                <View style={styles.stopIconSquare} />
                <Text style={styles.stopPillText}>TAP TO STOP</Text>
              </LinearGradient>
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
              style={styles.stopPill}
            >
              <LinearGradient
                colors={['#EA580C', '#C2410C', '#9A3412']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stopPillGradient}
              >
                <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.stopPillText}>START WINGMAN</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
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
    width: '100%',
    paddingHorizontal: 8,
  },
  orbLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: '100%',
  },
  orbSublabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
    letterSpacing: 0.2,
    textAlign: 'center',
    maxWidth: '100%',
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
  stopPillWrapper: {
    position: 'absolute',
    bottom: -6,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.65,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  stopPill: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  stopPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 6,
  },
  stopIconSquare: {
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  stopPillText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
