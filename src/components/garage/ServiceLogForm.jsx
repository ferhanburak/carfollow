import { CompactField } from "../ui";

export function ServiceLogForm({
  errors,
  form,
  onChange,
  onSubmit,
  parts,
}) {
  const safeParts = parts ?? [];

  return (
    <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={onSubmit}>
      <CompactField label="Part">
        <select
          value={form.partKey}
          onChange={(event) => onChange((current) => ({ ...current, partKey: event.target.value }))}
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
        >
          {safeParts.map((part) => (
            <option key={part.key} value={part.key}>
              {part.name}
            </option>
          ))}
        </select>
        {errors.partKey ? <p className="text-xs text-rose-300">{errors.partKey}</p> : null}
      </CompactField>

      <CompactField label="Type">
        <select
          value={form.type}
          onChange={(event) => onChange((current) => ({ ...current, type: event.target.value }))}
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
        >
          <option value="replacement">Replacement</option>
          <option value="inspection">Inspection</option>
          <option value="repair">Repair</option>
        </select>
      </CompactField>

      <CompactField label="Service Date">
        <input
          type="date"
          value={form.serviceDate}
          onChange={(event) => onChange((current) => ({ ...current, serviceDate: event.target.value }))}
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
        />
        {errors.serviceDate ? <p className="text-xs text-rose-300">{errors.serviceDate}</p> : null}
      </CompactField>

      <CompactField label="Service KM">
        <input
          type="number"
          value={form.serviceKm}
          onChange={(event) => onChange((current) => ({ ...current, serviceKm: event.target.value }))}
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
        />
        {errors.serviceKm ? <p className="text-xs text-rose-300">{errors.serviceKm}</p> : null}
      </CompactField>

      <CompactField label="Service Shop">
        <input
          value={form.serviceShop}
          onChange={(event) => onChange((current) => ({ ...current, serviceShop: event.target.value }))}
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
        />
        {errors.serviceShop ? <p className="text-xs text-rose-300">{errors.serviceShop}</p> : null}
      </CompactField>

      <CompactField label="Cost (TL)">
        <input
          type="number"
          value={form.cost}
          onChange={(event) => onChange((current) => ({ ...current, cost: event.target.value }))}
          className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 outline-none focus:border-lime-400"
        />
        {errors.cost ? <p className="text-xs text-rose-300">{errors.cost}</p> : null}
      </CompactField>

      <CompactField label="Notes">
        <textarea
          value={form.notes}
          onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
          className="col-span-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-lime-400"
          placeholder="Part code, workmanship notes, next control details..."
        />
      </CompactField>

      <button
        type="submit"
        className="col-span-2 min-h-12 rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_20px_rgba(163,230,53,0.35)]"
      >
        Service Log Ekle
      </button>
    </form>
  );
}
