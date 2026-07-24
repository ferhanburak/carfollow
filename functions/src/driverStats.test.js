const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyCompletedDriveToClan,
  applyCompletedDriveToStats,
  buildAchievementProgress,
  buildDriverStatsDocument,
  buildPartLifeSnapshot,
  calculateAcceptedDriveKm,
  calculateAcceptedDriveSummary,
  getMonthKey,
  isNightTime,
} = require("./driverStats");

test("calculates part health from the stricter kilometer or calendar limit", () => {
  const snapshot = buildPartLifeSnapshot({
    replacedKm: 10000,
    replacedAt: "2026-01-01",
    lifeExpectancyKm: 10000,
    lifeExpectancyMonths: 12,
  }, 18000, new Date("2026-04-01T12:00:00.000Z"));

  assert.equal(snapshot.remainingKm, 2000);
  assert.equal(snapshot.kmHealthPercent, 20);
  assert.equal(snapshot.timeHealthPercent > snapshot.kmHealthPercent, true);
  assert.equal(snapshot.healthPercent, 20);
  assert.equal(snapshot.healthStatus, "due-soon");
  assert.equal(snapshot.dueDate, "2027-01-01");
});

test("marks an expired calendar maintenance item as overdue", () => {
  const snapshot = buildPartLifeSnapshot({
    replacedKm: 10000,
    replacedAt: "2025-01-01",
    lifeExpectancyKm: 50000,
    lifeExpectancyMonths: 12,
  }, 12000, new Date("2026-07-01T00:00:00.000Z"));

  assert.equal(snapshot.timeHealthPercent, 0);
  assert.equal(snapshot.healthPercent, 0);
  assert.equal(snapshot.healthStatus, "overdue");
});

test("resets clan and member totals when a new monthly period starts", () => {
  const aggregate = applyCompletedDriveToClan({
    clan: {
      id: "clan-1",
      name: "Ankara Apex",
      tag: "APEX",
      memberCount: 3,
      monthlyKmPeriod: "2026-06",
      monthlyKm: 900,
      monthlyDriveSeconds: 7200,
      monthlyMaxSpeedKmh: 180,
    },
    member: {
      clanId: "clan-1",
      monthlyKmPeriod: "2026-06",
      monthlyKm: 240,
      monthlyDriveSeconds: 3600,
      monthlyMaxSpeedKmh: 150,
    },
    acceptedKm: 5.2,
    movingSeconds: 240,
    maxSpeedKmh: 126,
    periodKey: "2026-07",
  });

  assert.equal(aggregate.clanPatch.monthlyKm, 5.2);
  assert.equal(aggregate.clanPatch.monthlyDriveSeconds, 240);
  assert.equal(aggregate.clanPatch.monthlyMaxSpeedKmh, 126);
  assert.equal(aggregate.clanPatch.km, 5.2);
  assert.equal(aggregate.memberPatch.monthlyKm, 5.2);
  assert.equal(aggregate.memberPatch.monthlyDriveSeconds, 240);
  assert.equal(aggregate.memberPatch.monthlyMaxSpeedKmh, 126);
  assert.equal(aggregate.leaderboardEntry.id, "2026-07__clan-1");
  assert.equal(aggregate.leaderboardEntry.monthlyDriveSeconds, 240);
  assert.equal(aggregate.leaderboardEntry.monthlyMaxSpeedKmh, 126);
});

test("accumulates current clan drive time and preserves the highest speed", () => {
  const aggregate = applyCompletedDriveToClan({
    clan: {
      id: "clan-1",
      monthlyKmPeriod: "2026-07",
      monthlyKm: 120,
      monthlyDriveSeconds: 3600,
      monthlyMaxSpeedKmh: 142,
    },
    member: {
      clanId: "clan-1",
      monthlyKmPeriod: "2026-07",
      monthlyKm: 40,
      monthlyDriveSeconds: 1200,
      monthlyMaxSpeedKmh: 118,
    },
    acceptedKm: 4.5,
    movingSeconds: 300,
    maxSpeedKmh: 130,
    periodKey: "2026-07",
  });

  assert.equal(aggregate.clanPatch.monthlyDriveSeconds, 3900);
  assert.equal(aggregate.clanPatch.monthlyMaxSpeedKmh, 142);
  assert.equal(aggregate.memberPatch.monthlyDriveSeconds, 1500);
  assert.equal(aggregate.memberPatch.monthlyMaxSpeedKmh, 130);
});

test("uses the Istanbul calendar for monthly periods and night sessions", () => {
  assert.equal(getMonthKey(new Date("2026-06-30T22:30:00.000Z")), "2026-07");
  assert.equal(isNightTime(new Date("2026-07-13T21:30:00.000Z")), true);
  assert.equal(isNightTime(new Date("2026-07-13T09:30:00.000Z")), false);
});

test("clamps reported distance to server elapsed time", () => {
  const result = calculateAcceptedDriveKm({
    reportedKm: 20,
    startedAt: new Date("2026-07-13T10:00:00.000Z"),
    finishedAt: new Date("2026-07-13T10:00:10.000Z"),
  });

  assert.deepEqual(result, {
    acceptedKm: 1.3,
    rejectedKm: 18.7,
    elapsedSeconds: 10,
  });
});

