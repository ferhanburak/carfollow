import { formatNumber } from "../../utils/garage";

function getTone(status) {
  if (status === "critical") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }

  if (status === "warning") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  }

  return "border-lime-400/20 bg-lime-400/10 text-lime-100";
}

export function UpcomingMaintenanceList({ items }) {
  if (!items.length) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-400">
        Tum kritik parcalar guvende. Yeni bir servis planlamasi gerekmiyor.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.key} className={`rounded-2xl border p-4 ${getTone(item.snapshot.status)}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">{item.name}</p>
            <p className="text-sm font-bold">%{item.snapshot.health}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-neutral-300">
            <div className="rounded-xl bg-black/20 px-3 py-2">
              Kalan Omur: {formatNumber(item.snapshot.kmRemaining)} KM
            </div>
            <div className="rounded-xl bg-black/20 px-3 py-2">
              Tarih Payi: {item.snapshot.daysRemaining === null ? "--" : `${item.snapshot.daysRemaining} gun`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
