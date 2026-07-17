import { createRequire } from "node:module";
import path from "node:path";

const PROJECT_ID = "carfollow-75750";
const APP_ID = "cruiser-app-prod";
const STORAGE_BUCKET = "carfollow-75750.firebasestorage.app";
const runId = process.argv.find((value) => value.startsWith("--run-id="))?.split("=")[1] ?? "";
const execute = process.argv.includes("--execute");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10) ?? "";
const expectedConfirmation = `DELETE-POSTMAN-E2E-${runId}`;
const publicRoot = `artifacts/${APP_ID}/public/data`;
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

if (!/^\d{10,20}$/.test(runId)) {
  throw new Error("A numeric Postman run id is required: --run-id=1234567890123");
}

function getFirebaseCliAuth() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is required to locate the Firebase CLI session.");
  return require(path.join(appData, "npm", "node_modules", "firebase-tools", "lib", "auth.js"));
}

async function getAccessToken() {
  const cliAuth = getFirebaseCliAuth();
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error("Run firebase login --reauth first.");
  const token = await cliAuth.getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ]);
  if (!token?.access_token) throw new Error("Firebase CLI did not return an access token.");
  return token.access_token;
}

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok && response.status !== 404) {
    throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return { status: response.status, body };
}

function decodeValue(value = {}) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue);
  if (value.mapValue) return decodeFields(value.mapValue.fields ?? {});
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function encodeValue(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: String(value) };
}

function documentId(document) {
  return document.name.split("/").at(-1);
}

async function listDocuments(collectionPath, token) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const { body } = await requestJson(`${firestoreBase}/${collectionPath}?${query}`, token);
    documents.push(...(body.documents ?? []).map((document) => ({
      ...document,
      id: documentId(document),
      data: decodeFields(document.fields),
    })));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return documents;
}

async function getDocument(documentPath, token) {
  const response = await requestJson(`${firestoreBase}/${documentPath}`, token);
  if (response.status === 404) return null;
  return { ...response.body, id: documentId(response.body), data: decodeFields(response.body.fields) };
}

async function patchDocument(documentPath, patch, token) {
  const query = new URLSearchParams();
  Object.keys(patch).forEach((field) => query.append("updateMask.fieldPaths", field));
  await requestJson(`${firestoreBase}/${documentPath}?${query}`, token, {
    method: "PATCH",
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, encodeValue(value)])) }),
  });
}

async function deleteDocuments(documents, token) {
  const names = [...new Set(documents.map((document) => document.name))];
  for (let index = 0; index < names.length; index += 400) {
    await requestJson(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
      token,
      { method: "POST", body: JSON.stringify({ writes: names.slice(index, index + 400).map((name) => ({ delete: name })) }) },
    );
  }
}

async function listStorageObjects(prefix, token) {
  const objects = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ prefix });
    if (pageToken) query.set("pageToken", pageToken);
    const { body } = await requestJson(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(STORAGE_BUCKET)}/o?${query}`,
      token,
    );
    objects.push(...(body.items ?? []));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return objects;
}

async function deleteStorageObjects(objects, token) {
  for (const object of objects) {
    await requestJson(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(STORAGE_BUCKET)}/o/${encodeURIComponent(object.name)}`,
      token,
      { method: "DELETE" },
    );
  }
}

async function rollbackRatings(ratings, token) {
  const deltasByUser = new Map();
  for (const rating of ratings) {
    const current = deltasByUser.get(rating.data.targetUserId) ?? { score: 0, harmony: 0, alert: 0 };
    current.score += Number(rating.data.scoreDeltaApplied ?? 0);
    current.harmony += Number(rating.data.harmonyDelta ?? 0);
    current.alert += Number(rating.data.alertDelta ?? 0);
    deltasByUser.set(rating.data.targetUserId, current);
  }
  for (const [userId, delta] of deltasByUser) {
    const privatePath = `artifacts/${APP_ID}/users/${userId}/profile/current`;
    const publicPath = `${publicRoot}/publicProfiles/${userId}`;
    const profile = await getDocument(privatePath, token);
    if (!profile) continue;
    const patch = {
      driverScore: Math.max(0, Math.min(100, Number(profile.data.driverScore ?? 0) - delta.score)),
      harmonyVotes: Math.max(0, Number(profile.data.harmonyVotes ?? 0) - delta.harmony),
      alertVotes: Math.max(0, Number(profile.data.alertVotes ?? 0) - delta.alert),
    };
    await patchDocument(privatePath, patch, token);
    if (await getDocument(publicPath, token)) await patchDocument(publicPath, patch, token);
  }
}

