const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildConvoyDocument,
  buildConvoyMemberDocument,
  buildPublicMapSummary,
  canSeeConvoy,
  getDistanceMeters,
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
  const driving = resolveConvoyLocationUpdate(convoy, { lat: 39.85, lng: 32.75 }, 11_000);
  const arrived = resolveConvoyLocationUpdate(convoy, destination, 11_000);
  assert.equal(driving.lifecycleStatus, "rolling");
  assert.equal(driving.tripStatus, "enroute");
  assert.equal(arrived.tripStatus, "arrived");
  assert.equal(arrived.distanceToDestinationM, 0);
  assert.ok(getDistanceMeters({ lat: 39.9, lng: 32.8 }, destination) > 10_000);
});
