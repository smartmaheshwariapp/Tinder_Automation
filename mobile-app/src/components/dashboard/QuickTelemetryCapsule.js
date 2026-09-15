import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
function format(value) { const n=Number(value); return Number.isFinite(n) ? Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0,n)) : '0'; }
export default function QuickTelemetryCapsule({ lifetimeStats }) {
  const s=lifetimeStats || {};
  const metrics=[
    { label:'Swipes', icon:'heart-outline', value:s.totalSwipes ?? s.totalLikes ?? s.swipes ?? 0, detail:s.todaySwipes != null || s.todayLikes != null ? format(s.todaySwipes ?? s.todayLikes)+' today' : 'All time', color:theme.colors.accent },
    { label:'Messages', icon:'chatbubble-outline', value:s.totalMessages ?? s.messagesSent ?? s.messages ?? 0, detail:s.todayMessages != null ? format(s.todayMessages)+' today' : 'All time', color:theme.colors.info },
    { label:'Matches', icon:'people-outline', value:s.totalMatches ?? s.matchesCreated ?? s.matches ?? 0, detail:format(s.activeChats ?? s.activeConversations ?? 0)+' active chats', color:theme.colors.success },
  ];
  return <View style={styles.grid}>{metrics.map(m=><View style={styles.card} key={m.label} accessible accessibilityLabel={m.label+': '+m.value+'. '+m.detail}>
    <View style={[styles.icon,{backgroundColor:m.color+'15'}]}><Ionicons name={m.icon} size={17} color={m.color}/></View>
    <Text style={styles.value}>{format(m.value)}</Text>
    <Text style={styles.label}>{m.label}</Text>
    <Text style={styles.detail}>{m.detail}</Text>
  </View>)}</View>;
}
const styles=StyleSheet.create({
  grid:{flexDirection:'row',gap:10,marginBottom:20},
  card:{flex:1,minWidth:0,backgroundColor:theme.colors.surface,borderRadius:20,paddingVertical:16,paddingHorizontal:12,gap:5},
  icon:{width:32,height:32,borderRadius:11,alignItems:'center',justifyContent:'center',marginBottom:7},
  value:{...theme.type.title,color:theme.colors.text,fontVariant:['tabular-nums']},
  label:{...theme.type.caption,fontFamily:theme.fonts.label,color:theme.colors.textSecondary},
  detail:{...theme.type.caption,color:theme.colors.muted},
});
