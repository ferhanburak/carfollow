const ACCOUNT_EXPORT_VERSION = 1;
const ACCOUNT_DELETE_CONFIRMATION = "DELETE MY CRUISER ACCOUNT";
const RECENT_LOGIN_MAX_AGE_SECONDS = 10 * 60;

function requireDeletionConfirmation(value) {
  if (String(value ?? "").trim() !== ACCOUNT_DELETE_CONFIRMATION) {
    throw new Error("Account deletion confirmation does not match.");
  }
}

function hasRecentAuthentication(authTimeSeconds, nowMs = Date.now()) {
  const authTime = Number(authTimeSeconds);
  if (!Number.isFinite(authTime) || authTime <= 0) return false;
  const ageSeconds = Math.max(0, Math.floor(nowMs / 1000) - authTime);
  return ageSeconds <= RECENT_LOGIN_MAX_AGE_SECONDS;
}

function buildWithdrawnPrivacySettings(current = {}) {
  return {
    ...current,
    plateSearchEnabled: false,
    showPlateOnLiveMap: false,
    showModelInSearch: false,
    showRegionInSearch: false,
    locationPrecision: "hidden",
    safeZoneEnabled: false,
    safeZone: null,
  };
}

function buildAccountExport({ userId, profile, collections, social, exportedAt }) {
  return {
    exportVersion: ACCOUNT_EXPORT_VERSION,
    appId: "cruiser-app-prod",
    userId,
    exportedAt,
    profile: profile ?? null,
    collections: collections ?? {},
    social: social ?? {},
  };
}

module.exports = {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_EXPORT_VERSION,
  RECENT_LOGIN_MAX_AGE_SECONDS,
  buildAccountExport,
  buildWithdrawnPrivacySettings,
  hasRecentAuthentication,
  requireDeletionConfirmation,
};
