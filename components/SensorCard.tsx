import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SensorStatus } from '../hooks/useSensorData';
import { useAppTheme, type AppPalette } from '../theme/ThemeProvider';

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  color: string;
  status: SensorStatus;
  containerStyle?: StyleProp<ViewStyle>;
  valueTextStyle?: StyleProp<TextStyle>;
  adjustValueToFit?: boolean;
  minimumFontScale?: number;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
};

const STATUS_COLOR: Record<SensorStatus, string> = {
  good: '#0E9F6E',
  warning: '#B7791F',
  danger: '#D92D4B',
  unknown: '#64748B',
};

const CARD_RADIUS = 18;

export default function SensorCard({
  label,
  value,
  unit,
  icon,
  color,
  status,
  containerStyle,
  valueTextStyle,
  adjustValueToFit = true,
  minimumFontScale = 0.78,
  onPress,
  onPressIn,
  onPressOut,
}: Props) {
  const { theme } = useAppTheme();
  const styles = createStyles(theme.palette);
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }

  function pressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressIn();
        onPressIn?.();
      }}
      onPressOut={() => {
        pressOut();
        onPressOut?.();
      }}
      style={[styles.container, containerStyle]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: color,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={styles.label}>{label}</Text>

        <View style={styles.contentRow}>
          <View style={styles.iconWrapper}>{icon}</View>
          <Text
            style={[styles.value, valueTextStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit={adjustValueToFit}
            minimumFontScale={adjustValueToFit ? minimumFontScale : 1}
          >
            {value}
            {unit ? <Text style={styles.unit}> {unit}</Text> : null}
          </Text>
        </View>

        <View
          style={[
            styles.statusDot,
            { backgroundColor: STATUS_COLOR[status] },
          ]}
        />

        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={16} color={theme.palette.icon} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    container: {
      width: '48%',
      marginBottom: 14,
    },
    card: {
      height: 132,
      borderRadius: CARD_RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.border,
      elevation: 3,
      shadowColor: palette.shadow,
      shadowOpacity: 0.09,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    label: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      color: palette.textPrimary,
      marginBottom: 10,
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconWrapper: {
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    value: {
      marginLeft: 10,
      fontFamily: 'Inter-SemiBold',
      fontSize: 24,
      color: palette.textPrimary,
      flexShrink: 1,
    },
    unit: {
      fontFamily: 'Inter-Medium',
      fontSize: 14,
      color: palette.textSecondary,
    },
    statusDot: {
      position: 'absolute',
      left: 18,
      bottom: 14,
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    arrow: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      backgroundColor: palette.cardArrowBackground,
      borderRadius: 14,
      padding: 6,
    },
  });
}
