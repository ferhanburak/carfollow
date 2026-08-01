import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { firestoreDb } from '@/lib/firebase';
import { callFirebase, getFirebaseErrorMessage } from '@/lib/firebase-callable';
import { PUBLIC_COLLECTIONS, publicCollectionPath } from '@/lib/firebase-paths';
import { normalizeAllTimeLeaderboardEntries, normalizeLeaderboardEntries } from '@/lib/leaderboard';
import type { LeaderboardEntry } from '@/types/cruiser';

export function useLeaderboards() {
  const [driverEntries, setDriverEntries] = useState<LeaderboardEntry[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<LeaderboardEntry[]>([]);
  const [clans, setClans] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const drivers = useMemo(
    () => normalizeLeaderboardEntries(driverEntries, 'driver'),
    [driverEntries],
  );
  const allTimeDrivers = useMemo(
    () => normalizeAllTimeLeaderboardEntries([...driverEntries, ...allTimeEntries]),
    [allTimeEntries, driverEntries],
  );

  useEffect(() => {
    const driverUnsubscribe = onSnapshot(
      collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.individualLeaderboard)),
      (snapshot) => {
        const entries = snapshot.docs.map((item) => ({
          ...item.data(),
          id: String(item.data().id ?? item.id),
        })) as LeaderboardEntry[];
        setDriverEntries(entries);
        setLoading(false);
      },
      (snapshotError) => setError(getFirebaseErrorMessage(snapshotError)),
    );
    const allTimeUnsubscribe = onSnapshot(
      collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.individualAllTimeLeaderboard)),
      (snapshot) => {
        setAllTimeEntries(snapshot.docs.map((item) => ({
          ...item.data(),
          id: String(item.data().id ?? item.id),
        })) as LeaderboardEntry[]);
      },
      (snapshotError) => setError(getFirebaseErrorMessage(snapshotError)),
    );
    const clanUnsubscribe = onSnapshot(
      collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.clanLeaderboard)),
      (snapshot) => {
        const entries = snapshot.docs.map((item) => ({
          ...item.data(),
          id: String(item.data().id ?? item.id),
        })) as LeaderboardEntry[];
        setClans(normalizeLeaderboardEntries(entries, 'clan'));
      },
      (snapshotError) => setError(getFirebaseErrorMessage(snapshotError)),
    );
    void callFirebase<{ stats?: Record<string, unknown> }>('refreshDriverStats')
      .then((response) => setStats(response.stats ?? null))
      .catch((refreshError) => setError(getFirebaseErrorMessage(refreshError)));
    return () => {
      driverUnsubscribe();
      allTimeUnsubscribe();
      clanUnsubscribe();
    };
  }, []);

  return { allTimeDrivers, drivers, clans, stats, loading, error };
}
