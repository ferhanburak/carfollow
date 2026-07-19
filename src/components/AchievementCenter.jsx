function AchievementBar({ achievement, compact = false }) {
  return (
    <div className={`${compact ? "mt-3 h-2" : "mt-4 h-3"} overflow-hidden rounded-full bg-white/8`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          achievement.unlocked ? "bg-lime-400" : achievement.percent >= 70 ? "bg-amber-400" : "bg-white/30"
        }`}
        style={{ width: `${achievement.percent}%` }}
      />
    </div>
  );
}

function AchievementCard({ achievement }) {
  const remaining = Math.max(0, Number(achievement.target ?? 0) - Number(achievement.current ?? 0));
  return (
    <div className={`rounded-[1.35rem] border p-4 ${achievement.unlocked ? "border-lime-400/20 bg-lime-400/[0.06]" : "border-white/8 bg-white/[0.03]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-100">{achievement.title}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">{achievement.description}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${achievement.unlocked ? "bg-lime-400/15 text-lime-200" : "bg-white/8 text-neutral-300"}`}>
          {achievement.unlocked ? "Tamam" : `%${achievement.percent}`}
        </span>
      </div>
      <AchievementBar achievement={achievement} />
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span>{achievement.current} / {achievement.target} {achievement.unit}</span>
        <span>{achievement.unlocked ? "Kazanildi" : `${remaining} ${achievement.unit} kaldi`}</span>
      </div>
    </div>
  );
}

function AchievementGroup({ achievements, emptyText, title }) {
  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-neutral-400">{achievements.length}</span>
      </div>
      <div className="mt-3 space-y-3">
        {achievements.length ? achievements.map((achievement) => <AchievementCard key={achievement.key} achievement={achievement} />) : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-neutral-500">{emptyText}</div>}
      </div>
    </div>
  );
}

export function AchievementProgressPanel({ achievements, isOpen, onClose, onOpen, status }) {
  const completed = achievements.filter((achievement) => achievement.unlocked);
  const remaining = achievements
    .filter((achievement) => !achievement.unlocked)
    .sort((left, right) => right.percent - left.percent);
  const featured = remaining[0] ?? [...completed].sort((left, right) => right.percent - left.percent)[0] ?? null;

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Basarim detaylarini ac"
        className="group w-full rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.13),transparent_46%),#111111] p-4 text-left transition hover:border-lime-400/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">Achievement Progress</p>
            <h3 className="mt-2 text-lg font-black">Basarimlar</h3>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-lime-300">{completed.length} / {achievements.length}</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-neutral-500">Kazanildi</p>
          </div>
        </div>

        {featured ? (
          <div className="mt-4 rounded-[1.35rem] border border-white/8 bg-black/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{remaining.length ? "Siradaki En Yakin" : "Tum Hedefler Tamam"}</p>
                <p className="mt-2 truncate text-sm font-bold text-neutral-100">{featured.title}</p>
              </div>
              <span className="shrink-0 rounded-full border border-lime-400/15 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">%{featured.percent}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-500">{featured.description}</p>
            <AchievementBar achievement={featured} compact />
            <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
              <span>{featured.current} / {featured.target} {featured.unit}</span>
              <span className="text-lime-300">Tumunu gor &rsaquo;</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-neutral-500">Basarim verisi bekleniyor.</div>
        )}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[45] bg-black/85 backdrop-blur-md md:p-4" role="dialog" aria-modal="true" aria-label="Basarim merkezi paneli">
          <section className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden border-white/10 bg-[#090909] shadow-[0_24px_90px_rgba(0,0,0,0.9)] md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:border">
            <header className="app-safe-top shrink-0 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.16),transparent_44%),#111111] px-4 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">DRIVER MILESTONES</p>
                  <h2 className="mt-1 text-lg font-black">Basarim Merkezi</h2>
                  <p className="mt-1 text-xs text-neutral-500">{completed.length} / {achievements.length} basarim tamamlandi</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Basarim merkezini kapat" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-xl text-neutral-300">&times;</button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className={`rounded-2xl border px-4 py-3 text-xs ${status?.state === "error" || status?.state === "degraded" ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-lime-400/20 bg-lime-400/10 text-lime-100"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span>Achievement source</span>
                  <span className="font-semibold uppercase tracking-[0.16em]">{status?.mode === "firebase" ? status.state : "demo"}</span>
                </div>
                {status?.error ? <p className="mt-2 text-amber-200">{status.error}</p> : null}
              </div>
              <AchievementGroup achievements={remaining} emptyText="Tum basarimlari tamamladin." title="Devam Edenler" />
              <AchievementGroup achievements={completed} emptyText="Henuz tamamlanan basarim yok." title="Tamamlananlar" />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
