import DialogContent from './common/DialogContent';
import { createStyles, theme as uiTheme, alpha } from '../theme';
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
import AppButton from './ui/AppButton';
import NotificationService from '../services/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Third-party brand marks — used only for the destination app's icon tint.
const BRAND_WHATSAPP = '#25D366';
const BRAND_INSTAGRAM = '#E1306C';

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
  let primaryColor = uiTheme.colors.tinder;
  let headline = `Open Tinder?`;
  let description = `You are about to leave Flirteasy and open ${matchName}'s conversation in the Tinder app.`;

  if (phone) {
    primaryApp = 'WhatsApp';
    primaryIcon = 'logo-whatsapp';
    primaryColor = BRAND_WHATSAPP;
    headline = `Open WhatsApp?`;
    description = `Start a chat with ${matchName} (${phone}) in the WhatsApp app.`;
  } else if (instagram) {
    primaryApp = 'Instagram';
    primaryIcon = 'logo-instagram';
    primaryColor = BRAND_INSTAGRAM;
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
          accessibilityLabel="Stay in app"
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />

        <DialogContent style={styles.modalCard}>
          {/* Top App Icon Badge (brand-tinted for the destination app) */}
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: alpha(primaryColor, 0.14), borderColor: alpha(primaryColor, 0.34) },
            ]}
          >
            <Ionicons name={primaryIcon} size={28} color={primaryColor} />
          </View>

          {/* Title & Description */}
          <Text style={styles.titleText} accessibilityRole="header">{headline}</Text>
          <Text style={styles.descText}>{description}</Text>

          {/* "Remember my choice" Toggle Checkbox */}
          <TouchableOpacity accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberChoice }}
            accessibilityLabel={`Don't ask again for ${primaryApp}`}
            style={[styles.checkboxRow, rememberChoice && styles.checkboxRowChecked]}
            onPress={() => {
              setRememberChoice(!rememberChoice);
              safeHaptic('light');
            }}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkboxBox,
                rememberChoice && styles.checkboxBoxChecked,
              ]}
            >
              {rememberChoice && <Ionicons name="checkmark" size={14} color={uiTheme.colors.onPrimary} />}
            </View>
            <Text style={styles.checkboxLabel}>
              Don't ask again for {primaryApp}
            </Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            {/* Primary Action Button */}
            <AppButton
              title={`Open ${primaryApp}`}
              icon={primaryIcon}
              haptic={false}
              onPress={handleLaunchPrimary}
            />

            {/* Secondary Action Options */}
            {phone && primaryApp !== 'Tinder' && (
              <AppButton
                title="Open in Tinder Instead"
                icon="flame-outline"
                variant="outline"
                haptic={false}
                onPress={() => handleLaunchSecondary('Tinder')}
              />
            )}

            {/* Cancel Button */}
            <AppButton
              title="Stay in App"
              variant="secondary"
              onPress={onClose}
            />

            {phone && (
              <AppButton
                title={copied ? 'Copied to Clipboard' : `Copy ${phone}`}
                icon={copied ? 'checkmark-circle-outline' : 'copy-outline'}
                variant="ghost"
                size="sm"
                haptic={false}
                accessibilityLabel={copied ? 'Phone number copied to clipboard' : `Copy phone number ${phone}`}
                textStyle={copied ? styles.copiedText : styles.copyText}
                onPress={handleCopy}
              />
            )}
          </View>
        </DialogContent>
      </View>
    </Modal>
  );
}

const styles = createStyles(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: uiTheme.colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: uiTheme.spacing.xxl,
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: uiTheme.colors.surface,
    borderRadius: uiTheme.radius.sheet,
    borderWidth: 1,
    borderColor: uiTheme.colors.hairline,
    padding: uiTheme.spacing.xxl,
    alignItems: 'center',
    ...uiTheme.shadows.lg,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: uiTheme.spacing.lg,
  },
  titleText: {
    ...uiTheme.type.title2,
    color: uiTheme.colors.text,
    marginBottom: uiTheme.spacing.sm,
    textAlign: 'center',
  },
  descText: {
    ...uiTheme.type.callout,
    color: uiTheme.colors.muted,
    textAlign: 'center',
    marginBottom: uiTheme.spacing.xl,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: uiTheme.layout.touchTarget + 4,
    backgroundColor: uiTheme.colors.elevated,
    borderRadius: uiTheme.radius.input,
    borderWidth: 1,
    borderColor: uiTheme.colors.borderSubtle,
    paddingHorizontal: uiTheme.spacing.md,
    paddingVertical: uiTheme.spacing.sm,
    marginBottom: uiTheme.spacing.xl,
    gap: uiTheme.spacing.md,
  },
  checkboxRowChecked: {
    borderColor: uiTheme.colors.primaryBorder,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: uiTheme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: uiTheme.colors.primary,
    borderColor: uiTheme.colors.primary,
  },
  checkboxLabel: {
    ...uiTheme.type.label,
    color: uiTheme.colors.text,
    flex: 1,
  },
  actions: {
    alignSelf: 'stretch',
    gap: 10,
  },
  copyText: {
    color: uiTheme.colors.textSecondary,
  },
  copiedText: {
    color: uiTheme.colors.success,
  },
}));
