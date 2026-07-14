import { getPinIcon } from "../constants/pins";
import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import { PUBLIC_COLLECTIONS, publicCollectionPath, resolveAppId } from "../services/firebasePaths";

const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : Number(value ?? 0));
const toItems = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

export function buildFirebaseMapState({ pins = [], photos = [], reviews = [] }) {
  const photosByPin = new Map();
  photos.forEach((photo) => photosByPin.set(photo.pinId, [...(photosByPin.get(photo.pinId) ?? []), { ...photo, uploadedAt: millis(photo.createdAt) }]));
  const reviewsByPin = new Map();
  reviews.forEach((review) => reviewsByPin.set(review.pinId, [...(reviewsByPin.get(review.pinId) ?? []), { ...review, createdAt: millis(review.createdAt) }]));
  return {
    mapPins: pins.map((pin) => ({
      ...pin,
      icon: pin.icon ?? getPinIcon(pin.type),
      gallery: (photosByPin.get(pin.id) ?? []).sort((a, b) => b.uploadedAt - a.uploadedAt),
      reviews: (reviewsByPin.get(pin.id) ?? []).sort((a, b) => b.createdAt - a.createdAt),
    })),
  };
}

export function isFirebaseMapRepositoryEnabled() { return isFirebaseModeEnabled(); }

export async function subscribeFirebaseMapState(onStateChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services?.firestore) return () => {};
  const { collection, onSnapshot } = await import("firebase/firestore");
  const appId = resolveAppId();
  const snapshots = { pins: [], photos: [], reviews: [] };
  const loaded = { pins: false, photos: false, reviews: false };
  const emit = () => { if (Object.values(loaded).every(Boolean)) onStateChange(buildFirebaseMapState(snapshots)); };
  const subscribe = (key, collectionName) => onSnapshot(
    collection(services.firestore, publicCollectionPath(collectionName, appId)),
    (snapshot) => { snapshots[key] = toItems(snapshot); loaded[key] = true; emit(); }, onError,
  );
  const unsubscribers = [
    subscribe("pins", PUBLIC_COLLECTIONS.mapPins),
    subscribe("photos", PUBLIC_COLLECTIONS.mapSpotPhotos),
    subscribe("reviews", PUBLIC_COLLECTIONS.washReviews),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

async function callMapFunction(name, data) {
  const services = await getFirebaseServices();
  if (!services?.functions) throw new Error("Firebase Functions are unavailable.");
  const { httpsCallable } = await import("firebase/functions");
  const response = await httpsCallable(services.functions, name)(data);
  return response.data;
}

export const createFirebaseMapNode = (pin) => callMapFunction("createMapNode", { pin });
export const submitFirebaseWashReview = (review) => callMapFunction("submitWashReview", review);
export const toggleFirebaseMapLike = (data) => callMapFunction("toggleMapLike", data);

export async function uploadFirebaseMapSpotPhoto(pinId, file) {
  const services = await getFirebaseServices();
  if (!services?.storage || !services?.authUser) throw new Error("Firebase Storage is unavailable.");
  if (!file?.type?.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("Select an image smaller than 10 MB.");
  const { getDownloadURL, ref, uploadBytes } = await import("firebase/storage");
  const safeName = String(file.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `artifacts/${resolveAppId()}/mapNodes/${pinId}/photos/${services.authUser.uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(services.storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return { storagePath, imageUrl: await getDownloadURL(storageRef) };
}

export async function addFirebaseMapSpotPhoto({ pinId, title, file }) {
  const upload = await uploadFirebaseMapSpotPhoto(pinId, file);
  return callMapFunction("addMapSpotPhoto", { pinId, title, ...upload });
}
