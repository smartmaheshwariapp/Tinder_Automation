import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContentTransition, MotionTouchable as Button } from '../common/Motion';
import { theme } from '../../theme';
import { getTinderAuthState, subscribeTinderAuthState } from '../../utils/sessionManager';
import { collectionLists } from '../../utils/tinderCollectionsModel';
import {
  activateCollections, disconnectCollections,
  getCollections, refreshConversations, subscribeCollections,
} from '../../services/tinderCollections';

const TABS = {
  swiped: { label: 'Swiped', icon: 'heart', color: '#FF5A7D', tint: 'rgba(255,90,125,0.14)' },
  strong: { label: 'Strong', icon: 'sparkles', color: '#FFB36B', tint: 'rgba(255,179,107,0.14)' },
  chatting: { label: 'Chats', icon: 'chatbubbles', color: '#7DDFC0', tint: 'rgba(125,223,192,0.13)' },
};

const fullLabel = tab => tab === 'strong' ? 'Strong matches' : tab === 'chatting' ? 'Conversations' : 'Swiped profiles';
const formatTime = value => {
  if (!value) return '';
  const ago = Date.now() - value;
  if (ago < 60000) return 'Now';
  if (ago < 3600000) return `${Math.floor(ago / 60000)}m`;
  if (ago < 86400000) return `${Math.floor(ago / 3600000)}h`;
  if (ago < 604800000) return `${Math.floor(ago / 86400000)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function Avatar({ profile, large = false }) {
  const [failed, setFailed] = useState(false);
  const size = large ? styles.avatarLarge : styles.avatar;
  if (profile?.photos?.[0] && !failed) {
    return <View style={[styles.avatarFrame, size]}><Image source={{ uri: profile.photos[0] }} style={[size, styles.avatarImage]} onError={() => setFailed(true)} /></View>;
  }
  return <LinearGradient colors={['#3B2438', '#211422']} style={[styles.avatarFrame, size, styles.placeholder]}>
    <Ionicons name="person-outline" size={large ? 38 : 24} color={theme.colors.textSecondary} />
  </LinearGradient>;
}

function Score({ value }) {
  const color = value >= 80 ? TABS.chatting.color : TABS.strong.color;
  return <View style={[styles.score, { borderColor: color }]}>
    <Text style={[styles.scoreValue, { color }]}>{value}</Text><Text style={styles.scoreUnit}>%</Text>
  </View>;
}

function Summary({ type, count, active, onPress }) {
  const item = TABS[type];
  return <Button style={[styles.summary, active && { borderColor: item.color }]} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
    <View style={[styles.summaryIcon, { backgroundColor: item.tint }]}><Ionicons name={item.icon} size={18} color={item.color} /></View>
    <Text style={styles.summaryCount}>{count.toLocaleString()}</Text>
    <Text style={styles.summaryLabel}>{item.label}</Text>
  </Button>;
}

function ProfileRow({ item, tab, ownerId, onPress }) {
  const profile = item.profile;
  const active = TABS[tab];
  const latest = item.messages?.[0];
  const subtitle = tab === 'swiped'
    ? item.action === 'like' ? (item.matched ? 'Liked · It’s a match' : 'You liked this profile') : 'You passed this profile'
    : tab === 'strong' ? item.reasons?.[0] || 'High estimated compatibility'
      : `${latest?.senderId === ownerId ? 'You: ' : ''}${latest?.text || 'Open conversation'}`;
  return <Button style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${profile?.name || 'profile'} details`}>
    <Avatar profile={profile} />
    <View style={styles.rowCopy}>
      <View style={styles.nameLine}><Text style={styles.name} numberOfLines={1}>{profile?.name || 'Tinder profile'}</Text>
        {tab === 'chatting' && <Text style={styles.time}>{formatTime(item.lastActivityAt)}</Text>}
      </View>
      <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      <View style={styles.meta}>
        {tab === 'swiped' && <View style={[styles.pill, { backgroundColor: active.tint }]}>
          <Ionicons name={item.action === 'like' ? 'heart' : 'close'} size={10} color={active.color} />
          <Text style={[styles.pillText, { color: active.color }]}>{item.action === 'like' ? 'LIKED' : 'PASSED'}</Text>
        </View>}
        {tab === 'strong' && <Text style={styles.metaText}>{item.reasons?.[1] || 'Compatibility estimate'}</Text>}
        {tab === 'chatting' && <><View style={[styles.onlineDot, { backgroundColor: active.color }]} /><Text style={styles.metaText}>Active conversation</Text></>}
      </View>
    </View>
    {tab === 'strong' ? <Score value={item.score} /> : <View style={styles.chevron}><Ionicons name="chevron-forward" size={15} color={theme.colors.textSecondary} /></View>}
  </Button>;
}

