const iconPaths = {
  map: (
    <>
      <path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20Z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  liveMap: (
    <>
      <path d="m5 19 5.2-14 3.1 6.1L19 14l-14 5Z" />
      <path d="m10.2 5 3.1 6.1" />
    </>
  ),
  drive: (
    <>
      <path d="M4.5 17a8 8 0 1 1 15 0" />
      <path d="m12 13 4-4" />
      <path d="M8 17h8" />
    </>
  ),
  social: (
    <>
      <path d="M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3" />
      <path d="M16 11a2.5 2.5 0 1 0 0-5M18 14.5a3 3 0 0 1 2 2.8V19" />
    </>
  ),
  leaderboard: (
    <>
      <path d="M5 20v-6h4v6M10 20V8h4v12M15 20V4h4v16" />
      <path d="M3 20h18" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
};

function NavigationIcon({ name }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1.35rem] w-[1.35rem]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      {iconPaths[name]}
    </svg>
  );
}

export function BottomNavigation({ activeTab, items, onSelect }) {
  return (
    <nav aria-label="Ana navigasyon" className="app-bottom-nav absolute left-1/2 z-20 w-[calc(100%-0.75rem)] max-w-[27rem] -translate-x-1/2 px-1.5 sm:w-[calc(100%-1.5rem)] sm:px-3">
      <div
        className="grid gap-1 rounded-[1.4rem] border border-white/10 bg-[#111111]/95 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              title={item.label}
              onClick={() => onSelect(item.key)}
              className={`group relative flex min-h-12 w-full items-center justify-center rounded-2xl transition duration-200 active:scale-90 ${
                isActive
                  ? "bg-lime-400 text-black shadow-[0_0_20px_rgba(163,230,53,0.42)]"
                  : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
              }`}
            >
              <NavigationIcon name={item.key} />
              <span className={`absolute bottom-1 h-0.5 rounded-full bg-current transition-all ${isActive ? "w-3 opacity-70" : "w-0 opacity-0"}`} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
