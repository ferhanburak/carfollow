import {
  collection,
  limit,
  onSnapshot,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';

import { firebaseFunctions, firestoreDb } from '@/lib/firebase';
import { publicCollectionPath } from '@/lib/firebase-paths';

export type ForumThread = {
  id: string;
  category: 'places' | 'builds' | 'technical' | 'roadlife';
  body: string;
  imageUrl?: string;
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
) {
  const result = await httpsCallable(firebaseFunctions, 'createForumThread')({
    thread: { category, body: body.trim(), imageUrl: '', storagePath: '' },
  });
  return result.data;
}
