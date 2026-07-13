export function getDriverStatsPeriod(dateValue = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(dateValue));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
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
    monthlyKm: Number(stats.monthlyKm ?? user.monthlyKm ?? 0),
    monthlyNightKm: Number(stats.monthlyNightKm ?? user.monthlyNightKm ?? 0),
    lifetimeVerifiedKm: Number(stats.lifetimeVerifiedKm ?? user.lifetimeVerifiedKm ?? 0),
    completedDriveSessions: Number(stats.completedSessions ?? user.completedDriveSessions ?? 0),
    achievementBadges,
    badges: uniqueStrings([...(user.badges ?? []), ...achievementBadges]),
    achievementProgress: Array.isArray(stats.achievements) ? stats.achievements : user.achievementProgress,
    driverStats: stats,
  };
}

export function normalizeIndividualLeaderboard(entries, currentUser, periodKey = getDriverStatsPeriod()) {
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
      monthlyKm: Number(currentUser.monthlyKm ?? 0),
      monthlyNightKm: Number(currentUser.monthlyNightKm ?? 0),
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
      monthlyKm: Number(entry.monthlyKm ?? 0),
      driverScore: Number(entry.driverScore ?? 0),
      rank: index + 1,
      verified: true,
    }));
}
