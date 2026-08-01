import type { LeaderboardEntry } from '@/types/cruiser';

type LeaderboardKind = 'driver' | 'clan';

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
    weeklyKm: entry.weeklyPeriodKey === periods.week ? Number(entry.weeklyKm ?? 0) : 0,
    weeklyDriveSeconds: entry.weeklyPeriodKey === periods.week
      ? Number(entry.weeklyDriveSeconds ?? 0)
      : 0,
    weeklyMaxSpeedKmh: entry.weeklyPeriodKey === periods.week
      ? Number(entry.weeklyMaxSpeedKmh ?? 0)
      : 0,
  }));
}
