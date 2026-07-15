import { describe, expect, it } from "vitest";
import { maskPlate, normalizePlateForSearch, normalizePrivacySettings } from "./privacy";

describe("privacy helpers", () => {
  it("normalizes and masks a plate without exposing its middle characters", () => {
    expect(normalizePlateForSearch("06 pwa-101")).toBe("06PWA101");
    expect(maskPlate("06 PWA 101")).toBe("06 ••• 01");
  });

  it("uses safe defaults for malformed settings", () => {
    expect(normalizePrivacySettings({ locationPrecision: "somewhere" })).toMatchObject({
      plateSearchEnabled: true,
      locationPrecision: "approximate",
    });
  });
});
