import { theme as uiTheme } from '../theme';
// src/screens/OnboardingScreen.js — 6-Step Onboarding matching Desktop Plugin
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  AccessibilityInfo,
  ScrollView,
  TextInput,
  Switch,
  Animated,
  Easing,
  Dimensions,
  Image,
  StatusBar,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  LayoutAnimation,
  UIManager,
  PanResponder,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  generateDynamicAiConversation,
  fetchLiveAiChatReply,
} from '../utils/aiConversationEngine';

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

// ── Real Generated Profiles for Live Sliding Showcase ──
const PREVIEW_PROFILES = [
  {
    id: 'sarah',
    name: 'Sarah, 26',
    sub: 'Loves travel, photography & coffee',
    matchScore: '98% Match',
    image: require('../../assets/profiles/sarah.jpg'),
    opener: "Noticed your trip to Kyoto—did you find that hidden matcha spot by the canal?",
    tags: [
      { icon: 'heart-outline', label: 'Shared interests', color: '#FF6B8B' },
      { icon: 'shield-checkmark-outline', label: 'Verified profile', color: '#00E676' },
      { icon: 'time-outline', label: 'Natural timing', color: uiTheme.colors.secondary },
    ],
  },
  {
    id: 'maya',
    name: 'Maya, 25',
    sub: 'Architect & espresso lover',
    matchScore: '96% Match',
    image: require('../../assets/profiles/maya.jpg'),
    opener: "That outdoor cafe looks cozy! What's your go-to coffee order on a Sunday morning?",
    tags: [
      { icon: 'heart-outline', label: 'Shared interests', color: '#FF6B8B' },
      { icon: 'shield-checkmark-outline', label: 'Verified profile', color: '#00E676' },
      { icon: 'sparkles-outline', label: 'Active now', color: uiTheme.colors.secondary },
    ],
  },
  {
    id: 'elena',
    name: 'Elena, 27',
    sub: 'Rooftop sunsets & live jazz',
    matchScore: '95% Match',
    image: require('../../assets/profiles/elena.jpg'),
    opener: "Golden hour rooftop views can't be beat. Have you caught live jazz around there?",
    tags: [
      { icon: 'heart-outline', label: 'Shared interests', color: '#FF6B8B' },
      { icon: 'shield-checkmark-outline', label: 'Verified profile', color: '#00E676' },
      { icon: 'time-outline', label: 'Natural timing', color: uiTheme.colors.secondary },
    ],
  },
];

const CARD_WIDTH = Math.min(SCREEN_WIDTH - 64, 305);
const CARD_GAP = 14;
const TRACK_WIDTH = PREVIEW_PROFILES.length * (CARD_WIDTH + CARD_GAP);
const DISPLAY_CARDS = [...PREVIEW_PROFILES, ...PREVIEW_PROFILES];

// ── Master Country & Dial Code Registry (Exact 100% Parity with Desktop Plugin) ──
const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Russian', 'Arabic', 'Hindi', 'Chinese', 'Japanese', 'Korean',
  'Turkish', 'Dutch', 'Polish', 'Swedish', 'Ukrainian', 'Hebrew',
  'Persian', 'Romanian', 'Greek', 'Czech', 'Hungarian', 'Thai'
];

// ── Master Trendy Languages by Country (Top 3 Regional Dating Languages) ──
const COUNTRY_TRENDY_LANGUAGES = {
  'United States': ['English', 'Spanish', 'French'],
  'United Kingdom': ['English', 'French', 'Spanish'],
  'Canada': ['English', 'French', 'Spanish'],
  'Australia': ['English', 'Chinese', 'Spanish'],
  'New Zealand': ['English', 'Chinese', 'French'],
  'Ireland': ['English', 'French', 'Spanish'],
  'Spain': ['Spanish', 'English', 'French'],
  'Mexico': ['Spanish', 'English', 'French'],
  'Argentina': ['Spanish', 'English', 'Italian'],
  'Brazil': ['Portuguese', 'English', 'Spanish'],
  'Colombia': ['Spanish', 'English', 'Portuguese'],
  'Chile': ['Spanish', 'English', 'German'],
  'Peru': ['Spanish', 'English', 'Portuguese'],
  'France': ['French', 'English', 'Spanish'],
  'Belgium': ['French', 'Dutch', 'German'],
  'Switzerland': ['German', 'French', 'Italian'],
  'Germany': ['German', 'English', 'French'],
  'Austria': ['German', 'English', 'Italian'],
  'Italy': ['Italian', 'English', 'Spanish'],
  'Portugal': ['Portuguese', 'English', 'Spanish'],
  'Poland': ['Polish', 'English', 'German'],
  'Sweden': ['Swedish', 'English', 'German'],
  'Norway': ['Swedish', 'English', 'German'],
  'Denmark': ['German', 'Swedish', 'English'],
  'Finland': ['Swedish', 'Russian', 'English'],
  'Greece': ['Greek', 'English', 'French'],
  'Czech Republic': ['Czech', 'English', 'German'],
  'Hungary': ['Hungarian', 'English', 'German'],
  'Romania': ['Romanian', 'English', 'French'],
  'Russia': ['Russian', 'English', 'German'],
  'Ukraine': ['Ukrainian', 'Russian', 'English'],
  'Belarus': ['Russian', 'Ukrainian', 'English'],
  'Japan': ['Japanese', 'English', 'Chinese'],
  'South Korea': ['Korean', 'English', 'Japanese'],
  'China': ['Chinese', 'English', 'Japanese'],
  'Taiwan': ['Chinese', 'English', 'Japanese'],
  'India': ['Hindi', 'English', 'French'],
  'Pakistan': ['English', 'Arabic', 'Persian'],
  'Thailand': ['Thai', 'English', 'Chinese'],
  'Philippines': ['English', 'Spanish', 'Chinese'],
  'Singapore': ['English', 'Chinese', 'Japanese'],
  'United Arab Emirates': ['Arabic', 'English', 'French'],
  'Saudi Arabia': ['Arabic', 'English', 'French'],
  'Egypt': ['Arabic', 'English', 'French'],
  'Israel': ['Hebrew', 'English', 'Russian'],
  'Turkey': ['Turkish', 'English', 'German'],
  'Iran': ['Persian', 'English', 'Arabic'],
  'South Africa': ['English', 'Dutch', 'French'],
};

const getTrendyLanguagesForCountry = (countryName) => {
  const custom = COUNTRY_TRENDY_LANGUAGES[countryName];
  if (custom && custom.length >= 3) {
    const valid = custom.filter((l) => LANGUAGES.includes(l));
    if (valid.length >= 3) return valid.slice(0, 3);
  }
  return ['English', 'Spanish', 'French'];
};

const DIAL_CODES = [
  { code: 'AF', dial: '+93',  name: 'Afghanistan',            len: [9,  9]  },
  { code: 'AL', dial: '+355', name: 'Albania',                len: [9,  9]  },
  { code: 'DZ', dial: '+213', name: 'Algeria',                len: [9,  9]  },
  { code: 'AR', dial: '+54',  name: 'Argentina',              len: [10, 10] },
  { code: 'AM', dial: '+374', name: 'Armenia',                len: [8,  8]  },
  { code: 'AU', dial: '+61',  name: 'Australia',              len: [9,  9]  },
  { code: 'AT', dial: '+43',  name: 'Austria',                len: [10, 11] },
  { code: 'AZ', dial: '+994', name: 'Azerbaijan',             len: [9,  9]  },
  { code: 'BD', dial: '+880', name: 'Bangladesh',             len: [10, 10] },
  { code: 'BY', dial: '+375', name: 'Belarus',                len: [9,  9]  },
  { code: 'BE', dial: '+32',  name: 'Belgium',                len: [9,  9]  },
  { code: 'BO', dial: '+591', name: 'Bolivia',                len: [8,  8]  },
  { code: 'BA', dial: '+387', name: 'Bosnia and Herzegovina', len: [8,  8]  },
  { code: 'BR', dial: '+55',  name: 'Brazil',                 len: [10, 11] },
  { code: 'BG', dial: '+359', name: 'Bulgaria',               len: [9,  9]  },
  { code: 'KH', dial: '+855', name: 'Cambodia',               len: [8,  9]  },
  { code: 'CA', dial: '+1',   name: 'Canada',                 len: [10, 10] },
  { code: 'CL', dial: '+56',  name: 'Chile',                  len: [9,  9]  },
  { code: 'CN', dial: '+86',  name: 'China',                  len: [11, 11] },
  { code: 'CO', dial: '+57',  name: 'Colombia',               len: [10, 10] },
  { code: 'HR', dial: '+385', name: 'Croatia',                len: [8,  9]  },
  { code: 'CZ', dial: '+420', name: 'Czech Republic',         len: [9,  9]  },
  { code: 'DK', dial: '+45',  name: 'Denmark',                len: [8,  8]  },
  { code: 'EC', dial: '+593', name: 'Ecuador',                len: [9,  9]  },
  { code: 'EG', dial: '+20',  name: 'Egypt',                  len: [10, 10] },
  { code: 'EE', dial: '+372', name: 'Estonia',                len: [7,  8]  },
  { code: 'ET', dial: '+251', name: 'Ethiopia',               len: [9,  9]  },
  { code: 'FI', dial: '+358', name: 'Finland',                len: [9,  10] },
  { code: 'FR', dial: '+33',  name: 'France',                 len: [9,  9]  },
  { code: 'GE', dial: '+995', name: 'Georgia',                len: [9,  9]  },
  { code: 'DE', dial: '+49',  name: 'Germany',                len: [10, 11] },
  { code: 'GH', dial: '+233', name: 'Ghana',                  len: [9,  9]  },
  { code: 'GR', dial: '+30',  name: 'Greece',                 len: [10, 10] },
  { code: 'GT', dial: '+502', name: 'Guatemala',              len: [8,  8]  },
  { code: 'HU', dial: '+36',  name: 'Hungary',                len: [9,  9]  },
  { code: 'IN', dial: '+91',  name: 'India',                  len: [10, 10] },
  { code: 'ID', dial: '+62',  name: 'Indonesia',              len: [9,  12] },
  { code: 'IR', dial: '+98',  name: 'Iran',                   len: [10, 10] },
  { code: 'IQ', dial: '+964', name: 'Iraq',                   len: [10, 10] },
  { code: 'IE', dial: '+353', name: 'Ireland',                len: [9,  9]  },
  { code: 'IL', dial: '+972', name: 'Israel',                 len: [9,  9]  },
  { code: 'IT', dial: '+39',  name: 'Italy',                  len: [9,  10] },
  { code: 'JP', dial: '+81',  name: 'Japan',                  len: [10, 10] },
  { code: 'JO', dial: '+962', name: 'Jordan',                 len: [9,  9]  },
  { code: 'KZ', dial: '+7',   name: 'Kazakhstan',             len: [10, 10] },
  { code: 'KE', dial: '+254', name: 'Kenya',                  len: [9,  9]  },
  { code: 'XK', dial: '+383', name: 'Kosovo',                 len: [8,  8]  },
  { code: 'KW', dial: '+965', name: 'Kuwait',                 len: [8,  8]  },
  { code: 'LV', dial: '+371', name: 'Latvia',                 len: [8,  8]  },
  { code: 'LB', dial: '+961', name: 'Lebanon',                len: [7,  8]  },
  { code: 'LY', dial: '+218', name: 'Libya',                  len: [9,  9]  },
  { code: 'LT', dial: '+370', name: 'Lithuania',              len: [8,  8]  },
  { code: 'MY', dial: '+60',  name: 'Malaysia',               len: [9,  10] },
  { code: 'MX', dial: '+52',  name: 'Mexico',                 len: [10, 10] },
  { code: 'MD', dial: '+373', name: 'Moldova',                len: [8,  8]  },
  { code: 'MN', dial: '+976', name: 'Mongolia',               len: [8,  8]  },
  { code: 'MA', dial: '+212', name: 'Morocco',                len: [9,  9]  },
  { code: 'NL', dial: '+31',  name: 'Netherlands',            len: [9,  9]  },
  { code: 'NZ', dial: '+64',  name: 'New Zealand',            len: [8,  9]  },
  { code: 'NG', dial: '+234', name: 'Nigeria',                len: [10, 10] },
  { code: 'MK', dial: '+389', name: 'North Macedonia',        len: [8,  8]  },
  { code: 'NO', dial: '+47',  name: 'Norway',                 len: [8,  8]  },
  { code: 'PK', dial: '+92',  name: 'Pakistan',               len: [10, 10] },
  { code: 'PY', dial: '+595', name: 'Paraguay',               len: [9,  9]  },
  { code: 'PE', dial: '+51',  name: 'Peru',                   len: [9,  9]  },
  { code: 'PH', dial: '+63',  name: 'Philippines',            len: [10, 10] },
  { code: 'PL', dial: '+48',  name: 'Poland',                 len: [9,  9]  },
  { code: 'PT', dial: '+351', name: 'Portugal',               len: [9,  9]  },
  { code: 'QA', dial: '+974', name: 'Qatar',                  len: [8,  8]  },
  { code: 'RO', dial: '+40',  name: 'Romania',                len: [9,  9]  },
  { code: 'RU', dial: '+7',   name: 'Russia',                 len: [10, 10] },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia',           len: [9,  9]  },
  { code: 'RS', dial: '+381', name: 'Serbia',                 len: [8,  9]  },
  { code: 'SK', dial: '+421', name: 'Slovakia',               len: [9,  9]  },
  { code: 'SI', dial: '+386', name: 'Slovenia',               len: [8,  8]  },
  { code: 'ZA', dial: '+27',  name: 'South Africa',           len: [9,  9]  },
  { code: 'KR', dial: '+82',  name: 'South Korea',            len: [9,  10] },
  { code: 'ES', dial: '+34',  name: 'Spain',                  len: [9,  9]  },
  { code: 'LK', dial: '+94',  name: 'Sri Lanka',              len: [9,  9]  },
  { code: 'SE', dial: '+46',  name: 'Sweden',                 len: [9,  9]  },
  { code: 'CH', dial: '+41',  name: 'Switzerland',            len: [9,  9]  },
  { code: 'SY', dial: '+963', name: 'Syria',                  len: [9,  9]  },
  { code: 'TW', dial: '+886', name: 'Taiwan',                 len: [9,  9]  },
  { code: 'TH', dial: '+66',  name: 'Thailand',               len: [9,  9]  },
  { code: 'TN', dial: '+216', name: 'Tunisia',                len: [8,  8]  },
  { code: 'TR', dial: '+90',  name: 'Turkey',                 len: [10, 10] },
  { code: 'UA', dial: '+380', name: 'Ukraine',                len: [9,  9]  },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates',   len: [9,  9]  },
  { code: 'GB', dial: '+44',  name: 'United Kingdom',         len: [10, 10] },
  { code: 'US', dial: '+1',   name: 'United States',          len: [10, 10] },
  { code: 'UY', dial: '+598', name: 'Uruguay',                len: [8,  8]  },
  { code: 'UZ', dial: '+998', name: 'Uzbekistan',             len: [9,  9]  },
  { code: 'VE', dial: '+58',  name: 'Venezuela',              len: [10, 10] },
  { code: 'VN', dial: '+84',  name: 'Vietnam',                len: [9,  10] },
  { code: 'YE', dial: '+967', name: 'Yemen',                  len: [9,  9]  },
];

