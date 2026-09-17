import { theme as uiTheme } from "../theme";
import React from "react";
import { MotionProvider } from "../components/common/Motion";
import useReducedMotion from "../hooks/useReducedMotion";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthScreen from "../screens/AuthScreen";
import LoginScreen from "../screens/LoginScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import PlatformSelectScreen from "../screens/PlatformSelectScreen";
import PlatformConfigScreen from "../screens/PlatformConfigScreen";
import BrowserScreen from "../screens/BrowserScreen";
import CloudDashboardScreen from "../screens/CloudDashboardScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator({
  initialRouteName = "Auth",
  initialUser = null,
}) {
  const reducedMotion = useReducedMotion();
  return (
    <MotionProvider>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: uiTheme.colors.background,
            overflow: "hidden",
          },
          animation: reducedMotion ? "none" : "slide_from_right",
        }}
      >
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen
          name="PlatformSelect"
          component={PlatformSelectScreen}
          initialParams={
            initialUser
              ? { user: initialUser, userId: initialUser.id }
              : undefined
          }
        />
        <Stack.Screen name="CloudDashboard" component={CloudDashboardScreen} />
        <Stack.Screen name="PlatformConfig" component={PlatformConfigScreen} />
        <Stack.Screen name="Browser" component={BrowserScreen} />
      </Stack.Navigator>
    </MotionProvider>
  );
}
