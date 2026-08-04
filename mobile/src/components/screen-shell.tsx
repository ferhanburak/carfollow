import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PropsWithChildren, ReactNode } from 'react';

import { LocalizedPressable as Pressable, LocalizedText as Text } from '@/components/localized-text';
import { useAuth } from '@/providers/auth-provider';
import { useAppData } from '@/providers/app-data-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

type ScreenShellProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  scrollProps?: ScrollViewProps;
}>;

export function ScreenShell({
  children,
  title,
  subtitle,
  action,
  scrollProps,
}: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useAppTheme();

  return (
    <LinearGradient
      colors={resolvedTheme === 'dark'
        ? [colors.background, '#0b0f08', colors.background]
        : [colors.background, colors.backgroundRaised, colors.background]}
      style={styles.root}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <AppHeader />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            {...scrollProps}
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 120 + insets.bottom },
              scrollProps?.contentContainerStyle,
            ]}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? 'handled'}
            showsVerticalScrollIndicator={false}
          >
            {title ? (
              <View style={styles.titleRow}>
                <View style={styles.titleCopy}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                {action}
              </View>
            ) : null}
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

export function AppHeader() {
  const { profile } = useAuth();
  const { resolvedTheme } = useAppTheme();
  const pathname = usePathname();
  const router = useRouter();
  const {
    markAllNotificationsRead,
    markNotificationRead,
    notifications,
    unreadConversationCount,
    unreadNotificationCount,
  } = useAppData();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <>
      <LinearGradient
        colors={resolvedTheme === 'dark'
          ? ['rgba(58,18,26,0.88)', 'rgba(15,17,14,0.96)', 'rgba(30,48,16,0.90)']
          : ['#f9ecef', '#ffffff', '#edf6df']}
        end={{ x: 1, y: 0.5 }}
        start={{ x: 0, y: 0.5 }}
        style={styles.header}
      >
        <Pressable
          accessibilityLabel="Profil"
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={styles.identityName}>
            {profile?.fullName || 'TrackSnap'}
          </Text>
          <Text numberOfLines={1} style={styles.identityVehicle}>
            {profile?.model || 'Sürücü ağı'}
          </Text>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Mesajlar"
            onPress={() => router.push({
              pathname: '/(tabs)/social',
              params: { section: 'messages' },
            })}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.text} />
            {unreadConversationCount ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{Math.min(99, unreadConversationCount)}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityLabel="Bildirimler"
            onPress={() => setNotificationsOpen(true)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {unreadNotificationCount ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{Math.min(99, unreadNotificationCount)}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityLabel="Sürüş modu"
            onPress={() => router.push('/(tabs)/drive')}
            style={({ pressed }) => [
              styles.headerButton,
              styles.driveButton,
              pathname.endsWith('/drive') && styles.driveButtonCurrent,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="car-sport" size={20} color={colors.black} />
          </Pressable>

          <Pressable
            accessibilityLabel="Ayarlar"
            onPress={() => router.push({
              pathname: '/(tabs)/profile',
              params: { section: 'settings', request: String(Date.now()) },
            })}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </LinearGradient>

      <Modal
        animationType="slide"
        onRequestClose={() => setNotificationsOpen(false)}
        transparent
        visible={notificationsOpen}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setNotificationsOpen(false)}>
          <Pressable style={styles.notificationSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Bildirimler</Text>
              {unreadNotificationCount ? (
                <Pressable onPress={() => void markAllNotificationsRead()}>
                  <Text style={styles.readAll}>Tümünü okundu işaretle</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.length ? notifications.map((notification) => (
                <Pressable
                  key={notification.id}
                  onPress={() => {
                    if (!notification.readAt) void markNotificationRead(notification.id);
                  }}
                  style={[styles.notification, !notification.readAt && styles.notificationUnread]}
                >
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationBody}>{notification.body}</Text>
                </Pressable>
              )) : (
                <Text style={styles.emptyText}>Yeni bildiriminiz yok.</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function Surface({
  children,
  accent = false,
}: PropsWithChildren<{ accent?: boolean }>) {
  return (
    <View style={[styles.surface, accent && styles.surfaceAccent]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

const styles = createThemedStyles(() => ({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: { flex: 1 },
  header: {
    height: 64,
    marginHorizontal: 14,
    marginTop: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.backgroundRaised,
    justifyContent: 'center',
  },
  identityName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  identityVehicle: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerButton: {
    width: 44,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveButton: {
    borderColor: colors.lime,
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 7,
  },
  driveButtonCurrent: {
    shadowOpacity: 0.72,
    shadowRadius: 16,
  },
  badge: {
    position: 'absolute',
    right: -3,
    top: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 9,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 120,
    gap: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 25,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 5,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  surface: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  surfaceAccent: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
  },
  eyebrow: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2.4,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  notificationSheet: {
    maxHeight: '72%',
    padding: 18,
    paddingBottom: 30,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    marginBottom: 18,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
    alignSelf: 'center',
  },
  sheetHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 21,
  },
  readAll: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  notification: {
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    backgroundColor: colors.surface,
  },
  notificationUnread: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
  },
  notificationTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  notificationBody: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
  },
  emptyText: {
    paddingVertical: 34,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.96 }],
  },
}));
