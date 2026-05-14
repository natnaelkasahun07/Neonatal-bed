import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
  Text as SvgText,
} from 'react-native-svg';
import {
  Droplet,
  Sun,
  Thermometer,
  Volume2,
  Wind,
} from 'lucide-react-native';
import useSensorData, {
  formatLightState,
  formatSoundLevelPercent,
  type SensorStatus,
  type SensorKey,
  type BooleanSummary,
} from '../../hooks/useSensorData';
import type { NotificationItem } from '../../components/NotificationBell';
import { useSoundSettings } from '../../context/SoundSettings';
import { useAppTheme, type AppPalette, type AppTheme } from '../../theme/ThemeProvider';

const HOURS_OPTIONS = [1, 6, 12, 24, 48] as const;
const SCREEN_HORIZONTAL_PADDING = 16;
const METRIC_CARD_HEIGHT = 304;
const DEGREE_CELSIUS = '\u00B0C';

type DashboardUI = {
  ink: string;
  slate: string;
  muted: string;
  white: string;
  background: string;
  border: string;
  softSurface: string;
  shadow: string;
  alert: string;
  blackSurface: string;
  blackSurfaceSoft: string;
  onBlack: string;
  onBlackMuted: string;
};

type SensorData = ReturnType<typeof useSensorData>;
type GraphPoint = {
  timestamp: number;
  value: number;
};

function createDashboardUI(theme: AppTheme): DashboardUI {
  const palette = theme.palette;

  return {
    ink: palette.textPrimary,
    slate: palette.textSecondary,
    muted: palette.iconMuted,
    white: palette.surface,
    background: theme.gradient[0],
    border: palette.border,
    softSurface: palette.surfaceSecondary,
    shadow: palette.shadow,
    alert: palette.destructive,
    blackSurface: theme.isDark ? '#08111E' : '#0B1220',
    blackSurfaceSoft: palette.accent,
    onBlack: '#FFFFFF',
    onBlackMuted: theme.isDark ? '#DCE7F7' : '#C7D2E7',
  };
}

function withHexOpacity(hexColor: string, opacity: number) {
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

type StatusIconName = 'checkmark' | 'alert' | 'close';
type CryLabel = 'ambient' | 'crying' | 'babbling_or_laughing';
type CryDisplayState = CryLabel | 'unknown';
type CryConnectionState = 'live' | 'stale' | 'offline';
type CryProbabilitySet = Record<CryLabel, number | null>;
type IoniconName = keyof typeof Ionicons.glyphMap;
type TrendDirection = 'up' | 'down' | 'flat';

type SensorInsightTone = {
  accent: string;
  accentSoft: string;
  graphFill: string;
  gradient: [string, string, string];
};

type SensorDetailProfile = {
  category: string;
  heroLabel: string;
  targetLabel: string;
  targetValue: string;
  rangeLabel: string;
  rangeMin?: number;
  rangeMax?: number;
  scaleMin?: number;
  scaleMax?: number;
  lowLabel?: string;
  highLabel?: string;
  interpretation: Record<SensorStatus, string>;
  recommendation: Record<SensorStatus, string>;
};

type CryApiPayload = {
  label?: string | null;
  smoothed_label?: string | null;
  final_state?: string | null;
  cry_detected?: boolean | null;
  babbling_or_laughing_detected?: boolean | null;
  top_probability?: number | null;
  probabilities?: Partial<Record<CryLabel, number>> | null;
  cry_percent?: number | null;
  ambient_percent?: number | null;
  bubble_laughter_percent?: number | null;
  confidence_percent?: number | null;
  sound_level_percent?: number | null;
  timestamp?: string | number | null;
  model?: string | { name?: string | null } | null;
  model_name?: string | null;
  microphone?: string | { label?: string | null; name?: string | null; model?: string | null } | null;
  source?: string | null;
};

type CrySensorData = SensorData & {
  cry?: CryApiPayload | null;
  snapshot: SensorData['snapshot'] & {
    cry?: CryApiPayload | null;
  };
};

type CryDisplayModel = {
  state: CryDisplayState;
  stateLabel: string;
  interpretation: string;
  probabilities: CryProbabilitySet;
  modelName: string;
  sourceLabel: string;
  connectionState: CryConnectionState;
  connectionLabel: string;
};

const CRY_STALE_AFTER_MS = 30 * 1000;
const CRY_PROBABILITY_ANIMATION_MS = 300;
const DEFAULT_CRY_MODEL_NAME = 'CryNet Small';
const DEFAULT_CRY_SOURCE_LABEL = 'USB Mic';

const CRY_STATE_LABELS: Record<CryDisplayState, string> = {
  ambient: 'Ambient',
  crying: 'Crying',
  babbling_or_laughing: 'Babbling / Laughing',
  unknown: 'Unknown / Offline',
};

const CRY_INTERPRETATIONS: Record<CryDisplayState, string> = {
  ambient: 'No cry pattern detected',
  crying: 'Infant cry pattern detected',
  babbling_or_laughing: 'Vocal activity detected',
  unknown: 'No model signal available',
};

const EMPTY_CRY_PROBABILITIES: CryProbabilitySet = {
  ambient: null,
  crying: null,
  babbling_or_laughing: null,
};

const SENSOR_LABELS: Record<SensorKey, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  sound: 'Sound',
  light: 'Light',
  airQuality: 'Air Quality',
};

const SENSOR_MODAL_UNITS: Record<SensorKey, string> = {
  temperature: DEGREE_CELSIUS,
  humidity: '%',
  sound: '%',
  light: 'State',
  airQuality: 'ppm',
};

const SENSOR_GRAPH_VARIANTS: Record<SensorKey, 'numeric' | 'boolean'> = {
  temperature: 'numeric',
  humidity: 'numeric',
  sound: 'numeric',
  light: 'boolean',
  airQuality: 'numeric',
};

const SENSOR_GRAPH_STATE_LABELS: Partial<
  Record<SensorKey, { low: string; high: string }>
> = {
  light: { low: 'Dark', high: 'Bright' },
};

const SENSOR_DETAIL_TONES: Record<SensorKey, SensorInsightTone> = {
  temperature: {
    accent: '#FF6B4A',
    accentSoft: 'rgba(255, 107, 74, 0.2)',
    graphFill: 'rgba(255, 107, 74, 0.24)',
    gradient: ['#101827', '#233247', '#3A2430'],
  },
  humidity: {
    accent: '#24C8DB',
    accentSoft: 'rgba(36, 200, 219, 0.2)',
    graphFill: 'rgba(36, 200, 219, 0.23)',
    gradient: ['#0E1B29', '#173447', '#123B41'],
  },
  airQuality: {
    accent: '#4DD985',
    accentSoft: 'rgba(77, 217, 133, 0.2)',
    graphFill: 'rgba(77, 217, 133, 0.23)',
    gradient: ['#101D18', '#1D3027', '#153C2A'],
  },
  sound: {
    accent: '#9C8CFF',
    accentSoft: 'rgba(156, 140, 255, 0.22)',
    graphFill: 'rgba(156, 140, 255, 0.23)',
    gradient: ['#151729', '#292447', '#202B4A'],
  },
  light: {
    accent: '#F6B84B',
    accentSoft: 'rgba(246, 184, 75, 0.22)',
    graphFill: 'rgba(246, 184, 75, 0.24)',
    gradient: ['#211A10', '#352816', '#263626'],
  },
};

function createSensorDetailTones(
  palette: AppPalette
): Record<SensorKey, SensorInsightTone> {
  return {
    temperature: {
      ...SENSOR_DETAIL_TONES.temperature,
      accent: palette.sensorColors.temperature,
      accentSoft: withHexOpacity(palette.sensorColors.temperature, 0.22),
      graphFill: withHexOpacity(palette.sensorColors.temperature, 0.24),
    },
    humidity: {
      ...SENSOR_DETAIL_TONES.humidity,
      accent: palette.sensorColors.humidity,
      accentSoft: withHexOpacity(palette.sensorColors.humidity, 0.22),
      graphFill: withHexOpacity(palette.sensorColors.humidity, 0.24),
    },
    airQuality: {
      ...SENSOR_DETAIL_TONES.airQuality,
      accent: palette.sensorColors.airQuality,
      accentSoft: withHexOpacity(palette.sensorColors.airQuality, 0.22),
      graphFill: withHexOpacity(palette.sensorColors.airQuality, 0.24),
    },
    sound: {
      ...SENSOR_DETAIL_TONES.sound,
      accent: palette.sensorColors.sound,
      accentSoft: withHexOpacity(palette.sensorColors.sound, 0.24),
      graphFill: withHexOpacity(palette.sensorColors.sound, 0.24),
    },
    light: {
      ...SENSOR_DETAIL_TONES.light,
      accent: palette.sensorColors.light,
      accentSoft: withHexOpacity(palette.sensorColors.light, 0.24),
      graphFill: withHexOpacity(palette.sensorColors.light, 0.25),
    },
  };
}

const SENSOR_DETAIL_PROFILES: Record<SensorKey, SensorDetailProfile> = {
  temperature: {
    category: 'Thermal stability',
    heroLabel: 'Incubator climate reading',
    targetLabel: 'Comfort band',
    targetValue: '24-30\u00B0C',
    rangeLabel: 'Recommended thermal band',
    rangeMin: 24,
    rangeMax: 30,
    scaleMin: 18,
    scaleMax: 36,
    lowLabel: 'Cool',
    highLabel: 'Hot',
    interpretation: {
      good: 'Temperature is inside the defined neonatal comfort range.',
      warning: 'Temperature is drifting toward the edge of the desired range.',
      danger: 'Temperature is outside the safe operating range and needs attention.',
      unknown: 'Temperature data is currently unavailable.',
    },
    recommendation: {
      good: 'Maintain the current warmer setting and continue routine observation.',
      warning: 'Check incubator airflow, blankets, and room drafts before the drift becomes critical.',
      danger: 'Escalate immediately: verify the probe placement and adjust the thermal control.',
      unknown: 'Check the DHT11 connection and wait for the next valid sample.',
    },
  },
  humidity: {
    category: 'Moisture control',
    heroLabel: 'Relative humidity reading',
    targetLabel: 'Care band',
    targetValue: '40-60%',
    rangeLabel: 'Recommended humidity band',
    rangeMin: 40,
    rangeMax: 60,
    scaleMin: 20,
    scaleMax: 85,
    lowLabel: 'Dry',
    highLabel: 'Humid',
    interpretation: {
      good: 'Humidity is balanced for a stable cot environment.',
      warning: 'Humidity is moving outside the preferred care band.',
      danger: 'Humidity is far from the target band and may affect comfort.',
      unknown: 'Humidity data is currently unavailable.',
    },
    recommendation: {
      good: 'Keep ventilation and humidifier settings unchanged while monitoring the trend.',
      warning: 'Inspect the water chamber, airflow, and bed cover position.',
      danger: 'Correct the humidity source and confirm the sensor is not obstructed.',
      unknown: 'Check the DHT11 connection and wait for the next valid sample.',
    },
  },
  airQuality: {
    category: 'Air safety',
    heroLabel: 'MQ-135 gas estimate',
    targetLabel: 'Safe threshold',
    targetValue: '<350 ppm',
    rangeLabel: 'Raw gas sensor threshold',
    rangeMin: 0,
    rangeMax: 350,
    scaleMin: 0,
    scaleMax: 700,
    lowLabel: 'Clean',
    highLabel: 'Heavy',
    interpretation: {
      good: 'Air quality is currently within the safe calibrated threshold.',
      warning: 'Air quality is elevated and should be watched closely.',
      danger: 'Air quality is above the danger threshold and may require ventilation.',
      unknown: 'Air quality is unavailable from the current Pi payload.',
    },
    recommendation: {
      good: 'Continue normal monitoring and keep the cot area well ventilated.',
      warning: 'Check nearby cleaning agents, airflow, and sensor exposure.',
      danger: 'Increase ventilation, remove possible sources, and verify the reading.',
      unknown: 'Check the ADS1115/MQ-135 path before interpreting gas readings.',
    },
  },
  sound: {
    category: 'Acoustic activity',
    heroLabel: 'USB microphone RMS level',
    targetLabel: 'Quiet threshold',
    targetValue: '<5%',
    rangeLabel: 'USB microphone RMS range',
    rangeMin: 0,
    rangeMax: 5,
    scaleMin: 0,
    scaleMax: 100,
    lowLabel: 'Quiet',
    highLabel: 'Very Loud',
    interpretation: {
      good: 'The USB microphone level is inside the quiet baseline.',
      warning: 'The USB microphone level is elevated and should be compared with the cry card.',
      danger: 'The USB microphone level is very loud and may indicate distress or environmental noise.',
      unknown: 'USB microphone sound level is currently unavailable.',
    },
    recommendation: {
      good: 'Maintain the low-noise environment and continue passive monitoring.',
      warning: 'Review the cry model panel and check the infant or surrounding equipment.',
      danger: 'Respond immediately and compare with the cry detection confidence.',
      unknown: 'Check the USB microphone connection and Pi audio capture service.',
    },
  },
  light: {
    category: 'Lighting exposure',
    heroLabel: 'Ambient light state',
    targetLabel: 'Preferred state',
    targetValue: 'Day/night aligned',
    rangeLabel: 'Light exposure balance',
    lowLabel: 'Dark',
    highLabel: 'Bright',
    interpretation: {
      good: 'Lighting is aligned with the expected environmental state.',
      warning: 'Lighting may be too bright or mismatched for rest conditions.',
      danger: 'Lighting exposure is abnormal for the current care state.',
      unknown: 'Light data is currently unavailable.',
    },
    recommendation: {
      good: 'Keep lighting steady and avoid sudden brightness changes.',
      warning: 'Adjust curtains, room lamps, or cot cover to reduce stimulation.',
      danger: 'Correct the lighting source and verify the light sensor placement.',
      unknown: 'Check the LDR digital input and wait for the next valid sample.',
    },
  },
};

