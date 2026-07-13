import { buildPublicUserProfile, USER_SCHEMA_VERSION } from "../domain/userDocuments";
import {
  buildVehicleDocument,
  buildVehiclePartDocument,
  buildVehiclePassportDocument,
  dedupeVehicleParts,
  resolvePrimaryVehicleId,
  scopeVehicleRecords,
  vehiclePartDocumentId,
} from "../domain/vehicleDocuments";
import { getFirebaseServices } from "../services/firebaseClient";
import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
  privateUserCollectionPath,
  privateUserDocumentPath,
  publicDocumentPath,
  resolveAppId,
} from "../services/firebasePaths";
import { createDefaultParts, inferVehicleType } from "../utils/vehicleParts";

function mapCollectionSnapshot(snapshot) {
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      ...data,
      id: data.id ?? item.id,
      firestoreId: item.id,
    };
  });
}

function createRepositoryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireDocument(snapshot, code, message) {
  if (!snapshot.exists()) {
    throw createRepositoryError(code, message);
  }
  return snapshot.data();
}

function numbersMatch(left, right) {
  return Number(left) === Number(right);
}

function isMatchingFuelLog(existingLog, nextLog, userId, vehicleId) {
  return existingLog?.id === nextLog.id &&
    existingLog.userId === userId &&
    existingLog.vehicleId === vehicleId &&
    numbersMatch(existingLog.liters, nextLog.liters) &&
    numbersMatch(existingLog.price, nextLog.price) &&
    numbersMatch(existingLog.currentKm, nextLog.currentKm) &&
    String(existingLog.station ?? "").trim() === String(nextLog.station ?? "").trim();
}

function isMatchingServiceLog(existingLog, nextLog, userId, vehicleId) {
  return existingLog?.id === nextLog.id &&
    existingLog.userId === userId &&
    existingLog.vehicleId === vehicleId &&
    existingLog.partKey === String(nextLog.partKey) &&
    existingLog.type === String(nextLog.type) &&
    existingLog.serviceDate === String(nextLog.serviceDate) &&
    numbersMatch(existingLog.serviceKm, nextLog.serviceKm) &&
    numbersMatch(existingLog.cost, nextLog.cost ?? 0) &&
    String(existingLog.serviceShop ?? "").trim() === String(nextLog.serviceShop ?? "").trim() &&
    String(existingLog.notes ?? "").trim() === String(nextLog.notes ?? "").trim() &&
    String(existingLog.receiptImageUrl ?? "").trim() === String(nextLog.receiptImageUrl ?? "").trim();
}

async function readVehicleBundle(firestore, userId, vehicleId) {
  const { collection, doc, getDoc, getDocs, query } = await import("firebase/firestore");
  const appId = resolveAppId();
  const [vehicleSnapshot, passportSnapshot, fuelSnapshot, partsSnapshot, serviceSnapshot] = await Promise.all([
    getDoc(doc(firestore, privateUserDocumentPath(userId, PRIVATE_COLLECTIONS.vehicles, vehicleId, appId))),
    getDoc(doc(firestore, privateUserDocumentPath(userId, PRIVATE_COLLECTIONS.vehiclePassports, vehicleId, appId))),
    getDocs(query(collection(firestore, privateUserCollectionPath(userId, PRIVATE_COLLECTIONS.fuelLogs, appId)))),
    getDocs(query(collection(firestore, privateUserCollectionPath(userId, PRIVATE_COLLECTIONS.parts, appId)))),
    getDocs(query(collection(firestore, privateUserCollectionPath(userId, PRIVATE_COLLECTIONS.serviceLogs, appId)))),
  ]);

  return {
    vehicle: vehicleSnapshot.exists() ? vehicleSnapshot.data() : null,
    passport: passportSnapshot.exists() ? passportSnapshot.data() : null,
    fuelLogs: mapCollectionSnapshot(fuelSnapshot),
    parts: mapCollectionSnapshot(partsSnapshot),
    serviceLogs: mapCollectionSnapshot(serviceSnapshot),
  };
}

