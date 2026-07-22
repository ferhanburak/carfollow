const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildConvoyDocument,
  buildConvoyEditablePatch,
  buildConvoyMemberDocument,
  buildPublicMapSummary,
  DEFAULT_ARRIVAL_RADIUS_M,
  canDeleteConvoy,
  canManageConvoy,
  canSeeConvoy,
  getDistanceMeters,
  isClosedConvoy,
  presentConvoy,
  resolveConvoyLocationUpdate,
} = require("./convoy");

const host = { id: "host", plate: "06 HOST 06", fullName: "Host", clanId: "clan-1", clan: "Apex", driverScore: 90, harmonyVotes: 8 };
const guest = { id: "guest", plate: "34 GUEST 34", fullName: "Guest", driverScore: 80, harmonyVotes: 6, alertVotes: 0 };

function createConvoy(overrides = {}) {
  return buildConvoyDocument({
    convoyId: "convoy-1", host, invitedProfiles: [], timestamp: "now",
    pin: { name: "Night Run", lat: 39.9, lng: 32.8, route: "Ankara route", routePath: [], time: "22:30", capacity: 8, visibility: "public", accessPolicy: "request", detailVisibility: "trusted", minDriverScore: 75, minHarmonyVotes: 5, maxAlertVotes: 2, ...overrides },
  });
}

test("restricted public summary removes exact route and rounds coordinates", () => {
  const summary = buildPublicMapSummary(createConvoy());
  assert.equal(summary.route, "Restricted route");
  assert.equal(summary.time, "Restricted");
  assert.equal(summary.lat, 40);
  assert.equal(summary.backendCanViewDetails, false);
});

test("trusted visible driver receives exact details while low-score driver receives a locked projection", () => {
  const convoy = createConvoy();
  const trusted = presentConvoy(convoy, guest, null, []);
  const locked = presentConvoy(convoy, { ...guest, id: "low", driverScore: 40 }, null, []);
  assert.equal(trusted.route, "Ankara route");
  assert.equal(trusted.backendCanJoin, true);
  assert.equal(locked.route, "Restricted route");
  assert.equal(locked.backendCanJoin, false);
});

test("friends and clan visibility are evaluated from server-owned relationships", () => {
  const publicConvoy = createConvoy();
  const friendsConvoy = createConvoy({ visibility: "friends" });
  const clanConvoy = createConvoy({ visibility: "clan" });
  // A separate authenticated driver can always discover a public convoy.
  assert.equal(canSeeConvoy(publicConvoy, guest, new Set()), true);
  assert.equal(canSeeConvoy(friendsConvoy, guest, new Set(["host"])), true);
  assert.equal(canSeeConvoy(friendsConvoy, guest, new Set()), false);
  assert.equal(canSeeConvoy(clanConvoy, { ...guest, clanId: "clan-1" }, new Set()), true);
});

test("missing convoy visibility defaults to public discovery", () => {
  const convoy = createConvoy({ visibility: undefined });
  assert.equal(convoy.visibility, "public");
  assert.equal(canSeeConvoy(convoy, guest, new Set()), true);
});

test("member documents preserve identity and reputation snapshots", () => {
  const member = buildConvoyMemberDocument({ convoy: createConvoy(), profile: guest, status: "pending", timestamp: "now" });
  assert.equal(member.id, "convoy-1__guest");
  assert.equal(member.membershipStatus, "pending");
  assert.equal(member.scoreSnapshot, 80);
});

test("convoy management roles keep host authority and allow delegated managers", () => {
  const convoy = createConvoy();
  const hostMembership = buildConvoyMemberDocument({ convoy, profile: host, timestamp: "now" });
  const managerMembership = { ...buildConvoyMemberDocument({ convoy, profile: guest, timestamp: "now" }), managementRole: "manager" };
  const memberMembership = { ...managerMembership, managementRole: "member" };

  assert.equal(hostMembership.managementRole, "host");
  assert.equal(canManageConvoy(convoy, hostMembership, host.id), true);
  assert.equal(canManageConvoy(convoy, managerMembership, guest.id), true);
  assert.equal(canManageConvoy(convoy, memberMembership, guest.id), false);
});

test("editable convoy patch validates capacity and preserves route coordinates", () => {
  const convoy = { ...createConvoy(), approvedCount: 3 };
  const patch = buildConvoyEditablePatch(convoy, {
    name: "Updated Run",
    route: "New route",
    time: "23:00",
    capacity: 10,
    visibility: "friends",
  });

  assert.equal(patch.name, "Updated Run");
  assert.equal(patch.capacity, 10);
  assert.equal(patch.visibility, "friends");
  assert.throws(() => buildConvoyEditablePatch(convoy, { capacity: 2 }), /approved member count/);
});

