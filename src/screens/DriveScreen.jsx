import { useReverseGeocodedLocation } from "../hooks/useReverseGeocodedLocation";

function formatTripDistance(distanceKm) {
  const distance = Math.max(0, Number(distanceKm) || 0);
  return `${distance < 1 ? distance.toFixed(2) : distance.toFixed(1)} KM`;
}

function formatDriveDuration(seconds) {
  const totalMinutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}S ${minutes}DK` : `${minutes} DK`;
}

function getGpsStatusLabel(status) {
  const labels = {
    denied: "IZIN REDDEDILDI",
    error: "GPS HATASI",
    idle: "GPS HAZIR",
    live: "GPS CANLI",
    requesting: "GPS ARANIYOR",
    timeout: "GPS BEKLENIYOR",
    unavailable: "GPS YOK",
    weak: "ZAYIF SINYAL",
  };

  return labels[status] ?? labels.idle;
}

function CompactMetric({ label, value, accent = false }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/8 bg-black/20 px-2 py-2 text-center">
      <p className="truncate text-[8px] uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-black ${accent ? "text-lime-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

export function DriveScreen({
  driveHud,
  drivers,
  isDriving,
}) {
  const resolvedLocation = useReverseGeocodedLocation(driveHud.location, isDriving);
  const locationLabel = resolvedLocation.label || (
    isDriving ? "Konum bekleniyor" : "Surusu baslat"
  );
  const accuracy = Number(driveHud.accuracy);

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.12),transparent_34%),linear-gradient(160deg,#171717,#090909)] p-3 shadow-[inset_0_0_24px_rgba(163,230,53,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-black uppercase tracking-tight">
              {isDriving ? "Surus Modu Aktif" : "Suruse Hazir"}
            </h3>
            <p className="mt-1 truncate text-[10px] text-neutral-400">
              <span className="font-semibold text-lime-300">{getGpsStatusLabel(driveHud.gpsStatus)}</span>
              <span className="mx-1.5 text-neutral-700">/</span>
              {locationLabel}
            </p>
          </div>
          <div className={`h-3 w-3 shrink-0 rounded-full ${isDriving ? "bg-lime-400 shadow-[0_0_14px_#a3e635]" : "bg-neutral-600"}`} />
        </div>

        <div className="py-4 text-center">
          <div className="flex items-end justify-center gap-2">
            <strong className="text-5xl font-black tabular-nums leading-none text-lime-300">
              {Math.round(driveHud.speed || 0)}
            </strong>
            <span className="pb-1 text-sm font-bold uppercase tracking-[0.16em] text-neutral-400">KM/H</span>
          </div>
          <p className="mt-1.5 text-[9px] uppercase tracking-[0.16em] text-neutral-500">
            Max {Math.round(driveHud.maxSpeedKmh || 0)} KM/H
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <CompactMetric label="Mesafe" value={formatTripDistance(driveHud.sessionKm)} accent />
          <CompactMetric label="Surus" value={formatDriveDuration(driveHud.movingSeconds)} />
          <CompactMetric
            label="GPS"
            value={Number.isFinite(accuracy) && accuracy > 0 ? `+/-${Math.round(accuracy)} M` : "--"}
          />
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-[#111111] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Canli Aktif Suruculer</p>
          <span className="text-[10px] uppercase tracking-[0.16em] text-lime-300">Canli</span>
        </div>
        {drivers.length > 0 ? (
          <div className="mt-3 space-y-2">
            {drivers.map((driver) => (
              <div key={driver.plate} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
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
