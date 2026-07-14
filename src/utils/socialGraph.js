function createConnectionRecord(profile, status, createdAt = Date.now()) {
  return {
    userId: profile.userId ?? profile.id ?? profile.plate,
    plate: profile.plate,
    fullName: profile.fullName,
    model: profile.model,
    region: profile.region,
    clan: profile.clan ?? "",
    avatar: profile.avatar ?? "",
    status,
    createdAt,
  };
}

function sortByNewest(items) {
  return [...items].sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0));
}

export function normalizeSocialState(user) {
  return {
    ...user,
    blockedDrivers: sortByNewest(user.blockedDrivers ?? []),
    friends: sortByNewest(user.friends ?? []),
    incomingRequests: sortByNewest(user.incomingRequests ?? []),
    outgoingRequests: sortByNewest(user.outgoingRequests ?? []),
  };
}

export function getFriendshipStatus(user, targetPlate) {
  if (!user || !targetPlate) {
    return "none";
  }
  if (user.plate === targetPlate) {
    return "self";
  }
  if ((user.blockedDrivers ?? []).some((entry) => entry.plate === targetPlate)) {
    return "blocked";
  }
  if ((user.friends ?? []).some((entry) => entry.plate === targetPlate)) {
    return "friend";
  }
  if ((user.outgoingRequests ?? []).some((entry) => entry.plate === targetPlate)) {
    return "outgoing";
  }
  if ((user.incomingRequests ?? []).some((entry) => entry.plate === targetPlate)) {
    return "incoming";
  }
  return "none";
}

export function searchCommunityMembers(query, directory, user) {
  const normalizedQuery = query.trim().toLowerCase();
  const blockedUserIds = new Set((user?.blockedDrivers ?? []).map((entry) => entry.userId));
  const blockedPlates = new Set((user?.blockedDrivers ?? []).map((entry) => entry.plate));
  const entries = (directory ?? []).filter(
    (entry) =>
      entry.plate !== user?.plate &&
      !blockedUserIds.has(entry.userId) &&
      !blockedPlates.has(entry.plate),
  );
  const filteredEntries = normalizedQuery
    ? entries.filter((entry) =>
        [entry.plate, entry.model, entry.fullName, entry.region, entry.clan]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(normalizedQuery)),
      )
    : entries;

  return filteredEntries.map((entry) => ({
    ...entry,
    friendshipStatus: getFriendshipStatus(user, entry.plate),
  }));
}

export function sendFriendRequest(user, profile) {
  if (!user || !profile || user.plate === profile.plate) {
    return user;
  }

  const state = normalizeSocialState(user);
  const existingStatus = getFriendshipStatus(state, profile.plate);
  if (existingStatus !== "none") {
    return state;
  }

  const nextOutgoing = createConnectionRecord(profile, "pending");
  return {
    ...state,
    outgoingRequests: [nextOutgoing, ...state.outgoingRequests],
  };
}

export function acceptFriendRequest(user, plate) {
  const state = normalizeSocialState(user);
  const request = state.incomingRequests.find((entry) => entry.plate === plate);
  if (!request) {
    return state;
  }

  return {
    ...state,
    friends: [
      createConnectionRecord(request, "accepted", Date.now()),
      ...state.friends.filter((entry) => entry.plate !== plate),
    ],
    incomingRequests: state.incomingRequests.filter((entry) => entry.plate !== plate),
  };
}

export function rejectFriendRequest(user, plate) {
  const state = normalizeSocialState(user);
  return {
    ...state,
    incomingRequests: state.incomingRequests.filter((entry) => entry.plate !== plate),
  };
}

export function cancelOutgoingFriendRequest(user, plate) {
  const state = normalizeSocialState(user);
  return {
    ...state,
    outgoingRequests: state.outgoingRequests.filter((entry) => entry.plate !== plate),
  };
}

export function removeFriend(user, plate) {
  const state = normalizeSocialState(user);
  return {
    ...state,
    friends: state.friends.filter((entry) => entry.plate !== plate),
  };
}

export function blockCommunityMember(user, profile) {
  if (!user || !profile || user.plate === profile.plate) {
    return user;
  }

  const state = normalizeSocialState(user);
  const blockedRecord = createConnectionRecord(profile, "blocked");
  return {
    ...state,
    blockedDrivers: [
      blockedRecord,
      ...state.blockedDrivers.filter((entry) => entry.plate !== profile.plate),
    ],
    friends: state.friends.filter((entry) => entry.plate !== profile.plate),
    incomingRequests: state.incomingRequests.filter((entry) => entry.plate !== profile.plate),
    outgoingRequests: state.outgoingRequests.filter((entry) => entry.plate !== profile.plate),
    conversations: Object.fromEntries(
      Object.entries(state.conversations ?? {}).filter(([, conversation]) =>
        conversation.participantPlate !== profile.plate,
      ),
    ),
  };
}

export function unblockCommunityMember(user, plate) {
  const state = normalizeSocialState(user);
  return {
    ...state,
    blockedDrivers: state.blockedDrivers.filter((entry) => entry.plate !== plate),
  };
}
