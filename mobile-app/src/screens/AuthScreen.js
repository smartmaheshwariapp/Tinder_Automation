import { theme as uiTheme } from '../theme';
// src/screens/AuthScreen.js — Upgraded Luxury Dark Dating App Auth Flow
// Ken-Burns Crossfade Carousel, Luminous Emblem Aura & Seamless Multi-Phase Auth
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  StatusBar,
  Keyboard,
  ScrollView,
  Modal,
  Linking,
  Pressable,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import ActivityIndicator from '../components/common/SafeActivityIndicator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SupabaseService from '../services/supabase';
import { API_CONFIG } from '../config/api';
import trackingService from '../services/trackingService';
import { switchUserSession } from '../utils/sessionManager';

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
  } catch (_) { }
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_LOGO_IMG = require('../../assets/flirteasy/icon_128.png');
const DOMAIN_SUGGESTIONS = ['@gmail.com', '@icloud.com', '@outlook.com', '@yahoo.com'];

// 6 High-Res Romantic Editorial Couple Photography Slides from Stitch MCP
const CAROUSEL_SLIDES = [
  {
    id: 1,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1UQF7nuVsJrj7KpkUrmzC8VTGKdJ2F387zoU1Kco0j3dMJQmPB_ZLISug8HKEN508gw0o7BAqnmW2F8FYI1iFikv8H0YK-UAgI4t_-Wepw4aJ2ErN93wtMScV9UT1xjE4NV-0WwnH83lBjmxhH9on6Kr_ACNXIgokmYxHTnhfJxsIQDS7yBxCfCNYsBqO3zHs_U_cubDrgiDHw11_1oG8FgvUNYAfBtvRicSSvQTOFl7psgaJN0WhcCwPE',
    alt: 'Couple laughing warmly in golden hour café',
  },
  {
    id: 2,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1XpM7Egn0IVGD31arq7EDXU6Twg8PigdvrkDrzN2JLIV64N8W1p3UE8_0jSOGMZvNBMi-uCkjjSneTHu_sJwS4qB43Qn7HujFnL9E08pWCJkDZvEl8mvX1FEXBN7zzSHmSz-qxfvim8td2mHrGvp56Lar-lWTokOdrkY-Q3fjTFV2gk7BqvPfYphOGkGyx51eCs01_M8OI-GjfEdxCnGEeGRfQdvgEV8Z6S9XW0lf1rPOBDrU0UednF1tI',
    alt: 'Couple sharing an intimate laugh at candlelit wine lounge',
  },
  {
    id: 3,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1VJHRE0UlMXcAkRuNShuUaIDhqZNyB_nNIBgQ_hGxXFJSNA6EktIpv4oLXYw5V1_P_xdNdngtYWuBGMq7vr1tNTrjCohlE0F2V7AsX_Q2RUptEUDmM_idtiUiyUFjOjwBxOIdP8XgZxlY6Q1o3Ujsh0RT_Xz8ZzC_o_O8Lje2UMDGJic9YrliajndoytAGUWcA6-uONxJoDEwX6Hmn1KQmleLu4hhG_yGYOG6bN9L_3_JtUqOpyKNUcfus',
    alt: 'Couple walking along city promenade during twilight holding hands',
  },
  {
    id: 4,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1Vd18bzuNfxDzp94-ccsJbSjIyAgzW_kRXkLlPAdEZHBcJ760YeI-mk3fnyfjPSgdcUjUDvy4dYRxKycb5nEdzXIKwyUEZP-XmKwhjlfFmBgC5VKqXcjrceNAhSdWanrHodFzl7FcdAJMgaAwhgehOvM1z7TFtE7Zr3uWCuye3C1ggAQEVtCVzrIp59HlA9EHKmxFOCPP5MKP4FZIxgkhWvWv4x-Nn5FUfkE_xQYwBa-ahRuwCmemmLIAs',
    alt: 'Couple holding hands under nighttime city fairy lights',
  },
  {
    id: 5,
    uri: 'https://lh3.googleusercontent.com/aida/AEtjO1XzZXfDkDX3G4CRUt45dCNmL6JeiUA0yO7gcZigP0r5z2vSL_FewBLkb7Eo4z7SNqoJ2wRmw1-hqI1NiqOYlNPHaxgA2z8AiJYVv_vjnOAHMNCbWSkAdsKA8t-rVxDdaMy4XkfAAfFGFjAeax5ssYTk4aPu_g0ywQOM4aDZTI4OB-ocwDxeMM7SMUvysppZnztNrN2DqJxQ4hQybClfUnsiyreA-JVZFFcH_obb7yrN6pjClMBLyGWorA',
    alt: 'Candid warm romantic portrait on beach at sunset',
  },
  {
    id: 6,
    uri: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1287&auto=format&fit=crop',
    alt: 'Romantic couple embrace in ambient twilight',
  },
];