test("accepts moving time and maximum speed only within server and sample limits", () => {
  const result = calculateAcceptedDriveSummary({
    acceptedSampleCount: 12,
    qualifiedSpeedSampleCount: 4,
    reportedKm: 2,
    reportedMaxSpeedKmh: 118,
    reportedMovingSeconds: 80,
    startedAt: new Date("2026-07-13T10:00:00.000Z"),
    finishedAt: new Date("2026-07-13T10:02:00.000Z"),
  });

  assert.deepEqual(result, {
    acceptedKm: 2,
    rejectedKm: 0,
    elapsedSeconds: 120,
    acceptedSampleCount: 12,
    averageSpeedKmh: 90,
    maxSpeedKmh: 118,
    movingSeconds: 80,
    qualifiedSpeedSampleCount: 4,
    rejectedMovingSeconds: 0,
  });
});

test("rejects unsupported speed records and caps moving time to observed sample windows", () => {
  const result = calculateAcceptedDriveSummary({
    acceptedSampleCount: 2,
    qualifiedSpeedSampleCount: 1,
    reportedKm: 1,
    reportedMaxSpeedKmh: 190,
    reportedMovingSeconds: 300,
    startedAt: new Date("2026-07-13T10:00:00.000Z"),
    finishedAt: new Date("2026-07-13T10:05:00.000Z"),
  });

  assert.equal(result.movingSeconds, 30);
  assert.equal(result.rejectedMovingSeconds, 270);
  assert.equal(result.maxSpeedKmh, 0);
});

test("resets monthly counters when the period changes", () => {
  const stats = buildDriverStatsDocument({
    existingStats: {
      periodKey: "2026-06",
      monthlyKm: 900,
      monthlyNightKm: 600,
      monthlyDriveSeconds: 3600,
      monthlyMaxSpeedKmh: 140,
      monthlyTimedKm: 60,
      lifetimeVerifiedKm: 1200,
      lifetimeDriveSeconds: 7200,
      lifetimeMaxSpeedKmh: 180,
      lifetimeTimedKm: 120,
      completedSessions: 4,
    },
    profile: { id: "user-1", odometer: 68000, driverScore: 90, harmonyVotes: 4 },
    passport: { serviceLogCount: 2 },
    vehicle: { odometer: 68000 },
    now: new Date("2026-07-13T10:00:00.000Z"),
  });

  assert.equal(stats.periodKey, "2026-07");
  assert.equal(stats.monthlyKm, 0);
  assert.equal(stats.monthlyNightKm, 0);
  assert.equal(stats.monthlyDriveSeconds, 0);
  assert.equal(stats.monthlyMaxSpeedKmh, 0);
  assert.equal(stats.lifetimeVerifiedKm, 1200);
  assert.equal(stats.lifetimeDriveSeconds, 7200);
  assert.equal(stats.lifetimeMaxSpeedKmh, 180);
});

test("unlocks achievements from authoritative metric snapshots", () => {
  const achievements = buildAchievementProgress({
    monthlyNightKm: 500,
    odometer: 70000,
    harmonyVotes: 20,
    serviceLogCount: 5,
    driverScore: 95,
  });

  assert.equal(achievements.every((achievement) => achievement.unlocked), true);
});

test("adds accepted night distance to monthly and lifetime totals", () => {
  const stats = applyCompletedDriveToStats({
    existingStats: {
      periodKey: "2026-07",
      monthlyKm: 120,
      monthlyNightKm: 40,
      lifetimeVerifiedKm: 600,
      completedSessions: 3,
    },
    profile: { id: "user-1", odometer: 68400, driverScore: 90, harmonyVotes: 4 },
    passport: { serviceLogCount: 2 },
    vehicle: { odometer: 68405.2 },
    acceptedKm: 5.2,
    movingSeconds: 240,
    maxSpeedKmh: 126,
    isNight: true,
    now: new Date("2026-07-13T21:00:00.000Z"),
  });

  assert.equal(stats.monthlyKm, 125.2);
  assert.equal(stats.monthlyNightKm, 45.2);
  assert.equal(stats.lifetimeVerifiedKm, 605.2);
  assert.equal(stats.monthlyDriveSeconds, 240);
  assert.equal(stats.lifetimeDriveSeconds, 240);
  assert.equal(stats.monthlyMaxSpeedKmh, 126);
  assert.equal(stats.lifetimeMaxSpeedKmh, 126);
  assert.equal(stats.monthlyAverageSpeedKmh, 78);
  assert.equal(stats.completedSessions, 4);
});

test("keeps previously unlocked monthly achievements after a period reset", () => {
  const stats = buildDriverStatsDocument({
    existingStats: {
      periodKey: "2026-06",
      monthlyNightKm: 520,
      achievementBadges: ["Gece Savascisi"],
    },
    profile: { id: "user-1", odometer: 20000, driverScore: 80, harmonyVotes: 1 },
    passport: { serviceLogCount: 0 },
    vehicle: { odometer: 20000 },
    now: new Date("2026-07-13T10:00:00.000Z"),
  });

  const nightWarrior = stats.achievements.find((entry) => entry.key === "night-warrior");
  assert.equal(stats.monthlyNightKm, 0);
  assert.equal(nightWarrior.unlocked, true);
  assert.equal(nightWarrior.percent, 100);
});
