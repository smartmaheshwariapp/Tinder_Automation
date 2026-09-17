import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, StatusBar } from 'react-native';
import SafeActivityIndicator from './src/components/common/SafeActivityIndicator';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { theme } from './src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import AppNavigator from './src/navigation/AppNavigator';
import InAppNotificationBanner from './src/components/InAppNotificationBanner';
import ExternalRedirectModal from './src/components/ExternalRedirectModal';
import NotificationService from './src/services/notifications';
import { useFonts } from 'expo-font';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import SupabaseService from './src/services/supabase';

const navigationTheme = {
  ...DarkTheme,
  fonts: { regular: { fontFamily: theme.fonts.body, fontWeight: "normal" }, medium: { fontFamily: theme.fonts.label, fontWeight: "normal" }, bold: { fontFamily: theme.fonts.heading, fontWeight: "normal" }, heavy: { fontFamily: theme.fonts.display, fontWeight: "normal" } },
  colors: { ...DarkTheme.colors, primary: theme.colors.primary, background: theme.colors.background, card: theme.colors.surface, text: theme.colors.text, border: theme.colors.border, notification: theme.colors.primary },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Auth');
  const [initialUser, setInitialUser] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("Checking for updates...");
  const [redirectNotif, setRedirectNotif] = useState(null);
  const navigationRef = useRef(null);

  const [fontsLoaded, fontError] = useFonts({
    Manrope_700Bold, Manrope_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });

  useEffect(() => {
    NotificationService.initialize();

    const unsubRedirect = NotificationService.subscribeRedirectPrompt((notif) => {
      setRedirectNotif(notif);
    });

    const cleanupListeners = NotificationService.setupListeners(
      (notif) => {},
      (response, notifItem) => {
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

        // Restore authenticated Flint user session on startup
        try {
          const user = await SupabaseService.getCurrentUser();
          if (user && (user.email || user.id)) {
            console.log('[App] Restored authenticated Flint user session:', user.email || user.id);
            setInitialUser(user);
            setInitialRoute('PlatformSelect');
          } else {
            setInitialRoute('Auth');
          }
        } catch (_) {
          setInitialRoute('Auth');
        }
      } finally {
        setIsReady(true);
      }
    };

    boot();
  }, []);

  if (!isReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#18101d" />
        <SafeActivityIndicator size="large" color="#ff4f73" />
        <Text style={styles.splashTitle}>Flint</Text>
        <Text style={styles.splashStatus}>{updateStatus}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <AppNavigator initialRouteName={initialRoute} initialUser={initialUser} />
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
    backgroundColor: '#18101d',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#edddf1',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  splashStatus: {
    fontSize: 14,
    color: '#ac888b',
    marginTop: 8,
    textAlign: 'center',
  },
});
