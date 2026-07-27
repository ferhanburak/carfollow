import { getFirebaseServices } from "../services/firebaseClient";
import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
  privateUserDocumentPath,
  publicCollectionPath,
  resolveAppId,
} from "../services/firebasePaths";

function createRepositoryError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function normalizeCallableError(error, fallbackMessage) {
  const code = String(error?.code ?? "cruiser/driver-stats-failed");
  return createRepositoryError(code, error instanceof Error ? error.message : fallbackMessage, error);
}

async function callDriverFunction(functionName, payload = {}) {
  const services = await getFirebaseServices();
  if (!services?.functions) {
    throw createRepositoryError(
      "cruiser/functions-unavailable",
      "Secure driver statistics service is unavailable.",
    );
  }

  const { httpsCallable } = await import("firebase/functions");
  try {
    const callable = httpsCallable(services.functions, functionName);
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    throw normalizeCallableError(error, `${functionName} could not be completed.`);
  }
}

async function readDriverStatsDocument(services, firestoreModule = null) {
  const { doc, getDoc } = firestoreModule ?? await import("firebase/firestore");
  const snapshot = await getDoc(doc(
    services.firestore,
    privateUserDocumentPath(
      services.authUser.uid,
      PRIVATE_COLLECTIONS.driverStats,
      "current",
      resolveAppId(),
    ),
  ));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function loadFirebaseIndividualLeaderboard(servicesOverride = null, firestoreModule = null) {
  const services = servicesOverride ?? await getFirebaseServices();
  if (!services) {
    return [];
  }

  const { collection, getDocs, query } = firestoreModule ?? await import("firebase/firestore");
  const snapshot = await getDocs(query(collection(
    services.firestore,
    publicCollectionPath(PUBLIC_COLLECTIONS.individualLeaderboard, resolveAppId()),
  )));

  return snapshot.docs.map((entry) => ({
    ...entry.data(),
    id: entry.data().id ?? entry.id,
    firestoreId: entry.id,
  }));
}

export async function loadFirebaseDriverStatsState({ forceRefresh = false } = {}) {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  let stats = null;
  let partHealth = [];
  const warnings = [];
  const firestoreModule = await import("firebase/firestore");
  const leaderboardPromise = loadFirebaseIndividualLeaderboard(services, firestoreModule)
    .then((entries) => ({ entries, error: null }))
    .catch((error) => ({ entries: [], error }));

  if (!forceRefresh) {
    try {
      stats = await readDriverStatsDocument(services, firestoreModule);
    } catch (readError) {
      warnings.push(readError instanceof Error ? readError.message : "Driver stats could not be read.");
    }
  }

  if (forceRefresh || !stats) {
    try {
      const refreshed = await callDriverFunction("refreshDriverStats");
      stats = refreshed?.stats ?? stats;
      partHealth = refreshed?.partHealth ?? [];
    } catch (error) {
      warnings.push(error.message);
      if (!stats) {
        try {
          stats = await readDriverStatsDocument(services, firestoreModule);
        } catch (readError) {
          warnings.push(readError instanceof Error ? readError.message : "Driver stats could not be read.");
        }
      }
    }
  }

  const leaderboardResult = await leaderboardPromise;
  if (leaderboardResult.error) {
    warnings.push(
      leaderboardResult.error instanceof Error
        ? leaderboardResult.error.message
        : "Leaderboard could not be read.",
    );
  }

  return {
    authUid: services.authUser.uid,
    stats,
    partHealth,
    leaderboardEntries: leaderboardResult.entries,
    warning: warnings.filter(Boolean).join(" "),
    syncedAt: Date.now(),
  };
}

export async function startFirebaseDriveSession(sessionId) {
  if (!sessionId) {
    throw createRepositoryError("cruiser/invalid-drive-session", "Drive session identity is missing.");
  }
  return callDriverFunction("startDriveSession", { sessionId });
}

export async function finishFirebaseDriveSession(sessionId, summaryOrReportedKm) {
  const summary = summaryOrReportedKm && typeof summaryOrReportedKm === "object"
    ? summaryOrReportedKm
    : { reportedKm: summaryOrReportedKm };
  const payload = {
    acceptedSampleCount: Number(summary.acceptedSampleCount ?? 0),
    qualifiedSpeedSampleCount: Number(summary.qualifiedSpeedSampleCount ?? 0),
    reportedKm: Number(summary.reportedKm),
    reportedMaxSpeedKmh: Number(summary.reportedMaxSpeedKmh ?? 0),
    reportedMovingSeconds: Number(summary.reportedMovingSeconds ?? 0),
    sessionId,
  };
  const numericFields = [
    payload.acceptedSampleCount,
    payload.qualifiedSpeedSampleCount,
    payload.reportedKm,
    payload.reportedMaxSpeedKmh,
    payload.reportedMovingSeconds,
  ];
  if (!sessionId || numericFields.some((value) => !Number.isFinite(value) || value < 0)) {
    throw createRepositoryError("cruiser/invalid-drive-session", "Drive session result is invalid.");
  }
  return callDriverFunction("finishDriveSession", payload);
}
