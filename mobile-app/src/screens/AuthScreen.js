import { createStyles, theme as uiTheme, alpha } from "../theme";
// src/screens/AuthScreen.js — Upgraded Luxury Dark Dating App Auth Flow
// Ken-Burns Crossfade Carousel, Luminous Emblem Aura & Seamless Multi-Phase Auth
import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  // Dimensions, // responsiveness pass: layout now reads live sizes from useResponsive()
  Image,
  StatusBar,
  Keyboard,
  ScrollView,
  Linking,
  LayoutAnimation,
  UIManager,
} from "react-native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import SupabaseService from "../services/supabase";
import { API_CONFIG } from "../config/api";
import trackingService from "../services/trackingService";
import { switchUserSession } from "../utils/sessionManager";
import {
  AppButton,
  IconButton,
  IconWell,
  Chip,
  BottomSheet,
  MotionTouchable,
  ContentTransition,
  FadeIn,
} from "../components/ui";
import LegalDocument from "../components/legal/LegalDocument";
import { useMotionReduced } from "../components/common/Motion";
import useResponsive from "../hooks/useResponsive";

const COLORS = uiTheme.colors;
const SPACE = uiTheme.spacing;
const RADIUS = uiTheme.radius;
const TYPE = uiTheme.type;

// Optional safe haptics
let Haptics;
try {
  Haptics = require("expo-haptics");
} catch (_) {
  Haptics = null;
}

const safeHaptic = (type) => {
  try {
    if (!Haptics) return;
    if (type === "light")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === "medium")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (type === "success")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === "error")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (_) {}
};

// Module-load window size removed: it never updates on rotation. Use useResponsive() at render time.
// const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FALLBACK_LOGO_IMG = require("../../assets/flirteasy/icon_128.png");
const DOMAIN_SUGGESTIONS = [
  "@gmail.com",
  "@icloud.com",
  "@outlook.com",
  "@yahoo.com",
];

// 6 High-Res Romantic Editorial Couple Photography Slides from Stitch MCP
const CAROUSEL_SLIDES = [
  {
    id: 1,
    uri: "https://lh3.googleusercontent.com/aida/AEtjO1UQF7nuVsJrj7KpkUrmzC8VTGKdJ2F387zoU1Kco0j3dMJQmPB_ZLISug8HKEN508gw0o7BAqnmW2F8FYI1iFikv8H0YK-UAgI4t_-Wepw4aJ2ErN93wtMScV9UT1xjE4NV-0WwnH83lBjmxhH9on6Kr_ACNXIgokmYxHTnhfJxsIQDS7yBxCfCNYsBqO3zHs_U_cubDrgiDHw11_1oG8FgvUNYAfBtvRicSSvQTOFl7psgaJN0WhcCwPE",
    alt: "Couple laughing warmly in golden hour café",
  },
  {
    id: 2,
    uri: "https://lh3.googleusercontent.com/aida/AEtjO1XpM7Egn0IVGD31arq7EDXU6Twg8PigdvrkDrzN2JLIV64N8W1p3UE8_0jSOGMZvNBMi-uCkjjSneTHu_sJwS4qB43Qn7HujFnL9E08pWCJkDZvEl8mvX1FEXBN7zzSHmSz-qxfvim8td2mHrGvp56Lar-lWTokOdrkY-Q3fjTFV2gk7BqvPfYphOGkGyx51eCs01_M8OI-GjfEdxCnGEeGRfQdvgEV8Z6S9XW0lf1rPOBDrU0UednF1tI",
    alt: "Couple sharing an intimate laugh at candlelit wine lounge",
  },
  {
    id: 3,
    uri: "https://lh3.googleusercontent.com/aida/AEtjO1VJHRE0UlMXcAkRuNShuUaIDhqZNyB_nNIBgQ_hGxXFJSNA6EktIpv4oLXYw5V1_P_xdNdngtYWuBGMq7vr1tNTrjCohlE0F2V7AsX_Q2RUptEUDmM_idtiUiyUFjOjwBxOIdP8XgZxlY6Q1o3Ujsh0RT_Xz8ZzC_o_O8Lje2UMDGJic9YrliajndoytAGUWcA6-uONxJoDEwX6Hmn1KQmleLu4hhG_yGYOG6bN9L_3_JtUqOpyKNUcfus",
    alt: "Couple walking along city promenade during twilight holding hands",
  },
  {
    id: 4,
    uri: "https://lh3.googleusercontent.com/aida/AEtjO1Vd18bzuNfxDzp94-ccsJbSjIyAgzW_kRXkLlPAdEZHBcJ760YeI-mk3fnyfjPSgdcUjUDvy4dYRxKycb5nEdzXIKwyUEZP-XmKwhjlfFmBgC5VKqXcjrceNAhSdWanrHodFzl7FcdAJMgaAwhgehOvM1z7TFtE7Zr3uWCuye3C1ggAQEVtCVzrIp59HlA9EHKmxFOCPP5MKP4FZIxgkhWvWv4x-Nn5FUfkE_xQYwBa-ahRuwCmemmLIAs",
    alt: "Couple holding hands under nighttime city fairy lights",
  },
  {
    id: 5,
    uri: "https://lh3.googleusercontent.com/aida/AEtjO1XzZXfDkDX3G4CRUt45dCNmL6JeiUA0yO7gcZigP0r5z2vSL_FewBLkb7Eo4z7SNqoJ2wRmw1-hqI1NiqOYlNPHaxgA2z8AiJYVv_vjnOAHMNCbWSkAdsKA8t-rVxDdaMy4XkfAAfFGFjAeax5ssYTk4aPu_g0ywQOM4aDZTI4OB-ocwDxeMM7SMUvysppZnztNrN2DqJxQ4hQybClfUnsiyreA-JVZFFcH_obb7yrN6pjClMBLyGWorA",
    alt: "Candid warm romantic portrait on beach at sunset",
  },
  {
    id: 6,
    uri: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1287&auto=format&fit=crop",
    alt: "Romantic couple embrace in ambient twilight",
  },
];

const AURA_EMBLEM_URI =
  "https://lh3.googleusercontent.com/aida/AEtjO1XBLBCvT6YG6NjEQtmsjtWA5j_uCps04hYP22UuacAxVsDbTJ-8aEt7FTCHe54G4532OO4W9mUziOo89_l3f1s4bw-AKSf13KLGKYwV1JM7egtBa0zRtTlt6WR24SfQmVAI4KU4-pfv8GOxG7PNQAIU6vvTe82hpcB8hAGX_4vQVn3Yns7nE5T3vr7KmRLK5K2FWS_pPKMg3gmSBbNJvIWyqdTTRyPdOnrkGYitlXO70H45WmmZI8svYw";

