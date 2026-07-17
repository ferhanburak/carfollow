import { CompactField, InsightCard } from "../ui";

export function SpotPinPanel({
  pin,
  user,
  spotPhotoForm,
  spotPhotoErrors,
  spotPhotoFeedback,
  onLikePin,
  onLikeGallery,
  onDeleteSpotPhoto,
  onReportSpotPhoto,
  onSpotPhotoFileChange,
  onSpotPhotoFormChange,
  onSubmitSpotPhoto,
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-lime-400">Photo Spot</p>
          <h3 className="mt-2 text-xl font-black">{pin.name}</h3>
          <p className="mt-2 text-sm text-neutral-400">{pin.description}</p>
        </div>
        <button type="button" onClick={onLikePin} className="min-h-12 rounded-2xl bg-lime-400/10 px-4 text-sm font-semibold text-lime-300">
          + Like Pin
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {pin.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 px-3 py-2 text-xs text-neutral-300">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <InsightCard label="Pin Likes" value={`${pin.likes}`} />
        <InsightCard label="Gallery Likes" value={`${pin.galleryLikes}`} />
      </div>

      <form className="mt-4 space-y-3 rounded-2xl bg-black/20 p-4" onSubmit={onSubmitSpotPhoto}>
        <p className="text-sm font-semibold">Spot Gallery Upload</p>
        {spotPhotoFeedback ? (
          <div className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm text-lime-200">
            {spotPhotoFeedback}
          </div>
        ) : null}
        <CompactField label="Photo Title">
          <input
            value={spotPhotoForm.title}
            onChange={(event) => onSpotPhotoFormChange((current) => ({ ...current, title: event.target.value }))}
            className="h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 outline-none focus:border-lime-400"
            placeholder="Night roller / pit stop frame"
          />
          {spotPhotoErrors.title ? <p className="text-xs text-rose-300">{spotPhotoErrors.title}</p> : null}
        </CompactField>
        <CompactField label="Photo File">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onSpotPhotoFileChange(event.target.files?.[0] ?? null)}
            className="block h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 py-3 text-sm text-neutral-300 file:mr-3 file:rounded-xl file:border-0 file:bg-lime-400 file:px-3 file:py-2 file:font-semibold file:text-black"
          />
          {spotPhotoForm.fileName ? <p className="text-xs text-neutral-500">{spotPhotoForm.fileName}</p> : null}
          {spotPhotoErrors.imageUrl ? <p className="text-xs text-rose-300">{spotPhotoErrors.imageUrl}</p> : null}
        </CompactField>
        {spotPhotoForm.imageUrl ? (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <img src={spotPhotoForm.imageUrl} alt={spotPhotoForm.title || "Spot preview"} className="h-36 w-full object-cover" />
          </div>
        ) : null}
        <button type="submit" className="min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black">
          Fotoyu Spot'a Ekle
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {pin.gallery.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-2xl bg-black/20">
            {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-40 w-full object-cover" /> : null}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.title}</p>
                <p className="text-xs text-neutral-500">{item.author ?? user.plate} toplulugu burada aktif.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => onLikeGallery(item.id)} className="min-h-12 rounded-2xl border border-white/10 px-3 text-xs text-lime-300">
                  {item.likes} Like
                </button>
                {item.userId === (user.firebaseUid ?? user.id) ? (
                  <button type="button" onClick={() => onDeleteSpotPhoto?.(item.id)} className="min-h-12 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3 text-xs text-rose-200">
                    Sil
                  </button>
                ) : (
                  <button type="button" onClick={() => onReportSpotPhoto?.(item.id)} className="min-h-12 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 text-xs text-amber-100">
                    Raporla
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
