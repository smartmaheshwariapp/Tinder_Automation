import DialogContent from './DialogContent';
import { theme as uiTheme } from '../../theme';
// mobile-app/src/components/common/LocationNoticeModal.js
// Universal, high-converting location access, permission & feedback modal across all screens
// Uses React Native native <Modal> portal to ensure viewport-centered, unclipped presentation over all ScrollViews

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  AppState,
  Animated,
  Keyboard,
} from 'react-native';
import ActivityIndicator from './SafeActivityIndicator';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../ui/AppButton';
import { TONES } from '../ui/Badge';
import LocationService from '../../services/locationService';

/**
 * Types:
 * - 'connected': Successful GPS acquisition (emerald theme, city pill)
 * - 'access_needed': OS location permission denied/blocked (rose theme, Open Settings CTA)
 * - 'services_disabled': Hardware/device GPS turned off (amber theme, Turn On Location CTA)
 * - 'notice': Generic informational/warning notice (indigo theme, Got it CTA)
 */
export default function LocationNoticeModal({
  visible,
  type = 'connected', // 'connected' | 'access_needed' | 'services_disabled' | 'notice'
  title,
  cityName,
  message,
  onClose,
  onOpenSettings,
  onEnableGps,
  onChooseCityManually,
  onLocationAcquired,
}) {
  const [modalType, setModalType] = useState(type);
  const [modalCity, setModalCity] = useState(cityName || '');
  const [rechecking, setRechecking] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    if (visible) {
      try { Keyboard.dismiss(); } catch (_) {}
      setModalType(type);
      setModalCity(cityName || '');
      setRechecking(false);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.94);
    }
  }, [visible, type, cityName, fadeAnim, scaleAnim]);

  // Re-check location when returning from device OS settings
  const handleAutoCheck = useCallback(async () => {
    if (rechecking) return;
    setRechecking(true);
    try {
      const res = await LocationService.requestAndGetDeviceLocation();
      if (res && res.success) {
        setModalCity(res.cityName || 'Current Location');
        setModalType('connected');
        if (onLocationAcquired) {
          onLocationAcquired(res);
        }
      }
    } catch (_) {}
    finally {
      setRechecking(false);
    }
  }, [rechecking, onLocationAcquired]);

  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && (modalType === 'access_needed' || modalType === 'services_disabled')) {
        handleAutoCheck();
      }
    });
    return () => {
      sub.remove();
    };
  }, [visible, modalType, handleAutoCheck]);

  if (!visible) return null;

  const handlePressSettings = async () => {
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      await LocationService.openDeviceSettings();
    }
  };

  const handlePressEnableGps = async () => {
    if (onEnableGps) {
      onEnableGps();
    } else {
      const turnedOn = await LocationService.enableNetworkProvider();
      if (turnedOn) {
        handleAutoCheck();
      } else {
        await LocationService.openDeviceSettings();
      }
    }
  };

  // Resolved titles & copy
  const isConnected = modalType === 'connected';
  const isBlocked = modalType === 'access_needed';
  const isServicesDisabled = modalType === 'services_disabled';
  const isNotice = modalType === 'notice';

  const defaultTitle = isConnected
    ? 'Location Connected'
    : isBlocked
    ? 'Location Access Needed'
    : isServicesDisabled
    ? 'Location Turned Off'
    : 'Location Notice';

  const defaultMessage = isConnected
    ? `Now prioritizing singles near ${modalCity || 'your current area'}. Tinder will show you matches nearby.`
    : isBlocked
    ? "To discover and match with singles in your city, please allow Location in your phone's settings."
    : isServicesDisabled
    ? "Your phone's location service is turned off. Please turn on Location in quick settings to see nearby people."
    : (message || 'Please check your location settings to continue finding matches.');

  const tone = isConnected ? 'success' : isBlocked ? 'primary' : isServicesDisabled ? 'warning' : 'info';
  const toneColors = TONES[tone];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop pressable to dismiss on tap outside */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        {/* Centered Modal Card */}
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <DialogContent style={styles.card}>
          {/* Top Status Icon Pill */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: toneColors.bg, borderColor: toneColors.border },
            ]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={rechecking ? 'Checking location' : undefined}
          >
            {rechecking ? (
              <ActivityIndicator size="small" color={uiTheme.colors.primary} />
            ) : (
              <Ionicons
                name={
                  isConnected
                    ? 'navigate'
                    : isBlocked
                    ? 'location-outline'
                    : isServicesDisabled
                    ? 'navigate-outline'
                    : 'information-circle-outline'
                }
                size={28}
                color={toneColors.fg}
              />
            )}
          </View>

          {/* Title */}
          <Text style={styles.title} accessibilityRole="header">{title || defaultTitle}</Text>

          {/* Connected City Badge */}
          {isConnected && Boolean(modalCity) && (
            <View style={styles.cityBadge}>
              <View style={styles.cityDot} />
              <Ionicons name="location-sharp" size={13} color={uiTheme.colors.success} />
              <Text style={styles.cityText} numberOfLines={1}>
                {modalCity}
              </Text>
            </View>
          )}

          {/* Subtitle / Explanation */}
          <Text style={styles.message}>{message || defaultMessage}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            {isBlocked && (
              <>
                <AppButton
                  title="Open Device Settings"
                  icon="settings-outline"
                  onPress={handlePressSettings}
                />

                <AppButton
                  title={rechecking ? 'Checking Location…' : "I've Enabled It • Check Again"}
                  icon="refresh"
                  variant="secondary"
                  onPress={handleAutoCheck}
                />

                {onChooseCityManually && (
                  <AppButton
                    title="Pick a City Manually"
                    variant="ghost"
                    size="sm"
                    textStyle={styles.tertiaryText}
                    onPress={() => {
                      if (onClose) onClose();
                      onChooseCityManually();
                    }}
                  />
                )}
              </>
            )}

            {isServicesDisabled && (
              <>
                <AppButton
                  title="Turn On Location"
                  icon="power-outline"
                  onPress={handlePressEnableGps}
                />

                <AppButton
                  title={rechecking ? 'Checking…' : 'Check Again'}
                  icon="refresh"
                  variant="secondary"
                  onPress={handleAutoCheck}
                />

                {onChooseCityManually && (
                  <AppButton
                    title="Pick a City Manually"
                    variant="ghost"
                    size="sm"
                    textStyle={styles.tertiaryText}
                    onPress={() => {
                      if (onClose) onClose();
                      onChooseCityManually();
                    }}
                  />
                )}
              </>
            )}

            {(isConnected || isNotice) && (
              <AppButton
                title={isConnected ? 'Start Matching' : 'Got it'}
                icon={isConnected ? 'sparkles' : 'checkmark'}
                onPress={onClose}
              />
            )}
          </View>
          </DialogContent>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: uiTheme.colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: uiTheme.spacing.xxl,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.sheet,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    padding: uiTheme.spacing.xxl,
    alignItems: 'center',
    ...uiTheme.shadows.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  title: {
    ...uiTheme.type.title2,
    color: uiTheme.colors.text,
    textAlign: 'center',
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: uiTheme.colors.successSoft,
    borderWidth: 1,
    borderColor: uiTheme.colors.successBorder,
    borderRadius: uiTheme.radius.pill,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 6,
    marginTop: uiTheme.spacing.md,
  },
  cityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: uiTheme.colors.success,
  },
  cityText: {
    ...uiTheme.type.subhead,
    fontFamily: uiTheme.fonts.strong,
    color: uiTheme.colors.success,
    flexShrink: 1,
  },
  message: {
    ...uiTheme.type.callout,
    color: uiTheme.colors.muted,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: uiTheme.spacing.xxl,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  tertiaryText: {
    color: uiTheme.colors.muted,
  },
});
