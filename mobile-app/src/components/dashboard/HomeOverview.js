import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActivityIndicator from '../common/SafeActivityIndicator';

const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const GOALS = { date: 'Dates', phone: 'Phone', instagram: 'Socials', move_to_instagram: 'Instagram', never: 'Conversation' };

export default function HomeOverview({ stats, settings, isLoggedIn, starting, checking, latencyMs, onOpenBrowser, onToggleAgent, onAutomation, onSettings, onActivity }) {
  const state = stats?.agentState || {};
  const running = Boolean(isLoggedIn && (state.isRunning ?? (state.currentPhase && !['stopped', 'idle'].includes(state.currentPhase))));
  const totals = stats?.lifetimeStats || state.stats || {};
  const goal = settings?.goal || settings?.primaryGoal || settings?.selectedGoal || settings?.primaryGoals?.[0] || 'never';
  const tone = settings?.tone || settings?.chattingStyle || settings?.personalityStyle || 'freestyle';
  const safe = settings?.safetyMode ?? settings?.safeModeEnabled ?? true;
  const busy = starting || checking;
  const metrics = [
    { label: 'SWIPES', value: totals.totalSwipes ?? totals.totalLikes ?? totals.swipes ?? 0, icon: 'heart-outline', color: '#FF4169' },
    { label: 'MATCHES', value: totals.totalMatches ?? totals.matchesCreated ?? totals.matches ?? 0, icon: 'people-outline', color: '#AE8FFF' },
    { label: 'REPLIES', value: totals.totalMessages ?? totals.messagesSent ?? totals.messages ?? 0, icon: 'chatbubble-outline', color: '#6ED2B1' },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.instance} onPress={onOpenBrowser} disabled={starting} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={isLoggedIn ? 'Open Tinder account' : 'Connect Tinder account'}>
        <View style={styles.flameWrap}>
          <LinearGradient colors={['#FF285A', '#FF5076']} style={styles.flame}>
            <Ionicons name="flame" size={29} color="#FFFFFF" />
          </LinearGradient>
          <View style={[styles.onlineDot, !isLoggedIn && styles.offlineDot]} />
        </View>
        <View style={styles.instanceInfo}>
          <View style={styles.instanceTitleRow}>
            <Text style={styles.instanceTitle}>Tinder Instance</Text>
            <View style={[styles.liveBadge, !isLoggedIn && styles.offlineBadge]}>
              <Text style={[styles.liveText, !isLoggedIn && styles.offlineText]}>{isLoggedIn ? 'LIVE' : 'OFFLINE'}</Text>
            </View>
          </View>
          <Text style={styles.location} numberOfLines={1}>{settings?.locationCity || 'Choose your location'}</Text>
        </View>
        <View style={styles.latency}>
          <Text style={styles.latencyLabel}>LATENCY</Text>
          <Text style={styles.latencyValue}>{isLoggedIn && Number.isFinite(latencyMs) ? `${Math.round(latencyMs)}ms` : '—'}</Text>
        </View>
        {starting ? <ActivityIndicator size="small" color="#FF4169" /> : <Ionicons name="chevron-forward" size={18} color="#626267" />}
      </TouchableOpacity>

      <View style={styles.agentCard}>
        <View style={styles.cardHeading}>
          <View style={styles.stateCopy}>
            <Text style={styles.eyebrow}>SYSTEM STATE</Text>
            <Text style={styles.stateTitle}>{busy ? 'Connecting' : running ? 'Agent Active' : 'Agent Standby'}</Text>
          </View>
          <View style={styles.readyBadge}>
            <View style={[styles.statusDot, { backgroundColor: running ? '#48CB8D' : '#78787D' }]} />
            <Text style={styles.readyText}>{running ? 'Running' : isLoggedIn ? 'Ready for Batch' : 'Connect to Start'}</Text>
          </View>
        </View>
        <View pointerEvents="none" style={styles.chipArtwork}>
          <Ionicons name="hardware-chip-outline" size={94} color="#18181B" />
        </View>

        <View style={styles.launchArea}>
          <View style={styles.launchGlow}>
            <View style={styles.launchRing}>
              <View style={styles.innerRing}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={busy ? 'Connecting to Tinder' : running ? 'Pause agent' : isLoggedIn ? 'Launch agent' : 'Connect Tinder to launch agent'}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={isLoggedIn ? onToggleAgent : onOpenBrowser}
                  activeOpacity={0.8}
                  style={styles.launchButton}
                >
                  <LinearGradient colors={running ? ['#7256D8', '#C42E7C', '#EC315D'] : ['#7646BB', '#BF2E91', '#ED315F']} start={{ x: 0.9, y: 0 }} end={{ x: 0.1, y: 1 }} style={styles.launchGradient}>
                    {busy ? <ActivityIndicator size="large" color="#FFFFFF" /> : <Ionicons name={running ? 'pause' : 'play'} size={39} color="#FFFFFF" style={!running && { marginLeft: 6 }} />}
                    <Text style={styles.launchLabel}>{busy ? 'CONNECTING' : running ? 'PAUSE' : 'LAUNCH'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <Text style={styles.launchHint}>{running ? 'Your assistant is working for you' : isLoggedIn ? 'Your next connection starts here' : 'Connect Tinder to get started'}</Text>
        </View>

        <View style={styles.tiles}>
          {[
            { label: 'GOAL', value: GOALS[goal] || titleCase(goal), icon: 'flag-outline', action: onAutomation },
            { label: 'TONE', value: titleCase(tone), icon: 'mic-outline', action: onAutomation },
            { label: 'SPEED', value: safe ? 'Human' : 'Fast', icon: 'timer-outline', action: onSettings },
          ].map(tile => (
            <TouchableOpacity key={tile.label} style={styles.tile} onPress={tile.action} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Edit ${tile.label.toLowerCase()}: ${tile.value}`}>
              <Ionicons name={tile.icon} size={18} color="#949498" />
              <Text style={styles.tileLabel}>{tile.label}</Text>
              <Text style={styles.tileValue} numberOfLines={1}>{tile.value}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.metrics}>
        {metrics.map(metric => (
          <TouchableOpacity key={metric.label} style={styles.metric} onPress={onActivity} accessibilityRole="button" accessibilityLabel={`${metric.value} ${metric.label.toLowerCase()}, view activity`}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{Number(metric.value).toLocaleString()}</Text>
            <Ionicons name={metric.icon} size={17} color={metric.color} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.activityLink} onPress={onActivity} accessibilityRole="button">
        <View style={styles.activityIcon}><Ionicons name="pulse-outline" size={18} color="#FF5478" /></View>
        <View style={styles.instanceInfo}>
          <Text style={styles.activityTitle}>Your activity</Text>
          <Text style={styles.location}>Follow every new connection</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#737378" />
      </TouchableOpacity>
    </ScrollView>
  );
}

export function HomeBottomNavigation({ activeTab, onSelect }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.navigationWrap, { bottom: insets.bottom + 10 }]} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(37, 51, 49, 0.9)', 'rgba(27, 32, 31, 0.88)', 'rgba(24, 24, 25, 0.86)']}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.navigation}
        accessibilityRole="tablist"
      >
        {[
          { id: 'home', icon: 'home', label: 'Home' },
          { id: 'browser', icon: 'chatbubble-outline', label: 'Tinder browser' },
          { id: 'automation', icon: 'compass-outline', label: 'Automation' },
          { id: 'activity', icon: 'analytics-outline', label: 'Activity' },
        ].map(tab => (
          <TouchableOpacity key={tab.id} style={styles.navSlot} onPress={() => onSelect(tab.id)} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: activeTab === tab.id }} activeOpacity={0.75}>
            {activeTab === tab.id ? (
              <LinearGradient colors={['#FF2858', '#FF3E4E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.navActive}><Ionicons name={tab.icon} size={21} color="#FFFFFF" /></LinearGradient>
            ) : <Ionicons name={tab.icon} size={21} color="#777F7D" />}
          </TouchableOpacity>
        ))}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 17, paddingBottom: 100, gap: 22 },
  instance: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: '#0E0E0F', borderWidth: 1, borderColor: '#252526', borderRadius: 28 },
  flameWrap: { position: 'relative' },
  flame: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: 7, backgroundColor: '#47D18C', borderWidth: 3, borderColor: '#0E0E0F' },
  offlineDot: { backgroundColor: '#727277' },
  instanceInfo: { flex: 1, minWidth: 0 },
  instanceTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  instanceTitle: { color: '#F4F4F4', fontSize: 14, fontWeight: '700', letterSpacing: -0.3 },
  liveBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: '#10261B' },
  liveText: { color: '#56CE90', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  offlineBadge: { backgroundColor: '#202023' },
  offlineText: { color: '#929297' },
  location: { color: '#808084', fontSize: 12, marginTop: 5 },
  latency: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  latencyLabel: { color: '#747479', fontSize: 8, fontWeight: '700' },
  latencyValue: { color: '#C2C2C5', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  agentCard: { backgroundColor: '#0D0D0E', borderWidth: 1, borderColor: '#242426', borderRadius: 32, padding: 22, overflow: 'hidden' },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', zIndex: 1 },
  stateCopy: { flex: 1 },
  eyebrow: { color: '#7F7F84', fontSize: 10, letterSpacing: 2.1, fontWeight: '700', marginBottom: 7 },
  stateTitle: { color: '#F7F7F7', fontSize: 24, fontWeight: '700', letterSpacing: -1 },
  readyBadge: { flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1, borderColor: '#29292C', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5, marginTop: 1 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  readyText: { color: '#AAAAAE', fontSize: 8, fontWeight: '600' },
  chipArtwork: { position: 'absolute', right: 15, top: 38 },
  launchArea: { alignItems: 'center', paddingTop: 42, paddingBottom: 31 },
  launchGlow: { shadowColor: '#F82D63', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 25, borderRadius: 100 },
  launchRing: { width: 192, height: 192, borderRadius: 96, borderWidth: 3, borderTopColor: '#62303E', borderRightColor: '#A6294A', borderBottomColor: '#942342', borderLeftColor: '#28151B', padding: 8, transform: [{ rotate: '-18deg' }] },
  innerRing: { flex: 1, borderRadius: 90, borderWidth: 1, borderColor: '#23141C', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '18deg' }] },
  launchButton: { width: 148, height: 148, borderRadius: 74, overflow: 'hidden' },
  launchGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  launchLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1, color: '#FFFFFF' },
  launchHint: { color: '#737378', fontSize: 10, marginTop: 18, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, backgroundColor: '#1B1B1D', borderWidth: 1, borderColor: '#29292C', borderRadius: 17, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, gap: 8 },
  tileLabel: { color: '#8A8A8F', fontSize: 9, fontWeight: '700' },
  tileValue: { color: '#F1F1F3', fontSize: 11, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 6 },
  metric: { flex: 1, minWidth: 0, backgroundColor: '#0E0E0F', borderWidth: 1, borderColor: '#252526', borderRadius: 19, padding: 15, gap: 10 },
  metricLabel: { color: '#75757A', fontSize: 9, fontWeight: '700' },
  metricValue: { color: '#F4F4F5', fontSize: 27, fontWeight: '700', letterSpacing: -1 },
  activityLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingBottom: 2 },
  activityIcon: { height: 39, width: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#211017' },
  activityTitle: { color: '#DADADD', fontSize: 13, fontWeight: '600' },
  navigationWrap: { position: 'absolute', left: 20, right: 20, bottom: 10, zIndex: 10, backgroundColor: 'transparent' },
  navigation: { flexDirection: 'row', backgroundColor: 'transparent', borderRadius: 32, borderWidth: 1, borderColor: 'rgba(112, 126, 121, 0.18)', paddingVertical: 6, paddingHorizontal: 8, overflow: 'hidden' },
  navSlot: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  navActive: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
