const test = require("node:test");
const assert = require("node:assert/strict");
const { buildServiceLogDeletionPlan } = require("./serviceLogDeletion");

test("service log deletion recalculates passport totals", () => {
  const targetLog = { id: "svc-2", type: "repair", partKey: "oil", serviceDate: "2026-07-20", cost: 900 };
  const remaining = { id: "svc-1", type: "inspection", partKey: "oil", serviceDate: "2026-06-01", cost: 250 };
  const plan = buildServiceLogDeletionPlan({ targetLog, serviceLogs: [targetLog, remaining] });

  assert.equal(plan.passportPatch.serviceLogCount, 1);
  assert.equal(plan.passportPatch.totalServiceSpend, 250);
  assert.equal(plan.passportPatch.lastServiceDate, "2026-06-01");
  assert.equal(plan.partPatch, null);
});

test("deleting the active replacement restores the previous replacement", () => {
  const targetLog = { id: "svc-2", type: "replacement", partKey: "oil", serviceDate: "2026-07-20", serviceKm: 22000, cost: 1900 };
  const previous = { id: "svc-1", type: "replacement", partKey: "oil", serviceDate: "2026-05-10", serviceKm: 18000, cost: 1700, serviceShop: "Apex" };
  const plan = buildServiceLogDeletionPlan({
    targetLog,
    serviceLogs: [targetLog, previous],
    part: { lastServiceLogId: "svc-2", replacedKm: 22000, replacedAt: "2026-07-20" },
  });

  assert.equal(plan.rollbackMode, "previous-replacement");
  assert.equal(plan.partPatch.lastServiceLogId, "svc-1");
  assert.equal(plan.partPatch.replacedKm, 18000);
  assert.equal(plan.partPatch.replacedAt, "2026-05-10");
});

test("captured part state restores the baseline when no older replacement remains", () => {
  const targetLog = {
    id: "svc-1",
    type: "replacement",
    partKey: "oil",
    serviceDate: "2026-07-20",
    serviceKm: 22000,
    previousPartState: { replacedKm: 15000, replacedAt: "2026-01-01" },
  };
  const plan = buildServiceLogDeletionPlan({
    targetLog,
    serviceLogs: [targetLog],
    part: { lastServiceLogId: "svc-1", replacedKm: 22000, replacedAt: "2026-07-20" },
  });

  assert.equal(plan.rollbackMode, "captured-baseline");
  assert.equal(plan.partPatch.replacedKm, 15000);
  assert.equal(plan.partPatch.lastServiceLogId, null);
});
