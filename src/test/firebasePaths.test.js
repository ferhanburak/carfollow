import {
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
});
