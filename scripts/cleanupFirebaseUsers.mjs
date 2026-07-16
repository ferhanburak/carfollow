import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT_ID = "carfollow-75750";
const APP_ID = "cruiser-app-prod";
const DATABASE_URL = "https://carfollow-75750-default-rtdb.firebaseio.com";
const STORAGE_BUCKET = "carfollow-75750.firebasestorage.app";
const KEEP_EMAILS = new Set([
  "ferhanburakbjk@gmail.com",
  "ferhanburak@gmail.com",
]);
const EXECUTE = process.argv.includes("--execute");
const CONFIRMATION = process.argv.find((value) => value.startsWith("--confirm="))?.split("=")[1] ?? "";
const EXPECTED_CONFIRMATION = "DELETE-16-USERS";
const FIRESTORE_ROOT = `artifacts/${APP_ID}`;
const PUBLIC_DATA_MARKER = `/artifacts/${APP_ID}/public/data/`;
const USER_DATA_MARKER = `/artifacts/${APP_ID}/users/`;

function getFirebaseCliAuth() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is required to locate the Firebase CLI session.");
  const authPath = path.join(appData, "npm", "node_modules", "firebase-tools", "lib", "auth.js");
  return require(authPath);
}

async function getAccessToken() {
  const cliAuth = getFirebaseCliAuth();
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Firebase CLI login is required. Run firebase login --reauth first.");
  }
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
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function listAuthUsers(token) {
  const users = [];
  let nextPageToken = "";
  do {
    const query = new URLSearchParams({ maxResults: "1000" });
    if (nextPageToken) query.set("nextPageToken", nextPageToken);
    const response = await requestJson(
      `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?${query}`,
      token,
    );
    users.push(...(response.users ?? []));
    nextPageToken = response.nextPageToken ?? "";
  } while (nextPageToken);
  return users;
}

const firestoreBase = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const encodeDocumentPath = (value) => value.split("/").map(encodeURIComponent).join("/");

async function listCollectionIds(parentPath, token) {
  const ids = [];
  let pageToken = "";
  do {
    const body = { pageSize: 1000 };
    if (pageToken) body.pageToken = pageToken;
    const response = await requestJson(
      `${firestoreBase}/${encodeDocumentPath(parentPath)}:listCollectionIds`,
      token,
      { method: "POST", body: JSON.stringify(body) },
    );
    ids.push(...(response.collectionIds ?? []));
    pageToken = response.nextPageToken ?? "";
  } while (pageToken);
  return ids;
}

async function listDocuments(parentPath, collectionId, token) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "1000", showMissing: "true" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await requestJson(
      `${firestoreBase}/${encodeDocumentPath(parentPath)}/${encodeURIComponent(collectionId)}?${query}`,
      token,
    );
    documents.push(...(response.documents ?? []));
    pageToken = response.nextPageToken ?? "";
  } while (pageToken);
  return documents;
}

function relativeDocumentPath(documentName) {
  return documentName.split("/documents/")[1] ?? "";
}

async function scanFirestore(parentPath, token, output = []) {
  const collectionIds = await listCollectionIds(parentPath, token);
  for (const collectionId of collectionIds) {
    const documents = await listDocuments(parentPath, collectionId, token);
    for (const document of documents) {
      const documentPath = relativeDocumentPath(document.name);
      if (document.fields) output.push(document);
      // CRUISER stores documents directly below public/private subcollections.
      // Only the synthetic `public/data` and `users/{uid}` parents can have children.
      if (documentPath.split("/").length <= 4) await scanFirestore(documentPath, token, output);
    }
  }
  return output;
}

function collectFirestoreStrings(value, output = new Set()) {
  if (!value || typeof value !== "object") return output;
  if (typeof value.stringValue === "string") output.add(value.stringValue);
  if (typeof value.referenceValue === "string") output.add(value.referenceValue);
  for (const item of value.arrayValue?.values ?? []) collectFirestoreStrings(item, output);
  for (const item of Object.values(value.mapValue?.fields ?? {})) collectFirestoreStrings(item, output);
  return output;
}

