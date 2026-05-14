import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { LinearGradient } from 'expo-linear-gradient';

import {
  AppThemeProvider,
  useAppTheme,
  THEMES,
} from '../theme/ThemeProvider';

import { SoundSettingsProvider } from '../context/SoundSettings';

/* ===================== INTERNAL LAYOUT ===================== */

function RootLayoutInner() {
  const { themeKey } = useAppTheme();

  const activeTheme =
    THEMES.find(t => t.key === themeKey) ?? THEMES[0];

  const BaseTheme = activeTheme.isDark ? DarkTheme : DefaultTheme;

  const TransparentTheme = {
    ...BaseTheme,
    colors: {
      ...BaseTheme.colors,
      background: 'transparent',
    },
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('relative');
      NavigationBar.setBackgroundColorAsync(activeTheme.palette.navigationBar);
      NavigationBar.setButtonStyleAsync(activeTheme.palette.navigationBarButtonStyle);
    }
  }, [activeTheme.palette.navigationBar, activeTheme.palette.navigationBarButtonStyle]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LinearGradient
          colors={activeTheme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        >
          <ThemeProvider value={TransparentTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="modal"
                options={{ presentation: 'modal' }}
              />
            </Stack>
            <StatusBar style={activeTheme.statusBarStyle} />
          </ThemeProvider>
        </LinearGradient>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

/* ===================== ROOT ===================== */

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SoundSettingsProvider>
      <AppThemeProvider>
        <RootLayoutInner />
      </AppThemeProvider>
    </SoundSettingsProvider>
  );
}
