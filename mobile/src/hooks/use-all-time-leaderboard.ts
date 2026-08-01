import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { firestoreDb } from '@/lib/firebase';
import { getFirebaseErrorMessage } from '@/lib/firebase-callable';
import { PUBLIC_COLLECTIONS, publicCollectionPath } from '@/lib/firebase-paths';
import { normalizeAllTimeLeaderboardEntries } from '@/lib/leaderboard';
import type { LeaderboardEntry } from '@/types/cruiser';

export function useAllTimeLeaderboard() {
  const [rawEntries, setRawEntries] = useState<LeaderboardEntry[]>([]);
  const [legacyEntries, setLegacyEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const allTimeUnsubscribe = onSnapshot(
      collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.individualAllTimeLeaderboard)),
      (snapshot) => {
        setRawEntries(snapshot.docs.map((item) => ({
          ...item.data(),
          id: String(item.data().id ?? item.id),
        })) as LeaderboardEntry[]);
      },
      (snapshotError) => setError(getFirebaseErrorMessage(snapshotError)),
    );
    const legacyUnsubscribe = onSnapshot(
      collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.individualLeaderboard)),
      (snapshot) => {
        setLegacyEntries(snapshot.docs.map((item) => ({
          ...item.data(),
          id: String(item.data().id ?? item.id),
        })) as LeaderboardEntry[]);
      },
      (snapshotError) => setError(getFirebaseErrorMessage(snapshotError)),
    );

    return () => {
      allTimeUnsubscribe();
      legacyUnsubscribe();
    };
  }, []);

  const entries = useMemo(
    () => normalizeAllTimeLeaderboardEntries([...legacyEntries, ...rawEntries]),
    [legacyEntries, rawEntries],
  );

  return { entries, error };
}
