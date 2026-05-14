import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ===================== THEMES ===================== */

export type AppPalette = {
  textPrimary: string;
  textSecondary: string;
  surface: string;
  surfaceSecondary: string;
  controlBackground: string;
  controlActive: string;
  controlText: string;
  controlTextActive: string;
  border: string;
  divider: string;
  icon: string;
  iconMuted: string;
  accent: string;
  shadow: string;
  destructive: string;
  overlay: string;
  modalBackdrop: string;
  tabBarBackground: string;
  navigationBar: string;
  navigationBarButtonStyle: 'light' | 'dark';
  blurTint: 'light' | 'dark';
  graphBackground: string;
  graphGrid: string;
  graphLabel: string;
  sensorIcon: string;
  cardArrowBackground: string;
  sensorColors: {
    temperature: string;
    humidity: string;
    light: string;
    sound: string;
    airQuality: string;
  };
};

type ThemeDefinition = {
  key: string;
  name: string;
  description: string;
  gradient: readonly [string, string, string];
  isDark: boolean;
  statusBarStyle: 'light' | 'dark';
  palette: AppPalette;
};

const clinicalWhitePalette: AppPalette = {
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  surface: '#FFFFFF',
  surfaceSecondary: '#EAF2FF',
  controlBackground: '#E7EDF7',
  controlActive: '#0F172A',
  controlText: '#0F172A',
  controlTextActive: '#FFFFFF',
  border: '#D7DFEA',
  divider: '#DDE6F2',
  icon: '#0F172A',
  iconMuted: '#64748B',
  accent: '#2563EB',
  shadow: '#0F172A',
  destructive: '#D92D4B',
  overlay: 'rgba(246,249,255,0.7)',
  modalBackdrop: 'rgba(0,0,0,0.3)',
  tabBarBackground: '#FFFFFF',
  navigationBar: '#FFFFFF',
  navigationBarButtonStyle: 'dark',
  blurTint: 'light',
  graphBackground: '#FFFFFF',
  graphGrid: '#DDE6F2',
  graphLabel: '#475569',
  sensorIcon: '#0F172A',
  cardArrowBackground: '#EAF2FF',
  sensorColors: {
    temperature: '#FF6B4A',
    humidity: '#24C8DB',
    light: '#F6B84B',
    sound: '#9C8CFF',
    airQuality: '#4DD985',
  },
};

const aquaCarePalette: AppPalette = {
  textPrimary: '#0F2A2E',
  textSecondary: '#3F6469',
  surface: '#FFFFFF',
  surfaceSecondary: '#E5F7F4',
  controlBackground: '#DFF3F1',
  controlActive: '#0F766E',
  controlText: '#0F2A2E',
  controlTextActive: '#FFFFFF',
  border: '#C8E5E1',
  divider: '#D8EFEC',
  icon: '#0F2A2E',
  iconMuted: '#5F7F83',
  accent: '#0F9F8F',
  shadow: '#052F35',
  destructive: '#D92D4B',
  overlay: 'rgba(236,252,249,0.72)',
  modalBackdrop: 'rgba(4,30,35,0.32)',
  tabBarBackground: '#FFFFFF',
  navigationBar: '#FFFFFF',
  navigationBarButtonStyle: 'dark',
  blurTint: 'light',
  graphBackground: '#FFFFFF',
  graphGrid: '#CBE8E5',
  graphLabel: '#3F6469',
  sensorIcon: '#0F2A2E',
  cardArrowBackground: '#E5F7F4',
  sensorColors: {
    temperature: '#E96F50',
    humidity: '#0EADBF',
    light: '#D99A1E',
    sound: '#6D6AEF',
    airQuality: '#19A66A',
  },
};

const lavenderPulsePalette: AppPalette = {
  textPrimary: '#211A3A',
  textSecondary: '#5B5374',
  surface: '#FFFFFF',
  surfaceSecondary: '#F0ECFF',
  controlBackground: '#E9E4FA',
  controlActive: '#6D5BD0',
  controlText: '#211A3A',
  controlTextActive: '#FFFFFF',
  border: '#DCD5F3',
  divider: '#E5DFF6',
  icon: '#211A3A',
  iconMuted: '#786F91',
  accent: '#7C6AED',
  shadow: '#211A3A',
  destructive: '#D92D4B',
  overlay: 'rgba(247,245,255,0.72)',
  modalBackdrop: 'rgba(21,16,43,0.32)',
  tabBarBackground: '#FFFFFF',
  navigationBar: '#FFFFFF',
  navigationBarButtonStyle: 'dark',
  blurTint: 'light',
  graphBackground: '#FFFFFF',
  graphGrid: '#DED6F4',
  graphLabel: '#5B5374',
  sensorIcon: '#211A3A',
  cardArrowBackground: '#F0ECFF',
  sensorColors: {
    temperature: '#F06E6A',
    humidity: '#28B6D4',
    light: '#E0A633',
    sound: '#7C6AED',
    airQuality: '#35B982',
  },
};

