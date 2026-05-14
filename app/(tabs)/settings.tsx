import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  useAppTheme,
  THEMES,
  type AppPalette,
} from '../../theme/ThemeProvider';
import { useSoundSettings } from '../../context/SoundSettings';

type ThemeOption = (typeof THEMES)[number];
type Styles = ReturnType<typeof createStyles>;

const THEME_ICONS: Record<ThemeOption['key'], keyof typeof Ionicons.glyphMap> = {
  clinical: 'medkit-outline',
  aqua: 'water-outline',
  lavender: 'color-palette-outline',
  sunrise: 'sunny-outline',
  midnight: 'moon-outline',
};

function withOpacity(hexColor: string, opacity: number) {
  if (!hexColor.startsWith('#')) return hexColor;

  const normalized =
    hexColor.length === 4
      ? `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`
      : hexColor;

  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');

  return `${normalized}${alpha}`;
}

function getPreviewTones(themeOption: ThemeOption) {
  const accent = themeOption.palette.accent;
  const palette = themeOption.palette;

  return {
    accent,
    ink: themeOption.isDark ? 'rgba(248,250,252,0.92)' : palette.textPrimary,
    mutedInk: themeOption.isDark
      ? 'rgba(248,250,252,0.28)'
      : withOpacity(palette.textSecondary, 0.22),
    softSurface: themeOption.isDark
      ? 'rgba(255,255,255,0.08)'
      : palette.surfaceSecondary,
    strongSurface: themeOption.isDark
      ? 'rgba(255,255,255,0.12)'
      : palette.surface,
    accentSoft: withOpacity(accent, themeOption.isDark ? 0.24 : 0.16),
    accentGlass: withOpacity(accent, themeOption.isDark ? 0.34 : 0.22),
  };
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { themeKey, theme, setThemeKey } = useAppTheme();
  const { soundEnabled, toggleSound } = useSoundSettings();
  const palette = theme.palette;
  const styles = createStyles(palette, theme.isDark);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: theme.gradient[0] }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 84,
        },
      ]}
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerIcon}>
          <Ionicons name="settings-outline" size={20} color={palette.textPrimary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Theme and alert preferences
          </Text>
        </View>
        <View style={styles.activeThemePill}>
          <Text style={styles.activeThemePillText} numberOfLines={1}>
            {theme.name}
          </Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIcon}>
            <Ionicons name="color-palette-outline" size={19} color={palette.textPrimary} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionEyebrow}>Appearance</Text>
            <Text style={styles.sectionTitle}>Theme studio</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={styles.themeCarousel}
        >
          {THEMES.map((themeOption, index) => (
            <ThemeCard
              key={themeOption.key}
              themeOption={themeOption}
              selected={themeKey === themeOption.key}
              onPress={() => setThemeKey(themeOption.key)}
              soundEnabled={soundEnabled}
              isLast={index === THEMES.length - 1}
              styles={styles}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIcon}>
            <Ionicons name="notifications-outline" size={19} color={palette.textPrimary} />
          </View>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionEyebrow}>Alerts</Text>
            <Text style={styles.sectionTitle}>Notification sound</Text>
          </View>
        </View>

        <SoundCard
          soundEnabled={soundEnabled}
          onPress={toggleSound}
          styles={styles}
          palette={palette}
          isDark={theme.isDark}
        />
      </View>
    </ScrollView>
  );
}

function ThemeCard({
  themeOption,
  selected,
  onPress,
  soundEnabled,
  isLast,
  styles,
}: {
  themeOption: ThemeOption;
  selected: boolean;
  onPress: () => void;
  soundEnabled: boolean;
  isLast: boolean;
  styles: Styles;
}) {
  const accent = themeOption.palette.accent;
  const selectionIndicatorBaseStyle = {
    backgroundColor: themeOption.isDark
      ? 'rgba(255,255,255,0.18)'
      : 'rgba(255,255,255,0.78)',
    borderColor: themeOption.isDark
      ? 'rgba(255,255,255,0.26)'
      : 'rgba(255,255,255,0.92)',
  } as const;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeCardPressable,
        isLast && styles.themeCardPressableLast,
        pressed && styles.themeCardPressed,
      ]}
    >
      <View style={styles.themeCardShell}>
        <View
          style={[
            styles.themeCard,
            selected && styles.themeCardSelected,
          ]}
        >
          <MiniThemePreview
            themeOption={themeOption}
            soundEnabled={soundEnabled}
            variant="card"
            styles={styles}
          />

          <BlurView
            intensity={28}
            tint={themeOption.isDark ? 'dark' : 'light'}
            style={styles.themeFooter}
          >
            <View style={styles.themeFooterRow}>
              <View style={styles.themeFooterCopy}>
                <View style={styles.themeFooterTitleRow}>
                  <View
                    style={[
                      styles.themeIconWrap,
                      {
                        backgroundColor: withOpacity(
                          accent,
                          themeOption.isDark ? 0.24 : 0.16
                        ),
                      },
                    ]}
                  >
                    <Ionicons
                      name={THEME_ICONS[themeOption.key]}
                      size={14}
                      color={accent}
                    />
                  </View>
                  <Text style={styles.themeName}>{themeOption.name}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.selectionIndicator,
                  selectionIndicatorBaseStyle,
                  selected && styles.selectionIndicatorSelected,
                ]}
              >
                {selected ? <View style={styles.selectionIndicatorDot} /> : null}
              </View>
            </View>
          </BlurView>
        </View>
      </View>
    </Pressable>
  );
}

