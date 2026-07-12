import { individualDriverSeed } from "../data/mockData";
import { formatNumber } from "../utils/garage";
import { buildAchievementProgress, buildIndividualLeaderboard, buildPersonalStats } from "../utils/socialStats";

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

export function StatsScreen({
  activeConversation,
  activeConversationId,
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
  inviteFriendToClan,
  messageDraft,
  onClanFormChange,
  onFriendSearchChange,
  onMessageDraftChange,
  openConversation,
  requestFriend,
  revokeClanInvite,
  sendMessage,
  socialFeedback,
  user,
  withdrawFriendRequest,
}) {
  const personalStats = buildPersonalStats(user);
  const achievementProgress = buildAchievementProgress(user);
  const individualLeaderboard = buildIndividualLeaderboard(user, individualDriverSeed);
  const sortedClans = [...clans].sort((a, b) => b.km - a.km);
  const canInviteToClan = ["owner", "captain"].includes(user.clanRole ?? "member");

  return (
    <section className="space-y-4">
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
                  <div>
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                    <p className="mt-1 text-sm font-semibold">{entry.fullName}</p>
                    <p className="text-xs text-neutral-500">{entry.model} / {entry.region}</p>
                  </div>
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
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                    <p className="mt-1 text-sm font-semibold">{entry.fullName}</p>
                    <p className="text-xs text-neutral-500">{entry.model}</p>
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
                      <div>
                        <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                        <p className="mt-1 text-sm font-semibold">{entry.fullName}</p>
                        <p className="text-xs text-neutral-500">{entry.model} / {entry.region}</p>
                      </div>
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
              <p className="text-xs text-neutral-500">Realtime Database baglantisina hazir mock sohbet akisi.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              {conversationList.length} thread
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
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{conversation.participantPlate}</p>
                    <p className="mt-1 text-sm font-semibold">{conversation.participantName}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{conversation.lastMessage?.body ?? "Mesaj yok"}</p>
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
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{activeConversation.participantPlate}</p>
                    <p className="mt-1 text-sm font-semibold">{activeConversation.participantName}</p>
                    <p className="text-xs text-neutral-500">{activeConversation.participantModel}</p>
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
              <div className="flex items-center justify-between gap-3">
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
              </div>
            </div>
          ))}
        </div>
      </div>

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

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Driver Stats</p>
            <h3 className="mt-2 text-xl font-black">Personal Progress Board</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">Live Profile</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {personalStats.map((stat) => (
            <div key={stat.key} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{stat.label}</p>
              <p className="mt-2 text-sm font-bold text-lime-300">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Achievements</p>
            <h3 className="mt-2 text-xl font-black">Titles and Unlock Progress</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">
            {(user.badges ?? []).length} active titles
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {achievementProgress.map((achievement) => (
            <div key={achievement.key} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{achievement.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{achievement.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.22em] ${
                    achievement.unlocked
                      ? "border border-lime-400/20 bg-lime-400/10 text-lime-300"
                      : "border border-white/10 bg-white/5 text-neutral-400"
                  }`}
                >
                  {achievement.unlocked ? "Unlocked" : `%${achievement.percent}`}
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    achievement.unlocked ? "bg-lime-400" : achievement.percent >= 70 ? "bg-amber-400" : "bg-white/30"
                  }`}
                  style={{ width: `${achievement.percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {formatNumber(achievement.current)} / {formatNumber(achievement.target)} {achievement.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <p className="text-sm font-semibold">Active Drivers on the Highway</p>
        <div className="mt-4 space-y-3">
          {drivers.map((driver) => (
            <div key={`${driver.plate}-leader`} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
              <div>
                <p className="font-mono text-sm tracking-[0.16em] text-lime-300">{driver.plate}</p>
                <p className="text-xs text-neutral-500">{driver.vehicle}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{driver.node}</p>
                <p className="text-xs text-rose-300">{driver.speed} KM/H</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
