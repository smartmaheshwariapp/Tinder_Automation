import { theme as uiTheme, alpha } from '../theme';
// src/screens/LoginScreen.js — Upgraded Luxury Dark Dating App Login Screen
// Featuring Cinematic Background Carousel, Luminous Aura Emblem, and Modern Glassmorphic Inputs
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
  Animated,
  Easing,
  Dimensions,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SupabaseService from '../services/supabase';
import { AppButton, IconWell, Chip, BottomSheet, MotionTouchable, ContentTransition, FadeIn } from '../components/ui';
import useResponsive from '../hooks/useResponsive';

const COLORS = uiTheme.colors;
const SPACE = uiTheme.spacing;
const RADIUS = uiTheme.radius;
const TYPE = uiTheme.type;

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

export default function LoginScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { gutter, isCompact, isShort } = useResponsive();
  const passwordInputRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);

  // ── Auto-resolve authenticated Flint session ──
  useEffect(() => {
    if (route?.params?.logout || route?.params?.forceAuth) return;
    let isMounted = true;
    (async () => {
      try {
        const user = await SupabaseService.getCurrentUser();
        if (user && (user.email || user.id) && isMounted) {
          navigation.replace('PlatformSelect', {
            user,
            userId: user.id,
          });
        }
      } catch (_) {}
    })();
    return () => {
      isMounted = false;
    };
  }, [route?.params?.logout, route?.params?.forceAuth]);

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

  const emblemSize = isCompact || isShort ? 72 : 84;
  const emblemRadius = Math.round(emblemSize * 0.3);
  const cardPadding = isCompact ? SPACE.lg : SPACE.xxl;

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
              <Image source={{ uri: slide.uri }} style={styles.carouselImage} resizeMode="cover" accessible={false} />
            </Animated.View>
          ))}
        </View>
        {/* Scrim overlays with high zIndex */}
        <LinearGradient
          colors={[alpha(COLORS.background, 0.92), alpha(COLORS.surface, 0.42), alpha(COLORS.background, 0)]}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
        />
        <LinearGradient
          colors={[alpha(COLORS.background, 0), alpha(COLORS.background, 0.84), COLORS.background]}
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
            {
              paddingHorizontal: gutter,
              paddingTop: Math.max(insets.top, SPACE.xl) + SPACE.sm,
              paddingBottom: Math.max(insets.bottom, SPACE.xl) + SPACE.sm,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero Branding */}
          <FadeIn style={styles.brandContainer}>
            <View style={styles.emblemWrapper}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary, COLORS.warning]}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={[styles.emblemFrame, { width: emblemSize, height: emblemSize, borderRadius: emblemRadius }]}
              >
                <View style={[styles.emblemInner, { borderRadius: emblemRadius - 3 }]}>
                  <Image
                    source={emblemFailed ? FALLBACK_LOGO_IMG : { uri: FLINT_EMBLEM_URI }}
                    onError={() => setEmblemFailed(true)}
                    style={styles.emblemImg}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                </View>
              </LinearGradient>
            </View>

            <Text style={styles.brandTitle} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Flint</Text>
            <Text style={styles.heroDialogue}>Strike the spark. Ignite real chemistry.</Text>
          </FadeIn>

          {/* Frosted Glass Auth Card */}
          <FadeIn delay={60}>
            <View style={[styles.card, { padding: cardPadding }]}>
              <ContentTransition transitionKey={isSignUp ? 'signup' : 'login'}>
                <Text style={styles.cardTitle} accessibilityRole="header">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {isSignUp
                    ? 'Join Flint to find genuine connections.'
                    : 'Sign in to resume finding great matches.'}
                </Text>
              </ContentTransition>

              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Email Address</Text>
                <View
                  style={[
                    styles.inputBox,
                    isFocusedEmail && styles.inputBoxFocused,
                    Boolean(errorMessage) && styles.inputBoxError,
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color={Boolean(errorMessage) ? COLORS.error : isFocusedEmail ? COLORS.accent : COLORS.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor={COLORS.muted}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setErrorMessage('');
                      if (accountConflict) setAccountConflict(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    selectionColor={COLORS.accent}
                    cursorColor={COLORS.accent}
                    underlineColorAndroid="transparent"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    keyboardAppearance="dark"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                    accessibilityLabel="Email address"
                    onFocus={() => setIsFocusedEmail(true)}
                    onBlur={() => setIsFocusedEmail(false)}
                  />
                  {Boolean(email) && (
                    <MotionTouchable
                      onPress={() => {
                        setEmail('');
                        setErrorMessage('');
                        if (accountConflict) setAccountConflict(null);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={styles.iconAction}
                      accessibilityRole="button"
                      accessibilityLabel="Clear email"
                    >
                      <Ionicons name="close-circle" size={17} color={COLORS.muted} />
                    </MotionTouchable>
                  )}
                  {isValidEmail(email) && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={COLORS.success}
                      style={styles.validIcon}
                    />
                  )}
                </View>
                {/* Privacy Microcopy for Email */}
                <ContentTransition transitionKey={isSignUp ? 'signup' : 'login'} style={styles.fieldHintRow}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.muted} />
                  <Text style={styles.fieldHintText}>
                    {isSignUp
                      ? 'Never shown on your profile · Used for verification'
                      : "We'll send a secure code to sign you in"}
                  </Text>
                </ContentTransition>

                {/* Contextual Domain Suggestions: ONLY when typing before @ */}
                {Boolean(email.length > 0 && !email.includes('@')) && (
                  <View style={styles.domainSection}>
                    <Text style={styles.domainLabel}>Quick suggestions:</Text>
                    <View style={styles.domainChipsRow}>
                      {DOMAIN_SUGGESTIONS.map((d) => (
                        <Chip
                          key={d}
                          label={d}
                          onPress={() => handleSelectDomain(d)}
                          accessibilityLabel={`Use ${d}`}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Password</Text>
                <View style={[styles.inputBox, isFocusedPassword && styles.inputBoxFocused]}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={19}
                    color={isFocusedPassword ? COLORS.accent : COLORS.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.muted}
                    value={password}
                    onChangeText={setPassword}
                    autoCorrect={false}
                    spellCheck={false}
                    selectionColor={COLORS.accent}
                    cursorColor={COLORS.accent}
                    underlineColorAndroid="transparent"
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    keyboardAppearance="dark"
                    returnKeyType="done"
                    maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                    accessibilityLabel="Password"
                    onFocus={() => setIsFocusedPassword(true)}
                    onBlur={() => setIsFocusedPassword(false)}
                  />
                  <MotionTouchable
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={19}
                      color={COLORS.muted}
                    />
                  </MotionTouchable>
                </View>

                {!isSignUp && (
                  <MotionTouchable
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
                    <Text style={styles.forgotPasswordText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Forgot Password?</Text>
                  </MotionTouchable>
                )}
              </View>

              {/* Mandatory 18+ & Terms Checkbox for Sign Up */}
              {isSignUp && (
                <MotionTouchable
                  style={[
                    styles.consentCheckboxRow,
                    agreementError && styles.consentCheckboxRowError,
                  ]}
                  pressScale={0.99}
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
                    {isAgreed && <Ionicons name="checkmark" size={15} color={COLORS.onPrimary} />}
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
                </MotionTouchable>
              )}

              {/* Agreement Warning if unselected */}
              {isSignUp && agreementError && (
                <View style={styles.agreementWarningRow} accessibilityLiveRegion="polite">
                  <Ionicons name="alert-circle" size={14} color={COLORS.error} style={styles.errorIcon} />
                  <Text style={styles.agreementWarningText}>
                    Please check the box to accept the Terms & 18+ policy to continue
                  </Text>
                </View>
              )}

              {/* Inline Existing Account Conflict Banner (Option 1) */}
              {accountConflict === 'exists' && (
                <FadeIn style={styles.conflictBanner}>
                  <View style={styles.conflictBannerHeader}>
                    <Ionicons name="information-circle" size={18} color={COLORS.secondary} />
                    <Text style={styles.conflictBannerTitle}>
                      An account with this email already exists.
                    </Text>
                  </View>
                  <AppButton
                    title="Sign In Instead"
                    size="sm"
                    iconRight="chevron-forward"
                    fullWidth={false}
                    haptic={false}
                    onPress={handleSwitchToLogin}
                    accessibilityLabel="Sign in with this email instead"
                  />
                </FadeIn>
              )}

              {/* Inline Account Not Found Banner (Option 1) */}
              {accountConflict === 'not_found' && (
                <FadeIn style={styles.conflictBanner}>
                  <View style={styles.conflictBannerHeader}>
                    <Ionicons name="information-circle" size={18} color={COLORS.secondary} />
                    <Text style={styles.conflictBannerTitle}>
                      No account found with this email.
                    </Text>
                  </View>
                  <AppButton
                    title="Create Account Instead"
                    size="sm"
                    iconRight="chevron-forward"
                    fullWidth={false}
                    haptic={false}
                    onPress={handleSwitchToSignup}
                    accessibilityLabel="Create a new account instead"
                  />
                </FadeIn>
              )}

              {/* Standard Error */}
              {Boolean(errorMessage) && !accountConflict && (
                <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
                  <Ionicons name="alert-circle" size={15} color={COLORS.error} style={styles.errorIcon} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Main Action Button */}
              <AppButton
                title={isSignUp ? 'Create Account' : 'Sign In'}
                iconRight="chevron-forward"
                onPress={handleAuthSubmit}
                loading={isLoading}
                haptic={false}
                accessibilityLabel={isSignUp ? 'Create Account' : 'Sign In'}
                style={[styles.primaryButton, isSignUp && !isAgreed && !isLoading && styles.primaryButtonMuted]}
              />

              {/* Footer Prompt */}
              <View style={styles.footerContainer}>
                <Text style={styles.footerText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                  {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                </Text>
                <MotionTouchable
                  style={styles.footerAction}
                  onPress={() => {
                    safeHaptic('light');
                    setIsSignUp(!isSignUp);
                    setErrorMessage('');
                    setAccountConflict(null);
                    setAgreementError(false);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={isSignUp ? 'Sign In' : 'Join Now'}
                >
                  <Text style={styles.footerActionText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    {isSignUp ? 'Sign In' : 'Join Now'}
                  </Text>
                </MotionTouchable>
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
          </FadeIn>

          {/* Continue as Guest at Bottom (Apple HIG 44pt Touch Target & HitSlop) */}
          <MotionTouchable
            style={styles.guestBottomLink}
            onPress={async () => {
              safeHaptic('light');
              let guestUser = null;
              try {
                guestUser = await SupabaseService.saveGuestSession();
              } catch (_) {}
              navigation.replace('PlatformSelect', {
                user: guestUser || { id: 'guest_user', email: 'guest@flint.ai', fullName: 'Guest User', isGuest: true },
                userId: guestUser?.id || 'guest_user',
              });
            }}
            activeOpacity={0.6}
            hitSlop={{ top: 6, bottom: 12, left: 24, right: 24 }}
            accessibilityRole="button"
            accessibilityLabel="Continue as Guest"
            accessibilityHint="Browse Flint without logging in"
          >
            <Text style={styles.guestBottomLinkText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Continue as Guest</Text>
          </MotionTouchable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════════════════════════════════════════════════ */}
      {/* LEGAL & PRIVACY IN-APP SHEET (App Store 5.1.1)     */}
      {/* ═══════════════════════════════════════════════════ */}
      <BottomSheet
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        closeLabel="Close legal document"
        title="Legal & Privacy"
        subtitle="Flint Trust, Safety & Compliance"
        maxHeightRatio={0.86}
        footer={
          <AppButton
            title="I Understand & Agree"
            accessibilityLabel="I Understand and Accept"
            haptic={false}
            onPress={() => {
              safeHaptic('medium');
              setIsAgreed(true);
              setAgreementError(false);
              setLegalModalVisible(false);
            }}
          />
        }
      >
        {/* Segmented Tab Switcher */}
        <View style={styles.modalTabRow} accessibilityRole="tablist">
          <MotionTouchable
            style={[
              styles.modalTabBtn,
              legalTab === 'terms' && styles.modalTabBtnActive,
            ]}
            pressScale={0.98}
            onPress={() => {
              safeHaptic('light');
              setLegalTab('terms');
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel="Terms of Service"
            accessibilityState={{ selected: legalTab === 'terms' }}
          >
            <Text
              style={[
                styles.modalTabText,
                legalTab === 'terms' && styles.modalTabTextActive,
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
            >
              Terms of Service
            </Text>
          </MotionTouchable>

          <MotionTouchable
            style={[
              styles.modalTabBtn,
              legalTab === 'privacy' && styles.modalTabBtnActive,
            ]}
            pressScale={0.98}
            onPress={() => {
              safeHaptic('light');
              setLegalTab('privacy');
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel="Privacy Policy"
            accessibilityState={{ selected: legalTab === 'privacy' }}
          >
            <Text
              style={[
                styles.modalTabText,
                legalTab === 'privacy' && styles.modalTabTextActive,
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
            >
              Privacy Policy
            </Text>
          </MotionTouchable>
        </View>

        {/* Legal Document Body */}
        <ContentTransition transitionKey={legalTab}>
          {legalTab === 'terms' ? (
            <View style={styles.legalSection}>
              <View style={styles.legalBadgeRow}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.secondary} />
                <Text style={styles.legalBadgeText}>18+ Age Requirement & Community Honor Code</Text>
              </View>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">1. Eligibility & Age Restriction</Text>
              <Text style={styles.legalParagraph}>
                You must be at least 18 years of age to create an account on Flint and use our service. By creating an account or signing in, you affirm, represent, and warrant that you are at least 18 years old and are legally capable of entering into this binding agreement. Any account found to be operated by a minor will be immediately and permanently terminated.
              </Text>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">2. Member Conduct & Mutual Respect</Text>
              <Text style={styles.legalParagraph}>
                Flint is a community dedicated to real romantic chemistry, dignity, and authentic connections. We enforce a zero-tolerance policy against hate speech, harassment, impersonation, commercial solicitation, unsolicited explicit media, and scamming. Every profile is subject to automated and human trust screening.
              </Text>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">3. Safety & Profile Authenticity</Text>
              <Text style={styles.legalParagraph}>
                To maintain an authentic network, Flint may require live biometric liveness selfie checks to verify your identity. You agree to upload only your own authentic, recent photos and to represent yourself truthfully.
              </Text>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">4. Subscriptions & Account Termination</Text>
              <Text style={styles.legalParagraph}>
                You retain the right to delete your Flint account at any time in App Settings. Any premium subscriptions or boosts are managed through Apple App Store or Google Play Store billing terms.
              </Text>
            </View>
          ) : (
            <View style={styles.legalSection}>
              <View style={styles.legalBadgeRow}>
                <Ionicons name="lock-closed" size={14} color={COLORS.secondary} />
                <Text style={styles.legalBadgeText}>256-Bit TLS Encryption & GDPR / CCPA Compliant</Text>
              </View>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">1. Personal Data We Collect</Text>
              <Text style={styles.legalParagraph}>
                We only collect information necessary to create your romantic match profile: your name, verified email, dating preferences, approximate geolocation (strictly while using the app, never tracked continuously in the background), and photos you explicitly upload.
              </Text>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">2. Zero Third-Party Data Brokers</Text>
              <Text style={styles.legalParagraph}>
                Flint does not sell, rent, or trade your personal data to advertisers or third-party data brokers. Your private chat messages are encrypted and only accessible to you and your match.
              </Text>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">3. Data Ownership & Deletion Rights</Text>
              <Text style={styles.legalParagraph}>
                Under GDPR, CCPA, and global privacy standards, you maintain total ownership over your data. You may request a complete export of your account data or trigger immediate permanent erasure by tapping "Delete Account" in Flint Settings.
              </Text>

              <Text style={styles.legalParagraphHead} accessibilityRole="header">4. Data Protection Contact</Text>
              <Text style={styles.legalParagraph}>
                Questions regarding data security or privacy compliance may be addressed directly to our Data Protection Officer at privacy@flint.dating.
              </Text>
            </View>
          )}
        </ContentTransition>
      </BottomSheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* CONCIERGE SIGN-IN SUPPORT SHEET                    */}
      {/* ═══════════════════════════════════════════════════ */}
      <BottomSheet
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
        closeLabel="Close support"
        title="Sign-In Concierge"
        subtitle="Fast assistance with your Flint account"
        maxHeightRatio={0.8}
        footer={
          <AppButton
            title="Back to Sign In"
            variant="ghost"
            onPress={() => setSupportModalVisible(false)}
          />
        }
      >
        {/* Tip 1 */}
        <View style={styles.supportTipCard}>
          <IconWell icon="mail" tone="secondary" size={36} />
          <View style={styles.supportTipBody}>
            <Text style={styles.supportTipTitle}>Trouble Signing In?</Text>
            <Text style={styles.supportTipText}>
              Ensure you are using the exact email associated with your account. If you registered via Google or Apple, select the matching option.
            </Text>
          </View>
        </View>

        {/* Tip 2 */}
        <View style={styles.supportTipCard}>
          <IconWell icon="sync" tone="secondary" size={36} />
          <View style={styles.supportTipBody}>
            <Text style={styles.supportTipTitle}>Forgot Your Password?</Text>
            <Text style={styles.supportTipText}>
              We can dispatch a secure single-use magic reset link or 6-digit OTP directly to your inbox.
            </Text>
          </View>
        </View>

        {/* Tip 3 */}
        <View style={styles.supportTipCard}>
          <IconWell icon="shield-checkmark" tone="secondary" size={36} />
          <View style={styles.supportTipBody}>
            <Text style={styles.supportTipTitle}>Account Status & Inquiries</Text>
            <Text style={styles.supportTipText}>
              If your account was temporarily locked or flagged for verification, our concierge team will assist you immediately.
            </Text>
          </View>
        </View>

        {/* Direct Concierge Contact Button */}
        <AppButton
          title="Contact Flint Concierge"
          variant="secondary"
          icon="chatbubbles"
          iconRight="open-outline"
          haptic={false}
          style={styles.conciergeContactBtn}
          onPress={() => {
            safeHaptic('medium');
            Linking.openURL('mailto:support@flint.dating?subject=Flint%20Login%20Assistance').catch(() => { });
          }}
          accessibilityLabel="Email Flint Concierge Support"
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    width: '100%',
    maxWidth: uiTheme.layout.formMax,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },

  // ── Brand Header ──
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACE.xxl,
  },
  emblemWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  emblemFrame: {
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    ...uiTheme.shadows.md,
  },
  emblemInner: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: alpha(COLORS.white, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemImg: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    ...TYPE.largeTitle,
    color: COLORS.text,
    textShadowColor: alpha(COLORS.primary, 0.45),
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  heroDialogue: {
    ...TYPE.bodyStrong,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACE.xs,
    maxWidth: 320,
    textShadowColor: alpha(COLORS.black, 0.65),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // ── Card ──
  card: {
    backgroundColor: alpha(COLORS.surface, 0.9),
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: RADIUS.xl,
    ...uiTheme.shadows.lg,
  },
  cardTitle: {
    ...TYPE.title,
    color: COLORS.text,
    marginBottom: SPACE.xs,
    textAlign: 'center',
  },
  cardSubtitle: {
    ...TYPE.callout,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACE.xxl,
  },

  // ── Input Fields ──
  inputGroup: {
    marginBottom: SPACE.lg,
  },
  inputLabel: {
    ...TYPE.label,
    color: COLORS.text,
    marginBottom: SPACE.sm,
  },
  fieldHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs + 2,
    marginTop: SPACE.sm,
    paddingLeft: SPACE.xxs,
  },
  fieldHintText: {
    ...TYPE.footnote,
    flex: 1,
    color: COLORS.muted,
  },

  // ── Domain Chips ──
  domainSection: {
    marginTop: SPACE.md,
  },
  domainLabel: {
    ...TYPE.caption,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.muted,
    marginBottom: SPACE.sm,
  },
  domainChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.elevated,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.input,
    height: uiTheme.layout.inputHeight,
    paddingLeft: SPACE.md + 2,
    paddingRight: SPACE.sm,
  },
  inputBoxFocused: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.elevatedHigh,
  },
  inputBoxError: {
    borderColor: COLORS.error,
  },
  inputIcon: {
    marginRight: SPACE.sm + 2,
  },
  textInput: {
    ...TYPE.body,
    lineHeight: undefined,
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
    paddingVertical: 0,
    height: '100%',
  },
  iconAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validIcon: {
    marginLeft: SPACE.xxs,
    marginRight: SPACE.xs,
  },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    minHeight: uiTheme.layout.touchTarget,
    justifyContent: 'center',
    paddingLeft: SPACE.md,
    marginTop: SPACE.xs,
    marginBottom: -SPACE.sm,
  },
  forgotPasswordText: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
  },

  // ── Primary CTA ──
  primaryButton: {
    marginTop: SPACE.sm,
  },
  primaryButtonMuted: {
    opacity: 0.7,
  },

  // ── Mandatory Consent Checkbox & Warning ──
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    minHeight: uiTheme.layout.touchTarget,
    paddingVertical: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  consentCheckboxRowError: {},
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  consentBoxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  consentBoxError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorSoft,
  },
  consentText: {
    ...TYPE.footnote,
    flex: 1,
    minWidth: 0,
    color: COLORS.textSecondary,
  },
  agreementWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.xs + 2,
    marginBottom: SPACE.md,
  },
  agreementWarningText: {
    ...TYPE.footnote,
    flex: 1,
    color: COLORS.error,
  },

  // ── Account Conflict Banner (Option 1 Inline Switcher) ──
  conflictBanner: {
    backgroundColor: COLORS.secondarySoft,
    borderWidth: 1,
    borderColor: COLORS.secondaryBorder,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    marginBottom: SPACE.lg,
    gap: SPACE.md,
  },
  conflictBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  conflictBannerTitle: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.text,
    flex: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.xs + 2,
    marginBottom: SPACE.md,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    ...TYPE.footnote,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.error,
    flexShrink: 1,
  },

  // ── Guest Link ──
  guestBottomLink: {
    alignItems: 'center',
    alignSelf: 'center',
    minHeight: uiTheme.layout.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    marginTop: SPACE.md,
  },
  guestBottomLinkText: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.textSecondary,
  },

  // ── Footer ──
  footerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACE.md,
    marginBottom: SPACE.xs,
  },
  footerText: {
    ...TYPE.callout,
    color: COLORS.textSecondary,
  },
  footerAction: {
    minHeight: uiTheme.layout.touchTarget,
    justifyContent: 'center',
  },
  footerActionText: {
    ...TYPE.callout,
    fontFamily: uiTheme.fonts.strong,
    color: COLORS.secondary,
  },

  // ── Legal & Links ──
  legalDisclaimerText: {
    ...TYPE.footnote,
    color: COLORS.muted,
    textAlign: 'center',
    paddingHorizontal: SPACE.sm,
  },
  legalLink: {
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
  },

  // ── Sheets (legal + support) ──
  modalTabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.md,
    padding: SPACE.xs,
    marginBottom: SPACE.lg,
  },
  modalTabBtn: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  modalTabBtnActive: {
    backgroundColor: COLORS.elevatedHigh,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  modalTabText: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.muted,
  },
  modalTabTextActive: {
    color: COLORS.text,
  },
  legalSection: {
    gap: SPACE.sm,
  },
  legalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  legalBadgeText: {
    ...TYPE.caption,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
    flex: 1,
  },
  legalParagraphHead: {
    ...TYPE.headline,
    color: COLORS.text,
    marginTop: SPACE.sm,
  },
  legalParagraph: {
    ...TYPE.callout,
    color: COLORS.textSecondary,
  },
  supportTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.lg,
    padding: SPACE.md + 2,
    marginBottom: SPACE.sm + 2,
    gap: SPACE.md,
  },
  supportTipBody: {
    flex: 1,
    minWidth: 0,
  },
  supportTipTitle: {
    ...TYPE.headline,
    color: COLORS.text,
    marginBottom: SPACE.xs,
  },
  supportTipText: {
    ...TYPE.footnote,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  conciergeContactBtn: {
    marginTop: SPACE.sm,
  },
});
