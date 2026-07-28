export const APP_ID = 'cruiser-app-prod';

export function privateProfilePath(userId: string) {
  return `artifacts/${APP_ID}/users/${userId}/profile/current`;
}

export function publicCollectionPath(collectionName: string) {
  return `artifacts/${APP_ID}/public/data/${collectionName}`;
}
