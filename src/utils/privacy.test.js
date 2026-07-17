import { describe, expect, it } from "vitest";
import {
  buildPrivacyAwareTelemetry,
  maskPlate,
  normalizePlateForSearch,
  normalizePrivacySettings,
  projectTelemetryLocation,
} from "./privacy";

describe("privacy helpers", () => {
  it("normalizes and masks a plate without exposing its middle characters", () => {
    expect(normalizePlateForSearch("06 pwa-101")).toBe("06PWA101");
    expect(maskPlate("06 PWA 101")).toBe("06 ••• 01");
  });

  it("uses safe defaults for malformed settings", () => {
    expect(normalizePrivacySettings({ locationPrecision: "somewhere" })).toMatchObject({
      plateSearchEnabled: false,
      locationPrecision: "approximate",
    });
  });

  it("removes coordinates inside the private safe zone", () => {
    expect(projectTelemetryLocation(
      { lat: 39.9, lng: 32.8 },
      { locationPrecision: "exact", safeZoneEnabled: true, safeZone: { lat: 39.9, lng: 32.8, radiusM: 300 } },
    )).toEqual({ locationVisibility: "safe-zone", safeZoneActive: true });
  });

  it("rounds approximate coordinates and never publishes the safe zone center", () => {
    const telemetry = buildPrivacyAwareTelemetry({
      active: true,
      plate: "06 PWA 101",
      location: { lat: 39.95678, lng: 32.74321 },
      safeZone: { lat: 1, lng: 2, radiusM: 300 },
    }, {
      locationPrecision: "approximate",
      showPlateOnLiveMap: false,
    });
    expect(telemetry).toMatchObject({ lat: 39.96, lng: 32.74, locationVisibility: "approximate" });
    expect(telemetry.plate).not.toBe("06 PWA 101");
    expect(telemetry).not.toHaveProperty("safeZone");
    expect(telemetry).not.toHaveProperty("location");
  });
});
