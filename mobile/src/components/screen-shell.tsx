import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren, ReactNode } from 'react';

import { useAuth } from '@/providers/auth-provider';
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
          <View style={styles.connection}>
            <Ionicons name="radio" size={13} color={colors.lime} />
            <Text style={styles.connectionText}>CANLI</Text>
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
  connection: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  connectionText: {
    color: colors.limeBright,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.8,
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
});
