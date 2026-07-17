import { describe, expect, it } from "vitest";
import { getTrackableConvoys } from "./useConvoyTracking";

const user = { firebaseUid: "driver-1", plate: "06 TEST 01" };
const routePath = [{ lat: 39.9, lng: 32.8 }, { lat: 39.8, lng: 32.7 }];

describe("convoy tracking selection", () => {
  it("starts only for approved due convoy members", () => {
    const convoys = [
      { id: "due", type: "meet", lifecycleStatus: "planning", scheduledStartAtMs: 1_000, routePath, attendees: [{ userId: "driver-1" }] },
      { id: "future", type: "meet", lifecycleStatus: "planning", scheduledStartAtMs: 9_000, routePath, attendees: [{ userId: "driver-1" }] },
      { id: "other", type: "meet", lifecycleStatus: "rolling", routePath, attendees: [{ userId: "driver-2" }] },
    ];

    expect(getTrackableConvoys(convoys, user, 5_000).map((convoy) => convoy.id)).toEqual(["due"]);
  });

  it("keeps rolling convoys trackable until completion", () => {
    const convoy = { id: "rolling", type: "meet", lifecycleStatus: "rolling", routePath, attendees: [{ plate: user.plate }] };
    expect(getTrackableConvoys([convoy], user, 1).map((item) => item.id)).toEqual(["rolling"]);
    expect(getTrackableConvoys([{ ...convoy, lifecycleStatus: "completed" }], user, 1)).toEqual([]);
  });
});
