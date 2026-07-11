import {
  privateUserCollectionPath,
  publicCollectionPath,
  realtimeDmPath,
  resolveAppId,
} from "../services/firebasePaths";
import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";

function mapCollectionSnapshot(snapshot) {
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

async function loadFirestoreModule() {
  return import("firebase/firestore/lite");
}

async function loadDatabaseModule() {
  return import("firebase/database");
}

export function isFirebaseRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function loadFirebaseWorldState() {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { firestore } = services;
  const { collection, getDocs, query } = await loadFirestoreModule();
  const [mapPinsSnapshot, clansSnapshot, driversSnapshot] = await Promise.all([
    getDocs(query(collection(firestore, publicCollectionPath("mapPins", resolveAppId())))),
    getDocs(query(collection(firestore, publicCollectionPath("clans", resolveAppId())))),
    getDocs(query(collection(firestore, publicCollectionPath("drivers", resolveAppId())))),
  ]);

  return {
    mapPins: mapCollectionSnapshot(mapPinsSnapshot),
    clans: mapCollectionSnapshot(clansSnapshot),
    drivers: mapCollectionSnapshot(driversSnapshot),
  };
}

export async function saveFirebaseUserProfile(user) {
  const services = await getFirebaseServices();
  if (!services || !user?.id) {
    return null;
  }

  const { firestore, authUser } = services;
  const { doc, setDoc } = await loadFirestoreModule();
  // Private path: /artifacts/{appId}/users/{userId}/{collectionName}
  await setDoc(
    doc(firestore, privateUserCollectionPath(authUser.uid, "profile", resolveAppId()), "current"),
    {
      ...user,
      firebaseUid: authUser.uid,
    },
    { merge: true },
  );

  return {
    authUid: authUser.uid,
    syncedAt: Date.now(),
  };
}

export async function saveFirebaseFuelLog(nextLog) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { firestore, authUser } = services;
  const { addDoc, collection } = await loadFirestoreModule();
  await addDoc(collection(firestore, privateUserCollectionPath(authUser.uid, "fuelLogs", resolveAppId())), nextLog);

  return {
    authUid: authUser.uid,
    syncedAt: Date.now(),
  };
}

export async function saveFirebaseWashReview(pinId, review) {
  const services = await getFirebaseServices();
  if (!services || !pinId) {
    return;
  }

  const { firestore } = services;
  const { addDoc, collection } = await loadFirestoreModule();
  await addDoc(collection(firestore, publicCollectionPath("washReviews", resolveAppId())), {
    pinId,
    ...review,
  });
}

export async function saveFirebaseCruiseJoin(pinId, plate) {
  const services = await getFirebaseServices();
  if (!services || !pinId || !plate) {
    return;
  }

  const { firestore } = services;
  const { collection, doc, setDoc } = await loadFirestoreModule();
  await setDoc(
    doc(collection(firestore, publicCollectionPath("cruiseAttendees", resolveAppId())), `${pinId}_${plate}`),
    { pinId, plate, joinedAt: Date.now() },
    { merge: true },
  );
}

export async function saveFirebaseActiveDriver(driver) {
  const services = await getFirebaseServices();
  if (!services || !driver?.plate) {
    return null;
  }

  const { database, authUser } = services;
  if (!database) {
    return null;
  }

  const { ref, set } = await loadDatabaseModule();
  // Realtime Database is reserved for low-latency driver / DM-like surfaces.
  await set(ref(database, realtimeDmPath(`${driver.plate}_telemetry`)), {
    ...driver,
    firebaseUid: authUser.uid,
    updatedAt: Date.now(),
  });

  return {
    authUid: authUser.uid,
    syncedAt: Date.now(),
  };
}

export async function saveFirebaseMapPin(pin) {
  const services = await getFirebaseServices();
  if (!services || !pin?.id) {
    return null;
  }

  const { firestore } = services;
  const { collection, doc, setDoc } = await loadFirestoreModule();
  await setDoc(
    doc(collection(firestore, publicCollectionPath("mapPins", resolveAppId())), pin.id),
    {
      ...pin,
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  return {
    syncedAt: Date.now(),
  };
}
