import { after, before, beforeEach, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  get as getDatabaseValue,
  ref as databaseRef,
  set as setDatabaseValue,
  update as updateDatabaseValue,
} from "firebase/database";
import {
  getBytes,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

const PROJECT_ID = "demo-cruiser";
const APP_ID = "cruiser-app-prod";
const OWNER_ID = "owner-user";
const OTHER_ID = "other-user";
const STRANGER_ID = "stranger-user";
const VEHICLE_ID = "vehicle-owner-user";
const PLATE_NORMALIZED = "06TEST01";
const FIXED_TIME = Timestamp.fromDate(new Date("2026-07-14T12:00:00.000Z"));
const publicPath = (collectionName, documentId) =>
  `artifacts/${APP_ID}/public/data/${collectionName}/${documentId}`;
const privatePath = (userId, collectionName, documentId) =>
  `artifacts/${APP_ID}/users/${userId}/${collectionName}/${documentId}`;
const realtimePath = (suffix) => `artifacts/${APP_ID}/realtime/${suffix}`;

let testEnvironment;

function buildPrivateProfile() {
  return {
    id: OWNER_ID,
    firebaseUid: OWNER_ID,
    email: "owner@example.com",
    primaryVehicleId: VEHICLE_ID,
    plate: "06 TEST 01",
    plateNormalized: PLATE_NORMALIZED,
    fullName: "Owner Driver",
    model: "Test Vehicle",
    horsepower: 180,
    garage: "Cruiser Garage",
    region: "Ankara",
    odometer: 12000,
    driverScore: 80,
    harmonyVotes: 1,
    alertVotes: 0,
    monthlyKm: 0,
    badges: ["Yeni Uye", "Garajda Aktif"],
    schemaVersion: 2,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  };
}

function buildPublicProfile() {
  const { email: _email, odometer: _odometer, ...profile } = buildPrivateProfile();
  return {
    ...profile,
    userId: OWNER_ID,
  };
}

function buildVehicle() {
  return {
    id: VEHICLE_ID,
    vehicleId: VEHICLE_ID,
    ownerId: OWNER_ID,
    isPrimary: true,
    status: "active",
    plate: "06 TEST 01",
    plateNormalized: PLATE_NORMALIZED,
    model: "Test Vehicle",
    vehicleType: "car",
    tuningStage: "Stock",
    horsepower: 180,
    odometer: 12000,
    garage: "Cruiser Garage",
    schemaVersion: 1,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
  };
}

function buildPassport(overrides = {}) {
  return {
    id: VEHICLE_ID,
    vehicleId: VEHICLE_ID,
    ownerId: OWNER_ID,
    status: "active",
    serviceLogCount: 0,
    fuelLogCount: 0,
    totalServiceSpend: 0,
    lastMutationType: "bootstrap",
    lastMutationId: "bootstrap",
    schemaVersion: 1,
    issuedAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

function buildFuelLog(overrides = {}) {
  return {
    id: "fuel-valid-1",
    userId: OWNER_ID,
    vehicleId: VEHICLE_ID,
    liters: 42,
    price: 1950,
    currentKm: 12100,
    station: "Apex Fuel",
    createdAt: FIXED_TIME,
    ...overrides,
  };
}

function buildServiceLog(overrides = {}) {
  return {
    id: "service-valid-1",
    userId: OWNER_ID,
    vehicleId: VEHICLE_ID,
    partKey: "engine-oil",
    type: "replacement",
    serviceDate: "2026-07-14",
    serviceKm: 12200,
    serviceShop: "Apex Garage",
    cost: 3200,
    notes: "Oil and filter changed.",
    receiptImageUrl: "",
    createdAt: FIXED_TIME,
    ...overrides,
  };
}

function buildPart(overrides = {}) {
  return {
    key: "engine-oil",
    vehicleId: VEHICLE_ID,
    userId: OWNER_ID,
    name: "Engine Oil",
    shortLabel: "Oil",
    zone: "engine",
    lifeExpectancyKm: 10000,
    lifeExpectancyMonths: 12,
    replacedKm: 12200,
    replacedAt: "2026-07-14",
    lastServiceLogId: "service-valid-1",
    schemaVersion: 1,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...overrides,
  };
}

async function seedFirestoreFixtures() {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const batch = writeBatch(database);
    batch.set(doc(database, publicPath("plateClaims", PLATE_NORMALIZED)), {
      uid: OWNER_ID,
      vehicleId: VEHICLE_ID,
      plate: "06 TEST 01",
      plateNormalized: PLATE_NORMALIZED,
      createdAt: FIXED_TIME,
    });
    batch.set(doc(database, publicPath("publicProfiles", OWNER_ID)), buildPublicProfile());
    batch.set(doc(database, privatePath(OWNER_ID, "profile", "current")), buildPrivateProfile());
    batch.set(doc(database, privatePath(OWNER_ID, "vehicles", VEHICLE_ID)), buildVehicle());
    batch.set(doc(database, privatePath(OWNER_ID, "vehiclePassports", VEHICLE_ID)), buildPassport());
    batch.set(doc(database, privatePath(OWNER_ID, "driverStats", "current")), {
      userId: OWNER_ID,
      periodKey: "2026-07",
      monthlyKm: 12.4,
    });
    batch.set(doc(database, privatePath(OWNER_ID, "driveSessions", "ride-owner-123456")), {
      userId: OWNER_ID,
      vehicleId: VEHICLE_ID,
      status: "completed",
    });
    batch.set(doc(database, privatePath(OWNER_ID, "vehiclePassportExports", "export-owner-1")), {
      id: "export-owner-1",
      userId: OWNER_ID,
      vehicleId: VEHICLE_ID,
      readinessScore: 84,
      generatedAt: FIXED_TIME,
      schemaVersion: 1,
    });
    batch.set(doc(database, publicPath("individualLeaderboard", `2026-07__${OWNER_ID}`)), {
      id: `2026-07__${OWNER_ID}`,
      userId: OWNER_ID,
      periodKey: "2026-07",
      monthlyKm: 12.4,
    });
    batch.set(doc(database, publicPath("friendships", `${OTHER_ID}__${OWNER_ID}`)), {
      id: `${OTHER_ID}__${OWNER_ID}`,
      requesterUserId: OWNER_ID,
      targetUserId: OTHER_ID,
      participantIds: [OWNER_ID, OTHER_ID],
      participants: { [OWNER_ID]: true, [OTHER_ID]: true },
      status: "pending",
      schemaVersion: 1,
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    });
    batch.set(doc(database, privatePath(OWNER_ID, "blockedUsers", STRANGER_ID)), {
      id: STRANGER_ID,
      ownerUserId: OWNER_ID,
      targetUserId: STRANGER_ID,
      targetProfile: {
        userId: STRANGER_ID,
        plate: "34 BLOCK 01",
        fullName: "Blocked Driver",
        model: "Test Vehicle",
        region: "Istanbul",
        avatar: "",
      },
      schemaVersion: 1,
      blockedAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
    });
    await batch.commit();
  });
}

before(async () => {
  const [firestoreRules, databaseRules, storageRules] = await Promise.all([
    readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
    readFile(new URL("../../database.rules.json", import.meta.url), "utf8"),
    readFile(new URL("../../storage.rules", import.meta.url), "utf8"),
  ]);
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: firestoreRules },
    database: { rules: databaseRules },
    storage: { rules: storageRules },
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

describe("Firestore security rules", { concurrency: false }, () => {
  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seedFirestoreFixtures();
  });

  it("requires authentication for public profile reads", async () => {
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();
    const anonymousDb = testEnvironment
      .authenticatedContext("anonymous-user", { firebase: { sign_in_provider: "anonymous" } })
      .firestore();
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const profileReference = publicPath("publicProfiles", OWNER_ID);

    await assertFails(getDoc(doc(unauthenticatedDb, profileReference)));
    await assertFails(getDoc(doc(anonymousDb, profileReference)));
    await assertSucceeds(getDoc(doc(ownerDb, profileReference)));
  });

  it("allows only owners to read private vehicle data and backend aggregates", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const otherDb = testEnvironment.authenticatedContext(OTHER_ID).firestore();
    const protectedPaths = [
      privatePath(OWNER_ID, "profile", "current"),
      privatePath(OWNER_ID, "vehicles", VEHICLE_ID),
      privatePath(OWNER_ID, "driverStats", "current"),
      privatePath(OWNER_ID, "driveSessions", "ride-owner-123456"),
      privatePath(OWNER_ID, "vehiclePassportExports", "export-owner-1"),
    ];

    for (const documentPath of protectedPaths) {
      await assertSucceeds(getDoc(doc(ownerDb, documentPath)));
      await assertFails(getDoc(doc(otherDb, documentPath)));
    }
  });

  it("keeps plate claims query-resistant while allowing exact authenticated lookups", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    await assertSucceeds(getDoc(doc(ownerDb, publicPath("plateClaims", PLATE_NORMALIZED))));
    await assertFails(getDocs(collection(ownerDb, `artifacts/${APP_ID}/public/data/plateClaims`)));
  });

  it("allows participant-scoped friendship reads and blocks direct client writes", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const strangerDb = testEnvironment.authenticatedContext(STRANGER_ID).firestore();
    const friendshipPath = publicPath("friendships", `${OTHER_ID}__${OWNER_ID}`);

    await assertSucceeds(getDoc(doc(ownerDb, friendshipPath)));
    await assertFails(getDoc(doc(strangerDb, friendshipPath)));
    await assertSucceeds(getDocs(query(
      collection(ownerDb, `artifacts/${APP_ID}/public/data/friendships`),
      where("participantIds", "array-contains", OWNER_ID),
    )));
    await assertFails(getDocs(collection(ownerDb, `artifacts/${APP_ID}/public/data/friendships`)));
    await assertFails(setDoc(doc(ownerDb, publicPath("friendships", "manual-friendship")), {
      participantIds: [OWNER_ID, STRANGER_ID],
      status: "accepted",
    }));
  });

  it("keeps blocked drivers private and backend-owned", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const otherDb = testEnvironment.authenticatedContext(OTHER_ID).firestore();
    const blockedPath = privatePath(OWNER_ID, "blockedUsers", STRANGER_ID);

    await assertSucceeds(getDoc(doc(ownerDb, blockedPath)));
    await assertSucceeds(getDocs(collection(ownerDb, `artifacts/${APP_ID}/users/${OWNER_ID}/blockedUsers`)));
    await assertFails(getDoc(doc(otherDb, blockedPath)));
    await assertFails(setDoc(doc(ownerDb, privatePath(OWNER_ID, "blockedUsers", OTHER_ID)), {
      ownerUserId: OWNER_ID,
      targetUserId: OTHER_ID,
    }));
  });

  it("allows scoped clan reads but blocks every direct clan mutation", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const otherDb = testEnvironment.authenticatedContext(OTHER_ID).firestore();
    const strangerDb = testEnvironment.authenticatedContext(STRANGER_ID).firestore();
    const clanId = "clan-owner";
    const clanPath = publicPath("clans", clanId);
    const memberPath = publicPath("clanMembers", `${clanId}__${OWNER_ID}`);
    const invitePath = publicPath("clanInvites", `${clanId}__${OTHER_ID}`);

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      await setDoc(doc(database, clanPath), {
        id: clanId,
        name: "Owner Clan",
        tag: "OWN",
        memberCount: 1,
      });
      await setDoc(doc(database, memberPath), {
        id: `${clanId}__${OWNER_ID}`,
        clanId,
        userId: OWNER_ID,
        role: "owner",
      });
      await setDoc(doc(database, invitePath), {
        id: `${clanId}__${OTHER_ID}`,
        clanId,
        targetUserId: OTHER_ID,
        invitedByUserId: OWNER_ID,
        status: "pending",
      });
    });

    await assertSucceeds(getDoc(doc(ownerDb, clanPath)));
    await assertSucceeds(getDocs(collection(ownerDb, `artifacts/${APP_ID}/public/data/clanMembers`)));
    await assertSucceeds(getDocs(query(
      collection(otherDb, `artifacts/${APP_ID}/public/data/clanInvites`),
      where("targetUserId", "==", OTHER_ID),
    )));
    await assertFails(getDoc(doc(strangerDb, invitePath)));
    await assertFails(getDocs(collection(otherDb, `artifacts/${APP_ID}/public/data/clanInvites`)));
    await assertFails(setDoc(doc(ownerDb, clanPath), { id: clanId, name: "Manual Clan" }));
    await assertFails(setDoc(doc(ownerDb, memberPath), { clanId, userId: OWNER_ID, role: "owner" }));
    await assertFails(setDoc(doc(otherDb, invitePath), { clanId, targetUserId: OTHER_ID, status: "pending" }));
  });

  it("blocks client-side clan membership changes on profiles", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(updateDoc(doc(ownerDb, publicPath("publicProfiles", OWNER_ID)), {
      clan: "Manual Clan",
      clanId: "manual-clan",
      clanRole: "owner",
      updatedAt: FIXED_TIME,
    }));
    await assertFails(updateDoc(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      clan: "Manual Clan",
      clanId: "manual-clan",
      clanRole: "owner",
      updatedAt: FIXED_TIME,
    }));
  });

  it("blocks client writes to driver stats and individual leaderboard", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    await assertFails(setDoc(doc(ownerDb, privatePath(OWNER_ID, "driverStats", "manual")), {
      monthlyKm: 9999,
    }));
    await assertFails(setDoc(doc(ownerDb, publicPath("individualLeaderboard", "manual-entry")), {
      userId: OWNER_ID,
      monthlyKm: 9999,
    }));
  });

  it("allows ordinary profile and vehicle setup updates", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const batch = writeBatch(ownerDb);
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      garage: "Updated Garage",
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, publicPath("publicProfiles", OWNER_ID)), {
      garage: "Updated Garage",
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehicles", VEHICLE_ID)), {
      garage: "Updated Garage",
      updatedAt: FIXED_TIME,
    });

    await assertSucceeds(batch.commit());
  });

  it("blocks client changes to backend-owned profile statistics", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    await assertFails(updateDoc(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      monthlyKm: 9999,
      badges: ["Yeni Uye", "Garajda Aktif", "Injected Badge"],
    }));
  });

  it("blocks arbitrary odometer changes even when profile and vehicle are changed together", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const batch = writeBatch(ownerDb);
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      odometer: 99000,
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehicles", VEHICLE_ID)), {
      odometer: 99000,
      lastOdometerSource: "profile",
      updatedAt: FIXED_TIME,
    });

    await assertFails(batch.commit());
  });

  it("allows an atomic fuel append that advances profile, vehicle, and passport together", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const fuelLog = buildFuelLog();
    const batch = writeBatch(ownerDb);

    batch.set(doc(ownerDb, privatePath(OWNER_ID, "fuelLogs", fuelLog.id)), fuelLog);
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehicles", VEHICLE_ID)), {
      odometer: fuelLog.currentKm,
      lastOdometerSource: "fuel",
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      odometer: fuelLog.currentKm,
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehiclePassports", VEHICLE_ID)), {
      fuelLogCount: 1,
      lastFuelKm: fuelLog.currentKm,
      lastMutationId: fuelLog.id,
      lastMutationType: "fuel",
      updatedAt: FIXED_TIME,
    });

    await assertSucceeds(batch.commit());
  });

  it("blocks fuel records without the matching passport mutation", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const fuelLog = buildFuelLog({ id: "fuel-missing-passport" });
    const batch = writeBatch(ownerDb);

    batch.set(doc(ownerDb, privatePath(OWNER_ID, "fuelLogs", fuelLog.id)), fuelLog);
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehicles", VEHICLE_ID)), {
      odometer: fuelLog.currentKm,
      lastOdometerSource: "fuel",
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      odometer: fuelLog.currentKm,
      updatedAt: FIXED_TIME,
    });

    await assertFails(batch.commit());
  });

  it("blocks backdated fuel records below the current odometer", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const fuelLog = buildFuelLog({
      id: "fuel-backdated",
      currentKm: 11900,
    });
    const batch = writeBatch(ownerDb);

    batch.set(doc(ownerDb, privatePath(OWNER_ID, "fuelLogs", fuelLog.id)), fuelLog);
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehicles", VEHICLE_ID)), {
      lastOdometerSource: "fuel",
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehiclePassports", VEHICLE_ID)), {
      fuelLogCount: 1,
      lastFuelKm: fuelLog.currentKm,
      lastMutationId: fuelLog.id,
      lastMutationType: "fuel",
      updatedAt: FIXED_TIME,
    });

    await assertFails(batch.commit());
  });

  it("allows an atomic service replacement that refreshes the matching part", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const serviceLog = buildServiceLog();
    const part = buildPart();
    const batch = writeBatch(ownerDb);

    batch.set(doc(ownerDb, privatePath(OWNER_ID, "serviceLogs", serviceLog.id)), serviceLog);
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehicles", VEHICLE_ID)), {
      odometer: serviceLog.serviceKm,
      lastOdometerSource: "service",
      lastServiceDate: serviceLog.serviceDate,
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "profile", "current")), {
      odometer: serviceLog.serviceKm,
      updatedAt: FIXED_TIME,
    });
    batch.update(doc(ownerDb, privatePath(OWNER_ID, "vehiclePassports", VEHICLE_ID)), {
      serviceLogCount: 1,
      totalServiceSpend: serviceLog.cost,
      lastServiceDate: serviceLog.serviceDate,
      lastMutationId: serviceLog.id,
      lastMutationType: "service",
      updatedAt: FIXED_TIME,
    });
    batch.set(doc(ownerDb, privatePath(OWNER_ID, "parts", `${VEHICLE_ID}--${part.key}`)), part);

    await assertSucceeds(batch.commit());
  });

  it("blocks direct part replacement when no matching service log exists", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const partPath = privatePath(OWNER_ID, "parts", `${VEHICLE_ID}--engine-oil`);

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), partPath), buildPart({
        replacedKm: 12000,
        replacedAt: "2026-06-01",
        lastServiceLogId: "bootstrap-part",
      }));
    });

    await assertFails(updateDoc(doc(ownerDb, partPath), {
      replacedKm: 13000,
      replacedAt: "2026-07-20",
      lastServiceLogId: "missing-service-log",
      updatedAt: FIXED_TIME,
    }));
  });

  it("blocks client-side vehicle passport status changes", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(updateDoc(doc(ownerDb, privatePath(OWNER_ID, "vehiclePassports", VEHICLE_ID)), {
      status: "archived",
      updatedAt: FIXED_TIME,
    }));
  });

  it("blocks client writes to backend-created passport export snapshots", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();

    await assertFails(setDoc(doc(ownerDb, privatePath(OWNER_ID, "vehiclePassportExports", "manual-export")), {
      id: "manual-export",
      userId: OWNER_ID,
      vehicleId: VEHICLE_ID,
      readinessScore: 100,
      generatedAt: FIXED_TIME,
      schemaVersion: 1,
    }));
  });

  it("keeps every map and convoy mutation callable-only", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).firestore();
    const basePin = {
      id: "node-1", name: "Test node", lat: 39.9, lng: 32.8,
      createdByUid: OWNER_ID, createdAt: FIXED_TIME, updatedAt: FIXED_TIME,
    };
    await assertFails(setDoc(doc(ownerDb, publicPath("mapPins", "node-1")), { ...basePin, type: "spot" }));
    await assertFails(setDoc(doc(ownerDb, publicPath("mapPins", "wash-1")), { ...basePin, id: "wash-1", type: "wash" }));
    await assertFails(setDoc(doc(ownerDb, publicPath("mapPins", "meet-1")), { ...basePin, id: "meet-1", type: "meet" }));
    await assertFails(setDoc(doc(ownerDb, publicPath("washReviews", "wash-1__owner")), { pinId: "wash-1", userId: OWNER_ID }));
    await assertFails(setDoc(doc(ownerDb, publicPath("mapSpotPhotos", "photo-1")), { pinId: "node-1", userId: OWNER_ID }));
    await assertFails(setDoc(doc(ownerDb, publicPath("mapLikes", "like-1")), { pinId: "node-1", userId: OWNER_ID }));
    await assertFails(setDoc(doc(ownerDb, publicPath("convoys", "convoy-1")), { hostUserId: OWNER_ID, route: "private" }));
    await assertFails(setDoc(doc(ownerDb, publicPath("convoyMembers", "convoy-1__owner")), { convoyId: "convoy-1", userId: OWNER_ID }));
    await assertFails(getDoc(doc(ownerDb, publicPath("convoys", "convoy-1"))));
  });
});

