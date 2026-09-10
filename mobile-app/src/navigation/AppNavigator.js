import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from '../screens/AuthScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PlatformSelectScreen from '../screens/PlatformSelectScreen';
import PlatformConfigScreen from '../screens/PlatformConfigScreen';
import BrowserScreen from '../screens/BrowserScreen';
import CloudDashboardScreen from '../screens/CloudDashboardScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Auth"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#08050B', overflow: 'hidden' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="PlatformSelect" component={PlatformSelectScreen} />
      <Stack.Screen name="CloudDashboard" component={CloudDashboardScreen} />
      <Stack.Screen name="PlatformConfig" component={PlatformConfigScreen} />
      <Stack.Screen name="Browser" component={BrowserScreen} />
    </Stack.Navigator>
  );
}
