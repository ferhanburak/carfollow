import { useEffect, useState } from "react";
import {
  getMeetAccessPolicyLabel,
  getMeetAccessPolicyOptions,
  getMeetDetailVisibilityLabel,
  getMeetDetailVisibilityOptions,
  getMeetVisibilityLabel,
  getMeetVisibilityOptions,
} from "../utils/meetVisibility";
import { CompactField } from "./ui";
import { validateMapPinForm } from "../utils/validation";

const nodeTypes = [
  { key: "meet", label: "Event" },
  { key: "spot", label: "Photo Spot" },
  { key: "wash", label: "Wash" },
];
const visibilityOptions = getMeetVisibilityOptions();
const accessPolicyOptions = getMeetAccessPolicyOptions();
const detailVisibilityOptions = getMeetDetailVisibilityOptions();

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
  user,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRequiredNotice, setShowRequiredNotice] = useState(false);
  const resolvedOpen = alwaysOpen || isOpen;
  const isSpot = form.type === "spot";
  const isMeet = form.type === "meet";
  const isWash = form.type === "wash";
  const routePointCount = form.routePoints.length;
  const hasErrors = showRequiredNotice || Object.values(errors ?? {}).some(Boolean);
  const visibleFeedback = showRequiredNotice ? "Zorunlu alanlari doldurunuz." : feedback;

  useEffect(() => {
    setShowRequiredNotice(false);
  }, [form]);

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

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              const nextErrors = validateMapPinForm(form);
              setShowRequiredNotice(Object.keys(nextErrors).length > 0);
              onSubmit(event);
            }}
          >
            {visibleFeedback ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${
                hasErrors
                  ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                  : "border-lime-400/30 bg-lime-400/10 text-lime-200"
              }`} role={hasErrors ? "alert" : "status"}>
                {visibleFeedback}
              </div>
            ) : null}

            <p className="text-xs text-neutral-500">
              <span className="font-bold text-rose-400">*</span> Zorunlu alan
            </p>

            <CompactField label="Node Name" required>
              <input
                value={form.name}
                onChange={(event) => onFormChange((current) => ({ ...current, name: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                placeholder={isSpot ? "Sunset Spot" : isMeet ? "Friday Convoy" : "Self Wash Hub"}
              />
              {errors.name ? <p className="text-xs text-rose-300">{errors.name}</p> : null}
            </CompactField>

            <div className="grid grid-cols-2 gap-3">
              <CompactField label="Latitude" required>
                <input
                  type="number"
                  step="0.0001"
                  value={form.lat}
                  onChange={(event) => onFormChange((current) => ({ ...current, lat: event.target.value }))}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                />
                {errors.lat ? <p className="text-xs text-rose-300">{errors.lat}</p> : null}
              </CompactField>
              <CompactField label="Longitude" required>
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
                <CompactField label="Spot Story" required>
                  <input
                    value={form.description}
                    onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                    placeholder="Asfalt, manzara ve trafik karakteri..."
                  />
                  {errors.description ? <p className="text-xs text-rose-300">{errors.description}</p> : null}
                </CompactField>
                <CompactField label="Quick Tags" optional>
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
                  <CompactField label="Launch Time" required>
                    <input
                      type="datetime-local"
                      value={form.time}
                      onChange={(event) => onFormChange((current) => ({ ...current, time: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                    />
                    {errors.time ? <p className="text-xs text-rose-300">{errors.time}</p> : null}
                  </CompactField>
                  <CompactField label="Route Summary" required>
                    <input
                      value={form.route}
                      onChange={(event) => onFormChange((current) => ({ ...current, route: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                      placeholder="Beytepe -> Incek -> Mogan"
                    />
                    {errors.route ? <p className="text-xs text-rose-300">{errors.route}</p> : null}
                  </CompactField>
                </div>

                <CompactField label="Capacity" required>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={form.capacity}
                    onChange={(event) => onFormChange((current) => ({ ...current, capacity: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                  />
                  {errors.capacity ? <p className="text-xs text-rose-300">{errors.capacity}</p> : null}
                </CompactField>

                <CompactField label="Visibility" required>
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

                <div className="grid grid-cols-2 gap-3">
                  <CompactField label="Join Policy" required>
                    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/8 bg-black/20 p-2">
                      {accessPolicyOptions.map((policy) => (
                        <button
                          key={policy}
                          type="button"
                          onClick={() => onFormChange((current) => ({ ...current, accessPolicy: policy }))}
                          className={`min-h-12 rounded-2xl px-3 text-[11px] font-bold transition ${
                            form.accessPolicy === policy ? "bg-lime-400 text-black" : "text-neutral-400"
                          }`}
                        >
                          {getMeetAccessPolicyLabel(policy)}
                        </button>
                      ))}
                    </div>
                    {errors.accessPolicy ? <p className="text-xs text-rose-300">{errors.accessPolicy}</p> : null}
                  </CompactField>

                  <CompactField label="Detail Access" required>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/8 bg-black/20 p-2">
                      {detailVisibilityOptions.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onFormChange((current) => ({ ...current, detailVisibility: mode }))}
                          className={`min-h-12 rounded-2xl px-3 text-[11px] font-bold transition ${
                            form.detailVisibility === mode ? "bg-lime-400 text-black" : "text-neutral-400"
                          }`}
                        >
                          {getMeetDetailVisibilityLabel(mode)}
                        </button>
                      ))}
                    </div>
                    {errors.detailVisibility ? <p className="text-xs text-rose-300">{errors.detailVisibility}</p> : null}
                  </CompactField>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <CompactField label="Min Score" required>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.minDriverScore}
                      onChange={(event) => onFormChange((current) => ({ ...current, minDriverScore: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                    />
                    {errors.minDriverScore ? <p className="text-xs text-rose-300">{errors.minDriverScore}</p> : null}
                  </CompactField>
                  <CompactField label="Min Uyum" required>
                    <input
                      type="number"
                      min="0"
                      value={form.minHarmonyVotes}
                      onChange={(event) => onFormChange((current) => ({ ...current, minHarmonyVotes: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                    />
                    {errors.minHarmonyVotes ? <p className="text-xs text-rose-300">{errors.minHarmonyVotes}</p> : null}
                  </CompactField>
                  <CompactField label="Max Alert" required>
                    <input
                      type="number"
                      min="0"
                      value={form.maxAlertVotes}
                      onChange={(event) => onFormChange((current) => ({ ...current, maxAlertVotes: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
                    />
                    {errors.maxAlertVotes ? <p className="text-xs text-rose-300">{errors.maxAlertVotes}</p> : null}
                  </CompactField>
                </div>

                <CompactField label="Invite Friends" optional>
                  <div className="space-y-2 rounded-2xl border border-white/8 bg-black/20 p-3">
                    {(user?.friends ?? []).length ? (
                      user.friends.map((friend) => {
                        const active = (form.invitedPlates ?? []).includes(friend.plate);

                        return (
                          <button
                            key={friend.plate}
                            type="button"
                            onClick={() =>
                              onFormChange((current) => ({
                                ...current,
                                invitedPlates: active
                                  ? current.invitedPlates.filter((plate) => plate !== friend.plate)
                                  : [...current.invitedPlates, friend.plate],
                              }))
                            }
                            className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
                              active
                                ? "border-lime-400/30 bg-lime-400/10 text-lime-200"
                                : "border-white/10 bg-white/5 text-neutral-300"
                            }`}
                          >
                            <span>
                              <span className="block font-mono text-xs tracking-[0.14em]">{friend.plate}</span>
                              <span className="block text-xs text-neutral-400">{friend.fullName}</span>
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.18em]">
                              {active ? "Invited" : "Add"}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-neutral-500">Davet eklemek icin once arkadas listeni buyut.</p>
                    )}
                  </div>
                </CompactField>

                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-lime-300">
                        Route Builder <span className="text-rose-400">*</span>
                      </p>
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
                  <CompactField label="Foam" required>
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
                  <CompactField label="Water" required>
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
                <CompactField label="Launch Review" required>
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
