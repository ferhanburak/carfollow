import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenShell, Surface } from '@/components/screen-shell';
import { useLeaderboards } from '@/hooks/use-leaderboards';
import {
  allTimeMetricOptions,
  sortAllTimeLeaderboard,
  type AllTimeMetric,
} from '@/lib/leaderboard';
import { useAuth } from '@/providers/auth-provider';
import { useDriverProfile } from '@/providers/driver-profile-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';
import type { DriverSummary, LeaderboardEntry } from '@/types/cruiser';

type Period = 'monthly' | 'weekly' | 'daily';
type Metric = 'Km' | 'DriveSeconds' | 'MaxSpeedKmh';

const periodOptions: { value: Period; label: string; title: string }[] = [
  { value: 'monthly', label: 'A', title: 'Aylık' },
  { value: 'weekly', label: 'H', title: 'Haftalık' },
  { value: 'daily', label: 'G', title: 'Günlük' },
];

const metricOptions: { value: Metric; label: string }[] = [
  { value: 'Km', label: 'KM' },
  { value: 'DriveSeconds', label: 'Sürüş Süresi' },
  { value: 'MaxSpeedKmh', label: 'Maksimum Hız' },
];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const { openDriverProfile } = useDriverProfile();
  const { allTimeDrivers, clans, drivers, error, loading } = useLeaderboards();
  const [period, setPeriod] = useState<Period>('monthly');
  const [metric, setMetric] = useState<Metric>('Km');
  const [allTimeMetric, setAllTimeMetric] = useState<AllTimeMetric>('lifetimeVerifiedKm');
  const [allTimeOpen, setAllTimeOpen] = useState(false);
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [showAllClans, setShowAllClans] = useState(false);

  const field = `${period}${metric}` as keyof LeaderboardEntry;
  const sortedDrivers = useMemo(
    () => [...drivers].sort((left, right) => Number(right[field] ?? 0) - Number(left[field] ?? 0)),
    [drivers, field],
  );
  const sortedClans = useMemo(
    () => [...clans].sort((left, right) => Number(right[field] ?? 0) - Number(left[field] ?? 0)),
    [clans, field],
  );
  const sortedAllTime = useMemo(
    () => sortAllTimeLeaderboard(allTimeDrivers, allTimeMetric),
    [allTimeDrivers, allTimeMetric],
  );
  const ownRank = sortedDrivers.findIndex((entry) => (entry.userId ?? entry.id) === user?.uid) + 1;
  const periodTitle = periodOptions.find((option) => option.value === period)?.title ?? 'Aylık';

  const openProfile = (entry: LeaderboardEntry) => void openDriverProfile(toDriverSummary(entry));

  return (
    <ScreenShell>
      <LegendsPodium
        entries={sortedAllTime}
        metric={allTimeMetric}
        onChangeMetric={setAllTimeMetric}
        onOpenAll={() => setAllTimeOpen(true)}
        onOpenDriver={openProfile}
      />

      <LeaderboardCard
        entries={showAllDrivers ? sortedDrivers : sortedDrivers.slice(0, 5)}
        field={field}
        kind="driver"
        metric={metric}
        onOpenDriver={(driver) => void openDriverProfile(driver)}
        onToggle={() => setShowAllDrivers((current) => !current)}
        period={period}
        setMetric={setMetric}
        setPeriod={setPeriod}
        subtitle={showAllDrivers
          ? `${sortedDrivers.length} sürücü`
          : 'İlk 5 sürücü · tümünü görmek için dokunun'}
        title={`${periodTitle} Sürücü Sıralaması`}
      />

      <View style={styles.selfStats}>
        <Stat label="Sıran" value={ownRank ? `#${ownRank}` : '-'} />
        <Stat label="Sürücü" value={String(sortedDrivers.length)} />
        <Stat label="Klan" value={String(sortedClans.length)} />
      </View>

      <LeaderboardCard
        entries={showAllClans ? sortedClans : sortedClans.slice(0, 5)}
        field={field}
        kind="clan"
        metric={metric}
        onToggle={() => setShowAllClans((current) => !current)}
        period={period}
        setMetric={setMetric}
        setPeriod={setPeriod}
        subtitle={showAllClans
          ? `${sortedClans.length} klan`
          : 'İlk 5 klan · tümünü görmek için dokunun'}
        title={`${periodTitle} Klan Sıralaması`}
      />

      {loading ? <ActivityIndicator color={colors.lime} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <AllTimeRankingModal
        entries={sortedAllTime}
        metric={allTimeMetric}
        onChangeMetric={setAllTimeMetric}
        onClose={() => setAllTimeOpen(false)}
        onOpenDriver={openProfile}
        visible={allTimeOpen}
      />
    </ScreenShell>
  );
}

