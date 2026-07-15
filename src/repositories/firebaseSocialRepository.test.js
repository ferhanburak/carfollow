import { describe, expect, it } from "vitest";
import { buildFirebaseSocialState } from "./firebaseSocialRepository";

const profiles = [
  { userId: "self", plate: "06 SELF 01", fullName: "Self Driver", model: "Cupra" },
  { userId: "friend", plate: "34 FND 01", fullName: "Friend Driver", model: "Golf GTI" },
  { userId: "incoming", plate: "35 INC 01", fullName: "Incoming Driver", model: "Civic" },
  { userId: "outgoing", plate: "16 OUT 01", fullName: "Outgoing Driver", model: "R6" },
];

describe("buildFirebaseSocialState", () => {
  it("projects accepted, incoming and outgoing friendship edges for the current user", () => {
    const state = buildFirebaseSocialState({
      currentUserId: "self",
      profiles,
      friendships: [
        {
          id: "friend__self",
          participantIds: ["friend", "self"],
          requesterUserId: "friend",
          targetUserId: "self",
          status: "accepted",
          acceptedAt: { toMillis: () => 300 },
        },
        {
          id: "incoming__self",
          participantIds: ["incoming", "self"],
          requesterUserId: "incoming",
          targetUserId: "self",
          status: "pending",
          createdAt: { toMillis: () => 200 },
        },
        {
          id: "outgoing__self",
          participantIds: ["outgoing", "self"],
          requesterUserId: "self",
          targetUserId: "outgoing",
          status: "pending",
          createdAt: { toMillis: () => 100 },
        },
      ],
    });

    expect(state.directory).toEqual([]);
    expect(state.friends[0]).toMatchObject({ userId: "friend", plate: "34 FND 01", status: "accepted" });
    expect(state.incomingRequests[0]).toMatchObject({ userId: "incoming", status: "pending" });
    expect(state.outgoingRequests[0]).toMatchObject({ userId: "outgoing", status: "pending" });
  });

  it("hydrates private block records with their public profile snapshot", () => {
    const state = buildFirebaseSocialState({
      currentUserId: "self",
      profiles,
      blocks: [
        {
          targetUserId: "incoming",
          targetProfile: { userId: "incoming", plate: "35 INC 01", fullName: "Stored Name" },
          blockedAt: { toMillis: () => 500 },
        },
      ],
    });

    expect(state.blockedDrivers[0]).toMatchObject({
      userId: "incoming",
      plate: "35 INC 01",
      fullName: "Incoming Driver",
      blockedAt: 500,
      status: "blocked",
    });
  });
});
