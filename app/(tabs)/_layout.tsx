import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, Home, Settings, User } from 'lucide-react-native';
import { useAppTheme, type AppPalette } from '../../theme/ThemeProvider';

const TAB_BAR_CONTENT_HEIGHT = 56;

function TabIcon({
  focused,
  Icon,
  palette,
}: {
  focused: boolean;
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  palette: AppPalette;
}) {
  return (
    <View style={styles.iconWrapper}>
      <Icon
        size={21}
        color={focused ? palette.accent : palette.iconMuted}
        strokeWidth={focused ? 2.4 : 2}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.iconMuted,
        tabBarStyle: {
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          paddingHorizontal: 10,
          backgroundColor: palette.tabBarBackground,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.border,
          ...(Platform.OS === 'android'
            ? { elevation: 8 }
            : {
                shadowColor: palette.shadow,
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: -3 },
              }),
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={Home} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={Activity} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={Settings} palette={palette} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={User} palette={palette} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: 40,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
