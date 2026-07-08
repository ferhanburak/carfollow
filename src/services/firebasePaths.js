const FALLBACK_APP_ID = "cruiser-app-prod";

export function resolveAppId() {
  return typeof __app_id !== "undefined" ? __app_id : FALLBACK_APP_ID;
}

export function publicCollectionPath(collectionName, resolvedAppId = resolveAppId()) {
  return `/artifacts/${resolvedAppId}/public/data/${collectionName}`;
}

export function privateUserCollectionPath(userId, collectionName, resolvedAppId = resolveAppId()) {
  return `/artifacts/${resolvedAppId}/users/${userId}/${collectionName}`;
}

export function realtimeDmPath(plate) {
  return `directMessages/${plate.replaceAll(" ", "_")}`;
}
