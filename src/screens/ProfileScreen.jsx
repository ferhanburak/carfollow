import { VehiclePassportSummary } from "../components/garage/VehiclePassportSummary";
import { CompactField, InsightCard } from "../components/ui";

export function ProfileScreen({
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

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InsightCard label="Profile Ready" value={`%${profileCompletion}`} />
          <InsightCard label="Driver Score" value={`${user.driverScore}/100`} />
          <InsightCard label="Monthly KM" value={`${Math.round(user.monthlyKm ?? 0)} KM`} />
          <InsightCard label="Clan" value={user.clan ?? "--"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(user.badges ?? []).map((badge) => (
            <span key={badge} className="rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-2 text-xs text-lime-200">
              {badge}
            </span>
          ))}
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

        <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={onSubmitProfile}>
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
    </section>
  );
}
