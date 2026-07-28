import { useEffect, useMemo, useState } from "react";
import { ClanCenter, ClanCreatePanel, ClanMembershipLoadingCard, ClanSummaryCard } from "../components/ClanCenter";
import { individualDriverSeed } from "../data/mockData";
import { getActionError } from "../utils/actionFeedback";
import { formatNumber } from "../utils/garage";
import {
  buildIndividualLeaderboard,
  formatDriveTime,
  rankIndividualLeaderboard,
} from "../utils/socialStats";

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

function SocialActionIcon({ name }) {
  const paths = {
    block: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="m6.5 6.5 11 11" />
      </>
    ),
    chat: (
      <>
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.6-.8L4 20l1.3-3.8A7.6 7.6 0 1 1 20 11.5Z" />
        <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth="2.4" />
      </>
    ),
    clan: (
      <>
        <path d="M12 3 19 6.5v5c0 4.2-2.8 7.4-7 9.5-4.2-2.1-7-5.3-7-9.5v-5L12 3Z" />
        <path d="M9 12h6M12 9v6" />
      </>
    ),
    remove: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.4-3.1 2.2-5 5.5-5 1.2 0 2.2.2 3 .7M15 12l6 6M21 12l-6 6" />
      </>
    ),
    undo: (
      <>
        <path d="m8 7-4 4 4 4" />
        <path d="M5 11h8a6 6 0 0 1 6 6v1" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

const leaderboardPeriods = [
  { key: "monthly", shortLabel: "A", label: "Aylık" },
  { key: "weekly", shortLabel: "H", label: "Haftalık" },
  { key: "daily", shortLabel: "G", label: "Günlük" },
];

const leaderboardMetrics = [
  {
    key: "km",
    fieldSuffix: "Km",
    label: "KM",
    summaryLabel: "KM",
    format: (value) => `${formatNumber(value)} KM`,
  },
  {
    key: "driveSeconds",
    fieldSuffix: "DriveSeconds",
    label: "Sürüş Süresi",
    summaryLabel: "Sürüş",
    format: (value) => formatDriveTime(value),
  },
  {
    key: "maxSpeedKmh",
    fieldSuffix: "MaxSpeedKmh",
    label: "Maksimum Hız",
    summaryLabel: "Max Hız",
    format: (value) => `${Math.round(Number(value) || 0)} KM/H`,
  },
];

function SegmentedControl({ ariaLabel, items, onChange, value, compact = false }) {
  const selectedIndex = Math.max(0, items.findIndex((item) => item.key === value));

  return (
    <div
      aria-label={ariaLabel}
      className={`relative grid overflow-hidden rounded-full border border-white/10 bg-black/35 p-0.5 ${
        compact ? "w-[7.25rem] shrink-0 min-[390px]:w-[8.25rem]" : "w-full"
      }`}
      role="group"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 rounded-full bg-lime-400 shadow-[0_0_16px_rgba(163,230,53,0.24)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateX(${selectedIndex * 100}%)`,
          width: `calc((100% - 0.25rem) / ${items.length})`,
        }}
      />
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-label={item.label}
          aria-pressed={value === item.key}
          onClick={() => onChange(item.key)}
          className={`relative z-10 rounded-full px-1 font-semibold leading-none transition-colors duration-300 active:scale-95 ${
            compact ? "min-h-10 text-xs" : "min-h-11 whitespace-nowrap text-xs"
          } ${value === item.key ? "text-black" : "text-neutral-400 hover:text-white"}`}
        >
          {compact ? item.shortLabel : item.label}
        </button>
      ))}
    </div>
  );
}

function getLeaderboardMetric(periodKey, metricKey) {
  const metric = leaderboardMetrics.find((entry) => entry.key === metricKey) ?? leaderboardMetrics[0];
  return {
    ...metric,
    fieldKey: `${periodKey}${metric.fieldSuffix}`,
  };
}

export function StatsScreen({
  acceptIncomingClanInvite,
  approveFriendRequest,
  blockDriver,
  clanFeedback,
  clanEventFeedback,
  clanEventPendingId,
  clanEvents = [],
  clanForm,
  clanPendingKey,
  clans,
  createNewClan,
  currentClan,
  currentClanMembers = [],
  declineFriendRequest,
  declineIncomingClanInvite,
  deleteClanEvent,
  friendSearchQuery,
  friendSearchResults,
  hostableConvoys,
  inviteDriverToMeet,
  inviteFriendToClan,
  individualLeaderboardEntries,
  leaveCurrentClan,
  onClanFormChange,
  onFriendSearchChange,
  onOpenPublicProfile,
  openConversation,
  requestFriend,
  removeClanMember,
  removeFriendship,
  revokeClanInvite,
  socialFeedback,
  socialPendingKey,
  transferClanOwnership,
  user,
  updateClanMemberRole,
  withdrawFriendRequest,
  mode = "social",
}) {
  const [clanCenterOpen, setClanCenterOpen] = useState(false);
  const [leaderboardPeriodKey, setLeaderboardPeriodKey] = useState("monthly");
  const [leaderboardMetricKey, setLeaderboardMetricKey] = useState("km");
  const [clanLeaderboardPeriodKey, setClanLeaderboardPeriodKey] = useState("monthly");
  const [clanLeaderboardMetricKey, setClanLeaderboardMetricKey] = useState("km");
  const [individualLeaderboardExpanded, setIndividualLeaderboardExpanded] = useState(false);
  const [clanLeaderboardExpanded, setClanLeaderboardExpanded] = useState(false);
  const baseIndividualLeaderboard = Array.isArray(individualLeaderboardEntries)
    ? individualLeaderboardEntries
    : buildIndividualLeaderboard(user, individualDriverSeed);
  const activeLeaderboardPeriod = leaderboardPeriods.find(
    (period) => period.key === leaderboardPeriodKey,
  ) ?? leaderboardPeriods[0];
  const activeLeaderboardMetric = getLeaderboardMetric(leaderboardPeriodKey, leaderboardMetricKey);
  const individualLeaderboard = useMemo(
    () => rankIndividualLeaderboard(baseIndividualLeaderboard, activeLeaderboardMetric.fieldKey),
    [activeLeaderboardMetric.fieldKey, baseIndividualLeaderboard],
  );
  const activeClanLeaderboardPeriod = leaderboardPeriods.find(
    (period) => period.key === clanLeaderboardPeriodKey,
  ) ?? leaderboardPeriods[0];
  const activeClanLeaderboardMetric = getLeaderboardMetric(
    clanLeaderboardPeriodKey,
    clanLeaderboardMetricKey,
  );
  const clanLeaderboard = useMemo(
    () => rankIndividualLeaderboard(
      clans.map((clan) => ({ ...clan, monthlyKm: Number(clan.monthlyKm ?? clan.km ?? 0) })),
      activeClanLeaderboardMetric.fieldKey,
    ),
    [activeClanLeaderboardMetric.fieldKey, clans],
  );
  const visibleIndividualLeaderboard = individualLeaderboardExpanded
    ? individualLeaderboard
    : individualLeaderboard.slice(0, 5);
  const visibleClanLeaderboard = clanLeaderboardExpanded
    ? clanLeaderboard
    : clanLeaderboard.slice(0, 5);
  const canInviteToClan = ["owner", "captain"].includes(user.clanRole ?? "member");
  const isClanPending = Boolean(clanPendingKey);
  const hasClanMembership = Boolean(currentClan || user.clanId || user.clan);
  const clanMemberCount = currentClanMembers.length || Number(currentClan?.members ?? 0);
  const primaryHostableConvoy = hostableConvoys?.[0] ?? null;
  const hasSearchResults = friendSearchResults.length > 0;
  const socialError = getActionError(socialFeedback);

  const friendPlateSet = useMemo(() => new Set((user.friends ?? []).map((entry) => entry.plate)), [user.friends]);
  const incomingPlateSet = useMemo(() => new Set((user.incomingRequests ?? []).map((entry) => entry.plate)), [user.incomingRequests]);
  const outgoingPlateSet = useMemo(() => new Set((user.outgoingRequests ?? []).map((entry) => entry.plate)), [user.outgoingRequests]);

  const openProfileDrawer = (profile, source = "community") => {
    onOpenPublicProfile?.({ ...profile, source });
  };
  const toggleLeaderboardFromCard = (event, toggleExpanded) => {
    if (event.target.closest("button, [data-leaderboard-row]")) {
      return;
    }
    toggleExpanded((current) => !current);
  };
  const isSocialEntryPending = (entry) =>
    Boolean(socialPendingKey && entry?.userId && socialPendingKey.endsWith(`:${entry.userId}`));
  const hasPendingClanInvite = (entry) => (user.sentClanInvites ?? []).some((invite) =>
    (invite.targetUserId && invite.targetUserId === entry.userId) ||
    (invite.targetPlate && invite.targetPlate === entry.plate),
  );
  const isInvitedToConvoy = (convoy, entry) => (convoy?.invitedGuests ?? []).some((invite) =>
    (invite.userId && invite.userId === entry.userId) ||
    (invite.plate && invite.plate === entry.plate),
  );
  const showSocial = mode === "social";
  const showLeaderboard = mode === "leaderboard";

  useEffect(() => {
    if (!hasClanMembership) setClanCenterOpen(false);
  }, [hasClanMembership]);

  return (
    <section className="space-y-4">
      {showSocial ? (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        {!hasClanMembership && (user.clanInvites ?? []).length ? (
          <div
            data-testid="incoming-clan-invite-alert"
            className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
          >
            {user.clanInvites.length} bekleyen klan davetin var. Klan Kur alanından kabul veya red işlemi yapabilirsin.
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-black">Klan Merkezi</h3>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">
            {hasClanMembership ? currentClan?.name ?? user.clan : "Clanless"}
          </div>
        </div>

        <div className="mt-4">
          {currentClan ? (
            <ClanSummaryCard clan={currentClan} eventCount={clanEvents.length} memberCount={clanMemberCount} onOpen={() => setClanCenterOpen(true)} userRole={user.clanRole} />
          ) : hasClanMembership ? (
            <ClanMembershipLoadingCard clanName={user.clan} />
          ) : (
            <ClanCreatePanel
              clanFeedback={clanFeedback}
              clanForm={clanForm}
              invites={user.clanInvites ?? []}
              isPending={isClanPending}
              onAcceptInvite={acceptIncomingClanInvite}
              onCreateClan={createNewClan}
              onDeclineInvite={declineIncomingClanInvite}
              onFormChange={onClanFormChange}
            />
          )}
        </div>

        <ClanCenter
          clan={currentClan}
          clanEventFeedback={clanEventFeedback}
          clanFeedback={clanFeedback}
          eventPendingId={clanEventPendingId}
          events={clanEvents}
          isOpen={clanCenterOpen}
          isPending={isClanPending}
          members={currentClanMembers}
          onClose={() => setClanCenterOpen(false)}
          onDeleteEvent={deleteClanEvent}
          onLeave={leaveCurrentClan}
          onOpenProfile={onOpenPublicProfile}
          onRemoveMember={removeClanMember}
          onRevokeInvite={revokeClanInvite}
          onTransferOwnership={transferClanOwnership}
          onUpdateMemberRole={updateClanMemberRole}
          outgoingInvites={user.sentClanInvites ?? []}
          user={user}
        />

      </div>
      ) : null}

      {showSocial ? (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black">Arkadaş Bul ve Bağlan</h3>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-neutral-400">
            {(user.friends ?? []).length} friends
          </div>
        </div>
        {socialError ? (
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {socialError}
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Kullanıcı Ara</p>
              <p className="mt-1 text-xs text-neutral-500">Tam plakayla ara. Yalnızca birebir eslesen kayıt gösterilir.</p>
            </div>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
              {hasSearchResults ? `${Math.min(friendSearchResults.length, 8)} sonuç` : "Hazır"}
            </span>
          </div>
          <input
            value={friendSearchQuery}
            onChange={(event) => onFriendSearchChange(event.target.value)}
            placeholder="Ornek: 06 PWA 101"
            className="mt-3 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none focus:border-lime-400"
          />
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
            {friendSearchResults.slice(0, 8).map((entry) => (
              <div key={`${entry.userId}-${entry.plate}`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => openProfileDrawer(entry, "search")} className="text-left">
                    <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                    <p className="mt-1 text-sm font-semibold">{entry.fullName ?? "CRUISER Driver"}</p>
                    <p className="text-xs text-neutral-500">{entry.model ?? "Araç bilgisi gizli"}{entry.region ? ` / ${entry.region}` : ""}</p>
                  </button>
                  {entry.friendshipStatus === "none" ? (
                    <button
                      type="button"
                      disabled={isSocialEntryPending(entry)}
                      onClick={() => requestFriend(entry)}
                      className="min-h-12 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black disabled:cursor-wait disabled:opacity-50"
                    >
                      Arkadaş Ekle
                    </button>
                  ) : entry.friendshipStatus === "outgoing" ? (
                    <button
                      type="button"
                      disabled
                      className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      İstek Gönderildi
                    </button>
                  ) : entry.friendshipStatus === "incoming" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSocialEntryPending(entry)}
                        onClick={() => approveFriendRequest(entry.plate)}
                        className="min-h-12 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black disabled:cursor-wait disabled:opacity-50"
                      >
                        Kabul
                      </button>
                      <button
                        type="button"
                        disabled={isSocialEntryPending(entry)}
                        onClick={() => declineFriendRequest(entry.plate)}
                        className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200 disabled:cursor-wait disabled:opacity-50"
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {canInviteToClan ? (
                    <button
                      type="button"
                      disabled={isClanPending || hasPendingClanInvite(entry)}
                      onClick={() => inviteFriendToClan(entry)}
                      className="min-h-12 rounded-xl border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-xs font-semibold text-lime-200 disabled:cursor-wait disabled:opacity-50"
                    >
                      {hasPendingClanInvite(entry) ? "Davet Gönderildi" : "Klana Davet"}
                    </button>
                  ) : null}
                  {primaryHostableConvoy ? (
                    <button
                      type="button"
                      disabled={isInvitedToConvoy(primaryHostableConvoy, entry)}
                      onClick={() => inviteDriverToMeet(primaryHostableConvoy.id, entry)}
                      className="min-h-12 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isInvitedToConvoy(primaryHostableConvoy, entry) ? "Davet Gönderildi" : "Konvoya Davet"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!hasSearchResults && friendSearchQuery.trim() ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                Bu tam plakaya ait bir sürücü bulunamadı.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Gelen İstekler</p>
            <div className="mt-4 space-y-3">
              {(user.incomingRequests ?? []).length ? (
                user.incomingRequests.map((entry) => (
                  <div key={`${entry.plate}-incoming`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <button type="button" onClick={() => openProfileDrawer(entry, "incoming")} className="text-left">
                      <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{entry.plate}</p>
                      <p className="mt-1 text-sm font-semibold">{entry.fullName}</p>
                      <p className="text-xs text-neutral-500">{entry.model}</p>
                    </button>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={isSocialEntryPending(entry)}
                        onClick={() => approveFriendRequest(entry.plate)}
                        className="min-h-12 flex-1 rounded-xl bg-lime-400 px-3 py-2 text-xs font-bold text-black disabled:cursor-wait disabled:opacity-50"
                      >
                        Kabul Et
                      </button>
                      <button
                        type="button"
                        disabled={isSocialEntryPending(entry)}
                        onClick={() => declineFriendRequest(entry.plate)}
                        className="min-h-12 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200 disabled:cursor-wait disabled:opacity-50"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Yeni arkadaş isteği yok.
                </div>
              )}
            </div>
          </div>

          <div aria-label="Giden istekler" className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Giden İstekler</p>
            <div className="mt-4 space-y-3">
              {(user.outgoingRequests ?? []).length ? (
                user.outgoingRequests.map((entry) => (
                  <div key={`${entry.userId ?? entry.plate}-outgoing`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <button type="button" onClick={() => openProfileDrawer(entry, "outgoing")} className="min-h-12 min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-neutral-100">{entry.fullName}</p>
                      <p className="mt-1 truncate text-xs text-neutral-500">{entry.model || "Araç bilgisi yok"}</p>
                    </button>
                    <button
                      type="button"
                      aria-label={`${entry.fullName} arkadaşlık istegini geri çek`}
                      title="Istegi geri çek"
                      disabled={isSocialEntryPending(entry)}
                      onClick={() => withdrawFriendRequest(entry.plate)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-300 transition active:scale-95 disabled:cursor-wait disabled:opacity-50"
                    >
                      <SocialActionIcon name="undo" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Bekleyen giden istek yok.
                </div>
              )}
            </div>
          </div>

          <div aria-label="Arkadaş listesi" className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <p className="text-sm font-semibold">Arkadaş Listesi</p>
            <div className="mt-4 space-y-3">
              {(user.friends ?? []).length ? (
                user.friends.map((entry) => (
                  <div key={`${entry.plate}-friend`} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    <button type="button" onClick={() => openProfileDrawer(entry, "friend")} className="min-h-12 w-full text-left">
                      <p className="truncate text-sm font-semibold text-neutral-100">{entry.fullName}</p>
                      <p className="mt-1 truncate text-xs text-neutral-500">{entry.model || "Araç bilgisi yok"}</p>
                    </button>
                    <div className={`mt-2 grid gap-2 ${canInviteToClan ? "grid-cols-4" : "grid-cols-3"}`}>
                      <button
                        type="button"
                        aria-label={`${entry.fullName} ile sohbet ac`}
                        title="Sohbet ac"
                        disabled={isSocialEntryPending(entry)}
                        onClick={() => openConversation(entry)}
                        className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-200 transition active:scale-95 disabled:opacity-50"
                      >
                        <SocialActionIcon name="chat" />
                      </button>
                      {canInviteToClan ? (
                        <button
                          type="button"
                          aria-label={hasPendingClanInvite(entry) ? `${entry.fullName} klan daveti gönderildi` : `${entry.fullName} klana davet et`}
                          title={hasPendingClanInvite(entry) ? "Davet gönderildi" : "Klana davet et"}
                          disabled={isSocialEntryPending(entry) || hasPendingClanInvite(entry)}
                          onClick={() => inviteFriendToClan(entry)}
                          className="flex min-h-12 items-center justify-center rounded-xl bg-lime-400 text-black transition active:scale-95 disabled:opacity-50"
                        >
                          <SocialActionIcon name="clan" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`${entry.fullName} arkadaşlıktan çıkar`}
                        title="Arkadaşlıktan çıkar"
                        disabled={isSocialEntryPending(entry)}
                        onClick={() => removeFriendship(entry.plate)}
                        className="flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-neutral-300 transition active:scale-95 disabled:cursor-wait disabled:opacity-50"
                      >
                        <SocialActionIcon name="remove" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${entry.fullName} engelle`}
                        title="Engelle"
                        disabled={isSocialEntryPending(entry)}
                        onClick={() => blockDriver(entry)}
                        className="flex min-h-12 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-200 transition active:scale-95 disabled:cursor-wait disabled:opacity-50"
                      >
                        <SocialActionIcon name="block" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
                  Henüz arkadaş eklenmedi.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      ) : null}

      {showLeaderboard ? (
      <div
        aria-label={`${activeLeaderboardPeriod.label} sürücü sıralaması`}
        className="cursor-pointer rounded-[1.5rem] border border-white/10 bg-[#111111] p-3.5"
        onClick={(event) => toggleLeaderboardFromCard(event, setIndividualLeaderboardExpanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-expanded={individualLeaderboardExpanded}
            onClick={() => setIndividualLeaderboardExpanded((current) => !current)}
            className="min-h-10 min-w-0 flex-1 rounded-xl px-0.5 text-left active:scale-[0.99]"
          >
            <h3 className="text-sm font-extrabold tracking-[-0.015em] min-[390px]:text-base">
              {activeLeaderboardPeriod.label} Sürücü Sıralaması
            </h3>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-500">
              {individualLeaderboardExpanded
                ? "Tüm sürücüler"
                : "İlk 5 sürücü (tümünü görmek için tıklayınız)"}
            </p>
          </button>
          <SegmentedControl
            ariaLabel="Sürücü sıralama dönemi"
            compact
            items={leaderboardPeriods}
            onChange={setLeaderboardPeriodKey}
            value={leaderboardPeriodKey}
          />
        </div>
        <div className="mt-2">
          <SegmentedControl
            ariaLabel="Leaderboard ölçütü"
            items={leaderboardMetrics}
            onChange={setLeaderboardMetricKey}
            value={leaderboardMetricKey}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <div className="rounded-xl border border-white/8 bg-black/20 px-2 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Sıran</p>
            <p className="mt-1 text-sm font-extrabold text-lime-300 tabular-nums">
              #{individualLeaderboard.find((driver) => driver.plate === user.plate)?.rank ?? "--"}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-2 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">{activeLeaderboardMetric.summaryLabel}</p>
            <p className="mt-1 truncate text-sm font-extrabold text-lime-300 tabular-nums">
              {activeLeaderboardMetric.format(user[activeLeaderboardMetric.fieldKey])}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 px-2 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Skor</p>
            <p className="mt-1 text-sm font-extrabold text-lime-300 tabular-nums">{user.driverScore}/100</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {visibleIndividualLeaderboard.map((driver) => (
            <div
              key={driver.userId ?? `${driver.plate}-individual`}
              data-leaderboard-row
              className={`rounded-xl border p-2.5 ${
                driver.plate === user.plate ? "border-lime-400/30 bg-lime-400/10" : "border-white/8 bg-black/20"
              }`}
            >
              <button type="button" onClick={() => openProfileDrawer(driver, "leaderboard")} className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 text-left">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold tabular-nums ${getClanRankTone(driver.rank - 1)}`}>
                    #{driver.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{driver.fullName}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-neutral-500">{driver.model}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold text-lime-300 tabular-nums">
                    {activeLeaderboardMetric.format(driver[activeLeaderboardMetric.fieldKey])}
                  </p>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {showLeaderboard ? (
      <div
        aria-label={`${activeClanLeaderboardPeriod.label} klan sıralaması`}
        className="cursor-pointer rounded-[1.5rem] border border-white/10 bg-[#111111] p-3.5"
        onClick={(event) => toggleLeaderboardFromCard(event, setClanLeaderboardExpanded)}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-expanded={clanLeaderboardExpanded}
            onClick={() => setClanLeaderboardExpanded((current) => !current)}
            className="min-h-10 min-w-0 flex-1 rounded-xl px-0.5 text-left active:scale-[0.99]"
          >
            <h3 className="text-sm font-extrabold tracking-[-0.015em] min-[390px]:text-base">
              {activeClanLeaderboardPeriod.label} Klan Sıralaması
            </h3>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium text-neutral-500">
              {clanLeaderboardExpanded
                ? "Tüm klanlar"
                : "İlk 5 klan (tümünü görmek için tıklayınız)"}
            </p>
          </button>
          <SegmentedControl
            ariaLabel="Klan sıralama dönemi"
            compact
            items={leaderboardPeriods}
            onChange={setClanLeaderboardPeriodKey}
            value={clanLeaderboardPeriodKey}
          />
        </div>
        <div className="mt-2">
          <SegmentedControl
            ariaLabel="Klan leaderboard ölçütü"
            items={leaderboardMetrics}
            onChange={setClanLeaderboardMetricKey}
            value={clanLeaderboardMetricKey}
          />
        </div>
        <div className="mt-3 space-y-2">
          {visibleClanLeaderboard.map((clan) => (
            <div key={clan.id} data-leaderboard-row className={`rounded-xl border p-2.5 ${
              clan.name === user.clan ? "border-lime-400/30 bg-lime-400/10" : "border-white/8 bg-black/20"
            }`}>
              <div className="flex min-h-[3.25rem] items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold tabular-nums ${getClanRankTone(clan.rank - 1)}`}>
                    #{clan.rank}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{clan.name}</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-neutral-500">{clan.members} üye</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-extrabold text-lime-300 tabular-nums">
                    {activeClanLeaderboardMetric.format(clan[activeClanLeaderboardMetric.fieldKey])}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      ) : null}

    </section>
  );
}
