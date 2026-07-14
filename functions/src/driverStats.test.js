const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyCompletedDriveToClan,
  applyCompletedDriveToStats,
  buildAchievementProgress,
  buildDriverStatsDocument,
  buildPartLifeSnapshot,
  calculateAcceptedDriveKm,
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
    },
    member: { clanId: "clan-1", monthlyKmPeriod: "2026-06", monthlyKm: 240 },
    acceptedKm: 5.2,
    periodKey: "2026-07",
  });

  assert.equal(aggregate.clanPatch.monthlyKm, 5.2);
  assert.equal(aggregate.clanPatch.km, 5.2);
  assert.equal(aggregate.memberPatch.monthlyKm, 5.2);
  assert.equal(aggregate.leaderboardEntry.id, "2026-07__clan-1");
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
    acceptedKm: 5.2,
    rejectedKm: 14.8,
    elapsedSeconds: 10,
  });
});

test("resets monthly counters when the period changes", () => {
  const stats = buildDriverStatsDocument({
    existingStats: {
      periodKey: "2026-06",
      monthlyKm: 900,
      monthlyNightKm: 600,
      lifetimeVerifiedKm: 1200,
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
  assert.equal(stats.lifetimeVerifiedKm, 1200);
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
    isNight: true,
    now: new Date("2026-07-13T21:00:00.000Z"),
  });

  assert.equal(stats.monthlyKm, 125.2);
  assert.equal(stats.monthlyNightKm, 45.2);
  assert.equal(stats.lifetimeVerifiedKm, 605.2);
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
