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

function buildRealtimeAccountDeletionUpdates({ appId, userId, threads = [] }) {
  const root = `artifacts/${appId}/realtime`;
  const updates = {
    [`${root}/presence/${userId}`]: null,
    [`${root}/telemetry/${userId}`]: null,
    [`${root}/directMessages/userThreads/${userId}`]: null,
  };

  for (const { threadId, participantIds = [] } of threads) {
    updates[`${root}/directMessages/threads/${threadId}`] = null;
    for (const participantId of participantIds) {
      // The user's parent index is already deleted above; adding a child path
      // to the same multi-location update would make Realtime Database reject it.
      if (participantId && participantId !== userId) {
        updates[`${root}/directMessages/userThreads/${participantId}/${threadId}`] = null;
      }
    }
  }

  return updates;
}

module.exports = {
  ACCOUNT_DELETE_CONFIRMATION,
  ACCOUNT_EXPORT_VERSION,
  RECENT_LOGIN_MAX_AGE_SECONDS,
  buildAccountExport,
  buildRealtimeAccountDeletionUpdates,
  buildWithdrawnPrivacySettings,
  hasRecentAuthentication,
  requireDeletionConfirmation,
};
