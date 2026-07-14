const FALLBACK_APP_ID = "cruiser-app-prod";

export const PUBLIC_COLLECTIONS = Object.freeze({
  clans: "clans",
  clanMembers: "clanMembers",
  clanInvites: "clanInvites",
  convoyMembers: "convoyMembers",
  convoys: "convoys",
  cruiseAttendees: "cruiseAttendees",
  drivers: "drivers",
  individualLeaderboard: "individualLeaderboard",
  friendships: "friendships",
  mapPins: "mapPins",
  mapLikes: "mapLikes",
  mapSpotPhotos: "mapSpotPhotos",
  plateClaims: "plateClaims",
  publicProfiles: "publicProfiles",
  washReviews: "washReviews",
});

export const PRIVATE_COLLECTIONS = Object.freeze({
  blockedUsers: "blockedUsers",
  driverStats: "driverStats",
  driveSessions: "driveSessions",
  fuelLogs: "fuelLogs",
  notifications: "notifications",
  parts: "parts",
  profile: "profile",
  serviceLogs: "serviceLogs",
  vehiclePassportExports: "vehiclePassportExports",
  vehiclePassports: "vehiclePassports",
  vehicles: "vehicles",
});

export function resolveAppId() {
  return typeof __app_id !== "undefined" ? __app_id : FALLBACK_APP_ID;
}

export function publicCollectionPath(collectionName, resolvedAppId = resolveAppId()) {
  return `/artifacts/${resolvedAppId}/public/data/${collectionName}`;
}

export function privateUserCollectionPath(userId, collectionName, resolvedAppId = resolveAppId()) {
  return `/artifacts/${resolvedAppId}/users/${userId}/${collectionName}`;
}

export function publicDocumentPath(collectionName, documentId, resolvedAppId = resolveAppId()) {
  return `${publicCollectionPath(collectionName, resolvedAppId)}/${documentId}`;
}

export function privateUserDocumentPath(
  userId,
  collectionName,
  documentId,
  resolvedAppId = resolveAppId(),
) {
  return `${privateUserCollectionPath(userId, collectionName, resolvedAppId)}/${documentId}`;
}

export function realtimeDmPath(plate) {
  return `directMessages/${plate.replaceAll(" ", "_")}`;
}

export function realtimeDmThreadsPath(resolvedAppId = resolveAppId()) {
  return `artifacts/${resolvedAppId}/realtime/directMessages/threads`;
}

export function realtimeDmThreadPath(threadId, resolvedAppId = resolveAppId()) {
  return `${realtimeDmThreadsPath(resolvedAppId)}/${threadId}`;
}

export function realtimeDmThreadTypingPath(threadId, resolvedAppId = resolveAppId()) {
  return `${realtimeDmThreadPath(threadId, resolvedAppId)}/typing`;
}

export function realtimeDmUserThreadsPath(userId, resolvedAppId = resolveAppId()) {
  return `artifacts/${resolvedAppId}/realtime/directMessages/userThreads/${userId}`;
}

export function realtimePresencePath(resolvedAppId = resolveAppId()) {
  return `artifacts/${resolvedAppId}/realtime/presence`;
}

export function realtimePresencePlatePath(plate, resolvedAppId = resolveAppId()) {
  return `${realtimePresencePath(resolvedAppId)}/${plate.replaceAll(" ", "_")}`;
}

export function realtimePresenceUserPath(userId, resolvedAppId = resolveAppId()) {
  return `${realtimePresencePath(resolvedAppId)}/${userId}`;
}

export function realtimeTelemetryPath(resolvedAppId = resolveAppId()) {
  return `artifacts/${resolvedAppId}/realtime/telemetry`;
}

export function realtimeTelemetryUserPath(userId, resolvedAppId = resolveAppId()) {
  return `${realtimeTelemetryPath(resolvedAppId)}/${userId}`;
}