describe("Realtime Database security rules", { concurrency: false }, () => {
  beforeEach(async () => {
    await testEnvironment.clearDatabase();
  });

  it("lets users publish only their own valid presence", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).database();
    const otherDb = testEnvironment.authenticatedContext(OTHER_ID).database();
    const presence = {
      plate: "06 TEST 01",
      status: "online",
      lastSeen: 1720958400000,
      updatedAt: 1720958400000,
      firebaseUid: OWNER_ID,
    };

    await assertSucceeds(setDatabaseValue(databaseRef(ownerDb, realtimePath(`presence/${OWNER_ID}`)), presence));
    await assertFails(setDatabaseValue(databaseRef(otherDb, realtimePath(`presence/${OWNER_ID}`)), presence));
  });

  it("requires authentication for presence reads", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).database();
    const anonymousDb = testEnvironment
      .authenticatedContext("anonymous-user", { firebase: { sign_in_provider: "anonymous" } })
      .database();
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().database();

    await assertSucceeds(getDatabaseValue(databaseRef(ownerDb, realtimePath("presence"))));
    await assertFails(getDatabaseValue(databaseRef(anonymousDb, realtimePath("presence"))));
    await assertFails(getDatabaseValue(databaseRef(unauthenticatedDb, realtimePath("presence"))));
  });

  it("rejects invalid telemetry and cross-user telemetry writes", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).database();
    const otherDb = testEnvironment.authenticatedContext(OTHER_ID).database();
    const validTelemetry = {
      plate: "06 TEST 01",
      firebaseUid: OWNER_ID,
      speed: 110,
      updatedAt: 1720958400000,
    };

    await assertSucceeds(setDatabaseValue(databaseRef(ownerDb, realtimePath(`telemetry/${OWNER_ID}`)), validTelemetry));
    await assertFails(setDatabaseValue(databaseRef(ownerDb, realtimePath(`telemetry/${OWNER_ID}`)), {
      ...validTelemetry,
      speed: 401,
    }));
    await assertFails(setDatabaseValue(databaseRef(otherDb, realtimePath(`telemetry/${OWNER_ID}`)), validTelemetry));
  });

  it("limits DM thread reads and writes to participants", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).database();
    const otherDb = testEnvironment.authenticatedContext(OTHER_ID).database();
    const strangerDb = testEnvironment.authenticatedContext(STRANGER_ID).database();
    const threadPath = realtimePath("directMessages/threads/thread-owner-other");
    const thread = {
      participantUids: { [OWNER_ID]: true, [OTHER_ID]: true },
      updatedAt: 1720958400000,
      messages: {
        first: { senderUid: OWNER_ID, text: "Merhaba", createdAt: 1720958400000 },
      },
    };

    await assertSucceeds(setDatabaseValue(databaseRef(ownerDb, threadPath), thread));
    await assertSucceeds(getDatabaseValue(databaseRef(otherDb, threadPath)));
    await assertFails(getDatabaseValue(databaseRef(strangerDb, threadPath)));
    await assertFails(updateDatabaseValue(databaseRef(strangerDb, threadPath), {
      "messages/injected": { senderUid: STRANGER_ID, text: "blocked" },
    }));
  });

  it("isolates per-user DM indexes", async () => {
    const ownerDb = testEnvironment.authenticatedContext(OWNER_ID).database();
    const otherDb = testEnvironment.authenticatedContext(OTHER_ID).database();
    const indexPath = realtimePath(`directMessages/userThreads/${OWNER_ID}/thread-owner-other`);

    await assertSucceeds(setDatabaseValue(databaseRef(ownerDb, indexPath), true));
    await assertSucceeds(getDatabaseValue(databaseRef(ownerDb, realtimePath(`directMessages/userThreads/${OWNER_ID}`))));
    await assertFails(setDatabaseValue(databaseRef(otherDb, indexPath), true));
  });
});