async function migrateLegacyVehiclePassport(firestore, firebaseUser, profile, bundle, vehicleId) {
  const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
  const appId = resolveAppId();
  const userId = firebaseUser.uid;
  const migratedParts = dedupeVehicleParts(bundle.parts, vehicleId);
  const sourceParts = migratedParts.length
    ? migratedParts
    : createDefaultParts(profile.vehicleType ?? inferVehicleType(profile.model), profile.odometer);
  const preparedUser = {
    ...profile,
    primaryVehicleId: vehicleId,
    fuelLogs: scopeVehicleRecords(bundle.fuelLogs, vehicleId),
    parts: sourceParts,
    serviceLogs: scopeVehicleRecords(bundle.serviceLogs, vehicleId),
  };
  const vehicleDocument = buildVehicleDocument(preparedUser, userId);
  const passportDocument = buildVehiclePassportDocument(preparedUser, userId);
  const privateProfileRef = doc(
    firestore,
    privateUserDocumentPath(userId, PRIVATE_COLLECTIONS.profile, "current", appId),
  );
  const publicProfileRef = doc(
    firestore,
    publicDocumentPath(PUBLIC_COLLECTIONS.publicProfiles, userId, appId),
  );
  const vehicleRef = doc(
    firestore,
    privateUserDocumentPath(userId, PRIVATE_COLLECTIONS.vehicles, vehicleId, appId),
  );
  const passportRef = doc(
    firestore,
    privateUserDocumentPath(userId, PRIVATE_COLLECTIONS.vehiclePassports, vehicleId, appId),
  );
  const partRecords = sourceParts.map((part) => ({
    part,
    ref: doc(
      firestore,
      privateUserDocumentPath(
        userId,
        PRIVATE_COLLECTIONS.parts,
        vehiclePartDocumentId(vehicleId, part.key),
        appId,
      ),
    ),
  }));

  await runTransaction(firestore, async (transaction) => {
    const [privateProfileSnapshot, publicProfileSnapshot, vehicleSnapshot, passportSnapshot, ...partSnapshots] =
      await Promise.all([
        transaction.get(privateProfileRef),
        transaction.get(publicProfileRef),
        transaction.get(vehicleRef),
        transaction.get(passportRef),
        ...partRecords.map(({ ref }) => transaction.get(ref)),
      ]);

    if (!privateProfileSnapshot.exists()) {
      throw createRepositoryError("cruiser/profile-not-found", "CRUISER profile could not be migrated.");
    }

    const timestamp = serverTimestamp();
    transaction.update(privateProfileRef, {
      primaryVehicleId: vehicleId,
      schemaVersion: USER_SCHEMA_VERSION,
      updatedAt: timestamp,
    });

    if (publicProfileSnapshot.exists()) {
      transaction.update(publicProfileRef, {
        primaryVehicleId: vehicleId,
        schemaVersion: USER_SCHEMA_VERSION,
        updatedAt: timestamp,
      });
    } else {
      transaction.set(publicProfileRef, {
        ...buildPublicUserProfile(preparedUser, firebaseUser),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    if (!vehicleSnapshot.exists()) {
      transaction.set(vehicleRef, {
        ...vehicleDocument,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    if (!passportSnapshot.exists()) {
      transaction.set(passportRef, {
        ...passportDocument,
        issuedAt: timestamp,
        updatedAt: timestamp,
      });
    }

    partRecords.forEach(({ part, ref }, index) => {
      if (partSnapshots[index].exists()) {
        return;
      }

      transaction.set(ref, {
        ...buildVehiclePartDocument(part, userId, vehicleId),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  });
}

export async function loadFirebaseVehiclePassportBundle(firestore, firebaseUser, profile) {
  const vehicleId = resolvePrimaryVehicleId(profile, firebaseUser.uid);
  let bundle = await readVehicleBundle(firestore, firebaseUser.uid, vehicleId);
  const scopedPartKeys = new Set(
    bundle.parts.filter((part) => part.vehicleId === vehicleId).map((part) => part.key),
  );
  const needsPartMigration = dedupeVehicleParts(bundle.parts, vehicleId).some(
    (part) => !scopedPartKeys.has(part.key),
  ) || bundle.parts.length === 0;

  if (!profile.primaryVehicleId || !bundle.vehicle || !bundle.passport || needsPartMigration) {
    await migrateLegacyVehiclePassport(firestore, firebaseUser, profile, bundle, vehicleId);
    bundle = await readVehicleBundle(firestore, firebaseUser.uid, vehicleId);
  }

  if (!bundle.vehicle || !bundle.passport) {
    throw createRepositoryError(
      "cruiser/vehicle-passport-not-found",
      "Vehicle Passport could not be initialized for this account.",
    );
  }

  return {
    vehicle: bundle.vehicle,
    passport: bundle.passport,
    fuelLogs: scopeVehicleRecords(bundle.fuelLogs, vehicleId).sort(
      (left, right) => Number(right.currentKm ?? 0) - Number(left.currentKm ?? 0),
    ),
    parts: dedupeVehicleParts(bundle.parts, vehicleId),
    serviceLogs: scopeVehicleRecords(bundle.serviceLogs, vehicleId).sort((left, right) =>
      String(right.serviceDate ?? "").localeCompare(String(left.serviceDate ?? "")),
    ),
  };
}

export async function saveFirebaseFuelLog(nextLog) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { firestore, authUser } = services;
  const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
  const appId = resolveAppId();
  const vehicleId = String(nextLog?.vehicleId ?? "");
  if (!nextLog?.id || !vehicleId) {
    throw createRepositoryError("cruiser/invalid-fuel-log", "Fuel log identity is missing.");
  }

  const fuelLogRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.fuelLogs, nextLog.id, appId),
  );
  const vehicleRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.vehicles, vehicleId, appId),
  );
  const passportRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.vehiclePassports, vehicleId, appId),
  );
  const profileRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.profile, "current", appId),
  );

  const mutation = await runTransaction(firestore, async (transaction) => {
    const [fuelLogSnapshot, vehicleSnapshot, passportSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(fuelLogRef),
      transaction.get(vehicleRef),
      transaction.get(passportRef),
      transaction.get(profileRef),
    ]);
    const vehicle = requireDocument(
      vehicleSnapshot,
      "cruiser/vehicle-not-found",
      "The active vehicle could not be found.",
    );
    const passport = requireDocument(
      passportSnapshot,
      "cruiser/vehicle-passport-not-found",
      "The active Vehicle Passport could not be found.",
    );
    const profile = requireDocument(
      profileSnapshot,
      "cruiser/profile-not-found",
      "The active CRUISER profile could not be found.",
    );

    if (fuelLogSnapshot.exists() && !isMatchingFuelLog(fuelLogSnapshot.data(), nextLog, authUser.uid, vehicleId)) {
      throw createRepositoryError(
        "cruiser/fuel-log-id-conflict",
        "A different fuel record already uses this record identity.",
      );
    }
    if (fuelLogSnapshot.exists()) {
      return { duplicate: true, odometer: Number(vehicle.odometer ?? 0) };
    }
    if (profile.primaryVehicleId !== vehicleId || vehicle.ownerId !== authUser.uid) {
      throw createRepositoryError("cruiser/vehicle-owner-mismatch", "Vehicle ownership validation failed.");
    }

    const timestamp = serverTimestamp();
    const currentKm = Number(nextLog.currentKm);
    const nextOdometer = Math.max(Number(vehicle.odometer ?? 0), Number(profile.odometer ?? 0), currentKm);
    transaction.set(fuelLogRef, {
      id: nextLog.id,
      vehicleId,
      userId: authUser.uid,
      liters: Number(nextLog.liters),
      price: Number(nextLog.price),
      currentKm,
      station: String(nextLog.station ?? "").trim(),
      createdAt: timestamp,
    });
    transaction.update(vehicleRef, {
      odometer: nextOdometer,
      lastOdometerSource: "fuel",
      updatedAt: timestamp,
    });
    transaction.update(profileRef, {
      odometer: nextOdometer,
      updatedAt: timestamp,
    });
    transaction.update(passportRef, {
      fuelLogCount: Number(passport.fuelLogCount ?? 0) + 1,
      lastFuelKm: currentKm,
      lastMutationId: nextLog.id,
      lastMutationType: "fuel",
      updatedAt: timestamp,
    });

    return { duplicate: false, odometer: nextOdometer };
  });

  return {
    authUid: authUser.uid,
    vehicleId,
    ...mutation,
    syncedAt: Date.now(),
  };
}

