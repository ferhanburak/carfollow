import { collection, onSnapshot } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';

import { firebaseAuth, firebaseStorage, firestoreDb } from '@/lib/firebase';
import { callFirebase, getFirebaseErrorMessage, toMillis } from '@/lib/firebase-callable';
import { APP_ID, PUBLIC_COLLECTIONS, publicCollectionPath } from '@/lib/firebase-paths';
import type { MapPin } from '@/types/cruiser';
import { isVisibleMapPin } from '@/utils/map-pin-visibility';

export type SpotPhoto = {
  id: string;
  pinId: string;
  title?: string;
  imageUrl?: string;
  likes?: number;
  createdAt: number;
};

export type MapUploadImage = {
  uri: string;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
};

export type WashReview = {
  id: string;
  pinId: string;
  userId?: string;
  author?: string;
  foam: number;
  water: number;
  note?: string;
  imageUrl?: string;
  storagePath?: string;
  helpfulCount?: number;
  createdAt: number;
};

export function useMapWorld() {
  const [basePins, setBasePins] = useState<MapPin[]>([]);
  const [convoys, setConvoys] = useState<MapPin[]>([]);
  const [photos, setPhotos] = useState<SpotPhoto[]>([]);
  const [reviews, setReviews] = useState<WashReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refreshConvoys = async () => {
    try {
      const response = await callFirebase<{ convoys?: MapPin[] }>('listAccessibleConvoys');
      setConvoys(Array.isArray(response.convoys) ? response.convoys : []);
    } catch (convoyError) {
      setError(getFirebaseErrorMessage(convoyError, 'Konvoylar yüklenemedi.'));
    }
  };

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(
        collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.mapPins)),
        (snapshot) => {
          setBasePins(snapshot.docs.map((item) => ({
            ...item.data(),
            id: item.id,
          })) as MapPin[]);
          setLoading(false);
          void refreshConvoys();
        },
      ),
      onSnapshot(
        collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.mapSpotPhotos)),
        (snapshot) => setPhotos(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
          createdAt: toMillis(item.data().createdAt),
        })) as SpotPhoto[]),
      ),
      onSnapshot(
        collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.washReviews)),
        (snapshot) => setReviews(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
          createdAt: toMillis(item.data().createdAt),
        })) as WashReview[]),
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const convoyIds = new Set(convoys.map((item) => item.id));
  const pins = [
    ...basePins.filter((pin) => pin.type !== 'meet' || !convoyIds.has(pin.id)),
    ...convoys,
  ];
  const activePins = pins.filter(isVisibleMapPin);

  async function run<T>(key: string, operation: () => Promise<T>) {
    setBusy(key);
    setError('');
    try {
      return await operation();
    } catch (operationError) {
      setError(getFirebaseErrorMessage(operationError));
      throw operationError;
    } finally {
      setBusy('');
    }
  }

  return {
    pins,
    activePins,
    photos,
    reviews,
    loading,
    busy,
    error,
    clearError: () => setError(''),
    refreshConvoys,
    createNode: (pin: Record<string, unknown>) => run(
      'create-node',
      () => callFirebase<{ ok: boolean; pinId: string }>('createMapNode', { pin }),
    ),
    updateNode: (pinId: string, details: Record<string, unknown>) => run(
      `update-node-${pinId}`,
      () => callFirebase('updateMapNode', { pinId, details }),
    ),
    deleteNode: (pinId: string) => run(
      `delete-node-${pinId}`,
      () => callFirebase('deleteMapNode', { pinId }),
    ),
    createConvoy: (pin: Record<string, unknown>) => run(
      'create-convoy',
      async () => {
        const response = await callFirebase('createConvoy', { pin });
        await refreshConvoys();
        return response;
      },
    ),
    joinConvoy: (convoyId: string) => run(
      `join-${convoyId}`,
      async () => {
        const response = await callFirebase('requestConvoyJoin', { convoyId });
        await refreshConvoys();
        return response;
      },
    ),
    respondConvoyRequest: (
      convoyId: string,
      memberUserId: string,
      decision: 'approved' | 'declined',
    ) => run(`respond-${convoyId}-${memberUserId}`, async () => {
      const response = await callFirebase('respondConvoyJoinRequest', {
        convoyId,
        memberUserId,
        decision,
      });
      await refreshConvoys();
      return response;
    }),
    removeConvoyMember: (convoyId: string, memberUserId: string) => run(
      `remove-${convoyId}-${memberUserId}`,
      async () => {
        const response = await callFirebase('removeConvoyMember', { convoyId, memberUserId });
        await refreshConvoys();
        return response;
      },
    ),
    setConvoyMemberRole: (
      convoyId: string,
      memberUserId: string,
      managementRole: 'manager' | 'member',
    ) => run(`role-${convoyId}-${memberUserId}`, async () => {
      const response = await callFirebase('setConvoyMemberRole', {
        convoyId,
        memberUserId,
        managementRole,
      });
      await refreshConvoys();
      return response;
    }),
    cancelConvoyTrip: (convoyId: string) => run(`cancel-trip-${convoyId}`, async () => {
      const response = await callFirebase('updateConvoyTripStatus', {
        convoyId,
        tripStatus: 'cancelled',
      });
      await refreshConvoys();
      return response;
    }),
    rateConvoyMember: (
      convoyId: string,
      targetUserId: string,
      signal: 'harmony' | 'alert',
    ) => run(`rate-${convoyId}-${targetUserId}`, async () => {
      const response = await callFirebase('rateConvoyMember', {
        convoyId,
        targetUserId,
        signal,
      });
      await refreshConvoys();
      return response;
    }),
    syncConvoyLocation: async (
      convoyId: string,
      location: { lat: number; lng: number; accuracy: number },
    ) => callFirebase<{
      convoyId: string;
      lifecycleStatus: string;
      tripStatus: string;
      distanceToDestinationM?: number | null;
      completed?: boolean;
    }>('syncConvoyLocation', { convoyId, ...location }),
    updateConvoy: (convoyId: string, details: Record<string, unknown>) => run(
      `update-${convoyId}`,
      async () => {
        const response = await callFirebase('updateConvoyDetails', { convoyId, details });
        await refreshConvoys();
        return response;
      },
    ),
    deleteConvoy: (convoyId: string) => run(
      `delete-${convoyId}`,
      async () => {
        const response = await callFirebase('deleteConvoy', { convoyId });
        await refreshConvoys();
        return response;
      },
    ),
    likePin: (pinId: string) => run(
      `like-${pinId}`,
      () => callFirebase('toggleMapLike', { pinId, targetType: 'pin' }),
    ),
    helpfulReview: (reviewId: string) => run(
      `helpful-${reviewId}`,
      () => callFirebase('toggleWashReviewHelpful', { reviewId }),
    ),
    addSpotPhoto: (
      pinId: string,
      image: MapUploadImage,
    ) => run(`photo-${pinId}`, async () => {
      const uploaded = await uploadMapImage(pinId, 'photos', image);
      try {
        return await callFirebase('addMapSpotPhoto', {
          pinId,
          storagePath: uploaded.storagePath,
          imageUrl: uploaded.imageUrl,
          title: 'TrackSnap spot',
        });
      } catch (uploadError) {
        await deleteObject(uploaded.storageReference).catch(() => {});
        throw uploadError;
      }
    }),
    reviewWash: (
      pinId: string,
      review: {
        foam: number;
        water: number;
        allowsBuckets: boolean;
        shadowDrying: boolean;
        note: string;
      },
      image?: MapUploadImage,
    ) => run(`review-${pinId}`, async () => {
      const uploaded = image ? await uploadMapImage(pinId, 'reviews', image) : null;
      try {
        return await callFirebase('submitWashReview', {
          pinId,
          ...review,
          ...(uploaded ? {
            storagePath: uploaded.storagePath,
            imageUrl: uploaded.imageUrl,
          } : {}),
        });
      } catch (reviewError) {
        if (uploaded) await deleteObject(uploaded.storageReference).catch(() => {});
        throw reviewError;
      }
    }),
  };
}

async function uploadMapImage(
  pinId: string,
  category: 'photos' | 'reviews',
  image: MapUploadImage,
) {
  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Fotoğraf yüklemek için yeniden giriş yapmalısınız.');
  if (Number(image.fileSize ?? 0) > 10 * 1024 * 1024) {
    throw new Error('Görsel en fazla 10 MB olabilir.');
  }
  const response = await fetch(image.uri);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size > 10 * 1024 * 1024) {
    throw new Error('En fazla 10 MB boyutunda bir görsel seçin.');
  }
  const safeName = String(image.fileName || `${category}-${Date.now()}.jpg`)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .slice(-100);
  const storagePath =
    `artifacts/${APP_ID}/mapNodes/${pinId}/${category}/${userId}/${Date.now()}-${safeName}`;
  const storageReference = ref(firebaseStorage, storagePath);
  await uploadBytes(storageReference, blob, {
    cacheControl: 'public,max-age=86400',
    contentType: image.mimeType || blob.type || 'image/jpeg',
  });
  return {
    imageUrl: await getDownloadURL(storageReference),
    storagePath,
    storageReference,
  };
}
