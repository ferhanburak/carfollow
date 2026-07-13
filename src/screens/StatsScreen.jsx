import { useMemo, useState } from "react";
import { individualDriverSeed } from "../data/mockData";
import { formatNumber } from "../utils/garage";
import { buildIndividualLeaderboard } from "../utils/socialStats";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getActionTone(status) {
  if (status === "friend") {
    return "border-lime-400/20 bg-lime-400/10 text-lime-300";
  }
  if (status === "incoming") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
  if (status === "outgoing") {
    return "border-white/10 bg-white/5 text-neutral-300";
  }
  return "border-rose-400/20 bg-rose-400/10 text-rose-200";
}

function getClanRankTone(index) {
  if (index === 0) {
    return "bg-amber-300 text-black";
  }
  if (index === 1) {
    return "bg-neutral-300 text-black";
  }
  if (index === 2) {
    return "bg-orange-500 text-black";
  }
  return "bg-white/10 text-white";
}

function getPresenceTone(status) {
  if (status === "online") {
    return "bg-lime-400";
  }
  if (status === "away") {
    return "bg-amber-400";
  }
  return "bg-neutral-500";
}

function formatPresenceLabel(presence) {
  if (!presence) {
    return "offline";
  }
  if (presence.status === "online") {
    return "online";
  }
  if (presence.status === "away") {
    return "away";
  }

  const lastSeen = Number(presence.lastSeen ?? 0);
  if (!lastSeen) {
    return "offline";
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - lastSeen) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} dk once`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours} sa once`;
}