const SPARKLINE_WIDTH = 238;
const SPARKLINE_HEIGHT = 78;
const DETAIL_GRAPH_WIDTH = 360;

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const sensor = useSensorData();
  const { soundEnabled } = useSoundSettings();
  const { theme } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const ui = createDashboardUI(theme);
  const styles = createStyles(ui);
  const sensorDetailTones = createSensorDetailTones(theme.palette);

  const [activeSensor, setActiveSensor] = useState<SensorKey | null>(null);
  const [beds, setBeds] = useState<string[]>(['NeoBed-01']);
  const [activeBed, setActiveBed] = useState('NeoBed-01');
  const [bedOpen, setBedOpen] = useState(false);
  const [selectedHours, setSelectedHours] = useState<number>(1);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (!activeSensor) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveSensor(null);
      return true;
    });

    return () => subscription.remove();
  }, [activeSensor]);

  const lightSummary = sensor.getBooleanSummary('light', selectedHours);
  const detailCardWidth = Math.min(
    312,
    Math.max(260, screenWidth - SCREEN_HORIZONTAL_PADDING * 2 - 42)
  );
  const temperatureHistory = toGraphPoints(
    sensor.getHistory('temperature', selectedHours)
  );
  const humidityHistory = toGraphPoints(
    sensor.getHistory('humidity', selectedHours)
  );
  const airQualityHistory = toGraphPoints(
    sensor.getHistory('airQuality', selectedHours)
  );
  const soundHistory = toGraphPoints(sensor.getSoundLevelHistory(selectedHours));
  const lightHistory = toGraphPoints(sensor.getHistory('light', selectedHours));
  const conditionSnapshotItems = [
    {
      label: 'Temperature',
      value: getStatusSnapshotLabel(sensor.temperatureStatus),
      status: sensor.temperatureStatus,
    },
    {
      label: 'Humidity',
      value: getStatusSnapshotLabel(sensor.humidityStatus),
      status: sensor.humidityStatus,
    },
    {
      label: 'Air Quality',
      value: getStatusSnapshotLabel(sensor.airQualityStatus),
      status: sensor.airQualityStatus,
    },
    {
      label: 'Sound',
      value: sensor.soundStatusLabel,
      status: sensor.soundStatus,
    },
    {
      label: 'Light',
      value: formatLightState(sensor.isBright),
      status: sensor.lightStatus,
    },
  ];

  useEffect(() => {
    let mounted = true;

    async function loadSound() {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/notification.mp3'),
        { shouldPlay: false }
      );

      if (mounted) {
        soundRef.current = sound;
      }
    }

    loadSound();

    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  function addBed() {
    setBeds(prev => {
      const nextIndex = prev.length + 1;
      const newBed = `NeoBed-${String(nextIndex).padStart(2, '0')}`;
      setActiveBed(newBed);
      setBedOpen(false);
      return [...prev, newBed];
    });
  }

  function deleteBed(bed: string) {
    if (beds.length === 1) return;

    setBeds(prev => {
      const remaining = prev.filter(b => b !== bed);
      const renumbered = remaining.map((_, index) =>
        `NeoBed-${String(index + 1).padStart(2, '0')}`
      );

      if (bed === activeBed) {
        setActiveBed(renumbered[0]);
      } else {
        const oldIndex = prev.indexOf(activeBed);
        setActiveBed(renumbered[Math.min(oldIndex, renumbered.length - 1)]);
      }

      return renumbered;
    });
  }

  useEffect(() => {
    const dangers = [
      sensor.temperatureStatus === 'danger' && 'Temperature is critical',
      sensor.humidityStatus === 'danger' && 'Humidity is critical',
      sensor.airQualityStatus === 'danger' && 'Air quality is critical',
    ].filter(Boolean) as string[];

    setNotifications(prev => {
      const existing = prev.map(notification => notification.message);

      const newAlerts = dangers
        .filter(message => !existing.includes(message))
        .map(message => ({
          id: `${message}-${Date.now()}`,
          message,
          timestamp: Date.now(),
        }));

      if (newAlerts.length > 0 && soundRef.current && soundEnabled) {
        soundRef.current.replayAsync();
      }

      return [...prev, ...newAlerts];
    });
  }, [
    sensor.temperatureStatus,
    sensor.humidityStatus,
    sensor.airQualityStatus,
    soundEnabled,
  ]);

  if (activeSensor) {
    return (
      <PremiumSensorDetailScreen
        sensorKey={activeSensor}
        selectedHours={selectedHours}
        ui={ui}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        activeBed={activeBed}
        currentValue={getCurrentSensorValue(activeSensor, sensor)}
        currentStatus={getCurrentSensorStatus(activeSensor, sensor)}
        statusLabelOverride={
          activeSensor === 'sound' ? sensor.soundStatusLabel : undefined
        }
        unit={SENSOR_MODAL_UNITS[activeSensor]}
        tone={sensorDetailTones[activeSensor]}
        detailGradient={theme.gradient}
        variant={SENSOR_GRAPH_VARIANTS[activeSensor]}
        stateLabels={SENSOR_GRAPH_STATE_LABELS[activeSensor]}
        points={
          activeSensor === 'sound'
            ? toGraphPoints(sensor.getSoundLevelHistory(selectedHours))
            : toGraphPoints(sensor.getHistory(activeSensor, selectedHours))
        }
        numericStats={
          activeSensor === 'temperature' ||
          activeSensor === 'humidity' ||
          activeSensor === 'airQuality'
            ? {
                average: sensor.getMetric(activeSensor, selectedHours, 'Average'),
                min: sensor.getMetric(activeSensor, selectedHours, 'Min'),
                max: sensor.getMetric(activeSensor, selectedHours, 'Max'),
              }
            : activeSensor === 'sound'
              ? {
                  average: sensor.getSoundLevelMetric(selectedHours, 'Average'),
                  min: sensor.getSoundLevelMetric(selectedHours, 'Min'),
                  max: sensor.getSoundLevelMetric(selectedHours, 'Max'),
                }
            : undefined
        }
        booleanSummary={
          activeSensor === 'light'
              ? {
                  summary: lightSummary,
                  activeLabel: 'Bright',
                  inactiveLabel: 'Dark',
                }
              : undefined
        }
        onBack={() => setActiveSensor(null)}
        onSelectHours={setSelectedHours}
      />
    );
  }

  return (
    <View style={styles.screenRoot}>
      <ScrollView
        style={{ backgroundColor: ui.background }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 14,
            paddingBottom: 28,
          },
        ]}
      >
      <View style={styles.topControls}>
        <View style={styles.controlsRow}>
          <Pressable
            style={styles.bedButton}
            onPress={() => setBedOpen(open => !open)}
          >
            <View style={styles.bedButtonIcon}>
              <Ionicons name="bed-outline" size={18} color={ui.ink} />
            </View>
            <Text style={styles.bedText} numberOfLines={1}>
              {activeBed}
            </Text>
            <Ionicons
              name={bedOpen ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={ui.muted}
              style={styles.bedChevron}
            />
          </Pressable>

          <DashboardNotificationBell
            hasUnread={notifications.length > 0}
            ui={ui}
            onOpen={() => setNotifOpen(true)}
          />
        </View>

        {bedOpen && (
          <View style={styles.bedDropdown}>
            {beds.map(bed => {
              const isActiveBed = bed === activeBed;

              return (
                <View
                  key={bed}
                  style={[
                    styles.bedItemRow,
                    isActiveBed && styles.bedItemRowActive,
                  ]}
                >
                  <Pressable
                    style={styles.bedItemPressable}
                    onPress={() => {
                      setActiveBed(bed);
                      setBedOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.bedItemText,
                        isActiveBed && styles.bedItemTextActive,
                      ]}
                    >
                      {bed}
                    </Text>
                  </Pressable>

                  {isActiveBed && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={ui.ink}
                      style={styles.bedCheckIcon}
                    />
                  )}

                  {beds.length > 1 && (
                    <Pressable
                      style={styles.bedDeleteButton}
                      onPress={() => deleteBed(bed)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={ui.muted}
                      />
                    </Pressable>
                  )}
                </View>
              );
            })}

            <View style={styles.divider} />

            <Pressable style={styles.addBedButton} onPress={addBed}>
              <Ionicons name="add" size={14} color={ui.ink} />
              <Text style={styles.addBedText}>Add Bed</Text>
            </Pressable>
          </View>
        )}
      </View>

      <CryDetectionHeroCard sensor={sensor} ui={ui} />

      <View style={styles.sensorSectionHeader}>
        <View style={styles.sensorSectionIcon}>
          <Ionicons name="pulse-outline" size={20} color={ui.ink} />
        </View>
        <View style={styles.sensorSectionCopy}>
          <Text style={styles.sensorSectionTitle} numberOfLines={1}>
            Environmental Readings
          </Text>
          <Text style={styles.sensorSectionSubtitle} numberOfLines={1}>
            Real-time sensor data from the bed
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <DashboardSensorCard
          label="Temperature"
          value={sensor.temperatureC}
          unit={DEGREE_CELSIUS}
          status={sensor.temperatureStatus}
          ui={ui}
          icon={
            <Thermometer size={20} color={sensorDetailTones.temperature.accent} strokeWidth={2.2} />
          }
          containerStyle={styles.sensorGridCard}
          onPress={() => setActiveSensor('temperature')}
        />

        <DashboardSensorCard
          label="Humidity"
          value={sensor.humidityPct}
          unit="%"
          status={sensor.humidityStatus}
          ui={ui}
          icon={
            <Droplet size={20} color={sensorDetailTones.humidity.accent} strokeWidth={2.2} />
          }
          containerStyle={styles.sensorGridCard}
          onPress={() => setActiveSensor('humidity')}
        />

        <DashboardSensorCard
          label="Light"
          value={formatLightState(sensor.isBright)}
          status={sensor.lightStatus}
          ui={ui}
          icon={
            <Sun size={20} color={sensorDetailTones.light.accent} strokeWidth={2.1} />
          }
          containerStyle={styles.sensorGridCard}
          onPress={() => setActiveSensor('light')}
        />

        <DashboardSensorCard
          label="Sound"
          value={formatSoundLevelPercent(sensor.soundLevelPercent)}
          status={sensor.soundStatus}
          statusLabel={sensor.soundStatusLabel}
          ui={ui}
          icon={
            <Volume2 size={21} color={sensorDetailTones.sound.accent} strokeWidth={2.1} />
          }
          containerStyle={styles.sensorGridCard}
          onPress={() => setActiveSensor('sound')}
        />

        <DashboardSensorCard
          label="Air Quality"
          value={getAirQualityCardValue(sensor.airQualityStatus, sensor.airQualityRaw)}
          status={sensor.airQualityStatus}
          ui={ui}
          icon={
            <Wind size={21} color={sensorDetailTones.airQuality.accent} strokeWidth={2.1} />
          }
          containerStyle={styles.sensorGridCard}
          onPress={() => setActiveSensor('airQuality')}
        />
      </View>

      <View style={styles.snapshotSection}>
        <View style={styles.snapshotHeaderRow}>
          <View style={styles.snapshotTitleBlock}>
            <Text style={styles.snapshotTitle}>Condition Snapshot</Text>
            <Text style={styles.snapshotSubtitle} numberOfLines={1}>
              Current neonatal bed state
            </Text>
          </View>
          <Text style={styles.snapshotCount}>
            {conditionSnapshotItems.length} checks
          </Text>
        </View>

        <View style={styles.snapshotInlineGrid}>
          {conditionSnapshotItems.map(item => (
            <View key={item.label} style={styles.snapshotInlineItem}>
              <View
                style={[
                  styles.snapshotAccentLine,
                  { backgroundColor: getSnapshotStatusColor(item.status, ui) },
                ]}
              />
              <View
                style={[
                  styles.statusMark,
                  { backgroundColor: getSnapshotStatusColor(item.status, ui) },
                ]}
              >
                <Ionicons
                  name={getStatusIconName(item.status)}
                  size={13}
                  color={ui.white}
                />
              </View>
              <View style={styles.snapshotInlineCopy}>
                <Text style={styles.snapshotChipLabel} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.snapshotChipValue} numberOfLines={1}>
                  {item.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.detailsSection}>
        <View style={styles.detailsHeader}>
          <View style={styles.detailsTitleBlock}>
            <Text style={styles.detailsEyebrow}>Sensor Details</Text>
            <Text style={styles.detailsTitle}>Clinical Trend Deck</Text>
          </View>
        </View>

        <View style={styles.trendWindowControl}>
          <Text style={styles.trendWindowLabel}>Window</Text>
          <View style={styles.hoursRow}>
            {HOURS_OPTIONS.map(hours => (
              <Pressable
                key={hours}
                onPress={() => setSelectedHours(hours)}
                style={[
                  styles.hourChip,
                  selectedHours === hours && styles.hourChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.hourText,
                    selectedHours === hours && styles.hourTextActive,
                  ]}
                >
                  {hours}H
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={detailCardWidth + 12}
          snapToAlignment="start"
          style={styles.detailsDeck}
          contentContainerStyle={styles.detailsDeckContent}
        >
          <NumericMetricCard
            label="Temperature"
            unit={DEGREE_CELSIUS}
            currentValue={sensor.temperatureC}
            avg={sensor.getMetric('temperature', selectedHours, 'Average')}
            min={sensor.getMetric('temperature', selectedHours, 'Min')}
            max={sensor.getMetric('temperature', selectedHours, 'Max')}
            status={sensor.temperatureStatus}
            ui={ui}
            tone={sensorDetailTones.temperature}
            history={temperatureHistory}
            cardWidth={detailCardWidth}
            icon={<Thermometer size={20} color={sensorDetailTones.temperature.accent} strokeWidth={2.3} />}
            onPress={() => setActiveSensor('temperature')}
          />
          <NumericMetricCard
            label="Humidity"
            unit="%"
            currentValue={sensor.humidityPct}
            avg={sensor.getMetric('humidity', selectedHours, 'Average')}
            min={sensor.getMetric('humidity', selectedHours, 'Min')}
            max={sensor.getMetric('humidity', selectedHours, 'Max')}
            status={sensor.humidityStatus}
            ui={ui}
            tone={sensorDetailTones.humidity}
            history={humidityHistory}
            cardWidth={detailCardWidth}
            icon={<Droplet size={20} color={sensorDetailTones.humidity.accent} strokeWidth={2.3} />}
            onPress={() => setActiveSensor('humidity')}
          />
          <NumericMetricCard
            label="Air Quality"
            unit="ppm"
            currentValue={sensor.airQualityRaw}
            avg={sensor.getMetric('airQuality', selectedHours, 'Average')}
            min={sensor.getMetric('airQuality', selectedHours, 'Min')}
            max={sensor.getMetric('airQuality', selectedHours, 'Max')}
            status={sensor.airQualityStatus}
            ui={ui}
            tone={sensorDetailTones.airQuality}
            history={airQualityHistory}
            cardWidth={detailCardWidth}
            icon={<Wind size={20} color={sensorDetailTones.airQuality.accent} strokeWidth={2.3} />}
            onPress={() => setActiveSensor('airQuality')}
          />
          <NumericMetricCard
            label="Sound"
            unit="%"
            currentValue={sensor.soundLevelPercent ?? Number.NaN}
            avg={sensor.getSoundLevelMetric(selectedHours, 'Average')}
            min={sensor.getSoundLevelMetric(selectedHours, 'Min')}
            max={sensor.getSoundLevelMetric(selectedHours, 'Max')}
            status={sensor.soundStatus}
            statusLabel={sensor.soundStatusLabel}
            ui={ui}
            tone={sensorDetailTones.sound}
            history={soundHistory}
            cardWidth={detailCardWidth}
            icon={<Volume2 size={20} color={sensorDetailTones.sound.accent} strokeWidth={2.3} />}
            onPress={() => setActiveSensor('sound')}
          />
          <StateMetricCard
            label="Light"
            currentValue={lightSummary.currentState}
            activeLabel="Bright"
            activeCount={lightSummary.activeCount}
            inactiveLabel="Dark"
            inactiveCount={lightSummary.inactiveCount}
            lastState={lightSummary.lastState}
            status={sensor.lightStatus}
            ui={ui}
            tone={sensorDetailTones.light}
            history={lightHistory}
            cardWidth={detailCardWidth}
            icon={<Sun size={20} color={sensorDetailTones.light.accent} strokeWidth={2.3} />}
            onPress={() => setActiveSensor('light')}
          />
        </ScrollView>
      </View>

      </ScrollView>

      <DashboardNotificationPopover
        notifications={notifications}
        visible={notifOpen}
        ui={ui}
        topOffset={insets.top + 60}
        onClose={() => setNotifOpen(false)}
        onDismiss={id =>
          setNotifications(prev => prev.filter(n => n.id !== id))
        }
      />
    </View>
  );
}

function getStatusSnapshotLabel(status: SensorStatus) {
  switch (status) {
    case 'danger':
      return 'Critical';
    case 'warning':
      return 'Caution';
    case 'good':
      return 'Normal';
    case 'unknown':
      return 'Unavailable';
  }
}

function getAirQualityCardValue(status: SensorStatus, value: number) {
  if (status === 'unknown' || !Number.isFinite(value)) return 'Unavailable';

  switch (status) {
    case 'danger':
      return 'Unsafe';
    case 'warning':
      return 'Caution';
    case 'good':
      return 'Safe';
  }
}

function getSnapshotStatusColor(status: SensorStatus, ui: DashboardUI) {
  switch (status) {
    case 'danger':
      return ui.alert;
    case 'warning':
      return '#B7791F';
    case 'good':
      return '#0E9F6E';
    case 'unknown':
      return ui.muted;
  }
}

function getStatusIconName(status: SensorStatus): StatusIconName {
  switch (status) {
    case 'danger':
      return 'close';
    case 'warning':
    case 'unknown':
      return 'alert';
    case 'good':
      return 'checkmark';
  }
}

function getCurrentSensorValue(sensorKey: SensorKey, sensor: SensorData) {
  switch (sensorKey) {
    case 'temperature':
      return sensor.temperatureC;
    case 'humidity':
      return sensor.humidityPct;
    case 'airQuality':
      return sensor.airQualityRaw;
    case 'sound':
      return sensor.soundLevelPercent ?? Number.NaN;
    case 'light':
      return formatLightState(sensor.isBright);
  }
}

function getCurrentSensorStatus(
  sensorKey: SensorKey,
  sensor: SensorData
): SensorStatus {
  switch (sensorKey) {
    case 'temperature':
      return sensor.temperatureStatus;
    case 'humidity':
      return sensor.humidityStatus;
    case 'airQuality':
      return sensor.airQualityStatus;
    case 'sound':
      return sensor.soundStatus;
    case 'light':
      return sensor.lightStatus;
  }
}

function getCryDisplayModel(sensor: SensorData): CryDisplayModel {
  const adaptedSensor = sensor as CrySensorData;
  const cryPayload = adaptedSensor.cry ?? adaptedSensor.snapshot.cry ?? null;

  if (cryPayload) {
    return mapCryPayloadToDisplay(cryPayload);
  }

  return createUnavailableCryDisplay();
}

function mapCryPayloadToDisplay(cryPayload: CryApiPayload): CryDisplayModel {
  const timestampMs = parseCryTimestamp(cryPayload.timestamp);
  const hasFreshSignal = isFreshCrySignal(timestampMs);
  const rawState = inferCryState(cryPayload);
  const state = hasFreshSignal ? rawState : 'unknown';
  const connectionState: CryConnectionState = hasFreshSignal
    ? 'live'
    : timestampMs
      ? 'stale'
      : 'offline';

  return {
    state,
    stateLabel: CRY_STATE_LABELS[state],
    interpretation: CRY_INTERPRETATIONS[state],
    probabilities: hasFreshSignal
      ? getCryProbabilitySet(cryPayload)
      : { ...EMPTY_CRY_PROBABILITIES },
    modelName: resolveCryModelName(cryPayload),
    sourceLabel: resolveCrySourceLabel(cryPayload),
    connectionState,
    connectionLabel: getCryConnectionLabel(connectionState),
  };
}

function createUnavailableCryDisplay(): CryDisplayModel {
  return {
    state: 'unknown',
    stateLabel: CRY_STATE_LABELS.unknown,
    interpretation: CRY_INTERPRETATIONS.unknown,
    probabilities: { ...EMPTY_CRY_PROBABILITIES },
    modelName: DEFAULT_CRY_MODEL_NAME,
    sourceLabel: DEFAULT_CRY_SOURCE_LABEL,
    connectionState: 'offline',
    connectionLabel: getCryConnectionLabel('offline'),
  };
}

function inferCryState(cryPayload: CryApiPayload): CryDisplayState {
  const label = normalizeCryLabel(
    cryPayload.final_state ?? cryPayload.smoothed_label ?? cryPayload.label
  );
  const dominantProbability =
    getDominantProbability(cryPayload.probabilities) ??
    getDominantProbability({
      ambient: cryPayload.ambient_percent ?? undefined,
      crying: cryPayload.cry_percent ?? undefined,
      babbling_or_laughing: cryPayload.bubble_laughter_percent ?? undefined,
    });

  if (label) return label;
  if (dominantProbability) return dominantProbability.state;
  if (cryPayload.babbling_or_laughing_detected === true) {
    return 'babbling_or_laughing';
  }
  if (cryPayload.cry_detected === true) return 'crying';
  if (cryPayload.cry_detected === false) return 'ambient';

  return 'unknown';
}

function normalizeCryLabel(value?: string | null): CryLabel | null {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'ambient':
    case 'background':
    case 'normal_background':
      return 'ambient';
    case 'cry':
    case 'crying':
    case 'bad':
      return 'crying';
    case 'good':
    case 'babbling':
    case 'laughing':
    case 'bubble_laughter':
    case 'babbling_or_laughing':
      return 'babbling_or_laughing';
    default:
      return null;
  }
}

function getDominantProbability(
  probabilities?: Partial<Record<CryLabel, number>> | null
) {
  if (!probabilities) return null;

  const candidates = (Object.keys(CRY_STATE_LABELS) as CryDisplayState[])
    .filter((state): state is CryLabel => state !== 'unknown')
    .map(state => ({
      state,
      value: normalizeProbability(probabilities[state]),
    }))
    .filter(
      (item): item is { state: CryLabel; value: number } =>
        item.value !== null
    );

  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) =>
    current.value > best.value ? current : best
  );
}

function getCryProbabilitySet(cryPayload: CryApiPayload): CryProbabilitySet {
  const probabilities: CryProbabilitySet = { ...EMPTY_CRY_PROBABILITIES };

  (Object.keys(probabilities) as CryLabel[]).forEach(label => {
    probabilities[label] = normalizeProbability(cryPayload.probabilities?.[label]);
  });

  probabilities.ambient ??= normalizeProbability(cryPayload.ambient_percent);
  probabilities.crying ??= normalizeProbability(cryPayload.cry_percent);
  probabilities.babbling_or_laughing ??= normalizeProbability(
    cryPayload.bubble_laughter_percent
  );

  if (
    Object.values(probabilities).every(value => value === null) &&
    (cryPayload.top_probability !== undefined ||
      cryPayload.confidence_percent !== undefined)
  ) {
    const topProbability = normalizeProbability(
      cryPayload.top_probability ?? cryPayload.confidence_percent
    );
    const state = inferCryState(cryPayload);

    if (topProbability !== null && state !== 'unknown') {
      probabilities[state] = topProbability;
    }
  }

  return probabilities;
}

function normalizeProbability(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  const ratio = value > 1 ? value / 100 : value;
  return Math.min(Math.max(ratio, 0), 1);
}

function formatCryProbabilityValue(value: number | null) {
  return value === null ? '--' : `${(value * 100).toFixed(1)} %`;
}

function resolveCryModelName(cryPayload: CryApiPayload) {
  if (cryPayload.model_name?.trim()) return cryPayload.model_name.trim();
  if (typeof cryPayload.model === 'string' && cryPayload.model.trim()) {
    return cryPayload.model.trim();
  }
  if (typeof cryPayload.model === 'object' && cryPayload.model?.name?.trim()) {
    return cryPayload.model.name.trim();
  }

  return DEFAULT_CRY_MODEL_NAME;
}

function resolveCrySourceLabel(cryPayload: CryApiPayload) {
  if (typeof cryPayload.microphone === 'string' && cryPayload.microphone.trim()) {
    return cryPayload.microphone.trim();
  }

  if (typeof cryPayload.microphone === 'object' && cryPayload.microphone) {
    const detail =
      cryPayload.microphone.label?.trim() ??
      cryPayload.microphone.name?.trim() ??
      cryPayload.microphone.model?.trim();

    if (detail) return detail;
  }

  if (cryPayload.source?.trim()) return cryPayload.source.trim();

  return DEFAULT_CRY_SOURCE_LABEL;
}

function parseCryTimestamp(timestamp?: string | number | null) {
  if (typeof timestamp === 'number') {
    if (!Number.isFinite(timestamp)) return null;
    return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  }
  if (!timestamp?.trim()) return null;

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }

  const direct = Date.parse(timestamp);
  if (Number.isFinite(direct)) return direct;

  const normalized = Date.parse(timestamp.replace(' ', 'T'));
  return Number.isFinite(normalized) ? normalized : null;
}

