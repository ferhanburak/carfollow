import { describe, expect, it } from "vitest";
import { getDriverStatsPeriod } from "../domain/driverStats";
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

  it("uses only the current server-owned monthly clan leaderboard entry", () => {
    const periodKey = getDriverStatsPeriod();
    const state = buildFirebaseClanState({
      clans: [
        { id: "clan-1", name: "Apex", memberCount: 2, monthlyKmPeriod: "old-period", monthlyKm: 900 },
        { id: "clan-2", name: "Night", memberCount: 4, monthlyKmPeriod: periodKey, monthlyKm: 80 },
      ],
      leaderboardEntries: [
        { id: `${periodKey}__clan-1`, clanId: "clan-1", periodKey, monthlyKm: 125.2 },
        { id: `old-period__clan-2`, clanId: "clan-2", periodKey: "old-period", monthlyKm: 9999 },
      ],
    });

    expect(state.clans.map((clan) => [clan.id, clan.km])).toEqual([
      ["clan-1", 125.2],
      ["clan-2", 80],
    ]);
  });

  it("preserves partial subscription readiness so invites can render immediately", () => {
    const state = buildFirebaseClanState({
      incomingInvites: [
        {
          id: "clan-1__self",
          clanId: "clan-1",
          clanName: "INIURIA",
          targetUserId: "self",
          invitedByName: "Captain",
          status: "pending",
          createdAt: { toMillis: () => 500 },
        },
      ],
      loaded: {
        clans: false,
        leaderboardEntries: false,
        memberships: false,
        incomingInvites: true,
        outgoingInvites: false,
        members: true,
      },
    });

    expect(state.clanInvites).toHaveLength(1);
    expect(state.clanInvites[0]).toMatchObject({ clanName: "INIURIA", targetUserId: "self" });
    expect(state.loaded).toMatchObject({ incomingInvites: true, clans: false });
  });
});
