import { useEffect, useState } from "react";
import { CompactField } from "./ui";
import { normalizePrivacySettings } from "../utils/privacy";
import { useLanguage } from "../providers/LanguageProvider";

const getSections = (t) => [
  { key: "appearance", code: "01", title: t('settings.appearance'), description: t('settings.appearanceDescription') },
  { key: "language", code: "02", title: t('settings.language'), description: t('settings.languageDescription') },
  { key: "privacy", code: "03", title: t('settings.privacy'), description: t('settings.privacyDescription') },
  { key: "blocked", code: "04", title: t('settings.blocked'), description: t('settings.blockedDescription') },
  { key: "vehicle", code: "05", title: t('settings.vehicle'), description: t('settings.vehicleDescription') },
  { key: "account", code: "06", title: t('settings.account'), description: t('settings.accountDescription') },
  { key: "security", code: "07", title: t('settings.security'), description: t('settings.securityDescription') },
];

export function SettingsButton({ onClick, tone = "default" }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('settings.title')}
      title={t('settings.title')}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-neutral-200 transition hover:border-lime-400/40 hover:text-lime-300 ${
        tone === "map" ? "border-white/10 bg-black/75 backdrop-blur" : "border-white/10 bg-black/30"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3v-4h.09A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3h4v.09A1.7 1.7 0 0 0 15.04 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
      </svg>
    </button>
  );
}

function SettingsHome({ isFirebaseAuth, onRequestLogout, onSelect, themeMode, user }) {
  const { language, t } = useLanguage();
  const sections = getSections(t);
  const values = {
    appearance: themeMode === "system" ? t('settings.systemTheme') : themeMode === "dark" ? t('settings.darkTheme') : t('settings.lightTheme'),
    language: language === 'tr' ? t('language.turkish') : t('language.english'),
    privacy: user.privacy?.safeZoneEnabled ? "Safe Zone açık" : "Standart",
    blocked: `${user.blockedDrivers?.length ?? 0} sürücü`,
    vehicle: user.model,
    account: isFirebaseAuth ? (user.emailVerified ? "Doğrulandı" : "Doğrulama gerekli") : "Demo hesap",
    security: isFirebaseAuth ? user.email : "Demo hesap",
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[1.5rem] border border-lime-400/15 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.12),transparent_46%),#101010] p-4">
        <p className="text-sm font-bold text-neutral-100">{user.fullName}</p>
        <p className="mt-1 font-mono text-xs tracking-[0.16em] text-neutral-500">{user.plate}</p>
      </div>
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className="group flex min-h-[5.75rem] w-full items-center gap-3 rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-3 py-3 text-left transition hover:border-lime-400/25 hover:bg-lime-400/[0.05]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-400/15 bg-lime-400/[0.07] font-mono text-xs tracking-[0.16em] text-lime-300">{section.code}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-neutral-100">{section.title}</span>
            <span className="mt-1 block text-xs leading-4 text-neutral-500">{section.description}</span>
            <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.14em] text-lime-400/70">{values[section.key]}</span>
          </span>
          <span className="text-lg text-neutral-600 transition group-hover:translate-x-1 group-hover:text-lime-300">&rsaquo;</span>
        </button>
      ))}
      <div className="border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onRequestLogout}
          className="min-h-12 w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 font-bold text-rose-200 transition hover:bg-rose-500/20"
        >
          {t('settings.logout')}
        </button>
        <p className="mt-2 text-center text-[11px] leading-4 text-neutral-600">{t('settings.logoutHint')}</p>
      </div>
    </div>
  );
}

