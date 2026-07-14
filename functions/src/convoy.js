const CONVOY_SCHEMA_VERSION = 1;
const VISIBILITIES = ["public", "friends", "clan"];
const ACCESS_POLICIES = ["open", "request", "trusted"];
const DETAIL_VISIBILITIES = ["public", "trusted"];
const LIFECYCLE_STATUSES = ["planning", "rolling", "delayed", "completed"];
const TRIP_STATUSES = ["ready", "enroute", "arrived", "cancelled"];

function safeText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function safeCoordinate(value, limit) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || Math.abs(coordinate) > limit) throw new Error("A valid convoy location is required.");
  return Number(coordinate.toFixed(6));
}

function safeRoutePoints(points) {
  if (!Array.isArray(points)) return [];
  return points.slice(0, 40).map((point) => ({ lat: safeCoordinate(point?.lat, 90), lng: safeCoordinate(point?.lng, 180) }));
}

function projectDriver(profile, fallbackUserId = "") {
  const userId = String(profile?.userId ?? profile?.firebaseUid ?? profile?.id ?? fallbackUserId);
  const score = Number(profile?.driverScore ?? profile?.score ?? 0);
  const harmonyVotes = Number(profile?.harmonyVotes ?? 0);
  const alertVotes = Number(profile?.alertVotes ?? 0);
  return {
    userId,
    plate: safeText(profile?.plate, 24),
    fullName: safeText(profile?.fullName, 80) || "CRUISER Driver",
    model: safeText(profile?.model, 100),
    region: safeText(profile?.region, 80),
    score,
    driverScore: score,
    harmonyVotes,
    alertVotes,
    status: alertVotes > 2 || score < 55 ? "Watchlist" : harmonyVotes >= 5 || score >= 85 ? "Uyumlu" : "Convoy Ready",
  };
}

