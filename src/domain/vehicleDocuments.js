import { normalizePlate } from "./userDocuments";
import { normalizeVehicleParts } from "../utils/vehicleParts";

export const VEHICLE_SCHEMA_VERSION = 1;
export const VEHICLE_PASSPORT_SCHEMA_VERSION = 1;

const VEHICLE_USER_FIELDS = [
  "garage",
  "horsepower",
  "model",
  "odometer",
  "plate",
  "tuningStage",
  "vehicleType",
];

function normalizeIdentifier(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^0-9A-Za-z_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

  return normalized || fallback;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function optionalStringFields(source, fieldNames) {
  return Object.fromEntries(
    fieldNames
      .filter((field) => source?.[field] !== undefined && source?.[field] !== null)
      .map((field) => [field, String(source[field])]),
  );
}

export function resolvePrimaryVehicleId(user, ownerId = user?.firebaseUid ?? user?.id) {
  const ownerKey = normalizeIdentifier(ownerId, "primary");
  return normalizeIdentifier(user?.primaryVehicleId, `vehicle-${ownerKey}`);
}

export function vehiclePartDocumentId(vehicleId, partKey) {
  return `${normalizeIdentifier(vehicleId, "vehicle-primary")}--${normalizeIdentifier(partKey, "part")}`;
}

export function buildVehicleDocument(user, ownerId = user?.firebaseUid ?? user?.id) {
  const vehicleId = resolvePrimaryVehicleId(user, ownerId);

  return {
    id: vehicleId,
    vehicleId,
    ownerId,
    isPrimary: true,
    status: "active",
    plate: String(user?.plate ?? "").toUpperCase(),
    plateNormalized: normalizePlate(user?.plate),
    model: String(user?.model ?? ""),
    vehicleType: user?.vehicleType === "motorcycle" ? "motorcycle" : "car",
    tuningStage: String(user?.tuningStage ?? "Stock"),
    horsepower: numberOrZero(user?.horsepower),
    odometer: numberOrZero(user?.odometer),
    garage: String(user?.garage ?? ""),
    schemaVersion: VEHICLE_SCHEMA_VERSION,
  };
}

export function buildVehicleProfilePatch(user) {
  return {
    garage: String(user?.garage ?? ""),
    horsepower: numberOrZero(user?.horsepower),
    model: String(user?.model ?? ""),
    tuningStage: String(user?.tuningStage ?? "Stock"),
    vehicleType: user?.vehicleType === "motorcycle" ? "motorcycle" : "car",
    schemaVersion: VEHICLE_SCHEMA_VERSION,
  };
}

export function buildVehiclePassportDocument(user, ownerId = user?.firebaseUid ?? user?.id) {
  const vehicleId = resolvePrimaryVehicleId(user, ownerId);
  const serviceLogs = user?.serviceLogs ?? [];
  const fuelLogs = user?.fuelLogs ?? [];

  return {
    id: vehicleId,
    vehicleId,
    ownerId,
    status: "active",
    serviceLogCount: serviceLogs.length,
    fuelLogCount: fuelLogs.length,
    totalServiceSpend: serviceLogs.reduce((sum, log) => sum + numberOrZero(log?.cost), 0),
    lastMutationType: "bootstrap",
    lastMutationId: "bootstrap",
    schemaVersion: VEHICLE_PASSPORT_SCHEMA_VERSION,
  };
}

export function buildVehiclePartDocument(part, ownerId, vehicleId) {
  return {
    key: String(part?.key ?? ""),
    vehicleId,
    userId: ownerId,
    name: String(part?.name ?? part?.key ?? "Part"),
    shortLabel: String(part?.shortLabel ?? part?.name ?? part?.key ?? "Part"),
    zone: String(part?.zone ?? "engine"),
    lifeExpectancyKm: numberOrZero(part?.lifeExpectancyKm ?? part?.lifeExpectancy),
    lifeExpectancyDays: numberOrZero(part?.lifeExpectancyDays ?? Number(part?.lifeExpectancyMonths ?? 0) * 30),
    lifeExpectancyMonths: numberOrZero(part?.lifeExpectancyMonths),
    replacedKm: numberOrZero(part?.replacedKm),
    replacedAt: String(part?.replacedAt ?? new Date().toISOString().slice(0, 10)),
    ...optionalStringFields(part, ["lastServiceLogId", "lastServiceShop", "notes"]),
    ...(part?.lastServiceCost !== undefined
      ? { lastServiceCost: numberOrZero(part.lastServiceCost) }
      : {}),
    schemaVersion: VEHICLE_SCHEMA_VERSION,
  };
}

export function scopeVehicleRecords(records, vehicleId) {
  return (records ?? []).filter((record) => !record?.vehicleId || record.vehicleId === vehicleId);
}

export function dedupeVehicleParts(parts, vehicleId) {
  const matchingParts = scopeVehicleRecords(parts, vehicleId).sort((left, right) => {
    const leftPriority = left.vehicleId === vehicleId ? 1 : 0;
    const rightPriority = right.vehicleId === vehicleId ? 1 : 0;
    return leftPriority - rightPriority;
  });

  return [...new Map(matchingParts.map((part) => [part.key, part])).values()];
}

export function mergeVehiclePassportBundle(profile, bundle = {}) {
  const ownerId = profile?.firebaseUid ?? profile?.id;
  const vehicleId = bundle.vehicle?.vehicleId ?? resolvePrimaryVehicleId(profile, ownerId);
  const vehicleFields = Object.fromEntries(
    VEHICLE_USER_FIELDS.filter((field) => bundle.vehicle?.[field] !== undefined).map((field) => [field, bundle.vehicle[field]]),
  );
  const vehicleType = vehicleFields.vehicleType ?? profile?.vehicleType ?? "car";

  return {
    ...profile,
    ...vehicleFields,
    primaryVehicleId: vehicleId,
    vehiclePassport: bundle.passport ?? profile?.vehiclePassport ?? null,
    fuelLogs: scopeVehicleRecords(bundle.fuelLogs ?? profile?.fuelLogs ?? [], vehicleId),
    parts: normalizeVehicleParts(
      dedupeVehicleParts(bundle.parts ?? profile?.parts ?? [], vehicleId),
      vehicleType,
    ),
    serviceLogs: scopeVehicleRecords(bundle.serviceLogs ?? profile?.serviceLogs ?? [], vehicleId),
  };
}
