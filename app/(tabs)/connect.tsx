import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useSensorData, { formatSoundLevelPercent } from '../../hooks/useSensorData';
import { useAppTheme, type AppPalette } from '../../theme/ThemeProvider';

type Freshness = 'live' | 'stale' | 'offline';
type ModuleState = 'healthy' | 'stale' | 'warning' | 'waiting';

const BED_NAME = 'NeoBed-01';

const MODULES = [
  {
    label: 'Environment',
    detail: 'DHT11 temperature and humidity',
    icon: 'thermometer-outline',
    errorKeys: ['dht11'],
  },
  {
    label: 'Air Quality',
    detail: 'MQ-135 gas sensor',
    icon: 'leaf-outline',
    errorKeys: ['mq135', 'ads1115'],
  },
  {
    label: 'Light',
    detail: 'LDR ambient light',
    icon: 'sunny-outline',
    errorKeys: ['light'],
  },
  {
    label: 'Sound Level',
    detail: 'USB microphone RMS audio level',
    icon: 'volume-high-outline',
    errorKeys: ['sound_level'],
  },
  {
    label: 'Cry Model',
    detail: 'CryNet Small USB microphone inference',
    icon: 'pulse-outline',
    errorKeys: ['cry_detection'],
  },
] as const;

export default function Connect() {
  const insets = useSafeAreaInsets();
  const sensor = useSensorData();
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const styles = createStyles(palette, theme.isDark);
  const hasSuccessfulFetch = sensor.lastSuccessfulFetchAt !== null;
  const freshness = sensor.dataFreshness as Freshness;
  const heroState = getHeroState(freshness, hasSuccessfulFetch);
  const heroColor = getFreshnessColor(freshness, palette);
  const sensorErrors = sensor.sensorErrors ?? {};

  const liveReadings = [
    {
      label: 'Temperature',
      value: formatReading(sensor.temperatureC, 'C', 1, hasSuccessfulFetch),
      icon: 'thermometer-outline',
      tone: palette.sensorColors.temperature,
    },
    {
      label: 'Humidity',
      value: formatReading(sensor.humidityPct, '%', 1, hasSuccessfulFetch),
      icon: 'water-outline',
      tone: palette.sensorColors.humidity,
    },
    {
      label: 'Air Quality',
      value: formatReading(sensor.airQualityPpm, 'ppm', 0, hasSuccessfulFetch),
      icon: 'leaf-outline',
      tone: palette.sensorColors.airQuality,
    },
    {
      label: 'Sound',
      value: hasSuccessfulFetch
        ? formatSoundLevelPercent(sensor.soundLevelPercent)
        : '--',
      icon: 'volume-high-outline',
      tone: palette.sensorColors.sound,
    },
  ] as const;

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
        <Text style={styles.eyebrow}>Bed Health</Text>
        <Text style={styles.title}>Monitor readiness</Text>
        <Text style={styles.subtitle}>
          Live status for the fixed neonatal bed setup.
        </Text>
      </View>

      <LinearGradient
        colors={
          theme.isDark
            ? [palette.surfaceSecondary, palette.surface, '#08111E']
            : [palette.surface, theme.gradient[1], palette.surfaceSecondary]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <View style={[styles.heroIcon, { backgroundColor: withOpacity(heroColor, 0.14) }]}>
              <Ionicons name="hardware-chip-outline" size={23} color={heroColor} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroLabel}>{BED_NAME}</Text>
              <Text style={styles.heroTitle}>Raspberry Pi sensor hub</Text>
            </View>
          </View>

          <View style={[styles.statusPill, { borderColor: withOpacity(heroColor, 0.3) }]}>
            <View style={[styles.statusDot, { backgroundColor: heroColor }]} />
            <Text style={[styles.statusPillText, { color: heroColor }]}>
              {heroState.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroStatsRow}>
          <HeroStat
            label="Data freshness"
            value={freshnessLabel(freshness, hasSuccessfulFetch)}
            styles={styles}
          />
          <HeroStat
            label="Last successful sync"
            value={formatLastSync(sensor.lastSuccessfulFetchAt)}
            styles={styles}
          />
        </View>

        {sensor.piError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={palette.destructive} />
            <Text style={styles.errorText} numberOfLines={2}>
              {sensor.piError}
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Modules</Text>
          <Text style={styles.sectionTitle}>Sensor health</Text>
        </View>

        <View style={styles.moduleList}>
          {MODULES.map(module => {
            const error = getModuleError(sensorErrors, module.errorKeys);
            const state = getModuleState(error, freshness, hasSuccessfulFetch);
            const stateColor = getModuleStateColor(state, palette);

            return (
              <View key={module.label} style={styles.moduleRow}>
                <View style={styles.moduleLeft}>
                  <View
                    style={[
                      styles.moduleIcon,
                      { backgroundColor: withOpacity(stateColor, 0.12) },
                    ]}
                  >
                    <Ionicons name={module.icon} size={18} color={stateColor} />
                  </View>
                  <View style={styles.moduleCopy}>
                    <Text style={styles.moduleLabel}>{module.label}</Text>
                    <Text style={styles.moduleDetail} numberOfLines={1}>
                      {error ?? module.detail}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.moduleState, { color: stateColor }]}>
                  {formatModuleState(state)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Live Feed</Text>
          <Text style={styles.sectionTitle}>Last known readings</Text>
        </View>

        <View style={styles.readingGrid}>
          {liveReadings.map(reading => (
            <View key={reading.label} style={styles.readingCard}>
              <View
                style={[
                  styles.readingIcon,
                  { backgroundColor: withOpacity(reading.tone, 0.14) },
                ]}
              >
                <Ionicons name={reading.icon} size={18} color={reading.tone} />
              </View>
              <Text style={styles.readingLabel}>{reading.label}</Text>
              <Text style={styles.readingValue}>{reading.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.guidanceCard}>
        <Ionicons name="shield-checkmark-outline" size={20} color={palette.accent} />
        <View style={styles.guidanceCopy}>
          <Text style={styles.guidanceTitle}>Single-bed mode</Text>
          <Text style={styles.guidanceText}>
            This screen now focuses on the one active monitor, keeping API,
            sensor, and model readiness visible without QR setup.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function HeroStat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

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

function getHeroState(freshness: Freshness, hasSuccessfulFetch: boolean) {
  if (!hasSuccessfulFetch) return 'waiting';
  return freshness;
}

function getFreshnessColor(freshness: Freshness, palette: AppPalette) {
  switch (freshness) {
    case 'live':
      return '#0E9F6E';
    case 'stale':
      return '#B7791F';
    case 'offline':
      return palette.destructive;
  }
}

function freshnessLabel(freshness: Freshness, hasSuccessfulFetch: boolean) {
  if (!hasSuccessfulFetch) return 'Waiting';
  if (freshness === 'live') return 'Live';
  if (freshness === 'stale') return 'Stale';
  return 'Offline';
}

function getModuleState(
  error: string | null,
  freshness: Freshness,
  hasSuccessfulFetch: boolean
): ModuleState {
  if (!hasSuccessfulFetch) return 'waiting';
  if (error) return 'warning';
  if (freshness === 'offline') return 'stale';
  return 'healthy';
}

function getModuleStateColor(state: ModuleState, palette: AppPalette) {
  switch (state) {
    case 'healthy':
      return '#0E9F6E';
    case 'stale':
    case 'warning':
      return '#B7791F';
    case 'waiting':
      return palette.textSecondary;
  }
}

function formatModuleState(state: ModuleState) {
  switch (state) {
    case 'healthy':
      return 'OK';
    case 'stale':
      return 'Stale';
    case 'warning':
      return 'Check';
    case 'waiting':
      return 'Wait';
  }
}

function getModuleError(
  errors: Record<string, string | null>,
  keys: readonly string[]
) {
  for (const key of keys) {
    const message = errors[key];

    if (message) return message;
  }

  return null;
}

function formatReading(
  value: number,
  unit: string,
  precision: number,
  hasSuccessfulFetch: boolean
) {
  if (!hasSuccessfulFetch) return '--';
  if (!Number.isFinite(value)) return '--';

  const formatted =
    precision === 0 ? `${Math.round(value)}` : value.toFixed(precision);

  return `${formatted} ${unit}`;
}

function formatLastSync(timestamp: number | null) {
  if (!timestamp) return 'No sync yet';

  const elapsedMs = Date.now() - timestamp;
  const elapsedSeconds = Math.max(0, Math.round(elapsedMs / 1000));

  if (elapsedSeconds < 5) return 'Just now';
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.round(elapsedMinutes / 60);
  return `${elapsedHours}h ago`;
}

function createStyles(palette: AppPalette, isDark = false) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
    },
    headerBlock: {
      marginBottom: 16,
    },
    eyebrow: {
      fontFamily: 'Inter-Medium',
      fontSize: 11,
      lineHeight: 14,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 28,
      lineHeight: 34,
      color: palette.textPrimary,
      marginBottom: 4,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 13,
      lineHeight: 18,
      color: palette.textSecondary,
    },
    heroCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 16,
      marginBottom: 20,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.24 : 0.09,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    heroIdentity: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    heroLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 11,
      lineHeight: 14,
      color: palette.textSecondary,
      marginBottom: 3,
    },
    heroTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 17,
      lineHeight: 21,
      color: palette.textPrimary,
    },
    statusPill: {
      minHeight: 28,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 10,
      flexShrink: 0,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusPillText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
    },
    heroDivider: {
      height: 1,
      backgroundColor: palette.divider,
      marginVertical: 14,
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    heroStat: {
      flex: 1,
      minWidth: 0,
      borderRadius: 16,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.88)',
      padding: 11,
    },
    heroStatLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    heroStatValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: palette.textPrimary,
    },
    errorBanner: {
      marginTop: 12,
      borderRadius: 15,
      backgroundColor: withOpacity(palette.destructive, isDark ? 0.18 : 0.1),
      borderWidth: 1,
      borderColor: withOpacity(palette.destructive, isDark ? 0.28 : 0.18),
      paddingHorizontal: 11,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    errorText: {
      flex: 1,
      minWidth: 0,
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      lineHeight: 16,
      color: palette.destructive,
    },
    sectionBlock: {
      marginBottom: 20,
    },
    sectionHeader: {
      marginBottom: 11,
    },
    sectionEyebrow: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    sectionTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 18,
      lineHeight: 23,
      color: palette.textPrimary,
    },
    moduleList: {
      gap: 10,
    },
    moduleRow: {
      minHeight: 68,
      borderRadius: 18,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    moduleLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    moduleIcon: {
      width: 38,
      height: 38,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    moduleCopy: {
      flex: 1,
      minWidth: 0,
    },
    moduleLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: palette.textPrimary,
      marginBottom: 3,
    },
    moduleDetail: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: palette.textSecondary,
    },
    moduleState: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      textTransform: 'uppercase',
      flexShrink: 0,
    },
    readingGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
    },
    readingCard: {
      width: '48.4%',
      minHeight: 118,
      borderRadius: 20,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 13,
      justifyContent: 'space-between',
    },
    readingIcon: {
      width: 36,
      height: 36,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    readingLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 11,
      lineHeight: 14,
      color: palette.textSecondary,
      textTransform: 'uppercase',
    },
    readingValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 20,
      lineHeight: 25,
      color: palette.textPrimary,
    },
    guidanceCard: {
      borderTopWidth: 1,
      borderTopColor: palette.divider,
      paddingTop: 15,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
    },
    guidanceCopy: {
      flex: 1,
      minWidth: 0,
    },
    guidanceTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: palette.textPrimary,
      marginBottom: 4,
    },
    guidanceText: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      lineHeight: 17,
      color: palette.textSecondary,
    },
  });
}