const DIAL_EXAMPLES = {
  '+93': '701234567',   '+355': '661234567',  '+213': '551234567',
  '+54': '1123456789',  '+374': '77123456',   '+61': '412345678',
  '+43': '6641234567',  '+994': '501234567',  '+880': '1712345678',
  '+375': '291234567',  '+32': '470123456',   '+591': '71234567',
  '+387': '61123456',   '+55': '11912345678', '+359': '881234567',
  '+855': '12345678',   '+1':  '2015551234',  '+56': '912345678',
  '+86': '13812345678', '+57': '3001234567',  '+385': '91234567',
  '+420': '601123456',  '+45': '20123456',    '+593': '991234567',
  '+20': '1001234567',  '+372': '51234567',   '+251': '911234567',
  '+358': '412345678',  '+33': '612345678',   '+995': '555123456',
  '+49': '15123456789', '+233': '201234567',  '+30': '6912345678',
  '+502': '51234567',   '+36': '201234567',   '+91': '9123456789',
  '+62': '81234567890', '+98': '9123456789',  '+964': '7901234567',
  '+353': '851234567',  '+972': '501234567',  '+39': '3123456789',
  '+81': '9012345678',  '+962': '791234567',  '+7':  '9161234567',
  '+254': '712345678',  '+383': '43123456',   '+965': '51234567',
  '+371': '21234567',   '+961': '3123456',    '+218': '912345678',
  '+370': '61234567',   '+60': '123456789',   '+52': '5512345678',
  '+373': '69123456',   '+976': '88123456',   '+212': '612345678',
  '+31': '612345678',   '+64': '21123456',    '+234': '8012345678',
  '+389': '71234567',   '+47': '41234567',    '+92': '3001234567',
  '+595': '961234567',  '+51': '912345678',   '+63': '9171234567',
  '+48': '512345678',   '+351': '912345678',  '+974': '33123456',
  '+40': '712345678',   '+966': '512345678',  '+381': '641234567',
  '+421': '901234567',  '+386': '31234567',   '+27': '711234567',
  '+82': '1012345678',  '+34': '612345678',   '+94': '712345678',
  '+46': '701234567',   '+41': '791234567',   '+963': '944123456',
  '+886': '912345678',  '+66': '812345678',   '+216': '20123456',
  '+90': '5321234567',  '+380': '501234567',  '+971': '501234567',
  '+44': '7911123456',  '+598': '91234567',   '+998': '901234567',
  '+58': '4121234567',  '+84': '912345678',   '+967': '712345678',
};

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina',
  'Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia','Croatia',
  'Czech Republic','Denmark','Ecuador','Egypt','Estonia','Ethiopia','Finland',
  'France','Georgia','Germany','Ghana','Greece','Guatemala','Hungary','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan',
  'Kazakhstan','Kenya','Kosovo','Kuwait','Latvia','Lebanon','Libya','Lithuania',
  'Malaysia','Mexico','Moldova','Mongolia','Morocco','Netherlands','New Zealand',
  'Nigeria','North Macedonia','Norway','Pakistan','Paraguay','Peru','Philippines',
  'Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia',
  'Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka',
  'Sweden','Switzerland','Syria','Taiwan','Thailand','Tunisia','Turkey',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Venezuela','Vietnam','Yemen',
];

// ── Master Country Flag & ISO Conversion Registry ──
const COUNTRY_TO_CODE = DIAL_CODES.reduce((acc, cur) => {
  acc[cur.name] = cur.code;
  return acc;
}, {});

const getFlagFromCode = (code) => {
  if (!code || typeof code !== 'string' || code.length !== 2) return '🌐';
  const offset = 127397;
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + offset));
  } catch (e) {
    return '🌐';
  }
};

const getCountryFlag = (countryName) => {
  const code = COUNTRY_TO_CODE[countryName];
  return getFlagFromCode(code);
};

const GOALS = [
  {
    id: 'date',
    title: 'Set up a Date',
    desc: 'Suggests drinks, coffee, or dinner once there is a good vibe.',
    icon: 'calendar',
    gradient: [uiTheme.colors.primary, uiTheme.colors.secondary],
    accentColor: uiTheme.colors.primary,
    bgActive: 'rgba(255, 51, 102, 0.12)',
  },
  {
    id: 'phone',
    title: 'Get Her Number',
    desc: 'Asks for her number so you can text or WhatsApp directly.',
    icon: 'call',
    gradient: ['#00E676', '#00B0FF'],
    accentColor: '#00E676',
    bgActive: 'rgba(0, 230, 118, 0.10)',
  },
  {
    id: 'social',
    title: 'Exchange Socials',
    desc: 'Swaps Instagram or Snapchat to check out photos and stories.',
    icon: 'logo-instagram',
    gradient: ['#E040FB', '#7C4DFF'],
    accentColor: '#E040FB',
    bgActive: 'rgba(224, 64, 251, 0.10)',
  },
  {
    id: 'never_stop',
    title: 'Casual Chat & Banter',
    desc: 'Keeps the conversation fun and playful with no rush to meet.',
    icon: 'chatbubbles',
    gradient: ['#00E5FF', '#2979FF'],
    accentColor: '#00E5FF',
    bgActive: 'rgba(0, 229, 255, 0.10)',
  },
];

const getStrategySummary = (goals) => {
  if (!goals || goals.length === 0) {
    return 'Pick at least one goal so Flint knows how to guide your chats.';
  }
  if (goals.includes('never_stop')) {
    return 'Flint will keep the banter fun and relaxed, letting the conversation flow with zero rush.';
  }
  const hasDate = goals.includes('date');
  const hasPhone = goals.includes('phone');
  const hasSocial = goals.includes('social');

  if (hasDate && hasPhone && hasSocial) {
    return 'Flint will break the ice, swap Instagram or numbers, and help you set up an in-person date.';
  }
  if (hasDate && hasPhone) {
    return 'Flint will build a fun connection, get her number, and find a great time to grab drinks or coffee.';
  }
  if (hasDate && hasSocial) {
    return 'Flint will keep the vibe fun, swap Instagrams, and suggest meeting up when she is interested.';
  }
  if (hasPhone && hasSocial) {
    return 'Flint will focus on moving the chat from Tinder over to text, WhatsApp, or Instagram.';
  }
  if (hasDate) {
    return 'Flint will focus on turning great chats into real-world dates.';
  }
  if (hasPhone) {
    return 'Flint will find the right moment to ask for her number so you can text directly.';
  }
  if (hasSocial) {
    return 'Flint will naturally trade Instagram or Snapchat handles with her.';
  }
  return 'Flint will keep things natural and charming while getting to know her.';
};

// Apple-calibrated UI spring physics: damping ~0.86, response ~0.35s
const CARD_SPRING = { mass: 1, stiffness: 170, damping: 26 };
const POP_SPRING = { mass: 0.6, stiffness: 260, damping: 18 }; // snappier, for checkmark
const COUNTER_SPRING = { mass: 0.5, stiffness: 300, damping: 20 }; // for header counter pulse

