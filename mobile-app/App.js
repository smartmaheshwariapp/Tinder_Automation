import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, StatusBar } from 'react-native';
import SafeActivityIndicator from './src/components/common/SafeActivityIndicator';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import AppNavigator from './src/navigation/AppNavigator';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';
import ExternalRedirectModal from './src/components/ExternalRedirectModal';
import NotificationService from './src/services/notifications';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("Checking for updates...");
  const [redirectNotif, setRedirectNotif] = useState(null);
  const navigationRef = useRef(null);

  useEffect(() => {
    // 1. Initialize Notification Center persistent storage & channels
    NotificationService.initialize();

    // 2. Subscribe to smart redirect modals (WhatsApp / Instagram / Tinder)
    const unsubRedirect = NotificationService.subscribeRedirectPrompt((notif) => {
      setRedirectNotif(notif);
    });

    // 3. Setup Native Push & OS Tray Tap Listeners
    const cleanupListeners = NotificationService.setupListeners(
      (notif) => {
        // Foreground push received
      },
      (response, notifItem) => {
        // User tapped push notification in the OS tray
        const data = notifItem?.data || {};
        if (data.phone || data.instagram) {
          NotificationService.handleNotificationRedirect(notifItem);
        } else if (data.type === 'new_match' || data.type === 'cycle_complete') {
          if (navigationRef.current && navigationRef.current.isReady && navigationRef.current.isReady()) {
            navigationRef.current.navigate('PlatformSelect');
          }
        }
      }
    );

    return () => {
      unsubRedirect();
      cleanupListeners();
    };
  }, []);


  useEffect(() => {
    const boot = async () => {
      try {
        // Check for updates (Production only, skip in Expo Go)
        if (!__DEV__) {
          try {
            setUpdateStatus("Checking for updates...");
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
              setUpdateStatus("Downloading update...");
              await Updates.fetchUpdateAsync();
              setUpdateStatus("Update ready! Restarting...");
              await Updates.reloadAsync();
              return;
            }
          } catch (updateError) {
            console.log("Update check failed:", updateError);
            setUpdateStatus("Preparing your experience…");
          }
        }
      } finally {
        setIsReady(true);
      }
    };

    boot();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0F0F13" />
        <SafeActivityIndicator size="large" color="#FE3C72" />
        <Text style={styles.splashTitle}>Linksy</Text>
        <Text style={styles.splashStatus}>{updateStatus}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
        <InAppNotificationBanner
          onNavigateToStream={(notif) => {
            const data = notif?.data || {};
            if (data.type === 'new_match' || data.type === 'cycle_complete') {
              if (navigationRef.current && navigationRef.current.isReady && navigationRef.current.isReady()) {
                navigationRef.current.navigate('PlatformSelect');
              }
            }
          }}
        />
        <ExternalRedirectModal
          visible={!!redirectNotif}
          notification={redirectNotif}
          onClose={() => setRedirectNotif(null)}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#0F0F13',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  splashStatus: {
    fontSize: 14,
    color: '#8E8E9F',
    marginTop: 8,
    textAlign: 'center',
  },
});
