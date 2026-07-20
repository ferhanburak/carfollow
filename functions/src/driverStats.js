// Client distance comes from filtered GPS fixes; this remains a server-side anti-abuse ceiling.
const DRIVE_KM_PER_SECOND = 0.1;
const DRIVE_GRACE_SECONDS = 3;
const MAX_SESSION_SECONDS = 6 * 60 * 60;
const MAX_SESSION_KM = 2000;
const STATS_SCHEMA_VERSION = 1;
const TIME_ZONE = "Europe/Istanbul";
const { resolveMaintenanceLimit } = require("./maintenanceLimits");

const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  {
    key: "night-warrior",
    title: "Gece Savascisi",
    description: "Ayni ay icinde 500 KM gece surusu tamamla.",
    metric: "monthlyNightKm",
    target: 500,
    unit: "KM",
  },
  {
    key: "asphalt-weeper",
    title: "Asfalt Aglatan",
    description: "Arac odometresinde 70.000 KM seviyesine ulas.",
    metric: "odometer",
    target: 70000,
    unit: "KM",
  },
  {
    key: "crew-favorite",
    title: "Uyum Ustasi",
    description: "Konvoylardan 20 pozitif uyum oyu topla.",
    metric: "harmonyVotes",
    target: 20,
    unit: "vote",
  },
  {
    key: "garage-keeper",
    title: "Garaj Arsivi",
    description: "Vehicle Passport'a en az 5 servis kaydi ekle.",
    metric: "serviceLogCount",
    target: 5,
    unit: "log",
  },
  {
    key: "apex-score",
    title: "Crew Apex",
    description: "Sunucu kontrollu surucu skorunda 95 seviyesine ulas.",
    metric: "driverScore",
    target: 95,
    unit: "score",
  },
]);

function roundKm(value) {
  return Number(Math.max(0, Number(value) || 0).toFixed(1));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function addUtcMonths(date, months) {
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + Math.max(0, Number(months) || 0));
  return nextDate;
}

function buildPartLifeSnapshot(part = {}, odometer = 0, now = new Date()) {
  const maintenanceLimit = resolveMaintenanceLimit(part);
  const currentOdometer = roundKm(odometer);
  const replacedKm = roundKm(part.replacedKm);
  const lifeExpectancyKm = maintenanceLimit.lifeExpectancyKm;
  const usedKm = roundKm(Math.max(0, currentOdometer - replacedKm));
  const remainingKm = roundKm(Math.max(0, lifeExpectancyKm - usedKm));
  const kmHealthPercent = lifeExpectancyKm > 0
    ? clampPercent((remainingKm / lifeExpectancyKm) * 100)
    : 100;

  const replacedAt = new Date(`${String(part.replacedAt ?? "").slice(0, 10)}T00:00:00.000Z`);
  const lifeExpectancyDays = maintenanceLimit.lifeExpectancyDays;
  const lifeExpectancyMonths = maintenanceLimit.lifeExpectancyMonths;
  const hasTimeLimit = (lifeExpectancyDays > 0 || lifeExpectancyMonths > 0) && Number.isFinite(replacedAt.getTime());
  const dueDate = !hasTimeLimit
    ? null
    : lifeExpectancyDays > 0
      ? new Date(replacedAt.getTime() + lifeExpectancyDays * 24 * 60 * 60 * 1000)
      : addUtcMonths(replacedAt, lifeExpectancyMonths);
  const totalLifeMs = hasTimeLimit ? Math.max(1, dueDate.getTime() - replacedAt.getTime()) : 0;
  const remainingTimeMs = hasTimeLimit ? Math.max(0, dueDate.getTime() - toDate(now).getTime()) : 0;
  const timeHealthPercent = hasTimeLimit
    ? clampPercent((remainingTimeMs / totalLifeMs) * 100)
    : 100;
  const healthPercent = Math.min(kmHealthPercent, timeHealthPercent);
  const status = healthPercent <= 0
    ? "overdue"
    : healthPercent < 20 ? "critical" : healthPercent < 50 ? "due-soon" : "healthy";

  return {
    healthPercent,
    kmHealthPercent,
    timeHealthPercent,
    usedKm,
    remainingKm,
    dueDate: dueDate?.toISOString().slice(0, 10) ?? null,
    healthStatus: status,
    healthOdometer: currentOdometer,
    healthPeriodKey: getMonthKey(now),
  };
}

