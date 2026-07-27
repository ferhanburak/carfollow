import { useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useReverseGeocodedLocation } from "../hooks/useReverseGeocodedLocation";

const categories = [
  { key: "all", label: "Tüm Paylaşımlar", tabLabel: "Tümü" },
  { key: "places", label: "Etkinlik, Mekan & Rota", tabLabel: "Etkinlik & Mekan" },
  { key: "builds", label: "Modifikasyon & Araçlar", tabLabel: "Modifikasyon" },
  { key: "technical", label: "Arıza & Teknik Destek", tabLabel: "Arıza & Teknik" },
  { key: "roadlife", label: "Yoldan & Hayattan", tabLabel: "Günlük Yaşam" },
];

const categoryMeta = Object.fromEntries(categories.map((category) => [category.key, category]));

function ActionIcon({ children }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      {children}
    </svg>
  );
}

function ThreadCard({ onAddReply, onToggleLike, pendingKey, thread }) {
  const [reply, setReply] = useState("");
  const [repliesOpen, setRepliesOpen] = useState(false);

  const submitReply = async () => {
    if (await onAddReply(thread.id, reply)) setReply("");
  };
  const sharedLocation = thread.location && typeof thread.location === "object" ? thread.location : null;
  const locationLabel = sharedLocation?.label || (typeof thread.location === "string" ? thread.location : "");
  const locationUrl = sharedLocation
    ? `https://www.google.com/maps/search/?api=1&query=${sharedLocation.lat},${sharedLocation.lng}`
    : "";

  return (
    <article className="border-b border-white/10 px-4 py-4 transition-colors hover:bg-white/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {thread.authorName}
            <span className="ml-2 font-normal text-neutral-500">{thread.authorModel || thread.authorPlate}</span>
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-lime-400">
            {categoryMeta[thread.category]?.label ?? "Forum"}
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-neutral-600">
          {thread.createdAt ? new Date(thread.createdAt).toLocaleDateString("tr-TR") : ""}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{thread.body}</p>
      {thread.imageUrl ? (
        <img
          src={thread.imageUrl}
          alt="Paylaşım görseli"
          className="mt-3 max-h-[28rem] w-full rounded-2xl border border-white/10 bg-black/30 object-cover"
        />
      ) : null}
      {locationLabel ? (
        locationUrl ? (
          <a href={locationUrl} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition active:scale-[0.98]">
            <ActionIcon><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></ActionIcon>
            {locationLabel}
          </a>
        ) : (
          <p className="mt-3 rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-3 text-xs text-sky-200">{locationLabel}</p>
        )
      ) : null}
      <div className="mt-4 flex items-center gap-7 text-neutral-500">
        <button
          type="button"
          disabled={pendingKey === `like:${thread.id}`}
          onClick={() => onToggleLike(thread.id)}
          aria-label={thread.likedByViewer ? "Faydalı isaretini kaldır" : "Faydalı bul"}
          className={`flex min-h-12 items-center gap-2 text-xs font-semibold transition active:scale-90 ${thread.likedByViewer ? "text-lime-400" : "hover:text-lime-300"}`}
        >
          <ActionIcon><path d="M7 10v10H4V10h3Zm3 10V9l3-5c1.3.3 2 1.3 2 2.5L14.5 10H20l-1.4 8.4A2 2 0 0 1 16.6 20H10Z" /></ActionIcon>
          {thread.likeCount ?? 0}
        </button>
        <button type="button" aria-expanded={repliesOpen} onClick={() => setRepliesOpen((current) => !current)} className="flex min-h-12 items-center gap-2 text-xs font-semibold transition hover:text-sky-300 active:scale-90">
          <ActionIcon><path d="M5 5h14v11H9l-4 3Z" /><path d="M8 9h8M8 12h5" /></ActionIcon>
          {thread.replyCount ?? thread.replies?.length ?? 0}
        </button>
      </div>
      {repliesOpen ? (
        <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
          {(thread.replies ?? []).map((item) => (
            <div key={item.id} className="rounded-xl bg-black/25 px-3 py-3">
              <p className="text-xs font-semibold text-lime-200">{item.authorName}</p>
              <p className="mt-1 text-sm text-neutral-300">{item.body}</p>
            </div>
          ))}
          <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={2} placeholder="Yanitini yaz..." className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none focus:border-lime-400" />
          <button type="button" disabled={!reply.trim() || pendingKey === `reply:${thread.id}`} onClick={submitReply} className="min-h-12 w-full rounded-xl bg-lime-400 text-xs font-bold text-black disabled:opacity-40">
            {pendingKey === `reply:${thread.id}` ? "Gönderiliyor..." : "Yanitla"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function ForumScreen({ addReply, createThread, feedback, form, onFormChange, pendingKey, threads, toggleLike, user }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locationPending, setLocationPending] = useState(false);
  const imageInputRef = useRef(null);
  const visibleThreads = activeCategory === "all" ? threads : threads.filter((thread) => thread.category === activeCategory);
  const draftLocation = form.location && typeof form.location === "object" ? form.location : null;
  const resolvedLocation = useReverseGeocodedLocation(draftLocation, Boolean(draftLocation));

  useEffect(() => () => {
    if (imagePreview && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  useEffect(() => {
    if (!draftLocation || !resolvedLocation.label || draftLocation.label === resolvedLocation.label) return;
    onFormChange((current) => ({
      ...current,
      location: current.location ? { ...current.location, label: resolvedLocation.label } : null,
    }));
  }, [draftLocation, onFormChange, resolvedLocation.label]);

  const publishThread = async () => {
    if (await createThread(imageFile)) {
      setComposerOpen(false);
      setImageFile(null);
      setImagePreview("");
      setImageError("");
      setLocationError("");
    }
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setImageFile(null);
    setImagePreview("");
    setImageError("");
    setLocationError("");
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Yalnızca görsel dosyası seçebilirsiniz.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError("Görsel en fazla 10 MB olabilir.");
      return;
    }
    setImageFile(file);
    setImageError("");
    setImagePreview(typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "");
  };

  const selectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Bu cihazda konum özelliği kullanılamıyor.");
      return;
    }
    setLocationPending(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onFormChange((current) => ({
          ...current,
          location: {
            accuracy: Math.round(coords.accuracy || 0),
            label: "Konum belirleniyor...",
            lat: Number(coords.latitude.toFixed(6)),
            lng: Number(coords.longitude.toFixed(6)),
          },
        }));
        setLocationPending(false);
      },
      (error) => {
        const messages = {
          1: "Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açabilirsiniz.",
          2: "Konumunuz belirlenemedi. GPS bağlantınızı kontrol edip tekrar deneyin.",
          3: "Konum belirleme zaman aşımına uğradı. Lütfen tekrar deneyin.",
        };
        setLocationError(messages[error.code] ?? "Konum eklenemedi. Lütfen tekrar deneyin.");
        setLocationPending(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
    );
  };

  return (
    <section className="-mx-1 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#0b0b0b] pb-3">
      <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 scrollbar-none">
        {categories.map((category) => (
          <button key={category.key} type="button" aria-label={category.label} onClick={() => setActiveCategory(category.key)} className={`relative min-h-14 shrink-0 px-3 text-[11px] font-bold transition active:scale-95 ${activeCategory === category.key ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
            <span>{category.tabLabel}</span>
            <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-lime-400 transition-opacity ${activeCategory === category.key ? "opacity-100" : "opacity-0"}`} />
          </button>
        ))}
      </div>

      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <ProfileAvatar src={user?.avatar} label={user?.fullName} className="h-11 w-11 rounded-full" />
          {!composerOpen ? (
            <button type="button" onClick={() => setComposerOpen(true)} className="min-h-12 flex-1 text-left text-base text-neutral-500 transition active:scale-[0.98]">
              Ne paylaşmak istersin?
            </button>
          ) : (
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <select value={form.category} onChange={(event) => onFormChange((current) => ({ ...current, category: event.target.value }))} className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#171717] px-3 text-sm">
                {categories.slice(1).map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
              </select>
              <button
                type="button"
                aria-label="Paylaşımı iptal et"
                title="Kapat"
                onClick={closeComposer}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 text-neutral-400 transition hover:border-rose-400/30 hover:text-rose-300 active:scale-90"
              >
                <ActionIcon><path d="m6 6 12 12M18 6 6 18" /></ActionIcon>
              </button>
            </div>
            <textarea value={form.body} onChange={(event) => onFormChange((current) => ({ ...current, body: event.target.value }))} rows={4} placeholder="Paylaşımını anlat *" className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-3 text-sm outline-none focus:border-lime-400" />
            {draftLocation ? (
              <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 text-xs text-sky-200">
                <span className="min-w-0 truncate">{resolvedLocation.label || draftLocation.label}</span>
                <button
                  type="button"
                  aria-label="Konumu kaldır"
                  onClick={() => onFormChange((current) => ({ ...current, location: null }))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sky-100 transition active:scale-90"
                >
                  <ActionIcon><path d="m6 6 12 12M18 6 6 18" /></ActionIcon>
                </button>
              </div>
            ) : null}
            {imagePreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <img src={imagePreview} alt="Seçilen paylaşım görseli" className="max-h-72 w-full object-cover" />
                <button
                  type="button"
                  aria-label="Seçilen görseli kaldır"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview("");
                  }}
                  className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/75 text-white backdrop-blur active:scale-90"
                >
                  <ActionIcon><path d="m6 6 12 12M18 6 6 18" /></ActionIcon>
                </button>
              </div>
            ) : null}
            {imageError ? <p role="alert" className="text-xs text-rose-300">{imageError}</p> : null}
            {locationError ? <p role="alert" className="text-xs text-rose-300">{locationError}</p> : null}
            {feedback ? <p role="alert" className="text-xs text-rose-300">{feedback}</p> : null}
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <div className="flex items-center gap-2">
                <input ref={imageInputRef} type="file" accept="image/*" onChange={selectImage} className="hidden" />
                <button
                  type="button"
                  aria-label="Görsel ekle"
                  title="Görsel ekle"
                  onClick={() => imageInputRef.current?.click()}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border transition active:scale-90 ${
                    imageFile ? "border-lime-400/40 bg-lime-400/10 text-lime-300" : "border-white/10 text-neutral-400 hover:text-white"
                  }`}
                >
                  <ActionIcon><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 4-4 3 3 2-2 5 4" /></ActionIcon>
                </button>
                <button
                  type="button"
                  aria-label={draftLocation ? "Konumu yenile" : "Konum ekle"}
                  title={draftLocation ? "Konumu yenile" : "Konum ekle"}
                  disabled={locationPending}
                  onClick={selectCurrentLocation}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border transition active:scale-90 disabled:opacity-50 ${
                    draftLocation ? "border-sky-400/40 bg-sky-400/10 text-sky-300" : "border-white/10 text-neutral-400 hover:text-white"
                  }`}
                >
                  <ActionIcon><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></ActionIcon>
                </button>
              </div>
              <button
                type="button"
                aria-label="Paylaş"
                title="Paylaş"
                disabled={pendingKey === "create"}
                onClick={publishThread}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-400 text-black shadow-[0_0_20px_rgba(163,230,53,0.32)] transition active:scale-90 disabled:opacity-50"
              >
                <ActionIcon><path d="m4 4 17 8-17 8 3-8-3-8Z" /><path d="M7 12h14" /></ActionIcon>
              </button>
            </div>
          </div>
          )}
        </div>
        {!composerOpen && feedback ? <p role="alert" className="ml-14 mt-2 text-xs text-rose-300">{feedback}</p> : null}
      </div>

      <div>
        {visibleThreads.map((thread) => <ThreadCard key={thread.id} onAddReply={addReply} onToggleLike={toggleLike} pendingKey={pendingKey} thread={thread} />)}
        {!visibleThreads.length ? <div className="p-8 text-center text-sm text-neutral-500">Bu kategoride henüz paylaşım yok. İlk paylaşımı sen yap.</div> : null}
      </div>
    </section>
  );
}
