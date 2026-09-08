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

// ─── Phase Telemetry & Copywriting (1:1 with Desktop V2 status-display.js) ───
const TELEMETRY_MAP = {
  checking:     { action: 'CHECKING',     detail: 'READING YOUR PROFILE',                color: '#818CF8' },
  connecting:   { action: 'CONNECTING',   detail: 'YOUR WINGMAN IS COMING ONLINE',       color: '#818CF8' },
  initializing: { action: 'SETTING UP',   detail: 'YOUR AI WINGMAN IS READY',            color: '#A855F7' },
  starting:     { action: 'ALMOST THERE', detail: 'LAUNCHING YOUR DATING GAME',          color: '#A855F7' },
  liking:       { action: 'SWIPING',      detail: 'AI TARGETING ACTIVE',                 color: '#10B981' },
  transitioning:{ action: 'COOLDOWN',     detail: 'PREPARING NEXT PHASE',                color: '#10B981' },
  processing:   { action: 'ANALYZING',    detail: 'READING BETWEEN THE LINES',           color: '#A855F7' },
  lead_scan:    { action: 'SCANNING',     detail: 'FINDING POTENTIAL DATES',             color: '#EC4899' },
  messaging:    { action: 'MESSAGING',    detail: 'RIZZ LEVEL: MAXIMUM',                 color: '#EC4899' },
  polling:      { action: 'AWAITING REPLIES', detail: 'RECHECKING SOON',                 color: '#818CF8' },
  network_wait: { action: 'INTERRUPTED',  detail: 'HOLDING — WILL RESUME ON RECONNECT',  color: '#F59E0B' },
  waiting:      { action: 'COMPLETE',     detail: 'COOLDOWN IN PROGRESS — NEXT CYCLE SOON', color: '#F59E0B' },
  safety_lock:  { action: 'SAFETY LOCK',  detail: 'HOURLY LIMIT REACHED — PACING AUTO',  color: '#F59E0B' },
  stopped:      { action: 'STANDBY',      detail: 'READY FOR ACTION',                    color: '#64748B' },
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

  let phase = agentState?.currentPhase || (isRunning ? 'liking' : 'stopped');
  const subPhase = (agentState?.activeSubPhase || '').toLowerCase();
  const waitingReason = agentState?.waitingReason;

  if (isRunning) {
    if (subPhase.includes('scan') || subPhase.includes('decode') || subPhase.includes('parse')) {
      phase = 'lead_scan';
    } else if (subPhase.includes('like') || subPhase.includes('swipe')) {
      phase = 'liking';
    } else if (subPhase.includes('message') || subPhase.includes('rizz') || subPhase.includes('reply')) {
      phase = 'messaging';
    } else if (waitingReason === 'searching') {
      phase = 'polling';
    }
  }

  const isSafetyLocked = waitingReason === 'safety_lock' || waitingReason === 'like_limit' || waitingReason === 'message_limit';
  const isStarting = isRunning && ['starting', 'initializing', 'checking', 'connecting'].includes(phase);
  const isWaitingCooldown = isRunning && phase === 'waiting' && !isSafetyLocked;

  // ─── 1. Radar Spin Animation (for checking, connecting, scanning) ───
  const radarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [radarAnim]);
  const radarSpin = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ─── 2. Heart Beating & Ripple Animation (for liking / swiping) ───
  const heartBeatAnim = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (phase === 'liking' || (isRunning && !isStarting && !isSafetyLocked && !isWaitingCooldown)) {
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
  }, [phase, isRunning, isStarting, isSafetyLocked, isWaitingCooldown]);

  // ─── 3. Bouncing 3-Dots Messaging Animation ───
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'messaging' || phase === 'lead_scan') {
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
  }, [phase]);

  // ─── 4. Shimmer Progress Bar Animation ───
  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    if (isRunning || isSafetyLocked) {
      const loop = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      shimmerAnim.setValue(-1);
    }
  }, [isRunning, isSafetyLocked, shimmerAnim]);
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-240, 240],
  });

  // ─── 5. Tactile Button Press Spring Scale ───
  const pressScale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.95,
      speed: 40,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
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
        action: 'SAFETY LOCK',
        detail: countdown ? `RESETS IN ${countdown} — HOURLY LIMIT` : 'HOURLY SWIPE LIMIT REACHED',
        color: '#F59E0B',
      };
    }
    if (isStarting) {
      return {
        action: 'STARTING...',
        detail: 'INITIALIZING AI ENGINE',
        color: '#818CF8',
      };
    }
    if (isWaitingCooldown) {
      return {
        action: 'COMPLETE',
        detail: countdown ? `COOLDOWN ACTIVE — NEXT BATCH IN ${countdown}` : 'COOLDOWN IN PROGRESS — NEXT CYCLE SOON',
        color: '#F59E0B',
      };
    }
    if (isRunning) {
      if (phase === 'liking') {
        return {
          action: `${currentLikes} SWIPES`,
          detail: 'AI TARGETING ACTIVE',
          color: '#10B981',
        };
      }
      if (phase === 'messaging') {
        return {
          action: `${currentMsgs} SENT`,
          detail: 'RIZZ LEVEL: MAXIMUM',
          color: '#EC4899',
        };
      }
      return TELEMETRY_MAP[phase] || TELEMETRY_MAP.liking;
    }
    return TELEMETRY_MAP.stopped;
  }, [isRunning, phase, isStarting, isSafetyLocked, isWaitingCooldown, currentLikes, currentMsgs, countdown]);

  // ─── Dynamic Button Styling & Labels (Desktop V2 1:1 Parity) ───
  const buttonConfig = useMemo(() => {
    if (isSafetyLocked) {
      return {
        label: countdown ? `SAFETY LOCK: ${countdown}` : 'SAFETY LOCK',
        sublabel: 'Hourly rate limit reached • Resets automatically',
        icon: 'lock-closed',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.6)',
        textColor: '#FBBF24',
        shimmerColor: '#F59E0B',
      };
    }
    if (isStarting) {
      return {
        label: 'STARTING WINGMAN...',
        sublabel: 'Connecting to Tinder & calibrating...',
        icon: 'sync',
        bgColor: 'rgba(129, 140, 248, 0.18)',
        borderColor: 'rgba(129, 140, 248, 0.5)',
        textColor: '#818CF8',
        shimmerColor: '#818CF8',
        isLoading: true,
      };
    }
    if (isWaitingCooldown) {
      return {
        label: 'STOP AGENT',
        sublabel: countdown ? `Resting between batches • Next cycle in ${countdown}` : 'Cycle complete • Pacing automation',
        icon: 'square',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.45)',
        textColor: '#FCA5A5',
        shimmerColor: '#EF4444',
      };
    }
    if (isRunning) {
      return {
        label: 'STOP AGENT',
        sublabel: `${currentLikes} Likes • ${currentMsgs} DMs • Tap to pause`,
        icon: 'square',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.45)',
        textColor: '#FCA5A5',
        shimmerColor: '#EF4444',
      };
    }
    return {
      label: 'START AGENT',
      sublabel: 'Auto-likes compatible matches & chats in your style',
      icon: 'play',
      bgColor: 'rgba(16, 185, 129, 0.15)',
      borderColor: 'rgba(16, 185, 129, 0.45)',
      textColor: '#6EE7B7',
      shimmerColor: '#10B981',
    };
  }, [isRunning, isStarting, isSafetyLocked, isWaitingCooldown, countdown, currentLikes, currentMsgs]);

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
                  style={[
                    styles.heartRipple,
                    {
                      transform: [{ scale: rippleScale }],
                      opacity: rippleOpacity,
                    },
                  ]}
                />
                <Animated.View style={{ transform: [{ scale: heartBeatAnim }] }}>
                  <Ionicons name="heart" size={18} color="#10B981" />
                </Animated.View>
              </View>
            )}

            {phase === 'messaging' && isRunning && !isWaitingCooldown && (
              <View style={styles.messagingIconWrap}>
                <Ionicons name="chatbubble" size={18} color="#EC4899" />
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
              <Ionicons name="time-outline" size={18} color="#F59E0B" />
            )}

            {isSafetyLocked && (
              <Ionicons name="lock-closed" size={18} color="#F59E0B" />
            )}

            {!isRunning && !isSafetyLocked && (
              <View style={styles.breathingDot} />
            )}
          </View>

          {/* Status Label & Divider Telemetry */}
          <View style={styles.telemetryTextWrap}>
            <View style={styles.telemetryHeaderLine}>
              <Text style={[styles.telemetryAction, { color: telemetry.color }]}>
                {telemetry.action}
              </Text>
              <Text style={styles.statusDivider}>//</Text>
              <Text style={styles.telemetryDetail} numberOfLines={1}>
                {telemetry.detail}
              </Text>
            </View>
          </View>
        </View>

        {/* Next Run Countdown Badge (1:1 with desktop next-run-badge) */}
        {countdown && isRunning && (
          <View style={styles.nextRunBadge}>
            <Ionicons name="time" size={11} color="#F59E0B" />
            <Text style={styles.nextRunText}>{countdown}</Text>
          </View>
        )}
      </View>

      {/* ═════════ 2. The Master Desktop V2 Button ═════════ */}
      <Animated.View style={{ transform: [{ scale: pressScale }] }}>
        <TouchableOpacity
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
              <ActivityIndicator size="small" color={buttonConfig.textColor} style={{ marginRight: 8 }} />
            ) : (
              <View style={[styles.btnIconContainer, { backgroundColor: buttonConfig.borderColor }]}>
                <Ionicons name={buttonConfig.icon} size={15} color={buttonConfig.textColor} />
              </View>
            )}

            <View style={styles.btnTextContent}>
              <Text style={[styles.btnMainTitle, { color: buttonConfig.textColor }]}>
                {buttonConfig.label}
              </Text>
              <Text style={styles.btnSubTitle} numberOfLines={1}>
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
          <View style={styles.shimmerContainer}>
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
          <Ionicons name="flag-outline" size={11} color="#818CF8" />
          <Text style={styles.metaLabel}>Goal: <Text style={styles.metaVal}>{settings?.optimizingFor || 'Date Setup'}</Text></Text>
        </View>

        <View style={styles.metaBadge}>
          <Ionicons name="color-wand-outline" size={11} color="#EC4899" />
          <Text style={styles.metaLabel}>Tone: <Text style={styles.metaVal}>{settings?.tone || 'Playful'}</Text></Text>
        </View>

        <View style={styles.metaBadge}>
          <Ionicons name="shield-checkmark-outline" size={11} color="#10B981" />
          <Text style={[styles.metaLabel, { color: '#10B981' }]}>
            {settings?.safetyMode !== false ? 'Safe Paced' : 'Uncapped'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#14121F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    marginBottom: 12,
  },

  // ─── Status Banner Row ───
  statusBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconHub: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748B',
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
    borderColor: '#10B981',
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
    backgroundColor: '#FFF',
  },
  telemetryTextWrap: {
    flex: 1,
  },
  telemetryHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  telemetryAction: {
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusDivider: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.25)',
    fontWeight: '700',
  },
  telemetryDetail: {
    fontSize: 10.5,
    color: '#CBD5E1',
    fontWeight: '600',
    letterSpacing: 0.2,
    flex: 1,
  },
  nextRunBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  nextRunText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // ─── Master Button (Desktop V2 Parity) ───
  masterBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 10,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextContent: {
    flex: 1,
  },
  btnMainTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  btnSubTitle: {
    fontSize: 10.5,
    color: '#8E8DA3',
    fontWeight: '500',
    marginTop: 1,
  },

  // ─── Shimmer Progress Bar ───
  shimmerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  metaBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#0D0B14',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaLabel: {
    fontSize: 10,
    color: '#716E89',
    fontWeight: '600',
  },
  metaVal: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
});
