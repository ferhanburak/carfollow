import { getPartHealthSnapshot } from "../../utils/vehiclePassport";
import { getVehicleDiagramSlots } from "../../utils/vehicleParts";

function getPartTone(status) {
  if (status === "critical") {
    return "fill-rose-500 stroke-rose-200";
  }
  if (status === "warning") {
    return "fill-amber-400 stroke-amber-100";
  }
  return "fill-lime-400 stroke-lime-100";
}

function getPanelTone(status, active) {
  const activeRing = active ? "ring-2 ring-lime-400/60" : "";
  if (status === "critical") {
    return `border-rose-500/30 bg-rose-500/10 ${activeRing}`;
  }
  if (status === "warning") {
    return `border-amber-400/30 bg-amber-400/10 ${activeRing}`;
  }
  return `border-lime-400/20 bg-lime-400/10 ${activeRing}`;
}

function CarSilhouette() {
  return (
    <>
      <rect x="28" y="18" width="44" height="64" rx="18" fill="#111111" stroke="rgba(255,255,255,0.14)" />
      <rect x="35" y="28" width="30" height="20" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
      <rect x="38" y="52" width="24" height="14" rx="6" fill="rgba(255,255,255,0.03)" />
      <rect x="10" y="20" width="12" height="18" rx="5" fill="#0d0d0d" stroke="rgba(255,255,255,0.12)" />
      <rect x="10" y="64" width="12" height="18" rx="5" fill="#0d0d0d" stroke="rgba(255,255,255,0.12)" />
      <rect x="78" y="20" width="12" height="18" rx="5" fill="#0d0d0d" stroke="rgba(255,255,255,0.12)" />
      <rect x="78" y="64" width="12" height="18" rx="5" fill="#0d0d0d" stroke="rgba(255,255,255,0.12)" />
    </>
  );
}

