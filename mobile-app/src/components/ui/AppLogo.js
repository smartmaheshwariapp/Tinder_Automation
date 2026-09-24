import React from "react";
import { Image, View } from "react-native";
import { createStyles, theme } from "../../theme";

const LOGO = require("../../../assets/logo-mark.png");

/**
 * The app mark: the same artwork as the launcher icon and the splash, so the logo
 * inside the app matches the icon the user tapped to open it.
 *
 * `ring` adds a background-coloured rim for placements that sit over other content.
 */
export default function AppLogo({
  size = 72,
  ring = false,
  glow = true,
  style,
  accessibilityLabel,
}) {
  const mark = (
    <Image
      source={LOGO}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );

  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: "image", accessibilityLabel }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
      };

  if (!ring) {
    return (
      <View style={[glow && theme.shadows.glow, style]} {...a11y}>
        {mark}
      </View>
    );
  }

  const outer = size + Math.round(size * 0.14);
  return (
    <View
      style={[
        styles.ring,
        {
          width: outer,
          height: outer,
          borderRadius: Math.round(outer * 0.26),
          padding: (outer - size) / 2,
        },
        glow && theme.shadows.glow,
        style,
      ]}
      {...a11y}
    >
      {mark}
    </View>
  );
}

const styles = createStyles(() => ({
  ring: {
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
}));
