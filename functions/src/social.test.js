const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildBlockedDriverDocument,
  buildFriendshipDocument,
  buildFriendshipMigrationDocument,
  buildPairId,
  getCounterpartUserId,
  maskPlate,
  normalizePrivacySettings,
  projectPlateSearchResult,
} = require("./social");

const requester = {
  id: "driver-b",
  plate: "06 TEST 02",
  fullName: "Second Driver",
  model: "Seat Ibiza",
  region: "Ankara",
};
const target = {
  id: "driver-a",
  plate: "34 TEST 01",
  fullName: "First Driver",
  model: "Yamaha R6",
  region: "Istanbul",
};

test("buildPairId is stable regardless of request direction", () => {
  assert.equal(buildPairId("driver-b", "driver-a"), "driver-a__driver-b");
  assert.equal(buildPairId("driver-a", "driver-b"), "driver-a__driver-b");
});

test("buildFriendshipDocument stores a participant-scoped pending edge", () => {
  const timestamp = { server: true };
  const document = buildFriendshipDocument({ requester, target, timestamp });

  assert.equal(document.id, "driver-a__driver-b");
  assert.deepEqual(document.participantIds, ["driver-a", "driver-b"]);
  assert.equal(document.requesterUserId, "driver-b");
  assert.equal(document.targetUserId, "driver-a");
  assert.equal(document.status, "pending");
  assert.equal(document.requesterProfile.plate, "06 TEST 02");
  assert.equal(document.targetProfile.model, "Yamaha R6");
  assert.equal(getCounterpartUserId(document, "driver-b"), "driver-a");
});

test("buildBlockedDriverDocument keeps the block private-owner scoped", () => {
  const timestamp = { server: true };
  const document = buildBlockedDriverDocument({ ownerUserId: "driver-b", target, timestamp });

  assert.equal(document.ownerUserId, "driver-b");
  assert.equal(document.targetUserId, "driver-a");
  assert.equal(document.targetProfile.fullName, "First Driver");
  assert.equal(document.blockedAt, timestamp);
});

test("buildFriendshipMigrationDocument upgrades a legacy edge without changing its direction", () => {
  const timestamp = { server: true };
  const createdAt = { legacy: true };
  const document = buildFriendshipMigrationDocument({
    friendship: {
      requesterUserId: "driver-a",
      targetUserId: "driver-b",
      status: "pending",
      createdAt,
    },
    leftProfile: requester,
    rightProfile: target,
    timestamp,
  });

  assert.deepEqual(document.participantIds, ["driver-a", "driver-b"]);
  assert.equal(document.requesterUserId, "driver-a");
  assert.equal(document.targetUserId, "driver-b");
  assert.equal(document.requesterProfile.plate, "34 TEST 01");
  assert.equal(document.createdAt, createdAt);
  assert.equal(document.updatedAt, timestamp);
});

test("plate search always returns a masked, privacy-scoped profile", () => {
  const result = projectPlateSearchResult({
    ...target,
    privacy: { plateSearchEnabled: true, showModelInSearch: false, showRegionInSearch: true },
  });

  assert.equal(result.plateMasked, "34 ••• 01");
  assert.equal(result.fullName, "CRUISER Driver");
  assert.equal(result.model, "");
  assert.equal(result.region, "Istanbul");
  assert.equal(maskPlate("06 TEST 02"), "06 ••• 02");
  assert.equal(normalizePrivacySettings({ locationPrecision: "bad" }).locationPrecision, "approximate");
});
