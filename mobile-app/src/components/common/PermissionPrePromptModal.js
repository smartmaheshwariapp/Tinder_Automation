import DialogContent from './DialogContent';
import { theme as uiTheme } from '../../theme';
// mobile-app/src/components/common/PermissionPrePromptModal.js
// Consumer-grade, high-converting permission pre-prompt modal with live feedback & GPS sync

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AppState,
} from 'react-native';
import ActivityIndicator from './SafeActivityIndicator';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../ui/AppButton';
import Badge, { TONES } from '../ui/Badge';
import IconWell from '../ui/IconWell';
import LocationService from '../../services/locationService';
import NotificationService from '../../services/notifications';

export default function PermissionPrePromptModal({
  visible,
  onClose,
  onPermissionsGranted,
  onPermissionsUpdated,
}) {
  // Steps: 'intro' | 'requesting' | 'success' | 'blocked' | 'services_disabled' | 'manual'
  const [step, setStep] = useState('intro');
  const [statusText, setStatusText] = useState('');
  const [resolvedCity, setResolvedCity] = useState('');
  const [locationResult, setLocationResult] = useState(null);

  useEffect(() => {
    if (visible) {
      setStep('intro');
      setStatusText('');
      setResolvedCity('');
      setLocationResult(null);
    }
  }, [visible]);

  // Auto-detect when returning from device settings
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && (step === 'blocked' || step === 'services_disabled')) {
        handleEnableAll();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [step]);

  const handleEnableAll = async () => {
    setStep('requesting');
    setStatusText('Acquiring location…');

    try {
      // 1. Request location and acquire coordinates directly
      const locRes = await LocationService.requestAndGetDeviceLocation();

      // 2. Request Notification Permission
      try {
        if (NotificationService && NotificationService.requestPermissions) {
          await NotificationService.requestPermissions();
        }
      } catch (_) {}

      if (locRes && locRes.success) {
        setResolvedCity(locRes.cityName || 'Current Location');
        setLocationResult(locRes);
        setStep('success');
      } else if (locRes && locRes.code === 'SERVICES_DISABLED') {
        setStatusText(locRes.error || 'Please turn on GPS in your device settings.');
        setStep('services_disabled');
      } else if (locRes && (locRes.code === 'PERMISSION_BLOCKED' || locRes.canAskAgain === false)) {
        setStatusText('Location access is disabled in device settings.');
        setStep('blocked');
      } else {
        setStatusText(locRes?.error || 'Location permission was not granted.');
        setStep('blocked');
      }
    } catch (err) {
      console.warn('[PermissionModal] Request error:', err);
      setStep('blocked');
    }
  };

  const handleOpenSettings = async () => {
    await LocationService.openDeviceSettings();
  };

  const handleEnableGps = async () => {
    const turnedOn = await LocationService.enableNetworkProvider();
    if (turnedOn) {
      handleEnableAll();
    } else {
      await LocationService.openDeviceSettings();
    }
  };

  const handleFinishSuccess = () => {
    if (onPermissionsGranted && locationResult) {
      onPermissionsGranted(locationResult);
    } else if (onPermissionsUpdated) {
      onPermissionsUpdated({ location: true, notifications: true, ...locationResult });
    }
    if (onClose) onClose();
  };

  const handleFinishManual = () => {
    if (onClose) onClose();
  };

  const renderHeaderIcon = (icon, tone, size = 28) => {
    const t = TONES[tone] || TONES.primary;
    return (
      <View style={[styles.iconCircle, { backgroundColor: t.bg, borderColor: t.border }]}>
        <Ionicons name={icon} size={size} color={t.fg} />
      </View>
    );
  };

  const renderBenefit = ({ icon, tone, title, tag, desc }) => (
    <View style={styles.featureItem} accessible accessibilityLabel={`${title}. ${desc}`}>
      <IconWell icon={icon} tone={tone} size={40} iconSize={20} />
      <View style={styles.featureTextWrap}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle} numberOfLines={2}>{title}</Text>
          <Badge label={tag} tone={tone} size="sm" />
        </View>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <DialogContent style={styles.sheet}>
          {/* ══════════ STEP 1: INTRO VALUE PROPOSITION ══════════ */}
          {step === 'intro' && (
            <>
              {/* Header Icon */}
              <View style={styles.iconWrap}>
                {renderHeaderIcon('sparkles', 'primary')}
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.title} accessibilityRole="header">Find Matches Near You</Text>
              <Text style={styles.subtitle}>
                Meet amazing singles in your area and get notified instantly when someone matches with you.
              </Text>

              {/* Permissions Feature List */}
              <View style={styles.featureList}>
                {/* Location Feature */}
                {renderBenefit({
                  icon: 'location',
                  tone: 'info',
                  title: 'People In Your City',
                  tag: 'ESSENTIAL',
                  desc: 'See people nearby so you can easily plan coffee, drinks, or dates.',
                })}

                {/* Notifications Feature */}
                {renderBenefit({
                  icon: 'chatbubbles',
                  tone: 'primary',
                  title: 'Instant Match Alerts',
                  tag: 'INSTANT',
                  desc: 'Get notified the second a new match likes you back or sends a message.',
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <AppButton
                  title="Allow Location & Alerts"
                  iconRight="arrow-forward"
                  onPress={handleEnableAll}
                />

                <AppButton
                  title="Browse Any City Instead"
                  variant="secondary"
                  onPress={handleFinishManual}
                />
              </View>
            </>
          )}

          {/* ══════════ STEP 2: REQUESTING / LIVE GPS FIX ══════════ */}
          {step === 'requesting' && (
            <View style={styles.loadingContainer} accessibilityLiveRegion="polite">
              <View style={styles.loadingPulseCircle}>
                <ActivityIndicator size="large" color={uiTheme.colors.primary} />
              </View>
              <Text style={styles.loadingTitle} accessibilityRole="header">Finding Your Location…</Text>
              <Text style={styles.loadingSubtitle}>
                {statusText || 'Finding people near your current city.'}
              </Text>
            </View>
          )}

          {/* ══════════ STEP 3: SUCCESS ══════════ */}
          {step === 'success' && (
            <View style={styles.successContainer} accessibilityLiveRegion="polite">
              <View style={styles.iconWrap}>
                {renderHeaderIcon('checkmark-circle', 'success', 32)}
              </View>
              <Text style={styles.successTitle} accessibilityRole="header">Location Found!</Text>
              <View style={styles.cityPill}>
                <Ionicons name="location-sharp" size={14} color={uiTheme.colors.success} />
                <Text style={styles.cityNameText} numberOfLines={1}>{resolvedCity}</Text>
              </View>
              <Text style={styles.successSubtitle}>
                We'll prioritize showing you great singles near {resolvedCity}.
              </Text>

              <View style={styles.actions}>
                <AppButton
                  title="Start Matching"
                  iconRight="sparkles"
                  onPress={handleFinishSuccess}
                />
              </View>
            </View>
          )}

          {/* ══════════ STEP 4: PERMISSION BLOCKED / DENIED IN SETTINGS ══════════ */}
          {step === 'blocked' && (
            <View style={styles.manualContainer}>
              <View style={styles.iconWrap}>
                {renderHeaderIcon('location-outline', 'primary')}
              </View>
              <Text style={styles.title} accessibilityRole="header">Location Access Needed</Text>
              <Text style={styles.subtitle}>
                To show people in your city, please allow Location in your phone's settings.
              </Text>

              <View style={styles.actions}>
                <AppButton
                  title="Open Device Settings"
                  icon="settings-outline"
                  onPress={handleOpenSettings}
                />

                <AppButton
                  title="I've Enabled It • Check Again"
                  icon="refresh"
                  variant="secondary"
                  onPress={handleEnableAll}
                />

                <AppButton
                  title="Pick a City Manually"
                  variant="ghost"
                  size="sm"
                  textStyle={styles.tertiaryText}
                  onPress={() => setStep('manual')}
                />
              </View>
            </View>
          )}

          {/* ══════════ STEP 5: HARDWARE GPS SWITCH DISABLED ══════════ */}
          {step === 'services_disabled' && (
            <View style={styles.manualContainer}>
              <View style={styles.iconWrap}>
                {renderHeaderIcon('navigate-outline', 'warning')}
              </View>
              <Text style={styles.title} accessibilityRole="header">Turn On Location</Text>
              <Text style={styles.subtitle}>
                Your phone's location is turned off. Please turn on Location in quick settings to see nearby people.
              </Text>

              <View style={styles.actions}>
                <AppButton
                  title="Turn On Location"
                  icon="power-outline"
                  onPress={handleEnableGps}
                />

                <AppButton
                  title="Check Again"
                  icon="refresh"
                  variant="secondary"
                  onPress={handleEnableAll}
                />

                <AppButton
                  title="Pick a City Manually"
                  variant="ghost"
                  size="sm"
                  textStyle={styles.tertiaryText}
                  onPress={() => setStep('manual')}
                />
              </View>
            </View>
          )}

          {/* ══════════ STEP 6: MANUAL / FALLBACK ══════════ */}
          {step === 'manual' && (
            <View style={styles.manualContainer}>
              <View style={styles.iconWrap}>
                {renderHeaderIcon('globe-outline', 'secondary')}
              </View>
              <Text style={styles.title} accessibilityRole="header">Pick Any City</Text>
              <Text style={styles.subtitle}>
                You can pick from 60+ cities around the world anytime in settings to meet people worldwide.
              </Text>

              <View style={styles.actions}>
                <AppButton
                  title="Continue to App"
                  iconRight="arrow-forward"
                  onPress={handleFinishManual}
                />
              </View>
            </View>
          )}
        </DialogContent>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: uiTheme.colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: uiTheme.spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.sheet,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    padding: uiTheme.spacing.xxl,
    ...uiTheme.shadows.lg,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...uiTheme.type.title2,
    color: uiTheme.colors.text,
    textAlign: 'center',
    marginBottom: uiTheme.spacing.sm,
  },
  subtitle: {
    ...uiTheme.type.callout,
    color: uiTheme.colors.muted,
    textAlign: 'center',
    marginBottom: uiTheme.spacing.xl,
  },
  featureList: {
    gap: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.xxl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.lg,
    padding: uiTheme.spacing.md,
    borderWidth: 1,
    borderColor: uiTheme.colors.borderSubtle,
  },
  featureTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 3,
  },
  featureTitle: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.heading,
    color: uiTheme.colors.text,
    flexShrink: 1,
  },
  featureDesc: {
    ...uiTheme.type.footnote,
    color: uiTheme.colors.muted,
  },
  actions: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 10,
  },
  tertiaryText: {
    color: uiTheme.colors.muted,
  },
  // Loading State
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: uiTheme.spacing.xxl,
  },
  loadingPulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: uiTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: uiTheme.colors.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: uiTheme.spacing.xl,
  },
  loadingTitle: {
    ...uiTheme.type.section,
    color: uiTheme.colors.text,
    textAlign: 'center',
    marginBottom: uiTheme.spacing.sm,
  },
  loadingSubtitle: {
    ...uiTheme.type.callout,
    color: uiTheme.colors.muted,
    textAlign: 'center',
  },
  // Success State
  successContainer: {
    alignItems: 'center',
    paddingVertical: uiTheme.spacing.sm,
  },
  successTitle: {
    ...uiTheme.type.title2,
    color: uiTheme.colors.text,
    marginBottom: uiTheme.spacing.md,
    textAlign: 'center',
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: uiTheme.colors.successSoft,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 6,
    borderRadius: uiTheme.radius.pill,
    borderWidth: 1,
    borderColor: uiTheme.colors.successBorder,
    marginBottom: uiTheme.spacing.md,
  },
  cityNameText: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.strong,
    color: uiTheme.colors.success,
    flexShrink: 1,
  },
  successSubtitle: {
    ...uiTheme.type.callout,
    color: uiTheme.colors.muted,
    textAlign: 'center',
    marginBottom: uiTheme.spacing.xxl,
  },
  // Manual / Error State
  manualContainer: {
    alignItems: 'center',
    paddingVertical: uiTheme.spacing.sm,
  },
});