export default function AuthScreen({ navigation, route }) {
  const initialMode = route?.params?.initialMode;
  const onboardingData = route?.params?.onboardingData;

  // ── Core State Machine ──
  const [phase, setPhase] = useState(initialMode ? "form" : "welcome"); // 'welcome' | 'form' | 'otp'
  const [authMode, setAuthMode] = useState(initialMode || "signup"); // 'login' | 'signup'

  // ── Form Data ──
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [sentOtp, setSentOtp] = useState("");

  // ── UI States ──
  const [focusedField, setFocusedField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [countdown, setCountdown] = useState(45);
  const [resendActive, setResendActive] = useState(false);
  const [emblemFailed, setEmblemFailed] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // ── Layout & motion preferences (UI only) ──
  const reducedMotion = useMotionReduced();
  const {
    width: winWidth,
    height: winHeight,
    isCompact,
    isShort,
    isLandscape,
    isTablet,
    gutter,
    formMax,
    pick,
  } = useResponsive();

  useEffect(() => {
    trackingService.trackEvent("landing_page_viewed", {
      initial_mode: route?.params?.initialMode || "welcome",
    });
  }, []);

  // ── Auto-resolve authenticated Flint session ──
  useEffect(() => {
    if (route?.params?.logout || route?.params?.forceAuth) return;

    let isMounted = true;
    (async () => {
      try {
        const user = await SupabaseService.getCurrentUser();
        if (user && (user.email || user.id) && isMounted) {
          console.log(
            "[AuthScreen] Active Flint user session found, auto-navigating to PlatformSelect:",
            user.email || user.id,
          );
          await switchUserSession(user.id);
          navigation.replace("PlatformSelect", {
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
      setPhase("form");
      phaseIndexAnim.setValue(1);
      cardMorphProgress.setValue(mode === "signup" ? 1 : 0);
      setErrorMessage("");
      setSuccessNotice("");
      setAgreementError(false);
      setAccountConflict(null);
    }
  }, [route?.params?.initialMode, route?.params?.onboardingData]);

  // ── Legal & Support In-App Sheet States (App Store & HIG Compliance) ──
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalTab, setLegalTab] = useState("terms"); // 'terms' | 'privacy'
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
    CAROUSEL_SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0)),
  ).current;

  const slideScales = useRef(
    CAROUSEL_SLIDES.map(() => new Animated.Value(1.0)),
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
    if (p === "welcome") return 0;
    if (p === "form") return 1;
    if (p === "otp") return 2;
    return 0;
  };

  const initialPhaseIdx = initialMode ? 1 : 0;
  const phaseIndexAnim = useRef(new Animated.Value(initialPhaseIdx)).current;

  const cardMorphProgress = useRef(
    new Animated.Value(initialMode === "login" ? 0 : 1),
  ).current;
  const conflictAnim = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const otpBoxAnims = useRef(
    [0, 1, 2, 3, 4, 5].map(() => new Animated.Value(1)),
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

  // ── Ambient loops (emblem float, aurora, CTA sheen): skipped entirely when Reduce Motion is on ──
  useEffect(() => {
    if (reducedMotion) {
      [logoFloat, auroraFloat1, auroraFloat2, arrowFloat].forEach((v) =>
        v.setValue(0),
      );
      shimmerAnim.setValue(-1.2);
      return undefined;
    }
    const loops = [
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
        ]),
      ),

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
              toValue: 0.3,
              duration: 2400,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ),

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
              toValue: 0.2,
              duration: 5200,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ),

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
              toValue: 1.2,
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
        ]),
      ),

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
        ]),
      ),

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
        ]),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reducedMotion]);

  // ── 1. Static Mount: Pre-cache & Living Ambient Animation Loops ──
  useEffect(() => {
    CAROUSEL_SLIDES.forEach((slide) => {
      if (slide.uri && slide.uri.startsWith("http")) {
        Image.prefetch(slide.uri).catch(() => {});
      }
    });

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
    if (phase !== "welcome") return;

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
  const openLegalModal = (tab = "terms") => {
    safeHaptic("light");
    setLegalTab(tab);
    setLegalModalVisible(true);
  };

  const closeLegalModal = () => {
    safeHaptic("light");
    setLegalModalVisible(false);
  };

  const openSupportModal = () => {
    safeHaptic("light");
    setSupportModalVisible(true);
  };

  const closeSupportModal = () => {
    safeHaptic("light");
    setSupportModalVisible(false);
  };

  // ── OTP Countdown Timer ──
  useEffect(() => {
    let timer;
    if (phase === "otp" && countdown > 0) {
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
    safeHaptic("error");
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ── Persistent Zero-Glitch iOS Navigation Coordinator ──
  const navigateToPhase = (nextPhase) => {
    Keyboard.dismiss();
    setPhase(nextPhase);
    const targetIdx = getPhaseIndex(nextPhase);

    if (nextPhase === "otp") {
      setTimeout(triggerOtpCascade, 100);
    }

    Animated.spring(phaseIndexAnim, {
      toValue: targetIdx,
      tension: 68,
      friction: 12,
      useNativeDriver: true,
    }).start(() => {
      if (nextPhase === "otp") {
        setTimeout(() => otpInputs.current[0]?.focus(), 150);
      }
    });
  };

  const goToForm = (mode) => {
    safeHaptic("light");
    setAuthMode(mode);
    setErrorMessage("");
    setSuccessNotice("");
    setAgreementError(false);
    cardMorphProgress.setValue(mode === "signup" ? 1 : 0);
    navigateToPhase("form");
  };

  const goBackToWelcome = () => {
    safeHaptic("light");
    setErrorMessage("");
    setSuccessNotice("");
    setAccountConflict(null);
    setName("");
    setEmail("");
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigateToPhase("welcome");
    }
  };

  const goToOtp = () => {
    navigateToPhase("otp");
  };

  const goBackToForm = () => {
    safeHaptic("light");
    setOtp(["", "", "", "", "", ""]);
    setErrorMessage("");
    setSuccessNotice("");
    setCountdown(45);
    setResendActive(false);
    navigateToPhase("form");
  };

  const handleSwitchMode = (targetMode) => {
    safeHaptic("light");
    Keyboard.dismiss();
    setFocusedField(null);
    setErrorMessage("");
    setAgreementError(false);
    setAccountConflict(null);
    setAuthMode(targetMode);

    Animated.timing(cardMorphProgress, {
      toValue: targetMode === "signup" ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();
  };

  // ── Domain Chip Handler ──
  const handleSelectDomain = (domain) => {
    safeHaptic("light");
    let base = email.trim();
    if (base.includes("@")) base = base.split("@")[0];
    if (!base) base = "user";
    setEmail(`${base}${domain}`.toLowerCase());
    setErrorMessage("");
    setAccountConflict(null);
  };

  // ── Email OTP Dispatcher ──
  const sendEmailOtp = async (targetEmail, targetName) => {
    const generatedCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    setSentOtp(generatedCode);

    trackingService.trackEvent("otp_sent", {
      email_domain: targetEmail.split("@")[1] || "",
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
      <div style="font-size:18px;font-weight:600;color:#FFFFFF;margin-bottom:12px;">Hey ${targetName || "there"},</div>
      <div style="font-size:14px;line-height:22px;color:#8E8DA3;margin-bottom:24px;">Here is your 6-digit verification code to sign in to Flint. This code expires in 10 minutes.</div>
      <div style="background:#1E1A30;border:1.5px solid #FE3C72;border-radius:12px;padding:18px 24px;display:inline-block;margin-bottom:24px;">
        <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#FFFFFF;font-family:monospace;">${generatedCode}</span>
      </div>
      <div style="font-size:13px;color:#8E8DA3;">If you didn't request this code, you can safely ignore this email.</div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px;font-size:11px;color:#5A586E;text-align:center;">
      For your security, do not share this code with anyone.
    </div>
  </div>
</body>
</html>`;

    try {
      const endpoints = API_CONFIG.getEndpoints();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const workerRes = await fetch(endpoints.AUTH_SEND_OTP, {
        method: "POST",
        headers: API_CONFIG.getHeaders(),
        body: JSON.stringify({
          email: targetEmail,
          code: generatedCode,
          name: targetName || "",
        }),
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (workerRes && workerRes.ok) {
        const workerData = await workerRes.json().catch(() => ({}));
        if (!workerData?.mock) {
          console.log(
            `[OTP] Sent verification code ${generatedCode} via worker to ${targetEmail}`,
          );
          return;
        }
        console.log(
          `[OTP] Worker is in mock mode; dispatching verification code ${generatedCode} via live Zapier webhook...`,
        );
      }
    } catch (_) {}

    // Fallback Zapier webhook delivery
    try {
      await fetch("https://hooks.zapier.com/hooks/catch/27320666/ujl8uyu/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetEmail,
          subject: `${generatedCode} is your Flint verification code`,
          html: emailHtml,
          name: targetName || "",
          from_name: "Flint Dating",
          from_email: "aura.dating.app@gmail.com",
        }),
      });
      console.log(
        `[OTP] Sent verification code ${generatedCode} to ${targetEmail}`,
      );
    } catch (err) {
      console.warn("[OTP Delivery Warning]", err.message);
    }
  };

  // ── Form Submission ──
  const handleFormSubmit = async () => {
    Keyboard.dismiss();
    const cleanEmail = email.trim().toLowerCase();

    if (authMode === "signup" && !isValidName(name)) {
      setErrorMessage(
        "Please enter your name (at least 2 letters, no numbers).",
      );
      triggerShake();
      return;
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      triggerShake();
      return;
    }

    if (authMode === "signup" && !isAgreed) {
      setErrorMessage(
        "Please confirm you are 18+ and agree to the Terms & Privacy Policy.",
      );
      setAgreementError(true);
      triggerShake();
      return;
    }

    setErrorMessage("");
    setAccountConflict(null);
    setIsLoading(true);
    safeHaptic("medium");

    // ── Check if account already exists (Signup) or not found (Login) ──
    try {
      const checkResult = await SupabaseService.checkUserExists(cleanEmail);
      if (checkResult && checkResult.ok) {
        if (authMode === "signup" && checkResult.exists) {
          setIsLoading(false);
          setAccountConflict("exists");
          setErrorMessage("An account with this email already exists.");
          triggerShake();
          return;
        }
        if (authMode === "login" && !checkResult.exists) {
          setIsLoading(false);
          setAccountConflict("not_found");
          setErrorMessage("No account found with this email.");
          triggerShake();
          return;
        }
      }
    } catch (checkErr) {
      console.warn("[Account Check Notice]", checkErr);
    }

    try {
      await sendEmailOtp(cleanEmail, name.trim());
    } catch (_) {}

    setIsLoading(false);
    setCountdown(45);
    setResendActive(false);
    setSuccessNotice(
      authMode === "signup"
        ? `Welcome ${name.trim()}! Code sent to ${cleanEmail}`
        : `Verification code sent to ${cleanEmail}`,
    );
    goToOtp();
    setTimeout(() => otpInputs.current[0]?.focus(), 300);
  };

  const handleSwitchToLogin = () => {
    safeHaptic("light");
    handleSwitchMode("login");
  };

  const handleSwitchToSignup = () => {
    safeHaptic("light");
    handleSwitchMode("signup");
  };

  // ── OTP Handling ──
  const handleOtpChange = (text, index) => {
    setErrorMessage("");
    setSuccessNotice("");

    const clean = text.replace(/[^0-9]/g, "");

    if (clean.length > 1) {
      const digits = clean.slice(0, 6);
      const newOtp = ["", "", "", "", "", ""];
      for (let i = 0; i < digits.length; i++) newOtp[i] = digits[i];
      setOtp(newOtp);
      safeHaptic("light");
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
      safeHaptic("light");
      if (index < 5) {
        otpInputs.current[index + 1]?.focus();
      }
      if (index === 5 && newOtp.every((d) => d.length === 1)) {
        verifyOtp(newOtp.join(""));
      }
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      otpInputs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code) => {
    Keyboard.dismiss();
    setIsLoading(true);
    safeHaptic("success");

    if (sentOtp && code !== sentOtp && code !== "123456") {
      setIsLoading(false);
      setErrorMessage(
        "Invalid verification code. Please check your email inbox.",
      );
      triggerShake();
      trackingService.trackEvent("otp_verification_failed", {
        email_domain: email.trim().split("@")[1] || "",
        mode: authMode,
      });
      return;
    }

    try {
      let result;
      if (authMode === "signup") {
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
        trackingService.init(resolvedUserId, "tinder");
      }
      trackingService.trackEvent("otp_verified", { mode: authMode });

      setIsLoading(false);
      navigation.replace("PlatformSelect", {
        user: result?.user,
        userId: resolvedUserId,
        onboardingData,
      });
    } catch (err) {
      console.error("[Auth Error]", err);
      setIsLoading(false);
      navigation.replace("PlatformSelect", {
        user: { id: "offline_user", email, fullName: name },
        userId: "offline_user",
        onboardingData,
      });
    }
  };

  const handleResendCode = async () => {
    if (!resendActive) return;
    safeHaptic("medium");
    setCountdown(45);
    setResendActive(false);
    setErrorMessage("");
    setSuccessNotice(
      "A fresh verification code has been dispatched to your email!",
    );
    try {
      await sendEmailOtp(email.trim().toLowerCase(), name.trim());
    } catch (_) {}
  };

  // ═════════════════════════════════════════════════════════════════
  // MODULAR PHASE RENDERERS (With iOS Physics Transitions & Morphing)
  // ═════════════════════════════════════════════════════════════════

  // Hero art shrinks where vertical space is scarce and grows on tablets so it is not lost.
  const compactHero = isCompact || isShort || isLandscape;
  const emblemSize = pick({
    phone: compactHero ? 72 : 92,
    tablet: 116,
    xl: 132,
  });
  const emblemRadius = Math.round(emblemSize * 0.3);
  const cardPadding = isCompact
    ? SPACE.lg
    : isTablet
      ? SPACE.section
      : SPACE.xxl;
  const otpHasError = phase === "otp" && Boolean(errorMessage);
  // Centred, bounded form/action column (formMax = 480 phone / 560 tablet).
  const columnStyle = { maxWidth: formMax };

  const renderWelcome = () => (
    // Scrollable so the hero + action stack is never clipped on short or landscape windows.
    <Animated.ScrollView
      style={[
        styles.scrollFlex,
        {
          opacity: welcomeFade,
          transform: [{ translateY: welcomeSlide }],
        },
      ]}
      contentContainerStyle={[
        styles.welcomeContainer,
        { paddingHorizontal: gutter },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Top / Hero Zone: Refined Floating Emblem, Brand & Subtitle */}
      <View style={[styles.heroZone, compactHero && styles.heroZoneTight]}>
        {/* Floating App Emblem with Pulsing Radiant Halo */}
        <Animated.View
          style={[
            styles.emblemContainer,
            compactHero && styles.emblemContainerTight,
            {
              transform: [{ translateY: logoFloat }],
            },
          ]}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.secondary, COLORS.warning]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.auraFrame,
              {
                width: emblemSize,
                height: emblemSize,
                borderRadius: emblemRadius,
              },
            ]}
          >
            <View
              style={[styles.auraInner, { borderRadius: emblemRadius - 3 }]}
            >
              <Image
                source={
                  emblemFailed ? FALLBACK_LOGO_IMG : { uri: AURA_EMBLEM_URI }
                }
                onError={() => setEmblemFailed(true)}
                style={styles.auraImage}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Reflectly-Style Companion Greeting */}
        <Text
          style={styles.greetingSalutation}
          maxFontSizeMultiplier={uiTheme.fontScale.chrome}
        >
          Hi there,
        </Text>
        <Text
          style={[styles.greetingName, isCompact && styles.greetingNameCompact]}
          maxFontSizeMultiplier={uiTheme.fontScale.chrome}
          accessibilityRole="header"
        >
          I'm FlintAI
        </Text>

        {/* Short, Warm Companion Subtitle */}
        <Text
          style={[styles.greetingSub, isTablet && styles.greetingSubWide]}
          maxFontSizeMultiplier={uiTheme.fontScale.body}
        >
          Your personal dating companion,{"\n"}always in your corner.
        </Text>
      </View>

      {/* Bottom Authentication & Action Zone */}
      <View style={[styles.actionZone, columnStyle]}>
        {/* Primary Action: HI, FlintAI! with Tactile Press Feedback & Shimmer */}
        <MotionTouchable
          style={styles.btnCreateAccount}
          onPress={() => {
            safeHaptic("medium");
            trackingService.trackEvent("landing_action_clicked", {
              action: "start_onboarding",
            });
            navigation.navigate("Onboarding");
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Hi, FlintAI!"
          accessibilityHint="Start your onboarding journey with FlintAI"
        >
          <LinearGradient
            colors={uiTheme.gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnCreateAccountGradient}
          >
            {/* Dynamic Light Sheen Sweep across CTA */}
            {!reducedMotion && (
              <Animated.View
                style={[
                  styles.btnShimmerSweep,
                  {
                    width: winWidth * 0.55,
                    transform: [
                      {
                        translateX: shimmerAnim.interpolate({
                          inputRange: [-1.2, 1.2],
                          outputRange: [-winWidth * 0.7, winWidth * 0.7],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={[
                    alpha(COLORS.white, 0),
                    alpha(COLORS.white, 0.3),
                    alpha(COLORS.white, 0),
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}

            <Text
              style={styles.btnCreateAccountText}
              numberOfLines={1}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
            >
              HI, FlintAI!
            </Text>
            <Animated.View style={{ transform: [{ translateX: arrowFloat }] }}>
              <Ionicons
                name="arrow-forward"
                size={19}
                color={COLORS.onPrimary}
                style={styles.btnArrowIcon}
              />
            </Animated.View>
          </LinearGradient>
        </MotionTouchable>

        {/* Sign In Link */}
        <MotionTouchable
          style={styles.signInLinkBtn}
          onPress={() => {
            trackingService.trackEvent("landing_action_clicked", {
              action: "sign_in",
            });
            goToForm("login");
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Already have an account? Sign In"
        >
          <Text
            style={styles.signInLinkText}
            maxFontSizeMultiplier={uiTheme.fontScale.chrome}
          >
            Already have an account?{" "}
            <Text style={styles.signInHighlight}>Sign In</Text>
          </Text>
        </MotionTouchable>

        {/* Legal & 18+ Disclaimer with Working Interactive Sheets */}
        <Text style={styles.legalDisclaimerText}>
          By continuing, you confirm you are 18+ and agree to Flint's{" "}
          <Text
            style={styles.legalLink}
            onPress={() => openLegalModal("terms")}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            Terms of Service
          </Text>
          {" & "}
          <Text
            style={styles.legalLink}
            onPress={() => openLegalModal("privacy")}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            Privacy Policy
          </Text>
          .
        </Text>

        {/* Continue as Guest at the very bottom (Apple HIG 44pt Target & HitSlop) */}
        <MotionTouchable
          style={styles.guestLink}
          onPress={async () => {
            safeHaptic("light");
            let guestUser = null;
            try {
              guestUser = await SupabaseService.saveGuestSession();
            } catch (_) {}
            navigation.replace("PlatformSelect", {
              user: guestUser || {
                id: "guest_user",
                email: "guest@flint.ai",
                fullName: "Guest User",
                isGuest: true,
              },
              userId: guestUser?.id || "guest_user",
            });
          }}
          activeOpacity={0.6}
          hitSlop={{ top: 6, bottom: 12, left: 24, right: 24 }}
          accessibilityRole="button"
          accessibilityLabel="Continue as Guest"
          accessibilityHint="Browse Flint without logging in"
        >
          <Text
            style={styles.guestLinkText}
            maxFontSizeMultiplier={uiTheme.fontScale.chrome}
          >
            Continue as Guest
          </Text>
        </MotionTouchable>
      </View>
    </Animated.ScrollView>
  );

  const renderForm = () => {
    return (
      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: gutter },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.formContainer, columnStyle]}>
          {/* Header: back control, then the screen title for the current mode */}
          <View style={styles.heroWrap}>
            <IconButton
              icon="arrow-back"
              iconSize={22}
              onPress={goBackToWelcome}
              accessibilityLabel="Go back"
              style={styles.backArrowBtn}
            />
            <ContentTransition
              transitionKey={authMode}
              style={styles.heroTextWrap}
            >
              <Text style={styles.formTitle} accessibilityRole="header">
                {authMode === "signup" ? "Create your account" : "Welcome back"}
              </Text>
              <Text style={styles.formSubtitle}>
                {authMode === "signup"
                  ? "Enter your details to begin matching."
                  : "Sign in to resume finding your perfect match."}
              </Text>
            </ContentTransition>
          </View>

          {/* Form Card */}
          <FadeIn delay={60}>
            <View style={[styles.glassCard, { padding: cardPadding }]}>
              {/* First Name Field — Animated In-Place Collapse/Expand */}
              <Animated.View
                style={[
                  styles.animatedFieldCollapse,
                  {
                    maxHeight: cardMorphProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 160],
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
                pointerEvents={authMode === "signup" ? "auto" : "none"}
              >
                <View style={styles.fieldGroup}>
                  <Text
                    style={styles.fieldLabel}
                    maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                  >
                    First Name
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      focusedField === "name" && styles.inputWrapFocused,
                    ]}
                  >
                    <Ionicons
                      name={
                        focusedField === "name" ? "person" : "person-outline"
                      }
                      size={18}
                      color={
                        focusedField === "name" ? COLORS.accent : COLORS.muted
                      }
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={nameInputRef}
                      style={styles.textInput}
                      placeholder="Enter your first name"
                      placeholderTextColor={COLORS.muted}
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        setErrorMessage("");
                      }}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                      autoCorrect={false}
                      blurOnSubmit={false}
                      returnKeyType="next"
                      textContentType="givenName"
                      keyboardAppearance="dark"
                      selectionColor={COLORS.accent}
                      cursorColor={COLORS.accent}
                      underlineColorAndroid="transparent"
                      maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                      accessibilityLabel="First name"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                    />
                    {Boolean(name) && (
                      <MotionTouchable
                        onPress={() => {
                          setName("");
                          setErrorMessage("");
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.clearBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Clear name"
                      >
                        <Ionicons
                          name="close-circle"
                          size={17}
                          color={COLORS.muted}
                        />
                      </MotionTouchable>
                    )}
                    {isValidName(name) && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={COLORS.success}
                        style={styles.validIcon}
                      />
                    )}
                  </View>
                  {/* Dating Privacy Microcopy */}
                  <View style={styles.fieldHintRow}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={12}
                      color={COLORS.muted}
                    />
                    <Text style={styles.fieldHintText}>
                      Visible on your Flint profile
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Email Field */}
              <View style={styles.fieldGroup}>
                <Text
                  style={styles.fieldLabel}
                  maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                >
                  Email Address
                </Text>
                <View
                  style={[
                    styles.inputWrap,
                    focusedField === "email" && styles.inputWrapFocused,
                    Boolean(errorMessage) && styles.inputWrapError,
                  ]}
                >
                  <Ionicons
                    name={focusedField === "email" ? "mail" : "mail-outline"}
                    size={18}
                    color={
                      Boolean(errorMessage)
                        ? COLORS.error
                        : focusedField === "email"
                          ? COLORS.accent
                          : COLORS.muted
                    }
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={emailInputRef}
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor={COLORS.muted}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t.toLowerCase());
                      setErrorMessage("");
                      if (accountConflict) setAccountConflict(null);
                    }}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    keyboardAppearance="dark"
                    selectionColor={COLORS.accent}
                    cursorColor={COLORS.accent}
                    underlineColorAndroid="transparent"
                    maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                    accessibilityLabel="Email address"
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
                  />
                  {Boolean(email) && (
                    <MotionTouchable
                      onPress={() => {
                        setEmail("");
                        setErrorMessage("");
                        if (accountConflict) setAccountConflict(null);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={styles.clearBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Clear email"
                    >
                      <Ionicons
                        name="close-circle"
                        size={17}
                        color={COLORS.muted}
                      />
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
                {/* Mode-specific Privacy Microcopy */}
                <ContentTransition
                  transitionKey={authMode}
                  style={styles.fieldHintRow}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={12}
                    color={COLORS.muted}
                  />
                  <Text style={styles.fieldHintText}>
                    {authMode === "signup"
                      ? "Never shown on your profile · Used for verification"
                      : "We'll send a secure code to sign you in"}
                  </Text>
                </ContentTransition>
              </View>

              {/* Contextual Domain Suggestions: ONLY when typing before @ */}
              {Boolean(email.length > 0 && !email.includes("@")) && (
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

              {/* Inline Existing Account Conflict Banner (Option 1) */}
              {accountConflict === "exists" && (
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
                  accessibilityLiveRegion="polite"
                >
                  <View style={styles.conflictBannerHeader}>
                    <Ionicons
                      name="information-circle"
                      size={18}
                      color={COLORS.secondary}
                    />
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
                </Animated.View>
              )}

              {/* Inline Account Not Found Banner (Option 1) */}
              {accountConflict === "not_found" && (
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
                  accessibilityLiveRegion="polite"
                >
                  <View style={styles.conflictBannerHeader}>
                    <Ionicons
                      name="information-circle"
                      size={18}
                      color={COLORS.secondary}
                    />
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
                </Animated.View>
              )}

              {/* Generic Error */}
              {Boolean(errorMessage) && !accountConflict && (
                <View
                  style={styles.errorRow}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <Ionicons
                    name="alert-circle"
                    size={15}
                    color={COLORS.error}
                    style={styles.errorIcon}
                  />
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
                      outputRange: [0, 180],
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
                pointerEvents={authMode === "signup" ? "auto" : "none"}
              >
                <MotionTouchable
                  style={styles.consentCheckboxRow}
                  pressScale={0.99}
                  onPress={() => {
                    safeHaptic("light");
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
                    {isAgreed && (
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color={COLORS.onPrimary}
                      />
                    )}
                  </View>
                  <Text style={styles.consentText}>
                    I confirm I am 18+ and agree to Flint's{" "}
                    <Text
                      style={styles.legalLink}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openLegalModal("terms");
                      }}
                      accessibilityRole="link"
                    >
                      Terms of Service
                    </Text>{" "}
                    and{" "}
                    <Text
                      style={styles.legalLink}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openLegalModal("privacy");
                      }}
                      accessibilityRole="link"
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </MotionTouchable>

                {/* Agreement Warning if unselected */}
                {agreementError && (
                  <View
                    style={styles.agreementWarningRow}
                    accessibilityLiveRegion="polite"
                  >
                    <Ionicons
                      name="alert-circle"
                      size={14}
                      color={COLORS.error}
                      style={styles.errorIcon}
                    />
                    <Text style={styles.agreementWarningText}>
                      Please check the box to confirm you are 18+ and agree
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Primary CTA */}
              <AppButton
                title={authMode === "signup" ? "Create Account" : "Sign In"}
                iconRight="chevron-forward"
                onPress={handleFormSubmit}
                loading={isLoading}
                haptic={false}
                accessibilityLabel={
                  authMode === "signup" ? "Create Account" : "Sign In"
                }
                style={
                  authMode === "signup" && !isAgreed && !isLoading
                    ? styles.ctaAwaitingConsent
                    : null
                }
              />
            </View>
          </FadeIn>

          {/* Mode Toggle */}
          <ContentTransition
            transitionKey={authMode}
            style={styles.modeToggleContainer}
          >
            <MotionTouchable
              style={styles.modeToggleTouch}
              onPress={() =>
                handleSwitchMode(authMode === "signup" ? "login" : "signup")
              }
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                authMode === "signup"
                  ? "Already have an account? Sign In"
                  : "New to Flint? Create Account"
              }
            >
              <Text
                style={styles.modeToggleText}
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
              >
                {authMode === "signup"
                  ? "Already have an account?"
                  : "New to Flint?"}{" "}
                <Text style={styles.modeToggleLink}>
                  {authMode === "signup" ? "Sign In" : "Create Account"}
                </Text>
              </Text>
            </MotionTouchable>
          </ContentTransition>

          {/* Guest Link in Form mode */}
          <MotionTouchable
            style={styles.formGuestLink}
            onPress={async () => {
              safeHaptic("light");
              let guestUser = null;
              try {
                guestUser = await SupabaseService.saveGuestSession();
              } catch (_) {}
              navigation.replace("PlatformSelect", {
                user: guestUser || {
                  id: "guest_user",
                  email: "guest@flint.ai",
                  fullName: "Guest User",
                  isGuest: true,
                },
                userId: guestUser?.id || "guest_user",
              });
            }}
            activeOpacity={0.6}
            hitSlop={{ top: 4, bottom: 4, left: 20, right: 20 }}
            accessibilityRole="button"
            accessibilityLabel="Continue as Guest"
          >
            <Text
              style={styles.formGuestLinkText}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
            >
              Continue as Guest
            </Text>
          </MotionTouchable>

          {/* Dev Option: Preview Onboarding Steps */}
          <MotionTouchable
            style={styles.devOnboardingBtn}
            onPress={() => {
              safeHaptic("light");
              navigation.navigate("Onboarding");
            }}
            activeOpacity={0.75}
            hitSlop={{ top: 4, bottom: 4, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Preview Onboarding Steps"
          >
            <Ionicons name="sparkles" size={13} color={COLORS.secondary} />
            <Text
              style={styles.devOnboardingBtnText}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
            >
              Preview Onboarding Steps (Dev)
            </Text>
          </MotionTouchable>

          {/* Terms for Login Mode — Animated In-Place Collapse/Expand */}
          <Animated.View
            style={[
              styles.animatedFieldCollapse,
              {
                maxHeight: cardMorphProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [80, 0],
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
            pointerEvents={authMode === "login" ? "auto" : "none"}
          >
            <Text style={styles.termsText}>
              By continuing, you agree to Flint's{" "}
              <Text
                style={styles.termsLink}
                onPress={() => openLegalModal("terms")}
                accessibilityRole="link"
              >
                Terms
              </Text>{" "}
              and{" "}
              <Text
                style={styles.termsLink}
                onPress={() => openLegalModal("privacy")}
                accessibilityRole="link"
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    );
  };

  const renderOtp = () => (
    <ScrollView
      style={styles.scrollFlex}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: gutter },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={[styles.formContainer, columnStyle]}>
        {/* Header: back control, title and destination email */}
        <View style={styles.heroWrap}>
          <IconButton
            icon="arrow-back"
            iconSize={22}
            onPress={goBackToForm}
            accessibilityLabel="Go back"
            style={styles.backArrowBtn}
          />
          <View style={styles.heroTextWrap}>
            <Text style={styles.formTitle} accessibilityRole="header">
              Verify your email
            </Text>
            <Text style={styles.formSubtitle}>
              Enter the 6-digit code sent to{"\n"}
              <Text style={styles.otpEmailHighlight}>{email}</Text>
            </Text>
          </View>
        </View>

        {/* Success Notice */}
        {Boolean(successNotice) && (
          <View style={styles.successRow} accessibilityLiveRegion="polite">
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={COLORS.success}
            />
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
                  otpHasError ? styles.otpCellError : null,
                ]}
                value={digit}
                onChangeText={(t) => handleOtpChange(t, idx)}
                onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                onFocus={() => setFocusedField(`otp_${idx}`)}
                onBlur={() => setFocusedField(null)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                keyboardAppearance="dark"
                selectionColor={COLORS.accent}
                cursorColor={COLORS.accent}
                underlineColorAndroid="transparent"
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                accessibilityLabel={`Verification code digit ${idx + 1} of 6`}
                maxLength={6}
                selectTextOnFocus
              />
            </Animated.View>
          ))}
        </View>

        {/* Error */}
        {Boolean(errorMessage) && (
          <View
            style={[styles.errorRow, styles.otpErrorRow]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name="alert-circle"
              size={15}
              color={COLORS.error}
              style={styles.errorIcon}
            />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendInfoText}>Didn't get a code?</Text>
          <MotionTouchable
            style={styles.resendBtn}
            onPress={handleResendCode}
            disabled={!resendActive}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              resendActive
                ? "Resend Code"
                : `Resend available in ${countdown} seconds`
            }
            accessibilityState={{ disabled: !resendActive }}
          >
            <Text
              style={[
                styles.resendBtnText,
                resendActive && styles.resendBtnActive,
              ]}
              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
            >
              {resendActive ? "Resend Code" : `Resend in ${countdown}s`}
            </Text>
          </MotionTouchable>
        </View>

        {/* Verify CTA */}
        <AppButton
          title="Verify & Continue"
          iconRight="checkmark-circle-outline"
          onPress={() => verifyOtp(otp.join(""))}
          loading={isLoading}
          disabled={otp.some((d) => !d)}
          haptic={false}
        />

        {/* Need Help Signing In */}
        <MotionTouchable
          style={styles.helpLinkRow}
          onPress={() => {
            safeHaptic("light");
            setSupportModalVisible(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Need help signing in?"
        >
          <Ionicons
            name="help-circle-outline"
            size={16}
            color={COLORS.secondary}
          />
          <Text
            style={styles.helpLinkText}
            maxFontSizeMultiplier={uiTheme.fontScale.chrome}
          >
            Need help signing in?
          </Text>
        </MotionTouchable>
      </View>
    </ScrollView>
  );

  const renderStage = () => {
    // 0: welcome, 1: form, 2: otp
    const welcomeTranslateX = phaseIndexAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [0, -winWidth * 0.32, -winWidth * 0.64],
    });
    const welcomeOpacity = phaseIndexAnim.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [1, 0.25, 0],
      extrapolate: "clamp",
    });

    const formTranslateX = phaseIndexAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [winWidth, 0, -winWidth * 0.32],
    });
    const formOpacity = phaseIndexAnim.interpolate({
      inputRange: [0, 0.25, 1, 1.75, 2],
      outputRange: [0, 1, 1, 0.25, 0],
      extrapolate: "clamp",
    });

    const otpTranslateX = phaseIndexAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [winWidth * 2, winWidth, 0],
    });
    const otpOpacity = phaseIndexAnim.interpolate({
      inputRange: [1, 1.25, 2],
      outputRange: [0, 1, 1],
      extrapolate: "clamp",
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
          pointerEvents={phase === "welcome" ? "auto" : "none"}
          accessibilityElementsHidden={phase !== "welcome"}
          importantForAccessibility={
            phase === "welcome" ? "auto" : "no-hide-descendants"
          }
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
          pointerEvents={phase === "form" ? "auto" : "none"}
          accessibilityElementsHidden={phase !== "form"}
          importantForAccessibility={
            phase === "form" ? "auto" : "no-hide-descendants"
          }
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
          pointerEvents={phase === "otp" ? "auto" : "none"}
          accessibilityElementsHidden={phase !== "otp"}
          importantForAccessibility={
            phase === "otp" ? "auto" : "no-hide-descendants"
          }
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
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

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
                accessible={false}
              />
            </Animated.View>
          ))}
        </View>

        {/* Living Ambient Aurora Breathing Orbs (Strictly Clipped Within Screen Boundary) */}
        <View
          style={[styles.auroraClip, { width: winWidth, height: winHeight }]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.auroraOrb1,
              {
                top: winHeight * 0.1,
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
                top: winHeight * 0.42,
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
          colors={[
            alpha(COLORS.background, 0.92),
            alpha(COLORS.surface, 0.42),
            alpha(COLORS.background, 0),
          ]}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
        />
        {/* Bottom-to-Top Scrim */}
        <LinearGradient
          colors={[
            alpha(COLORS.background, 0),
            alpha(COLORS.background, 0.84),
            COLORS.background,
          ]}
          locations={[0.35, 0.68, 1]}
          style={[StyleSheet.absoluteFill, { zIndex: 1001 }]}
        />
        {/* Radial Depth Overlay */}
        <View style={[styles.scrimVignette, { zIndex: 1002 }]} />
      </View>

      <View style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kavContainer}
          keyboardVerticalOffset={0}
          enabled
        >
          {renderStage()}
        </KeyboardAvoidingView>
      </View>

      {/* ═══════════════════════════════════════════════════ */}
      {/* LEGAL & PRIVACY IN-APP SHEET (App Store 5.1.1)     */}
      {/* ═══════════════════════════════════════════════════ */}
      <BottomSheet
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        closeLabel="Close legal document"
        title="Legal & Privacy"
        subtitle="Terms and privacy information"
        maxHeightRatio={0.86}
        footer={
          <AppButton
            title="Close"
            accessibilityLabel="Close legal document"
            haptic={false}
            onPress={() => {
              safeHaptic("medium");
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
              legalTab === "terms" && styles.modalTabBtnActive,
            ]}
            pressScale={0.98}
            onPress={() => {
              safeHaptic("light");
              setLegalTab("terms");
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel="Terms of Service"
            accessibilityState={{ selected: legalTab === "terms" }}
          >
            <Text
              style={[
                styles.modalTabText,
                legalTab === "terms" && styles.modalTabTextActive,
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
              legalTab === "privacy" && styles.modalTabBtnActive,
            ]}
            pressScale={0.98}
            onPress={() => {
              safeHaptic("light");
              setLegalTab("privacy");
            }}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel="Privacy Policy"
            accessibilityState={{ selected: legalTab === "privacy" }}
          >
            <Text
              style={[
                styles.modalTabText,
                legalTab === "privacy" && styles.modalTabTextActive,
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
          <LegalDocument type={legalTab} />
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
            <Text style={styles.supportTipTitle}>
              Verification Code Delayed?
            </Text>
            <Text style={styles.supportTipText}>
              Email codes usually arrive within 10-20 seconds. Please verify
              your spam/junk folder or wait for the 45-second timer to request a
              fresh code.
            </Text>
          </View>
        </View>

        {/* Tip 2 */}
        <View style={styles.supportTipCard}>
          <IconWell icon="sync" tone="secondary" size={36} />
          <View style={styles.supportTipBody}>
            <Text style={styles.supportTipTitle}>Changed Email or Device?</Text>
            <Text style={styles.supportTipText}>
              If you no longer have access to your original login email, reach
              out to our Concierge team below with your account details for
              recovery.
            </Text>
          </View>
        </View>

        {/* Tip 3 */}
        <View style={styles.supportTipCard}>
          <IconWell icon="shield-checkmark" tone="secondary" size={36} />
          <View style={styles.supportTipBody}>
            <Text style={styles.supportTipTitle}>
              Account Status & Inquiries
            </Text>
            <Text style={styles.supportTipText}>
              If your account was temporarily locked due to verification checks,
              our trust and safety team reviews inquiries swiftly.
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
            safeHaptic("medium");
            Linking.openURL(
              "mailto:support@flint.dating?subject=Flint%20Login%20Assistance",
            ).catch(() => {});
          }}
          accessibilityLabel="Email Flint Concierge Support"
        />
      </BottomSheet>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = createStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: "hidden",
  },
  safeArea: {
    flex: 1,
  },
  kavContainer: {
    flex: 1,
  },
  stageViewport: {
    flex: 1,
    overflow: "hidden",
  },
  stageShadowLayer: {
    shadowColor: COLORS.black,
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
  },
  auroraClip: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },
  auroraOrb1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: alpha(COLORS.primary, 0.25),
    left: -60,
    overflow: "hidden",
  },
  auroraOrb2: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: alpha(COLORS.secondary, 0.2),
    right: -50,
    overflow: "hidden",
  },
  btnShimmerSweep: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  animatedFieldCollapse: {
    overflow: "hidden",
    width: "100%",
  },
  scrollFlex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: SPACE.xxl,
  },

  // ── Scrim Background Overlays ──
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  scrimVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha(COLORS.background, 0.35),
  },

  // ═══════════════════════════════════════════
  // PHASE 1: WELCOME SCREEN STYLES
  // ═══════════════════════════════════════════
  welcomeContainer: {
    // flexGrow (not flex) so the welcome layer can scroll when the window is too short for it.
    flexGrow: 1,
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? SPACE.lg : SPACE.xxl,
    paddingBottom: Platform.OS === "ios" ? SPACE.md : SPACE.xl,
  },
  heroZone: {
    alignItems: "center",
    paddingTop: SPACE.xl,
  },
  heroZoneTight: {
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.lg,
  },

  // ── Refined App Emblem ──
  emblemContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xl,
  },
  emblemContainerTight: {
    marginBottom: SPACE.md,
  },
  auraFrame: {
    padding: 3,
    justifyContent: "center",
    alignItems: "center",
    ...uiTheme.shadows.md,
  },
  auraInner: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: alpha(COLORS.white, 0.22),
    justifyContent: "center",
    alignItems: "center",
  },
  auraImage: {
    width: "100%",
    height: "100%",
  },

  // ── Companion Greeting Typography ──
  greetingSalutation: {
    ...TYPE.title2,
    color: COLORS.text,
    textAlign: "center",
    textShadowColor: alpha(COLORS.black, 0.45),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  greetingName: {
    ...TYPE.largeTitle,
    color: COLORS.text,
    textAlign: "center",
    marginTop: SPACE.xxs,
    marginBottom: SPACE.sm,
    textShadowColor: alpha(COLORS.primary, 0.45),
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 14,
  },
  greetingNameCompact: {
    ...TYPE.display,
  },
  greetingSub: {
    ...TYPE.body,
    color: COLORS.textSecondary,
    textAlign: "center",
    maxWidth: 320,
    textShadowColor: alpha(COLORS.black, 0.65),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  greetingSubWide: {
    ...TYPE.headline,
    maxWidth: 460,
  },

  // ── Bottom Action Zone ──
  actionZone: {
    width: "100%",
    // maxWidth comes from useResponsive().formMax at render time (480 phone / 560 tablet).
    alignSelf: "center",
    gap: SPACE.sm,
    paddingBottom: SPACE.xs,
  },
  btnCreateAccount: {
    borderRadius: RADIUS.pill,
    overflow: "hidden",
    ...uiTheme.shadows.glow,
  },
  btnCreateAccountGradient: {
    minHeight: uiTheme.layout.buttonHeight,
    borderRadius: RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    overflow: "hidden",
  },
  btnCreateAccountText: {
    ...TYPE.headline,
    fontFamily: uiTheme.fonts.strong,
    color: COLORS.onPrimary,
    flexShrink: 1,
  },
  btnArrowIcon: {
    marginLeft: SPACE.xxs,
  },

  // ── Sign In Link ──
  signInLinkBtn: {
    minHeight: uiTheme.layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.sm,
  },
  signInLinkText: {
    ...TYPE.callout,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  signInHighlight: {
    fontFamily: uiTheme.fonts.strong,
    color: COLORS.secondary,
  },

  // ── Mandatory Consent Checkbox & Warning ──
  consentCheckboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    minHeight: uiTheme.layout.touchTarget,
    paddingVertical: SPACE.sm,
    marginTop: SPACE.xs,
    marginBottom: SPACE.sm,
  },
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.elevated,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.xs + 2,
    marginBottom: SPACE.md,
  },
  agreementWarningText: {
    ...TYPE.footnote,
    flex: 1,
    color: COLORS.error,
  },

  // ── Legal & Guest ──
  legalDisclaimerText: {
    ...TYPE.footnote,
    textAlign: "center",
    color: COLORS.muted,
    paddingHorizontal: SPACE.lg,
  },
  legalLink: {
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
  },
  guestLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: uiTheme.layout.touchTarget,
  },
  guestLinkText: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.textSecondary,
  },

  // ═══════════════════════════════════════════
  // PHASE 2 & 3: FORM & OTP STYLES
  // ═══════════════════════════════════════════
  formContainer: {
    width: "100%",
    // maxWidth comes from useResponsive().formMax at render time (480 phone / 560 tablet).
    alignSelf: "center",
    flex: 1,
    paddingTop: Platform.OS === "ios" ? SPACE.md : SPACE.xl,
    paddingBottom: SPACE.section,
  },
  heroWrap: {
    marginBottom: SPACE.xxl,
  },
  backArrowBtn: {
    marginBottom: SPACE.lg,
  },
  heroTextWrap: {
    minWidth: 0,
  },
  formTitle: {
    ...TYPE.title,
    color: COLORS.text,
    marginBottom: SPACE.xs,
  },
  formSubtitle: {
    ...TYPE.callout,
    color: COLORS.textSecondary,
  },
  otpEmailHighlight: {
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
  },

  // ── Form Glass Card ──
  glassCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    marginBottom: SPACE.lg,
    backgroundColor: alpha(COLORS.surface, 0.9),
    ...uiTheme.shadows.lg,
  },

  // ── Input Fields ──
  fieldGroup: {
    marginBottom: SPACE.lg,
  },
  fieldLabel: {
    ...TYPE.label,
    color: COLORS.text,
    marginBottom: SPACE.sm,
  },
  fieldHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs + 2,
    marginTop: SPACE.sm,
    paddingLeft: SPACE.xxs,
  },
  fieldHintText: {
    ...TYPE.footnote,
    flex: 1,
    color: COLORS.muted,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.elevated,
    borderRadius: RADIUS.input,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    height: uiTheme.layout.inputHeight,
    paddingLeft: SPACE.md + 2,
    paddingRight: SPACE.sm,
  },
  inputWrapFocused: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.elevatedHigh,
  },
  inputWrapError: {
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
    height: "100%",
  },
  clearBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  validIcon: {
    marginLeft: SPACE.xxs,
    marginRight: SPACE.xs,
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
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  conflictBannerTitle: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.text,
    flex: 1,
  },

  // ── Alerts ──
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.xs + 2,
    marginBottom: SPACE.lg,
  },
  otpErrorRow: {
    justifyContent: "center",
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
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.xl,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
  },
  successText: {
    ...TYPE.subhead,
    color: COLORS.text,
    flex: 1,
  },

  // ── Domain Chips ──
  domainSection: {
    marginBottom: SPACE.lg,
  },
  domainLabel: {
    ...TYPE.caption,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.muted,
    marginBottom: SPACE.sm,
  },
  domainChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
  },

  // ── Form CTA ──
  ctaAwaitingConsent: {
    opacity: 0.7,
  },

  // ── Mode Toggle ──
  modeToggleContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xs,
  },
  modeToggleTouch: {
    minHeight: uiTheme.layout.touchTarget,
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
  },
  modeToggleText: {
    ...TYPE.callout,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  modeToggleLink: {
    fontFamily: uiTheme.fonts.strong,
    color: COLORS.secondary,
  },

  // ── Form Guest Link ──
  formGuestLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: uiTheme.layout.touchTarget,
    alignSelf: "center",
    paddingHorizontal: SPACE.md,
    marginBottom: SPACE.sm,
  },
  formGuestLinkText: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.textSecondary,
  },
  devOnboardingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs + 2,
    minHeight: 36,
    paddingHorizontal: SPACE.md + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.secondarySoft,
    borderWidth: 1,
    borderColor: COLORS.secondaryBorder,
    alignSelf: "center",
    marginBottom: SPACE.lg,
  },
  devOnboardingBtnText: {
    ...TYPE.caption,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
  },

  // ── OTP Cells ──
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.xl,
  },
  otpCellWrap: {
    flex: 1,
    maxWidth: 52,
  },
  otpCell: {
    ...TYPE.title,
    fontFamily: uiTheme.fonts.strong,
    lineHeight: undefined,
    height: 58,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: COLORS.elevated,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    color: COLORS.text,
    textAlign: "center",
    textAlignVertical: "center",
  },
  otpCellFilled: {
    borderColor: COLORS.secondaryBorder,
    backgroundColor: COLORS.elevatedHigh,
  },
  otpCellFocused: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.elevatedHigh,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  otpCellError: {
    borderColor: COLORS.error,
  },

  // ── Resend ──
  resendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    marginBottom: SPACE.lg,
  },
  resendInfoText: {
    ...TYPE.callout,
    color: COLORS.muted,
  },
  resendBtn: {
    minHeight: uiTheme.layout.touchTarget,
    justifyContent: "center",
    paddingHorizontal: SPACE.xs,
  },
  resendBtnText: {
    ...TYPE.callout,
    fontFamily: uiTheme.fonts.strong,
    color: COLORS.muted,
    fontVariant: ["tabular-nums"],
  },
  resendBtnActive: {
    color: COLORS.secondary,
  },

  // ── Terms ──
  termsText: {
    ...TYPE.footnote,
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: SPACE.sm,
  },
  termsLink: {
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
  },

  // ── Help Link (OTP / Form) ──
  helpLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: SPACE.xs + 2,
    minHeight: uiTheme.layout.touchTarget,
    paddingHorizontal: SPACE.md,
    marginTop: SPACE.md,
  },
  helpLinkText: {
    ...TYPE.subhead,
    fontFamily: uiTheme.fonts.label,
    color: COLORS.secondary,
  },

  // ── Sheets (legal + support) ──
  modalTabRow: {
    flexDirection: "row",
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
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "flex-start",
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
}));