function isFreshCrySignal(timestampMs: number | null) {
  return Boolean(timestampMs && Date.now() - timestampMs <= CRY_STALE_AFTER_MS);
}

function getCryConnectionLabel(connectionState: CryConnectionState) {
  switch (connectionState) {
    case 'live':
      return 'Live';
    case 'stale':
      return 'Stale';
    case 'offline':
      return 'Offline';
  }
}

type DetailStyles = ReturnType<typeof createDetailStyles>;

function PremiumSensorDetailScreen({
  sensorKey,
  selectedHours,
  ui,
  insetsTop,
  insetsBottom,
  activeBed,
  currentValue,
  currentStatus,
  statusLabelOverride,
  unit,
  tone,
  detailGradient,
  variant,
  stateLabels,
  points,
  numericStats,
  booleanSummary,
  onBack,
  onSelectHours,
}: {
  sensorKey: SensorKey;
  selectedHours: number;
  ui: DashboardUI;
  insetsTop: number;
  insetsBottom: number;
  activeBed: string;
  currentValue: string | number;
  currentStatus: SensorStatus;
  statusLabelOverride?: string;
  unit?: string;
  tone: SensorInsightTone;
  detailGradient: readonly [string, string, string];
  variant: 'numeric' | 'boolean';
  stateLabels?: { low: string; high: string };
  points: GraphPoint[];
  numericStats?: {
    average: number;
    min: number;
    max: number;
  };
  booleanSummary?: {
    summary: BooleanSummary;
    activeLabel: string;
    inactiveLabel: string;
  };
  onBack: () => void;
  onSelectHours: (hours: number) => void;
}) {
  const { height } = useWindowDimensions();
  const styles = createDetailStyles(ui);
  const profile = SENSOR_DETAIL_PROFILES[sensorKey];
  const valueUnit = unit && unit !== 'State' ? unit : undefined;
  const sensorLabel = SENSOR_LABELS[sensorKey];
  const statusLabel =
    statusLabelOverride ?? getSensorCardStatusLabel(sensorLabel, currentStatus);
  const statusColor = getSensorCardStatusColor(sensorLabel, currentStatus, ui);
  const displayCurrentValue =
    typeof currentValue === 'number'
      ? formatMetricNumber(currentValue, valueUnit ?? '')
      : currentValue;
  const graphHeight = Math.max(
    variant === 'boolean' ? 162 : 178,
    Math.min(Math.round(height * 0.24), variant === 'boolean' ? 190 : 208)
  );
  const trend =
    variant === 'numeric'
      ? getNumericTrend(points, valueUnit ?? '')
      : getBooleanTrend(points, stateLabels);
  const statItems = buildDetailStatItems({
    variant,
    unit: valueUnit,
    trendValue: trend.value,
    numericStats,
    booleanSummary,
    points,
    currentStatus,
  });

  return (
      <LinearGradient
        colors={detailGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.detailRoot}
    >
      <View style={[styles.detailTopBar, { paddingTop: insetsTop + 12 }]}>
        <Pressable style={styles.detailBackButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={ui.ink} />
        </Pressable>

        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailTitle}>{sensorLabel}</Text>
          <Text style={styles.detailSubtitle}>
            {activeBed} - {profile.category}
          </Text>
        </View>

        <Text style={[styles.detailTopSignalText, { color: statusColor }]}>
          LIVE
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.detailContent,
          { paddingBottom: insetsBottom + 24 },
        ]}
      >
        <LinearGradient
          colors={tone.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.detailImmersiveBand}
        >
          <View
            style={[
              styles.detailBandGlow,
              { backgroundColor: tone.accentSoft },
            ]}
          />

          <View style={styles.detailBandHeader}>
            <View style={styles.detailBandTitleRow}>
              <View
                style={[
                  styles.detailBandIcon,
                  { backgroundColor: tone.accentSoft },
                ]}
              >
                {getDetailSensorIcon(sensorKey, tone.accent)}
              </View>
              <View style={styles.detailBandTitleCopy}>
                <Text style={styles.detailBandEyebrow} numberOfLines={1}>
                  {profile.heroLabel}
                </Text>
                <Text style={styles.detailBandTitle} numberOfLines={1}>
                  {sensorLabel}
                </Text>
              </View>
            </View>

            <View style={styles.detailBandStatus}>
              <Ionicons
                name={getStatusIconName(currentStatus)}
                size={12}
                color={statusColor}
              />
              <Text
                style={[styles.detailBandStatusText, { color: statusColor }]}
                numberOfLines={1}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.detailBandValueRow}>
            <View style={styles.detailBandValueBlock}>
              <Text
                style={styles.detailCurrentValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.62}
              >
                {displayCurrentValue}
                {valueUnit && displayCurrentValue !== '--' ? (
                  <Text style={styles.detailCurrentUnit}> {valueUnit}</Text>
                ) : null}
              </Text>
            </View>

            <View style={styles.detailTrendInline}>
              <Ionicons
                name={getTrendIconName(trend.direction)}
                size={15}
                color={tone.accent}
              />
              <Text
                style={[styles.detailTrendInlineText, { color: tone.accent }]}
                numberOfLines={1}
              >
                {trend.label} {trend.value}
              </Text>
            </View>
          </View>

          <View style={styles.detailGraphBackdrop}>
            <ImmersiveDetailGraph
              sensorKey={sensorKey}
              points={points}
              variant={variant}
              tone={tone}
              profile={profile}
              stateLabels={stateLabels}
              unit={valueUnit}
              height={graphHeight}
            />
          </View>

          <Text style={styles.detailBandInterpretation}>
            {profile.interpretation[currentStatus]}
          </Text>

          <View style={styles.detailBandMetaRow}>
            <DetailMetaChip
              label={profile.targetLabel}
              value={profile.targetValue}
              styles={styles}
            />
            <DetailMetaChip
              label="Window"
              value={`${selectedHours}H`}
              styles={styles}
            />
            <DetailMetaChip
              label="Updated"
              value={formatLastUpdated(points)}
              styles={styles}
            />
          </View>
        </LinearGradient>

        <View style={styles.detailWindowRail}>
          <Text style={styles.detailWindowRailLabel}>Window</Text>
          <View style={styles.detailHoursRow}>
            {HOURS_OPTIONS.map(hours => (
              <Pressable
                key={hours}
                onPress={() => onSelectHours(hours)}
                style={[
                  styles.detailHourChip,
                  selectedHours === hours && styles.detailHourChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.detailHourText,
                    selectedHours === hours && styles.detailHourTextActive,
                  ]}
                >
                  {hours}H
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.detailInsightStrip}>
          <Text style={styles.detailInsightLabel}>Trend Intelligence</Text>
          <Text style={styles.detailInsightText} numberOfLines={1}>
            {formatSampleCount(points.length)} / {formatCadence(points)}
          </Text>
        </View>

        {numericStats ? (
          <NumericRangePanel
            profile={profile}
            currentValue={
              typeof currentValue === 'number' && Number.isFinite(currentValue)
                ? currentValue
                : null
            }
            unit={valueUnit}
            tone={tone}
            styles={styles}
          />
        ) : booleanSummary ? (
          <StateDistributionPanel
            profile={profile}
            summary={booleanSummary.summary}
            activeLabel={booleanSummary.activeLabel}
            inactiveLabel={booleanSummary.inactiveLabel}
            tone={tone}
            points={points}
            styles={styles}
          />
        ) : null}

        <View style={styles.detailStatsGrid}>
          <View style={styles.detailStatsHeader}>
            <Text style={styles.detailStatsTitle}>Key Measures</Text>
            <Text style={styles.detailStatsSubtitle} numberOfLines={1}>
              Built from the selected history window
            </Text>
          </View>

          <View style={styles.detailStatTileGrid}>
            {statItems.map(item => (
              <PremiumDetailStatTile
                key={item.label}
                label={item.label}
                value={item.value}
                helper={item.helper}
                tone={tone}
                styles={styles}
              />
            ))}
          </View>
        </View>

        <View style={styles.detailGuidanceLine}>
          <View
            style={[
              styles.detailGuidanceIcon,
              { backgroundColor: tone.accentSoft },
            ]}
          >
            <Ionicons
              name="medkit-outline"
              size={18}
              color={tone.accent}
            />
          </View>
          <View style={styles.detailGuidanceCopy}>
            <Text style={styles.detailGuidanceLabel}>
              Recommended Response
            </Text>
            <Text style={styles.detailGuidanceText}>
              {profile.recommendation[currentStatus]}
            </Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

type DetailStatItem = {
  label: string;
  value: string;
  helper?: string;
};

function DetailMetaChip({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: DetailStyles;
}) {
  return (
    <View style={styles.detailMetaChip}>
      <Text style={styles.detailMetaLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={styles.detailMetaValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {value}
      </Text>
    </View>
  );
}

function PremiumDetailStatTile({
  label,
  value,
  helper,
  tone,
  styles,
}: {
  label: string;
  value: string;
  helper?: string;
  tone: SensorInsightTone;
  styles: DetailStyles;
}) {
  return (
    <View style={styles.detailStatTile}>
      <View
        style={[
          styles.detailStatIndicator,
          { backgroundColor: tone.accent },
        ]}
      />
      <Text style={styles.detailStatLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={styles.detailStatValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.64}
      >
        {value}
      </Text>
      {helper ? (
        <Text style={styles.detailStatHelper} numberOfLines={1}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

function NumericRangePanel({
  profile,
  currentValue,
  unit,
  tone,
  styles,
}: {
  profile: SensorDetailProfile;
  currentValue: number | null;
  unit?: string;
  tone: SensorInsightTone;
  styles: DetailStyles;
}) {
  if (
    currentValue === null ||
    profile.rangeMin === undefined ||
    profile.rangeMax === undefined ||
    profile.scaleMin === undefined ||
    profile.scaleMax === undefined
  ) {
    return null;
  }

  const safeLeft = getRangePercent(
    profile.rangeMin,
    profile.scaleMin,
    profile.scaleMax
  );
  const safeRight = getRangePercent(
    profile.rangeMax,
    profile.scaleMin,
    profile.scaleMax
  );
  const markerLeft = getRangePercent(
    currentValue,
    profile.scaleMin,
    profile.scaleMax
  );
  const safeWidth = Math.max(4, safeRight - safeLeft);

  return (
    <View style={styles.detailAnalysisCard}>
      <View style={styles.detailAnalysisHeader}>
        <View style={styles.detailAnalysisTitleBlock}>
          <Text style={styles.detailAnalysisTitle}>Range Position</Text>
          <Text style={styles.detailAnalysisSubtitle}>
            {profile.rangeLabel}
          </Text>
        </View>
        <Text style={styles.detailAnalysisValue} numberOfLines={1}>
          {formatMetricWithUnit(currentValue, unit ?? '')}
        </Text>
      </View>

      <View style={styles.detailRangeTrack}>
        <View
          style={[
            styles.detailRangeSafeBand,
            {
              left: `${safeLeft}%`,
              width: `${safeWidth}%`,
              backgroundColor: tone.accent,
            },
          ]}
        />
        <View
          style={[
            styles.detailRangeMarker,
            {
              left: `${markerLeft}%`,
              borderColor: tone.accent,
            },
          ]}
        />
      </View>

      <View style={styles.detailRangeLabels}>
        <Text style={styles.detailRangeLabel} numberOfLines={1}>
          {profile.lowLabel ??
            formatMetricWithUnit(profile.scaleMin, unit ?? '')}
        </Text>
        <Text style={styles.detailRangeCenterLabel} numberOfLines={1}>
          {formatMetricWithUnit(profile.rangeMin, unit ?? '')} -{' '}
          {formatMetricWithUnit(profile.rangeMax, unit ?? '')}
        </Text>
        <Text style={styles.detailRangeLabel} numberOfLines={1}>
          {profile.highLabel ??
            formatMetricWithUnit(profile.scaleMax, unit ?? '')}
        </Text>
      </View>
    </View>
  );
}

function StateDistributionPanel({
  profile,
  summary,
  activeLabel,
  inactiveLabel,
  tone,
  points,
  styles,
}: {
  profile: SensorDetailProfile;
  summary: BooleanSummary;
  activeLabel: string;
  inactiveLabel: string;
  tone: SensorInsightTone;
  points: GraphPoint[];
  styles: DetailStyles;
}) {
  const total = summary.activeCount + summary.inactiveCount;
  const activePct =
    total > 0 ? Math.round((summary.activeCount / total) * 100) : 0;
  const inactivePct = Math.max(0, 100 - activePct);

  return (
    <View style={styles.detailAnalysisCard}>
      <View style={styles.detailAnalysisHeader}>
        <View style={styles.detailAnalysisTitleBlock}>
          <Text style={styles.detailAnalysisTitle}>State Distribution</Text>
          <Text style={styles.detailAnalysisSubtitle}>
            {profile.rangeLabel}
          </Text>
        </View>
        <Text style={styles.detailAnalysisValue} numberOfLines={1}>
          {countStateTransitions(points)} changes
        </Text>
      </View>

      <View style={styles.detailStateBars}>
        <View style={styles.detailStateBarRow}>
          <Text style={styles.detailStateBarLabel} numberOfLines={1}>
            {activeLabel}
          </Text>
          <View style={styles.detailStateBarTrack}>
            <View
              style={[
                styles.detailStateBarFill,
                {
                  width: `${activePct}%`,
                  backgroundColor: tone.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.detailStateBarPct}>{activePct}%</Text>
        </View>

        <View style={styles.detailStateBarRow}>
          <Text style={styles.detailStateBarLabel} numberOfLines={1}>
            {inactiveLabel}
          </Text>
          <View style={styles.detailStateBarTrack}>
            <View
              style={[
                styles.detailStateBarFill,
                {
                  width: `${inactivePct}%`,
                  backgroundColor: 'rgba(23,28,38,0.34)',
                },
              ]}
            />
          </View>
          <Text style={styles.detailStateBarPct}>{inactivePct}%</Text>
        </View>
      </View>
    </View>
  );
}

function ImmersiveDetailGraph({
  sensorKey,
  points,
  variant,
  tone,
  profile,
  stateLabels,
  unit,
  height,
}: {
  sensorKey: SensorKey;
  points: GraphPoint[];
  variant: 'numeric' | 'boolean';
  tone: SensorInsightTone;
  profile: SensorDetailProfile;
  stateLabels?: { low: string; high: string };
  unit?: string;
  height: number;
}) {
  const geometry = buildDetailGraphGeometry(points, height, variant, profile);
  const gradientId = `detailGraphFill-${sensorKey}`;
  const glowId = `detailGraphGlow-${sensorKey}`;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${DETAIL_GRAPH_WIDTH} ${height}`}
      preserveAspectRatio="none"
    >
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0%" stopColor={tone.accent} stopOpacity="0.36" />
          <Stop offset="62%" stopColor={tone.accent} stopOpacity="0.08" />
          <Stop offset="100%" stopColor={tone.accent} stopOpacity="0" />
        </SvgLinearGradient>
        <SvgLinearGradient id={glowId} x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.02" />
          <Stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.02" />
        </SvgLinearGradient>
      </Defs>

      {geometry.targetBand ? (
        <Rect
          x={geometry.targetBand.x}
          y={geometry.targetBand.y}
          width={geometry.targetBand.width}
          height={geometry.targetBand.height}
          rx={10}
          fill={tone.accent}
          opacity={0.12}
        />
      ) : null}

      {geometry.guides.map((guide, index) => (
        <Line
          key={`${guide}-${index}`}
          x1={12}
          x2={DETAIL_GRAPH_WIDTH - 12}
          y1={guide}
          y2={guide}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />
      ))}

      <Rect
        x={0}
        y={0}
        width={DETAIL_GRAPH_WIDTH}
        height={height}
        fill={`url(#${glowId})`}
        opacity={0.36}
      />

      {geometry.areaPath ? (
        <Path d={geometry.areaPath} fill={`url(#${gradientId})`} />
      ) : null}
      {geometry.linePath ? (
        <Path
          d={geometry.linePath}
          fill="none"
          stroke={tone.accent}
          strokeWidth={variant === 'boolean' ? 3.4 : 3.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {geometry.lastPoint ? (
        <Circle
          cx={geometry.lastPoint.x}
          cy={geometry.lastPoint.y}
          r={5}
          fill={tone.accent}
          stroke="#FFFFFF"
          strokeWidth={2}
        />
      ) : null}

      <SvgText
        x={14}
        y={height - 7}
        fill="rgba(255,255,255,0.74)"
        fontSize="10"
        fontWeight="600"
      >
        {formatGraphStartLabel(points)}
      </SvgText>
      <SvgText
        x={DETAIL_GRAPH_WIDTH - 14}
        y={height - 7}
        fill="rgba(255,255,255,0.74)"
        fontSize="10"
        fontWeight="600"
        textAnchor="end"
      >
        {formatGraphEndLabel(points)}
      </SvgText>
      <SvgText
        x={DETAIL_GRAPH_WIDTH - 14}
        y={17}
        fill="rgba(255,255,255,0.8)"
        fontSize="10"
        fontWeight="700"
        textAnchor="end"
      >
        {variant === 'boolean'
          ? (stateLabels?.high ?? 'Active')
          : profile.rangeLabel}
      </SvgText>
      {variant === 'numeric' && unit ? (
        <SvgText
          x={14}
          y={17}
          fill="rgba(255,255,255,0.56)"
          fontSize="10"
          fontWeight="600"
        >
          {unit}
        </SvgText>
      ) : null}
    </Svg>
  );
}

function getDetailSensorIcon(sensorKey: SensorKey, color: string) {
  const iconProps = { size: 22, color, strokeWidth: 2.3 };

  switch (sensorKey) {
    case 'temperature':
      return <Thermometer {...iconProps} />;
    case 'humidity':
      return <Droplet {...iconProps} />;
    case 'airQuality':
      return <Wind {...iconProps} />;
    case 'sound':
      return <Volume2 {...iconProps} />;
    case 'light':
      return <Sun {...iconProps} />;
  }
}

function buildDetailStatItems({
  variant,
  unit,
  trendValue,
  numericStats,
  booleanSummary,
  points,
  currentStatus,
}: {
  variant: 'numeric' | 'boolean';
  unit?: string;
  trendValue: string;
  numericStats?: {
    average: number;
    min: number;
    max: number;
  };
  booleanSummary?: {
    summary: BooleanSummary;
    activeLabel: string;
    inactiveLabel: string;
  };
  points: GraphPoint[];
  currentStatus: SensorStatus;
}): DetailStatItem[] {
  if (variant === 'numeric' && numericStats) {
    const spread = numericStats.max - numericStats.min;

    return [
      {
        label: 'Average',
        value: formatMetricWithUnit(numericStats.average, unit ?? ''),
        helper: 'Mean reading',
      },
      {
        label: 'Minimum',
        value: formatMetricWithUnit(numericStats.min, unit ?? ''),
        helper: 'Lowest sample',
      },
      {
        label: 'Maximum',
        value: formatMetricWithUnit(numericStats.max, unit ?? ''),
        helper: 'Highest sample',
      },
      {
        label: 'Change',
        value: trendValue,
        helper: 'First to latest',
      },
      {
        label: 'Spread',
        value: formatMetricWithUnit(spread, unit ?? ''),
        helper: 'Max minus min',
      },
      {
        label: 'Status',
        value: getStatusSnapshotLabel(currentStatus),
        helper: 'Current band',
      },
    ];
  }

  if (booleanSummary) {
    const total =
      booleanSummary.summary.activeCount + booleanSummary.summary.inactiveCount;
    const activePct =
      total > 0
        ? Math.round((booleanSummary.summary.activeCount / total) * 100)
        : 0;

    return [
      {
        label: 'Current',
        value: booleanSummary.summary.currentState,
        helper: 'Latest state',
      },
      {
        label: booleanSummary.activeLabel,
        value: `${booleanSummary.summary.activeCount}`,
        helper: `${activePct}% of samples`,
      },
      {
        label: booleanSummary.inactiveLabel,
        value: `${booleanSummary.summary.inactiveCount}`,
        helper: `${Math.max(0, 100 - activePct)}% of samples`,
      },
      {
        label: 'Last State',
        value: booleanSummary.summary.lastState,
        helper: 'Previous distinct',
      },
      {
        label: 'Changes',
        value: `${countStateTransitions(points)}`,
        helper: 'State switches',
      },
      {
        label: 'Samples',
        value: `${points.length}`,
        helper: 'Window size',
      },
    ];
  }

  return [];
}

function getBooleanTrend(
  points: GraphPoint[],
  stateLabels?: { low: string; high: string }
) {
  if (points.length === 0) {
    return {
      direction: 'flat' as TrendDirection,
      label: 'No Data',
      value: '--',
    };
  }

  const latest = points[points.length - 1].value >= 1;
  let previousDistinct = latest;

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const value = points[index].value >= 1;
    if (value !== latest) {
      previousDistinct = value;
      break;
    }
  }

  const activeLabel = stateLabels?.high ?? 'Active';
  const inactiveLabel = stateLabels?.low ?? 'Inactive';
  const latestLabel = latest ? activeLabel : inactiveLabel;
  const previousLabel = previousDistinct ? activeLabel : inactiveLabel;
  const transitions = countStateTransitions(points);

  if (latest === previousDistinct) {
    return {
      direction: 'flat' as TrendDirection,
      label: 'Holding',
      value: latestLabel,
    };
  }

  return {
    direction: latest ? ('up' as TrendDirection) : ('down' as TrendDirection),
    label: 'Changed',
    value: `${previousLabel} -> ${latestLabel}`,
    transitions,
  };
}

function countStateTransitions(points: GraphPoint[]) {
  if (points.length < 2) return 0;

  let transitions = 0;
  let previous = points[0].value >= 1;

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index].value >= 1;
    if (current !== previous) {
      transitions += 1;
      previous = current;
    }
  }

  return transitions;
}

function getRangePercent(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
}

function buildDetailGraphGeometry(
  points: GraphPoint[],
  height: number,
  variant: 'numeric' | 'boolean',
  profile: SensorDetailProfile
) {
  const visiblePoints = downsampleSparklinePoints(points, 44);
  const guides = [0.24, 0.46, 0.68].map(ratio => Math.round(height * ratio));

  if (visiblePoints.length === 0) {
    return {
      linePath: '',
      areaPath: '',
      lastPoint: null,
      guides,
      targetBand: null,
    };
  }

  const xPadding = 14;
  const topPadding = 24;
  const bottomPadding = 28;
  const plotWidth = DETAIL_GRAPH_WIDTH - xPadding * 2;
  const plotHeight = height - topPadding - bottomPadding;
  const values = visiblePoints.map(point => point.value);
  const numericMin = Math.min(
    ...values,
    profile.rangeMin ?? Number.POSITIVE_INFINITY
  );
  const numericMax = Math.max(
    ...values,
    profile.rangeMax ?? Number.NEGATIVE_INFINITY
  );
  const rawMin = variant === 'boolean' ? 0 : numericMin;
  const rawMax = variant === 'boolean' ? 1 : numericMax;
  const rawRange = Math.max(rawMax - rawMin, variant === 'boolean' ? 1 : 0.1);
  const paddedMin = variant === 'boolean' ? 0 : rawMin - rawRange * 0.16;
  const paddedMax = variant === 'boolean' ? 1 : rawMax + rawRange * 0.16;
  const paddedRange = Math.max(paddedMax - paddedMin, 0.1);

  function valueToY(value: number) {
    const normalized = (value - paddedMin) / paddedRange;
    return topPadding + (1 - normalized) * plotHeight;
  }

  const coordinates = visiblePoints.map((point, index) => {
    const x =
      visiblePoints.length === 1
        ? DETAIL_GRAPH_WIDTH / 2
        : xPadding + (index / (visiblePoints.length - 1)) * plotWidth;
    return { x, y: valueToY(point.value) };
  });

  const baseline = height - bottomPadding;
  const linePath =
    variant === 'boolean'
      ? buildStepLinePath(coordinates)
      : buildSmoothLinePath(coordinates);
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${baseline} L ${firstPoint.x.toFixed(1)} ${baseline} Z`;
  const targetBand =
    variant === 'numeric' &&
    profile.rangeMin !== undefined &&
    profile.rangeMax !== undefined
      ? {
          x: xPadding,
          y: Math.min(valueToY(profile.rangeMin), valueToY(profile.rangeMax)),
          width: plotWidth,
          height: Math.max(
            6,
            Math.abs(valueToY(profile.rangeMin) - valueToY(profile.rangeMax))
          ),
        }
      : null;

  return { linePath, areaPath, lastPoint, guides, targetBand };
}

function buildSmoothLinePath(coordinates: { x: number; y: number }[]) {
  if (coordinates.length === 1) {
    const point = coordinates[0];
    return `M ${point.x - 0.01} ${point.y} L ${point.x + 0.01} ${point.y}`;
  }

  return coordinates.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;

    const previous = coordinates[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX.toFixed(1)} ${previous.y.toFixed(1)}, ${controlX.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, '');
}

function buildStepLinePath(coordinates: { x: number; y: number }[]) {
  if (coordinates.length === 1) {
    const point = coordinates[0];
    return `M ${point.x - 0.01} ${point.y} L ${point.x + 0.01} ${point.y}`;
  }

  let path = `M ${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`;

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const midX = (previous.x + current.x) / 2;
    path += ` L ${midX.toFixed(1)} ${previous.y.toFixed(1)} L ${midX.toFixed(1)} ${current.y.toFixed(1)} L ${current.x.toFixed(1)} ${current.y.toFixed(1)}`;
  }

  return path;
}

function formatGraphStartLabel(points: GraphPoint[]) {
  const first = points[0];
  if (!first) return '';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(first.timestamp));
}

function formatGraphEndLabel(points: GraphPoint[]) {
  const latest = points[points.length - 1];
  if (!latest) return '';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(latest.timestamp));
}

function formatSampleCount(count: number) {
  return `${count} sample${count === 1 ? '' : 's'}`;
}

function formatLastUpdated(points: GraphPoint[]) {
  const latest = points[points.length - 1];
  if (!latest) return '--';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(latest.timestamp));
}

function formatCadence(points: GraphPoint[]) {
  if (points.length < 2) return 'single sample';

  const first = points[0].timestamp;
  const last = points[points.length - 1].timestamp;
  const averageGap = Math.max((last - first) / (points.length - 1), 0);

  if (averageGap < 60 * 1000) {
    return `${Math.max(1, Math.round(averageGap / 1000))}s cadence`;
  }

  if (averageGap < 60 * 60 * 1000) {
    return `${Math.max(1, Math.round(averageGap / 60000))}m cadence`;
  }

  return `${Math.max(1, Math.round(averageGap / 3600000))}h cadence`;
}

function CryDetectionHeroCard({
  sensor,
  ui,
}: {
  sensor: SensorData;
  ui: DashboardUI;
}) {
  const styles = createSummaryStyles(ui);
  const model = getCryDisplayModel(sensor);
  const isOffline = model.connectionState === 'offline';
  const isStale = model.connectionState === 'stale';

  return (
    <View style={styles.cryHeroCard}>
      <View style={styles.cryHeroTopRow}>
        <Text style={styles.cryHeroEyebrow}>CRY DETECTION MODEL</Text>
        <View style={styles.cryConnectionPill}>
          <View
            style={[
              styles.cryConnectionDot,
              isOffline && styles.cryConnectionDotOffline,
              isStale && styles.cryConnectionDotStale,
            ]}
          />
          <Text style={styles.cryConnectionText}>
            {model.connectionLabel.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cryHeroMainRow}>
        <View style={styles.cryHeroLeftPane}>
          <Text
            style={styles.cryStateValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {model.stateLabel}
          </Text>
          <Text style={styles.cryInterpretation} numberOfLines={1}>
            {model.interpretation}
          </Text>

          <CryWaveform styles={styles} />
        </View>

        <CrySignalIllustration styles={styles} />
      </View>

      <View style={styles.cryHeroDivider} />

      <View style={styles.cryModelMetaRow}>
        <CryModelInfo
          icon="cube-outline"
          label="MODEL"
          value={model.modelName}
          styles={styles}
          ui={ui}
        />
        <View style={styles.cryModelMetaDivider} />
        <CryModelInfo
          icon="mic-outline"
          label="SOURCE"
          value={model.sourceLabel}
          styles={styles}
          ui={ui}
        />
      </View>

      <View style={styles.cryProbabilityRow}>
        <CryProbabilityCell
          label="AMBIENT"
          value={model.probabilities.ambient}
          active={model.state === 'ambient'}
          styles={styles}
          ui={ui}
        />
        <CryProbabilityCell
          label="CRYING"
          value={model.probabilities.crying}
          active={model.state === 'crying'}
          styles={styles}
          ui={ui}
        />
        <CryProbabilityCell
          label="BABBLE"
          value={model.probabilities.babbling_or_laughing}
          active={model.state === 'babbling_or_laughing'}
          styles={styles}
          ui={ui}
        />
      </View>
    </View>
  );
}

type SummaryStyles = ReturnType<typeof createSummaryStyles>;

function CryWaveform({ styles }: { styles: SummaryStyles }) {
  const centerY = 9;
  const marks = Array.from({ length: 58 }, (_, index) => {
    const x = 5 + index * 6.7;
    const distanceFromCenter = Math.abs(index - 28.5);
    const centerSwell = Math.exp(-(distanceFromCenter * distanceFromCenter) / 92);
    const sideTexture = Math.sin(index * 0.92) * 0.48;
    const height = Math.max(2.5, 3 + centerSwell * 14 * (1 + sideTexture));
    const isQuietEdge = distanceFromCenter > 13;

    if (isQuietEdge) {
      return (
        <Circle
          key={index}
          cx={x}
          cy={centerY}
          r={1.25}
          fill="#A9C2FF"
          opacity="0.88"
        />
      );
    }

    return (
      <Line
        key={index}
        x1={x}
        y1={centerY - height / 2}
        x2={x}
        y2={centerY + height / 2}
        stroke="#A9C2FF"
        strokeWidth={2.35}
        strokeLinecap="round"
        opacity={distanceFromCenter < 8 ? 0.98 : 0.86}
      />
    );
  });

  return (
    <View style={styles.cryWaveform}>
      <Svg width="100%" height="100%" viewBox="0 0 276 22" preserveAspectRatio="none">
        {marks}
      </Svg>
    </View>
  );
}

function CrySignalIllustration({ styles }: { styles: SummaryStyles }) {
  return (
    <View style={styles.crySignalIllustration}>
      <Svg width="100%" height="100%" viewBox="0 0 180 180">
        <Defs>
          <RadialGradient id="cryGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFE7C8" stopOpacity="0.46" />
            <Stop offset="46%" stopColor="#9DBBFF" stopOpacity="0.22" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <SvgLinearGradient id="babyHaloFill" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24" />
            <Stop offset="100%" stopColor="#7BB8FF" stopOpacity="0.12" />
          </SvgLinearGradient>
          <SvgLinearGradient id="babySkinFill" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0%" stopColor="#FFF1DD" stopOpacity="1" />
            <Stop offset="64%" stopColor="#FFD4B8" stopOpacity="1" />
            <Stop offset="100%" stopColor="#F5B99B" stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient id="babyCapFill" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
            <Stop offset="58%" stopColor="#D8EAFF" stopOpacity="0.98" />
            <Stop offset="100%" stopColor="#9FC8FF" stopOpacity="0.96" />
          </SvgLinearGradient>
          <SvgLinearGradient id="babyWrapFill" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0%" stopColor="#EEF7FF" stopOpacity="1" />
            <Stop offset="52%" stopColor="#BBD9FF" stopOpacity="0.98" />
            <Stop offset="100%" stopColor="#79AFFF" stopOpacity="0.9" />
          </SvgLinearGradient>
          <SvgLinearGradient id="babyWrapShadow" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0%" stopColor="#7BB8FF" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#233B66" stopOpacity="0.18" />
          </SvgLinearGradient>
        </Defs>

        <Circle cx="90" cy="90" r="64" fill="url(#cryGlow)" />
        <Circle cx="90" cy="91" r="57" fill="url(#babyHaloFill)" />
        <Circle
          cx="90"
          cy="91"
          r="62"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          opacity="0.18"
        />
        <Circle cx="42" cy="58" r="2.4" fill="#FFFFFF" opacity="0.52" />
        <Circle cx="132" cy="47" r="2.8" fill="#FFE7C8" opacity="0.58" />
        <Circle cx="143" cy="104" r="1.8" fill="#FFFFFF" opacity="0.46" />

        <Path
          d="M52 130C55 108 70 96 90 96C110 96 125 108 128 130C121 146 107 154 90 154C73 154 59 146 52 130Z"
          fill="url(#babyWrapFill)"
        />
        <Path
          d="M57 134C66 142 77 146 90 146C103 146 114 142 123 134C117 149 105 157 90 157C75 157 63 149 57 134Z"
          fill="url(#babyWrapShadow)"
        />
        <Path
          d="M64 117C74 126 85 132 98 135C89 140 82 146 76 151"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.2"
          opacity="0.74"
        />
        <Path
          d="M117 117C105 127 93 135 78 139"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.2"
          opacity="0.54"
        />

        <Circle cx="55" cy="86" r="10.5" fill="#F2B997" opacity="0.9" />
        <Circle cx="125" cy="86" r="10.5" fill="#F2B997" opacity="0.9" />
        <Circle cx="90" cy="85" r="39.5" fill="url(#babySkinFill)" />
        <Path
          d="M57 81C59 58 73 46 91 46C111 46 123 61 124 82C116 75 105 71 91 71C77 71 66 74 57 81Z"
          fill="url(#babyCapFill)"
        />
        <Path
          d="M58 82C64 68 76 60 90 60C105 60 117 68 123 82"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeWidth="3"
          opacity="0.72"
        />
        <Path
          d="M84 47C78 40 82 32 90 32C98 32 102 41 94 48"
          fill="none"
          stroke="#FFFFFF"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          opacity="0.95"
        />
        <Circle cx="90" cy="34" r="5.4" fill="#FFFFFF" opacity="0.92" />

        <Circle cx="74" cy="97" r="7.2" fill="#FF9EB0" opacity="0.25" />
        <Circle cx="106" cy="97" r="7.2" fill="#FF9EB0" opacity="0.25" />
        <G
          fill="none"
          stroke="#263A5E"
          strokeLinecap="round"
          strokeWidth="3"
          opacity="0.72"
        >
          <Path d="M72 84C76 88 82 88 86 84" />
          <Path d="M94 84C98 88 104 88 108 84" />
        </G>
        <Path
          d="M87 92C89 93.3 91 93.3 93 92"
          fill="none"
          stroke="#263A5E"
          strokeLinecap="round"
          strokeWidth="2"
          opacity="0.34"
        />
        <Path
          d="M82 105C86 110 94 110 98 105"
          fill="none"
          stroke="#263A5E"
          strokeLinecap="round"
          strokeWidth="3"
          opacity="0.62"
        />
        <Path
          d="M59 88C59 109 72 123 90 123C108 123 121 109 121 88"
          fill="none"
          stroke="#FFF7EC"
          strokeLinecap="round"
          strokeWidth="2.3"
          opacity="0.34"
        />
        <Circle cx="76" cy="78" r="1.4" fill="#FFFFFF" opacity="0.82" />
        <Circle cx="101" cy="78" r="1.2" fill="#FFFFFF" opacity="0.7" />
      </Svg>
    </View>
  );
}

function CryModelInfo({
  icon,
  label,
  value,
  styles,
  ui,
}: {
  icon: IoniconName;
  label: string;
  value: string;
  styles: SummaryStyles;
  ui: DashboardUI;
}) {
  return (
    <View style={styles.cryModelInfo}>
      <Ionicons name={icon} size={21} color={ui.onBlack} />
      <View style={styles.cryModelInfoCopy}>
        <Text style={styles.cryModelInfoLabel}>{label}</Text>
        <Text style={styles.cryModelInfoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function CryProbabilityCell({
  label,
  value,
  active,
  styles,
  ui,
}: {
  label: string;
  value: number | null;
  active: boolean;
  styles: SummaryStyles;
  ui: DashboardUI;
}) {
  const targetProgress = normalizeProbability(value) ?? 0;
  const hasValue = value !== null;
  const animatedProgress = useRef(new Animated.Value(targetProgress)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(targetProgress);

  useEffect(() => {
    const listenerId = animatedProgress.addListener(({ value: nextProgress }) => {
      setDisplayProgress(Math.min(Math.max(nextProgress, 0), 1));
    });

    return () => {
      animatedProgress.removeListener(listenerId);
    };
  }, [animatedProgress]);

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: targetProgress,
      duration: CRY_PROBABILITY_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, targetProgress]);

  const animatedFillWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, trackWidth],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.cryProbabilityCell, active && styles.cryProbabilityCellActive]}>
      <Text style={styles.cryProbabilityLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={styles.cryProbabilityValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
      >
        {formatCryProbabilityValue(hasValue ? displayProgress : null)}
      </Text>
      <View
        style={styles.cryProbabilityTrack}
        onLayout={({ nativeEvent }) => {
          const nextWidth = nativeEvent.layout.width;
          setTrackWidth(currentWidth =>
            currentWidth === nextWidth ? currentWidth : nextWidth
          );
        }}
      >
        <Animated.View
          style={[
            styles.cryProbabilityFill,
            {
              width: animatedFillWidth,
              backgroundColor: active ? '#7BB8FF' : ui.blackSurfaceSoft,
            },
          ]}
        />
      </View>
    </View>
  );
}

function DashboardSensorCard({
  label,
  value,
  unit,
  status,
  statusLabel,
  icon,
  ui,
  containerStyle,
  wide = false,
  onPress,
}: {
  label: string;
  value: string | number;
  unit?: string;
  status: SensorStatus;
  statusLabel?: string;
  icon: ReactNode;
  ui: DashboardUI;
  containerStyle?: StyleProp<ViewStyle>;
  wide?: boolean;
  onPress: () => void;
}) {
  const styles = createSensorCardStyles(ui);
  const resolvedStatusLabel = statusLabel ?? getSensorCardStatusLabel(label, status);
  const statusColor = getSensorCardStatusColor(label, status, ui);

  if (wide) {
    return (
      <Pressable
        style={[styles.sensorCard, styles.sensorCardWide, containerStyle]}
        onPress={onPress}
      >
        <View style={styles.sensorWideContent}>
          <View style={styles.sensorIconBox}>{icon}</View>
          <View style={styles.sensorWideCopy}>
            <Text
              style={styles.sensorLabel}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {label}
            </Text>
            <Text
              style={styles.sensorValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.56}
            >
              {value}
              {unit ? <Text style={styles.sensorUnit}> {unit}</Text> : null}
            </Text>
            <SensorStatusPill
              label={resolvedStatusLabel}
              color={statusColor}
              styles={styles}
            />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.sensorCard, containerStyle]}
      onPress={onPress}
    >
      <Text
        style={styles.sensorLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {label}
      </Text>

      <View style={styles.sensorCardMiddleRow}>
        <View style={styles.sensorIconBox}>{icon}</View>
        <Text
          style={styles.sensorValue}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.56}
        >
          {value}
          {unit ? <Text style={styles.sensorUnit}> {unit}</Text> : null}
        </Text>
      </View>

      <SensorStatusPill
        label={resolvedStatusLabel}
        color={statusColor}
        styles={styles}
      />
    </Pressable>
  );
}

function SensorStatusPill({
  label,
  color,
  styles,
}: {
  label: string;
  color: string;
  styles: ReturnType<typeof createSensorCardStyles>;
}) {
  return (
    <View style={styles.sensorStatusPill}>
      <View style={[styles.sensorStatusDot, { backgroundColor: color }]} />
      <Text style={styles.sensorStatusPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function getSensorCardStatusLabel(label: string, status: SensorStatus) {
  if (status === 'unknown') return 'Unavailable';
  if (status === 'danger') return 'Critical';
  if (status === 'warning') return 'Caution';
  if (label === 'Light' || label === 'Sound') return 'Optimal';
  if (label === 'Air Quality') return 'Good';
  return 'Normal';
}

function getSensorCardStatusColor(
  label: string,
  status: SensorStatus,
  ui: DashboardUI
) {
  if (status === 'unknown') return ui.muted;
  if (status === 'danger') return ui.alert;
  if (status === 'warning') return '#B7791F';
  if (label === 'Light' || label === 'Sound') return '#2563EB';
  return '#0E9F6E';
}

function DashboardNotificationBell({
  hasUnread,
  ui,
  onOpen,
}: {
  hasUnread: boolean;
  ui: DashboardUI;
  onOpen: () => void;
}) {
  const styles = createNotificationStyles(ui);

  return (
    <Pressable style={styles.bellButton} onPress={onOpen}>
      <Ionicons name="notifications-outline" size={22} color={ui.ink} />
      {hasUnread && <View style={styles.notificationDot} />}
    </Pressable>
  );
}

function DashboardNotificationPopover({
  notifications,
  visible,
  ui,
  topOffset,
  onClose,
  onDismiss,
}: {
  notifications: NotificationItem[];
  visible: boolean;
  ui: DashboardUI;
  topOffset: number;
  onClose: () => void;
  onDismiss: (id: string) => void;
}) {
  const styles = createNotificationStyles(ui);
  const hasUnread = notifications.length > 0;
  const alertCountLabel =
    notifications.length === 1
      ? '1 active alert'
      : `${notifications.length} active alerts`;

  if (!visible) return null;

  return (
    <View style={styles.notificationOverlay} pointerEvents="box-none">
      <Pressable style={styles.notificationBackdrop} onPress={onClose} />

      <View style={[styles.notificationPanel, { top: topOffset }]}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationHeaderText}>
            <Text style={styles.notificationTitle}>Notifications</Text>
            <Text style={styles.notificationSubtitle}>
              {hasUnread ? alertCountLabel : 'All systems are quiet'}
            </Text>
          </View>
          <Pressable
            style={styles.notificationCloseButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={16} color={ui.muted} />
          </Pressable>
        </View>

        {notifications.length === 0 ? (
          <View style={styles.notificationEmptyState}>
            <Text style={styles.notificationEmptyTitle}>No alerts yet</Text>
            <Text style={styles.notificationEmptyText}>
              Vitals are stable across the current bed.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.notificationList}
            contentContainerStyle={styles.notificationListContent}
            showsVerticalScrollIndicator={false}
          >
            {notifications.map(notification => (
              <View key={notification.id} style={styles.notificationItem}>
                <View style={styles.notificationCopy}>
                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {formatNotificationTime(notification.timestamp)}
                  </Text>
                </View>
                <Pressable
                  style={styles.notificationDismiss}
                  onPress={() => onDismiss(notification.id)}
                >
                  <Ionicons name="close" size={14} color={ui.muted} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function formatNotificationTime(timestamp: number) {
  const elapsedMs = Date.now() - timestamp;
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function NumericMetricCard({
  label,
  unit,
  currentValue,
  avg,
  min,
  max,
  status,
  statusLabel,
  ui,
  icon,
  tone,
  history,
  cardWidth,
  onPress,
}: {
  label: string;
  unit: string;
  currentValue: number;
  avg: number;
  min: number;
  max: number;
  status: SensorStatus;
  statusLabel?: string;
  ui: DashboardUI;
  icon: ReactNode;
  tone: SensorInsightTone;
  history: GraphPoint[];
  cardWidth: number;
  onPress: () => void;
}) {
  const styles = createMetricCardStyles(ui);
  const resolvedStatusLabel = statusLabel ?? getSensorCardStatusLabel(label, status);
  const statusColor = getSensorCardStatusColor(label, status, ui);
  const trend = getNumericTrend(history, unit);
  const formattedCurrentValue = formatMetricNumber(currentValue, unit);

  return (
    <Pressable
      style={[styles.metricCard, { width: cardWidth }]}
      onPress={onPress}
    >
      <LinearGradient
        colors={tone.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricCardGradient}
      >
        <View
          style={[
            styles.metricColorWash,
            { backgroundColor: tone.accentSoft },
          ]}
        />

        <View style={styles.metricHeaderRow}>
          <View style={styles.metricTitleCluster}>
            <View
              style={[
                styles.metricIconShell,
                { backgroundColor: tone.accentSoft },
              ]}
            >
              {icon}
            </View>
            <View style={styles.metricTitleCopy}>
              <Text style={styles.metricTitle} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.metricSubtitle} numberOfLines={1}>
                Current profile
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.metricStatusBadge,
              { backgroundColor: statusColor },
            ]}
          >
            <Text style={styles.metricStatusText} numberOfLines={1}>
              {resolvedStatusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.metricHeroRow}>
          <View style={styles.metricPrimaryBlock}>
            <Text
              style={styles.metricPrimaryValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {formattedCurrentValue}
              {formattedCurrentValue !== '--' ? (
                <Text style={styles.metricPrimaryUnit}> {unit}</Text>
              ) : null}
            </Text>
            <Text style={styles.metricCaption}>Now reading</Text>
          </View>

          <MetricTrendPill trend={trend} tone={tone} styles={styles} />
        </View>

        <View style={styles.metricSparkFrame}>
          <MiniTrendLine
            points={history}
            color={tone.accent}
            fillColor={tone.graphFill}
          />
        </View>

        <View style={styles.metricStatsRow}>
          <MetricStatCell
            label="Avg"
            value={formatMetricWithUnit(avg, unit)}
            styles={styles}
          />
          <MetricStatCell
            label="Min"
            value={formatMetricWithUnit(min, unit)}
            styles={styles}
          />
          <MetricStatCell
            label="Max"
            value={formatMetricWithUnit(max, unit)}
            styles={styles}
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function StateMetricCard({
  label,
  currentValue,
  activeLabel,
  activeCount,
  inactiveLabel,
  inactiveCount,
  lastState,
  status,
  ui,
  icon,
  tone,
  history,
  cardWidth,
  onPress,
}: {
  label: string;
  currentValue: string;
  activeLabel: string;
  activeCount: number;
  inactiveLabel: string;
  inactiveCount: number;
  lastState: string;
  status: SensorStatus;
  ui: DashboardUI;
  icon: ReactNode;
  tone: SensorInsightTone;
  history: GraphPoint[];
  cardWidth: number;
  onPress: () => void;
}) {
  const styles = createMetricCardStyles(ui);
  const statusLabel = getSensorCardStatusLabel(label, status);
  const statusColor = getSensorCardStatusColor(label, status, ui);
  const totalCount = activeCount + inactiveCount;

  return (
    <Pressable
      style={[styles.metricCard, { width: cardWidth }]}
      onPress={onPress}
    >
      <LinearGradient
        colors={tone.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.metricCardGradient}
      >
        <View
          style={[
            styles.metricColorWash,
            { backgroundColor: tone.accentSoft },
          ]}
        />

        <View style={styles.metricHeaderRow}>
          <View style={styles.metricTitleCluster}>
            <View
              style={[
                styles.metricIconShell,
                { backgroundColor: tone.accentSoft },
              ]}
            >
              {icon}
            </View>
            <View style={styles.metricTitleCopy}>
              <Text style={styles.metricTitle} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.metricSubtitle} numberOfLines={1}>
                State profile
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.metricStatusBadge,
              { backgroundColor: statusColor },
            ]}
          >
            <Text style={styles.metricStatusText} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.metricHeroRow}>
          <View style={styles.metricPrimaryBlock}>
            <Text
              style={styles.metricPrimaryValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.62}
            >
              {currentValue}
            </Text>
            <Text style={styles.metricCaption}>Current state</Text>
          </View>

          <View
            style={[
              styles.metricStateBadge,
              { backgroundColor: tone.accentSoft },
            ]}
          >
            <Text
              style={[styles.metricStateBadgeText, { color: tone.accent }]}
              numberOfLines={1}
            >
              {lastState}
            </Text>
            <Text style={styles.metricStateBadgeLabel}>last</Text>
          </View>
        </View>

        <View style={styles.metricSparkFrame}>
          <MiniTrendLine
            points={history}
            color={tone.accent}
            fillColor={tone.graphFill}
          />
        </View>

        <View style={styles.metricStatsRow}>
          <MetricStatCell
            label={activeLabel}
            value={`${activeCount}`}
            styles={styles}
          />
          <MetricStatCell
            label={inactiveLabel}
            value={`${inactiveCount}`}
            styles={styles}
          />
          <MetricStatCell label="Samples" value={`${totalCount}`} styles={styles} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function MetricTrendPill({
  trend,
  tone,
  styles,
}: {
  trend: ReturnType<typeof getNumericTrend>;
  tone: SensorInsightTone;
  styles: ReturnType<typeof createMetricCardStyles>;
}) {
  return (
    <View style={[styles.metricTrendPill, { backgroundColor: tone.accentSoft }]}>
      <Ionicons
        name={getTrendIconName(trend.direction)}
        size={13}
        color={tone.accent}
      />
      <View style={styles.metricTrendCopy}>
        <Text
          style={[styles.metricTrendLabel, { color: tone.accent }]}
          numberOfLines={1}
        >
          {trend.label}
        </Text>
        <Text style={styles.metricTrendValue} numberOfLines={1}>
          {trend.value}
        </Text>
      </View>
    </View>
  );
}

function MetricStatCell({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createMetricCardStyles>;
}) {
  return (
    <View style={styles.metricStatCell}>
      <Text style={styles.metricStatLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={styles.metricStatValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.68}
      >
        {value}
      </Text>
    </View>
  );
}

function MiniTrendLine({
  points,
  color,
  fillColor,
}: {
  points: GraphPoint[];
  color: string;
  fillColor: string;
}) {
  const geometry = buildSparklineGeometry(points);

  return (
    <Svg
      width="100%"
      height={SPARKLINE_HEIGHT}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      preserveAspectRatio="none"
    >
      {[18, 39, 60].map(y => (
        <Line
          key={y}
          x1={0}
          x2={SPARKLINE_WIDTH}
          y1={y}
          y2={y}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />
      ))}
      {geometry.areaPath ? (
        <Path d={geometry.areaPath} fill={fillColor} />
      ) : null}
      {geometry.linePath ? (
        <Path
          d={geometry.linePath}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {geometry.lastPoint ? (
        <Circle
          cx={geometry.lastPoint.x}
          cy={geometry.lastPoint.y}
          r={4}
          fill={color}
          stroke="rgba(255,255,255,0.82)"
          strokeWidth={2}
        />
      ) : null}
    </Svg>
  );
}

function toGraphPoints(
  points: { timestamp: number; value: number | boolean }[]
): GraphPoint[] {
  return points.map(point => ({
    timestamp: point.timestamp,
    value:
      typeof point.value === 'boolean' ? (point.value ? 1 : 0) : point.value,
  }));
}

function getNumericTrend(points: GraphPoint[], unit: string) {
  if (points.length < 2) {
    return {
      direction: 'flat' as TrendDirection,
      label: 'Holding',
      value: '--',
    };
  }

  const firstValue = points[0].value;
  const lastValue = points[points.length - 1].value;
  const delta = lastValue - firstValue;
  const threshold = unit === 'ppm' ? 8 : unit === '%' ? 0.8 : 0.2;
  const direction: TrendDirection =
    Math.abs(delta) <= threshold ? 'flat' : delta > 0 ? 'up' : 'down';

  return {
    direction,
    label:
      direction === 'flat' ? 'Stable' : direction === 'up' ? 'Rising' : 'Falling',
    value:
      direction === 'flat'
        ? `~${formatMetricWithUnit(Math.abs(delta), unit)}`
        : formatSignedMetric(delta, unit),
  };
}

function getTrendIconName(direction: TrendDirection): IoniconName {
  if (direction === 'up') return 'trending-up';
  if (direction === 'down') return 'trending-down';
  return 'remove';
}

function formatMetricNumber(value: number | null | undefined, unit: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  if (unit === 'ppm') return `${Math.round(value)}`;
  return value.toFixed(1);
}

function formatMetricWithUnit(value: number | null | undefined, unit: string) {
  const formatted = formatMetricNumber(value, unit);
  if (formatted === '--' || !unit) return formatted;
  if (unit === 'ppm') return `${formatted} ppm`;
  return `${formatted}${unit}`;
}

function formatSignedMetric(value: number, unit: string) {
  const sign = value > 0 ? '+' : '-';
  return `${sign}${formatMetricWithUnit(Math.abs(value), unit)}`;
}

function downsampleSparklinePoints(points: GraphPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;

  const sampled: GraphPoint[] = [];
  const lastIndex = points.length - 1;

  for (let index = 0; index < maxPoints; index += 1) {
    const sampleIndex = Math.round((index / (maxPoints - 1)) * lastIndex);
    sampled.push(points[sampleIndex]);
  }

  return sampled;
}

function buildSparklineGeometry(points: GraphPoint[]) {
  const visiblePoints = downsampleSparklinePoints(points, 30);

  if (visiblePoints.length === 0) {
    return { linePath: '', areaPath: '', lastPoint: null };
  }

  const values = visiblePoints.map(point => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const hasRange = maxValue - minValue > 0;
  const paddedMin = hasRange ? minValue : minValue - 1;
  const paddedRange = hasRange ? maxValue - minValue : 2;
  const horizontalPadding = 8;
  const verticalPadding = 10;
  const plotWidth = SPARKLINE_WIDTH - horizontalPadding * 2;
  const plotHeight = SPARKLINE_HEIGHT - verticalPadding * 2;

  const coordinates = visiblePoints.map((point, index) => {
    const x =
      visiblePoints.length === 1
        ? SPARKLINE_WIDTH / 2
        : horizontalPadding +
          (index / (visiblePoints.length - 1)) * plotWidth;
    const normalized = (point.value - paddedMin) / paddedRange;
    const y = verticalPadding + (1 - normalized) * plotHeight;

    return { x, y };
  });

  if (coordinates.length === 1) {
    const point = coordinates[0];
    const linePath = `M ${point.x - 0.01} ${point.y} L ${point.x + 0.01} ${point.y}`;
    const areaPath = `${linePath} L ${point.x + 0.01} ${SPARKLINE_HEIGHT - verticalPadding} L ${point.x - 0.01} ${SPARKLINE_HEIGHT - verticalPadding} Z`;

    return { linePath, areaPath, lastPoint: point };
  }

  const linePath = coordinates
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(' ');
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${SPARKLINE_HEIGHT - verticalPadding} L ${firstPoint.x.toFixed(1)} ${SPARKLINE_HEIGHT - verticalPadding} Z`;

  return { linePath, areaPath, lastPoint };
}

function createStyles(ui: DashboardUI) {
  return StyleSheet.create({
    screenRoot: {
      flex: 1,
      backgroundColor: ui.background,
    },
    container: {
      paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    },
    bedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ui.white,
      borderWidth: 1,
      borderColor: ui.border,
      borderRadius: 15,
      paddingLeft: 6,
      paddingRight: 11,
      height: 38,
      width: 172,
      maxWidth: '64%',
      flexShrink: 1,
      shadowColor: ui.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    bedButtonIcon: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ui.softSurface,
      marginRight: 10,
    },
    bedText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      lineHeight: 19,
      color: ui.ink,
      flex: 1,
      minWidth: 0,
    },
    bedChevron: {
      marginLeft: 7,
    },
    bedDropdown: {
      marginTop: 7,
      marginBottom: 8,
      alignSelf: 'flex-start',
      backgroundColor: ui.white,
      borderWidth: 1,
      borderColor: ui.border,
      borderRadius: 16,
      padding: 6,
      width: 172,
      zIndex: 30,
      elevation: 6,
      shadowColor: ui.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
    },
    bedItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 12,
      minHeight: 38,
      paddingHorizontal: 10,
      marginBottom: 2,
    },
    bedItemRowActive: {
      backgroundColor: ui.softSurface,
    },
    bedItemPressable: {
      flex: 1,
      minWidth: 0,
      alignSelf: 'stretch',
      justifyContent: 'center',
    },
    bedItemText: {
      fontFamily: 'Inter-Regular',
      fontSize: 13,
      color: ui.ink,
    },
    bedItemTextActive: {
      fontFamily: 'Inter-SemiBold',
    },
    bedCheckIcon: {
      marginLeft: 8,
      marginRight: 2,
    },
    bedDeleteButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 2,
    },
    divider: {
      height: 1,
      backgroundColor: ui.border,
      marginVertical: 6,
    },
    addBedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 36,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
    },
    addBedText: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: ui.ink,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 12,
      marginBottom: 20,
    },
    sensorGridCard: {
      width: '48.4%',
      marginBottom: 0,
    },
    sensorGridCardWide: {
      width: '48.4%',
      marginBottom: 0,
    },
    snapshotSection: {
      marginBottom: 20,
      paddingHorizontal: 2,
    },
    snapshotHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 11,
    },
    snapshotTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    snapshotTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      lineHeight: 18,
      color: ui.ink,
      marginBottom: 1,
    },
    snapshotSubtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
    },
    snapshotCount: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      color: ui.muted,
      textTransform: 'uppercase',
      flexShrink: 0,
    },
    snapshotInlineGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
    },
    snapshotInlineItem: {
      width: '48.4%',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 34,
    },
    snapshotAccentLine: {
      width: 3,
      height: 26,
      borderRadius: 2,
      backgroundColor: ui.ink,
      opacity: 0.72,
      marginRight: 7,
    },
    statusMark: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ui.ink,
      marginRight: 8,
    },
    snapshotInlineCopy: {
      flex: 1,
      minWidth: 0,
    },
    snapshotChipLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: ui.slate,
      textTransform: 'uppercase',
    },
    snapshotChipValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 12,
      lineHeight: 16,
      color: ui.ink,
    },
    trendWindowControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
      backgroundColor: ui.softSurface,
      borderWidth: 1,
      borderColor: ui.border,
      borderRadius: 18,
      padding: 4,
    },
    trendWindowLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
      textTransform: 'uppercase',
      width: 54,
      textAlign: 'center',
    },
    hoursRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: ui.white,
      borderWidth: 0,
      borderColor: 'transparent',
      borderRadius: 16,
      padding: 3,
      gap: 3,
    },
    hourChip: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    hourChipActive: {
      backgroundColor: ui.ink,
      shadowColor: ui.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    hourText: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      color: ui.slate,
    },
    hourTextActive: {
      color: ui.white === '#FFFFFF' ? '#FFFFFF' : '#0C121B',
    },
    detailsSection: {
      marginBottom: 4,
      paddingTop: 2,
    },
    detailsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    detailsTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    detailsEyebrow: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    detailsTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 18,
      lineHeight: 23,
      color: ui.ink,
    },
    detailsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
      rowGap: 12,
    },
    detailsDeck: {
      overflow: 'visible',
    },
    detailsDeckContent: {
      alignItems: 'flex-start',
      gap: 12,
      paddingRight: 4,
    },
    topControls: {
      position: 'relative',
      marginBottom: 13,
      zIndex: 30,
    },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 38,
      gap: 10,
    },
    sensorSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    sensorSectionIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ui.softSurface,
      flexShrink: 0,
    },
    sensorSectionCopy: {
      flex: 1,
      minWidth: 0,
    },
    sensorSectionTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 16,
      color: ui.ink,
      marginBottom: 2,
    },
    sensorSectionSubtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
    },
  });
}

