import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionsBase = "https://us-central1-carfollow-75750.cloudfunctions.net";
const firestoreBase = "https://firestore.googleapis.com/v1/projects/carfollow-75750/databases/(default)/documents/artifacts/cruiser-app-prod/public/data";
const storageBucket = "carfollow-75750.firebasestorage.app";
const runId = Date.now().toString();

async function readLocalApiKey() {
  const contents = await readFile(path.join(rootDir, ".env"), "utf8").catch(() => "");
  return contents.match(/^VITE_FIREBASE_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
}

const credentials = {
  apiKey: process.env.CARFOLLOW_E2E_API_KEY || await readLocalApiKey(),
  emailA: process.env.CARFOLLOW_E2E_EMAIL_A,
  passwordA: process.env.CARFOLLOW_E2E_PASSWORD_A,
  emailB: process.env.CARFOLLOW_E2E_EMAIL_B,
  passwordB: process.env.CARFOLLOW_E2E_PASSWORD_B,
};
const missing = Object.entries(credentials).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) throw new Error(`Missing E2E environment values: ${missing.join(", ")}. See postman/README.md.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function assertCoordinate(actual, expected, label) {
  assert(Number(actual?.lat) === expected.lat, `${label} latitude changed: ${actual?.lat}`);
  assert(Number(actual?.lng) === expected.lng, `${label} longitude changed: ${actual?.lng}`);
}

function assertRoutePath(actual, expected, label) {
  assert(Array.isArray(actual), `${label} is not an array.`);
  assert(actual.length === expected.length, `${label} node count changed: expected ${expected.length}, received ${actual.length}.`);
  expected.forEach((point, index) => assertCoordinate(actual[index], point, `${label}[${index}]`));
}

async function parseResponse(response, label) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON (${response.status}): ${text.replace(/\s+/g, " ").slice(0, 240)}`);
  }
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function signIn(email, password, label) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(credentials.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const result = await parseResponse(response, `Sign in ${label}`);
  pass(`${label} authenticated`);
  return { idToken: result.idToken, uid: result.localId };
}

