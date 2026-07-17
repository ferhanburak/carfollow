const SOCIAL_SCHEMA_VERSION = 1;

const DEFAULT_PRIVACY_SETTINGS = Object.freeze({
  plateSearchEnabled: false,
  showPlateOnLiveMap: false,
  showModelInSearch: true,
  showRegionInSearch: false,
  locationPrecision: "approximate",
  safeZoneEnabled: true,
  safeZone: null,
  kvkkConsentVersion: "2026-07",
});

function normalizeSafeZone(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  const radiusM = Number(value?.radiusM);
  if (
    !Number.isFinite(lat) || lat < -90 || lat > 90 ||
    !Number.isFinite(lng) || lng < -180 || lng > 180 ||
    !Number.isFinite(radiusM)
  ) return null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    radiusM: Math.round(Math.min(2000, Math.max(100, radiusM))),
  };
}

function normalizePlate(value) {
  return String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function maskPlate(value) {
  const normalized = normalizePlate(value);
  if (normalized.length < 5) return "•• ••• ••";
  return `${normalized.slice(0, Math.min(2, normalized.length - 3))} ••• ${normalized.slice(-2)}`;
}

function normalizePrivacySettings(value = {}) {
  return {
    ...DEFAULT_PRIVACY_SETTINGS,
    plateSearchEnabled: value.plateSearchEnabled === true,
    showPlateOnLiveMap: value.showPlateOnLiveMap === true,
    showModelInSearch: value.showModelInSearch !== false,
    showRegionInSearch: value.showRegionInSearch === true,
    safeZoneEnabled: value.safeZoneEnabled !== false,
    safeZone: normalizeSafeZone(value.safeZone),
    locationPrecision: ["hidden", "approximate", "exact"].includes(value.locationPrecision)
      ? value.locationPrecision
      : DEFAULT_PRIVACY_SETTINGS.locationPrecision,
  };
}

function projectPlateSearchResult(profile, fallbackUserId = "") {
  const privacy = normalizePrivacySettings(profile?.privacy);
  return {
    userId: String(profile?.id ?? profile?.userId ?? profile?.firebaseUid ?? fallbackUserId),
    plateMasked: maskPlate(profile?.plate),
    fullName: "CRUISER Driver",
    model: privacy.showModelInSearch ? String(profile?.model ?? "") : "",
    region: privacy.showRegionInSearch ? String(profile?.region ?? "") : "",
    vehicleType: String(profile?.vehicleType ?? ""),
    driverScore: Number(profile?.driverScore ?? 0),
  };
}

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
  DEFAULT_PRIVACY_SETTINGS,
  buildBlockedDriverDocument,
  buildFriendshipDocument,
  buildFriendshipMigrationDocument,
  buildPairId,
  getCounterpartUserId,
  maskPlate,
  normalizePlate,
  normalizePrivacySettings,
  projectPlateSearchResult,
  projectSocialProfile,
};
