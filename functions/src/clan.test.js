const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildClanDocument,
  buildClanInviteDocument,
  buildClanMemberDocument,
  canInviteClanMember,
  canManageClanMember,
  normalizeClanName,
  normalizeClanTag,
} = require("./clan");

const owner = {
  id: "owner-user",
  plate: "06 PWA 101",
  fullName: "Poyraz Alkan",
  model: "Seat Ibiza Cupra",
  region: "Ankara",
  monthlyKm: 420,
};

test("clan identity normalizers create stable name and tag values", () => {
  assert.equal(normalizeClanName("  Ankara   Apex "), "ankara apex");
  assert.equal(normalizeClanTag(" ap ex "), "APEX");
});

test("buildClanDocument seeds an owner-led public clan summary", () => {
  const timestamp = { server: true };
  const clan = buildClanDocument({
    clanId: "clan-1",
    owner,
    name: "Ankara Apex",
    tag: "apex",
    description: "Gece rotalari",
    periodKey: "2026-07",
    timestamp,
  });

  assert.equal(clan.ownerUserId, "owner-user");
  assert.equal(clan.memberCount, 1);
  assert.equal(clan.members, 1);
  assert.equal(clan.tag, "APEX");
  assert.equal(clan.monthlyKm, 0);
  assert.equal(clan.monthlyKmPeriod, "2026-07");
});

test("member and invite documents expose only community-safe profile data", () => {
  const timestamp = { server: true };
  const member = buildClanMemberDocument({ clanId: "clan-1", profile: owner, role: "owner", timestamp });
  const invite = buildClanInviteDocument({
    clan: { id: "clan-1", name: "Ankara Apex", tag: "APEX" },
    inviter: owner,
    target: { id: "friend-user", plate: "34 TEST 01", fullName: "Friend", model: "R6" },
    timestamp,
  });

  assert.equal(member.id, "clan-1__owner-user");
  assert.equal(member.role, "owner");
  assert.equal(invite.id, "clan-1__friend-user");
  assert.equal(invite.targetPlate, "34 TEST 01");
});

test("clan role capabilities protect owner and captain boundaries", () => {
  assert.equal(canInviteClanMember("owner"), true);
  assert.equal(canInviteClanMember("captain"), true);
  assert.equal(canInviteClanMember("member"), false);
  assert.equal(canManageClanMember("captain", "member"), true);
  assert.equal(canManageClanMember("captain", "captain"), false);
  assert.equal(canManageClanMember("owner", "owner"), false);
});
