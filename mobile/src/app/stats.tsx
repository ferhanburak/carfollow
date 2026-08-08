import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { LocalizedPressable as Pressable, LocalizedText as Text } from '@/components/localized-text';
import { ScreenShell, Surface } from '@/components/screen-shell';
import { useGarage } from '@/hooks/use-garage';
import { useAuth } from '@/providers/auth-provider';
import { useAppLanguage } from '@/providers/language-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

type SpeedDistribution = {
  under50?: number;
  from50To80?: number;
  from80To110?: number;
  from110To150?: number;
  over150?: number;
};

const SPEED_BUCKETS = [
  { key: 'under50', label: '< 50 km/sa', color: '#22d3ee' },
  { key: 'from50To80', label: '50–80 km/sa', color: '#22c55e' },
  { key: 'from80To110', label: '80–110 km/sa', color: '#facc15' },
  { key: 'from110To150', label: '110–150 km/sa', color: '#f97316' },
  { key: 'over150', label: '150+ km/sa', color: '#f43f5e' },
] as const;

export default function StatsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { driverStats, fuelLogs, serviceLogs } = useGarage();
  const { language } = useAppLanguage();
  const stats = driverStats ?? {};
  const distribution = (stats.monthlySpeedDistributionSeconds ?? {}) as SpeedDistribution;
  const distributionTotal = SPEED_BUCKETS.reduce(
    (sum, bucket) => sum + Math.max(0, Number(distribution[bucket.key]) || 0),
    0,
  );
  const likes = Number(profile?.communityEventLikesReceived ?? 0)
    + Number(profile?.communityPhotoLikesReceived ?? 0);
  const isEnglish = language === 'en';

  const secondaryStats = [
    {
      icon: 'moon-outline' as const,
      label: isEnglish ? 'Night distance' : 'Gece sürüşü',
      value: `${formatNumber(stats.monthlyNightKm, language)} KM`,
    },
    {
      icon: 'speedometer-outline' as const,
      label: isEnglish ? 'Average speed' : 'Ortalama hız',
      value: `${formatNumber(stats.monthlyAverageSpeedKmh, language)} KM/H`,
    },
    {
      icon: 'checkmark-circle-outline' as const,
      label: isEnglish ? 'Verified total' : 'Onaylı toplam',
      value: `${formatNumber(stats.lifetimeVerifiedKm ?? profile?.totalKm, language)} KM`,
    },
    {
      icon: 'car-sport-outline' as const,
      label: isEnglish ? 'Completed drives' : 'Tamamlanan sürüş',
      value: formatNumber(stats.completedSessions, language),
    },
    {
      icon: 'heart-outline' as const,
      label: isEnglish ? 'Likes received' : 'Alınan beğeni',
      value: formatNumber(likes, language),
    },
    {
      icon: 'thumbs-up-outline' as const,
      label: isEnglish ? 'Helpful votes' : 'Faydalı oy',
      value: formatNumber(profile?.communityHelpfulVotesReceived, language),
    },
    {
      icon: 'construct-outline' as const,
      label: isEnglish ? 'Service records' : 'Servis kaydı',
      value: String(serviceLogs.length),
    },
    {
      icon: 'water-outline' as const,
      label: isEnglish ? 'Fuel receipts' : 'Yakıt fişi',
      value: String(fuelLogs.length),
    },
  ];

  return (
    <ScreenShell>
      <View style={styles.navigationRow}>
        <Pressable
          accessibilityLabel={isEnglish ? 'Go back' : 'Geri dön'}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>
        <View style={styles.navigationCopy}>
          <Text style={styles.pageTitle}>{isEnglish ? 'Driving Statistics' : 'Sürüş İstatistikleri'}</Text>
          <Text style={styles.pageSubtitle}>
            {profile?.model || (isEnglish ? 'Your vehicle' : 'Aracın')} · {isEnglish ? 'This month' : 'Bu ay'}
          </Text>
        </View>
      </View>

      <Surface accent>
        <View style={styles.heroGrid}>
          <MetricHero
            label={isEnglish ? 'Monthly distance' : 'Aylık mesafe'}
            value={`${formatNumber(stats.monthlyKm ?? profile?.monthlyKm, language)} KM`}
          />
          <MetricHero
            label={isEnglish ? 'Driving time' : 'Sürüş süresi'}
            value={formatDuration(stats.monthlyDriveSeconds, language)}
          />
        </View>
      </Surface>

      <Surface>
        <Text style={styles.sectionLabel}>{isEnglish ? 'TOP SPEED' : 'MAKSİMUM HIZ'}</Text>
        <View style={styles.topSpeedRow}>
          <Text style={styles.topSpeed}>{formatNumber(stats.monthlyMaxSpeedKmh, language)}</Text>
          <Text style={styles.topSpeedUnit}>KM/H</Text>
        </View>
        <Text style={styles.sectionTitle}>{isEnglish ? 'Speed distribution' : 'Hız dağılımı'}</Text>
        <View style={styles.distributionList}>
          {SPEED_BUCKETS.map((bucket) => {
            const seconds = Math.max(0, Number(distribution[bucket.key]) || 0);
            const percentage = distributionTotal > 0 ? Math.round((seconds / distributionTotal) * 100) : 0;
            return (
              <View key={bucket.key} style={styles.distributionRow}>
                <Text style={styles.distributionLabel}>{bucket.label}</Text>
                <View style={styles.distributionTrack}>
                  <View
                    style={[
                      styles.distributionFill,
                      { backgroundColor: bucket.color, width: `${percentage}%` },
                    ]}
                  />
                </View>
                <Text style={styles.distributionPercent}>%{percentage}</Text>
              </View>
            );
          })}
        </View>
        {!distributionTotal ? (
          <Text style={styles.distributionHint}>
            {isEnglish
              ? 'Distribution will appear after your next GPS-verified drive.'
              : 'Dağılım, bir sonraki GPS doğrulamalı sürüşünden sonra oluşacak.'}
          </Text>
        ) : null}
      </Surface>

      <Surface>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'All statistics' : 'Tüm istatistikler'}</Text>
          <Ionicons name="stats-chart" size={18} color={colors.limeBright} />
        </View>
        <View style={styles.detailGrid}>
          {secondaryStats.map((item) => (
            <View key={item.label} style={styles.detailMetric}>
              <Ionicons name={item.icon} size={17} color={colors.textMuted} />
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={styles.detailValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </Surface>

      <Surface>
        <Text style={styles.sectionLabel}>{isEnglish ? 'ALL TIME' : 'TÜM ZAMANLAR'}</Text>
        <Text style={styles.totalTime}>{formatDuration(stats.lifetimeDriveSeconds, language)}</Text>
        <Text style={styles.totalTimeCaption}>
          {isEnglish ? 'Total verified driving time' : 'Toplam doğrulanmış sürüş süresi'}
        </Text>
      </Surface>
    </ScreenShell>
  );
}

function MetricHero({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>{value}</Text>
    </View>
  );
}

function formatNumber(value: unknown, language: 'tr' | 'en') {
  return Number(value ?? 0).toLocaleString(language === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 1,
  });
}

function formatDuration(value: unknown, language: 'tr' | 'en') {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (language === 'en') return hours ? `${hours} hr ${minutes} min` : `${minutes} min`;
  return hours ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
}

const styles = createThemedStyles(() => ({
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationCopy: { flex: 1 },
  pageTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.5 },
  pageSubtitle: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  heroGrid: { flexDirection: 'row', gap: 9 },
  heroMetric: {
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.backgroundRaised,
    justifyContent: 'space-between',
  },
  heroLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroValue: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 19 },
  sectionLabel: {
    color: colors.textFaint,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 2,
  },
  topSpeedRow: { marginTop: 8, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  topSpeed: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 66, letterSpacing: -3 },
  topSpeedUnit: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 19 },
  sectionTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  distributionList: { marginTop: 16, gap: 14 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  distributionLabel: { width: 88, color: colors.text, fontFamily: fonts.semibold, fontSize: 10 },
  distributionTrack: {
    flex: 1,
    height: 10,
    overflow: 'hidden',
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
  },
  distributionFill: { height: '100%', minWidth: 0, borderRadius: 5 },
  distributionPercent: {
    width: 34,
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    textAlign: 'right',
  },
  distributionHint: {
    marginTop: 16,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
  },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailGrid: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailMetric: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 0,
    minHeight: 82,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
  },
  detailLabel: { marginTop: 8, color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 9 },
  detailValue: { marginTop: 4, color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 14 },
  totalTime: { marginTop: 10, color: colors.text, fontFamily: fonts.extraBold, fontSize: 40, letterSpacing: -1.5 },
  totalTimeCaption: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
