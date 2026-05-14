import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAppTheme, type AppPalette } from '../theme/ThemeProvider';

export type NotificationItem = {
  id: string;
  message: string;
  timestamp: number;
};

type Props = {
  notifications: NotificationItem[];
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDismiss: (id: string) => void;
};

export default function NotificationBell({
  notifications,
  visible,
  onOpen,
  onClose,
  onDismiss,
}: Props) {
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const styles = createStyles(palette);
  const hasUnread = notifications.length > 0;
  const previousCountRef = useRef(notifications.length);

  useEffect(() => {
    previousCountRef.current = notifications.length;
  }, [notifications]);

  return (
    <>
      <Pressable style={styles.bell} onPress={onOpen}>
        <View style={styles.bellContainer}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={palette.icon}
          />
          {hasUnread && <View style={styles.dot} />}
        </View>
      </Pressable>

      {visible && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            onPressIn={onClose}
          >
            <BlurView
              intensity={20}
              tint={palette.blurTint}
              style={StyleSheet.absoluteFill}
            />
          </Pressable>

          <Pressable style={styles.panel} onPress={() => {}}>
            <Text style={styles.title}>Notifications</Text>

            {notifications.length === 0 ? (
              <Text style={styles.empty}>No alerts yet</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.item}>
                    <Text style={styles.message}>{item.message}</Text>
                    <Pressable onPress={() => onDismiss(item.id)}>
                      <Ionicons name="close" size={14} color={palette.iconMuted} />
                    </Pressable>
                  </View>
                )}
              />
            )}
          </Pressable>
        </View>
      )}
    </>
  );
}

function createStyles(palette: AppPalette) {
  return StyleSheet.create({
    bell: {
      padding: 6,
    },
    bellContainer: {
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    dot: {
      position: 'absolute',
      top: 3,
      right: -1,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.destructive,
    },
    panel: {
      position: 'absolute',
      top: 50,
      right: 14,
      width: 220,
      backgroundColor: palette.surface,
      borderRadius: 16,
      padding: 12,
      elevation: 10,
      shadowColor: palette.shadow,
      shadowOpacity: 0.24,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    title: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      color: palette.textPrimary,
      marginBottom: 8,
    },
    empty: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      color: palette.textSecondary,
    },
    item: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    message: {
      flex: 1,
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      color: palette.textPrimary,
      marginRight: 8,
    },
  });
}
