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
  forum: (
    <>
      <path d="M5 5h14v11H9l-4 3Z" />
      <path d="M8 9h8M8 12h5" />
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

function CruiserRoadMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="h-10 w-10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 2.8 34 7.2v10.5c0 9-5.5 14.9-14 18.5-8.5-3.6-14-9.5-14-18.5V7.2Z" strokeWidth="1.5" opacity=".9" />

      <path d="M14.2 31.5c10-4.2 1.4-7.8 8.3-11.3 6.8-3.4 7-7.1 3.7-11.6" strokeWidth="2.1" />
      <path d="M23.8 32.2c9.4-6.6.6-9.2 6.1-12.8 5.1-3.3 4.3-7.8 1.4-11.2" strokeWidth="2.1" />
      <path d="M19.4 31.6c9.4-5.4 1-8.4 7.3-11.9 6-3.3 5.5-7.5 2.1-11.4" strokeWidth="1" strokeDasharray="2.2 2.8" opacity=".85" />

      <path d="M8.6 11.2h8.1v5.7H8.6Z" strokeWidth="1.5" />
      <path d="m10.2 11.2 1-1.8h2.9l1 1.8" strokeWidth="1.3" />
      <circle cx="12.7" cy="14.1" r="1.5" strokeWidth="1.3" />

      <path d="M31.6 20.4c0 2.7-3.4 6.2-3.4 6.2s-3.4-3.5-3.4-6.2a3.4 3.4 0 1 1 6.8 0Z" strokeWidth="1.5" />
      <circle cx="28.2" cy="20.3" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BottomNavigation({ activeTab, items, onSelect }) {
  return (
    <nav aria-label="Ana navigasyon" className="app-bottom-nav absolute left-1/2 z-20 w-[calc(100%-0.75rem)] max-w-[27rem] -translate-x-1/2 px-1.5 sm:w-[calc(100%-1.5rem)] sm:px-3">
      <div
        className="relative grid gap-1 overflow-visible rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_50%_-35%,rgba(163,230,53,0.13),transparent_34%),rgba(17,17,17,0.96)] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        style={{ gridTemplateColumns: items.map((item) => item.key === "forum" ? "1.35fr" : "1fr").join(" ") }}
      >
        {items.map((item) => {
          const isActive = activeTab === item.key;
          const isPrimary = item.key === "forum";
          return (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              data-primary-navigation={isPrimary ? "true" : undefined}
              title={item.label}
              onClick={() => onSelect(item.key)}
              className={`group relative mx-auto flex items-center justify-center transition duration-200 active:scale-90 ${
                isPrimary
                  ? `z-10 h-16 w-16 -translate-y-3.5 justify-self-center rounded-full border-2 ${
                      isActive
                        ? "border-lime-200 bg-lime-400 text-black shadow-[0_0_0_5px_rgba(10,10,10,0.95),0_0_32px_rgba(163,230,53,0.58)]"
                        : "border-lime-400/70 bg-[#171717] text-lime-300 shadow-[0_0_0_5px_rgba(10,10,10,0.95),0_0_22px_rgba(163,230,53,0.2)] hover:border-lime-300 hover:text-lime-200"
                    }`
                  : `min-h-12 w-full rounded-2xl ${
                      isActive
                        ? "bg-lime-400 text-black shadow-[0_0_20px_rgba(163,230,53,0.42)]"
                        : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
                    }`
              }`}
            >
              {isPrimary ? <CruiserRoadMark /> : <NavigationIcon name={item.key} />}
              <span className={`absolute h-0.5 rounded-full bg-current transition-all ${
                isPrimary ? "bottom-1.5" : "bottom-1"
              } ${isActive ? "w-3 opacity-70" : "w-0 opacity-0"}`} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
