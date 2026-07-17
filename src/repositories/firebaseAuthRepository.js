import { mergeVehiclePassportBundle } from "../domain/vehicleDocuments";
import { loadFirebaseVehiclePassportBundle } from "./firebaseVehiclePassportRepository";
import { getFirebaseCoreServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import {
  PRIVATE_COLLECTIONS,
  privateUserDocumentPath,
  resolveAppId,
} from "../services/firebasePaths";

function createCruiserAuthError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
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
  const vehicleBundle = await loadFirebaseVehiclePassportBundle(
    services.firestore,
    firebaseUser,
    {
      ...profileData,
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email ?? profileData.email ?? "",
    },
  );
  return mergeVehiclePassportBundle(
    {
      ...profileData,
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email ?? profileData.email ?? "",
    },
    vehicleBundle,
  );
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
      primaryVehicleId: `vehicle-${credential.user.uid}`,
      email: credential.user.email ?? email.trim(),
    };
    const { httpsCallable } = await import("firebase/functions");
    await httpsCallable(services.functions, "finalizeRegistration")({
      profile: nextUser,
      acceptKvkk: true,
    });
    return loadFirebaseAuthenticatedProfile(credential.user);
  } catch (error) {
    if (credential?.user) {
      try {
        await deleteUser(credential.user);
      } catch {
        // The orphan account can be recovered by an administrator if rollback is denied.
      }
    }
    if (error?.code === "functions/already-exists") {
      throw createCruiserAuthError("cruiser/plate-already-in-use", "This vehicle plate is already registered.", error);
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
