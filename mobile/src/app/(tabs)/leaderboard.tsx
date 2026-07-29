import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScreenShell, Surface } from '@/components/screen-shell';
import { useLeaderboards } from '@/hooks/use-leaderboards';
import { useAuth } from '@/providers/auth-provider';
import { colors, fonts } from '@/theme/colors';
import type { LeaderboardEntry } from '@/types/cruiser';

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
  const { clans, drivers, error, loading } = useLeaderboards();
  const [period, setPeriod] = useState<Period>('monthly');
  const [metric, setMetric] = useState<Metric>('Km');
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
  const ownRank = sortedDrivers.findIndex((entry) => (entry.userId ?? entry.id) === user?.uid) + 1;
  const periodTitle = periodOptions.find((option) => option.value === period)?.title ?? 'Aylık';

  return (
    <ScreenShell>
      <LeaderboardCard
        entries={showAllDrivers ? sortedDrivers : sortedDrivers.slice(0, 5)}
        field={field}
        kind="driver"
        metric={metric}
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
    </ScreenShell>
  );
}

function LeaderboardCard({
  entries,
  field,
  kind,
  metric,
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
                <Text style={[
                  styles.periodText,
                  period === option.value && styles.periodTextActive,
                ]}>
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
              <Text style={[
                styles.metricText,
                metric === option.value && styles.metricTextActive,
              ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rows}>
          {entries.length ? entries.map((entry, index) => (
            <View key={`${kind}-${entry.id}`} style={styles.row}>
              <View style={[styles.rank, rankStyle(index)]}>
                <Text style={[styles.rankText, index < 3 && styles.rankTextTop]}>#{index + 1}</Text>
              </View>
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.name}>
                  {kind === 'driver'
                    ? entry.fullName || 'CRUISER sürücüsü'
                    : entry.clanName || entry.name || 'CRUISER klanı'}
                </Text>
                <Text numberOfLines={1} style={styles.model}>
                  {kind === 'driver'
                    ? entry.model || 'Araç bilgisi yok'
                    : `${entry.memberCount ?? 0} üye`}
                </Text>
              </View>
              <Text style={styles.value}>{formatValue(Number(entry[field] ?? 0), metric)}</Text>
            </View>
          )) : (
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatValue(value: number, metric: Metric) {
  if (metric === 'DriveSeconds') {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    return hours ? `${hours}sa ${minutes}dk` : `${minutes}dk`;
  }
  if (metric === 'MaxSpeedKmh') return `${Math.round(value)} KM/H`;
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KM`;
}

function rankStyle(index: number) {
  if (index === 0) return styles.rankGold;
  if (index === 1) return styles.rankSilver;
  if (index === 2) return styles.rankBronze;
  return styles.rankDefault;
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 17, letterSpacing: -0.3 },
  subtitle: { marginTop: 3, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 9 },
  periodSwitch: {
    padding: 3,
    borderRadius: 18,
    backgroundColor: colors.black,
    flexDirection: 'row',
  },
  periodButton: {
    width: 39,
    height: 39,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodButtonActive: { backgroundColor: colors.lime },
  periodText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 12 },
  periodTextActive: { color: colors.black },
  metricSwitch: {
    marginTop: 12,
    padding: 3,
    borderRadius: 18,
    backgroundColor: colors.black,
    flexDirection: 'row',
  },
  metricButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 5,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricButtonActive: {
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  metricText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 10, textAlign: 'center' },
  metricTextActive: { color: colors.black, fontFamily: fonts.bold },
  rows: { marginTop: 12, gap: 7 },
  row: {
    minHeight: 62,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rank: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  error: { color: '#fda4af', fontFamily: fonts.semibold, fontSize: 11, textAlign: 'center' },
});
