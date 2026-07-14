import { describe, expect, it } from "vitest";
import { buildFirebaseMapState, mergeFirebaseConvoys } from "./firebaseMapRepository";

describe("firebaseMapRepository projections", () => {
  it("replaces public meet summaries with backend-authorized convoy projections", () => {
    const result = mergeFirebaseConvoys(
      [{ id: "spot-1", type: "spot" }, { id: "convoy-1", type: "meet", route: "Restricted route" }],
      [{ id: "convoy-1", type: "meet", route: "Exact route", backendCanViewDetails: true }],
    );
    expect(result).toEqual([
      { id: "spot-1", type: "spot" },
      { id: "convoy-1", type: "meet", route: "Exact route", backendCanViewDetails: true },
    ]);
  });

  it("joins spot photos and wash reviews without embedding writes in map pins", () => {
    const state = buildFirebaseMapState({
      pins: [{ id: "spot-1", type: "spot" }, { id: "wash-1", type: "wash" }],
      photos: [{ id: "photo-1", pinId: "spot-1", createdAt: 2 }],
      reviews: [{ id: "review-1", pinId: "wash-1", createdAt: 3 }],
    });
    expect(state.mapPins[0].gallery).toHaveLength(1);
    expect(state.mapPins[1].reviews).toHaveLength(1);
  });
});
