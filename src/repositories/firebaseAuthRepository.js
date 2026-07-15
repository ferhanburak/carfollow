import {
  buildPrivateUserProfile,
  buildPublicUserProfile,
  normalizePlate,
} from "../domain/userDocuments";
import {
  buildVehicleDocument,
  buildVehiclePartDocument,
  buildVehiclePassportDocument,
  mergeVehiclePassportBundle,
  resolvePrimaryVehicleId,
  vehiclePartDocumentId,
} from "../domain/vehicleDocuments";
import { loadFirebaseVehiclePassportBundle } from "./firebaseVehiclePassportRepository";
import { getFirebaseCoreServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
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

async function bootstrapFirebaseProfile(firestore, firebaseUser, user) {
  const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
  const appId = resolveAppId();
  const plateNormalized = normalizePlate(user.plate);
  if (!plateNormalized) {
    throw createCruiserAuthError("cruiser/invalid-plate", "A valid vehicle plate is required.");
  }

  const vehicleId = resolvePrimaryVehicleId(user, firebaseUser.uid);
  const preparedUser = {
    ...user,
    id: firebaseUser.uid,
    firebaseUid: firebaseUser.uid,
    primaryVehicleId: vehicleId,
  };
  const vehicleDocument = buildVehicleDocument(preparedUser, firebaseUser.uid);
  const passportDocument = buildVehiclePassportDocument(preparedUser, firebaseUser.uid);
  const preparedParts = (preparedUser.parts ?? []).map((part) =>
    buildVehiclePartDocument(part, firebaseUser.uid, vehicleId),
  );
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
  const vehicleRef = doc(
    firestore,
    privateUserDocumentPath(firebaseUser.uid, PRIVATE_COLLECTIONS.vehicles, vehicleId, appId),
  );
  const passportRef = doc(
    firestore,
    privateUserDocumentPath(firebaseUser.uid, PRIVATE_COLLECTIONS.vehiclePassports, vehicleId, appId),
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
        vehicleId,
        plate: preparedUser.plate,
        plateNormalized,
        createdAt,
      });
    }
    transaction.set(publicProfileRef, {
      ...buildPublicUserProfile(preparedUser, firebaseUser),
      createdAt,
      updatedAt: createdAt,
    });
    const privateProfile = buildPrivateUserProfile(preparedUser, firebaseUser);
    transaction.set(privateProfileRef, {
      ...privateProfile,
      privacyConsent: {
        ...privateProfile.privacyConsent,
        kvkkAcceptedAt: createdAt,
        plateSearchConsent: preparedUser.privacy?.plateSearchEnabled === true,
      },
      createdAt,
      updatedAt: createdAt,
    });
    transaction.set(vehicleRef, {
      ...vehicleDocument,
      createdAt,
      updatedAt: createdAt,
    });
    transaction.set(passportRef, {
      ...passportDocument,
      issuedAt: createdAt,
      updatedAt: createdAt,
    });

    for (const part of preparedParts) {
      if (!part?.key) {
        continue;
      }
      const partRef = doc(
        firestore,
        privateUserDocumentPath(
          firebaseUser.uid,
          PRIVATE_COLLECTIONS.parts,
          vehiclePartDocumentId(vehicleId, part.key),
          appId,
        ),
      );
      transaction.set(partRef, {
        ...part,
        createdAt,
        updatedAt: createdAt,
      });
    }
  });

  return {
    preparedUser,
    vehicle: vehicleDocument,
    passport: passportDocument,
    parts: preparedParts,
  };
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
    const bootstrap = await bootstrapFirebaseProfile(services.firestore, credential.user, nextUser);
    return mergeVehiclePassportBundle(
      buildPrivateUserProfile(bootstrap.preparedUser, credential.user),
      {
        vehicle: bootstrap.vehicle,
        passport: bootstrap.passport,
        fuelLogs: bootstrap.preparedUser.fuelLogs ?? [],
        parts: bootstrap.parts,
        serviceLogs: bootstrap.preparedUser.serviceLogs ?? [],
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
