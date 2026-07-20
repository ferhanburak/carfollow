import { describe, expect, it } from "vitest";
import {
  applyPartServiceToUser,
  buildVehicleHistoryReport,
  buildVehiclePassportSummary,
  formatServiceDate,
  getPartHealthSnapshot,
  getUpcomingMaintenance,
  removeServiceLogFromUser,
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
        type: "replacement",
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

  it("keeps part life unchanged for an inspection record", () => {
    const nextUser = applyPartServiceToUser(
      {
        odometer: 17000,
        parts: [basePart],
        serviceLogs: [],
      },
      {
        id: "svc-inspection-1",
        partKey: "oil",
        type: "inspection",
        serviceDate: "2026-07-11",
        serviceKm: 17120,
        cost: 350,
        serviceShop: "Apex Garage",
        notes: "Oil level checked",
      },
    );

    expect(nextUser.parts[0].replacedKm).toBe(basePart.replacedKm);
    expect(nextUser.parts[0].replacedAt).toBe(basePart.replacedAt);
    expect(nextUser.serviceLogs).toHaveLength(1);
  });

  it("removes a mistaken service record and restores the previous replacement", () => {
    const previousLog = {
      id: "svc-old",
      partKey: "oil",
      type: "replacement",
      serviceDate: "2026-05-01",
      serviceKm: 15000,
      cost: 1500,
      serviceShop: "Apex",
    };
    const mistakenLog = {
      id: "svc-wrong",
      partKey: "oil",
      type: "replacement",
      serviceDate: "2026-07-20",
      serviceKm: 25000,
      cost: 2500,
      serviceShop: "Wrong Shop",
    };
    const nextUser = removeServiceLogFromUser({
      odometer: 25000,
      parts: [{ ...basePart, replacedKm: 25000, replacedAt: "2026-07-20", lastServiceLogId: "svc-wrong" }],
      serviceLogs: [mistakenLog, previousLog],
      vehiclePassport: { serviceLogCount: 2, totalServiceSpend: 4000 },
    }, "svc-wrong");

    expect(nextUser.serviceLogs).toEqual([previousLog]);
    expect(nextUser.parts[0].lastServiceLogId).toBe("svc-old");
    expect(nextUser.parts[0].replacedKm).toBe(15000);
    expect(nextUser.vehiclePassport.serviceLogCount).toBe(1);
    expect(nextUser.vehiclePassport.totalServiceSpend).toBe(1500);
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

  it("builds a vehicle history report with documented km coverage and recent services", () => {
    const user = {
      odometer: 20000,
      parts: [
        {
          ...basePart,
          replacedKm: 18000,
          replacedAt: "2026-06-01",
        },
        {
          key: "brake",
          name: "Brake Pads",
          replacedKm: 18000,
          replacedAt: "2026-06-01",
          lifeExpectancyKm: 30000,
          lifeExpectancyMonths: 36,
        },
      ],
      fuelLogs: [{ id: "fuel-1", currentKm: 19000 }],
      serviceLogs: [
        { id: "svc-1", partKey: "oil", type: "replacement", serviceDate: "2026-07-11", serviceKm: 19500, cost: 2250 },
        { id: "svc-2", partKey: "brake", type: "inspection", serviceDate: "2026-05-11", serviceKm: 18200, cost: 450 },
      ],
      vehiclePassport: {
        serviceLogCount: 2,
        fuelLogCount: 1,
        status: "active",
      },
    };

    const summary = buildVehiclePassportSummary(user, new Date("2026-07-12").getTime());
    const report = buildVehicleHistoryReport(user, summary);

    expect(report.historyScore).toBeGreaterThan(70);
    expect(report.documentedKmCoverage).toBe(98);
    expect(report.documentedParts).toBe(1);
    expect(report.recentServiceLogs.map((log) => log.id)).toEqual(["svc-1", "svc-2"]);
    expect(report.riskFlags).toEqual([]);
  });

  it("flags vehicle history risks when coverage or integrity is weak", () => {
    const user = {
      odometer: 50000,
      parts: [{ ...basePart, replacedKm: 10000, lifeExpectancyKm: 8000 }],
      fuelLogs: [{ id: "fuel-1", currentKm: 12000 }],
      serviceLogs: [],
      vehiclePassport: {
        serviceLogCount: 3,
        fuelLogCount: 1,
        status: "active",
      },
    };

    const summary = buildVehiclePassportSummary(user, new Date("2026-07-12").getTime());
    const report = buildVehicleHistoryReport(user, summary);

    expect(report.historyScore).toBeLessThan(70);
    expect(report.riskFlags).toContain("1 critical part");
    expect(report.riskFlags).toContain("record count mismatch");
    expect(report.riskFlags).toContain("low documented KM coverage");
    expect(report.riskFlags).toContain("no service history");
  });

  it("formats hydrated Firestore timestamp values", () => {
    expect(formatServiceDate({ seconds: 1783728000, nanoseconds: 0 })).not.toBe("--");
  });
});