function documentStrings(document) {
  const values = new Set();
  for (const value of Object.values(document.fields ?? {})) collectFirestoreStrings(value, values);
  return values;
}

function fieldString(document, field) {
  return document.fields?.[field]?.stringValue ?? "";
}

function documentId(document) {
  return relativeDocumentPath(document.name).split("/").at(-1) ?? "";
}

function publicCollectionId(document) {
  const pathValue = `/${relativeDocumentPath(document.name)}`;
  if (!pathValue.includes(PUBLIC_DATA_MARKER)) return "";
  return pathValue.split(PUBLIC_DATA_MARKER)[1]?.split("/")[0] ?? "";
}

function privateUserId(document) {
  const pathValue = `/${relativeDocumentPath(document.name)}`;
  if (!pathValue.includes(USER_DATA_MARKER)) return "";
  return pathValue.split(USER_DATA_MARKER)[1]?.split("/")[0] ?? "";
}

function isScopedToUid(id, uid) {
  return id === uid || id.startsWith(`${uid}__`) || id.endsWith(`__${uid}`) || id.includes(`-${uid}`);
}

const OWNER_SCOPED_PUBLIC_COLLECTIONS = new Set([
  "clans",
  "convoyMembers",
  "convoyRatings",
  "convoys",
  "cruiseAttendees",
  "drivers",
  "friendships",
  "individualLeaderboard",
  "mapLikes",
  "mapPins",
  "mapSpotPhotos",
  "publicProfiles",
  "seedProbes",
  "washReviews",
]);

