function sortByNewest(items) {
  return [...items].sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0));
}

export function normalizeClanState(user) {
  if (!user) {
    return user;
  }

  return {
    ...user,
    clanRole: user.clanRole ?? "member",
    clanInvites: sortByNewest(user.clanInvites ?? []),
    sentClanInvites: sortByNewest(user.sentClanInvites ?? []),
  };
}

function sanitizeClanIdentity(value) {
  return value.trim().replace(/\s+/g, " ");
}

function createClanInviteRecord(user, clan, targetFriend) {
  return {
    id: `invite-${Date.now()}-${targetFriend.plate.replaceAll(" ", "")}`,
    clanId: clan.id,
    clanName: clan.name,
    clanTag: clan.tag,
    fromPlate: user.plate,
    fromName: user.fullName,
    targetPlate: targetFriend.plate,
    targetName: targetFriend.fullName,
    targetModel: targetFriend.model,
    createdAt: Date.now(),
    status: "pending",
  };
}

function updateClanMembershipCount(clans, clanName, delta) {
  return clans.map((clan) =>
    clan.name === clanName
      ? {
          ...clan,
          members: Math.max(0, Number(clan.members ?? 0) + delta),
        }
      : clan,
  );
}

export function createClan(user, clans, payload) {
  const state = normalizeClanState(user);
  const name = sanitizeClanIdentity(payload.name ?? "");
  const tag = sanitizeClanIdentity(payload.tag ?? "").toUpperCase();
  const description = sanitizeClanIdentity(payload.description ?? "");

  if (!name || !tag) {
    return { nextUser: state, nextClans: clans, feedback: "Klan adi ve tag gerekli." };
  }

  const duplicateName = clans.some((clan) => clan.name.toLowerCase() === name.toLowerCase());
  const duplicateTag = clans.some((clan) => String(clan.tag ?? "").toLowerCase() === tag.toLowerCase());
  if (duplicateName || duplicateTag) {
    return { nextUser: state, nextClans: clans, feedback: "Bu klan adi veya tag zaten kullaniliyor." };
  }

  const previousClan = state.clan;
  const nextClan = {
    id: `clan-${Date.now()}`,
    name,
    tag,
    description: description || "Yeni kurulan CRUISER klani.",
    km: Number(state.monthlyKm ?? 0),
    members: 1,
    captainPlate: state.plate,
    visibility: "friends",
  };

  let nextClans = [nextClan, ...clans];
  if (previousClan) {
    nextClans = updateClanMembershipCount(nextClans, previousClan, -1);
  }

  return {
    nextUser: {
      ...state,
      clan: name,
      clanRole: "owner",
      clanInvites: [],
    },
    nextClans,
    feedback: `${name} klani kuruldu. Artik lider sensin.`,
  };
}

export function sendClanInvite(user, targetFriend, clans) {
  const state = normalizeClanState(user);
  if (!targetFriend) {
    return { nextUser: state, feedback: "Davet gonderilecek surucu secilemedi." };
  }

  if (!state.clan) {
    return { nextUser: state, feedback: "Once bir klana dahil olman gerekiyor." };
  }

  if (!["owner", "captain"].includes(state.clanRole ?? "member")) {
    return { nextUser: state, feedback: "Klan daveti gondermek icin lider olmalisin." };
  }

  const clan = clans.find((entry) => entry.name === state.clan);
  if (!clan) {
    return { nextUser: state, feedback: "Aktif klan bilgisi bulunamadi." };
  }

  if ((state.sentClanInvites ?? []).some((entry) => entry.targetPlate === targetFriend.plate && entry.status === "pending")) {
    return { nextUser: state, feedback: `${targetFriend.fullName} icin zaten aktif bir davet var.` };
  }

  const invite = createClanInviteRecord(state, clan, targetFriend);
  return {
    nextUser: {
      ...state,
      sentClanInvites: [invite, ...(state.sentClanInvites ?? [])],
    },
    feedback: `${targetFriend.fullName} icin ${clan.name} daveti hazirlandi.`,
  };
}

export function cancelClanInvite(user, inviteId) {
  const state = normalizeClanState(user);
  const targetInvite = (state.sentClanInvites ?? []).find((entry) => entry.id === inviteId);

  return {
    nextUser: {
      ...state,
      sentClanInvites: (state.sentClanInvites ?? []).filter((entry) => entry.id !== inviteId),
    },
    feedback: targetInvite ? `${targetInvite.targetName} icin giden klan daveti iptal edildi.` : "Klan daveti kaldirildi.",
  };
}

export function acceptClanInvite(user, clans, inviteId) {
  const state = normalizeClanState(user);
  const invite = (state.clanInvites ?? []).find((entry) => entry.id === inviteId);
  if (!invite) {
    return { nextUser: state, nextClans: clans, feedback: "Klan daveti bulunamadi." };
  }

  let nextClans = updateClanMembershipCount(clans, invite.clanName, 1);
  if (state.clan && state.clan !== invite.clanName) {
    nextClans = updateClanMembershipCount(nextClans, state.clan, -1);
  }

  return {
    nextUser: {
      ...state,
      clan: invite.clanName,
      clanRole: "member",
      clanInvites: (state.clanInvites ?? []).filter((entry) => entry.id !== inviteId),
    },
    nextClans,
    feedback: `${invite.clanName} daveti kabul edildi.`,
  };
}

export function declineClanInvite(user, inviteId) {
  const state = normalizeClanState(user);
  const invite = (state.clanInvites ?? []).find((entry) => entry.id === inviteId);

  return {
    nextUser: {
      ...state,
      clanInvites: (state.clanInvites ?? []).filter((entry) => entry.id !== inviteId),
    },
    feedback: invite ? `${invite.clanName} daveti reddedildi.` : "Klan daveti kapatildi.",
  };
}
