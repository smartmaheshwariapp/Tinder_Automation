import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Optional Brand Asset
let HEADER_LOGO = null;
try {
  HEADER_LOGO = require('../../assets/flirteasy/Text_logo.png');
} catch (_) {
  HEADER_LOGO = null;
}

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);

  const handleAuthSubmit = () => {
    // Navigate to the main dashboard / platform select screen
    navigation.navigate('PlatformSelect');
  };

  const handleGoogleSignIn = () => {
    // Google auth flow / instant demo access
    navigation.navigate('PlatformSelect');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#233D32" />

      {/* Top Forest Green Header Area */}
      <View style={[styles.headerSection, { paddingTop: Math.max(insets.top, 20) }]}>
        {/* Decorative ambient lighting */}
        <View style={styles.ambientGlow} />

        {/* Brand Logo & Subtitle */}
        <View style={styles.brandContainer}>
          <View style={styles.logoRow}>
            <Text style={styles.logoTilde}>~ </Text>
            <Text style={styles.logoScript}>flirteasy</Text>
            <View style={styles.heartWrapper}>
              <Ionicons name="heart-outline" size={18} color="#F5C6A5" style={styles.heart1} />
              <Ionicons name="heart-outline" size={14} color="#F5C6A5" style={styles.heart2} />
            </View>
          </View>
          <Text style={styles.logoTagline}>Connect with Ease</Text>
        </View>
      </View>

      {/* Bottom Main Content Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.card}>
            {/* Header Titles */}
            <View style={styles.titleSection}>
              <Text style={styles.welcomeTitle}>
                {isSignUp ? 'Join ' : 'Welcome to '}
                <Text style={styles.brandHighlight}>flirteasy</Text>!
              </Text>
              <Text style={styles.welcomeSubtitle}>
                {isSignUp
                  ? 'Create an account to meet amazing people.'
                  : 'Sign in to find your perfect match.'}
              </Text>
            </View>

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <View
                style={[
                  styles.inputBox,
                  isFocusedEmail && styles.inputBoxFocused,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color={isFocusedEmail ? '#E06D53' : '#8E9B93'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Your email address"
                  placeholderTextColor="#A4ACA6"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  selectionColor="#E06D53"
                  cursorColor="#E06D53"
                  underlineColorAndroid="transparent"
                  keyboardType="email-address"
                  onFocus={() => setIsFocusedEmail(true)}
                  onBlur={() => setIsFocusedEmail(false)}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View
                style={[
                  styles.inputBox,
                  isFocusedPassword && styles.inputBoxFocused,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={isFocusedPassword ? '#E06D53' : '#8E9B93'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor="#A4ACA6"
                  value={password}
                  onChangeText={setPassword}
                  autoCorrect={false}
                  spellCheck={false}
                  selectionColor="#E06D53"
                  cursorColor="#E06D53"
                  underlineColorAndroid="transparent"
                  secureTextEntry={!showPassword}
                  onFocus={() => setIsFocusedPassword(true)}
                  onBlur={() => setIsFocusedPassword(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={19}
                    color="#8E9B93"
                  />
                </TouchableOpacity>
              </View>

              {!isSignUp && (
                <TouchableOpacity style={styles.forgotPasswordButton}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Main Action Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.88}
              onPress={handleAuthSubmit}
            >
              <Text style={styles.primaryButtonText}>
                {isSignUp ? 'Create Account' : 'Start Flirting'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In Button */}
            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.85}
              onPress={handleGoogleSignIn}
            >
              <View style={styles.googleIconContainer}>
                {/* Clean Multi-Color Google G Symbol */}
                <Text style={styles.googleGLogo}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Footer Prompt */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
                <Text style={styles.footerActionText}>
                  {isSignUp ? 'Sign In' : 'Join Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#233D32', // Deep forest green header background
  },
  headerSection: {
    height: 180,
    backgroundColor: '#233D32',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    top: 20,
    width: 220,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245, 198, 165, 0.08)',
  },
  brandContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTilde: {
    fontSize: 28,
    color: '#F5C6A5',
    fontStyle: 'italic',
    fontWeight: '300',
  },
  logoScript: {
    fontSize: 36,
    color: '#F5C6A5', // Warm peach-gold brand color
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'sans-serif-condensed',
    letterSpacing: 1,
    includeFontPadding: false,
  },
  heartWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
    marginBottom: 10,
  },
  heart1: {
    transform: [{ rotate: '15deg' }],
  },
  heart2: {
    marginLeft: -4,
    transform: [{ rotate: '-10deg' }],
  },
  logoTagline: {
    color: '#D5E2D9',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.8,
    marginTop: -2,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#FAF7F2', // Warm ivory/off-white card
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#26342E',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  brandHighlight: {
    color: '#DE6B48', // Warm coral terracotta accent
    fontWeight: '800',
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    color: '#7B8881',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2B3B34',
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E1D8',
    borderRadius: 13,
    height: 50,
    paddingHorizontal: 14,
  },
  inputBoxFocused: {
    borderColor: '#DE6B48',
    borderWidth: 1.5,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#26342E',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 12.5,
    color: '#495B52',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#DE6B48', // FlirtEasy signature coral-orange
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#DE6B48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4DFD6',
  },
  dividerText: {
    paddingHorizontal: 14,
    fontSize: 11.5,
    color: '#9CA69F',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2DDD3',
    borderRadius: 14,
    height: 50,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  googleGLogo: {
    fontSize: 17,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#2B3B34',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
  },
  footerText: {
    fontSize: 13.5,
    color: '#7B8881',
  },
  footerActionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#DE6B48',
  },
});
