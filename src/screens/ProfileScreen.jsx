import { useEffect, useState } from "react";
import { VehiclePassportSummary } from "../components/garage/VehiclePassportSummary";
import { CompactField, InsightCard } from "../components/ui";
import { buildAchievementProgress, buildPersonalStats } from "../utils/socialStats";
import { normalizePrivacySettings } from "../utils/privacy";

export function ProfileScreen({
  accountFeedback,
  accountPending,
  isFirebaseAuth,
  onDeleteAccount,
  onExportAccount,
  onSendEmailVerification,
  onWithdrawConsent,
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
  onSavePrivacySettings,
  onSubmitProfile,
  driverStatsStatus,
}) {
  const [privacy, setPrivacy] = useState(() => normalizePrivacySettings(user.privacy));
  const [kvkkAccepted, setKvkkAccepted] = useState(Boolean(user.privacyConsent?.kvkkAcceptedAt && !user.privacyConsent?.withdrawnAt));
  const [safeZoneFeedback, setSafeZoneFeedback] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  useEffect(() => {
    setPrivacy(normalizePrivacySettings(user.privacy));
    setKvkkAccepted(Boolean(user.privacyConsent?.kvkkAcceptedAt && !user.privacyConsent?.withdrawnAt));
  }, [user.privacy, user.privacyConsent?.kvkkAcceptedAt, user.privacyConsent?.withdrawnAt]);
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

  const captureSafeZoneCenter = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setSafeZoneFeedback("Bu cihaz konum secimini desteklemiyor.");
      return;
    }
    setSafeZoneFeedback("Guvenli merkez aliniyor...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPrivacy((current) => normalizePrivacySettings({
          ...current,
          safeZoneEnabled: true,
          safeZone: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            radiusM: current.safeZone?.radiusM ?? 300,
          },
        }));
        setSafeZoneFeedback("Guvenli merkez yalnizca ozel profiline eklendi. Kaydetmeyi unutma.");
      },
      (error) => setSafeZoneFeedback(error.message || "Konum izni alinamadi."),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Gizlilik ve Konum</p>
            <p className="mt-1 text-xs text-neutral-500">Konum ve Live Map gorunurlugunu sen belirlersin.</p>
          </div>
          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-lime-300">KVKK</span>
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-lime-400/15 bg-lime-400/[0.04] px-4 py-3 text-sm">
            <span>
              <span className="block">Tam plakayla arkadas aramasi</span>
              <span className="mt-1 block text-xs text-neutral-500">Giris yapmis kullanicilar icin aktif; toplu listeleme kapali.</span>
            </span>
            <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-lime-300">Aktif</span>
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm">
            <span>Aramada arac modelimi goster</span>
            <input type="checkbox" checked={privacy.showModelInSearch} onChange={(event) => setPrivacy((current) => ({ ...current, showModelInSearch: event.target.checked }))} className="h-5 w-5 accent-lime-400" />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm">
            <span>Bolgeyi arama sonucunda goster</span>
            <input type="checkbox" checked={privacy.showRegionInSearch} onChange={(event) => setPrivacy((current) => ({ ...current, showRegionInSearch: event.target.checked }))} className="h-5 w-5 accent-lime-400" />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm">
            <span>Live Map'te tam plakami goster</span>
            <input type="checkbox" checked={privacy.showPlateOnLiveMap} onChange={(event) => setPrivacy((current) => ({ ...current, showPlateOnLiveMap: event.target.checked }))} className="h-5 w-5 accent-lime-400" />
          </label>
          <label className="block rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm">
            <span className="block">Live Map konum hassasiyeti</span>
            <select value={privacy.locationPrecision} onChange={(event) => setPrivacy((current) => ({ ...current, locationPrecision: event.target.value }))} className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm outline-none focus:border-lime-400">
              <option value="hidden">Gizle</option>
              <option value="approximate">Yaklasik konum</option>
              <option value="exact">Tam konum</option>
            </select>
          </label>
          <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 px-4 py-4">
            <label className="flex min-h-12 items-center justify-between gap-3 text-sm">
              <span>
                <span className="block font-semibold">Safe Zone</span>
                <span className="mt-1 block text-xs text-neutral-500">Bu bolgede Live Map koordinati yayinlanmaz.</span>
              </span>
              <input type="checkbox" checked={privacy.safeZoneEnabled} onChange={(event) => setPrivacy((current) => ({ ...current, safeZoneEnabled: event.target.checked }))} className="h-5 w-5 accent-lime-400" />
            </label>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button type="button" onClick={captureSafeZoneCenter} className="min-h-12 rounded-xl border border-white/10 bg-black/30 px-3 text-xs font-semibold text-neutral-200">
                {privacy.safeZone ? "Merkezi Yenile" : "Mevcut Konumu Merkez Yap"}
              </button>
              <select
                aria-label="Safe Zone Radius"
                value={privacy.safeZone?.radiusM ?? 300}
                onChange={(event) => setPrivacy((current) => ({
                  ...current,
                  safeZone: current.safeZone ? { ...current.safeZone, radiusM: Number(event.target.value) } : null,
                }))}
                className="min-h-12 rounded-xl border border-white/10 bg-[#171717] px-3 text-xs outline-none focus:border-lime-400"
              >
                <option value="200">200 m</option>
                <option value="300">300 m</option>
                <option value="500">500 m</option>
                <option value="1000">1 km</option>
              </select>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">
              {safeZoneFeedback || (privacy.safeZone ? "Guvenli merkez kayit icin hazir; koordinat ekranda gosterilmez." : "Henuz guvenli merkez secilmedi.")}
            </p>
          </div>
          <label className="flex gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs text-neutral-300">
            <input type="checkbox" checked={kvkkAccepted} onChange={(event) => setKvkkAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-lime-400" />
            <span>Plaka, profil ve konum tercihleri islendigi konusunda aydinlatma metnini okudum; bu tercihleri istegimle kaydediyorum.</span>
          </label>
          <button type="button" onClick={() => onSavePrivacySettings?.(privacy, kvkkAccepted)} className="min-h-12 w-full rounded-2xl border border-lime-400/30 bg-lime-400/10 font-semibold text-lime-100">
            Gizlilik Tercihlerini Kaydet
          </button>
        </div>
      </div>

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

        <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${
          driverStatsStatus?.state === "error" || driverStatsStatus?.state === "degraded"
            ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
            : "border-lime-400/20 bg-lime-400/10 text-lime-100"
        }`}>
          <div className="flex items-center justify-between gap-3">
            <span>Achievement source</span>
            <span className="font-semibold uppercase tracking-[0.16em]">
              {driverStatsStatus?.mode === "firebase" ? driverStatsStatus.state : "demo"}
            </span>
          </div>
          {driverStatsStatus?.error ? <p className="mt-2 text-amber-200">{driverStatsStatus.error}</p> : null}
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

      {isFirebaseAuth ? (
        <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
          <p className="text-sm font-semibold text-neutral-100">Hesap ve Veri Kontrolleri</p>
          <p className="mt-1 text-xs text-neutral-500">Dogrulama, veri tasinabilirligi ve KVKK tercihlerini buradan yonet.</p>
          {accountFeedback ? (
            <div className="mt-4 rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">
              {accountFeedback}
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" disabled={accountPending || user.emailVerified} onClick={onSendEmailVerification} className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-neutral-200 disabled:opacity-50">
              {user.emailVerified ? "E-posta Dogrulandi" : "Dogrulama E-postasi Gonder"}
            </button>
            <button type="button" disabled={accountPending} onClick={onExportAccount} className="min-h-12 rounded-2xl border border-lime-400/25 bg-lime-400/10 px-3 text-xs font-semibold text-lime-100 disabled:opacity-50">
              Verilerimi JSON Olarak Indir
            </button>
            <button type="button" disabled={accountPending} onClick={onWithdrawConsent} className="min-h-12 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 text-xs font-semibold text-amber-100 disabled:opacity-50 sm:col-span-2">
              KVKK Onayini Geri Cek ve Paylasimi Kapat
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-4">
            <p className="text-xs font-semibold text-rose-100">Hesabi kalici olarak sil</p>
            <p className="mt-1 text-[11px] text-neutral-500">Once aktif konvoylarini kapat ve klan sahipligini devret. Sonra asagidaki ifadeyi aynen yaz.</p>
            <p className="mt-2 font-mono text-[11px] text-rose-200">DELETE MY CRUISER ACCOUNT</p>
            <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-3 h-12 w-full rounded-xl border border-rose-400/20 bg-black/30 px-3 text-sm outline-none focus:border-rose-400" />
            <button type="button" disabled={accountPending || deleteConfirmation !== "DELETE MY CRUISER ACCOUNT"} onClick={() => onDeleteAccount?.(deleteConfirmation)} className="mt-3 min-h-12 w-full rounded-xl bg-rose-500 px-4 text-xs font-black text-white disabled:opacity-40">
              Hesabimi ve Kisisel Verilerimi Sil
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-rose-400/15 bg-rose-500/5 p-4">
        <p className="text-sm font-semibold text-neutral-100">Account Session</p>
        <p className="mt-1 text-xs text-neutral-500">Bu cihazdaki CRUISER oturumunu guvenli sekilde kapat.</p>
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
