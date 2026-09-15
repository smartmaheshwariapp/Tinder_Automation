import { theme as uiTheme } from '../theme';
// src/screens/LoginScreen.js — Upgraded Luxury Dark Dating App Login Screen
// Featuring Cinematic Background Carousel, Luminous Aura Emblem, and Modern Glassmorphic Inputs
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Image, Animated, Easing, Dimensions, Modal, Linking, Pressable } from 'react-native';
import { FocusInput as TextInput, MotionTouchable as TouchableOpacity } from '../components/common/Motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SupabaseService from '../services/supabase';

// Safe haptics
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
  } catch (_) { }
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const DOMAIN_SUGGESTIONS = ['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com'];
const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

const CAROUSEL_SLIDES = [
  {
    id: 1,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1UQF7nuVsJrj7KpkUrmzC8VTGKdJ2F387zoU1Kco0j3dMJQmPB_ZLISug8HKEN508gw0o7BAqnmW2F8FYI1iFikv8H0YK-UAgI4t_-Wepw4aJ2ErN93wtMScV9UT1xjE4NV-0WwnH83lBjmxhH9on6Kr_ACNXIgokmYxHTnhfJxsIQDS7yBxCfCNYsBqO3zHs_U_cubDrgiDHw11_1oG8FgvUNYAfBtvRicSSvQTOFl7psgaJN0WhcCwPE',
  },
  {
    id: 2,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1XpM7Egn0IVGD31arq7EDXU6Twg8PigdvrkDrzN2JLIV64N8W1p3UE8_0jSOGMZvNBMi-uCkjjSneTHu_sJwS4qB43Qn7HujFnL9E08pWCJkDZvEl8mvX1FEXBN7zzSHmSz-qxfvim8td2mHrGvp56Lar-lWTokOdrkY-Q3fjTFV2gk7BqvPfYphOGkGyx51eCs01_M8OI-GjfEdxCnGEeGRfQdvgEV8Z6S9XW0lf1rPOBDrU0UednF1tI',
  },
  {
    id: 3,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1VJHRE0UlMXcAkRuNShuUaIDhqZNyB_nNIBgQ_hGxXFJSNA6EktIpv4oLXYw5V1_P_xdNdngtYWuBGMq7vr1tNTrjCohlE0F2V7AsX_Q2RUptEUDmM_idtiUiyUFjOjwBxOIdP8XgZxlY6Q1o3Ujsh0RT_Xz8ZzC_o_O8Lje2UMDGJic9YrliajndoytAGUWcA6-uONxJoDEwX6Hmn1KQmleLu4hhG_yGYOG6bN9L_3_JtUqOpyKNUcfus',
  },
  {
    id: 4,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1Vd18bzuNfxDzp94-ccsJbSjIyAgzW_kRXkLlPAdEZHBcJ760YeI-mk3fnyfjPSgdcUjUDvy4dYRxKycb5nEdzXIKwyUEZP-XmKwhjlfFmBgC5VKqXcjrceNAhSdWanrHodFzl7FcdAJMgaAwhgehOvM1z7TFtE7Zr3uWCuye3C1ggAQEVtCVzrIp59HlA9EHKmxFOCPP5MKP4FZIxgkhWvWv4x-Nn5FUfkE_xQYwBa-ahRuwCmemmLIAs',
  },
  {
    id: 5,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1XzZXfDkDX3G4CRUt45dCNmL6JeiUA0yO7gcZigP0r5z2vSL_FewBLkb7Eo4z7SNqoJ2wRmw1-hqI1NiqOYlNPHaxgA2z8AiJYVv_vjnOAHMNCbWSkAdsKA8t-rVxDdaMy4XkfAAfFGFjAeax5ssYTk4aPu_g0ywQOM4aDZTI4OB-ocwDxeMM7SMUvysppZnztNrN2DqJxQ4hQybClfUnsiyreA-JVZFFcH_obb7yrN6pjClMBLyGWorA',
  },
  {
    id: 6,
    uri: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1287&auto=format&fit=crop',
  },
];

