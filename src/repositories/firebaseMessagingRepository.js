import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import {
  realtimeDmThreadPath,
  realtimeDmThreadTypingPath,
  realtimeDmUserThreadsPath,
  realtimePresencePath,
  realtimePresenceUserPath,
  resolveAppId,
} from "../services/firebasePaths";

function toMessages(payload) {
  return Object.entries(payload ?? {})
    .map(([messageId, message]) => ({ id: message.id ?? messageId, ...message }))
    .sort((left, right) => Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0));
}

export function normalizeFirebaseMessageThread(threadId, payload, currentUserId) {
  if (!payload?.participantUids?.[currentUserId]) return null;
  const participantUserId = Object.keys(payload.participantUids).find((userId) => userId !== currentUserId);
  if (!participantUserId) return null;
  const profiles = payload.participantProfiles ?? {};
  const profile = Array.isArray(profiles)
    ? profiles.find((entry) => entry?.userId === participantUserId) ?? {}
    : profiles[participantUserId] ?? {};
  return {
    id: threadId,
    participantUserId,
    participantPlate: profile.plate ?? "UNKNOWN",
    participantName: profile.fullName ?? profile.plate ?? "Unknown Driver",
    participantModel: profile.model ?? "Unknown Setup",
    participantAvatar: profile.avatar ?? "",
    messages: toMessages(payload.messages),
    lastReadAt: Number(payload.readBy?.[currentUserId] ?? 0),
    updatedAt: Number(payload.updatedAt ?? 0),
  };
}

export function isFirebaseMessagingRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

async function callMessagingFunction(name, data) {
  const services = await getFirebaseServices();
  if (!services?.functions) throw new Error("Firebase messaging is unavailable.");
  const { httpsCallable } = await import("firebase/functions");
  const response = await httpsCallable(services.functions, name)(data);
  return response.data;
}

export const ensureFirebaseDirectMessageThread = (targetUserId) =>
  callMessagingFunction("ensureDirectMessageThread", { targetUserId });

export const sendFirebaseDirectMessage = (targetUserId, body) =>
  callMessagingFunction("sendDirectMessage", { targetUserId, body });

export async function subscribeFirebaseDirectMessages(onThreadsChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services?.database || typeof onThreadsChange !== "function") return () => {};
  const { authUser, database } = services;
  const { onValue, ref } = await import("firebase/database");
  const threadSubscriptions = new Map();
  const conversations = new Map();
  let stopped = false;
  const emit = () => onThreadsChange(Object.fromEntries(conversations));
  const indexRef = ref(database, realtimeDmUserThreadsPath(authUser.uid, resolveAppId()));
  const unsubscribeIndex = onValue(indexRef, (snapshot) => {
    const nextThreadIds = new Set(Object.keys(snapshot.val() ?? {}));
    for (const [threadId, unsubscribe] of threadSubscriptions) {
      if (!nextThreadIds.has(threadId)) {
        unsubscribe();
        threadSubscriptions.delete(threadId);
        conversations.delete(threadId);
      }
    }
    for (const threadId of nextThreadIds) {
      if (threadSubscriptions.has(threadId)) continue;
      const threadRef = ref(database, realtimeDmThreadPath(threadId, resolveAppId()));
      const unsubscribe = onValue(threadRef, (threadSnapshot) => {
        if (stopped) return;
        const conversation = normalizeFirebaseMessageThread(threadId, threadSnapshot.val(), authUser.uid);
        if (conversation) conversations.set(threadId, conversation);
        else conversations.delete(threadId);
        emit();
      }, onError);
      threadSubscriptions.set(threadId, unsubscribe);
    }
    emit();
  }, onError);
  return () => {
    stopped = true;
    unsubscribeIndex();
    threadSubscriptions.forEach((unsubscribe) => unsubscribe());
    threadSubscriptions.clear();
  };
}

export async function markFirebaseConversationRead(threadId) {
  const services = await getFirebaseServices();
  if (!services?.database || !threadId) return null;
  const { ref, serverTimestamp, set } = await import("firebase/database");
  await set(ref(services.database, `${realtimeDmThreadPath(threadId, resolveAppId())}/readBy/${services.authUser.uid}`), serverTimestamp());
  return { ok: true };
}

export async function subscribeFirebaseTyping(threadId, onTypingChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services?.database || !threadId || typeof onTypingChange !== "function") return () => {};
  const { onValue, ref } = await import("firebase/database");
  return onValue(
    ref(services.database, realtimeDmThreadTypingPath(threadId, resolveAppId())),
    (snapshot) => onTypingChange(snapshot.val() ?? {}),
    onError,
  );
}

export async function saveFirebaseTypingState(threadId, profile, status) {
  const services = await getFirebaseServices();
  if (!services?.database || !threadId) return null;
  const { onDisconnect, ref, remove, serverTimestamp, set } = await import("firebase/database");
  const typingRef = ref(services.database, `${realtimeDmThreadTypingPath(threadId, resolveAppId())}/${services.authUser.uid}`);
  if (status !== "typing") {
    await remove(typingRef);
    return { ok: true };
  }
  await onDisconnect(typingRef).remove();
  await set(typingRef, {
    userId: services.authUser.uid,
    firebaseUid: services.authUser.uid,
    plate: profile?.plate ?? "",
    status: "typing",
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function initializeFirebasePresence(profile) {
  const services = await getFirebaseServices();
  if (!services?.database || !profile?.plate) return () => {};
  const { onDisconnect, ref, serverTimestamp, set } = await import("firebase/database");
  const presenceRef = ref(services.database, realtimePresenceUserPath(services.authUser.uid, resolveAppId()));
  const disconnect = onDisconnect(presenceRef);
  await disconnect.set({
    firebaseUid: services.authUser.uid,
    plate: profile.plate,
    status: "offline",
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await set(presenceRef, {
    firebaseUid: services.authUser.uid,
    plate: profile.plate,
    status: typeof document !== "undefined" && document.hidden ? "away" : "online",
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return () => {
    void set(presenceRef, {
      firebaseUid: services.authUser.uid,
      plate: profile.plate,
      status: "offline",
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).then(() => disconnect.cancel()).catch(() => {});
  };
}

export async function saveFirebasePresenceState(profile, status) {
  const services = await getFirebaseServices();
  if (!services?.database || !profile?.plate || !["online", "away", "offline"].includes(status)) return null;
  const { ref, serverTimestamp, update } = await import("firebase/database");
  await update(ref(services.database, realtimePresenceUserPath(services.authUser.uid, resolveAppId())), {
    firebaseUid: services.authUser.uid,
    plate: profile.plate,
    status,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function subscribeFirebasePresence(plates, onPresenceChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services?.database || typeof onPresenceChange !== "function") return () => {};
  const normalizedPlateSet = new Set((plates ?? []).filter(Boolean).map((plate) => plate.replaceAll(" ", "_")));
  const { onValue, ref } = await import("firebase/database");
  return onValue(ref(services.database, realtimePresencePath(resolveAppId())), (snapshot) => {
    const payload = snapshot.val() ?? {};
    onPresenceChange(Object.fromEntries(Object.entries(payload)
      .filter(([, value]) => normalizedPlateSet.size === 0 || normalizedPlateSet.has(String(value?.plate ?? "").replaceAll(" ", "_")))
      .map(([key, value]) => [value?.plate ?? key, value])));
  }, onError);
}
