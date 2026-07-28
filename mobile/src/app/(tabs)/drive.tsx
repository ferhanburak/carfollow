import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow, ScreenShell, Surface } from '@/components/screen-shell';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme/colors';

export default function DriveScreen() {
  const { profile } = useAuth();

  return (
    <ScreenShell title="Sürüş Modu" subtitle="Gerçek GPS oturumunun mobil kokpiti.">
      <Surface accent>
        <View style={styles.statusRow}>
          <View>
            <Eyebrow>GPS OTURUMU</Eyebrow>
            <Text style={styles.status}>Sürüşe hazır</Text>
          </View>
          <View style={styles.dot} />
        </View>
        <Text style={styles.speed}>0</Text>
        <Text style={styles.unit}>KM/H</Text>
        <View style={styles.metrics}>
          <Metric label="Mesafe" value="0,0 KM" />
          <Metric label="Süre" value="0 DK" />
          <Metric label="Odometre" value={`${formatNumber(profile?.odometer)} KM`} />
        </View>
      </Surface>
      <Text style={styles.note}>
        GPS mesafesi, hız filtreleme ve güvenli oturum kapatma bir sonraki mobil modülde mevcut backend fonksiyonlarına bağlanacak.
      </Text>
    </ScreenShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function formatNumber(value?: number) {
  return Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    marginTop: 8,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 23,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  speed: {
    marginTop: 38,
    color: colors.lime,
    fontFamily: fonts.extraBold,
    fontSize: 92,
    letterSpacing: -6,
    textAlign: 'center',
  },
  unit: {
    marginTop: -8,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 4,
    textAlign: 'center',
  },
  metrics: {
    marginTop: 38,
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    minHeight: 76,
    paddingHorizontal: 8,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(4,6,4,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 6,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  note: {
    paddingHorizontal: 5,
    color: colors.textFaint,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});
