const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
  RegistrationError,
  buildRegistrationBundle,
  normalizePlate,
} = require("./registration");

function buildInput(overrides = {}) {
  return {
    uid: "driver-uid",
    email: "driver@example.test",
    acceptKvkk: true,
    timestamp: 123456,
    profile: {
      fullName: "Poyraz Alkan",
      plate: "06 pwa 101",
      model: "Seat Ibiza Cupra",
      garage: "Ankara Apex Garage",
      region: "Ankara Bati",
      horsepower: 248,
      odometer: 12000,
      avatar: "https://firebasestorage.googleapis.com/avatar.jpg",
      tuningStage: "Stage 2+",
      vehicleType: "car",
      driverScore: 999,
      privacy: { plateSearchEnabled: true, locationPrecision: "exact" },
      parts: [{ key: "engine-oil", name: "Engine Oil", lifeExpectancyKm: 10000, replacedKm: 10000 }],
    },
    ...overrides,
  };
}

describe("registration", () => {
  it("normalizes plates consistently", () => {
    assert.equal(normalizePlate(" 06 pwa-101 "), "06PWA101");
  });

  it("builds server-owned identity defaults and private consent", () => {
    const bundle = buildRegistrationBundle(buildInput());
    assert.equal(bundle.claim.plateNormalized, "06PWA101");
    assert.equal(bundle.privateProfile.driverScore, 80);
    assert.equal(bundle.privateProfile.privacy.locationPrecision, "approximate");
    assert.equal(bundle.privateProfile.privacy.plateSearchEnabled, true);
    assert.equal(bundle.privateProfile.privacyConsent.kvkkAcceptedAt, 123456);
    assert.equal(bundle.privateProfile.odometer, 12000);
    assert.equal(bundle.privateProfile.odometerOrigin, "user-entered");
    assert.equal(bundle.publicProfile.avatar, "https://firebasestorage.googleapis.com/avatar.jpg");
    assert.equal(bundle.publicProfile.email, undefined);
    assert.equal(bundle.publicProfile.odometer, undefined);
    assert.equal(bundle.parts[0].id, "vehicle-driver-uid--engine-oil");
  });

  it("requires explicit privacy notice consent", () => {
    assert.throws(
      () => buildRegistrationBundle(buildInput({ acceptKvkk: false })),
      (error) => error instanceof RegistrationError && error.code === "failed-precondition",
    );
  });

  it("rejects invalid vehicle identity fields", () => {
    assert.throws(
      () => buildRegistrationBundle(buildInput({ profile: { ...buildInput().profile, horsepower: 9000 } })),
      (error) => error instanceof RegistrationError && error.code === "invalid-argument",
    );
  });
});