async function main() {
  const token = await getAccessToken();
  const collectionNames = [
    "mapPins", "mapSpotPhotos", "mapLikes", "washReviews",
    "convoys", "convoyMembers", "convoyRatings",
  ];
  const entries = Object.fromEntries(await Promise.all(collectionNames.map(async (name) => [
    name,
    await listDocuments(`${publicRoot}/${name}`, token),
  ])));
  const rootNames = new Set([
    `POSTMAN E2E SPOT ${runId}`,
    `POSTMAN E2E WASH ${runId}`,
  ]);
  const pins = entries.mapPins.filter((document) => rootNames.has(document.data.name));
  const convoys = entries.convoys.filter((document) =>
    [`POSTMAN E2E PUBLIC CONVOY ${runId}`, `POSTMAN E2E FRIENDS CONVOY ${runId}`].includes(document.data.name),
  );
  const pinIds = new Set(pins.map((document) => document.id));
  const convoyIds = new Set(convoys.map((document) => document.id));
  const related = [
    ...entries.mapSpotPhotos.filter((document) => pinIds.has(document.data.pinId)),
    ...entries.mapLikes.filter((document) => pinIds.has(document.data.pinId)),
    ...entries.washReviews.filter((document) => pinIds.has(document.data.pinId)),
    ...entries.convoyMembers.filter((document) => convoyIds.has(document.data.convoyId)),
    ...entries.convoyRatings.filter((document) => convoyIds.has(document.data.convoyId)),
  ];
  const ratings = entries.convoyRatings.filter((document) => convoyIds.has(document.data.convoyId));
  const participantIds = new Set([
    ...entries.convoyMembers.filter((document) => convoyIds.has(document.data.convoyId)).map((document) => document.data.userId),
  ].filter(Boolean));
  const notifications = [];
  for (const userId of participantIds) {
    const userNotifications = await listDocuments(`artifacts/${APP_ID}/users/${userId}/notifications`, token);
    notifications.push(...userNotifications.filter((document) => convoyIds.has(document.data.action?.targetId)));
  }
  const storageObjects = (await Promise.all([...pinIds].map((pinId) =>
    listStorageObjects(`artifacts/${APP_ID}/mapNodes/${pinId}/`, token),
  ))).flat();
  const documentsToDelete = [...pins, ...convoys, ...related, ...notifications];
  const report = {
    mode: execute ? "execute" : "dry-run",
    projectId: PROJECT_ID,
    runId,
    roots: { pinIds: [...pinIds], convoyIds: [...convoyIds] },
    firestoreDeleteCount: new Set(documentsToDelete.map((document) => document.name)).size,
    storageDeleteCount: storageObjects.length,
    ratingRollbackCount: ratings.length,
    confirmationRequired: expectedConfirmation,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!execute) return;
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Execution guard failed. Use --confirm=${expectedConfirmation}`);
  }
  if (pins.length !== 2 || convoys.length !== 2) {
    throw new Error(`Expected exactly 2 pins and 2 convoys for this run, found ${pins.length} and ${convoys.length}.`);
  }
  await rollbackRatings(ratings, token);
  await deleteStorageObjects(storageObjects, token);
  await deleteDocuments(documentsToDelete, token);
  console.log(JSON.stringify({ completed: true, runId, deletedDocuments: report.firestoreDeleteCount }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
