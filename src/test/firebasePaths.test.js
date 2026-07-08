import {
  privateUserCollectionPath,
  publicCollectionPath,
  realtimeDmPath,
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
  });

  it("creates a realtime dm path from plate values", () => {
    expect(realtimeDmPath("34 MOTO 410")).toBe("directMessages/34_MOTO_410");
  });
});
