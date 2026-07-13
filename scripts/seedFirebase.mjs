import "dotenv/config";

if (process.env.CRUISER_ALLOW_LEGACY_SEED !== "true") {
  throw new Error(
    "Legacy production seed is disabled. Use the Emulator Suite, or set CRUISER_ALLOW_LEGACY_SEED=true only for an intentional migration.",
  );
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
};

const requiredKeys = ["apiKey", "projectId", "databaseURL"];
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);

if (missingKeys.length > 0) {
  throw new Error(`Missing Firebase config keys: ${missingKeys.join(", ")}`);
}

const { appId, initialClans, initialDrivers, initialMapPins, quickProfiles } = await import("../src/data/mockData.js");
const { privateUserCollectionPath, publicCollectionPath, realtimeDmPath } = await import(
  "../src/services/firebasePaths.js"
);

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeDatabaseUrl(databaseUrl) {
  return databaseUrl.replace(/\/+$/, "");
}

function encodeFirestoreValue(value) {
  if (value === null) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeFirestoreValue(item)),
      },
    };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  switch (typeof value) {
    case "boolean":
      return { booleanValue: value };
    case "number":
      if (Number.isInteger(value)) {
        return { integerValue: String(value) };
      }

      return { doubleValue: value };
    case "string":
      return { stringValue: value };
    case "object":
      return { mapValue: { fields: encodeFirestoreFields(value) } };
    default:
      return { stringValue: String(value) };
  }
}

function encodeFirestoreFields(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, encodeFirestoreValue(value)]));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed (${response.status} ${response.statusText}) for ${url}\n${body}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
}

async function putFirestoreDocument(documentPath, payload) {
  const normalizedPath = trimSlashes(documentPath);
  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
    `/databases/(default)/documents/${normalizedPath}?key=${firebaseConfig.apiKey}`;

  return requestJson(url, {
    method: "PATCH",
    body: JSON.stringify({ fields: encodeFirestoreFields(payload) }),
  });
}

async function putRealtimeNode(path, payload) {
  const normalizedUrl = normalizeDatabaseUrl(firebaseConfig.databaseURL);
  const normalizedPath = trimSlashes(path);
  const url = `${normalizedUrl}/${normalizedPath}.json`;

  return requestJson(url, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function seedPublicCollection(collectionName, items, idSelector = (item) => item.id) {
  for (const item of items) {
    const docId = idSelector(item);
    const path = `${publicCollectionPath(collectionName, appId)}/${docId}`;
    await putFirestoreDocument(path, item);
  }
}

async function seedQuickProfile(profile) {
  await putFirestoreDocument(`${privateUserCollectionPath(profile.id, "profile", appId)}/current`, profile);

  for (const fuelLog of profile.fuelLogs) {
    await putFirestoreDocument(`${privateUserCollectionPath(profile.id, "fuelLogs", appId)}/${fuelLog.id}`, fuelLog);
  }

  await putRealtimeNode(realtimeDmPath(`${profile.plate}_telemetry`), {
    plate: profile.plate,
    vehicle: profile.model,
    node: profile.region,
    speed: 0,
    updatedAt: Date.now(),
  });
}

async function seedCruiseAndReviews() {
  const meetPins = initialMapPins.filter((pin) => pin.type === "meet");
  const washPins = initialMapPins.filter((pin) => pin.type === "wash");

  for (const meetPin of meetPins) {
    for (const attendee of meetPin.attendees) {
      const attendeeDocId = `${meetPin.id}_${attendee.replaceAll(" ", "_")}`;
      await putFirestoreDocument(`${publicCollectionPath("cruiseAttendees", appId)}/${attendeeDocId}`, {
        pinId: meetPin.id,
        plate: attendee,
        joinedAt: Date.now(),
      });
    }
  }

  for (const washPin of washPins) {
    for (const review of washPin.reviews) {
      await putFirestoreDocument(`${publicCollectionPath("washReviews", appId)}/${review.id}`, {
        pinId: washPin.id,
        ...review,
      });
    }
  }
}

async function seedRealtimeDatabase() {
  const telemetrySeed = Object.fromEntries(
    initialDrivers.map((driver) => [
      `${driver.plate}_telemetry`.replaceAll(" ", "_"),
      {
        ...driver,
        updatedAt: Date.now(),
      },
    ]),
  );

  const profilesSeed = Object.fromEntries(
    quickProfiles.map((profile) => [
      profile.plate.replaceAll(" ", "_"),
      {
        plate: profile.plate,
        model: profile.model,
        region: profile.region,
        clan: profile.clan,
        updatedAt: Date.now(),
      },
    ]),
  );

  await putRealtimeNode("directMessagesSeed/activeProfiles", profilesSeed);
  await putRealtimeNode("directMessagesSeed/telemetry", telemetrySeed);
  await putRealtimeNode("codexSeedProbe", {
    ok: true,
    source: "codex-seed-script-rest",
    updatedAt: Date.now(),
  });
}

await seedPublicCollection("mapPins", initialMapPins);
await seedPublicCollection("clans", initialClans);
await seedPublicCollection("drivers", initialDrivers, (driver) => driver.plate.replaceAll(" ", "_"));

for (const profile of quickProfiles) {
  await seedQuickProfile(profile);
}

await seedCruiseAndReviews();
await seedRealtimeDatabase();

console.log("Firebase seed completed via REST.");
