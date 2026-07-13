const DRIVE_KM_PER_SECOND = 0.4;
const DRIVE_GRACE_SECONDS = 3;
const MAX_SESSION_SECONDS = 6 * 60 * 60;
const MAX_SESSION_KM = 2000;
const STATS_SCHEMA_VERSION = 1;
const TIME_ZONE = "Europe/Istanbul";

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
  buildAchievementProgress,
  buildDriverStatsDocument,
  buildLeaderboardEntry,
  calculateAcceptedDriveKm,
  getMonthKey,
  isNightTime,
  roundKm,
};
