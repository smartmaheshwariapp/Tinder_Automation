import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import PlatformSelectScreen from '../screens/PlatformSelectScreen';
import PlatformConfigScreen from '../screens/PlatformConfigScreen';
import BrowserScreen from '../screens/BrowserScreen';
import CloudDashboardScreen from '../screens/CloudDashboardScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#233D32' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PlatformSelect" component={PlatformSelectScreen} />
      <Stack.Screen name="CloudDashboard" component={CloudDashboardScreen} />
      <Stack.Screen name="PlatformConfig" component={PlatformConfigScreen} />
      <Stack.Screen name="Browser" component={BrowserScreen} />
    </Stack.Navigator>
  );
}

