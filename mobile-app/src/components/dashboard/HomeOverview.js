import { theme as uiTheme } from "../../theme";
import React from "react";
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MotionTouchable as TouchableOpacity } from '../common/Motion';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ActivityIndicator from "../common/SafeActivityIndicator";
import MasterControlOrb from "./MasterControlOrb";

const titleCase = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const GOALS = {
  date: "Dates",
  phone: "Phone",
  instagram: "Socials",
  move_to_instagram: "Instagram",
  never: "Conversation",
};

export default function HomeOverview({
  stats,
  settings,
  isLoggedIn,
  starting,
  checking,
  latencyMs,
  onOpenBrowser,
  onToggleAgent,
  onAutomation,
  onSettings,
  onActivity,
}) {
  const state = stats?.agentState || {};
  const running = Boolean(
    isLoggedIn &&
    (state.isRunning ??
      (state.currentPhase &&
        !["stopped", "idle"].includes(state.currentPhase))),
  );
  const totals = stats?.lifetimeStats || state.stats || {};
  const goal =
    settings?.goal ||
    settings?.primaryGoal ||
    settings?.selectedGoal ||
    settings?.primaryGoals?.[0] ||
    "never";
  const tone =
    settings?.tone ||
    settings?.chattingStyle ||
    settings?.personalityStyle ||
    "freestyle";
  const safe = settings?.safetyMode ?? settings?.safeModeEnabled ?? true;
  const busy = starting || checking;
  const metrics = [
    {
      label: "SWIPES",
      value: totals.totalSwipes ?? totals.totalLikes ?? totals.swipes ?? 0,
      icon: "heart-outline",
      color: uiTheme.colors.primary,
    },
    {
      label: "MATCHES",
      value:
        totals.totalMatches ?? totals.matchesCreated ?? totals.matches ?? 0,
      icon: "people-outline",
      color: uiTheme.colors.secondary,
    },
    {
      label: "REPLIES",
      value:
        totals.totalMessages ?? totals.messagesSent ?? totals.messages ?? 0,
      icon: "chatbubble-outline",
      color: "#6ED2B1",
    },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity
        style={styles.instance}
        onPress={onOpenBrowser}
        disabled={starting}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={
          isLoggedIn ? "Open Tinder account" : "Connect Tinder account"
        }
      >
        <View style={styles.flameWrap}>
          <LinearGradient
            colors={[
              uiTheme.colors.primary,
              uiTheme.colors.accent,
              uiTheme.colors.secondary,
            ]}
            style={styles.flame}
          >
            <Ionicons name="flame" size={29} color="#FFFFFF" />
          </LinearGradient>
          <View style={[styles.onlineDot, !isLoggedIn && styles.offlineDot]} />
        </View>
        <View style={styles.instanceInfo}>
          <View style={styles.instanceTitleRow}>
            <Text style={styles.instanceTitle}>Tinder Instance</Text>
            <View
              style={[styles.liveBadge, !isLoggedIn && styles.offlineBadge]}
            >
              <Text
                style={[styles.liveText, !isLoggedIn && styles.offlineText]}
              >
                {isLoggedIn ? "LIVE" : "OFFLINE"}
              </Text>
            </View>
          </View>
          <View style={styles.instanceMetaRow}>
            <Text style={styles.location} numberOfLines={1}>
              {settings?.locationCity || "Choose your location"}
            </Text>
            {isLoggedIn && (
              <View
                style={[
                  styles.planBadge,
                  settings?.userProfile?.tinderPlan === "platinum" && styles.planBadgePlatinum,
                  settings?.userProfile?.tinderPlan === "gold" && styles.planBadgeGold,
                  settings?.userProfile?.tinderPlan === "plus" && styles.planBadgePlus,
                ]}
              >
                <Text
                  style={[
                    styles.planBadgeText,
                    settings?.userProfile?.tinderPlan === "platinum" && styles.planTextPlatinum,
                    settings?.userProfile?.tinderPlan === "gold" && styles.planTextGold,
                    settings?.userProfile?.tinderPlan === "plus" && styles.planTextPlus,
                  ]}
                >
                  {settings?.userProfile?.tinderPlan === "platinum"
                    ? "💎 Platinum"
                    : settings?.userProfile?.tinderPlan === "gold"
                      ? "👑 Gold"
                      : settings?.userProfile?.tinderPlan === "plus"
                        ? "⚡ Plus"
                        : "Free"}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.latency}>
          <Text style={styles.latencyLabel}>LATENCY</Text>
          <Text style={styles.latencyValue}>
            {isLoggedIn && Number.isFinite(latencyMs)
              ? `${Math.round(latencyMs)}ms`
              : "—"}
          </Text>
        </View>
        {starting ? (
          <ActivityIndicator size="small" color={uiTheme.colors.primary} />
        ) : (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={uiTheme.colors.muted}
          />
        )}
      </TouchableOpacity>

      <View style={styles.agentCard}>
        <View style={styles.cardHeading}>
          <View style={styles.stateCopy}>
            <Text style={styles.eyebrow}>SYSTEM STATE</Text>
            <Text style={styles.stateTitle}>
              {busy
                ? "Connecting"
                : !isLoggedIn
                  ? "Not Connected"
                  : state?.waitingReason === "safety_lock"
                    ? "Safety Lock"
                    : running
                      ? (state?.currentPhase === "messaging"
                          ? "Agent Messaging"
                          : state?.currentPhase === "transitioning"
                            ? "Agent Cooldown"
                            : state?.currentPhase === "waiting" || state?.currentPhase === "polling"
                              ? "Awaiting Replies"
                              : "Agent Active")
                      : "Agent Standby"}
            </Text>
          </View>
          <View style={styles.readyBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: running ? "#48CB8D" : (!isLoggedIn ? uiTheme.colors.muted : "#FE3C72") },
              ]}
            />
            <Text style={styles.readyText}>
              {busy
                ? "Starting"
                : !isLoggedIn
                  ? "Connect to Start"
                  : state?.waitingReason === "safety_lock"
                    ? "Pacing"
                    : running
                      ? (state?.currentPhase === "messaging"
                          ? "Replying"
                          : state?.currentPhase === "transitioning"
                            ? "Resting"
                            : state?.currentPhase === "waiting" || state?.currentPhase === "polling"
                              ? "Watchdog"
                              : "Swiping")
                      : "Ready for Batch"}
            </Text>
          </View>
        </View>
        <View pointerEvents="none" style={styles.chipArtwork}>
          <Ionicons name="hardware-chip-outline" size={94} color="#28182F" />
        </View>

        <MasterControlOrb
          stats={stats}
          settings={settings}
          isLoggedIn={isLoggedIn}
          busy={busy}
          onToggleAgent={onToggleAgent}
          onOpenBrowser={onOpenBrowser}
        />

        <View style={styles.tiles}>
          {[
            {
              label: "GOAL",
              value: GOALS[goal] || titleCase(goal),
              icon: "flag-outline",
              action: onAutomation,
            },
            {
              label: "TONE",
              value: titleCase(tone),
              icon: "mic-outline",
              action: onAutomation,
            },
            {
              label: "SPEED",
              value: safe ? "Human" : "Fast",
              icon: "timer-outline",
              action: onSettings,
            },
          ].map((tile) => (
            <TouchableOpacity
              key={tile.label}
              style={styles.tile}
              onPress={tile.action}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${tile.label.toLowerCase()}: ${tile.value}`}
            >
              <View style={styles.tileHeader}>
                <Ionicons
                  name={tile.icon}
                  size={18}
                  color={uiTheme.colors.textSecondary}
                />
                <Text style={styles.tileLabel}>{tile.label}</Text>
              </View>
              <Text style={styles.tileValue} numberOfLines={1}>
                {tile.value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <TouchableOpacity
            key={metric.label}
            style={styles.metric}
            onPress={onActivity}
            accessibilityRole="button"
            accessibilityLabel={`${metric.value} ${metric.label.toLowerCase()}, view activity`}
          >
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>
                {Number(metric.value).toLocaleString()}
              </Text>
              <Ionicons name={metric.icon} size={17} color={metric.color} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {/* <TouchableOpacity
        style={styles.activityLink}
        onPress={onActivity}
        accessibilityRole="button"
      >
        <View style={styles.activityIcon}>
          <Ionicons
            name="pulse-outline"
            size={18}
            color={uiTheme.colors.accent}
          />
        </View>
        <View style={styles.instanceInfo}>
          <Text style={styles.activityTitle}>Your activity</Text>
          <Text style={styles.location}>Follow every new connection</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={uiTheme.colors.muted} />
      </TouchableOpacity> */}
    </ScrollView>
  );
}

export function HomeBottomNavigation({ activeTab, onSelect }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.navigationWrap, { bottom: insets.bottom + 10 }]}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={[
          "rgba(59, 32, 48, 0.9)",
          "rgba(32, 20, 40, 0.88)",
          "rgba(22, 14, 28, 0.86)",
        ]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.navigation}
        accessibilityRole="tablist"
      >
        {[
          { id: "home", icon: "home", label: "Home" },
          // {
          //   id: "browser",
          //   icon: "chatbubble-outline",
          //   label: "Tinder browser",
          // },
          { id: "automation", icon: "compass-outline", label: "Automation" },
          { id: "activity", icon: "analytics-outline", label: "Activity" },
          { id: "appSettings", icon: "settings-outline", label: "App settings" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.navSlot}
            onPress={() => onSelect(tab.id)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.id }}
            activeOpacity={0.75}
          >
            {activeTab === tab.id ? (
              <LinearGradient
                colors={[
                  uiTheme.colors.primary,
                  uiTheme.colors.accent,
                  uiTheme.colors.secondary,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.navActive}
              >
                <Ionicons name={tab.icon} size={21} color="#FFFFFF" />
              </LinearGradient>
            ) : (
              <Ionicons
                name={tab.icon}
                size={21}
                color={uiTheme.colors.muted}
              />
            )}
          </TouchableOpacity>
        ))}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 17,
    paddingBottom: 100,
    gap: 22,
  },
  instance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: uiTheme.spacing.lg,
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    borderRadius: 28,
  },
  flameWrap: { position: "relative" },
  flame: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#47D18C",
    borderWidth: 3,
    borderColor: uiTheme.colors.surface,
  },
  offlineDot: { backgroundColor: "#727277" },
  instanceInfo: { flex: 1, minWidth: 0 },
  instanceTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  instanceTitle: {
    fontFamily: "Manrope_700Bold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.label.fontSize,
    fontWeight: "normal",
    letterSpacing: -0.3,
  },
  liveBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: "#10261B",
  },
  liveText: {
    fontFamily: "Inter_800ExtraBold",
    color: "#56CE90",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 0.7,
  },
  offlineBadge: { backgroundColor: "#281824" },
  offlineText: { color: uiTheme.colors.muted },
  instanceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  location: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
  },
  planBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  planBadgePlatinum: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.45)",
  },
  planBadgeGold: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "rgba(234, 179, 8, 0.45)",
  },
  planBadgePlus: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.45)",
  },
  planBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: uiTheme.type.caption.fontSize,
    color: uiTheme.colors.muted,
    textTransform: "uppercase",
  },
  planTextPlatinum: {
    color: "#38BDF8",
  },
  planTextGold: {
    color: "#FACC15",
  },
  planTextPlus: {
    color: "#C084FC",
  },
  latency: { alignItems: "flex-end", gap: uiTheme.spacing.xs, flexShrink: 0 },
  latencyLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  latencyValue: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "normal",
    fontVariant: ["tabular-nums"],
  },
  agentCard: {
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    borderRadius: 32,
    padding: 22,
    overflow: "hidden",
  },
  cardHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: uiTheme.spacing.sm,
    alignItems: "flex-start",
    zIndex: 1,
  },
  stateCopy: { flexGrow: 1, minWidth: 170 },
  eyebrow: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    letterSpacing: 1.2,
    fontWeight: "normal",
    marginBottom: 7,
  },
  stateTitle: {
    fontFamily: "Manrope_700Bold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.title.fontSize,
    fontWeight: "normal",
    letterSpacing: -1,
  },
  readyBadge: {
    flexDirection: "row",
    gap: uiTheme.spacing.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    borderRadius: uiTheme.radius.card,
    paddingHorizontal: uiTheme.spacing.sm,
    paddingVertical: 5,
    marginTop: 1,
  },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  readyText: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.textSecondary,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  chipArtwork: { position: "absolute", right: 15, top: 38 },
  launchArea: { alignItems: "center", paddingTop: 42, paddingBottom: 31 },
  launchGlow: {
    shadowColor: uiTheme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    borderRadius: 100,
  },
  launchRing: {
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 3,
    borderTopColor: "#805044",
    borderRightColor: uiTheme.colors.secondary,
    borderBottomColor: uiTheme.colors.primary,
    borderLeftColor: "#3B1C32",
    padding: uiTheme.spacing.sm,
    transform: [{ rotate: "-18deg" }],
  },
  innerRing: {
    flex: 1,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "#42243A",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "18deg" }],
  },
  launchButton: {
    width: 148,
    height: 148,
    borderRadius: 74,
    overflow: "hidden",
  },
  launchGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  launchLabel: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
    letterSpacing: 1.1,
    color: "#FFFFFF",
  },
  launchHint: {
    fontFamily: "Inter_400Regular",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    marginTop: 18,
    textAlign: "center",
  },
  tiles: { flexDirection: "row", gap: uiTheme.spacing.sm },
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: uiTheme.colors.elevated,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    borderRadius: 17,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: uiTheme.spacing.xs,
    gap: uiTheme.spacing.sm,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: uiTheme.spacing.xs,
  },
  tileLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  tileValue: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.text,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  metrics: { flexDirection: "row", gap: 10, marginTop: 6 },
  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: uiTheme.colors.surface,
    borderWidth: 1,
    borderColor: uiTheme.colors.border,
    borderRadius: 19,
    padding: 15,
    gap: 5,
  },
  metricLabel: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.muted,
    fontSize: uiTheme.type.caption.fontSize,
    fontWeight: "normal",
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.sm,
  },
  metricValue: {
    fontFamily: "Inter_700Bold",
    color: uiTheme.colors.text,
    fontSize: 28,
    fontWeight: "normal",
  },
  activityLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiTheme.spacing.md,
    paddingHorizontal: uiTheme.spacing.xs,
    paddingBottom: 2,
  },
  activityIcon: {
    height: 39,
    width: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: "#321526",
  },
  activityTitle: {
    fontFamily: "Inter_600SemiBold",
    color: uiTheme.colors.text,
    fontSize: 13,
    fontWeight: "normal",
  },
  navigationWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 10,
    zIndex: 10,
    backgroundColor: "transparent",
  },
  navigation: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: "transparent",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 170, 128, 0.18)",
    paddingVertical: 6,
    paddingHorizontal: uiTheme.spacing.sm,
    overflow: "hidden",
  },
  navSlot: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  navActive: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
