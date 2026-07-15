import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";

export function isFirebaseModerationRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function submitFirebaseModerationReport(payload) {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error("Firebase authentication is required for reports.");
  }
  const { httpsCallable } = await import("firebase/functions");
  const result = await httpsCallable(services.functions, "submitModerationReport")(payload);
  return result.data;
}
