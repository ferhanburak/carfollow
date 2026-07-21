import { describe, expect, it } from "vitest";
import { buildVisibleMapDrivers, getMapDriverRelation } from "./mapDriverRelations";

const user = {
  firebaseUid: "self-1",
  plate: "06 SELF 01",
  blockedDrivers: [{ userId: "blocked-1" }],
  friends: [{ userId: "shared-1", plate: "06 FRIEND 01" }],
};

describe("map driver relationships", () => {
  it("prioritizes friendship over clan membership", () => {
    const driver = { firebaseUid: "shared-1", plate: "06 FRIEND 01" };
    expect(getMapDriverRelation(driver, user, [{ userId: "shared-1" }])).toBe("friend");
  });

  it("hides self and blocked drivers while keeping clan and strangers", () => {
    const drivers = [
      { firebaseUid: "self-1", plate: "06 SELF 01" },
      { firebaseUid: "blocked-1", plate: "06 BLOCK 01" },
      { firebaseUid: "clan-1", plate: "06 CLAN 01" },
      { firebaseUid: "other-1", plate: "06 OTHER 01" },
    ];
    const visible = buildVisibleMapDrivers(drivers, user, [{ userId: "clan-1" }]);
    expect(visible.map((entry) => [entry.firebaseUid, entry.mapRelation])).toEqual([
      ["clan-1", "clan"],
      ["other-1", "stranger"],
    ]);
  });
});