async function callFunction(name, account, data = {}) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.idToken}` },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  if (!payload.result?.ok) throw new Error(`${name} returned an unsuccessful result: ${JSON.stringify(payload)}`);
  pass(name);
  return payload.result;
}

async function getPublicDocument(collectionName, documentId, account) {
  const response = await fetch(`${firestoreBase}/${collectionName}/${documentId}`, {
    headers: { Authorization: `Bearer ${account.idToken}` },
  });
  return parseResponse(response, `Read ${collectionName}/${documentId}`);
}

async function assertPublicDocumentMissing(collectionName, documentId, account) {
  const response = await fetch(`${firestoreBase}/${collectionName}/${documentId}`, {
    headers: { Authorization: `Bearer ${account.idToken}` },
  });
  assert(response.status === 404, `${collectionName}/${documentId} should have been deleted.`);
  pass(`Account verifies deleted ${collectionName} document`);
}

async function uploadSpotFixture(pinId, account) {
  const storagePath = `artifacts/cruiser-app-prod/mapNodes/${pinId}/photos/${account.uid}/postman-${runId}.svg`;
  const image = await readFile(path.join(rootDir, "postman", "fixtures", "test-spot.svg"));
  const query = new URLSearchParams({ uploadType: "media", name: storagePath });
  const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?${query}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${account.idToken}`, "Content-Type": "image/svg+xml" },
    body: image,
  });
  const uploaded = await parseResponse(response, "Storage photo upload");
  const token = String(uploaded.downloadTokens ?? "").split(",")[0];
  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(uploaded.name)}?alt=media${token ? `&token=${token}` : ""}`;
  pass("Storage photo upload");
  return { storagePath: uploaded.name, imageUrl };
}

function firestoreString(document, field) {
  return document.fields?.[field]?.stringValue;
}

async function main() {
  console.log(`CRUISER two-account E2E runId: ${runId}`);
  const accountA = await signIn(credentials.emailA, credentials.passwordA, "Account A");
  const accountB = await signIn(credentials.emailB, credentials.passwordB, "Account B");
  assert(accountA.uid !== accountB.uid, "E2E accounts must be different Firebase users.");
  pass("Accounts have distinct UIDs");

  const spot = await callFunction("createMapNode", accountA, {
    pin: {
      type: "spot",
      name: `POSTMAN E2E SPOT ${runId}`,
      lat: 39.9208,
      lng: 32.8541,
      description: "Two-account automated visibility test.",
      tags: ["#PostmanE2E", "#NightRun"],
    },
  });
  const spotDocument = await getPublicDocument("mapPins", spot.pinId, accountB);
  assert(firestoreString(spotDocument, "createdByUid") === accountA.uid, "Account B did not read Account A's spot.");
  pass("Account B reads Account A photo spot");
  await callFunction("toggleMapLike", accountB, { pinId: spot.pinId, targetType: "pin" });
  const upload = await uploadSpotFixture(spot.pinId, accountB);
  const photo = await callFunction("addMapSpotPhoto", accountB, {
    pinId: spot.pinId,
    title: `POSTMAN E2E PHOTO ${runId}`,
    ...upload,
  });
  await callFunction("toggleMapLike", accountA, { pinId: spot.pinId, targetType: "photo", photoId: photo.photoId });
  await callFunction("deleteMapSpotPhoto", accountB, { photoId: photo.photoId });
  await assertPublicDocumentMissing("mapSpotPhotos", photo.photoId, accountA);

  const wash = await callFunction("createMapNode", accountA, {
    pin: {
      type: "wash",
      name: `POSTMAN E2E WASH ${runId}`,
      lat: 39.9135,
      lng: 32.8421,
      foam: 4,
      water: 4,
      allowsBuckets: true,
      shadowDrying: true,
      note: "Initial Account A review.",
    },
  });
  const washDocument = await getPublicDocument("mapPins", wash.pinId, accountB);
  assert(firestoreString(washDocument, "type") === "wash", "Account B did not read Account A's wash node.");
  pass("Account B reads Account A wash node");
  const washReview = await callFunction("submitWashReview", accountB, {
    pinId: wash.pinId,
    foam: 5,
    water: 4,
    allowsBuckets: true,
    shadowDrying: false,
    note: "Account B automated review.",
  });
  assert(washReview.rating?.reviews === 2, "Wash aggregate did not include both accounts.");
  pass("Wash aggregate updated for both accounts");

  const selectedConvoyRoute = [
    { lat: 39.9208, lng: 32.8541 },
    { lat: 39.9004, lng: 32.8093 },
    { lat: 39.9021, lng: 32.7029 },
  ];
  const convoy = await callFunction("createConvoy", accountA, {
    pin: {
      name: `POSTMAN E2E PUBLIC CONVOY ${runId}`,
      lat: 39.9208,
      lng: 32.8541,
      route: "Kizilay - Cankaya - Umitkoy",
      routePath: selectedConvoyRoute,
      time: "2026-07-18 22:30",
      scheduledStartAtMs: Date.now() - 60_000,
      capacity: 12,
      visibility: "public",
      accessPolicy: "request",
      detailVisibility: "trusted",
      minDriverScore: 0,
      minHarmonyVotes: 0,
      maxAlertVotes: 99,
      invitedGuests: [],
    },
  });
  let convoyList = await callFunction("listAccessibleConvoys", accountB);
  const mapView = convoyList.convoys.find((item) => item.id === convoy.convoyId);
  assert(mapView, "Public convoy marker is not visible to Account B.");
  assert(mapView.type === "meet", "Public convoy was not projected as a meet marker.");
  assertCoordinate(mapView, selectedConvoyRoute[0], "Account B convoy marker");
  assertRoutePath(mapView.routePath, selectedConvoyRoute, "Account B selected route");
  pass("Account B receives Account A convoy marker and selected route");
  await callFunction("requestConvoyJoin", accountB, { convoyId: convoy.convoyId });
  convoyList = await callFunction("listAccessibleConvoys", accountA);
  const hostView = convoyList.convoys.find((item) => item.id === convoy.convoyId);
  assert(hostView.pendingRequests.some((item) => item.userId === accountB.uid), "Account B is not pending for Account A.");
  await callFunction("respondConvoyJoinRequest", accountA, { convoyId: convoy.convoyId, memberUserId: accountB.uid, decision: "approved" });
  convoyList = await callFunction("listAccessibleConvoys", accountB);
  const memberView = convoyList.convoys.find((item) => item.id === convoy.convoyId);
  assert(memberView.attendees.some((item) => item.userId === accountB.uid), "Account B was not approved.");
  assertRoutePath(memberView.routePath, selectedConvoyRoute, "Approved member route");
  pass("Public convoy request, approval and route visibility");
  const destination = selectedConvoyRoute.at(-1);
  const hostArrival = await callFunction("syncConvoyLocation", accountA, { convoyId: convoy.convoyId, ...destination, accuracy: 5 });
  assert(hostArrival.tripStatus === "arrived" && hostArrival.lifecycleStatus === "rolling", "Convoy completed before every active member arrived.");
  const memberArrival = await callFunction("syncConvoyLocation", accountB, { convoyId: convoy.convoyId, ...destination, accuracy: 5 });
  assert(memberArrival.tripStatus === "arrived" && memberArrival.lifecycleStatus === "completed", "Last GPS arrival did not complete the convoy.");
  convoyList = await callFunction("listAccessibleConvoys", accountB);
  const completedView = convoyList.convoys.find((item) => item.id === convoy.convoyId);
  assert(completedView.lifecycleStatus === "completed", "Completed convoy state is not visible to Account B.");
  assert(completedView.attendees.every((item) => item.tripStatus === "arrived"), "Not every convoy member is marked arrived.");
  pass("GPS arrivals automatically complete the convoy");
  await callFunction("rateConvoyMember", accountB, { convoyId: convoy.convoyId, targetUserId: accountA.uid, signal: "harmony" });
  await callFunction("rateConvoyMember", accountA, { convoyId: convoy.convoyId, targetUserId: accountB.uid, signal: "harmony" });

  const friendsConvoy = await callFunction("createConvoy", accountA, {
    pin: {
      name: `POSTMAN E2E FRIENDS CONVOY ${runId}`,
      lat: 39.925,
      lng: 32.84,
      route: "Ankara Friends Test Route",
      routePath: [{ lat: 39.925, lng: 32.84 }, { lat: 39.91, lng: 32.79 }],
      time: "2026-07-19 21:30",
      capacity: 8,
      visibility: "friends",
      accessPolicy: "request",
      detailVisibility: "trusted",
      minDriverScore: 0,
      minHarmonyVotes: 0,
      maxAlertVotes: 99,
      invitedGuests: [],
    },
  });
  await callFunction("inviteConvoyMember", accountA, { convoyId: friendsConvoy.convoyId, targetUserId: accountB.uid });
  convoyList = await callFunction("listAccessibleConvoys", accountB);
  assert(convoyList.convoys.some((item) => item.id === friendsConvoy.convoyId), "Invited friends convoy is not visible.");
  await callFunction("requestConvoyJoin", accountB, { convoyId: friendsConvoy.convoyId });
  convoyList = await callFunction("listAccessibleConvoys", accountB);
  const invitedView = convoyList.convoys.find((item) => item.id === friendsConvoy.convoyId);
  assert(invitedView.attendees.some((item) => item.userId === accountB.uid), "Invited Account B was not immediately approved.");
  pass("Friends convoy invitation and immediate approval");

  console.log(`E2E completed successfully. runId=${runId}`);
}

try {
  await main();
} finally {
  console.log(`Dry-run cleanup: npm run postman:cleanup -- --run-id=${runId}`);
  console.log(`Execute cleanup: npm run postman:cleanup -- --run-id=${runId} --execute --confirm=DELETE-POSTMAN-E2E-${runId}`);
}