function createDetailStyles(ui: DashboardUI) {
  return StyleSheet.create({
    detailRoot: {
      flex: 1,
      backgroundColor: ui.background,
    },
    detailTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
      paddingBottom: 14,
      backgroundColor: 'transparent',
    },
    detailBackButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderWidth: 1,
      borderColor: ui.border,
      marginRight: 12,
      shadowColor: ui.shadow,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    detailHeaderCopy: {
      flex: 1,
      minWidth: 0,
    },
    detailTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 18,
      color: ui.ink,
      marginBottom: 3,
    },
    detailSubtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      color: ui.slate,
    },
    detailContent: {
      paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
      paddingTop: 0,
    },
    detailCurrentValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 36,
      lineHeight: 42,
      color: ui.onBlack,
    },
    detailCurrentUnit: {
      fontFamily: 'Inter-Medium',
      fontSize: 15,
      color: ui.onBlackMuted,
    },
    detailStatsGrid: {
      marginBottom: 18,
    },
    detailStatTile: {
      width: '48%',
      minHeight: 70,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderColor: 'transparent',
      borderRadius: 0,
      borderTopWidth: 1,
      borderTopColor: ui.border,
      paddingTop: 12,
      paddingBottom: 10,
      paddingHorizontal: 0,
      paddingLeft: 22,
      justifyContent: 'space-between',
      shadowColor: ui.shadow,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    detailStatLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: ui.slate,
    },
    detailStatValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 17,
      color: ui.ink,
    },
    detailStatUnit: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: ui.slate,
    },
    detailTopStatusPill: {
      minWidth: 58,
      height: 32,
      borderRadius: 16,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ui.softSurface,
      borderWidth: 1,
      borderColor: ui.border,
      gap: 6,
      flexShrink: 0,
    },
    detailTopStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    detailTopStatusText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: ui.ink,
      textTransform: 'uppercase',
    },
    detailTopSignalText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0,
      textTransform: 'uppercase',
      flexShrink: 0,
    },
    detailImmersiveBand: {
      minHeight: 388,
      marginHorizontal: -SCREEN_HORIZONTAL_PADDING,
      paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
      paddingTop: 18,
      paddingBottom: 16,
      marginBottom: 14,
      overflow: 'hidden',
    },
    detailBandGlow: {
      position: 'absolute',
      right: -70,
      top: -64,
      width: 180,
      height: 180,
      borderRadius: 90,
      opacity: 0.98,
    },
    detailBandHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    detailBandTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    detailBandIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    detailBandTitleCopy: {
      flex: 1,
      minWidth: 0,
    },
    detailBandEyebrow: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: 'rgba(255,255,255,0.74)',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    detailBandTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 18,
      lineHeight: 22,
      color: ui.onBlack,
    },
    detailBandStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    detailBandStatusText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      textTransform: 'uppercase',
    },
    detailBandValueRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 7,
    },
    detailBandValueBlock: {
      flex: 1,
      minWidth: 0,
    },
    detailTrendInline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 5,
      maxWidth: 132,
      paddingBottom: 8,
      flexShrink: 0,
    },
    detailTrendInlineText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 11,
      lineHeight: 14,
      flexShrink: 1,
    },
    detailGraphBackdrop: {
      height: 206,
      marginHorizontal: -6,
      marginBottom: 8,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    detailBandInterpretation: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      lineHeight: 17,
      color: 'rgba(255,255,255,0.86)',
      marginBottom: 12,
    },
    detailBandMetaRow: {
      flexDirection: 'row',
      gap: 10,
    },
    detailMetaChip: {
      flex: 1,
      minWidth: 0,
      minHeight: 42,
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.24)',
      paddingTop: 8,
      paddingHorizontal: 0,
      paddingVertical: 0,
      justifyContent: 'space-between',
    },
    detailMetaLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: 'rgba(255,255,255,0.72)',
      textTransform: 'uppercase',
    },
    detailMetaValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 12,
      lineHeight: 16,
      color: ui.onBlack,
    },
    detailWindowRail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
      paddingVertical: 2,
    },
    detailWindowRailLabel: {
      width: 52,
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
      textTransform: 'uppercase',
    },
    detailHoursRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ui.softSurface,
      borderRadius: 15,
      padding: 3,
      gap: 3,
    },
    detailHourChip: {
      flex: 1,
      minWidth: 0,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailHourChipActive: {
      backgroundColor: ui.ink,
      shadowColor: ui.shadow,
      shadowOpacity: 0,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    detailHourText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
    },
    detailHourTextActive: {
      color: ui.white,
    },
    detailInsightStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: ui.border,
      paddingVertical: 12,
      marginBottom: 14,
    },
    detailInsightLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: ui.ink,
      flexShrink: 0,
    },
    detailInsightText: {
      flex: 1,
      minWidth: 0,
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ui.slate,
      textAlign: 'right',
    },
    detailAnalysisCard: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: ui.border,
      borderRadius: 0,
      paddingVertical: 14,
      paddingHorizontal: 0,
      marginBottom: 14,
    },
    detailAnalysisHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    detailAnalysisTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    detailAnalysisTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      lineHeight: 19,
      color: ui.ink,
      marginBottom: 2,
    },
    detailAnalysisSubtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: ui.slate,
    },
    detailAnalysisValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: ui.ink,
      flexShrink: 0,
    },
    detailRangeTrack: {
      height: 12,
      borderRadius: 999,
      backgroundColor: '#DDE7F4',
      overflow: 'hidden',
      position: 'relative',
      marginBottom: 10,
    },
    detailRangeSafeBand: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      opacity: 0.88,
      borderRadius: 999,
    },
    detailRangeMarker: {
      position: 'absolute',
      top: -5,
      width: 6,
      height: 22,
      borderRadius: 3,
      backgroundColor: ui.white,
      borderWidth: 2,
      marginLeft: -3,
      shadowColor: ui.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    detailRangeLabels: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    detailRangeLabel: {
      flex: 1,
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
    },
    detailRangeCenterLabel: {
      flex: 1.35,
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: ui.ink,
      textAlign: 'center',
    },
    detailStateBars: {
      gap: 11,
    },
    detailStateBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    detailStateBarLabel: {
      width: 74,
      fontFamily: 'Inter-SemiBold',
      fontSize: 11,
      lineHeight: 14,
      color: ui.ink,
    },
    detailStateBarTrack: {
      flex: 1,
      height: 9,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: '#DDE7F4',
    },
    detailStateBarFill: {
      height: 9,
      borderRadius: 999,
    },
    detailStateBarPct: {
      width: 34,
      textAlign: 'right',
      fontFamily: 'Inter-SemiBold',
      fontSize: 11,
      lineHeight: 14,
      color: ui.ink,
    },
    detailStatsHeader: {
      marginBottom: 10,
    },
    detailStatsTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      lineHeight: 19,
      color: ui.ink,
      marginBottom: 2,
    },
    detailStatsSubtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: ui.slate,
    },
    detailStatTileGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
    },
    detailStatIndicator: {
      position: 'absolute',
      left: 4,
      top: 13,
      width: 3,
      height: 26,
      borderRadius: 3,
    },
    detailStatHelper: {
      fontFamily: 'Inter-Regular',
      fontSize: 10,
      lineHeight: 13,
      color: ui.slate,
      marginTop: 4,
    },
    detailGuidanceLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: ui.border,
      paddingTop: 14,
      paddingBottom: 4,
    },
    detailGuidanceIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    detailGuidanceCopy: {
      flex: 1,
      minWidth: 0,
    },
    detailGuidanceLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 12,
      lineHeight: 16,
      color: ui.ink,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    detailGuidanceText: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      lineHeight: 17,
      color: ui.slate,
    },
  });
}

