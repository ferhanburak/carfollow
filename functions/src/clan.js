const CLAN_SCHEMA_VERSION = 1;
const CLAN_ROLES = Object.freeze(["owner", "captain", "member"]);

function sanitizeClanText(value, maxLength) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeClanName(value) {
  return sanitizeClanText(value, 48).toLocaleLowerCase("tr-TR");
}

function normalizeClanTag(value) {
  return sanitizeClanText(value, 6).replace(/\s+/g, "").toUpperCase();
}

function projectClanProfile(profile, fallbackUserId = "") {
  const userId = String(profile?.id ?? profile?.userId ?? profile?.firebaseUid ?? fallbackUserId);
  return {
    userId,
    plate: String(profile?.plate ?? ""),
    fullName: String(profile?.fullName ?? profile?.plate ?? "Unknown Driver"),
    model: String(profile?.model ?? ""),
    region: String(profile?.region ?? ""),
    avatar: String(profile?.avatar ?? ""),
    driverScore: Number(profile?.driverScore ?? 0),
    monthlyKm: Number(profile?.monthlyKm ?? 0),
  };
}

function buildClanDocument({ clanId, owner, name, tag, description, periodKey = "", timestamp }) {
  const ownerProfile = projectClanProfile(owner);
  const safeName = sanitizeClanText(name, 48);
  const safeTag = normalizeClanTag(tag);

  return {
    id: clanId,
    name: safeName,
    nameNormalized: normalizeClanName(safeName),
    tag: safeTag,
    tagNormalized: safeTag.toLowerCase(),
    description: sanitizeClanText(description, 280) || "Yeni kurulan CRUISER klani.",
    ownerUserId: ownerProfile.userId,
    ownerPlate: ownerProfile.plate,
    ownerName: ownerProfile.fullName,
    createdByUserId: ownerProfile.userId,
    captainPlate: ownerProfile.plate,
    memberCount: 1,
    // Legacy UI reads `members`; keep it in sync until leaderboard migration is complete.
    members: 1,
    km: 0,
    monthlyKm: 0,
    monthlyKmPeriod: String(periodKey),
    visibility: "public",
    schemaVersion: CLAN_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildClanMemberDocument({ clanId, profile, role, periodKey = "", timestamp }) {
  const member = projectClanProfile(profile);
  return {
    id: `${clanId}__${member.userId}`,
    clanId,
    userId: member.userId,
    role,
    ...member,
    // Only kilometers driven after joining count toward this clan.
    monthlyKm: 0,
    monthlyKmPeriod: String(periodKey),
    schemaVersion: CLAN_SCHEMA_VERSION,
    joinedAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildClanInviteDocument({ clan, inviter, target, timestamp }) {
  const inviterProfile = projectClanProfile(inviter);
  const targetProfile = projectClanProfile(target);
  return {
    id: `${clan.id}__${targetProfile.userId}`,
    clanId: clan.id,
    clanName: clan.name,
    clanTag: clan.tag,
    targetUserId: targetProfile.userId,
    targetPlate: targetProfile.plate,
    targetName: targetProfile.fullName,
    targetModel: targetProfile.model,
    invitedByUserId: inviterProfile.userId,
    invitedByPlate: inviterProfile.plate,
    invitedByName: inviterProfile.fullName,
    invitedByRole: "member",
    status: "pending",
    schemaVersion: CLAN_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isClanRole(role) {
  return CLAN_ROLES.includes(role);
}

function canInviteClanMember(role) {
  return role === "owner" || role === "captain";
}

function canManageClanMember(actorRole, targetRole) {
  if (actorRole === "owner") {
    return targetRole !== "owner";
  }
  return actorRole === "captain" && targetRole === "member";
}

module.exports = {
  CLAN_ROLES,
  CLAN_SCHEMA_VERSION,
  buildClanDocument,
  buildClanInviteDocument,
  buildClanMemberDocument,
  canInviteClanMember,
  canManageClanMember,
  isClanRole,
  normalizeClanName,
  normalizeClanTag,
  projectClanProfile,
  sanitizeClanText,
};
