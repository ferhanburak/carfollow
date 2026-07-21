const REGISTRATION_SCHEMA_VERSION = 3;
const VEHICLE_SCHEMA_VERSION = 1;
const PASSPORT_SCHEMA_VERSION = 1;
const KVKK_CONSENT_VERSION = "2026-07";
const TERMS_VERSION = "2026-07";
const PRIVACY_NOTICE_VERSION = "2026-07";
const { resolveMaintenanceLimit } = require("./maintenanceLimits");

class RegistrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RegistrationError";
    this.code = code;
  }
}

function normalizePlate(value) {
  return String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function cleanText(value, { field, min = 0, max }) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) {
    throw new RegistrationError("invalid-argument", `${field} is invalid.`);
  }
  return text;
}

function cleanNumber(value, { field, min = 0, max }) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new RegistrationError("invalid-argument", `${field} is invalid.`);
  }
  return number;
}

function normalizeIdentifier(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^0-9A-Za-z_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

function normalizePart(part, { uid, vehicleId, odometer }) {
  const key = normalizeIdentifier(part?.key, "").slice(0, 80);
  if (!key) return null;
  const replacedKm = cleanNumber(part?.replacedKm ?? odometer, {
    field: "Part replacement mileage",
    min: 0,
    max: odometer,
  });
  const replacedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(part?.replacedAt ?? ""))
    ? String(part.replacedAt)
    : new Date().toISOString().slice(0, 10);
  const maintenanceLimit = resolveMaintenanceLimit({ ...part, key });

  return {
    key,
    vehicleId,
    userId: uid,
    name: cleanText(part?.name ?? key, { field: "Part name", min: 1, max: 80 }),
    shortLabel: cleanText(part?.shortLabel ?? part?.name ?? key, {
      field: "Part label",
      min: 1,
      max: 40,
    }),
    zone: cleanText(part?.zone ?? "engine", { field: "Part zone", min: 1, max: 40 }),
    lifeExpectancyKm: cleanNumber(maintenanceLimit.lifeExpectancyKm, {
      field: "Part life expectancy",
      min: 0,
      max: 1000000,
    }),
    lifeExpectancyDays: cleanNumber(maintenanceLimit.lifeExpectancyDays, {
      field: "Part time expectancy in days",
      min: 0,
      max: 7300,
    }),
    lifeExpectancyMonths: cleanNumber(maintenanceLimit.lifeExpectancyMonths, {
      field: "Part time expectancy",
      min: 0,
      max: 240,
    }),
    replacedKm,
    replacedAt,
    schemaVersion: VEHICLE_SCHEMA_VERSION,
  };
}

function buildRegistrationBundle({
  uid,
  email,
  profile,
  acceptTerms,
  acceptPlateSearch,
  acceptKvkk,
  timestamp,
}) {
  if (!uid || !email) {
    throw new RegistrationError("unauthenticated", "A verified Firebase identity is required.");
  }
  const legacyRegistration = acceptTerms !== true && acceptKvkk === true;
  if (acceptTerms !== true && !legacyRegistration) {
    throw new RegistrationError("failed-precondition", "Terms acceptance is required.");
  }

  const fullName = cleanText(profile?.fullName, { field: "Full name", min: 2, max: 80 });
  const plate = cleanText(profile?.plate, { field: "Plate", min: 5, max: 16 }).toUpperCase();
  const plateNormalized = normalizePlate(plate);
  if (plateNormalized.length < 5 || plateNormalized.length > 12) {
    throw new RegistrationError("invalid-argument", "Plate is invalid.");
  }
  const model = cleanText(profile?.model, { field: "Vehicle model", min: 2, max: 100 });
  const garage = cleanText(profile?.garage ?? "", { field: "Garage", min: 0, max: 100 });
  const region = cleanText(profile?.region ?? "Belirtilmedi", { field: "Region", min: 2, max: 80 });
  const horsepower = cleanNumber(profile?.horsepower ?? 0, { field: "Horsepower", min: 0, max: 5000 });
  const odometer = cleanNumber(profile?.odometer, { field: "Odometer", min: 0, max: 5000000 });
  const avatar = cleanText(profile?.avatar ?? "", { field: "Avatar", min: 0, max: 2048 });
  if (!["car", "motorcycle"].includes(profile?.vehicleType)) {
    throw new RegistrationError("invalid-argument", "Vehicle type is invalid.");
  }
  const vehicleType = profile.vehicleType;
  const tuningStage = ["Stock", "Stage 1", "Stage 2+", "Stage 3"].includes(profile?.tuningStage)
    ? profile.tuningStage
    : "Stock";
  const vehicleId = `vehicle-${normalizeIdentifier(uid, "primary")}`;
  const plateSearchEnabled = acceptPlateSearch === true || legacyRegistration;
  const privacy = {
    plateSearchEnabled,
    showPlateOnLiveMap: false,
    showModelInSearch: profile?.privacy?.showModelInSearch !== false,
    showRegionInSearch: profile?.privacy?.showRegionInSearch === true,
    locationPrecision: "approximate",
    safeZoneEnabled: true,
    safeZone: null,
    kvkkConsentVersion: KVKK_CONSENT_VERSION,
  };
  const identity = {
    id: uid,
    firebaseUid: uid,
    primaryVehicleId: vehicleId,
    fullName,
    plate,
    plateNormalized,
    model,
    garage,
    region,
    tuningStage,
    vehicleType,
    horsepower,
    avatar,
    driverScore: 80,
    harmonyVotes: 1,
    alertVotes: 0,
    monthlyKm: 0,
    badges: ["Yeni Uye", "Garajda Aktif"],
    schemaVersion: REGISTRATION_SCHEMA_VERSION,
  };
  const parts = (Array.isArray(profile?.parts) ? profile.parts : [])
    .slice(0, 30)
    .map((part) => normalizePart(part, { uid, vehicleId, odometer }))
    .filter(Boolean);

  return {
    claim: {
      uid,
      vehicleId,
      plate,
      plateNormalized,
      createdAt: timestamp,
    },
    publicProfile: {
      ...identity,
      userId: uid,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    privateProfile: {
      ...identity,
      email,
      odometer,
      odometerOrigin: "user-entered",
      privacy,
      legalAcceptance: {
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: timestamp,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        privacyNoticePresentedAt: timestamp,
      },
      ...(plateSearchEnabled ? {
        privacyConsent: {
          version: KVKK_CONSENT_VERSION,
          kvkkAcceptedAt: timestamp,
          plateSearchConsent: true,
        },
      } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    vehicle: {
      id: vehicleId,
      vehicleId,
      ownerId: uid,
      isPrimary: true,
      status: "active",
      plate,
      plateNormalized,
      model,
      vehicleType,
      tuningStage,
      horsepower,
      odometer,
      odometerOrigin: "user-entered",
      garage,
      schemaVersion: VEHICLE_SCHEMA_VERSION,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    passport: {
      id: vehicleId,
      vehicleId,
      ownerId: uid,
      status: "active",
      serviceLogCount: 0,
      fuelLogCount: 0,
      totalServiceSpend: 0,
      lastMutationType: "bootstrap",
      lastMutationId: "bootstrap",
      schemaVersion: PASSPORT_SCHEMA_VERSION,
      issuedAt: timestamp,
      updatedAt: timestamp,
    },
    parts: parts.map((part) => ({
      id: `${vehicleId}--${part.key}`,
      data: { ...part, createdAt: timestamp, updatedAt: timestamp },
    })),
  };
}

module.exports = {
  KVKK_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  TERMS_VERSION,
  RegistrationError,
  buildRegistrationBundle,
  normalizePlate,
};
