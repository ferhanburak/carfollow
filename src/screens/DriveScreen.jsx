import { HudStat } from "../components/ui";

function formatSyncTime(timestamp) {
  if (!timestamp) {
    return "waiting";
  }

  return new Date(timestamp).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getConnectionTone(connection) {
  if (connection === "online") {
    return "text-lime-300";
  }

  if (connection === "degraded" || connection === "partial" || connection === "configured") {
    return "text-amber-300";
  }

  if (connection === "disabled") {
    return "text-neutral-400";
  }

  return "text-rose-300";
}

export function DriveScreen({
  driveHud,
  driveSessionFeedback,
  driveSessionPending,
  driveSessionStatus,
  drivers,
  firebaseStatus,
  isDriving,
  user,
}) {
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
        <div className="mt-5 grid grid-cols-2 gap-3">
          <HudStat label="Speed" value={`${driveHud.speed || 0} KM/H`} accent="lime" />
          <HudStat label="Kat Edilen Mesafe" value={`${driveHud.sessionKm.toFixed(1)} KM`} accent="rose" />
          <HudStat label="Current Setup" value={`${user.tuningStage} / ${user.horsepower}HP`} accent="neutral" />
          <HudStat label="Node" value={driveHud.etaNode} accent="lime" />
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
            Surus aktifken kilometre sayaci ve bakim bilesen omru es zamanli guncellenir.
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

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-neutral-400">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.22em] text-neutral-500">Telemetry Sync</span>
            <span className={firebaseStatus.telemetry === "error" ? "text-rose-300" : "text-lime-300"}>
              {firebaseStatus.telemetry}
            </span>
          </div>
          <p className={`mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${getConnectionTone(firebaseStatus.connection)}`}>
            Connection: {firebaseStatus.connection}
          </p>
          <p className="mt-2 font-mono text-[11px] text-lime-300">
            UID: {firebaseStatus.authUid ?? "authenticated session pending"}
          </p>
          <p className="mt-1">Last RTDB push: {formatSyncTime(firebaseStatus.lastTelemetrySyncAt)}</p>
          {firebaseStatus.error ? <p className="mt-2 text-rose-300">{firebaseStatus.error}</p> : null}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <p className="text-sm font-semibold">Canli Aktif Suruculer</p>
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
      </div>
    </section>
  );
}
