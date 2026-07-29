export const APP_ID = 'cruiser-app-prod';

export const PUBLIC_COLLECTIONS = {
  clans: 'clans',
  clanMembers: 'clanMembers',
  clanInvites: 'clanInvites',
  clanLeaderboard: 'clanLeaderboard',
  friendships: 'friendships',
  individualLeaderboard: 'individualLeaderboard',
  mapPins: 'mapPins',
  mapLikes: 'mapLikes',
  mapSpotPhotos: 'mapSpotPhotos',
  washReviews: 'washReviews',
} as const;

export const PRIVATE_COLLECTIONS = {
  blockedUsers: 'blockedUsers',
  driverStats: 'driverStats',
  fuelLogs: 'fuelLogs',
  notifications: 'notifications',
  parts: 'parts',
  profile: 'profile',
  serviceLogs: 'serviceLogs',
  vehiclePassports: 'vehiclePassports',
  vehicles: 'vehicles',
} as const;

export function privateProfilePath(userId: string) {
  return `artifacts/${APP_ID}/users/${userId}/profile/current`;
}

export function publicCollectionPath(collectionName: string) {
  return `artifacts/${APP_ID}/public/data/${collectionName}`;
}

export function privateCollectionPath(userId: string, collectionName: string) {
  return `artifacts/${APP_ID}/users/${userId}/${collectionName}`;
}

export function privateDocumentPath(userId: string, collectionName: string, documentId: string) {
  return `${privateCollectionPath(userId, collectionName)}/${documentId}`;
}

export function realtimeRootPath() {
  return `artifacts/${APP_ID}/realtime`;
}

export function realtimeTelemetryPath() {
  return `${realtimeRootPath()}/telemetry`;
}

export function realtimePresencePath() {
  return `${realtimeRootPath()}/presence`;
}

export function realtimeDmThreadsPath() {
  return `${realtimeRootPath()}/directMessages/threads`;
}

export function realtimeDmThreadPath(threadId: string) {
  return `${realtimeDmThreadsPath()}/${threadId}`;
}

export function realtimeDmUserThreadsPath(userId: string) {
  return `${realtimeRootPath()}/directMessages/userThreads/${userId}`;
}
