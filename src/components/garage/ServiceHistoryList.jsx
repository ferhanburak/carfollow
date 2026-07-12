import { formatNumber } from "../../utils/garage";
import { formatServiceDate } from "../../utils/vehiclePassport";

function getTypeTone(type) {
  if (type === "replacement") {
    return "border-lime-400/25 bg-lime-400/10 text-lime-200";
  }

  if (type === "repair") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }

  return "border-white/10 bg-white/[0.04] text-neutral-300";
}

export function ServiceHistoryList({ logs, partsByKey }) {
  const safeLogs = logs ?? [];

  if (!safeLogs.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
        Henuz servis kaydi yok. Ilk kayitla birlikte Vehicle Passport olusmaya baslayacak.
      </div>
    );
  }

  return (
      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
      {safeLogs.map((log) => (
        <div key={log.id} className="rounded-2xl bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-neutral-100">{partsByKey.get(log.partKey)?.name ?? log.partKey}</p>
              <span
                className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${getTypeTone(log.type)}`}
              >
                {log.type}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-lime-300">{formatNumber(log.cost ?? 0)} TL</p>
              <p className="text-xs text-neutral-500">{formatNumber(log.serviceKm)} KM</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
            <span>{log.serviceShop}</span>
            <span>{formatServiceDate(log.serviceDate)}</span>
          </div>
          {log.notes ? <p className="mt-3 text-xs text-neutral-400">{log.notes}</p> : null}
        </div>
      ))}
    </div>
  );
}
