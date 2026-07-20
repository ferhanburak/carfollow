import { useState } from "react";
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

export function ServiceHistoryList({ logs, onDelete, partsByKey, pendingId = "" }) {
  const safeLogs = logs ?? [];
  const [confirmingId, setConfirmingId] = useState("");

  const confirmDelete = async (serviceLogId) => {
    const deleted = await onDelete?.(serviceLogId);
    if (deleted) setConfirmingId("");
  };

  if (!safeLogs.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-neutral-500">
        Henuz servis kaydi yok. Ilk kayitla birlikte Vehicle Passport olusmaya baslayacak.
      </div>
    );
  }

  return (
    <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
      {safeLogs.map((log) => {
        const partName = partsByKey.get(log.partKey)?.name ?? log.partKey;
        const isPending = pendingId === log.id;
        const isConfirming = confirmingId === log.id;
        return (
          <div key={log.id} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-neutral-100">{partName}</p>
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
            {isConfirming ? (
              <div role="alert" className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/[0.08] p-3">
                <p className="text-xs font-semibold text-rose-100">Bu servis kaydi kalici olarak silinecek.</p>
                <p className="mt-1 text-[11px] leading-4 text-neutral-400">Passport toplamlari ve bagli parca gecmisi yeniden hesaplanir.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setConfirmingId("")}
                    className="min-h-12 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-neutral-200 disabled:opacity-50"
                  >
                    Vazgec
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => void confirmDelete(log.id)}
                    className="min-h-12 rounded-xl bg-rose-500 text-xs font-bold text-white shadow-[0_0_18px_rgba(244,63,94,0.25)] disabled:cursor-wait disabled:opacity-50"
                  >
                    {isPending ? "Siliniyor..." : "Silmeyi Onayla"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={Boolean(pendingId)}
                onClick={() => setConfirmingId(log.id)}
                aria-label={`${partName} servis kaydini sil`}
                className="mt-4 min-h-12 w-full rounded-xl border border-rose-400/20 bg-rose-500/[0.06] px-3 text-xs font-semibold text-rose-200 disabled:opacity-40"
              >
                Hatali Kaydi Sil
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
