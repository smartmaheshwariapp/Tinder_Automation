import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';

const PLATFORMS = [
  { id: 'tinder', name: 'Tinder', color: '#FE3C72', desc: 'Auto-swiping & AI replies' },
  { id: 'bumble', name: 'Bumble', color: '#FFCB37', desc: 'Female-first automation' },
  { id: 'hinge', name: 'Hinge', color: '#1B1A1F', desc: 'Profile likes & comments' },
  { id: 'aisle', name: 'Aisle', color: '#8E2DE2', desc: 'Premium local auto-match' },
];

export default function PlatformSelectScreen({ navigation }) {
  // Configured production domains for backend stream and API routing
  const [vpsUrl, setVpsUrl] = useState('https://stream.smartmaheshwari.com/?usr=User&pwd=admin');
  const [proxyIp, setProxyIp] = useState('jestcsld:lhwbi2hzo3eg@198.23.243.226:1080');

  const handleSelect = (platform) => {
    navigation.navigate('PlatformConfig', {
      platform: platform.name,
      vpsUrl: vpsUrl,
      proxyIp: proxyIp,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>FlirtEasy</Text>
          <Text style={styles.subtitle}>Virtual Browser & AI swiper control panel</Text>
        </View>

        {/* Platform Selection */}
        <Text style={styles.sectionTitle}>Select Active Platform</Text>
        <View style={styles.grid}>
          {PLATFORMS.map((platform) => (
            <TouchableOpacity
              key={platform.id}
              style={[styles.card, { borderLeftColor: platform.color }]}
              onPress={() => handleSelect(platform)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{platform.name}</Text>
                <View style={[styles.badge, { backgroundColor: platform.color + '20' }]}>
                  <Text style={[styles.badgeText, { color: platform.color }]}>Ready</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{platform.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F13',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E9F',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'column',
    gap: 15,
  },
  card: {
    backgroundColor: '#181820',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A35',
    borderLeftWidth: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 13,
    color: '#8E8E9F',
    lineHeight: 18,
  },
});

