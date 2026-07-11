import { describe, expect, it } from "vitest";
import {
  applyPartServiceToUser,
  buildVehiclePassportSummary,
  getPartHealthSnapshot,
  getUpcomingMaintenance,
} from "./vehiclePassport";

describe("vehiclePassport utils", () => {
  const basePart = {
    key: "oil",
    name: "Engine Oil",
    replacedKm: 10000,
    replacedAt: "2026-01-01",
    lifeExpectancyKm: 8000,
    lifeExpectancyMonths: 12,
  };

  it("calculates combined part health from km and date", () => {
    const snapshot = getPartHealthSnapshot(basePart, 14000, new Date("2026-07-01").getTime());
    expect(snapshot.health).toBeLessThan(100);
    expect(snapshot.kmRemaining).toBe(4000);
    expect(snapshot.status).toBe("healthy");
  });

  it("marks upcoming maintenance when health is low", () => {
    const upcoming = getUpcomingMaintenance(
      [{ ...basePart, replacedKm: 10000, replacedAt: "2025-01-01" }],
      17500,
      new Date("2026-07-01").getTime(),
    );
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].snapshot.status).toBe("critical");
  });

  it("resets the part when a service log is applied", () => {
    const nextUser = applyPartServiceToUser(
      {
        odometer: 17000,
        parts: [basePart],
        serviceLogs: [],
      },
      {
        id: "svc-1",
        partKey: "oil",
        serviceDate: "2026-07-11",
        serviceKm: 17120,
        cost: 2250,
        serviceShop: "Apex Garage",
        notes: "Fresh oil change",
      },
    );

    expect(nextUser.parts[0].replacedKm).toBe(17120);
    expect(nextUser.parts[0].replacedAt).toBe("2026-07-11");
    expect(nextUser.serviceLogs).toHaveLength(1);
  });

  it("builds a maintenance summary", () => {
    const summary = buildVehiclePassportSummary({
      odometer: 15000,
      parts: [basePart],
      serviceLogs: [{ id: "svc-1", serviceDate: "2026-07-11", cost: 2250 }],
    });

    expect(summary.totalServiceLogs).toBe(1);
    expect(summary.totalServiceSpend).toBe(2250);
    expect(summary.maintenanceScore).toBeGreaterThan(0);
  });
});
