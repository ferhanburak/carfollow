import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useAppData } from '@/providers/app-data-provider';
import { colors, fonts } from '@/theme/colors';

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
  const { profile } = useAuth();
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
    <LinearGradient
      colors={[colors.background, '#0b0f08', colors.background]}
      style={styles.root}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <Text numberOfLines={1} style={styles.identityName}>
              {profile?.fullName || 'CRUISER'}
            </Text>
            <Text numberOfLines={1} style={styles.identityVehicle}>
              {profile?.model || 'Sürücü ağı'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Mesajlar"
              onPress={() => router.push({ pathname: '/(tabs)/social', params: { section: 'messages' } })}
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
          </View>
        </View>
        <ScrollView
          {...scrollProps}
          contentContainerStyle={[styles.content, scrollProps?.contentContainerStyle]}
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
      </SafeAreaView>
    </LinearGradient>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    minHeight: 62,
    marginHorizontal: 14,
    marginTop: 6,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: 'rgba(15,17,14,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  identityVehicle: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(18,20,17,0.92)',
  },
  surfaceAccent: {
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(26,34,17,0.88)',
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
  sheetTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 21 },
  readAll: { color: colors.lime, fontFamily: fonts.bold, fontSize: 11 },
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
  notificationTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
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
  pressed: { opacity: 0.68, transform: [{ scale: 0.96 }] },
});
