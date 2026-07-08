import { ref, set } from "firebase/database";
import { addDoc, collection, doc, getDocs, query, setDoc } from "firebase/firestore";
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

export function isFirebaseRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function loadFirebaseWorldState() {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { firestore } = services;
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
    return;
  }

  const { firestore } = services;
  // Private path: /artifacts/{appId}/users/{userId}/{collectionName}
  await setDoc(doc(firestore, privateUserCollectionPath(user.id, "profile", resolveAppId()), "current"), user, {
    merge: true,
  });
}

export async function saveFirebaseFuelLog(userId, nextLog) {
  const services = await getFirebaseServices();
  if (!services || !userId) {
    return;
  }

  const { firestore } = services;
  await addDoc(collection(firestore, privateUserCollectionPath(userId, "fuelLogs", resolveAppId())), nextLog);
}

export async function saveFirebaseWashReview(pinId, review) {
  const services = await getFirebaseServices();
  if (!services || !pinId) {
    return;
  }

  const { firestore } = services;
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
  await setDoc(
    doc(collection(firestore, publicCollectionPath("cruiseAttendees", resolveAppId())), `${pinId}_${plate}`),
    { pinId, plate, joinedAt: Date.now() },
    { merge: true },
  );
}

export async function saveFirebaseActiveDriver(driver) {
  const services = await getFirebaseServices();
  if (!services || !driver?.plate) {
    return;
  }

  const { database } = services;
  if (!database) {
    return;
  }

  // Realtime Database is reserved for low-latency driver / DM-like surfaces.
  await set(ref(database, realtimeDmPath(`${driver.plate}_telemetry`)), {
    ...driver,
    updatedAt: Date.now(),
  });
}
