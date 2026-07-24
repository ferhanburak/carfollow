import { describe, expect, it } from "vitest";
import {
  buildPersonalStats,
  formatDriveTime,
  rankIndividualLeaderboard,
} from "./socialStats";

describe("social stats", () => {
  it("formats verified drive time without exposing seconds", () => {
    expect(formatDriveTime(0)).toBe("0 DK");
    expect(formatDriveTime(3_900)).toBe("1 SA 5 DK");
  });

  it("adds drive duration and speed metrics without a completed-session counter", () => {
    const stats = buildPersonalStats({
      monthlyDriveSeconds: 3_900,
      monthlyMaxSpeedKmh: 128.4,
      monthlyAverageSpeedKmh: 54.6,
      serviceLogs: [],
      fuelLogs: [],
    });

    expect(stats).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "drive-time", value: "1 SA 5 DK" }),
      expect.objectContaining({ key: "max-speed", value: "128 KM/H" }),
      expect.objectContaining({ key: "average-speed", value: "55 KM/H" }),
    ]));
    expect(stats.some((stat) => stat.key === "drive-sessions")).toBe(false);
  });

  it("ranks the same drivers by the selected monthly metric", () => {
    const drivers = [
      { userId: "a", monthlyKm: 100, monthlyDriveSeconds: 2_000, monthlyMaxSpeedKmh: 120, driverScore: 80 },
      { userId: "b", monthlyKm: 80, monthlyDriveSeconds: 4_000, monthlyMaxSpeedKmh: 150, driverScore: 75 },
    ];

    expect(rankIndividualLeaderboard(drivers, "monthlyKm")[0].userId).toBe("a");
    expect(rankIndividualLeaderboard(drivers, "monthlyDriveSeconds")[0].userId).toBe("b");
    expect(rankIndividualLeaderboard(drivers, "monthlyMaxSpeedKmh")[0].userId).toBe("b");
  });
});
