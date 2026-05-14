import { useEffect, useState } from 'react';

export type SensorStatus = 'good' | 'warning' | 'danger' | 'unknown';
export type MetricType = 'Average' | 'Min' | 'Max';
export type NumericSensorKey = 'temperature' | 'humidity' | 'airQuality';
export type BooleanSensorKey = 'sound' | 'light';
export type SensorKey = NumericSensorKey | BooleanSensorKey;
export type CryLabel = 'ambient' | 'crying' | 'babbling_or_laughing';
export type DataFreshness = 'live' | 'stale' | 'offline';

export type CryApiPayload = {
  label: CryLabel;
  smoothed_label: CryLabel;
  cry_detected: boolean;
  babbling_or_laughing_detected: boolean;
  top_probability: number;
  probabilities: Record<CryLabel, number>;
  timestamp: string | null;
  model: string;
  model_name: string;
  source: string;
  sound_level_percent: number | null;
};

export type SensorSnapshot = {
  timestamp: string;
  temperatureC: number;
  humidityPct: number;
  soundDetected: boolean;
  soundLevelPercent: number | null;
  soundLevelStatus: string;
  soundLevelSource: string | null;
  soundStatus: SensorStatus;
  soundReadingAvailable: boolean;
  isBright: boolean;
  airQualityRaw: number;
  airQualityStatus: SensorStatus;
  airQualitySource: string | null;
  cry: CryApiPayload | null;
};

export type PiAirQualityPayload = {
  adc_voltage_v?: number | null;
  mq135_voltage_v?: number | null;
  ppm_estimate?: number | null;
  source?: string | null;
  status?: string | null;
};

export type PiCryDetectionPayload = {
  ambient_percent?: number | null;
  bubble_laughter_percent?: number | null;
  confidence_percent?: number | null;
  cry_percent?: number | null;
  final_state?: string | null;
  model_name?: string | null;
  source?: string | null;
  sound_level_percent?: number | null;
  timestamp?: string | number | null;
};

export type PiDevicePayload = {
  datetime?: string | null;
  name?: string | null;
  status?: string | null;
  timestamp?: number | null;
};

export type PiEnvironmentPayload = {
  humidity_percent?: number | null;
  humidity_status?: string | null;
  source?: string | null;
  temperature_c?: number | null;
  temperature_status?: string | null;
};

export type PiLightPayload = {
  raw_state?: number | null;
  source?: string | null;
  state?: string | null;
};

export type PiSoundLevelPayload = {
  method?: string | null;
  sound_level_percent?: number | null;
  source?: string | null;
  status?: string | null;
};

export type PiSensorErrors = Record<string, string | null>;

export type PiApiPayload = {
  air_quality?: PiAirQualityPayload | null;
  cry_detection?: PiCryDetectionPayload | null;
  device?: PiDevicePayload | null;
  environment?: PiEnvironmentPayload | null;
  errors?: PiSensorErrors | null;
  light?: PiLightPayload | null;
  sound_level?: PiSoundLevelPayload | null;
};

type NumericSensorRecord = {
  timestamp: number;
  value: number;
};

type BooleanSensorRecord = {
  timestamp: number;
  value: boolean;
};

type SensorHistory = {
  temperature: NumericSensorRecord[];
  humidity: NumericSensorRecord[];
  airQuality: NumericSensorRecord[];
  sound: BooleanSensorRecord[];
  soundLevel: NumericSensorRecord[];
  light: BooleanSensorRecord[];
};

type LiveSensorState = {
  snapshot: SensorSnapshot;
  history: SensorHistory;
  piConnected: boolean;
  piError: string | null;
  lastUpdated: string | null;
  lastSuccessfulFetchAt: number | null;
  rawPiData: PiApiPayload | null;
  telemetry: SensorTelemetry;
  sensorErrors: PiSensorErrors | null;
};

export type BooleanSummary = {
  currentState: string;
  lastState: string;
  activeCount: number;
  inactiveCount: number;
};