test("clan members can inspect attendee details for their clan events", () => {
  const convoy = createConvoy({ visibility: "clan" });
  const clanMate = { ...guest, id: "clan-mate", clanId: "clan-1", driverScore: 10, harmonyVotes: 0 };
  const member = buildConvoyMemberDocument({ convoy, profile: guest, timestamp: "now" });
  const presented = presentConvoy(convoy, clanMate, null, [member]);
  assert.equal(presented.backendCanViewDetails, true);
  assert.equal(presented.attendees.length, 1);
});

test("closed convoy deletion is limited to host or clan management", () => {
  const completed = { ...createConvoy(), lifecycleStatus: "completed" };
  const planning = createConvoy();
  const rolling = { ...createConvoy(), lifecycleStatus: "rolling" };
  assert.equal(isClosedConvoy(completed), true);
  assert.equal(isClosedConvoy(planning), false);
  assert.equal(canDeleteConvoy(completed, "host", "member"), true);
  assert.equal(canDeleteConvoy(completed, "clan-owner", "owner"), true);
  assert.equal(canDeleteConvoy(completed, "clan-captain", "captain"), true);
  assert.equal(canDeleteConvoy(completed, "ordinary-member", "member"), false);
  assert.equal(canDeleteConvoy(planning, "host", "member"), false);
  assert.equal(canDeleteConvoy(planning, "clan-owner", "owner"), true);
  assert.equal(canDeleteConvoy(planning, "clan-captain", "captain"), true);
  assert.equal(canDeleteConvoy(planning, "ordinary-member", "member"), false);
  assert.equal(canDeleteConvoy(rolling, "clan-owner", "owner"), false);
});

test("scheduled convoy waits for launch time before GPS tracking starts", () => {
  const convoy = createConvoy({ scheduledStartAtMs: 10_000, routePath: [{ lat: 39.9, lng: 32.8 }, { lat: 39.8, lng: 32.7 }] });
  const update = resolveConvoyLocationUpdate(convoy, { lat: 39.85, lng: 32.75 }, 9_000);
  assert.equal(update.lifecycleStatus, "planning");
  assert.equal(update.tripStatus, "ready");
  assert.equal(update.startsInMs, 1_000);
});

test("GPS heartbeat starts a due convoy and marks destination arrival", () => {
  const destination = { lat: 39.8, lng: 32.7 };
  const convoy = createConvoy({ scheduledStartAtMs: 10_000, routePath: [{ lat: 39.9, lng: 32.8 }, destination] });
  const driving = resolveConvoyLocationUpdate(convoy, { lat: 39.85, lng: 32.75, accuracy: 5 }, 11_000);
  const verifying = resolveConvoyLocationUpdate(convoy, { ...destination, accuracy: 5 }, 11_000);
  const arrived = resolveConvoyLocationUpdate(convoy, { ...destination, accuracy: 5 }, 11_000, {
    tripStatus: verifying.tripStatus,
    arrivalConfirmationCount: verifying.arrivalConfirmationCount,
  });
  assert.equal(driving.lifecycleStatus, "rolling");
  assert.equal(driving.tripStatus, "enroute");
  assert.equal(verifying.tripStatus, "enroute");
  assert.equal(verifying.arrivalConfirmationCount, 1);
  assert.equal(arrived.tripStatus, "arrived");
  assert.equal(arrived.arrivalConfirmationCount, 2);
  assert.equal(arrived.distanceToDestinationM, 0);
  assert.equal(arrived.arrivalRadiusM, 50);
  assert.equal(DEFAULT_ARRIVAL_RADIUS_M, 50);
  assert.ok(getDistanceMeters({ lat: 39.9, lng: 32.8 }, destination) > 10_000);
});

test("arrival verification rejects weak GPS and resets after leaving the destination radius", () => {
  const destination = { lat: 39.8, lng: 32.7 };
  const convoy = createConvoy({
    arrivalRadiusM: 150,
    scheduledStartAtMs: 10_000,
    routePath: [{ lat: 39.9, lng: 32.8 }, destination],
  });
  const weakGps = resolveConvoyLocationUpdate(convoy, { ...destination, accuracy: 120 }, 11_000);
  const firstValid = resolveConvoyLocationUpdate(convoy, { ...destination, accuracy: 10 }, 11_000);
  const outside = resolveConvoyLocationUpdate(
    convoy,
    { lat: destination.lat + 0.001, lng: destination.lng, accuracy: 10 },
    11_000,
    { arrivalConfirmationCount: firstValid.arrivalConfirmationCount },
  );

  assert.equal(weakGps.awaitingAccuracy, true);
  assert.equal(weakGps.arrivalConfirmationCount, 0);
  assert.equal(firstValid.arrivalConfirmationCount, 1);
  assert.equal(outside.insideArrivalRadius, false);
  assert.equal(outside.arrivalConfirmationCount, 0);
  assert.equal(outside.arrivalRadiusM, 50);
});
