import React, { useState, useEffect, useRef } from "react";
import { Image, StyleSheet, Text, View, StatusBar } from "react-native";
import SafeActivityIndicator from "./src/components/common/SafeActivityIndicator";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createStyles,
  theme,
  applyTheme,
  subscribeTheme,
  THEME_STORAGE_KEY,
} from "./src/theme";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import AppNavigator from "./src/navigation/AppNavigator";
import AppLogo from "./src/components/ui/AppLogo";
// The name, cropped from the brand lockup, with "Flirt" lifted to white for the dark splash.
const SPLASH_WORDMARK = require("./assets/wordmark-text.png");
// Boot often finishes in a few hundred ms, which makes the splash flash past. Hold it for
// long enough to read the mark, then hand over to the app.
const MIN_SPLASH_MS = 2000;
import InAppNotificationBanner from "./src/components/InAppNotificationBanner";
import ExternalRedirectModal from "./src/components/ExternalRedirectModal";
import NotificationService from "./src/services/notifications";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import SupabaseService from "./src/services/supabase";
import { MotionProvider } from "./src/components/common/Motion";

// Built per render so an Appearance change is picked up without restarting.
const buildNavigationTheme = () => ({
  ...DarkTheme,
  fonts: {
    regular: { fontFamily: theme.fonts.body, fontWeight: "normal" },
    medium: { fontFamily: theme.fonts.label, fontWeight: "normal" },
    bold: { fontFamily: theme.fonts.heading, fontWeight: "normal" },
    heavy: { fontFamily: theme.fonts.display, fontWeight: "normal" },
  },
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.primary,
  },
});

// Root shell shared by the splash and the app: gesture handling, safe-area context and a
// safe-area inset view. Screens inside it no longer need to add the notch/home-indicator
// insets themselves; full-screen Modals render in their own window and still do.
function AppShell({ children }) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.root}>{children}</SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [initialRoute, setInitialRoute] = useState("Auth");
  const [initialUser, setInitialUser] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("Checking for updates...");
  const [redirectNotif, setRedirectNotif] = useState(null);
  // applyTheme() rebuilds every style sheet in place, so the app only needs to re-render.
  const [, setThemeVersion] = useState(0);
  useEffect(() => subscribeTheme(() => setThemeVersion((v) => v + 1)), []);
  const navigationRef = useRef(null);

  const [fontsLoaded, fontError] = useFonts({
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Runs alongside boot rather than after it, so the floor overlaps the work instead of
  // being added to it: a slow start-up still costs the user nothing extra.
  useEffect(() => {
    const timer = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    NotificationService.initialize();

    const unsubRedirect = NotificationService.subscribeRedirectPrompt(
      (notif) => {
        setRedirectNotif(notif);
      },
    );

    const cleanupListeners = NotificationService.setupListeners(
      (notif) => {},
      (response, notifItem) => {
        const data = notifItem?.data || {};
        if (data.phone || data.instagram) {
          NotificationService.handleNotificationRedirect(notifItem);
        } else if (
          data.type === "new_match" ||
          data.type === "cycle_complete"
        ) {
          if (
            navigationRef.current &&
            navigationRef.current.isReady &&
            navigationRef.current.isReady()
          ) {
            navigationRef.current.navigate("PlatformSelect");
          }
        }
      },
    );

    return () => {
      unsubRedirect();
      cleanupListeners();
    };
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        // Saved Appearance choice: applyTheme rebuilds the already-loaded style sheets.
        try {
          const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
          if (savedTheme) applyTheme(savedTheme);
        } catch (_) {}

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
            console.log(
              "[App] Restored authenticated Flint user session:",
              user.email || user.id,
            );
            setInitialUser(user);
            setInitialRoute("PlatformSelect");
          } else {
            setInitialRoute("Auth");
          }
        } catch (_) {
          setInitialRoute("Auth");
        }
      } finally {
        setIsReady(true);
      }
    };

    boot();
  }, []);

  if (!minSplashElapsed || !isReady || (!fontsLoaded && !fontError)) {
    return (
      <AppShell>
        <View style={styles.splashContainer}>
          <StatusBar
            barStyle="light-content"
            backgroundColor={theme.colors.background}
          />
          <AppLogo size={88} />
          <Image
            source={SPLASH_WORDMARK}
            style={styles.splashWordmark}
            resizeMode="contain"
            accessibilityRole="header"
            accessibilityLabel="FlirtEasy"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.splashStatus} accessibilityLiveRegion="polite">
            {updateStatus}
          </Text>
          <SafeActivityIndicator
            size={20}
            color={theme.colors.accent}
            style={styles.splashSpinner}
          />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <MotionProvider>
        <NavigationContainer ref={navigationRef} theme={buildNavigationTheme()}>
          <AppNavigator
            initialRouteName={initialRoute}
            initialUser={initialUser}
          />
          <InAppNotificationBanner
            onNavigateToStream={(notif) => {
              const data = notif?.data || {};
              if (data.type === "new_match" || data.type === "cycle_complete") {
                if (
                  navigationRef.current &&
                  navigationRef.current.isReady &&
                  navigationRef.current.isReady()
                ) {
                  navigationRef.current.navigate("PlatformSelect");
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
      </MotionProvider>
    </AppShell>
  );
}

const styles = createStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  splashMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.glow,
  },
  // Fonts may still be loading here, so the splash relies on system weights.
  // Wordmark aspect is 3.63:1; height follows the width so it never distorts.
  splashWordmark: {
    width: 232,
    height: 64,
    marginTop: theme.spacing.xl,
  },
  splashStatus: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
    textAlign: "center",
  },
  splashSpinner: {
    marginTop: theme.spacing.xxl,
  },
}));