export async function saveFirebaseServiceLog(serviceLog, servicedPart) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  const { firestore, authUser } = services;
  const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
  const appId = resolveAppId();
  const vehicleId = String(serviceLog?.vehicleId ?? "");
  const isReplacement = serviceLog?.type === "replacement";
  if (!serviceLog?.id || !vehicleId || (isReplacement && !servicedPart?.key)) {
    throw createRepositoryError("cruiser/invalid-service-log", "Service log identity is incomplete.");
  }

  const serviceLogRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.serviceLogs, serviceLog.id, appId),
  );
  const vehicleRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.vehicles, vehicleId, appId),
  );
  const passportRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.vehiclePassports, vehicleId, appId),
  );
  const profileRef = doc(
    firestore,
    privateUserDocumentPath(authUser.uid, PRIVATE_COLLECTIONS.profile, "current", appId),
  );
  const partRef = isReplacement
    ? doc(
        firestore,
        privateUserDocumentPath(
          authUser.uid,
          PRIVATE_COLLECTIONS.parts,
          vehiclePartDocumentId(vehicleId, servicedPart.key),
          appId,
        ),
      )
    : null;

  const mutation = await runTransaction(firestore, async (transaction) => {
    const [serviceLogSnapshot, vehicleSnapshot, passportSnapshot, profileSnapshot, partSnapshot] =
      await Promise.all([
        transaction.get(serviceLogRef),
        transaction.get(vehicleRef),
        transaction.get(passportRef),
        transaction.get(profileRef),
        partRef ? transaction.get(partRef) : Promise.resolve(null),
      ]);
    const vehicle = requireDocument(
      vehicleSnapshot,
      "cruiser/vehicle-not-found",
      "The active vehicle could not be found.",
    );
    const passport = requireDocument(
      passportSnapshot,
      "cruiser/vehicle-passport-not-found",
      "The active Vehicle Passport could not be found.",
    );
    const profile = requireDocument(
      profileSnapshot,
      "cruiser/profile-not-found",
      "The active CRUISER profile could not be found.",
    );

    if (
      serviceLogSnapshot.exists() &&
      !isMatchingServiceLog(serviceLogSnapshot.data(), serviceLog, authUser.uid, vehicleId)
    ) {
      throw createRepositoryError(
        "cruiser/service-log-id-conflict",
        "A different service record already uses this record identity.",
      );
    }
    if (serviceLogSnapshot.exists()) {
      return { duplicate: true, odometer: Number(vehicle.odometer ?? 0) };
    }
    if (profile.primaryVehicleId !== vehicleId || vehicle.ownerId !== authUser.uid) {
      throw createRepositoryError("cruiser/vehicle-owner-mismatch", "Vehicle ownership validation failed.");
    }

    const timestamp = serverTimestamp();
    const serviceKm = Number(serviceLog.serviceKm);
    const serviceCost = Number(serviceLog.cost ?? 0);
    const nextOdometer = Math.max(Number(vehicle.odometer ?? 0), Number(profile.odometer ?? 0), serviceKm);
    transaction.set(serviceLogRef, {
      id: serviceLog.id,
      vehicleId,
      userId: authUser.uid,
      partKey: String(serviceLog.partKey),
      type: String(serviceLog.type),
      serviceDate: String(serviceLog.serviceDate),
      serviceKm,
      serviceShop: String(serviceLog.serviceShop ?? "").trim(),
      cost: serviceCost,
      notes: String(serviceLog.notes ?? "").trim(),
      receiptImageUrl: String(serviceLog.receiptImageUrl ?? "").trim(),
      createdAt: timestamp,
    });
    transaction.update(vehicleRef, {
      odometer: nextOdometer,
      lastOdometerSource: "service",
      lastServiceDate: String(serviceLog.serviceDate),
      updatedAt: timestamp,
    });
    transaction.update(profileRef, {
      odometer: nextOdometer,
      updatedAt: timestamp,
    });
    transaction.update(passportRef, {
      serviceLogCount: Number(passport.serviceLogCount ?? 0) + 1,
      totalServiceSpend: Number(passport.totalServiceSpend ?? 0) + serviceCost,
      lastServiceDate: String(serviceLog.serviceDate),
      lastMutationId: serviceLog.id,
      lastMutationType: "service",
      updatedAt: timestamp,
    });

    if (partRef) {
      transaction.set(partRef, {
        ...buildVehiclePartDocument(
          { ...servicedPart, lastServiceLogId: serviceLog.id },
          authUser.uid,
          vehicleId,
        ),
        createdAt: partSnapshot?.exists() ? partSnapshot.data().createdAt : timestamp,
        updatedAt: timestamp,
      });
    }

    return { duplicate: false, odometer: nextOdometer };
  });

  return {
    authUid: authUser.uid,
    vehicleId,
    ...mutation,
    syncedAt: Date.now(),
  };
}