// ── 5-Layer Native-Driver Animated Goal Card ──
const GoalCardItem = React.memo(({ goal, isSelected, onToggle }) => {
  const progress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const checkProgress = useRef(new Animated.Value(isSelected ? 1 : 0.6)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    });
  }, []);

  useEffect(() => {
    if (reduceMotion.current) {
      progress.setValue(isSelected ? 1 : 0);
      checkProgress.setValue(isSelected ? 1 : 0.6);
      if (isSelected) ripple.setValue(1);
      return;
    }

    Animated.spring(progress, {
      toValue: isSelected ? 1 : 0,
      ...CARD_SPRING,
      useNativeDriver: true,
    }).start();

    Animated.spring(checkProgress, {
      toValue: isSelected ? 1 : 0.6,
      ...POP_SPRING,
      useNativeDriver: true,
    }).start();

    if (isSelected) {
      ripple.setValue(0);
      Animated.timing(ripple, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.965,
      mass: 0.5,
      stiffness: 300,
      damping: 20,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      mass: 0.5,
      stiffness: 200,
      damping: 18,
      useNativeDriver: true,
    }).start();
  };

  // Layer 2: Lift + scale (transform-only, 100% GPU on native thread)
  const cardTranslateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });
  const cardLiftScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.018],
  });

  // Layer 1: Ambient halo glow behind card
  const glowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.32],
  });
  const glowScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.04],
  });

  // Dedicated Shadow View (separate from elevation - avoids re-rasterization on Android)
  const shadowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.24],
  });
  const shadowScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.05],
  });

  // Layer 4: Icon disk micro-rotation + modest overshoot
  const iconRotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-3deg', '0deg'],
  });
  const iconScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  // Layer 5: Checkmark ripple ring
  const ringOpacity = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 0],
  });
  const ringScale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  return (
    <Pressable
      onPress={() => onToggle(goal.id)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${goal.title}: ${goal.desc}`}
      style={styles.goalCardWrap}
    >
      {/* Layer 1: Ambient Halo Glow */}
      <Animated.View
        style={[
          styles.goalGlow,
          {
            backgroundColor: goal.accentColor,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
        pointerEvents="none"
      />

      {/* Layer 2: Dedicated GPU Shadow (avoids Android elevation re-rasterization) */}
      <Animated.View
        style={[
          styles.goalShadow,
          {
            opacity: shadowOpacity,
            transform: [{ scale: shadowScale }, { translateY: 3 }],
          },
        ]}
        pointerEvents="none"
      />

      {/* Layer 3: Card Surface with Lift & Scale */}
      <Animated.View
        style={[
          styles.goalCard,
          {
            transform: [
              { translateY: cardTranslateY },
              { scale: cardLiftScale },
              { scale: pressScale },
            ],
          },
        ]}
      >
        {/* Pre-rendered Gradient Sheen with Native Opacity */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: progress }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[`${goal.accentColor}26`, `${goal.accentColor}02`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Specular Border with Native Opacity */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.goalSpecularBorder,
            { borderColor: goal.accentColor, opacity: progress },
          ]}
          pointerEvents="none"
        />

        {/* Layer 4: Icon Disk with Micro-Rotation */}
        <Animated.View
          style={[
            styles.goalIconDisk,
            {
              transform: [{ rotate: iconRotate }, { scale: iconScale }],
            },
          ]}
        >
          <LinearGradient
            colors={
              isSelected
                ? goal.gradient
                : ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons
            name={goal.icon}
            size={20}
            color={isSelected ? '#FFFFFF' : 'rgba(245, 230, 240, 0.6)'}
          />
        </Animated.View>

        {/* Content Info */}
        <View style={styles.goalInfo}>
          <Text style={[styles.goalTitle, isSelected && styles.goalTitleSelected]}>
            {goal.title}
          </Text>
          <Text style={[styles.goalDesc, isSelected && styles.goalDescSelected]}>
            {goal.desc}
          </Text>
        </View>

        {/* Layer 5: Checkmark Squircle & Expanding Ripple Ring */}
        <View style={styles.goalCheckWrap}>
          <Animated.View
            style={[
              styles.goalRippleRing,
              {
                borderColor: goal.accentColor,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.goalCheckSquircle,
              {
                backgroundColor: isSelected ? goal.accentColor : 'rgba(255, 255, 255, 0.04)',
                borderColor: isSelected ? goal.accentColor : 'rgba(255, 255, 255, 0.22)',
                transform: [{ scale: checkProgress }],
              },
            ]}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const FREQUENCIES = [
  {
    value: 30,
    label: 'Active',
    time: '30m',
    icon: 'flash',
    sub: 'Fast replies',
    insight: 'Replies every 30m while chats are hot.',
  },
  {
    value: 60,
    label: 'Balanced',
    time: '1h',
    icon: 'sparkles',
    sub: 'Recommended',
    insight: 'Checks every hour — natural daily rhythm.',
  },
  {
    value: 120,
    label: 'Relaxed',
    time: '2h',
    icon: 'cafe',
    sub: 'Casual pace',
    insight: 'Checks every 2 hours — relaxed, chill texting.',
  },
];

const PERSONALITIES = [
  {
    id: 'freestyle',
    label: 'Freestyle',
    tagline: 'Context-Smart',
    icon: 'sparkles',
    accentColor: uiTheme.colors.primary,
    previewOpener: "Hey! Love the energy in your profile. How's your week treating you so far?",
    vibeDesc: 'Adapts to photos and bio cues for natural chemistry.',
  },
  {
    id: 'flirty',
    label: 'Flirty',
    tagline: 'Teasing & Warm',
    icon: 'flame',
    accentColor: uiTheme.colors.accent,
    previewOpener: "Had to swipe right — that smile definitely caught my eye. What's your secret?",
    vibeDesc: 'Playful compliments and charm to spark chemistry fast.',
  },
  {
    id: 'confident',
    label: 'Confident',
    tagline: 'Direct & Bold',
    icon: 'diamond',
    accentColor: '#00E5FF',
    previewOpener: "Hey, good taste! Let's skip the small talk — what are you most passionate about right now?",
    vibeDesc: 'Direct, bold questions that cut past small talk.',
  },
  {
    id: 'witty',
    label: 'Witty',
    tagline: 'Sharp Banter',
    icon: 'bulb',
    accentColor: '#B388FF',
    previewOpener: "Quick question: what's the craziest story behind your third travel photo?",
    vibeDesc: 'Clever banter and humor to get her smiling right away.',
  },
  {
    id: 'charming',
    label: 'Charming',
    tagline: 'Smooth & Polite',
    icon: 'heart',
    accentColor: uiTheme.colors.secondary,
    previewOpener: "Honestly couldn't just scroll past without saying hi. What's something fun you've been up to?",
    vibeDesc: 'Smooth curiosity with classic gentlemanly warmth.',
  },
  {
    id: 'playful',
    label: 'Playful',
    tagline: 'High Energy',
    icon: 'happy',
    accentColor: '#FFD600',
    previewOpener: 'Swiped right for the vibe, stayed to see if your humor matches mine 😏',
    vibeDesc: 'Lively teasing and fun energy to keep chats exciting.',
  },
  {
    id: 'bold',
    label: 'Bold',
    tagline: 'Direct & Daring',
    icon: 'flash',
    accentColor: '#FF3D00',
    previewOpener: "Let's be real — we'd probably have great chemistry over coffee or drinks.",
    vibeDesc: 'Daring, memorable openers that stand out instantly.',
  },
  {
    id: 'romantic',
    label: 'Romantic',
    tagline: 'Sweet & Sincere',
    icon: 'rose',
    accentColor: '#F48FB1',
    previewOpener: "Love the energy in your photos. What's something that always brings a smile to your face?",
    vibeDesc: 'Sweet, sincere questions that spark real feelings.',
  },
  {
    id: 'gentle',
    label: 'Gentle',
    tagline: 'Relaxed & Kind',
    icon: 'cafe',
    accentColor: '#00E676',
    previewOpener: 'Hey there! Loved your profile, you seem to have really warm, down-to-earth energy.',
    vibeDesc: 'Relaxed, warm curiosity with zero pressure or rush.',
  },
  {
    id: 'serious',
    label: 'Deep Connection',
    tagline: 'Authentic & Real',
    icon: 'compass',
    accentColor: '#448AFF',
    previewOpener: "Looking for something real and genuine. What's a passion project you love working on?",
    vibeDesc: 'Authentic, thoughtful questions for deeper connections.',
  },
];

const PRIMARY_PERSONALITY_IDS = ['freestyle', 'flirty', 'confident', 'witty', 'charming', 'gentle'];

export default function OnboardingScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // ── Step Selections State ──
  const selectedPlatform = 'tinder'; // Tinder-dedicated app
  const [country, setCountry] = useState('United States');
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);
  const [dialCode, setDialCode] = useState('+1');
  const [whatsapp, setWhatsapp] = useState('');
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState(['date', 'phone']);
  const [goalFeedback, setGoalFeedback] = useState(null);
  const goalFeedbackTimer = useRef(null);
  const strategyFadeAnim = useRef(new Animated.Value(1)).current;
  const [strategyText, setStrategyText] = useState(() => getStrategySummary(['date', 'phone']));
  const counterPulse = useRef(new Animated.Value(1)).current;
  const prevGoalsRef = useRef(selectedGoals);

  useEffect(() => {
    if (prevGoalsRef.current !== selectedGoals) {
      prevGoalsRef.current = selectedGoals;
      Animated.sequence([
        Animated.timing(counterPulse, { toValue: 1.12, duration: 90, useNativeDriver: true }),
        Animated.spring(counterPulse, { toValue: 1, ...COUNTER_SPRING, useNativeDriver: true }),
      ]).start();
    }
  }, [selectedGoals]);

  useEffect(() => {
    Animated.timing(strategyFadeAnim, {
      toValue: 0.15,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setStrategyText(getStrategySummary(selectedGoals));
      Animated.timing(strategyFadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [selectedGoals]);

  const primaryGoalObj = useMemo(() => {
    if (!selectedGoals || selectedGoals.length === 0) return GOALS[0];
    return GOALS.find((g) => g.id === selectedGoals[0]) || GOALS[0];
  }, [selectedGoals]);

  const goalsSummary = useMemo(() => {
    if (!selectedGoals || selectedGoals.length === 0) {
      return {
        title: 'Casual Chat & Banter',
        detail: 'Fun, playful chats with zero pressure to meet',
      };
    }
    if (selectedGoals.includes('never_stop')) {
      return {
        title: 'Casual Chat & Banter',
        detail: 'Fun, playful chats with zero pressure to meet',
      };
    }
    const matched = GOALS.filter((g) => selectedGoals.includes(g.id));
    const hasDate = selectedGoals.includes('date');
    const hasPhone = selectedGoals.includes('phone');
    const hasSocial = selectedGoals.includes('social');

    if (matched.length === 1) {
      if (hasDate) {
        return {
          title: 'Set up a Date',
          detail: 'Focused on turning great chats into real-world dates',
        };
      }
      if (hasPhone) {
        return {
          title: 'Get Her Number',
          detail: 'Finds the right moment to get her number so you can text',
        };
      }
      if (hasSocial) {
        return {
          title: 'Exchange Socials',
          detail: 'Naturally trades Instagram or Snapchat handles',
        };
      }
      return {
        title: matched[0].title,
        detail: matched[0].desc,
      };
    }

    if (hasDate && hasPhone && hasSocial) {
      return {
        title: 'Dates, Numbers & Socials',
        detail: 'Builds chemistry, swaps handles, and lines up dates',
      };
    }
    if (hasDate && hasPhone) {
      return {
        title: 'Set up a Date & Get Her Number',
        detail: 'Builds chemistry, gets her number, and plans a date',
      };
    }
    if (hasDate && hasSocial) {
      return {
        title: 'Set up a Date & Exchange Socials',
        detail: 'Trades Instagram handles and suggests meeting up',
      };
    }
    if (hasPhone && hasSocial) {
      return {
        title: 'Get Her Number & Exchange Socials',
        detail: 'Moves the chat smoothly over to WhatsApp or Instagram',
      };
    }

    return {
      title: matched.map((g) => g.title).join(' & '),
      detail: 'Tailored to spark chemistry and lead to real dates',
    };
  }, [selectedGoals]);

  const [frequency, setFrequency] = useState(30);
  const frequencyPulse = useRef(new Animated.Value(1)).current;
  const cadenceFadeAnim = useRef(new Animated.Value(1)).current;
  const [cadenceTrackWidth, setCadenceTrackWidth] = useState(0);
  const cadenceSliderAnim = useRef(new Animated.Value(0)).current;
  const shieldPulse = useRef(new Animated.Value(1)).current;
  const [personality, setPersonality] = useState('freestyle');
  const [showAllPersonalities, setShowAllPersonalities] = useState(false);
  const voiceFadeAnim = useRef(new Animated.Value(1)).current;
  const personalityPulse = useRef(new Animated.Value(1)).current;
  const [safeMode, setSafeMode] = useState(true);

  const currentFreqObj = useMemo(
    () => FREQUENCIES.find((f) => f.value === frequency) || FREQUENCIES[1],
    [frequency]
  );

  const cadenceSegmentWidth = useMemo(() => {
    return cadenceTrackWidth > 6 ? (cadenceTrackWidth - 6) / 3 : 0;
  }, [cadenceTrackWidth]);

  const cadenceSliderTranslateX = useMemo(() => {
    if (!cadenceSegmentWidth) return 0;
    return cadenceSliderAnim.interpolate({
      inputRange: [0, 1, 2],
      outputRange: [0, cadenceSegmentWidth, cadenceSegmentWidth * 2],
    });
  }, [cadenceSegmentWidth, cadenceSliderAnim]);

  const handleSelectFrequency = (val) => {
    safeHaptic('light');
    if (val === frequency) return;
    const targetIdx = FREQUENCIES.findIndex((f) => f.value === val);
    if (targetIdx !== -1) {
      Animated.spring(cadenceSliderAnim, {
        toValue: targetIdx,
        ...POP_SPRING,
        useNativeDriver: true,
      }).start();
    }
    Animated.sequence([
      Animated.timing(frequencyPulse, { toValue: 1.12, duration: 80, useNativeDriver: true }),
      Animated.spring(frequencyPulse, { toValue: 1, ...COUNTER_SPRING, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(cadenceFadeAnim, { toValue: 0.2, duration: 70, useNativeDriver: true }),
      Animated.timing(cadenceFadeAnim, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    setFrequency(val);
  };

  // Living shield beacon pulse loop (when safeMode is active)
  useEffect(() => {
    if (!safeMode) {
      shieldPulse.setValue(1);
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shieldPulse, { toValue: 1.25, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shieldPulse, { toValue: 1.0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [safeMode, shieldPulse]);

  const currentPersonalityObj = useMemo(
    () => PERSONALITIES.find((p) => p.id === personality) || PERSONALITIES[0],
    [personality]
  );

  const displayedPersonalities = useMemo(() => {
    if (showAllPersonalities) {
      return PERSONALITIES;
    }
    const primary = PERSONALITIES.filter((p) => PRIMARY_PERSONALITY_IDS.includes(p.id));
    if (!PRIMARY_PERSONALITY_IDS.includes(personality)) {
      const selectedExtra = PERSONALITIES.find((p) => p.id === personality);
      if (selectedExtra) {
        return [...primary.slice(0, 5), selectedExtra];
      }
    }
    return primary;
  }, [showAllPersonalities, personality]);

  const handleSelectPersonality = (id) => {
    safeHaptic('light');
    if (id === personality) return;
    Animated.sequence([
      Animated.timing(personalityPulse, { toValue: 1.12, duration: 80, useNativeDriver: true }),
      Animated.spring(personalityPulse, { toValue: 1, ...COUNTER_SPRING, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(voiceFadeAnim, { toValue: 0.15, duration: 80, useNativeDriver: true }),
      Animated.timing(voiceFadeAnim, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    setPersonality(id);
  };

  // ── Voice of Flint Real-Time Typewriter & AI Visualizer ──
  const [typedOpener, setTypedOpener] = useState('');
  const [isTypingOpener, setIsTypingOpener] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const typingTimerRef = useRef(null);
  const draftingTimerRef = useRef(null);
  const voiceCursorOpacity = useRef(new Animated.Value(1)).current;
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;
  const waveBar1 = useRef(new Animated.Value(0.4)).current;
  const waveBar2 = useRef(new Animated.Value(0.8)).current;
  const waveBar3 = useRef(new Animated.Value(0.5)).current;
  const toneScrollRef = useRef(null);

  // ── Step 5 Live Match Simulator Animated Lifecycle (Real & Adaptive AI Conversation) ──
  const [simPhase, setSimPhase] = useState('typing'); // 'typing' | 'replying'
  const [simVariation, setSimVariation] = useState(0);
  const [activeSimChat, setActiveSimChat] = useState(() =>
    generateDynamicAiConversation({
      country,
      selectedLanguages,
      selectedGoals,
      personality,
      frequency,
      safeMode,
      whatsapp,
      variationIndex: 0,
    })
  );
  const simBubbleOpacity = useRef(new Animated.Value(0)).current;
  const simBubbleScale = useRef(new Animated.Value(0.92)).current;
  const simTimerRef = useRef(null);
  const liveAiAbortRef = useRef(null);

  const triggerSimChat = useCallback((nextVarIndex = null) => {
    if (simTimerRef.current) clearTimeout(simTimerRef.current);
    if (liveAiAbortRef.current) liveAiAbortRef.current();

    setSimPhase('typing');
    simBubbleOpacity.setValue(0);
    simBubbleScale.setValue(0.92);

    const targetVar = typeof nextVarIndex === 'number' ? nextVarIndex : simVariation;
    const dynamicChat = generateDynamicAiConversation({
      country,
      selectedLanguages,
      selectedGoals,
      personality,
      frequency,
      safeMode,
      whatsapp,
      variationIndex: targetVar,
    });
    setActiveSimChat(dynamicChat);

    // Try live AI LLM completion in parallel
    let isCancelled = false;
    liveAiAbortRef.current = () => { isCancelled = true; };

    fetchLiveAiChatReply({
      personality,
      selectedGoals,
      country,
      selectedLanguages,
      incomingMessage: dynamicChat.incomingMessage,
      timeoutMs: 1150,
    }).then(realAiReply => {
      if (!isCancelled && realAiReply) {
        setActiveSimChat(prev => ({
          ...prev,
          aiReply: realAiReply,
          isLiveModel: true,
        }));
      }
    }).catch(() => {});

    simTimerRef.current = setTimeout(() => {
      setSimPhase('replying');
      Animated.parallel([
        Animated.timing(simBubbleOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(simBubbleScale, {
          toValue: 1,
          tension: 260,
          friction: 16,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1300);
  }, [
    country,
    selectedLanguages,
    selectedGoals,
    personality,
    frequency,
    safeMode,
    whatsapp,
    simVariation,
    simBubbleOpacity,
    simBubbleScale,
  ]);

  useEffect(() => {
    if (currentStep === 5) {
      triggerSimChat(0);
    }
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
      if (liveAiAbortRef.current) liveAiAbortRef.current();
    };
  }, [currentStep, personality, country, selectedGoals, triggerSimChat]);

  // Blinking cursor loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(voiceCursorOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(voiceCursorOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [voiceCursorOpacity]);

  // Bouncing typing dots loop
  useEffect(() => {
    const bounce = (anim, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -4, duration: 220, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 220, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }),
          Animated.delay(Math.max(0, 360 - delay)),
        ])
      );
    };

    const d1 = bounce(typingDot1, 0);
    const d2 = bounce(typingDot2, 120);
    const d3 = bounce(typingDot3, 240);

    d1.start();
    d2.start();
    d3.start();

    return () => {
      d1.stop();
      d2.stop();
      d3.stop();
    };
  }, [typingDot1, typingDot2, typingDot3]);

  // Audio / Vibe Waveform Visualizer loop
  useEffect(() => {
    const wave = (anim, toVal, dur) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: toVal, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: dur, useNativeDriver: true }),
        ])
      );
    };
    const w1 = wave(waveBar1, 1.0, 320);
    const w2 = wave(waveBar2, 0.85, 260);
    const w3 = wave(waveBar3, 1.0, 380);
    w1.start();
    w2.start();
    w3.start();
    return () => {
      w1.stop();
      w2.stop();
      w3.stop();
    };
  }, [waveBar1, waveBar2, waveBar3]);

  // Interactive Typewriter Stream Controller
  useEffect(() => {
    if (currentStep !== 4) return;

    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (draftingTimerRef.current) {
      clearTimeout(draftingTimerRef.current);
      draftingTimerRef.current = null;
    }

    setIsDrafting(true);
    setIsTypingOpener(true);
    setTypedOpener('');

    draftingTimerRef.current = setTimeout(() => {
      setIsDrafting(false);
      const fullText = currentPersonalityObj.previewOpener;
      let charIdx = 0;

      typingTimerRef.current = setInterval(() => {
        charIdx += 2;
        if (charIdx >= fullText.length) {
          setTypedOpener(fullText);
          setIsTypingOpener(false);
          if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
        } else {
          setTypedOpener(fullText.slice(0, charIdx));
        }
      }, 24);
    }, 220);

    return () => {
      if (draftingTimerRef.current) clearTimeout(draftingTimerRef.current);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [personality, currentStep, currentPersonalityObj.previewOpener]);

  // ── Modals & Search ──
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountrySearchFocused, setIsCountrySearchFocused] = useState(false);
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [dialSearch, setDialSearch] = useState('');
  const [isDialSearchFocused, setIsDialSearchFocused] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const langExpandAnim = useRef(new Animated.Value(0)).current;

  // ── Living Ambient Aurora Orbs (AuthScreen Quality Sync) ──
  const auroraFloat1 = useRef(new Animated.Value(0)).current;
  const auroraScale1 = useRef(new Animated.Value(1.0)).current;
  const auroraOpacity1 = useRef(new Animated.Value(0.28)).current;
  const auroraFloat2 = useRef(new Animated.Value(0)).current;
  const auroraScale2 = useRef(new Animated.Value(1.05)).current;
  const auroraOpacity2 = useRef(new Animated.Value(0.22)).current;

  // ── Step Navigation & Tactile Physics ──
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  // ── Step 5: Smooth Constellation Path & Executive Emblem Physics ──
  const heroTickScale = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const engineCardAnim = useRef(new Animated.Value(0)).current;
  const node1Anim = useRef(new Animated.Value(0)).current;
  const line1Anim = useRef(new Animated.Value(0)).current;
  const node2Anim = useRef(new Animated.Value(0)).current;
  const line2Anim = useRef(new Animated.Value(0)).current;
  const node3Anim = useRef(new Animated.Value(0)).current;
  const line3Anim = useRef(new Animated.Value(0)).current;
  const node4Anim = useRef(new Animated.Value(0)).current;

  // ── Step 5: Interactive Swipe Deck & Setup Readiness Physics ──
  const [activeProfileIdx, setActiveProfileIdx] = useState(1); // Maya by default
  const [isCardSwiping, setIsCardSwiping] = useState(false);
  const cardPan = useRef(new Animated.ValueXY()).current;
  const laserBeamAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 6 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: () => {
          setIsCardSwiping(true);
          cardPan.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          cardPan.setValue({ x: gestureState.dx, y: gestureState.dy * 0.3 });
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockAppResponder: () => true,
        onPanResponderTerminate: () => {
          setIsCardSwiping(false);
          Animated.spring(cardPan, {
            toValue: { x: 0, y: 0 },
            friction: 7,
            tension: 90,
            useNativeDriver: false,
          }).start();
        },
        onPanResponderRelease: (_, gestureState) => {
          setIsCardSwiping(false);
          const swipeThreshold = 75;
          if (gestureState.dx > swipeThreshold) {
            // Swipe Right -> Like
            safeHaptic('medium');
            Animated.timing(cardPan, {
              toValue: { x: SCREEN_WIDTH + 140, y: gestureState.dy * 0.4 },
              duration: 200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }).start(() => {
              setActiveProfileIdx((prev) => (prev + 1) % PREVIEW_PROFILES.length);
              cardPan.setValue({ x: 0, y: 0 });
            });
          } else if (gestureState.dx < -swipeThreshold) {
            // Swipe Left -> Pass
            safeHaptic('light');
            Animated.timing(cardPan, {
              toValue: { x: -SCREEN_WIDTH - 140, y: gestureState.dy * 0.4 },
              duration: 200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }).start(() => {
              setActiveProfileIdx((prev) => (prev + 1) % PREVIEW_PROFILES.length);
              cardPan.setValue({ x: 0, y: 0 });
            });
          } else {
            // Reset to center
            Animated.spring(cardPan, {
              toValue: { x: 0, y: 0 },
              friction: 7,
              tension: 90,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [cardPan]
  );

  const cardRotate = cardPan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: ['-14deg', '0deg', '14deg'],
    extrapolate: 'clamp',
  });

  const likeStampOpacity = cardPan.x.interpolate({
    inputRange: [20, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeStampOpacity = cardPan.x.interpolate({
    inputRange: [-80, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const nextCardScale = cardPan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: [1.0, 0.94, 1.0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (currentStep === 5) {
      const p = PREVIEW_PROFILES[activeProfileIdx];
      setActiveSimChat((prev) => ({
        ...prev,
        matchName: p.name,
        matchSub: p.sub,
        incomingMessage: p.opener,
      }));
      triggerSimChat(0);
      laserBeamAnim.setValue(0);
      Animated.timing(laserBeamAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [activeProfileIdx, currentStep, triggerSimChat]);

  // ── Step 1: Living Cockpit & Sliding Showcase Physics ──
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const marqueeAnim = useRef(new Animated.Value(0)).current;

  // ── 1. Static Mount: Living Ambient Aurora Loops ──
  useEffect(() => {
    // Ambient Aurora Orb 1 Loop
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auroraFloat1, {
            toValue: 24,
            duration: 6500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale1, {
            toValue: 1.14,
            duration: 6500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auroraOpacity1, {
            toValue: 0.38,
            duration: 6500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(auroraFloat1, {
            toValue: 0,
            duration: 6500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale1, {
            toValue: 1.0,
            duration: 6500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auroraOpacity1, {
            toValue: 0.28,
            duration: 6500,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Ambient Aurora Orb 2 Loop
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auroraFloat2, {
            toValue: -22,
            duration: 7800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale2, {
            toValue: 0.94,
            duration: 7800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auroraOpacity2, {
            toValue: 0.32,
            duration: 7800,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(auroraFloat2, {
            toValue: 0,
            duration: 7800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auroraScale2, {
            toValue: 1.05,
            duration: 7800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auroraOpacity2, {
            toValue: 0.22,
            duration: 7800,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Shimmering Cursor Blink Loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 520,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Infinite Smooth Non-Stop Marquee Slide Loop
    Animated.loop(
      Animated.timing(marqueeAnim, {
        toValue: -TRACK_WIDTH,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    return () => {
      if (goalFeedbackTimer.current) clearTimeout(goalFeedbackTimer.current);
    };
  }, []);

  // ── Step 1: Infinite Smooth Non-Stop Marquee Slide Loop ──
  useEffect(() => {
    let anim;
    if (currentStep === 1) {
      marqueeAnim.setValue(0);
      anim = Animated.loop(
        Animated.timing(marqueeAnim, {
          toValue: -TRACK_WIDTH,
          duration: 18000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      anim.start();
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [currentStep]);

  // ── 2. Executive Confirmation & Setup Readiness on Step 5 ──
  useEffect(() => {
    let sequenceAnim;

    if (currentStep === 5) {
      safeHaptic('medium');
      engineCardAnim.setValue(0);
      cardPan.setValue({ x: 0, y: 0 });
      laserBeamAnim.setValue(0);

      sequenceAnim = Animated.spring(engineCardAnim, {
        toValue: 1,
        tension: 180,
        friction: 12,
        useNativeDriver: false,
      });
      sequenceAnim.start();

      Animated.timing(laserBeamAnim, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }

    return () => {
      if (sequenceAnim) sequenceAnim.stop();
    };
  }, [currentStep]);

  // ── Tactile Button Physics ──
  const handleBtnPressIn = () => {
    Animated.spring(ctaScale, {
      toValue: 0.965,
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

  // ── Dial Code Rules & Phone Constraints ──
  const currentDialRule =
    DIAL_CODES.find((d) => d.dial === dialCode && d.name === country) ||
    DIAL_CODES.find((d) => d.dial === dialCode) || { len: [7, 15] };
  const maxPhoneLength = currentDialRule.len ? currentDialRule.len[1] : 15;
  const minPhoneLength = currentDialRule.len ? currentDialRule.len[0] : 7;
  const isPhoneTooShort = Boolean(whatsapp && whatsapp.length < minPhoneLength);

  const cleanPhoneInput = (raw, maxLen) => {
    let d = raw.replace(/[^\d]/g, '');
    if (d.startsWith('0')) d = d.slice(1);
    return d.slice(0, maxLen || maxPhoneLength);
  };

  const handleWhatsappChange = (text) => {
    setWhatsapp(cleanPhoneInput(text, maxPhoneLength));
  };

  // ── Direction-Aware Smooth Step Transitions ──
  const transitionToStep = (newStep) => {
    const isForward = newStep > currentStep;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 130,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep(newStep);
      slideAnim.setValue(isForward ? 28 : -28);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNext = () => {
    if (currentStep === 2) {
      if (whatsapp && isPhoneTooShort) {
        safeHaptic('error');
        return;
      }
      if (selectedLanguages.length === 0) {
        setSelectedLanguages(['English']);
      }
    }
    safeHaptic('light');
    if (currentStep < totalSteps) {
      transitionToStep(currentStep + 1);
    } else {
      safeHaptic('success');
      navigation.replace('PlatformSelect', {
        onboardingData: {
          platform: selectedPlatform,
          country,
          languages: selectedLanguages,
          dialCode,
          whatsapp,
          goals: selectedGoals,
          frequency,
          personality,
          safeMode,
        },
      });
    }
  };

  const handleBack = () => {
    safeHaptic('light');
    if (currentStep > 1) {
      transitionToStep(currentStep - 1);
    } else {
      navigation.navigate('Auth');
    }
  };

  // ── Country Selection Handler ──
  const handleSelectCountry = (selectedCountryName) => {
    safeHaptic('light');
    setCountry(selectedCountryName);
    const match = DIAL_CODES.find((d) => d.name === selectedCountryName);
    if (match) {
      setDialCode(match.dial);
      if (whatsapp) {
        setWhatsapp(cleanPhoneInput(whatsapp, match.len[1]));
      }
    }
    const newTrendy = getTrendyLanguagesForCountry(selectedCountryName);
    if (newTrendy && newTrendy.length > 0) {
      if (selectedLanguages.length === 1 && selectedLanguages[0] === 'English' && newTrendy[0] !== 'English') {
        setSelectedLanguages(Array.from(new Set([newTrendy[0], 'English'])));
      }
    }
    setCountrySearch('');
    setCountryModalVisible(false);
  };

  // ── Dial Code Selection Handler ──
  const handleSelectDialCode = (item) => {
    safeHaptic('light');
    setDialCode(item.dial);
    if (item.name) {
      setCountry(item.name);
      const newTrendy = getTrendyLanguagesForCountry(item.name);
      if (newTrendy && newTrendy.length > 0) {
        if (selectedLanguages.length === 1 && selectedLanguages[0] === 'English' && newTrendy[0] !== 'English') {
          setSelectedLanguages(Array.from(new Set([newTrendy[0], 'English'])));
        }
      }
    }
    if (whatsapp) {
      setWhatsapp(cleanPhoneInput(whatsapp, item.len[1]));
    }
    setDialSearch('');
    setDialModalVisible(false);
  };

  // ── Language Toggle Handler ──
  const toggleLanguage = (lang) => {
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length > 1) {
        safeHaptic('light');
        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
      } else {
        safeHaptic('warning');
      }
    } else {
      if (selectedLanguages.length >= 4) {
        safeHaptic('warning');
        return;
      }
      safeHaptic('light');
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  // ── Industry-Grade Smooth Language Expansion Toggle Handler ──
  const handleToggleLanguagesExpand = () => {
    safeHaptic('light');
    const nextState = !showAllLanguages;
    setShowAllLanguages(nextState);
    Animated.timing(langExpandAnim, {
      toValue: nextState ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();
  };

  const showGoalFeedback = (msg) => {
    safeHaptic('error');
    setGoalFeedback(msg);
    if (goalFeedbackTimer.current) clearTimeout(goalFeedbackTimer.current);
    goalFeedbackTimer.current = setTimeout(() => {
      setGoalFeedback(null);
    }, 2400);
  };

  // ── Goal Toggle Handler ──
  const toggleGoal = (goalId) => {
    if (goalId === 'never_stop') {
      safeHaptic('medium');
      setSelectedGoals(['never_stop']);
      setGoalFeedback(null);
      return;
    }

    let filtered = selectedGoals.filter((g) => g !== 'never_stop');
    if (filtered.includes(goalId)) {
      if (filtered.length <= 1) {
        showGoalFeedback('Please keep at least 1 goal selected');
        return;
      }
      safeHaptic('light');
      filtered = filtered.filter((g) => g !== goalId);
      setGoalFeedback(null);
    } else {
      if (filtered.length >= 3) {
        showGoalFeedback('You can pick up to 3 goals');
        return;
      }
      safeHaptic('light');
      filtered.push(goalId);
      setGoalFeedback(null);
    }
    setSelectedGoals(filtered);
  };

  const filteredCountries = COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredDialCodes = DIAL_CODES.filter(
    (d) =>
      d.name.toLowerCase().includes(dialSearch.toLowerCase()) ||
      d.dial.includes(dialSearch)
  );

  const currentPhoneExample = DIAL_EXAMPLES[dialCode] || '501234567';
  const trendyLanguages = getTrendyLanguagesForCountry(country);
  const primaryLanguages = Array.from(new Set([...selectedLanguages, ...trendyLanguages]));
  const secondaryLanguages = LANGUAGES.filter((l) => !primaryLanguages.includes(l));
  const hiddenLanguagesCount = secondaryLanguages.length;

  const matchedGoals = useMemo(() => {
    if (!selectedGoals || selectedGoals.length === 0) return [GOALS[0]];
    if (selectedGoals.includes('never_stop')) {
      const g = GOALS.find((item) => item.id === 'never_stop');
      return g ? [g] : [GOALS[0]];
    }
    return GOALS.filter((g) => selectedGoals.includes(g.id));
  }, [selectedGoals]);

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 2.2],
  });
  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.55, 0.25, 0],
  });

  const currentMatch = PREVIEW_PROFILES[activeProfileIdx] || PREVIEW_PROFILES[1];
  const nextMatch = PREVIEW_PROFILES[(activeProfileIdx + 1) % PREVIEW_PROFILES.length];
  const thirdMatch = PREVIEW_PROFILES[(activeProfileIdx + 2) % PREVIEW_PROFILES.length];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── 1. Luxury Atmospheric Base Gradient ── */}
      <LinearGradient
        colors={['#08050B', '#0D0714', '#120A1A', '#160E20']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── 2. Living Ambient Aurora Orbs ── */}
      <Animated.View
        style={[
          styles.auroraOrb1,
          {
            opacity: auroraOpacity1,
            transform: [
              { translateY: auroraFloat1 },
              { scale: auroraScale1 },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[uiTheme.colors.primary, uiTheme.colors.accent, uiTheme.colors.secondary, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 0.9 }}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.auroraOrb2,
          {
            opacity: auroraOpacity2,
            transform: [
              { translateY: auroraFloat2 },
              { scale: auroraScale2 },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['#7928CA', '#9333EA', '#FF0080', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.1, y: 0.2 }}
          end={{ x: 0.9, y: 0.8 }}
        />
      </Animated.View>

      {/* ── 3. Subtle Vignette Scrim ── */}
      <LinearGradient
        colors={['rgba(8, 5, 11, 0.45)', 'rgba(8, 5, 11, 0.78)', '#08050B']}
        locations={[0, 0.45, 0.95]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea}>
        {/* ── Header: Brand / Back, Sign In Pill ── */}
        <View style={styles.header}>
          {currentStep > 1 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerLogoWrap}
              onPress={handleBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Return to Welcome"
            >
              <LinearGradient
                colors={[uiTheme.colors.primary, uiTheme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerLogoGradient}
              >
                <Ionicons name="flame" size={17} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.headerTitleWrap}>
            <Ionicons name="flame" size={19} color={uiTheme.colors.primary} style={styles.headerBrandFlame} />
            <Text style={styles.headerBrandTitle}>Flint</Text>
          </View>

          <TouchableOpacity
            style={styles.headerSignInBtn}
            onPress={() => {
              safeHaptic('light');
              navigation.navigate('Auth');
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            <Text style={styles.headerSignInText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* ── Segmented Progress Bar & Step Phase (All Steps 1-5) ── */}
        <View style={[styles.progressContainer, (currentStep === 3 || currentStep === 4) && styles.progressContainerStep3]}>
          <View style={styles.segmentTrackRow}>
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const isFilled = stepNum <= currentStep;
              const isCurrent = stepNum === currentStep;
              return (
                <View key={stepNum} style={styles.segmentTrack}>
                  {isFilled && (
                    <LinearGradient
                      colors={
                        isCurrent
                          ? [uiTheme.colors.primary, uiTheme.colors.secondary]
                          : [uiTheme.colors.primary, uiTheme.colors.accent]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.stepCounterRow}>
            <Text style={styles.stepCounterText}>
              Step <Text style={styles.stepCounterBold}>{currentStep}</Text> of {totalSteps}
            </Text>

          </View>
        </View>

        {/* ── Animated Step Viewport ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              (currentStep === 3 || currentStep === 4) && styles.scrollContentStep3,
              currentStep === 5 && styles.scrollContentStep5,
            ]}
            scrollEnabled={currentStep === 5 ? !isCardSwiping : true}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.stepContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 1: LIVING LIVE COCKPIT PREVIEW                  */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 1 && (
                <View>
                  {/* Hero Header */}
                  <View style={styles.heroWrap}>
                    <Text style={styles.stepTitle}>Better Dates, Less Effort</Text>
                    <Text style={styles.stepSubtitle}>
                      Flint finds people you'll actually like, sparks natural conversations, and helps you meet up in real life.
                    </Text>
                  </View>

                  {/* Non-Stop Smooth Sliding Cards Showcase */}
                  <View style={styles.marqueeSectionWrap}>
                    <View style={styles.marqueeWindow}>
                      <Animated.View
                          style={[
                            styles.marqueeTrack,
                            { transform: [{ translateX: marqueeAnim }] },
                          ]}
                        >
                          {DISPLAY_CARDS.map((card, idx) => (
                            <View key={`${card.id}-${idx}`} style={styles.cockpitCardContainer}>
                              <LinearGradient
                                colors={['rgba(255, 51, 102, 0.16)', 'rgba(179, 136, 255, 0.08)', 'rgba(22, 14, 32, 0.94)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.cockpitCardGradient}
                              >
                                {/* Top Row: Real Generated Portrait & Match Score */}
                                <View style={styles.cockpitHeaderRow}>
                                  <View style={styles.cockpitAvatarWrap}>
                                    <Image
                                      source={card.image}
                                      style={styles.cockpitAvatarImage}
                                      resizeMode="cover"
                                    />
                                    <View style={styles.cockpitAvatarLiveBeacon} />
                                  </View>

                                  <View style={styles.cockpitProfileMeta}>
                                    <View style={styles.cockpitNameRow}>
                                      <Text style={styles.cockpitProfileName}>{card.name}</Text>
                                      <Ionicons name="checkmark-circle" size={13} color="#00E676" style={{ marginLeft: 5 }} />
                                    </View>
                                    <Text style={styles.cockpitProfileSub} numberOfLines={1}>
                                      {card.sub}
                                    </Text>
                                  </View>

                                  <View style={styles.cockpitScoreWrap}>
                                    <Ionicons name="sparkles" size={13} color="#00E676" style={{ marginRight: 4 }} />
                                    <Text style={styles.cockpitScoreText}>{card.matchScore}</Text>
                                  </View>
                                </View>

                                {/* Hairline Divider */}
                                <View style={styles.cockpitHairline} />

                                {/* Simulated Real-Time Opener Box */}
                                <View style={styles.cockpitOpenerBox}>
                                  <View style={styles.cockpitOpenerHeader}>
                                    <Ionicons name="chatbubble-outline" size={12} color="#B388FF" style={{ marginRight: 5 }} />
                                    <Text style={styles.cockpitOpenerLabel}>Suggested message</Text>
                                  </View>
                                  <Text style={styles.cockpitOpenerText}>
                                    "{card.opener}"
                                    <Animated.Text style={[styles.cockpitCursor, { opacity: cursorOpacity }]}>|</Animated.Text>
                                  </Text>
                                </View>

                                {/* Live Match Reassurance Strip */}
                                <View style={styles.cockpitFooterStrip}>
                                  {card.tags.map((tag, tIdx) => (
                                    <React.Fragment key={tIdx}>
                                      {tIdx > 0 && <View style={styles.cockpitFooterDot} />}
                                      <View style={styles.cockpitFooterItem}>
                                        <Ionicons name={tag.icon} size={12} color={tag.color} />
                                        <Text style={styles.cockpitFooterItemText}>{tag.label}</Text>
                                      </View>
                                    </React.Fragment>
                                  ))}
                                </View>
                              </LinearGradient>
                            </View>
                          ))}
                        </Animated.View>
                      </View>
                    </View>

                  {/* 3 Core Value Pillars */}
                  <View style={styles.featureList}>
                    {/* Pillar 1: Quality Matches */}
                    <View style={styles.featureRow}>
                      <View style={styles.featureIconOuterGlow}>
                        <LinearGradient
                          colors={['rgba(255, 51, 102, 0.28)', 'rgba(255, 51, 102, 0.08)']}
                          style={styles.featureIconWrap}
                        >
                          <Ionicons name="compass-outline" size={20} color={uiTheme.colors.primary} />
                        </LinearGradient>
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Quality Matches</Text>
                        <Text style={styles.featureDesc}>
                          Only connects you with people who share your vibe, lifestyle, and interests.
                        </Text>
                      </View>
                    </View>

                    {/* Pillar 2: Thoughtful Icebreakers */}
                    <View style={styles.featureRow}>
                      <View style={styles.featureIconOuterGlow}>
                        <LinearGradient
                          colors={['rgba(179, 136, 255, 0.28)', 'rgba(179, 136, 255, 0.08)']}
                          style={styles.featureIconWrap}
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#B388FF" />
                        </LinearGradient>
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Thoughtful Icebreakers</Text>
                        <Text style={styles.featureDesc}>
                          Starts chats with natural lines based on what they genuinely love in their bio.
                        </Text>
                      </View>
                    </View>

                    {/* Pillar 3: Real-World Dates */}
                    <View style={styles.featureRow}>
                      <View style={styles.featureIconOuterGlow}>
                        <LinearGradient
                          colors={['rgba(255, 170, 128, 0.28)', 'rgba(255, 170, 128, 0.08)']}
                          style={styles.featureIconWrap}
                        >
                          <Ionicons name="calendar-outline" size={20} color={uiTheme.colors.secondary} />
                        </LinearGradient>
                      </View>
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Real-World Dates</Text>
                        <Text style={styles.featureDesc}>
                          Moves past endless small talk so you can comfortably exchange numbers and meet up.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 2: ABOUT YOU                                   */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 2 && (
                <View>
                  <View style={styles.heroWrap}>
                    <Text style={styles.stepTitle}>About you</Text>
                    <Text style={styles.stepSubtitle}>
                      Flint adapts your conversation tone and references so chats feel completely natural in your area.
                    </Text>
                  </View>

                  {/* Regional Dating Context Card */}
                  <View style={styles.step2GlassCard}>
                    <LinearGradient
                      colors={['rgba(255, 51, 102, 0.10)', 'rgba(179, 136, 255, 0.05)', 'rgba(22, 14, 32, 0.94)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.step2CardGradient}
                    >
                      {/* Sub-section 1: Where you date */}
                      <View style={styles.step2SectionHeader}>
                        <View style={styles.step2IconDiskCoral}>
                          <Ionicons name="location-sharp" size={16} color={uiTheme.colors.primary} />
                        </View>
                        <View style={styles.step2HeaderTextWrap}>
                          <View style={styles.step2TitleWithPillRow}>
                            <Text style={styles.step2SectionTitle}>Where you date</Text>
                            <View style={styles.step2CoralBadgePill}>
                              <Text style={styles.step2CoralBadgeText}>{dialCode}</Text>
                            </View>
                          </View>
                          <Text style={styles.step2SectionSub}>Matches your city, timezone & local slang</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.step2SelectTrigger}
                        onPress={() => {
                          safeHaptic('light');
                          setCountrySearch('');
                          setCountryModalVisible(true);
                        }}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={`Country selector, currently selected: ${country}`}
                      >
                        <View style={styles.step2SelectTriggerLeft}>
                          <View style={styles.step2FlagDisk}>
                            <Text style={styles.step2FlagEmoji}>{getCountryFlag(country)}</Text>
                          </View>
                          <Text style={styles.step2SelectTriggerText} numberOfLines={1}>{country}</Text>
                        </View>
                        <View style={styles.step2ChevronWrap}>
                          <Ionicons name="chevron-down" size={16} color="rgba(245, 230, 240, 0.6)" />
                        </View>
                      </TouchableOpacity>

                      {/* Hairline Divider */}
                      <View style={styles.step2Divider} />

                      {/* Sub-section 2: Languages you speak */}
                      <View style={styles.step2SectionHeader}>
                        <View style={styles.step2IconDiskAmethyst}>
                          <Ionicons name="chatbubbles" size={16} color="#B388FF" />
                        </View>
                        <View style={styles.step2HeaderTextWrap}>
                          <View style={styles.step2TitleWithPillRow}>
                            <Text style={styles.step2SectionTitle}>Languages you speak</Text>
                            <View style={styles.step2LangCountPill}>
                              <Text style={styles.step2LangCountText}>
                                {selectedLanguages.length} selected
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.step2SectionSub}>Flint crafts native openers in these languages</Text>
                        </View>
                      </View>

                      {/* Compact Primary Chips (Top 3 Regional + Active) + Inline Expand Pill */}
                      <View style={styles.langChipsContainer}>
                        {primaryLanguages.map((lang) => {
                          const isSelected = selectedLanguages.includes(lang);
                          return (
                            <TouchableOpacity
                              key={lang}
                              style={[
                                styles.langChip,
                                isSelected && styles.langChipSelected,
                              ]}
                              onPress={() => toggleLanguage(lang)}
                              activeOpacity={0.78}
                              accessibilityRole="button"
                              accessibilityLabel={`${lang}, ${isSelected ? 'selected' : 'not selected'}`}
                            >
                              <Text
                                style={[
                                  styles.langChipText,
                                  isSelected && styles.langChipTextSelected,
                                ]}
                              >
                                {lang}
                              </Text>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={13} color={uiTheme.colors.primary} />
                              )}
                            </TouchableOpacity>
                          );
                        })}

                        {hiddenLanguagesCount > 0 && (
                          <TouchableOpacity
                            style={styles.moreLangChip}
                            onPress={handleToggleLanguagesExpand}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={showAllLanguages ? 'Show fewer languages' : 'Show more languages'}
                          >
                            <Text style={styles.moreLangChipText}>
                              {showAllLanguages ? 'Show Less' : `+ ${hiddenLanguagesCount} More`}
                            </Text>
                            <Animated.View
                              style={{
                                transform: [
                                  {
                                    rotate: langExpandAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: ['0deg', '180deg'],
                                    }),
                                  },
                                ],
                              }}
                            >
                              <Ionicons
                                name="chevron-down"
                                size={13}
                                color={uiTheme.colors.secondary}
                              />
                            </Animated.View>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Smooth Collapsible Secondary Chips Accordion */}
                      <Animated.View
                        style={[
                          styles.secondaryLangWrap,
                          {
                            maxHeight: langExpandAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 360],
                            }),
                            opacity: langExpandAnim.interpolate({
                              inputRange: [0, 0.35, 1],
                              outputRange: [0, 0.5, 1],
                            }),
                            transform: [
                              {
                                translateY: langExpandAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-6, 0],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <View style={styles.langChipsContainerSecondary}>
                          {secondaryLanguages.map((lang) => {
                            const isSelected = selectedLanguages.includes(lang);
                            return (
                              <TouchableOpacity
                                key={lang}
                                style={[
                                  styles.langChip,
                                  isSelected && styles.langChipSelected,
                                ]}
                                onPress={() => toggleLanguage(lang)}
                                activeOpacity={0.78}
                                accessibilityRole="button"
                                accessibilityLabel={`${lang}, ${isSelected ? 'selected' : 'not selected'}`}
                              >
                                <Text
                                  style={[
                                    styles.langChipText,
                                    isSelected && styles.langChipTextSelected,
                                  ]}
                                >
                                  {lang}
                                </Text>
                                {isSelected && (
                                  <Ionicons name="checkmark-circle" size={13} color={uiTheme.colors.primary} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </Animated.View>
                    </LinearGradient>
                  </View>

                  {/* Instant Date Alerts Glass Card */}
                  <View style={styles.step2GlassCardEmerald}>
                    <LinearGradient
                      colors={['rgba(0, 230, 118, 0.09)', 'rgba(22, 14, 32, 0.94)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.step2CardGradient}
                    >
                      <View style={styles.step2SectionHeader}>
                        <View style={styles.step2IconDiskEmerald}>
                          <Ionicons name="logo-whatsapp" size={17} color="#00E676" />
                        </View>
                        <View style={styles.step2HeaderTextWrap}>
                          <View style={styles.step2TitleWithPillRow}>
                            <Text style={styles.step2SectionTitle}>Instant Date Alerts</Text>
                            <View style={styles.step2OptionalPill}>
                              <Text style={styles.step2OptionalText}>VIP Alerts</Text>
                            </View>
                          </View>
                          <Text style={styles.step2SectionSub}>Get a private ping when a match wants to meet up</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.phoneInputWrap,
                          isPhoneFocused && styles.phoneInputWrapFocused,
                          isPhoneTooShort && styles.phoneInputWrapError,
                          Boolean(whatsapp && !isPhoneTooShort) && styles.phoneInputWrapOk,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.dialCodeBtn}
                          onPress={() => {
                            safeHaptic('light');
                            setDialSearch('');
                            setDialModalVisible(true);
                          }}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Country dial code, selected: ${dialCode}`}
                        >
                          <Text style={styles.dialFlagText}>{getCountryFlag(country)}</Text>
                          <Text style={styles.dialCodeText}>{dialCode}</Text>
                          <Ionicons name="chevron-down" size={13} color="rgba(245, 230, 240, 0.6)" />
                        </TouchableOpacity>
                        <View style={styles.dialDivider} />
                        <TextInput
                          style={styles.phoneInput}
                          placeholder={currentPhoneExample}
                          placeholderTextColor="rgba(245, 230, 240, 0.3)"
                          value={whatsapp}
                          onChangeText={handleWhatsappChange}
                          onFocus={() => setIsPhoneFocused(true)}
                          onBlur={() => setIsPhoneFocused(false)}
                          keyboardType="phone-pad"
                          returnKeyType="done"
                          maxLength={maxPhoneLength}
                          accessibilityLabel="WhatsApp phone number for instant date alerts"
                        />
                        {Boolean(whatsapp) && (
                          <TouchableOpacity
                            onPress={() => {
                              safeHaptic('light');
                              setWhatsapp('');
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ padding: 4 }}
                            accessibilityRole="button"
                            accessibilityLabel="Clear phone number"
                          >
                            <Ionicons name="close-circle" size={16} color="rgba(245, 230, 240, 0.45)" />
                          </TouchableOpacity>
                        )}
                        {Boolean(whatsapp && !isPhoneTooShort) && (
                          <Ionicons name="checkmark-circle" size={18} color="#00E676" style={{ marginLeft: 4 }} />
                        )}
                      </View>

                      {isPhoneTooShort ? (
                        <View style={styles.phoneFeedbackRow}>
                          <Ionicons name="alert-circle" size={13} color={uiTheme.colors.accent} style={{ marginRight: 6 }} />
                          <Text style={styles.hintTextError}>
                            Number looks too short for {dialCode} (min {minPhoneLength} digits)
                          </Text>
                        </View>
                      ) : Boolean(whatsapp && !isPhoneTooShort) ? (
                        <View style={styles.phoneFeedbackRow}>
                          <Ionicons name="checkmark-circle" size={13} color="#00E676" style={{ marginRight: 6 }} />
                          <Text style={styles.privacyReassuranceActiveText}>
                            Alerts active • Stored on your device only • Never shared
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.phoneFeedbackRow}>
                          <Ionicons name="shield-checkmark" size={13} color="#00E676" style={{ marginRight: 6 }} />
                          <Text style={styles.privacyReassuranceText}>
                            Optional • Stored on your device only • Never shared
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 3: WHAT'S YOUR GOAL?                            */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 3 && (
                <View>
                  <View style={styles.step3HeroWrap}>
                    <Text style={styles.step3Title}>What's Your Goal?</Text>
                    <View style={styles.goalSubtitleRow}>
                      <Text style={styles.step3Subtitle}>
                        {selectedGoals.includes('never_stop')
                          ? 'Relaxed chat mode is active.'
                          : "Pick up to 3 things you'd like from your matches."}
                      </Text>
                      <Animated.View
                        style={[
                          styles.goalCountPill,
                          selectedGoals.includes('never_stop') && styles.goalCountPillContinuous,
                          { transform: [{ scale: counterPulse }] },
                        ]}
                      >
                        <Ionicons
                          name={selectedGoals.includes('never_stop') ? 'infinite' : 'checkmark-circle'}
                          size={13}
                          color={selectedGoals.includes('never_stop') ? '#00E5FF' : uiTheme.colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.goalCountText,
                            selectedGoals.includes('never_stop') && styles.goalCountTextContinuous,
                          ]}
                        >
                          {selectedGoals.includes('never_stop')
                            ? 'Casual Chat'
                            : `${selectedGoals.length} of 3 chosen`}
                        </Text>
                      </Animated.View>
                    </View>
                  </View>

                  {Boolean(goalFeedback) && (
                    <View style={styles.goalFeedbackBanner}>
                      <Ionicons name="information-circle" size={14} color={uiTheme.colors.secondary} style={{ marginRight: 5 }} />
                      <Text style={styles.goalFeedbackText}>{goalFeedback}</Text>
                    </View>
                  )}

                  <View style={styles.goalsList}>
                    {GOALS.map((goal) => (
                      <GoalCardItem
                        key={goal.id}
                        goal={goal}
                        isSelected={selectedGoals.includes(goal.id)}
                        onToggle={toggleGoal}
                      />
                    ))}
                  </View>

                  {/* Friendly Game Plan Preview */}
                  <View style={styles.strategyCardWrapper}>
                    <LinearGradient
                      colors={['rgba(255, 51, 102, 0.08)', 'rgba(22, 14, 32, 0.95)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.strategyCard}
                    >
                      <View style={styles.strategyHeaderRow}>
                        <View style={styles.strategyIconDisk}>
                          <Ionicons name="sparkles" size={12} color={uiTheme.colors.secondary} />
                        </View>
                        <Text style={styles.strategyHeaderTitle}>How Flint will help you</Text>
                        <View style={styles.strategyGamePlanBadge}>
                          <Text style={styles.strategyGamePlanBadgeText}>Your Game Plan</Text>
                        </View>
                      </View>
                      <Animated.Text style={[styles.strategySummaryText, { opacity: strategyFadeAnim }]}>
                        {strategyText}
                      </Animated.Text>
                    </LinearGradient>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 4: BEHAVIOR & STYLE                             */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 4 && (
                <View>
                  <View style={styles.step3HeroWrap}>
                    <Text style={styles.step3Title}>Behavior & Style</Text>
                    <Text style={styles.step3Subtitle}>
                      Fine-tune how Flint talks and how actively he replies for you.
                    </Text>
                  </View>

                  {/* Unified Luxury Glass Settings Card */}
                  <View style={styles.step4GlassCard}>
                    <LinearGradient
                      colors={['rgba(255, 51, 102, 0.08)', 'rgba(179, 136, 255, 0.05)', 'rgba(22, 14, 32, 0.94)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.step4CardGradient}
                    >
                      {/* Sub-section 1: Conversation Tone & Personality */}
                      <View style={styles.step4SectionHeader}>
                        <View style={styles.step4IconDiskAmethyst}>
                          <Ionicons name="sparkles" size={15} color="#B388FF" />
                        </View>
                        <View style={styles.step4HeaderTextWrap}>
                          <Text numberOfLines={1} style={styles.step4SectionTitle}>Conversation Tone</Text>
                          <Text style={styles.step4SectionSub}>Tap any tone to hear Flint's opening style</Text>
                        </View>
                      </View>

                      {/* Smooth Horizontal Smart Tone Rail (All 10 Personalities, Zero Clutter) */}
                      <ScrollView
                        ref={toneScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.toneScrollTrack}
                      >
                        {PERSONALITIES.map((p) => {
                          const isSelected = personality === p.id;
                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={[
                                styles.personalityPill,
                                isSelected && {
                                  backgroundColor: `${p.accentColor}25`,
                                  borderColor: p.accentColor,
                                },
                              ]}
                              onPress={() => handleSelectPersonality(p.id)}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel={`${p.label} personality mode`}
                            >
                              <Ionicons
                                name={p.icon}
                                size={12}
                                color={isSelected ? p.accentColor : 'rgba(245, 230, 240, 0.65)'}
                                style={{ marginRight: 4 }}
                              />
                              <Text
                                style={[
                                  styles.personalityPillText,
                                  isSelected && { fontFamily: 'Inter_800ExtraBold', color: '#FFFFFF', fontWeight: 'normal' },
                                ]}
                              >
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      {/* Live "Voice of Flint" Interactive AI Studio with Real-Time Typing Animation */}
                      <TouchableOpacity
                        activeOpacity={0.95}
                        onPress={() => {
                          if (isTypingOpener || isDrafting) {
                            if (draftingTimerRef.current) clearTimeout(draftingTimerRef.current);
                            if (typingTimerRef.current) clearInterval(typingTimerRef.current);
                            setIsDrafting(false);
                            setIsTypingOpener(false);
                            setTypedOpener(currentPersonalityObj.previewOpener);
                            safeHaptic('light');
                          }
                        }}
                        style={[styles.voicePreviewWrapper, { borderColor: `${currentPersonalityObj.accentColor}40` }]}
                        accessibilityRole="button"
                        accessibilityLabel="Voice of Flint preview. Tap to reveal full message"
                      >
                        <LinearGradient
                          colors={[`${currentPersonalityObj.accentColor}15`, 'rgba(16, 9, 24, 0.96)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.voicePreviewCard}
                        >
                          <View style={styles.voiceHeaderRow}>
                            <View style={styles.voiceHeaderLeft}>
                              <View style={[styles.voiceIconDisk, { backgroundColor: `${currentPersonalityObj.accentColor}25` }]}>
                                <Ionicons name="chatbubble-ellipses" size={10} color={currentPersonalityObj.accentColor} />
                              </View>
                              <Text style={styles.voiceHeaderTitle}>Voice of Flint</Text>
                              <View style={styles.voiceLiveBeaconRow}>
                                <View style={[styles.voiceLiveDot, { backgroundColor: currentPersonalityObj.accentColor }]} />
                                <Text style={[styles.voiceLiveText, { color: currentPersonalityObj.accentColor }]}>
                                  {isDrafting ? 'Drafting...' : isTypingOpener ? 'Typing...' : 'Live Preview'}
                                </Text>
                              </View>
                            </View>

                            <View style={[styles.voiceTagBadge, { borderColor: `${currentPersonalityObj.accentColor}45`, backgroundColor: `${currentPersonalityObj.accentColor}18` }]}>
                              <Text style={[styles.voiceTagBadgeText, { color: currentPersonalityObj.accentColor }]}>
                                {currentPersonalityObj.tagline}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.voiceBubble}>
                            {isDrafting ? (
                              <View style={styles.voiceDraftingRow}>
                                <View style={styles.typingDotsRow}>
                                  <Animated.View style={[styles.typingDot, { backgroundColor: currentPersonalityObj.accentColor, transform: [{ translateY: typingDot1 }] }]} />
                                  <Animated.View style={[styles.typingDot, { backgroundColor: currentPersonalityObj.accentColor, transform: [{ translateY: typingDot2 }] }]} />
                                  <Animated.View style={[styles.typingDot, { backgroundColor: currentPersonalityObj.accentColor, transform: [{ translateY: typingDot3 }] }]} />
                                </View>
                                <Text style={styles.voiceDraftingText}>Flint is tailoring an opener...</Text>
                              </View>
                            ) : (
                              <Text style={styles.voiceOpenerText}>
                                "{typedOpener}
                                {isTypingOpener && (
                                  <Animated.Text style={{ fontFamily: 'Inter_800ExtraBold', opacity: voiceCursorOpacity, color: currentPersonalityObj.accentColor, fontWeight: 'normal' }}>
                                    |
                                  </Animated.Text>
                                )}
                                "
                              </Text>
                            )}
                          </View>

                          <View style={styles.voiceVibeRow}>
                            <View style={styles.voiceEqualizerRow}>
                              <Animated.View style={[styles.voiceEqualizerBar, { backgroundColor: currentPersonalityObj.accentColor, transform: [{ scaleY: waveBar1 }] }]} />
                              <Animated.View style={[styles.voiceEqualizerBar, { backgroundColor: currentPersonalityObj.accentColor, transform: [{ scaleY: waveBar2 }] }]} />
                              <Animated.View style={[styles.voiceEqualizerBar, { backgroundColor: currentPersonalityObj.accentColor, transform: [{ scaleY: waveBar3 }] }]} />
                            </View>
                            <Text style={styles.voiceVibeDesc} numberOfLines={2}>
                              {currentPersonalityObj.vibeDesc}
                            </Text>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>

                      {/* Hairline Divider */}
                      <View style={styles.step4Divider} />

                      {/* Sub-section 2: Reply Speed (Intelligent Cadence Bar) */}
                      <View style={styles.step4SectionHeader}>
                        <View style={styles.step4IconDiskCoral}>
                          <Ionicons name="timer" size={15} color={uiTheme.colors.primary} />
                        </View>
                        <View style={styles.step4HeaderTextWrap}>
                          <Text numberOfLines={1} style={styles.step4SectionTitle}>Reply Speed</Text>
                          <Text style={styles.step4SectionSub}>How often Flint checks for new matches and replies</Text>
                        </View>
                      </View>

                      {/* Compact Segmented Cadence Track with Smooth Animated Slider */}
                      <View
                        style={styles.cadenceSegmentTrack}
                        onLayout={(e) => setCadenceTrackWidth(e.nativeEvent.layout.width)}
                      >
                        {cadenceSegmentWidth > 0 && (
                          <Animated.View
                            style={[
                              styles.cadenceSliderThumb,
                              {
                                width: cadenceSegmentWidth,
                                transform: [{ translateX: cadenceSliderTranslateX }],
                              },
                            ]}
                          >
                            <LinearGradient
                              colors={['rgba(255, 51, 102, 0.35)', 'rgba(255, 94, 126, 0.22)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={StyleSheet.absoluteFillObject}
                            />
                          </Animated.View>
                        )}

                        {FREQUENCIES.map((freq) => {
                          const isSelected = frequency === freq.value;
                          return (
                            <TouchableOpacity
                              key={freq.value}
                              style={styles.cadenceSegmentBtn}
                              onPress={() => handleSelectFrequency(freq.value)}
                              activeOpacity={0.85}
                              accessibilityRole="button"
                              accessibilityLabel={`${freq.label}, ${freq.time}, ${freq.sub}`}
                            >
                              <Ionicons
                                name={freq.icon}
                                size={12}
                                color={isSelected ? uiTheme.colors.primary : 'rgba(245, 230, 240, 0.55)'}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={[styles.cadenceSegmentLabel, isSelected && styles.cadenceSegmentLabelActive]}>
                                {freq.label}
                              </Text>
                              <View style={[styles.cadenceTimePill, isSelected && styles.cadenceTimePillActive]}>
                                <Text style={[styles.cadenceTimeText, isSelected && styles.cadenceTimeTextActive]}>
                                  {freq.time}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Live Dynamic Cadence Insight (Compact & Anti-Cutoff) */}
                      <Animated.View style={[styles.cadenceInsightRow, { opacity: cadenceFadeAnim }]}>
                        <View style={styles.cadenceInsightDot} />
                        <Text style={styles.cadenceInsightText} numberOfLines={2}>
                          {currentFreqObj.insight}
                        </Text>
                      </Animated.View>

                      {/* Hairline Divider */}
                      <View style={styles.step4Divider} />

                      {/* Sub-section 3: Smart Protection (Living Human Shield) */}
                      <View style={styles.step4SectionHeader}>
                        <View style={[styles.step4IconDiskEmerald, !safeMode && styles.step4IconDiskDimmed]}>
                          <Ionicons
                            name={safeMode ? "shield-checkmark" : "shield-outline"}
                            size={15}
                            color={safeMode ? "#00E676" : "#8E8E93"}
                          />
                        </View>
                        <View style={styles.step4HeaderTextWrap}>
                          <View style={styles.step4TitleWithPillRow}>
                            <Text numberOfLines={1} style={styles.step4SectionTitle}>Smart Protection</Text>
                            <Switch
                              value={safeMode}
                              onValueChange={(val) => {
                                safeHaptic('medium');
                                setSafeMode(val);
                              }}
                              trackColor={{ false: 'rgba(255, 255, 255, 0.14)', true: '#00E676' }}
                              thumbColor="#FFFFFF"
                              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }], marginRight: -4 }}
                            />
                          </View>
                          <Text style={styles.step4SectionSub}>
                            {safeMode
                              ? 'Mimics natural human texting habits to keep your account safe'
                              : 'Instant mode: Replies send immediately with zero delay (testing)'}
                          </Text>
                        </View>
                      </View>

                      {/* 3-Pillar Living Security Matrix */}
                      <View style={[styles.shieldMatrixRow, !safeMode && { opacity: 0.38 }]}>
                        <View style={[styles.shieldPillarCard, !safeMode && styles.shieldPillarCardDimmed]}>
                          <View style={styles.shieldPillarTop}>
                            <Ionicons name="time" size={11} color={safeMode ? "#00E676" : "#8E8E93"} />
                            <Text numberOfLines={1} style={[styles.shieldPillarTitle, !safeMode && styles.shieldPillarTitleDimmed]}>
                              Natural Typing
                            </Text>
                          </View>
                          <Text numberOfLines={1} style={styles.shieldPillarSub}>
                            2–5s human delay
                          </Text>
                        </View>

                        <View style={[styles.shieldPillarCard, !safeMode && styles.shieldPillarCardDimmed]}>
                          <View style={styles.shieldPillarTop}>
                            <Ionicons name="moon" size={11} color={safeMode ? "#00E676" : "#8E8E93"} />
                            <Text numberOfLines={1} style={[styles.shieldPillarTitle, !safeMode && styles.shieldPillarTitleDimmed]}>
                              Night Rest
                            </Text>
                          </View>
                          <Text numberOfLines={1} style={styles.shieldPillarSub}>
                            Natural sleep hours
                          </Text>
                        </View>

                        <View style={[styles.shieldPillarCard, !safeMode && styles.shieldPillarCardDimmed]}>
                          <View style={styles.shieldPillarTop}>
                            <Ionicons name="shield-checkmark" size={11} color={safeMode ? "#00E676" : "#8E8E93"} />
                            <Text numberOfLines={1} style={[styles.shieldPillarTitle, !safeMode && styles.shieldPillarTitleDimmed]}>
                              Safe Pace
                            </Text>
                          </View>
                          <Text numberOfLines={1} style={styles.shieldPillarSub}>
                            Within daily limits
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                </View>
              )}

              {/* ═════════════════════════════════════════════════════ */}
              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 5: YOU'RE ALL SET! (FLUID CALIBRATION PATH)     */}
              {/* ═════════════════════════════════════════════════════ */}
              {/* ═════════════════════════════════════════════════════ */}
              {/* ═════════════════════════════════════════════════════ */}
              {/* STEP 5: GRAND MATCH HERO & SWIPE DECK ENTRANCE        */}
              {/* ═════════════════════════════════════════════════════ */}
              {currentStep === 5 && (
                <View style={styles.step5Container}>
                  {/* Executive Entrance Header */}
                  <View style={styles.heroEntranceHeader}>
                    <Text style={styles.heroEntranceTitle}>Ready to Match</Text>
                    <Text style={styles.heroEntranceSubtitle}>
                      Maya is waiting in your deck · Flint is live & drafting
                    </Text>
                  </View>

                  {/* ── 3D Fanned Dating Deck Container ── */}
                  <View style={styles.deckStackWrap}>
                    {/* Background Stacked Card (Elena, tilted -4.2 deg) */}
                    <View style={styles.deckBackCard2}>
                      <Image
                        source={thirdMatch.image}
                        style={styles.deckBackImage}
                        resizeMode="cover"
                      />
                      <View style={styles.deckBackOverlay} />
                    </View>

                    {/* Background Stacked Card (Sarah, tilted 3.4 deg, scales smoothly as front card is swiped) */}
                    <Animated.View
                      style={[
                        styles.deckBackCard1,
                        {
                          transform: [
                            { rotate: '3.4deg' },
                            { translateY: -2 },
                            { scale: nextCardScale },
                          ],
                        },
                      ]}
                    >
                      <Image
                        source={nextMatch.image}
                        style={styles.deckBackImage}
                        resizeMode="cover"
                      />
                      <View style={styles.deckBackOverlay} />
                    </Animated.View>

                    {/* Foreground Hero Match Card (Interactive Swipeable with PanResponder) */}
                    <Animated.View
                      {...panResponder.panHandlers}
                      style={[
                        styles.heroMatchCard,
                        {
                          opacity: engineCardAnim,
                          transform: [
                            { translateX: cardPan.x },
                            { translateY: cardPan.y },
                            { rotate: cardRotate },
                          ],
                        },
                      ]}
                    >
                      {/* Full-Bleed Profile Photo with Face Centering */}
                      <Image
                        source={currentMatch.image}
                        style={styles.heroProfileImage}
                        resizeMode="cover"
                      />

                      {/* Top Vignette Gradient for Badges */}
                      <LinearGradient
                        colors={['rgba(12, 6, 18, 0.65)', 'transparent']}
                        style={styles.heroTopScrim}
                      />

                      {/* Top Floating Glass Badges Row: Only 98% Match (WINGMAN ACTIVE REMOVED per user request) */}
                      <View style={styles.heroTopBadgesRow}>
                        <View style={styles.heroCompatibilityBadge}>
                          <Ionicons name="flame" size={12} color={uiTheme.colors.accent} />
                          <Text style={styles.heroCompatibilityText}>{currentMatch.matchScore || '98% Match'}</Text>
                        </View>
                      </View>

                      {/* Glowing LIKE Stamp (reveals on drag right) */}
                      <Animated.View style={[styles.stampLikeWrap, { opacity: likeStampOpacity }]} pointerEvents="none">
                        <View style={styles.stampLikeBorder}>
                          <Text style={styles.stampLikeText}>LIKE</Text>
                        </View>
                      </Animated.View>

                      {/* Glowing NOPE Stamp (reveals on drag left) */}
                      <Animated.View style={[styles.stampNopeWrap, { opacity: nopeStampOpacity }]} pointerEvents="none">
                        <View style={styles.stampNopeBorder}>
                          <Text style={styles.stampNopeText}>NOPE</Text>
                        </View>
                      </Animated.View>

                      {/* ── Frosted Glass Live Chat Dock (Anchored at Card Base) ── */}
                      <View style={styles.heroFrostedDock}>
                        {/* Match Profile Identity */}
                        <View style={styles.heroDockHeader}>
                          <View style={styles.heroNameRow}>
                            <Text style={styles.heroNameText}>{currentMatch.name}</Text>
                            <Ionicons name="checkmark-circle" size={14} color="#00E676" style={{ marginLeft: 4 }} />
                          </View>
                          <View style={styles.heroLocationRow}>
                            <Ionicons name="location-sharp" size={10.5} color={uiTheme.colors.accent} />
                            <Text style={styles.heroLocationText} numberOfLines={1}>
                              {currentMatch.sub.split('&')[0].trim()} · {country} {getCountryFlag(country)}
                            </Text>
                          </View>
                        </View>

                        {/* Match's Incoming Message */}
                        <View style={styles.heroIncomingBubble}>
                          <Text style={styles.heroIncomingText} numberOfLines={2}>
                            {activeSimChat.incomingMessage}
                          </Text>
                        </View>

                        {/* Flint Wingman Outgoing Message */}
                        {simPhase === 'typing' ? (
                          <View style={styles.heroTypingDock}>
                            <Ionicons name="sparkles" size={10} color={uiTheme.colors.secondary} />
                            <Text style={styles.heroTypingText}>
                              Flint drafting in your {currentPersonalityObj.label} vibe...
                            </Text>
                            <View style={styles.vipTypingDotsWrap}>
                              <Animated.View style={[styles.vipTypingDot, { transform: [{ translateY: typingDot1 }] }]} />
                              <Animated.View style={[styles.vipTypingDot, { transform: [{ translateY: typingDot2 }] }]} />
                              <Animated.View style={[styles.vipTypingDot, { transform: [{ translateY: typingDot3 }] }]} />
                            </View>
                          </View>
                        ) : (
                          <Animated.View
                            style={[
                              styles.heroAiBubble,
                              {
                                opacity: simBubbleOpacity,
                                transform: [{ scale: simBubbleScale }],
                                borderColor: `${currentPersonalityObj.accentColor}55`,
                              },
                            ]}
                          >
                            <LinearGradient
                              colors={[`${currentPersonalityObj.accentColor}35`, 'rgba(22, 10, 30, 0.96)']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.heroAiBubbleGradient}
                            >
                              <View style={styles.heroAiAuthorRow}>
                                <Ionicons name="sparkles" size={9.5} color={currentPersonalityObj.accentColor} />
                                <Text style={[styles.heroAiAuthorText, { color: currentPersonalityObj.accentColor }]}>
                                  Flint · {currentPersonalityObj.label} Mode
                                </Text>
                                <Text style={styles.heroAiStrategyText}>
                                  {activeSimChat.strategyLabel ? `· ${activeSimChat.strategyLabel}` : '· Auto-drafted'}
                                </Text>
                              </View>
                              <Text style={styles.heroAiBubbleText} numberOfLines={3}>
                                {activeSimChat.aiReply}
                              </Text>
                            </LinearGradient>
                          </Animated.View>
                        )}

                        {/* Replay / Shuffle AI Response Button */}
                        <TouchableOpacity
                          onPress={() => {
                            safeHaptic('light');
                            const nextV = simVariation + 1;
                            setSimVariation(nextV);
                            triggerSimChat(nextV);
                          }}
                          activeOpacity={0.7}
                          style={styles.heroShuffleRow}
                          accessibilityRole="button"
                          accessibilityLabel="Shuffle AI wingman response"
                        >
                          <Ionicons name="refresh" size={10.5} color="rgba(245, 230, 240, 0.55)" />
                          <Text style={styles.heroShuffleText}>Tap to shuffle AI response · or swipe card</Text>
                        </TouchableOpacity>
                      </View>
                    </Animated.View>
                  </View>

                  {/* ── Setup Summary & Preferences Readiness Hub ── */}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                      safeHaptic('light');
                      laserBeamAnim.setValue(0);
                      Animated.timing(laserBeamAnim, {
                        toValue: 1,
                        duration: 1200,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: false,
                      }).start();
                    }}
                    style={styles.readinessCard}
                    accessibilityRole="button"
                    accessibilityLabel="Preferences Setup Summary"
                  >
                    {/* Header Row: Clean Status */}
                    <View style={styles.readinessHeaderRow}>
                      <View style={styles.readinessHeaderLeft}>
                        <View style={styles.readinessDotPulse}>
                          <View style={styles.readinessDotCore} />
                        </View>
                        <Text style={styles.readinessHeaderTitle}>Preferences Saved</Text>
                        <Text style={styles.readinessHeaderSub}>· Ready to match</Text>
                      </View>
                      <View style={styles.readinessBadge}>
                        <Ionicons name="checkmark-circle" size={12.5} color="#00E676" />
                        <Text style={styles.readinessBadgeText}>All Set</Text>
                      </View>
                    </View>

                    {/* Glowing Laser Divider */}
                    <View style={styles.readinessLaserTrack}>
                      <View style={styles.readinessLaserBack} />
                      <Animated.View
                        style={[
                          styles.readinessLaserBeam,
                          {
                            width: laserBeamAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['15%', '100%'],
                            }),
                          },
                        ]}
                      />
                    </View>

                    {/* 4 Preferences Info Chips */}
                    <View style={styles.readinessGrid}>
                      <View style={styles.readinessGridItem}>
                        <Ionicons name="flame" size={12} color={uiTheme.colors.primary} />
                        <Text style={styles.readinessGridText} numberOfLines={1}>Tinder</Text>
                      </View>
                      <View style={styles.readinessGridItem}>
                        <Ionicons name="location-sharp" size={11} color="#00E676" />
                        <Text style={styles.readinessGridText} numberOfLines={1}>{country} {getCountryFlag(country)}</Text>
                      </View>
                      <View style={styles.readinessGridItem}>
                        <Ionicons name="heart" size={11} color="#FF6584" />
                        <Text style={styles.readinessGridText} numberOfLines={1}>{goalsSummary.title}</Text>
                      </View>
                      <View style={styles.readinessGridItem}>
                        <Ionicons name="sparkles" size={11} color={currentPersonalityObj.accentColor} />
                        <Text style={[styles.readinessGridText, { color: currentPersonalityObj.accentColor }]} numberOfLines={1}>
                          {currentPersonalityObj.label} Vibe
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Sticky Bottom Footer with Tactile CTA Dock ── */}
        <View style={styles.footer}>
          <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
            <TouchableOpacity
              style={styles.continueBtn}
              onPress={handleNext}
              onPressIn={handleBtnPressIn}
              onPressOut={handleBtnPressOut}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={currentStep === 1 ? 'Get Started' : currentStep === totalSteps ? 'Start Meeting Matches' : 'Continue'}
            >
              <LinearGradient
                colors={[uiTheme.colors.primary, uiTheme.colors.accent, uiTheme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueGradient}
              >
                <Text style={styles.continueBtnText}>
                  {currentStep === 1 ? 'Get Started' : currentStep === totalSteps ? 'Start Meeting Matches' : 'Continue'}
                </Text>
                <Ionicons
                  name={currentStep === totalSteps ? 'flame' : 'chevron-forward'}
                  size={18}
                  color="#FFFFFF"
                  style={{ marginLeft: 4 }}
                />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Fixed-Height Footer Sub-Slot (Keeps CTA Button 100% Locked in Place Across All Steps) ── */}
          <View style={styles.footerSubSlot}>
            {currentStep === 1 && (
              <View style={styles.ctaReassuranceRow}>
                <Ionicons name="shield-checkmark" size={12} color="rgba(255, 255, 255, 0.45)" style={{ marginRight: 5 }} />
                <Text style={styles.ctaReassuranceText}>Takes under 60 seconds • Completely private</Text>
              </View>
            )}

            {currentStep > 1 && currentStep < totalSteps && (
              <View style={styles.ctaReassuranceRow}>
                <Ionicons name="shield-checkmark" size={12} color="rgba(255, 255, 255, 0.35)" style={{ marginRight: 5 }} />
                <Text style={styles.ctaReassuranceText}>Encrypted & private • Change anytime</Text>
              </View>
            )}

            {currentStep === totalSteps && (
              <TouchableOpacity
                style={styles.guestFooterBtn}
                onPress={() => {
                  safeHaptic('light');
                  navigation.replace('PlatformSelect');
                }}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                accessibilityRole="button"
                accessibilityLabel="Continue as Guest"
              >
                <Text style={styles.guestFooterText}>Continue as Guest →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* ── Country Picker Frosted Modal (iOS Industry Standard) ── */}
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCountrySearch('');
          setCountryModalVisible(false);
        }}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity accessibilityRole="button"
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setCountrySearch('');
              setCountryModalVisible(false);
            }}
          />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1E122A', '#140D1E', '#0D0714']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIconDiskCoral}>
                  <Ionicons name="location-sharp" size={17} color={uiTheme.colors.primary} />
                </View>
                <View style={styles.modalHeaderTitleGroup}>
                  <Text style={styles.modalTitle}>Select Country</Text>
                  <Text style={styles.modalSub}>Matches your city, timezone & local slang</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  safeHaptic('light');
                  Keyboard.dismiss();
                  setCountrySearch('');
                  setCountryModalVisible(false);
                }}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close country selector"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* High-Contrast Frosted Search Bar */}
            <View
              style={[
                styles.modalSearchWrap,
                isCountrySearchFocused && styles.modalSearchWrapFocusedCoral,
              ]}
            >
              <Ionicons
                name="search"
                size={17}
                color={isCountrySearchFocused ? uiTheme.colors.primary : 'rgba(255, 255, 255, 0.55)'}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search 95+ countries..."
                placeholderTextColor="rgba(255, 255, 255, 0.42)"
                value={countrySearch}
                onChangeText={setCountrySearch}
                onFocus={() => setIsCountrySearchFocused(true)}
                onBlur={() => setIsCountrySearchFocused(false)}
                autoCorrect={false}
                returnKeyType="search"
              />
              {Boolean(countrySearch) && (
                <TouchableOpacity accessibilityRole="button"
                  onPress={() => {
                    safeHaptic('light');
                    setCountrySearch('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.65)" />
                </TouchableOpacity>
              )}
              <View style={styles.modalMatchCountPill}>
                <Text style={styles.modalMatchCountText}>{filteredCountries.length}</Text>
              </View>
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: 40 }}
              initialNumToRender={20}
              maxToRenderPerBatch={25}
              windowSize={10}
              ItemSeparatorComponent={() => <View style={styles.modalHairline} />}
              ListEmptyComponent={
                <View style={styles.modalEmptyWrap}>
                  <Ionicons name="search-outline" size={28} color="rgba(255, 255, 255, 0.25)" />
                  <Text style={styles.modalEmptyTitle}>No countries found</Text>
                  <Text style={styles.modalEmptySub}>Try a different spelling or name</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = country === item;
                const matchDial = DIAL_CODES.find((d) => d.name === item)?.dial;
                return (
                  <TouchableOpacity accessibilityRole="button"
                    style={[
                      styles.modalListItem,
                      isSelected && styles.modalListItemSelected,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleSelectCountry(item);
                    }}
                    activeOpacity={0.65}
                  >
                    <View style={styles.modalListItemLeft}>
                      <Text style={styles.modalItemFlag}>{getCountryFlag(item)}</Text>
                      <Text
                        style={[
                          styles.modalListText,
                          isSelected && styles.modalListTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item}
                      </Text>
                    </View>
                    <View style={styles.modalListItemRight}>
                      {Boolean(matchDial) && (
                        <Text style={[styles.modalItemDialText, isSelected && styles.modalItemDialTextSelected]}>
                          {matchDial}
                        </Text>
                      )}
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={uiTheme.colors.primary} style={{ marginLeft: 8 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Dial Code Picker Frosted Modal (iOS Industry Standard) ── */}
      <Modal
        visible={dialModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setDialSearch('');
          setDialModalVisible(false);
        }}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity accessibilityRole="button"
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setDialSearch('');
              setDialModalVisible(false);
            }}
          />
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#10221A', '#0D1A14', '#08120D']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIconDiskEmerald}>
                  <Ionicons name="call" size={16} color="#00E676" />
                </View>
                <View style={styles.modalHeaderTitleGroup}>
                  <Text style={styles.modalTitle}>Country Dial Code</Text>
                  <Text style={styles.modalSub}>Select prefix for instant date alerts</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  safeHaptic('light');
                  Keyboard.dismiss();
                  setDialSearch('');
                  setDialModalVisible(false);
                }}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close dial code selector"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* High-Contrast Frosted Search Bar */}
            <View
              style={[
                styles.modalSearchWrap,
                isDialSearchFocused && styles.modalSearchWrapFocusedEmerald,
              ]}
            >
              <Ionicons
                name="search"
                size={17}
                color={isDialSearchFocused ? '#00E676' : 'rgba(255, 255, 255, 0.55)'}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search country or dial code..."
                placeholderTextColor="rgba(255, 255, 255, 0.42)"
                value={dialSearch}
                onChangeText={setDialSearch}
                onFocus={() => setIsDialSearchFocused(true)}
                onBlur={() => setIsDialSearchFocused(false)}
                autoCorrect={false}
                returnKeyType="search"
              />
              {Boolean(dialSearch) && (
                <TouchableOpacity accessibilityRole="button"
                  onPress={() => {
                    safeHaptic('light');
                    setDialSearch('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.65)" />
                </TouchableOpacity>
              )}
              <View style={styles.modalMatchCountPill}>
                <Text style={styles.modalMatchCountText}>{filteredDialCodes.length}</Text>
              </View>
            </View>

            <FlatList
              data={filteredDialCodes}
              keyExtractor={(item) => `${item.code}-${item.dial}`}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: 40 }}
              initialNumToRender={20}
              maxToRenderPerBatch={25}
              windowSize={10}
              ItemSeparatorComponent={() => <View style={styles.modalHairline} />}
              ListEmptyComponent={
                <View style={styles.modalEmptyWrap}>
                  <Ionicons name="search-outline" size={28} color="rgba(255, 255, 255, 0.25)" />
                  <Text style={styles.modalEmptyTitle}>No dial codes found</Text>
                  <Text style={styles.modalEmptySub}>Try searching by country or dial prefix</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = dialCode === item.dial && (country === item.name || !DIAL_CODES.some(d => d.dial === item.dial && d.name === country));
                return (
                  <TouchableOpacity accessibilityRole="button"
                    style={[
                      styles.modalListItem,
                      isSelected && styles.modalListItemSelectedEmerald,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      handleSelectDialCode(item);
                    }}
                    activeOpacity={0.65}
                  >
                    <View style={styles.modalListItemLeft}>
                      <Text style={styles.modalItemFlag}>{getFlagFromCode(item.code)}</Text>
                      <Text
                        style={[
                          styles.modalListText,
                          isSelected && styles.modalListTextSelectedEmerald,
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <View style={styles.modalListItemRight}>
                      <View style={[styles.modalDialBadge, isSelected && styles.modalDialBadgeSelected]}>
                        <Text style={[styles.modalDialText, isSelected && styles.modalDialTextSelected]}>
                          {item.dial}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#00E676" style={{ marginLeft: 8 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#08050B',
  },
  safeArea: {
    flex: 1,
  },

  // ── Ambient Background Living Aurora Orbs ──
  auroraOrb1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: SCREEN_WIDTH * 0.88,
    height: SCREEN_WIDTH * 0.88,
    borderRadius: (SCREEN_WIDTH * 0.88) / 2,
    overflow: 'hidden',
  },
  auroraOrb2: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.12,
    left: -SCREEN_WIDTH * 0.35,
    width: SCREEN_WIDTH * 0.92,
    height: SCREEN_WIDTH * 0.92,
    borderRadius: (SCREEN_WIDTH * 0.92) / 2,
    overflow: 'hidden',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uiTheme.spacing.xl,
    paddingTop: uiTheme.spacing.sm,
    paddingBottom: uiTheme.spacing.sm,
  },
  headerLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: uiTheme.radius.input,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerLogoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrandFlame: {
    marginRight: 5,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  headerBrandTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255, 51, 102, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSignInBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 51, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.32)',
  },
  headerSignInText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.accent,
    fontSize: 12.5,
    fontWeight: 'normal',
  },

  // ── Segmented Progress Bar ──
  progressContainer: {
    paddingHorizontal: 22,
    marginTop: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.lg,
  },
  progressContainerStep3: {
    marginBottom: uiTheme.spacing.md,
  },
  segmentTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: uiTheme.spacing.sm,
  },
  segmentTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  stepCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepCounterText: { fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 240, 0.65)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  stepCounterBold: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },
  stepPhaseName: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.accent,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },

  // ── Content Scroll ──
  scrollContent: { width: '100%', maxWidth: 600, alignSelf: 'center',
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  scrollContentStep3: {
    paddingBottom: 14,
    paddingTop: uiTheme.spacing.xs,
  },
  scrollContentStep5: {
    paddingBottom: 6,
    paddingTop: uiTheme.spacing.md,
  },
  stepContainer: {
    width: '100%',
  },
  heroWrap: {
    marginTop: 6,
    marginBottom: uiTheme.spacing.lg,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: -0.6,
    marginBottom: uiTheme.spacing.sm,
  },
  stepSubtitle: {
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.label.fontSize,
    lineHeight: 20.5,
    fontFamily: 'Inter_500Medium',
  },

  // ── Living Cockpit Sliding Showcase ──
  marqueeSectionWrap: {
    marginHorizontal: -22,
    marginTop: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.xl,
  },
  marqueeWindow: {
    width: '100%',
    overflow: 'hidden',
    paddingVertical: 6,
  },
  marqueeTrack: {
    flexDirection: 'row',
    width: (CARD_WIDTH + CARD_GAP) * DISPLAY_CARDS.length + 100,
    paddingLeft: 22,
  },
  cockpitCardContainer: {
    width: CARD_WIDTH,
    flexShrink: 0,
    marginRight: CARD_GAP,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 102, 136, 0.24)',
    overflow: 'hidden',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  cockpitCardGradient: {
    padding: uiTheme.spacing.lg,
  },
  cockpitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cockpitAvatarWrap: {
    position: 'relative',
    marginRight: uiTheme.spacing.md,
  },
  cockpitAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cockpitAvatarLiveBeacon: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00E676',
    borderWidth: 2,
    borderColor: '#160E20',
  },
  cockpitProfileMeta: {
    flex: 1,
  },
  cockpitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cockpitProfileName: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  cockpitProfileSub: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  cockpitScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  cockpitScoreText: { fontFamily: 'Inter_700Bold',
    color: '#00E676',
    fontSize: 12.5,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  cockpitHairline: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginVertical: uiTheme.spacing.md,
  },
  cockpitOpenerBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: uiTheme.spacing.md,
    marginBottom: uiTheme.spacing.md,
  },
  cockpitOpenerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cockpitOpenerLabel: { fontFamily: 'Inter_600SemiBold',
    color: '#C49BFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  cockpitOpenerText: { fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    fontSize: 12.8,
    lineHeight: 18,
    fontWeight: 'normal',
    fontStyle: 'italic',
  },
  cockpitCursor: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.primary,
    fontWeight: 'normal',
    fontSize: uiTheme.type.label.fontSize,
  },
  cockpitFooterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  cockpitFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
  },
  cockpitFooterItemText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  cockpitFooterDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },

  // ── Step 1: Feature List (Apple HIG Borderless with Specular Disks) ──
  featureList: {
    gap: uiTheme.spacing.lg,
    marginTop: uiTheme.spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIconOuterGlow: {
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  featureDesc: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: 12.5,
    lineHeight: 17.5,
    fontWeight: 'normal',
  },

  // ── Step 2: About You (Regional Context & VIP Alerts) ──
  step2GlassCard: {
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 102, 136, 0.22)',
    overflow: 'hidden',
    marginBottom: uiTheme.spacing.lg,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  step2GlassCardEmerald: {
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(0, 230, 118, 0.22)',
    overflow: 'hidden',
    marginBottom: uiTheme.spacing.lg,
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  step2CardGradient: {
    padding: uiTheme.spacing.lg,
  },
  step2SectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: uiTheme.spacing.md,
  },
  step2IconDiskCoral: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 51, 102, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uiTheme.spacing.md,
  },
  step2IconDiskAmethyst: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(179, 136, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(179, 136, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uiTheme.spacing.md,
  },
  step2IconDiskEmerald: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 230, 118, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uiTheme.spacing.md,
  },
  step2HeaderTextWrap: {
    flex: 1,
  },
  step2TitleWithPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 2,
  },
  step2SectionTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  step2CoralBadgePill: {
    backgroundColor: 'rgba(255, 51, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.28)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: uiTheme.radius.small,
  },
  step2CoralBadgeText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.secondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  step2LangCountPill: {
    backgroundColor: 'rgba(179, 136, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(179, 136, 255, 0.28)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: uiTheme.radius.small,
  },
  step2LangCountText: { fontFamily: 'Inter_700Bold',
    color: '#B388FF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  step2OptionalPill: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.28)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: uiTheme.radius.small,
  },
  step2OptionalText: { fontFamily: 'Inter_700Bold',
    color: '#00E676',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  step2SectionSub: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginTop: 2,
  },
  step2SelectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 6, 14, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 15,
    height: 52,
    paddingHorizontal: 13,
  },
  step2SelectTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  step2FlagDisk: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  step2FlagEmoji: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.section.fontSize,
    lineHeight: 22,
  },
  step2SelectTriggerText: { fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'normal',
    flexShrink: 1,
  },
  step2ChevronWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step2Divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginVertical: uiTheme.spacing.lg,
  },
  langChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 6, 14, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 7.5,
  },
  langChipSelected: {
    borderColor: uiTheme.colors.primary,
    backgroundColor: 'rgba(255, 51, 102, 0.16)',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  langChipText: { fontFamily: 'Inter_600SemiBold',
    color: '#D8D0DD',
    fontSize: 12.5,
    fontWeight: 'normal',
  },
  langChipTextSelected: { fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  moreLangChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 170, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 128, 0.25)',
    borderRadius: 18,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 7.5,
  },
  moreLangChipText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  secondaryLangWrap: {
    overflow: 'hidden',
  },
  langChipsContainerSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uiTheme.spacing.sm,
    paddingTop: uiTheme.spacing.sm,
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 6, 14, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 15,
    height: 52,
    paddingHorizontal: uiTheme.spacing.md,
  },
  phoneInputWrapFocused: {
    borderColor: 'rgba(0, 230, 118, 0.55)',
    backgroundColor: 'rgba(10, 6, 14, 0.85)',
  },
  phoneInputWrapError: {
    borderColor: '#FF4D6D',
    backgroundColor: 'rgba(255, 77, 109, 0.1)',
  },
  phoneInputWrapOk: {
    borderColor: 'rgba(0, 230, 118, 0.45)',
  },
  dialCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: uiTheme.spacing.sm,
    paddingHorizontal: uiTheme.spacing.xs,
  },
  dialFlagText: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.body.fontSize,
    marginRight: uiTheme.spacing.xs,
  },
  dialCodeText: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
  },
  dialDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: uiTheme.spacing.sm,
  },
  phoneInput: { fontFamily: 'Inter_600SemiBold',
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'normal',
  },
  phoneFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  privacyReassuranceText: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.6)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    lineHeight: 16,
  },
  privacyReassuranceActiveText: { fontFamily: 'Inter_600SemiBold',
    color: '#00E676',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    lineHeight: 16,
  },
  hintTextError: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.accent,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    lineHeight: 16,
  },

  // ── Step 3: Goals ──
  step3HeroWrap: {
    marginTop: uiTheme.spacing.xs,
    marginBottom: 14,
  },
  step3Title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  goalSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.sm,
  },
  step3Subtitle: {
    color: uiTheme.colors.muted,
    fontSize: 13.5,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  goalCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 51, 102, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: uiTheme.spacing.xs,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.25)',
  },
  goalCountPillContinuous: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.28)',
  },
  goalCountText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  goalCountTextContinuous: {
    color: '#00E5FF',
  },
  goalFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 170, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 128, 0.28)',
    borderRadius: uiTheme.radius.input,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 7,
    marginBottom: 10,
  },
  goalFeedbackText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.secondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  goalsList: {
    gap: 10,
  },
  goalCardWrap: {
    marginVertical: 0,
  },
  goalGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: uiTheme.radius.card,
  },
  goalShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: '#000000',
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 14, 30, 0.82)',
    borderWidth: 1.4,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  goalSpecularBorder: {
    borderRadius: 18,
    borderWidth: 1.4,
  },
  goalIconDisk: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    overflow: 'hidden',
  },
  goalInfo: {
    flex: 1,
    paddingRight: uiTheme.spacing.sm,
  },
  goalTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
    marginBottom: 3,
    letterSpacing: 0.1,
  },
  goalTitleSelected: {
    color: '#FFFFFF',
  },
  goalDesc: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.80)',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: 'normal',
  },
  goalDescSelected: {
    color: 'rgba(255, 255, 255, 0.95)',
  },
  goalCheckWrap: {
    position: 'relative',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRippleRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  goalCheckSquircle: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Dynamic Game Plan Strategy Preview ──
  strategyCardWrapper: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 128, 0.20)',
    overflow: 'hidden',
  },
  strategyCard: {
    paddingVertical: uiTheme.spacing.md,
    paddingHorizontal: 14,
  },
  strategyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  strategyIconDisk: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 170, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uiTheme.spacing.sm,
  },
  strategyHeaderTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'normal',
    letterSpacing: 0.15,
    flex: 1,
  },
  strategyGamePlanBadge: {
    backgroundColor: 'rgba(255, 170, 128, 0.12)',
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 128, 0.25)',
  },
  strategyGamePlanBadgeText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  strategySummaryText: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.92)',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: 'normal',
  },

  // ── Step 4: Behavior & Style (Luxury Obsidian Glass Card) ──
  step4GlassCard: {
    backgroundColor: 'rgba(22, 14, 30, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  step4CardGradient: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  step4SectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  step4IconDiskAmethyst: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(179, 136, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(179, 136, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step4IconDiskCoral: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 51, 102, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step4IconDiskEmerald: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step4IconDiskDimmed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  step4HeaderTextWrap: {
    flex: 1,
  },
  step4TitleWithPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: uiTheme.spacing.sm,
  },
  step4SectionTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  step4SectionSub: { fontFamily: 'Inter_500Medium',
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginTop: 1,
  },
  step4AmethystBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(179, 136, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(179, 136, 255, 0.32)',
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 7.5,
    paddingVertical: 2,
    height: 22,
  },
  step4AmethystBadgeText: { fontFamily: 'Inter_700Bold',
    color: '#B388FF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    includeFontPadding: false,
  },
  step4CoralBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 51, 102, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.32)',
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 7.5,
    paddingVertical: 2,
    height: 22,
  },
  step4CoralBadgeText: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.primary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    includeFontPadding: false,
  },
  step4Divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 11,
  },
  toneScrollTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 11,
    paddingHorizontal: 2,
  },
  personalityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 7, 18, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: uiTheme.radius.input,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  personalityPillText: { fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 240, 0.75)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  voicePreviewWrapper: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 2,
  },
  voicePreviewCard: {
    padding: 11,
  },
  voiceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  voiceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  voiceIconDisk: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHeaderTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  voiceLiveBeaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    marginLeft: uiTheme.spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  voiceLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  voiceLiveText: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  voiceTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    height: 20,
  },
  voiceTagBadgeText: { fontFamily: 'Inter_700Bold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    includeFontPadding: false,
  },
  voiceBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 11,
    paddingVertical: uiTheme.spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 6,
  },
  voiceDraftingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.sm,
    paddingVertical: 2,
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 2,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  voiceDraftingText: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.65)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    fontStyle: 'italic',
  },
  voiceOpenerText: { fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    fontStyle: 'italic',
    lineHeight: 17,
  },
  voiceVibeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  voiceEqualizerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 10,
    gap: 2,
    flexShrink: 0,
  },
  voiceEqualizerBar: {
    width: 2.5,
    height: 10,
    borderRadius: 1.25,
  },
  voiceVibeDesc: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.72)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    lineHeight: 15,
    flex: 1,
  },
  // ── Reply Speed: Compact Segmented Cadence Track & Dynamic Insight ──
  cadenceSegmentTrack: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: 'rgba(10, 5, 15, 0.75)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 3,
    marginBottom: 6,
  },
  cadenceSliderThumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.65)',
    overflow: 'hidden',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.40,
    shadowRadius: 5,
    elevation: 4,
  },
  cadenceSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: 10,
    zIndex: 1,
  },
  cadenceSegmentLabel: { fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 240, 0.70)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    marginRight: uiTheme.spacing.xs,
  },
  cadenceSegmentLabelActive: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  cadenceTimePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  cadenceTimePillActive: {
    backgroundColor: 'rgba(255, 51, 102, 0.35)',
  },
  cadenceTimeText: { fontFamily: 'Inter_700Bold',
    color: 'rgba(245, 230, 240, 0.65)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    includeFontPadding: false,
  },
  cadenceTimeTextActive: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },
  cadenceInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    marginTop: 2,
    gap: 6,
  },
  cadenceInsightDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: uiTheme.colors.primary,
    flexShrink: 0,
  },
  cadenceInsightText: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.75)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    lineHeight: 15,
    flex: 1,
  },

  // ── Smart Protection: Living Human Shield Matrix ──
  smartProtectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  shieldBeaconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.30)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: uiTheme.spacing.xs,
  },
  shieldBeaconPillDimmed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  shieldBeaconDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00E676',
  },
  shieldBeaconDotDimmed: {
    backgroundColor: '#8E8E93',
  },
  shieldBeaconText: { fontFamily: 'Inter_700Bold',
    color: '#00E676',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  shieldBeaconTextDimmed: {
    color: '#8E8E93',
  },
  shieldMatrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: uiTheme.spacing.sm,
  },
  shieldPillarCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 230, 118, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
    borderRadius: 10,
    paddingVertical: 5.5,
    paddingHorizontal: 6,
  },
  shieldPillarCardDimmed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shieldPillarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    marginBottom: 2,
  },
  shieldPillarTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    includeFontPadding: false,
  },
  shieldPillarTitleDimmed: {
    color: '#8E8E93',
  },
  shieldPillarSub: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.60)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },

  // ── Step 5: Hybrid Laser Thread & Live Match Simulator (Zero Jargon, Zero Scroll) ──
  step5Container: {
    alignItems: 'center',
    width: '100%',
    paddingTop: uiTheme.spacing.xs,
    paddingBottom: 0,
    overflow: 'visible',
  },
  heroBadgeWrapper: {
    position: 'relative',
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.sm,
    overflow: 'visible',
  },
  // ── Step 5: Grand Match Hero & Fanned Deck Entrance ──
  heroEntranceHeader: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 0,
  },
  heroEntranceTitle: {
    color: '#FFFFFF',
    fontSize: uiTheme.type.title.fontSize,
    fontFamily: 'Manrope_800ExtraBold',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 3,
  },
  heroEntranceSubtitle: {
    color: 'rgba(245, 230, 240, 0.65)',
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    maxWidth: 320,
  },
  deckStackWrap: {
    position: 'relative',
    width: '100%',
    height: 350,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckBackCard2: {
    position: 'absolute',
    width: '90%',
    height: 334,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.20)',
    transform: [{ rotate: '-4.2deg' }, { translateY: -4 }],
    zIndex: 1,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  deckBackCard1: {
    position: 'absolute',
    width: '93%',
    height: 340,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 80, 120, 0.28)',
    zIndex: 2,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 5,
  },
  deckBackImage: {
    ...StyleSheet.absoluteFillObject,
  },
  deckBackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 7, 20, 0.78)',
  },
  heroMatchCard: {
    position: 'relative',
    width: '98%',
    height: 345,
    borderRadius: uiTheme.radius.sheet,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 60, 110, 0.42)',
    backgroundColor: '#120818',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.38,
    shadowRadius: 22,
    elevation: 12,
    zIndex: 3,
    justifyContent: 'space-between',
  },
  heroProfileImage: {
    position: 'absolute',
    top: -85,
    left: 0,
    right: 0,
    height: 480,
    transform: [{ scale: 1.18 }],
  },
  heroTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    zIndex: 1,
  },
  heroTopBadgesRow: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: uiTheme.spacing.md,
    paddingTop: 10,
  },
  heroCompatibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 8, 22, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: uiTheme.radius.input,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    gap: uiTheme.spacing.xs,
  },
  heroCompatibilityText: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  stampLikeWrap: {
    position: 'absolute',
    top: 24,
    right: 18,
    zIndex: 10,
    transform: [{ rotate: '15deg' }],
  },
  stampLikeBorder: {
    borderWidth: 2.5,
    borderColor: '#00E676',
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(0, 230, 118, 0.18)',
  },
  stampLikeText: { fontFamily: 'Inter_800ExtraBold',
    color: '#00E676',
    fontSize: 17,
    fontWeight: 'normal',
    letterSpacing: 1.5,
  },
  stampNopeWrap: {
    position: 'absolute',
    top: 24,
    left: 18,
    zIndex: 10,
    transform: [{ rotate: '-15deg' }],
  },
  stampNopeBorder: {
    borderWidth: 2.5,
    borderColor: uiTheme.colors.primary,
    borderRadius: uiTheme.radius.small,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 51, 102, 0.18)',
  },
  stampNopeText: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.primary,
    fontSize: 17,
    fontWeight: 'normal',
    letterSpacing: 1.5,
  },
  readinessCard: {
    width: '98%',
    backgroundColor: 'rgba(18, 9, 26, 0.82)',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 60, 110, 0.26)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: uiTheme.spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  readinessHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: uiTheme.spacing.sm,
  },
  readinessHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readinessDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 230, 118, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readinessDotCore: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#00E676',
  },
  readinessHeaderTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: 'normal',
    letterSpacing: -0.1,
  },
  readinessHeaderSub: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.55)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  readinessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    backgroundColor: 'rgba(0, 230, 118, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.32)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  readinessBadgeText: { fontFamily: 'Inter_800ExtraBold',
    color: '#00E676',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  readinessLaserTrack: {
    position: 'relative',
    height: 2,
    marginBottom: 9,
  },
  readinessLaserBack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1,
  },
  readinessLaserBeam: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: uiTheme.colors.primary,
    borderRadius: 1,
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  readinessGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  readinessGridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: uiTheme.spacing.xs,
  },
  readinessGridText: { fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: -0.1,
  },
  heroFrostedDock: {
    position: 'relative',
    zIndex: 2,
    backgroundColor: 'rgba(14, 7, 20, 0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: uiTheme.spacing.md,
    paddingTop: 10,
    paddingBottom: uiTheme.spacing.sm,
  },
  heroDockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroNameText: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: 'normal',
    letterSpacing: -0.3,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroLocationText: { fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 240, 0.85)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  heroIncomingBubble: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: uiTheme.radius.input,
    borderTopLeftRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    marginBottom: 5,
  },
  heroIncomingText: { fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 15.5,
    fontWeight: 'normal',
  },
  heroTypingDock: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 51, 102, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.32)',
    borderRadius: uiTheme.radius.input,
    borderTopRightRadius: 3,
    paddingHorizontal: 9,
    paddingVertical: 5.5,
  },
  heroTypingText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.secondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  vipTypingDotsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 2,
  },
  vipTypingDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: uiTheme.colors.accent,
  },
  heroAiBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    borderRadius: uiTheme.radius.input,
    borderTopRightRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroAiBubbleGradient: {
    paddingHorizontal: 10,
    paddingVertical: 5.5,
  },
  heroAiAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.xs,
    marginBottom: 2,
  },
  heroAiAuthorText: { fontFamily: 'Manrope_800ExtraBold',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  heroAiStrategyText: { fontFamily: 'Inter_500Medium',
    color: 'rgba(245, 230, 240, 0.50)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  heroAiBubbleText: { fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    fontSize: uiTheme.type.caption.fontSize,
    lineHeight: 15.5,
    fontWeight: 'normal',
  },
  heroShuffleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.xs,
    paddingTop: 5,
  },
  heroShuffleText: { fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 240, 0.58)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },

  // ── Sticky Bottom Footer (Visually Matches Create Account / Sign In) ──
  footer: {
    paddingHorizontal: 22,
    paddingTop: uiTheme.spacing.md,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(8, 5, 11, 0.94)',
  },
  continueBtn: {
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 6,
  },
  continueGradient: {
    height: 54,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.2,
  },
  footerSubSlot: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  ctaReassuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaReassuranceText: { fontFamily: 'Inter_500Medium',
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
    letterSpacing: 0.2,
  },
  guestFooterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  guestFooterText: { fontFamily: 'Inter_600SemiBold',
    color: 'rgba(245, 230, 240, 0.65)',
    fontSize: 13,
    fontWeight: 'normal',
  },

  // ── Modals (iOS Industry Standard Luxury Sheet) ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#140D1F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    height: '82%',
    paddingHorizontal: uiTheme.spacing.lg,
    paddingTop: uiTheme.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.65,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    alignSelf: 'center',
    marginTop: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.lg,
  },
  modalHandle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    alignSelf: 'center',
    marginTop: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.lg,
  },
  modalList: {
    flex: 1,
  },
  modalHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginLeft: 54,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uiTheme.spacing.xs,
    marginBottom: uiTheme.spacing.lg,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
    flex: 1,
  },
  modalHeaderIconDiskCoral: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 51, 102, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderIconDiskEmerald: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 230, 118, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitleGroup: {
    flex: 1,
  },
  modalTitle: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'normal',
    letterSpacing: -0.3,
  },
  modalSub: { fontFamily: 'Inter_500Medium',
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: 'normal',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: uiTheme.spacing.md,
  },
  modalSearchWrapFocusedCoral: {
    borderColor: uiTheme.colors.primary,
    backgroundColor: 'rgba(255, 51, 102, 0.08)',
  },
  modalSearchWrapFocusedEmerald: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  modalSearchInput: { fontFamily: 'Inter_500Medium',
    flex: 1,
    color: '#FFFFFF',
    fontSize: uiTheme.type.body.fontSize,
    fontWeight: 'normal',
  },
  modalMatchCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalMatchCountText: { fontFamily: 'Inter_700Bold',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: uiTheme.spacing.md,
    borderRadius: uiTheme.radius.input,
  },
  modalListItemSelected: {
    backgroundColor: 'rgba(255, 51, 102, 0.12)',
  },
  modalListItemSelectedEmerald: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  modalListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uiTheme.spacing.md,
    flex: 1,
  },
  modalItemFlag: { fontFamily: 'Inter_400Regular',
    fontSize: uiTheme.type.title.fontSize,
    width: 32,
    textAlign: 'center',
  },
  modalListText: { fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'normal',
    flex: 1,
    letterSpacing: -0.2,
  },
  modalListTextSelected: { fontFamily: 'Inter_800ExtraBold',
    color: uiTheme.colors.accent,
    fontWeight: 'normal',
  },
  modalListTextSelectedEmerald: { fontFamily: 'Inter_800ExtraBold',
    color: '#00E676',
    fontWeight: 'normal',
  },
  modalListItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalItemDialText: { fontFamily: 'Inter_500Medium',
    color: 'rgba(255, 255, 255, 0.42)',
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: 'normal',
  },
  modalItemDialTextSelected: { fontFamily: 'Inter_700Bold',
    color: uiTheme.colors.secondary,
    fontWeight: 'normal',
  },
  modalDialBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: uiTheme.spacing.xs,
    borderRadius: uiTheme.radius.small,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  modalDialBadgeSelected: {
    backgroundColor: 'rgba(0, 230, 118, 0.22)',
    borderColor: 'rgba(0, 230, 118, 0.55)',
  },
  modalDialText: { fontFamily: 'Inter_800ExtraBold',
    color: '#00E676',
    fontSize: 13,
    fontWeight: 'normal',
  },
  modalDialTextSelected: { fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontWeight: 'normal',
  },
  modalEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    gap: uiTheme.spacing.sm,
  },
  modalEmptyTitle: { fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'normal',
  },
  modalEmptySub: { fontFamily: 'Inter_500Medium',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: 'normal',
  },
});
