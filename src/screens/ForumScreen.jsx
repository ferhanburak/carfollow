import { useState } from "react";

const categories = [
  { key: "all", label: "Tum Akis" },
  { key: "places", label: "Rota & Mekan" },
  { key: "builds", label: "Modifiye & Build" },
  { key: "technical", label: "Teknik Destek" },
  { key: "roadlife", label: "Road Life" },
];

const categoryMeta = Object.fromEntries(categories.map((category) => [category.key, category]));

function ThreadCard({ onAddReply, onToggleLike, pendingKey, thread }) {
  const [reply, setReply] = useState("");
  const [repliesOpen, setRepliesOpen] = useState(false);

  const submitReply = async () => {
    if (await onAddReply(thread.id, reply)) setReply("");
  };

  return (
    <article className="rounded-[1.6rem] border border-white/10 bg-[#111111] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-lime-300">
            {categoryMeta[thread.category]?.label ?? "Forum"}
          </span>
          <h3 className="mt-3 text-lg font-black text-white">{thread.title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{thread.authorName} / {thread.authorModel || thread.authorPlate}</p>
        </div>
        <span className="shrink-0 text-[10px] text-neutral-600">
          {thread.createdAt ? new Date(thread.createdAt).toLocaleDateString("tr-TR") : ""}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{thread.body}</p>
      {thread.location ? <p className="mt-3 rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">Konum: {thread.location}</p> : null}
      {thread.setup ? <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Setup: {thread.setup}</p> : null}
      {thread.vehicleKm ? <p className="mt-3 text-xs text-neutral-500">Arac KM: {Number(thread.vehicleKm).toLocaleString("tr-TR")}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pendingKey === `like:${thread.id}`}
          onClick={() => onToggleLike(thread.id)}
          className={`min-h-12 rounded-xl border px-3 text-xs font-semibold transition active:scale-[0.97] ${thread.likedByViewer ? "border-lime-400/30 bg-lime-400/15 text-lime-200" : "border-white/10 bg-white/5 text-neutral-300"}`}
        >
          {thread.likedByViewer ? "Faydali Bulundu" : "Faydali"} / {thread.likeCount ?? 0}
        </button>
        <button type="button" onClick={() => setRepliesOpen((current) => !current)} className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-neutral-300">
          Yanitlar / {thread.replyCount ?? thread.replies?.length ?? 0}
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
            {pendingKey === `reply:${thread.id}` ? "Gonderiliyor..." : "Yanitla"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function ForumScreen({ addReply, createThread, feedback, form, onFormChange, pendingKey, threads, toggleLike }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const visibleThreads = activeCategory === "all" ? threads : threads.filter((thread) => thread.category === activeCategory);

  return (
    <section className="space-y-4 pb-3">
      <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.14),transparent_45%),#111111] p-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">CRUISER COMMUNITY</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Forum</h2>
            <p className="mt-1 text-xs text-neutral-500">Rotalar, build'ler, teknik bilgi ve yol hayati.</p>
          </div>
          <button type="button" onClick={() => setComposerOpen((current) => !current)} className="min-h-12 rounded-2xl bg-lime-400 px-4 text-xs font-black text-black active:scale-95">
            {composerOpen ? "Kapat" : "Paylas"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button key={category.key} type="button" onClick={() => setActiveCategory(category.key)} className={`min-h-12 shrink-0 rounded-2xl border px-4 text-xs font-semibold ${activeCategory === category.key ? "border-lime-400/30 bg-lime-400 text-black" : "border-white/10 bg-[#111111] text-neutral-400"}`}>
            {category.label}
          </button>
        ))}
      </div>

      {composerOpen ? (
        <div className="rounded-[1.6rem] border border-lime-400/20 bg-[#111111] p-4">
          <p className="text-sm font-black">Yeni Paylasim</p>
          <div className="mt-4 space-y-3">
            <select value={form.category} onChange={(event) => onFormChange((current) => ({ ...current, category: event.target.value }))} className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm">
              {categories.slice(1).map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </select>
            <input value={form.title} onChange={(event) => onFormChange((current) => ({ ...current, title: event.target.value }))} placeholder="Baslik *" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm outline-none focus:border-lime-400" />
            <textarea value={form.body} onChange={(event) => onFormChange((current) => ({ ...current, body: event.target.value }))} rows={4} placeholder="Paylasimini anlat *" className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-3 text-sm outline-none focus:border-lime-400" />
            {form.category === "places" ? <input value={form.location} onChange={(event) => onFormChange((current) => ({ ...current, location: event.target.value }))} placeholder="Mekan veya rota" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm" /> : null}
            {form.category === "builds" ? <input value={form.setup} onChange={(event) => onFormChange((current) => ({ ...current, setup: event.target.value }))} placeholder="Parcalar ve setup" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm" /> : null}
            {form.category === "technical" ? <input type="number" min="0" value={form.vehicleKm} onChange={(event) => onFormChange((current) => ({ ...current, vehicleKm: event.target.value }))} placeholder="Arac kilometresi" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm" /> : null}
            {feedback ? <p className="text-xs text-rose-300">{feedback}</p> : null}
            <button type="button" disabled={pendingKey === "create"} onClick={createThread} className="min-h-12 w-full rounded-xl bg-lime-400 text-sm font-black text-black disabled:opacity-50">
              {pendingKey === "create" ? "Yayinlaniyor..." : "Foruma Yayinla"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {visibleThreads.map((thread) => <ThreadCard key={thread.id} onAddReply={addReply} onToggleLike={toggleLike} pendingKey={pendingKey} thread={thread} />)}
        {!visibleThreads.length ? <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-[#0d0d0d] p-7 text-center text-sm text-neutral-500">Bu kategoride henuz paylasim yok. Ilk paylasimi sen yap.</div> : null}
      </div>
    </section>
  );
}