describe("Storage security rules", { concurrency: false }, () => {
  beforeEach(async () => {
    await testEnvironment.clearStorage();
  });

  it("allows owners to upload images to their avatar path", async () => {
    const ownerStorage = testEnvironment.authenticatedContext(OWNER_ID).storage();
    const avatarReference = storageRef(
      ownerStorage,
      `artifacts/${APP_ID}/users/${OWNER_ID}/avatars/profile.png`,
    );

    await assertSucceeds(uploadBytes(avatarReference, new Uint8Array([137, 80, 78, 71]), {
      contentType: "image/png",
    }));
  });

  it("blocks cross-user and non-image avatar uploads", async () => {
    const ownerStorage = testEnvironment.authenticatedContext(OWNER_ID).storage();
    const otherStorage = testEnvironment.authenticatedContext(OTHER_ID).storage();
    const ownerAvatarPath = `artifacts/${APP_ID}/users/${OWNER_ID}/avatars/profile.png`;

    await assertFails(uploadBytes(storageRef(otherStorage, ownerAvatarPath), new Uint8Array([1]), {
      contentType: "image/png",
    }));
    await assertFails(uploadBytes(storageRef(ownerStorage, ownerAvatarPath), new Uint8Array([1]), {
      contentType: "text/plain",
    }));
  });

  it("allows signed-in reads but blocks anonymous reads", async () => {
    const ownerStorage = testEnvironment.authenticatedContext(OWNER_ID).storage();
    const otherStorage = testEnvironment.authenticatedContext(OTHER_ID).storage();
    const anonymousStorage = testEnvironment
      .authenticatedContext("anonymous-user", { firebase: { sign_in_provider: "anonymous" } })
      .storage();
    const unauthenticatedStorage = testEnvironment.unauthenticatedContext().storage();
    const avatarPath = `artifacts/${APP_ID}/users/${OWNER_ID}/avatars/profile.png`;

    await uploadBytes(storageRef(ownerStorage, avatarPath), new Uint8Array([137, 80, 78, 71]), {
      contentType: "image/png",
    });
    await assertSucceeds(getBytes(storageRef(otherStorage, avatarPath)));
    await assertFails(getBytes(storageRef(anonymousStorage, avatarPath)));
    await assertFails(getBytes(storageRef(unauthenticatedStorage, avatarPath)));
  });

  it("blocks uploads outside known application paths", async () => {
    const ownerStorage = testEnvironment.authenticatedContext(OWNER_ID).storage();
    await assertFails(uploadBytes(
      storageRef(ownerStorage, `artifacts/unknown-app/users/${OWNER_ID}/avatars/profile.png`),
      new Uint8Array([137, 80, 78, 71]),
      { contentType: "image/png" },
    ));
  });
});
