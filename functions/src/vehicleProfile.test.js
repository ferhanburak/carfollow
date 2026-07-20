const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { VehicleProfileError, buildVehicleProfileUpdate } = require("./vehicleProfile");

const input = {
  fullName: "Poyraz Alkan",
  model: "Seat Ibiza Cupra",
  tuningStage: "Stage 2+",
  horsepower: 248,
  garage: "Apex Garage",
  region: "Ankara Bati",
  avatar: "https://firebasestorage.googleapis.com/avatar.jpg",
  odometer: 68500,
};

describe("vehicle profile update", () => {
  it("updates profile and vehicle odometer consistently", () => {
    const result = buildVehicleProfileUpdate({ input, profile: { odometer: 68420, odometerOrigin: "user-entered" }, vehicle: { odometer: 68420 } });
    assert.equal(result.privatePatch.odometer, 68500);
    assert.equal(result.vehiclePatch.odometer, 68500);
    assert.equal(result.publicPatch.odometer, undefined);
    assert.equal(result.correctionApplied, false);
  });

  it("allows one downward correction for a legacy default", () => {
    const result = buildVehicleProfileUpdate({ input: { ...input, odometer: 8200 }, profile: { odometer: 12000 }, vehicle: { odometer: 12000 } });
    assert.equal(result.correctionApplied, true);
    assert.equal(result.privatePatch.odometerOrigin, "legacy-corrected");
  });

  it("rejects reducing a user-entered or previously corrected odometer", () => {
    assert.throws(
      () => buildVehicleProfileUpdate({ input: { ...input, odometer: 8000 }, profile: { odometer: 12000, odometerOrigin: "user-entered" }, vehicle: { odometer: 12000 } }),
      (error) => error instanceof VehicleProfileError && error.code === "failed-precondition",
    );
  });
});
