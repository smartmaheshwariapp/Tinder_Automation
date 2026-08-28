// src/components/dashboard/DashboardPanel.js — Apple iOS-Grade Root Dashboard Panel
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MasterHeroController from './MasterHeroController';
import QuickTelemetryCapsule from './QuickTelemetryCapsule';
import SegmentedTabControl from './SegmentedTabControl';
import ActivityTimeline from './ActivityTimeline';
import AutomationV2Panel from './AutomationV2Panel';
import SettingsPanel from './SettingsPanel';
import FloatingSaveBar from './FloatingSaveBar';
import useExtensionSettings from '../../hooks/useExtensionSettings';

function LoadingState() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="small" color="#FE3C72" />
      <Text style={styles.loadingText}>Syncing assistant data…</Text>
    </View>
  );
}

export default function DashboardPanel({
  stats,
  loading,
  error,
  controlsContent,
  onToggleAgent,
  onLogout,
  orchestratorUrl,
}) {
  const [activeTab, setActiveTab] = useState('activity');

  const handleTabSelect = useCallback((tab) => setActiveTab(tab), []);

  const agentState    = stats?.agentState    ?? null;
  const lifetimeStats = stats?.lifetimeStats ?? null;
  const progressFeed  = stats?.progressFeed  ?? [];
  const liveSettings  = stats?.settings      ?? null;

  // Remote settings hook for Automation V2 & configuration
  const {
    settings: v2Settings,
    loading: v2Loading,
    saving: v2Saving,
    saveSuccess: v2SaveSuccess,
    error: v2Error,
    saveSettings: handleSaveV2Settings,
  } = useExtensionSettings(orchestratorUrl);

  const effectiveSettings = v2Settings || liveSettings;

  // ─── Global Dynamic Floating Save Bar Controller ───
  const [dirtyState, setDirtyState] = useState({
    isDirty: false,
    saveFn: null,
    discardFn: null,
  });

  const handleDirtyChange = useCallback((isDirty, saveFn, discardFn) => {
    setDirtyState({
      isDirty: Boolean(isDirty),
      saveFn: saveFn || null,
      discardFn: discardFn || null,
    });
  }, []);

  const handleGlobalSave = useCallback(() => {
    if (dirtyState.saveFn) {
      dirtyState.saveFn();
    }
  }, [dirtyState]);

  const handleGlobalDiscard = useCallback(() => {
    if (dirtyState.discardFn) {
      dirtyState.discardFn();
    }
    setDirtyState({ isDirty: false, saveFn: null, discardFn: null });
  }, [dirtyState]);

  return (
    <View style={styles.panel}>
      {/* ── Scrollable Dashboard Content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── 1. Master Centerpiece Hero Controller (1:1 with Desktop V2) ── */}
        <MasterHeroController
          agentState={agentState}
          settings={effectiveSettings}
          onToggleAgent={onToggleAgent}
        />

        {/* ── 2. Integrated Telemetry Capsule (Swipes, Messages, Matches) ── */}
        <QuickTelemetryCapsule lifetimeStats={lifetimeStats} />

        {/* ── 3. Apple-Style Segmented Navigation (Activity | Automation | Settings) ── */}
        <SegmentedTabControl
          activeTab={activeTab}
          onSelectTab={handleTabSelect}
        />

        {/* ── 4. Active Tab Content ── */}
        {activeTab === 'activity' && (
          loading && !stats ? (
            <LoadingState />
          ) : (
            <View>
              {error && !stats && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
                  <Text style={styles.errorText}>
                    Connecting to cloud assistant…
                  </Text>
                </View>
              )}

              <ActivityTimeline progressFeed={progressFeed} />
            </View>
          )
        )}

        {activeTab === 'automation' && (
          <AutomationV2Panel
            settings={v2Settings}
            loading={v2Loading}
            saving={v2Saving}
            saveSuccess={v2SaveSuccess}
            error={v2Error}
            onSave={handleSaveV2Settings}
            onDirtyChange={handleDirtyChange}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            settings={v2Settings}
            loading={v2Loading}
            saving={v2Saving}
            saveSuccess={v2SaveSuccess}
            error={v2Error}
            onSave={handleSaveV2Settings}
            onDirtyChange={handleDirtyChange}
            onLogout={onLogout}
            rawControlsContent={controlsContent}
            orchestratorUrl={orchestratorUrl}
            stats={stats}
          />
        )}
      </ScrollView>

      {/* ─── 5. Global Floating Save Bar (Always Fixed at Viewport Bottom) ─── */}
      <FloatingSaveBar
        visible={dirtyState.isDirty}
        saving={v2Saving}
        saveSuccess={v2SaveSuccess}
        error={v2Error}
        onSave={handleGlobalSave}
        onDiscard={handleGlobalDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#09080E',
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 90, // Extra breathing space so content isn't covered by floating save bar
  },
  loadingWrap: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  loadingText: {
    color: '#8E8DA3',
    fontSize: 12.5,
    marginTop: 10,
    fontWeight: '500',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
