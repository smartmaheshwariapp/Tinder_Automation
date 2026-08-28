import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthScreen from '../screens/AuthScreen';
import PlatformSelectScreen from '../screens/PlatformSelectScreen';
import PlatformConfigScreen from '../screens/PlatformConfigScreen';
import BrowserScreen from '../screens/BrowserScreen';
import CloudDashboardScreen from '../screens/CloudDashboardScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PlatformSelect"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#08070D' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="PlatformSelect" component={PlatformSelectScreen} />
      <Stack.Screen name="CloudDashboard" component={CloudDashboardScreen} />
      <Stack.Screen name="PlatformConfig" component={PlatformConfigScreen} />
      <Stack.Screen name="Browser" component={BrowserScreen} />
    </Stack.Navigator>
  );
}

