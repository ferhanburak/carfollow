import { HudStat } from "../components/ui";

function formatTripDistance(distanceKm) {
  const distance = Math.max(0, Number(distanceKm) || 0);
  return `${distance < 1 ? distance.toFixed(2) : distance.toFixed(1)} KM`;
}

function getGpsStatusView(status) {
  const views = {
    denied: { label: "IZIN REDDEDILDI", tone: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
    error: { label: "GPS HATASI", tone: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
    idle: { label: "HAZIR", tone: "border-white/10 bg-white/[0.03] text-neutral-400" },
    live: { label: "GPS CANLI", tone: "border-lime-400/30 bg-lime-400/10 text-lime-200" },
    requesting: { label: "GPS ARANIYOR", tone: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
    timeout: { label: "BEKLENIYOR", tone: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
    unavailable: { label: "GPS YOK", tone: "border-rose-400/30 bg-rose-400/10 text-rose-200" },
    weak: { label: "ZAYIF SINYAL", tone: "border-amber-400/30 bg-amber-400/10 text-amber-200" },
  };

  return views[status] ?? views.idle;
}

export function DriveScreen({
  driveHud,
  driveSessionFeedback,
  driveSessionPending,
  driveSessionStatus,
  drivers,
  isDriving,
  user,
}) {
  const gpsView = getGpsStatusView(driveHud.gpsStatus);

  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(160deg,#171717,#0b0b0b)] p-5 shadow-[inset_0_0_24px_rgba(163,230,53,0.05)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Live GPS HUD</p>
            <h3 className="mt-2 text-xl font-black">Surus Modu {isDriving ? "Aktif" : "Hazir"}</h3>
          </div>
          <div className={`h-3 w-3 rounded-full ${isDriving ? "bg-lime-400 shadow-[0_0_14px_#a3e635]" : "bg-neutral-600"}`} />
        </div>
        <div className={`mt-4 flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${gpsView.tone}`}>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] opacity-70">Gercek Konum Telemetrisi</p>
            <p className="mt-1 text-xs font-bold">{gpsView.label}</p>
          </div>
          <div className="text-right text-[11px]">
            <p>{driveHud.accuracy ? `Dogruluk ±${Math.round(driveHud.accuracy)} m` : "Konum bekleniyor"}</p>
            <p className="mt-1 opacity-70">Sahte hiz veya sabit KM artisi yok</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <HudStat label="GPS Speed" value={`${Math.round(driveHud.speed || 0)} KM/H`} accent="lime" />
          <HudStat label="Gercek Mesafe" value={formatTripDistance(driveHud.sessionKm)} accent="rose" />
          <HudStat label="Current Setup" value={`${user.tuningStage} / ${user.horsepower}HP`} accent="neutral" />
          <HudStat label="GPS" value={driveHud.etaNode} accent="lime" />
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-neutral-400">Trip Energy</span>
            <span className="font-semibold text-lime-300">{Math.min(100, driveHud.sessionKm * 6).toFixed(0)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#a3e635,#bef264,#f43f5e)] shadow-[0_0_18px_rgba(163,230,53,0.55)] transition-all duration-700"
              style={{ width: `${Math.min(100, driveHud.sessionKm * 6)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-neutral-400">
            Odometre ve bakim omru yalnizca filtrelerden gecen gercek GPS mesafesiyle guncellenir.
          </p>
        </div>

        <div className={`mt-4 rounded-2xl border p-4 text-sm ${
          driveSessionStatus === "error"
            ? "border-rose-400/20 bg-rose-400/10 text-rose-100"
            : driveSessionStatus === "active"
              ? "border-lime-400/20 bg-lime-400/10 text-lime-100"
              : "border-white/10 bg-black/20 text-neutral-300"
        }`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.22em]">Secure Drive Session</span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">
              {driveSessionPending ? "processing" : driveSessionStatus}
            </span>
          </div>
          <p className="mt-2 text-xs opacity-80">
            {driveSessionFeedback || "Surusu baslattiginda sunucu kontrollu oturum durumu burada gorunur."}
          </p>
        </div>

      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Canli Aktif Suruculer</p>
          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-lime-300">
            Canli Akis
          </span>
        </div>
        {drivers.length > 0 ? (
          <div className="mt-4 space-y-3">
            {drivers.map((driver) => (
              <div key={driver.plate} className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="font-mono text-sm tracking-[0.16em] text-lime-300">{driver.plate}</p>
                  <p className="text-xs text-neutral-500">{driver.vehicle}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{driver.speed} KM/H</p>
                  <p className="text-xs text-neutral-500">{driver.node}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-neutral-300">Su anda aktif surucu yok</p>
            <p className="mt-1 text-xs text-neutral-500">Suruse baslayan suruculer burada gorunur.</p>
          </div>
        )}
      </div>
    </section>
  );
}
