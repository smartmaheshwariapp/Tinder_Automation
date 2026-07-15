import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';

export default function PlatformActiveScreen({ route, navigation }) {
  const { platform, vpsUrl } = route.params;
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ swipes: 0, likes: 0, matches: 0 });
  const [swipes, setSwipes] = useState([]);

  // Extract host dynamically
  let host = '127.0.0.1';
  try {
    const cleanUrl = vpsUrl.includes('://') ? vpsUrl : 'http://' + vpsUrl;
    const match = cleanUrl.match(/\/\/([^:/]+)/);
    if (match) host = match[1];
  } catch (e) {}

  const cloudApiBase = `http://${host}:3001/cloud/sessions/dev_user_1_session`;

  // Fetch session status initially and poll every 10 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch(cloudApiBase, {
        headers: { 'Authorization': 'Bearer dev_testing_token' }
      });
      const data = await response.json();
      if (data.success) {
        setIsActive(data.state === 'active');
      }

      // Fetch actual swiped profiles list
      const swipesResponse = await fetch(`${cloudApiBase}/swipes`, {
        headers: { 'Authorization': 'Bearer dev_testing_token' }
      });
      const swipesData = await swipesResponse.json();
      if (swipesData.success) {
        setSwipes(swipesData.swipes || []);
        
        // Compute real statistics from logged swipes
        const totalSwipes = swipesData.swipes.length;
        const totalLikes = swipesData.swipes.filter(s => s.action === 'like').length;
        setStats({
          swipes: totalSwipes,
          likes: totalLikes,
          matches: Math.round(totalLikes * 0.08) // Roughly 8% match conversion simulation
        });
      }
    } catch (err) {
      console.warn('[Active] Failed to fetch session status:', err);
    }
  };

  const handleToggleActive = async () => {
    setLoading(true);
    const endpoint = isActive ? `${cloudApiBase}/stop` : `${cloudApiBase}/start`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev_testing_token'
        }
      });
      const data = await response.json();
      if (data.success) {
        setIsActive(!isActive);
        Alert.alert('Success', isActive ? 'Swiping paused successfully.' : 'Swiping resumed successfully.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to toggle swiping state.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCycle = async () => {
    setLoading(true);
    // Trigger immediate swiping cycle
    try {
      const response = await fetch(`${cloudApiBase}/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev_testing_token'
        }
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Immediate swiping cycle triggered!');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to trigger immediate cycle.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async () => {
    Alert.alert(
      'Disconnect Session',
      'Are you sure you want to stop this automation session and close your profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // 1. Tell Neko orchestrator to shut down the login container
              await fetch(`http://${host}:3000/stop-session`, { method: 'POST' });
              // 2. Tell Cloud Worker to terminate session
              await fetch(cloudApiBase, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer dev_testing_token' }
              });
              navigation.replace('PlatformSelect');
            } catch (err) {
              console.warn('[Active] Failed to cleanly stop session:', err);
              navigation.replace('PlatformSelect');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>{platform} Automation</Text>
      </View>

      <View style={styles.content}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.statusText}>{isActive ? '🟢 Swiping Active (24/7 Cloud)' : '🔴 Swiping Paused'}</Text>
          </View>
          <Text style={styles.description}>
            {isActive 
              ? 'Playwright is running background tasks on the server. Your phone does not need to remain open.' 
              : 'Swiping scheduler is currently idle. Press resume to reactivate.'}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.swipes}</Text>
            <Text style={styles.statLabel}>Swipes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.likes}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.matches}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.btn, isActive ? styles.btnPause : styles.btnResume]} 
            onPress={handleToggleActive}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{isActive ? '⏸ Pause Swiping' : '▶ Resume Swiping'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.btnSecondary} 
            onPress={handleTriggerCycle}
            disabled={loading}
          >
            <Text style={styles.btnSecondaryText}>⚡ Run Swipe Cycle Now</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.btnDisconnect} 
            onPress={handleStopSession}
            disabled={loading}
          >
            <Text style={styles.btnDisconnectText}>🔌 Disconnect & Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Live Swipe Observer Section */}
        <View style={styles.observerContainer}>
          <Text style={styles.observerTitle}>👀 Live Swipe Log</Text>
          {swipes.length === 0 ? (
            <Text style={styles.noSwipesText}>No swipes logged yet. Liking cycle is preparing...</Text>
          ) : (
            <ScrollView style={styles.observerScroll} contentContainerStyle={{ gap: 10 }}>
              {swipes.map((item, idx) => (
                <View key={idx} style={styles.swipeCard}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.swipePhoto} />
                  ) : (
                    <View style={[styles.swipePhoto, { backgroundColor: '#2A2A35', justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: '#8E8E9F', fontSize: 18 }}>👤</Text>
                    </View>
                  )}
                  <View style={styles.swipeInfo}>
                    <Text style={styles.swipeName}>{item.name}{item.age ? `, ${item.age}` : ''}</Text>
                    <Text style={styles.swipeTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                  </View>
                  <View style={[styles.actionTag, { backgroundColor: item.action === 'like' ? '#10B98120' : '#EF444420' }]}>
                    <Text style={[styles.actionTagText, { color: item.action === 'like' ? '#10B981' : '#EF4444' }]}>
                      {item.action === 'like' ? '✓ LIKED' : '✕ PASSED'}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F13',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F2E',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 20,
  },
  card: {
    backgroundColor: '#181820',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  description: {
    fontSize: 14,
    color: '#8E8E9F',
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#181820',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  statNum: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E9F',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 20,
  },
  btn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  btnPause: {
    backgroundColor: '#E11D48',
  },
  btnResume: {
    backgroundColor: '#10B981',
  },
  btnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  btnSecondary: {
    backgroundColor: '#2A2A35',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: '#3F3F4E',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  btnDisconnect: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: '#E11D48',
  },
  btnDisconnectText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: 'bold',
  },
  observerContainer: {
    flex: 1,
    marginTop: 10,
    backgroundColor: '#181820',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  observerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  noSwipesText: {
    color: '#8E8E9F',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  observerScroll: {
    flex: 1,
  },
  swipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20202A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  swipePhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  swipeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  swipeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  swipeTime: {
    fontSize: 11,
    color: '#8E8E9F',
    marginTop: 2,
  },
  actionTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionTagText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
