// src/screens/AuthScreen.js — World-Class Ambient Animated Authentication & Registration Screen
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
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');

const DOMAIN_SUGGESTIONS = ['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com'];
const PLATFORM_OPTIONS = [
  { id: 'tinder', label: 'Tinder', icon: 'flame', color: '#FD297B' },
  { id: 'bumble', label: 'Bumble', icon: 'sparkles', color: '#FFCB37' },
  { id: 'hinge', label: 'Hinge', icon: 'heart', color: '#8E8DA3' },
];

export default function AuthScreen({ navigation, route }) {
  // ── Mode: 'login' | 'signup' ──
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  
  // ── Step: 'form' | 'otp' ──
  const [step, setStep] = useState('form');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('tinder');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  
  // States
  const [focusedField, setFocusedField] = useState(null); // 'name' | 'email' | null
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [countdown, setCountdown] = useState(45);
  const [resendActive, setResendActive] = useState(false);

  // ── Animation References ──
  const orbScale1 = useRef(new Animated.Value(1)).current;
  const orbScale2 = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.6)).current;

  const contentFade = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const modeSlide = useRef(new Animated.Value(0)).current; // 0: login, 1: signup

  const otpInputs = useRef([]);

  // ── Ambient Background Breathing Glow Animation ──
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale1, {
          toValue: 1.25,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbScale1, {
          toValue: 1,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orbScale2, {
          toValue: 1.3,
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbScale2, {
          toValue: 1,
          duration: 5500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -6,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.parallel([
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlide, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Mode Switch Animation ──
  const switchAuthMode = (mode) => {
    Keyboard.dismiss();
    setErrorMessage('');
    setSuccessNotice('');
    setAuthMode(mode);
    Animated.spring(modeSlide, {
      toValue: mode === 'login' ? 0 : 1,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start();
  };

  // ── Countdown Timer for OTP Resend ──
  useEffect(() => {
    let timer;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setResendActive(true);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // ── Validation Helpers ──
  const isValidEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // ── Domain Chip Tap Handler ──
  const handleSelectDomain = (domain) => {
    let base = email.trim();
    if (base.includes('@')) {
      base = base.split('@')[0];
    }
    if (!base) base = 'user';
    setEmail(`${base}${domain}`.toLowerCase());
    setErrorMessage('');
  };

  // ── Submit Form (Login / Signup) ──
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

    setTimeout(() => {
      setIsLoading(false);
      setStep('otp');
      setCountdown(45);
      setResendActive(false);
      setSuccessNotice(
        authMode === 'signup'
          ? `Welcome ${name.trim()}! Security code sent to ${cleanEmail}`
          : `Security code sent to ${cleanEmail}`
      );
      setTimeout(() => otpInputs.current[0]?.focus(), 150);
    }, 700);
  };

  // ── OTP Input with Full Paste Support ──
  const handleOtpChange = (text, index) => {
    setErrorMessage('');
    setSuccessNotice('');

    // Handle full 6-digit paste
    if (text && text.length > 1) {
      const cleanDigits = text.replace(/[^0-9]/g, '').slice(0, 6);
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < cleanDigits.length; i++) {
        newOtp[i] = cleanDigits[i];
      }
      setOtp(newOtp);
      if (cleanDigits.length === 6) {
        otpInputs.current[5]?.focus();
        verifyOtp(cleanDigits);
      } else {
        const nextIdx = Math.min(cleanDigits.length, 5);
        otpInputs.current[nextIdx]?.focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    if (text && index === 5 && newOtp.every((d) => d.length === 1)) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        otpInputs.current[index - 1]?.focus();
      }
    }
  };

  // ── Verify OTP & Enter Main Screen ──
  const verifyOtp = async (code) => {
    Keyboard.dismiss();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigation.replace('PlatformSelect');
    }, 850);
  };

  // ── Resend Code ──
  const handleResendCode = () => {
    if (!resendActive) return;
    setCountdown(45);
    setResendActive(false);
    setErrorMessage('');
    setSuccessNotice('A fresh verification code has been dispatched!');
  };

  // ── Back to Form ──
  const handleBackToForm = () => {
    setStep('form');
    setOtp(['', '', '', '', '', '']);
    setErrorMessage('');
    setSuccessNotice('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#08070D" />

      {/* ─── Ambient Pulsing Glowing Orbs ─── */}
      <View style={styles.ambientGlowContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.glowOrbPink,
            {
              transform: [{ scale: orbScale1 }],
              opacity: orbOpacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.glowOrbPurple,
            {
              transform: [{ scale: orbScale2 }],
              opacity: orbOpacity,
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.contentWrap,
                {
                  opacity: contentFade,
                  transform: [{ translateY: contentSlide }],
                },
              ]}
            >
              {/* ─── Hero Header & Floating Logo ─── */}
              <View style={styles.heroSection}>
                <Animated.View
                  style={[
                    styles.logoBadgeWrap,
                    { transform: [{ translateY: logoFloat }] },
                  ]}
                >
                  <View style={styles.logoGlowRing} />
                  <Image source={LOGO_IMG} style={styles.logoImage} resizeMode="contain" />
                </Animated.View>

                <Text style={styles.appTitle}>FlirtEasy</Text>
                <View style={styles.taglinePill}>
                  <Ionicons name="sparkles" size={12} color="#FE3C72" />
                  <Text style={styles.taglineText}>AI DATING COPILOT</Text>
                </View>

                <Text style={styles.headline}>
                  {step === 'otp'
                    ? 'Verify Security Code'
                    : authMode === 'signup'
                    ? 'Create Your Account'
                    : 'Welcome Back'}
                </Text>
                <Text style={styles.subHeadline}>
                  {step === 'otp'
                    ? `Enter the 6-digit verification code sent to\n${email}`
                    : authMode === 'signup'
                    ? 'Start getting 3x more matches and personalized AI conversations today.'
                    : 'Sign in to access your automated matches, chats, and live telemetry.'}
                </Text>
              </View>

              {/* ─── Form Card ─── */}
              <Animated.View
                style={[
                  styles.glassCard,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {step === 'form' ? (
                  <>
                    {/* ── Mode Segment Control (Log In vs Create Account) ── */}
                    <View style={styles.modeSegmentContainer}>
                      <TouchableOpacity
                        style={[
                          styles.modeSegmentBtn,
                          authMode === 'login' && styles.modeSegmentBtnActive,
                        ]}
                        onPress={() => switchAuthMode('login')}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.modeSegmentText,
                            authMode === 'login' && styles.modeSegmentTextActive,
                          ]}
                        >
                          Sign In
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modeSegmentBtn,
                          authMode === 'signup' && styles.modeSegmentBtnActive,
                        ]}
                        onPress={() => switchAuthMode('signup')}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.modeSegmentText,
                            authMode === 'signup' && styles.modeSegmentTextActive,
                          ]}
                        >
                          Create Account
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* ── Sign Up: Name Field ── */}
                    {authMode === 'signup' && (
                      <View style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>YOUR NAME / NICKNAME</Text>
                        <View
                          style={[
                            styles.inputContainer,
                            focusedField === 'name' && styles.inputContainerFocused,
                          ]}
                        >
                          <Ionicons
                            name={focusedField === 'name' ? 'person' : 'person-outline'}
                            size={18}
                            color={focusedField === 'name' ? '#FE3C72' : '#8E8DA3'}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            style={styles.textInput}
                            placeholder="e.g. Alex"
                            placeholderTextColor="#5A586E"
                            value={name}
                            onChangeText={(text) => {
                              setName(text);
                              if (errorMessage) setErrorMessage('');
                            }}
                            onFocus={() => setFocusedField('name')}
                            onBlur={() => setFocusedField(null)}
                            autoCapitalize="words"
                            autoCorrect={false}
                            returnKeyType="next"
                          />
                          {Boolean(name.trim()) && (
                            <View style={styles.validBadge}>
                              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* ── Email Field ── */}
                    <View style={styles.fieldBlock}>
                      <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                      <View
                        style={[
                          styles.inputContainer,
                          focusedField === 'email' && styles.inputContainerFocused,
                          Boolean(errorMessage) && styles.inputContainerError,
                        ]}
                      >
                        <Ionicons
                          name={focusedField === 'email' ? 'mail' : 'mail-outline'}
                          size={18}
                          color={focusedField === 'email' ? '#FE3C72' : '#8E8DA3'}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.textInput}
                          placeholder="name@example.com"
                          placeholderTextColor="#5A586E"
                          value={email}
                          onChangeText={(text) => {
                            setEmail(text.toLowerCase());
                            if (errorMessage) setErrorMessage('');
                          }}
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
                            onPress={() => {
                              setEmail('');
                              setErrorMessage('');
                            }}
                            style={styles.clearBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close-circle" size={16} color="#716E89" />
                          </TouchableOpacity>
                        )}

                        {isValidEmail(email) && (
                          <View style={styles.validBadge}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Error Message */}
                    {Boolean(errorMessage) && (
                      <View style={styles.errorRow}>
                        <Ionicons name="alert-circle" size={14} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                      </View>
                    )}

                    {/* Smart Domain Quick-Picker Chips */}
                    <View style={styles.domainChipsWrap}>
                      <Text style={styles.domainChipsTitle}>Quick Domain:</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.domainChipsScroll}
                      >
                        {DOMAIN_SUGGESTIONS.map((domain) => (
                          <TouchableOpacity
                            key={domain}
                            style={styles.domainChip}
                            onPress={() => handleSelectDomain(domain)}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.domainChipText}>{domain}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    {/* ── Sign Up: Platform Preference ── */}
                    {authMode === 'signup' && (
                      <View style={styles.platformPrefBlock}>
                        <Text style={styles.fieldLabel}>PRIMARY DATING APP</Text>
                        <View style={styles.platformOptionsRow}>
                          {PLATFORM_OPTIONS.map((plat) => {
                            const isSelected = selectedPlatform === plat.id;
                            return (
                              <TouchableOpacity
                                key={plat.id}
                                style={[
                                  styles.platformOptionChip,
                                  isSelected && styles.platformOptionChipSelected,
                                ]}
                                onPress={() => setSelectedPlatform(plat.id)}
                                activeOpacity={0.8}
                              >
                                <Ionicons
                                  name={plat.icon}
                                  size={14}
                                  color={isSelected ? '#FE3C72' : '#8E8DA3'}
                                />
                                <Text
                                  style={[
                                    styles.platformOptionLabel,
                                    isSelected && styles.platformOptionLabelSelected,
                                  ]}
                                >
                                  {plat.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Primary CTA Button */}
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={handleFormSubmit}
                      disabled={isLoading}
                      activeOpacity={0.88}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>
                            {authMode === 'signup'
                              ? 'Create Free Account'
                              : 'Continue with Email'}
                          </Text>
                          <Ionicons name="arrow-forward" size={16} color="#FFF" />
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Switch Mode Footer Toggle */}
                    <View style={styles.switchModeRow}>
                      <Text style={styles.switchModeText}>
                        {authMode === 'signup'
                          ? 'Already have an account?'
                          : 'New to FlirtEasy?'}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          switchAuthMode(authMode === 'signup' ? 'login' : 'signup')
                        }
                        activeOpacity={0.8}
                      >
                        <Text style={styles.switchModeLink}>
                          {authMode === 'signup' ? 'Sign In' : 'Create Account'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* ═══════════ STEP 2: 6-DIGIT OTP VERIFICATION ═══════════ */
                  <View style={styles.formStep}>
                    <View style={styles.otpHeaderRow}>
                      <Text style={styles.fieldLabel}>ENTER 6-DIGIT CODE</Text>
                      <TouchableOpacity onPress={handleBackToForm} activeOpacity={0.7}>
                        <Text style={styles.editEmailText}>Change Email</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Success Notice */}
                    {Boolean(successNotice) && (
                      <View style={styles.successRow}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Text style={styles.successText}>{successNotice}</Text>
                      </View>
                    )}

                    {/* 6 Digit Cells */}
                    <View style={styles.otpCellsRow}>
                      {otp.map((digit, idx) => (
                        <TextInput
                          key={idx}
                          ref={(ref) => (otpInputs.current[idx] = ref)}
                          style={[
                            styles.otpCell,
                            digit ? styles.otpCellFilled : null,
                          ]}
                          value={digit}
                          onChangeText={(text) => handleOtpChange(text, idx)}
                          onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                          keyboardType="number-pad"
                          maxLength={6}
                          selectTextOnFocus
                        />
                      ))}
                    </View>

                    {/* Error Message */}
                    {Boolean(errorMessage) && (
                      <View style={styles.errorRow}>
                        <Ionicons name="alert-circle" size={14} color="#EF4444" />
                        <Text style={styles.errorText}>{errorMessage}</Text>
                      </View>
                    )}

                    {/* Resend Code Section */}
                    <View style={styles.resendRow}>
                      <Text style={styles.resendInfoText}>Didn't receive a code?</Text>
                      <TouchableOpacity
                        onPress={handleResendCode}
                        disabled={!resendActive}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.resendBtnText,
                            resendActive && styles.resendBtnTextActive,
                          ]}
                        >
                          {resendActive ? 'Resend Code' : `Resend in ${countdown}s`}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Verify CTA Button */}
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => verifyOtp(otp.join(''))}
                      disabled={isLoading || otp.some((d) => !d)}
                      activeOpacity={0.88}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>Verify & Launch Cockpit</Text>
                          <Ionicons name="checkmark-circle-outline" size={17} color="#FFF" />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* ─── Divider ─── */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR EXPLORE</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* ─── Alternative Quick Actions ─── */}
                <View style={styles.socialOptionsRow}>
                  <TouchableOpacity
                    style={styles.secondarySocialBtn}
                    onPress={() => navigation.replace('PlatformSelect')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="speedometer-outline" size={17} color="#FE3C72" />
                    <Text style={styles.secondarySocialBtnText}>Direct Cockpit Peek</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondarySocialBtn}
                    onPress={() => {
                      navigation.navigate('Browser', {
                        platform: 'Tinder',
                        vpsUrl: 'https://stream.smartmaheshwari.com/?usr=User&pwd=admin',
                        proxyIp: '',
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="logo-google" size={16} color="#4285F4" />
                    <Text style={styles.secondarySocialBtnText}>Tinder Web Sign-In</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* ─── Security & Privacy Footer ─── */}
              <View style={styles.footerWrap}>
                <View style={styles.securityPill}>
                  <Ionicons name="lock-closed" size={12} color="#10B981" />
                  <Text style={styles.securityPillText}>256-Bit Encrypted Automation Tunnel</Text>
                </View>

                <Text style={styles.termsText}>
                  By continuing, you agree to FlirtEasy's{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08070D',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  // ── Ambient Background Glows ──
  ambientGlowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glowOrbPink: {
    position: 'absolute',
    top: -SCREEN_WIDTH * 0.35,
    right: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_WIDTH * 0.95,
    borderRadius: SCREEN_WIDTH * 0.475,
    backgroundColor: 'rgba(254, 60, 114, 0.18)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 100,
  },
  glowOrbPurple: {
    position: 'absolute',
    bottom: -SCREEN_WIDTH * 0.3,
    left: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    backgroundColor: 'rgba(121, 40, 202, 0.15)',
    shadowColor: '#7928CA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 110,
  },

  // ── Hero Section ──
  contentWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadgeWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#161324',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  logoGlowRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.15)',
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  taglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(254, 60, 114, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.28)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginTop: 6,
    marginBottom: 14,
  },
  taglineText: {
    color: '#FE3C72',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  subHeadline: {
    color: '#8E8DA3',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  // ── Glass Form Card ──
  glassCard: {
    backgroundColor: '#12101C',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 10,
  },

  // ── Mode Segment Controller ──
  modeSegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#191629',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modeSegmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  modeSegmentBtnActive: {
    backgroundColor: '#26223B',
    borderWidth: 1,
    borderColor: 'rgba(254, 60, 114, 0.35)',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modeSegmentText: {
    color: '#8E8DA3',
    fontSize: 13,
    fontWeight: '700',
  },
  modeSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ── Form Fields ──
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#8E8DA3',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181528',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    height: 50,
    paddingHorizontal: 14,
  },
  inputContainerFocused: {
    borderColor: '#FE3C72',
    backgroundColor: '#1C182F',
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 4,
    marginRight: 4,
  },
  validBadge: {
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
    marginLeft: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
    marginLeft: 2,
  },
  successText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Domain Suggestions ──
  domainChipsWrap: {
    marginBottom: 14,
  },
  domainChipsTitle: {
    color: '#716E89',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 5,
  },
  domainChipsScroll: {
    gap: 7,
  },
  domainChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  domainChipText: {
    color: '#D8D6E8',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Sign Up: Platform Selector ──
  platformPrefBlock: {
    marginBottom: 16,
  },
  platformOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  platformOptionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#181528',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 9,
  },
  platformOptionChipSelected: {
    borderColor: '#FE3C72',
    backgroundColor: 'rgba(254, 60, 114, 0.12)',
  },
  platformOptionLabel: {
    color: '#8E8DA3',
    fontSize: 12,
    fontWeight: '700',
  },
  platformOptionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ── Primary Action Button ──
  primaryButton: {
    height: 52,
    backgroundColor: '#FE3C72',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FE3C72',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // ── Switch Mode Toggle Link ──
  switchModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  switchModeText: {
    color: '#8E8DA3',
    fontSize: 12.5,
  },
  switchModeLink: {
    color: '#FE3C72',
    fontSize: 12.5,
    fontWeight: '800',
  },

  // ── Form Step 2: OTP Cells ──
  formStep: {
    width: '100%',
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editEmailText: {
    color: '#FE3C72',
    fontSize: 11.5,
    fontWeight: '700',
  },
  otpCellsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  otpCell: {
    flex: 1,
    height: 54,
    backgroundColor: '#181528',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  otpCellFilled: {
    borderColor: '#FE3C72',
    backgroundColor: '#1E1933',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  resendInfoText: {
    color: '#8E8DA3',
    fontSize: 12,
  },
  resendBtnText: {
    color: '#716E89',
    fontSize: 12,
    fontWeight: '700',
  },
  resendBtnTextActive: {
    color: '#FE3C72',
  },

  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  dividerText: {
    color: '#636077',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // ── Secondary Social Options ──
  socialOptionsRow: {
    gap: 9,
  },
  secondarySocialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    height: 44,
  },
  secondarySocialBtnText: {
    color: '#D8D6E8',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Footer ──
  footerWrap: {
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.22)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  securityPillText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  termsText: {
    color: '#636077',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  termsLink: {
    color: '#8E8DA3',
    textDecorationLine: 'underline',
  },
});