function buildFirestoreDeletePlan(documents, removedUids, protectedUids) {
  const deleted = new Map();
  const mark = (document, reason) => {
    if (!deleted.has(document.name)) deleted.set(document.name, { document, reason });
  };

  for (const document of documents) {
    const privateUid = privateUserId(document);
    const id = documentId(document);
    const values = documentStrings(document);
    if (privateUid && !protectedUids.has(privateUid)) {
      mark(document, `private data belongs to unprotected user ${privateUid}`);
      continue;
    }
    const matchedUid = [...removedUids].find((uid) => (
      privateUid === uid || values.has(uid) || isScopedToUid(id, uid)
    ));
    if (matchedUid) {
      mark(document, `references removed user ${matchedUid}`);
      continue;
    }
    const collectionId = publicCollectionId(document);
    const hasProtectedOwner = [...protectedUids].some((uid) => values.has(uid) || isScopedToUid(id, uid));
    if (OWNER_SCOPED_PUBLIC_COLLECTIONS.has(collectionId) && !hasProtectedOwner) {
      mark(document, `legacy or unowned ${collectionId} record`);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    const deletedClanIds = new Set();
    const deletedConvoyIds = new Set();
    const deletedPinIds = new Set();
    for (const { document } of deleted.values()) {
      const collectionId = publicCollectionId(document);
      const id = documentId(document);
      if (collectionId === "clans") deletedClanIds.add(id);
      if (collectionId === "convoys") deletedConvoyIds.add(id);
      if (collectionId === "mapPins") deletedPinIds.add(id);
    }
    for (const document of documents) {
      if (deleted.has(document.name)) continue;
      const clanId = fieldString(document, "clanId");
      const convoyId = fieldString(document, "convoyId");
      const pinId = fieldString(document, "pinId");
      const id = documentId(document);
      if (deletedClanIds.has(clanId)) {
        mark(document, `references deleted clan ${clanId}`);
        changed = true;
      } else if (deletedConvoyIds.has(convoyId) || deletedConvoyIds.has(id)) {
        mark(document, `references deleted convoy ${convoyId || id}`);
        changed = true;
      } else if (deletedPinIds.has(pinId)) {
        mark(document, `references deleted map pin ${pinId}`);
        changed = true;
      }
    }
  }
  return deleted;
}

function summarizeByCollection(items) {
  const counts = {};
  for (const item of items) {
    const document = item.document ?? item;
    const collection = publicCollectionId(document) || (privateUserId(document) ? "private-user-data" : "other");
    counts[collection] = (counts[collection] ?? 0) + 1;
  }
  return counts;
}

function firebaseCliPath() {
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is required to locate Firebase CLI.");
  return path.join(appData, "npm", "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
}

async function readRealtimeDatabase() {
  const output = execFileSync(
    process.execPath,
    [firebaseCliPath(), "database:get", `/artifacts/${APP_ID}/realtime`, "--project", PROJECT_ID],
    { encoding: "utf8", windowsHide: true },
  );
  return JSON.parse(output || "null") ?? {};
}

function collectObjectStrings(value, output = new Set()) {
  if (typeof value === "string") output.add(value);
  if (!value || typeof value !== "object") return output;
  for (const child of Object.values(value)) collectObjectStrings(child, output);
  return output;
}

function buildRealtimeDeletePlan(data, removedUids) {
  const paths = new Map();
  const mark = (pathValue, reason) => paths.set(pathValue, reason);
  for (const uid of removedUids) {
    if (data?.presence?.[uid] !== undefined) mark(`presence/${uid}`, `removed user ${uid}`);
    if (data?.telemetry?.[uid] !== undefined) mark(`telemetry/${uid}`, `removed user ${uid}`);
    if (data?.directMessages?.userThreads?.[uid] !== undefined) {
      mark(`directMessages/userThreads/${uid}`, `removed user ${uid}`);
    }
  }
  for (const [threadId, thread] of Object.entries(data?.directMessages?.threads ?? {})) {
    const values = collectObjectStrings(thread);
    const matchedUid = [...removedUids].find((uid) => values.has(uid) || isScopedToUid(threadId, uid));
    if (matchedUid) mark(`directMessages/threads/${threadId}`, `references removed user ${matchedUid}`);
  }
  return paths;
}

async function listStorageObjects(token) {
  const objects = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ prefix: `artifacts/${APP_ID}/`, maxResults: "1000" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await requestJson(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(STORAGE_BUCKET)}/o?${query}`,
      token,
    );
    objects.push(...(response.items ?? []));
    pageToken = response.nextPageToken ?? "";
  } while (pageToken);
  return objects;
}

function buildStorageDeletePlan(objects, removedUids) {
  return objects.filter((object) => [...removedUids].some((uid) => object.name.split("/").includes(uid)));
}

async function deleteFirestoreDocuments(entries, token) {
  const names = [...entries.keys()];
  for (let index = 0; index < names.length; index += 400) {
    await requestJson(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
      token,
      {
        method: "POST",
        body: JSON.stringify({ writes: names.slice(index, index + 400).map((name) => ({ delete: name })) }),
      },
    );
  }
}

async function deleteRealtimePaths(paths) {
  if (!paths.size) return;
  for (const pathValue of paths.keys()) {
    execFileSync(
      process.execPath,
      [
        firebaseCliPath(),
        "database:remove",
        `/artifacts/${APP_ID}/realtime/${pathValue}`,
        "--project",
        PROJECT_ID,
        "--force",
        "--disable-triggers",
      ],
      { encoding: "utf8", windowsHide: true, stdio: "pipe" },
    );
  }
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

async function deleteAuthUsers(uids, token) {
  if (!uids.length) return;
  const response = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchDelete`,
    token,
    { method: "POST", body: JSON.stringify({ localIds: uids, force: true }) },
  );
  if (response.errors?.length) {
    throw new Error(`Auth batch delete reported errors: ${JSON.stringify(response.errors)}`);
  }
}

async function main() {
  const token = await getAccessToken();
  const authUsers = await listAuthUsers(token);
  const protectedUsers = authUsers.filter((user) => KEEP_EMAILS.has(String(user.email ?? "").toLowerCase()));
  if (protectedUsers.length !== KEEP_EMAILS.size) {
    throw new Error(`Protected account mismatch: expected ${KEEP_EMAILS.size}, found ${protectedUsers.length}.`);
  }
  const protectedUids = new Set(protectedUsers.map((user) => user.localId));
  const removedUsers = authUsers.filter((user) => !protectedUids.has(user.localId));
  const removedUids = new Set(removedUsers.map((user) => user.localId));

  const [firestoreDocuments, realtimeData, storageObjects] = await Promise.all([
    scanFirestore(FIRESTORE_ROOT, token),
    readRealtimeDatabase(),
    listStorageObjects(token),
  ]);
  const firestoreDeletes = buildFirestoreDeletePlan(firestoreDocuments, removedUids, protectedUids);
  const realtimeDeletes = buildRealtimeDeletePlan(realtimeData, removedUids);
  const storageDeletes = buildStorageDeletePlan(storageObjects, removedUids);
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupDir = path.resolve("D:/carfollow-backups", timestamp);
  await mkdir(backupDir, { recursive: true });
  const backup = {
    createdAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    appId: APP_ID,
    protectedUsers: protectedUsers.map(({ localId, email }) => ({ localId, email })),
    authUsers,
    firestoreDocuments,
    realtimeData,
    storageObjects,
  };
  await writeFile(path.join(backupDir, "firebase-backup.json"), JSON.stringify(backup, null, 2));
  try {
    await copyFile(path.resolve(".firebase-auth-inventory.json"), path.join(backupDir, "firebase-auth-export.json"));
  } catch {
    // The API inventory above is still sufficient when a CLI hash export is unavailable.
  }

  const report = {
    mode: EXECUTE ? "execute" : "dry-run",
    backupDir,
    auth: {
      total: authUsers.length,
      protected: protectedUsers.map(({ localId, email }) => ({ localId, email })),
      deleteCount: removedUsers.length,
    },
    firestore: {
      totalDocuments: firestoreDocuments.length,
      deleteCount: firestoreDeletes.size,
      deleteByCollection: summarizeByCollection([...firestoreDeletes.values()]),
      retainedByCollection: summarizeByCollection(firestoreDocuments.filter((doc) => !firestoreDeletes.has(doc.name))),
    },
    realtime: { deleteCount: realtimeDeletes.size, paths: Object.fromEntries(realtimeDeletes) },
    storage: { totalObjects: storageObjects.length, deleteCount: storageDeletes.length },
  };
  await writeFile(path.join(backupDir, "cleanup-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (!EXECUTE) return;
  if (CONFIRMATION !== EXPECTED_CONFIRMATION || removedUsers.length !== 16) {
    throw new Error(`Execution guard failed. Expected --confirm=${EXPECTED_CONFIRMATION} and exactly 16 delete candidates.`);
  }

  await deleteFirestoreDocuments(firestoreDeletes, token);
  await deleteRealtimePaths(realtimeDeletes);
  await deleteStorageObjects(storageDeletes, token);
  await deleteAuthUsers([...removedUids], token);
  const remainingAuthUsers = await listAuthUsers(token);
  const remainingEmails = remainingAuthUsers.map((user) => String(user.email ?? "").toLowerCase()).sort();
  const expectedEmails = [...KEEP_EMAILS].sort();
  if (JSON.stringify(remainingEmails) !== JSON.stringify(expectedEmails)) {
    throw new Error(`Post-cleanup Auth verification failed: ${JSON.stringify(remainingEmails)}`);
  }
  console.log(JSON.stringify({
    completed: true,
    deletedUsers: removedUsers.length,
    remainingAuthUsers: remainingEmails,
    backupDir,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