function AppearanceSettings({ onThemeModeChange, themeMode }) {
  const { t } = useLanguage();
  const options = [
    { value: "system", title: t('settings.system'), description: t('settings.systemDescription'), icon: "◐" },
    { value: "light", title: t('settings.light'), description: t('settings.lightDescription'), icon: "☀" },
    { value: "dark", title: t('settings.dark'), description: t('settings.darkDescription'), icon: "☾" },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-[1.4rem] border border-lime-400/20 bg-lime-400/[0.07] p-4">
        <p className="text-sm font-bold">{t('settings.appTheme')}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{t('settings.themeDescription')}</p>
      </div>
      {options.map((option) => {
        const selected = themeMode === option.value;
        return (
          <button
            aria-checked={selected}
            className={`flex min-h-[4.75rem] w-full items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition ${selected ? "border-lime-400/45 bg-lime-400/10" : "border-white/10 bg-white/[0.03]"}`}
            key={option.value}
            onClick={() => onThemeModeChange(option.value)}
            role="radio"
            type="button"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${selected ? "bg-lime-400 text-black" : "bg-white/5 text-neutral-400"}`}>{option.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{option.title}</span>
              <span className="mt-1 block text-xs leading-4 text-neutral-500">{option.description}</span>
            </span>
            <span className={`h-5 w-5 rounded-full border-2 ${selected ? "border-lime-400 bg-lime-400 shadow-[inset_0_0_0_4px_#111]" : "border-neutral-600"}`} />
          </button>
        );
      })}
    </div>
  );
}

function LanguageSettings() {
  const { language, setLanguage, t } = useLanguage();
  const options = [
    { value: 'tr', code: 'TR', title: t('language.turkish'), description: t('language.turkishDescription') },
    { value: 'en', code: 'EN', title: t('language.english'), description: t('language.englishDescription') },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-[1.4rem] border border-lime-400/20 bg-lime-400/[0.07] p-4">
        <p className="text-sm font-bold">{t('language.title')}</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{t('language.description')}</p>
      </div>
      {options.map((option) => {
        const selected = language === option.value;
        return (
          <button
            aria-checked={selected}
            className={`flex min-h-[4.75rem] w-full items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition ${selected ? "border-lime-400/45 bg-lime-400/10" : "border-white/10 bg-white/[0.03]"}`}
            key={option.value}
            onClick={() => setLanguage(option.value)}
            role="radio"
            type="button"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-mono text-xs font-black tracking-[0.12em] ${selected ? "bg-lime-400 text-black" : "bg-white/5 text-neutral-400"}`}>{option.code}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{option.title}</span>
              <span className="mt-1 block text-xs leading-4 text-neutral-500">{option.description}</span>
            </span>
            <span className={`h-5 w-5 rounded-full border-2 ${selected ? "border-lime-400 bg-lime-400 shadow-[inset_0_0_0_4px_#111]" : "border-neutral-600"}`} />
          </button>
        );
      })}
    </div>
  );
}

function PrivacySettings({ onSavePrivacySettings, socialFeedback, user }) {
  const [privacy, setPrivacy] = useState(() => normalizePrivacySettings(user.privacy));
  const [kvkkAccepted, setKvkkAccepted] = useState(Boolean(user.privacyConsent?.kvkkAcceptedAt && !user.privacyConsent?.withdrawnAt));
  const [safeZoneFeedback, setSafeZoneFeedback] = useState("");

  useEffect(() => {
    setPrivacy(normalizePrivacySettings(user.privacy));
    setKvkkAccepted(Boolean(user.privacyConsent?.kvkkAcceptedAt && !user.privacyConsent?.withdrawnAt));
  }, [user.privacy, user.privacyConsent?.kvkkAcceptedAt, user.privacyConsent?.withdrawnAt]);

  const captureSafeZoneCenter = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setSafeZoneFeedback("Bu cihaz konum secimini desteklemiyor.");
      return;
    }
    setSafeZoneFeedback("Güvenli merkez aliniyor...");
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
        setSafeZoneFeedback("Güvenli merkez özel profiline eklendi. Kaydetmeyi unutma.");
      },
      (error) => setSafeZoneFeedback(error.message || "Konum izni alınamadı."),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-3">
      {socialFeedback ? <p className="rounded-2xl border border-lime-400/15 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{socialFeedback}</p> : null}
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-lime-400/15 bg-lime-400/[0.04] px-4 py-3 text-sm">
        <span>
          <span className="block">Tam plakayla arkadaş aramasi</span>
          <span className="mt-1 block text-xs text-neutral-500">Giriş yapmış kullanıcılar için aktif; toplu listeleme kapalı.</span>
        </span>
        <span className="rounded-full bg-lime-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-lime-300">Aktif</span>
      </div>
      <SettingToggle label="Aramada araç modelimi göster" checked={privacy.showModelInSearch} onChange={(checked) => setPrivacy((current) => ({ ...current, showModelInSearch: checked }))} />
      <SettingToggle label="Bolgeyi arama sonucunda göster" checked={privacy.showRegionInSearch} onChange={(checked) => setPrivacy((current) => ({ ...current, showRegionInSearch: checked }))} />
      <SettingToggle label="Live Map'te tam plakami göster" checked={privacy.showPlateOnLiveMap} onChange={(checked) => setPrivacy((current) => ({ ...current, showPlateOnLiveMap: checked }))} />
      <label className="block rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm">
        <span className="block">Live Map konum hassasiyeti</span>
        <select value={privacy.locationPrecision} onChange={(event) => setPrivacy((current) => ({ ...current, locationPrecision: event.target.value }))} className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm outline-none focus:border-lime-400">
          <option value="hidden">Gizle</option>
          <option value="approximate">Yaklasik konum</option>
          <option value="exact">Tam konum</option>
        </select>
      </label>
      <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 px-4 py-4">
        <SettingToggle
          label="Safe Zone"
          description="Bu bolgede Live Map koordinati yayinlanmaz."
          checked={privacy.safeZoneEnabled}
          onChange={(checked) => setPrivacy((current) => ({ ...current, safeZoneEnabled: checked }))}
          plain
        />
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
        <p className="mt-2 text-[11px] text-neutral-500">{safeZoneFeedback || (privacy.safeZone ? "Güvenli merkez kayıt için hazır; koordinat ekranda gosterilmez." : "Henüz güvenli merkez seçilmedi.")}</p>
      </div>
      <label className="flex gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs text-neutral-300">
        <input type="checkbox" checked={kvkkAccepted} onChange={(event) => setKvkkAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-lime-400" />
        <span>Plaka, profil ve konum tercihlerimin islenmesine iliskin aydinlatma metnini okudum.</span>
      </label>
      <button type="button" onClick={() => onSavePrivacySettings?.(privacy, kvkkAccepted)} className="min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black">Gizlilik Tercihlerini Kaydet</button>
    </div>
  );
}

