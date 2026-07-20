import { useState } from "react";
import { formatNumber } from "../../utils/garage";
import { getPartHealthSnapshot } from "../../utils/vehiclePassport";
import { VehicleHealthDiagram } from "./VehicleHealthDiagram";

function getHealthTone(snapshot) {
  if (snapshot.status === "critical") return "bg-rose-500";
  if (snapshot.status === "warning") return "bg-amber-400";
  return "bg-lime-400";
}

export function VehicleHealthCenter({ odometer, onSelectPart, parts, selectedPartKey, vehicleType }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <VehicleHealthDiagram
        compact
        odometer={odometer}
        onOpen={() => setIsOpen(true)}
        parts={parts}
        selectedPartKey={selectedPartKey}
        vehicleType={vehicleType}
      />

      {isOpen ? (
        <div className="fixed inset-0 z-[45] bg-black/85 backdrop-blur-md md:p-4" role="dialog" aria-modal="true" aria-label="Parca sagligi merkezi">
          <section className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-white/10 bg-[#090909] shadow-[0_24px_90px_rgba(0,0,0,0.9)] md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:border">
            <header className="app-safe-top shrink-0 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.16),transparent_44%),#111111] px-4 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">VEHICLE HEALTH</p>
                  <h2 className="mt-1 text-lg font-black">Parca Sagligi</h2>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Parca sagligi merkezini kapat" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xl text-neutral-300">&times;</button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <VehicleHealthDiagram
                odometer={odometer}
                onSelectPart={onSelectPart}
                parts={parts}
                selectedPartKey={selectedPartKey}
                vehicleType={vehicleType}
              />

              <div className="mt-4 space-y-3">
                {parts.map((part) => {
                  const snapshot = getPartHealthSnapshot(part, odometer);
                  return (
                    <button
                      key={part.key}
                      type="button"
                      onClick={() => onSelectPart(part.key)}
                      className={`w-full rounded-2xl border bg-black/20 p-4 text-left transition ${selectedPartKey === part.key ? "border-lime-400/35" : "border-white/8"}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-neutral-100">{part.name}</span>
                        <span className={snapshot.status === "critical" ? "font-bold text-rose-300" : "font-bold text-neutral-200"}>%{snapshot.health}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-800">
                        <div className={`h-full rounded-full ${getHealthTone(snapshot)} transition-all duration-700`} style={{ width: `${snapshot.health}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>{formatNumber(snapshot.kmRemaining)} KM kaldi</span>
                        <span>{snapshot.daysRemaining === null ? "--" : `${snapshot.daysRemaining} gun`}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
