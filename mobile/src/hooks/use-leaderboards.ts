import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { firestoreDb } from '@/lib/firebase';
import { callFirebase, getFirebaseErrorMessage } from '@/lib/firebase-callable';
import { PUBLIC_COLLECTIONS, publicCollectionPath } from '@/lib/firebase-paths';
import type { LeaderboardEntry } from '@/types/cruiser';

export function useLeaderboards() {
  const [drivers, setDrivers] = useState<LeaderboardEntry[]>([]);
  const [clans, setClans] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const driverUnsubscribe = onSnapshot(
      collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.individualLeaderboard)),
      (snapshot) => {
        setDrivers(snapshot.docs.map((item) => ({
          ...item.data(),
          id: String(item.data().id ?? item.id),
        })) as LeaderboardEntry[]);
        setLoading(false);
      },
      (snapshotError) => setError(getFirebaseErrorMessage(snapshotError)),
    );
    const clanUnsubscribe = onSnapshot(
      collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.clanLeaderboard)),
      (snapshot) => setClans(snapshot.docs.map((item) => ({
        ...item.data(),
        id: String(item.data().id ?? item.id),
      })) as LeaderboardEntry[]),
      (snapshotError) => setError(getFirebaseErrorMessage(snapshotError)),
    );
    void callFirebase<{ stats?: Record<string, unknown> }>('refreshDriverStats')
      .then((response) => setStats(response.stats ?? null))
      .catch((refreshError) => setError(getFirebaseErrorMessage(refreshError)));
    return () => {
      driverUnsubscribe();
      clanUnsubscribe();
    };
  }, []);

  return { drivers, clans, stats, loading, error };
}
