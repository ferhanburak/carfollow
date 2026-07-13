import { VehiclePassportSummary } from "../components/garage/VehiclePassportSummary";
import { CompactField, InsightCard } from "../components/ui";
import { buildAchievementProgress, buildPersonalStats } from "../utils/socialStats";

export function ProfileScreen({
  onLogout,
  onOpenService,
  onOpenStats,
  passportSummary,
  profileCompletion,
  profileErrors,
  profileFeedback,
  profileForm,
  tuningOptions,
  user,
  onProfileFormChange,
  onSubmitProfile,
}) {
  const achievementProgress = buildAchievementProgress(user);
  const personalStats = buildPersonalStats(user);
  const socialSummary = [
    { key: "friends", label: "Arkadas", value: `${user.friends?.length ?? 0}` },
    { key: "incoming", label: "Gelen Istek", value: `${user.incomingRequests?.length ?? 0}` },
    { key: "outgoing", label: "Giden Istek", value: `${user.outgoingRequests?.length ?? 0}` },
    { key: "clan-invites", label: "Klan Daveti", value: `${user.clanInvites?.length ?? 0}` },
  ];
  const profileHealth = [
    { key: "completion", label: "Profil", value: `%${profileCompletion}` },
    { key: "passport", label: "Pasaport", value: passportSummary ? "Hazir" : "Bos" },
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
          <img src={user.avatar} alt={user.model} className="h-16 w-16 rounded-2xl object-cover" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
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
            className="min-h-12 rounded-2xl border border-white/10 bg-black/20 font-semibold text-neutral-200"
          >
            Servis Defterini Ac
          </button>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Vehicle Passport Snapshot</p>
            <p className="text-xs text-neutral-500">Profil ekraninda da hizli arac guven ozeti gorebilirsin.</p>
          </div>
          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-lime-300">
            Verified
          </span>
        </div>
        {passportSummary ? <VehiclePassportSummary summary={passportSummary} /> : null}
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Driver Stats Snapshot</p>
            <p className="text-xs text-neutral-500">Bireysel performans, servis disiplini ve sosyal ag ozeti.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">Live Profile</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {personalStats.map((stat) => (
            <InsightCard key={stat.key} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Achievement Progress</p>
            <p className="text-xs text-neutral-500">Unvanlari nasil kazanacagini ve ne kadar kaldigini net gor.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">{(user.badges ?? []).length} aktif unvan</span>
        </div>

        <div className="mt-4 space-y-3">
          {achievementProgress.map((achievement) => (
            <div key={achievement.key} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-100">{achievement.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{achievement.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    achievement.unlocked ? "bg-lime-400/15 text-lime-200" : "bg-white/8 text-neutral-300"
                  }`}
                >
                  {achievement.unlocked ? "Unlocked" : `%${achievement.percent}`}
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    achievement.unlocked ? "bg-lime-400" : achievement.percent >= 70 ? "bg-amber-400" : "bg-white/30"
                  }`}
                  style={{ width: `${achievement.percent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                <span>
                  {achievement.current} / {achievement.target} {achievement.unit}
                </span>
                <span>{achievement.unlocked ? "Tamamlandi" : "Devam ediyor"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Social Cockpit</p>
            <p className="text-xs text-neutral-500">Arkadaslar, davetler ve klan akisina hizli bakis.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">Crew Pulse</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {socialSummary.map((item) => (
            <InsightCard key={item.key} label={item.label} value={item.value} />
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-300">
          <p className="font-semibold text-neutral-100">Mevcut klan</p>
          <p className="mt-2">{user.clan ?? "Klan yok"}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Rol: {user.clanRole ?? "member"} / Uyum oyu: {user.harmonyVotes ?? 0} / Uyari oyu: {user.alertVotes ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Editable Vehicle Profile</p>
            <p className="text-xs text-neutral-500">Arac setup, servis noktasi ve profil gorunumunu buradan yonet.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">Private Profile</span>
        </div>

        {profileFeedback ? (
          <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
            {profileFeedback}
          </div>
        ) : null}

        <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={onSubmitProfile}>
          <CompactField label="Full Name">
            <input
              value={profileForm.fullName}
              onChange={(event) => onProfileFormChange((current) => ({ ...current, fullName: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {profileErrors.fullName ? <p className="text-xs text-rose-300">{profileErrors.fullName}</p> : null}
          </CompactField>

          <CompactField label="Region">
            <input
              value={profileForm.region}
              onChange={(event) => onProfileFormChange((current) => ({ ...current, region: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {profileErrors.region ? <p className="text-xs text-rose-300">{profileErrors.region}</p> : null}
          </CompactField>

          <CompactField label="Vehicle Model">
            <input
              value={profileForm.model}
              onChange={(event) => onProfileFormChange((current) => ({ ...current, model: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {profileErrors.model ? <p className="text-xs text-rose-300">{profileErrors.model}</p> : null}
          </CompactField>

          <CompactField label="Horsepower">
            <input
              type="number"
              value={profileForm.horsepower}
              onChange={(event) => onProfileFormChange((current) => ({ ...current, horsepower: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {profileErrors.horsepower ? <p className="text-xs text-rose-300">{profileErrors.horsepower}</p> : null}
          </CompactField>

          <CompactField label="Tuning Stage">
            <select
              value={profileForm.tuningStage}
              onChange={(event) => onProfileFormChange((current) => ({ ...current, tuningStage: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            >
              {tuningOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </CompactField>

          <CompactField label="Garage / Shop">
            <input
              value={profileForm.garage}
              onChange={(event) => onProfileFormChange((current) => ({ ...current, garage: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {profileErrors.garage ? <p className="text-xs text-rose-300">{profileErrors.garage}</p> : null}
          </CompactField>

          <div className="col-span-2">
            <CompactField label="Avatar URL">
              <input
                value={profileForm.avatar}
                onChange={(event) => onProfileFormChange((current) => ({ ...current, avatar: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
              />
            </CompactField>
          </div>

          <button
            type="submit"
            className="col-span-2 min-h-12 rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_20px_rgba(163,230,53,0.35)]"
          >
            Profili Guncelle
          </button>
        </form>
      </div>

      <div className="rounded-[1.75rem] border border-rose-400/15 bg-rose-500/5 p-4">
        <p className="text-sm font-semibold text-neutral-100">Account Session</p>
        <p className="mt-1 text-xs text-neutral-500">
          Bu cihazdaki CRUISER oturumunu guvenli sekilde kapat.
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 min-h-12 w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 font-semibold text-rose-200 transition hover:bg-rose-500/15"
        >
          Oturumu Kapat
        </button>
      </div>
    </section>
  );
}