function createSummaryStyles(ui: DashboardUI) {
  return StyleSheet.create({
    cryHeroCard: {
      backgroundColor: ui.blackSurface,
      borderWidth: 1,
      borderColor: 'rgba(123,184,255,0.28)',
      borderRadius: 16,
      paddingTop: 15,
      paddingHorizontal: 16,
      paddingBottom: 12,
      marginBottom: 18,
      overflow: 'hidden',
      elevation: 5,
      shadowColor: ui.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
    },
    cryHeroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    cryHeroEyebrow: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 14,
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: 0,
    },
    cryHeroMainRow: {
      position: 'relative',
      minHeight: 104,
      justifyContent: 'center',
      marginBottom: 0,
    },
    cryHeroLeftPane: {
      width: '58%',
      minWidth: 0,
      paddingRight: 2,
      zIndex: 2,
    },
    cryConnectionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 24,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(123,184,255,0.36)',
      backgroundColor: 'rgba(123,184,255,0.12)',
      flexShrink: 0,
    },
    cryConnectionDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#34D399',
      marginRight: 7,
    },
    cryConnectionDotOffline: {
      backgroundColor: ui.alert,
    },
    cryConnectionDotStale: {
      backgroundColor: ui.muted,
    },
    cryConnectionText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: ui.onBlack,
    },
    crySignalIllustration: {
      position: 'absolute',
      right: -18,
      top: -10,
      width: 126,
      height: 126,
      zIndex: 1,
    },
    cryStateValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 31,
      lineHeight: 37,
      color: ui.onBlack,
    },
    cryInterpretation: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: 'rgba(255,255,255,0.88)',
      marginTop: 2,
    },
    cryWaveform: {
      width: '100%',
      height: 22,
      marginTop: 13,
      overflow: 'hidden',
    },
    cryHeroDivider: {
      height: 1,
      backgroundColor: 'rgba(123,184,255,0.26)',
      marginTop: 0,
      marginBottom: 10,
    },
    cryModelMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 11,
      gap: 12,
    },
    cryModelInfo: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cryModelInfoCopy: {
      flex: 1,
      minWidth: 0,
    },
    cryModelInfoLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: 'rgba(255,255,255,0.8)',
      marginBottom: 2,
    },
    cryModelInfoValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 12,
      lineHeight: 16,
      color: ui.onBlack,
    },
    cryModelMetaDivider: {
      width: 1,
      height: 30,
      backgroundColor: 'rgba(123,184,255,0.26)',
      flexShrink: 0,
    },
    cryProbabilityRow: {
      flexDirection: 'row',
      gap: 7,
    },
    cryProbabilityCell: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.24)',
      backgroundColor: 'rgba(255,255,255,0.075)',
      paddingHorizontal: 9,
      paddingTop: 8,
      paddingBottom: 8,
    },
    cryProbabilityCellActive: {
      borderColor: 'rgba(123,184,255,0.44)',
      backgroundColor: 'rgba(123,184,255,0.13)',
    },
    cryProbabilityLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: 5,
    },
    cryProbabilityValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 17,
      lineHeight: 21,
      color: ui.onBlack,
    },
    cryProbabilityTrack: {
      height: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      overflow: 'hidden',
      marginTop: 7,
    },
    cryProbabilityFill: {
      height: 4,
      borderRadius: 999,
    },
  });
}

