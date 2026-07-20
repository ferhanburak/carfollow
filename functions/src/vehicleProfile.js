class VehicleProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VehicleProfileError";
    this.code = code;
  }
}

function cleanText(value, field, min, max) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max) {
    throw new VehicleProfileError("invalid-argument", `${field} is invalid.`);
  }
  return text;
}

function cleanOdometer(value) {
  const odometer = Number(value);
  if (!Number.isFinite(odometer) || odometer < 0 || odometer > 5000000) {
    throw new VehicleProfileError("invalid-argument", "Odometer must be between 0 and 5,000,000 KM.");
  }
  return Math.round(odometer * 10) / 10;
}

function buildVehicleProfileUpdate({ input = {}, profile = {}, vehicle = {} }) {
  const currentOdometer = Math.max(Number(profile.odometer ?? 0), Number(vehicle.odometer ?? 0));
  const odometer = cleanOdometer(input.odometer);
  const correctionApplied = odometer < currentOdometer;
  const legacyCorrectionAllowed = !profile.odometerOrigin && !profile.odometerCorrectionUsedAt;
  if (correctionApplied && !legacyCorrectionAllowed) {
    throw new VehicleProfileError("failed-precondition", "Odometer cannot be reduced after its initial correction.");
  }

  const tuningStage = ["Stock", "Stage 1", "Stage 2+", "Stage 3"].includes(input.tuningStage)
    ? input.tuningStage
    : "Stock";
  const horsepower = Number(input.horsepower);
  if (!Number.isFinite(horsepower) || horsepower <= 0 || horsepower > 5000) {
    throw new VehicleProfileError("invalid-argument", "Horsepower is invalid.");
  }

  const shared = {
    fullName: cleanText(input.fullName, "Full name", 2, 80),
    model: cleanText(input.model, "Vehicle model", 2, 100),
    tuningStage,
    horsepower,
    garage: cleanText(input.garage, "Garage", 2, 100),
    region: cleanText(input.region, "Region", 2, 80),
    avatar: cleanText(input.avatar ?? profile.avatar ?? "", "Avatar", 0, 2048),
  };

  return {
    currentOdometer,
    odometer,
    correctionApplied,
    privatePatch: {
      ...shared,
      odometer,
      odometerOrigin: correctionApplied ? "legacy-corrected" : (profile.odometerOrigin ?? "user-entered"),
    },
    publicPatch: shared,
    vehiclePatch: {
      model: shared.model,
      tuningStage,
      horsepower,
      garage: shared.garage,
      odometer,
      odometerOrigin: correctionApplied ? "legacy-corrected" : (vehicle.odometerOrigin ?? profile.odometerOrigin ?? "user-entered"),
      lastOdometerSource: "profile-settings",
    },
  };
}

module.exports = { VehicleProfileError, buildVehicleProfileUpdate };
