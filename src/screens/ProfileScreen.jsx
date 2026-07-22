import { useState } from "react";
import { AchievementProgressPanel } from "../components/AchievementCenter";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { InsightCard } from "../components/ui";
import { buildAchievementProgress, buildPersonalStats } from "../utils/socialStats";

function CompactMetric({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
      <p className="text-[8px] uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-lime-300" title={value}>{value}</p>
    </div>
  );
}

export function ProfileScreen({
  onOpenService,
  onOpenStats,
  profileCompletion,
  user,
}) {
  const [achievementCenterOpen, setAchievementCenterOpen] = useState(false);
  const achievementProgress = buildAchievementProgress(user);
  const personalStats = buildPersonalStats(user);
  const garageStat = personalStats.find((stat) => stat.key === "garage");
  const compactPersonalStats = personalStats.filter((stat) => stat.key !== "garage");
  const socialSummary = [
    { key: "friends", label: "Arkadas", value: `${user.friends?.length ?? 0}` },
    { key: "incoming", label: "Gelen Istek", value: `${user.incomingRequests?.length ?? 0}` },
    { key: "outgoing", label: "Giden Istek", value: `${user.outgoingRequests?.length ?? 0}` },
    { key: "clan-invites", label: "Klan Daveti", value: `${user.clanInvites?.length ?? 0}` },
  ];
  const profileHealth = [
    { key: "completion", label: "Profil", value: `%${profileCompletion}` },
    { key: "badges", label: "Unvan", value: `${user.badges?.length ?? 0}` },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Driver Identity</p>
            <h3 className="mt-2 text-xl font-black">{user.fullName}</h3>
            <p className="mt-1 text-sm text-neutral-400">
              {user.plate} / {user.model}
            </p>
          </div>
          <ProfileAvatar src={user.avatar} label={user.fullName} className="h-16 w-16" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {profileHealth.map((item) => (
            <div key={item.key} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-center">
              <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{item.label}</p>
              <p className="mt-1 text-sm font-black text-lime-300">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InsightCard label="Profile Ready" value={`%${profileCompletion}`} />
          <InsightCard label="Driver Score" value={`${user.driverScore}/100`} />
          <InsightCard label="Monthly KM" value={`${Math.round(user.monthlyKm ?? 0)} KM`} />
          <InsightCard label="Clan" value={user.clan ?? "--"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(user.badges ?? []).length ? (
            (user.badges ?? []).map((badge) => (
              <span key={badge} className="rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-2 text-xs text-lime-200">
                {badge}
              </span>
            ))
          ) : (
            <div className="w-full rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-500">
              Henuz aktif unvan yok. Profil, surus ve sosyal ilerleme ile ilk badge'lerini acabilirsin.
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenStats}
            className="min-h-12 rounded-2xl bg-lime-400 font-semibold text-black shadow-[0_0_20px_rgba(163,230,53,0.3)]"
          >
            Stats Ekranina Git
          </button>
          <button
            type="button"
            onClick={onOpenService}
            aria-label="Servis"
            className="min-h-12 rounded-2xl border border-white/10 bg-black/20 font-semibold text-neutral-200"
          >
            Servis
          </button>
        </div>
      </div>

      <div aria-label="Driver stats" className="rounded-[1.5rem] border border-white/10 bg-[#111111] p-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-sm font-semibold">Driver Stats Snapshot</p>
          <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-500">Live</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {compactPersonalStats.map((stat) => (
            <CompactMetric key={stat.key} label={stat.label} value={stat.value} />
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
          <span className="text-[9px] uppercase tracking-[0.16em] text-neutral-500">{garageStat?.label ?? "Aktif Garaj"}</span>
          <span className="truncate text-xs font-semibold text-neutral-200">{garageStat?.value ?? "--"}</span>
        </div>
      </div>

      <AchievementProgressPanel
        achievements={achievementProgress}
        isOpen={achievementCenterOpen}
        onClose={() => setAchievementCenterOpen(false)}
        onOpen={() => setAchievementCenterOpen(true)}
      />

      <div aria-label="Social cockpit" className="rounded-[1.5rem] border border-white/10 bg-[#111111] p-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-sm font-semibold">Social Cockpit</p>
          <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-500">Crew</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {socialSummary.map((item) => (
            <CompactMetric key={item.key} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] uppercase tracking-[0.16em] text-neutral-500">Mevcut klan</p>
            <p className="truncate text-xs font-bold text-neutral-100">{user.clan ?? "Klan yok"}</p>
          </div>
          <p className="mt-1 truncate text-[10px] text-neutral-500">
            {user.clanRole ?? "member"} / {user.harmonyVotes ?? 0} uyum / {user.alertVotes ?? 0} uyari
          </p>
        </div>
      </div>

    </section>
  );
}
