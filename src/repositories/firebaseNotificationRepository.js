import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import { PRIVATE_COLLECTIONS, privateUserCollectionPath, resolveAppId } from "../services/firebasePaths";

export const USER_NOTIFICATION_TYPES = Object.freeze(["friend-request", "convoy-invite"]);

export function isUserNotificationType(type) {
  return USER_NOTIFICATION_TYPES.includes(String(type ?? ""));
}

function toMillis(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }
  return Number(value ?? 0);
}

export function isFirebaseNotificationRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function subscribeFirebaseNotifications(onChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services || typeof onChange !== "function") {
    return () => {};
  }

  const { collection, onSnapshot } = await import("firebase/firestore");
  return onSnapshot(
    collection(
      services.firestore,
      privateUserCollectionPath(
        services.authUser.uid,
        PRIVATE_COLLECTIONS.notifications,
        resolveAppId(),
      ),
    ),
    (snapshot) => {
      const notifications = snapshot.docs
        .map((document) => {
          const data = document.data();
          return {
            ...data,
            id: data.id ?? document.id,
            createdAt: toMillis(data.createdAt),
            updatedAt: toMillis(data.updatedAt),
            readAt: data.readAt ? toMillis(data.readAt) : null,
          };
        })
        .filter((notification) => isUserNotificationType(notification.type))
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 100);
      onChange(notifications);
    },
    onError,
  );
}

async function callNotificationFunction(name, payload = {}) {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error("Firebase authentication is required for notifications.");
  }
  const { httpsCallable } = await import("firebase/functions");
  const result = await httpsCallable(services.functions, name)(payload);
  return result.data;
}

export function markFirebaseNotificationRead(notificationId) {
  return callNotificationFunction("markNotificationRead", { notificationId });
}

export function markAllFirebaseNotificationsRead() {
  return callNotificationFunction("markAllNotificationsRead");
}