function formatMessageTime(timestamp) {
  const time = Number(timestamp ?? 0);
  if (!time) {
    return "--";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 1) {
    return "simdi";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} dk`;
  }
  if (diffMinutes < 1440) {
    return `${Math.round(diffMinutes / 60)} sa`;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function buildDrawerStats(profileDrawer, fallbackUser) {
  const harmonyVotes = Number(profileDrawer?.harmonyVotes ?? 0);
  const alertVotes = Number(profileDrawer?.alertVotes ?? 0);
  const totalVotes = harmonyVotes + alertVotes;
  const harmonyRatio = totalVotes ? clampPercent((harmonyVotes / totalVotes) * 100) : 100;

  return [
    {
      key: "score",
      label: "Surucu Skoru",
      value: `${Number(profileDrawer?.driverScore ?? 0)}/100`,
    },
    {
      key: "km",
      label: "Aylik KM",
      value: `${formatNumber(Number(profileDrawer?.monthlyKm ?? 0))} KM`,
    },
    {
      key: "harmony",
      label: "Uyum Orani",
      value: `%${harmonyRatio}`,
    },
    {
      key: "presence",
      label: "Bolge",
      value: profileDrawer?.region ?? fallbackUser?.region ?? "--",
    },
  ];
}

function resolveDrawerReputation(profileDrawer) {
  const score = Number(profileDrawer?.driverScore ?? 0);
  const harmonyVotes = Number(profileDrawer?.harmonyVotes ?? 0);
  const alertVotes = Number(profileDrawer?.alertVotes ?? 0);

  if (score >= 90 && alertVotes <= 1) {
    return {
      label: "Convoy Elite",
      tone: "border-lime-400/20 bg-lime-400/10 text-lime-200",
      description: "Yuksek skor ve temiz uyum kaydi.",
    };
  }

  if (score >= 75 && harmonyVotes >= alertVotes) {
    return {
      label: "Road Friendly",
      tone: "border-white/10 bg-white/[0.04] text-neutral-200",
      description: "Konvoy icin guvenli ve uyumlu gorunuyor.",
    };
  }

  return {
    label: "Watchlist",
    tone: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    description: "Davet oncesi davranis gecmisi tekrar kontrol edilmeli.",
  };
}

export function StatsScreen({
  activeConversation,
  activeConversationId,
  activeTypingUsers,
  acceptIncomingClanInvite,
  approveFriendRequest,
  chatFeedback,
  clanFeedback,
  clanForm,
  clans,
  conversationList,
  createNewClan,
  currentClan,
  declineFriendRequest,
  declineIncomingClanInvite,
  drivers,
  friendSearchQuery,
  friendSearchResults,
  hostableConvoys,
  inviteDriverToMeet,
  inviteFriendToClan,
  messageDraft,
  onClanFormChange,
  onFriendSearchChange,
  onMessageDraftChange,
  onOpenPublicProfile,
  openConversation,
  presenceMap,
  requestFriend,
  revokeClanInvite,
  sendMessage,
  socialFeedback,
  totalUnreadCount,
  user,
  withdrawFriendRequest,
  mode = "social",
}) {
  const [profileDrawer, setProfileDrawer] = useState(null);
  const [expandedProfile, setExpandedProfile] = useState(null);
  const individualLeaderboard = buildIndividualLeaderboard(user, individualDriverSeed);
  const sortedClans = [...clans].sort((a, b) => b.km - a.km);
  const canInviteToClan = ["owner", "captain"].includes(user.clanRole ?? "member");
  const primaryHostableConvoy = hostableConvoys?.[0] ?? null;

  const friendPlateSet = useMemo(() => new Set((user.friends ?? []).map((entry) => entry.plate)), [user.friends]);
  const incomingPlateSet = useMemo(() => new Set((user.incomingRequests ?? []).map((entry) => entry.plate)), [user.incomingRequests]);
  const outgoingPlateSet = useMemo(() => new Set((user.outgoingRequests ?? []).map((entry) => entry.plate)), [user.outgoingRequests]);

  const openProfileDrawer = (profile, source = "community") => {
    setProfileDrawer({ ...profile, source });
  };

  const openExpandedProfile = (profile) => {
    if (onOpenPublicProfile) {
      onOpenPublicProfile(profile);
      setProfileDrawer(null);
      return;
    }
    setExpandedProfile(profile);
    setProfileDrawer(null);
  };

  const closeExpandedProfile = () => {
    setExpandedProfile(null);
  };

  const selectedProfileStatus = profileDrawer
    ? profileDrawer.plate === user.plate
      ? "self"
      : friendPlateSet.has(profileDrawer.plate)
        ? "friend"
        : incomingPlateSet.has(profileDrawer.plate)
          ? "incoming"
          : outgoingPlateSet.has(profileDrawer.plate)
            ? "outgoing"
            : "none"
    : "none";
  const drawerStats = profileDrawer ? buildDrawerStats(profileDrawer, user) : [];
  const drawerReputation = profileDrawer ? resolveDrawerReputation(profileDrawer) : null;
  const drawerPresence = profileDrawer ? presenceMap?.[profileDrawer.plate] : null;
  const drawerCanMessage = selectedProfileStatus !== "self";
  const drawerCanInviteToClan = canInviteToClan && selectedProfileStatus !== "self";
  const drawerCanInviteToConvoy = Boolean(primaryHostableConvoy) && selectedProfileStatus !== "self";
  const drawerActionLabel =
    selectedProfileStatus === "friend"
      ? "Arkadas"
      : selectedProfileStatus === "incoming"
        ? "Istek Bekliyor"
        : selectedProfileStatus === "outgoing"
          ? "Gonderildi"
          : selectedProfileStatus === "self"
            ? "Sen"
            : "Arkadas Ekle";

  const handleConvoyInviteFromDrawer = () => {
    if (!profileDrawer || !primaryHostableConvoy) {
      return;
    }

    inviteDriverToMeet(primaryHostableConvoy.id, profileDrawer);
  };

  const expandedProfileStatus = expandedProfile
    ? expandedProfile.plate === user.plate
      ? "self"
      : friendPlateSet.has(expandedProfile.plate)
        ? "friend"
        : incomingPlateSet.has(expandedProfile.plate)
          ? "incoming"
          : outgoingPlateSet.has(expandedProfile.plate)
            ? "outgoing"
            : "none"
    : "none";
  const expandedPresence = expandedProfile ? presenceMap?.[expandedProfile.plate] : null;
  const expandedStats = expandedProfile ? buildDrawerStats(expandedProfile, user) : [];
  const expandedReputation = expandedProfile ? resolveDrawerReputation(expandedProfile) : null;
  const showSocial = mode === "social";
  const showLeaderboard = mode === "leaderboard";

  return (
    <section className="space-y-4">
      {showSocial ? (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Clan Management</p>
            <h3 className="mt-2 text-xl font-black">Klan Merkezi</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">
            {user.clan ? user.clan : "Clanless"}
          </div>
        </div>

        {clanFeedback ? (
          <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
            {clanFeedback}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Aktif Klan</p>
                <p className="mt-1 text-xs text-neutral-500">Uyeligin, rolun ve aylik ekip ritmi.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
                {user.clanRole ?? "member"}
              </span>
            </div>

            {currentClan ? (
              <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-lime-200">{currentClan.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-lime-300">{currentClan.tag}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-lime-200">{formatNumber(currentClan.km)} KM</p>
                    <p className="text-xs text-lime-100/70">{currentClan.members} members</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-lime-100/80">{currentClan.description}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                Henuz aktif bir klan bulunmuyor. Yeni ekip kurabilir ya da gelen daveti kabul edebilirsin.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Yeni Klan Kur</p>
            <p className="mt-1 text-xs text-neutral-500">Mevcut klanindaysan yeni klan kurunca lider olarak yeni ekibe gecersin.</p>
            <div className="mt-4 space-y-3">
              <input
                value={clanForm.name}
                onChange={(event) => onClanFormChange((current) => ({ ...current, name: event.target.value }))}
                placeholder="Klan adi"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-lime-400"
              />
              <input
                value={clanForm.tag}
                onChange={(event) => onClanFormChange((current) => ({ ...current, tag: event.target.value.toUpperCase() }))}
                placeholder="Kisa tag"
                maxLength={6}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm uppercase tracking-[0.16em] outline-none focus:border-lime-400"
              />
              <textarea
                value={clanForm.description}
                onChange={(event) => onClanFormChange((current) => ({ ...current, description: event.target.value }))}
                placeholder="Kisa klan aciklamasi"
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-lime-400"
              />
              <button
                type="button"
                onClick={createNewClan}
                className="min-h-12 w-full rounded-2xl bg-lime-400 px-4 py-3 text-sm font-bold text-black"
              >
                Klani Kur
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Gelen Klan Davetleri</p>
            <div className="mt-4 space-y-3">
              {(user.clanInvites ?? []).length ? (
                user.clanInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{invite.clanName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-lime-300">{invite.clanTag}</p>
                        <p className="mt-2 text-xs text-neutral-500">Davet eden: {invite.fromName} / {invite.fromPlate}</p>
                      </div>
                      <span className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                        Pending
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => acceptIncomingClanInvite(invite.id)}
                        className="min-h-12 flex-1 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black"
                      >
                        Kabul Et
                      </button>
                      <button
                        type="button"
                        onClick={() => declineIncomingClanInvite(invite.id)}
                        className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Bekleyen klan daveti yok.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Giden Klan Davetleri</p>
                <p className="mt-1 text-xs text-neutral-500">Liderler arkadas listesi uzerinden ekip daveti yollayabilir.</p>
              </div>
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                {canInviteToClan ? "Invite On" : "Leader Only"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {(user.sentClanInvites ?? []).length ? (
                user.sentClanInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{invite.targetPlate}</p>
                    <p className="mt-1 text-sm font-semibold">{invite.targetName}</p>
                    <p className="text-xs text-neutral-500">{invite.targetModel}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
                        {invite.clanName}
                      </span>
                      <button
                        type="button"
                        onClick={() => revokeClanInvite(invite.id)}
                        className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200"
                      >
                        Iptal Et
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Henuz giden klan daveti yok.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {showSocial ? (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Social Graph</p>
            <h3 className="mt-2 text-xl font-black">Arkadas Bul ve Baglan</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">
            {(user.friends ?? []).length} friends
          </div>
        </div>
        {socialFeedback ? (
          <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
            {socialFeedback}
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
          <p className="text-sm font-semibold">Kullanici Ara</p>
          <input
            value={friendSearchQuery}
            onChange={(event) => onFriendSearchChange(event.target.value)}
            placeholder="Plaka, model, isim ya da bolge ile ara"
            className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-lime-400"
          />
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {friendSearchResults.slice(0, 8).map((entry) => (
              <div key={`${entry.userId}-${entry.plate}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => openProfileDrawer(entry, "search")} className="text-left">
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                    <p className="mt-1 text-sm font-semibold">{entry.fullName}</p>
                    <p className="text-xs text-neutral-500">{entry.model} / {entry.region}</p>
                  </button>
                  {entry.friendshipStatus === "none" ? (
                    <button
                      type="button"
                      onClick={() => requestFriend(entry)}
                      className="min-h-12 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black"
                    >
                      Arkadas Ekle
                    </button>
                  ) : entry.friendshipStatus === "outgoing" ? (
                    <button
                      type="button"
                      onClick={() => withdrawFriendRequest(entry.plate)}
                      className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200"
                    >
                      Istegi Geri Cek
                    </button>
                  ) : entry.friendshipStatus === "incoming" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => approveFriendRequest(entry.plate)}
                        className="min-h-12 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black"
                      >
                        Kabul
                      </button>
                      <button
                        type="button"
                        onClick={() => declineFriendRequest(entry.plate)}
                        className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200"
                      >
                        Reddet
                      </button>
                    </div>
                  ) : (
                    <span className={`rounded-xl border px-3 py-2 text-xs font-semibold ${getActionTone(entry.friendshipStatus)}`}>
                      Friends
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Gelen Istekler</p>
            <div className="mt-4 space-y-3">
              {(user.incomingRequests ?? []).length ? (
                user.incomingRequests.map((entry) => (
                  <div key={`${entry.plate}-incoming`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <button type="button" onClick={() => openProfileDrawer(entry, "incoming")} className="text-left">
                      <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                      <p className="mt-1 text-sm font-semibold">{entry.fullName}</p>
                      <p className="text-xs text-neutral-500">{entry.model}</p>
                    </button>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => approveFriendRequest(entry.plate)}
                        className="min-h-12 flex-1 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black"
                      >
                        Kabul Et
                      </button>
                      <button
                        type="button"
                        onClick={() => declineFriendRequest(entry.plate)}
                        className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Yeni arkadas istegi yok.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Arkadas Listesi</p>
            <div className="mt-4 space-y-3">
              {(user.friends ?? []).length ? (
                user.friends.map((entry) => (
                  <div key={`${entry.plate}-friend`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" onClick={() => openProfileDrawer(entry, "friend")} className="text-left">
                        <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                        <p className="mt-1 text-sm font-semibold">{entry.fullName}</p>
                        <p className="text-xs text-neutral-500">{entry.model} / {entry.region}</p>
                      </button>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => openConversation(entry)}
                          className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200"
                        >
                          Sohbet Ac
                        </button>
                        {canInviteToClan ? (
                          <button
                            type="button"
                            onClick={() => inviteFriendToClan(entry)}
                            className="min-h-12 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black"
                          >
                            Klana Davet Et
                          </button>
                        ) : (
                          <span className="rounded-xl border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-center text-xs font-semibold text-lime-300">
                            Friend
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Henuz arkadas eklenmedi.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">DM Panel</p>
              <p className="text-xs text-neutral-500">Realtime Database baglantili dusuk gecikmeli sohbet akisi.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              {conversationList.length} thread / {totalUnreadCount} unread
            </div>
          </div>
          {chatFeedback ? (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
              {chatFeedback}
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr,1.1fr]">
            <div className="space-y-3">
              {conversationList.length ? (
                conversationList.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() =>
                      openConversation({
                        plate: conversation.participantPlate,
                        fullName: conversation.participantName,
                        model: conversation.participantModel,
                        avatar: conversation.participantAvatar,
                      })
                    }
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      activeConversationId === conversation.id ? "border-lime-400/30 bg-lime-400/10" : "border-white/8 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${getPresenceTone(presenceMap?.[conversation.participantPlate]?.status)}`} />
                          <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{conversation.participantPlate}</p>
                        </div>
                        <p className="mt-1 text-sm font-semibold">{conversation.participantName}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{conversation.lastMessage?.body ?? "Mesaj yok"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                          {formatPresenceLabel(presenceMap?.[conversation.participantPlate])}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {formatMessageTime(conversation.lastMessage?.createdAt)}
                        </span>
                        {conversation.unreadCount ? (
                          <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-bold text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Henuz aktif DM thread yok.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              {activeConversation ? (
                <>
                  <div className="border-b border-white/8 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${getPresenceTone(presenceMap?.[activeConversation.participantPlate]?.status)}`} />
                      <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{activeConversation.participantPlate}</p>
                    </div>
                    <p className="mt-1 text-sm font-semibold">{activeConversation.participantName}</p>
                    <p className="text-xs text-neutral-500">
                      {activeConversation.participantModel} / {formatPresenceLabel(presenceMap?.[activeConversation.participantPlate])}
                    </p>
                  </div>
                  <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                    {(activeConversation.messages ?? []).map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-2xl px-4 py-3 text-sm ${
                          message.authorPlate === user.plate ? "ml-8 bg-lime-400/10 text-lime-100" : "mr-8 bg-black/30 text-neutral-200"
                        }`}
                      >
                        <p>{message.body}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500">{message.authorPlate}</p>
                      </div>
                    ))}
                  </div>
                  {activeTypingUsers.length ? (
                    <p className="mt-3 text-xs text-lime-300">
                      {activeTypingUsers.map((entry) => entry.plate).join(", ")} yaziyor...
                    </p>
                  ) : null}
                  <div className="mt-4 flex gap-2">
                    <input
                      value={messageDraft}
                      onChange={(event) => onMessageDraftChange(event.target.value)}
                      placeholder="Mesaj yaz..."
                      className="h-12 flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-lime-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        sendMessage({
                          plate: activeConversation.participantPlate,
                          fullName: activeConversation.participantName,
                          model: activeConversation.participantModel,
                          avatar: activeConversation.participantAvatar,
                        })
                      }
                      className="min-h-12 rounded-2xl bg-lime-400 px-4 text-xs font-bold text-black"
                    >
                      Gonder
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Sohbet acmak icin bir arkadas sec.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {showLeaderboard ? (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Individual Leaderboard</p>
            <h3 className="mt-2 text-xl font-black">Monthly Driver Kilometers</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Solo Rank</div>
        </div>
        <div className="mt-4 space-y-3">
          {individualLeaderboard.map((driver) => (
            <div
              key={`${driver.plate}-individual`}
              className={`rounded-2xl border p-4 ${
                driver.plate === user.plate ? "border-lime-400/30 bg-lime-400/10" : "border-white/8 bg-black/20"
              }`}
            >
              <button type="button" onClick={() => openProfileDrawer(driver, "leaderboard")} className="flex w-full items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${getClanRankTone(driver.rank - 1)}`}>
                    #{driver.rank}
                  </div>
                  <div>
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{driver.plate}</p>
                    <p className="text-sm font-semibold">{driver.fullName}</p>
                    <p className="text-xs text-neutral-500">{driver.model} / {driver.region}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-lime-300">{formatNumber(driver.monthlyKm)} KM</p>
                  <p className="text-xs text-neutral-500">Score {driver.driverScore} / {driver.clan}</p>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {showLeaderboard ? (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Monthly Clan Leaderboard</p>
            <h3 className="mt-2 text-xl font-black">Collective Kilometers</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Live Sync</div>
        </div>
        <div className="mt-4 space-y-3">
          {sortedClans.map((clan, index) => (
            <div key={clan.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${getClanRankTone(index)}`}>
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-semibold">{clan.name}</p>
                    <p className="text-xs text-neutral-500">{clan.members} members / {clan.tag}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-lime-300">{formatNumber(clan.km)} KM</p>
                  <p className="text-xs text-neutral-500">
                    {clan.name === user.clan ? "Your clan is syncing live" : "Monthly total"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {showLeaderboard ? (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <p className="text-sm font-semibold">Active Drivers on the Highway</p>
        <div className="mt-4 space-y-3">
          {drivers.map((driver) => (
            <button
              key={`${driver.plate}-leader`}
              type="button"
              onClick={() => openProfileDrawer({ plate: driver.plate, model: driver.vehicle, region: driver.node, fullName: driver.plate, speed: driver.speed }, "highway")}
              className="flex w-full items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-left"
            >
              <div>
                <p className="font-mono text-sm tracking-[0.16em] text-lime-300">{driver.plate}</p>
                <p className="text-xs text-neutral-500">{driver.vehicle}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{driver.node}</p>
                <p className="text-xs text-rose-300">{driver.speed} KM/H</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      ) : null}

      {profileDrawer ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 px-3 pb-3 pt-14 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0d0d0d] shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-lime-400">Driver Profile</p>
                <h3 className="mt-1 text-base font-black">{profileDrawer.fullName ?? profileDrawer.plate}</h3>
              </div>
              <button
                type="button"
                onClick={() => setProfileDrawer(null)}
                className="min-h-10 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-semibold text-neutral-300"
              >
                Kapat
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm tracking-[0.16em] text-lime-300">{profileDrawer.plate}</p>
                    <p className="mt-1 text-sm font-semibold">{profileDrawer.model ?? "Unknown Setup"}</p>
                    <p className="text-xs text-neutral-500">{profileDrawer.region ?? user.region}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${getPresenceTone(drawerPresence?.status)}`} />
                      <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        {formatPresenceLabel(drawerPresence)}
                      </span>
                    </div>
                    {profileDrawer.clan ? <p className="mt-2 text-xs text-neutral-400">{profileDrawer.clan}</p> : null}
                  </div>
                </div>

                {drawerReputation ? (
                  <div className={`mt-4 rounded-2xl border px-4 py-3 ${drawerReputation.tone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.18em]">Driver Reputation</p>
                      <span className="text-xs font-semibold">{drawerReputation.label}</span>
                    </div>
                    <p className="mt-2 text-xs">{drawerReputation.description}</p>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {drawerStats.map((stat) => (
                  <div key={stat.key} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{stat.label}</p>
                    <p className="mt-2 text-sm font-bold text-lime-300">{stat.value}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => openExpandedProfile(profileDrawer)}
                className="min-h-12 w-full rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 text-sm font-semibold text-lime-100"
              >
                Detayli Profili Ac
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={selectedProfileStatus === "self" || selectedProfileStatus === "friend" || selectedProfileStatus === "incoming" || selectedProfileStatus === "outgoing"}
                  onClick={() => requestFriend(profileDrawer)}
                  className="min-h-12 rounded-2xl bg-lime-400 px-4 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {drawerActionLabel}
                </button>
                <button
                  type="button"
                  disabled={!drawerCanMessage}
                  onClick={() => openConversation(profileDrawer)}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mesaj Gonder
                </button>
                <button
                  type="button"
                  disabled={!drawerCanInviteToClan}
                  onClick={() => inviteFriendToClan(profileDrawer)}
                  className="min-h-12 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 text-xs font-semibold text-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Klana Davet
                </button>
                <button
                  type="button"
                  disabled={!drawerCanInviteToConvoy}
                  onClick={handleConvoyInviteFromDrawer}
                  className="min-h-12 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Konvoya Davet
                </button>
              </div>

              {selectedProfileStatus === "incoming" ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => approveFriendRequest(profileDrawer.plate)}
                    className="min-h-12 rounded-2xl bg-lime-400 px-4 text-xs font-bold text-black"
                  >
                    Istegi Kabul Et
                  </button>
                  <button
                    type="button"
                    onClick={() => declineFriendRequest(profileDrawer.plate)}
                    className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-200"
                  >
                    Istegi Reddet
                  </button>
                </div>
              ) : null}

              {selectedProfileStatus === "outgoing" ? (
                <button
                  type="button"
                  onClick={() => withdrawFriendRequest(profileDrawer.plate)}
                  className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-200"
                >
                  Giden Arkadaslik Isteğini Geri Cek
                </button>
              ) : null}

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-neutral-400">
                <p>Kaynak: {profileDrawer.source}</p>
                <p className="mt-1">Iliski durumu: {selectedProfileStatus}</p>
                {primaryHostableConvoy ? <p className="mt-1">Aktif host konvoyu: {primaryHostableConvoy.name}</p> : <p className="mt-1">Aktif host konvoyu bulunmuyor.</p>}
                {profileDrawer.speed ? <p className="mt-1">Anlik hiz: {profileDrawer.speed} KM/H</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {expandedProfile ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050505]/95 px-3 py-6 backdrop-blur-sm">
          <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-[#0d0d0d] shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[2rem] border-b border-white/10 bg-[#0d0d0d]/95 px-4 py-4 backdrop-blur">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-lime-400">Public Driver Profile</p>
                <h3 className="mt-1 text-lg font-black">{expandedProfile.fullName ?? expandedProfile.plate}</h3>
              </div>
              <button
                type="button"
                onClick={closeExpandedProfile}
                className="min-h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-xs font-semibold text-neutral-300"
              >
                Kapat
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.12),transparent_35%),linear-gradient(180deg,#171717,#0f0f0f)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm tracking-[0.16em] text-lime-300">{expandedProfile.plate}</p>
                    <p className="mt-1 text-base font-semibold text-neutral-100">{expandedProfile.model ?? "Unknown Setup"}</p>
                    <p className="mt-1 text-xs text-neutral-500">{expandedProfile.region ?? user.region}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${getPresenceTone(expandedPresence?.status)}`} />
                      <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        {formatPresenceLabel(expandedPresence)}
                      </span>
                    </div>
                    {expandedProfile.clan ? <p className="mt-2 text-xs text-neutral-400">{expandedProfile.clan}</p> : null}
                  </div>
                </div>

                {expandedReputation ? (
                  <div className={`mt-4 rounded-2xl border px-4 py-3 ${expandedReputation.tone}`}>
                    <p className="text-xs uppercase tracking-[0.18em]">Reputation</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="font-semibold">{expandedReputation.label}</p>
                      <p className="text-xs">{expandedProfileStatus}</p>
                    </div>
                    <p className="mt-2 text-xs">{expandedReputation.description}</p>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {expandedStats.map((stat) => (
                  <div key={stat.key} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{stat.label}</p>
                    <p className="mt-2 text-sm font-bold text-lime-300">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-sm font-semibold text-neutral-100">Konvoy Uyumu</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full ${
                      Number(expandedProfile.alertVotes ?? 0) > Number(expandedProfile.harmonyVotes ?? 0) ? "bg-rose-500" : "bg-lime-400"
                    }`}
                    style={{
                      width: `${clampPercent(
                        ((Number(expandedProfile.harmonyVotes ?? 0) /
                          Math.max(1, Number(expandedProfile.harmonyVotes ?? 0) + Number(expandedProfile.alertVotes ?? 0))) *
                          100),
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>Uyum oyu: {Number(expandedProfile.harmonyVotes ?? 0)}</span>
                  <span>Uyari oyu: {Number(expandedProfile.alertVotes ?? 0)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={expandedProfileStatus !== "none"}
                  onClick={() => requestFriend(expandedProfile)}
                  className="min-h-12 rounded-2xl bg-lime-400 px-4 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {expandedProfileStatus === "friend"
                    ? "Zaten Arkadas"
                    : expandedProfileStatus === "incoming"
                      ? "Istek Bekliyor"
                      : expandedProfileStatus === "outgoing"
                        ? "Istek Gonderildi"
                        : expandedProfileStatus === "self"
                          ? "Bu Sensin"
                          : "Arkadas Ekle"}
                </button>
                <button
                  type="button"
                  disabled={expandedProfileStatus === "self"}
                  onClick={() => openConversation(expandedProfile)}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mesaj Gonder
                </button>
                <button
                  type="button"
                  disabled={!canInviteToClan || expandedProfileStatus === "self"}
                  onClick={() => inviteFriendToClan(expandedProfile)}
                  className="min-h-12 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 text-xs font-semibold text-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Klana Davet
                </button>
                <button
                  type="button"
                  disabled={!primaryHostableConvoy || expandedProfileStatus === "self"}
                  onClick={() => inviteDriverToMeet(primaryHostableConvoy.id, expandedProfile)}
                  className="min-h-12 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Konvoya Davet
                </button>
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-neutral-400">
                <p>Kaynak: {expandedProfile.source}</p>
                <p className="mt-1">Durum: {expandedProfileStatus}</p>
                {expandedProfile.speed ? <p className="mt-1">Anlik hiz: {expandedProfile.speed} KM/H</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
