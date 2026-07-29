import { collection, onSnapshot } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';

import { firebaseAuth, firebaseStorage, firestoreDb } from '@/lib/firebase';
import { callFirebase, getFirebaseErrorMessage, toMillis } from '@/lib/firebase-callable';
import { APP_ID, PUBLIC_COLLECTIONS, publicCollectionPath } from '@/lib/firebase-paths';
import type { MapPin } from '@/types/cruiser';

export type SpotPhoto = {
  id: string;
  pinId: string;
  title?: string;
  imageUrl?: string;
  likes?: number;
  createdAt: number;
};

export type WashReview = {
  id: string;
  pinId: string;
  author?: string;
  foam: number;
  water: number;
  note?: string;
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
    photos,
    reviews,
    loading,
    busy,
    error,
    clearError: () => setError(''),
    refreshConvoys,
    createNode: (pin: Record<string, unknown>) => run(
      'create-node',
      () => callFirebase('createMapNode', { pin }),
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
    likePin: (pinId: string) => run(
      `like-${pinId}`,
      () => callFirebase('toggleMapLike', { pinId, targetType: 'pin' }),
    ),
    addSpotPhoto: (
      pinId: string,
      image: {
        uri: string;
        fileName?: string | null;
        fileSize?: number;
        mimeType?: string | null;
      },
    ) => run(`photo-${pinId}`, async () => {
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
      const safeName = String(image.fileName || `spot-${Date.now()}.jpg`)
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '-')
        .slice(-100);
      const storagePath =
        `artifacts/${APP_ID}/mapNodes/${pinId}/photos/${userId}/${Date.now()}-${safeName}`;
      const storageReference = ref(firebaseStorage, storagePath);
      try {
        await uploadBytes(storageReference, blob, {
          cacheControl: 'public,max-age=86400',
          contentType: image.mimeType || blob.type || 'image/jpeg',
        });
        const imageUrl = await getDownloadURL(storageReference);
        return await callFirebase('addMapSpotPhoto', {
          pinId,
          storagePath,
          imageUrl,
          title: 'CRUISER spot',
        });
      } catch (uploadError) {
        await deleteObject(storageReference).catch(() => {});
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
    ) => run(
      `review-${pinId}`,
      () => callFirebase('submitWashReview', { pinId, ...review }),
    ),
  };
}