const sunriseCarePalette: AppPalette = {
  textPrimary: '#281E18',
  textSecondary: '#6D5748',
  surface: '#FFFFFF',
  surfaceSecondary: '#FFF0DE',
  controlBackground: '#F7E5D1',
  controlActive: '#B86419',
  controlText: '#281E18',
  controlTextActive: '#FFFFFF',
  border: '#EBD7C2',
  divider: '#F0E0CF',
  icon: '#281E18',
  iconMuted: '#856F5F',
  accent: '#D97706',
  shadow: '#2B190E',
  destructive: '#C9334E',
  overlay: 'rgba(255,248,240,0.74)',
  modalBackdrop: 'rgba(43,25,14,0.32)',
  tabBarBackground: '#FFFFFF',
  navigationBar: '#FFFFFF',
  navigationBarButtonStyle: 'dark',
  blurTint: 'light',
  graphBackground: '#FFFFFF',
  graphGrid: '#EBD7C2',
  graphLabel: '#6D5748',
  sensorIcon: '#281E18',
  cardArrowBackground: '#FFF0DE',
  sensorColors: {
    temperature: '#E85D3F',
    humidity: '#1EA7BE',
    light: '#D98716',
    sound: '#8A68D8',
    airQuality: '#2DA76C',
  },
};

const midnightCarePalette: AppPalette = {
  textPrimary: '#F8FAFC',
  textSecondary: '#C4D0E4',
  surface: '#0E1728',
  surfaceSecondary: '#17263E',
  controlBackground: '#17263E',
  controlActive: '#7BB8FF',
  controlText: '#F8FAFC',
  controlTextActive: '#08111E',
  border: '#354762',
  divider: '#263850',
  icon: '#F8FAFC',
  iconMuted: '#AEBED3',
  accent: '#7BB8FF',
  shadow: '#020617',
  destructive: '#FF6B7A',
  overlay: 'rgba(6,10,18,0.72)',
  modalBackdrop: 'rgba(2,6,13,0.72)',
  tabBarBackground: '#0D172A',
  navigationBar: '#0A1424',
  navigationBarButtonStyle: 'light',
  blurTint: 'dark',
  graphBackground: '#122033',
  graphGrid: '#3A4C68',
  graphLabel: '#B9C7DB',
  sensorIcon: '#F8FAFC',
  cardArrowBackground: '#1F3352',
  sensorColors: {
    temperature: '#FF8A70',
    humidity: '#4DD8F0',
    light: '#FFD166',
    sound: '#B6A6FF',
    airQuality: '#75E0A7',
  },
};

export const THEMES = [
  {
    key: 'clinical',
    name: 'Clinical White',
    description: 'Bright white neonatal dashboard',
    gradient: ['#F6F9FF', '#FFFFFF', '#EEF4FF'],
    isDark: false,
    statusBarStyle: 'dark',
    palette: clinicalWhitePalette,
  },
  {
    key: 'aqua',
    name: 'Aqua Care',
    description: 'Fresh teal with clean clinical contrast',
    gradient: ['#EAFBF7', '#F7FEFC', '#FFFFFF'],
    isDark: false,
    statusBarStyle: 'dark',
    palette: aquaCarePalette,
  },
  {
    key: 'lavender',
    name: 'Lavender Pulse',
    description: 'Soft violet focus with crisp readability',
    gradient: ['#F5F2FF', '#FBFAFF', '#FFFFFF'],
    isDark: false,
    statusBarStyle: 'dark',
    palette: lavenderPulsePalette,
  },
  {
    key: 'sunrise',
    name: 'Sunrise Care',
    description: 'Warm white with calm amber accents',
    gradient: ['#FFF3E4', '#FFF9F3', '#FFFFFF'],
    isDark: false,
    statusBarStyle: 'dark',
    palette: sunriseCarePalette,
  },
  {
    key: 'midnight',
    name: 'Midnight Care',
    description: 'Low-light navy with luminous clinical accents',
    gradient: ['#08111E', '#0E1A2F', '#152540'],
    isDark: true,
    statusBarStyle: 'light',
    palette: midnightCarePalette,
  },
] as const satisfies readonly ThemeDefinition[];

export type ThemeKey = typeof THEMES[number]['key'];
export type AppTheme = (typeof THEMES)[number];

type ThemeContextType = {
  themeKey: ThemeKey;
  theme: AppTheme;
  setThemeKey: (key: ThemeKey) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'APP_THEME_KEY';

export function getThemeByKey(key: ThemeKey) {
  return THEMES.find(theme => theme.key === key) ?? THEMES[0];
}

function isThemeKey(value: string): value is ThemeKey {
  return THEMES.some(theme => theme.key === value);
}

/* ===================== PROVIDER ===================== */

export function AppThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>('clinical');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (value && isThemeKey(value)) {
        setThemeKeyState(value);
      }
    });
  }, []);

  const setThemeKey = (key: ThemeKey) => {
    setThemeKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY, key);
  };

  const theme = getThemeByKey(themeKey);

  return (
    <ThemeContext.Provider value={{ themeKey, theme, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ===================== HOOK ===================== */

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }
  return ctx;
}
