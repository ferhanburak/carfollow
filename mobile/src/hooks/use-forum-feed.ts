import {
  collection,
  limit,
  onSnapshot,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { useEffect, useState } from 'react';

import {
  firebaseAuth,
  firebaseFunctions,
  firebaseStorage,
  firestoreDb,
} from '@/lib/firebase';
import { APP_ID, publicCollectionPath } from '@/lib/firebase-paths';

export type ForumThread = {
  id: string;
  category: 'places' | 'builds' | 'technical' | 'roadlife';
  body: string;
  imageUrl?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
    label?: string;
  } | null;
  authorName: string;
  authorModel: string;
  likeCount: number;
  replyCount: number;
  createdAt?: Timestamp;
  status?: string;
};

export function useForumFeed() {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const feedQuery = query(
      collection(firestoreDb, publicCollectionPath('forumThreads')),
      limit(50),
    );

    return onSnapshot(feedQuery, (snapshot) => {
      const nextThreads = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }) as ForumThread)
        .filter((thread) => (
          thread.body &&
          thread.authorName &&
          thread.status !== 'deleted' &&
          thread.status !== 'hidden'
        ))
        .sort((left, right) => (
          (right.createdAt?.toMillis?.() ?? 0) - (left.createdAt?.toMillis?.() ?? 0)
        ));
      setThreads(nextThreads);
      setError('');
      setLoading(false);
    }, (snapshotError) => {
      setError(snapshotError.message);
      setLoading(false);
    });
  }, []);

  return { threads, loading, error };
}

export async function createForumThread(
  category: ForumThread['category'],
  body: string,
  image?: {
    uri: string;
    fileName?: string | null;
    fileSize?: number;
    mimeType?: string | null;
  } | null,
  location?: ForumThread['location'],
) {
  let uploadedImage = { imageUrl: '', storagePath: '' };
  try {
    uploadedImage = await uploadForumImage(image);
    const result = await httpsCallable(firebaseFunctions, 'createForumThread')({
      thread: { category, body: body.trim(), location: location ?? null, ...uploadedImage },
    });
    return result.data;
  } catch (error) {
    if (uploadedImage.storagePath) {
      await deleteObject(ref(firebaseStorage, uploadedImage.storagePath)).catch(() => {});
    }
    throw error;
  }
}

async function uploadForumImage(image?: {
  uri: string;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
} | null) {
  if (!image) return { imageUrl: '', storagePath: '' };
  if (Number(image.fileSize ?? 0) > 10 * 1024 * 1024) {
    throw new Error('Görsel en fazla 10 MB olabilir.');
  }

  const userId = firebaseAuth.currentUser?.uid;
  if (!userId) throw new Error('Görsel yüklemek için yeniden giriş yapmalısın.');

  const response = await fetch(image.uri);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('Yalnızca görsel dosyası seçebilirsin.');
  }
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('Görsel en fazla 10 MB olabilir.');
  }

  const safeName = String(image.fileName || `forum-${Date.now()}.jpg`)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .slice(-100);
  const storagePath = `artifacts/${APP_ID}/forumThreads/${userId}/${Date.now()}-${safeName}`;
  const storageRef = ref(firebaseStorage, storagePath);
  await uploadBytes(storageRef, blob, {
    cacheControl: 'public,max-age=86400',
    contentType: image.mimeType || blob.type || 'image/jpeg',
  });
  return {
    imageUrl: await getDownloadURL(storageRef),
    storagePath,
  };
}
