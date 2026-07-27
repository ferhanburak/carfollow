export function getDriverStatsPeriod(dateValue = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(dateValue));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function getZonedDateParts(dateValue = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(dateValue));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function getDriverStatsDayPeriod(dateValue = new Date()) {
  const values = getZonedDateParts(dateValue);
  return `${values.year}-${values.month}-${values.day}`;
}

export function getDriverStatsWeekPeriod(dateValue = new Date()) {
  const values = getZonedDateParts(dateValue);
  const localDate = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  ));
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return localDate.toISOString().slice(0, 10);
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean).map(String))];
}

export function mergeDriverStatsIntoUser(user, stats) {
  if (!user || !stats) {
    return user;
  }

  const achievementBadges = uniqueStrings(stats.achievementBadges);
  return {
    ...user,
    dailyKm: Number(stats.dailyKm ?? user.dailyKm ?? 0),
    dailyDriveSeconds: Number(stats.dailyDriveSeconds ?? user.dailyDriveSeconds ?? 0),
    dailyMaxSpeedKmh: Number(stats.dailyMaxSpeedKmh ?? user.dailyMaxSpeedKmh ?? 0),
    dailyPeriodKey: stats.dailyPeriodKey ?? user.dailyPeriodKey,
    weeklyKm: Number(stats.weeklyKm ?? user.weeklyKm ?? 0),
    weeklyDriveSeconds: Number(stats.weeklyDriveSeconds ?? user.weeklyDriveSeconds ?? 0),
    weeklyMaxSpeedKmh: Number(stats.weeklyMaxSpeedKmh ?? user.weeklyMaxSpeedKmh ?? 0),
    weeklyPeriodKey: stats.weeklyPeriodKey ?? user.weeklyPeriodKey,
    monthlyKm: Number(stats.monthlyKm ?? user.monthlyKm ?? 0),
    monthlyNightKm: Number(stats.monthlyNightKm ?? user.monthlyNightKm ?? 0),
    monthlyDriveSeconds: Number(stats.monthlyDriveSeconds ?? user.monthlyDriveSeconds ?? 0),
    monthlyMaxSpeedKmh: Number(stats.monthlyMaxSpeedKmh ?? user.monthlyMaxSpeedKmh ?? 0),
    monthlyAverageSpeedKmh: Number(stats.monthlyAverageSpeedKmh ?? user.monthlyAverageSpeedKmh ?? 0),
    lifetimeVerifiedKm: Number(stats.lifetimeVerifiedKm ?? user.lifetimeVerifiedKm ?? 0),
    lifetimeDriveSeconds: Number(stats.lifetimeDriveSeconds ?? user.lifetimeDriveSeconds ?? 0),
    lifetimeMaxSpeedKmh: Number(stats.lifetimeMaxSpeedKmh ?? user.lifetimeMaxSpeedKmh ?? 0),
    completedDriveSessions: Number(stats.completedSessions ?? user.completedDriveSessions ?? 0),
    achievementBadges,
    badges: uniqueStrings([...(user.badges ?? []), ...achievementBadges]),
    achievementProgress: Array.isArray(stats.achievements) ? stats.achievements : user.achievementProgress,
    driverStats: stats,
  };
}

export function normalizeIndividualLeaderboard(entries, currentUser, periodKey = getDriverStatsPeriod()) {
  const dailyPeriodKey = getDriverStatsDayPeriod();
  const weeklyPeriodKey = getDriverStatsWeekPeriod();
  const currentUserId = currentUser?.firebaseUid ?? currentUser?.id;
  const matchingEntries = (entries ?? []).filter((entry) => entry?.periodKey === periodKey);
  const entriesByUser = new Map(
    matchingEntries
      .filter((entry) => entry?.userId)
      .map((entry) => [entry.userId, entry]),
  );

  if (currentUser && currentUserId && !entriesByUser.has(currentUserId)) {
    entriesByUser.set(currentUserId, {
      id: `${periodKey}__${currentUserId}`,
      userId: currentUserId,
      periodKey,
      plate: currentUser.plate,
      fullName: currentUser.fullName,
      model: currentUser.model,
      region: currentUser.region,
      clan: currentUser.clan,
      dailyPeriodKey: currentUser.dailyPeriodKey,
      dailyKm: Number(currentUser.dailyKm ?? 0),
      dailyDriveSeconds: Number(currentUser.dailyDriveSeconds ?? 0),
      dailyMaxSpeedKmh: Number(currentUser.dailyMaxSpeedKmh ?? 0),
      weeklyPeriodKey: currentUser.weeklyPeriodKey,
      weeklyKm: Number(currentUser.weeklyKm ?? 0),
      weeklyDriveSeconds: Number(currentUser.weeklyDriveSeconds ?? 0),
      weeklyMaxSpeedKmh: Number(currentUser.weeklyMaxSpeedKmh ?? 0),
      monthlyKm: Number(currentUser.monthlyKm ?? 0),
      monthlyNightKm: Number(currentUser.monthlyNightKm ?? 0),
      monthlyDriveSeconds: Number(currentUser.monthlyDriveSeconds ?? 0),
      monthlyMaxSpeedKmh: Number(currentUser.monthlyMaxSpeedKmh ?? 0),
      monthlyAverageSpeedKmh: Number(currentUser.monthlyAverageSpeedKmh ?? 0),
      lifetimeVerifiedKm: Number(currentUser.lifetimeVerifiedKm ?? 0),
      completedSessions: Number(currentUser.completedDriveSessions ?? 0),
      driverScore: Number(currentUser.driverScore ?? 0),
      achievementBadges: currentUser.achievementBadges ?? [],
    });
  }

  return [...entriesByUser.values()]
    .sort((left, right) => {
      const distanceDifference = Number(right.monthlyKm ?? 0) - Number(left.monthlyKm ?? 0);
      if (distanceDifference !== 0) {
        return distanceDifference;
      }
      const scoreDifference = Number(right.driverScore ?? 0) - Number(left.driverScore ?? 0);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
      return String(left.fullName ?? left.plate ?? "").localeCompare(String(right.fullName ?? right.plate ?? ""));
    })
    .map((entry, index) => ({
      ...entry,
      dailyKm: entry.dailyPeriodKey === dailyPeriodKey ? Number(entry.dailyKm ?? 0) : 0,
      dailyDriveSeconds: entry.dailyPeriodKey === dailyPeriodKey
        ? Number(entry.dailyDriveSeconds ?? 0)
        : 0,
      dailyMaxSpeedKmh: entry.dailyPeriodKey === dailyPeriodKey
        ? Number(entry.dailyMaxSpeedKmh ?? 0)
        : 0,
      weeklyKm: entry.weeklyPeriodKey === weeklyPeriodKey ? Number(entry.weeklyKm ?? 0) : 0,
      weeklyDriveSeconds: entry.weeklyPeriodKey === weeklyPeriodKey
        ? Number(entry.weeklyDriveSeconds ?? 0)
        : 0,
      weeklyMaxSpeedKmh: entry.weeklyPeriodKey === weeklyPeriodKey
        ? Number(entry.weeklyMaxSpeedKmh ?? 0)
        : 0,
      monthlyKm: Number(entry.monthlyKm ?? 0),
      monthlyDriveSeconds: Number(entry.monthlyDriveSeconds ?? 0),
      monthlyMaxSpeedKmh: Number(entry.monthlyMaxSpeedKmh ?? 0),
      monthlyAverageSpeedKmh: Number(entry.monthlyAverageSpeedKmh ?? 0),
      driverScore: Number(entry.driverScore ?? 0),
      rank: index + 1,
      verified: true,
    }));
}
