import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { firestoreDb } from '@/lib/firebase';
import { callFirebase, getFirebaseErrorMessage, toMillis } from '@/lib/firebase-callable';
import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
  privateCollectionPath,
  publicCollectionPath,
} from '@/lib/firebase-paths';
import { useAuth } from '@/providers/auth-provider';
import type {
  Clan,
  ClanInvite,
  ClanMember,
  DriverSummary,
  Friendship,
} from '@/types/cruiser';

type SocialState = {
  friends: DriverSummary[];
  incoming: DriverSummary[];
  outgoing: DriverSummary[];
  blocked: DriverSummary[];
};

function counterpart(friendship: Friendship, currentUserId: string): DriverSummary | null {
  const targetId = friendship.participantIds?.find((id) => id !== currentUserId);
  if (!targetId) return null;
  const embedded = friendship.requesterUserId === targetId
    ? friendship.requesterProfile
    : friendship.targetProfile;
  return {
    ...(embedded ?? {}),
    userId: targetId,
    friendshipId: friendship.id,
    status: friendship.status,
  };
}

export function useSocialWorld() {
  const { profile, refreshProfile, user } = useAuth();
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [blocked, setBlocked] = useState<DriverSummary[]>([]);
  const [clans, setClans] = useState<Clan[]>([]);
  const [memberships, setMemberships] = useState<ClanMember[]>([]);
  const [subscribedMembers, setSubscribedMembers] = useState<ClanMember[]>([]);
  const [incomingClanInvites, setIncomingClanInvites] = useState<ClanInvite[]>([]);
  const [outgoingClanInvites, setOutgoingClanInvites] = useState<ClanInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubscribers = [
      onSnapshot(
        query(
          collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.friendships)),
          where('participantIds', 'array-contains', user.uid),
        ),
        (snapshot) => {
          setFriendships(snapshot.docs.map((item) => ({
            ...item.data(),
            id: item.id,
            createdAt: toMillis(item.data().createdAt),
          })) as Friendship[]);
          setLoading(false);
        },
      ),
      onSnapshot(
        collection(firestoreDb, privateCollectionPath(user.uid, PRIVATE_COLLECTIONS.blockedUsers)),
        (snapshot) => setBlocked(snapshot.docs.map((item) => {
          const data = item.data();
          return {
            ...(data.targetProfile ?? {}),
            userId: String(data.targetUserId ?? item.id),
          };
        })),
      ),
      onSnapshot(
        collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.clans)),
        (snapshot) => setClans(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
        })) as Clan[]),
      ),
      onSnapshot(
        query(
          collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.clanMembers)),
          where('userId', '==', user.uid),
        ),
        (snapshot) => setMemberships(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
        })) as ClanMember[]),
      ),
      onSnapshot(
        query(
          collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.clanInvites)),
          where('targetUserId', '==', user.uid),
        ),
        (snapshot) => setIncomingClanInvites(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
          createdAt: toMillis(item.data().createdAt),
        })) as ClanInvite[]),
      ),
      onSnapshot(
        query(
          collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.clanInvites)),
          where('invitedByUserId', '==', user.uid),
        ),
        (snapshot) => setOutgoingClanInvites(snapshot.docs.map((item) => ({
          ...item.data(),
          id: item.id,
          createdAt: toMillis(item.data().createdAt),
        })) as ClanInvite[]),
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user]);

  const membership = memberships[0] ?? null;
  const currentClan = clans.find((clan) => clan.id === membership?.clanId) ?? null;

  useEffect(() => {
    if (!membership?.clanId) return;
    return onSnapshot(
      query(
        collection(firestoreDb, publicCollectionPath(PUBLIC_COLLECTIONS.clanMembers)),
        where('clanId', '==', membership.clanId),
      ),
      (snapshot) => setSubscribedMembers(snapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
        joinedAt: toMillis(item.data().joinedAt),
      })) as ClanMember[]),
    );
  }, [membership?.clanId]);
  const members = membership?.clanId ? subscribedMembers : [];

  const social = useMemo<SocialState>(() => {
    const state: SocialState = { friends: [], incoming: [], outgoing: [], blocked };
    if (!user) return state;
    friendships.forEach((friendship) => {
      const driver = counterpart(friendship, user.uid);
      if (!driver) return;
      if (friendship.status === 'accepted') state.friends.push(driver);
      else if (friendship.targetUserId === user.uid) state.incoming.push(driver);
      else state.outgoing.push(driver);
    });
    return state;
  }, [blocked, friendships, user]);

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
    ...social,
    currentUserId: user?.uid ?? '',
    profile,
    clans,
    currentClan,
    membership,
    members,
    incomingClanInvites,
    outgoingClanInvites,
    loading,
    busy,
    error,
    clearError: () => setError(''),
    searchPlate: (plate: string) => run(
      'search',
      async () => (await callFirebase<{ driver: DriverSummary | null }>(
        'searchDriverByPlate',
        { plate },
      )).driver,
    ),
    getPublicProfile: (targetUserId: string, context: { convoyId?: string } = {}) => run(
      `profile-${targetUserId}`,
      async () => (await callFirebase<{ driver: DriverSummary | null }>(
        'getPublicDriverProfile',
        { targetUserId, context },
      )).driver,
    ),
    requestFriend: (targetUserId: string) => run(
      `friend-${targetUserId}`,
      () => callFirebase('requestFriendship', { targetUserId }),
    ),
    respondFriend: (targetUserId: string, decision: 'accepted' | 'declined') => run(
      `friend-${targetUserId}`,
      () => callFirebase('respondFriendship', { targetUserId, decision }),
    ),
    cancelFriend: (targetUserId: string) => run(
      `friend-${targetUserId}`,
      () => callFirebase('cancelFriendshipRequest', { targetUserId }),
    ),
    removeFriend: (targetUserId: string) => run(
      `friend-${targetUserId}`,
      () => callFirebase('removeFriendship', { targetUserId }),
    ),
    blockDriver: (targetUserId: string) => run(
      `block-${targetUserId}`,
      () => callFirebase('blockDriver', { targetUserId }),
    ),
    unblockDriver: (targetUserId: string) => run(
      `block-${targetUserId}`,
      () => callFirebase('unblockDriver', { targetUserId }),
    ),
    reportDriver: (targetUserId: string, reason: string, details: string) => run(
      `report-${targetUserId}`,
      () => callFirebase('submitModerationReport', {
        targetType: 'driver',
        targetId: targetUserId,
        reason,
        details,
      }),
    ),
    createClan: (name: string, tag: string, description: string) => run(
      'create-clan',
      async () => {
        const response = await callFirebase('createClan', { name, tag, description });
        await refreshProfile();
        return response;
      },
    ),
    inviteClan: (targetUserId: string) => run(
      `clan-${targetUserId}`,
      () => callFirebase('inviteClanMember', { clanId: currentClan?.id, targetUserId }),
    ),
    cancelClanInvite: (targetUserId: string) => run(
      `clan-${targetUserId}`,
      () => callFirebase('cancelClanInvite', { clanId: currentClan?.id, targetUserId }),
    ),
    respondClanInvite: (clanId: string, decision: 'accepted' | 'declined') => run(
      `clan-${clanId}`,
      async () => {
        const response = await callFirebase('respondClanInvite', { clanId, decision });
        await refreshProfile();
        return response;
      },
    ),
    updateClanRole: (targetUserId: string, role: 'captain' | 'member') => run(
      `clan-role-${targetUserId}`,
      () => callFirebase('updateClanMemberRole', {
        clanId: currentClan?.id,
        targetUserId,
        role,
      }),
    ),
    removeClanMember: (targetUserId: string) => run(
      `clan-member-${targetUserId}`,
      () => callFirebase('removeClanMember', {
        clanId: currentClan?.id,
        targetUserId,
      }),
    ),
    transferClanOwnership: (targetUserId: string) => run(
      `clan-owner-${targetUserId}`,
      async () => {
        const response = await callFirebase('transferClanOwnership', {
          clanId: currentClan?.id,
          targetUserId,
        });
        await refreshProfile();
        return response;
      },
    ),
    inviteConvoy: (convoyId: string, targetUserId: string) => run(
      `convoy-${convoyId}-${targetUserId}`,
      () => callFirebase('inviteConvoyMember', { convoyId, targetUserId }),
    ),
    deleteClanEvent: (convoyId: string) => run(
      `clan-event-${convoyId}`,
      () => callFirebase('deleteConvoy', { convoyId }),
    ),
    leaveClan: () => run('leave-clan', async () => {
      const response = await callFirebase('leaveClan', { clanId: currentClan?.id });
      await refreshProfile();
      return response;
    }),
  };
}
