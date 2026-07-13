import { describe, expect, it } from "vitest";
import {
  getDriverStatsPeriod,
  mergeDriverStatsIntoUser,
  normalizeIndividualLeaderboard,
} from "./driverStats";

describe("driver stats domain", () => {
  it("resolves the monthly period in the Istanbul timezone", () => {
    expect(getDriverStatsPeriod("2026-06-30T22:30:00.000Z")).toBe("2026-07");
  });

  it("merges authoritative stats and unlocked titles into the user", () => {
    const user = mergeDriverStatsIntoUser(
      { id: "user-1", badges: ["Yeni Uye"], monthlyKm: 10 },
      {
        monthlyKm: 24.8,
        monthlyNightKm: 8,
        lifetimeVerifiedKm: 124,
        completedSessions: 3,
        achievementBadges: ["Garaj Arsivi"],
        achievements: [{ key: "garage-keeper", unlocked: true }],
      },
    );

    expect(user.monthlyKm).toBe(24.8);
    expect(user.badges).toEqual(["Yeni Uye", "Garaj Arsivi"]);
    expect(user.driverStats.completedSessions).toBe(3);
  });

  it("filters by period, deduplicates users, and ranks in memory", () => {
    const leaderboard = normalizeIndividualLeaderboard(
      [
        { id: "old", userId: "user-1", periodKey: "2026-06", monthlyKm: 999 },
        { id: "a", userId: "user-2", periodKey: "2026-07", monthlyKm: 80, driverScore: 70 },
        { id: "b", userId: "user-3", periodKey: "2026-07", monthlyKm: 80, driverScore: 90 },
      ],
      { id: "user-1", plate: "06 TEST 01", fullName: "Test", monthlyKm: 20, driverScore: 80 },
      "2026-07",
    );

    expect(leaderboard.map((entry) => entry.userId)).toEqual(["user-3", "user-2", "user-1"]);
    expect(leaderboard.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });
});
