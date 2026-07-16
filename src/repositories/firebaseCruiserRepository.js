import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
  privateUserCollectionPath,
  privateUserDocumentPath,
  publicCollectionPath,
  realtimePresencePath,
  realtimePresenceUserPath,
  realtimeTelemetryUserPath,
  realtimeDmThreadTypingPath,
  realtimeDmThreadsPath,
  realtimeDmThreadPath,
  resolveAppId,
} from "../services/firebasePaths";
import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import { buildPrivateUserProfilePatch, buildPublicUserProfilePatch } from "../domain/userDocuments";
import { buildVehicleProfilePatch, resolvePrimaryVehicleId } from "../domain/vehicleDocuments";

function mapCollectionSnapshot(snapshot) {
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

async function loadFirestoreModule() {
  return import("firebase/firestore");
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
  const driversSnapshot = await getDocs(query(
    collection(firestore, publicCollectionPath(PUBLIC_COLLECTIONS.drivers, resolveAppId())),
  ));

  return {
    drivers: mapCollectionSnapshot(driversSnapshot),
  };
}

export async function saveFirebaseUserProfile(user) {
  const services = await getFirebaseServices();
  if (!services || !user?.id) {
    return null;
  }

  const { firestore, authUser } = services;
  const { doc, serverTimestamp, writeBatch } = await loadFirestoreModule();
  const batch = writeBatch(firestore);
  const updatedAt = serverTimestamp();
  const vehicleId = resolvePrimaryVehicleId(user, authUser.uid);
  // Private path: /artifacts/{appId}/users/{userId}/{collectionName}
  batch.set(
    doc(firestore, privateUserCollectionPath(authUser.uid, PRIVATE_COLLECTIONS.profile, resolveAppId()), "current"),
    {
      ...buildPrivateUserProfilePatch(user, authUser),
      updatedAt,
    },
    { merge: true },
  );
  batch.set(
    doc(firestore, publicCollectionPath(PUBLIC_COLLECTIONS.publicProfiles, resolveAppId()), authUser.uid),
    {
      ...buildPublicUserProfilePatch(user, authUser),
      updatedAt,
    },
    { merge: true },
  );
  batch.update(
    doc(
      firestore,
      privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.vehicles, vehicleId, resolveAppId()),
    ),
    {
      ...buildVehicleProfilePatch(user),
      updatedAt,
    },
  );
  await batch.commit();

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
  const { authUser } = services;
  const { addDoc, collection, serverTimestamp } = await loadFirestoreModule();
  await addDoc(collection(firestore, publicCollectionPath(PUBLIC_COLLECTIONS.washReviews, resolveAppId())), {
    pinId,
    ...review,
    userId: authUser.uid,
    createdAt: serverTimestamp(),
  });
}

export async function saveFirebaseCruiseJoin(pinId, plate) {
  const services = await getFirebaseServices();
  if (!services || !pinId || !plate) {
    return;
  }

  const { firestore, authUser } = services;
  const { collection, doc, serverTimestamp, setDoc } = await loadFirestoreModule();
  await setDoc(
    doc(
      collection(firestore, publicCollectionPath(PUBLIC_COLLECTIONS.cruiseAttendees, resolveAppId())),
      `${pinId}_${authUser.uid}`,
    ),
    { pinId, plate, userId: authUser.uid, joinedAt: serverTimestamp() },
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

  const { ref, serverTimestamp, set } = await loadDatabaseModule();
  // Realtime Database is reserved for low-latency driver / DM-like surfaces.
  await set(ref(database, realtimeTelemetryUserPath(authUser.uid, resolveAppId())), {
    ...driver,
    firebaseUid: authUser.uid,
    updatedAt: serverTimestamp(),
  });

  return {
    authUid: authUser.uid,
    syncedAt: Date.now(),
  };
}

function normalizeFirebaseThread(threadId, payload, userPlate) {
  if (!payload || !userPlate) {
    return null;
  }

  const participants = payload.participants ?? [];
  if (!participants.includes(userPlate)) {
    return null;
  }

  const participant = (payload.participantProfiles ?? []).find((entry) => entry.plate !== userPlate) ?? {};
  const messages = Object.entries(payload.messages ?? {})
    .map(([messageId, message]) => ({
      id: message.id ?? messageId,
      ...message,
    }))
    .sort((left, right) => Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0));

  return {
    id: threadId,
    participantPlate: participant.plate ?? payload.participants?.find((plate) => plate !== userPlate) ?? "UNKNOWN",
    participantName: participant.fullName ?? participant.plate ?? "Unknown Driver",
    participantModel: participant.model ?? "Unknown Setup",
    participantAvatar: participant.avatar ?? "",
    messages,
    updatedAt: Number(payload.updatedAt ?? 0),
  };
}

