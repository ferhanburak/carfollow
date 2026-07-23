import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import { PUBLIC_COLLECTIONS, publicCollectionPath, resolveAppId } from "../services/firebasePaths";

const toMillis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : Number(value ?? 0));
const toItems = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

export function buildForumState({ threads = [], replies = [], likes = [], viewerUserId = "" }) {
  const repliesByThread = new Map();
  replies.forEach((reply) => {
    const normalized = { ...reply, createdAt: toMillis(reply.createdAt) };
    repliesByThread.set(reply.threadId, [...(repliesByThread.get(reply.threadId) ?? []), normalized]);
  });
  const likedThreadIds = new Set(likes.filter((like) => like.userId === viewerUserId).map((like) => like.threadId));

  return threads
    .filter((thread) => thread.status !== "deleted" && thread.status !== "hidden")
    .map((thread) => ({
      ...thread,
      createdAt: toMillis(thread.createdAt),
      updatedAt: toMillis(thread.updatedAt),
      likedByViewer: likedThreadIds.has(thread.id),
      replies: (repliesByThread.get(thread.id) ?? []).sort((left, right) => left.createdAt - right.createdAt),
    }))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function isFirebaseForumRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function subscribeFirebaseForum(viewerUserId, onChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services?.firestore) return () => {};
  const { collection, onSnapshot } = await import("firebase/firestore");
  const appId = resolveAppId();
  const state = { threads: [], replies: [], likes: [] };
  const loaded = { threads: false, replies: false, likes: false };
  const emit = () => {
    if (Object.values(loaded).every(Boolean)) onChange(buildForumState({ ...state, viewerUserId }));
  };
  const subscribe = (key, collectionName) => onSnapshot(
    collection(services.firestore, publicCollectionPath(collectionName, appId)),
    (snapshot) => {
      state[key] = toItems(snapshot);
      loaded[key] = true;
      emit();
    },
    onError,
  );
  const unsubscribers = [
    subscribe("threads", PUBLIC_COLLECTIONS.forumThreads),
    subscribe("replies", PUBLIC_COLLECTIONS.forumReplies),
    subscribe("likes", PUBLIC_COLLECTIONS.forumLikes),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

async function callForumFunction(name, data) {
  const services = await getFirebaseServices();
  if (!services?.functions) throw new Error("Firebase Functions are unavailable.");
  const { httpsCallable } = await import("firebase/functions");
  const response = await httpsCallable(services.functions, name)(data);
  return response.data;
}

export const createFirebaseForumThread = (thread) => callForumFunction("createForumThread", { thread });
export const toggleFirebaseForumLike = (threadId) => callForumFunction("toggleForumLike", { threadId });
export const addFirebaseForumReply = (threadId, body) => callForumFunction("addForumReply", { threadId, body });
