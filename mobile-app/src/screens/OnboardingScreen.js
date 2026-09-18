import { theme as uiTheme, alpha } from '../theme';
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
  useWindowDimensions,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackActions } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import trackingService from '../services/trackingService';
import { AppButton, Badge, Chip, ContentTransition, IconButton, IconWell } from '../components/ui';
import { useMotionReduced } from '../components/common/Motion';
import useResponsive from '../hooks/useResponsive';
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
  } catch (_) { }
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_IMG = require('../../assets/flirteasy/icon_128.png');

// Design-system shorthands (see DESIGN_SYSTEM.md).
const C = uiTheme.colors;
const TY = uiTheme.type;
const SP = uiTheme.spacing;
const RD = uiTheme.radius;

// Presentational step metadata for the progress header (eyebrow per step).
const STEP_EYEBROWS = ['Welcome', 'Your region', 'Your goals', 'Chat style', 'Preview'];
// Approximate heights of fixed chrome, used to size the step 5 deck so it fits without scrolling.
const TOP_BAR_HEIGHT = 64;
const FOOTER_HEIGHT = 112;

// ── Real Generated Profiles for Live Sliding Showcase ──
const PREVIEW_PROFILES = [
  {
    id: 'sarah',
    name: 'Sarah, 26',
    sub: 'Loves travel, photography & coffee',
    matchScore: '98% Match',
    image: require('../../assets/profiles/sarah_card.jpg'),
    opener: "Noticed your trip to Kyoto—did you find that hidden matcha spot by the canal?",
    tags: [
      { icon: 'heart-outline', label: 'Shared interests', color: C.accent },
      { icon: 'shield-checkmark-outline', label: 'Verified profile', color: C.success },
      { icon: 'time-outline', label: 'Natural timing', color: C.secondary },
    ],
  },
  {
    id: 'maya',
    name: 'Maya, 25',
    sub: 'Architect & espresso lover',
    matchScore: '96% Match',
    image: require('../../assets/profiles/maya_card.jpg'),
    opener: "That outdoor cafe looks cozy! What's your go-to coffee order on a Sunday morning?",
    tags: [
      { icon: 'heart-outline', label: 'Shared interests', color: C.accent },
      { icon: 'shield-checkmark-outline', label: 'Verified profile', color: C.success },
      { icon: 'sparkles-outline', label: 'Active now', color: C.secondary },
    ],
  },
  {
    id: 'elena',
    name: 'Elena, 27',
    sub: 'Rooftop sunsets & live jazz',
    matchScore: '95% Match',
    image: require('../../assets/profiles/elena_card.jpg'),
    opener: "Golden hour rooftop views can't be beat. Have you caught live jazz around there?",
    tags: [
      { icon: 'heart-outline', label: 'Shared interests', color: C.accent },
      { icon: 'shield-checkmark-outline', label: 'Verified profile', color: C.success },
      { icon: 'time-outline', label: 'Natural timing', color: C.secondary },
    ],
  },
];

const CARD_WIDTH = Math.min(SCREEN_WIDTH - 64, 305);
const CARD_GAP = 14;
const TRACK_WIDTH = PREVIEW_PROFILES.length * (CARD_WIDTH + CARD_GAP);
const DISPLAY_CARDS = [...PREVIEW_PROFILES, ...PREVIEW_PROFILES];

// ── Authentic Profile-Specific AI Dating Openers (Context-Aware & Tailored to Each Match) ──
const PROFILE_OPENERS_MATRIX = {
  sarah: {
    flirty: [
      "Noticed those travel shots—a smile that charming usually spells trouble 😉 Did you find that hidden matcha cafe in Kyoto?",
      "You look like someone who knows all the best coffee spots in the world. Care to test that theory over drinks?",
      "That Kyoto photo has main character energy. Tell me: are you always this photogenic or was the golden hour showing off? ✨",
    ],
    witty: [
      "Rate Kyoto's matcha on a scale of 1 to 'I'm moving there tomorrow.' What was your favorite street?",
      "I'm convinced your camera roll is 90% aesthetic coffee shops and 10% accidental blurry travel pics 😂",
      "Travel, photography, and coffee—you've officially built the holy trinity of great weekend plans.",
    ],
    confident: [
      "Your travel photos show great taste. Skip the tourist spots—what's the one place in Kyoto you'd take me first?",
      "I love someone who actually appreciates good photography. Let's grab espresso this week and swap travel stories.",
      "You clearly know how to pick great destinations. What's the next country on your radar?",
    ],
    charming: [
      "Noticed your Kyoto photos—did you ever stumble across that tiny hidden tea house by the canal?",
      "Such warm, adventurous energy in your pictures. What was the single best meal from your travels?",
      "Traveling with a good camera is the best way to see the world. What's your favorite photo you've taken?",
    ],
    bold: [
      "Let's skip the small talk: pick a city, I'll book the coffee, and you can show me how to take proper travel photos 😉",
      "You have an effortless glow in these photos. Tell me your craziest travel story over drinks this Thursday.",
      "I rarely swipe right this fast, but that Kyoto smile is hard to ignore. What's your go-to weekend adventure?",
    ],
    playful: [
      "If your travel photos were a magazine cover, I'd subscribe. Did you get lost in Kyoto or did you actually have a map? 😏",
      "Serious question: does coffee taste 10x better when you're traveling, or is it just the vacation talking?",
      "That smile is dangerously charming. Are you as fun to travel with as your profile suggests?",
    ],
    romantic: [
      "There's a quiet magic in those travel photos. What was the one moment on your trip where time just stood still?",
      "Finding quiet corners in foreign cities is pure romance. What place has stolen your heart the most?",
      "Your photos feel like poetry. What song reminds you most of that Kyoto sunset?",
    ],
    gentle: [
      "Hey Sarah! Loved your photography vibe—you seem to have such a calm, genuine appreciation for beautiful places.",
      "Such peaceful energy in your Kyoto pictures. Hope you've had a wonderful week exploring cozy cafes!",
      "Hi Sarah! What's your absolute favorite cozy coffee spot you've discovered so far?",
    ],
    serious: [
      "Travel always reshapes how we see the world. What was the most meaningful lesson your travels taught you?",
      "Photography is all about perspective. What draws you to capture the moments you do?",
      "It's rare to see someone with such a genuine eye for beauty. What kind of adventures fulfill you most?",
    ],
    freestyle: [
      "Noticed your trip to Kyoto—did you find that hidden matcha spot by the canal, or get lost in the bamboo grove?",
      "That coffee aesthetic is unbeatable! What's the most memorable cafe you've ever stumbled upon?",
      "Incredible eye for photography. Are you currently planning your next big getaway?",
    ],
  },
  maya: {
    flirty: [
      "An architect with serious espresso standards? That's an unfair combination 😉 Do you design buildings or just steal hearts?",
      "That outdoor terrace looks gorgeous, but honestly your smile steals all the architectural spotlight ✨",
      "I have a sudden urge to learn all about Italian design. Want to quiz me over an espresso this Thursday? 😉",
    ],
    witty: [
      "As an architect, be honest: do you judge cafes purely by their interior lighting, or does the espresso actually matter? 😂",
      "I promise not to make any cheesy 'let's build a future together' puns if you tell me where that terrace cafe is.",
      "Tell me you don't secretly critique the ceiling height of every restaurant you walk into 😏",
    ],
    confident: [
      "Great design, sharp smile, and high espresso standards. I know a hidden espresso bar downtown you'll appreciate—let's go.",
      "You clearly know what great aesthetics look like. Let's grab an espresso and talk favorite cities.",
      "I admire people who create things. What's the dream project you want to build one day?",
    ],
    charming: [
      "That outdoor cafe looks cozy! What's an architect's official go-to coffee order on a crisp Sunday morning?",
      "Your aesthetic in these photos is lovely. What sparked your passion for architecture?",
      "Always fascinated by great architecture. What's the most inspiring city you've ever explored?",
    ],
    bold: [
      "You have incredible style. Let's see if your conversation is as well-designed as your projects 😉 Drinks this week?",
      "I'm skipping the small talk—recommend me your favorite coffee spot and I'll buy round one.",
      "You have that rare combination of brains, creativity, and charisma. Let's grab coffee and see if sparks fly.",
    ],
    playful: [
      "Architect alert! Tell me the truth: how often do you walk into a room and mentally remodel the entire floor plan? 😏",
      "On a scale from 1 to 'double espresso directly into my veins', how busy has your week been?",
      "That cafe looks like a European daydream! Are you secretly an undercover travel blogger? 😏",
    ],
    romantic: [
      "There's so much soul in well-designed spaces. What building or place has moved you the most emotionally?",
      "A slow morning, warm espresso, and great conversation—sounds like the ideal start to any love story.",
      "Your creative passion shines through your smile. What inspires your favorite designs?",
    ],
    gentle: [
      "Hey Maya! Love the warm, creative energy in your profile. What’s your favorite hidden spot around town?",
      "Such a peaceful cafe vibe! Hope you're enjoying some quiet time away from blueprints this week.",
      "Hi Maya! What’s your favorite way to unwind after a long design session?",
    ],
    serious: [
      "Architecture shapes how people live and connect with each other. What philosophy drives your work?",
      "It takes dedication to master design. What's an architectural movement you feel deeply connected to?",
      "Looking for someone passionate about what they do. What project has made you the most proud?",
    ],
    freestyle: [
      "That outdoor cafe terrace has great proportions! What's an architect's honest verdict on their espresso?",
      "Design and great coffee are the best two things in life. What's your favorite neighbourhood to wander?",
      "Love the creative vibe on your profile! Have you worked on any exciting local builds recently?",
    ],
  },
  elena: {
    flirty: [
      "Golden hour was definitely made for you 😉 But more importantly: smooth jazz or upbeat rooftop vibes?",
      "That rooftop view is stunning, but honestly you outshined the entire skyline ✨ Wine this weekend?",
      "Live jazz, sunsets, and a smile like that? Be careful, you're raising my standards way too high 😉",
    ],
    witty: [
      "Rooftop sunsets and live jazz? If your playlist is as good as this photo, we might just be best friends already 😂",
      "Please tell me you don't clap on the 1 and 3 during a jazz solo—that's my only dealbreaker! 🎷",
      "Golden hour glow + live jazz = you're basically living in a La La Land scene. Who's your favorite jazz artist?",
    ],
    confident: [
      "You have top-tier taste in evenings. I know a speakeasy with live jazz that rivals this rooftop—care to join?",
      "A woman who appreciates live jazz and rooftop views doesn't settle for boring dates. Let's grab a glass this Friday.",
      "You look like someone who knows the best-kept secrets in the city. What's your favorite jazz bar?",
    ],
    charming: [
      "There's nothing quite like golden hour with good music. Have you caught any unforgettable live jazz sets lately?",
      "Such an effortless, vibrant energy in your pictures. What's your favorite rooftop spot around here?",
      "Live jazz is unmatched for evening vibes. Do you play any instruments or just have great musical taste?",
    ],
    bold: [
      "That rooftop glow caught my attention immediately. Let's grab a glass of wine this week and debate the best jazz spots 😉",
      "I'll keep it simple: you, me, and a cozy jazz club this Thursday. You pick the venue, I'll get the drinks.",
      "You have that magnetic evening energy. What's one song that never fails to put you in an amazing mood?",
    ],
    playful: [
      "Live jazz and rooftop sunsets—are you starring in a movie or is this just your average Tuesday night? 😏",
      "If you had to choose one forever: rooftop sunsets with no music, or underground jazz with no windows?",
      "That golden hour lighting is doing you justice! Did you have to fight for that rooftop seat? 😏",
    ],
    romantic: [
      "Sunsets and live jazz speak right to the soul. What song instantly takes you back to a perfect summer night?",
      "There's something deeply romantic about watching the city lights come on while a saxophone plays in the background.",
      "Your photos radiate such warm, soulful energy. What makes an evening truly unforgettable for you?",
    ],
    gentle: [
      "Hey Elena! Such lovely, warm energy in your photos. What's your favorite spot for an evening unwinding with live music?",
      "Golden hour rooftop views are the best way to end the day. Hope you've been catching some gorgeous sunsets!",
      "Hi Elena! Love your musical taste—there's nothing quite like live acoustic sets on a calm evening.",
    ],
    serious: [
      "Jazz is all about spontaneity and deep listening. Do you find that music influences how you experience the city?",
      "There's a rare depth to people who love live jazz. What kind of sounds or art move you most?",
      "Looking for authentic connection. What does your ideal, meaningful evening look like?",
    ],
    freestyle: [
      "Golden hour rooftop views can't be beat! Have you found any underground jazz spots with that same vibe?",
      "That sunset lighting is pure magic. What's the best live performance you've seen this year?",
      "Live jazz and evening views—you clearly know how to enjoy the city. What's your favorite speakeasy?",
    ],
  },
};

