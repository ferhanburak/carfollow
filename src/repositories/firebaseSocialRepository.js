import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
  privateUserCollectionPath,
  publicCollectionPath,
  resolveAppId,
} from "../services/firebasePaths";

function toMillis(value) {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }
  return Number(value ?? 0);
}

function sortNewest(items) {
  return [...items].sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0));
}

function normalizePublicProfile(profile) {
  const userId = profile.userId ?? profile.firebaseUid ?? profile.id;
  return {
    ...profile,
    id: userId,
    userId,
  };
}

function resolveFriendshipProfile(friendship, currentUserId, profilesById) {
  const counterpartUserId = (friendship.participantIds ?? []).find((userId) => userId !== currentUserId);
  if (!counterpartUserId) {
    return null;
  }

  const embeddedProfile = friendship.requesterUserId === counterpartUserId
    ? friendship.requesterProfile
    : friendship.targetProfile;
  const liveProfile = profilesById.get(counterpartUserId);

  return {
    ...(embeddedProfile ?? {}),
    ...(liveProfile ?? {}),
    id: counterpartUserId,
    userId: counterpartUserId,
    friendshipId: friendship.id,
    status: friendship.status,
    createdAt: toMillis(friendship.acceptedAt ?? friendship.createdAt),
  };
}

export function buildFirebaseSocialState({ currentUserId, profiles = [], friendships = [], blocks = [] }) {
  const normalizedProfiles = profiles.map(normalizePublicProfile);
  const profilesById = new Map(normalizedProfiles.map((profile) => [profile.userId, profile]));
  const blockedUserIds = new Set(blocks.map((block) => block.targetUserId));
  const friends = [];
  const incomingRequests = [];
  const outgoingRequests = [];

  for (const friendship of friendships) {
    const profile = resolveFriendshipProfile(friendship, currentUserId, profilesById);
    if (!profile) {
      continue;
    }
    if (blockedUserIds.has(profile.userId)) {
      continue;
    }

    if (friendship.status === "accepted") {
      friends.push(profile);
    } else if (friendship.status === "pending" && friendship.targetUserId === currentUserId) {
      incomingRequests.push(profile);
    } else if (friendship.status === "pending" && friendship.requesterUserId === currentUserId) {
      outgoingRequests.push(profile);
    }
  }

  const blockedDrivers = blocks.map((block) => ({
    ...(block.targetProfile ?? {}),
    ...(profilesById.get(block.targetUserId) ?? {}),
    id: block.targetUserId,
    userId: block.targetUserId,
    blockedAt: toMillis(block.blockedAt),
    status: "blocked",
  }));

  return {
    directory: normalizedProfiles.filter((profile) => profile.userId !== currentUserId),
    friends: sortNewest(friends),
    incomingRequests: sortNewest(incomingRequests),
    outgoingRequests: sortNewest(outgoingRequests),
    blockedDrivers: sortNewest(blockedDrivers.map((entry) => ({ ...entry, createdAt: entry.blockedAt }))),
  };
}

export function isFirebaseSocialRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function subscribeFirebaseSocialState(onStateChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services || typeof onStateChange !== "function") {
    return () => {};
  }

  const { authUser, firestore } = services;
  const { collection, onSnapshot, query, where } = await import("firebase/firestore");
  const snapshots = {
    profiles: [],
    friendships: [],
    blocks: [],
  };
  const loaded = {
    profiles: false,
    friendships: false,
    blocks: false,
  };

  const emit = () => {
    if (!Object.values(loaded).every(Boolean)) {
      return;
    }
    onStateChange(buildFirebaseSocialState({
      currentUserId: authUser.uid,
      ...snapshots,
    }));
  };
  const mapSnapshot = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const bind = (key, reference) => onSnapshot(
    reference,
    (snapshot) => {
      snapshots[key] = mapSnapshot(snapshot);
      loaded[key] = true;
      emit();
    },
    onError,
  );

  const appId = resolveAppId();
  const unsubscribers = [
    bind(
      "profiles",
      query(collection(firestore, publicCollectionPath(PUBLIC_COLLECTIONS.publicProfiles, appId))),
    ),
    bind(
      "friendships",
      query(
        collection(firestore, publicCollectionPath(PUBLIC_COLLECTIONS.friendships, appId)),
        where("participantIds", "array-contains", authUser.uid),
      ),
    ),
    bind(
      "blocks",
      query(collection(
        firestore,
        privateUserCollectionPath(authUser.uid, PRIVATE_COLLECTIONS.blockedUsers, appId),
      )),
    ),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

async function callSocialFunction(name, data) {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error("Firebase authentication is required for social actions.");
  }

  const { httpsCallable } = await import("firebase/functions");
  const callable = httpsCallable(services.functions, name);
  const result = await callable(data);
  return result.data;
}

export function requestFirebaseFriendship(targetUserId) {
  return callSocialFunction("requestFriendship", { targetUserId });
}

export function respondFirebaseFriendship(targetUserId, decision) {
  return callSocialFunction("respondFriendship", { targetUserId, decision });
}

export function cancelFirebaseFriendshipRequest(targetUserId) {
  return callSocialFunction("cancelFriendshipRequest", { targetUserId });
}

export function removeFirebaseFriendship(targetUserId) {
  return callSocialFunction("removeFriendship", { targetUserId });
}

export function blockFirebaseDriver(targetUserId) {
  return callSocialFunction("blockDriver", { targetUserId });
}

export function unblockFirebaseDriver(targetUserId) {
  return callSocialFunction("unblockDriver", { targetUserId });
}
