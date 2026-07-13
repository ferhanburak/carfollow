export const USER_SCHEMA_VERSION = 1;

const PRIVATE_SUBCOLLECTION_FIELDS = new Set([
  "conversations",
  "createdAt",
  "fuelLogs",
  "parts",
  "password",
  "serviceLogs",
  "updatedAt",
]);

const PUBLIC_PROFILE_FIELDS = [
  "alertVotes",
  "avatar",
  "badges",
  "clan",
  "clanId",
  "clanRole",
  "driverScore",
  "fullName",
  "garage",
  "harmonyVotes",
  "horsepower",
  "model",
  "monthlyKm",
  "plate",
  "primaryVehicleId",
  "region",
  "tuningStage",
  "vehicleType",
];

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    if (value instanceof Date || typeof value.toDate === "function") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, item]) => key !== "password" && item !== undefined)
        .map(([key, item]) => [key, sanitizeValue(item)]),
    );
  }

  return value;
}

export function normalizePlate(plate) {
  return String(plate ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

export function buildPrivateUserProfile(user, firebaseUser) {
  const uid = firebaseUser?.uid ?? user?.firebaseUid ?? user?.id;
  const source = sanitizeValue(user ?? {});

  for (const field of PRIVATE_SUBCOLLECTION_FIELDS) {
    delete source[field];
  }

  return {
    ...source,
    id: uid,
    firebaseUid: uid,
    email: firebaseUser?.email ?? source.email ?? "",
    plate: String(source.plate ?? "").toUpperCase(),
    plateNormalized: normalizePlate(source.plate),
    schemaVersion: USER_SCHEMA_VERSION,
  };
}

export function buildPublicUserProfile(user, firebaseUser) {
  const uid = firebaseUser?.uid ?? user?.firebaseUid ?? user?.id;
  const source = sanitizeValue(user ?? {});
  const publicFields = Object.fromEntries(
    PUBLIC_PROFILE_FIELDS.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]),
  );

  return {
    ...publicFields,
    id: uid,
    userId: uid,
    firebaseUid: uid,
    plate: String(source.plate ?? "").toUpperCase(),
    plateNormalized: normalizePlate(source.plate),
    schemaVersion: USER_SCHEMA_VERSION,
  };
}

export function mergePrivateUserCollections(profile, collections = {}) {
  return {
    ...profile,
    fuelLogs: collections.fuelLogs ?? [],
    parts: collections.parts ?? [],
    serviceLogs: collections.serviceLogs ?? [],
  };
}
