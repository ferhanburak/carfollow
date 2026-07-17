import { describe, expect, it } from "vitest";
import { normalizeFirebaseActiveDrivers } from "./firebaseCruiserRepository";

describe("normalizeFirebaseActiveDrivers", () => {
  it("returns only fresh active telemetry records", () => {
    const now = 100_000;
    const drivers = normalizeFirebaseActiveDrivers({
      newest: {
        active: true,
        plate: "06 LIVE 01",
        vehicle: "Audi A5",
        node: "Ankara Merkez",
        speed: 92.6,
        updatedAt: now - 1_000,
      },
      older: {
        active: true,
        plate: "34 LIVE 02",
        speed: 75,
        updatedAt: now - 5_000,
      },
      stopped: {
        active: false,
        plate: "35 STOP 03",
        updatedAt: now,
      },
      stale: {
        active: true,
        plate: "16 OLD 04",
        updatedAt: now - 20_001,
      },
    }, now);

    expect(drivers).toEqual([
      {
        firebaseUid: "newest",
        plate: "06 LIVE 01",
        vehicle: "Audi A5",
        node: "Ankara Merkez",
        speed: 93,
        locationVisibility: "hidden",
        safeZoneActive: false,
        updatedAt: now - 1_000,
      },
      {
        firebaseUid: "older",
        plate: "34 LIVE 02",
        vehicle: "Vehicle not shared",
        node: "Location hidden",
        speed: 75,
        locationVisibility: "hidden",
        safeZoneActive: false,
        updatedAt: now - 5_000,
      },
    ]);
  });

  it("keeps only already-sanitized public coordinates", () => {
    const drivers = normalizeFirebaseActiveDrivers({
      visible: {
        active: true,
        plate: "06 *** 01",
        lat: 39.96,
        lng: 32.74,
        locationVisibility: "approximate",
        updatedAt: 99_000,
      },
    }, 100_000);
    expect(drivers[0]).toMatchObject({ lat: 39.96, lng: 32.74, locationVisibility: "approximate" });
  });
});