const FLINT_EMBLEM_URI =
  'https://lh3.googleusercontent.com/aida/AEtjO1XBLBCvT6YG6NjEQtmsjtWA5j_uCps04hYP22UuacAxVsDbTJ-8aEt7FTCHe54G4532OO4W9mUziOo89_l3f1s4bw-AKSf13KLGKYwV1JM7egtBa0zRtTlt6WR24SfQmVAI4KU4-pfv8GOxG7PNQAIU6vvTe82hpcB8hAGX_4vQVn3Yns7nE5T3vr7KmRLK5K2FWS_pPKMg3gmSBbNJvIWyqdTTRyPdOnrkGYitlXO70H45WmmZI8svYw';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);

  // ── Legal & Support In-App Sheet States (App Store & HIG Compliance) ──
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalTab, setLegalTab] = useState('terms'); // 'terms' | 'privacy'
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [agreementError, setAgreementError] = useState(false);
  const [accountConflict, setAccountConflict] = useState(null); // 'exists' | 'not_found' | null
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const openLegalModal = (tab = 'terms') => {
    safeHaptic('light');
    setLegalTab(tab);
    setLegalModalVisible(true);
  };

  // Animations
  const logoGlowScale = useRef(new Animated.Value(1)).current;
  const logoGlowOpacity = useRef(new Animated.Value(0.4)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Zero-glitch carousel animation values (6 slides)
  const slideOpacities = useRef(
    CAROUSEL_SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  const slideScales = useRef(
    CAROUSEL_SLIDES.map(() => new Animated.Value(1.0))
  ).current;

  const [zIndices, setZIndices] = useState([10, 1, 1, 1, 1, 1]);
  const zCounterRef = useRef(10);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    // 1. Pre-cache all 6 images immediately
    CAROUSEL_SLIDES.forEach((slide) => {
      if (slide.uri && slide.uri.startsWith('http')) {
        Image.prefetch(slide.uri).catch(() => { });
      }
    });

    // 2. Emblem breathing glow
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoGlowScale, { toValue: 1.15, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(logoGlowOpacity, { toValue: 0.6, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(logoGlowScale, { toValue: 1.0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(logoGlowOpacity, { toValue: 0.35, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();

    // 3. Initial Ken-Burns zoom on slide 0
    Animated.timing(slideScales[0], {
      toValue: 1.06,
      duration: 6500,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    // 4. Overlapping crossfade carousel loop (5.5 seconds)
    const interval = setInterval(() => {
      const currentIdx = activeIndexRef.current;
      const nextIdx = (currentIdx + 1) % CAROUSEL_SLIDES.length;

      zCounterRef.current += 1;
      const newZ = zCounterRef.current;
      setZIndices((prev) => {
        const nextZ = [...prev];
        nextZ[nextIdx] = newZ;
        return nextZ;
      });

      slideScales[nextIdx].setValue(1.0);
      slideOpacities[nextIdx].setValue(0);

      Animated.timing(slideScales[nextIdx], {
        toValue: 1.06,
        duration: 6500,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();

      Animated.timing(slideOpacities[nextIdx], {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          slideOpacities[currentIdx].setValue(0);
          slideScales[currentIdx].setValue(1.0);
          activeIndexRef.current = nextIdx;
        }
      });
    }, 5500);

    return () => clearInterval(interval);
  }, []);

  const handleAuthSubmit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      safeHaptic('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (isSignUp && !isAgreed) {
      safeHaptic('error');
      setAgreementError(true);
      return;
    }

    setErrorMessage('');
    setAccountConflict(null);
    setIsLoading(true);

    try {
      const check = await SupabaseService.checkUserExists(cleanEmail);
      if (check && check.ok) {
        if (isSignUp && check.exists) {
          setIsLoading(false);
          safeHaptic('error');
          setAccountConflict('exists');
          setErrorMessage('An account with this email already exists.');
          return;
        }
        if (!isSignUp && !check.exists) {
          setIsLoading(false);
          safeHaptic('error');
          setAccountConflict('not_found');
          setErrorMessage('No account found with this email.');
          return;
        }
      }
    } catch (_) { }

    try {
      if (isSignUp) {
        await SupabaseService.registerUser({ email: cleanEmail, fullName: cleanEmail.split('@')[0] });
      } else {
        await SupabaseService.loginUser({ email: cleanEmail });
      }
    } catch (_) { }

    setIsLoading(false);
    safeHaptic('success');
    navigation.replace('PlatformSelect');
  };

  const handleSwitchToLogin = () => {
    safeHaptic('light');
    setIsSignUp(false);
    setAccountConflict(null);
    setErrorMessage('');
    setAgreementError(false);
  };

  const handleSwitchToSignup = () => {
    safeHaptic('light');
    setIsSignUp(true);
    setAccountConflict(null);
    setErrorMessage('');
    setAgreementError(false);
  };

  const handleSelectDomain = (domain) => {
    safeHaptic('light');
    let base = email.trim();
    if (base.includes('@')) base = base.split('@')[0];
    if (!base) base = 'user';
    setEmail(`${base}${domain}`.toLowerCase());
    setErrorMessage('');
    setAccountConflict(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Background Carousel with Overlapping Crossfades ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>
          {CAROUSEL_SLIDES.map((slide, idx) => (
            <Animated.View
              key={slide.id}
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: slideOpacities[idx],
                  transform: [{ scale: slideScales[idx] }],
                  zIndex: zIndices[idx],
                },
              ]}
            >
              <Image source={{ uri: slide.uri }} style={styles.carouselImage} resizeMode="cover" />
            </Animated.View>
          ))}
        </View>
        {/* Scrim overlays with high zIndex */}
        <LinearGradient
          colors={['rgba(10, 5, 13, 0.92)', 'rgba(18, 10, 23, 0.42)', 'transparent']}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
        />
        <LinearGradient
          colors={['transparent', 'rgba(14, 8, 18, 0.82)', uiTheme.colors.background]}
          locations={[0.35, 0.68, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1001 }]}
        />
      </View>

      {/* ── Main Content ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
        enabled
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top, 20) + 10, paddingBottom: Math.max(insets.bottom, 20) + 10 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero Branding */}
          <View style={styles.brandContainer}>
            <View style={styles.emblemWrapper}>
              <LinearGradient
                colors={[uiTheme.colors.primary, uiTheme.colors.secondary, '#FFD166']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={styles.emblemFrame}
              >
                <View style={styles.emblemInner}>
                  <Image
                    source={emblemFailed ? FALLBACK_LOGO_IMG : { uri: FLINT_EMBLEM_URI }}
                    onError={() => setEmblemFailed(true)}
                    style={styles.emblemImg}
                    resizeMode="cover"
                  />
                </View>
              </LinearGradient>
            </View>

            <Text style={styles.brandTitle}>Flint</Text>
            <Text style={styles.heroDialogue}>Strike the spark. Ignite real chemistry.</Text>
          </View>

          {/* Frosted Glass Auth Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isSignUp
                ? 'Join Flint to find genuine connections.'
                : 'Sign in to resume finding great matches.'}
            </Text>


            {/* Email Field */}
            <View style={styles.inputGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.inputLabel}>Email Address</Text>
              </View>
              <View style={[styles.inputBox, isFocusedEmail && styles.inputBoxFocused]}>
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color={isFocusedEmail ? uiTheme.colors.secondary : uiTheme.colors.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="name@example.com"
                  placeholderTextColor={uiTheme.colors.muted}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setErrorMessage('');
                    if (accountConflict) setAccountConflict(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  selectionColor={uiTheme.colors.secondary}
                  cursorColor={uiTheme.colors.secondary}
                  underlineColorAndroid="transparent"
                  keyboardType="email-address"
                  onFocus={() => setIsFocusedEmail(true)}
                  onBlur={() => setIsFocusedEmail(false)}
                />
                {Boolean(email) && (
                  <TouchableOpacity
                    onPress={() => {
                      setEmail('');
                      setErrorMessage('');
                      if (accountConflict) setAccountConflict(null);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel="Clear email"
                  >
                    <Ionicons name="close-circle" size={16} color={uiTheme.colors.muted} />
                  </TouchableOpacity>
                )}
                {isValidEmail(email) && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#4ECCA3"
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
              {/* Privacy Microcopy for Email */}
              <View style={styles.fieldHintRow}>
                <Ionicons name="shield-checkmark-outline" size={11.5} color="rgba(245, 230, 240, 0.52)" />
                <Text style={styles.fieldHintText}>
                  {isSignUp
                    ? 'Never shown on your profile · Used for verification'
                    : "We'll send a secure code to sign you in"}
                </Text>
              </View>

              {/* Contextual Domain Suggestions: ONLY when typing before @ */}
              {Boolean(email.length > 0 && !email.includes('@')) && (
                <View style={styles.domainSection}>
                  <Text style={styles.domainLabel}>Quick suggestions:</Text>
                  <View style={styles.domainChipsRow}>
                    {DOMAIN_SUGGESTIONS.map((d) => (
                      <TouchableOpacity accessibilityRole="button"
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
              )}
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={[styles.inputBox, isFocusedPassword && styles.inputBoxFocused]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={isFocusedPassword ? uiTheme.colors.secondary : uiTheme.colors.muted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor={uiTheme.colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  autoCorrect={false}
                  spellCheck={false}
                  selectionColor={uiTheme.colors.secondary}
                  cursorColor={uiTheme.colors.secondary}
                  underlineColorAndroid="transparent"
                  secureTextEntry={!showPassword}
                  onFocus={() => setIsFocusedPassword(true)}
                  onBlur={() => setIsFocusedPassword(false)}
                />
                <TouchableOpacity accessibilityRole="button"
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={19}
                    color={uiTheme.colors.muted}
                  />
                </TouchableOpacity>
              </View>

              {!isSignUp && (
                <TouchableOpacity
                  style={styles.forgotPasswordButton}
                  onPress={() => {
                    safeHaptic('light');
                    setSupportModalVisible(true);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password?"
                  accessibilityHint="Get login assistance from Flint concierge"
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Mandatory 18+ & Terms Checkbox for Sign Up */}
            {isSignUp && (
              <TouchableOpacity
                style={[
                  styles.consentCheckboxRow,
                  agreementError && styles.consentCheckboxRowError,
                ]}
                onPress={() => {
                  safeHaptic('light');
                  setIsAgreed(!isAgreed);
                  setAgreementError(false);
                }}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAgreed }}
                accessibilityLabel="Confirm 18+ and agree to Flint's Terms of Service and Privacy Policy"
              >
                <View
                  style={[
                    styles.consentBox,
                    isAgreed && styles.consentBoxChecked,
                    agreementError && styles.consentBoxError,
                  ]}
                >
                  {isAgreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.consentText}>
                  I confirm I am 18+ and agree to Flint's{' '}
                  <Text
                    style={styles.legalLink}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openLegalModal('terms');
                    }}
                    accessibilityRole="link"
                    accessibilityLabel="Terms of Service"
                  >
                    Terms of Service
                  </Text>
                  {' & '}
                  <Text
                    style={styles.legalLink}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openLegalModal('privacy');
                    }}
                    accessibilityRole="link"
                    accessibilityLabel="Privacy Policy"
                  >
                    Privacy Policy
                  </Text>.
                </Text>
              </TouchableOpacity>
            )}

            {/* Agreement Warning if unselected */}
            {isSignUp && agreementError && (
              <View style={styles.agreementWarningRow}>
                <Ionicons name="alert-circle" size={13} color={uiTheme.colors.accent} />
                <Text style={styles.agreementWarningText}>
                  Please check the box to accept the Terms & 18+ policy to continue
                </Text>
              </View>
            )}

            {/* Inline Existing Account Conflict Banner (Option 1) */}
            {accountConflict === 'exists' && (
              <View style={styles.conflictBanner}>
                <View style={styles.conflictBannerHeader}>
                  <Ionicons name="information-circle" size={17} color={uiTheme.colors.secondary} />
                  <Text style={styles.conflictBannerTitle}>
                    An account with this email already exists.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.conflictActionBtn}
                  onPress={handleSwitchToLogin}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with this email instead"
                >
                  <Text style={styles.conflictActionText}>Sign In Instead</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Inline Account Not Found Banner (Option 1) */}
            {accountConflict === 'not_found' && (
              <View style={styles.conflictBanner}>
                <View style={styles.conflictBannerHeader}>
                  <Ionicons name="information-circle" size={17} color={uiTheme.colors.secondary} />
                  <Text style={styles.conflictBannerTitle}>
                    No account found with this email.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.conflictActionBtn}
                  onPress={handleSwitchToSignup}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new account instead"
                >
                  <Text style={styles.conflictActionText}>Create Account Instead</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Standard Error */}
            {Boolean(errorMessage) && !accountConflict && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color={uiTheme.colors.accent} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Main Action Button (Stitch Velvet & Peach Gradient) */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isSignUp && !isAgreed && styles.primaryButtonMuted,
              ]}
              activeOpacity={0.88}
              onPress={handleAuthSubmit}
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? 'Create Account' : 'Sign In'}
            >
              <LinearGradient
                colors={
                  isSignUp && !isAgreed
                    ? ['rgba(255, 51, 102, 0.55)', 'rgba(255, 94, 126, 0.55)', 'rgba(255, 170, 128, 0.55)']
                    : [uiTheme.colors.primary, uiTheme.colors.accent, uiTheme.colors.secondary]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Footer Prompt */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  safeHaptic('light');
                  setIsSignUp(!isSignUp);
                  setErrorMessage('');
                  setAccountConflict(null);
                  setAgreementError(false);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isSignUp ? 'Sign In' : 'Join Now'}
              >
                <Text style={styles.footerActionText}>
                  {isSignUp ? 'Sign In' : 'Join Now'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Legal Links for Existing Users */}
            {!isSignUp && (
              <Text style={styles.legalDisclaimerText}>
                By signing in, you agree to Flint's{' '}
                <Text
                  style={styles.legalLink}
                  onPress={() => openLegalModal('terms')}
                  accessibilityRole="link"
                >
                  Terms
                </Text>
                {' & '}
                <Text
                  style={styles.legalLink}
                  onPress={() => openLegalModal('privacy')}
                  accessibilityRole="link"
                >
                  Privacy Policy
                </Text>.
              </Text>
            )}
          </View>

          {/* Continue as Guest at Bottom (Apple HIG 44pt Touch Target & HitSlop) */}
          <TouchableOpacity
            style={styles.guestBottomLink}
            onPress={() => {
              safeHaptic('light');
              navigation.replace('PlatformSelect');
            }}
            activeOpacity={0.6}
            hitSlop={{ top: 14, bottom: 20, left: 24, right: 24 }}
            accessibilityRole="button"
            accessibilityLabel="Continue as Guest"
            accessibilityHint="Browse Flint without logging in"
          >
            <Text style={styles.guestBottomLinkText}>Continue as Guest</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════════════════════════════════════════════════ */}
      {/* LEGAL & PRIVACY IN-APP MODAL (App Store 5.1.1)    */}
      {/* ═══════════════════════════════════════════════════ */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setLegalModalVisible(false)}
          />
          <View style={styles.modalCard}>
            {/* Drag Pill Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleGroup}>
                <Text style={styles.modalTitle}>Legal & Privacy</Text>
                <Text style={styles.modalSub}>Flint Trust, Safety & Compliance</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setLegalModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close legal document"
              >
                <Ionicons name="close" size={22} color={uiTheme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Segmented Tab Switcher */}
            <View style={styles.modalTabRow}>
              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  legalTab === 'terms' && styles.modalTabBtnActive,
                ]}
                onPress={() => {
                  safeHaptic('light');
                  setLegalTab('terms');
                }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: legalTab === 'terms' }}
              >
                <Text
                  style={[
                    styles.modalTabText,
                    legalTab === 'terms' && styles.modalTabTextActive,
                  ]}
                >
                  Terms of Service
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  legalTab === 'privacy' && styles.modalTabBtnActive,
                ]}
                onPress={() => {
                  safeHaptic('light');
                  setLegalTab('privacy');
                }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: legalTab === 'privacy' }}
              >
                <Text
                  style={[
                    styles.modalTabText,
                    legalTab === 'privacy' && styles.modalTabTextActive,
                  ]}
                >
                  Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body Scroll */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {legalTab === 'terms' ? (
                <View style={styles.legalSection}>
                  <View style={styles.legalBadgeRow}>
                    <Ionicons name="shield-checkmark" size={14} color={uiTheme.colors.secondary} />
                    <Text style={styles.legalBadgeText}>18+ Age Requirement & Community Honor Code</Text>
                  </View>

                  <Text style={styles.legalParagraphHead}>1. Eligibility & Age Restriction</Text>
                  <Text style={styles.legalParagraph}>
                    You must be at least 18 years of age to create an account on Flint and use our service. By creating an account or signing in, you affirm, represent, and warrant that you are at least 18 years old and are legally capable of entering into this binding agreement. Any account found to be operated by a minor will be immediately and permanently terminated.
                  </Text>

                  <Text style={styles.legalParagraphHead}>2. Member Conduct & Mutual Respect</Text>
                  <Text style={styles.legalParagraph}>
                    Flint is a community dedicated to real romantic chemistry, dignity, and authentic connections. We enforce a zero-tolerance policy against hate speech, harassment, impersonation, commercial solicitation, unsolicited explicit media, and scamming. Every profile is subject to automated and human trust screening.
                  </Text>

                  <Text style={styles.legalParagraphHead}>3. Safety & Profile Authenticity</Text>
                  <Text style={styles.legalParagraph}>
                    To maintain an authentic network, Flint may require live biometric liveness selfie checks to verify your identity. You agree to upload only your own authentic, recent photos and to represent yourself truthfully.
                  </Text>

                  <Text style={styles.legalParagraphHead}>4. Subscriptions & Account Termination</Text>
                  <Text style={styles.legalParagraph}>
                    You retain the right to delete your Flint account at any time in App Settings. Any premium subscriptions or boosts are managed through Apple App Store or Google Play Store billing terms.
                  </Text>
                </View>
              ) : (
                <View style={styles.legalSection}>
                  <View style={styles.legalBadgeRow}>
                    <Ionicons name="lock-closed" size={14} color={uiTheme.colors.secondary} />
                    <Text style={styles.legalBadgeText}>256-Bit TLS Encryption & GDPR / CCPA Compliant</Text>
                  </View>

                  <Text style={styles.legalParagraphHead}>1. Personal Data We Collect</Text>
                  <Text style={styles.legalParagraph}>
                    We only collect information necessary to create your romantic match profile: your name, verified email, dating preferences, approximate geolocation (strictly while using the app, never tracked continuously in the background), and photos you explicitly upload.
                  </Text>

                  <Text style={styles.legalParagraphHead}>2. Zero Third-Party Data Brokers</Text>
                  <Text style={styles.legalParagraph}>
                    Flint does not sell, rent, or trade your personal data to advertisers or third-party data brokers. Your private chat messages are encrypted and only accessible to you and your match.
                  </Text>

                  <Text style={styles.legalParagraphHead}>3. Data Ownership & Deletion Rights</Text>
                  <Text style={styles.legalParagraph}>
                    Under GDPR, CCPA, and global privacy standards, you maintain total ownership over your data. You may request a complete export of your account data or trigger immediate permanent erasure by tapping "Delete Account" in Flint Settings.
                  </Text>

                  <Text style={styles.legalParagraphHead}>4. Data Protection Contact</Text>
                  <Text style={styles.legalParagraph}>
                    Questions regarding data security or privacy compliance may be addressed directly to our Data Protection Officer at privacy@flint.dating.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Bottom Modal CTA */}
            <View style={styles.modalBottomBar}>
              <TouchableOpacity
                style={styles.modalAcceptBtn}
                onPress={() => {
                  safeHaptic('medium');
                  setIsAgreed(true);
                  setAgreementError(false);
                  setLegalModalVisible(false);
                }}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="I Understand and Accept"
              >
                <LinearGradient
                  colors={[uiTheme.colors.primary, uiTheme.colors.accent, uiTheme.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalAcceptGradient}
                >
                  <Text style={styles.modalAcceptBtnText}>I Understand & Agree</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════ */}
      {/* CONCIERGE SIGN-IN SUPPORT MODAL                   */}
      {/* ═══════════════════════════════════════════════════ */}
      <Modal
        visible={supportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setSupportModalVisible(false)}
          />
          <View style={[styles.modalCard, styles.supportModalCard]}>
            {/* Drag Pill Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleGroup}>
                <Text style={styles.modalTitle}>Sign-In Concierge</Text>
                <Text style={styles.modalSub}>Fast assistance with your Flint account</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSupportModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close support"
              >
                <Ionicons name="close" size={22} color={uiTheme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Tip 1 */}
              <View style={styles.supportTipCard}>
                <View style={styles.supportTipIconWrap}>
                  <Ionicons name="mail" size={18} color={uiTheme.colors.secondary} />
                </View>
                <View style={styles.supportTipBody}>
                  <Text style={styles.supportTipTitle}>Trouble Signing In?</Text>
                  <Text style={styles.supportTipText}>
                    Ensure you are using the exact email associated with your account. If you registered via Google or Apple, select the matching option.
                  </Text>
                </View>
              </View>

              {/* Tip 2 */}
              <View style={styles.supportTipCard}>
                <View style={styles.supportTipIconWrap}>
                  <Ionicons name="sync" size={18} color={uiTheme.colors.secondary} />
                </View>
                <View style={styles.supportTipBody}>
                  <Text style={styles.supportTipTitle}>Forgot Your Password?</Text>
                  <Text style={styles.supportTipText}>
                    We can dispatch a secure single-use magic reset link or 6-digit OTP directly to your inbox.
                  </Text>
                </View>
              </View>

              {/* Tip 3 */}
              <View style={styles.supportTipCard}>
                <View style={styles.supportTipIconWrap}>
                  <Ionicons name="shield-checkmark" size={18} color={uiTheme.colors.secondary} />
                </View>
                <View style={styles.supportTipBody}>
                  <Text style={styles.supportTipTitle}>Account Status & Inquiries</Text>
                  <Text style={styles.supportTipText}>
                    If your account was temporarily locked or flagged for verification, our concierge team will assist you immediately.
                  </Text>
                </View>
              </View>

              {/* Direct Concierge Contact Button */}
              <TouchableOpacity
                style={styles.conciergeContactBtn}
                onPress={() => {
                  safeHaptic('medium');
                  Linking.openURL('mailto:support@flint.dating?subject=Flint%20Login%20Assistance').catch(() => { });
                }}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Email Flint Concierge Support"
              >
                <Ionicons name="chatbubbles" size={18} color={uiTheme.colors.secondary} />
                <Text style={styles.conciergeContactBtnText}>Contact Flint Concierge</Text>
                <Ionicons name="open-outline" size={16} color={uiTheme.colors.muted} />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalBottomBar}>
              <TouchableOpacity accessibilityRole="button"
                style={styles.modalDismissSimpleBtn}
                onPress={() => setSupportModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalDismissSimpleText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a050d',
    overflow: 'hidden',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%', maxWidth: 480, alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: uiTheme.spacing.xxl,
    justifyContent: 'center',
  },

  // ── Brand Header ──
  brandContainer: {
    alignItems: 'center',
    marginBottom: uiTheme.spacing.xxl,
  },
  emblemWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emblemFrame: {
    width: 84,
    height: 84,
    borderRadius: 26,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  emblemInner: {
    width: '100%',
    height: '100%',
    borderRadius: uiTheme.radius.card,
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 10, 23, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemImg: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: 'normal',
    letterSpacing: -0.7,
    marginBottom: uiTheme.spacing.xs,
    textShadowColor: 'rgba(255, 51, 102, 0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  heroDialogue: {
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255, 240, 245, 0.92)',
    fontSize: 15.5,
    fontWeight: 'normal',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginTop: uiTheme.spacing.xs,
    maxWidth: 320,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // ── Card ──
  card: {
    backgroundColor: 'rgba(22, 14, 28, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    padding: uiTheme.spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 22,
    fontWeight: 'normal',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: uiTheme.spacing.xs,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: 'rgba(245, 235, 240, 0.75)',
    textAlign: 'center',
    marginBottom: uiTheme.spacing.xl,
  },

  // ── Input Fields ──
  inputGroup: {
    marginBottom: uiTheme.spacing.lg,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  fieldHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    paddingLeft: uiTheme.spacing.xs,
  },
  fieldHintText: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(237, 221, 241, 0.52)',
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 15,
  },

  // ── Domain Chips ──
  domainSection: {
    marginTop: 10,
    marginBottom: uiTheme.spacing.xs,
  },
  domainLabel: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginBottom: 6,
  },
  domainChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
  },
  domainChip: {
    backgroundColor: 'rgba(59, 49, 64, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  domainChipText: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  inputLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    color: 'rgba(237, 221, 241, 0.65)',
    marginBottom: 7,
    letterSpacing: 0.4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 10, 23, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 14,
  },
  inputBoxFocused: {
    borderColor: uiTheme.colors.secondary,
    backgroundColor: 'rgba(32, 20, 40, 0.92)',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    fontFamily: 'Inter_400Regular',
    flex: 1,
    fontSize: 14.5,
    color: uiTheme.colors.text,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  eyeButton: {
    padding: uiTheme.spacing.xs,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: uiTheme.spacing.sm,
  },
  forgotPasswordText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },

  // ── Primary CTA (Stitch Velvet & Peach Gradient) ──
  primaryButton: {
    borderRadius: 26,
    overflow: 'hidden',
    marginTop: uiTheme.spacing.sm,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonMuted: {
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryGradient: {
    height: 54,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  primaryButtonText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },

  // ── Mandatory Consent Checkbox & Warning ──
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: uiTheme.spacing.md,
    paddingHorizontal: 2,
    paddingVertical: 6,
    marginTop: uiTheme.spacing.xs,
    marginBottom: 14,
  },
  consentCheckboxRowError: {},
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(12, 6, 16, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  consentBoxChecked: {
    backgroundColor: uiTheme.colors.primary,
    borderColor: uiTheme.colors.accent,
  },
  consentBoxError: {
    borderColor: '#FF4D6D',
    backgroundColor: 'rgba(255, 77, 109, 0.25)',
  },
  consentText: {
    fontFamily: 'Inter_400Regular',
    flex: 1,
    color: 'rgba(245, 235, 240, 0.82)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  agreementWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.xs,
  },
  agreementWarningText: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.accent,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Account Conflict Banner (Option 1 Inline Switcher) ──
  conflictBanner: {
    backgroundColor: 'rgba(255, 170, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 128, 0.35)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: uiTheme.spacing.md,
    marginBottom: 14,
    gap: 10,
  },
  conflictBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
  },
  conflictBannerTitle: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: 'normal',
    flex: 1,
    lineHeight: 18,
  },
  conflictActionBtn: {
    backgroundColor: uiTheme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  conflictActionText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'normal',
    letterSpacing: 0.1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: uiTheme.spacing.md,
    paddingLeft: 2,
  },
  errorText: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.accent,
    fontSize: 13,
    fontWeight: 'normal',
  },

  // ── Guest Link ──
  guestBottomLink: {
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: uiTheme.spacing.sm,
  },
  guestBottomLinkText: {
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 211, 0.72)',
    fontSize: 13.5,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },

  // ── Footer ──
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: uiTheme.spacing.md,
  },
  footerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: uiTheme.colors.textSecondary,
  },
  footerActionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
    fontWeight: 'normal',
    color: uiTheme.colors.secondary,
  },

  // ── Legal & Links ──
  legalDisclaimerText: {
    fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },

  // ── Modals & Bottom Sheets (Apple HIG & App Store Compliance) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 8, 0.82)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: uiTheme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomWidth: 0,
    maxHeight: '86%',
    minHeight: 460,
    paddingTop: uiTheme.spacing.md,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
  },
  supportModalCard: {
    minHeight: 420,
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: uiTheme.spacing.lg,
  },
  modalHeaderTitleGroup: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: 'normal',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: 12.5,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 3,
    marginBottom: uiTheme.spacing.lg,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  modalTabBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  modalTabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    fontWeight: 'normal',
    color: uiTheme.colors.muted,
  },
  modalTabTextActive: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  modalScroll: {
    flexGrow: 0,
    maxHeight: 340,
  },
  modalScrollContent: {
    paddingBottom: uiTheme.spacing.lg,
  },
  legalSection: {
    gap: uiTheme.spacing.md,
  },
  legalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    backgroundColor: 'rgba(255, 51, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.25)',
    borderRadius: 10,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: uiTheme.spacing.sm,
    marginBottom: 6,
  },
  legalBadgeText: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  legalParagraphHead: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
    marginTop: 6,
  },
  legalParagraph: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(245, 235, 240, 0.78)',
    fontSize: 13,
    lineHeight: 20,
  },
  modalBottomBar: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
  },
  modalAcceptBtn: {
    borderRadius: uiTheme.radius.sheet,
    overflow: 'hidden',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  modalAcceptGradient: {
    height: 48,
    borderRadius: uiTheme.radius.sheet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAcceptBtnText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  supportTipCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: uiTheme.spacing.md,
  },
  supportTipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 170, 128, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  supportTipBody: {
    flex: 1,
  },
  supportTipTitle: {
    fontFamily: 'Manrope_700Bold',
    color: uiTheme.colors.text,
    fontSize: 13.5,
    fontWeight: 'normal',
    marginBottom: uiTheme.spacing.xs,
  },
  supportTipText: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(245, 235, 240, 0.7)',
    fontSize: 12.5,
    lineHeight: 18,
  },
  conciergeContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    backgroundColor: 'rgba(255, 51, 102, 0.14)',
    borderWidth: 1.2,
    borderColor: uiTheme.colors.accent,
    borderRadius: 22,
    paddingVertical: uiTheme.spacing.md,
    marginTop: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.xs,
  },
  conciergeContactBtnText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
  },
  modalDismissSimpleBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalDismissSimpleText: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: 13.5,
    fontWeight: 'normal',
  },
});
