const SOCIAL_SCHEMA_VERSION = 1;

function buildPairId(leftId, rightId) {
  return [String(leftId), String(rightId)]
    .sort((left, right) => left.localeCompare(right))
    .join("__");
}

function projectSocialProfile(profile, fallbackUserId = "") {
  const userId = String(profile?.userId ?? profile?.firebaseUid ?? profile?.id ?? fallbackUserId);

  return {
    userId,
    plate: String(profile?.plate ?? ""),
    fullName: String(profile?.fullName ?? profile?.plate ?? ""),
    model: String(profile?.model ?? ""),
    region: String(profile?.region ?? ""),
    avatar: String(profile?.avatar ?? ""),
  };
}

function buildFriendshipDocument({ requester, target, timestamp }) {
  const requesterProfile = projectSocialProfile(requester);
  const targetProfile = projectSocialProfile(target);

  return {
    id: buildPairId(requesterProfile.userId, targetProfile.userId),
    requesterUserId: requesterProfile.userId,
    targetUserId: targetProfile.userId,
    participantIds: [requesterProfile.userId, targetProfile.userId].sort((left, right) =>
      left.localeCompare(right),
    ),
    participants: {
      [requesterProfile.userId]: true,
      [targetProfile.userId]: true,
    },
    requesterProfile,
    targetProfile,
    status: "pending",
    schemaVersion: SOCIAL_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildFriendshipMigrationDocument({ friendship, leftProfile, rightProfile, timestamp }) {
  const profilesById = new Map(
    [leftProfile, rightProfile]
      .map((profile) => projectSocialProfile(profile))
      .map((profile) => [profile.userId, profile]),
  );
  const requester = profilesById.get(friendship?.requesterUserId);
  const target = profilesById.get(friendship?.targetUserId);
  if (!requester || !target || requester.userId === target.userId) {
    return null;
  }

  return {
    ...buildFriendshipDocument({ requester, target, timestamp }),
    status: friendship.status ?? "pending",
    createdAt: friendship.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function buildBlockedDriverDocument({ ownerUserId, target, timestamp }) {
  const targetProfile = projectSocialProfile(target);

  return {
    id: targetProfile.userId,
    ownerUserId,
    targetUserId: targetProfile.userId,
    targetProfile,
    schemaVersion: SOCIAL_SCHEMA_VERSION,
    blockedAt: timestamp,
    updatedAt: timestamp,
  };
}

function getCounterpartUserId(friendship, userId) {
  return (friendship?.participantIds ?? []).find((participantId) => participantId !== userId) ?? null;
}

module.exports = {
  SOCIAL_SCHEMA_VERSION,
  buildBlockedDriverDocument,
  buildFriendshipDocument,
  buildFriendshipMigrationDocument,
  buildPairId,
  getCounterpartUserId,
  projectSocialProfile,
};
