// Client distance comes from filtered GPS fixes; this remains a server-side anti-abuse ceiling.
const DRIVE_KM_PER_SECOND = 0.1;
const DRIVE_GRACE_SECONDS = 3;
const MAX_DRIVE_SPEED_KMH = 320;
const MAX_GPS_SAMPLE_GAP_SECONDS = 30;
const MAX_SESSION_SECONDS = 6 * 60 * 60;
const MAX_SESSION_KM = 2000;
const STATS_SCHEMA_VERSION = 3;
const TIME_ZONE = "Europe/Istanbul";
const { resolveMaintenanceLimit } = require("./maintenanceLimits");

const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  {
    key: "night-warrior",
    title: "Gece Savaşçısı",
    description: "Aynı ay içinde 500 KM gece sürüşü tamamla.",
    metric: "monthlyNightKm",
    target: 500,
    unit: "KM",
  },
  {
    key: "asphalt-weeper",
    title: "Asfalt Ağlatan",
    description: "Araç odometresinde 70.000 KM seviyesine ulaş.",
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
    description: "Vehicle Passport'a en az 5 servis kaydı ekle.",
    metric: "serviceLogCount",
    target: 5,
    unit: "log",
  },
  {
    key: "apex-score",
    title: "Crew Apex",
    description: "Sunucu kontrollu sürücü skorunda 95 seviyesine ulaş.",
    metric: "driverScore",
    target: 95,
    unit: "score",
  },
]);

function roundKm(value) {
  return Number(Math.max(0, Number(value) || 0).toFixed(1));
}

