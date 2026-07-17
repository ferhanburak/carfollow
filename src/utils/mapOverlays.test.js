import { describe, expect, it } from "vitest";
import { buildMapOverlayModel } from "./mapOverlays";

const selectedRoute = [
  { lat: 39.9208, lng: 32.8541 },
  { lat: 39.9004, lng: 32.8093 },
  { lat: 39.9021, lng: 32.7029 },
];

describe("map overlay model", () => {
  it("projects an accessible convoy into a marker and route polyline", () => {
    const convoy = {
      id: "convoy-route-test",
      type: "meet",
      name: "Ankara test convoy",
      lat: "39.9208",
      lng: "32.8541",
      routePath: selectedRoute,
      backendCanViewDetails: true,
      backendCanJoin: true,
    };

    const result = buildMapOverlayModel({
      pins: [convoy],
      selectedPinId: convoy.id,
      user: { firebaseUid: "member-1" },
    });

    expect(result.markers).toEqual([expect.objectContaining({
      id: convoy.id,
      lat: 39.9208,
      lng: 32.8541,
    })]);
    expect(result.selectedPin?.id).toBe(convoy.id);
    expect(result.routePath).toEqual(selectedRoute);
  });

  it("keeps a restricted convoy marker visible without exposing its route", () => {
    const result = buildMapOverlayModel({
      pins: [{
        id: "restricted-convoy",
        type: "meet",
        lat: 40,
        lng: 33,
        routePath: selectedRoute,
        backendCanViewDetails: false,
        backendCanJoin: false,
      }],
      selectedPinId: "restricted-convoy",
      user: { firebaseUid: "untrusted-driver" },
    });

    expect(result.markers).toHaveLength(1);
    expect(result.routePath).toEqual([]);
  });

  it("drops invalid coordinates and does not auto-select another marker", () => {
    const result = buildMapOverlayModel({
      pins: [
        { id: "valid", type: "spot", lat: 39.9, lng: 32.8 },
        { id: "invalid", type: "meet", lat: 999, lng: 32.8 },
      ],
      selectedPinId: "invalid",
      user: null,
    });

    expect(result.markers.map((pin) => pin.id)).toEqual(["valid"]);
    expect(result.selectedPin).toBeNull();
  });

  it("keeps every marker unselected after a blank map click", () => {
    const result = buildMapOverlayModel({
      pins: [
        { id: "spot-1", type: "spot", lat: 39.9, lng: 32.8 },
        { id: "meet-1", type: "meet", lat: 39.8, lng: 32.7 },
      ],
      selectedPinId: null,
      user: null,
    });

    expect(result.markers).toHaveLength(2);
    expect(result.selectedPin).toBeNull();
    expect(result.routePath).toEqual([]);
  });
});