function SoundCard({
  soundEnabled,
  onPress,
  styles,
  palette,
  isDark,
}: {
  soundEnabled: boolean;
  onPress: () => void;
  styles: Styles;
  palette: AppPalette;
  isDark: boolean;
}) {
  const accent = palette.sensorColors.sound;
  const toggle = useSharedValue(soundEnabled ? 1 : 0);
  const trackInactiveColor = isDark
    ? 'rgba(255,255,255,0.16)'
    : '#D9DEE7';
  const trackActiveColor = palette.controlActive;
  const trackInactiveBorderColor = isDark
    ? 'rgba(255,255,255,0.18)'
    : '#D9DEE7';
  const trackActiveBorderColor = palette.controlActive;
  const iconInactiveColor = isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(248,250,252,0.96)';
  const iconActiveColor = withOpacity(palette.controlActive, isDark ? 0.2 : 0.1);
  const statePillInactiveColor = isDark
    ? 'rgba(255,255,255,0.06)'
    : 'rgba(248,250,252,0.96)';
  const statePillActiveColor = withOpacity(
    palette.controlActive,
    isDark ? 0.18 : 0.1
  );
  const statePillInactiveBorderColor = isDark
    ? 'rgba(255,255,255,0.06)'
    : palette.border;
  const statePillActiveBorderColor = withOpacity(
    palette.controlActive,
    isDark ? 0.24 : 0.16
  );

  useEffect(() => {
    toggle.value = withSpring(soundEnabled ? 1 : 0, {
      stiffness: 180,
      damping: 18,
      mass: 0.8,
    });
  }, [soundEnabled, toggle]);

  const animatedTrackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      toggle.value,
      [0, 1],
      [trackInactiveColor, trackActiveColor]
    ),
    borderColor: interpolateColor(
      toggle.value,
      [0, 1],
      [trackInactiveBorderColor, trackActiveBorderColor]
    ),
  }));

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(toggle.value, [0, 1], [0, 20]),
      },
    ],
    backgroundColor: interpolateColor(
      toggle.value,
      [0, 1],
      ['#FFFFFF', isDark ? '#DDEBFF' : '#FFFFFF']
    ),
  }));

  const animatedIconPlateStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(toggle.value, [0, 1], [1, 1.04]),
      },
    ],
    backgroundColor: interpolateColor(
      toggle.value,
      [0, 1],
      [iconInactiveColor, iconActiveColor]
    ),
  }));

  const animatedStatePillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      toggle.value,
      [0, 1],
      [statePillInactiveColor, statePillActiveColor]
    ),
    borderColor: interpolateColor(
      toggle.value,
      [0, 1],
      [statePillInactiveBorderColor, statePillActiveBorderColor]
    ),
  }));

  const activeBars = [14, 24, 18, 30, 22];
  const mutedBars = [6, 8, 7, 9, 7];

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: soundEnabled }}
      onPress={onPress}
    >
      <View style={styles.soundShell}>
        <LinearGradient
          colors={
            isDark
              ? [palette.surfaceSecondary, palette.surface, '#0A1424']
              : [palette.surface, '#FAFCFF', palette.surfaceSecondary]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.soundCard, soundEnabled && styles.soundCardEnabled]}
        >
          <View style={styles.soundHeaderRow}>
            <View style={styles.soundTitleGroup}>
              <Animated.View style={[styles.soundIconPlate, animatedIconPlateStyle]}>
                <Ionicons
                  name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
                  size={20}
                  color={palette.icon}
                />
              </Animated.View>

              <View>
                <Text style={styles.soundTitle}>Alert sound</Text>
                <Text style={styles.soundSubtitle}>
                  {soundEnabled ? 'Audio cues are active' : 'Silent state'}
                </Text>
              </View>
            </View>

            <Animated.View style={[styles.toggleTrack, animatedTrackStyle]}>
              <Animated.View style={[styles.toggleThumb, animatedThumbStyle]} />
            </Animated.View>
          </View>

          <View style={styles.soundFooterRow}>
            <View style={styles.soundBarsRow}>
              {activeBars.map((height, index) => (
                <View
                  key={index}
                  style={[
                    styles.soundBar,
                    {
                      height: soundEnabled ? height : mutedBars[index],
                      opacity: soundEnabled ? 1 : 0.42,
                      backgroundColor:
                        index % 2 === 0
                          ? withOpacity(accent, soundEnabled ? 0.9 : 0.48)
                          : withOpacity(accent, soundEnabled ? 0.6 : 0.34),
                    },
                  ]}
                />
              ))}
            </View>

            <Animated.View style={[styles.soundStatePill, animatedStatePillStyle]}>
              <Ionicons
                name={soundEnabled ? 'checkmark-circle-outline' : 'pause-circle-outline'}
                size={14}
                color={soundEnabled ? palette.controlActive : palette.iconMuted}
              />
              <Text
                style={[
                  styles.soundStatePillText,
                  soundEnabled && styles.soundStatePillTextActive,
                ]}
              >
                {soundEnabled ? 'Active' : 'Muted'}
              </Text>
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

