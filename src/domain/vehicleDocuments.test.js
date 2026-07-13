import { describe, expect, it } from "vitest";
import {
  buildVehicleDocument,
  buildVehiclePartDocument,
  buildVehiclePassportDocument,
  dedupeVehicleParts,
  mergeVehiclePassportBundle,
  resolvePrimaryVehicleId,
  vehiclePartDocumentId,
} from "./vehicleDocuments";

describe("vehicle document contracts", () => {
  const user = {
    id: "user-42",
    firebaseUid: "user-42",
    fullName: "Poyraz Alkan",
    plate: "06 PWA 101",
    model: "Seat Ibiza Cupra",
    vehicleType: "car",
    tuningStage: "Stage 2+",
    horsepower: 248,
    odometer: 68420,
    garage: "Apex Garage",
    serviceLogs: [{ id: "service-1", cost: 2250 }],
    fuelLogs: [{ id: "fuel-1" }],
  };

  it("creates a stable primary vehicle id from the owner uid", () => {
    expect(resolvePrimaryVehicleId(user)).toBe("vehicle-user-42");
    expect(resolvePrimaryVehicleId({ ...user, primaryVehicleId: "car/custom 1" })).toBe("car-custom-1");
  });

  it("builds separate vehicle and passport documents", () => {
    const vehicle = buildVehicleDocument(user);
    const passport = buildVehiclePassportDocument(user);

    expect(vehicle).toMatchObject({
      vehicleId: "vehicle-user-42",
      ownerId: "user-42",
      plateNormalized: "06PWA101",
      odometer: 68420,
    });
    expect(passport).toMatchObject({
      vehicleId: "vehicle-user-42",
      serviceLogCount: 1,
      fuelLogCount: 1,
      totalServiceSpend: 2250,
    });
  });

  it("uses vehicle-scoped part ids and prefers migrated part records", () => {
    const vehicleId = resolvePrimaryVehicleId(user);
    const legacyPart = { key: "oil", replacedKm: 60000 };
    const scopedPart = buildVehiclePartDocument({ key: "oil", replacedKm: 64000 }, user.id, vehicleId);

    expect(vehiclePartDocumentId(vehicleId, "oil")).toBe("vehicle-user-42--oil");
    expect(dedupeVehicleParts([scopedPart, legacyPart], vehicleId)).toEqual([scopedPart]);
  });

  it("hydrates the active vehicle without replacing the account id", () => {
    const vehicle = buildVehicleDocument(user);
    const passport = buildVehiclePassportDocument(user);
    const hydrated = mergeVehiclePassportBundle(
      { id: user.id, fullName: user.fullName },
      { vehicle, passport, fuelLogs: user.fuelLogs, parts: [], serviceLogs: user.serviceLogs },
    );

    expect(hydrated.id).toBe(user.id);
    expect(hydrated.primaryVehicleId).toBe(vehicle.vehicleId);
    expect(hydrated.vehiclePassport).toEqual(passport);
  });
});
