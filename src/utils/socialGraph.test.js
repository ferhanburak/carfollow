import { describe, expect, it } from "vitest";
import {
  blockCommunityMember,
  getFriendshipStatus,
  removeFriend,
  searchCommunityMembers,
  unblockCommunityMember,
} from "./socialGraph";

const target = {
  userId: "target-user",
  plate: "34 TEST 01",
  fullName: "Target Driver",
  model: "Golf GTI",
  region: "Istanbul",
};

function buildUser() {
  return {
    plate: "06 SELF 01",
    friends: [target],
    incomingRequests: [],
    outgoingRequests: [],
    blockedDrivers: [],
    conversations: {
      thread: { participantPlate: target.plate, messages: [] },
    },
  };
}

describe("socialGraph blocks", () => {
  it("removes active social edges and hides a blocked profile from search", () => {
    const blockedUser = blockCommunityMember(buildUser(), target);

    expect(getFriendshipStatus(blockedUser, target.plate)).toBe("blocked");
    expect(blockedUser.friends).toEqual([]);
    expect(blockedUser.conversations).toEqual({});
    expect(searchCommunityMembers("test", [target], blockedUser)).toEqual([]);
  });

  it("unblocks profiles and removes friendships independently", () => {
    const blockedUser = blockCommunityMember(buildUser(), target);
    expect(unblockCommunityMember(blockedUser, target.plate).blockedDrivers).toEqual([]);
    expect(removeFriend(buildUser(), target.plate).friends).toEqual([]);
  });
});