function Empty({ tab, loading }) {
  const item = TABS[tab];
  const text = tab === 'swiped' ? 'New likes and passes will appear here.'
    : tab === 'strong' ? 'Insights appear as profile interests and intentions are collected.'
      : 'Refresh Tinder to import active conversations and recent messages.';
  return <View style={styles.empty}>
    <View style={[styles.emptyIcon, { backgroundColor: item.tint }]}>{loading ? <ActivityIndicator color={item.color} /> : <Ionicons name={item.icon} size={24} color={item.color} />}</View>
    <Text style={styles.emptyTitle}>{loading ? 'Updating connections' : `No ${fullLabel(tab).toLowerCase()} yet`}</Text>
    <Text style={styles.emptyText}>{text}</Text>
  </View>;
}

export default function TinderCollections({ settings, onConnect }) {
  const [state, setState] = useState(getCollections);
  const [tab, setTab] = useState('swiped');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const update = auth => auth?.isLoggedIn && auth?.token ? activateCollections(auth.token) : disconnectCollections();
    const stop = subscribeCollections(setState);
    update(getTinderAuthState());
    const stopAuth = subscribeTinderAuthState(update);
    return () => { stop(); stopAuth(); };
  }, []);
  const lists = useMemo(() => collectionLists(state.data, state.own, settings), [state.data, state.own, settings]);
  const entries = lists[tab];
  const active = TABS[tab];
  const previewLimit = tab === 'swiped' ? 10 : 3;
  const close = () => { setOpen(false); setSelected(null); };
  const openItem = item => { setSelected(item); setOpen(true); };

  return <View style={styles.section}>
    <View style={styles.header}>
      <View style={styles.headerIcon}><Ionicons name="people" size={18} color={theme.colors.primary} /></View>
      <View style={styles.headerCopy}><Text style={styles.eyebrow}>CONNECTION INTELLIGENCE</Text><Text style={styles.heading}>Your connections</Text></View>
      {state.data && <View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>}
    </View>

    {!state.data ? <LinearGradient colors={['rgba(255,51,102,0.18)', 'rgba(255,170,128,0.08)', '#201428']} style={styles.connect}>
      <View style={styles.peopleArt}><View style={styles.artPerson}><Ionicons name="person" size={17} color={theme.colors.textSecondary} /></View>
        <LinearGradient colors={[theme.colors.primary, theme.colors.secondary]} style={styles.artHeart}><Ionicons name="heart" size={27} color="#FFF" /></LinearGradient>
        <View style={styles.artPerson}><Ionicons name="person" size={17} color={theme.colors.textSecondary} /></View>
      </View>
      <Text style={styles.connectTitle}>{state.loading ? 'Connecting your Tinder data…' : 'See every connection clearly'}</Text>
      <Text style={styles.connectText}>Track swipes, find promising profiles and continue active conversations from one beautiful dashboard.</Text>
      <Button style={styles.connectButton} onPress={onConnect} disabled={state.loading}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.accent, theme.colors.secondary]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={styles.buttonGradient}>
          {state.loading ? <ActivityIndicator color="#FFF" /> : <Ionicons name="link" size={18} color="#FFF" />}<Text style={styles.buttonText}>{state.loading ? 'Connecting…' : 'Connect Tinder'}</Text>
        </LinearGradient>
      </Button>
      {!!state.error && <Text style={styles.error}>{state.error}</Text>}
    </LinearGradient> : <>
      <View style={styles.summaries}>{Object.keys(TABS).map(type => <Summary key={type} type={type} count={lists[type].length} active={tab === type} onPress={() => setTab(type)} />)}</View>
      <View style={styles.card}>
        <View style={styles.tabs}>{Object.entries(TABS).map(([type, item]) => <Button key={type} style={[styles.tab, tab === type && styles.tabActive]} onPress={() => setTab(type)} accessibilityRole="tab" accessibilityState={{ selected: tab === type }}>
          <Ionicons name={tab === type ? item.icon : `${item.icon}-outline`} size={14} color={tab === type ? item.color : theme.colors.muted} />
          <Text style={[styles.tabText, tab === type && styles.tabTextActive]}>{item.label}</Text>
        </Button>)}</View>
        <ContentTransition transitionKey={tab} style={styles.content}>
          <View style={styles.listHeader}><View><Text style={styles.listTitle}>{fullLabel(tab)}</Text><Text style={styles.listCount}>{entries.length} {entries.length === 1 ? 'profile' : 'profiles'}</Text></View>
            {entries.length > previewLimit && <Button style={styles.viewAll} onPress={() => { setSelected(null); setOpen(true); }}><Text style={[styles.viewAllText, { color: active.color }]}>View all</Text><Ionicons name="arrow-forward" size={14} color={active.color} /></Button>}
          </View>
          {tab === 'strong' && <View style={styles.note}><Ionicons name="information-circle-outline" size={15} color={theme.colors.info} /><Text style={styles.noteText}>Estimated from shared profile details. This is not a Tinder score.</Text></View>}
          {!!state.error && <Text style={styles.error}>{state.error}</Text>}
          {tab === 'chatting' && !!state.conversationError && <Text style={styles.error}>{state.conversationError}</Text>}
          {entries.slice(0, previewLimit).map((item, index) => <ProfileRow key={item.id || item.profileId || item.profile?.id || index} item={item} tab={tab} ownerId={state.data?.ownerId} onPress={() => openItem(item)} />)}
          {!entries.length && <Empty tab={tab} loading={state.loading} />}
        </ContentTransition>
        {tab === 'chatting' && <Button style={styles.refresh} disabled={state.loading} onPress={refreshConversations}>
          {state.loading ? <ActivityIndicator size="small" color={theme.colors.text} /> : <Ionicons name="refresh" size={17} color={theme.colors.text} />}
          <Text style={styles.refreshText}>{state.loading ? 'Refreshing conversations…' : 'Refresh conversations'}</Text>
        </Button>}
      </View>
      <View style={styles.sync}><Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.success} />
        <Text style={styles.syncText}>Private and saved on this device</Text>
      </View>
    </>}

    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
      <View style={[styles.modal, { paddingTop: insets.top }]}>
        <View style={styles.modalHeader}><Button style={styles.close} onPress={selected ? () => setSelected(null) : close}><Ionicons name={selected ? 'arrow-back' : 'close'} size={21} color={theme.colors.text} /></Button>
          <View style={styles.modalHeading}><Text style={styles.modalEyebrow}>{selected ? active.label.toUpperCase() : 'YOUR CONNECTIONS'}</Text><Text style={styles.modalTitle} numberOfLines={1}>{selected?.profile?.name || fullLabel(tab)}</Text></View>
          <View style={[styles.modalType, { backgroundColor: active.tint }]}><Ionicons name={active.icon} size={18} color={active.color} /></View>
        </View>
        {selected ? <ScrollView contentContainerStyle={[styles.details, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['rgba(255,51,102,0.16)', 'rgba(255,170,128,0.04)', 'transparent']} style={styles.hero}><Avatar profile={selected.profile} large /><Text style={styles.detailName}>{selected.profile?.name || 'Tinder profile'}</Text>{selected.score != null && <Score value={selected.score} />}{!!selected.profile?.bio && <Text style={styles.bio}>{selected.profile.bio}</Text>}</LinearGradient>
          {!!selected.reasons?.length && <View style={styles.detailCard}><Text style={styles.detailLabel}>WHY YOU MAY CONNECT</Text><View style={styles.chips}>{selected.reasons.map(reason => <View key={reason} style={styles.reason}><Ionicons name="sparkles" size={12} color={TABS.strong.color} /><Text style={styles.reasonText}>{reason}</Text></View>)}</View><Text style={styles.disclaimer}>Estimated fit: {selected.score}/100. Missing profile data does not increase the score.</Text></View>}
          {!!selected.profile?.interests?.length && <View style={styles.detailCard}><Text style={styles.detailLabel}>INTERESTS</Text><View style={styles.chips}>{selected.profile.interests.map(value => <View key={value} style={styles.interest}><Text style={styles.interestText}>{value}</Text></View>)}</View></View>}
          {!!selected.action && <View style={styles.actionDetail}><View style={[styles.actionIcon, { backgroundColor: active.tint }]}><Ionicons name={selected.action === 'like' ? 'heart' : 'close'} size={18} color={active.color} /></View><View><Text style={styles.actionTitle}>{selected.action === 'like' ? 'You liked this profile' : 'You passed this profile'}</Text><Text style={styles.actionTime}>{selected.swipedAt ? new Date(selected.swipedAt).toLocaleString() : 'Recently'}</Text></View></View>}
          {!!selected.messages?.length && <View style={styles.detailCard}><Text style={styles.detailLabel}>RECENT MESSAGES</Text>{selected.messages.map(message => { const mine = message.senderId === state.data?.ownerId; return <View key={message.id} style={[styles.message, mine && styles.mine]}><Text style={styles.sender}>{mine ? 'YOU' : selected.profile?.name?.toUpperCase() || 'MATCH'}</Text><Text style={styles.messageText}>{message.text || 'Media message'}</Text>{!!message.sentAt && <Text style={styles.messageTime}>{new Date(message.sentAt).toLocaleString()}</Text>}</View>; })}</View>}
        </ScrollView> : <FlatList data={entries} keyExtractor={(item, index) => String(item.id || item.profileId || item.profile?.id || index)} renderItem={({ item }) => <ProfileRow item={item} tab={tab} ownerId={state.data?.ownerId} onPress={() => setSelected(item)} />} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} ListEmptyComponent={<Empty tab={tab} loading={state.loading} />} contentContainerStyle={[styles.modalList, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false} />}
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  section:{gap:14},header:{flexDirection:'row',alignItems:'center',gap:12},headerIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,51,102,.12)',borderWidth:1,borderColor:'rgba(255,94,126,.18)'},headerCopy:{flex:1},eyebrow:{...theme.type.caption,color:theme.colors.secondary,fontFamily:theme.fonts.label,letterSpacing:1,fontSize:9},heading:{...theme.type.section,color:theme.colors.text,fontSize:20,letterSpacing:-.4},live:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:6,borderRadius:99,backgroundColor:'rgba(97,214,163,.09)',borderWidth:1,borderColor:'rgba(97,214,163,.18)'},liveDot:{width:6,height:6,borderRadius:3,backgroundColor:theme.colors.success},liveText:{...theme.type.caption,color:theme.colors.success,fontFamily:theme.fonts.label,fontSize:9,letterSpacing:.8},
  connect:{padding:22,borderRadius:26,borderWidth:1,borderColor:'rgba(255,139,149,.18)',alignItems:'center'},peopleArt:{height:70,flexDirection:'row',alignItems:'center',gap:18,marginBottom:10},artPerson:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'#2D1C2C',borderWidth:1,borderColor:theme.colors.border},artHeart:{width:58,height:58,borderRadius:21,alignItems:'center',justifyContent:'center',...theme.shadow},connectTitle:{...theme.type.section,color:theme.colors.text,fontSize:20,textAlign:'center'},connectText:{...theme.type.body,color:theme.colors.muted,fontSize:13,lineHeight:20,textAlign:'center',marginTop:6,maxWidth:360},connectButton:{alignSelf:'stretch',borderRadius:16,overflow:'hidden',marginTop:18},buttonGradient:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:18},buttonText:{...theme.type.label,color:'#FFF'},error:{...theme.type.caption,color:theme.colors.error,textAlign:'center',marginTop:8},
  summaries:{flexDirection:'row',gap:9},summary:{flex:1,minHeight:112,borderRadius:20,padding:12,backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.divider,alignItems:'flex-start',justifyContent:'space-between'},summaryIcon:{width:32,height:32,borderRadius:11,alignItems:'center',justifyContent:'center'},summaryCount:{fontFamily:theme.fonts.heading,color:theme.colors.text,fontSize:24,lineHeight:28,fontVariant:['tabular-nums'],letterSpacing:-.7},summaryLabel:{...theme.type.caption,color:theme.colors.muted,fontSize:10},
  card:{borderRadius:26,padding:13,gap:14,backgroundColor:theme.colors.elevated,borderWidth:1,borderColor:theme.colors.border},tabs:{flexDirection:'row',gap:4,padding:4,borderRadius:17,backgroundColor:'#120A15',borderWidth:1,borderColor:theme.colors.divider},tab:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:4,borderRadius:13},tabActive:{backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.border},tabText:{...theme.type.caption,color:theme.colors.muted,fontFamily:theme.fonts.label,fontSize:10},tabTextActive:{color:theme.colors.text},content:{gap:9},listHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:3},listTitle:{...theme.type.section,color:theme.colors.text,fontSize:16,lineHeight:22},listCount:{...theme.type.caption,color:theme.colors.muted,fontSize:10},viewAll:{flexDirection:'row',alignItems:'center',gap:5,minHeight:36},viewAllText:{...theme.type.caption,fontFamily:theme.fonts.label},note:{flexDirection:'row',gap:7,padding:10,borderRadius:12,backgroundColor:'rgba(188,167,255,.07)'},noteText:{...theme.type.caption,color:theme.colors.textSecondary,flex:1,fontSize:10,lineHeight:15},
  row:{flexDirection:'row',alignItems:'center',gap:12,minHeight:86,padding:11,borderRadius:19,backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.divider},avatarFrame:{borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.1)'},avatar:{width:54,height:64},avatarLarge:{width:108,height:126,borderRadius:27},avatarImage:{resizeMode:'cover'},placeholder:{alignItems:'center',justifyContent:'center'},rowCopy:{flex:1,minWidth:0},nameLine:{flexDirection:'row',alignItems:'center',gap:8},name:{...theme.type.label,color:theme.colors.text,fontFamily:theme.fonts.heading,fontSize:15,flex:1},time:{...theme.type.caption,color:theme.colors.muted,fontSize:9},subtitle:{...theme.type.caption,color:theme.colors.textSecondary,fontSize:11,lineHeight:16,marginTop:3},meta:{minHeight:19,flexDirection:'row',alignItems:'center',gap:6,marginTop:5},pill:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:99},pillText:{fontFamily:theme.fonts.label,fontSize:8,letterSpacing:.65},metaText:{...theme.type.caption,color:theme.colors.muted,fontSize:9,flexShrink:1},onlineDot:{width:6,height:6,borderRadius:3},chevron:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:theme.colors.elevated,borderWidth:1,borderColor:theme.colors.divider},score:{width:46,height:46,borderRadius:23,borderWidth:2,alignItems:'center',justifyContent:'center',flexDirection:'row',backgroundColor:'#120A15'},scoreValue:{fontFamily:theme.fonts.heading,fontSize:14},scoreUnit:{...theme.type.caption,color:theme.colors.muted,fontSize:7,marginTop:4},
  empty:{alignItems:'center',padding:22,borderRadius:19,backgroundColor:theme.colors.surface,borderWidth:1,borderStyle:'dashed',borderColor:theme.colors.border},emptyIcon:{width:48,height:48,borderRadius:17,alignItems:'center',justifyContent:'center',marginBottom:10},emptyTitle:{...theme.type.label,color:theme.colors.text,fontFamily:theme.fonts.heading},emptyText:{...theme.type.caption,color:theme.colors.muted,textAlign:'center',marginTop:5},refresh:{minHeight:47,borderRadius:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#2A1929',borderWidth:1,borderColor:theme.colors.border},refreshText:{...theme.type.label,color:theme.colors.text,fontSize:12},sync:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,minHeight:26},syncText:{...theme.type.caption,color:theme.colors.muted,fontSize:10},retry:{minHeight:30,justifyContent:'center',paddingHorizontal:6},retryText:{...theme.type.caption,color:theme.colors.warning,fontFamily:theme.fonts.label},
  modal:{flex:1,backgroundColor:theme.colors.background},modalHeader:{minHeight:72,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:18,borderBottomWidth:1,borderBottomColor:theme.colors.divider},close:{width:42,height:42,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.border},modalHeading:{flex:1},modalEyebrow:{...theme.type.caption,color:theme.colors.muted,fontFamily:theme.fonts.label,fontSize:9,letterSpacing:.9},modalTitle:{...theme.type.section,color:theme.colors.text,fontSize:18},modalType:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center'},modalList:{width:'100%',maxWidth:620,alignSelf:'center',padding:18},details:{width:'100%',maxWidth:620,alignSelf:'center',paddingHorizontal:18,gap:14},hero:{alignItems:'center',paddingTop:28,paddingBottom:22,paddingHorizontal:20,borderBottomLeftRadius:28,borderBottomRightRadius:28},detailName:{...theme.type.title,color:theme.colors.text,marginTop:14,marginBottom:10},bio:{...theme.type.body,color:theme.colors.textSecondary,textAlign:'center',fontSize:13,lineHeight:20,marginTop:13},detailCard:{gap:10,padding:17,borderRadius:21,backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.divider},detailLabel:{...theme.type.caption,color:theme.colors.secondary,fontFamily:theme.fonts.label,fontSize:9,letterSpacing:1},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},reason:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:99,backgroundColor:'rgba(255,179,107,.1)'},reasonText:{...theme.type.caption,color:theme.colors.textSecondary,fontSize:10},interest:{paddingHorizontal:11,paddingVertical:7,borderRadius:99,backgroundColor:theme.colors.elevated},interestText:{...theme.type.caption,color:theme.colors.textSecondary,fontSize:10},disclaimer:{...theme.type.caption,color:theme.colors.muted,fontSize:9},actionDetail:{flexDirection:'row',alignItems:'center',gap:12,padding:15,borderRadius:20,backgroundColor:theme.colors.surface,borderWidth:1,borderColor:theme.colors.divider},actionIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},actionTitle:{...theme.type.label,color:theme.colors.text},actionTime:{...theme.type.caption,color:theme.colors.muted,fontSize:10},message:{alignSelf:'flex-start',maxWidth:'88%',gap:4,padding:12,borderRadius:16,borderTopLeftRadius:5,backgroundColor:theme.colors.elevated},mine:{alignSelf:'flex-end',borderTopLeftRadius:16,borderTopRightRadius:5,backgroundColor:'rgba(255,51,102,.14)'},sender:{...theme.type.caption,color:theme.colors.secondary,fontFamily:theme.fonts.label,fontSize:8,letterSpacing:.7},messageText:{...theme.type.body,color:theme.colors.text,fontSize:13,lineHeight:19},messageTime:{...theme.type.caption,color:theme.colors.muted,fontSize:8},
});
