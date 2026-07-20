const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveMaintenanceLimit } = require("./maintenanceLimits");

test("canonical maintenance limits override legacy default part intervals", () => {
  assert.deepEqual(resolveMaintenanceLimit({
    key: "battery",
    lifeExpectancyKm: 50000,
    lifeExpectancyMonths: 36,
  }), {
    lifeExpectancyKm: 999999,
    lifeExpectancyDays: 1825,
    lifeExpectancyMonths: 60,
  });
});

test("vehicle-specific parts retain their configured fallback intervals", () => {
  assert.deepEqual(resolveMaintenanceLimit({
    key: "chain",
    lifeExpectancyKm: 18000,
    lifeExpectancyMonths: 18,
  }), {
    lifeExpectancyKm: 18000,
    lifeExpectancyDays: 0,
    lifeExpectancyMonths: 18,
  });
});