type SensorTelemetry = {
  mq135Voltage: number;
  airQualityPpm: number;
  soundLevelPercent: number | null;
  soundLevelStatus: string;
  soundLevelSource: string | null;
  cryFinalState: string;
  cryConfidencePercent: number;
  ambientPercent: number;
  cryPercent: number;
  bubbleLaughterPercent: number;
};

const HISTORY_WINDOW_HOURS = 48;
const HISTORY_WINDOW_MS = HISTORY_WINDOW_HOURS * 60 * 60 * 1000;

const PI_FETCH_TIMEOUT_MS = 5000;
const LIVE_FRESHNESS_MS = 5000;
const LIVE_SAMPLE_INTERVAL_MS = 3000;

const STALE_FRESHNESS_MS = 30000;
const PI_API_URL = 'http://192.168.43.218:5000/api/latest';
const DEFAULT_CRY_MODEL_NAME = 'CryNet Small';
const DEFAULT_CRY_SOURCE = 'USB microphone';

const TEMPERATURE_LIMITS = {
  goodMin: 24,
  goodMax: 30,
  warningMin: 22,
  warningMax: 32,
} as const;

const HUMIDITY_LIMITS = {
  goodMin: 40,
  goodMax: 60,
  warningMin: 35,
  warningMax: 70,
} as const;

// Placeholder thresholds for MQ-135 ppm estimates coming through the Pi backend.
// Replace these with calibrated ranges once the Raspberry Pi backend provides
// real readings for your environment.
export const AIR_QUALITY_THRESHOLDS = {
  goodMax: 350,
  warningMax: 550,
} as const;

export function normalizeSensorStatus(value: string | null | undefined): SensorStatus {
  const normalized = normalizePiStatus(value).replace(/[_-]+/g, ' ');

  switch (normalized) {
    case 'good':
    case 'normal':
    case 'ok':
    case 'safe':
    case 'quiet':
      return 'good';
    case 'warning':
    case 'caution':
    case 'moderate':
    case 'loud':
    case 'cold':
    case 'hot':
    case 'dry':
    case 'humid':
    case 'elevated':
      return 'warning';
    case 'danger':
    case 'critical':
    case 'unsafe':
    case 'very loud':
      return 'danger';
    case 'unknown':
    case 'unavailable':
    case 'offline':
    case 'missing':
    case '':
      return 'unknown';
    default:
      return 'unknown';
  }
}

export function getTemperatureStatus(value: number): SensorStatus {
  if (!isValidTemperature(value)) return 'unknown';

  if (value >= TEMPERATURE_LIMITS.goodMin && value <= TEMPERATURE_LIMITS.goodMax) {
    return 'good';
  }

  if (value >= TEMPERATURE_LIMITS.warningMin && value <= TEMPERATURE_LIMITS.warningMax) {
    return 'warning';
  }

  return 'danger';
}

export function getHumidityStatus(value: number): SensorStatus {
  if (!isValidHumidity(value)) return 'unknown';

  if (value >= HUMIDITY_LIMITS.goodMin && value <= HUMIDITY_LIMITS.goodMax) {
    return 'good';
  }

  if (value >= HUMIDITY_LIMITS.warningMin && value <= HUMIDITY_LIMITS.warningMax) {
    return 'warning';
  }

  return 'danger';
}

export function getAirQualityStatus(
  value: number | null | undefined,
  rawStatus?: string | null
): SensorStatus {
  if (rawStatus?.trim()) {
    const normalizedStatus = normalizeSensorStatus(rawStatus);
    if (normalizedStatus === 'unknown' || !isValidAirQualityPpm(value)) {
      return 'unknown';
    }

    return normalizedStatus;
  }

  if (!isValidAirQualityPpm(value)) return 'unknown';
  if (value <= AIR_QUALITY_THRESHOLDS.goodMax) return 'good';
  if (value <= AIR_QUALITY_THRESHOLDS.warningMax) return 'warning';
  return 'danger';
}

export function formatSoundState(soundDetected: boolean) {
  return soundDetected ? 'Detected' : 'No Sound';
}