function buildConvoyDocument({ convoyId, pin, host, invitedProfiles = [], timestamp }) {
  const visibility = VISIBILITIES.includes(pin?.visibility) ? pin.visibility : "public";
  const accessPolicy = ACCESS_POLICIES.includes(pin?.accessPolicy) ? pin.accessPolicy : "request";
  const detailVisibility = DETAIL_VISIBILITIES.includes(pin?.detailVisibility) ? pin.detailVisibility : "trusted";
  const rawCapacity = Number(pin?.capacity ?? 12);
  if (!Number.isInteger(rawCapacity) || rawCapacity < 2 || rawCapacity > 50) throw new Error("Convoy capacity must be between 2 and 50.");
  const capacity = rawCapacity;
  const hostProfile = projectDriver(host);
  if (!hostProfile.userId) throw new Error("A convoy host is required.");
  if (visibility === "clan" && !host?.clanId) throw new Error("Clan-only convoys require clan membership.");
  const name = safeText(pin?.name, 100);
  const route = safeText(pin?.route, 240);
  const time = safeText(pin?.time, 40);
  if (!name || !route || !time) throw new Error("Convoy name, route, and launch time are required.");
  const uniqueInvites = Array.from(new Map(invitedProfiles.map((profile) => {
    const projected = projectDriver(profile);
    return [projected.userId, projected];
  }).filter(([userId]) => userId && userId !== hostProfile.userId)).values()).slice(0, 20);
  const routePath = safeRoutePoints(pin?.routePath);
  if (routePath.length === 1) throw new Error("A convoy route needs at least two points.");
  const minDriverScore = Number(pin?.minDriverScore ?? 0);
  const minHarmonyVotes = Number(pin?.minHarmonyVotes ?? 0);
  const maxAlertVotes = Number(pin?.maxAlertVotes ?? 999);
  if (![minDriverScore, minHarmonyVotes, maxAlertVotes].every(Number.isFinite)) throw new Error("Convoy trust limits must be valid numbers.");
  return {
    id: convoyId,
    type: "meet",
    name,
    lat: safeCoordinate(pin?.lat, 90),
    lng: safeCoordinate(pin?.lng, 180),
    route,
    routePath,
    time,
    capacity,
    visibility,
    accessPolicy,
    detailVisibility,
    minDriverScore: Math.min(100, Math.max(0, minDriverScore)),
    minHarmonyVotes: Math.max(0, minHarmonyVotes),
    maxAlertVotes: Math.max(0, maxAlertVotes),
    hostUserId: hostProfile.userId,
    createdByUid: hostProfile.userId,
    createdByPlate: hostProfile.plate,
    createdByName: hostProfile.fullName,
    createdByClan: safeText(host?.clan, 80),
    clanId: safeText(host?.clanId, 160) || null,
    invitedUserIds: uniqueInvites.map((profile) => profile.userId),
    invitedGuests: uniqueInvites,
    lifecycleStatus: "planning",
    approvedCount: 1,
    pendingCount: 0,
    schemaVersion: CONVOY_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildConvoyMemberDocument({ convoy, profile, status = "approved", timestamp }) {
  const driver = projectDriver(profile);
  return {
    id: `${convoy.id}__${driver.userId}`,
    convoyId: convoy.id,
    hostUserId: convoy.hostUserId,
    userId: driver.userId,
    ...driver,
    membershipStatus: status,
    tripStatus: "ready",
    scoreSnapshot: driver.score,
    harmonyVotesSnapshot: driver.harmonyVotes,
    alertVotesSnapshot: driver.alertVotes,
    schemaVersion: CONVOY_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function meetsTrust(convoy, profile) {
  return Number(profile?.driverScore ?? profile?.score ?? 0) >= Number(convoy?.minDriverScore ?? 0) &&
    Number(profile?.harmonyVotes ?? 0) >= Number(convoy?.minHarmonyVotes ?? 0) &&
    Number(profile?.alertVotes ?? 0) <= Number(convoy?.maxAlertVotes ?? 999);
}

function canSeeConvoy(convoy, profile, friendUserIds = new Set(), membership = null) {
  if (convoy.hostUserId === profile?.id || convoy.hostUserId === profile?.firebaseUid) return true;
  if (membership || (convoy.invitedUserIds ?? []).includes(profile?.id ?? profile?.firebaseUid)) return true;
  if (convoy.visibility === "public") return true;
  if (convoy.visibility === "friends") return friendUserIds.has(convoy.hostUserId);
  return convoy.visibility === "clan" && Boolean(profile?.clanId) && profile.clanId === convoy.clanId;
}

function canSeeDetails(convoy, profile, membership = null) {
  const userId = profile?.id ?? profile?.firebaseUid;
  if (convoy.hostUserId === userId) return true;
  if (membership?.membershipStatus === "approved") return true;
  if ((convoy.invitedUserIds ?? []).includes(userId)) return true;
  // Exact location is never exposed to a driver who fails the join threshold.
  return meetsTrust(convoy, profile);
}

function buildPublicMapSummary(convoy) {
  return {
    id: convoy.id,
    type: "meet",
    name: convoy.name,
    lat: Math.round(convoy.lat),
    lng: Math.round(convoy.lng),
    route: "Restricted route",
    routePath: [],
    time: "Restricted",
    capacity: convoy.capacity,
    visibility: convoy.visibility,
    accessPolicy: convoy.accessPolicy,
    detailVisibility: convoy.detailVisibility,
    minDriverScore: convoy.minDriverScore,
    minHarmonyVotes: convoy.minHarmonyVotes,
    maxAlertVotes: convoy.maxAlertVotes,
    createdByUid: convoy.hostUserId,
    createdByPlate: convoy.createdByPlate,
    createdByName: convoy.createdByName,
    createdByClan: convoy.createdByClan,
    lifecycleStatus: convoy.lifecycleStatus,
    approvedCount: convoy.approvedCount,
    backendCanViewDetails: false,
    backendCanJoin: false,
    schemaVersion: CONVOY_SCHEMA_VERSION,
    createdAt: convoy.createdAt,
    updatedAt: convoy.updatedAt,
  };
}

function presentConvoy(convoy, profile, membership, members) {
  const detailsAllowed = canSeeDetails(convoy, profile, membership);
  const approved = members.filter((member) => member.membershipStatus === "approved");
  const pending = members.filter((member) => member.membershipStatus === "pending");
  const full = approved.length >= Number(convoy.capacity ?? 0);
  const joined = membership?.membershipStatus === "approved";
  const pendingSelf = membership?.membershipStatus === "pending";
  const trusted = meetsTrust(convoy, profile);
  const canJoin = !joined && !pendingSelf && !full && trusted && convoy.lifecycleStatus === "planning";
  const base = detailsAllowed ? convoy : buildPublicMapSummary(convoy);
  return {
    ...base,
    backendCanViewDetails: detailsAllowed,
    backendCanJoin: canJoin,
    backendAccessReason: !trusted ? "Driver score or behavior requirements are not met." : full ? "Convoy capacity is full." : pendingSelf ? "Join request is awaiting host approval." : "",
    attendees: detailsAllowed ? approved : [],
    pendingRequests: convoy.hostUserId === (profile?.id ?? profile?.firebaseUid) ? pending : [],
    invitedGuests: detailsAllowed ? (convoy.invitedGuests ?? []) : [],
  };
}

module.exports = {
  ACCESS_POLICIES, CONVOY_SCHEMA_VERSION, DETAIL_VISIBILITIES, LIFECYCLE_STATUSES, TRIP_STATUSES, VISIBILITIES,
  buildConvoyDocument, buildConvoyMemberDocument, buildPublicMapSummary, canSeeConvoy, canSeeDetails,
  meetsTrust, presentConvoy, projectDriver, safeText,
};
