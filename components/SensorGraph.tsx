import React from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  LineChart,
  type lineDataItem,
} from 'react-native-gifted-charts';

export type GraphPoint = {
  timestamp: number;
  value: number;
};

export type GraphVariant = 'numeric' | 'boolean';

export type GraphStateLabels = {
  low: string;
  high: string;
};

type Props = {
  points: GraphPoint[];
  color: string;
  unit?: string;
  variant: GraphVariant;
  stateLabels?: GraphStateLabels;
  contentWidth?: number;
  chartHeight?: number;
};

type HslColor = {
  h: number;
  s: number;
  l: number;
};

const MAX_VISIBLE_POINTS = 36;
const MIN_CHART_WIDTH = 220;
const MIN_CHART_HEIGHT = 144;
const CHART_SHELL_HORIZONTAL_PADDING = 16;
const DEFAULT_NUMERIC_CHART_HEIGHT = 186;
const DEFAULT_BOOLEAN_CHART_HEIGHT = 156;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(hexColor: string) {
  if (!hexColor.startsWith('#')) return null;

  if (hexColor.length === 4) {
    return `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`;
  }

  return hexColor.length === 7 ? hexColor : null;
}

function hexToRgb(hexColor: string) {
  const normalized = normalizeHex(hexColor);
  if (!normalized) return null;

  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map(channel => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation =
    lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);

  let hue = 0;

  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

function hueToRgb(p: number, q: number, t: number) {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  };
}

function createOutlineColor(hexColor: string) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const saturation = clamp(Math.max(hsl.s + 0.2, 0.58), 0, 0.84);
  const lightness = clamp(Math.min(hsl.l * 0.56, 0.44), 0.26, 0.44);
  const vividRgb = hslToRgb(hsl.h, saturation, lightness);

  return rgbToHex(vividRgb.r, vividRgb.g, vividRgb.b);
}

function withOpacity(hexColor: string, opacity: number) {
  const normalized = normalizeHex(hexColor);
  if (!normalized) return hexColor;

  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');

  return `${normalized}${alpha}`;
}

function downsamplePoints(points: GraphPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;

  const result: GraphPoint[] = [];
  const lastIndex = points.length - 1;

  for (let index = 0; index < maxPoints; index += 1) {
    const sampleIndex = Math.round((index / (maxPoints - 1)) * lastIndex);
    result.push(points[sampleIndex]);
  }

  return result;
}

