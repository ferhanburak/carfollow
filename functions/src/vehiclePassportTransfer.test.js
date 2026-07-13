const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTransferAuditEventDocument,
  buildTransferNotificationDocument,
  buildTransferRequestDocument,
  normalizePlate,
} = require("./vehiclePassportTransfer");

test("normalizes transfer target plates for claim lookup", () => {
  assert.equal(normalizePlate("34 moto 410"), "34MOTO410");
  assert.equal(normalizePlate(" 06-PWA-101 "), "06PWA101");
});

test("builds a pending ownership transfer request document", () => {
  const requestedAt = new Date("2026-07-14T10:00:00.000Z");
  const transfer = buildTransferRequestDocument({
    transferId: "transfer-1",
    ownerUserId: "owner-1",
    ownerProfile: { plate: "06 PWA 101", fullName: "Poyraz Alkan", odometer: 68000 },
    targetUserId: "target-1",
    targetProfile: { plate: "34 MOTO 410", fullName: "Derin Sari" },
    vehicle: { vehicleId: "vehicle-1", plate: "06 PWA 101", model: "Seat Ibiza", odometer: 68200 },
    passport: { vehicleId: "vehicle-1" },
    requestedAt,
  });

  assert.equal(transfer.status, "pending");
  assert.equal(transfer.vehicleId, "vehicle-1");
  assert.equal(transfer.targetPlate, "34 MOTO 410");
  assert.equal(transfer.requestedAt, requestedAt);
  assert.equal(transfer.schemaVersion, 1);
});

test("builds audit and notification documents for transfer timeline", () => {
  const createdAt = new Date("2026-07-14T10:00:00.000Z");
  const transfer = {
    id: "transfer-1",
    ownerUserId: "owner-1",
    ownerPlate: "06 PWA 101",
    ownerName: "Poyraz Alkan",
    targetUserId: "target-1",
    targetPlate: "34 MOTO 410",
    vehicleId: "vehicle-1",
    vehiclePlate: "06 PWA 101",
    model: "Seat Ibiza",
    requestedAt: createdAt,
  };
  const audit = buildTransferAuditEventDocument({
    eventId: "event-1",
    transferId: transfer.id,
    action: "requested",
    actorUserId: "owner-1",
    actorPlate: "06 PWA 101",
    ownerUserId: "owner-1",
    targetUserId: "target-1",
    targetPlate: "34 MOTO 410",
    vehicleId: "vehicle-1",
    statusFrom: "owned",
    statusTo: "transfer_requested",
    createdAt,
  });
  const notification = buildTransferNotificationDocument({ transfer, createdAt });

  assert.equal(audit.action, "requested");
  assert.equal(audit.statusTo, "transfer_requested");
  assert.equal(notification.type, "vehicle_passport_transfer");
  assert.equal(notification.status, "pending");
});
