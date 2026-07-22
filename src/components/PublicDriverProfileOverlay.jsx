import { useState } from "react";
import { formatNumber } from "../utils/garage";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
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

  return `${Math.round(diffMinutes / 60)} sa once`;
}

function buildStats(profile, fallbackUser) {
  const harmonyVotes = Number(profile?.harmonyVotes ?? 0);
  const alertVotes = Number(profile?.alertVotes ?? 0);
  const totalVotes = harmonyVotes + alertVotes;
  const harmonyRatio = totalVotes ? clampPercent((harmonyVotes / totalVotes) * 100) : 100;

  return [
    { key: "score", label: "Surucu Skoru", value: `${Number(profile?.driverScore ?? profile?.score ?? 0)}/100` },
    { key: "km", label: "Aylik KM", value: `${formatNumber(Number(profile?.monthlyKm ?? 0))} KM` },
    { key: "harmony", label: "Uyum Orani", value: `%${harmonyRatio}` },
    { key: "region", label: "Bolge", value: profile?.region ?? fallbackUser?.region ?? "--" },
  ];
}

function resolveReputation(profile) {
  const score = Number(profile?.driverScore ?? profile?.score ?? 0);
  const harmonyVotes = Number(profile?.harmonyVotes ?? 0);
  const alertVotes = Number(profile?.alertVotes ?? 0);

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

function getProfileStatus(user, profile) {
  if (!profile) {
    return "none";
  }
  const profileUserId = profile.userId ?? profile.firebaseUid ?? profile.id;
  const currentUserId = user.firebaseUid ?? user.userId ?? user.id;
  const matchesProfile = (entry) => {
    const entryUserId = entry.userId ?? entry.firebaseUid ?? entry.id;
    return profileUserId && entryUserId ? profileUserId === entryUserId : entry.plate === profile.plate;
  };
  if ((profileUserId && profileUserId === currentUserId) || profile.plate === user.plate) {
    return "self";
  }
  if ((user.blockedDrivers ?? []).some(matchesProfile)) {
    return "blocked";
  }
  if ((user.friends ?? []).some(matchesProfile)) {
    return "friend";
  }
  if ((user.incomingRequests ?? []).some(matchesProfile)) {
    return "incoming";
  }
  if ((user.outgoingRequests ?? []).some(matchesProfile)) {
    return "outgoing";
  }
  return "none";
}

export function PublicDriverProfileOverlay({
  hostableConvoy,
  onBlockDriver,
  onClose,
  onInviteFriendToClan,
  onInviteToConvoy,
  onOpenConversation,
  onReportDriver,
  onRequestFriend,
  onRemoveFriendship,
  onUnblockDriver,
  presence,
  profile,
  moderationFeedback,
  moderationPending,
  socialPendingKey,
  user,
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("dangerous-driving");
  const [reportDetails, setReportDetails] = useState("");

  if (!profile) {
    return null;
  }

  const profileStatus = getProfileStatus(user, profile);
  const reputation = resolveReputation(profile);
  const stats = buildStats(profile, user);
  const isPending = Boolean(
    socialPendingKey && profile.userId && socialPendingKey.endsWith(`:${profile.userId}`),
  );
  const canReceiveCommunityInvite = !["blocked", "self"].includes(profileStatus);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050505]/95 px-3 py-6 backdrop-blur-sm">
      <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-[#0d0d0d] shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[2rem] border-b border-white/10 bg-[#0d0d0d]/95 px-4 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-lime-400">Public Driver Profile</p>
            <h3 className="mt-1 text-lg font-black">{profile.fullName ?? profile.plate}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-2xl border border-white/10 bg-black/25 px-4 text-xs font-semibold text-neutral-300"
          >
            Kapat
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-[1.5rem] border border-white/8 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.12),transparent_35%),linear-gradient(180deg,#171717,#0f0f0f)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm tracking-[0.16em] text-lime-300">{profile.plate}</p>
                <p className="mt-1 text-base font-semibold text-neutral-100">{profile.model ?? "Unknown Setup"}</p>
                <p className="mt-1 text-xs text-neutral-500">{profile.region ?? user.region}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${getPresenceTone(presence?.status)}`} />
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    {formatPresenceLabel(presence)}
                  </span>
                </div>
                {profile.clan ? <p className="mt-2 text-xs text-neutral-400">{profile.clan}</p> : null}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl border px-4 py-3 ${reputation.tone}`}>
              <p className="text-xs uppercase tracking-[0.18em]">Reputation</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-semibold">{reputation.label}</p>
                <p className="text-xs">{profileStatus}</p>
              </div>
              <p className="mt-2 text-xs">{reputation.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat) => (
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
                  Number(profile.alertVotes ?? 0) > Number(profile.harmonyVotes ?? 0) ? "bg-rose-500" : "bg-lime-400"
                }`}
                style={{
                  width: `${clampPercent(
                    ((Number(profile.harmonyVotes ?? 0) /
                      Math.max(1, Number(profile.harmonyVotes ?? 0) + Number(profile.alertVotes ?? 0))) *
                      100),
                  )}%`,
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
              <span>Uyum oyu: {Number(profile.harmonyVotes ?? 0)}</span>
              <span>Uyari oyu: {Number(profile.alertVotes ?? 0)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={profileStatus !== "none" || isPending}
              onClick={() => onRequestFriend(profile)}
              className="min-h-12 rounded-2xl bg-lime-400 px-4 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileStatus === "friend"
                ? "Zaten Arkadas"
                : profileStatus === "incoming"
                  ? "Istek Bekliyor"
                  : profileStatus === "outgoing"
                    ? "Istek Gonderildi"
                    : profileStatus === "blocked"
                      ? "Surucu Engelli"
                    : profileStatus === "self"
                      ? "Bu Sensin"
                      : "Arkadas Ekle"}
            </button>
            <button
              type="button"
              disabled={profileStatus !== "friend" || isPending}
              onClick={() => onOpenConversation(profile)}
              className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mesaj Gonder
            </button>
            <button
              type="button"
              disabled={!onInviteFriendToClan || !canReceiveCommunityInvite || isPending}
              onClick={() => onInviteFriendToClan(profile)}
              className="min-h-12 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 text-xs font-semibold text-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Klana Davet
            </button>
            <button
              type="button"
              disabled={!onInviteToConvoy || !hostableConvoy || !canReceiveCommunityInvite || isPending}
              onClick={() => onInviteToConvoy(hostableConvoy.id, profile)}
              className="min-h-12 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Konvoya Davet
            </button>
            {profileStatus === "friend" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onRemoveFriendship?.(profile.plate)}
                className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-300 disabled:cursor-wait disabled:opacity-50"
              >
                Arkadasliktan Cikar
              </button>
            ) : null}
            {profileStatus === "blocked" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onUnblockDriver?.(profile)}
                className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-neutral-200 disabled:cursor-wait disabled:opacity-50"
              >
                Engeli Kaldir
              </button>
            ) : profileStatus !== "self" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onBlockDriver?.(profile)}
                className="min-h-12 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 disabled:cursor-wait disabled:opacity-50"
              >
                Surucuyu Engelle
              </button>
            ) : null}
          </div>

          {profileStatus !== "self" ? (
            <div className="rounded-2xl border border-rose-400/15 bg-rose-500/[0.04] p-4">
              <button
                type="button"
                onClick={() => setReportOpen((current) => !current)}
                className="min-h-12 w-full rounded-xl border border-rose-400/20 px-4 text-xs font-semibold text-rose-200"
              >
                {reportOpen ? "Rapor Formunu Kapat" : "Surucuyu Raporla"}
              </button>
              {reportOpen ? (
                <form
                  className="mt-3 space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const completed = await onReportDriver?.(profile, { reason: reportReason, details: reportDetails });
                    if (completed) {
                      setReportDetails("");
                      setReportOpen(false);
                    }
                  }}
                >
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm text-neutral-200"
                  >
                    <option value="dangerous-driving">Tehlikeli surus</option>
                    <option value="harassment">Taciz veya rahatsizlik</option>
                    <option value="spam">Spam</option>
                    <option value="false-information">Yanlis bilgi</option>
                    <option value="inappropriate-content">Uygunsuz icerik</option>
                    <option value="other">Diger</option>
                  </select>
                  <textarea
                    value={reportDetails}
                    onChange={(event) => setReportDetails(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Incelemeye yardimci olacak kisa bir aciklama..."
                    className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-3 text-sm text-neutral-200 outline-none focus:border-rose-400/40"
                  />
                  <button
                    type="submit"
                    disabled={moderationPending || !onReportDriver}
                    className="min-h-12 w-full rounded-xl bg-rose-500 px-4 text-xs font-black text-white disabled:opacity-50"
                  >
                    {moderationPending ? "Rapor gonderiliyor..." : "Guvenlik Ekibine Gonder"}
                  </button>
                </form>
              ) : null}
              {moderationFeedback ? <p className="mt-3 text-xs text-rose-100/80">{moderationFeedback}</p> : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-neutral-400">
            <p>Kaynak: {profile.source ?? "shared-overlay"}</p>
            <p className="mt-1">Durum: {profileStatus}</p>
            {profile.speed ? <p className="mt-1">Anlik hiz: {profile.speed} KM/H</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
