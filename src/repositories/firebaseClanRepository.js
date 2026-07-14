import { getFirebaseServices, isFirebaseModeEnabled } from "../services/firebaseClient";
import { getDriverStatsPeriod } from "../domain/driverStats";
import { PUBLIC_COLLECTIONS, publicCollectionPath, resolveAppId } from "../services/firebasePaths";

function toMillis(value) {
  return typeof value?.toMillis === "function" ? value.toMillis() : Number(value ?? 0);
}

function sortNewest(items, timestampField = "createdAt") {
  return [...items].sort((left, right) => toMillis(right[timestampField]) - toMillis(left[timestampField]));
}

function normalizeClan(clan, leaderboardEntry, periodKey) {
  const currentMonthlyKm = Number(
    leaderboardEntry?.monthlyKm ?? (
      clan.monthlyKmPeriod === periodKey
        ? clan.monthlyKm
        : clan.monthlyKmPeriod ? 0 : clan.km
    ) ?? 0,
  );
  return {
    ...clan,
    km: currentMonthlyKm,
    monthlyKm: currentMonthlyKm,
    monthlyKmPeriod: periodKey,
    members: Number(clan.memberCount ?? clan.members ?? 0),
    memberCount: Number(clan.memberCount ?? clan.members ?? 0),
  };
}

function normalizeInvite(invite) {
  return {
    ...invite,
    fromName: invite.invitedByName ?? invite.fromName ?? "Unknown Driver",
    fromPlate: invite.invitedByPlate ?? invite.fromPlate ?? "",
    createdAt: toMillis(invite.createdAt),
  };
}

export function buildFirebaseClanState({
  clans = [],
  leaderboardEntries = [],
  memberships = [],
  incomingInvites = [],
  outgoingInvites = [],
  members = [],
}) {
  const membership = memberships[0] ?? null;
  const periodKey = getDriverStatsPeriod();
  const leaderboardByClan = new Map(
    leaderboardEntries
      .filter((entry) => entry.periodKey === periodKey && entry.clanId)
      .map((entry) => [entry.clanId, entry]),
  );
  const normalizedClans = clans
    .map((clan) => normalizeClan(clan, leaderboardByClan.get(clan.id), periodKey))
    .sort((left, right) => Number(right.km ?? 0) - Number(left.km ?? 0));
  const currentClan = membership
    ? normalizedClans.find((clan) => clan.id === membership.clanId) ?? null
    : null;

  return {
    clans: normalizedClans,
    currentClan,
    currentClanMembers: sortNewest(
      members.map((member) => ({ ...member, joinedAt: toMillis(member.joinedAt) })),
      "joinedAt",
    ),
    membership,
    clanInvites: sortNewest(incomingInvites.map(normalizeInvite)),
    sentClanInvites: sortNewest(outgoingInvites.map(normalizeInvite)),
  };
}

export function isFirebaseClanRepositoryEnabled() {
  return isFirebaseModeEnabled();
}

export async function subscribeFirebaseClanState(onStateChange, onError = () => {}) {
  const services = await getFirebaseServices();
  if (!services || typeof onStateChange !== "function") {
    return () => {};
  }

  const { authUser, firestore } = services;
  const { collection, onSnapshot, query, where } = await import("firebase/firestore");
  const appId = resolveAppId();
  const collectionRef = (name) => collection(firestore, publicCollectionPath(name, appId));
  const snapshots = {
    clans: [],
    leaderboardEntries: [],
    memberships: [],
    incomingInvites: [],
    outgoingInvites: [],
    members: [],
  };
  const loaded = {
    clans: false,
    leaderboardEntries: false,
    memberships: false,
    incomingInvites: false,
    outgoingInvites: false,
    members: false,
  };
  let unsubscribeMembers = () => {};
  let subscribedClanId = "";

  const mapSnapshot = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const emit = () => {
    if (Object.values(loaded).every(Boolean)) {
      onStateChange(buildFirebaseClanState(snapshots));
    }
  };
  const bindMembers = (clanId) => {
    if (subscribedClanId === clanId) {
      return;
    }
    unsubscribeMembers();
    subscribedClanId = clanId;
    snapshots.members = [];
    if (!clanId) {
      loaded.members = true;
      emit();
      return;
    }
    loaded.members = false;
    unsubscribeMembers = onSnapshot(
      query(collectionRef(PUBLIC_COLLECTIONS.clanMembers), where("clanId", "==", clanId)),
      (snapshot) => {
        snapshots.members = mapSnapshot(snapshot);
        loaded.members = true;
        emit();
      },
      onError,
    );
  };
  const bind = (key, reference, afterChange) => onSnapshot(reference, (snapshot) => {
    snapshots[key] = mapSnapshot(snapshot);
    loaded[key] = true;
    afterChange?.();
    emit();
  }, onError);

  const unsubscribers = [
    bind("clans", collectionRef(PUBLIC_COLLECTIONS.clans)),
    bind("leaderboardEntries", collectionRef(PUBLIC_COLLECTIONS.clanLeaderboard)),
    bind(
      "memberships",
      query(collectionRef(PUBLIC_COLLECTIONS.clanMembers), where("userId", "==", authUser.uid)),
      () => bindMembers(snapshots.memberships[0]?.clanId ?? ""),
    ),
    bind(
      "incomingInvites",
      query(collectionRef(PUBLIC_COLLECTIONS.clanInvites), where("targetUserId", "==", authUser.uid)),
    ),
    bind(
      "outgoingInvites",
      query(collectionRef(PUBLIC_COLLECTIONS.clanInvites), where("invitedByUserId", "==", authUser.uid)),
    ),
  ];
  bindMembers("");

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribeMembers();
  };
}

async function callClanFunction(name, data) {
  const services = await getFirebaseServices();
  if (!services) {
    throw new Error("Firebase authentication is required for clan actions.");
  }
  const { httpsCallable } = await import("firebase/functions");
  const result = await httpsCallable(services.functions, name)(data);
  return result.data;
}

export function createFirebaseClan(payload) {
  return callClanFunction("createClan", payload);
}

export function inviteFirebaseClanMember(clanId, targetUserId) {
  return callClanFunction("inviteClanMember", { clanId, targetUserId });
}

export function respondFirebaseClanInvite(clanId, decision) {
  return callClanFunction("respondClanInvite", { clanId, decision });
}

export function cancelFirebaseClanInvite(clanId, targetUserId) {
  return callClanFunction("cancelClanInvite", { clanId, targetUserId });
}

export function updateFirebaseClanMemberRole(clanId, targetUserId, role) {
  return callClanFunction("updateClanMemberRole", { clanId, targetUserId, role });
}

export function removeFirebaseClanMember(clanId, targetUserId) {
  return callClanFunction("removeClanMember", { clanId, targetUserId });
}

export function transferFirebaseClanOwnership(clanId, targetUserId) {
  return callClanFunction("transferClanOwnership", { clanId, targetUserId });
}

export function leaveFirebaseClan(clanId) {
  return callClanFunction("leaveClan", { clanId });
}
