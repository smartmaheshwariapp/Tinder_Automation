import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PlatformSelectScreen from '../screens/PlatformSelectScreen';
import PlatformConfigScreen from '../screens/PlatformConfigScreen';
import BrowserScreen from '../screens/BrowserScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PlatformSelect"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F0F13' },
      }}
    >
      <Stack.Screen name="PlatformSelect" component={PlatformSelectScreen} />
      <Stack.Screen name="PlatformConfig" component={PlatformConfigScreen} />
      <Stack.Screen name="Browser" component={BrowserScreen} />
    </Stack.Navigator>
  );
}