export function formatLightState(isBright: boolean) {
  return isBright ? 'Bright' : 'Dark';
}

function getLightStatus(isBright: boolean): SensorStatus {
  return isBright ? 'good' : 'warning';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function keepPreviousIfInvalid<T>(
  nextValue: T | null | undefined,
  previousValue: T,
  isValid: (value: T | null | undefined) => boolean
): T {
  return isValid(nextValue) ? nextValue as T : previousValue;
}

function getSafeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isValidTemperature(value: number | null | undefined): value is number {
  return isValidNumber(value) && value > 0 && value <= 60;
}

function isValidHumidity(value: number | null | undefined): value is number {
  return isValidNumber(value) && value > 0 && value <= 100;
}

function isValidAirQualityPpm(value: number | null | undefined): value is number {
  return isValidNumber(value) && value > 0;
}

function isValidMq135Voltage(value: number | null | undefined): value is number {
  return isValidNumber(value) && value > 0;
}

function isValidPercent(value: number | null | undefined): value is number {
  return isValidNumber(value) && value >= 0 && value <= 100;
}

function normalizePercentRatio(value: number | null | undefined) {
  return clamp(getSafeNumber(value) / 100, 0, 1);
}

function normalizePiStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

type SoundLevelStatusText = 'quiet' | 'moderate' | 'loud' | 'very loud' | 'unknown';

type NormalizedSoundLevel = {
  percent: number | null;
  statusText: SoundLevelStatusText;
  status: SensorStatus;
  soundDetected: boolean;
  source: string | null;
};

type NormalizedAirQuality = {
  rawPpm: number;
  status: SensorStatus;
  source: string | null;
  mq135Voltage: number;
};

function normalizeSoundStatusText(
  value: string | null | undefined
): SoundLevelStatusText {
  const normalized = normalizePiStatus(value).replace(/[_-]+/g, ' ');

  switch (normalized) {
    case 'quiet':
    case 'moderate':
    case 'loud':
    case 'very loud':
      return normalized;
    default:
      return 'unknown';
  }
}

function classifySoundStatusFromPercent(percent: number | null): SoundLevelStatusText {
  if (percent === null) return 'unknown';
  if (percent >= 80) return 'very loud';
  if (percent >= 45) return 'loud';
  if (percent >= 5) return 'moderate';
  return 'quiet';
}

function getSoundSeverity(
  percent: number | null,
  statusText: SoundLevelStatusText
): SensorStatus {
  switch (statusText) {
    case 'quiet':
      return 'good';
    case 'moderate':
    case 'loud':
      return 'warning';
    case 'very loud':
      return 'danger';
    case 'unknown':
      if (percent === null) return 'unknown';
      if (percent >= 80) return 'danger';
      if (percent >= 5) return 'warning';
      return 'good';
  }
}

export function formatSoundStatusLabel(value: string | null | undefined) {
  const status = normalizeSoundStatusText(value);

  switch (status) {
    case 'quiet':
      return 'Quiet';
    case 'moderate':
      return 'Moderate';
    case 'loud':
      return 'Loud';
    case 'very loud':
      return 'Very Loud';
    case 'unknown':
      return 'Unavailable';
  }
}

export function formatSoundLevelPercent(value: number | null | undefined) {
  if (!isValidPercent(value)) return '--';
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

export function normalizeSoundLevel(
  raw: PiSoundLevelPayload | null | undefined
): NormalizedSoundLevel {
  const rawPercent = raw?.sound_level_percent;
  const percent = isValidPercent(rawPercent) ? rawPercent : null;
  const rawStatus = normalizeSoundStatusText(raw?.status);
  const statusText =
    rawStatus === 'unknown' ? classifySoundStatusFromPercent(percent) : rawStatus;
  const activeStatus =
    statusText === 'moderate' || statusText === 'loud' || statusText === 'very loud';
  const soundDetected = (percent !== null && percent >= 5) || activeStatus;

  return {
    percent,
    statusText,
    status: getSoundSeverity(percent, statusText),
    soundDetected,
    source: raw?.source?.trim() || null,
  };
}

export function normalizeAirQuality(
  raw: PiAirQualityPayload | null | undefined
): NormalizedAirQuality {
  const rawPpmValue = raw?.ppm_estimate;
  const mq135Voltage = raw?.mq135_voltage_v;
  const rawPpm = isValidAirQualityPpm(rawPpmValue)
    ? rawPpmValue
    : Number.NaN;
  const status = getAirQualityStatus(rawPpm, raw?.status);

  return {
    rawPpm,
    status,
    source: raw?.source?.trim() || null,
    mq135Voltage: isValidMq135Voltage(mq135Voltage)
      ? mq135Voltage
      : Number.NaN,
  };
}

function mapPiCryLabel(value: string | null | undefined): CryLabel | null {
  const normalized = normalizePiStatus(value).replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'cry':
    case 'crying':
    case 'bad':
      return 'crying';
    case 'good':
    case 'bubble_laughter':
    case 'babbling_or_laughing':
      return 'babbling_or_laughing';
    case 'ambient':
      return 'ambient';
    default:
      return null;
  }
}

function getDominantCryLabel(
  raw: PiCryDetectionPayload | null | undefined
): CryLabel | null {
  const candidates: Array<{
    label: CryLabel;
    value: number | null | undefined;
  }> = [
    { label: 'ambient', value: raw?.ambient_percent },
    { label: 'crying', value: raw?.cry_percent },
    {
      label: 'babbling_or_laughing',
      value: raw?.bubble_laughter_percent,
    },
  ];
  const validCandidates = candidates.filter(
    (candidate): candidate is { label: CryLabel; value: number } =>
      isValidPercent(candidate.value)
  );

  if (validCandidates.length === 0) return null;

  const sorted = [...validCandidates].sort(
    (left, right) => right.value - left.value
  );
  const [highest, secondHighest] = sorted;

  if (!highest || highest.value === secondHighest?.value) {
    return null;
  }

  return highest.label;
}

function hasValidCryPayload(raw: PiCryDetectionPayload | null | undefined) {
  return Boolean(
    raw &&
      (mapPiCryLabel(raw.final_state) ||
        isValidPercent(raw.ambient_percent) ||
        isValidPercent(raw.cry_percent) ||
        isValidPercent(raw.bubble_laughter_percent) ||
        isValidPercent(raw.confidence_percent))
  );
}

function createOfflineCryPayload(): CryApiPayload {
  return {
    label: 'ambient',
    smoothed_label: 'ambient',
    cry_detected: false,
    babbling_or_laughing_detected: false,
    top_probability: 0,
    probabilities: {
      ambient: 0,
      crying: 0,
      babbling_or_laughing: 0,
    },
    timestamp: null,
    model: DEFAULT_CRY_MODEL_NAME,
    model_name: DEFAULT_CRY_MODEL_NAME,
    source: DEFAULT_CRY_SOURCE,
    sound_level_percent: null,
  };
}

function parsePiTimestampMs(value: string | number | null | undefined) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (!value?.trim()) return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolvePayloadTimestampMs(
  rawTimestamp: string | number | null | undefined,
  fallbackTimestampMs: number
) {
  return parsePiTimestampMs(rawTimestamp) ?? fallbackTimestampMs;
}

export function normalizeCryPayload(
  raw: PiCryDetectionPayload | null | undefined,
  fallbackTimestampMs: number
): CryApiPayload | null {
  if (!hasValidCryPayload(raw)) return null;

  const finalStateLabel = mapPiCryLabel(raw?.final_state);
  const mappedLabel = finalStateLabel ?? getDominantCryLabel(raw) ?? 'ambient';
  const timestampMs = resolvePayloadTimestampMs(raw?.timestamp, fallbackTimestampMs);
  const modelName = raw?.model_name?.trim() || DEFAULT_CRY_MODEL_NAME;
  const soundLevelPercent = raw?.sound_level_percent;
  const probabilities = {
    ambient: normalizePercentRatio(raw?.ambient_percent),
    crying: normalizePercentRatio(raw?.cry_percent),
    babbling_or_laughing: normalizePercentRatio(raw?.bubble_laughter_percent),
  };

  return {
    label: mappedLabel,
    smoothed_label: mappedLabel,
    cry_detected: mappedLabel === 'crying',
    babbling_or_laughing_detected: mappedLabel === 'babbling_or_laughing',
    top_probability: isValidPercent(raw?.confidence_percent)
      ? normalizePercentRatio(raw?.confidence_percent)
      : probabilities[mappedLabel],
    probabilities,
    timestamp: new Date(timestampMs).toISOString(),
    model: modelName,
    model_name: modelName,
    source: raw?.source?.trim() || DEFAULT_CRY_SOURCE,
    sound_level_percent: isValidPercent(soundLevelPercent)
      ? soundLevelPercent
      : null,
  };
}

function hasLightState(raw: PiLightPayload | null | undefined) {
  return typeof raw?.state === 'string' && raw.state.trim().length > 0;
}

export function mapPiPayloadToSnapshot(
  raw: PiApiPayload,
  now: number,
  previousSnapshot: SensorSnapshot
): SensorSnapshot {
  const airQuality = normalizeAirQuality(raw.air_quality);
  const soundLevel = normalizeSoundLevel(raw.sound_level);
  const cryTimestampMs =
    parsePiTimestampMs(raw.device?.timestamp) ??
    parsePiTimestampMs(raw.device?.datetime) ??
    now;
  const temperatureC = keepPreviousIfInvalid(
    raw.environment?.temperature_c,
    previousSnapshot.temperatureC,
    isValidTemperature
  );
  const humidityPct = keepPreviousIfInvalid(
    raw.environment?.humidity_percent,
    previousSnapshot.humidityPct,
    isValidHumidity
  );
  const isBright = hasLightState(raw.light)
    ? normalizePiStatus(raw.light?.state) === 'bright'
    : previousSnapshot.isBright;
  const cry =
    normalizeCryPayload(raw.cry_detection, cryTimestampMs) ??
    createOfflineCryPayload();

  return {
    timestamp: new Date(now).toISOString(),
    temperatureC,
    humidityPct,
    soundDetected: soundLevel.soundDetected,
    soundLevelPercent: soundLevel.percent,
    soundLevelStatus: soundLevel.statusText,
    soundLevelSource: soundLevel.source,
    soundStatus: soundLevel.status,
    soundReadingAvailable: soundLevel.status !== 'unknown',
    isBright,
    airQualityRaw: airQuality.rawPpm,
    airQualityStatus: airQuality.status,
    airQualitySource: airQuality.source,
    cry,
  };
}

function createInitialSnapshot(timestamp: number): SensorSnapshot {
  return {
    timestamp: new Date(timestamp).toISOString(),
    temperatureC: 0,
    humidityPct: 0,
    soundDetected: false,
    soundLevelPercent: null,
    soundLevelStatus: 'unknown',
    soundLevelSource: null,
    soundStatus: 'unknown',
    soundReadingAvailable: false,
    isBright: false,
    airQualityRaw: Number.NaN,
    airQualityStatus: 'unknown',
    airQualitySource: null,
    cry: createOfflineCryPayload(),
  };
}

function computeMetric(data: NumericSensorRecord[], metric: MetricType) {
  if (data.length === 0) return Number.NaN;

  const values = data.map(record => record.value);

  switch (metric) {
    case 'Average':
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case 'Min':
      return Math.min(...values);
    case 'Max':
      return Math.max(...values);
  }
}

function trimHistory<T extends { timestamp: number }>(
  history: T[],
  nextRecord: T | null,
  cutoff: number
) {
  const trimmed = history.filter(record => record.timestamp >= cutoff);
  return nextRecord ? [...trimmed, nextRecord] : trimmed;
}

function filterHistoryWindow<T extends { timestamp: number }>(
  history: T[],
  hours: number
) {
  const now = Date.now();
  const from = now - hours * 60 * 60 * 1000;
  return history.filter(record => record.timestamp >= from);
}

function createInitialTelemetry(): SensorTelemetry {
  return {
    mq135Voltage: Number.NaN,
    airQualityPpm: Number.NaN,
    soundLevelPercent: null,
    soundLevelStatus: 'unknown',
    soundLevelSource: null,
    cryFinalState: 'unknown',
    cryConfidencePercent: 0,
    ambientPercent: 0,
    cryPercent: 0,
    bubbleLaughterPercent: 0,
  };
}

function normalizeCryFinalState(raw: PiCryDetectionPayload | null | undefined) {
  return mapPiCryLabel(raw?.final_state) ?? getDominantCryLabel(raw) ?? 'unknown';
}

function mapPiPayloadToTelemetry(
  raw: PiApiPayload,
  previousTelemetry: SensorTelemetry
): SensorTelemetry {
  const airQuality = normalizeAirQuality(raw.air_quality);
  const soundLevel = normalizeSoundLevel(raw.sound_level);

  return {
    mq135Voltage: airQuality.mq135Voltage,
    airQualityPpm: airQuality.rawPpm,
    soundLevelPercent: soundLevel.percent,
    soundLevelStatus: soundLevel.statusText,
    soundLevelSource: soundLevel.source,
    cryFinalState: hasValidCryPayload(raw.cry_detection)
      ? normalizeCryFinalState(raw.cry_detection)
      : previousTelemetry.cryFinalState,
    cryConfidencePercent: keepPreviousIfInvalid(
      raw.cry_detection?.confidence_percent,
      previousTelemetry.cryConfidencePercent,
      isValidPercent
    ),
    ambientPercent: keepPreviousIfInvalid(
      raw.cry_detection?.ambient_percent,
      previousTelemetry.ambientPercent,
      isValidPercent
    ),
    cryPercent: keepPreviousIfInvalid(
      raw.cry_detection?.cry_percent,
      previousTelemetry.cryPercent,
      isValidPercent
    ),
    bubbleLaughterPercent: keepPreviousIfInvalid(
      raw.cry_detection?.bubble_laughter_percent,
      previousTelemetry.bubbleLaughterPercent,
      isValidPercent
    ),
  };
}

function getDataFreshness(
  lastSuccessfulFetchAt: number | null,
  now = Date.now()
): DataFreshness {
  if (!lastSuccessfulFetchAt) return 'offline';

  const age = now - lastSuccessfulFetchAt;

  if (age <= LIVE_FRESHNESS_MS) return 'live';
  if (age <= STALE_FRESHNESS_MS) return 'stale';
  return 'offline';
}

function createInitialState(now: number): LiveSensorState {
  const snapshot = createInitialSnapshot(now);

  return {
    snapshot,
    history: {
      temperature: [{ timestamp: now, value: snapshot.temperatureC }],
      humidity: [{ timestamp: now, value: snapshot.humidityPct }],
      airQuality: [],
      sound: [],
      soundLevel: [],
      light: [{ timestamp: now, value: snapshot.isBright }],
    },
    piConnected: false,
    piError: null,
    lastUpdated: null,
    lastSuccessfulFetchAt: null,
    rawPiData: null,
    telemetry: createInitialTelemetry(),
    sensorErrors: null,
  };
}

function appendSnapshotToHistory(
  history: SensorHistory,
  snapshot: SensorSnapshot,
  timestamp: number
): SensorHistory {
  const cutoff = timestamp - HISTORY_WINDOW_MS;

  return {
    temperature: trimHistory(
      history.temperature,
      { timestamp, value: snapshot.temperatureC },
      cutoff
    ),
    humidity: trimHistory(
      history.humidity,
      { timestamp, value: snapshot.humidityPct },
      cutoff
    ),
    airQuality: trimHistory(
      history.airQuality,
      isValidAirQualityPpm(snapshot.airQualityRaw)
        ? { timestamp, value: snapshot.airQualityRaw }
        : null,
      cutoff
    ),
    sound: trimHistory(
      history.sound,
      snapshot.soundReadingAvailable
        ? { timestamp, value: snapshot.soundDetected }
        : null,
      cutoff
    ),
    soundLevel: trimHistory(
      history.soundLevel,
      isValidPercent(snapshot.soundLevelPercent)
        ? { timestamp, value: snapshot.soundLevelPercent }
        : null,
      cutoff
    ),
    light: trimHistory(
      history.light,
      { timestamp, value: snapshot.isBright },
      cutoff
    ),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'Pi API request timed out';
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'Unable to connect to Raspberry Pi API';
}

function getPrecision(sensor: NumericSensorKey) {
  return sensor === 'airQuality' ? 0 : 1;
}

function formatMetricValue(sensor: NumericSensorKey, value: number) {
  const precision = getPrecision(sensor);
  return precision === 0 ? Math.round(value) : Number(value.toFixed(precision));
}

export default function useSensorData() {
  const [sensorState, setSensorState] = useState<LiveSensorState>(() =>
    createInitialState(Date.now())
  );

  useEffect(() => {
    let isMounted = true;
    let requestInFlight = false;
    let activeRequestId = 0;

    function releaseRequest(requestId: number) {
      if (activeRequestId === requestId) {
        requestInFlight = false;
      }
    }

    function markPiRequestFailed(error: unknown) {
      if (!isMounted) return;

      setSensorState(previous => ({
        ...previous,
        piConnected: false,
        piError: getErrorMessage(error),
      }));
    }

    async function fetchPiData() {
      if (requestInFlight) return;

      requestInFlight = true;
      const requestId = activeRequestId + 1;
      activeRequestId = requestId;
      const controller = new AbortController();
      const timeoutError = Object.assign(
        new Error('Pi API request timed out'),
        { name: 'AbortError' }
      );
      let didTimeout = false;
      const timeout = setTimeout(() => {
        if (activeRequestId !== requestId) return;

        didTimeout = true;
        controller.abort();
        markPiRequestFailed(timeoutError);
        releaseRequest(requestId);

        if (isMounted) {
          void fetchPiData();
        }
      }, PI_FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(PI_API_URL, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Pi API responded with HTTP ${response.status}`);
        }

        const raw = (await response.json()) as PiApiPayload;
        const now = Date.now();

        if (!isMounted || didTimeout || activeRequestId !== requestId) return;

        setSensorState(previous => {
          const snapshot = mapPiPayloadToSnapshot(raw, now, previous.snapshot);

          return {
            snapshot,
            history: appendSnapshotToHistory(previous.history, snapshot, now),
            piConnected: true,
            piError: null,
            lastUpdated: snapshot.timestamp,
            lastSuccessfulFetchAt: now,
            rawPiData: raw,
            telemetry: mapPiPayloadToTelemetry(raw, previous.telemetry),
            sensorErrors: raw.errors ?? null,
          };
        });
      } catch (error) {
        if (!isMounted || didTimeout || activeRequestId !== requestId) return;

        markPiRequestFailed(error);
      } finally {
        clearTimeout(timeout);
        releaseRequest(requestId);
      }
    }

    void fetchPiData();

    const interval = setInterval(() => {
      void fetchPiData();
    }, LIVE_SAMPLE_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  function getMetric(sensor: NumericSensorKey, hours: number, metric: MetricType) {
    const filtered = getNumericHistory(sensor, hours);

    return formatMetricValue(sensor, computeMetric(filtered, metric));
  }

  function getSoundLevelMetric(hours: number, metric: MetricType) {
    const value = computeMetric(getSoundLevelHistory(hours), metric);
    return Number.isFinite(value) ? Number(value.toFixed(1)) : Number.NaN;
  }

  function getNumericHistory(
    sensor: NumericSensorKey,
    hours: number
  ): NumericSensorRecord[] {
    return filterHistoryWindow(
      sensorState.history[sensor] as NumericSensorRecord[],
      hours
    );
  }

  function getHistory(
    sensor: SensorKey,
    hours: number
  ): Array<NumericSensorRecord | BooleanSensorRecord> {
    return filterHistoryWindow(
      sensorState.history[sensor] as Array<NumericSensorRecord | BooleanSensorRecord>,
      hours
    );
  }

  function getBooleanHistory(
    sensor: BooleanSensorKey,
    hours: number
  ): BooleanSensorRecord[] {
    return filterHistoryWindow(
      sensorState.history[sensor] as BooleanSensorRecord[],
      hours
    );
  }

  function getSoundLevelHistory(hours: number): NumericSensorRecord[] {
    return filterHistoryWindow(sensorState.history.soundLevel, hours);
  }

  function getGraphData(sensor: SensorKey, hours: number) {
    return getHistory(sensor, hours).map(record =>
      typeof record.value === 'boolean' ? (record.value ? 1 : 0) : record.value
    );
  }

  function getBooleanSummary(sensor: BooleanSensorKey, hours: number): BooleanSummary {
    const filtered = getBooleanHistory(sensor, hours);
    const currentRecord = filtered[filtered.length - 1] ?? sensorState.history[sensor][0];
    const currentValue = currentRecord?.value ?? false;
    const formatter = sensor === 'sound' ? formatSoundState : formatLightState;

    let lastDistinctValue = currentValue;

    for (let index = filtered.length - 2; index >= 0; index -= 1) {
      if (filtered[index].value !== currentValue) {
        lastDistinctValue = filtered[index].value;
        break;
      }
    }

    const activeCount = filtered.filter(record => record.value).length;

    return {
      currentState: formatter(currentValue),
      lastState: formatter(lastDistinctValue),
      activeCount,
      inactiveCount: filtered.length - activeCount,
    };
  }

  const snapshot = sensorState.snapshot;
  const rawPiData = sensorState.rawPiData;
  const telemetry = sensorState.telemetry;

  return {
    snapshot,
    history: sensorState.history,
    temperatureC: snapshot.temperatureC,
    humidityPct: snapshot.humidityPct,
    soundDetected: snapshot.soundDetected,
    soundLevelPercent: snapshot.soundLevelPercent,
    soundLevelStatus: snapshot.soundLevelStatus,
    soundLevelSource: snapshot.soundLevelSource,
    soundStatusLabel: formatSoundStatusLabel(snapshot.soundLevelStatus),
    isBright: snapshot.isBright,
    airQualityRaw: snapshot.airQualityRaw,
    airQualitySource: snapshot.airQualitySource,
    temperatureStatus: getTemperatureStatus(snapshot.temperatureC),
    humidityStatus: getHumidityStatus(snapshot.humidityPct),
    soundStatus: snapshot.soundStatus,
    lightStatus: getLightStatus(snapshot.isBright),
    airQualityStatus: snapshot.airQualityStatus,
    cry: snapshot.cry,
    piConnected: sensorState.piConnected,
    piError: sensorState.piError,
    lastUpdated: sensorState.lastUpdated,
    lastSuccessfulFetchAt: sensorState.lastSuccessfulFetchAt,
    dataFreshness: getDataFreshness(sensorState.lastSuccessfulFetchAt),
    rawPiData,
    sensorErrors: sensorState.sensorErrors,
    mq135Voltage: telemetry.mq135Voltage,
    airQualityPpm: Number.isFinite(telemetry.airQualityPpm)
      ? telemetry.airQualityPpm
      : snapshot.airQualityRaw,
    cryFinalState: telemetry.cryFinalState,
    cryConfidencePercent: telemetry.cryConfidencePercent,
    ambientPercent: telemetry.ambientPercent,
    cryPercent: telemetry.cryPercent,
    bubbleLaughterPercent: telemetry.bubbleLaughterPercent,
    getMetric,
    getHistory,
    getNumericHistory,
    getBooleanHistory,
    getSoundLevelHistory,
    getSoundLevelMetric,
    getGraphData,
    getBooleanSummary,
  };
}
