import { theme as uiTheme } from '../../theme';
// src/components/dashboard/DashboardPanel.js — Apple iOS-Grade Root Dashboard Panel
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MotionTouchable, ContentTransition } from '../common/Motion';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import ActivityIndicator from '../common/SafeActivityIndicator';
import { Ionicons } from '@expo/vector-icons';

import MasterHeroController from './MasterHeroController';
import QuickTelemetryCapsule from './QuickTelemetryCapsule';
import SegmentedTabControl from './SegmentedTabControl';
import ActivityTimeline from './ActivityTimeline';
import AutomationV2Panel from './AutomationV2Panel';
import SettingsPanel from './SettingsPanel';
import FloatingSaveBar from './FloatingSaveBar';
import useExtensionSettings from '../../hooks/useExtensionSettings';
import { resolveLocalUrl } from '../../utils/network';
import { getProgressFeed } from '../../utils/sessionManager';
import FeedbackState from '../common/FeedbackState';

function LoadingState() {
  return <FeedbackState kind="loading" title="Connecting your assistant" message="Your latest activity will appear here shortly." />;
}

export default function DashboardPanel({
  stats,
  loading,
  error,
  controlsContent,
  onToggleAgent,
  onLogout,
  onConnect,
  isLoggedIn,
  orchestratorUrl,
  onSaveSettings,
  settings: propSettings,
  onSyncProfile,
  onPushBio,
  selectedTab,
  onTabChange,
}) {
  const [internalTab, setInternalTab] = useState('activity');
  const activeTab = selectedTab || internalTab;
  const [showSessionControls, setShowSessionControls] = useState(false);
  const contentRef = useRef(null);
  useEffect(() => { contentRef.current?.scrollTo({ y: 0, animated: false }); }, [activeTab]);
  const [targetSettingsSection, setTargetSettingsSection] = useState(null);

  const handleTabSelect = useCallback((tab) => {
    setTargetSettingsSection(null);
    setInternalTab(tab);
    onTabChange?.(tab);
  }, [onTabChange]);

  const handleNavigateToSettings = useCallback((section) => {
    if (section) setTargetSettingsSection(section);
    setInternalTab('settings');
    onTabChange?.('settings');
  }, [onTabChange]);

  const agentState    = stats?.agentState    ?? null;
  const lifetimeStats = stats?.lifetimeStats ?? null;
  const progressFeed  = (Array.isArray(stats?.progressFeed) && stats.progressFeed.length > 0)
    ? stats.progressFeed
    : (typeof getProgressFeed === 'function' ? getProgressFeed() : []);
  const liveSettings  = (propSettings || stats?.settings) ?? null;

  const effectiveOrchestratorUrl = orchestratorUrl || resolveLocalUrl('http://localhost:3001');

  // Remote settings hook for Automation V2 & configuration (when orchestratorUrl is available)
  const {
    settings: v2Settings,
    loading: v2Loading,
    saving: v2Saving,
    saveSuccess: v2SaveSuccess,
    error: v2Error,
    saveSettings: handleSaveV2Settings,
  } = useExtensionSettings(onSaveSettings ? null : effectiveOrchestratorUrl);

  const [localSaving, setLocalSaving] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [localSaveSuccess, setLocalSaveSuccess] = useState(false);
  const [localSettings, setLocalSettings] = useState(null);

  const effectiveSettings = localSettings || propSettings || v2Settings || liveSettings;

  const handleSave = useCallback(async (updated) => {
    if (onSaveSettings) {
      setLocalSaving(true);
      setLocalError(null);
      try {
        const success = await onSaveSettings(updated);
        if (success !== false) {
          setLocalSettings(prev => ({ ...(prev || effectiveSettings || {}), ...updated }));
          setLocalSaveSuccess(true);
          setTimeout(() => setLocalSaveSuccess(false), 3000);
          return true;
        }
        setLocalError('Your settings could not be saved. Please try again.');
        return false;
      } catch (_) {
        setLocalError('Your settings could not be saved. Please try again.');
        return false;
      } finally {
        setLocalSaving(false);
      }
    }
    return await handleSaveV2Settings(updated);
  }, [onSaveSettings, effectiveSettings, handleSaveV2Settings]);

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
      <View style={styles.tabDock}>
        <SegmentedTabControl activeTab={activeTab} onSelectTab={handleTabSelect} />
      </View>
      {/* ── Scrollable Dashboard Content ── */}
      <ScrollView
        ref={contentRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── 1. Master Centerpiece Hero Controller (1:1 with Desktop V2) ── */}
        <MotionTouchable style={styles.sessionSummary} onPress={() => setShowSessionControls(!showSessionControls)} accessibilityRole="button" accessibilityLabel="Session controls" accessibilityState={{ expanded: showSessionControls }}>
          <Ionicons name="pulse-outline" size={19} color={uiTheme.colors.accent} />
          <View style={{ flex: 1 }}><Text style={styles.sessionTitle}>Session controls</Text><Text style={styles.sessionDetail}>{agentState?.isRunning ? 'Assistant is running' : 'Manage your assistant'}</Text></View>
          <Ionicons name={showSessionControls ? 'chevron-up' : 'chevron-down'} size={18} color={uiTheme.colors.muted} />
        </MotionTouchable>
        {showSessionControls && <MasterHeroController
          agentState={agentState}
          settings={effectiveSettings}
          onToggleAgent={onToggleAgent}
        />}

        {/* ── 2. Integrated Telemetry Capsule (Swipes, Messages, Matches) ── */}
        {activeTab === 'activity' && <QuickTelemetryCapsule lifetimeStats={lifetimeStats} />}

        {/* ── 3. Apple-Style Segmented Navigation (Activity | Automation | Settings) ── */}
        {activeTab !== 'activity' && <View style={styles.tabIntroduction}>
          <Text style={styles.tabTitle}>{activeTab === 'automation' ? 'Your assistant, your way.' : 'Fine-tune your experience.'}</Text>
          <Text style={styles.tabDescription}>{activeTab === 'automation' ? 'Set your goals, conversation style, and preferences.' : 'Manage safety, scheduling, and account preferences.'}</Text>
        </View>}
        <ContentTransition transitionKey={activeTab}>

        {/* ── 4. Active Tab Content ── */}
        {activeTab === 'activity' && (
          loading && !stats ? (
            <LoadingState />
          ) : (
            <View>
              {error && !stats && (
                <FeedbackState kind="error" title="Assistant unavailable" message="Check your connection, then reconnect to your Tinder session." actionLabel="Reconnect" onAction={onConnect} />
              )}

              <ActivityTimeline progressFeed={progressFeed} />
            </View>
          )
        )}

        {activeTab === 'automation' && (
          <AutomationV2Panel
            settings={effectiveSettings}
            loading={onSaveSettings ? false : v2Loading}
            saving={onSaveSettings ? localSaving : v2Saving}
            saveSuccess={onSaveSettings ? localSaveSuccess : v2SaveSuccess}
            error={onSaveSettings ? localError : v2Error}
            onSave={handleSave}
            onDirtyChange={handleDirtyChange}
            onNavigateToSettings={handleNavigateToSettings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            settings={effectiveSettings}
            loading={onSaveSettings ? false : v2Loading}
            saving={onSaveSettings ? localSaving : v2Saving}
            saveSuccess={onSaveSettings ? localSaveSuccess : v2SaveSuccess}
            error={onSaveSettings ? localError : v2Error}
            onSave={handleSave}
            onDirtyChange={handleDirtyChange}
            onLogout={onLogout}
            onConnect={onConnect}
            isLoggedIn={isLoggedIn}
            rawControlsContent={controlsContent}
            orchestratorUrl={effectiveOrchestratorUrl}
            stats={stats}
            onSyncProfile={onSyncProfile}
            onPushBio={onPushBio}
            initialOpenSection={targetSettingsSection}
          />
        )}
        </ContentTransition>
      </ScrollView>

      {/* ─── 5. Global Floating Save Bar (Always Fixed at Viewport Bottom) ─── */}
      <FloatingSaveBar
        visible={dirtyState.isDirty}
        saving={onSaveSettings ? localSaving : v2Saving}
        saveSuccess={onSaveSettings ? localSaveSuccess : v2SaveSuccess}
        error={onSaveSettings ? localError : v2Error}
        onSave={handleGlobalSave}
        onDiscard={handleGlobalDiscard}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabDock: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8 },
  sessionSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: uiTheme.colors.surface, borderRadius: 16, marginBottom: 20, minHeight: 64 },
  sessionTitle: { ...uiTheme.type.label, color: uiTheme.colors.text },
  sessionDetail: { ...uiTheme.type.caption, color: uiTheme.colors.muted },
  tabIntroduction: { gap: 8, marginBottom: 24 },
  tabTitle: { ...uiTheme.type.title, color: uiTheme.colors.text },
  tabDescription: { ...uiTheme.type.body, color: uiTheme.colors.muted },
  panel: {
    flex: 1,
    backgroundColor: uiTheme.colors.background,
    position: 'relative',
  },
  scrollContent: { width: '100%', maxWidth: 600, alignSelf: 'center',
    paddingHorizontal: uiTheme.spacing.xl,
    paddingTop: uiTheme.spacing.lg,
    paddingBottom: 90, // Extra breathing space so content isn't covered by floating save bar
  },
  loadingWrap: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  loadingText: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: 12.5,
    marginTop: 10,
    fontWeight: 'normal',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.md,
  },
  errorText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.error,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
});
