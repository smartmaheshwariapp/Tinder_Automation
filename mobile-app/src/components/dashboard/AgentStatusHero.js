import { theme as uiTheme } from '../../theme';
// src/components/dashboard/AgentStatusHero.js — Sleek Live Status Hero with Native Vector Icons
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { MotionTouchable as TouchableOpacity } from '../common/Motion';
import { Ionicons } from '@expo/vector-icons';

// ─── Phase metadata with clean vector icons ─────────────────────────────────
const PHASE_META = {
  liking:        { label: 'SWIPING',       color: uiTheme.colors.primary, icon: 'heart' },
  messaging:     { label: 'MESSAGING',     color: '#EC4899', icon: 'chatbubbles' },
  lead_scan:     { label: 'SCANNING',      color: '#C026D3', icon: 'scan' },
  waiting:       { label: 'WAITING',       color: uiTheme.colors.warning, icon: 'time-outline' },
  polling:       { label: 'SYNCING',       color: uiTheme.colors.info, icon: 'sync' },
  transitioning: { label: 'COOLDOWN',      color: '#8B5CF6', icon: 'hourglass-outline' },
  initializing:  { label: 'INITIALIZING',  color: uiTheme.colors.primary, icon: 'sparkles' },
  starting:      { label: 'STARTING',      color: uiTheme.colors.primary, icon: 'flash' },
  checking:      { label: 'CHECKING',      color: uiTheme.colors.info, icon: 'search' },
  connecting:    { label: 'CONNECTING',    color: uiTheme.colors.info, icon: 'radio-outline' },
  network_wait:  { label: 'OFFLINE',       color: uiTheme.colors.error, icon: 'cloud-offline' },
  locked:        { label: 'SAFETY LOCK',   color: uiTheme.colors.error, icon: 'lock-closed' },
  stopped:       { label: 'STANDBY',       color: uiTheme.colors.muted, icon: 'pause' },
};

function resolvePhase(agentState) {
  if (!agentState?.isRunning) return 'stopped';
  const phase = agentState.currentPhase || 'stopped';
  const sub = (agentState.activeSubPhase || '').toLowerCase();
  if (sub.includes('like') || sub.includes('swipe')) return 'liking';
  if (sub.includes('message') || sub.includes('rizz') || sub.includes('reply')) return 'messaging';
  if (sub.includes('scan') || sub.includes('decode')) return 'lead_scan';
  if (agentState.waitingReason === 'safety_lock') return 'locked';
  return PHASE_META[phase] ? phase : 'stopped';
}

function formatCountdown(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AgentStatusHero({ agentState, onToggleAgent }) {
  const phase = resolvePhase(agentState);
  const meta = PHASE_META[phase] || PHASE_META.stopped;
  const isRunning = Boolean(
    agentState?.isRunning ||
    (agentState?.currentPhase && agentState.currentPhase !== 'stopped')
  );

  // Countdown timer
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

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isRunning) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isRunning, pulseAnim]);

  // Progress label
  const progressLabel = useMemo(() => {
    const currentCycle = agentState?.currentCycle;
    if (isRunning && currentCycle) {
      const parts = [];
      if (currentCycle.likesCompleted > 0) parts.push(`${currentCycle.likesCompleted} Likes`);
      if (currentCycle.messagesProcessed > 0) parts.push(`${currentCycle.messagesProcessed} DMs`);
      if (currentCycle.currentName) parts.push(`with ${currentCycle.currentName}`);
      if (parts.length > 0) return parts.join(' · ');
    }
    if (countdown) return `Next run in ${countdown}`;
    if (agentState?.waitingReason) {
      const reasonMap = {
        schedule: 'Waiting for scheduled window',
        cooldown: 'Cooling down between runs',
        safety_lock: 'Daily safety limit reached',
        no_matches: 'All new matches engaged',
      };
      return reasonMap[agentState.waitingReason] || agentState.waitingReason;
    }
    if (!isRunning) return 'Tap Start to activate AI Auto-Pilot';
    return null;
  }, [agentState, isRunning, countdown]);

  return (
    <View style={styles.container}>
      {/* Left: Glowing Orb with Native Vector Icon */}
      <View style={styles.orbWrap}>
        <Animated.View
          style={[
            styles.orbRing,
            {
              borderColor: meta.color,
              opacity: pulseAnim,
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.95, 1.15] }) }],
            },
          ]}
        />
        <View style={[styles.orb, { backgroundColor: meta.color + '18', borderColor: meta.color + '60' }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
      </View>

      {/* Center: Labels */}
      <View style={styles.labels}>
        <View style={styles.phaseRow}>
          <Text style={[styles.phaseLabel, { color: meta.color }]}>{meta.label}</Text>
          <View style={[styles.runningBadge, { backgroundColor: isRunning ? 'rgba(16, 185, 129, 0.12)' : 'rgba(113, 110, 137, 0.15)', borderColor: isRunning ? 'rgba(16, 185, 129, 0.3)' : 'rgba(113, 110, 137, 0.3)' }]}>
            <View style={[styles.runningDot, { backgroundColor: isRunning ? uiTheme.colors.success : uiTheme.colors.muted }]} />
            <Text style={[styles.runningText, { color: isRunning ? uiTheme.colors.success : uiTheme.colors.muted }]}>
              {isRunning ? 'ACTIVE' : 'IDLE'}
            </Text>
          </View>
        </View>
        {progressLabel ? (
          <Text style={styles.progressLabel} numberOfLines={1}>{progressLabel}</Text>
        ) : null}
      </View>

      {/* Right: Remote Start/Stop Trigger Button */}
      {onToggleAgent ? (
        <TouchableOpacity accessibilityRole="button"
          style={[
            styles.toggleBtn,
            {
              backgroundColor: isRunning ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 60, 114, 0.12)',
              borderColor: isRunning ? 'rgba(239, 68, 68, 0.35)' : 'rgba(254, 60, 114, 0.35)',
            },
          ]}
          onPress={onToggleAgent}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isRunning ? 'square' : 'play'}
            size={12}
            color={isRunning ? uiTheme.colors.error : uiTheme.colors.primary}
          />
          <Text style={[styles.toggleBtnText, { color: isRunning ? uiTheme.colors.error : uiTheme.colors.primary }]}>
            {isRunning ? 'Stop' : 'Start'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uiTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiTheme.colors.elevated,
    padding: 14,
    marginBottom: uiTheme.spacing.md,
  },
  orbWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uiTheme.spacing.md,
  },
  orbRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: uiTheme.radius.sheet,
    borderWidth: 1.5,
  },
  orb: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flex: 1,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  phaseLabel: { fontFamily: 'Inter_800ExtraBold',
    fontSize: 14.5,
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },
  runningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  runningDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  runningText: { fontFamily: 'Inter_800ExtraBold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.8,
  },
  progressLabel: { fontFamily: 'Inter_500Medium',
    marginTop: uiTheme.spacing.xs,
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    fontWeight: 'normal',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    marginLeft: uiTheme.spacing.sm,
  },
  toggleBtnText: { fontFamily: 'Inter_800ExtraBold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
});
