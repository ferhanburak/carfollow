export const DEFAULT_PRIVACY_SETTINGS = Object.freeze({
  plateSearchEnabled: false,
  showModelInSearch: true,
  showRegionInSearch: false,
  locationPrecision: "approximate",
  safeZoneEnabled: true,
  kvkkConsentVersion: "2026-07",
});

export function normalizePlateForSearch(value) {
  return String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function maskPlate(value) {
  const normalized = normalizePlateForSearch(value);
  if (normalized.length < 5) return "•• ••• ••";
  const prefix = normalized.slice(0, Math.min(2, normalized.length - 3));
  const suffix = normalized.slice(-2);
  return `${prefix} ••• ${suffix}`;
}

export function normalizePrivacySettings(value = {}) {
  const locationPrecision = ["hidden", "approximate", "exact"].includes(value.locationPrecision)
    ? value.locationPrecision
    : DEFAULT_PRIVACY_SETTINGS.locationPrecision;

  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...value,
    locationPrecision,
    plateSearchEnabled: value.plateSearchEnabled === true,
    showModelInSearch: value.showModelInSearch !== false,
    showRegionInSearch: value.showRegionInSearch === true,
    safeZoneEnabled: value.safeZoneEnabled !== false,
  };
}
