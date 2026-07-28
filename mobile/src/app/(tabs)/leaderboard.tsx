import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow, ScreenShell, Surface } from '@/components/screen-shell';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme/colors';

export default function LeaderboardScreen() {
  const { profile } = useAuth();

  return (
    <ScreenShell title="Aylık Sıralama" subtitle="Gerçek sürüş istatistikleriyle güncellenir.">
      <Surface>
        <View style={styles.segment}>
          <Text style={styles.segmentActive}>KM</Text>
          <Text style={styles.segmentLabel}>Süre</Text>
          <Text style={styles.segmentLabel}>Maksimum Hız</Text>
        </View>
        <View style={styles.selfRow}>
          <View style={styles.rank}><Text style={styles.rankText}>•</Text></View>
          <View style={styles.identity}>
            <Text style={styles.name}>{profile?.fullName || 'Sürücü'}</Text>
            <Text style={styles.model}>{profile?.model || 'Araç bilgisi yok'}</Text>
          </View>
          <Text style={styles.value}>{formatKm(profile?.monthlyKm)} KM</Text>
        </View>
        <View style={styles.empty}>
          <Eyebrow>CANLI VERİ</Eyebrow>
          <Text style={styles.emptyText}>
            Tam sıralama aboneliği mobil repository katmanına bağlandığında diğer sürücüler burada listelenecek.
          </Text>
        </View>
      </Surface>
    </ScreenShell>
  );
}

function formatKm(value?: number) {
  return Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

const styles = StyleSheet.create({
  segment: {
    padding: 4,
    borderRadius: 18,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentActive: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.lime,
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 12,
    textAlignVertical: 'center',
  },
  segmentLabel: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  selfRow: {
    marginTop: 14,
    minHeight: 68,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  rank: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 18 },
  identity: { flex: 1 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  model: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  value: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 13 },
  empty: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});
