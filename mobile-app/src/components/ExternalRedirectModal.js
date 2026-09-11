import DialogContent from './common/DialogContent';
import { theme as uiTheme } from '../theme';
// mobile-app/src/components/ExternalRedirectModal.js
// Production-Grade External App Redirect Confirmation Modal with "Remember Preference"

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Clipboard,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NotificationService from '../services/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch (_) {}

const safeHaptic = (type = 'light') => {
  try {
    if (Haptics && Haptics.impactAsync) {
      if (type === 'success' && Haptics.notificationAsync) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  } catch (_) {}
};

export default function ExternalRedirectModal({
  visible,
  notification,
  onClose,
}) {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!notification) return null;

  const data = notification.data || {};
  const phone = data.phone;
  const matchName = data.matchName || 'your match';
  const instagram = data.instagram || data.handle;

  // Determine primary destination
  let primaryApp = 'Tinder';
  let primaryIcon = 'heart-outline';
  let primaryColor = uiTheme.colors.primary;
  let headline = `Open Tinder?`;
  let description = `You are about to leave FlirtEasy and open ${matchName}'s conversation in the Tinder app.`;

  if (phone) {
    primaryApp = 'WhatsApp';
    primaryIcon = 'logo-whatsapp';
    primaryColor = '#25D366';
    headline = `Open WhatsApp?`;
    description = `Start a chat with ${matchName} (${phone}) in the WhatsApp app.`;
  } else if (instagram) {
    primaryApp = 'Instagram';
    primaryIcon = 'logo-instagram';
    primaryColor = '#E1306C';
    headline = `Open Instagram?`;
    description = `View @${instagram.replace('@', '')}'s profile in the Instagram app.`;
  }

  const handleLaunchPrimary = async () => {
    safeHaptic('success');
    if (rememberChoice) {
      NotificationService.setRedirectPreference(primaryApp.toLowerCase(), 'auto_open');
    }
    onClose();
    if (primaryApp === 'WhatsApp') {
      await NotificationService.openWhatsApp(phone);
    } else if (primaryApp === 'Instagram') {
      await NotificationService.openInstagram(instagram);
    } else {
      await NotificationService.openPlatformApp('Tinder', data);
    }
  };

  const handleLaunchSecondary = async (appType) => {
    safeHaptic('light');
    if (rememberChoice) {
      NotificationService.setRedirectPreference(appType.toLowerCase(), 'auto_open');
    }
    onClose();
    if (appType === 'Tinder') {
      await NotificationService.openPlatformApp('Tinder', data);
    } else if (appType === 'WhatsApp' && phone) {
      await NotificationService.openWhatsApp(phone);
    } else if (appType === 'Instagram' && instagram) {
      await NotificationService.openInstagram(instagram);
    }
  };

  const handleCopy = () => {
    if (phone) {
      Clipboard.setString(phone);
      setCopied(true);
      safeHaptic('success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity accessibilityRole="button"
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />

        <DialogContent style={styles.modalCard}>
          {/* Top App Icon Badge */}
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: primaryColor + '18', borderColor: primaryColor + '35' },
            ]}
          >
            <Ionicons name={primaryIcon} size={28} color={primaryColor} />
          </View>

          {/* Title & Description */}
          <Text style={styles.titleText}>{headline}</Text>
          <Text style={styles.descText}>{description}</Text>

          {/* "Remember my choice" Toggle Checkbox */}
          <TouchableOpacity accessibilityRole="button"
            style={styles.checkboxRow}
            onPress={() => {
              setRememberChoice(!rememberChoice);
              safeHaptic('light');
            }}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkboxBox,
                rememberChoice && { backgroundColor: primaryColor, borderColor: primaryColor },
              ]}
            >
              {rememberChoice && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
            </View>
            <Text style={styles.checkboxLabel}>
              Don't ask again for {primaryApp}
            </Text>
          </TouchableOpacity>

          {/* Primary Action Button */}
          <TouchableOpacity accessibilityRole="button"
            style={[styles.primaryBtn, { backgroundColor: primaryColor }]}
            onPress={handleLaunchPrimary}
            activeOpacity={0.85}
          >
            <Ionicons name={primaryIcon} size={17} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Open {primaryApp}</Text>
          </TouchableOpacity>

          {/* Secondary Action Options */}
          {phone && primaryApp !== 'Tinder' && (
            <TouchableOpacity accessibilityRole="button"
              style={styles.secondaryOptionBtn}
              onPress={() => handleLaunchSecondary('Tinder')}
              activeOpacity={0.8}
            >
              <Ionicons name="flame-outline" size={15} color={uiTheme.colors.primary} />
              <Text style={styles.secondaryOptionText}>Open in Tinder Instead</Text>
            </TouchableOpacity>
          )}

          {phone && (
            <TouchableOpacity accessibilityRole="button"
              style={styles.copyOptionBtn}
              onPress={handleCopy}
              activeOpacity={0.8}
            >
              <Ionicons
                name={copied ? 'checkmark-circle-outline' : 'copy-outline'}
                size={14}
                color={copied ? uiTheme.colors.success : '#A4A2B8'}
              />
              <Text style={[styles.copyOptionText, copied && { color: uiTheme.colors.success }]}>
                {copied ? 'Copied to Clipboard' : `Copy ${phone}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Cancel Button */}
          <TouchableOpacity accessibilityRole="button"
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelBtnText}>Stay in App</Text>
          </TouchableOpacity>
        </DialogContent>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: uiTheme.spacing.xxl,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#12101D',
    borderRadius: uiTheme.radius.sheet,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: uiTheme.radius.card,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  titleText: { fontFamily: 'Manrope_800ExtraBold',
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'normal',
    letterSpacing: -0.3,
    marginBottom: uiTheme.spacing.sm,
    textAlign: 'center',
  },
  descText: { fontFamily: 'Inter_400Regular',
    color: uiTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18.5,
    fontWeight: 'normal',
    textAlign: 'center',
    marginBottom: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#181628',
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: 10,
    marginBottom: uiTheme.spacing.lg,
    gap: 10,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: 12.5,
    fontWeight: 'normal',
    flex: 1,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: uiTheme.spacing.sm,
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  primaryBtnText: { fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: 'normal',
  },
  secondaryOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'stretch',
    backgroundColor: '#1A182B',
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    marginBottom: uiTheme.spacing.sm,
  },
  secondaryOptionText: { fontFamily: 'Inter_600SemiBold',
    color: uiTheme.colors.text,
    fontSize: 12.5,
    fontWeight: 'normal',
  },
  copyOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 6,
  },
  copyOptionText: { fontFamily: 'Inter_600SemiBold',
    color: '#A4A2B8',
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: 'normal',
  },
  cancelBtn: {
    paddingVertical: uiTheme.spacing.sm,
    marginTop: uiTheme.spacing.xs,
  },
  cancelBtnText: { fontFamily: 'Inter_600SemiBold',
    color: '#6E6C80',
    fontSize: 12.5,
    fontWeight: 'normal',
  },
});
