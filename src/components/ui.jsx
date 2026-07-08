export function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

export function CompactField({ label, children }) {
  return (
    <label className="space-y-2">
      <span className="text-xs uppercase tracking-[0.22em] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

export function HudStat({ label, value, accent }) {
  const styles =
    accent === "lime"
      ? "border-lime-400/20 bg-lime-400/10 text-lime-300"
      : accent === "rose"
        ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
        : "border-white/10 bg-white/[0.04] text-neutral-200";

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <p className="mt-3 text-lg font-black">{value}</p>
    </div>
  );
}

export function InsightCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-lime-300">{value}</p>
    </div>
  );
}
