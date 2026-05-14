import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, type AppPalette } from '../../theme/ThemeProvider';

type Profile = {
  id: string;
  name: string;
};

type ProfileModal = 'edit' | 'health' | 'emergency' | 'about' | null;

const INITIAL_PROFILES: Profile[] = [
  { id: '1', name: 'User' },
  { id: '2', name: 'Guest' },
];

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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const styles = createStyles(palette, theme.isDark);

  const [profiles, setProfiles] = useState(INITIAL_PROFILES);
  const [activeProfile, setActiveProfile] = useState(INITIAL_PROFILES[0]);
  const [modal, setModal] = useState<ProfileModal>(null);
  const [tempName, setTempName] = useState(INITIAL_PROFILES[0].name);

  function saveName() {
    const nextName = tempName.trim() || activeProfile.name;

    setProfiles(prev =>
      prev.map(profile =>
        profile.id === activeProfile.id ? { ...profile, name: nextName } : profile
      )
    );
    setActiveProfile(prev => ({ ...prev, name: nextName }));
    setTempName(nextName);
    setModal(null);
  }

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          <View style={styles.headerIcon}>
            <Ionicons name="person-circle-outline" size={21} color={palette.textPrimary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Account</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Profiles, care contacts, and support
            </Text>
          </View>
          <View style={styles.activeProfilePill}>
            <Text style={styles.activeProfilePillText} numberOfLines={1}>
              {activeProfile.name}
            </Text>
          </View>
        </View>

        <View style={styles.heroShell}>
          <LinearGradient
            colors={
              theme.isDark
                ? [palette.surfaceSecondary, palette.surface, theme.gradient[0]]
                : [palette.surface, theme.gradient[1], theme.gradient[0]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />

            <View style={styles.heroTopRow}>
              <View style={styles.identityRow}>
                <View style={styles.avatarShell}>
                  <LinearGradient
                    colors={
                      theme.isDark
                        ? [withOpacity(palette.accent, 0.36), palette.surfaceSecondary]
                        : [withOpacity(palette.accent, 0.16), palette.surfaceSecondary]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {activeProfile.name.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                </View>

                <View style={styles.identityCopy}>
                  <View style={styles.profilePill}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={13}
                      color={palette.accent}
                    />
                    <Text style={styles.profilePillText}>Primary</Text>
                  </View>
                  <Text style={styles.heroName}>{activeProfile.name}</Text>
                  <Text style={styles.heroMeta}>Monitoring access ready.</Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.heroAction,
                  pressed && styles.pressedSurface,
                ]}
                onPress={() => {
                  setTempName(activeProfile.name);
                  setModal('edit');
                }}
              >
                <Ionicons name="create-outline" size={17} color={palette.icon} />
              </Pressable>
            </View>

            <View style={styles.heroInfoStack}>
              <HeroInfoCard
                icon="call-outline"
                label="Emergency line"
                value="+251 47 111 22 33"
                detail="Jimma University Medical Center"
                tone={palette.destructive}
                wide
              />

              <View style={styles.heroInfoRow}>
                <HeroInfoCard
                  icon="business-outline"
                  label="Support center"
                  value="Jimma Medical"
                  detail="Assigned contact"
                  tone={palette.accent}
                />
                <HeroInfoCard
                  icon="pulse-outline"
                  label="Status guide"
                  value="3 alert levels"
                  detail="Red, yellow, green"
                  tone={palette.sensorColors.temperature}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="people-outline" size={19} color={palette.textPrimary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>Identity</Text>
              <Text style={styles.sectionTitle}>Profiles</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profileSwitcherRow}
          >
            {profiles.map((profile, index) => {
              const selected = profile.id === activeProfile.id;

              return (
                <Pressable
                  key={profile.id}
                  onPress={() => {
                    setActiveProfile(profile);
                    setTempName(profile.name);
                  }}
                  style={({ pressed }) => [
                    styles.profileCard,
                    selected && styles.profileCardSelected,
                    index === profiles.length - 1 && styles.profileCardLast,
                    pressed && styles.pressedSurface,
                  ]}
                >
                  <View
                    style={[
                      styles.profileBadge,
                      selected && styles.profileBadgeSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.profileBadgeText,
                        selected && styles.profileBadgeTextSelected,
                      ]}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.profileCardCopy}>
                    <Text style={styles.profileCardTitle}>{profile.name}</Text>
                  </View>

                  <View
                    style={[
                      styles.profileSelectionIndicator,
                      selected
                        ? styles.profileSelectionIndicatorSelected
                        : styles.profileSelectionIndicatorUnselected,
                    ]}
                  >
                    {selected ? <View style={styles.profileSelectionDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="grid-outline" size={18} color={palette.textPrimary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>Care</Text>
              <Text style={styles.sectionTitle}>Quick tools</Text>
            </View>
          </View>

          <View style={styles.actionGrid}>
            <ProfileActionCard
              icon="person-outline"
              title="Edit name"
              description="Update the active profile."
              accentColor={palette.accent}
              onPress={() => {
                setTempName(activeProfile.name);
                setModal('edit');
              }}
            />
            <ProfileActionCard
              icon="heart-outline"
              title="Health info"
              description="Status meaning."
              accentColor={palette.sensorColors.temperature}
              onPress={() => setModal('health')}
            />
            <ProfileActionCard
              icon="call-outline"
              title="Emergency"
              description="Contact details."
              accentColor={palette.destructive}
              onPress={() => setModal('emergency')}
            />
            <ProfileActionCard
              icon="information-circle-outline"
              title="About"
              description="Project details."
              accentColor={palette.sensorColors.sound}
              onPress={() => setModal('about')}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={modal === 'edit'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModal(null)}
      >
        <ModalFrame onClose={() => setModal(null)}>
          <View style={styles.modalIconShell}>
            <Ionicons name="create-outline" size={20} color={palette.accent} />
          </View>
          <Text style={styles.modalTitle}>Edit name</Text>
          <Text style={styles.modalDescription}>Update the active profile label.</Text>

          <TextInput
            value={tempName}
            onChangeText={setTempName}
            style={styles.input}
            placeholder="Profile name"
            placeholderTextColor={palette.textSecondary}
          />

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => {
                setTempName(activeProfile.name);
                setModal(null);
              }}
            >
              <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
            </Pressable>

            <Pressable style={styles.modalButtonPrimary} onPress={saveName}>
              <Text style={styles.modalButtonPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </ModalFrame>
      </Modal>

      <Modal
        visible={modal === 'health'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModal(null)}
      >
        <InfoModal
          icon="heart-outline"
          title="Health status indicators"
          text={
            'Red: Parameter is in a critical condition\n\n' +
            'Yellow: Parameter is moderately critical\n\n' +
            'Green: Parameter is within normal range'
          }
          onClose={() => setModal(null)}
        />
      </Modal>

      <Modal
        visible={modal === 'emergency'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModal(null)}
      >
        <InfoModal
          icon="call-outline"
          title="Emergency contact"
          text={'Jimma University Medical Center\nPhone: +251 47 111 22 33'}
          onClose={() => setModal(null)}
        />
      </Modal>

      <Modal
        visible={modal === 'about'}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModal(null)}
      >
        <InfoModal
          icon="information-circle-outline"
          title="About this app"
          text={
            'Designed by Jimma University 5th year Biomedical Engineering students\n\n' +
            'Capstone Design I Project'
          }
          onClose={() => setModal(null)}
        />
      </Modal>
    </>
  );
}

function HeroInfoCard({
  icon,
  label,
  value,
  detail,
  tone,
  wide = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  detail: string;
  tone: string;
  wide?: boolean;
}) {
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const styles = createStyles(palette, theme.isDark);

  return (
    <View style={[styles.heroInfoCard, wide && styles.heroInfoCardWide]}>
      <View
        style={[
          styles.heroInfoIconShell,
          { backgroundColor: withOpacity(tone, theme.isDark ? 0.2 : 0.12) },
        ]}
      >
        <Ionicons name={icon} size={17} color={theme.isDark ? palette.icon : tone} />
      </View>

      <Text style={styles.heroInfoLabel}>{label}</Text>
      <Text style={styles.heroInfoValue}>{value}</Text>
      <Text style={styles.heroInfoDetail}>{detail}</Text>
    </View>
  );
}

function ProfileActionCard({
  icon,
  title,
  description,
  accentColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  accentColor: string;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const styles = createStyles(palette, theme.isDark);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        pressed && styles.pressedSurface,
      ]}
    >
      <View
        style={[
          styles.actionIconShell,
          { backgroundColor: withOpacity(accentColor, theme.isDark ? 0.18 : 0.14) },
        ]}
      >
        <Ionicons name={icon} size={19} color={accentColor} />
      </View>

      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>

      <View style={styles.actionFooter}>
        <View style={styles.actionArrow}>
          <Ionicons name="arrow-forward" size={15} color={palette.iconMuted} />
        </View>
      </View>
    </Pressable>
  );
}

function ModalFrame({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const styles = createStyles(palette, theme.isDark);

  return (
    <View style={styles.modalBackdrop}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
        <BlurView
          intensity={26}
          tint={palette.blurTint}
          style={StyleSheet.absoluteFillObject}
        />
      </Pressable>

      <View style={styles.modalCard}>{children}</View>
    </View>
  );
}

function InfoModal({
  icon,
  title,
  text,
  onClose,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  onClose: () => void;
}) {
  const { theme } = useAppTheme();
  const palette = theme.palette;
  const styles = createStyles(palette, theme.isDark);

  return (
    <ModalFrame onClose={onClose}>
      <View style={styles.modalIconShell}>
        <Ionicons name={icon} size={20} color={palette.accent} />
      </View>
      <Text style={styles.modalTitle}>{title}</Text>
      <Text style={styles.modalText}>{text}</Text>

      <Pressable style={styles.modalButtonPrimary} onPress={onClose}>
        <Text style={styles.modalButtonPrimaryText}>Close</Text>
      </Pressable>
    </ModalFrame>
  );
}

function createStyles(palette: AppPalette, isDark = false) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
    },
    headerBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 18,
    },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceSecondary,
      flexShrink: 0,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 18,
      lineHeight: 23,
      color: palette.textPrimary,
      marginBottom: 2,
    },
    subtitle: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 15,
      color: palette.textSecondary,
    },
    activeProfilePill: {
      maxWidth: 110,
      minHeight: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.controlActive,
      paddingHorizontal: 11,
      flexShrink: 0,
    },
    activeProfilePillText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 10,
      lineHeight: 13,
      color: palette.controlTextActive,
    },
    heroShell: {
      borderRadius: 24,
      marginBottom: 20,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.2 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    heroCard: {
      borderRadius: 24,
      overflow: 'hidden',
      padding: 16,
      borderWidth: 1,
      borderColor: palette.border,
    },
    heroGlowPrimary: {
      position: 'absolute',
      width: 180,
      height: 180,
      right: -50,
      top: -30,
      borderRadius: 999,
      backgroundColor: withOpacity(palette.accent, isDark ? 0.16 : 0.13),
    },
    heroGlowSecondary: {
      position: 'absolute',
      width: 120,
      height: 120,
      left: -24,
      bottom: -30,
      borderRadius: 999,
      backgroundColor: withOpacity(palette.sensorColors.airQuality, isDark ? 0.1 : 0.16),
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    identityRow: {
      flexDirection: 'row',
      flex: 1,
      paddingRight: 12,
    },
    avatarShell: {
      marginRight: 14,
    },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255,255,255,0.1)'
        : 'rgba(255,255,255,0.9)',
    },
    avatarText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 22,
      color: palette.textPrimary,
    },
    identityCopy: {
      flex: 1,
    },
    profilePill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: withOpacity(palette.accent, isDark ? 0.16 : 0.1),
      marginBottom: 8,
    },
    profilePillText: {
      fontFamily: 'Inter-Medium',
      fontSize: 12,
      color: palette.textPrimary,
    },
    heroName: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 22,
      color: palette.textPrimary,
      marginBottom: 4,
      letterSpacing: -0.4,
    },
    heroMeta: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      lineHeight: 17,
      color: palette.textSecondary,
      maxWidth: '90%',
    },
    heroAction: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    heroInfoStack: {
      gap: 10,
    },
    heroInfoRow: {
      flexDirection: 'row',
      gap: 10,
    },
    heroInfoCard: {
      flex: 1,
      minHeight: 106,
      borderRadius: 18,
      padding: 13,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    heroInfoCardWide: {
      minHeight: 92,
    },
    heroInfoIconShell: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    heroInfoLabel: {
      fontFamily: 'Inter-Medium',
      fontSize: 10,
      lineHeight: 13,
      color: palette.textSecondary,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    heroInfoValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      lineHeight: 18,
      color: palette.textPrimary,
      marginBottom: 3,
    },
    heroInfoDetail: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 16,
      color: palette.textSecondary,
    },
    sectionBlock: {
      marginBottom: 22,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    sectionIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceSecondary,
      flexShrink: 0,
    },
    sectionCopy: {
      flex: 1,
      minWidth: 0,
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
      fontSize: 13,
      lineHeight: 16,
      color: palette.textPrimary,
    },
    profileSwitcherRow: {
      flexDirection: 'row',
      paddingRight: 4,
    },
    profileCard: {
      width: 164,
      marginRight: 12,
      paddingVertical: 12,
      paddingHorizontal: 13,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    profileCardSelected: {
      borderWidth: 2,
      borderColor: palette.controlActive,
      backgroundColor: withOpacity(palette.controlActive, isDark ? 0.12 : 0.05),
    },
    profileCardLast: {
      marginRight: 0,
    },
    profileBadge: {
      width: 40,
      height: 40,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceSecondary,
      marginRight: 12,
    },
    profileBadgeSelected: {
      backgroundColor: withOpacity(palette.accent, isDark ? 0.2 : 0.12),
    },
    profileBadgeText: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 16,
      color: palette.textPrimary,
    },
    profileBadgeTextSelected: {
      color: palette.accent,
    },
    profileCardCopy: {
      flex: 1,
      paddingRight: 8,
    },
    profileCardTitle: {
      fontFamily: 'Inter-Medium',
      fontSize: 14,
      color: palette.textPrimary,
    },
    profileSelectionIndicator: {
      width: 18,
      height: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    profileSelectionIndicatorSelected: {
      backgroundColor: palette.controlActive,
      borderColor: palette.controlActive,
    },
    profileSelectionIndicatorUnselected: {
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.18)'
        : 'rgba(255,255,255,0.82)',
      borderColor: isDark
        ? 'rgba(255,255,255,0.24)'
        : 'rgba(255,255,255,0.94)',
    },
    profileSelectionDot: {
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
    },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    actionCard: {
      width: '48.3%',
      minHeight: 132,
      borderRadius: 22,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 13,
      marginBottom: 12,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.14 : 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    actionIconShell: {
      width: 42,
      height: 42,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    actionTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 14,
      lineHeight: 18,
      color: palette.textPrimary,
      marginBottom: 4,
    },
    actionDescription: {
      fontFamily: 'Inter-Regular',
      fontSize: 11,
      lineHeight: 16,
      color: palette.textSecondary,
    },
    actionFooter: {
      marginTop: 'auto',
      paddingTop: 12,
    },
    actionArrow: {
      width: 30,
      height: 30,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surfaceSecondary,
      borderWidth: 1,
      borderColor: palette.border,
    },
    pressedSurface: {
      opacity: 0.95,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      backgroundColor: withOpacity(
        isDark ? '#02060D' : '#0F172A',
        isDark ? 0.54 : 0.2
      ),
    },
    modalCard: {
      borderRadius: 22,
      backgroundColor: palette.surface,
      padding: 18,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOpacity: isDark ? 0.28 : 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 18,
    },
    modalIconShell: {
      width: 44,
      height: 44,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(239,246,255,0.92)',
      marginBottom: 12,
    },
    modalTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 17,
      lineHeight: 22,
      color: palette.textPrimary,
      marginBottom: 6,
    },
    modalDescription: {
      fontFamily: 'Inter-Regular',
      fontSize: 12,
      lineHeight: 17,
      color: palette.textSecondary,
      marginBottom: 13,
    },
    modalText: {
      fontFamily: 'Inter-Regular',
      fontSize: 13,
      lineHeight: 20,
      color: palette.textPrimary,
      marginBottom: 18,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: palette.textPrimary,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(255,255,255,0.88)',
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    modalButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
    },
    modalButtonSecondary: {
      backgroundColor: palette.surfaceSecondary,
    },
    modalButtonSecondaryText: {
      fontFamily: 'Inter-Medium',
      color: palette.textPrimary,
    },
    modalButtonPrimary: {
      alignSelf: 'flex-start',
      backgroundColor: palette.accent,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    modalButtonPrimaryText: {
      fontFamily: 'Inter-SemiBold',
      color: isDark ? '#08111E' : '#FFFFFF',
    },
  });
}
