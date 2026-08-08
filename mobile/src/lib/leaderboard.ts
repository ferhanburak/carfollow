import type { LeaderboardEntry } from '@/types/cruiser';

type LeaderboardKind = 'driver' | 'clan';

export type AllTimeMetric =
  | 'lifetimeVerifiedKm'
  | 'lifetimeDriveSeconds'
  | 'lifetimeMaxSpeedKmh';

export type AllTimeHonor = {
  metric: AllTimeMetric;
  rank: 1 | 2 | 3;
  title: string;
  shortTitle: string;
  value: number;
};

export const allTimeMetricOptions: {
  value: AllTimeMetric;
  label: string;
  title: string;
}[] = [
  { value: 'lifetimeVerifiedKm', label: 'KM', title: 'Onaylı KM' },
  { value: 'lifetimeDriveSeconds', label: 'Süre', title: 'Sürüş Süresi' },
  { value: 'lifetimeMaxSpeedKmh', label: 'GPS Hızı', title: 'Onaylı GPS Hızı' },
];

function getIstanbulDateParts(dateValue: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dateValue);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function getLeaderboardPeriodKeys(dateValue = new Date()) {
  const parts = getIstanbulDateParts(dateValue);
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const localDate = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  ));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);

  return {
    day,
    month: `${parts.year}-${parts.month}`,
    week: localDate.toISOString().slice(0, 10),
  };
}

function getEntryIdentity(entry: LeaderboardEntry, kind: LeaderboardKind) {
  return String(
    kind === 'driver'
      ? entry.userId || entry.id.split('__').at(-1)
      : entry.clanId || entry.id.split('__').at(-1),
  );
}

function getUpdatedAtMillis(entry: LeaderboardEntry) {
  const updatedAt = (entry as LeaderboardEntry & {
    updatedAt?: { seconds?: number; toMillis?: () => number } | number;
  }).updatedAt;

  if (typeof updatedAt === 'number') return updatedAt;
  if (typeof updatedAt?.toMillis === 'function') return updatedAt.toMillis();
  return Number(updatedAt?.seconds ?? 0) * 1000;
}

export function normalizeLeaderboardEntries(
  entries: LeaderboardEntry[],
  kind: LeaderboardKind,
  dateValue = new Date(),
) {
  const periods = getLeaderboardPeriodKeys(dateValue);
  const currentEntries = entries.filter((entry) => (
    entry.periodKey === periods.month || entry.id.startsWith(`${periods.month}__`)
  ));
  const entriesByIdentity = new Map<string, LeaderboardEntry>();

  currentEntries.forEach((entry) => {
    const identity = getEntryIdentity(entry, kind);
    if (!identity) return;

    const existing = entriesByIdentity.get(identity);
    if (!existing || getUpdatedAtMillis(entry) >= getUpdatedAtMillis(existing)) {
      entriesByIdentity.set(identity, entry);
    }
  });

  return [...entriesByIdentity.values()].map((entry) => ({
    ...entry,
    dailyKm: entry.dailyPeriodKey === periods.day ? Number(entry.dailyKm ?? 0) : 0,
    dailyDriveSeconds: entry.dailyPeriodKey === periods.day
      ? Number(entry.dailyDriveSeconds ?? 0)
      : 0,
    dailyMaxSpeedKmh: entry.dailyPeriodKey === periods.day
      ? Number(entry.dailyMaxSpeedKmh ?? 0)
      : 0,
    dailyLongestDriveKm: entry.dailyPeriodKey === periods.day
      ? Number(entry.dailyLongestDriveKm ?? 0)
      : 0,
    weeklyKm: entry.weeklyPeriodKey === periods.week ? Number(entry.weeklyKm ?? 0) : 0,
    weeklyDriveSeconds: entry.weeklyPeriodKey === periods.week
      ? Number(entry.weeklyDriveSeconds ?? 0)
      : 0,
    weeklyMaxSpeedKmh: entry.weeklyPeriodKey === periods.week
      ? Number(entry.weeklyMaxSpeedKmh ?? 0)
      : 0,
    weeklyLongestDriveKm: entry.weeklyPeriodKey === periods.week
      ? Number(entry.weeklyLongestDriveKm ?? 0)
      : 0,
  }));
}

export function normalizeAllTimeLeaderboardEntries(entries: LeaderboardEntry[]) {
  const entriesByUser = new Map<string, LeaderboardEntry>();

  entries.forEach((entry) => {
    const userId = getEntryIdentity(entry, 'driver');
    if (!userId) return;

    const existing = entriesByUser.get(userId);
    const latest = !existing || getUpdatedAtMillis(entry) >= getUpdatedAtMillis(existing)
      ? entry
      : existing;
    entriesByUser.set(userId, {
      ...existing,
      ...latest,
      id: userId,
      userId,
      lifetimeVerifiedKm: Math.max(
        Number(existing?.lifetimeVerifiedKm ?? 0),
        Number(entry.lifetimeVerifiedKm ?? 0),
      ),
      lifetimeDriveSeconds: Math.max(
        Number(existing?.lifetimeDriveSeconds ?? 0),
        Number(entry.lifetimeDriveSeconds ?? 0),
      ),
      lifetimeMaxSpeedKmh: Math.max(
        Number(existing?.lifetimeMaxSpeedKmh ?? 0),
        Number(entry.lifetimeMaxSpeedKmh ?? 0),
      ),
    });
  });

  return [...entriesByUser.values()];
}

export function sortAllTimeLeaderboard(
  entries: LeaderboardEntry[],
  metric: AllTimeMetric,
) {
  return [...entries].sort((left, right) => {
    const metricDifference = Number(right[metric] ?? 0) - Number(left[metric] ?? 0);
    if (metricDifference) return metricDifference;
    return String(left.fullName ?? left.userId ?? '').localeCompare(
      String(right.fullName ?? right.userId ?? ''),
      'tr',
    );
  });
}

export function getAllTimeHonors(entries: LeaderboardEntry[], userId?: string) {
  if (!userId) return [];

  return allTimeMetricOptions.flatMap<AllTimeHonor>((option) => {
    const rankIndex = sortAllTimeLeaderboard(entries, option.value)
      .findIndex((entry) => entry.userId === userId);
    if (rankIndex < 0 || rankIndex > 2) return [];

    const entry = sortAllTimeLeaderboard(entries, option.value)[rankIndex];
    if (Number(entry[option.value] ?? 0) <= 0) return [];
    const rank = (rankIndex + 1) as 1 | 2 | 3;
    return [{
      metric: option.value,
      rank,
      title: `Tüm Zamanlar ${option.title} #${rank}`,
      shortTitle: `${option.title} #${rank}`,
      value: Number(entry[option.value] ?? 0),
    }];
  });
}