function createSensorCardStyles(ui: DashboardUI) {
  return StyleSheet.create({
    sensorCard: {
      backgroundColor: ui.white,
      borderWidth: 1,
      borderColor: ui.border,
      borderRadius: 22,
      minHeight: 132,
      padding: 13,
      justifyContent: 'space-between',
      elevation: 3,
      shadowColor: ui.shadow,
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 9 },
    },
    sensorCardWide: {
      minHeight: 88,
      padding: 12,
      justifyContent: 'center',
    },
    sensorCardBody: {
      gap: 4,
    },
    sensorCardMiddleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      minHeight: 44,
    },
    sensorWideContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sensorWideCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    sensorIconBox: {
      width: 39,
      height: 39,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ui.softSurface,
      flexShrink: 0,
    },
    sensorStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      flexShrink: 0,
    },
    sensorLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 12,
      lineHeight: 15,
      color: ui.slate,
      textTransform: 'uppercase',
      letterSpacing: 0,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    sensorValue: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      fontFamily: 'Inter-SemiBold',
      fontSize: 22,
      lineHeight: 28,
      color: ui.ink,
    },
    sensorUnit: {
      fontFamily: 'Inter-Medium',
      fontSize: 14,
      color: ui.slate,
    },
    sensorStatusPill: {
      alignSelf: 'flex-start',
      minHeight: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      backgroundColor: ui.softSurface,
      paddingLeft: 9,
      paddingRight: 11,
      marginTop: 5,
    },
    sensorStatusPillText: {
      fontFamily: 'Inter-Medium',
      fontSize: 11,
      lineHeight: 15,
      color: ui.ink,
    },
  });
}

