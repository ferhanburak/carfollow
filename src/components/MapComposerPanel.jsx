import { useState } from "react";
import { getMeetVisibilityLabel, getMeetVisibilityOptions } from "../utils/meetVisibility";
import { CompactField } from "./ui";

const nodeTypes = [
  { key: "meet", label: "Event" },
  { key: "spot", label: "Photo Spot" },
  { key: "wash", label: "Wash" },
];
const visibilityOptions = getMeetVisibilityOptions();

export function MapComposerPanel({
  alwaysOpen = false,
  draftLocation,
  feedback,
  form,
  errors,
  mapPickMode,
  onClearRouteDraft,
  onFormChange,
  onRemoveLastRoutePoint,
  onSetMapPickMode,
  onSubmit,
  onUseSelectedCoordinates,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const resolvedOpen = alwaysOpen || isOpen;
  const isSpot = form.type === "spot";
  const isMeet = form.type === "meet";
  const isWash = form.type === "wash";
  const routePointCount = form.routePoints.length;

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Node Studio</p>
          <h3 className="mt-2 text-xl font-black">Yeni Nokta Olustur</h3>
          <p className="mt-2 text-sm text-neutral-400">
            Varsayilan akis event odakli. Haritadan ana nokta ve event rota dugumleri secilebilir.
          </p>
        </div>
        {!alwaysOpen ? (
          <button
            type="button"
            onClick={() => {
              setIsOpen((current) => {
                const next = !current;
                if (!next) {
                  onSetMapPickMode("node");
                }
                return next;
              });
            }}
            className={`min-h-12 rounded-2xl px-4 text-sm font-semibold transition ${
              resolvedOpen ? "bg-lime-400 text-black" : "border border-white/10 bg-black/20 text-neutral-300"
            }`}
          >
            {resolvedOpen ? "Editoru Gizle" : "Editoru Ac"}
          </button>
        ) : null}
      </div>

      {!resolvedOpen ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-neutral-300">
          <p>Su an ikinci bir photo spot degil, sadece yeni node olusturma alani var.</p>
          <p className="mt-2 text-neutral-500">
            Haritaya tikla, sonra editoru ac. Secili lokasyon:
            {" "}
            {draftLocation ? `${draftLocation.lat}, ${draftLocation.lng}` : "heniz yok"}
          </p>
        </div>
      ) : null}

      {resolvedOpen ? (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-lime-400/15 bg-lime-400/5 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-lime-300">Konum Secimi</p>
              <p className="mt-1 text-sm text-neutral-300">
                {draftLocation
                  ? `Ana nokta: ${draftLocation.lat}, ${draftLocation.lng}`
                  : "Haritada bos bir alana dokun veya secili node konumunu kopyala."}
              </p>
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
                onClick={() => {
                  onFormChange((current) => ({ ...current, type: type.key }));
                  onSetMapPickMode("node");
                }}
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

                <CompactField label="Visibility">
                  <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/8 bg-black/20 p-2">
                    {visibilityOptions.map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => onFormChange((current) => ({ ...current, visibility }))}
                        className={`min-h-12 rounded-2xl px-3 text-[11px] font-bold transition ${
                          form.visibility === visibility ? "bg-lime-400 text-black" : "text-neutral-400"
                        }`}
                      >
                        {getMeetVisibilityLabel(visibility)}
                      </button>
                    ))}
                  </div>
                  {errors.visibility ? <p className="text-xs text-rose-300">{errors.visibility}</p> : null}
                </CompactField>

                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-lime-300">Route Builder</p>
                      <p className="mt-1 text-sm text-neutral-300">
                        Mod:
                        {" "}
                        {mapPickMode === "route" ? "Rota noktasi ekleme" : "Ana event lokasyonu secme"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">{routePointCount} rota noktasi secildi.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onSetMapPickMode("node")}
                        className={`min-h-12 rounded-2xl px-3 text-xs font-semibold ${mapPickMode === "node" ? "bg-lime-400 text-black" : "border border-white/10 text-neutral-300"}`}
                      >
                        Ana Nokta
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetMapPickMode("route")}
                        className={`min-h-12 rounded-2xl px-3 text-xs font-semibold ${mapPickMode === "route" ? "bg-rose-400 text-black" : "border border-white/10 text-neutral-300"}`}
                      >
                        Rota Noktasi
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onRemoveLastRoutePoint}
                      disabled={routePointCount === 0}
                      className="min-h-12 rounded-2xl border border-white/10 px-4 text-xs text-neutral-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Son Noktayi Sil
                    </button>
                    <button
                      type="button"
                      onClick={onClearRouteDraft}
                      disabled={routePointCount === 0}
                      className="min-h-12 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-xs text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Rotayi Temizle
                    </button>
                  </div>
                  {routePointCount > 0 ? (
                    <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-xs text-neutral-300">
                      <p className="font-semibold text-lime-300">Taslak Rota Ozeti</p>
                      <div className="mt-2 space-y-1">
                        {form.routePoints.map((point, index) => (
                          <p key={`${point.lat}-${point.lng}-${index}`}>
                            {index === 0 ? "S" : index === form.routePoints.length - 1 ? "F" : index}
                            {" "}
                            / {point.lat}, {point.lng}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {errors.routePoints ? <p className="mt-3 text-xs text-rose-300">{errors.routePoints}</p> : null}
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
        </>
      ) : null}
    </div>
  );
}
