import { CompactField, InsightCard } from "../components/ui";
import { formatNumber, getPartHealth } from "../utils/garage";

export function GarageScreen({ appId, fuelErrors, fuelForm, fuelInsights, onFuelFormChange, onSubmitFuelLog, user }) {
  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Digital Garage</p>
            <h3 className="mt-2 text-xl font-black">{user.fullName}</h3>
            <p className="mt-1 text-sm text-neutral-400">
              {user.model} • {user.tuningStage} • {user.horsepower} HP
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Garage ID</p>
            <p className="font-mono text-sm text-lime-300">{user.plate}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {user.badges.map((badge) => (
            <span key={badge} className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-xs text-lime-200">
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Digital Maintenance Log</p>
          <span className="text-xs uppercase tracking-[0.24em] text-neutral-500">Live Wear</span>
        </div>
        <div className="mt-4 space-y-4">
          {user.parts.map((part) => {
            const health = getPartHealth(part, user.odometer);
            const tone = health > 50 ? "bg-lime-400" : health > 20 ? "bg-amber-400" : "bg-rose-500 animate-pulse";

            return (
              <div key={part.key} className="rounded-2xl bg-black/20 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{part.name}</span>
                  <span className={health <= 20 ? "text-rose-300" : "text-neutral-300"}>{health}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
                  <div className={`h-full rounded-full ${tone} transition-all duration-700`} style={{ width: `${health}%` }} />
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Formula: Current_Odometer - Replaced_Km / Life_Expectancy
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Fuel Efficiency Tracker</p>
            <p className="text-xs text-neutral-500">L/100km hesaplari son girislerle otomatik guncellenir.</p>
          </div>
          <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Avg</p>
            <p className="text-sm font-bold text-lime-300">{fuelInsights.average.toFixed(1)} L/100</p>
          </div>
        </div>

        <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={onSubmitFuelLog}>
          <CompactField label="Liters">
            <input
              type="number"
              value={fuelForm.liters}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, liters: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.liters ? <p className="text-xs text-rose-300">{fuelErrors.liters}</p> : null}
          </CompactField>
          <CompactField label="Price (TL)">
            <input
              type="number"
              value={fuelForm.price}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, price: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.price ? <p className="text-xs text-rose-300">{fuelErrors.price}</p> : null}
          </CompactField>
          <CompactField label="Current KM">
            <input
              type="number"
              value={fuelForm.currentKm}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, currentKm: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.currentKm ? <p className="text-xs text-rose-300">{fuelErrors.currentKm}</p> : null}
          </CompactField>
          <CompactField label="Station">
            <input
              value={fuelForm.station}
              onChange={(event) => onFuelFormChange((current) => ({ ...current, station: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
            />
            {fuelErrors.station ? <p className="text-xs text-rose-300">{fuelErrors.station}</p> : null}
          </CompactField>
          <button
            type="submit"
            className="col-span-2 min-h-12 rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_20px_rgba(163,230,53,0.35)]"
          >
            Receipt Ekle
          </button>
        </form>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <InsightCard label="Total Spend" value={`${formatNumber(fuelInsights.totalSpend)} TL`} />
          <InsightCard label="Per Fill" value={`${formatNumber(fuelInsights.costPerFill)} TL`} />
          <InsightCard label="Logs" value={`${user.fuelLogs.length}`} />
        </div>

        <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
          {user.fuelLogs.map((log) => (
            <div key={log.id} className="rounded-2xl bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{log.station}</p>
                <p className="text-sm text-lime-300">{log.liters} L</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                <span>{formatNumber(log.currentKm)} KM</span>
                <span>{formatNumber(log.price)} TL</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4 text-xs text-neutral-500">
        <p className="font-semibold text-neutral-300">Firestore Production Binding Notes</p>
        <p className="mt-2">
          Public path: <code>/artifacts/{appId}/public/data/{'{collectionName}'}</code>
        </p>
        <p className="mt-1">
          Private path: <code>/artifacts/{appId}/users/{'{userId}'}/{'{collectionName}'}</code>
        </p>
        <p className="mt-1">Deep filtering ve sorting istemci belleginde yapilacak sekilde tasarlanmistir.</p>
        <p className="mt-1">Plakadan DM icin dusuk gecikmeli yapi Realtime Database ile ayristirilmalidir.</p>
      </div>
    </section>
  );
}