function createNotificationStyles(ui: DashboardUI) {
  return StyleSheet.create({
    bellButton: {
      width: 38,
      height: 38,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ui.white,
      borderWidth: 1,
      borderColor: ui.border,
      shadowColor: ui.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    notificationDot: {
      position: 'absolute',
      top: 8,
      right: 5,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: ui.alert,
    },
    notificationPanel: {
      position: 'absolute',
      right: 16,
      width: 292,
      maxWidth: '90%',
      backgroundColor: ui.white,
      borderWidth: 1,
      borderColor: ui.border,
      borderRadius: 16,
      padding: 14,
      shadowColor: ui.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    notificationOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 80,
      elevation: 80,
    },
    notificationBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: ui.border,
    },
    notificationHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    notificationTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      lineHeight: 19,
      color: ui.ink,
    },
    notificationSubtitle: {
      marginTop: 2,
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: ui.slate,
    },
    notificationCloseButton: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ui.softSurface,
    },
    notificationEmptyState: {
      paddingTop: 14,
      paddingBottom: 4,
    },
    notificationEmptyTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: ui.ink,
    },
    notificationEmptyText: {
      marginTop: 3,
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      lineHeight: 16,
      color: ui.slate,
    },
    notificationList: {
      maxHeight: 240,
      marginTop: 10,
    },
    notificationListContent: {
      gap: 8,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderWidth: 1,
      borderColor: ui.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingLeft: 11,
      paddingRight: 8,
      backgroundColor: ui.softSurface,
    },
    notificationCopy: {
      flex: 1,
      minWidth: 0,
    },
    notificationMessage: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      lineHeight: 16,
      color: ui.ink,
    },
    notificationTime: {
      marginTop: 3,
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 14,
      color: ui.slate,
    },
    notificationDismiss: {
      width: 24,
      height: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
  });
}

