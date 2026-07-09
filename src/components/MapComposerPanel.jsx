import { CompactField } from "./ui";

const nodeTypes = [
  { key: "spot", label: "Photo Spot" },
  { key: "meet", label: "Event" },
  { key: "wash", label: "Wash" },
];

export function MapComposerPanel({
  feedback,
  form,
  errors,
  onFormChange,
  onSubmit,
  onUseSelectedCoordinates,
}) {
  const isSpot = form.type === "spot";
  const isMeet = form.type === "meet";
  const isWash = form.type === "wash";

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Node Studio</p>
          <h3 className="mt-2 text-xl font-black">Map Uzerine Yeni Nokta Ekle</h3>
          <p className="mt-2 text-sm text-neutral-400">Event, photo spot veya car wash noktasi olustur. Kaydedince haritada aninda belirir.</p>
        </div>
        <button
          type="button"
          onClick={onUseSelectedCoordinates}
          className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-xs font-semibold text-neutral-300"
        >
          Secili Node
          <br />
          Konumu
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-3xl border border-white/8 bg-black/20 p-2">
        {nodeTypes.map((type) => (
          <button
            key={type.key}
            type="button"
            onClick={() => onFormChange((current) => ({ ...current, type: type.key }))}
            className={`min-h-12 rounded-2xl px-3 text-xs font-bold transition ${
              form.type === type.key ? "bg-lime-400 text-black" : "text-neutral-400"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        {feedback ? (
          <div className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm text-lime-200">
            {feedback}
          </div>
        ) : null}

        <CompactField label="Node Name">
          <input
            value={form.name}
            onChange={(event) => onFormChange((current) => ({ ...current, name: event.target.value }))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
            placeholder={isSpot ? "Sunset Spot" : isMeet ? "Friday Convoy" : "Self Wash Hub"}
          />
          {errors.name ? <p className="text-xs text-rose-300">{errors.name}</p> : null}
        </CompactField>

        <div className="grid grid-cols-2 gap-3">
          <CompactField label="Latitude">
            <input
              type="number"
              step="0.0001"
              value={form.lat}
              onChange={(event) => onFormChange((current) => ({ ...current, lat: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
            />
            {errors.lat ? <p className="text-xs text-rose-300">{errors.lat}</p> : null}
          </CompactField>
          <CompactField label="Longitude">
            <input
              type="number"
              step="0.0001"
              value={form.lng}
              onChange={(event) => onFormChange((current) => ({ ...current, lng: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
            />
            {errors.lng ? <p className="text-xs text-rose-300">{errors.lng}</p> : null}
          </CompactField>
        </div>

        {isSpot ? (
          <>
            <CompactField label="Spot Story">
              <input
                value={form.description}
                onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                placeholder="Asfalt, manzara ve trafik karakteri..."
              />
              {errors.description ? <p className="text-xs text-rose-300">{errors.description}</p> : null}
            </CompactField>
            <CompactField label="Quick Tags">
              <input
                value={form.tags}
                onChange={(event) => onFormChange((current) => ({ ...current, tags: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                placeholder="#SmoothAsphalt #CrewApproved"
              />
            </CompactField>
          </>
        ) : null}

        {isMeet ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <CompactField label="Launch Time">
                <input
                  value={form.time}
                  onChange={(event) => onFormChange((current) => ({ ...current, time: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                  placeholder="23:30"
                />
                {errors.time ? <p className="text-xs text-rose-300">{errors.time}</p> : null}
              </CompactField>
              <CompactField label="Route Summary">
                <input
                  value={form.route}
                  onChange={(event) => onFormChange((current) => ({ ...current, route: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                  placeholder="Beytepe -> Incek -> Mogan"
                />
                {errors.route ? <p className="text-xs text-rose-300">{errors.route}</p> : null}
              </CompactField>
            </div>
          </>
        ) : null}

        {isWash ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <CompactField label="Foam">
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.foam}
                  onChange={(event) => onFormChange((current) => ({ ...current, foam: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                />
                {errors.foam ? <p className="text-xs text-rose-300">{errors.foam}</p> : null}
              </CompactField>
              <CompactField label="Water">
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.water}
                  onChange={(event) => onFormChange((current) => ({ ...current, water: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                />
                {errors.water ? <p className="text-xs text-rose-300">{errors.water}</p> : null}
              </CompactField>
            </div>
            <CompactField label="Launch Review">
              <input
                value={form.note}
                onChange={(event) => onFormChange((current) => ({ ...current, note: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                placeholder="Kirec, kopuk ve kurutma alani notu..."
              />
              {errors.note ? <p className="text-xs text-rose-300">{errors.note}</p> : null}
            </CompactField>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onFormChange((current) => ({ ...current, allowsBuckets: !current.allowsBuckets }))}
                className={`min-h-12 rounded-2xl border ${form.allowsBuckets ? "border-lime-400 bg-lime-400/10 text-lime-300" : "border-white/10 text-neutral-400"}`}
              >
                Allows Buckets
              </button>
              <button
                type="button"
                onClick={() => onFormChange((current) => ({ ...current, shadowDrying: !current.shadowDrying }))}
                className={`min-h-12 rounded-2xl border ${form.shadowDrying ? "border-lime-400 bg-lime-400/10 text-lime-300" : "border-white/10 text-neutral-400"}`}
              >
                Covered Shadow
              </button>
            </div>
          </>
        ) : null}

        <button type="submit" className="min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black">
          {isSpot ? "Photo Spot Ekle" : isMeet ? "Event Ekle" : "Wash Noktasi Ekle"}
        </button>
      </form>
    </div>
  );
}
