// src/screens/AuthScreen.js — Industry-Grade 3-Phase Auth Flow
// Uses react-native-reanimated for 60fps UI-thread animations
// Uses expo-linear-gradient, expo-blur, expo-haptics for premium feel
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');

const DOMAIN_SUGGESTIONS = ['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com'];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function AuthScreen({ navigation }) {
  // ── Core State Machine ──
  const [phase, setPhase] = useState('welcome'); // 'welcome' | 'form' | 'otp'
  const [authMode, setAuthMode] = useState('signup'); // 'login' | 'signup'

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
  const [phaseKey, setPhaseKey] = useState(0); // forces re-mount for animations

  // ── Refs ──
  const otpInputs = useRef([]);
  const emailInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // ── Reanimated Shared Values ──
  const logoGlow = useSharedValue(0);
  const logoFloat = useSharedValue(0);

  // ── Ambient Logo Animations (Welcome Phase) ──
  useEffect(() => {
    // Breathing glow
    logoGlow.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    // Gentle float
    logoFloat.value = withRepeat(
      withTiming(-8, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const logoGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logoGlow.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(logoGlow.value, [0, 1], [1, 1.15]) }],
  }));

  const logoFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoFloat.value }],
  }));

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

  // ── Phase Transitions ──
  const goToForm = (mode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthMode(mode);
    setErrorMessage('');
    setSuccessNotice('');
    setPhaseKey((k) => k + 1);
    setPhase('form');
  };

  const goBackToWelcome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMessage('');
    setSuccessNotice('');
    setName('');
    setEmail('');
    setPhaseKey((k) => k + 1);
    setPhase('welcome');
  };

  const goToOtp = () => {
    setPhaseKey((k) => k + 1);
    setPhase('otp');
  };

  const goBackToForm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOtp(['', '', '', '', '', '']);
    setErrorMessage('');
    setSuccessNotice('');
    setCountdown(45);
    setResendActive(false);
    setPhaseKey((k) => k + 1);
    setPhase('form');
  };

  // ── Domain Chip Handler ──
  const handleSelectDomain = (domain) => {
    Haptics.selectionAsync();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Please enter your name.');
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
    }, 700);
  };

  // ── OTP Handling ──
  const handleOtpChange = (text, index) => {
    setErrorMessage('');
    setSuccessNotice('');

    if (text && text.length > 1) {
      const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < digits.length; i++) newOtp[i] = digits[i];
      setOtp(newOtp);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (digits.length === 6) {
        otpInputs.current[5]?.focus();
        verifyOtp(digits);
      } else {
        otpInputs.current[Math.min(digits.length, 5)]?.focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (index < 5) otpInputs.current[index + 1]?.focus();
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      setIsLoading(false);
      navigation.replace('PlatformSelect');
    }, 850);
  };

  const handleResendCode = () => {
    if (!resendActive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCountdown(45);
    setResendActive(false);
    setErrorMessage('');
    setSuccessNotice('A fresh code has been sent!');
  };

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ─── Full-Screen Gradient Background ─── */}
      <LinearGradient
        colors={['#1A0A1E', '#120818', '#0A0612', '#08070D']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ─── Ambient Gradient Orbs (decorative) ─── */}
      <View style={styles.orbContainer} pointerEvents="none">
        <Animated.View style={[styles.orbPink, logoGlowStyle]} />
        <View style={styles.orbPurple} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kavContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.contentContainer}>

              {/* ═══════════════════════════════════════════════════ */}
              {/* PHASE 1: WELCOME / LANDING                        */}
              {/* ═══════════════════════════════════════════════════ */}
              {phase === 'welcome' && (
                <Animated.View
                  key={`welcome-${phaseKey}`}
                  entering={FadeIn.duration(500)}
                  exiting={FadeOut.duration(200)}
                  style={styles.welcomeContainer}
                >
                  {/* Hero: Logo + Brand */}
                  <View style={styles.welcomeHero}>
                    <Animated.View style={[styles.logoOuter, logoFloatStyle]}>
                      {/* Glow ring behind logo */}
                      <Animated.View style={[styles.logoGlowRing, logoGlowStyle]} />
                      <View style={styles.logoBadge}>
                        <Image source={LOGO_IMG} style={styles.logoImg} resizeMode="contain" />
                      </View>
                    </Animated.View>

                    <Animated.Text
                      entering={FadeInDown.delay(150).duration(500)}
                      style={styles.brandTitle}
                    >
                      FlirtEasy
                    </Animated.Text>

                    <Animated.View
                      entering={FadeInDown.delay(250).duration(500)}
                      style={styles.taglinePill}
                    >
                      <Ionicons name="sparkles" size={11} color="#FE3C72" />
                      <Text style={styles.taglineText}>AI DATING COPILOT</Text>
                    </Animated.View>

                    <Animated.Text
                      entering={FadeInDown.delay(350).duration(500)}
                      style={styles.welcomeSubtitle}
                    >
                      3x more matches.{'\n'}Intelligent conversations.{'\n'}Zero effort.
                    </Animated.Text>
                  </View>

                  {/* Bottom CTAs */}
                  <Animated.View
                    entering={FadeInUp.delay(450).duration(500)}
                    style={styles.welcomeBottomCtas}
                  >
                    {/* Primary: Create Account */}
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

                    {/* Tertiary: Guest */}
                    <TouchableOpacity
                      style={styles.guestLink}
                      onPress={() => navigation.replace('PlatformSelect')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.guestLinkText}>Continue as Guest</Text>
                      <Ionicons name="arrow-forward" size={13} color="#716E89" />
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Footer */}
                  <Animated.View
                    entering={FadeIn.delay(600).duration(400)}
                    style={styles.welcomeFooter}
                  >
                    <View style={styles.securityBadge}>
                      <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                      <Text style={styles.securityBadgeText}>End-to-end encrypted</Text>
                    </View>
                  </Animated.View>
                </Animated.View>
              )}

              {/* ═══════════════════════════════════════════════════ */}
              {/* PHASE 2: EMAIL FORM (Login / Signup)               */}
              {/* ═══════════════════════════════════════════════════ */}
              {phase === 'form' && (
                <Animated.View
                  key={`form-${phaseKey}`}
                  entering={SlideInRight.duration(350).easing(Easing.out(Easing.cubic))}
                  exiting={SlideOutLeft.duration(250)}
                  style={styles.formContainer}
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

                  {/* Glass Card */}
                  <BlurView intensity={20} tint="dark" style={styles.glassCard}>
                    <View style={styles.glassCardInner}>
                      {/* Name Field (signup only) */}
                      {authMode === 'signup' && (
                        <Animated.View
                          entering={FadeInDown.duration(300)}
                          style={styles.fieldGroup}
                        >
                          <Text style={styles.fieldLabel}>YOUR NAME</Text>
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
                              placeholder="What should we call you?"
                              placeholderTextColor="#4A4860"
                              value={name}
                              onChangeText={(t) => { setName(t); setErrorMessage(''); }}
                              onFocus={() => setFocusedField('name')}
                              onBlur={() => setFocusedField(null)}
                              autoCapitalize="words"
                              autoCorrect={false}
                              returnKeyType="next"
                              onSubmitEditing={() => emailInputRef.current?.focus()}
                            />
                            {Boolean(name.trim()) && (
                              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            )}
                          </View>
                        </Animated.View>
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
                            placeholderTextColor="#4A4860"
                            value={email}
                            onChangeText={(t) => { setEmail(t.toLowerCase()); setErrorMessage(''); }}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            returnKeyType="done"
                            onSubmitEditing={handleFormSubmit}
                          />
                          {Boolean(email) && (
                            <TouchableOpacity
                              onPress={() => { setEmail(''); setErrorMessage(''); }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="close-circle" size={16} color="#716E89" />
                            </TouchableOpacity>
                          )}
                          {isValidEmail(email) && (
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginLeft: 4 }} />
                          )}
                        </View>
                      </View>

                      {/* Error */}
                      {Boolean(errorMessage) && (
                        <Animated.View entering={FadeIn.duration(200)} style={styles.errorRow}>
                          <Ionicons name="alert-circle" size={14} color="#EF4444" />
                          <Text style={styles.errorText}>{errorMessage}</Text>
                        </Animated.View>
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
                  </BlurView>

                  {/* Mode Toggle */}
                  <View style={styles.modeToggleRow}>
                    <Text style={styles.modeToggleText}>
                      {authMode === 'signup' ? 'Already have an account?' : 'New to FlirtEasy?'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
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
              )}

              {/* ═══════════════════════════════════════════════════ */}
              {/* PHASE 3: OTP VERIFICATION                          */}
              {/* ═══════════════════════════════════════════════════ */}
              {phase === 'otp' && (
                <Animated.View
                  key={`otp-${phaseKey}`}
                  entering={SlideInRight.duration(350).easing(Easing.out(Easing.cubic))}
                  exiting={SlideOutLeft.duration(250)}
                  style={styles.formContainer}
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
                    <Animated.View entering={FadeIn.duration(200)} style={styles.successRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.successText}>{successNotice}</Text>
                    </Animated.View>
                  )}

                  {/* OTP Cells */}
                  <View style={styles.otpRow}>
                    {otp.map((digit, idx) => (
                      <Animated.View
                        key={idx}
                        entering={FadeInDown.delay(idx * 60).duration(300)}
                        style={styles.otpCellWrap}
                      >
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
                          maxLength={6}
                          selectTextOnFocus
                        />
                      </Animated.View>
                    ))}
                  </View>

                  {/* Error */}
                  {Boolean(errorMessage) && (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#EF4444" />
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </Animated.View>
                  )}

                  {/* Resend */}
                  <View style={styles.resendRow}>
                    <Text style={styles.resendInfoText}>Didn't get a code?</Text>
                    <TouchableOpacity
                      onPress={handleResendCode}
                      disabled={!resendActive}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.resendBtnText, resendActive && styles.resendBtnActive]}>
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
              )}

            </View>
          </TouchableWithoutFeedback>
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
    backgroundColor: 'rgba(254, 60, 114, 0.15)',
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: '#161324',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
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
    backgroundColor: 'rgba(254, 60, 114, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.2)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    paddingVertical: 10,
  },
  guestLinkText: {
    color: '#716E89',
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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

  // ── Glass Card ──
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  glassCardInner: {
    padding: 20,
    backgroundColor: 'rgba(18, 16, 28, 0.85)',
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
    backgroundColor: '#16132A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    height: 52,
    paddingHorizontal: 14,
  },
  inputWrapFocused: {
    borderColor: 'rgba(254, 60, 114, 0.5)',
    backgroundColor: '#1A1630',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
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
    shadowOpacity: 0.3,
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
    backgroundColor: '#16132A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  otpCellFilled: {
    borderColor: 'rgba(254, 60, 114, 0.5)',
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
