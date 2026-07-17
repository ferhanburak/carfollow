import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

const PROJECT_ID = "demo-cruiser";
const APP_ID = "cruiser-app-prod";
const AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [firestoreHost, firestorePort] = FIRESTORE_EMULATOR_HOST.split(":");
const publicPath = (collectionName, documentId) =>
  `artifacts/${APP_ID}/public/data/${collectionName}/${documentId}`;
const privatePath = (userId, collectionName, documentId) =>
  `artifacts/${APP_ID}/users/${userId}/${collectionName}/${documentId}`;
const normalizePlate = (plate) =>
  String(plate ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");

function normalizeIdentifier(value, fallback) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^0-9A-Za-z_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

function vehiclePartDocumentId(vehicleId, partKey) {
  return `${normalizeIdentifier(vehicleId, "vehicle-primary")}--${normalizeIdentifier(partKey, "part")}`;
}

let testEnvironment;
let appCounter = 0;
const apps = [];

function createClient(label) {
  appCounter += 1;
  const app = initializeApp(
    {
      apiKey: "demo-api-key",
      appId: `demo-app-${label}-${appCounter}`,
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
      projectId: PROJECT_ID,
    },
    `auth-identity-${label}-${appCounter}`,
  );
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  connectAuthEmulator(auth, `http://${AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  connectFirestoreEmulator(firestore, firestoreHost, Number(firestorePort));
  apps.push(app);
  return { app, auth, firestore };
}

function buildSignUpProfile(overrides = {}) {
  return {
    fullName: "Poyraz Alkan",
    plate: "06 AUTH 101",
    password: "hidden-password",
    model: "Seat Ibiza Cupra",
    tuningStage: "Stage 2+",
    vehicleType: "car",
    horsepower: 248,
    garage: "Ankara Apex Garage",
    region: "Ankara Bati",
    odometer: 68428.4,
    driverScore: 80,
    harmonyVotes: 1,
    alertVotes: 0,
    monthlyKm: 0,
    badges: ["Yeni Uye", "Garajda Aktif"],
    parts: [
      {
        key: "engine-oil",
        name: "Engine Oil",
        shortLabel: "Oil",
        zone: "engine",
        lifeExpectancyKm: 10000,
        lifeExpectancyMonths: 12,
        replacedKm: 66000,
        replacedAt: "2026-07-01",
      },
    ],
    ...overrides,
  };
}

async function clearAuthEmulator() {
  const response = await fetch(`http://${AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Auth emulator cleanup failed with ${response.status}`);
  }
}

async function createFirebaseAccount(auth, email, password = "super-secure-123") {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}

function createDuplicatePlateError() {
  const error = new Error("This vehicle plate is already registered.");
  error.code = "cruiser/plate-already-in-use";
  return error;
}

async function bootstrapCruiserIdentity(_firestore, firebaseUser, user) {
  const plateNormalized = normalizePlate(user.plate);
  const vehicleId = `vehicle-${firebaseUser.uid}`;
  const createdAt = serverTimestamp();
  return testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const claimRef = doc(firestore, publicPath("plateClaims", plateNormalized));
    const publicProfileRef = doc(firestore, publicPath("publicProfiles", firebaseUser.uid));
    const privateProfileRef = doc(firestore, privatePath(firebaseUser.uid, "profile", "current"));
    const vehicleRef = doc(firestore, privatePath(firebaseUser.uid, "vehicles", vehicleId));
    const passportRef = doc(firestore, privatePath(firebaseUser.uid, "vehiclePassports", vehicleId));

    await runTransaction(firestore, async (transaction) => {
    const existingClaim = await transaction.get(claimRef);
    if (existingClaim.exists() && existingClaim.data().uid !== firebaseUser.uid) {
      throw createDuplicatePlateError();
    }

    if (!existingClaim.exists()) {
      transaction.set(claimRef, {
        uid: firebaseUser.uid,
        vehicleId,
        plate: user.plate,
        plateNormalized,
        createdAt,
      });
    }

    const identityFields = {
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      primaryVehicleId: vehicleId,
      plate: user.plate.toUpperCase(),
      plateNormalized,
      fullName: user.fullName,
      model: user.model,
      horsepower: user.horsepower,
      garage: user.garage,
      region: user.region,
      tuningStage: user.tuningStage,
      vehicleType: user.vehicleType,
      driverScore: user.driverScore,
      harmonyVotes: user.harmonyVotes,
      alertVotes: user.alertVotes,
      monthlyKm: user.monthlyKm,
      badges: user.badges,
      schemaVersion: 2,
    };

    transaction.set(publicProfileRef, {
      ...identityFields,
      userId: firebaseUser.uid,
      createdAt,
      updatedAt: createdAt,
    });
    transaction.set(privateProfileRef, {
      ...identityFields,
      email: firebaseUser.email,
      odometer: user.odometer,
      createdAt,
      updatedAt: createdAt,
    });
    transaction.set(vehicleRef, {
      id: vehicleId,
      vehicleId,
      ownerId: firebaseUser.uid,
      isPrimary: true,
      status: "active",
      plate: user.plate.toUpperCase(),
      plateNormalized,
      model: user.model,
      vehicleType: user.vehicleType,
      tuningStage: user.tuningStage,
      horsepower: user.horsepower,
      odometer: user.odometer,
      garage: user.garage,
      schemaVersion: 1,
      createdAt,
      updatedAt: createdAt,
    });
    transaction.set(passportRef, {
      id: vehicleId,
      vehicleId,
      ownerId: firebaseUser.uid,
      status: "active",
      serviceLogCount: 0,
      fuelLogCount: 0,
      totalServiceSpend: 0,
      lastMutationType: "bootstrap",
      lastMutationId: "bootstrap",
      schemaVersion: 1,
      issuedAt: createdAt,
      updatedAt: createdAt,
    });

    for (const part of user.parts ?? []) {
      const partRef = doc(
        firestore,
        privatePath(firebaseUser.uid, "parts", vehiclePartDocumentId(vehicleId, part.key)),
      );
      transaction.set(partRef, {
        key: part.key,
        vehicleId,
        userId: firebaseUser.uid,
        name: part.name,
        shortLabel: part.shortLabel,
        zone: part.zone,
        lifeExpectancyKm: part.lifeExpectancyKm,
        lifeExpectancyMonths: part.lifeExpectancyMonths,
        replacedKm: part.replacedKm,
        replacedAt: part.replacedAt,
        schemaVersion: 1,
        createdAt,
        updatedAt: createdAt,
      });
    }
    });
  });
}

