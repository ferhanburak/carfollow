import {
  PRIVATE_COLLECTIONS,
  PUBLIC_COLLECTIONS,
  privateUserCollectionPath,
  privateUserDocumentPath,
  publicCollectionPath,
  publicDocumentPath,
  realtimeDmPath,
  realtimePresenceUserPath,
  realtimeTelemetryUserPath,
  resolveAppId,
} from "../services/firebasePaths";

describe("firebase path helpers", () => {
  it("resolves the fallback app id in local mode", () => {
    expect(resolveAppId()).toBe("cruiser-app-prod");
  });

  it("creates public and private firestore paths", () => {
    expect(publicCollectionPath("spots", "demo-app")).toBe("/artifacts/demo-app/public/data/spots");
    expect(privateUserCollectionPath("user-42", "fuelLogs", "demo-app")).toBe(
      "/artifacts/demo-app/users/user-42/fuelLogs",
    );
    expect(publicDocumentPath("publicProfiles", "user-42", "demo-app")).toBe(
      "/artifacts/demo-app/public/data/publicProfiles/user-42",
    );
    expect(privateUserDocumentPath("user-42", "profile", "current", "demo-app")).toBe(
      "/artifacts/demo-app/users/user-42/profile/current",
    );
    expect(privateUserDocumentPath("user-42", PRIVATE_COLLECTIONS.vehicles, "vehicle-42", "demo-app")).toBe(
      "/artifacts/demo-app/users/user-42/vehicles/vehicle-42",
    );
    expect(
      privateUserDocumentPath("user-42", PRIVATE_COLLECTIONS.vehiclePassports, "vehicle-42", "demo-app"),
    ).toBe("/artifacts/demo-app/users/user-42/vehiclePassports/vehicle-42");
    expect(privateUserDocumentPath("user-42", PRIVATE_COLLECTIONS.blockedUsers, "blocked-42", "demo-app"))
      .toBe("/artifacts/demo-app/users/user-42/blockedUsers/blocked-42");
  });

  it("creates a realtime dm path from plate values", () => {
    expect(realtimeDmPath("34 MOTO 410")).toBe("directMessages/34_MOTO_410");
  });

  it("uses stable user ids for presence and telemetry", () => {
    expect(realtimePresenceUserPath("firebase-user-1", "demo-app")).toBe(
      "artifacts/demo-app/realtime/presence/firebase-user-1",
    );
    expect(realtimeTelemetryUserPath("firebase-user-1", "demo-app")).toBe(
      "artifacts/demo-app/realtime/telemetry/firebase-user-1",
    );
  });

  it("defines backend-owned driver stats collections", () => {
    expect(PUBLIC_COLLECTIONS.individualLeaderboard).toBe("individualLeaderboard");
    expect(PRIVATE_COLLECTIONS.driverStats).toBe("driverStats");
    expect(PRIVATE_COLLECTIONS.driveSessions).toBe("driveSessions");
  });
});
