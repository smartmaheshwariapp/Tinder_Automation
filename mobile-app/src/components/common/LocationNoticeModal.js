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
  ActivityIndicator,
  AppState,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
          activeOpacity={1}
        />

        {/* Centered Modal Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Status Icon Pill */}
          <View
            style={[
              styles.iconCircle,
              isConnected && styles.iconCircleConnected,
              isBlocked && styles.iconCircleBlocked,
              isServicesDisabled && styles.iconCircleDisabled,
              isNotice && styles.iconCircleNotice,
            ]}
          >
            {rechecking ? (
              <ActivityIndicator size="small" color="#FE3C72" />
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
                size={26}
                color={
                  isConnected
                    ? '#10B981'
                    : isBlocked
                    ? '#FE3C72'
                    : isServicesDisabled
                    ? '#F59E0B'
                    : '#6366F1'
                }
              />
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{title || defaultTitle}</Text>

          {/* Connected City Badge */}
          {isConnected && Boolean(modalCity) && (
            <View style={styles.cityBadge}>
              <View style={styles.cityDot} />
              <Ionicons name="location-sharp" size={13} color="#10B981" />
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
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handlePressSettings}
                  activeOpacity={0.88}
                >
                  <Ionicons name="settings-outline" size={16} color="#FFF" />
                  <Text style={styles.primaryBtnText}>Open Device Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkAgainBtn}
                  onPress={handleAutoCheck}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={14} color="#10B981" />
                  <Text style={styles.checkAgainText}>
                    {rechecking ? 'Checking Location…' : "I've Enabled It • Check Again"}
                  </Text>
                </TouchableOpacity>

                {onChooseCityManually && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => {
                      if (onClose) onClose();
                      onChooseCityManually();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>Pick a City Manually</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {isServicesDisabled && (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handlePressEnableGps}
                  activeOpacity={0.88}
                >
                  <Ionicons name="power-outline" size={16} color="#FFF" />
                  <Text style={styles.primaryBtnText}>Turn On Location</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkAgainBtn}
                  onPress={handleAutoCheck}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={14} color="#10B981" />
                  <Text style={styles.checkAgainText}>
                    {rechecking ? 'Checking…' : 'Check Again'}
                  </Text>
                </TouchableOpacity>

                {onChooseCityManually && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => {
                      if (onClose) onClose();
                      onChooseCityManually();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>Pick a City Manually</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {(isConnected || isNotice) && (
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  isConnected && styles.primaryBtnConnected,
                ]}
                onPress={onClose}
                activeOpacity={0.88}
              >
                <Ionicons
                  name={isConnected ? 'sparkles' : 'checkmark'}
                  size={16}
                  color="#FFF"
                />
                <Text style={styles.primaryBtnText}>
                  {isConnected ? 'Start Matching' : 'Got it'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 4, 10, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#161424',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#26223B',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1F1B2E',
    borderWidth: 1,
    borderColor: '#363252',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircleConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  iconCircleBlocked: {
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
    borderColor: 'rgba(254, 60, 114, 0.3)',
  },
  iconCircleDisabled: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  iconCircleNotice: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
    marginBottom: 2,
  },
  cityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  cityText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    color: '#8E8DA3',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 22,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FE3C72',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnConnected: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  checkAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  checkAgainText: {
    color: '#10B981',
    fontSize: 12.5,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: '#8E8DA3',
    fontSize: 12.5,
    fontWeight: '600',
  },
});