before(async () => {
  const firestoreRules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");
  testEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: firestoreRules },
  });
});

beforeEach(async () => {
  await clearAuthEmulator();
  await testEnvironment.clearFirestore();
});

afterEach(async () => {
  while (apps.length) {
    await deleteApp(apps.pop());
  }
});

after(async () => {
  await testEnvironment?.cleanup();
});

describe("Firebase Auth identity contract", { concurrency: false }, () => {
  it("bootstraps a real email account into the CRUISER private and public identity model", async () => {
    const { auth, firestore } = createClient("bootstrap");
    const firebaseUser = await createFirebaseAccount(auth, "driver-bootstrap@example.test");

    await bootstrapCruiserIdentity(firestore, firebaseUser, buildSignUpProfile());

    const privateSnapshot = await getDoc(doc(firestore, privatePath(firebaseUser.uid, "profile", "current")));
    const publicSnapshot = await getDoc(doc(firestore, publicPath("publicProfiles", firebaseUser.uid)));
    const plateSnapshot = await getDoc(doc(firestore, publicPath("plateClaims", "06AUTH101")));
    const vehicleSnapshot = await getDoc(
      doc(firestore, privatePath(firebaseUser.uid, "vehicles", `vehicle-${firebaseUser.uid}`)),
    );
    const passportSnapshot = await getDoc(
      doc(firestore, privatePath(firebaseUser.uid, "vehiclePassports", `vehicle-${firebaseUser.uid}`)),
    );
    const partSnapshot = await getDoc(
      doc(firestore, privatePath(firebaseUser.uid, "parts", `vehicle-${firebaseUser.uid}--engine-oil`)),
    );

    assert.equal(privateSnapshot.exists(), true);
    assert.equal(publicSnapshot.exists(), true);
    assert.equal(plateSnapshot.data().uid, firebaseUser.uid);
    assert.equal(vehicleSnapshot.data().ownerId, firebaseUser.uid);
    assert.equal(passportSnapshot.data().lastMutationType, "bootstrap");
    assert.equal(partSnapshot.data().key, "engine-oil");
    assert.equal(privateSnapshot.data().password, undefined);
    assert.equal(publicSnapshot.data().email, undefined);
    assert.equal(publicSnapshot.data().odometer, undefined);
  });

  it("rejects duplicate plates before a second user receives CRUISER profile documents", async () => {
    const firstClient = createClient("duplicate-owner");
    const secondClient = createClient("duplicate-rival");
    const firstUser = await createFirebaseAccount(firstClient.auth, "plate-owner@example.test");
    const secondUser = await createFirebaseAccount(secondClient.auth, "plate-rival@example.test");

    await bootstrapCruiserIdentity(firstClient.firestore, firstUser, buildSignUpProfile({ plate: "34 RACE 34" }));

    await assert.rejects(
      () => bootstrapCruiserIdentity(secondClient.firestore, secondUser, buildSignUpProfile({ plate: "34 RACE 34" })),
      (error) => error?.code === "cruiser/plate-already-in-use",
    );

    const secondPrivateProfile = await getDoc(
      doc(secondClient.firestore, privatePath(secondUser.uid, "profile", "current")),
    );
    const secondPublicProfile = await getDoc(
      doc(secondClient.firestore, publicPath("publicProfiles", secondUser.uid)),
    );

    assert.equal(secondPrivateProfile.exists(), false);
    assert.equal(secondPublicProfile.exists(), false);
  });

  it("lets a returning email/password user read the bootstrapped private profile", async () => {
    const email = "returning-driver@example.test";
    const password = "super-secure-456";
    const { auth, firestore } = createClient("returning");
    const firebaseUser = await createFirebaseAccount(auth, email, password);

    await bootstrapCruiserIdentity(firestore, firebaseUser, buildSignUpProfile({ plate: "35 BACK 35" }));
    await signOut(auth);
    const returningCredential = await signInWithEmailAndPassword(auth, email, password);
    const privateSnapshot = await getDoc(
      doc(firestore, privatePath(returningCredential.user.uid, "profile", "current")),
    );

    assert.equal(privateSnapshot.data().firebaseUid, returningCredential.user.uid);
    assert.equal(privateSnapshot.data().plateNormalized, "35BACK35");
  });
});
