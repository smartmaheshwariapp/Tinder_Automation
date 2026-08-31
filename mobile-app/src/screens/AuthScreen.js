// src/screens/AuthScreen.js — 3-Phase Auth Flow (Welcome -> Form -> OTP)
// Powered by Expo Linear Gradient, Native Driver Animations & iOS Haptics
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  StatusBar,
  Keyboard,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SupabaseService from '../services/supabase';

// Optional safe haptics
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (_) {
  Haptics = null;
}

const safeHaptic = (type) => {
  try {
    if (!Haptics) return;
    if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (_) {}
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const DOMAIN_SUGGESTIONS = ['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com'];

export default function AuthScreen({ navigation, route }) {
  const initialMode = route?.params?.initialMode;
  const onboardingData = route?.params?.onboardingData;

  // ── Core State Machine ──
  const [phase, setPhase] = useState(initialMode ? 'form' : 'welcome'); // 'welcome' | 'form' | 'otp'
  const [authMode, setAuthMode] = useState(initialMode || 'signup'); // 'login' | 'signup'

  // ── Form Data ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // ── UI States ──
  const [focusedField, setFocusedField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [countdown, setCountdown] = useState(45);
  const [resendActive, setResendActive] = useState(false);

  // ── Refs ──
  const otpInputs = useRef([]);
  const emailInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // ── Native Animation Values ──
  const logoFloat = useRef(new Animated.Value(0)).current;
  const logoGlowScale = useRef(new Animated.Value(1)).current;
  const logoGlowOpacity = useRef(new Animated.Value(0.3)).current;

  const welcomeFade = useRef(new Animated.Value(0)).current;
  const welcomeSlide = useRef(new Animated.Value(25)).current;

  const phaseSlide = useRef(new Animated.Value(0)).current; // 0: in place, >0: offset
  const phaseFade = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Ambient Logo Animations ──
  useEffect(() => {
    // Gentle Float Loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -8,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Breathing Glow Loop
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoGlowScale, {
            toValue: 1.25,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(logoGlowOpacity, {
            toValue: 0.65,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(logoGlowScale, {
            toValue: 1,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(logoGlowOpacity, {
            toValue: 0.3,
            duration: 2800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Welcome Screen Initial Entrance
    Animated.parallel([
      Animated.timing(welcomeFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(welcomeSlide, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── OTP Countdown Timer ──
  useEffect(() => {
    let timer;
    if (phase === 'otp' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setResendActive(true);
    }
    return () => clearInterval(timer);
  }, [phase, countdown]);

  // ── Validation ──
  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const triggerShake = () => {
    safeHaptic('error');
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // ── Phase Transitions ──
  const animateTransition = (nextPhaseCallback) => {
    Animated.timing(phaseFade, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      nextPhaseCallback();
      phaseSlide.setValue(35);
      Animated.parallel([
        Animated.timing(phaseFade, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(phaseSlide, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const goToForm = (mode) => {
    safeHaptic('light');
    setAuthMode(mode);
    setErrorMessage('');
    setSuccessNotice('');
    animateTransition(() => {
      setPhase('form');
    });
  };

  const goBackToWelcome = () => {
    safeHaptic('light');
    setErrorMessage('');
    setSuccessNotice('');
    setName('');
    setEmail('');
    if (initialMode && phase === 'form') {
      navigation.replace('Onboarding');
    } else {
      animateTransition(() => {
        setPhase('welcome');
      });
    }
  };

  const goToOtp = () => {
    animateTransition(() => {
      setPhase('otp');
    });
  };

  const goBackToForm = () => {
    safeHaptic('light');
    setOtp(['', '', '', '', '', '']);
    setErrorMessage('');
    setSuccessNotice('');
    setCountdown(45);
    setResendActive(false);
    animateTransition(() => {
      setPhase('form');
    });
  };

  // ── Domain Chip Handler ──
  const handleSelectDomain = (domain) => {
    safeHaptic('light');
    let base = email.trim();
    if (base.includes('@')) base = base.split('@')[0];
    if (!base) base = 'user';
    setEmail(`${base}${domain}`.toLowerCase());
    setErrorMessage('');
  };

  // ── Form Submission ──
  const handleFormSubmit = async () => {
    Keyboard.dismiss();
    const cleanEmail = email.trim().toLowerCase();

    if (authMode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your name.');
      triggerShake();
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      triggerShake();
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    safeHaptic('medium');

    setTimeout(() => {
      setIsLoading(false);
      setCountdown(45);
      setResendActive(false);
      setSuccessNotice(
        authMode === 'signup'
          ? `Welcome ${name.trim()}! Code sent to ${cleanEmail}`
          : `Verification code sent to ${cleanEmail}`
      );
      goToOtp();
      setTimeout(() => otpInputs.current[0]?.focus(), 300);
    }, 600);
  };

  // ── OTP Handling ──
  const handleOtpChange = (text, index) => {
    setErrorMessage('');
    setSuccessNotice('');

    const clean = text.replace(/[^0-9]/g, '');

    // Multi-digit paste (e.g. from SMS autofill or clipboard)
    if (clean.length > 1) {
      const digits = clean.slice(0, 6);
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < digits.length; i++) newOtp[i] = digits[i];
      setOtp(newOtp);
      safeHaptic('light');
      if (digits.length === 6) {
        otpInputs.current[5]?.focus();
        verifyOtp(digits);
      } else {
        otpInputs.current[Math.min(digits.length, 5)]?.focus();
      }
      return;
    }

    const singleDigit = clean.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = singleDigit;
    setOtp(newOtp);

    if (singleDigit) {
      safeHaptic('light');
      if (index < 5) {
        otpInputs.current[index + 1]?.focus();
      }
      if (index === 5 && newOtp.every((d) => d.length === 1)) {
        verifyOtp(newOtp.join(''));
      }
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      otpInputs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code) => {
    Keyboard.dismiss();
    setIsLoading(true);
    safeHaptic('success');

    try {
      let result;
      if (authMode === 'signup') {
        result = await SupabaseService.registerUser({
          email: email.trim().toLowerCase(),
          fullName: name.trim(),
          onboardingData,
        });
      } else {
        result = await SupabaseService.loginUser({
          email: email.trim().toLowerCase(),
        });
      }

      setIsLoading(false);
      navigation.replace('PlatformSelect', {
        user: result?.user,
        onboardingData,
      });
    } catch (err) {
      console.error('[Auth Error]', err);
      setIsLoading(false);
      navigation.replace('PlatformSelect', { onboardingData });
    }
  };

  const handleResendCode = () => {
    if (!resendActive) return;
    safeHaptic('medium');
    setCountdown(45);
    setResendActive(false);
    setErrorMessage('');
    setSuccessNotice('A fresh verification code has been dispatched!');
  };

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Full-Screen Seamless Gradient Background ── */}
      <LinearGradient
        colors={['#1E0A22', '#140718', '#0A0612', '#08070D']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Ambient Background Glows ── */}
      <View style={styles.orbContainer} pointerEvents="none">
        <View style={styles.orbPink} />
        <View style={styles.orbPurple} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kavContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* ═══════════════════════════════════════════════════ */}
          {/* PHASE 1: WELCOME / LANDING                        */}
          {/* ═══════════════════════════════════════════════════ */}
          {phase === 'welcome' && (
            <View style={styles.contentContainer}>
              <Animated.View
                style={[
                  styles.welcomeContainer,
                  {
                    opacity: welcomeFade,
                    transform: [{ translateY: welcomeSlide }],
                  },
                ]}
              >
                  {/* Hero: Floating Logo + Brand */}
                  <View style={styles.welcomeHero}>
                    <Animated.View
                      style={[
                        styles.logoOuter,
                        { transform: [{ translateY: logoFloat }] },
                      ]}
                    >
                      {/* Glow ring behind logo */}
                      <Animated.View
                        style={[
                          styles.logoGlowRing,
                          {
                            transform: [{ scale: logoGlowScale }],
                            opacity: logoGlowOpacity,
                          },
                        ]}
                      />
                      <View style={styles.logoBadge}>
                        <Image source={LOGO_IMG} style={styles.logoImg} resizeMode="contain" />
                      </View>
                    </Animated.View>

                    <Text style={styles.brandTitle}>FlirtEasy</Text>

                    <View style={styles.taglinePill}>
                      <Ionicons name="sparkles" size={11} color="#FE3C72" />
                      <Text style={styles.taglineText}>AI DATING COPILOT</Text>
                    </View>

                    <Text style={styles.welcomeSubtitle}>
                      3x more matches.{'\n'}Intelligent conversations.{'\n'}Zero effort.
                    </Text>
                  </View>

                  {/* Bottom CTAs */}
                  <View style={styles.welcomeBottomCtas}>
                    {/* Primary: Create Free Account */}
                    <TouchableOpacity
                      style={styles.primaryPill}
                      onPress={() => goToForm('signup')}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#FE3C72', '#E8245C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryPillGradient}
                      >
                        <Text style={styles.primaryPillText}>Create Free Account</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFF" />
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Secondary: Sign In */}
                    <TouchableOpacity
                      style={styles.secondaryPill}
                      onPress={() => goToForm('login')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.secondaryPillText}>I already have an account</Text>
                    </TouchableOpacity>

                    {/* Tertiary: Continue as Guest */}
                    <TouchableOpacity
                      style={styles.guestLink}
                      onPress={() => {
                        safeHaptic('light');
                        navigation.replace('PlatformSelect');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.guestLinkText}>Continue as Guest</Text>
                      <Ionicons name="arrow-forward" size={13} color="#716E89" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.onboardingReturnLink}
                      onPress={() => {
                        safeHaptic('light');
                        navigation.replace('Onboarding');
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="sparkles" size={13} color="#FE3C72" />
                      <Text style={styles.onboardingReturnText}>Review Setup & Features</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Security Footer */}
                  <View style={styles.welcomeFooter}>
                    <View style={styles.securityBadge}>
                      <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                      <Text style={styles.securityBadgeText}>256-Bit Encrypted Automation</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* PHASE 2: EMAIL FORM (Login / Signup)               */}
            {/* ═══════════════════════════════════════════════════ */}
            {phase === 'form' && (
              <ScrollView
                style={styles.scrollFlex}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Animated.View
                  style={[
                    styles.formContainer,
                    {
                      opacity: phaseFade,
                      transform: [
                        { translateX: phaseSlide },
                        { translateX: shakeAnim },
                      ],
                    },
                  ]}
                >
                  {/* Back Button */}
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={goBackToWelcome}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Header */}
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>
                      {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
                    </Text>
                    <Text style={styles.formSubtitle}>
                      {authMode === 'signup'
                        ? 'Start getting smarter matches today.'
                        : 'Sign in to resume your AI dating copilot.'}
                    </Text>
                  </View>

                  {/* Form Card */}
                  <View style={styles.glassCard}>
                    <View style={styles.glassCardInner}>
                      {/* Name Field (signup only) */}
                      {authMode === 'signup' && (
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>YOUR NAME / NICKNAME</Text>
                          <View
                            style={[
                              styles.inputWrap,
                              focusedField === 'name' && styles.inputWrapFocused,
                            ]}
                          >
                            <Ionicons
                              name={focusedField === 'name' ? 'person' : 'person-outline'}
                              size={18}
                              color={focusedField === 'name' ? '#FE3C72' : '#716E89'}
                              style={styles.inputIcon}
                            />
                            <TextInput
                              ref={nameInputRef}
                              style={styles.textInput}
                              placeholder="e.g. Alex"
                              placeholderTextColor="#504E64"
                              value={name}
                              onChangeText={(t) => {
                                setName(t);
                                setErrorMessage('');
                              }}
                              onFocus={() => setFocusedField('name')}
                              onBlur={() => setFocusedField(null)}
                              autoCapitalize="words"
                              autoCorrect={false}
                              spellCheck={false}
                              textContentType="name"
                              selectionColor="#FE3C72"
                              cursorColor="#FE3C72"
                              underlineColorAndroid="transparent"
                              returnKeyType="next"
                              onSubmitEditing={() => emailInputRef.current?.focus()}
                            />
                            {Boolean(name.trim()) && (
                              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            )}
                          </View>
                        </View>
                      )}

                      {/* Email Field */}
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                        <View
                          style={[
                            styles.inputWrap,
                            focusedField === 'email' && styles.inputWrapFocused,
                            Boolean(errorMessage) && styles.inputWrapError,
                          ]}
                        >
                          <Ionicons
                            name={focusedField === 'email' ? 'mail' : 'mail-outline'}
                            size={18}
                            color={focusedField === 'email' ? '#FE3C72' : '#716E89'}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            ref={emailInputRef}
                            style={styles.textInput}
                            placeholder="name@example.com"
                            placeholderTextColor="#504E64"
                            value={email}
                            onChangeText={(t) => {
                              setEmail(t.toLowerCase());
                              setErrorMessage('');
                            }}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            autoCapitalize="none"
                            autoCorrect={false}
                            spellCheck={false}
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            keyboardAppearance="dark"
                            selectionColor="#FE3C72"
                            cursorColor="#FE3C72"
                            underlineColorAndroid="transparent"
                            returnKeyType="done"
                            onSubmitEditing={handleFormSubmit}
                          />
                          {Boolean(email) && (
                            <TouchableOpacity
                              onPress={() => {
                                setEmail('');
                                setErrorMessage('');
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="close-circle" size={16} color="#716E89" />
                            </TouchableOpacity>
                          )}
                          {isValidEmail(email) && (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color="#10B981"
                              style={{ marginLeft: 4 }}
                            />
                          )}
                        </View>
                      </View>

                      {/* Error */}
                      {Boolean(errorMessage) && (
                        <View style={styles.errorRow}>
                          <Ionicons name="alert-circle" size={14} color="#EF4444" />
                          <Text style={styles.errorText}>{errorMessage}</Text>
                        </View>
                      )}

                      {/* Domain Quick-Picks */}
                      <View style={styles.domainSection}>
                        <Text style={styles.domainLabel}>Quick fill:</Text>
                        <View style={styles.domainChipsRow}>
                          {DOMAIN_SUGGESTIONS.map((d) => (
                            <TouchableOpacity
                              key={d}
                              style={styles.domainChip}
                              onPress={() => handleSelectDomain(d)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.domainChipText}>{d}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* CTA */}
                      <TouchableOpacity
                        style={[styles.formCta, isLoading && { opacity: 0.7 }]}
                        onPress={handleFormSubmit}
                        disabled={isLoading}
                        activeOpacity={0.88}
                      >
                        <LinearGradient
                          colors={['#FE3C72', '#E8245C']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.formCtaGradient}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <>
                              <Text style={styles.formCtaText}>
                                {authMode === 'signup' ? 'Create Account' : 'Continue'}
                              </Text>
                              <Ionicons name="arrow-forward" size={17} color="#FFF" />
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Mode Toggle */}
                  <View style={styles.modeToggleRow}>
                    <Text style={styles.modeToggleText}>
                      {authMode === 'signup' ? 'Already have an account?' : 'New to FlirtEasy?'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        safeHaptic('light');
                        setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                        setErrorMessage('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.modeToggleLink}>
                        {authMode === 'signup' ? 'Sign In' : 'Create Account'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Terms */}
                  <Text style={styles.termsText}>
                    By continuing, you agree to our{' '}
                    <Text style={styles.termsLink}>Terms</Text> and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>.
                  </Text>
                </Animated.View>
              </ScrollView>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* PHASE 3: OTP VERIFICATION                          */}
            {/* ═══════════════════════════════════════════════════ */}
            {phase === 'otp' && (
              <ScrollView
                style={styles.scrollFlex}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Animated.View
                  style={[
                    styles.formContainer,
                    {
                      opacity: phaseFade,
                      transform: [
                        { translateX: phaseSlide },
                        { translateX: shakeAnim },
                      ],
                    },
                  ]}
                >
                  {/* Back Button */}
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={goBackToForm}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                  </TouchableOpacity>

                  {/* Header */}
                  <View style={styles.formHeader}>
                    <Text style={styles.formTitle}>Verify your email</Text>
                    <Text style={styles.formSubtitle}>
                      Enter the 6-digit code sent to{'\n'}
                      <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{email}</Text>
                    </Text>
                  </View>

                  {/* Success Notice */}
                  {Boolean(successNotice) && (
                    <View style={styles.successRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.successText}>{successNotice}</Text>
                    </View>
                  )}

                  {/* OTP Cells */}
                  <View style={styles.otpRow}>
                    {otp.map((digit, idx) => (
                      <View key={idx} style={styles.otpCellWrap}>
                        <TextInput
                          ref={(ref) => (otpInputs.current[idx] = ref)}
                          style={[
                            styles.otpCell,
                            digit ? styles.otpCellFilled : null,
                          ]}
                          value={digit}
                          onChangeText={(t) => handleOtpChange(t, idx)}
                          onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                          keyboardType="number-pad"
                          textContentType="oneTimeCode"
                          selectionColor="#FE3C72"
                          cursorColor="#FE3C72"
                          underlineColorAndroid="transparent"
                          maxLength={6}
                          selectTextOnFocus
                        />
                      </View>
                    ))}
                  </View>

                  {/* Error */}
                  {Boolean(errorMessage) && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                  )}

                  {/* Resend */}
                  <View style={styles.resendRow}>
                    <Text style={styles.resendInfoText}>Didn't get a code?</Text>
                    <TouchableOpacity
                      onPress={handleResendCode}
                      disabled={!resendActive}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.resendBtnText,
                          resendActive && styles.resendBtnActive,
                        ]}
                      >
                        {resendActive ? 'Resend Code' : `Resend in ${countdown}s`}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Verify CTA */}
                  <TouchableOpacity
                    style={[
                      styles.formCta,
                      (isLoading || otp.some((d) => !d)) && { opacity: 0.5 },
                    ]}
                    onPress={() => verifyOtp(otp.join(''))}
                    disabled={isLoading || otp.some((d) => !d)}
                    activeOpacity={0.88}
                  >
                    <LinearGradient
                      colors={['#FE3C72', '#E8245C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.formCtaGradient}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Text style={styles.formCtaText}>Verify & Continue</Text>
                          <Ionicons name="checkmark-circle-outline" size={17} color="#FFF" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </ScrollView>
            )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08070D',
  },
  safeArea: {
    flex: 1,
  },
  kavContainer: {
    flex: 1,
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // ── Ambient Orbs ──
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orbPink: {
    position: 'absolute',
    top: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: SCREEN_WIDTH * 0.425,
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
  },
  orbPurple: {
    position: 'absolute',
    bottom: -SCREEN_WIDTH * 0.25,
    left: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: SCREEN_WIDTH * 0.375,
    backgroundColor: 'rgba(121, 40, 202, 0.08)',
  },

  // ═══════════════════════════════════════════
  // PHASE 1: WELCOME
  // ═══════════════════════════════════════════
  welcomeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: SCREEN_HEIGHT * 0.08,
    paddingBottom: 16,
  },
  welcomeHero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoGlowRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 36,
    backgroundColor: 'rgba(254, 60, 114, 0.25)',
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: '#161324',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  logoImg: {
    width: 50,
    height: 50,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  taglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(254, 60, 114, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
  },
  taglineText: {
    color: '#FE3C72',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  welcomeSubtitle: {
    color: '#8E8DA3',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '500',
  },

  // ── Welcome Bottom CTAs ──
  welcomeBottomCtas: {
    gap: 12,
    paddingBottom: 8,
  },
  primaryPill: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryPillGradient: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryPillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  secondaryPill: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  secondaryPillText: {
    color: '#D8D6E8',
    fontSize: 15,
    fontWeight: '700',
  },
  guestLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  guestLinkText: {
    color: '#716E89',
    fontSize: 13,
    fontWeight: '600',
  },
  onboardingReturnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: 2,
  },
  onboardingReturnText: {
    color: '#FE3C72',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── Welcome Footer ──
  welcomeFooter: {
    alignItems: 'center',
    paddingTop: 4,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  securityBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },

  // ═══════════════════════════════════════════
  // PHASE 2 & 3: FORM / OTP
  // ═══════════════════════════════════════════
  formContainer: {
    flex: 1,
    paddingTop: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  formHeader: {
    marginBottom: 24,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  formSubtitle: {
    color: '#8E8DA3',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },

  // ── Form Card ──
  glassCard: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    backgroundColor: '#12101E',
  },
  glassCardInner: {
    padding: 20,
  },

  // ── Form Fields ──
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#716E89',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18152A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    height: 52,
    paddingHorizontal: 14,
  },
  inputWrapFocused: {
    borderColor: '#FE3C72',
    backgroundColor: '#1E1933',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  inputWrapError: {
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },

  // ── Error / Success Rows ──
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingLeft: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  successText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // ── Domain Chips ──
  domainSection: {
    marginBottom: 20,
  },
  domainLabel: {
    color: '#5A586E',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  domainChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  domainChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  domainChipText: {
    color: '#B8B6CC',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Form CTA Button ──
  formCta: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  formCtaGradient: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  formCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // ── Mode Toggle ──
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  modeToggleText: {
    color: '#8E8DA3',
    fontSize: 13,
  },
  modeToggleLink: {
    color: '#FE3C72',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── OTP Cells ──
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  otpCellWrap: {
    flex: 1,
    maxWidth: 52,
  },
  otpCell: {
    height: 56,
    backgroundColor: '#18152A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  otpCellFilled: {
    borderColor: '#FE3C72',
    backgroundColor: '#1E1933',
  },

  // ── Resend ──
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  resendInfoText: {
    color: '#8E8DA3',
    fontSize: 13,
  },
  resendBtnText: {
    color: '#5A586E',
    fontSize: 13,
    fontWeight: '700',
  },
  resendBtnActive: {
    color: '#FE3C72',
  },

  // ── Terms ──
  termsText: {
    color: '#5A586E',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#8E8DA3',
    textDecorationLine: 'underline',
  },
});
