const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ACCOUNT_DELETE_CONFIRMATION,
  buildAccountExport,
  buildWithdrawnPrivacySettings,
  hasRecentAuthentication,
  requireDeletionConfirmation,
} = require("./accountLifecycle");

test("consent withdrawal disables every discovery and location surface", () => {
  const privacy = buildWithdrawnPrivacySettings({ plateSearchEnabled: true, locationPrecision: "exact" });
  assert.equal(privacy.plateSearchEnabled, false);
  assert.equal(privacy.showPlateOnLiveMap, false);
  assert.equal(privacy.locationPrecision, "hidden");
  assert.equal(privacy.safeZoneEnabled, false);
  assert.equal(privacy.safeZone, null);
});

test("account deletion requires exact confirmation and a recent sign-in", () => {
  assert.doesNotThrow(() => requireDeletionConfirmation(ACCOUNT_DELETE_CONFIRMATION));
  assert.throws(() => requireDeletionConfirmation("delete"));
  const now = Date.UTC(2026, 6, 17, 12, 0, 0);
  assert.equal(hasRecentAuthentication(now / 1000 - 599, now), true);
  assert.equal(hasRecentAuthentication(now / 1000 - 601, now), false);
});

test("account export keeps private and social sections explicitly separated", () => {
  const payload = buildAccountExport({
    userId: "driver-1",
    profile: { fullName: "Driver" },
    collections: { vehicles: [{ id: "vehicle-1" }] },
    social: { friendships: [{ id: "edge-1" }] },
    exportedAt: "2026-07-17T12:00:00.000Z",
  });
  assert.equal(payload.exportVersion, 1);
  assert.equal(payload.collections.vehicles[0].id, "vehicle-1");
  assert.equal(payload.social.friendships[0].id, "edge-1");
});
