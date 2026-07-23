import { useState } from "react";
import { ProfileAvatar } from "../components/ProfileAvatar";

const categories = [
  { key: "all", label: "Tum Akis", tabLabel: "Tumu" },
  { key: "places", label: "Rota & Mekan", tabLabel: "Rota" },
  { key: "builds", label: "Modifiye & Build", tabLabel: "Modifiye" },
  { key: "technical", label: "Teknik Destek", tabLabel: "Teknik" },
  { key: "roadlife", label: "Road Life", tabLabel: "Hayat" },
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
      <h3 className="mt-3 text-base font-black text-white">{thread.title}</h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{thread.body}</p>
      {thread.location ? <p className="mt-3 rounded-xl border border-sky-400/15 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">Konum: {thread.location}</p> : null}
      {thread.setup ? <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Setup: {thread.setup}</p> : null}
      {thread.vehicleKm ? <p className="mt-3 text-xs text-neutral-500">Arac KM: {Number(thread.vehicleKm).toLocaleString("tr-TR")}</p> : null}
      <div className="mt-4 flex items-center gap-7 text-neutral-500">
        <button
          type="button"
          disabled={pendingKey === `like:${thread.id}`}
          onClick={() => onToggleLike(thread.id)}
          aria-label={thread.likedByViewer ? "Faydali isaretini kaldir" : "Faydali bul"}
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
            {pendingKey === `reply:${thread.id}` ? "Gonderiliyor..." : "Yanitla"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function ForumScreen({ addReply, createThread, feedback, form, onFormChange, pendingKey, threads, toggleLike, user }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const visibleThreads = activeCategory === "all" ? threads : threads.filter((thread) => thread.category === activeCategory);

  const publishThread = async () => {
    if (await createThread()) setComposerOpen(false);
  };

  return (
    <section className="-mx-1 overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#0b0b0b] pb-3">
      <div className="grid grid-cols-5 border-b border-white/10 px-1">
        {categories.map((category) => (
          <button key={category.key} type="button" aria-label={category.label} onClick={() => setActiveCategory(category.key)} className={`relative min-h-14 min-w-0 px-1 text-[10px] font-bold transition min-[390px]:text-[11px] active:scale-95 ${activeCategory === category.key ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}>
            <span className="block truncate">{category.tabLabel}</span>
            <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-lime-400 transition-opacity ${activeCategory === category.key ? "opacity-100" : "opacity-0"}`} />
          </button>
        ))}
      </div>

      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-start gap-3">
          <ProfileAvatar src={user?.avatar} label={user?.fullName} className="h-11 w-11 rounded-full" />
          <button type="button" onClick={() => setComposerOpen(true)} className="min-h-12 flex-1 text-left text-base text-neutral-500 transition active:scale-[0.98]">
            Ne paylasmak istersin?
          </button>
        </div>
        {composerOpen ? (
          <div className="ml-14 mt-1 space-y-3">
            <select value={form.category} onChange={(event) => onFormChange((current) => ({ ...current, category: event.target.value }))} className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm">
              {categories.slice(1).map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </select>
            <input value={form.title} onChange={(event) => onFormChange((current) => ({ ...current, title: event.target.value }))} placeholder="Baslik *" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm outline-none focus:border-lime-400" />
            <textarea value={form.body} onChange={(event) => onFormChange((current) => ({ ...current, body: event.target.value }))} rows={4} placeholder="Paylasimini anlat *" className="w-full rounded-xl border border-white/10 bg-[#171717] px-3 py-3 text-sm outline-none focus:border-lime-400" />
            {form.category === "places" ? <input value={form.location} onChange={(event) => onFormChange((current) => ({ ...current, location: event.target.value }))} placeholder="Mekan veya rota" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm" /> : null}
            {form.category === "builds" ? <input value={form.setup} onChange={(event) => onFormChange((current) => ({ ...current, setup: event.target.value }))} placeholder="Parcalar ve setup" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm" /> : null}
            {form.category === "technical" ? <input type="number" min="0" value={form.vehicleKm} onChange={(event) => onFormChange((current) => ({ ...current, vehicleKm: event.target.value }))} placeholder="Arac kilometresi" className="h-12 w-full rounded-xl border border-white/10 bg-[#171717] px-3 text-sm" /> : null}
            {feedback ? <p className="text-xs text-rose-300">{feedback}</p> : null}
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <button type="button" onClick={() => setComposerOpen(false)} className="min-h-12 px-2 text-xs font-bold text-neutral-500 transition hover:text-white active:scale-90">Vazgec</button>
              <button type="button" disabled={pendingKey === "create"} onClick={publishThread} className="min-h-12 rounded-full bg-lime-400 px-5 text-sm font-black text-black transition active:scale-95 disabled:opacity-50">
                {pendingKey === "create" ? "Yayinlaniyor..." : "Paylas"}
              </button>
            </div>
          </div>
        ) : null}
        {!composerOpen && feedback ? <p className="ml-14 mt-2 text-xs text-rose-300">{feedback}</p> : null}
      </div>

      <div>
        {visibleThreads.map((thread) => <ThreadCard key={thread.id} onAddReply={addReply} onToggleLike={toggleLike} pendingKey={pendingKey} thread={thread} />)}
        {!visibleThreads.length ? <div className="p-8 text-center text-sm text-neutral-500">Bu kategoride henuz paylasim yok. Ilk paylasimi sen yap.</div> : null}
      </div>
    </section>
  );
}
