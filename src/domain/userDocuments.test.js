import { describe, expect, it } from "vitest";
import {
  buildPrivateUserProfile,
  buildPrivateUserProfilePatch,
  buildPublicUserProfile,
  buildPublicUserProfilePatch,
  mergePrivateUserCollections,
  normalizePlate,
} from "./userDocuments";

describe("user document contracts", () => {
  const firebaseUser = { uid: "firebase-user-1", email: "driver@example.com" };
  const user = {
    id: "local-user",
    fullName: "Poyraz Alkan",
    plate: "06 pwa 101",
    password: "never-persist-this",
    model: "Seat Ibiza Cupra",
    primaryVehicleId: "vehicle-firebase-user-1",
    parts: [{ key: "oil" }],
    fuelLogs: [{ id: "fuel-1" }],
    serviceLogs: [{ id: "service-1" }],
    vehiclePassport: { vehicleId: "vehicle-1" },
    conversations: { thread: { messages: [] } },
    friends: [{ userId: "friend-1" }],
    incomingRequests: [{ userId: "incoming-1" }],
    outgoingRequests: [{ userId: "outgoing-1" }],
    blockedDrivers: [{ userId: "blocked-1" }],
    driverScore: 91,
  };

  it("normalizes a plate into a stable claim id", () => {
    expect(normalizePlate(" 06 pwa-101 ")).toBe("06PWA101");
  });

  it("keeps sensitive and subcollection data out of the private profile document", () => {
    const profile = buildPrivateUserProfile(user, firebaseUser);

    expect(profile).toMatchObject({
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      plate: "06 PWA 101",
      plateNormalized: "06PWA101",
      primaryVehicleId: "vehicle-firebase-user-1",
      schemaVersion: 2,
    });
    expect(profile).not.toHaveProperty("password");
    expect(profile).not.toHaveProperty("parts");
    expect(profile).not.toHaveProperty("fuelLogs");
    expect(profile).not.toHaveProperty("serviceLogs");
    expect(profile).not.toHaveProperty("conversations");
    expect(profile).not.toHaveProperty("friends");
    expect(profile).not.toHaveProperty("incomingRequests");
    expect(profile).not.toHaveProperty("outgoingRequests");
    expect(profile).not.toHaveProperty("blockedDrivers");
    expect(profile).not.toHaveProperty("vehiclePassport");
  });

  it("builds a public profile without private account fields", () => {
    const profile = buildPublicUserProfile(user, firebaseUser);

    expect(profile).toMatchObject({
      userId: firebaseUser.uid,
      plate: "06 PWA 101",
      model: "Seat Ibiza Cupra",
      driverScore: 91,
    });
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("password");
  });

  it("omits backend-owned counters from routine profile patches", () => {
    const source = {
      ...user,
      monthlyKm: 842,
      monthlyKmPeriod: "2026-07",
      achievementBadges: ["Gece Savascisi"],
      driverStats: { monthlyKm: 842 },
      odometer: 68420,
    };
    const privatePatch = buildPrivateUserProfilePatch(source, firebaseUser);
    const publicPatch = buildPublicUserProfilePatch(source, firebaseUser);

    expect(privatePatch).not.toHaveProperty("monthlyKm");
    expect(privatePatch).not.toHaveProperty("odometer");
    expect(privatePatch).not.toHaveProperty("driverStats");
    expect(privatePatch).not.toHaveProperty("badges");
    expect(publicPatch).not.toHaveProperty("monthlyKm");
    expect(publicPatch).not.toHaveProperty("achievementBadges");
    expect(publicPatch).not.toHaveProperty("badges");
  });

  it("hydrates normalized private collections", () => {
    expect(
      mergePrivateUserCollections({ id: firebaseUser.uid }, {
        fuelLogs: user.fuelLogs,
        parts: user.parts,
        serviceLogs: user.serviceLogs,
      }),
    ).toMatchObject({
      fuelLogs: user.fuelLogs,
      parts: user.parts,
      serviceLogs: user.serviceLogs,
    });
  });
});