function MiniThemePreview({
  themeOption,
  soundEnabled,
  variant,
  styles,
}: {
  themeOption: ThemeOption;
  soundEnabled: boolean;
  variant: 'hero' | 'card';
  styles: Styles;
}) {
  const tones = getPreviewTones(themeOption);

  return (
    <LinearGradient
      colors={themeOption.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.previewCanvas,
        variant === 'hero' ? styles.previewCanvasHero : styles.previewCanvasCard,
      ]}
    >
      <View
        style={[
          styles.previewAmbientGlow,
          { backgroundColor: withOpacity(tones.accent, themeOption.isDark ? 0.24 : 0.18) },
        ]}
      />

      <View style={styles.previewStatusRow}>
        <View style={styles.previewDotsRow}>
          <View style={[styles.previewDot, { backgroundColor: tones.ink }]} />
          <View style={[styles.previewDotSmall, { backgroundColor: tones.mutedInk }]} />
        </View>
        <View style={[styles.previewCapsule, { backgroundColor: tones.softSurface }]} />
      </View>

      <View style={styles.previewHeadlineRow}>
        <View style={styles.previewTextBlock}>
          <View
            style={[styles.previewTitleLine, { backgroundColor: tones.ink }]}
          />
          <View
            style={[styles.previewSubtitleLine, { backgroundColor: tones.mutedInk }]}
          />
        </View>

        <View
          style={[
            styles.previewSignalBubble,
            { backgroundColor: tones.accentGlass },
          ]}
        >
          <View
            style={[styles.previewSignalCore, { backgroundColor: tones.accent }]}
          />
          <View
            style={[
              styles.previewSignalWave,
              {
                backgroundColor: withOpacity(
                  tones.accent,
                  soundEnabled ? 0.5 : 0.2
                ),
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.previewWidgetRow}>
        <View
          style={[
            styles.previewWidgetPrimary,
            { backgroundColor: tones.strongSurface },
          ]}
        >
          <View
            style={[
              styles.previewWidgetLinePrimary,
              { backgroundColor: tones.ink },
            ]}
          />
          <View
            style={[
              styles.previewWidgetLineSecondary,
              { backgroundColor: tones.mutedInk },
            ]}
          />
        </View>

        <View
          style={[
            styles.previewWidgetSecondary,
            { backgroundColor: tones.softSurface },
          ]}
        >
          <View
            style={[
              styles.previewWidgetBadge,
              { backgroundColor: withOpacity(tones.accent, 0.22) },
            ]}
          />
        </View>
      </View>

      <View
        style={[
          styles.previewChartCard,
          {
            backgroundColor: tones.strongSurface,
            borderColor: themeOption.isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.5)',
          },
        ]}
      >
        <View
          style={[styles.previewGridLine, styles.previewGridLineTop, { backgroundColor: tones.mutedInk }]}
        />
        <View
          style={[styles.previewGridLine, styles.previewGridLineMiddle, { backgroundColor: tones.mutedInk }]}
        />

        <View style={styles.previewBarsRow}>
          <View
            style={[
              styles.previewBar,
              styles.previewBarShort,
              { backgroundColor: tones.mutedInk },
            ]}
          />
          <View style={[styles.previewBar, { backgroundColor: tones.mutedInk }]} />
          <View
            style={[
              styles.previewBar,
              styles.previewBarTall,
              { backgroundColor: tones.mutedInk },
            ]}
          />
          <View
            style={[
              styles.previewBar,
              styles.previewBarMedium,
              { backgroundColor: tones.mutedInk },
            ]}
          />
        </View>

        <View
          style={[
            styles.previewSparkFill,
            { backgroundColor: tones.accentSoft },
          ]}
        />

        <View style={styles.previewSpark}>
          <View
            style={[
              styles.previewSparkSegment,
              styles.previewSparkSegmentA,
              { backgroundColor: tones.accent },
            ]}
          />
          <View
            style={[
              styles.previewSparkSegment,
              styles.previewSparkSegmentB,
              { backgroundColor: tones.accent },
            ]}
          />
          <View
            style={[
              styles.previewSparkSegment,
              styles.previewSparkSegmentC,
              { backgroundColor: tones.accent },
            ]}
          />
          <View
            style={[
              styles.previewSparkSegment,
              styles.previewSparkSegmentD,
              { backgroundColor: tones.accent },
            ]}
          />

          <View style={[styles.previewSparkDot, styles.previewSparkDotA, { backgroundColor: tones.accent }]} />
          <View style={[styles.previewSparkDot, styles.previewSparkDotB, { backgroundColor: tones.accent }]} />
          <View style={[styles.previewSparkDot, styles.previewSparkDotC, { backgroundColor: tones.accent }]} />
          <View style={[styles.previewSparkDot, styles.previewSparkDotD, { backgroundColor: tones.accent }]} />
          <View style={[styles.previewSparkDot, styles.previewSparkDotE, { backgroundColor: tones.accent }]} />
        </View>
      </View>
    </LinearGradient>
  );
}

