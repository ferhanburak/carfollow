import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, ScreenShell, Surface } from '@/components/screen-shell';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, profile } = useAuth();

  const signOut = async () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenShell title="Profil">
      <Surface accent>
        <Eyebrow>SÜRÜCÜ KİMLİĞİ</Eyebrow>
        <Text style={styles.name}>{profile?.fullName || 'CRUISER Sürücüsü'}</Text>
        <Text style={styles.plate}>{profile?.plate || 'PLAKA YOK'}</Text>
        <View style={styles.vehicleCard}>
          <Ionicons color={colors.lime} name="car-sport" size={28} />
          <View style={styles.vehicleCopy}>
            <Text style={styles.model}>{profile?.model || 'Araç bilgisi yok'}</Text>
            <Text style={styles.setup}>
              {profile?.tuningStage || 'Stock'} · {profile?.horsepower || 0} HP
            </Text>
          </View>
        </View>
      </Surface>

      <View style={styles.metrics}>
        <ProfileMetric label="Odometre" value={`${formatNumber(profile?.odometer)} KM`} />
        <ProfileMetric label="Aylık KM" value={formatNumber(profile?.monthlyKm)} />
        <ProfileMetric label="Sürücü Skoru" value={`${profile?.driverScore || 0}/100`} />
        <ProfileMetric label="Bölge" value={profile?.region || 'Belirtilmedi'} />
      </View>

      <Pressable
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
      >
        <Ionicons color="#fda4af" name="log-out-outline" size={20} />
        <Text style={styles.logoutText}>Oturumu Kapat</Text>
      </Pressable>
    </ScreenShell>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <Surface>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </Surface>
  );
}

function formatNumber(value?: number) {
  return Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

const styles = StyleSheet.create({
  name: {
    marginTop: 10,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 27,
    letterSpacing: -0.7,
  },
  plate: {
    marginTop: 4,
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 2.2,
  },
  vehicleCard: {
    minHeight: 74,
    marginTop: 20,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(5,6,5,0.38)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  vehicleCopy: { flex: 1 },
  model: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  setup: { marginTop: 4, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 7,
    color: colors.limeBright,
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  logout: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.28)',
    backgroundColor: 'rgba(244,63,94,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  logoutText: { color: '#fda4af', fontFamily: fonts.bold, fontSize: 13 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