function getPersonalizedOpener(profileId, personalityId, variation = 0) {
  const profileOpeners = PROFILE_OPENERS_MATRIX[profileId] || PROFILE_OPENERS_MATRIX.sarah;
  const list = profileOpeners[personalityId] || profileOpeners.freestyle || profileOpeners.witty;
  return list[Math.abs(variation) % list.length];
}


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
  { code: 'AF', dial: '+93', name: 'Afghanistan', len: [9, 9] },
  { code: 'AL', dial: '+355', name: 'Albania', len: [9, 9] },
  { code: 'DZ', dial: '+213', name: 'Algeria', len: [9, 9] },
  { code: 'AR', dial: '+54', name: 'Argentina', len: [10, 10] },
  { code: 'AM', dial: '+374', name: 'Armenia', len: [8, 8] },
  { code: 'AU', dial: '+61', name: 'Australia', len: [9, 9] },
  { code: 'AT', dial: '+43', name: 'Austria', len: [10, 11] },
  { code: 'AZ', dial: '+994', name: 'Azerbaijan', len: [9, 9] },
  { code: 'BD', dial: '+880', name: 'Bangladesh', len: [10, 10] },
  { code: 'BY', dial: '+375', name: 'Belarus', len: [9, 9] },
  { code: 'BE', dial: '+32', name: 'Belgium', len: [9, 9] },
  { code: 'BO', dial: '+591', name: 'Bolivia', len: [8, 8] },
  { code: 'BA', dial: '+387', name: 'Bosnia and Herzegovina', len: [8, 8] },
  { code: 'BR', dial: '+55', name: 'Brazil', len: [10, 11] },
  { code: 'BG', dial: '+359', name: 'Bulgaria', len: [9, 9] },
  { code: 'KH', dial: '+855', name: 'Cambodia', len: [8, 9] },
  { code: 'CA', dial: '+1', name: 'Canada', len: [10, 10] },
  { code: 'CL', dial: '+56', name: 'Chile', len: [9, 9] },
  { code: 'CN', dial: '+86', name: 'China', len: [11, 11] },
  { code: 'CO', dial: '+57', name: 'Colombia', len: [10, 10] },
  { code: 'HR', dial: '+385', name: 'Croatia', len: [8, 9] },
  { code: 'CZ', dial: '+420', name: 'Czech Republic', len: [9, 9] },
  { code: 'DK', dial: '+45', name: 'Denmark', len: [8, 8] },
  { code: 'EC', dial: '+593', name: 'Ecuador', len: [9, 9] },
  { code: 'EG', dial: '+20', name: 'Egypt', len: [10, 10] },
  { code: 'EE', dial: '+372', name: 'Estonia', len: [7, 8] },
  { code: 'ET', dial: '+251', name: 'Ethiopia', len: [9, 9] },
  { code: 'FI', dial: '+358', name: 'Finland', len: [9, 10] },
  { code: 'FR', dial: '+33', name: 'France', len: [9, 9] },
  { code: 'GE', dial: '+995', name: 'Georgia', len: [9, 9] },
  { code: 'DE', dial: '+49', name: 'Germany', len: [10, 11] },
  { code: 'GH', dial: '+233', name: 'Ghana', len: [9, 9] },
  { code: 'GR', dial: '+30', name: 'Greece', len: [10, 10] },
  { code: 'GT', dial: '+502', name: 'Guatemala', len: [8, 8] },
  { code: 'HU', dial: '+36', name: 'Hungary', len: [9, 9] },
  { code: 'IN', dial: '+91', name: 'India', len: [10, 10] },
  { code: 'ID', dial: '+62', name: 'Indonesia', len: [9, 12] },
  { code: 'IR', dial: '+98', name: 'Iran', len: [10, 10] },
  { code: 'IQ', dial: '+964', name: 'Iraq', len: [10, 10] },
  { code: 'IE', dial: '+353', name: 'Ireland', len: [9, 9] },
  { code: 'IL', dial: '+972', name: 'Israel', len: [9, 9] },
  { code: 'IT', dial: '+39', name: 'Italy', len: [9, 10] },
  { code: 'JP', dial: '+81', name: 'Japan', len: [10, 10] },
  { code: 'JO', dial: '+962', name: 'Jordan', len: [9, 9] },
  { code: 'KZ', dial: '+7', name: 'Kazakhstan', len: [10, 10] },
  { code: 'KE', dial: '+254', name: 'Kenya', len: [9, 9] },
  { code: 'XK', dial: '+383', name: 'Kosovo', len: [8, 8] },
  { code: 'KW', dial: '+965', name: 'Kuwait', len: [8, 8] },
  { code: 'LV', dial: '+371', name: 'Latvia', len: [8, 8] },
  { code: 'LB', dial: '+961', name: 'Lebanon', len: [7, 8] },
  { code: 'LY', dial: '+218', name: 'Libya', len: [9, 9] },
  { code: 'LT', dial: '+370', name: 'Lithuania', len: [8, 8] },
  { code: 'MY', dial: '+60', name: 'Malaysia', len: [9, 10] },
  { code: 'MX', dial: '+52', name: 'Mexico', len: [10, 10] },
  { code: 'MD', dial: '+373', name: 'Moldova', len: [8, 8] },
  { code: 'MN', dial: '+976', name: 'Mongolia', len: [8, 8] },
  { code: 'MA', dial: '+212', name: 'Morocco', len: [9, 9] },
  { code: 'NL', dial: '+31', name: 'Netherlands', len: [9, 9] },
  { code: 'NZ', dial: '+64', name: 'New Zealand', len: [8, 9] },
  { code: 'NG', dial: '+234', name: 'Nigeria', len: [10, 10] },
  { code: 'MK', dial: '+389', name: 'North Macedonia', len: [8, 8] },
  { code: 'NO', dial: '+47', name: 'Norway', len: [8, 8] },
  { code: 'PK', dial: '+92', name: 'Pakistan', len: [10, 10] },
  { code: 'PY', dial: '+595', name: 'Paraguay', len: [9, 9] },
  { code: 'PE', dial: '+51', name: 'Peru', len: [9, 9] },
  { code: 'PH', dial: '+63', name: 'Philippines', len: [10, 10] },
  { code: 'PL', dial: '+48', name: 'Poland', len: [9, 9] },
  { code: 'PT', dial: '+351', name: 'Portugal', len: [9, 9] },
  { code: 'QA', dial: '+974', name: 'Qatar', len: [8, 8] },
  { code: 'RO', dial: '+40', name: 'Romania', len: [9, 9] },
  { code: 'RU', dial: '+7', name: 'Russia', len: [10, 10] },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia', len: [9, 9] },
  { code: 'RS', dial: '+381', name: 'Serbia', len: [8, 9] },
  { code: 'SK', dial: '+421', name: 'Slovakia', len: [9, 9] },
  { code: 'SI', dial: '+386', name: 'Slovenia', len: [8, 8] },
  { code: 'ZA', dial: '+27', name: 'South Africa', len: [9, 9] },
  { code: 'KR', dial: '+82', name: 'South Korea', len: [9, 10] },
  { code: 'ES', dial: '+34', name: 'Spain', len: [9, 9] },
  { code: 'LK', dial: '+94', name: 'Sri Lanka', len: [9, 9] },
  { code: 'SE', dial: '+46', name: 'Sweden', len: [9, 9] },
  { code: 'CH', dial: '+41', name: 'Switzerland', len: [9, 9] },
  { code: 'SY', dial: '+963', name: 'Syria', len: [9, 9] },
  { code: 'TW', dial: '+886', name: 'Taiwan', len: [9, 9] },
  { code: 'TH', dial: '+66', name: 'Thailand', len: [9, 9] },
  { code: 'TN', dial: '+216', name: 'Tunisia', len: [8, 8] },
  { code: 'TR', dial: '+90', name: 'Turkey', len: [10, 10] },
  { code: 'UA', dial: '+380', name: 'Ukraine', len: [9, 9] },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates', len: [9, 9] },
  { code: 'GB', dial: '+44', name: 'United Kingdom', len: [10, 10] },
  { code: 'US', dial: '+1', name: 'United States', len: [10, 10] },
  { code: 'UY', dial: '+598', name: 'Uruguay', len: [8, 8] },
  { code: 'UZ', dial: '+998', name: 'Uzbekistan', len: [9, 9] },
  { code: 'VE', dial: '+58', name: 'Venezuela', len: [10, 10] },
  { code: 'VN', dial: '+84', name: 'Vietnam', len: [9, 10] },
  { code: 'YE', dial: '+967', name: 'Yemen', len: [9, 9] },
];

const DIAL_EXAMPLES = {
  '+93': '701234567', '+355': '661234567', '+213': '551234567',
  '+54': '1123456789', '+374': '77123456', '+61': '412345678',
  '+43': '6641234567', '+994': '501234567', '+880': '1712345678',
  '+375': '291234567', '+32': '470123456', '+591': '71234567',
  '+387': '61123456', '+55': '11912345678', '+359': '881234567',
  '+855': '12345678', '+1': '2015551234', '+56': '912345678',
  '+86': '13812345678', '+57': '3001234567', '+385': '91234567',
  '+420': '601123456', '+45': '20123456', '+593': '991234567',
  '+20': '1001234567', '+372': '51234567', '+251': '911234567',
  '+358': '412345678', '+33': '612345678', '+995': '555123456',
  '+49': '15123456789', '+233': '201234567', '+30': '6912345678',
  '+502': '51234567', '+36': '201234567', '+91': '9123456789',
  '+62': '81234567890', '+98': '9123456789', '+964': '7901234567',
  '+353': '851234567', '+972': '501234567', '+39': '3123456789',
  '+81': '9012345678', '+962': '791234567', '+7': '9161234567',
  '+254': '712345678', '+383': '43123456', '+965': '51234567',
  '+371': '21234567', '+961': '3123456', '+218': '912345678',
  '+370': '61234567', '+60': '123456789', '+52': '5512345678',
  '+373': '69123456', '+976': '88123456', '+212': '612345678',
  '+31': '612345678', '+64': '21123456', '+234': '8012345678',
  '+389': '71234567', '+47': '41234567', '+92': '3001234567',
  '+595': '961234567', '+51': '912345678', '+63': '9171234567',
  '+48': '512345678', '+351': '912345678', '+974': '33123456',
  '+40': '712345678', '+966': '512345678', '+381': '641234567',
  '+421': '901234567', '+386': '31234567', '+27': '711234567',
  '+82': '1012345678', '+34': '612345678', '+94': '712345678',
  '+46': '701234567', '+41': '791234567', '+963': '944123456',
  '+886': '912345678', '+66': '812345678', '+216': '20123456',
  '+90': '5321234567', '+380': '501234567', '+971': '501234567',
  '+44': '7911123456', '+598': '91234567', '+998': '901234567',
  '+58': '4121234567', '+84': '912345678', '+967': '712345678',
};

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bangladesh', 'Belarus', 'Belgium', 'Bolivia', 'Bosnia and Herzegovina',
  'Brazil', 'Bulgaria', 'Cambodia', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia',
  'Czech Republic', 'Denmark', 'Ecuador', 'Egypt', 'Estonia', 'Ethiopia', 'Finland',
  'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Hungary', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kosovo', 'Kuwait', 'Latvia', 'Lebanon', 'Libya', 'Lithuania',
  'Malaysia', 'Mexico', 'Moldova', 'Mongolia', 'Morocco', 'Netherlands', 'New Zealand',
  'Nigeria', 'North Macedonia', 'Norway', 'Pakistan', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia',
  'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka',
  'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Thailand', 'Tunisia', 'Turkey',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
  'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen',
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
    gradient: [C.primary, C.secondary],
    accentColor: C.primary,
    tone: 'primary',
    bgActive: C.primarySoft,
  },
  {
    id: 'phone',
    title: 'Get Her Number',
    desc: 'Asks for her number so you can text or WhatsApp directly.',
    icon: 'call',
    gradient: [C.success, C.info],
    accentColor: C.success,
    tone: 'success',
    bgActive: C.successSoft,
  },
  {
    id: 'social',
    title: 'Exchange Socials',
    desc: 'Swaps Instagram or Snapchat to check out photos and stories.',
    icon: 'logo-instagram',
    gradient: [C.info, C.accent],
    accentColor: C.info,
    tone: 'info',
    bgActive: C.infoSoft,
  },
  {
    id: 'never_stop',
    title: 'Casual Chat & Banter',
    desc: 'Keeps the conversation fun and playful with no rush to meet.',
    icon: 'chatbubbles',
    gradient: [C.secondary, C.accent],
    accentColor: C.secondary,
    tone: 'secondary',
    bgActive: C.secondarySoft,
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

// ── Selectable Goal Card (native-driver selection, press and check animations) ──
const GoalCardItem = React.memo(({ goal, isSelected, onToggle }) => {
  const reduceMotion = useMotionReduced();
  const progress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const checkProgress = useRef(new Animated.Value(isSelected ? 1 : 0.6)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
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
        duration: uiTheme.motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [isSelected, reduceMotion]);

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, {
      toValue: uiTheme.motion.press.scale,
      mass: 0.5,
      stiffness: 300,
      damping: 20,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) {
      pressScale.setValue(1);
      return;
    }
    Animated.spring(pressScale, {
      toValue: 1,
      mass: 0.5,
      stiffness: 200,
      damping: 18,
      useNativeDriver: true,
    }).start();
  };

  const iconScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const ringOpacity = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 0],
  });
  const ringScale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
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
      <Animated.View style={[styles.goalCard, { transform: [{ scale: pressScale }] }]}>
        {/* Selected fill + border, faded in on the native thread */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.goalCardSelectedLayer, { opacity: progress }]}
          pointerEvents="none"
        />

        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <IconWell icon={goal.icon} tone={isSelected ? goal.tone : 'neutral'} size={44} iconSize={20} />
        </Animated.View>

        <View style={styles.goalInfo}>
          <Text style={styles.goalTitle} maxFontSizeMultiplier={uiTheme.fontScale.body}>
            {goal.title}
          </Text>
          <Text style={[styles.goalDesc, isSelected && styles.goalDescSelected]} maxFontSizeMultiplier={uiTheme.fontScale.body}>
            {goal.desc}
          </Text>
        </View>

        <View style={styles.goalCheckWrap}>
          <Animated.View
            style={[styles.goalRippleRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.goalCheck,
              isSelected && styles.goalCheckSelected,
              { transform: [{ scale: checkProgress }] },
            ]}
          >
            {isSelected && <Ionicons name="checkmark" size={14} color={C.onPrimary} />}
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
    accentColor: C.primary,
    previewOpener: "Hey! Love the energy in your profile. How's your week treating you so far?",
    vibeDesc: 'Adapts to photos and bio cues for natural chemistry.',
  },
  {
    id: 'flirty',
    label: 'Flirty',
    tagline: 'Teasing & Warm',
    icon: 'flame',
    accentColor: C.accent,
    previewOpener: "Had to swipe right — that smile definitely caught my eye. What's your secret?",
    vibeDesc: 'Playful compliments and charm to spark chemistry fast.',
  },
  {
    id: 'confident',
    label: 'Confident',
    tagline: 'Direct & Bold',
    icon: 'diamond',
    accentColor: C.info,
    previewOpener: "Hey, good taste! Let's skip the small talk — what are you most passionate about right now?",
    vibeDesc: 'Direct, bold questions that cut past small talk.',
  },
  {
    id: 'witty',
    label: 'Witty',
    tagline: 'Sharp Banter',
    icon: 'bulb',
    accentColor: C.info,
    previewOpener: "Quick question: what's the craziest story behind your third travel photo?",
    vibeDesc: 'Clever banter and humor to get her smiling right away.',
  },
  {
    id: 'charming',
    label: 'Charming',
    tagline: 'Smooth & Polite',
    icon: 'heart',
    accentColor: C.secondary,
    previewOpener: "Honestly couldn't just scroll past without saying hi. What's something fun you've been up to?",
    vibeDesc: 'Smooth curiosity with classic gentlemanly warmth.',
  },
  {
    id: 'playful',
    label: 'Playful',
    tagline: 'High Energy',
    icon: 'happy',
    accentColor: C.warning,
    previewOpener: 'Swiped right for the vibe, stayed to see if your humor matches mine 😏',
    vibeDesc: 'Lively teasing and fun energy to keep chats exciting.',
  },
  {
    id: 'bold',
    label: 'Bold',
    tagline: 'Direct & Daring',
    icon: 'flash',
    accentColor: C.error,
    previewOpener: "Let's be real — we'd probably have great chemistry over coffee or drinks.",
    vibeDesc: 'Daring, memorable openers that stand out instantly.',
  },
  {
    id: 'romantic',
    label: 'Romantic',
    tagline: 'Sweet & Sincere',
    icon: 'rose',
    accentColor: C.accent,
    previewOpener: "Love the energy in your photos. What's something that always brings a smile to your face?",
    vibeDesc: 'Sweet, sincere questions that spark real feelings.',
  },
  {
    id: 'gentle',
    label: 'Gentle',
    tagline: 'Relaxed & Kind',
    icon: 'cafe',
    accentColor: C.success,
    previewOpener: 'Hey there! Loved your profile, you seem to have really warm, down-to-earth energy.',
    vibeDesc: 'Relaxed, warm curiosity with zero pressure or rush.',
  },
  {
    id: 'serious',
    label: 'Deep Connection',
    tagline: 'Authentic & Real',
    icon: 'compass',
    accentColor: C.info,
    previewOpener: "Looking for something real and genuine. What's a passion project you love working on?",
    vibeDesc: 'Authentic, thoughtful questions for deeper connections.',
  },
];