function formatAxisValue(value: number, unit?: string) {
  if (unit === 'ppm') return `${Math.round(value)}`;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatXAxisLabel(timestamp: number, totalDurationMs: number) {
  const date = new Date(timestamp);

  if (totalDurationMs >= 36 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  if (totalDurationMs >= 6 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function buildXAxisLabels(points: GraphPoint[]) {
  const labels = Array.from({ length: points.length }, () => '');

  if (points.length === 0) return labels;

  const totalDurationMs = Math.max(
    points[points.length - 1].timestamp - points[0].timestamp,
    1
  );
  const markerIndexes = Array.from(
    new Set([
      0,
      Math.floor((points.length - 1) * 0.25),
      Math.floor((points.length - 1) * 0.5),
      Math.floor((points.length - 1) * 0.75),
      points.length - 1,
    ])
  );

  markerIndexes.forEach(index => {
    labels[index] = formatXAxisLabel(points[index].timestamp, totalDurationMs);
  });

  return labels;
}

export default function SensorGraph({
  points,
  color,
  unit,
  variant,
  stateLabels,
  contentWidth,
  chartHeight,
}: Props) {
  const { width } = useWindowDimensions();
  const outlineColor = createOutlineColor(color);
  const styles = createStyles(outlineColor);
  const resolvedChartHeight = Math.max(
    MIN_CHART_HEIGHT,
    Math.round(
      chartHeight ??
        (variant === 'boolean'
          ? DEFAULT_BOOLEAN_CHART_HEIGHT
          : DEFAULT_NUMERIC_CHART_HEIGHT)
    )
  );
  const resolvedContentWidth = Math.max(
    MIN_CHART_WIDTH + CHART_SHELL_HORIZONTAL_PADDING * 2,
    Math.floor(contentWidth ?? width - 56)
  );
  const shellStyle = [
    styles.chartShell,
    { minHeight: resolvedChartHeight + 24 },
  ];

  if (!points.length) {
    return (
      <View style={shellStyle}>
        <View style={[styles.emptyCanvas, { height: resolvedChartHeight }]}>
          <View style={styles.emptyGuide} />
          <View style={styles.emptyGuide} />
          <View style={styles.emptyGuide} />
          <View style={styles.emptyTrace} />
        </View>
      </View>
    );
  }

  const visiblePoints = downsamplePoints(points, MAX_VISIBLE_POINTS);
  const hasFractionalValues = visiblePoints.some(
    point => !Number.isInteger(point.value)
  );
  const isBooleanChart = variant === 'boolean';
  const yAxisLabelWidth = isBooleanChart ? 58 : unit === 'ppm' ? 50 : 44;
  const chartContainerWidth = Math.max(
    MIN_CHART_WIDTH,
    resolvedContentWidth - CHART_SHELL_HORIZONTAL_PADDING * 2
  );
  const plotWidth = Math.max(152, chartContainerWidth - yAxisLabelWidth);
  const chartData: lineDataItem[] = visiblePoints.map((point, index) => ({
    value: point.value,
    hideDataPoint: isBooleanChart ? false : index !== visiblePoints.length - 1,
  }));
  const xAxisLabels = buildXAxisLabels(visiblePoints);

  return (
    <View style={shellStyle}>
      <LineChart
        data={chartData}
        areaChart
        curved={!isBooleanChart}
        stepChart={isBooleanChart}
        disableScroll
        adjustToWidth
        parentWidth={chartContainerWidth}
        width={plotWidth}
        height={resolvedChartHeight}
        noOfSections={isBooleanChart ? 1 : 4}
        maxValue={isBooleanChart ? 1 : undefined}
        initialSpacing={6}
        endSpacing={6}
        color={outlineColor}
        thickness={isBooleanChart ? 2.9 : 2.7}
        dataPointsRadius={isBooleanChart ? 3.5 : 4.2}
        dataPointsColor={outlineColor}
        focusedDataPointColor={outlineColor}
        focusedDataPointRadius={isBooleanChart ? 4.5 : 5}
        startFillColor={withOpacity(outlineColor, 0.14)}
        endFillColor={withOpacity(outlineColor, 0.015)}
        startOpacity={1}
        endOpacity={1}
        showVerticalLines={false}
        showYAxisIndices={false}
        xAxisColor="rgba(148, 163, 184, 0.22)"
        yAxisColor="rgba(148, 163, 184, 0.18)"
        rulesColor="rgba(148, 163, 184, 0.14)"
        rulesThickness={1}
        xAxisLabelTextStyle={styles.xAxisText}
        yAxisTextStyle={styles.yAxisText}
        xAxisLabelTexts={xAxisLabels}
        xAxisLabelsHeight={28}
        xAxisLabelsVerticalShift={4}
        yAxisLabelWidth={yAxisLabelWidth}
        showFractionalValues={!isBooleanChart && hasFractionalValues}
        roundToDigits={!isBooleanChart && hasFractionalValues ? 1 : 0}
        formatYLabel={label => {
          if (isBooleanChart) {
            return Number(label) >= 1
              ? (stateLabels?.high ?? 'On')
              : (stateLabels?.low ?? 'Off');
          }

          return formatAxisValue(Number(label), unit);
        }}
      />
    </View>
  );
}

function createStyles(outlineColor: string) {
  return StyleSheet.create({
    chartShell: {
      width: '100%',
      borderRadius: 30,
      paddingTop: 20,
      paddingBottom: 14,
      paddingHorizontal: CHART_SHELL_HORIZONTAL_PADDING,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: 'rgba(226, 232, 240, 0.84)',
      overflow: 'hidden',
      shadowColor: '#0F172A',
      shadowOpacity: 0.06,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    xAxisText: {
      color: 'rgba(148, 163, 184, 0.95)',
      fontFamily: 'Inter-Regular',
      fontSize: 10.5,
    },
    yAxisText: {
      color: 'rgba(71, 85, 105, 0.82)',
      fontFamily: 'Inter-Medium',
      fontSize: 10.5,
    },
    emptyCanvas: {
      width: '100%',
      justifyContent: 'space-between',
      paddingVertical: 16,
    },
    emptyGuide: {
      height: 1,
      borderRadius: 999,
      backgroundColor: 'rgba(15, 23, 42, 0.06)',
    },
    emptyTrace: {
      position: 'absolute',
      left: '14%',
      right: '16%',
      top: '48%',
      height: 2.5,
      borderRadius: 999,
      backgroundColor: withOpacity(outlineColor, 0.92),
      shadowColor: outlineColor,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
  });
}
