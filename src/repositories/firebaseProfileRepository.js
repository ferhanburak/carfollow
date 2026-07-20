import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import { resolveAppId } from "../services/firebasePaths";
import { validateProfileImageFile } from "../utils/profileImages";

function profileError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function isFirebaseProfileRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function uploadFirebaseProfileAvatar(file) {
  const validationError = validateProfileImageFile(file);
  if (validationError) throw profileError("cruiser/avatar-invalid", validationError);
  if (!file) return { avatarUrl: "", storagePath: "" };

  const services = await getFirebaseServices();
  if (!services?.storage) throw profileError("cruiser/storage-unavailable", "Firebase Storage kullanilamiyor.");

  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const storagePath = `artifacts/${resolveAppId()}/users/${services.authUser.uid}/avatars/current`;
  const avatarRef = ref(services.storage, storagePath);
  await uploadBytes(avatarRef, file, { contentType: file.type, cacheControl: "public,max-age=3600" });
  const downloadUrl = await getDownloadURL(avatarRef);
  const separator = downloadUrl.includes("?") ? "&" : "?";
  return { avatarUrl: `${downloadUrl}${separator}v=${Date.now()}`, storagePath };
}

export async function deleteFirebaseProfileAvatar(storagePath) {
  if (!storagePath) return;
  const services = await getFirebaseServices();
  if (!services?.storage) return;
  const { deleteObject, ref } = await import("firebase/storage");
  await deleteObject(ref(services.storage, storagePath)).catch(() => {});
}

export async function updateFirebaseVehicleProfile(profile) {
  const services = await getFirebaseServices();
  if (!services?.authUser) throw profileError("cruiser/unauthenticated", "Firebase hesabi gerekli.");
  const { httpsCallable } = await import("firebase/functions");
  const result = await httpsCallable(services.functions, "updateVehicleProfile")({ profile });
  return result.data;
}
