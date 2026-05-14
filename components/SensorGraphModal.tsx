import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SensorGraph, {
  type GraphPoint,
  type GraphStateLabels,
  type GraphVariant,
} from './SensorGraph';
import { useAppTheme } from '../theme/ThemeProvider';

type Props = {
  visible: boolean;
  label: string;
  unit?: string;
  caption?: string;
  points: GraphPoint[];
  color: string;
  variant: GraphVariant;
  stateLabels?: GraphStateLabels;
  onClose: () => void;
};

export default function SensorGraphModal(props: Props) {
  const { visible, points, color, unit, variant, stateLabels, onClose } = props;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.975)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const overlayPadding = width < 400 ? 10 : 18;
  const topPadding = Math.max(insets.top + 8, 20);
  const bottomPadding = Math.max(insets.bottom + 8, 20);
  const modalWidth = Math.min(width - overlayPadding * 2, 620);
  const maxModalHeight = Math.max(320, height - topPadding - bottomPadding);
  const targetChartHeight = Math.round(
    Math.min(modalWidth * (variant === 'boolean' ? 0.5 : 0.62), maxModalHeight - 28)
  );
  const chartHeight = Math.max(
    variant === 'boolean' ? 176 : 210,
    targetChartHeight
  );
  const styles = createStyles(modalWidth);

  useEffect(() => {
    if (!visible) return;

    opacity.setValue(0);
    scale.setValue(0.975);
    translateY.setValue(12);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 5,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, translateY, visible]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.975,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 12,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(onClose);
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.overlayRoot,
          {
            paddingHorizontal: overlayPadding,
            paddingTop: topPadding,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose}>
            <BlurView
              intensity={36}
              tint={palette.blurTint}
              style={StyleSheet.absoluteFillObject}
            />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: palette.overlay },
              ]}
            />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity,
              transform: [{ scale }, { translateY }],
            },
          ]}
        >
          <SensorGraph
            points={points}
            color={color}
            unit={unit}
            variant={variant}
            stateLabels={stateLabels}
            contentWidth={modalWidth}
            chartHeight={chartHeight}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(modalWidth: number) {
  return StyleSheet.create({
    overlayRoot: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: modalWidth,
      backgroundColor: 'transparent',
    },
  });
}