function MotorcycleSilhouette() {
  return (
    <>
      <circle cx="18" cy="37" r="12" fill="#0d0d0d" stroke="rgba(255,255,255,0.18)" />
      <circle cx="82" cy="67" r="13" fill="#0d0d0d" stroke="rgba(255,255,255,0.18)" />
      <path d="M24 37 L38 42 L50 38 L62 43 L72 56 L62 67 L49 58 L34 55 Z" fill="#111111" stroke="rgba(255,255,255,0.14)" />
      <path d="M42 33 L55 29 L63 35" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 38 L40 56" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" strokeLinecap="round" />
      <path d="M62 43 L70 33" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

export function VehicleHealthDiagram({
  compact = false,
  odometer,
  onOpen,
  parts,
  selectedPartKey,
  onSelectPart,
  vehicleType,
}) {
  const slots = getVehicleDiagramSlots(vehicleType);
  const selectedPart = parts.find((part) => part.key === selectedPartKey) ?? parts[0] ?? null;
  const selectedSnapshot = selectedPart ? getPartHealthSnapshot(selectedPart, odometer) : null;
  const statusCounts = parts.reduce((counts, part) => {
    const status = getPartHealthSnapshot(part, odometer).status;
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, { healthy: 0, warning: 0, critical: 0 });

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Arac parca sagligi detaylarini ac"
        className="mt-4 w-full rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(163,230,53,0.1),transparent_44%),linear-gradient(180deg,#121212,#0c0c0c)] p-4 text-left transition hover:border-lime-400/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-lime-400">Interactive Vehicle Map</p>
            <p className="mt-1 text-sm font-semibold text-neutral-200">Parca durumuna dokunarak bak</p>
          </div>
          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-lime-300">Detay</span>
        </div>

        <div className="mt-3 rounded-[1.35rem] border border-white/8 bg-black/20 px-5 py-2">
          <svg viewBox="0 0 100 100" className="h-36 w-full pointer-events-none">
            {vehicleType === "motorcycle" ? <MotorcycleSilhouette /> : <CarSilhouette />}
            {parts.map((part) => {
              const slot = slots[part.key];
              if (!slot) return null;
              const snapshot = getPartHealthSnapshot(part, odometer);
              return (
                <g key={part.key}>
                  <circle cx={slot.x} cy={slot.y} r="4.6" className={`${getPartTone(snapshot.status)} stroke-[1.5]`} />
                  <circle cx={slot.x} cy={slot.y} r="7.4" fill="none" stroke={snapshot.status === "critical" ? "rgba(244,63,94,0.28)" : snapshot.status === "warning" ? "rgba(251,191,36,0.24)" : "rgba(163,230,53,0.22)"} strokeWidth="1" />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-lime-400/10 px-2 py-2 text-xs text-lime-200">{statusCounts.healthy} iyi</div>
          <div className="rounded-xl bg-amber-400/10 px-2 py-2 text-xs text-amber-200">{statusCounts.warning} yaklasan</div>
          <div className="rounded-xl bg-rose-500/10 px-2 py-2 text-xs text-rose-200">{statusCounts.critical} kritik</div>
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(163,230,53,0.08),transparent_40%),linear-gradient(180deg,#121212,#0c0c0c)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-lime-400">Interactive Vehicle Map</p>
          <p className="mt-1 text-sm text-neutral-400">Parcaya dokun, durumunu model ustunde izle.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-neutral-400">
          {vehicleType === "motorcycle" ? "Moto Layout" : "Car Layout"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-[1.35rem] border border-white/8 bg-black/20 p-3">
          <svg viewBox="0 0 100 100" className="h-[17rem] w-full">
            {vehicleType === "motorcycle" ? <MotorcycleSilhouette /> : <CarSilhouette />}
            {parts.map((part) => {
              const slot = slots[part.key];
              if (!slot) {
                return null;
              }
              const snapshot = getPartHealthSnapshot(part, odometer);
              const isActive = selectedPartKey === part.key;
              return (
                <g key={part.key}>
                  <circle
                    cx={slot.x}
                    cy={slot.y}
                    r={isActive ? 5.4 : 4.4}
                    className={`${getPartTone(snapshot.status)} cursor-pointer stroke-[1.5] transition-all`}
                    onClick={() => onSelectPart(part.key)}
                  />
                  <circle
                    cx={slot.x}
                    cy={slot.y}
                    r={isActive ? 9 : 7}
                    fill="none"
                    stroke={snapshot.status === "critical" ? "rgba(244,63,94,0.28)" : snapshot.status === "warning" ? "rgba(251,191,36,0.24)" : "rgba(163,230,53,0.22)"}
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          <div className={`rounded-[1.35rem] border p-4 ${selectedSnapshot ? getPanelTone(selectedSnapshot.status, true) : "border-white/10 bg-black/20"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-100">{selectedPart?.name ?? "No part selected"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400">{selectedPart?.zone ?? "zone"}</p>
              </div>
              <p className="text-lg font-black text-white">%{selectedSnapshot?.health ?? 0}</p>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-black/30">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  selectedSnapshot?.status === "critical"
                    ? "bg-rose-500"
                    : selectedSnapshot?.status === "warning"
                      ? "bg-amber-400"
                      : "bg-lime-400"
                }`}
                style={{ width: `${selectedSnapshot?.health ?? 0}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-300">
              <div className="rounded-xl bg-black/20 px-3 py-2">Kalan KM: {selectedSnapshot?.kmRemaining?.toLocaleString("tr-TR") ?? "--"}</div>
              <div className="rounded-xl bg-black/20 px-3 py-2">Kalan Gun: {selectedSnapshot?.daysRemaining ?? "--"}</div>
            </div>
            <div className="mt-3 text-xs text-neutral-400">
              Son degisim: {selectedPart?.replacedAt ?? "--"} @ {Number(selectedPart?.replacedKm ?? 0).toLocaleString("tr-TR")} KM
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {parts.map((part) => {
              const snapshot = getPartHealthSnapshot(part, odometer);
              return (
                <button
                  key={part.key}
                  type="button"
                  onClick={() => onSelectPart(part.key)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${getPanelTone(snapshot.status, selectedPartKey === part.key)}`}
                >
                  <p className="text-xs font-semibold text-neutral-100">{part.shortLabel ?? part.name}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-neutral-400">%{snapshot.health}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