export async function subscribeFirebaseDirectMessages(userPlate, onThreadsChange) {
  const services = await getFirebaseServices();
  if (!services || !services.database || !userPlate || typeof onThreadsChange !== "function") {
    return () => {};
  }

  const { database } = services;
  const { onValue, ref } = await loadDatabaseModule();
  // Realtime Database schema for low-latency plate-based DM:
  // /artifacts/{appId}/realtime/directMessages/threads/{threadId}
  const threadsRef = ref(database, realtimeDmThreadsPath(resolveAppId()));

  const unsubscribe = onValue(threadsRef, (snapshot) => {
    const rawThreads = snapshot.val() ?? {};
    const conversations = Object.fromEntries(
      Object.entries(rawThreads)
        .map(([threadId, payload]) => [threadId, normalizeFirebaseThread(threadId, payload, userPlate)])
        .filter(([, conversation]) => Boolean(conversation)),
    );

    onThreadsChange(conversations);
  });

  return unsubscribe;
}

export async function subscribeFirebaseTyping(threadId, onTypingChange) {
  const services = await getFirebaseServices();
  if (!services || !services.database || !threadId || typeof onTypingChange !== "function") {
    return () => {};
  }

  const { database } = services;
  const { onValue, ref } = await loadDatabaseModule();
  const typingRef = ref(database, realtimeDmThreadTypingPath(threadId, resolveAppId()));

  const unsubscribe = onValue(typingRef, (snapshot) => {
    onTypingChange(snapshot.val() ?? {});
  });

  return unsubscribe;
}

export async function saveFirebaseDirectMessage(threadId, participants, participantProfiles, message) {
  const services = await getFirebaseServices();
  if (!services || !services.database || !threadId || !participants?.length || !message) {
    return null;
  }

  const { database, authUser } = services;
  const { ref, set, update } = await loadDatabaseModule();
  const threadRef = ref(database, realtimeDmThreadPath(threadId, resolveAppId()));
  const messageId = message.id ?? `msg-${Date.now()}`;
  const nextMessageRef = ref(database, `${realtimeDmThreadPath(threadId, resolveAppId())}/messages/${messageId}`);
  const nextMessage = {
    ...message,
    id: messageId,
    firebaseUid: authUser.uid,
  };

  await Promise.all([
    update(threadRef, {
      id: threadId,
      participants,
      participantProfiles,
      updatedAt: Date.now(),
      lastMessage: nextMessage,
    }),
    set(nextMessageRef, {
      ...nextMessage,
    }),
  ]);

  return {
    authUid: authUser.uid,
    syncedAt: Date.now(),
    messageId,
  };
}

export async function saveFirebaseTypingState(threadId, plate, typingState) {
  const services = await getFirebaseServices();
  if (!services || !services.database || !threadId || !plate) {
    return null;
  }

  const { database, authUser } = services;
  const { ref, serverTimestamp, update } = await loadDatabaseModule();
  await update(ref(database, `${realtimeDmThreadTypingPath(threadId, resolveAppId())}/${plate.replaceAll(" ", "_")}`), {
    ...typingState,
    plate,
    firebaseUid: authUser.uid,
    updatedAt: serverTimestamp(),
  });

  return {
    authUid: authUser.uid,
    syncedAt: Date.now(),
  };
}

export async function saveFirebasePresence(plate, presence) {
  const services = await getFirebaseServices();
  if (!services || !services.database || !plate || !presence) {
    return null;
  }

  const { database, authUser } = services;
  const { ref, serverTimestamp, update } = await loadDatabaseModule();
  await update(ref(database, realtimePresenceUserPath(authUser.uid, resolveAppId())), {
    ...presence,
    plate,
    firebaseUid: authUser.uid,
    updatedAt: serverTimestamp(),
  });

  return {
    authUid: authUser.uid,
    syncedAt: Date.now(),
  };
}

export async function subscribeFirebasePresence(plates, onPresenceChange) {
  const services = await getFirebaseServices();
  if (!services || !services.database || typeof onPresenceChange !== "function") {
    return () => {};
  }

  const normalizedPlateSet = new Set((plates ?? []).filter(Boolean).map((plate) => plate.replaceAll(" ", "_")));
  const { database } = services;
  const { onValue, ref } = await loadDatabaseModule();
  const presenceRef = ref(database, realtimePresencePath(resolveAppId()));

  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const payload = snapshot.val() ?? {};
    const filteredPresence = Object.fromEntries(
      Object.entries(payload)
        .filter(([, value]) => normalizedPlateSet.size === 0 || normalizedPlateSet.has(String(value?.plate ?? "").replaceAll(" ", "_")))
        .map(([key, value]) => [value?.plate ?? key, value]),
    );

    onPresenceChange(filteredPresence);
  });

  return unsubscribe;
}

export async function saveFirebaseMapPin(pin) {
  const services = await getFirebaseServices();
  if (!services || !pin?.id) {
    return null;
  }

  const { firestore, authUser } = services;
  const { collection, doc, serverTimestamp, setDoc } = await loadFirestoreModule();
  await setDoc(
    doc(collection(firestore, publicCollectionPath(PUBLIC_COLLECTIONS.mapPins, resolveAppId())), pin.id),
    {
      ...pin,
      createdByUid: pin.createdByUid ?? authUser.uid,
      updatedByUid: authUser.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    syncedAt: Date.now(),
  };
}