function SettingToggle({ checked, description, label, onChange, plain = false }) {
  return (
    <label className={`flex min-h-12 items-center justify-between gap-3 text-sm ${plain ? "" : "rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"}`}>
      <span>
        <span className="block">{label}</span>
        {description ? <span className="mt-1 block text-xs text-neutral-500">{description}</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-lime-400" />
    </label>
  );
}

function BlockedSettings({ onUnblockDriver, socialFeedback, socialPendingKey, user }) {
  return (
    <div className="space-y-3">
      {socialFeedback ? <p className="rounded-2xl border border-lime-400/15 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{socialFeedback}</p> : null}
      {(user.blockedDrivers ?? []).length ? user.blockedDrivers.map((entry) => (
        <div key={entry.userId ?? entry.plate} className="flex min-h-[5.5rem] items-center justify-between gap-3 rounded-[1.35rem] border border-rose-400/10 bg-rose-500/[0.04] p-4">
          <div className="min-w-0">
            <p className="font-mono text-sm tracking-[0.14em] text-rose-200">{entry.plate}</p>
            <p className="mt-1 truncate text-sm font-semibold">{entry.fullName}</p>
            <p className="truncate text-xs text-neutral-500">{entry.model}</p>
          </div>
          <button type="button" disabled={Boolean(socialPendingKey?.endsWith(`:${entry.userId}`))} onClick={() => onUnblockDriver(entry)} className="min-h-12 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-neutral-200 disabled:opacity-50">Engeli Kaldır</button>
        </div>
      )) : (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 px-4 py-12 text-center">
          <p className="text-sm font-bold text-neutral-300">Engellenen sürücü yok</p>
          <p className="mt-2 text-xs text-neutral-500">Engellediğin kullanıcılar burada görünecek.</p>
        </div>
      )}
    </div>
  );
}

function VehicleSettings({ onProfileAvatarFileChange, onProfileFormChange, onSubmitProfile, profileErrors, profileFeedback, profileForm, profilePending, tuningOptions }) {
  return (
    <div>
      {profileFeedback ? <p className="mb-4 rounded-2xl border border-lime-400/15 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{profileFeedback}</p> : null}
      <form className="grid grid-cols-1 gap-3" onSubmit={onSubmitProfile}>
        <ProfileInput label="Full Name" value={profileForm.fullName} error={profileErrors.fullName} onChange={(value) => onProfileFormChange((current) => ({ ...current, fullName: value }))} />
        <ProfileInput label="Region" value={profileForm.region} error={profileErrors.region} onChange={(value) => onProfileFormChange((current) => ({ ...current, region: value }))} />
        <ProfileInput label="Vehicle Model" value={profileForm.model} error={profileErrors.model} onChange={(value) => onProfileFormChange((current) => ({ ...current, model: value }))} />
        <ProfileInput label="Horsepower" type="number" value={profileForm.horsepower} error={profileErrors.horsepower} onChange={(value) => onProfileFormChange((current) => ({ ...current, horsepower: value }))} />
        <CompactField label="Tuning Stage">
          <select value={profileForm.tuningStage} onChange={(event) => onProfileFormChange((current) => ({ ...current, tuningStage: event.target.value }))} className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400">
            {tuningOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </CompactField>
        <ProfileInput label="Garage / Shop" value={profileForm.garage} error={profileErrors.garage} onChange={(value) => onProfileFormChange((current) => ({ ...current, garage: value }))} />
        <ProfileInput label="Mevcut KM" type="number" value={profileForm.odometer} error={profileErrors.odometer} onChange={(value) => onProfileFormChange((current) => ({ ...current, odometer: value }))} />
        <CompactField label="Profil Fotoğrafı">
          <input aria-label="Profil Fotoğrafı" type="file" accept="image/*" onChange={(event) => onProfileAvatarFileChange?.(event.target.files?.[0] ?? null)} className="block min-h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-3 py-2 text-sm text-neutral-300 file:mr-3 file:rounded-xl file:border-0 file:bg-lime-400 file:px-3 file:py-2 file:font-semibold file:text-black" />
          {profileErrors.avatar ? <p className="text-xs text-rose-300">{profileErrors.avatar}</p> : null}
          {profileForm.avatarPreview ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <img src={profileForm.avatarPreview} alt="Profil fotoğrafı önizleme" className="h-16 w-16 rounded-2xl object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profileForm.avatarFileName || "Mevcut profil fotoğrafı"}</p>
                <p className="mt-1 text-xs text-neutral-500">Cihazdan JPG, PNG veya WebP / en fazla 5 MB</p>
              </div>
            </div>
          ) : null}
        </CompactField>
        <p className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-100">Kilometre artırılabilir. Eski 12.000 KM varsayimina sahip hesaplar kilometreyi bir kez aşağı yönlü düzeltebilir.</p>
        <button type="submit" disabled={profilePending} className="min-h-12 rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_20px_rgba(163,230,53,0.3)] disabled:cursor-wait disabled:opacity-50">{profilePending ? "Güncelleniyor..." : "Profili Güncelle"}</button>
      </form>
    </div>
  );
}

function ProfileInput({ error, label, onChange, type = "text", value }) {
  return (
    <CompactField label={label}>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400" />
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </CompactField>
  );
}

function AccountSettings({ accountFeedback, accountPending, isFirebaseAuth, onDeleteAccount, onExportAccount, onSendEmailVerification, onWithdrawConsent, user }) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  if (!isFirebaseAuth) return <DemoAccountNotice />;

  return (
    <div className="space-y-3">
      {accountFeedback ? <p className="rounded-2xl border border-lime-400/15 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{accountFeedback}</p> : null}
      <button type="button" disabled={accountPending || user.emailVerified} onClick={onSendEmailVerification} className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold disabled:opacity-50">{user.emailVerified ? "E-posta Doğrulandı" : "Doğrulama E-postasi Gönder"}</button>
      <button type="button" disabled={accountPending} onClick={onExportAccount} className="min-h-12 w-full rounded-2xl border border-lime-400/25 bg-lime-400/10 px-4 text-sm font-semibold text-lime-100 disabled:opacity-50">Verilerimi JSON Olarak Indir</button>
      <button type="button" disabled={accountPending} onClick={onWithdrawConsent} className="min-h-12 w-full rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100 disabled:opacity-50">KVKK Onayini Geri Çek ve Paylaşımı Kapat</button>
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-4">
        <p className="text-sm font-semibold text-rose-100">Hesabı kalıcı olarak sil</p>
        <p className="mt-2 text-xs leading-5 text-neutral-500">Aktif konvoylarini kapat ve klan sahipligini devret. Ardindan asagidaki ifadeyi aynen yaz.</p>
        <p className="mt-3 font-mono text-[11px] text-rose-200">DELETE MY CRUISER ACCOUNT</p>
        <input aria-label="Hesap silme onayi" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-3 h-12 w-full rounded-xl border border-rose-400/20 bg-black/30 px-3 text-sm outline-none focus:border-rose-400" />
        <button type="button" disabled={accountPending || deleteConfirmation !== "DELETE MY CRUISER ACCOUNT"} onClick={() => onDeleteAccount?.(deleteConfirmation)} className="mt-3 min-h-12 w-full rounded-xl bg-rose-500 px-4 text-xs font-black text-white disabled:opacity-40">Hesabımı ve Kişisel Verilerimi Sil</button>
      </div>
    </div>
  );
}

function SecuritySettings({ accountFeedback, accountPending, isFirebaseAuth, onSendPasswordReset, user }) {
  if (!isFirebaseAuth) return <DemoAccountNotice />;
  return (
    <div className="space-y-4">
      {accountFeedback ? <p className="rounded-2xl border border-lime-400/15 bg-lime-400/10 px-4 py-3 text-xs text-lime-100">{accountFeedback}</p> : null}
      <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Hesap E-postasi</p>
        <p className="mt-2 break-all text-sm font-semibold text-neutral-100">{user.email}</p>
        <p className="mt-2 text-xs leading-5 text-neutral-500">Şifre değiştirme bağlantısı yalnızca doğrulanmış hesap e-postana gönderilir.</p>
      </div>
      <button type="button" disabled={accountPending} onClick={onSendPasswordReset} className="min-h-12 w-full rounded-2xl bg-lime-400 px-4 text-sm font-bold text-black disabled:opacity-50">Şifre Değiştirme Bağlantısı Gönder</button>
      <p className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-xs leading-5 text-neutral-500">E-postadaki bağlantı tek kullanımlıktır. CRUISER mevcut şifreni uygulama içinde saklamaz.</p>
    </div>
  );
}

function DemoAccountNotice() {
  return <div className="rounded-[1.5rem] border border-amber-400/15 bg-amber-400/10 px-4 py-8 text-center text-sm text-amber-100">Bu işlem güvenli hesapla giriş yapıldığında kullanılabilir.</div>;
}

export function SettingsCenter({
  accountFeedback,
  accountPending,
  isFirebaseAuth,
  isOpen,
  onClose,
  onDeleteAccount,
  onExportAccount,
  onProfileAvatarFileChange,
  onProfileFormChange,
  onRequestLogout,
  onThemeModeChange,
  onSavePrivacySettings,
  onSelectSection,
  onSendEmailVerification,
  onSendPasswordReset,
  onSubmitProfile,
  onUnblockDriver,
  onWithdrawConsent,
  profileErrors,
  profileFeedback,
  profileForm,
  profilePending,
  section,
  socialFeedback,
  socialPendingKey,
  themeMode,
  tuningOptions,
  user,
}) {
  const { t } = useLanguage();
  if (!isOpen) return null;
  const activeSection = getSections(t).find((entry) => entry.key === section) ?? null;

  return (
    <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-md md:p-4" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <section className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-white/10 bg-[#090909] shadow-[0_24px_90px_rgba(0,0,0,0.85)] md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:border">
        <header className="app-safe-top shrink-0 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.14),transparent_42%),#111111] px-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {activeSection ? (
                <button type="button" onClick={() => onSelectSection(null)} aria-label={t('settings.back')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-lg">&larr;</button>
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10 font-mono text-xs text-lime-300">SYS</span>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black">{activeSection?.title ?? t('settings.title')}</h2>
                <p className="truncate text-xs text-neutral-500">{activeSection?.description ?? t('settings.subtitle')}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label={t('settings.close')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xl text-neutral-300">&times;</button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!activeSection ? <SettingsHome isFirebaseAuth={isFirebaseAuth} onRequestLogout={onRequestLogout} onSelect={onSelectSection} themeMode={themeMode} user={user} /> : null}
          {section === "appearance" ? <AppearanceSettings onThemeModeChange={onThemeModeChange} themeMode={themeMode} /> : null}
          {section === "language" ? <LanguageSettings /> : null}
          {section === "privacy" ? <PrivacySettings onSavePrivacySettings={onSavePrivacySettings} socialFeedback={socialFeedback} user={user} /> : null}
          {section === "blocked" ? <BlockedSettings onUnblockDriver={onUnblockDriver} socialFeedback={socialFeedback} socialPendingKey={socialPendingKey} user={user} /> : null}
          {section === "vehicle" ? <VehicleSettings onProfileAvatarFileChange={onProfileAvatarFileChange} onProfileFormChange={onProfileFormChange} onSubmitProfile={onSubmitProfile} profileErrors={profileErrors} profileFeedback={profileFeedback} profileForm={profileForm} profilePending={profilePending} tuningOptions={tuningOptions} /> : null}
          {section === "account" ? <AccountSettings accountFeedback={accountFeedback} accountPending={accountPending} isFirebaseAuth={isFirebaseAuth} onDeleteAccount={onDeleteAccount} onExportAccount={onExportAccount} onSendEmailVerification={onSendEmailVerification} onWithdrawConsent={onWithdrawConsent} user={user} /> : null}
          {section === "security" ? <SecuritySettings accountFeedback={accountFeedback} accountPending={accountPending} isFirebaseAuth={isFirebaseAuth} onSendPasswordReset={onSendPasswordReset} user={user} /> : null}
        </div>
      </section>
    </div>
  );
}
