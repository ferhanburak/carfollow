import { CompactField, InsightCard } from "../ui";

export function WashPinPanel({
  pin,
  washForm,
  washErrors,
  washFeedback,
  onWashFormChange,
  onSubmitWashReview,
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Car Wash Station</p>
      <h3 className="mt-2 text-xl font-black">{pin.name}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <InsightCard label="Foam Quality" value={pin.rating.foam.toFixed(1)} />
        <InsightCard label="Water Quality" value={pin.rating.water.toFixed(1)} />
        <InsightCard label="Buckets Allowed" value={`${pin.rating.allowsBuckets}/${pin.rating.reviews}`} />
        <InsightCard label="Shadow Drying" value={`${pin.rating.shadowDrying}/${pin.rating.reviews}`} />
      </div>

      <form className="mt-4 space-y-3 rounded-2xl bg-black/20 p-4" onSubmit={onSubmitWashReview}>
        <p className="text-sm font-semibold">Live Review Submit</p>
        {washFeedback ? (
          <div className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm text-lime-200">
            {washFeedback}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <CompactField label="Foam">
            <input
              type="number"
              min="1"
              max="5"
              value={washForm.foam}
              onChange={(event) => onWashFormChange((current) => ({ ...current, foam: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
            />
            {washErrors.foam ? <p className="text-xs text-rose-300">{washErrors.foam}</p> : null}
          </CompactField>
          <CompactField label="Water">
            <input
              type="number"
              min="1"
              max="5"
              value={washForm.water}
              onChange={(event) => onWashFormChange((current) => ({ ...current, water: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
            />
            {washErrors.water ? <p className="text-xs text-rose-300">{washErrors.water}</p> : null}
          </CompactField>
        </div>
        <CompactField label="Review Note">
          <input
            value={washForm.note}
            onChange={(event) => onWashFormChange((current) => ({ ...current, note: event.target.value }))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
            placeholder="Basinc, kirec, kurutma alani..."
          />
          {washErrors.note ? <p className="text-xs text-rose-300">{washErrors.note}</p> : null}
        </CompactField>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onWashFormChange((current) => ({ ...current, allowsBuckets: !current.allowsBuckets }))}
            className={`min-h-12 rounded-2xl border ${washForm.allowsBuckets ? "border-lime-400 bg-lime-400/10 text-lime-300" : "border-white/10 text-neutral-400"}`}
          >
            Allows Buckets
          </button>
          <button
            type="button"
            onClick={() => onWashFormChange((current) => ({ ...current, shadowDrying: !current.shadowDrying }))}
            className={`min-h-12 rounded-2xl border ${washForm.shadowDrying ? "border-lime-400 bg-lime-400/10 text-lime-300" : "border-white/10 text-neutral-400"}`}
          >
            Has Covered Shadow
          </button>
        </div>
        <button type="submit" className="min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black">
          Review Ekle
        </button>
      </form>

      <div className="mt-4 max-h-56 space-y-3 overflow-y-auto pr-1">
        {pin.reviews.map((review) => (
          <div key={review.id} className="rounded-2xl bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm tracking-[0.14em] text-lime-300">{review.author}</p>
              <p className="text-xs text-neutral-500">
                Foam {review.foam}/5 / Water {review.water}/5
              </p>
            </div>
            <p className="mt-2 text-sm text-neutral-300">{review.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
