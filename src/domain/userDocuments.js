export const USER_SCHEMA_VERSION = 2;

const PRIVATE_SUBCOLLECTION_FIELDS = new Set([
  "blockedDrivers",
  "conversations",
  "createdAt",
  "fuelLogs",
  "friends",
  "incomingRequests",
  "outgoingRequests",
  "parts",
  "password",
  "serviceLogs",
  "updatedAt",
  "vehiclePassport",
  "vehicles",
]);

const SERVER_OWNED_PROFILE_FIELDS = new Set([
  "achievementBadges",
  "achievementProgress",
  "badges",
  "completedDriveSessions",
  "driverStats",
  "driverStatsUpdatedAt",
  "lifetimeVerifiedKm",
  "monthlyKm",
  "monthlyKmPeriod",
  "monthlyNightKm",
  "odometer",
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

function omitServerOwnedFields(document) {
  const patch = { ...document };
  for (const field of SERVER_OWNED_PROFILE_FIELDS) {
    delete patch[field];
  }
  return patch;
}

export function buildPrivateUserProfilePatch(user, firebaseUser) {
  return omitServerOwnedFields(buildPrivateUserProfile(user, firebaseUser));
}

export function buildPublicUserProfilePatch(user, firebaseUser) {
  return omitServerOwnedFields(buildPublicUserProfile(user, firebaseUser));
}

export function mergePrivateUserCollections(profile, collections = {}) {
  return {
    ...profile,
    fuelLogs: collections.fuelLogs ?? [],
    parts: collections.parts ?? [],
    serviceLogs: collections.serviceLogs ?? [],
  };
}
