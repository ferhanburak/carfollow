import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { LocalizedPressable as Pressable, LocalizedText as Text } from '@/components/localized-text';
import { ScreenShell, Surface } from '@/components/screen-shell';
import { useAllTimeLeaderboard } from '@/hooks/use-all-time-leaderboard';
import { getAllTimeHonors } from '@/lib/leaderboard';
import { useDriverProfile } from '@/providers/driver-profile-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { DriverSummary } from '@/types/cruiser';

export default function PublicProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { social } = useDriverProfile();
  const { entries } = useAllTimeLeaderboard();
  const [profile, setProfile] = useState<DriverSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadPublicProfile = useEffectEvent((targetUserId: string) =>
    social.getPublicProfile(targetUserId));

  useEffect(() => {
    let active = true;
    if (!userId) return () => { active = false; };

    void loadPublicProfile(userId)
      .then((driver) => {
        if (!active) return;
        setProfile(driver);
        if (!driver) setError('Bu sürücünün profiline erişilemiyor.');
      })
      .catch(() => {
        if (active) setError('Bu sürücünün profiline erişilemiyor.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [userId]);

  const harmonyVotes = Number(profile?.harmonyVotes ?? 0);
  const alertVotes = Number(profile?.alertVotes ?? 0);
  const harmonyRatio = harmonyVotes + alertVotes
    ? Math.round((harmonyVotes / (harmonyVotes + alertVotes)) * 100)
    : 100;
  const likesReceived = Number(profile?.communityEventLikesReceived ?? 0)
    + Number(profile?.communityPhotoLikesReceived ?? 0);
  const honors = useMemo(() => getAllTimeHonors(entries, profile?.userId), [entries, profile?.userId]);

  return (
    <ScreenShell>
      <View style={styles.navigationRow}>
        <Pressable
          accessibilityLabel="Geri dön"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>
        <View style={styles.navigationCopy}>
          <Text style={styles.pageTitle}>Sürücü Profili</Text>
          <Text style={styles.pageSubtitle}>TrackSnap topluluk profili</Text>
        </View>
      </View>

      {!userId ? (
        <View style={styles.stateCard}>
          <Ionicons name="person-circle-outline" size={48} color={colors.textFaint} />
          <Text style={styles.stateText}>Sürücü profili bulunamadı.</Text>
        </View>
      ) : loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.lime} size="large" />
          <Text style={styles.stateText}>Profil yükleniyor...</Text>
        </View>
      ) : profile ? (
        <>
          <Surface accent>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                {profile.avatar ? (
                  <Image contentFit="cover" source={{ uri: profile.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {(profile.fullName || profile.model || 'T').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.heroCopy}>
                <Text numberOfLines={1} style={styles.name}>{profile.fullName || 'TrackSnap Sürücüsü'}</Text>
                <Text numberOfLines={1} style={styles.model}>{profile.model || 'Araç bilgisi yok'}</Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {[profile.plate || profile.plateMasked, profile.region].filter(Boolean).join(' · ') || 'Profil bilgileri'}
                </Text>
              </View>
            </View>

            <View style={styles.identityPills}>
              {profile.clan ? <Pill icon="shield-outline" label={profile.clan} /> : null}
              <Pill icon="people-outline" label={relationLabel(profile.relation)} />
            </View>
          </Surface>

          <Surface>
            <Text style={styles.sectionTitle}>Sürücü Özeti</Text>
            <View style={styles.metrics}>
              <Metric label="Sürücü Skoru" value={`${Number(profile.driverScore ?? profile.score ?? 0)}/100`} />
              <Metric label="Aylık KM" value={`${formatNumber(profile.monthlyKm)} KM`} />
              <Metric label="Uyum" value={`%${harmonyRatio}`} />
              <Metric label="Topluluk Katkısı" value={formatNumber(profile.communityKudos)} />
            </View>
          </Surface>

          <Surface>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Topluluk İtibarı</Text>
              <Text style={styles.scoreLabel}>{reputationLabel(Number(profile.driverScore ?? 0), harmonyRatio)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, harmonyRatio))}%` }]} />
            </View>
            <View style={styles.communityMetrics}>
              <Metric label="Alınan Beğeni" value={formatNumber(likesReceived)} compact />
              <Metric label="Faydalı Yanıt" value={formatNumber(profile.communityHelpfulVotesReceived)} compact />
            </View>
          </Surface>

          {honors.length ? (
            <Surface>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Tüm Zamanlar Unvanları</Text>
                <Ionicons name="trophy" size={18} color="#facc15" />
              </View>
              <View style={styles.honors}>
                {honors.map((honor) => (
                  <View key={honor.metric} style={[styles.honor, honorStyle(honor.rank)]}>
                    <Text style={[styles.honorRank, { color: honorColor(honor.rank) }]}>#{honor.rank}</Text>
                    <Text style={styles.honorTitle}>{honor.shortTitle}</Text>
                  </View>
                ))}
              </View>
            </Surface>
          ) : null}
        </>
      ) : (
        <View style={styles.stateCard}>
          <Ionicons name="person-circle-outline" size={48} color={colors.textFaint} />
          <Text style={styles.stateText}>{error || 'Sürücü profili bulunamadı.'}</Text>
        </View>
      )}
    </ScreenShell>
  );
}

function Metric({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return (
    <View style={[styles.metric, compact && styles.metricCompact]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Pill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={13} color={colors.limeBright} />
      <Text numberOfLines={1} style={styles.pillText}>{label}</Text>
    </View>
  );
}

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

function relationLabel(relation?: DriverSummary['relation']) {
  if (relation === 'friend') return 'Arkadaşınız';
  if (relation === 'clan') return 'Klan Üyesi';
  if (relation === 'convoy') return 'Konvoy Sürücüsü';
  return 'TrackSnap Sürücüsü';
}

function reputationLabel(score: number, harmonyRatio: number) {
  if (score >= 90 && harmonyRatio >= 90) return 'Convoy Elite';
  if (score >= 75 && harmonyRatio >= 70) return 'Road Friendly';
  return 'Yeni Sürücü';
}

function honorColor(rank: 1 | 2 | 3) {
  if (rank === 1) return '#facc15';
  if (rank === 2) return '#e5e7eb';
  return '#fb923c';
}

function honorStyle(rank: 1 | 2 | 3) {
  if (rank === 1) return styles.honorGold;
  if (rank === 2) return styles.honorSilver;
  return styles.honorBronze;
}

const styles = createThemedStyles(() => ({
  navigationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  pageTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20 },
  pageSubtitle: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  stateCard: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 11, textAlign: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.limeMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 24 },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 19 },
  model: { marginTop: 4, color: colors.text, fontFamily: fonts.semibold, fontSize: 11 },
  meta: { marginTop: 4, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  identityPills: { marginTop: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    maxWidth: '70%',
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 14 },
  scoreLabel: { color: colors.limeBright, fontFamily: fonts.bold, fontSize: 9 },
  metrics: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  communityMetrics: { marginTop: 13, flexDirection: 'row', gap: 9 },
  metric: {
    width: '48.5%',
    minHeight: 72,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    justifyContent: 'center',
  },
  metricCompact: { flex: 1, width: undefined },
  metricLabel: { color: colors.textFaint, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.1, textTransform: 'uppercase' },
  metricValue: { marginTop: 7, color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 13 },
  progressTrack: { marginTop: 14, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.lime },
  honors: { marginTop: 13, gap: 8 },
  honor: {
    minHeight: 50,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  honorRank: { width: 28, fontFamily: fonts.extraBold, fontSize: 13 },
  honorTitle: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 10 },
  honorGold: { borderColor: 'rgba(250,204,21,0.35)', backgroundColor: 'rgba(250,204,21,0.07)' },
  honorSilver: { borderColor: 'rgba(229,231,235,0.28)', backgroundColor: 'rgba(229,231,235,0.06)' },
  honorBronze: { borderColor: 'rgba(249,115,22,0.32)', backgroundColor: 'rgba(249,115,22,0.07)' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
}));