function applyCompletedDriveToClan({ clan = {}, member = {}, acceptedKm = 0, periodKey }) {
  const safePeriodKey = String(periodKey ?? getMonthKey());
  const previousClanKm = clan.monthlyKmPeriod === safePeriodKey
    ? roundKm(clan.monthlyKm ?? clan.km)
    : 0;
  const previousMemberKm = member.monthlyKmPeriod === safePeriodKey
    ? roundKm(member.monthlyKm)
    : 0;
  const monthlyKm = roundKm(previousClanKm + acceptedKm);
  const memberMonthlyKm = roundKm(previousMemberKm + acceptedKm);
  const clanId = String(clan.id ?? member.clanId ?? "");

  return {
    clanPatch: {
      monthlyKm,
      monthlyKmPeriod: safePeriodKey,
      // Legacy screens still read `km`; keep it as the current monthly total.
      km: monthlyKm,
    },
    memberPatch: {
      monthlyKm: memberMonthlyKm,
      monthlyKmPeriod: safePeriodKey,
    },
    leaderboardEntry: {
      id: `${safePeriodKey}__${clanId}`,
      clanId,
      periodKey: safePeriodKey,
      name: String(clan.name ?? ""),
      tag: String(clan.tag ?? ""),
      memberCount: Math.max(0, Number(clan.memberCount ?? clan.members ?? 0)),
      monthlyKm,
      schemaVersion: STATS_SCHEMA_VERSION,
    },
  };
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean).map(String))];
}

function toDate(value) {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }
  if (typeof value?.toMillis === "function") {
    return new Date(value.toMillis());
  }
  return new Date(value);
}

function getZonedParts(dateValue) {
  const date = toDate(dateValue);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getMonthKey(dateValue = new Date()) {
  const parts = getZonedParts(dateValue);
  return `${parts.year}-${parts.month}`;
}

function isNightTime(dateValue) {
  const hour = Number(getZonedParts(dateValue).hour);
  return hour >= 20 || hour < 6;
}

function calculateAcceptedDriveKm({ reportedKm, startedAt, finishedAt = new Date() }) {
  const startMs = toDate(startedAt).getTime();
  const finishMs = toDate(finishedAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs) || finishMs < startMs) {
    return { acceptedKm: 0, rejectedKm: roundKm(reportedKm), elapsedSeconds: 0 };
  }

  const elapsedSeconds = Math.min(MAX_SESSION_SECONDS, Math.max(0, (finishMs - startMs) / 1000));
  const allowedKm = Math.min(MAX_SESSION_KM, (elapsedSeconds + DRIVE_GRACE_SECONDS) * DRIVE_KM_PER_SECOND);
  const safeReportedKm = Math.min(MAX_SESSION_KM, roundKm(reportedKm));
  const acceptedKm = roundKm(Math.min(safeReportedKm, allowedKm));

  return {
    acceptedKm,
    rejectedKm: roundKm(safeReportedKm - acceptedKm),
    elapsedSeconds: Math.floor(elapsedSeconds),
  };
}

function buildAchievementProgress(metrics = {}, unlockedBadges = []) {
  const unlockedBadgeSet = new Set(unlockedBadges);
  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const current = roundKm(metrics[definition.metric]);
    const calculatedPercent = definition.target
      ? clampPercent((current / definition.target) * 100)
      : 0;
    const unlocked = calculatedPercent >= 100 || unlockedBadgeSet.has(definition.title);

    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      current,
      target: definition.target,
      unit: definition.unit,
      percent: unlocked ? 100 : calculatedPercent,
      unlocked,
    };
  });
}

