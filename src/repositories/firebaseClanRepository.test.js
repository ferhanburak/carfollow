import { describe, expect, it } from "vitest";
import { buildFirebaseClanState } from "./firebaseClanRepository";

describe("buildFirebaseClanState", () => {
  it("projects the current membership, roster and scoped invitations", () => {
    const state = buildFirebaseClanState({
      clans: [
        { id: "clan-1", name: "Ankara Apex", tag: "APEX", memberCount: 2, km: 2400 },
        { id: "clan-2", name: "Night Run", tag: "NIGHT", memberCount: 8, km: 4300 },
      ],
      memberships: [{ id: "clan-1__self", clanId: "clan-1", userId: "self", role: "owner" }],
      members: [
        { id: "clan-1__friend", clanId: "clan-1", userId: "friend", fullName: "Friend", joinedAt: { toMillis: () => 100 } },
        { id: "clan-1__self", clanId: "clan-1", userId: "self", fullName: "Self", joinedAt: { toMillis: () => 200 } },
      ],
      incomingInvites: [{ id: "invite-in", clanId: "clan-3", invitedByName: "Captain", invitedByPlate: "06 CAP 01", createdAt: { toMillis: () => 300 } }],
      outgoingInvites: [{ id: "invite-out", clanId: "clan-1", targetUserId: "target", createdAt: { toMillis: () => 400 } }],
    });

    expect(state.currentClan).toMatchObject({ id: "clan-1", members: 2, memberCount: 2 });
    expect(state.membership).toMatchObject({ clanId: "clan-1", role: "owner" });
    expect(state.currentClanMembers.map((member) => member.userId)).toEqual(["self", "friend"]);
    expect(state.clanInvites[0]).toMatchObject({ fromName: "Captain", fromPlate: "06 CAP 01", createdAt: 300 });
    expect(state.sentClanInvites[0]).toMatchObject({ id: "invite-out", createdAt: 400 });
    expect(state.clans.map((clan) => clan.id)).toEqual(["clan-2", "clan-1"]);
  });
});