const PRIMARY_PERSONALITY_IDS = ['freestyle', 'flirty', 'confident', 'witty', 'charming', 'gentle'];

export default function OnboardingScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    trackingService.trackEvent('onboarding_started', { step: 1 });
  }, []);
  const totalSteps = 5;

  // ── Layout & motion environment (presentation only) ──
  const reduceMotion = useMotionReduced();
  const insets = useSafeAreaInsets();
  const { gutter, height: windowHeight, contentWidth } = useResponsive();

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
  const [cardOpenerIndex, setCardOpenerIndex] = useState(0);
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
        title: 'Fun & Natural Banter',
        detail: 'Relaxed, witty conversations with zero pressure or awkwardness',
      };
    }
    if (selectedGoals.includes('never_stop')) {
      return {
        title: 'Fun & Natural Banter',
        detail: 'Relaxed, witty conversations with zero pressure or awkwardness',
      };
    }
    const matched = GOALS.filter((g) => selectedGoals.includes(g.id));
    const hasDate = selectedGoals.includes('date');
    const hasPhone = selectedGoals.includes('phone');
    const hasSocial = selectedGoals.includes('social');

    if (matched.length === 1) {
      if (hasDate) {
        return {
          title: 'Setting Up Real Dates',
          detail: 'Flint effortlessly turns mutual attraction into memorable real-life dates',
        };
      }
      if (hasPhone) {
        return {
          title: 'Getting Her Number',
          detail: 'Smoothly transitions great chats to texting at the peak of conversation',
        };
      }
      if (hasSocial) {
        return {
          title: 'Exchanging Socials',
          detail: 'Effortlessly swaps Instagram handles when the vibe is right',
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
        detail: 'Turns fun conversations into real-world dates and social connections',
      };
    }
    if (hasDate && hasPhone) {
      return {
        title: 'Real Dates & Phone Numbers',
        detail: 'Sparks genuine chemistry, gets her number, and plans real-life dates',
      };
    }
    if (hasDate && hasSocial) {
      return {
        title: 'Real Dates & Socials',
        detail: 'Trades Instagram handles and turns chats into real-world meetups',
      };
    }
    if (hasPhone && hasSocial) {
      return {
        title: 'Phone Numbers & Socials',
        detail: 'Moves the chat smoothly over to WhatsApp or Instagram without the lag',
      };
    }

    return {
      title: matched.map((g) => g.title).join(' & '),
      detail: 'Tailored to spark chemistry and lead to real-world dates',
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
    if (!safeMode || reduceMotion) {
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
  }, [safeMode, shieldPulse, reduceMotion]);

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
    }).catch(() => { });

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
    if (reduceMotion) {
      voiceCursorOpacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(voiceCursorOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.timing(voiceCursorOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [voiceCursorOpacity, reduceMotion]);

  // Bouncing typing dots loop
  useEffect(() => {
    if (reduceMotion) {
      typingDot1.setValue(0);
      typingDot2.setValue(0);
      typingDot3.setValue(0);
      return undefined;
    }
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
  }, [typingDot1, typingDot2, typingDot3, reduceMotion]);

  // Audio / Vibe Waveform Visualizer loop
  useEffect(() => {
    if (reduceMotion) {
      waveBar1.setValue(0.6);
      waveBar2.setValue(0.9);
      waveBar3.setValue(0.5);
      return undefined;
    }
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
  }, [waveBar1, waveBar2, waveBar3, reduceMotion]);

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
  const stepIndexAnim = useRef(new Animated.Value(1)).current;
  const mainScrollRef = useRef(null);
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

  // ── Step 5: High-End Native-Driven Profile Card Stack (Apple / Revolut Physics, Pure 3-Card Infinite Loop) ──
  const [activeProfileIdx, setActiveProfileIdx] = useState(0); // 0: Sarah, 1: Maya, 2: Elena
  const [profileZIndices, setProfileZIndices] = useState([3, 2, 1]); // Card 0: 3 (front), Card 1: 2 (mid), Card 2: 1 (back)
  const profileSlotsRef = useRef([0, 1, 2]); // [frontProfileIdx, midProfileIdx, backProfileIdx]
  const isSwipingProfileRef = useRef(false);
  const laserBeamAnim = useRef(new Animated.Value(0)).current;

  // Dedicated persistent animated values for each of the 3 preview profiles (NO value resetting, NO snapback):
  const profileCardAnims = useRef([
    {
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(1.0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1.0),
      dimmer: new Animated.Value(0.0), // 0.0 = completely bright
    },
    {
      x: new Animated.Value(0),
      y: new Animated.Value(-22),
      scale: new Animated.Value(0.94),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1.0),
      dimmer: new Animated.Value(0.35), // dimmed behind front card, peeks out above
    },
    {
      x: new Animated.Value(0),
      y: new Animated.Value(-42),
      scale: new Animated.Value(0.88),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1.0),
      dimmer: new Animated.Value(0.65), // dimmed behind mid card, peeks out above
    },
  ]).current;

  const likeStampOpacity = useRef(new Animated.Value(0)).current;
  const nopeStampOpacity = useRef(new Animated.Value(0)).current;

  // ── Step 5: High-End Native-Driven Playing Card Stack (Apple / Revolut Physics, ZERO Snapback) ──
  const [activeBlueprintIdx, setActiveBlueprintIdx] = useState(0);
  const [bpZIndices, setBpZIndices] = useState([3, 2, 1]); // Card 0: 3 (front), Card 1: 2 (mid), Card 2: 1 (back)
  const bpSlotsRef = useRef([0, 1, 2]); // [frontCardIdx, midCardIdx, backCardIdx]
  const isCyclingBlueprint = useRef(false);

  // Dedicated persistent animated values for each of the 3 blueprint cards (NO resetting, NO snapback):
  const bpCardAnims = useRef([
    {
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(1.0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1.0),
    },
    {
      x: new Animated.Value(0),
      y: new Animated.Value(8),
      scale: new Animated.Value(0.94),
      rotate: new Animated.Value(2.5),
      opacity: new Animated.Value(0.85),
    },
    {
      x: new Animated.Value(0),
      y: new Animated.Value(16),
      scale: new Animated.Value(0.88),
      rotate: new Animated.Value(-2.5),
      opacity: new Animated.Value(0.60),
    },
  ]).current;

  const cycleBlueprintCard = useCallback(() => {
    if (isCyclingBlueprint.current) return;
    isCyclingBlueprint.current = true;
    safeHaptic('light');

    const [frontIdx, midIdx, backIdx] = bpSlotsRef.current;
    const frontCard = bpCardAnims[frontIdx];
    const midCard = bpCardAnims[midIdx];
    const backCard = bpCardAnims[backIdx];

    // Phase 1: Top card slides smoothly out to the right (like a dealer sliding card off deck)
    Animated.parallel([
      Animated.timing(frontCard.x, {
        toValue: 90,
        duration: 180,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
        useNativeDriver: true,
      }),
      Animated.timing(frontCard.rotate, {
        toValue: 6,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(frontCard.scale, {
        toValue: 0.98,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Switch z-indices while front card is completely out to the right
      setBpZIndices((prev) => {
        const next = [...prev];
        next[frontIdx] = 1;
        next[midIdx] = 3;
        next[backIdx] = 2;
        return next;
      });

      // Phase 3: Front card slides back IN underneath into back slot (Slot 2)
      // Simultaneously, Mid card rises smoothly to Front (Slot 0), Back card rises to Mid (Slot 1)
      Animated.parallel([
        // Front card slides into back slot (Slot 2):
        Animated.timing(frontCard.x, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(frontCard.y, {
          toValue: 16,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(frontCard.scale, {
          toValue: 0.88,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(frontCard.rotate, {
          toValue: -2.5,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(frontCard.opacity, {
          toValue: 0.60,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),

        // Mid card rises to front slot (Slot 0):
        Animated.timing(midCard.y, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(midCard.scale, {
          toValue: 1.0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(midCard.rotate, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(midCard.opacity, {
          toValue: 1.0,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),

        // Back card rises to mid slot (Slot 1):
        Animated.timing(backCard.y, {
          toValue: 8,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(backCard.scale, {
          toValue: 0.94,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(backCard.rotate, {
          toValue: 2.5,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(backCard.opacity, {
          toValue: 0.85,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        bpSlotsRef.current = [midIdx, backIdx, frontIdx];
        setActiveBlueprintIdx(midIdx);
        isCyclingBlueprint.current = false;
      });
    });
  }, [bpCardAnims]);

  useEffect(() => {
    if (currentStep !== 5) return;
    const interval = setInterval(() => {
      cycleBlueprintCard();
    }, 3800);
    return () => clearInterval(interval);
  }, [currentStep, cycleBlueprintCard]);

  // ── Step 5: Pure Physical 3-Card Stack Loop Swipe Function (Zero Snapback, Infinite Loop) ──
  const swipeProfile = useCallback(
    (isLike) => {
      if (isSwipingProfileRef.current) return;
      isSwipingProfileRef.current = true;
      safeHaptic(isLike ? 'medium' : 'light');

      const [frontIdx, midIdx, backIdx] = profileSlotsRef.current;
      const frontAnim = profileCardAnims[frontIdx];
      const midAnim = profileCardAnims[midIdx];
      const backAnim = profileCardAnims[backIdx];

      const flingDir = isLike ? 1 : -1;
      const flingX = flingDir * (SCREEN_WIDTH + 140);
      const flingRot = flingDir * 12;

      Animated.parallel([
        // 1. Top card flings off screen (fast, fluid):
        Animated.timing(frontAnim.x, {
          toValue: flingX,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(frontAnim.rotate, {
          toValue: flingRot,
          duration: 220,
          useNativeDriver: false,
        }),
        Animated.timing(frontAnim.opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(likeStampOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.timing(nopeStampOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),

        // 2. 2nd card (mid) ZOOMS IN from 0.94 to 1.0, glides down from -22 to 0, and un-dims from 0.35 to 0.0 (dimmed -> bright!):
        Animated.timing(midAnim.scale, {
          toValue: 1.0,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(midAnim.y, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(midAnim.dimmer, {
          toValue: 0.0,
          duration: 220,
          useNativeDriver: false,
        }),

        // 3. 3rd card (back) ZOOMS IN from 0.88 to 0.94, glides down from -42 to -22, and un-dims from 0.65 to 0.35:
        Animated.timing(backAnim.scale, {
          toValue: 0.94,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(backAnim.y, {
          toValue: -22,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(backAnim.dimmer, {
          toValue: 0.35,
          duration: 220,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // Phase 2: Rotate slots: Mid is now Front (Slot 0), Back is now Mid (Slot 1), Front is now Back (Slot 2)
        profileSlotsRef.current = [midIdx, backIdx, frontIdx];

        // Update z-indices so new front is on top (3), mid is (2), back is (1)
        setProfileZIndices((prev) => {
          const next = [...prev];
          next[midIdx] = 3;
          next[backIdx] = 2;
          next[frontIdx] = 1;
          return next;
        });

        // Update active profile index to update subtitle and simulated chat
        setActiveProfileIdx(midIdx);

        // Position the swiped card behind the deck in Slot 2 (scale 0.88, y -42, dimmer 0.65)
        frontAnim.x.setValue(0);
        frontAnim.y.setValue(-42);
        frontAnim.scale.setValue(0.88);
        frontAnim.rotate.setValue(0);
        frontAnim.dimmer.setValue(0.65);

        // Seamlessly reveal it in the back slot behind the other two cards
        Animated.timing(frontAnim.opacity, {
          toValue: 1.0,
          duration: 180,
          useNativeDriver: false,
        }).start(() => {
          isSwipingProfileRef.current = false;
        });
      });
    },
    [profileCardAnims, likeStampOpacity, nopeStampOpacity]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isSwipingProfileRef.current &&
          Math.abs(gestureState.dx) > 6 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          !isSwipingProfileRef.current &&
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: () => {
          const [frontIdx] = profileSlotsRef.current;
          profileCardAnims[frontIdx].x.stopAnimation();
          profileCardAnims[frontIdx].y.stopAnimation();
          profileCardAnims[frontIdx].rotate.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (isSwipingProfileRef.current) return;
          const [frontIdx, midIdx, backIdx] = profileSlotsRef.current;
          const frontAnim = profileCardAnims[frontIdx];
          const midAnim = profileCardAnims[midIdx];
          const backAnim = profileCardAnims[backIdx];

          const dx = gestureState.dx;
          const dy = gestureState.dy;

          // 1. Move Front Card:
          frontAnim.x.setValue(dx);
          frontAnim.y.setValue(dy * 0.22);
          frontAnim.rotate.setValue(dx * 0.05);

          // 2. Stamps:
          if (dx > 18) {
            likeStampOpacity.setValue(Math.min((dx - 18) / 50, 1));
            nopeStampOpacity.setValue(0);
          } else if (dx < -18) {
            nopeStampOpacity.setValue(Math.min((-dx - 18) / 50, 1));
            likeStampOpacity.setValue(0);
          } else {
            likeStampOpacity.setValue(0);
            nopeStampOpacity.setValue(0);
          }

          // 3. Zoom-in and un-dim the 2nd (dimmed) card to bright as 1st card is swiped!
          const progress = Math.min(Math.abs(dx) / 120, 1);

          // Mid card (Slot 1) zooms in from 0.94 to 1.0, y glides from -22 to 0, dimmer un-dims from 0.35 to 0.0:
          midAnim.scale.setValue(0.94 + progress * (1.0 - 0.94));
          midAnim.y.setValue(-22 + progress * 22);
          midAnim.dimmer.setValue(0.35 - progress * 0.35);

          // Back card (Slot 2) zooms in from 0.88 to 0.94, y glides from -42 to -22, dimmer un-dims from 0.65 to 0.35:
          backAnim.scale.setValue(0.88 + progress * (0.94 - 0.88));
          backAnim.y.setValue(-42 + progress * 20);
          backAnim.dimmer.setValue(0.65 - progress * (0.65 - 0.35));
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockAppResponder: () => true,
        onPanResponderTerminate: () => {
          const [frontIdx, midIdx, backIdx] = profileSlotsRef.current;
          const frontAnim = profileCardAnims[frontIdx];
          const midAnim = profileCardAnims[midIdx];
          const backAnim = profileCardAnims[backIdx];

          Animated.parallel([
            Animated.spring(frontAnim.x, { toValue: 0, friction: 7, tension: 40, useNativeDriver: false }),
            Animated.spring(frontAnim.y, { toValue: 0, friction: 7, tension: 40, useNativeDriver: false }),
            Animated.spring(frontAnim.rotate, { toValue: 0, friction: 7, tension: 40, useNativeDriver: false }),
            Animated.timing(likeStampOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
            Animated.timing(nopeStampOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),

            Animated.spring(midAnim.scale, { toValue: 0.94, friction: 7, tension: 40, useNativeDriver: false }),
            Animated.spring(midAnim.y, { toValue: -22, friction: 7, tension: 40, useNativeDriver: false }),
            Animated.timing(midAnim.dimmer, { toValue: 0.35, duration: 180, useNativeDriver: false }),

            Animated.spring(backAnim.scale, { toValue: 0.88, friction: 7, tension: 40, useNativeDriver: false }),
            Animated.spring(backAnim.y, { toValue: -42, friction: 7, tension: 40, useNativeDriver: false }),
            Animated.timing(backAnim.dimmer, { toValue: 0.65, duration: 180, useNativeDriver: false }),
          ]).start();
        },
        onPanResponderRelease: (_, gestureState) => {
          const swipeThreshold = 50;
          if (gestureState.dx > swipeThreshold || gestureState.dx < -swipeThreshold) {
            const isLike = gestureState.dx > 0;
            swipeProfile(isLike);
          } else {
            const [frontIdx, midIdx, backIdx] = profileSlotsRef.current;
            const frontAnim = profileCardAnims[frontIdx];
            const midAnim = profileCardAnims[midIdx];
            const backAnim = profileCardAnims[backIdx];

            Animated.parallel([
              Animated.spring(frontAnim.x, { toValue: 0, friction: 7, tension: 40, useNativeDriver: false }),
              Animated.spring(frontAnim.y, { toValue: 0, friction: 7, tension: 40, useNativeDriver: false }),
              Animated.spring(frontAnim.rotate, { toValue: 0, friction: 7, tension: 40, useNativeDriver: false }),
              Animated.timing(likeStampOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
              Animated.timing(nopeStampOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),

              Animated.spring(midAnim.scale, { toValue: 0.94, friction: 7, tension: 40, useNativeDriver: false }),
              Animated.spring(midAnim.y, { toValue: 8, friction: 7, tension: 40, useNativeDriver: false }),
              Animated.timing(midAnim.dimmer, { toValue: 0.35, duration: 180, useNativeDriver: false }),

              Animated.spring(backAnim.scale, { toValue: 0.88, friction: 7, tension: 40, useNativeDriver: false }),
              Animated.spring(backAnim.y, { toValue: 16, friction: 7, tension: 40, useNativeDriver: false }),
              Animated.timing(backAnim.dimmer, { toValue: 0.65, duration: 180, useNativeDriver: false }),
            ]).start();
          }
        },
      }),
    [profileCardAnims, swipeProfile, likeStampOpacity, nopeStampOpacity]
  );

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

  // ── 1. Living Ambient Aurora & Cursor Loops (native driver, paused under reduced motion) ──
  useEffect(() => {
    if (reduceMotion) {
      auroraFloat1.setValue(0);
      auroraScale1.setValue(1.0);
      auroraOpacity1.setValue(0.28);
      auroraFloat2.setValue(0);
      auroraScale2.setValue(1.05);
      auroraOpacity2.setValue(0.22);
      cursorOpacity.setValue(1);
      return undefined;
    }

    // Ambient Aurora Orb 1 Loop
    const aurora1 = Animated.loop(
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
    );

    // Ambient Aurora Orb 2 Loop
    const aurora2 = Animated.loop(
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
    );

    // Shimmering Cursor Blink Loop
    const cursorBlink = Animated.loop(
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
    );

    aurora1.start();
    aurora2.start();
    cursorBlink.start();
    return () => {
      aurora1.stop();
      aurora2.stop();
      cursorBlink.stop();
    };
  }, [reduceMotion]);

  // ── Static Mount: initial marquee loop + goal feedback timer cleanup ──
  useEffect(() => {
    // Infinite Smooth Non-Stop Marquee Slide Loop
    if (!reduceMotion) {
      Animated.loop(
        Animated.timing(marqueeAnim, {
          toValue: -TRACK_WIDTH,
          duration: 22000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }

    return () => {
      if (goalFeedbackTimer.current) clearTimeout(goalFeedbackTimer.current);
    };
  }, []);

  // ── Step 1: Infinite Smooth Non-Stop Marquee Slide Loop ──
  useEffect(() => {
    let anim;
    if (currentStep === 1 && !reduceMotion) {
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
  }, [currentStep, reduceMotion]);

  // ── 2. Executive Confirmation & Setup Readiness on Step 5 ──
  useEffect(() => {
    let sequenceAnim;

    if (currentStep === 5) {
      safeHaptic('medium');
      engineCardAnim.setValue(0);
      laserBeamAnim.setValue(0);

      // Reset profile deck slots & resting physics
      profileSlotsRef.current = [0, 1, 2];
      setActiveProfileIdx(0);
      setProfileZIndices([3, 2, 1]);
      isSwipingProfileRef.current = false;

      profileCardAnims[0].x.setValue(0);
      profileCardAnims[0].y.setValue(0);
      profileCardAnims[0].scale.setValue(1.0);
      profileCardAnims[0].rotate.setValue(0);
      profileCardAnims[0].opacity.setValue(1.0);
      profileCardAnims[0].dimmer.setValue(0.0);

      profileCardAnims[1].x.setValue(0);
      profileCardAnims[1].y.setValue(-22);
      profileCardAnims[1].scale.setValue(0.94);
      profileCardAnims[1].rotate.setValue(0);
      profileCardAnims[1].opacity.setValue(1.0);
      profileCardAnims[1].dimmer.setValue(0.35);

      profileCardAnims[2].x.setValue(0);
      profileCardAnims[2].y.setValue(-42);
      profileCardAnims[2].scale.setValue(0.88);
      profileCardAnims[2].rotate.setValue(0);
      profileCardAnims[2].opacity.setValue(1.0);
      profileCardAnims[2].dimmer.setValue(0.65);

      likeStampOpacity.setValue(0);
      nopeStampOpacity.setValue(0);

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

  // ── Native-Equivalent Multi-Stage Viewport Interpolations (Full Screen Width Slides) ──
  const step1TranslateX = stepIndexAnim.interpolate({
    inputRange: [1, 2, 3, 4, 5],
    outputRange: [0, -SCREEN_WIDTH * 0.35, -SCREEN_WIDTH * 0.7, -SCREEN_WIDTH, -SCREEN_WIDTH * 1.3],
    extrapolate: 'clamp',
  });
  const step1Opacity = stepIndexAnim.interpolate({
    inputRange: [1, 1.7, 2],
    outputRange: [1, 0.2, 0],
    extrapolate: 'clamp',
  });

  const step2TranslateX = stepIndexAnim.interpolate({
    inputRange: [1, 2, 3, 4, 5],
    outputRange: [SCREEN_WIDTH, 0, -SCREEN_WIDTH * 0.35, -SCREEN_WIDTH * 0.7, -SCREEN_WIDTH],
    extrapolate: 'clamp',
  });
  const step2Opacity = stepIndexAnim.interpolate({
    inputRange: [1, 1.3, 2, 2.7, 3],
    outputRange: [0, 0.2, 1, 0.2, 0],
    extrapolate: 'clamp',
  });

  const step3TranslateX = stepIndexAnim.interpolate({
    inputRange: [1, 2, 3, 4, 5],
    outputRange: [SCREEN_WIDTH * 2, SCREEN_WIDTH, 0, -SCREEN_WIDTH * 0.35, -SCREEN_WIDTH * 0.7],
    extrapolate: 'clamp',
  });
  const step3Opacity = stepIndexAnim.interpolate({
    inputRange: [2, 2.3, 3, 3.7, 4],
    outputRange: [0, 0.2, 1, 0.2, 0],
    extrapolate: 'clamp',
  });

  const step4TranslateX = stepIndexAnim.interpolate({
    inputRange: [1, 2, 3, 4, 5],
    outputRange: [SCREEN_WIDTH * 3, SCREEN_WIDTH * 2, SCREEN_WIDTH, 0, -SCREEN_WIDTH * 0.35],
    extrapolate: 'clamp',
  });
  const step4Opacity = stepIndexAnim.interpolate({
    inputRange: [3, 3.3, 4, 4.7, 5],
    outputRange: [0, 0.2, 1, 0.2, 0],
    extrapolate: 'clamp',
  });

  const step5TranslateX = stepIndexAnim.interpolate({
    inputRange: [1, 2, 3, 4, 5],
    outputRange: [SCREEN_WIDTH * 4, SCREEN_WIDTH * 3, SCREEN_WIDTH * 2, SCREEN_WIDTH, 0],
    extrapolate: 'clamp',
  });
  const step5Opacity = stepIndexAnim.interpolate({
    inputRange: [4, 4.4, 5],
    outputRange: [0, 0.2, 1],
    extrapolate: 'clamp',
  });

  // ── Native 60/120 FPS Step Transitions matching Landing Slide ──
  const transitionToStep = (newStep) => {
    safeHaptic('light');
    Keyboard.dismiss();
    trackingService.trackEvent('onboarding_step_completed', {
      from_step: currentStep,
      to_step: newStep,
    });
    setCurrentStep(newStep);

    Animated.timing(stepIndexAnim, {
      toValue: newStep,
      duration: reduceMotion ? 0 : 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
      useNativeDriver: true,
    }).start();
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
      const tz = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
      const onboardingData = {
        platform: selectedPlatform,
        country,
        languages: selectedLanguages,
        dialCode,
        whatsapp,
        goals: selectedGoals,
        frequency,
        personality,
        safeMode,
        device_os: Platform.OS,
        device_os_version: String(Platform.Version),
        timezone: tz || 'UTC',
        app_version: '1.0.0',
      };

      trackingService.trackEvent('onboarding_completed', {
        country,
        languages_count: selectedLanguages.length,
        goals: selectedGoals,
        personality,
        frequency,
        safeMode,
        timezone: tz || 'UTC',
      });

      try {
        AsyncStorage.setItem('@flint_onboarding_data', JSON.stringify(onboardingData)).catch(() => { });
        AsyncStorage.setItem('@flint_has_completed_onboarding', 'true').catch(() => { });
      } catch (_) { }

      navigation.dispatch(
        StackActions.push('Auth', {
          initialMode: 'signup',
          onboardingData,
          forceAuth: true,
        })
      );
    }
  };

  const handleBack = () => {
    safeHaptic('light');
    if (currentStep > 1) {
      transitionToStep(currentStep - 1);
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Auth');
      }
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

  const BLUEPRINT_DECK = useMemo(
    () => [
      {
        id: 'intentions',
        stepNumber: '01 / 03',
        category: 'YOUR DATING GOAL',
        icon: 'heart',
        iconColor: C.accent,
        title: goalsSummary.title,
        detail: goalsSummary.detail,
        suit: '♥',
        badgeBg: alpha(C.accent, 0.18),
        gradient: [C.elevatedHigh, C.surface],
        borderColor: C.primaryBorder,
        accentGlow: C.primary,
      },
      {
        id: 'vibe',
        stepNumber: '02 / 03',
        category: 'YOUR FLIRT STYLE',
        icon: 'sparkles',
        iconColor: currentPersonalityObj.accentColor,
        title: `${currentPersonalityObj.label} & Charming`,
        detail: 'Tailored opening lines and banter drafted in your authentic voice.',
        suit: '★',
        badgeBg: alpha(currentPersonalityObj.accentColor, 0.16),
        gradient: [C.elevatedHigh, C.surface],
        borderColor: alpha(currentPersonalityObj.accentColor, 0.34),
        accentGlow: currentPersonalityObj.accentColor,
      },
      {
        id: 'scene',
        stepNumber: '03 / 03',
        category: 'LOCAL DATING',
        icon: 'location-sharp',
        iconColor: C.success,
        title: `Made for ${country} ${getCountryFlag(country)}`,
        detail: 'Paced naturally to match how people actually connect in your city.',
        suit: '✦',
        badgeBg: C.successSoft,
        gradient: [C.elevatedHigh, C.surface],
        borderColor: C.successBorder,
        accentGlow: C.success,
      },
    ],
    [goalsSummary, currentPersonalityObj, country]
  );


  const currentMatch = PREVIEW_PROFILES[activeProfileIdx] || PREVIEW_PROFILES[1];
  const nextMatch = PREVIEW_PROFILES[(activeProfileIdx + 1) % PREVIEW_PROFILES.length];
  const thirdMatch = PREVIEW_PROFILES[(activeProfileIdx + 2) % PREVIEW_PROFILES.length];

  // ── Responsive layout (presentation only) ──
  // Step 5 is a non-scrolling swipe deck: size the cards to the space left between the chrome.
  const stageHeight = windowHeight - insets.top - insets.bottom - TOP_BAR_HEIGHT - FOOTER_HEIGHT;
  const step5Reserved = 292; // step header + game plan deck + deck peek/margins
  const deckCardHeight = Math.round(Math.max(280, Math.min(385, stageHeight - step5Reserved)));
  const deckCardWidth = Math.round(Math.min(315, contentWidth, deckCardHeight * 0.82));
  const step5NeedsScroll = stageHeight - step5Reserved < 280;
  const scrollPadding = { paddingHorizontal: gutter };
  const ctaLabel = currentStep === 1 ? 'Get Started' : currentStep === totalSteps ? 'Start Meeting Matches' : 'Continue';

  const renderLanguageChip = (lang) => {
    const isSelected = selectedLanguages.includes(lang);
    return (
      <Chip
        key={lang}
        label={lang}
        selected={isSelected}
        onPress={() => toggleLanguage(lang)}
        accessibilityLabel={`${lang}, ${isSelected ? 'selected' : 'not selected'}`}
      />
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── 1. Atmospheric Base Gradient ── */}
      <LinearGradient
        colors={[C.background, C.background, C.surface]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── 2. Living Ambient Aurora Orbs (Strictly Clipped Within Screen Boundary) ── */}
      <View style={styles.auroraClip} pointerEvents="none">
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
        >
          <LinearGradient
            colors={[alpha(C.primary, 0.4), alpha(C.accent, 0.28), alpha(C.secondary, 0.14), 'transparent']}
            locations={[0, 0.35, 0.7, 1]}
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
        >
          <LinearGradient
            colors={[alpha(C.info, 0.32), alpha(C.info, 0.2), alpha(C.primary, 0.14), 'transparent']}
            locations={[0, 0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.1, y: 0.2 }}
            end={{ x: 0.9, y: 0.8 }}
          />
        </Animated.View>
      </View>

      {/* ── 3. Subtle Vignette Scrim ── */}
      <LinearGradient
        colors={[alpha(C.background, 0.45), alpha(C.background, 0.78), C.background]}
        locations={[0, 0.45, 0.95]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea}>
        {/* ── Progress Header: back + step X of N + segmented bar ── */}
        <View style={[styles.topBar, scrollPadding]}>
          <View style={styles.topBarInner}>
            <IconButton
              icon="chevron-back"
              onPress={handleBack}
              accessibilityLabel={currentStep === 1 ? 'Return to Welcome' : 'Go back'}
            />
            <View style={styles.progressCol}>
              <View style={styles.progressLabelRow}>
                <ContentTransition transitionKey={currentStep}>
                  <Text style={styles.progressLabel} maxFontSizeMultiplier={uiTheme.fontScale.chrome} numberOfLines={1}>
                    {`STEP ${currentStep} OF ${totalSteps}`}
                  </Text>
                </ContentTransition>
                <Text style={styles.progressStepName} maxFontSizeMultiplier={uiTheme.fontScale.chrome} numberOfLines={1}>
                  {STEP_EYEBROWS[currentStep - 1]}
                </Text>
              </View>
              <View
                style={styles.progressTrack}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`Step ${currentStep} of ${totalSteps}`}
                accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
              >
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.progressSegment, i < currentStep - 1 && styles.progressSegmentDone]}
                  >
                    {i === currentStep - 1 && (
                      <LinearGradient
                        colors={uiTheme.gradients.brandShort}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ── Animated Step Viewport ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <View style={styles.stageViewport}>
            {/* ── Step 1 Stage Layer ── */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [{ translateX: step1TranslateX }],
                  opacity: step1Opacity,
                },
              ]}
              pointerEvents={currentStep === 1 ? 'auto' : 'none'}
            >
              <ScrollView
                style={styles.scrollFlex}
                contentContainerStyle={[styles.scrollContent, scrollPadding]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.columnWide}>
                  <StepHeader
                    eyebrow={STEP_EYEBROWS[0]}
                    title="Better Dates, Less Effort"
                    subtitle="Flint finds people you'll actually like, sparks natural conversations, and helps you meet up in real life."
                  />

                  {/* Non-Stop Smooth Sliding Cards Showcase */}
                  <View style={[styles.marqueeSectionWrap, { marginHorizontal: -gutter }]}>
                    <View style={styles.marqueeWindow}>
                      <Animated.View
                        style={[
                          styles.marqueeTrack,
                          { paddingLeft: gutter, transform: [{ translateX: marqueeAnim }] },
                        ]}
                      >
                        {DISPLAY_CARDS.map((card, idx) => (
                          <View key={`${card.id}-${idx}`} style={styles.cockpitCardContainer}>
                            <LinearGradient
                              colors={[alpha(C.primary, 0.12), C.surface, C.surface]}
                              locations={[0, 0.55, 1]}
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
                                    <Text style={styles.cockpitProfileName} numberOfLines={1}>{card.name}</Text>
                                    <Ionicons name="checkmark-circle" size={14} color={C.success} />
                                  </View>
                                  <Text style={styles.cockpitProfileSub} numberOfLines={1}>
                                    {card.sub}
                                  </Text>
                                </View>

                                <View style={styles.cockpitScoreWrap}>
                                  <Ionicons name="sparkles" size={13} color={C.success} />
                                  <Text style={styles.cockpitScoreText} numberOfLines={1}>{card.matchScore}</Text>
                                </View>
                              </View>

                              {/* Hairline Divider */}
                              <View style={styles.cockpitHairline} />

                              {/* Simulated Real-Time Opener Box */}
                              <View style={styles.cockpitOpenerBox}>
                                <View style={styles.cockpitOpenerHeader}>
                                  <Ionicons name="chatbubble-outline" size={12} color={C.info} />
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
                                  <View key={tIdx} style={styles.cockpitFooterItem}>
                                    <Ionicons name={tag.icon} size={12} color={tag.color} />
                                    <Text style={styles.cockpitFooterItemText} numberOfLines={1}>{tag.label}</Text>
                                  </View>
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
                      <IconWell icon="compass-outline" tone="primary" size={44} iconSize={20} />
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Quality Matches</Text>
                        <Text style={styles.featureDesc}>
                          Only connects you with people who share your vibe, lifestyle, and interests.
                        </Text>
                      </View>
                    </View>

                    {/* Pillar 2: Thoughtful Icebreakers */}
                    <View style={styles.featureRow}>
                      <IconWell icon="chatbubble-ellipses-outline" tone="info" size={44} iconSize={20} />
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Thoughtful Icebreakers</Text>
                        <Text style={styles.featureDesc}>
                          Starts chats with natural lines based on what they genuinely love in their bio.
                        </Text>
                      </View>
                    </View>

                    {/* Pillar 3: Real-World Dates */}
                    <View style={styles.featureRow}>
                      <IconWell icon="calendar-outline" tone="secondary" size={44} iconSize={20} />
                      <View style={styles.featureInfo}>
                        <Text style={styles.featureTitle}>Real-World Dates</Text>
                        <Text style={styles.featureDesc}>
                          Moves past endless small talk so you can comfortably exchange numbers and meet up.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>

            {/* ── Step 2 Stage Layer ── */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.stageShadowLayer,
                {
                  transform: [{ translateX: step2TranslateX }],
                  opacity: step2Opacity,
                },
              ]}
              pointerEvents={currentStep === 2 ? 'auto' : 'none'}
            >
              <ScrollView
                style={styles.scrollFlex}
                contentContainerStyle={[styles.scrollContent, scrollPadding]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.columnForm}>
                  <StepHeader
                    eyebrow={STEP_EYEBROWS[1]}
                    title="About you"
                    subtitle="Flint adapts your conversation tone and references so chats feel completely natural in your area."
                  />

                  {/* Regional Dating Context Card */}
                  <View style={styles.card}>
                    {/* Sub-section 1: Where you date */}
                    <SectionHead
                      icon="location-sharp"
                      tone="primary"
                      title="Where you date"
                      subtitle="Matches your city, timezone & local slang"
                      right={<Badge label={dialCode} tone="primary" />}
                    />

                    <Text style={styles.fieldLabel}>Country</Text>
                    <TouchableOpacity
                      style={styles.selectField}
                      onPress={() => {
                        safeHaptic('light');
                        setCountrySearch('');
                        setCountryModalVisible(true);
                      }}
                      activeOpacity={0.82}
                      accessibilityRole="button"
                      accessibilityLabel={`Country selector, currently selected: ${country}`}
                      accessibilityHint="Opens the country list"
                    >
                      <View style={styles.flagDisk}>
                        <Text style={styles.flagEmoji}>{getCountryFlag(country)}</Text>
                      </View>
                      <Text style={styles.selectFieldText} numberOfLines={1}>{country}</Text>
                      <Ionicons name="chevron-down" size={18} color={C.muted} />
                    </TouchableOpacity>

                    {/* Hairline Divider */}
                    <View style={styles.cardDivider} />

                    {/* Sub-section 2: Languages you speak */}
                    <SectionHead
                      icon="chatbubbles"
                      tone="info"
                      title="Languages you speak"
                      subtitle="Flint crafts native openers in these languages"
                      right={<Badge label={`${selectedLanguages.length} selected`} tone="info" />}
                    />

                    {/* Compact Primary Chips (Top 3 Regional + Active) + Inline Expand Pill */}
                    <View style={styles.chipWrap}>
                      {primaryLanguages.map(renderLanguageChip)}

                      {hiddenLanguagesCount > 0 && (
                        <TouchableOpacity
                          style={styles.moreChip}
                          onPress={handleToggleLanguagesExpand}
                          activeOpacity={0.75}
                          hitSlop={{ top: 4, bottom: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={showAllLanguages ? 'Show fewer languages' : 'Show more languages'}
                          accessibilityState={{ expanded: showAllLanguages }}
                        >
                          <Text style={styles.moreChipText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
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
                            <Ionicons name="chevron-down" size={14} color={C.secondary} />
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
                      <View style={styles.chipWrapSecondary}>
                        {secondaryLanguages.map(renderLanguageChip)}
                      </View>
                    </Animated.View>
                  </View>

                  {/* Instant Date Alerts Card */}
                  <View style={styles.card}>
                    <SectionHead
                      icon="logo-whatsapp"
                      tone="success"
                      title="Instant Date Alerts"
                      subtitle="Get a private ping when a match wants to meet up"
                      right={<Badge label="VIP Alerts" tone="success" />}
                    />

                    <Text style={styles.fieldLabel}>WhatsApp number</Text>
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
                        <Ionicons name="chevron-down" size={14} color={C.muted} />
                      </TouchableOpacity>
                      <View style={styles.dialDivider} />
                      <TextInput
                        style={styles.phoneInput}
                        placeholder={currentPhoneExample}
                        placeholderTextColor={C.muted}
                        selectionColor={C.accent}
                        cursorColor={C.accent}
                        maxFontSizeMultiplier={uiTheme.fontScale.chrome}
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
                          style={styles.inputIconBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Clear phone number"
                        >
                          <Ionicons name="close-circle" size={18} color={C.muted} />
                        </TouchableOpacity>
                      )}
                      {Boolean(whatsapp && !isPhoneTooShort) && (
                        <Ionicons name="checkmark-circle" size={18} color={C.success} />
                      )}
                    </View>

                    {isPhoneTooShort ? (
                      <View style={styles.phoneFeedbackRow} accessibilityLiveRegion="polite">
                        <Ionicons name="alert-circle" size={14} color={C.error} />
                        <Text style={[styles.helperText, styles.helperTextError]}>
                          Number looks too short for {dialCode} (min {minPhoneLength} digits)
                        </Text>
                      </View>
                    ) : Boolean(whatsapp && !isPhoneTooShort) ? (
                      <View style={styles.phoneFeedbackRow} accessibilityLiveRegion="polite">
                        <Ionicons name="checkmark-circle" size={14} color={C.success} />
                        <Text style={[styles.helperText, styles.helperTextSuccess]}>
                          Alerts active • Stored on your device only • Never shared
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.phoneFeedbackRow}>
                        <Ionicons name="shield-checkmark" size={14} color={C.success} />
                        <Text style={styles.helperText}>
                          Optional • Stored on your device only • Never shared
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </ScrollView>
            </Animated.View>

            {/* ── Step 3 Stage Layer ── */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.stageShadowLayer,
                {
                  transform: [{ translateX: step3TranslateX }],
                  opacity: step3Opacity,
                },
              ]}
              pointerEvents={currentStep === 3 ? 'auto' : 'none'}
            >
              <ScrollView
                style={styles.scrollFlex}
                contentContainerStyle={[styles.scrollContent, scrollPadding]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.columnForm}>
                  <StepHeader eyebrow={STEP_EYEBROWS[2]} title="What's Your Goal?">
                    <View style={styles.goalSubtitleRow}>
                      <Text style={[styles.stepSubtitle, styles.flexShrink]}>
                        {selectedGoals.includes('never_stop')
                          ? 'Relaxed chat mode is active.'
                          : "Pick up to 3 things you'd like from your matches."}
                      </Text>
                      <Animated.View style={{ transform: [{ scale: counterPulse }] }}>
                        <Badge
                          icon={selectedGoals.includes('never_stop') ? 'infinite' : 'checkmark-circle'}
                          tone={selectedGoals.includes('never_stop') ? 'info' : 'primary'}
                          label={selectedGoals.includes('never_stop')
                            ? 'Casual Chat'
                            : `${selectedGoals.length} of 3 chosen`}
                        />
                      </Animated.View>
                    </View>
                  </StepHeader>

                  {Boolean(goalFeedback) && (
                    <View style={styles.goalFeedbackBanner} accessibilityLiveRegion="polite" accessibilityRole="alert">
                      <Ionicons name="information-circle" size={16} color={C.secondary} />
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
                  <View style={[styles.card, styles.strategyCard]}>
                    <View style={styles.strategyHeaderRow}>
                      <IconWell icon="sparkles" tone="secondary" size={28} iconSize={14} />
                      <Text style={styles.strategyHeaderTitle} numberOfLines={1}>How Flint will help you</Text>
                      <Badge label="Your Game Plan" tone="secondary" />
                    </View>
                    <Animated.Text style={[styles.strategySummaryText, { opacity: strategyFadeAnim }]}>
                      {strategyText}
                    </Animated.Text>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>

            {/* ── Step 4 Stage Layer ── */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.stageShadowLayer,
                {
                  transform: [{ translateX: step4TranslateX }],
                  opacity: step4Opacity,
                },
              ]}
              pointerEvents={currentStep === 4 ? 'auto' : 'none'}
            >
              <ScrollView
                style={styles.scrollFlex}
                contentContainerStyle={[styles.scrollContent, scrollPadding]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.columnForm}>
                  <StepHeader
                    eyebrow={STEP_EYEBROWS[3]}
                    title="Behavior & Style"
                    subtitle="Fine-tune how Flint talks and how actively he replies for you."
                  />

                  {/* Unified Settings Card */}
                  <View style={styles.card}>
                    {/* Sub-section 1: Conversation Tone & Personality */}
                    <SectionHead
                      icon="sparkles"
                      tone="info"
                      title="Conversation Tone"
                      subtitle="Tap any tone to hear Flint's opening style"
                    />

                    {/* Smooth Horizontal Smart Tone Rail (All 10 Personalities, Zero Clutter) */}
                    <ScrollView
                      ref={toneScrollRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.toneScroll}
                      contentContainerStyle={styles.toneScrollTrack}
                    >
                      {PERSONALITIES.map((p) => (
                        <Chip
                          key={p.id}
                          label={p.label}
                          icon={p.icon}
                          selected={personality === p.id}
                          onPress={() => handleSelectPersonality(p.id)}
                          accessibilityLabel={`${p.label} personality mode`}
                        />
                      ))}
                    </ScrollView>

                    {/* Live "Voice of Flint" Preview with Real-Time Typing Animation */}
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
                      style={styles.voicePreview}
                      accessibilityRole="button"
                      accessibilityLabel="Voice of Flint preview. Tap to reveal full message"
                    >
                      <View style={styles.voiceHeaderRow}>
                        <View style={styles.voiceHeaderLeft}>
                          <View style={[styles.voiceIconDisk, { backgroundColor: alpha(currentPersonalityObj.accentColor, 0.16), borderColor: alpha(currentPersonalityObj.accentColor, 0.34) }]}>
                            <Ionicons name="chatbubble-ellipses" size={12} color={currentPersonalityObj.accentColor} />
                          </View>
                          <Text style={styles.voiceHeaderTitle} numberOfLines={1}>Voice of Flint</Text>
                          <View style={styles.voiceLiveBeaconRow}>
                            <View style={[styles.voiceLiveDot, { backgroundColor: currentPersonalityObj.accentColor }]} />
                            <Text style={[styles.voiceLiveText, { color: currentPersonalityObj.accentColor }]} numberOfLines={1}>
                              {isDrafting ? 'Drafting...' : isTypingOpener ? 'Typing...' : 'Live Preview'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.voiceTagBadge, { borderColor: alpha(currentPersonalityObj.accentColor, 0.34), backgroundColor: alpha(currentPersonalityObj.accentColor, 0.14) }]}>
                          <Text style={[styles.voiceTagBadgeText, { color: currentPersonalityObj.accentColor }]} numberOfLines={1}>
                            {currentPersonalityObj.tagline}
                          </Text>
                        </View>
                      </View>

                      {/* Outgoing chat bubble (Flint's message) */}
                      <View style={styles.voiceBubble}>
                        <LinearGradient
                          colors={uiTheme.gradients.brandShort}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        {isDrafting ? (
                          <View style={styles.voiceDraftingRow}>
                            <View style={styles.typingDotsRow}>
                              <Animated.View style={[styles.typingDot, { transform: [{ translateY: typingDot1 }] }]} />
                              <Animated.View style={[styles.typingDot, { transform: [{ translateY: typingDot2 }] }]} />
                              <Animated.View style={[styles.typingDot, { transform: [{ translateY: typingDot3 }] }]} />
                            </View>
                            <Text style={styles.voiceDraftingText}>Flint is tailoring an opener...</Text>
                          </View>
                        ) : (
                          <Text style={styles.voiceOpenerText}>
                            "{typedOpener}
                            {isTypingOpener && (
                              <Animated.Text style={[styles.voiceCursor, { opacity: voiceCursorOpacity }]}>
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
                    </TouchableOpacity>

                    {/* Hairline Divider */}
                    <View style={styles.cardDivider} />

                    {/* Sub-section 2: Reply Speed (Intelligent Cadence Bar) */}
                    <SectionHead
                      icon="timer"
                      tone="primary"
                      title="Reply Speed"
                      subtitle="How often Flint checks for new matches and replies"
                    />

                    {/* Segmented Cadence Track with Smooth Animated Slider */}
                    <View
                      style={styles.cadenceSegmentTrack}
                      onLayout={(e) => setCadenceTrackWidth(e.nativeEvent.layout.width)}
                      accessibilityRole="radiogroup"
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
                        />
                      )}

                      {FREQUENCIES.map((freq) => {
                        const isSelected = frequency === freq.value;
                        return (
                          <TouchableOpacity
                            key={freq.value}
                            style={styles.cadenceSegmentBtn}
                            onPress={() => handleSelectFrequency(freq.value)}
                            activeOpacity={0.85}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected, checked: isSelected }}
                            accessibilityLabel={`${freq.label}, ${freq.time}, ${freq.sub}`}
                          >
                            <View style={styles.cadenceSegmentTop}>
                              <Ionicons
                                name={freq.icon}
                                size={13}
                                color={isSelected ? C.accent : C.muted}
                              />
                              <Text
                                style={[styles.cadenceSegmentLabel, isSelected && styles.cadenceSegmentLabelActive]}
                                numberOfLines={1}
                                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                              >
                                {freq.label}
                              </Text>
                            </View>
                            <Text
                              style={[styles.cadenceTimeText, isSelected && styles.cadenceTimeTextActive]}
                              numberOfLines={1}
                              maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                            >
                              {freq.time}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Live Dynamic Cadence Insight */}
                    <Animated.View style={[styles.cadenceInsightRow, { opacity: cadenceFadeAnim }]}>
                      <View style={styles.cadenceInsightDot} />
                      <Text style={styles.cadenceInsightText} numberOfLines={2}>
                        {currentFreqObj.insight}
                      </Text>
                    </Animated.View>

                    {/* Hairline Divider */}
                    <View style={styles.cardDivider} />

                    {/* Sub-section 3: Smart Protection */}
                    <SectionHead
                      icon={safeMode ? 'shield-checkmark' : 'shield-outline'}
                      tone="success"
                      dimmed={!safeMode}
                      title="Smart Protection"
                      subtitle={safeMode
                        ? 'Mimics natural human texting habits to keep your account safe'
                        : 'Instant mode: Replies send immediately with zero delay (testing)'}
                      right={
                        <Switch
                          value={safeMode}
                          onValueChange={(val) => {
                            safeHaptic('medium');
                            setSafeMode(val);
                          }}
                          trackColor={{ false: C.elevatedHigh, true: C.success }}
                          thumbColor={C.white}
                          ios_backgroundColor={C.elevatedHigh}
                          accessibilityLabel="Smart Protection"
                        />
                      }
                    />

                    {/* 3-Pillar Security Matrix */}
                    <View style={[styles.shieldMatrixRow, !safeMode && styles.shieldMatrixRowDimmed]}>
                      {[
                        { icon: 'time', title: 'Natural Typing', sub: '2–5s human delay' },
                        { icon: 'moon', title: 'Night Rest', sub: 'Natural sleep hours' },
                        { icon: 'shield-checkmark', title: 'Safe Pace', sub: 'Within daily limits' },
                      ].map((pillar) => (
                        <View key={pillar.title} style={[styles.shieldPillarCard, !safeMode && styles.shieldPillarCardDimmed]}>
                          <View style={styles.shieldPillarTop}>
                            <Ionicons name={pillar.icon} size={13} color={safeMode ? C.success : C.muted} />
                            <Text numberOfLines={1} style={[styles.shieldPillarTitle, !safeMode && styles.shieldPillarTitleDimmed]}>
                              {pillar.title}
                            </Text>
                          </View>
                          <Text numberOfLines={2} style={styles.shieldPillarSub}>
                            {pillar.sub}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>

            {/* ── Step 5 Stage Layer ── */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                styles.stageShadowLayer,
                {
                  transform: [{ translateX: step5TranslateX }],
                  opacity: step5Opacity,
                },
              ]}
              pointerEvents={currentStep === 5 ? 'auto' : 'none'}
            >
              <ScrollView
                style={styles.scrollFlex}
                contentContainerStyle={[styles.scrollContent, styles.scrollContentStep5, scrollPadding]}
                scrollEnabled={step5NeedsScroll}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.columnWide, styles.step5Container]}>
                  <StepHeader
                    eyebrow={STEP_EYEBROWS[4]}
                    title="Ready to Match"
                    subtitle={`${currentMatch.name.split(',')[0]} is waiting in your deck · Flint is live & drafting`}
                    subtitleLines={2}
                  />

                  {/* ── Dating Deck: Physical 3-Card Stack Loop (Zoom-In & Dim-to-Bright) ── */}
                  <View style={[styles.deckStackWrap, { height: deckCardHeight + 26 }]}>
                    {PREVIEW_PROFILES.map((profile, profileIdx) => {
                      const anim = profileCardAnims[profileIdx];
                      const isFront = profileSlotsRef.current[0] === profileIdx;
                      const zIdx = profileZIndices[profileIdx];

                      const rotateDeg = anim.rotate.interpolate({
                        inputRange: [-360, 360],
                        outputRange: ['-360deg', '360deg'],
                      });

                      return (
                        <Animated.View
                          key={profile.id}
                          {...(isFront ? panResponder.panHandlers : {})}
                          pointerEvents={isFront ? 'auto' : 'none'}
                          accessibilityLabel={isFront ? `${profile.name}. ${profile.sub}. Swipe left or right to see the next profile.` : undefined}
                          style={[
                            styles.heroMatchCard,
                            {
                              width: deckCardWidth,
                              height: deckCardHeight,
                              position: 'absolute',
                              zIndex: zIdx,
                              elevation: zIdx * 4,
                              opacity: anim.opacity,
                              transform: [
                                { translateX: anim.x },
                                { translateY: anim.y },
                                { rotate: rotateDeg },
                                { scale: anim.scale },
                              ],
                            },
                          ]}
                        >
                          {/* Full-Bleed Profile Photo with Natural Face Framing */}
                          <Image
                            source={profile.image}
                            style={styles.heroProfileImage}
                            resizeMode="cover"
                          />

                          {/* Top Vignette Gradient for Badges */}
                          <LinearGradient
                            colors={[alpha(C.background, 0.65), 'transparent']}
                            style={styles.heroTopScrim}
                          />

                          {/* Top Floating Badges Row */}
                          <View style={styles.heroTopBadgesRow}>
                            <View style={styles.heroCompatibilityBadge}>
                              <Ionicons name="flame" size={13} color={C.accent} />
                              <Text style={styles.heroCompatibilityText} numberOfLines={1}>{profile.matchScore || '98% Match'}</Text>
                            </View>
                            {isFront && (
                              <View style={styles.heroSwipeHintBadge}>
                                <Ionicons name="swap-horizontal" size={12} color={alpha(C.white, 0.8)} />
                                <Text style={styles.heroSwipeHintText} numberOfLines={1}>Swipe card</Text>
                              </View>
                            )}
                          </View>

                          {/* LIKE Stamp (reveals on drag right, front card only) */}
                          {isFront && (
                            <Animated.View style={[styles.stampLikeWrap, { opacity: likeStampOpacity }]} pointerEvents="none">
                              <View style={[styles.stampBorder, styles.stampLikeBorder]}>
                                <Text style={[styles.stampText, styles.stampLikeText]}>LIKE</Text>
                              </View>
                            </Animated.View>
                          )}

                          {/* NOPE Stamp (reveals on drag left, front card only) */}
                          {isFront && (
                            <Animated.View style={[styles.stampNopeWrap, { opacity: nopeStampOpacity }]} pointerEvents="none">
                              <View style={[styles.stampBorder, styles.stampNopeBorder]}>
                                <Text style={[styles.stampText, styles.stampNopeText]}>NOPE</Text>
                              </View>
                            </Animated.View>
                          )}

                          {/* ── Frosted Gradient Bottom Dock ── */}
                          <LinearGradient
                            colors={['transparent', alpha(C.background, 0.72), alpha(C.background, 0.96)]}
                            locations={[0, 0.32, 1]}
                            style={styles.heroFrostedDock}
                          >
                            <View style={styles.heroDockHeader}>
                              <View style={styles.heroIdentityCol}>
                                <View style={styles.heroNameRow}>
                                  <Text style={styles.heroNameText} numberOfLines={1}>{profile.name}</Text>
                                  <Ionicons name="checkmark-circle" size={16} color={C.success} />
                                </View>
                                <Text style={styles.heroLocationText} numberOfLines={1}>
                                  {profile.sub.split('&')[0].trim()} · 2 miles away
                                </Text>
                              </View>

                              {isFront && (
                                <IconButton
                                  icon="refresh"
                                  size={36}
                                  iconSize={16}
                                  variant="plain"
                                  color={C.secondary}
                                  style={styles.shuffleCircleBtn}
                                  onPress={() => {
                                    safeHaptic('light');
                                    setCardOpenerIndex((prev) => prev + 1);
                                  }}
                                  accessibilityLabel="Shuffle opener"
                                />
                              )}
                            </View>

                            {/* AI Wingman Icebreaker Pill */}
                            <View style={styles.icebreakerPill}>
                              <View style={styles.icebreakerHeaderRow}>
                                <Ionicons name="sparkles" size={12} color={currentPersonalityObj.accentColor} />
                                <Text style={[styles.icebreakerTag, { color: currentPersonalityObj.accentColor }]} numberOfLines={1}>
                                  Flint Icebreaker · {currentPersonalityObj.label}
                                </Text>
                              </View>
                              <Text style={styles.icebreakerQuoteText} numberOfLines={2}>
                                "{getPersonalizedOpener(profile.id, personality, cardOpenerIndex)}"
                              </Text>
                            </View>
                          </LinearGradient>

                          {/* ── Dimmer Overlay: dims 2nd & 3rd cards, un-dimming to bright on zoom-in ── */}
                          <Animated.View
                            style={[
                              StyleSheet.absoluteFillObject,
                              { backgroundColor: C.background, opacity: anim.dimmer },
                            ]}
                            pointerEvents="none"
                          />
                        </Animated.View>
                      );
                    })}
                  </View>

                  {/* ── Match Blueprint Playing Cards Stack Carousel ── */}
                  <View style={styles.blueprintDeckSection}>
                    {/* Header Row: Title + Card Deck Pips + Tap to Cycle Hint */}
                    <View style={styles.blueprintDeckHeader}>
                      <View style={styles.blueprintHeaderLeft}>
                        <Ionicons name="sparkles" size={14} color={C.accent} />
                        <Text style={styles.blueprintDeckTitle} numberOfLines={1} accessibilityRole="header">Your Dating Game Plan</Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={cycleBlueprintCard}
                        style={styles.blueprintCycleHintBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Cycle blueprint card"
                      >
                        <Text style={styles.blueprintCycleHintText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>Tap to cycle</Text>
                        <Ionicons name="refresh" size={12} color={C.secondary} />
                        <View style={styles.blueprintPipsRow}>
                          {[0, 1, 2].map((idx) => (
                            <View
                              key={idx}
                              style={[
                                styles.blueprintPip,
                                activeBlueprintIdx === idx && styles.blueprintPipActive,
                              ]}
                            />
                          ))}
                        </View>
                      </TouchableOpacity>
                    </View>

                    {/* Interactive Stack of Playing Cards (Native-Driven Slot Physics) */}
                    <TouchableOpacity
                      activeOpacity={0.92}
                      onPress={cycleBlueprintCard}
                      style={styles.blueprintCardsWrap}
                      accessibilityRole="button"
                      accessibilityLabel="Blueprint card stack. Tap to cycle next card."
                    >
                      {BLUEPRINT_DECK.map((card, idx) => {
                        const anim = bpCardAnims[idx];
                        const isFront = bpSlotsRef.current[0] === idx;
                        const rotateDeg = anim.rotate.interpolate({
                          inputRange: [-10, 10],
                          outputRange: ['-10deg', '10deg'],
                        });

                        return (
                          <Animated.View
                            key={card.id}
                            style={[
                              styles.blueprintCardSingle,
                              {
                                zIndex: bpZIndices[idx],
                                opacity: anim.opacity,
                                transform: [
                                  { translateX: anim.x },
                                  { translateY: anim.y },
                                  { scale: anim.scale },
                                  { rotate: rotateDeg },
                                ],
                              },
                            ]}
                          >
                            <LinearGradient
                              colors={card.gradient}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={[styles.blueprintCardGradient, { borderColor: card.borderColor }]}
                            >
                              <View style={styles.blueprintCardTopRow}>
                                <View style={[styles.blueprintCardBadge, { backgroundColor: card.badgeBg }]}>
                                  <Ionicons name={card.icon} size={12} color={card.iconColor} />
                                  <Text style={[styles.blueprintCardBadgeText, { color: card.iconColor }]} numberOfLines={1}>
                                    {card.category}
                                  </Text>
                                </View>
                                <View style={styles.blueprintCardRightTag}>
                                  <Text style={styles.blueprintSuitPill}>{card.suit} {card.stepNumber}</Text>

                                </View>
                              </View>
                              <Text style={styles.blueprintCardTitle} numberOfLines={1}>{card.title}</Text>
                              <Text style={styles.blueprintCardDetail} numberOfLines={1}>{card.detail}</Text>
                            </LinearGradient>
                          </Animated.View>
                        );
                      })}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>

        {/* ── Sticky Bottom Footer with Primary CTA ── */}
        <View style={[styles.footer, scrollPadding]}>
          <View style={styles.footerInner}>
            <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
              <AppButton
                title={ctaLabel}
                iconRight={currentStep === totalSteps ? 'flame' : 'chevron-forward'}
                onPress={handleNext}
                onPressIn={handleBtnPressIn}
                onPressOut={handleBtnPressOut}
                haptic={false}
                accessibilityLabel={ctaLabel}
              />
            </Animated.View>

            {/* ── Fixed-Height Footer Sub-Slot (Keeps the CTA locked in place across all steps) ── */}
            <ContentTransition transitionKey={currentStep} style={styles.footerSubSlot}>
              {currentStep === 1 && (
                <View style={styles.ctaReassuranceRow}>
                  <Ionicons name="shield-checkmark" size={13} color={C.muted} />
                  <Text style={styles.ctaReassuranceText} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    Takes under 60 seconds • Completely private
                  </Text>
                </View>
              )}

              {currentStep > 1 && currentStep < totalSteps && (
                <View style={styles.ctaReassuranceRow}>
                  <Ionicons name="shield-checkmark" size={13} color={C.muted} />
                  <Text style={styles.ctaReassuranceText} numberOfLines={1} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    Encrypted & private • Change anytime
                  </Text>
                </View>
              )}

              {currentStep === totalSteps && (
                <TouchableOpacity
                  style={styles.signInFooterBtn}
                  onPress={() => {
                    safeHaptic('light');
                    navigation.dispatch(
                      StackActions.push('Auth', {
                        initialMode: 'login',
                        forceAuth: true,
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
                      })
                    );
                  }}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6, left: 16, right: 16 }}
                  accessibilityRole="button"
                  accessibilityLabel="Already have an account? Sign In"
                >
                  <Text style={styles.signInFooterText} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
                    Already have an account?{' '}
                    <Text style={styles.signInFooterHighlight}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </ContentTransition>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Country Picker Sheet ── */}
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close country selector"
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setCountrySearch('');
              setCountryModalVisible(false);
            }}
          />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, SP.lg) }]} accessibilityViewIsModal>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <IconWell icon="location-sharp" tone="primary" size={40} iconSize={18} />
                <View style={styles.modalHeaderTitleGroup}>
                  <Text style={styles.modalTitle} accessibilityRole="header" numberOfLines={1}>Select Country</Text>
                  <Text style={styles.modalSub} numberOfLines={2}>Matches your city, timezone & local slang</Text>
                </View>
              </View>
              <IconButton
                icon="close"
                size={40}
                iconSize={18}
                onPress={() => {
                  safeHaptic('light');
                  Keyboard.dismiss();
                  setCountrySearch('');
                  setCountryModalVisible(false);
                }}
                accessibilityLabel="Close country selector"
              />
            </View>

            {/* Search Field */}
            <View
              style={[
                styles.modalSearchWrap,
                isCountrySearchFocused && styles.modalSearchWrapFocused,
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={isCountrySearchFocused ? C.accent : C.muted}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search 95+ countries..."
                placeholderTextColor={C.muted}
                selectionColor={C.accent}
                cursorColor={C.accent}
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                value={countrySearch}
                onChangeText={setCountrySearch}
                onFocus={() => setIsCountrySearchFocused(true)}
                onBlur={() => setIsCountrySearchFocused(false)}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search countries"
              />
              {Boolean(countrySearch) && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => {
                    safeHaptic('light');
                    setCountrySearch('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.inputIconBtn}
                >
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              )}
              <Badge label={String(filteredCountries.length)} tone="neutral" />
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              initialNumToRender={20}
              maxToRenderPerBatch={25}
              windowSize={10}
              ItemSeparatorComponent={() => <View style={styles.modalHairline} />}
              ListEmptyComponent={
                <View style={styles.modalEmptyWrap}>
                  <Ionicons name="search-outline" size={28} color={C.muted} />
                  <Text style={styles.modalEmptyTitle}>No countries found</Text>
                  <Text style={styles.modalEmptySub}>Try a different spelling or name</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = country === item;
                const matchDial = DIAL_CODES.find((d) => d.name === item)?.dial;
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={matchDial ? `${item}, ${matchDial}` : item}
                    accessibilityState={{ selected: isSelected }}
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
                        <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Dial Code Picker Sheet ── */}
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close dial code selector"
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setDialSearch('');
              setDialModalVisible(false);
            }}
          />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, SP.lg) }]} accessibilityViewIsModal>
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <IconWell icon="call" tone="success" size={40} iconSize={18} />
                <View style={styles.modalHeaderTitleGroup}>
                  <Text style={styles.modalTitle} accessibilityRole="header" numberOfLines={1}>Country Dial Code</Text>
                  <Text style={styles.modalSub} numberOfLines={2}>Select prefix for instant date alerts</Text>
                </View>
              </View>
              <IconButton
                icon="close"
                size={40}
                iconSize={18}
                onPress={() => {
                  safeHaptic('light');
                  Keyboard.dismiss();
                  setDialSearch('');
                  setDialModalVisible(false);
                }}
                accessibilityLabel="Close dial code selector"
              />
            </View>

            {/* Search Field */}
            <View
              style={[
                styles.modalSearchWrap,
                isDialSearchFocused && styles.modalSearchWrapFocused,
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={isDialSearchFocused ? C.accent : C.muted}
              />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search country or dial code..."
                placeholderTextColor={C.muted}
                selectionColor={C.accent}
                cursorColor={C.accent}
                maxFontSizeMultiplier={uiTheme.fontScale.chrome}
                value={dialSearch}
                onChangeText={setDialSearch}
                onFocus={() => setIsDialSearchFocused(true)}
                onBlur={() => setIsDialSearchFocused(false)}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search dial codes"
              />
              {Boolean(dialSearch) && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => {
                    safeHaptic('light');
                    setDialSearch('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.inputIconBtn}
                >
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              )}
              <Badge label={String(filteredDialCodes.length)} tone="neutral" />
            </View>

            <FlatList
              data={filteredDialCodes}
              keyExtractor={(item) => `${item.code}-${item.dial}`}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              initialNumToRender={20}
              maxToRenderPerBatch={25}
              windowSize={10}
              ItemSeparatorComponent={() => <View style={styles.modalHairline} />}
              ListEmptyComponent={
                <View style={styles.modalEmptyWrap}>
                  <Ionicons name="search-outline" size={28} color={C.muted} />
                  <Text style={styles.modalEmptyTitle}>No dial codes found</Text>
                  <Text style={styles.modalEmptySub}>Try searching by country or dial prefix</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = dialCode === item.dial && (country === item.name || !DIAL_CODES.some(d => d.dial === item.dial && d.name === country));
                return (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${item.dial}`}
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.modalListItem,
                      isSelected && styles.modalListItemSelected,
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
                          isSelected && styles.modalListTextSelected,
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
                        <Ionicons name="checkmark-circle" size={20} color={C.accent} />
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

// ── Consistent step header: overline eyebrow, title, one-line description ──
function StepHeader({ eyebrow, title, subtitle, subtitleLines, children }) {
  return (
    <View style={styles.stepHeader}>
      {eyebrow ? (
        <Text style={styles.stepEyebrow} maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
          {String(eyebrow).toUpperCase()}
        </Text>
      ) : null}
      <Text style={styles.stepTitle} accessibilityRole="header" maxFontSizeMultiplier={uiTheme.fontScale.chrome}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.stepSubtitle} numberOfLines={subtitleLines}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

// ── Card section heading: icon well, title (+ trailing badge/control), description ──
function SectionHead({ icon, tone = 'primary', dimmed = false, title, subtitle, right }) {
  return (
    <View style={styles.sectionHead}>
      <IconWell icon={icon} tone={dimmed ? 'neutral' : tone} size={36} iconSize={17} />
      <View style={styles.sectionHeadText}>
        <View style={styles.sectionHeadTitleRow}>
          <Text style={styles.sectionHeadTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
          {right}
        </View>
        {subtitle ? <Text style={styles.sectionHeadSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flex: 1,
    minWidth: 0,
  },

  // ── Ambient Background Living Aurora Orbs ──
  auroraClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
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
    bottom: SCREEN_HEIGHT * 0.1,
    left: -SCREEN_WIDTH * 0.12,
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: (SCREEN_WIDTH * 0.85) / 2,
    overflow: 'hidden',
  },

  // ── Progress Header ──
  topBar: {
    paddingTop: SP.sm,
    paddingBottom: SP.md,
  },
  topBarInner: {
    width: '100%',
    maxWidth: uiTheme.layout.readableMax,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
  },
  progressCol: {
    flex: 1,
    minWidth: 0,
    gap: SP.sm,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.sm,
  },
  progressLabel: {
    ...TY.overline,
    color: C.textSecondary,
  },
  progressStepName: {
    ...TY.caption,
    color: C.muted,
    flexShrink: 1,
    textAlign: 'right',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: SP.xs,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: RD.pill,
    backgroundColor: C.elevatedHigh,
    overflow: 'hidden',
  },
  progressSegmentDone: {
    backgroundColor: C.primary,
  },

  // ── Stage & Content Columns ──
  stageViewport: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  scrollFlex: {
    flex: 1,
  },
  stageShadowLayer: {
    shadowColor: C.black,
    shadowOffset: { width: -12, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: SP.xs,
    paddingBottom: SP.section,
  },
  scrollContentStep5: {
    paddingBottom: SP.md,
  },
  columnWide: {
    width: '100%',
    maxWidth: uiTheme.layout.readableMax,
    alignSelf: 'center',
  },
  columnForm: {
    width: '100%',
    maxWidth: uiTheme.layout.formMax,
    alignSelf: 'center',
  },

  // ── Step Header ──
  stepHeader: {
    marginBottom: SP.xl,
  },
  stepEyebrow: {
    ...TY.overline,
    color: C.secondary,
    marginBottom: SP.xs,
  },
  stepTitle: {
    ...TY.title,
    color: C.text,
    marginBottom: SP.xs,
  },
  stepSubtitle: {
    ...TY.body,
    color: C.muted,
  },

  // ── Shared Card & Section Heading ──
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: RD.card,
    padding: SP.lg,
    marginBottom: SP.lg,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
    marginVertical: SP.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    marginBottom: SP.md,
  },
  sectionHeadText: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.sm,
  },
  sectionHeadTitle: {
    ...TY.headline,
    color: C.text,
    flexShrink: 1,
  },
  sectionHeadSub: {
    ...TY.footnote,
    color: C.muted,
    marginTop: SP.xxs,
  },

  // ── Step 1: Sliding Showcase ──
  marqueeSectionWrap: {
    marginTop: SP.xs,
    marginBottom: SP.xxl,
  },
  marqueeWindow: {
    width: '100%',
    overflow: 'hidden',
    paddingVertical: SP.sm,
  },
  marqueeTrack: {
    flexDirection: 'row',
    width: (CARD_WIDTH + CARD_GAP) * DISPLAY_CARDS.length + 100,
  },
  cockpitCardContainer: {
    width: CARD_WIDTH,
    flexShrink: 0,
    marginRight: CARD_GAP,
    borderRadius: RD.card,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  cockpitCardGradient: {
    padding: SP.lg,
  },
  cockpitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
  },
  cockpitAvatarWrap: {
    position: 'relative',
  },
  cockpitAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: RD.md,
    backgroundColor: C.elevated,
  },
  cockpitAvatarLiveBeacon: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.surface,
  },
  cockpitProfileMeta: {
    flex: 1,
    minWidth: 0,
  },
  cockpitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    marginBottom: SP.xxs,
  },
  cockpitProfileName: {
    ...TY.headline,
    color: C.text,
    flexShrink: 1,
  },
  cockpitProfileSub: {
    ...TY.caption,
    color: C.muted,
  },
  cockpitScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
  },
  cockpitScoreText: {
    ...TY.subhead,
    fontFamily: uiTheme.fonts.strong,
    color: C.success,
  },
  cockpitHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
    marginVertical: SP.md,
  },
  cockpitOpenerBox: {
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RD.md,
    padding: SP.md,
    marginBottom: SP.md,
  },
  cockpitOpenerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    marginBottom: SP.xs,
  },
  cockpitOpenerLabel: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.label,
    color: C.info,
  },
  cockpitOpenerText: {
    ...TY.callout,
    color: C.text,
    fontStyle: 'italic',
  },
  cockpitCursor: {
    ...TY.callout,
    fontFamily: uiTheme.fonts.heavy,
    color: C.primary,
  },
  cockpitFooterStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: SP.md,
    rowGap: SP.xs,
  },
  cockpitFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
  },
  cockpitFooterItemText: {
    ...TY.caption,
    color: C.muted,
  },

  // ── Step 1: Feature List ──
  featureList: {
    gap: SP.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
  },
  featureInfo: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    ...TY.headline,
    color: C.text,
    marginBottom: SP.xxs,
  },
  featureDesc: {
    ...TY.callout,
    color: C.muted,
  },

  // ── Step 2: Fields, Chips & Phone ──
  fieldLabel: {
    ...TY.label,
    color: C.textSecondary,
    marginBottom: SP.sm,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RD.input,
    minHeight: uiTheme.layout.inputHeight,
    paddingHorizontal: SP.md,
  },
  flagDisk: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.neutralSoft,
    borderWidth: 1,
    borderColor: C.neutralBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagEmoji: {
    fontSize: TY.section.fontSize,
    lineHeight: 22,
  },
  selectFieldText: {
    ...TY.bodyStrong,
    color: C.text,
    flex: 1,
    minWidth: 0,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SP.sm,
  },
  chipWrapSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SP.sm,
    paddingTop: SP.sm,
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    minHeight: 36,
    backgroundColor: C.secondarySoft,
    borderWidth: 1,
    borderColor: C.secondaryBorder,
    borderRadius: RD.pill,
    paddingHorizontal: SP.md,
  },
  moreChipText: {
    ...TY.subhead,
    fontFamily: uiTheme.fonts.label,
    color: C.secondary,
  },
  secondaryLangWrap: {
    overflow: 'hidden',
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RD.input,
    height: uiTheme.layout.inputHeight,
    paddingHorizontal: SP.sm,
  },
  phoneInputWrapFocused: {
    borderColor: C.accent,
  },
  phoneInputWrapError: {
    borderColor: C.error,
    backgroundColor: C.errorSoft,
  },
  phoneInputWrapOk: {
    borderColor: C.successBorder,
  },
  dialCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    minHeight: uiTheme.layout.touchTarget,
    paddingHorizontal: SP.xs,
  },
  dialFlagText: {
    fontSize: TY.body.fontSize,
  },
  dialCodeText: {
    ...TY.bodyStrong,
    fontFamily: uiTheme.fonts.strong,
    color: C.text,
  },
  dialDivider: {
    width: 1,
    height: 24,
    backgroundColor: C.border,
    marginHorizontal: SP.xs,
  },
  phoneInput: {
    ...TY.body,
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: C.text,
    paddingVertical: 0,
  },
  inputIconBtn: {
    padding: SP.xs,
  },
  phoneFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    marginTop: SP.sm,
  },
  helperText: {
    ...TY.footnote,
    color: C.muted,
    flex: 1,
    minWidth: 0,
  },
  helperTextError: {
    color: C.error,
  },
  helperTextSuccess: {
    color: C.success,
  },

  // ── Step 3: Goals ──
  goalSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SP.sm,
  },
  goalFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    backgroundColor: C.secondarySoft,
    borderWidth: 1,
    borderColor: C.secondaryBorder,
    borderRadius: RD.md,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    marginBottom: SP.md,
  },
  goalFeedbackText: {
    ...TY.subhead,
    fontFamily: uiTheme.fonts.label,
    color: C.secondary,
    flex: 1,
    minWidth: 0,
  },
  goalsList: {
    gap: SP.md,
  },
  goalCardWrap: {
    borderRadius: RD.lg,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    minHeight: 72,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RD.lg,
    paddingVertical: SP.md,
    paddingHorizontal: SP.lg,
    overflow: 'hidden',
  },
  goalCardSelectedLayer: {
    backgroundColor: C.primarySoft,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    borderRadius: RD.lg,
  },
  goalInfo: {
    flex: 1,
    minWidth: 0,
  },
  goalTitle: {
    ...TY.headline,
    color: C.text,
    marginBottom: SP.xxs,
  },
  goalDesc: {
    ...TY.footnote,
    color: C.muted,
  },
  goalDescSelected: {
    color: C.textSecondary,
  },
  goalCheckWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalRippleRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RD.pill,
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  goalCheck: {
    width: 24,
    height: 24,
    borderRadius: RD.pill,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCheckSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },

  // ── Game Plan Strategy Preview ──
  strategyCard: {
    marginTop: SP.lg,
  },
  strategyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    marginBottom: SP.sm,
  },
  strategyHeaderTitle: {
    ...TY.label,
    color: C.text,
    flex: 1,
    minWidth: 0,
  },
  strategySummaryText: {
    ...TY.callout,
    color: C.textSecondary,
  },

  // ── Step 4: Tone, Voice Preview, Cadence & Protection ──
  toneScroll: {
    marginHorizontal: -SP.lg,
    marginBottom: SP.md,
  },
  toneScrollTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    paddingHorizontal: SP.lg,
    paddingVertical: SP.xs,
  },
  voicePreview: {
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: RD.lg,
    padding: SP.md,
  },
  voiceHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: SP.sm,
    rowGap: SP.xs,
    marginBottom: SP.md,
  },
  voiceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    flexShrink: 1,
  },
  voiceIconDisk: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHeaderTitle: {
    ...TY.label,
    color: C.text,
    flexShrink: 1,
  },
  voiceLiveBeaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xxs,
    borderRadius: RD.pill,
    backgroundColor: C.neutralSoft,
  },
  voiceLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  voiceLiveText: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.strong,
  },
  voiceTagBadge: {
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xxs,
    borderRadius: RD.pill,
    borderWidth: 1,
  },
  voiceTagBadgeText: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.strong,
  },
  voiceBubble: {
    alignSelf: 'flex-end',
    maxWidth: '94%',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: RD.lg,
    borderBottomRightRadius: RD.xs,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    marginBottom: SP.md,
    overflow: 'hidden',
  },
  voiceDraftingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.onPrimary,
  },
  voiceDraftingText: {
    ...TY.callout,
    color: C.onPrimary,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  voiceOpenerText: {
    ...TY.body,
    color: C.onPrimary,
  },
  voiceCursor: {
    fontFamily: uiTheme.fonts.heavy,
    fontWeight: 'normal',
    color: C.onPrimary,
  },
  voiceVibeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
  },
  voiceEqualizerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 12,
    gap: 2,
    flexShrink: 0,
  },
  voiceEqualizerBar: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
  },
  voiceVibeDesc: {
    ...TY.footnote,
    color: C.muted,
    flex: 1,
    minWidth: 0,
  },
  cadenceSegmentTrack: {
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: C.elevated,
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 3,
    marginBottom: SP.sm,
  },
  cadenceSliderThumb: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: RD.sm,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    backgroundColor: C.primarySoft,
  },
  cadenceSegmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: SP.xs,
    paddingHorizontal: SP.xxs,
    borderRadius: RD.sm,
    zIndex: 1,
  },
  cadenceSegmentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    maxWidth: '100%',
  },
  cadenceSegmentLabel: {
    ...TY.subhead,
    color: C.muted,
    flexShrink: 1,
  },
  cadenceSegmentLabelActive: {
    fontFamily: uiTheme.fonts.label,
    color: C.text,
  },
  cadenceTimeText: {
    ...TY.caption,
    color: C.muted,
    marginTop: SP.xxs,
  },
  cadenceTimeTextActive: {
    fontFamily: uiTheme.fonts.strong,
    color: C.secondary,
  },
  cadenceInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    paddingHorizontal: SP.xs,
  },
  cadenceInsightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
    flexShrink: 0,
  },
  cadenceInsightText: {
    ...TY.footnote,
    color: C.textSecondary,
    flex: 1,
    minWidth: 0,
  },
  shieldMatrixRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SP.sm,
  },
  shieldMatrixRowDimmed: {
    opacity: 0.5,
  },
  shieldPillarCard: {
    flexGrow: 1,
    flexBasis: 88,
    backgroundColor: C.successSoft,
    borderWidth: 1,
    borderColor: C.successBorder,
    borderRadius: RD.sm,
    paddingVertical: SP.sm,
    paddingHorizontal: SP.sm,
  },
  shieldPillarCardDimmed: {
    backgroundColor: C.neutralSoft,
    borderColor: C.neutralBorder,
  },
  shieldPillarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    marginBottom: SP.xxs,
  },
  shieldPillarTitle: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.label,
    color: C.text,
    flexShrink: 1,
  },
  shieldPillarTitleDimmed: {
    color: C.muted,
  },
  shieldPillarSub: {
    ...TY.caption,
    color: C.muted,
  },

  // ── Step 5: Swipe Deck ──
  step5Container: {
    overflow: 'visible',
  },
  deckStackWrap: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SP.sm,
  },
  heroMatchCard: {
    position: 'relative',
    borderRadius: RD.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.primaryBorder,
    backgroundColor: C.elevated,
    ...uiTheme.shadows.md,
    zIndex: 3,
    justifyContent: 'space-between',
  },
  heroProfileImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    zIndex: 1,
  },
  heroTopBadgesRow: {
    position: 'absolute',
    top: SP.md,
    left: SP.md,
    right: SP.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.sm,
    zIndex: 2,
  },
  heroCompatibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    backgroundColor: alpha(C.background, 0.82),
    borderWidth: 1,
    borderColor: C.primaryBorder,
    borderRadius: RD.pill,
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xs,
    flexShrink: 1,
  },
  heroCompatibilityText: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.strong,
    color: C.white,
  },
  heroSwipeHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    backgroundColor: alpha(C.background, 0.7),
    borderRadius: RD.pill,
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xs,
    borderWidth: 1,
    borderColor: C.neutralBorder,
  },
  heroSwipeHintText: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.label,
    color: alpha(C.white, 0.85),
  },
  heroFrostedDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: SP.md,
    paddingTop: SP.lg,
    paddingBottom: SP.md,
  },
  heroDockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.sm,
    marginBottom: SP.sm,
  },
  heroIdentityCol: {
    flex: 1,
    minWidth: 0,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
  },
  heroNameText: {
    ...TY.title2,
    color: C.white,
    flexShrink: 1,
  },
  heroLocationText: {
    ...TY.caption,
    color: alpha(C.white, 0.8),
  },
  shuffleCircleBtn: {
    borderRadius: RD.pill,
    backgroundColor: alpha(C.white, 0.12),
    borderWidth: 1,
    borderColor: alpha(C.white, 0.18),
  },
  icebreakerPill: {
    backgroundColor: alpha(C.background, 0.78),
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.neutralBorder,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    gap: SP.xxs,
  },
  icebreakerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
  },
  icebreakerTag: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.strong,
    flexShrink: 1,
  },
  icebreakerQuoteText: {
    ...TY.subhead,
    fontFamily: uiTheme.fonts.body,
    color: C.white,
    fontStyle: 'italic',
  },
  stampLikeWrap: {
    position: 'absolute',
    top: 50,
    left: SP.xl,
    zIndex: 10,
    transform: [{ rotate: '-15deg' }],
  },
  stampNopeWrap: {
    position: 'absolute',
    top: 50,
    right: SP.xl,
    zIndex: 10,
    transform: [{ rotate: '15deg' }],
  },
  stampBorder: {
    borderWidth: 3,
    borderRadius: RD.small,
    paddingHorizontal: SP.md,
    paddingVertical: SP.xs,
  },
  stampLikeBorder: {
    borderColor: C.success,
    backgroundColor: C.successSoft,
  },
  stampNopeBorder: {
    borderColor: C.primary,
    backgroundColor: C.primarySoft,
  },
  stampText: {
    ...TY.title,
    fontFamily: uiTheme.fonts.heavy,
    letterSpacing: 1.5,
  },
  stampLikeText: {
    color: C.success,
  },
  stampNopeText: {
    color: C.primary,
  },

  // ── Step 5: Game Plan Card Stack ──
  blueprintDeckSection: {
    width: '100%',
    marginTop: SP.md,
  },
  blueprintDeckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.sm,
    marginBottom: SP.sm,
  },
  blueprintHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    flexShrink: 1,
  },
  blueprintDeckTitle: {
    ...TY.label,
    color: C.text,
    flexShrink: 1,
  },
  blueprintCycleHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    minHeight: 28,
  },
  blueprintCycleHintText: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.label,
    color: C.muted,
  },
  blueprintPipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: SP.xxs,
  },
  blueprintPip: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.borderStrong,
  },
  blueprintPipActive: {
    width: 12,
    backgroundColor: C.accent,
  },
  blueprintCardsWrap: {
    position: 'relative',
    width: '100%',
    height: 104,
    alignItems: 'center',
  },
  blueprintCardSingle: {
    position: 'absolute',
    width: '100%',
    height: 88,
    borderRadius: RD.lg,
    overflow: 'hidden',
    ...uiTheme.shadows.sm,
  },
  blueprintCardGradient: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RD.lg,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    justifyContent: 'space-between',
  },
  blueprintCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.sm,
  },
  blueprintCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xxs,
    borderRadius: RD.small,
    flexShrink: 1,
  },
  blueprintCardBadgeText: {
    ...TY.overline,
    letterSpacing: 0.6,
  },
  blueprintCardRightTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.xs,
  },
  blueprintSuitPill: {
    ...TY.caption,
    fontFamily: uiTheme.fonts.strong,
    color: C.muted,
  },
  blueprintCardTitle: {
    ...TY.headline,
    color: C.text,
  },
  blueprintCardDetail: {
    ...TY.footnote,
    color: C.muted,
  },

  // ── Sticky Bottom Footer ──
  footer: {
    paddingTop: SP.md,
    paddingBottom: SP.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.divider,
    backgroundColor: alpha(C.background, 0.94),
  },
  footerInner: {
    width: '100%',
    maxWidth: uiTheme.layout.formMax,
    alignSelf: 'center',
  },
  footerSubSlot: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SP.xs,
  },
  ctaReassuranceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SP.xs,
  },
  ctaReassuranceText: {
    ...TY.caption,
    color: C.muted,
    flexShrink: 1,
  },
  signInFooterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: SP.sm,
  },
  signInFooterText: {
    ...TY.subhead,
    color: C.textSecondary,
  },
  signInFooterHighlight: {
    fontFamily: uiTheme.fonts.label,
    color: C.secondary,
  },

  // ── Picker Sheets ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    height: '82%',
    backgroundColor: C.surface,
    borderTopLeftRadius: RD.sheet,
    borderTopRightRadius: RD.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.hairline,
    paddingHorizontal: SP.lg,
    paddingTop: SP.sm,
    overflow: 'hidden',
    ...uiTheme.shadows.lg,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.borderStrong,
    alignSelf: 'center',
    marginTop: SP.xs,
    marginBottom: SP.lg,
  },
  modalList: {
    flex: 1,
  },
  modalListContent: {
    paddingBottom: SP.hero,
  },
  modalHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
    marginLeft: 56,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.md,
    paddingHorizontal: SP.xs,
    marginBottom: SP.lg,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    flex: 1,
    minWidth: 0,
  },
  modalHeaderTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    ...TY.title2,
    color: C.text,
  },
  modalSub: {
    ...TY.footnote,
    color: C.muted,
    marginTop: SP.xxs,
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    backgroundColor: C.elevated,
    borderRadius: RD.input,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP.md,
    height: uiTheme.layout.inputHeight,
    marginBottom: SP.md,
  },
  modalSearchWrapFocused: {
    borderColor: C.accent,
  },
  modalSearchInput: {
    ...TY.body,
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: C.text,
    paddingVertical: 0,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SP.md,
    minHeight: 56,
    paddingVertical: SP.sm,
    paddingHorizontal: SP.md,
    borderRadius: RD.md,
  },
  modalListItemSelected: {
    backgroundColor: C.primarySoft,
  },
  modalListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    flex: 1,
    minWidth: 0,
  },
  modalItemFlag: {
    fontSize: TY.title.fontSize,
    lineHeight: 30,
    width: 32,
    textAlign: 'center',
  },
  modalListText: {
    ...TY.bodyStrong,
    fontFamily: uiTheme.fonts.body,
    color: C.text,
    flex: 1,
    minWidth: 0,
  },
  modalListTextSelected: {
    fontFamily: uiTheme.fonts.label,
    color: C.accent,
  },
  modalListItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
  },
  modalItemDialText: {
    ...TY.subhead,
    color: C.muted,
  },
  modalItemDialTextSelected: {
    fontFamily: uiTheme.fonts.strong,
    color: C.secondary,
  },
  modalDialBadge: {
    backgroundColor: C.neutralSoft,
    paddingHorizontal: SP.sm,
    paddingVertical: SP.xxs,
    borderRadius: RD.small,
    borderWidth: 1,
    borderColor: C.neutralBorder,
  },
  modalDialBadgeSelected: {
    backgroundColor: C.primarySoft,
    borderColor: C.primaryBorder,
  },
  modalDialText: {
    ...TY.subhead,
    fontFamily: uiTheme.fonts.strong,
    color: C.textSecondary,
  },
  modalDialTextSelected: {
    color: C.text,
  },
  modalEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SP.spacious,
    gap: SP.sm,
  },
  modalEmptyTitle: {
    ...TY.headline,
    color: C.text,
  },
  modalEmptySub: {
    ...TY.footnote,
    color: C.muted,
  },
});
