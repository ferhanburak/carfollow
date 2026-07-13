import {
  buildPrivateUserProfile,
  buildPublicUserProfile,
  mergePrivateUserCollections,
  normalizePlate,
} from "../domain/userDocuments";
import { getFirebaseCoreServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
  privateUserCollectionPath,
  privateUserDocumentPath,
  publicCollectionPath,
  publicDocumentPath,
  resolveAppId,
} from "../services/firebasePaths";

function createCruiserAuthError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

async function loadFirestoreProfileCollections(firestore, userId) {
  const { collection, getDocs, query } = await import("firebase/firestore");
  const appId = resolveAppId();
  const [fuelSnapshot, partsSnapshot, serviceSnapshot] = await Promise.all([
    getDocs(query(collection(firestore, privateUserCollectionPath(userId, PRIVATE_COLLECTIONS.fuelLogs, appId)))),
    getDocs(query(collection(firestore, privateUserCollectionPath(userId, PRIVATE_COLLECTIONS.parts, appId)))),
    getDocs(query(collection(firestore, privateUserCollectionPath(userId, PRIVATE_COLLECTIONS.serviceLogs, appId)))),
  ]);

  const mapSnapshot = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  return {
    fuelLogs: mapSnapshot(fuelSnapshot).sort((left, right) => Number(right.currentKm ?? 0) - Number(left.currentKm ?? 0)),
    parts: mapSnapshot(partsSnapshot),
    serviceLogs: mapSnapshot(serviceSnapshot).sort((left, right) =>
      String(right.serviceDate ?? "").localeCompare(String(left.serviceDate ?? "")),
    ),
  };
}

export function isFirebaseAuthRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function loadFirebaseAuthenticatedProfile(firebaseUser) {
  if (!firebaseUser?.uid) {
    throw createCruiserAuthError("cruiser/unauthenticated", "Firebase authentication is required.");
  }

  const services = await getFirebaseCoreServices();
  if (!services) {
    throw createCruiserAuthError("cruiser/firebase-unavailable", "Firebase services are unavailable.");
  }

  const { doc, getDoc } = await import("firebase/firestore");
  const profileSnapshot = await getDoc(
    doc(
      services.firestore,
      privateUserDocumentPath(firebaseUser.uid, PRIVATE_COLLECTIONS.profile, "current", resolveAppId()),
    ),
  );

  if (!profileSnapshot.exists()) {
    throw createCruiserAuthError(
      "cruiser/profile-not-found",
      "This Firebase account does not have a CRUISER profile yet.",
    );
  }

  const { createdAt: _createdAt, updatedAt: _updatedAt, ...profileData } = profileSnapshot.data();
  const collections = await loadFirestoreProfileCollections(services.firestore, firebaseUser.uid);
  return mergePrivateUserCollections(
    {
      ...profileData,
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email ?? profileData.email ?? "",
    },
    collections,
  );
}

async function bootstrapFirebaseProfile(firestore, firebaseUser, user) {
  const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
  const appId = resolveAppId();
  const plateNormalized = normalizePlate(user.plate);
  if (!plateNormalized) {
    throw createCruiserAuthError("cruiser/invalid-plate", "A valid vehicle plate is required.");
  }

  const claimRef = doc(
    firestore,
    publicDocumentPath(PUBLIC_COLLECTIONS.plateClaims, plateNormalized, appId),
  );
  const publicProfileRef = doc(
    firestore,
    publicDocumentPath(PUBLIC_COLLECTIONS.publicProfiles, firebaseUser.uid, appId),
  );
  const privateProfileRef = doc(
    firestore,
    privateUserDocumentPath(firebaseUser.uid, PRIVATE_COLLECTIONS.profile, "current", appId),
  );

  await runTransaction(firestore, async (transaction) => {
    const existingClaim = await transaction.get(claimRef);
    if (existingClaim.exists() && existingClaim.data().uid !== firebaseUser.uid) {
      throw createCruiserAuthError("cruiser/plate-already-in-use", "This vehicle plate is already registered.");
    }

    const createdAt = serverTimestamp();
    if (!existingClaim.exists()) {
      transaction.set(claimRef, {
        uid: firebaseUser.uid,
        plate: user.plate,
        plateNormalized,
        createdAt,
      });
    }
    transaction.set(publicProfileRef, {
      ...buildPublicUserProfile(user, firebaseUser),
      createdAt,
      updatedAt: createdAt,
    });
    transaction.set(privateProfileRef, {
      ...buildPrivateUserProfile(user, firebaseUser),
      createdAt,
      updatedAt: createdAt,
    });

    for (const part of user.parts ?? []) {
      if (!part?.key) {
        continue;
      }
      const partRef = doc(
        firestore,
        privateUserDocumentPath(firebaseUser.uid, PRIVATE_COLLECTIONS.parts, part.key, appId),
      );
      transaction.set(partRef, {
        ...part,
        userId: firebaseUser.uid,
        updatedAt: createdAt,
      });
    }
  });
}

export async function registerFirebaseAccount({ email, password, user }) {
  const services = await getFirebaseCoreServices();
  if (!services) {
    throw createCruiserAuthError("cruiser/firebase-unavailable", "Firebase services are unavailable.");
  }

  const { createUserWithEmailAndPassword, deleteUser } = await import("firebase/auth");
  let credential = null;

  try {
    credential = await createUserWithEmailAndPassword(services.auth, email.trim(), password);
    const nextUser = {
      ...user,
      id: credential.user.uid,
      firebaseUid: credential.user.uid,
      email: credential.user.email ?? email.trim(),
    };
    await bootstrapFirebaseProfile(services.firestore, credential.user, nextUser);
    return mergePrivateUserCollections(
      buildPrivateUserProfile(nextUser, credential.user),
      {
        fuelLogs: nextUser.fuelLogs ?? [],
        parts: nextUser.parts ?? [],
        serviceLogs: nextUser.serviceLogs ?? [],
      },
    );
  } catch (error) {
    if (credential?.user) {
      try {
        await deleteUser(credential.user);
      } catch {
        // The orphan account can be recovered by an administrator if rollback is denied.
      }
    }
    throw error;
  }
}

export async function signInFirebaseAccount(email, password) {
  const services = await getFirebaseCoreServices();
  if (!services) {
    throw createCruiserAuthError("cruiser/firebase-unavailable", "Firebase services are unavailable.");
  }

  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const credential = await signInWithEmailAndPassword(services.auth, email.trim(), password);
  return loadFirebaseAuthenticatedProfile(credential.user);
}

export async function signOutFirebaseAccount() {
  const services = await getFirebaseCoreServices();
  if (!services) {
    return;
  }

  const { signOut } = await import("firebase/auth");
  await signOut(services.auth);
}

export async function subscribeFirebaseAuthState(onAuthStateChange) {
  const services = await getFirebaseCoreServices();
  if (!services) {
    throw createCruiserAuthError("cruiser/firebase-unavailable", "Firebase services are unavailable.");
  }
  if (typeof onAuthStateChange !== "function") {
    throw new TypeError("onAuthStateChange must be a function.");
  }

  const { onAuthStateChanged } = await import("firebase/auth");
  return onAuthStateChanged(services.auth, onAuthStateChange);
}
