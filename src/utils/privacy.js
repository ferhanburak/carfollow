export const DEFAULT_PRIVACY_SETTINGS = Object.freeze({
  plateSearchEnabled: false,
  showPlateOnLiveMap: false,
  showModelInSearch: true,
  showRegionInSearch: false,
  locationPrecision: "approximate",
  safeZoneEnabled: true,
  safeZone: null,
  kvkkConsentVersion: "2026-07",
});

function normalizeCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function normalizeSafeZone(value) {
  const lat = normalizeCoordinate(value?.lat, -90, 90);
  const lng = normalizeCoordinate(value?.lng, -180, 180);
  const radiusM = Number(value?.radiusM);
  if (lat === null || lng === null || !Number.isFinite(radiusM)) return null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    radiusM: Math.round(Math.min(2000, Math.max(100, radiusM))),
  };
}

export function getDistanceMeters(left, right) {
  const leftLat = normalizeCoordinate(left?.lat, -90, 90);
  const leftLng = normalizeCoordinate(left?.lng, -180, 180);
  const rightLat = normalizeCoordinate(right?.lat, -90, 90);
  const rightLng = normalizeCoordinate(right?.lng, -180, 180);
  if ([leftLat, leftLng, rightLat, rightLng].includes(null)) return Number.POSITIVE_INFINITY;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(rightLat - leftLat);
  const longitudeDelta = radians(rightLng - leftLng);
  const startLatitude = radians(leftLat);
  const endLatitude = radians(rightLat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

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
    safeZone: normalizeSafeZone(value.safeZone),
    locationPrecision,
    plateSearchEnabled: value.plateSearchEnabled === true,
    showPlateOnLiveMap: value.showPlateOnLiveMap === true,
    showModelInSearch: value.showModelInSearch !== false,
    showRegionInSearch: value.showRegionInSearch === true,
    safeZoneEnabled: value.safeZoneEnabled !== false,
  };
}

export function projectTelemetryLocation(location, privacyValue = {}) {
  const privacy = normalizePrivacySettings(privacyValue);
  const lat = normalizeCoordinate(location?.lat, -90, 90);
  const lng = normalizeCoordinate(location?.lng, -180, 180);
  if (lat === null || lng === null || privacy.locationPrecision === "hidden") {
    return { locationVisibility: "hidden", safeZoneActive: false };
  }
  if (
    privacy.safeZoneEnabled &&
    privacy.safeZone &&
    getDistanceMeters({ lat, lng }, privacy.safeZone) <= privacy.safeZone.radiusM
  ) {
    return { locationVisibility: "safe-zone", safeZoneActive: true };
  }
  if (privacy.locationPrecision === "approximate") {
    return {
      lat: Number(lat.toFixed(2)),
      lng: Number(lng.toFixed(2)),
      locationVisibility: "approximate",
      safeZoneActive: false,
    };
  }
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    locationVisibility: "exact",
    safeZoneActive: false,
  };
}

export function buildPrivacyAwareTelemetry(driver, privacyValue = {}) {
  const privacy = normalizePrivacySettings(privacyValue);
  const { location: _location, lat: _lat, lng: _lng, safeZone: _safeZone, ...safeDriver } = driver ?? {};
  const location = driver?.active
    ? projectTelemetryLocation(driver?.location ?? driver, privacy)
    : { locationVisibility: "inactive", safeZoneActive: false };
  return {
    ...safeDriver,
    plate: privacy.showPlateOnLiveMap ? String(driver?.plate ?? "") : maskPlate(driver?.plate),
    ...location,
  };
}
