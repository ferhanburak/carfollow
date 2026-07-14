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
  if (profile.plate === user.plate) {
    return "self";
  }
  if ((user.blockedDrivers ?? []).some((entry) => entry.plate === profile.plate)) {
    return "blocked";
  }
  if ((user.friends ?? []).some((entry) => entry.plate === profile.plate)) {
    return "friend";
  }
  if ((user.incomingRequests ?? []).some((entry) => entry.plate === profile.plate)) {
    return "incoming";
  }
  if ((user.outgoingRequests ?? []).some((entry) => entry.plate === profile.plate)) {
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
  onRequestFriend,
  onRemoveFriendship,
  onUnblockDriver,
  presence,
  profile,
  socialPendingKey,
  user,
}) {
  if (!profile) {
    return null;
  }

  const profileStatus = getProfileStatus(user, profile);
  const reputation = resolveReputation(profile);
  const stats = buildStats(profile, user);
  const isPending = Boolean(
    socialPendingKey && profile.userId && socialPendingKey.endsWith(`:${profile.userId}`),
  );

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
              disabled={!onInviteFriendToClan || profileStatus !== "friend" || isPending}
              onClick={() => onInviteFriendToClan(profile)}
              className="min-h-12 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 text-xs font-semibold text-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Klana Davet
            </button>
            <button
              type="button"
              disabled={!hostableConvoy || profileStatus !== "friend" || isPending}
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
