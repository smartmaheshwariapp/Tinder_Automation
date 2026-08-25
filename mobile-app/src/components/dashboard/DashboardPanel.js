// src/components/dashboard/DashboardPanel.js — Root Dashboard Panel with 1:1 Extension Navigation Tabs
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AgentStatusHero   from './AgentStatusHero';
import StatCards         from './StatCards';
import AiInsightRow      from './AiInsightRow';
import ActivityFeed      from './ActivityFeed';
import AutomationV2Panel from './AutomationV2Panel';
import SettingsPanel     from './SettingsPanel';
import useExtensionSettings from '../../hooks/useExtensionSettings';

// ─── Skeleton shimmer placeholder ────────────────────────────────────────────
function SkeletonBar({ width = '100%', height = 16, style }) {
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: 8,
          backgroundColor: '#1C192E',
        },
        style,
      ]}
    />
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="small" color="#FE3C72" />
      <Text style={styles.loadingText}>Syncing extension data…</Text>
      <View style={{ gap: 10, marginTop: 20, width: '100%' }}>
        <SkeletonBar height={60} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SkeletonBar height={90} width="30%" />
          <SkeletonBar height={90} width="30%" />
          <SkeletonBar height={90} width="30%" />
        </View>
        <SkeletonBar height={44} />
        <SkeletonBar height={44} />
        <SkeletonBar height={130} />
      </View>
    </View>
  );
}

// ─── Tab bar with clean vector icons ──────────────────────────────────────────
function TabBar({ activeTab, onSelect }) {
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
        onPress={() => onSelect('activity')}
        activeOpacity={0.8}
      >
        <Ionicons
          name="pulse-outline"
          size={14}
          color={activeTab === 'activity' ? '#FFF' : '#716E89'}
        />
        <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
          Activity
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'automation' && styles.tabActive]}
        onPress={() => onSelect('automation')}
        activeOpacity={0.8}
      >
        <Ionicons
          name="flash-outline"
          size={14}
          color={activeTab === 'automation' ? '#FFF' : '#716E89'}
        />
        <Text style={[styles.tabText, activeTab === 'automation' && styles.tabTextActive]}>
          Automation
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
        onPress={() => onSelect('settings')}
        activeOpacity={0.8}
      >
        <Ionicons
          name="settings-outline"
          size={14}
          color={activeTab === 'settings' ? '#FFF' : '#716E89'}
        />
        <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DashboardPanel({ stats, loading, error, controlsContent, onToggleAgent, orchestratorUrl }) {
  const [activeTab, setActiveTab] = useState('activity');

  const handleTabSelect = useCallback((tab) => setActiveTab(tab), []);

  const agentState    = stats?.agentState    ?? null;
  const lifetimeStats = stats?.lifetimeStats ?? null;
  const progressFeed  = stats?.progressFeed  ?? [];
  const liveSettings  = stats?.settings      ?? null;

  // Remote settings hook for Automation V2 & 6-Mode configuration
  const {
    settings: v2Settings,
    loading: v2Loading,
    saving: v2Saving,
    saveSuccess: v2SaveSuccess,
    error: v2Error,
    saveSettings: handleSaveV2Settings,
  } = useExtensionSettings(orchestratorUrl);

  return (
    <View style={styles.panel}>
      <TabBar activeTab={activeTab} onSelect={handleTabSelect} />

      {/* ── 1. Activity & Live Stats Tab ── */}
      {activeTab === 'activity' && (
        loading && !stats ? (
          <LoadingState />
        ) : (
          <View style={styles.dashboardContent}>
            {error && !stats && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.errorText}>
                  Connecting to agent… (Extension loading)
                </Text>
              </View>
            )}

            <AgentStatusHero agentState={agentState} onToggleAgent={onToggleAgent} />
            <StatCards       lifetimeStats={lifetimeStats} />
            <AiInsightRow    settings={liveSettings} lifetimeStats={lifetimeStats} />
            <ActivityFeed    progressFeed={progressFeed} />
          </View>
        )
      )}

      {/* ── 2. FlirtEasy Automation V2 (Accordions) Tab ── */}
      {activeTab === 'automation' && (
        <AutomationV2Panel
          settings={v2Settings}
          loading={v2Loading}
          saving={v2Saving}
          saveSuccess={v2SaveSuccess}
          error={v2Error}
          onSave={handleSaveV2Settings}
        />
      )}

      {/* ── 3. FlirtEasy Settings (6-Modes & API Keys) Tab ── */}
      {activeTab === 'settings' && (
        <SettingsPanel
          settings={v2Settings}
          loading={v2Loading}
          saving={v2Saving}
          saveSuccess={v2SaveSuccess}
          error={v2Error}
          onSave={handleSaveV2Settings}
          rawControlsContent={controlsContent}
          orchestratorUrl={orchestratorUrl}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#0D0B14',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161424',
    padding: 4,
    borderBottomWidth: 1,
    borderColor: '#26223B',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#26223B',
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#716E89',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  dashboardContent: {
    padding: 14,
  },
  loadingWrap: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8DA3',
    fontSize: 13,
    marginTop: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
