import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Updates from 'expo-updates';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("Checking for updates...");

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
        <ActivityIndicator size="large" color="#FE3C72" />
        <Text style={styles.splashTitle}>FlirtEasy</Text>
        <Text style={styles.splashStatus}>{updateStatus}</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
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