function buildDriverStatsDocument({ existingStats = {}, profile = {}, passport = {}, vehicle = {}, now = new Date() }) {
  const periodKey = getMonthKey(now);
  const isCurrentPeriod = existingStats.periodKey === periodKey;
  const monthlyKm = isCurrentPeriod ? roundKm(existingStats.monthlyKm) : 0;
  const monthlyNightKm = isCurrentPeriod ? roundKm(existingStats.monthlyNightKm) : 0;
  const metrics = {
    monthlyNightKm,
    odometer: roundKm(vehicle.odometer ?? profile.odometer),
    harmonyVotes: Number(profile.harmonyVotes ?? 0),
    serviceLogCount: Number(passport.serviceLogCount ?? 0),
    driverScore: Number(profile.driverScore ?? 80),
  };
  const existingAchievementBadges = uniqueStrings(existingStats.achievementBadges);
  const achievements = buildAchievementProgress(metrics, existingAchievementBadges);
  const achievementBadges = uniqueStrings([
    ...existingAchievementBadges,
    ...achievements.filter((entry) => entry.unlocked).map((entry) => entry.title),
  ]);

  return {
    userId: profile.firebaseUid ?? profile.id ?? existingStats.userId ?? "",
    periodKey,
    monthlyKm,
    monthlyNightKm,
    lifetimeVerifiedKm: roundKm(existingStats.lifetimeVerifiedKm),
    completedSessions: Math.max(0, Number(existingStats.completedSessions ?? 0)),
    activeSessionId: existingStats.activeSessionId ?? null,
    odometerSnapshot: metrics.odometer,
    serviceLogCountSnapshot: metrics.serviceLogCount,
    harmonyVotesSnapshot: metrics.harmonyVotes,
    driverScoreSnapshot: metrics.driverScore,
    achievements,
    achievementBadges,
    schemaVersion: STATS_SCHEMA_VERSION,
  };
}

function applyCompletedDriveToStats({ existingStats, profile, passport, vehicle, acceptedKm, isNight, now = new Date() }) {
  const baseline = buildDriverStatsDocument({ existingStats, profile, passport, vehicle, now });
  const monthlyKm = roundKm(baseline.monthlyKm + acceptedKm);
  const monthlyNightKm = roundKm(baseline.monthlyNightKm + (isNight ? acceptedKm : 0));
  const odometer = roundKm(vehicle.odometer ?? profile.odometer);
  const achievements = buildAchievementProgress({
    monthlyNightKm,
    odometer,
    harmonyVotes: Number(profile.harmonyVotes ?? 0),
    serviceLogCount: Number(passport.serviceLogCount ?? 0),
    driverScore: Number(profile.driverScore ?? 80),
  }, baseline.achievementBadges);
  const achievementBadges = uniqueStrings([
    ...baseline.achievementBadges,
    ...achievements.filter((entry) => entry.unlocked).map((entry) => entry.title),
  ]);

  return {
    ...baseline,
    monthlyKm,
    monthlyNightKm,
    lifetimeVerifiedKm: roundKm(baseline.lifetimeVerifiedKm + acceptedKm),
    completedSessions: baseline.completedSessions + 1,
    activeSessionId: null,
    odometerSnapshot: odometer,
    achievements,
    achievementBadges,
  };
}

function buildLeaderboardEntry({ userId, profile, stats }) {
  return {
    id: `${stats.periodKey}__${userId}`,
    userId,
    periodKey: stats.periodKey,
    plate: String(profile.plate ?? ""),
    fullName: String(profile.fullName ?? ""),
    model: String(profile.model ?? ""),
    region: String(profile.region ?? ""),
    clan: String(profile.clan ?? "Independent"),
    monthlyKm: roundKm(stats.monthlyKm),
    monthlyNightKm: roundKm(stats.monthlyNightKm),
    lifetimeVerifiedKm: roundKm(stats.lifetimeVerifiedKm),
    completedSessions: Math.max(0, Number(stats.completedSessions ?? 0)),
    driverScore: Math.max(0, Number(profile.driverScore ?? 0)),
    achievementBadges: [...(stats.achievementBadges ?? [])],
    schemaVersion: STATS_SCHEMA_VERSION,
  };
}

module.exports = {
  ACHIEVEMENT_DEFINITIONS,
  DRIVE_GRACE_SECONDS,
  DRIVE_KM_PER_SECOND,
  MAX_SESSION_KM,
  MAX_SESSION_SECONDS,
  STATS_SCHEMA_VERSION,
  applyCompletedDriveToStats,
  applyCompletedDriveToClan,
  buildAchievementProgress,
  buildDriverStatsDocument,
  buildLeaderboardEntry,
  buildPartLifeSnapshot,
  calculateAcceptedDriveKm,
  getMonthKey,
  isNightTime,
  roundKm,
};
