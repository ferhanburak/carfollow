const TRANSFER_SCHEMA_VERSION = 1;

function normalizePlate(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 12);
}

function safeString(value) {
  return String(value ?? "");
}

function buildTransferRequestDocument({
  transferId,
  ownerUserId,
  ownerProfile = {},
  targetUserId,
  targetProfile = {},
  vehicle = {},
  passport = {},
  requestedAt,
}) {
  return {
    id: transferId,
    ownerUserId,
    ownerPlate: safeString(ownerProfile.plate ?? vehicle.plate),
    ownerName: safeString(ownerProfile.fullName),
    targetUserId,
    targetPlate: safeString(targetProfile.plate),
    targetName: safeString(targetProfile.fullName),
    vehicleId: safeString(vehicle.vehicleId ?? passport.vehicleId),
    vehiclePlate: safeString(vehicle.plate ?? ownerProfile.plate),
    model: safeString(vehicle.model ?? ownerProfile.model),
    odometer: Number(vehicle.odometer ?? ownerProfile.odometer ?? 0),
    status: "pending",
    requestedAt,
    updatedAt: requestedAt,
    schemaVersion: TRANSFER_SCHEMA_VERSION,
  };
}

function buildTransferAuditEventDocument({
  eventId,
  transferId,
  action,
  actorUserId,
  actorPlate,
  ownerUserId,
  targetUserId,
  targetPlate,
  vehicleId,
  statusFrom,
  statusTo,
  note = "",
  createdAt,
}) {
  return {
    id: eventId,
    transferId,
    action,
    actorUserId,
    actorPlate: safeString(actorPlate),
    ownerUserId,
    targetUserId,
    targetPlate: safeString(targetPlate),
    vehicleId: safeString(vehicleId),
    statusFrom,
    statusTo,
    note: safeString(note).slice(0, 280),
    createdAt,
    schemaVersion: TRANSFER_SCHEMA_VERSION,
  };
}

function buildTransferNotificationDocument({ transfer, createdAt, status = "pending" }) {
  return {
    id: transfer.id,
    type: "vehicle_passport_transfer",
    status,
    ownerUserId: transfer.ownerUserId,
    ownerPlate: transfer.ownerPlate,
    ownerName: transfer.ownerName,
    targetUserId: transfer.targetUserId,
    targetPlate: transfer.targetPlate,
    vehicleId: transfer.vehicleId,
    vehiclePlate: transfer.vehiclePlate,
    model: transfer.model,
    requestedAt: transfer.requestedAt,
    createdAt,
    updatedAt: createdAt,
    schemaVersion: TRANSFER_SCHEMA_VERSION,
  };
}

module.exports = {
  TRANSFER_SCHEMA_VERSION,
  buildTransferAuditEventDocument,
  buildTransferNotificationDocument,
  buildTransferRequestDocument,
  normalizePlate,
};
