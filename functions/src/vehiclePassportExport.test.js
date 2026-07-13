const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildResaleReport,
  buildVehiclePassportExportDocument,
} = require("./vehiclePassportExport");

const profile = {
  fullName: "Poyraz Alkan",
  plate: "06 PWA 101",
  primaryVehicleId: "vehicle-user-1",
  odometer: 20000,
};
const vehicle = {
  vehicleId: "vehicle-user-1",
  model: "Seat Ibiza Cupra",
  odometer: 20000,
};
const healthyParts = [
  {
    key: "engine-oil",
    name: "Engine Oil",
    replacedKm: 18000,
    replacedAt: "2026-06-01",
    lifeExpectancyKm: 10000,
    lifeExpectancyMonths: 12,
  },
  {
    key: "brake-pads",
    name: "Brake Pads",
    replacedKm: 18000,
    replacedAt: "2026-06-01",
    lifeExpectancyKm: 30000,
    lifeExpectancyMonths: 36,
  },
];
const serviceLogs = [
  {
    id: "service-1",
    partKey: "engine-oil",
    type: "replacement",
    serviceDate: "2026-07-11",
    serviceKm: 19500,
    serviceShop: "Apex Garage",
    cost: 2250,
  },
  {
    id: "service-2",
    partKey: "brake-pads",
    type: "inspection",
    serviceDate: "2026-05-11",
    serviceKm: 18200,
    serviceShop: "Apex Garage",
    cost: 450,
  },
];

test("builds a backend resale report with documented proof and no risk flags", () => {
  const report = buildResaleReport({
    profile,
    passport: { serviceLogCount: 2, fuelLogCount: 1, status: "active", transferState: "owned" },
    vehicle,
    parts: healthyParts,
    serviceLogs,
    fuelLogs: [{ id: "fuel-1", currentKm: 19000 }],
    now: new Date("2026-07-12").getTime(),
  });

  assert.equal(report.documentedKmCoverage, 98);
  assert.equal(report.documentedParts, 1);
  assert.equal(report.riskFlags.length, 0);
  assert.equal(report.recentServiceLogs[0].id, "service-1");
  assert.equal(report.recentServiceLogs[0].serviceDate, "2026-07-11");
  assert.ok(report.readinessScore > 70);
});

test("flags weak resale history and count mismatch", () => {
  const report = buildResaleReport({
    profile: { ...profile, odometer: 50000 },
    passport: { serviceLogCount: 2, fuelLogCount: 1, status: "active", transferState: "owned" },
    vehicle: { ...vehicle, odometer: 50000 },
    parts: [{ ...healthyParts[0], replacedKm: 10000, lifeExpectancyKm: 8000 }],
    serviceLogs: [],
    fuelLogs: [{ id: "fuel-1", currentKm: 12000 }],
    now: new Date("2026-07-12").getTime(),
  });

  assert.ok(report.readinessScore < 70);
  assert.deepEqual(report.riskFlags, [
    "1 critical part",
    "record count mismatch",
    "low documented KM coverage",
    "no service history",
  ]);
});

test("builds an immutable export document shape", () => {
  const generatedAt = new Date("2026-07-14T12:00:00.000Z");
  const document = buildVehiclePassportExportDocument({
    exportId: "export-1",
    userId: "user-1",
    profile,
    passport: { serviceLogCount: 2, fuelLogCount: 1, status: "active", transferState: "owned" },
    vehicle,
    parts: healthyParts,
    serviceLogs,
    fuelLogs: [{ id: "fuel-1", currentKm: 19000 }],
    generatedAt,
  });

  assert.equal(document.id, "export-1");
  assert.equal(document.userId, "user-1");
  assert.equal(document.vehicleId, "vehicle-user-1");
  assert.equal(document.generatedAt, generatedAt);
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.recentServiceLogs.length, 2);
  assert.equal(document.recentServiceLogs[0].serviceDate, "2026-07-11");
});
