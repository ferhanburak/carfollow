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

async function readDriverStatsDocument(services) {
  const { doc, getDoc } = await import("firebase/firestore");
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

export async function loadFirebaseIndividualLeaderboard() {
  const services = await getFirebaseServices();
  if (!services) {
    return [];
  }

  const { collection, getDocs, query } = await import("firebase/firestore");
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

export async function loadFirebaseDriverStatsState() {
  const services = await getFirebaseServices();
  if (!services) {
    return null;
  }

  let stats = null;
  let partHealth = [];
  const warnings = [];
  try {
    const refreshed = await callDriverFunction("refreshDriverStats");
    stats = refreshed?.stats ?? null;
    partHealth = refreshed?.partHealth ?? [];
  } catch (error) {
    warnings.push(error.message);
    try {
      stats = await readDriverStatsDocument(services);
    } catch (readError) {
      warnings.push(readError instanceof Error ? readError.message : "Driver stats could not be read.");
    }
  }

  let leaderboardEntries = [];
  try {
    leaderboardEntries = await loadFirebaseIndividualLeaderboard();
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Leaderboard could not be read.");
  }

  return {
    authUid: services.authUser.uid,
    stats,
    partHealth,
    leaderboardEntries,
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

export async function finishFirebaseDriveSession(sessionId, reportedKm) {
  if (!sessionId || !Number.isFinite(Number(reportedKm)) || Number(reportedKm) < 0) {
    throw createRepositoryError("cruiser/invalid-drive-session", "Drive session result is invalid.");
  }
  return callDriverFunction("finishDriveSession", {
    sessionId,
    reportedKm: Number(reportedKm),
  });
}