function roundSpeed(value) {
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

function applyCompletedDriveToClan({
  clan = {},
  member = {},
  acceptedKm = 0,
  movingSeconds = 0,
  maxSpeedKmh = 0,
  periodKey,
  dayPeriodKey,
  weekPeriodKey,
}) {
  const safePeriodKey = String(periodKey ?? getMonthKey());
  const safeDayPeriodKey = String(dayPeriodKey ?? getDayKey());
  const safeWeekPeriodKey = String(weekPeriodKey ?? getWeekKey());
  const isCurrentClanPeriod = clan.monthlyKmPeriod === safePeriodKey;
  const isCurrentMemberPeriod = member.monthlyKmPeriod === safePeriodKey;
  const isCurrentClanDay = clan.dailyPeriodKey === safeDayPeriodKey;
  const isCurrentMemberDay = member.dailyPeriodKey === safeDayPeriodKey;
  const isCurrentClanWeek = clan.weeklyPeriodKey === safeWeekPeriodKey;
  const isCurrentMemberWeek = member.weeklyPeriodKey === safeWeekPeriodKey;
  const previousClanKm = isCurrentClanPeriod
    ? roundKm(clan.monthlyKm ?? clan.km)
    : 0;
  const previousMemberKm = isCurrentMemberPeriod
    ? roundKm(member.monthlyKm)
    : 0;
  const acceptedMovingSeconds = Math.max(0, Math.floor(Number(movingSeconds) || 0));
  const monthlyKm = roundKm(previousClanKm + acceptedKm);
  const memberMonthlyKm = roundKm(previousMemberKm + acceptedKm);
  const monthlyDriveSeconds = (
    isCurrentClanPeriod ? Math.max(0, Math.floor(Number(clan.monthlyDriveSeconds) || 0)) : 0
  ) + acceptedMovingSeconds;
  const memberMonthlyDriveSeconds = (
    isCurrentMemberPeriod ? Math.max(0, Math.floor(Number(member.monthlyDriveSeconds) || 0)) : 0
  ) + acceptedMovingSeconds;
  const monthlyMaxSpeedKmh = roundSpeed(Math.max(
    isCurrentClanPeriod ? Number(clan.monthlyMaxSpeedKmh) || 0 : 0,
    Number(maxSpeedKmh) || 0,
  ));
  const memberMonthlyMaxSpeedKmh = roundSpeed(Math.max(
    isCurrentMemberPeriod ? Number(member.monthlyMaxSpeedKmh) || 0 : 0,
    Number(maxSpeedKmh) || 0,
  ));
  const buildPeriodMetrics = (source, isCurrent) => ({
    km: roundKm((isCurrent ? source.km : 0) + acceptedKm),
    driveSeconds: (
      isCurrent ? Math.max(0, Math.floor(Number(source.driveSeconds) || 0)) : 0
    ) + acceptedMovingSeconds,
    maxSpeedKmh: roundSpeed(Math.max(
      isCurrent ? Number(source.maxSpeedKmh) || 0 : 0,
      Number(maxSpeedKmh) || 0,
    )),
  });
  const clanDaily = buildPeriodMetrics({
    km: clan.dailyKm,
    driveSeconds: clan.dailyDriveSeconds,
    maxSpeedKmh: clan.dailyMaxSpeedKmh,
  }, isCurrentClanDay);
  const memberDaily = buildPeriodMetrics({
    km: member.dailyKm,
    driveSeconds: member.dailyDriveSeconds,
    maxSpeedKmh: member.dailyMaxSpeedKmh,
  }, isCurrentMemberDay);
  const clanWeekly = buildPeriodMetrics({
    km: clan.weeklyKm,
    driveSeconds: clan.weeklyDriveSeconds,
    maxSpeedKmh: clan.weeklyMaxSpeedKmh,
  }, isCurrentClanWeek);
  const memberWeekly = buildPeriodMetrics({
    km: member.weeklyKm,
    driveSeconds: member.weeklyDriveSeconds,
    maxSpeedKmh: member.weeklyMaxSpeedKmh,
  }, isCurrentMemberWeek);
  const clanId = String(clan.id ?? member.clanId ?? "");

  return {
    clanPatch: {
      dailyKm: clanDaily.km,
      dailyDriveSeconds: clanDaily.driveSeconds,
      dailyMaxSpeedKmh: clanDaily.maxSpeedKmh,
      dailyPeriodKey: safeDayPeriodKey,
      weeklyKm: clanWeekly.km,
      weeklyDriveSeconds: clanWeekly.driveSeconds,
      weeklyMaxSpeedKmh: clanWeekly.maxSpeedKmh,
      weeklyPeriodKey: safeWeekPeriodKey,
      monthlyKm,
      monthlyDriveSeconds,
      monthlyMaxSpeedKmh,
      monthlyKmPeriod: safePeriodKey,
      // Legacy screens still read `km`; keep it as the current monthly total.
      km: monthlyKm,
    },
    memberPatch: {
      dailyKm: memberDaily.km,
      dailyDriveSeconds: memberDaily.driveSeconds,
      dailyMaxSpeedKmh: memberDaily.maxSpeedKmh,
      dailyPeriodKey: safeDayPeriodKey,
      weeklyKm: memberWeekly.km,
      weeklyDriveSeconds: memberWeekly.driveSeconds,
      weeklyMaxSpeedKmh: memberWeekly.maxSpeedKmh,
      weeklyPeriodKey: safeWeekPeriodKey,
      monthlyKm: memberMonthlyKm,
      monthlyDriveSeconds: memberMonthlyDriveSeconds,
      monthlyMaxSpeedKmh: memberMonthlyMaxSpeedKmh,
      monthlyKmPeriod: safePeriodKey,
    },
    leaderboardEntry: {
      id: `${safePeriodKey}__${clanId}`,
      clanId,
      periodKey: safePeriodKey,
      name: String(clan.name ?? ""),
      tag: String(clan.tag ?? ""),
      memberCount: Math.max(0, Number(clan.memberCount ?? clan.members ?? 0)),
      dailyKm: clanDaily.km,
      dailyDriveSeconds: clanDaily.driveSeconds,
      dailyMaxSpeedKmh: clanDaily.maxSpeedKmh,
      dailyPeriodKey: safeDayPeriodKey,
      weeklyKm: clanWeekly.km,
      weeklyDriveSeconds: clanWeekly.driveSeconds,
      weeklyMaxSpeedKmh: clanWeekly.maxSpeedKmh,
      weeklyPeriodKey: safeWeekPeriodKey,
      monthlyKm,
      monthlyDriveSeconds,
      monthlyMaxSpeedKmh,
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

function getDayKey(dateValue = new Date()) {
  const parts = getZonedParts(dateValue);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getWeekKey(dateValue = new Date()) {
  const parts = getZonedParts(dateValue);
  const localDate = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  ));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localDate.toISOString().slice(0, 10);
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

function calculateAcceptedDriveSummary({
  acceptedSampleCount,
  finishedAt = new Date(),
  qualifiedSpeedSampleCount,
  reportedKm,
  reportedMaxSpeedKmh,
  reportedMovingSeconds,
  startedAt,
}) {
  const distance = calculateAcceptedDriveKm({ reportedKm, startedAt, finishedAt });
  const safeAcceptedSampleCount = Math.max(0, Math.floor(Number(acceptedSampleCount) || 0));
  const safeQualifiedSampleCount = Math.min(
    safeAcceptedSampleCount,
    Math.max(0, Math.floor(Number(qualifiedSpeedSampleCount) || 0)),
  );
  const safeReportedMovingSeconds = Math.max(0, Math.floor(Number(reportedMovingSeconds) || 0));
  const sampleWindowSeconds = Math.max(
    0,
    (safeAcceptedSampleCount - 1) * MAX_GPS_SAMPLE_GAP_SECONDS,
  );
  const movingSeconds = distance.acceptedKm > 0 && safeAcceptedSampleCount >= 2
    ? Math.min(safeReportedMovingSeconds, distance.elapsedSeconds, sampleWindowSeconds)
    : 0;
  const requestedMaxSpeedKmh = roundSpeed(reportedMaxSpeedKmh);
  const maxSpeedKmh = (
    movingSeconds > 0 &&
    safeQualifiedSampleCount >= 2 &&
    requestedMaxSpeedKmh <= MAX_DRIVE_SPEED_KMH
  )
    ? requestedMaxSpeedKmh
    : 0;
  const averageSpeedKmh = movingSeconds > 0
    ? roundSpeed(Math.min(MAX_DRIVE_SPEED_KMH, (distance.acceptedKm / movingSeconds) * 3600))
    : 0;

  return {
    ...distance,
    acceptedSampleCount: safeAcceptedSampleCount,
    averageSpeedKmh,
    maxSpeedKmh,
    movingSeconds,
    qualifiedSpeedSampleCount: safeQualifiedSampleCount,
    rejectedMovingSeconds: Math.max(0, safeReportedMovingSeconds - movingSeconds),
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
  const dailyPeriodKey = getDayKey(now);
  const weeklyPeriodKey = getWeekKey(now);
  const isCurrentPeriod = existingStats.periodKey === periodKey;
  const isCurrentDay = existingStats.dailyPeriodKey === dailyPeriodKey;
  const isCurrentWeek = existingStats.weeklyPeriodKey === weeklyPeriodKey;
  const monthlyKm = isCurrentPeriod ? roundKm(existingStats.monthlyKm) : 0;
  const monthlyNightKm = isCurrentPeriod ? roundKm(existingStats.monthlyNightKm) : 0;
  const monthlyDriveSeconds = isCurrentPeriod
    ? Math.max(0, Math.floor(Number(existingStats.monthlyDriveSeconds) || 0))
    : 0;
  const monthlyMaxSpeedKmh = isCurrentPeriod ? roundSpeed(existingStats.monthlyMaxSpeedKmh) : 0;
  const monthlyTimedKm = isCurrentPeriod ? roundKm(existingStats.monthlyTimedKm) : 0;
  const monthlyAverageSpeedKmh = monthlyDriveSeconds > 0
    ? roundSpeed((monthlyTimedKm / monthlyDriveSeconds) * 3600)
    : 0;
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
    dailyPeriodKey,
    dailyKm: isCurrentDay ? roundKm(existingStats.dailyKm) : 0,
    dailyDriveSeconds: isCurrentDay
      ? Math.max(0, Math.floor(Number(existingStats.dailyDriveSeconds) || 0))
      : 0,
    dailyMaxSpeedKmh: isCurrentDay ? roundSpeed(existingStats.dailyMaxSpeedKmh) : 0,
    weeklyPeriodKey,
    weeklyKm: isCurrentWeek ? roundKm(existingStats.weeklyKm) : 0,
    weeklyDriveSeconds: isCurrentWeek
      ? Math.max(0, Math.floor(Number(existingStats.weeklyDriveSeconds) || 0))
      : 0,
    weeklyMaxSpeedKmh: isCurrentWeek ? roundSpeed(existingStats.weeklyMaxSpeedKmh) : 0,
    monthlyKm,
    monthlyNightKm,
    monthlyDriveSeconds,
    monthlyMaxSpeedKmh,
    monthlyAverageSpeedKmh,
    monthlyTimedKm,
    lifetimeVerifiedKm: roundKm(existingStats.lifetimeVerifiedKm),
    lifetimeDriveSeconds: Math.max(0, Math.floor(Number(existingStats.lifetimeDriveSeconds) || 0)),
    lifetimeMaxSpeedKmh: roundSpeed(existingStats.lifetimeMaxSpeedKmh),
    lifetimeTimedKm: roundKm(existingStats.lifetimeTimedKm),
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

function applyCompletedDriveToStats({
  existingStats,
  profile,
  passport,
  vehicle,
  acceptedKm,
  movingSeconds = 0,
  maxSpeedKmh = 0,
  isNight,
  now = new Date(),
}) {
  const baseline = buildDriverStatsDocument({ existingStats, profile, passport, vehicle, now });
  const monthlyKm = roundKm(baseline.monthlyKm + acceptedKm);
  const dailyKm = roundKm(baseline.dailyKm + acceptedKm);
  const weeklyKm = roundKm(baseline.weeklyKm + acceptedKm);
  const monthlyNightKm = roundKm(baseline.monthlyNightKm + (isNight ? acceptedKm : 0));
  const acceptedMovingSeconds = Math.max(0, Math.floor(Number(movingSeconds) || 0));
  const timedKm = acceptedMovingSeconds > 0 ? roundKm(acceptedKm) : 0;
  const monthlyDriveSeconds = baseline.monthlyDriveSeconds + acceptedMovingSeconds;
  const lifetimeDriveSeconds = baseline.lifetimeDriveSeconds + acceptedMovingSeconds;
  const monthlyTimedKm = roundKm(baseline.monthlyTimedKm + timedKm);
  const lifetimeTimedKm = roundKm(baseline.lifetimeTimedKm + timedKm);
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
    dailyKm,
    dailyDriveSeconds: baseline.dailyDriveSeconds + acceptedMovingSeconds,
    dailyMaxSpeedKmh: roundSpeed(Math.max(baseline.dailyMaxSpeedKmh, maxSpeedKmh)),
    weeklyKm,
    weeklyDriveSeconds: baseline.weeklyDriveSeconds + acceptedMovingSeconds,
    weeklyMaxSpeedKmh: roundSpeed(Math.max(baseline.weeklyMaxSpeedKmh, maxSpeedKmh)),
    monthlyKm,
    monthlyNightKm,
    monthlyDriveSeconds,
    monthlyMaxSpeedKmh: roundSpeed(Math.max(baseline.monthlyMaxSpeedKmh, maxSpeedKmh)),
    monthlyAverageSpeedKmh: monthlyDriveSeconds > 0
      ? roundSpeed((monthlyTimedKm / monthlyDriveSeconds) * 3600)
      : 0,
    monthlyTimedKm,
    lifetimeVerifiedKm: roundKm(baseline.lifetimeVerifiedKm + acceptedKm),
    lifetimeDriveSeconds,
    lifetimeMaxSpeedKmh: roundSpeed(Math.max(baseline.lifetimeMaxSpeedKmh, maxSpeedKmh)),
    lifetimeTimedKm,
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
    dailyPeriodKey: stats.dailyPeriodKey,
    dailyKm: roundKm(stats.dailyKm),
    dailyDriveSeconds: Math.max(0, Math.floor(Number(stats.dailyDriveSeconds) || 0)),
    dailyMaxSpeedKmh: roundSpeed(stats.dailyMaxSpeedKmh),
    weeklyPeriodKey: stats.weeklyPeriodKey,
    weeklyKm: roundKm(stats.weeklyKm),
    weeklyDriveSeconds: Math.max(0, Math.floor(Number(stats.weeklyDriveSeconds) || 0)),
    weeklyMaxSpeedKmh: roundSpeed(stats.weeklyMaxSpeedKmh),
    monthlyKm: roundKm(stats.monthlyKm),
    monthlyNightKm: roundKm(stats.monthlyNightKm),
    monthlyDriveSeconds: Math.max(0, Math.floor(Number(stats.monthlyDriveSeconds) || 0)),
    monthlyMaxSpeedKmh: roundSpeed(stats.monthlyMaxSpeedKmh),
    monthlyAverageSpeedKmh: roundSpeed(stats.monthlyAverageSpeedKmh),
    lifetimeVerifiedKm: roundKm(stats.lifetimeVerifiedKm),
    lifetimeDriveSeconds: Math.max(0, Math.floor(Number(stats.lifetimeDriveSeconds) || 0)),
    lifetimeMaxSpeedKmh: roundSpeed(stats.lifetimeMaxSpeedKmh),
    completedSessions: Math.max(0, Number(stats.completedSessions ?? 0)),
    driverScore: Math.max(0, Number(profile.driverScore ?? 0)),
    achievementBadges: [...(stats.achievementBadges ?? [])],
    schemaVersion: STATS_SCHEMA_VERSION,
  };
}

function buildAllTimeLeaderboardEntry({ userId, profile, stats }) {
  return {
    id: String(userId),
    userId: String(userId),
    plate: String(profile.plate ?? ""),
    fullName: String(profile.fullName ?? ""),
    model: String(profile.model ?? ""),
    region: String(profile.region ?? ""),
    clan: String(profile.clan ?? "Independent"),
    lifetimeVerifiedKm: roundKm(stats.lifetimeVerifiedKm),
    lifetimeDriveSeconds: Math.max(0, Math.floor(Number(stats.lifetimeDriveSeconds) || 0)),
    lifetimeMaxSpeedKmh: roundSpeed(stats.lifetimeMaxSpeedKmh),
    completedSessions: Math.max(0, Number(stats.completedSessions ?? 0)),
    driverScore: Math.max(0, Number(profile.driverScore ?? 0)),
    schemaVersion: STATS_SCHEMA_VERSION,
  };
}

module.exports = {
  ACHIEVEMENT_DEFINITIONS,
  DRIVE_GRACE_SECONDS,
  DRIVE_KM_PER_SECOND,
  MAX_SESSION_KM,
  MAX_SESSION_SECONDS,
  MAX_DRIVE_SPEED_KMH,
  STATS_SCHEMA_VERSION,
  applyCompletedDriveToStats,
  applyCompletedDriveToClan,
  buildAllTimeLeaderboardEntry,
  buildAchievementProgress,
  buildDriverStatsDocument,
  buildLeaderboardEntry,
  buildPartLifeSnapshot,
  calculateAcceptedDriveKm,
  calculateAcceptedDriveSummary,
  getDayKey,
  getMonthKey,
  getWeekKey,
  isNightTime,
  roundKm,
};
