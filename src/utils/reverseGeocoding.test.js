import { describe, expect, it } from "vitest";
import {
  formatDistrictLocation,
  shouldRefreshResolvedLocation,
} from "./reverseGeocoding";

describe("reverse geocoding helpers", () => {
  it("formats a privacy-friendly neighborhood and district label", () => {
    const results = [{
      address_components: [
        { long_name: "7. Cadde", types: ["route"] },
        { long_name: "Bahcelievler Mahallesi", types: ["neighborhood"] },
        { long_name: "Cankaya", types: ["administrative_area_level_2"] },
        { long_name: "Ankara", types: ["administrative_area_level_1"] },
      ],
    }];

    expect(formatDistrictLocation(results)).toBe("Bahcelievler Mahallesi / Cankaya");
    expect(formatDistrictLocation(results)).not.toContain("7. Cadde");
  });

  it("refreshes only after meaningful movement or the cache interval", () => {
    const previous = {
      location: { lat: 39.9208, lng: 32.8541 },
      resolvedAt: 1_000,
    };

    expect(shouldRefreshResolvedLocation(previous, { lat: 39.921, lng: 32.8542 }, 20_000)).toBe(false);
    expect(shouldRefreshResolvedLocation(previous, { lat: 39.925, lng: 32.8541 }, 20_000)).toBe(true);
    expect(shouldRefreshResolvedLocation(previous, { lat: 39.921, lng: 32.8542 }, 122_000)).toBe(true);
  });
});
