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

  const { firestore, authUser } = services;
  // Private path: /artifacts/{appId}/users/{userId}/{collectionName}
  await setDoc(
    doc(firestore, privateUserCollectionPath(authUser.uid, "profile", resolveAppId()), "current"),
    {
      ...user,
      firebaseUid: authUser.uid,
    },
    { merge: true },
  );
}

export async function saveFirebaseFuelLog(nextLog) {
  const services = await getFirebaseServices();
  if (!services) {
    return;
  }

  const { firestore, authUser } = services;
  await addDoc(collection(firestore, privateUserCollectionPath(authUser.uid, "fuelLogs", resolveAppId())), nextLog);
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

  const { database, authUser } = services;
  if (!database) {
    return;
  }

  // Realtime Database is reserved for low-latency driver / DM-like surfaces.
  await set(ref(database, realtimeDmPath(`${driver.plate}_telemetry`)), {
    ...driver,
    firebaseUid: authUser.uid,
    updatedAt: Date.now(),
  });
}
