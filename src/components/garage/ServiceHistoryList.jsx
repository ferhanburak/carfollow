import { formatNumber } from "../../utils/garage";
import { formatServiceDate } from "../../utils/vehiclePassport";

export function ServiceHistoryList({ logs, partsByKey }) {
  if (!logs.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
        Henuz servis kaydi yok. Ilk kayitla birlikte Vehicle Passport olusmaya baslayacak.
      </div>
    );
  }

  return (
    <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
      {logs.map((log) => (
        <div key={log.id} className="rounded-2xl bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-neutral-100">{partsByKey.get(log.partKey)?.name ?? log.partKey}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-lime-300">{log.type}</p>
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