function LegendsPodium({
  entries,
  metric,
  onChangeMetric,
  onOpenAll,
  onOpenDriver,
}: {
  entries: LeaderboardEntry[];
  metric: AllTimeMetric;
  onChangeMetric: (value: AllTimeMetric) => void;
  onOpenAll: () => void;
  onOpenDriver: (entry: LeaderboardEntry) => void;
}) {
  const podiumEntries = [entries[1], entries[0], entries[2]];
  const ranks = [2, 1, 3] as const;

  return (
    <Surface accent>
      <Pressable onPress={onOpenAll}>
        <View style={styles.legendsHeader}>
          <View style={styles.titleCopy}>
            <Text style={styles.legendsEyebrow}>TÜM ZAMANLAR</Text>
            <Text style={styles.title}>Efsaneler Kürsüsü</Text>
            <Text style={styles.subtitle}>Tüm sıralamayı görmek için dokunun</Text>
          </View>
          <Ionicons name="trophy" size={25} color="#facc15" />
        </View>

        <AllTimeMetricSwitch metric={metric} onChange={onChangeMetric} />

        {entries.length ? (
          <View style={styles.podium}>
            {podiumEntries.map((entry, index) => {
              const rank = ranks[index];
              return (
                <Pressable
                  disabled={!entry}
                  key={`podium-${rank}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    if (entry) onOpenDriver(entry);
                  }}
                  style={({ pressed }) => [
                    styles.podiumSlot,
                    rank === 1 && styles.podiumSlotFirst,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={[styles.podiumAvatar, podiumRankStyle(rank)]}>
                    <Text style={styles.podiumInitial}>{getInitial(entry?.fullName)}</Text>
                    <View style={[styles.podiumMedal, podiumRankStyle(rank)]}>
                      <Text style={styles.podiumRank}>#{rank}</Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.podiumName}>
                    {entry?.fullName || 'Henüz boş'}
                  </Text>
                  <Text numberOfLines={1} style={styles.podiumModel}>
                    {entry?.model || 'Sıralama bekleniyor'}
                  </Text>
                  <View style={[styles.podiumBlock, rank === 1 && styles.podiumBlockFirst]}>
                    <Text style={styles.podiumValue}>
                      {entry ? formatAllTimeValue(Number(entry[metric] ?? 0), metric) : '--'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={25} color={colors.textFaint} />
            <Text style={styles.emptyText}>İlk onaylı sürüşler kürsüyü oluşturacak.</Text>
          </View>
        )}
      </Pressable>
    </Surface>
  );
}

function AllTimeRankingModal({
  entries,
  metric,
  onChangeMetric,
  onClose,
  onOpenDriver,
  visible,
}: {
  entries: LeaderboardEntry[];
  metric: AllTimeMetric;
  onChangeMetric: (value: AllTimeMetric) => void;
  onClose: () => void;
  onOpenDriver: (entry: LeaderboardEntry) => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Pressable accessibilityLabel="Geri" onPress={onClose} style={styles.modalClose}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.modalTitleCopy}>
            <Text style={styles.modalTitle}>Tüm Zamanlar</Text>
            <Text style={styles.subtitle}>{entries.length} sürücü</Text>
          </View>
          <Ionicons name="trophy" size={23} color="#facc15" />
        </View>
        <View style={styles.modalMetricSwitch}>
          <AllTimeMetricSwitch metric={metric} onChange={onChangeMetric} />
        </View>
        <ScrollView contentContainerStyle={styles.modalList}>
          {entries.map((entry, index) => (
            <Pressable
              key={`all-time-${entry.userId ?? entry.id}`}
              onPress={() => onOpenDriver(entry)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rank, rankStyle(index)]}>
                <Text style={[styles.rankText, index < 3 && styles.rankTextTop]}>#{index + 1}</Text>
              </View>
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.name}>{entry.fullName || 'TrackSnap sürücüsü'}</Text>
                <Text numberOfLines={1} style={styles.model}>{entry.model || 'Araç bilgisi yok'}</Text>
              </View>
              <Text style={styles.value}>{formatAllTimeValue(Number(entry[metric] ?? 0), metric)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function AllTimeMetricSwitch({ metric, onChange }: {
  metric: AllTimeMetric;
  onChange: (value: AllTimeMetric) => void;
}) {
  return (
    <View style={styles.allTimeMetricSwitch}>
      {allTimeMetricOptions.map((option) => (
        <Pressable
          key={option.value}
          onPress={(event) => {
            event.stopPropagation();
            onChange(option.value);
          }}
          style={[styles.allTimeMetricButton, metric === option.value && styles.allTimeMetricActive]}
        >
          <Text style={[styles.metricText, metric === option.value && styles.metricTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LeaderboardCard({
  entries,
  field,
  kind,
  metric,
  onOpenDriver,
  onToggle,
  period,
  setMetric,
  setPeriod,
  subtitle,
  title,
}: {
  entries: LeaderboardEntry[];
  field: keyof LeaderboardEntry;
  kind: 'driver' | 'clan';
  metric: Metric;
  onOpenDriver?: (driver: DriverSummary) => void;
  onToggle: () => void;
  period: Period;
  setMetric: (value: Metric) => void;
  setPeriod: (value: Period) => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Surface>
      <Pressable onPress={onToggle}>
        <View style={styles.cardHeader}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.periodSwitch}>
            {periodOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={(event) => {
                  event.stopPropagation();
                  setPeriod(option.value);
                }}
                style={[styles.periodButton, period === option.value && styles.periodButtonActive]}
              >
                <Text style={[styles.periodText, period === option.value && styles.periodTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.metricSwitch}>
          {metricOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={(event) => {
                event.stopPropagation();
                setMetric(option.value);
              }}
              style={[styles.metricButton, metric === option.value && styles.metricButtonActive]}
            >
              <Text style={[styles.metricText, metric === option.value && styles.metricTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rows}>
          {entries.length ? entries.map((entry, index) => {
            const row = (
              <>
                <View style={[styles.rank, rankStyle(index)]}>
                  <Text style={[styles.rankText, index < 3 && styles.rankTextTop]}>#{index + 1}</Text>
                </View>
                <View style={styles.identity}>
                  <Text numberOfLines={1} style={styles.name}>
                    {kind === 'driver'
                      ? entry.fullName || 'TrackSnap sürücüsü'
                      : entry.clanName || entry.name || 'TrackSnap klanı'}
                  </Text>
                  <Text numberOfLines={1} style={styles.model}>
                    {kind === 'driver' ? entry.model || 'Araç bilgisi yok' : `${entry.memberCount ?? 0} üye`}
                  </Text>
                </View>
                <Text style={styles.value}>{formatValue(Number(entry[field] ?? 0), metric)}</Text>
              </>
            );
            if (kind === 'driver') {
              return (
                <Pressable
                  key={`${kind}-${entry.id}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onOpenDriver?.(toDriverSummary(entry));
                  }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  {row}
                </Pressable>
              );
            }
            return <View key={`${kind}-${entry.id}`} style={styles.row}>{row}</View>;
          }) : (
            <View style={styles.empty}>
              <Ionicons name="stats-chart-outline" size={22} color={colors.textFaint} />
              <Text style={styles.emptyText}>Bu dönem için veri yok.</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Surface>
  );
}

function toDriverSummary(entry: LeaderboardEntry): DriverSummary {
  return {
    userId: entry.userId ?? entry.id,
    fullName: entry.fullName,
    model: entry.model,
    driverScore: entry.driverScore,
    monthlyKm: entry.monthlyKm,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatValue(value: number, metric: Metric) {
  if (metric === 'DriveSeconds') return formatDuration(value);
  if (metric === 'MaxSpeedKmh') return `${Math.round(value)} KM/H`;
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KM`;
}

function formatAllTimeValue(value: number, metric: AllTimeMetric) {
  if (metric === 'lifetimeDriveSeconds') return formatDuration(value);
  if (metric === 'lifetimeMaxSpeedKmh') return `${Math.round(value)} KM/H`;
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KM`;
}

function formatDuration(value: number) {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${hours}sa ${minutes}dk` : `${minutes}dk`;
}

function getInitial(name?: string) {
  return name?.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
}

function podiumRankStyle(rank: 1 | 2 | 3) {
  if (rank === 1) return styles.rankGold;
  if (rank === 2) return styles.rankSilver;
  return styles.rankBronze;
}

function rankStyle(index: number) {
  if (index === 0) return styles.rankGold;
  if (index === 1) return styles.rankSilver;
  if (index === 2) return styles.rankBronze;
  return styles.rankDefault;
}

const styles = createThemedStyles(() => ({
  legendsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legendsEyebrow: { color: colors.lime, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17, letterSpacing: -0.3 },
  subtitle: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  allTimeMetricSwitch: {
    marginTop: 14,
    padding: 3,
    borderRadius: 18,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
  },
  allTimeMetricButton: {
    flex: 1,
    minHeight: 39,
    paddingHorizontal: 5,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allTimeMetricActive: { backgroundColor: colors.lime },
  podium: { marginTop: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  podiumSlot: { flex: 1, alignItems: 'center', minWidth: 0 },
  podiumSlotFirst: { paddingBottom: 10 },
  podiumAvatar: {
    width: 53,
    height: 53,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumInitial: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 20 },
  podiumMedal: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: { color: colors.black, fontFamily: fonts.extraBold, fontSize: 8 },
  podiumName: { marginTop: 10, color: colors.text, fontFamily: fonts.bold, fontSize: 10 },
  podiumModel: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 8 },
  podiumBlock: {
    width: '100%',
    minHeight: 56,
    marginTop: 8,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBlockFirst: { minHeight: 78, borderColor: 'rgba(250,204,21,0.48)' },
  podiumValue: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 9, textAlign: 'center' },
  periodSwitch: { padding: 3, borderRadius: 18, backgroundColor: colors.backgroundRaised, flexDirection: 'row' },
  periodButton: { width: 39, height: 39, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  periodButtonActive: { backgroundColor: colors.lime },
  periodText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 12 },
  periodTextActive: { color: colors.black },
  metricSwitch: { marginTop: 12, padding: 3, borderRadius: 18, backgroundColor: colors.backgroundRaised, flexDirection: 'row' },
  metricButton: { flex: 1, minHeight: 44, paddingHorizontal: 5, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  metricButtonActive: { backgroundColor: colors.lime },
  metricText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10, textAlign: 'center' },
  metricTextActive: { color: colors.black, fontFamily: fonts.bold },
  rows: { marginTop: 12, gap: 7 },
  row: {
    minHeight: 62,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rank: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rankGold: { backgroundColor: '#facc15' },
  rankSilver: { backgroundColor: '#e5e7eb' },
  rankBronze: { backgroundColor: '#f97316' },
  rankDefault: { backgroundColor: colors.surfaceAlt },
  rankText: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 11 },
  rankTextTop: { color: colors.black },
  identity: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  model: { marginTop: 2, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  value: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 11 },
  rowPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  selfStats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    minHeight: 64,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { color: colors.limeBright, fontFamily: fonts.extraBold, fontSize: 15 },
  statLabel: { marginTop: 3, color: colors.textFaint, fontFamily: fonts.bold, fontSize: 8 },
  empty: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, textAlign: 'center' },
  error: { color: '#fda4af', fontFamily: fonts.semibold, fontSize: 11, textAlign: 'center' },
  modalRoot: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    minHeight: 68,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalClose: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  modalTitleCopy: { flex: 1 },
  modalTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20 },
  modalMetricSwitch: { paddingHorizontal: 16, paddingBottom: 12 },
  modalList: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
}));