function createMetricCardStyles(ui: DashboardUI) {
  return StyleSheet.create({
    metricCard: {
      height: METRIC_CARD_HEIGHT,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: ui.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 7,
    },
    metricCardGradient: {
      height: METRIC_CARD_HEIGHT,
      borderRadius: 24,
      padding: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    metricColorWash: {
      position: 'absolute',
      right: -46,
      top: -42,
      width: 128,
      height: 128,
      borderRadius: 64,
      opacity: 0.95,
    },
    metricHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 18,
    },
    metricTitleCluster: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    metricIconShell: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      flexShrink: 0,
    },
    metricTitleCopy: {
      flex: 1,
      minWidth: 0,
    },
    metricTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      lineHeight: 19,
      color: ui.onBlack,
      marginBottom: 2,
    },
    metricSubtitle: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      color: 'rgba(255,255,255,0.76)',
    },
    metricStatusBadge: {
      maxWidth: 86,
      minHeight: 24,
      borderRadius: 999,
      paddingHorizontal: 9,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    metricStatusText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 9,
      lineHeight: 12,
      color: ui.white,
      textTransform: 'uppercase',
    },
    metricHeroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 13,
    },
    metricPrimaryBlock: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      justifyContent: 'center',
    },
    metricPrimaryValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 34,
      lineHeight: 40,
      color: ui.onBlack,
    },
    metricPrimaryUnit: {
      fontFamily: 'Inter-Medium',
      fontSize: 14,
      color: 'rgba(255,255,255,0.78)',
    },
    metricCaption: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      color: 'rgba(255,255,255,0.72)',
      textTransform: 'uppercase',
    },
    metricTrendPill: {
      minWidth: 88,
      minHeight: 46,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    metricTrendCopy: {
      flex: 1,
      minWidth: 0,
    },
    metricTrendLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
    },
    metricTrendValue: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 14,
      color: 'rgba(255,255,255,0.9)',
    },
    metricSparkFrame: {
      height: 86,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.09)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginBottom: 12,
    },
    metricStatsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    metricStatCell: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.095)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      paddingHorizontal: 9,
      paddingVertical: 8,
      justifyContent: 'space-between',
    },
    metricStatLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: 'rgba(255,255,255,0.72)',
      textTransform: 'uppercase',
    },
    metricStatValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: ui.onBlack,
    },
    metricStateBadge: {
      minWidth: 86,
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
    },
    metricStateBadgeText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 12,
      lineHeight: 15,
    },
    metricStateBadgeLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 9,
      lineHeight: 12,
      color: 'rgba(255,255,255,0.76)',
      textTransform: 'uppercase',
      marginTop: 1,
    },
  });
}