function createStyles(palette: AppPalette, isDark = false) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
    },
    headerBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 18,
    },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceSecondary,
      flexShrink: 0,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 18,
      lineHeight: 23,
      color: palette.textPrimary,
      marginBottom: 2,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: palette.textSecondary,
    },
    activeThemePill: {
      maxWidth: 116,
      minHeight: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.controlActive,
      paddingHorizontal: 11,
      flexShrink: 0,
    },
    activeThemePillText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: palette.controlTextActive,
    },
    sectionBlock: {
      marginBottom: 22,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    sectionIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceSecondary,
      flexShrink: 0,
    },
    sectionCopy: {
      flex: 1,
      minWidth: 0,
    },
    sectionEyebrow: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      textTransform: 'uppercase',
      color: palette.textSecondary,
      marginBottom: 2,
    },
    sectionTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 16,
      color: palette.textPrimary,
    },
    themeCarousel: {
      paddingLeft: 0,
      paddingRight: 4,
      paddingTop: 2,
      paddingBottom: 4,
      gap: 12,
    },
    themeCardPressable: {
      marginRight: 0,
    },
    themeCardPressableLast: {
      marginRight: 0,
    },
    themeCardPressed: {
      opacity: 0.95,
    },
    themeCardShell: {
      width: 196,
      borderRadius: 20,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.18 : 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    themeCard: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    themeCardSelected: {
      borderWidth: 2,
      borderColor: palette.controlActive,
    },
    themeFooter: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: isDark
        ? 'rgba(10,18,31,0.82)'
        : 'rgba(255,255,255,0.88)',
    },
    themeFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    themeFooterCopy: {
      flex: 1,
    },
    themeFooterTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    themeIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeName: {
      flex: 1,
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: palette.textPrimary,
    },
    selectionIndicator: {
      width: 18,
      height: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    selectionIndicatorSelected: {
      backgroundColor: palette.controlActive,
      borderColor: palette.controlActive,
    },
    selectionIndicatorDot: {
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
    },
    soundShell: {
      borderRadius: 22,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.2 : 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 9 },
      elevation: 4,
    },
    soundCard: {
      borderRadius: 22,
      overflow: 'hidden',
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
    },
    soundCardEnabled: {
      borderWidth: 2,
      borderColor: palette.controlActive,
    },
    soundHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 14,
    },
    soundTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    soundIconPlate: {
      width: 48,
      height: 48,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(255,255,255,0.92)',
    },
    soundTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      lineHeight: 19,
      color: palette.textPrimary,
      marginBottom: 2,
    },
    soundSubtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: palette.textSecondary,
    },
    toggleTrack: {
      width: 54,
      height: 32,
      borderRadius: 999,
      paddingHorizontal: 4,
      justifyContent: 'center',
      borderWidth: 1,
    },
    toggleThumb: {
      width: 22,
      height: 22,
      borderRadius: 999,
      shadowColor: palette.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    soundFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: palette.divider,
    },
    soundBarsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      height: 32,
      flex: 1,
    },
    soundBar: {
      width: 7,
      borderRadius: 999,
    },
    soundStatePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    soundStatePillText: {
      fontFamily: 'Inter-Medium',
      fontSize: 11,
      lineHeight: 14,
      color: palette.textSecondary,
    },
    soundStatePillTextActive: {
      color: palette.controlActive,
    },
    previewCanvas: {
      overflow: 'hidden',
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 10,
    },
    previewCanvasHero: {
      minHeight: 136,
    },
    previewCanvasCard: {
      minHeight: 106,
    },
    previewAmbientGlow: {
      position: 'absolute',
      width: 104,
      height: 104,
      right: -20,
      top: -18,
      borderRadius: 999,
    },
    previewStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 11,
    },
    previewDotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    previewDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    previewDotSmall: {
      width: 6,
      height: 6,
      borderRadius: 999,
    },
    previewCapsule: {
      width: 42,
      height: 9,
      borderRadius: 999,
    },
    previewHeadlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    previewTextBlock: {
      flex: 1,
      paddingRight: 12,
      gap: 6,
    },
    previewTitleLine: {
      width: '54%',
      height: 9,
      borderRadius: 999,
    },
    previewSubtitleLine: {
      width: '34%',
      height: 6,
      borderRadius: 999,
    },
    previewSignalBubble: {
      width: 32,
      height: 22,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    previewSignalCore: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    previewSignalWave: {
      width: 10,
      height: 5,
      borderRadius: 999,
    },
    previewWidgetRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 9,
    },
    previewWidgetPrimary: {
      flex: 1.1,
      borderRadius: 13,
      padding: 9,
    },
    previewWidgetSecondary: {
      width: 54,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewWidgetLinePrimary: {
      width: '62%',
      height: 7,
      borderRadius: 999,
      marginBottom: 6,
    },
    previewWidgetLineSecondary: {
      width: '42%',
      height: 5,
      borderRadius: 999,
    },
    previewWidgetBadge: {
      width: 20,
      height: 20,
      borderRadius: 999,
    },
    previewChartCard: {
      height: 50,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      paddingHorizontal: 10,
      justifyContent: 'flex-end',
    },
    previewGridLine: {
      position: 'absolute',
      left: 10,
      right: 10,
      height: 1,
      opacity: 0.55,
    },
    previewGridLineTop: {
      top: 18,
    },
    previewGridLineMiddle: {
      top: 31,
    },
    previewBarsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      height: 28,
      marginBottom: 6,
    },
    previewBar: {
      width: 8,
      height: 18,
      borderRadius: 999,
      opacity: 0.55,
    },
    previewBarShort: {
      height: 12,
    },
    previewBarTall: {
      height: 24,
    },
    previewBarMedium: {
      height: 16,
    },
    previewSparkFill: {
      position: 'absolute',
      left: '13%',
      right: '23%',
      bottom: 10,
      height: 18,
      borderRadius: 14,
    },
    previewSpark: {
      ...StyleSheet.absoluteFillObject,
    },
    previewSparkSegment: {
      position: 'absolute',
      height: 2.5,
      borderRadius: 999,
    },
    previewSparkSegmentA: {
      left: '10%',
      top: 32,
      width: '19%',
      transform: [{ rotate: '-20deg' }],
    },
    previewSparkSegmentB: {
      left: '28%',
      top: 24,
      width: '18%',
      transform: [{ rotate: '14deg' }],
    },
    previewSparkSegmentC: {
      left: '46%',
      top: 28,
      width: '20%',
      transform: [{ rotate: '-28deg' }],
    },
    previewSparkSegmentD: {
      left: '64%',
      top: 21,
      width: '18%',
      transform: [{ rotate: '18deg' }],
    },
    previewSparkDot: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 999,
    },
    previewSparkDotA: {
      left: '9%',
      top: 31,
    },
    previewSparkDotB: {
      left: '28%',
      top: 24,
    },
    previewSparkDotC: {
      left: '46%',
      top: 28,
    },
    previewSparkDotD: {
      left: '65%',
      top: 19,
    },
    previewSparkDotE: {
      left: '82%',
      top: 24,
    },
  });
}