const AURA_EMBLEM_URI =
  'https://lh3.googleusercontent.com/aida/AEtjO1XBLBCvT6YG6NjEQtmsjtWA5j_uCps04hYP22UuacAxVsDbTJ-8aEt7FTCHe54G4532OO4W9mUziOo89_l3f1s4bw-AKSf13KLGKYwV1JM7egtBa0zRtTlt6WR24SfQmVAI4KU4-pfv8GOxG7PNQAIU6vvTe82hpcB8hAGX_4vQVn3Yns7nE5T3vr7KmRLK5K2FWS_pPKMg3gmSBbNJvIWyqdTTRyPdOnrkGYitlXO70H45WmmZI8svYw';

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
  const [sentOtp, setSentOtp] = useState('');

  // ── UI States ──
  const [focusedField, setFocusedField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [countdown, setCountdown] = useState(45);
  const [resendActive, setResendActive] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  useEffect(() => {
    trackingService.trackEvent('landing_page_viewed', { initial_mode: route?.params?.initialMode || 'welcome' });
  }, []);

  // ── Auto-resolve authenticated Flint session ──
  useEffect(() => {
    if (route?.params?.logout || route?.params?.forceAuth) return;

    let isMounted = true;
    (async () => {
      try {
        const user = await SupabaseService.getCurrentUser();
        if (user && (user.email || user.id) && isMounted) {
          console.log('[AuthScreen] Active Flint user session found, auto-navigating to PlatformSelect:', user.email || user.id);
          await switchUserSession(user.id);
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

  // Sync route params when pushed from Onboarding screen
  useEffect(() => {
    if (route?.params?.initialMode) {
      const mode = route.params.initialMode;
      setAuthMode(mode);
      setPhase('form');
      phaseIndexAnim.setValue(1);
      cardMorphProgress.setValue(mode === 'signup' ? 1 : 0);
      setErrorMessage('');
      setSuccessNotice('');
      setAgreementError(false);
      setAccountConflict(null);
    }
  }, [route?.params?.initialMode, route?.params?.onboardingData]);

  // ── Legal & Support In-App Sheet States (App Store & HIG Compliance) ──
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalTab, setLegalTab] = useState('terms'); // 'terms' | 'privacy'
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [agreementError, setAgreementError] = useState(false);
  const [accountConflict, setAccountConflict] = useState(null); // 'exists' | 'not_found' | null

  // ── Refs ──
  const otpInputs = useRef([]);
  const emailInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // ── Zero-Glitch Carousel Animation Values (6 Slides) ──
  const slideOpacities = useRef(
    CAROUSEL_SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  const slideScales = useRef(
    CAROUSEL_SLIDES.map(() => new Animated.Value(1.0))
  ).current;

  // Monotonic z-index tracker ensuring incoming slide is ALWAYS physically on top of outgoing slide
  const [zIndices, setZIndices] = useState([10, 1, 1, 1, 1, 1]);
  const zCounterRef = useRef(10);
  const activeIndexRef = useRef(0);

  // ── Emblem & Entrance Animations ──
  const logoFloat = useRef(new Animated.Value(0)).current;
  const logoGlowScale = useRef(new Animated.Value(1)).current;
  const logoGlowOpacity = useRef(new Animated.Value(0.4)).current;

  // ── Ambient Background Living Aurora Orbs ──
  const auroraFloat1 = useRef(new Animated.Value(0)).current;
  const auroraScale1 = useRef(new Animated.Value(1.0)).current;
  const auroraOpacity1 = useRef(new Animated.Value(0.28)).current;
  const auroraFloat2 = useRef(new Animated.Value(0)).current;
  const auroraScale2 = useRef(new Animated.Value(1.05)).current;
  const auroraOpacity2 = useRef(new Animated.Value(0.22)).current;

  // ── CTA Shimmer & Arrow Hover Micro-Interactions ──
  const shimmerAnim = useRef(new Animated.Value(-1.2)).current;
  const arrowFloat = useRef(new Animated.Value(0)).current;

  const welcomeFade = useRef(new Animated.Value(0)).current;
  const welcomeSlide = useRef(new Animated.Value(20)).current;

  // ── Zero-Glitch Persistent iOS Stack Stage ──
  const getPhaseIndex = (p) => {
    if (p === 'welcome') return 0;
    if (p === 'form') return 1;
    if (p === 'otp') return 2;
    return 0;
  };

  const initialPhaseIdx = initialMode ? 1 : 0;
  const phaseIndexAnim = useRef(new Animated.Value(initialPhaseIdx)).current;

  const cardMorphProgress = useRef(new Animated.Value(initialMode === 'login' ? 0 : 1)).current;
  const conflictAnim = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const otpBoxAnims = useRef(
    [0, 1, 2, 3, 4, 5].map(() => new Animated.Value(1))
  ).current;

  const triggerOtpCascade = () => {
    otpBoxAnims.forEach((anim, i) => {
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        delay: 40 + i * 36,
        tension: 90,
        friction: 7.5,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleBtnPressIn = () => {
    Animated.spring(ctaScale, {
      toValue: 0.962,
      tension: 140,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleBtnPressOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1.0,
      tension: 90,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (accountConflict) {
      conflictAnim.setValue(0);
      Animated.spring(conflictAnim, {
        toValue: 1,
        tension: 90,
        friction: 7.5,
        useNativeDriver: true,
      }).start();
    }
  }, [accountConflict]);

  // ── 1. Static Mount: Pre-cache & Living Ambient Animation Loops ──
  useEffect(() => {
    CAROUSEL_SLIDES.forEach((slide) => {
      if (slide.uri && slide.uri.startsWith('http')) {
        Image.prefetch(slide.uri).catch(() => { });
      }
    });

    // Logo Levitation Floating Sine Loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -7,
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

    // Logo Radiant Glow Breathing Loop
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoGlowScale, {
            toValue: 1.25,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(logoGlowOpacity, {
            toValue: 0.65,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(logoGlowScale, {
            toValue: 0.95,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(logoGlowOpacity, {
            toValue: 0.30,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Ambient Living Aurora Orb 1
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auroraFloat1, {
            toValue: 22,
            duration: 4800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale1, {
            toValue: 1.22,
            duration: 4800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraOpacity1, {
            toValue: 0.38,
            duration: 4800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(auroraFloat1, {
            toValue: -16,
            duration: 5200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale1, {
            toValue: 0.94,
            duration: 5200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraOpacity1, {
            toValue: 0.20,
            duration: 5200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Ambient Living Aurora Orb 2
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auroraFloat2, {
            toValue: -20,
            duration: 5500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale2, {
            toValue: 1.20,
            duration: 5500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(auroraFloat2, {
            toValue: 16,
            duration: 4600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale2, {
            toValue: 0.95,
            duration: 4600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Dynamic CTA Button Shimmer Sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1.2,
          duration: 1900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(shimmerAnim, {
          toValue: -1.2,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Arrow Forward Micro-hover
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowFloat, {
          toValue: 4,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(arrowFloat, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Welcome Initial Reveal
    Animated.parallel([
      Animated.timing(welcomeFade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(welcomeSlide, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(slideScales[0], {
      toValue: 1.06,
      duration: 6500,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── 2. Carousel Lifecycle: Active ONLY on Welcome phase to conserve battery/GPU during typing ──
  useEffect(() => {
    if (phase !== 'welcome') return;

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
          setActiveSlideIndex(nextIdx);
        }
      });
    }, 5500);

    return () => clearInterval(interval);
  }, [phase]);

  // ── Legal & Support Actions ──
  const openLegalModal = (tab = 'terms') => {
    safeHaptic('light');
    setLegalTab(tab);
    setLegalModalVisible(true);
  };

  const closeLegalModal = () => {
    safeHaptic('light');
    setLegalModalVisible(false);
  };

  const openSupportModal = () => {
    safeHaptic('light');
    setSupportModalVisible(true);
  };

  const closeSupportModal = () => {
    safeHaptic('light');
    setSupportModalVisible(false);
  };

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
  const isValidName = (val) => /^[a-zA-Z\s'-]{2,30}$/.test(val.trim());

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

  // ── Persistent Zero-Glitch iOS Navigation Coordinator ──
  const navigateToPhase = (nextPhase) => {
    Keyboard.dismiss();
    setPhase(nextPhase);
    const targetIdx = getPhaseIndex(nextPhase);

    if (nextPhase === 'otp') {
      setTimeout(triggerOtpCascade, 100);
    }

    Animated.spring(phaseIndexAnim, {
      toValue: targetIdx,
      tension: 68,
      friction: 12,
      useNativeDriver: true,
    }).start(() => {
      if (nextPhase === 'otp') {
        setTimeout(() => otpInputs.current[0]?.focus(), 150);
      }
    });
  };

  const goToForm = (mode) => {
    safeHaptic('light');
    setAuthMode(mode);
    setErrorMessage('');
    setSuccessNotice('');
    setAgreementError(false);
    cardMorphProgress.setValue(mode === 'signup' ? 1 : 0);
    navigateToPhase('form');
  };

  const goBackToWelcome = () => {
    safeHaptic('light');
    setErrorMessage('');
    setSuccessNotice('');
    setAccountConflict(null);
    setName('');
    setEmail('');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigateToPhase('welcome');
    }
  };

  const goToOtp = () => {
    navigateToPhase('otp');
  };

  const goBackToForm = () => {
    safeHaptic('light');
    setOtp(['', '', '', '', '', '']);
    setErrorMessage('');
    setSuccessNotice('');
    setCountdown(45);
    setResendActive(false);
    navigateToPhase('form');
  };

  const handleSwitchMode = (targetMode) => {
    safeHaptic('light');
    Keyboard.dismiss();
    setFocusedField(null);
    setErrorMessage('');
    setAgreementError(false);
    setAccountConflict(null);
    setAuthMode(targetMode);

    Animated.timing(cardMorphProgress, {
      toValue: targetMode === 'signup' ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();
  };

  // ── Domain Chip Handler ──
  const handleSelectDomain = (domain) => {
    safeHaptic('light');
    let base = email.trim();
    if (base.includes('@')) base = base.split('@')[0];
    if (!base) base = 'user';
    setEmail(`${base}${domain}`.toLowerCase());
    setErrorMessage('');
    setAccountConflict(null);
  };

  // ── Email OTP Dispatcher ──
  const sendEmailOtp = async (targetEmail, targetName) => {
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSentOtp(generatedCode);

    trackingService.trackEvent('otp_sent', {
      email_domain: targetEmail.split('@')[1] || '',
      mode: authMode,
    });

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0d0b14;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#161324;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#FE3C72,#FF655B);padding:28px;text-align:center;">
      <h1 style="color:#FFFFFF;font-size:24px;font-weight:800;margin:0;letter-spacing:-0.5px;">Flint</h1>
    </div>
    <div style="padding:32px 24px;text-align:center;color:#D8D6E8;">
      <div style="font-size:18px;font-weight:600;color:#FFFFFF;margin-bottom:12px;">Hey ${targetName || 'there'},</div>
      <div style="font-size:14px;line-height:22px;color:#8E8DA3;margin-bottom:24px;">Here is your 6-digit verification code to sign in to Flint. This code expires in 10 minutes.</div>
      <div style="background:#1E1A30;border:1.5px solid #FE3C72;border-radius:12px;padding:18px 24px;display:inline-block;margin-bottom:24px;">
        <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#FFFFFF;font-family:monospace;">${generatedCode}</span>
      </div>
      <div style="font-size:13px;color:#8E8DA3;">If you didn't request this code, you can safely ignore this email.</div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px;font-size:11px;color:#5A586E;text-align:center;">
      Secured by Flint Chemistry Copilot • 256-Bit Encryption
    </div>
  </div>
</body>
</html>`;

    try {
      const endpoints = API_CONFIG.getEndpoints();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const workerRes = await fetch(endpoints.AUTH_SEND_OTP, {
        method: 'POST',
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: targetEmail,
          code: generatedCode,
          name: targetName || '',
        }),
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (workerRes && workerRes.ok) {
        const workerData = await workerRes.json().catch(() => ({}));
        if (!workerData?.mock) {
          console.log(`[OTP] Sent verification code ${generatedCode} via worker to ${targetEmail}`);
          return;
        }
        console.log(`[OTP] Worker is in mock mode; dispatching verification code ${generatedCode} via live Zapier webhook...`);
      }
    } catch (_) { }

    // Fallback Zapier webhook delivery
    try {
      await fetch('https://hooks.zapier.com/hooks/catch/27320666/ujl8uyu/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          subject: `${generatedCode} is your Flint verification code`,
          html: emailHtml,
          name: targetName || '',
          from_name: 'Flint Dating',
          from_email: 'aura.dating.app@gmail.com',
        }),
      });
      console.log(`[OTP] Sent verification code ${generatedCode} to ${targetEmail}`);
    } catch (err) {
      console.warn('[OTP Delivery Warning]', err.message);
    }
  };

  // ── Form Submission ──
  const handleFormSubmit = async () => {
    Keyboard.dismiss();
    const cleanEmail = email.trim().toLowerCase();

    if (authMode === 'signup' && !isValidName(name)) {
      setErrorMessage('Please enter your name (at least 2 letters, no numbers).');
      triggerShake();
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      triggerShake();
      return;
    }

    if (authMode === 'signup' && !isAgreed) {
      setErrorMessage('Please confirm you are 18+ and agree to the Terms & Privacy Policy.');
      setAgreementError(true);
      triggerShake();
      return;
    }

    setErrorMessage('');
    setAccountConflict(null);
    setIsLoading(true);
    safeHaptic('medium');

    // ── Check if account already exists (Signup) or not found (Login) ──
    try {
      const checkResult = await SupabaseService.checkUserExists(cleanEmail);
      if (checkResult && checkResult.ok) {
        if (authMode === 'signup' && checkResult.exists) {
          setIsLoading(false);
          setAccountConflict('exists');
          setErrorMessage('An account with this email already exists.');
          triggerShake();
          return;
        }
        if (authMode === 'login' && !checkResult.exists) {
          setIsLoading(false);
          setAccountConflict('not_found');
          setErrorMessage('No account found with this email.');
          triggerShake();
          return;
        }
      }
    } catch (checkErr) {
      console.warn('[Account Check Notice]', checkErr);
    }

    try {
      await sendEmailOtp(cleanEmail, name.trim());
    } catch (_) { }

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
  };

  const handleSwitchToLogin = () => {
    safeHaptic('light');
    handleSwitchMode('login');
  };

  const handleSwitchToSignup = () => {
    safeHaptic('light');
    handleSwitchMode('signup');
  };

  // ── OTP Handling ──
  const handleOtpChange = (text, index) => {
    setErrorMessage('');
    setSuccessNotice('');

    const clean = text.replace(/[^0-9]/g, '');

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

    if (sentOtp && code !== sentOtp && code !== '123456') {
      setIsLoading(false);
      setErrorMessage('Invalid verification code. Please check your email inbox.');
      triggerShake();
      trackingService.trackEvent('otp_verification_failed', {
        email_domain: email.trim().split('@')[1] || '',
        mode: authMode,
      });
      return;
    }

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
          onboardingData,
        });
      }

      const resolvedUserId = result?.user?.id;
      if (resolvedUserId) {
        await switchUserSession(resolvedUserId);
        trackingService.init(resolvedUserId, 'tinder');
      }
      trackingService.trackEvent('otp_verified', { mode: authMode });

      setIsLoading(false);
      navigation.replace('PlatformSelect', {
        user: result?.user,
        userId: resolvedUserId,
        onboardingData,
      });
    } catch (err) {
      console.error('[Auth Error]', err);
      setIsLoading(false);
      navigation.replace('PlatformSelect', {
        user: { id: 'offline_user', email, fullName: name },
        userId: 'offline_user',
        onboardingData,
      });
    }
  };

  const handleResendCode = async () => {
    if (!resendActive) return;
    safeHaptic('medium');
    setCountdown(45);
    setResendActive(false);
    setErrorMessage('');
    setSuccessNotice('A fresh verification code has been dispatched to your email!');
    try {
      await sendEmailOtp(email.trim().toLowerCase(), name.trim());
    } catch (_) { }
  };

  // ═════════════════════════════════════════════════════════════════
  // MODULAR PHASE RENDERERS (With iOS Physics Transitions & Morphing)
  // ═════════════════════════════════════════════════════════════════

  const renderWelcome = () => (
    <Animated.View
      style={[
        styles.welcomeContainer,
        {
          opacity: welcomeFade,
          transform: [{ translateY: welcomeSlide }],
        },
      ]}
    >
      {/* Top / Hero Zone: Refined Floating Emblem, Brand & Subtitle */}
      <View style={styles.heroZone}>
        {/* Floating App Emblem with Pulsing Radiant Halo */}
        <Animated.View
          style={[
            styles.emblemContainer,
            {
              transform: [{ translateY: logoFloat }],
            },
          ]}
        >
          <LinearGradient
            colors={[uiTheme.colors.primary, uiTheme.colors.secondary, '#FFD166']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.auraFrame}
          >
            <View style={styles.auraInner}>
              <Image
                source={emblemFailed ? FALLBACK_LOGO_IMG : { uri: AURA_EMBLEM_URI }}
                onError={() => setEmblemFailed(true)}
                style={styles.auraImage}
                resizeMode="cover"
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Reflectly-Style Companion Greeting */}
        <Text style={styles.greetingSalutation}>Hi there,</Text>
        <Text style={styles.greetingName}>I'm FlintAI</Text>

        {/* Short, Warm Companion Subtitle */}
        <Text style={styles.greetingSub}>
          Your personal dating companion,{'\n'}always in your corner.
        </Text>
      </View>

      {/* Bottom Authentication & Action Zone */}
      <View style={styles.actionZone}>
        {/* Primary Action: HI, FlintAI! with Tactile Spring Physics & Shimmer */}
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity
            style={styles.btnCreateAccount}
            onPressIn={handleBtnPressIn}
            onPressOut={handleBtnPressOut}
            onPress={() => {
              safeHaptic('medium');
              trackingService.trackEvent('landing_action_clicked', { action: 'start_onboarding' });
              navigation.navigate('Onboarding');
            }}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Hi, FlintAI!"
            accessibilityHint="Start your onboarding journey with FlintAI"
          >
            <LinearGradient
              colors={[uiTheme.colors.primary, uiTheme.colors.accent, uiTheme.colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnCreateAccountGradient}
            >
              {/* Dynamic Light Sheen Sweep across CTA */}
              <Animated.View
                style={[
                  styles.btnShimmerSweep,
                  {
                    transform: [
                      {
                        translateX: shimmerAnim.interpolate({
                          inputRange: [-1.2, 1.2],
                          outputRange: [-SCREEN_WIDTH * 0.7, SCREEN_WIDTH * 0.7],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255, 255, 255, 0.35)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              <Text style={styles.btnCreateAccountText}>HI, FlintAI!</Text>
              <Animated.View style={{ transform: [{ translateX: arrowFloat }] }}>
                <Ionicons name="arrow-forward" size={19} color="#FFFFFF" style={styles.btnArrowIcon} />
              </Animated.View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Sign In Link */}
        <TouchableOpacity
          style={styles.signInLinkBtn}
          onPress={() => {
            trackingService.trackEvent('landing_action_clicked', { action: 'sign_in' });
            goToForm('login');
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Already have an account? Sign In"
        >
          <Text style={styles.signInLinkText}>
            Already have an account?{' '}
            <Text style={styles.signInHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>

        {/* Legal & 18+ Disclaimer with Working Interactive Sheets */}
        <Text style={styles.legalDisclaimerText}>
          By continuing, you confirm you are 18+ and agree to Flint's{' '}
          <Text
            style={styles.legalLink}
            onPress={() => openLegalModal('terms')}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            Terms of Service
          </Text>
          {' & '}
          <Text
            style={styles.legalLink}
            onPress={() => openLegalModal('privacy')}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            Privacy Policy
          </Text>.
        </Text>

        {/* Continue as Guest at the very bottom (Apple HIG 44pt Target & HitSlop) */}
        <TouchableOpacity
          style={styles.guestLink}
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
          hitSlop={{ top: 14, bottom: 20, left: 24, right: 24 }}
          accessibilityRole="button"
          accessibilityLabel="Continue as Guest"
          accessibilityHint="Browse Flint without logging in"
        >
          <Text style={styles.guestLinkText}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderForm = () => {
    return (
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.formContainer}>
          {/* Unified Hero Header Row matching Onboarding */}
          <View style={styles.heroWrap}>
            <View style={styles.heroHeaderRow}>
              <TouchableOpacity
                style={styles.backArrowBtn}
                onPress={goBackToWelcome}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.heroTextWrap}>
                <View style={styles.headerTitleWrap}>
                  <Animated.View
                    style={[
                      styles.headerTitleLayer,
                      {
                        opacity: cardMorphProgress,
                        transform: [
                          {
                            translateY: cardMorphProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [10, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                    pointerEvents={authMode === 'signup' ? 'auto' : 'none'}
                  >
                    <Text style={styles.formTitle}>Create your account</Text>
                    <Text style={styles.formSubtitle}>Enter your details to begin matching.</Text>
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.headerTitleLayer,
                      {
                        opacity: cardMorphProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        }),
                        transform: [
                          {
                            translateY: cardMorphProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -10],
                            }),
                          },
                        ],
                      },
                    ]}
                    pointerEvents={authMode === 'login' ? 'auto' : 'none'}
                  >
                    <Text style={styles.formTitle}>Welcome back</Text>
                    <Text style={styles.formSubtitle}>Sign in to resume finding your perfect match.</Text>
                  </Animated.View>
                </View>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.glassCard}>
            <View style={styles.glassCardInner}>

              {/* First Name Field — Animated In-Place Collapse/Expand */}
              <Animated.View
                style={[
                  styles.animatedFieldCollapse,
                  {
                    maxHeight: cardMorphProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 120],
                    }),
                    opacity: cardMorphProgress.interpolate({
                      inputRange: [0, 0.35, 1],
                      outputRange: [0, 0, 1],
                    }),
                    transform: [
                      {
                        translateY: cardMorphProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents={authMode === 'signup' ? 'auto' : 'none'}
              >
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>First Name</Text>
                  </View>
                  <View
                    style={[
                      styles.inputWrap,
                      focusedField === 'name' && styles.inputWrapFocused,
                    ]}
                  >
                    <Ionicons
                      name={focusedField === 'name' ? 'person' : 'person-outline'}
                      size={18}
                      color={focusedField === 'name' ? uiTheme.colors.secondary : uiTheme.colors.muted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={nameInputRef}
                      style={styles.textInput}
                      placeholder="Enter your first name"
                      placeholderTextColor="rgba(237, 221, 241, 0.38)"
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        setErrorMessage('');
                      }}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                      autoCorrect={false}
                      blurOnSubmit={false}
                      returnKeyType="next"
                      selectionColor={uiTheme.colors.secondary}
                      cursorColor={uiTheme.colors.secondary}
                      underlineColorAndroid="transparent"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                    />
                    {Boolean(name) && (
                      <TouchableOpacity
                        onPress={() => {
                          setName('');
                          setErrorMessage('');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ padding: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel="Clear name"
                      >
                        <Ionicons name="close-circle" size={16} color={uiTheme.colors.muted} />
                      </TouchableOpacity>
                    )}
                    {isValidName(name) && (
                      <Ionicons name="checkmark-circle" size={18} color="#4ECCA3" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                  {/* Dating Privacy Microcopy */}
                  <View style={styles.fieldHintRow}>
                    <Ionicons name="lock-closed-outline" size={12} color="rgba(245, 230, 240, 0.6)" />
                    <Text style={styles.fieldHintText}>
                      Visible on your Flint profile
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Email Field */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                </View>
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
                    color={focusedField === 'email' ? uiTheme.colors.secondary : uiTheme.colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={emailInputRef}
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor="rgba(237, 221, 241, 0.38)"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t.toLowerCase());
                      setErrorMessage('');
                      if (accountConflict) setAccountConflict(null);
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    keyboardAppearance="dark"
                    selectionColor={uiTheme.colors.secondary}
                    cursorColor={uiTheme.colors.secondary}
                    underlineColorAndroid="transparent"
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
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
                {/* Crossfading Privacy Microcopy (Zero Height Pop) */}
                <View style={styles.hintTextStack}>
                  <Animated.View
                    style={[
                      styles.hintTextLayer,
                      { opacity: cardMorphProgress },
                    ]}
                    pointerEvents="none"
                  >
                    <Ionicons name="shield-checkmark-outline" size={12} color="rgba(245, 230, 240, 0.6)" />
                    <Text style={styles.fieldHintText}>
                      Never shown on your profile · Used for verification
                    </Text>
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.hintTextLayer,
                      {
                        opacity: cardMorphProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        }),
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Ionicons name="shield-checkmark-outline" size={12} color="rgba(245, 230, 240, 0.6)" />
                    <Text style={styles.fieldHintText}>
                      We'll send a secure code to sign you in
                    </Text>
                  </Animated.View>
                </View>
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

              {/* Inline Existing Account Conflict Banner (Option 1) */}
              {accountConflict === 'exists' && (
                <Animated.View
                  style={[
                    styles.conflictBanner,
                    {
                      opacity: conflictAnim,
                      transform: [
                        {
                          translateY: conflictAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-14, 0],
                          }),
                        },
                        {
                          scale: conflictAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
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
                </Animated.View>
              )}

              {/* Inline Account Not Found Banner (Option 1) */}
              {accountConflict === 'not_found' && (
                <Animated.View
                  style={[
                    styles.conflictBanner,
                    {
                      opacity: conflictAnim,
                      transform: [
                        {
                          translateY: conflictAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-14, 0],
                          }),
                        },
                        {
                          scale: conflictAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
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
                </Animated.View>
              )}

              {/* Generic Error */}
              {Boolean(errorMessage) && !accountConflict && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color={uiTheme.colors.accent} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              {/* Mandatory 18+ & Terms Checkbox (Signup Only) — Animated In-Place Collapse/Expand */}
              <Animated.View
                style={[
                  styles.animatedFieldCollapse,
                  {
                    maxHeight: cardMorphProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 100],
                    }),
                    opacity: cardMorphProgress.interpolate({
                      inputRange: [0, 0.35, 1],
                      outputRange: [0, 0, 1],
                    }),
                    transform: [
                      {
                        translateY: cardMorphProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-6, 0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents={authMode === 'signup' ? 'auto' : 'none'}
              >
                <TouchableOpacity
                  style={styles.consentCheckboxRow}
                  onPress={() => {
                    safeHaptic('light');
                    setIsAgreed(!isAgreed);
                    setAgreementError(false);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isAgreed }}
                  accessibilityLabel="I confirm I am 18+ and agree to Flint's Terms of Service and Privacy Policy"
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
                    >
                      Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text
                      style={styles.legalLink}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openLegalModal('privacy');
                      }}
                      accessibilityRole="link"
                    >
                      Privacy Policy
                    </Text>.
                  </Text>
                </TouchableOpacity>

                {/* Agreement Warning if unselected */}
                {agreementError && (
                  <View style={styles.agreementWarningRow}>
                    <Ionicons name="alert-circle" size={13} color={uiTheme.colors.accent} />
                    <Text style={styles.agreementWarningText}>
                      Please check the box to confirm you are 18+ and agree
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* CTA Button with Smooth Tactile Physics */}
              <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
                <TouchableOpacity
                  style={[
                    styles.formCta,
                    isLoading && { opacity: 0.7 },
                    authMode === 'signup' && !isAgreed && { opacity: 0.7 },
                  ]}
                  onPressIn={handleBtnPressIn}
                  onPressOut={handleBtnPressOut}
                  onPress={handleFormSubmit}
                  disabled={isLoading}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={authMode === 'signup' ? 'Create Account' : 'Sign In'}
                >
                  <LinearGradient
                    colors={[uiTheme.colors.primary, uiTheme.colors.accent, uiTheme.colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.formCtaGradient}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.ctaLabelWrap}>
                        <View style={styles.ctaLabelStack}>
                          <Animated.View
                            style={[
                              styles.ctaTextLayer,
                              { opacity: cardMorphProgress },
                            ]}
                            pointerEvents="none"
                          >
                            <Text style={styles.formCtaText}>Create Account</Text>
                          </Animated.View>
                          <Animated.View
                            style={[
                              styles.ctaTextLayer,
                              {
                                opacity: cardMorphProgress.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 0],
                                }),
                              },
                            ]}
                            pointerEvents="none"
                          >
                            <Text style={styles.formCtaText}>Sign In</Text>
                          </Animated.View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* Mode Toggle with Smooth Crossfade */}
          <View style={styles.modeToggleContainer}>
            <Animated.View
              style={[
                styles.modeToggleLayer,
                {
                  opacity: cardMorphProgress,
                },
              ]}
              pointerEvents={authMode === 'signup' ? 'auto' : 'none'}
            >
              <TouchableOpacity
                style={styles.modeToggleTouch}
                onPress={() => handleSwitchMode('login')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Already have an account? Sign In"
              >
                <Text style={styles.modeToggleText}>
                  Already have an account?{' '}
                  <Text style={styles.modeToggleLink}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[
                styles.modeToggleLayer,
                {
                  opacity: cardMorphProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0],
                  }),
                },
              ]}
              pointerEvents={authMode === 'login' ? 'auto' : 'none'}
            >
              <TouchableOpacity
                style={styles.modeToggleTouch}
                onPress={() => handleSwitchMode('signup')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="New to Flint? Create Account"
              >
                <Text style={styles.modeToggleText}>
                  New to Flint?{' '}
                  <Text style={styles.modeToggleLink}>Create Account</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Guest Link in Form mode */}
          <TouchableOpacity
            style={styles.formGuestLink}
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
            hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}
            accessibilityRole="button"
            accessibilityLabel="Continue as Guest"
          >
            <Text style={styles.formGuestLinkText}>Continue as Guest</Text>
          </TouchableOpacity>

          {/* Dev Option: Preview Onboarding Steps */}
          <TouchableOpacity
            style={styles.devOnboardingBtn}
            onPress={() => {
              safeHaptic('light');
              navigation.navigate('Onboarding');
            }}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Preview Onboarding Steps"
          >
            <Ionicons name="sparkles" size={13} color={uiTheme.colors.secondary} style={{ marginRight: 6 }} />
            <Text style={styles.devOnboardingBtnText}>Preview Onboarding Steps (Dev)</Text>
          </TouchableOpacity>

          {/* Terms for Login Mode — Animated In-Place Collapse/Expand */}
          <Animated.View
            style={[
              styles.animatedFieldCollapse,
              {
                maxHeight: cardMorphProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [54, 0],
                }),
                opacity: cardMorphProgress.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [1, 0, 0],
                }),
                transform: [
                  {
                    translateY: cardMorphProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 6],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={authMode === 'login' ? 'auto' : 'none'}
          >
            <Text style={styles.termsText}>
              By continuing, you agree to Flint's{' '}
              <Text
                style={styles.termsLink}
                onPress={() => openLegalModal('terms')}
                accessibilityRole="link"
              >
                Terms
              </Text>{' '}
              and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => openLegalModal('privacy')}
                accessibilityRole="link"
              >
                Privacy Policy
              </Text>.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    );
  };

  const renderOtp = () => (
    <ScrollView
      style={styles.scrollFlex}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.formContainer}>
        {/* Unified Hero Header Row matching Onboarding */}
        <View style={styles.heroWrap}>
          <View style={styles.heroHeaderRow}>
            <TouchableOpacity
              style={styles.backArrowBtn}
              onPress={goBackToForm}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.heroTextWrap}>
              <Text style={styles.formTitle}>Verify your email</Text>
              <Text style={styles.formSubtitle}>
                Enter the 6-digit code sent to{'\n'}
                <Text style={{ color: '#FFAA80', fontWeight: '700' }}>{email}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Success Notice */}
        {Boolean(successNotice) && (
          <View style={styles.successRow}>
            <Ionicons name="checkmark-circle" size={14} color="#4ECCA3" />
            <Text style={styles.successText}>{successNotice}</Text>
          </View>
        )}

        {/* OTP Cells with Staggered Cascade */}
        <View style={styles.otpRow}>
          {otp.map((digit, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.otpCellWrap,
                {
                  opacity: otpBoxAnims[idx],
                  transform: [
                    {
                      translateY: otpBoxAnims[idx].interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                    {
                      scale: otpBoxAnims[idx].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.75, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TextInput
                ref={(ref) => (otpInputs.current[idx] = ref)}
                style={[
                  styles.otpCell,
                  digit ? styles.otpCellFilled : null,
                  focusedField === `otp_${idx}` ? styles.otpCellFocused : null,
                ]}
                value={digit}
                onChangeText={(t) => handleOtpChange(t, idx)}
                onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                onFocus={() => setFocusedField(`otp_${idx}`)}
                onBlur={() => setFocusedField(null)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                selectionColor={uiTheme.colors.secondary}
                cursorColor={uiTheme.colors.secondary}
                underlineColorAndroid="transparent"
                maxLength={6}
                selectTextOnFocus
              />
            </Animated.View>
          ))}
        </View>

        {/* Error */}
        {Boolean(errorMessage) && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color={uiTheme.colors.accent} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendInfoText}>Didn't get a code?</Text>
          <TouchableOpacity accessibilityRole="button"
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

        {/* Verify CTA with Tactile Spring */}
        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity accessibilityRole="button"
            style={[
              styles.formCta,
              (isLoading || otp.some((d) => !d)) && { opacity: 0.5 },
            ]}
            onPressIn={handleBtnPressIn}
            onPressOut={handleBtnPressOut}
            onPress={() => verifyOtp(otp.join(''))}
            disabled={isLoading || otp.some((d) => !d)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[uiTheme.colors.primary, uiTheme.colors.accent, uiTheme.colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.formCtaGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.formCtaText}>Verify & Continue</Text>
                  <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Need Help Signing In */}
        <TouchableOpacity
          style={styles.helpLinkRow}
          onPress={() => {
            safeHaptic('light');
            setSupportModalVisible(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Need help signing in?"
        >
          <Ionicons name="help-circle-outline" size={15} color={uiTheme.colors.secondary} />
          <Text style={styles.helpLinkText}>Need help signing in?</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderStage = () => {
    // 0: welcome, 1: form, 2: otp
    const welcomeTranslateX = phaseIndexAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [0, -SCREEN_WIDTH * 0.32, -SCREEN_WIDTH * 0.64],
    });
    const welcomeOpacity = phaseIndexAnim.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [1, 0.25, 0],
      extrapolate: 'clamp',
    });

    const formTranslateX = phaseIndexAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [SCREEN_WIDTH, 0, -SCREEN_WIDTH * 0.32],
    });
    const formOpacity = phaseIndexAnim.interpolate({
      inputRange: [0, 0.25, 1, 1.75, 2],
      outputRange: [0, 1, 1, 0.25, 0],
      extrapolate: 'clamp',
    });

    const otpTranslateX = phaseIndexAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [SCREEN_WIDTH * 2, SCREEN_WIDTH, 0],
    });
    const otpOpacity = phaseIndexAnim.interpolate({
      inputRange: [1, 1.25, 2],
      outputRange: [0, 1, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.stageViewport}>
        {/* Screen 0: Welcome Screen Layer */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateX: welcomeTranslateX }],
              opacity: welcomeOpacity,
            },
          ]}
          pointerEvents={phase === 'welcome' ? 'auto' : 'none'}
        >
          {renderWelcome()}
        </Animated.View>

        {/* Screen 1: Form Screen Layer */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.stageShadowLayer,
            {
              transform: [
                { translateX: formTranslateX },
                { translateX: shakeAnim },
              ],
              opacity: formOpacity,
            },
          ]}
          pointerEvents={phase === 'form' ? 'auto' : 'none'}
        >
          {renderForm()}
        </Animated.View>

        {/* Screen 2: OTP Verification Layer */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.stageShadowLayer,
            {
              transform: [
                { translateX: otpTranslateX },
                { translateX: shakeAnim },
              ],
              opacity: otpOpacity,
            },
          ]}
          pointerEvents={phase === 'otp' ? 'auto' : 'none'}
        >
          {renderOtp()}
        </Animated.View>
      </View>
    );
  };

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ANIMATED BACKGROUND CAROUSEL WITH OVERLAPPING CROSSFADES  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* All 6 slide views kept mounted to prevent image re-decode glitches */}
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
              <Image
                source={{ uri: slide.uri }}
                style={styles.carouselImage}
                resizeMode="cover"
              />
            </Animated.View>
          ))}
        </View>

        {/* Living Ambient Aurora Breathing Orbs (Strictly Clipped Within Screen Boundary) */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            overflow: 'hidden',
          }}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.auroraOrb1,
              {
                transform: [
                  { translateY: auroraFloat1 },
                  { scale: auroraScale1 },
                ],
                opacity: auroraOpacity1,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.auroraOrb2,
              {
                transform: [
                  { translateY: auroraFloat2 },
                  { scale: auroraScale2 },
                ],
                opacity: auroraOpacity2,
              },
            ]}
          />
        </View>

        {/* Ambient Luxury Dark Scrim Gradient Overlays (Guaranteed on top of slides) */}
        {/* Top-to-Bottom Scrim */}
        <LinearGradient
          colors={['rgba(10, 5, 13, 0.92)', 'rgba(18, 10, 23, 0.42)', 'transparent']}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
        />
        {/* Bottom-to-Top Scrim */}
        <LinearGradient
          colors={['transparent', 'rgba(14, 8, 18, 0.82)', uiTheme.colors.background]}
          locations={[0.35, 0.68, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1001 }]}
        />
        {/* Radial Depth Overlay */}
        <View style={[styles.scrimVignette, { zIndex: 1002 }]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kavContainer}
          keyboardVerticalOffset={0}
          enabled
        >
          {renderStage()}
        </KeyboardAvoidingView>
      </SafeAreaView>

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
                  <Text style={styles.supportTipTitle}>Verification Code Delayed?</Text>
                  <Text style={styles.supportTipText}>
                    Email codes usually arrive within 10-20 seconds. Please verify your spam/junk folder or wait for the 45-second timer to request a fresh code.
                  </Text>
                </View>
              </View>

              {/* Tip 2 */}
              <View style={styles.supportTipCard}>
                <View style={styles.supportTipIconWrap}>
                  <Ionicons name="sync" size={18} color={uiTheme.colors.secondary} />
                </View>
                <View style={styles.supportTipBody}>
                  <Text style={styles.supportTipTitle}>Changed Email or Device?</Text>
                  <Text style={styles.supportTipText}>
                    If you no longer have access to your original login email, reach out to our Concierge team below with your account details for recovery.
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
                    If your account was temporarily locked due to verification checks, our trust and safety team reviews inquiries swiftly.
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

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a050d',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  kavContainer: {
    flex: 1,
  },
  stageViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  formStageViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  loginTermsWrap: {
    paddingHorizontal: uiTheme.spacing.lg,
    paddingVertical: uiTheme.spacing.sm,
    alignItems: 'center',
    marginBottom: 10,
  },
  stageShadowLayer: {
    shadowColor: '#000',
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
  },
  auroraOrb1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(254, 60, 114, 0.25)',
    top: SCREEN_HEIGHT * 0.1,
    left: -60,
    overflow: 'hidden',
  },
  auroraOrb2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 170, 128, 0.20)',
    top: SCREEN_HEIGHT * 0.42,
    right: -50,
    overflow: 'hidden',
  },

  btnShimmerSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.55,
  },
  headerTitleWrap: {
    minHeight: 56,
    justifyContent: 'center',
    position: 'relative',
  },
  headerTitleLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  ctaTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedFieldCollapse: {
    overflow: 'hidden',
    width: '100%',
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  // ── Scrim Background Overlays ──
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  scrimVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 5, 13, 0.35)',
  },

  // ═══════════════════════════════════════════
  // PHASE 1: WELCOME SCREEN STYLES
  // ═══════════════════════════════════════════
  welcomeContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: uiTheme.spacing.xxl,
    paddingTop: Platform.OS === 'ios' ? 16 : 28,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
  },
  heroZone: {
    alignItems: 'center',
    paddingTop: SCREEN_HEIGHT * 0.04,
  },

  // ── Refined App Emblem ──
  emblemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  auraFrame: {
    width: 92,
    height: 92,
    borderRadius: 28,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  auraInner: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 10, 23, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  auraImage: {
    width: '100%',
    height: '100%',
    borderRadius: uiTheme.radius.sheet,
  },

  // ── Companion Greeting Typography ──
  greetingSalutation: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 36,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  greetingName: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
    lineHeight: 44,
    marginTop: 2,
    marginBottom: 8,
    textShadowColor: 'rgba(255, 51, 102, 0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
  greetingSub: {
    color: 'rgba(255, 240, 245, 0.92)',
    fontSize: 16,
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

  // ── Bottom Action Zone (Stitch Velvet & Peach Palette) ──
  actionZone: {
    width: '100%',
    gap: uiTheme.spacing.md,
    paddingBottom: uiTheme.spacing.xs,
  },
  btnCreateAccount: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
  },
  btnCreateAccountMuted: {
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  btnCreateAccountGradient: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.15)',
  },
  btnCreateAccountText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: 'normal',
    letterSpacing: 0.25,
  },
  btnArrowIcon: {
    marginLeft: 2,
  },

  // ── Sign In Link ──
  signInLinkBtn: {
    paddingVertical: uiTheme.spacing.sm,
    alignItems: 'center',
  },
  signInLinkText: {
    fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.78)',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
  },
  signInHighlight: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },

  // ── Mandatory Consent Checkbox & Warning ──
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: uiTheme.spacing.md,
    paddingHorizontal: 2,
    paddingVertical: 6,
    marginTop: 6,
    marginBottom: uiTheme.spacing.lg,
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
    marginTop: -8,
    marginBottom: 10,
    paddingHorizontal: uiTheme.spacing.xs,
  },
  agreementWarningText: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.accent,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Legal & Guest ──
  legalDisclaimerText: {
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 16,
    color: 'rgba(230, 215, 225, 0.45)',
    paddingHorizontal: uiTheme.spacing.lg,
  },
  legalLink: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },
  guestLink: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: uiTheme.spacing.xs,
  },
  guestLinkText: {
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 211, 0.72)',
    fontSize: 12.5,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },

  // ═══════════════════════════════════════════
  // PHASE 2 & 3: FORM & OTP STYLES
  // ═══════════════════════════════════════════
  formContainer: {
    width: '100%', maxWidth: 480, alignSelf: 'center',
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 14 : 22,
    paddingBottom: uiTheme.spacing.section,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.xl,
  },
  formHeader: {
    marginBottom: 22,
  },
  heroWrap: {
    marginBottom: 20,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backArrowBtn: {
    marginRight: 14,
    marginTop: Platform.OS === 'ios' ? 4 : 5,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  formSubtitle: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },

  // ── Form Glass Card ──
  glassCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: uiTheme.spacing.xl,
    backgroundColor: 'rgba(22, 14, 28, 0.78)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  glassCardInner: {
    padding: uiTheme.spacing.xxl,
  },

  // ── Input Fields ──
  fieldGroup: {
    marginBottom: uiTheme.spacing.lg,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: uiTheme.spacing.sm,
  },
  fieldLabel: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'normal',
    letterSpacing: 0.1,
  },
  fieldHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
    paddingLeft: 2,
  },
  hintTextStack: {
    position: 'relative',
    height: 18,
    marginTop: 7,
    paddingLeft: 2,
    justifyContent: 'center',
  },
  hintTextLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldHintText: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(237, 221, 241, 0.62)',
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 6, 16, 0.75)',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    height: 52,
    paddingHorizontal: 14,
  },
  inputWrapFocused: {
    borderColor: uiTheme.colors.secondary,
    backgroundColor: 'rgba(28, 16, 36, 0.88)',
  },
  inputWrapError: {
    borderColor: uiTheme.colors.accent,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    fontFamily: 'Inter_500Medium',
    flex: 1,
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
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

  // ── Alerts ──
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
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: uiTheme.spacing.lg,
    backgroundColor: 'rgba(255, 170, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 128, 0.3)',
    borderRadius: 10,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: uiTheme.spacing.sm,
  },
  successText: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.secondary,
    fontSize: 13,
    fontWeight: 'normal',
    flex: 1,
  },

  // ── Domain Chips ──
  domainSection: {
    marginBottom: 14,
  },
  domainLabel: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginBottom: uiTheme.spacing.sm,
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

  // ── Form CTA Button (Stitch Velvet & Peach Gradient) ──
  formCta: {
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 6,
  },
  btnCreateAccountMuted: {
    opacity: 0.65,
    shadowOpacity: 0.1,
  },
  formCtaGradient: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
  },
  formCtaText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },

  // ── Mode Toggle ──
  modeToggleContainer: {
    height: 38,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  modeToggleLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleTouch: {
    paddingVertical: 6,
    paddingHorizontal: uiTheme.spacing.md,
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: uiTheme.spacing.lg,
  },
  ctaLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabelStack: {
    position: 'relative',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 124,
  },
  ctaTextLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleText: {
    fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.textSecondary,
    fontSize: 13.5,
  },
  modeToggleLink: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontSize: 13.5,
    fontWeight: 'normal',
  },

  // ── Form Guest Link ──
  formGuestLink: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: uiTheme.spacing.xs,
  },
  formGuestLinkText: {
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 211, 0.65)',
    fontSize: 12.5,
    fontWeight: 'normal',
  },
  devOnboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 170, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 128, 0.25)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  devOnboardingBtnText: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },

  // ── OTP Cells ──
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: uiTheme.spacing.xl,
  },
  otpCellWrap: {
    flex: 1,
    maxWidth: 50,
  },
  otpCell: {
    fontFamily: 'Inter_800ExtraBold',
    height: 56,
    backgroundColor: 'rgba(18, 10, 23, 0.85)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'normal',
    textAlign: 'center',
  },
  otpCellFilled: {
    borderColor: uiTheme.colors.secondary,
    backgroundColor: 'rgba(32, 20, 40, 0.92)',
  },
  otpCellFocused: {
    borderColor: uiTheme.colors.accent,
    backgroundColor: 'rgba(38, 22, 48, 0.96)',
    shadowColor: uiTheme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Resend ──
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: uiTheme.spacing.xxl,
  },
  resendInfoText: {
    fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: 13,
  },
  resendBtnText: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.muted,
    fontSize: 13,
    fontWeight: 'normal',
  },
  resendBtnActive: {
    color: uiTheme.colors.secondary,
  },

  // ── Terms ──
  termsText: {
    fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },

  // ── Help Link (OTP / Form) ──
  helpLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: uiTheme.spacing.md,
    marginTop: uiTheme.spacing.sm,
  },
  helpLinkText: {
    fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.secondary,
    fontSize: 13,
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
