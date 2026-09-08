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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ══════════ STEP 1: INTRO VALUE PROPOSITION ══════════ */}
          {step === 'intro' && (
            <>
              {/* Header Icon */}
              <View style={styles.iconWrap}>
                <View style={styles.iconCircle}>
                  <Ionicons name="sparkles" size={26} color="#FE3C72" />
                </View>
              </View>

              {/* Title & Subtitle */}
              <Text style={styles.title}>Find Matches Near You</Text>
              <Text style={styles.subtitle}>
                Meet amazing singles in your area and get notified instantly when someone matches with you.
              </Text>

              {/* Permissions Feature List */}
              <View style={styles.featureList}>
                {/* Location Feature */}
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                    <Ionicons name="location" size={20} color="#3B82F6" />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <View style={styles.featureTitleRow}>
                      <Text style={styles.featureTitle}>People In Your City</Text>
                      <View style={styles.statusPending}>
                        <Text style={styles.statusPendingText}>ESSENTIAL</Text>
                      </View>
                    </View>
                    <Text style={styles.featureDesc}>
                      See people nearby so you can easily plan coffee, drinks, or dates.
                    </Text>
                  </View>
                </View>

                {/* Notifications Feature */}
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(254, 60, 114, 0.12)' }]}>
                    <Ionicons name="chatbubbles" size={20} color="#FE3C72" />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <View style={styles.featureTitleRow}>
                      <Text style={styles.featureTitle}>Instant Match Alerts</Text>
                      <View style={styles.statusPending}>
                        <Text style={styles.statusPendingText}>INSTANT</Text>
                      </View>
                    </View>
                    <Text style={styles.featureDesc}>
                      Get notified the second a new match likes you back or sends a message.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleEnableAll}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>Allow Location & Alerts</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleFinishManual}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Browse Any City Instead</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ══════════ STEP 2: REQUESTING / LIVE GPS FIX ══════════ */}
          {step === 'requesting' && (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingPulseCircle}>
                <ActivityIndicator size="large" color="#FE3C72" />
              </View>
              <Text style={styles.loadingTitle}>Finding Your Location…</Text>
              <Text style={styles.loadingSubtitle}>
                {statusText || 'Finding people near your current city.'}
              </Text>
            </View>
          )}

          {/* ══════════ STEP 3: SUCCESS ══════════ */}
          {step === 'success' && (
            <View style={styles.successContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-circle" size={44} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Location Found!</Text>
              <View style={styles.cityPill}>
                <Ionicons name="location-sharp" size={14} color="#10B981" />
                <Text style={styles.cityNameText}>{resolvedCity}</Text>
              </View>
              <Text style={styles.successSubtitle}>
                We'll prioritize showing you great singles near {resolvedCity}.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleFinishSuccess}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>Start Matching</Text>
                <Ionicons name="sparkles" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════ STEP 4: PERMISSION BLOCKED / DENIED IN SETTINGS ══════════ */}
          {step === 'blocked' && (
            <View style={styles.manualContainer}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(254, 60, 114, 0.12)', borderColor: 'rgba(254, 60, 114, 0.3)' }]}>
                <Ionicons name="location-outline" size={30} color="#FE3C72" />
              </View>
              <Text style={styles.title}>Location Access Needed</Text>
              <Text style={styles.subtitle}>
                To show people in your city, please allow Location in your phone's settings.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleOpenSettings}
                activeOpacity={0.88}
              >
                <Ionicons name="settings-outline" size={16} color="#FFF" />
                <Text style={styles.primaryBtnText}>Open Device Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionBtn, { marginTop: 10 }]}
                onPress={handleEnableAll}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={15} color="#10B981" />
                <Text style={styles.secondaryActionText}>I've Enabled It • Check Again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setStep('manual')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Pick a City Manually</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════ STEP 5: HARDWARE GPS SWITCH DISABLED ══════════ */}
          {step === 'services_disabled' && (
            <View style={styles.manualContainer}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                <Ionicons name="navigate-outline" size={30} color="#F59E0B" />
              </View>
              <Text style={styles.title}>Turn On Location</Text>
              <Text style={styles.subtitle}>
                Your phone's location is turned off. Please turn on Location in quick settings to see nearby people.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleEnableGps}
                activeOpacity={0.88}
              >
                <Ionicons name="power-outline" size={16} color="#FFF" />
                <Text style={styles.primaryBtnText}>Turn On Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionBtn, { marginTop: 10 }]}
                onPress={handleEnableAll}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={15} color="#10B981" />
                <Text style={styles.secondaryActionText}>Check Again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setStep('manual')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Pick a City Manually</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════ STEP 6: MANUAL / FALLBACK ══════════ */}
          {step === 'manual' && (
            <View style={styles.manualContainer}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                <Ionicons name="globe-outline" size={30} color="#F59E0B" />
              </View>
              <Text style={styles.title}>Pick Any City</Text>
              <Text style={styles.subtitle}>
                You can pick from 60+ cities around the world anytime in settings to meet people worldwide.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleFinishManual}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>Continue to App</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#131122',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 24,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    color: '#A09EB5',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  featureList: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18162A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#26223B',
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  featureDesc: {
    color: '#8E8DA3',
    fontSize: 11,
    lineHeight: 15,
  },
  statusPending: {
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPendingText: {
    color: '#FE3C72',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primaryBtn: {
    backgroundColor: '#FE3C72',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryBtnText: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '600',
  },
  // Loading State
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingPulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(254, 60, 114, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  loadingTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  loadingSubtitle: {
    color: '#8E8DA3',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Success State
  successContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconCircle: {
    marginBottom: 12,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 14,
  },
  cityNameText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  successSubtitle: {
    color: '#A09EB5',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 22,
  },
  // Manual / Error State
  manualContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    width: '100%',
  },
  secondaryActionText: {
    color: '#10B981',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
