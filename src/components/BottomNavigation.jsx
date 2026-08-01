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
    <img
      aria-hidden="true"
      alt=""
      src="/cruiser-road-mark.png"
      className="h-[3.35rem] w-[3.35rem] object-contain drop-shadow-[0_0_10px_rgba(163,230,53,0.72)]"
    />
  );
}

export function BottomNavigation({ activeTab, items, onSelect }) {
  const { t } = useLanguage();
  const labels = {
    map: t('nav.map'),
    liveMap: t('nav.liveMap'),
    drive: t('nav.drive'),
    forum: t('nav.forum'),
    social: t('nav.social'),
    leaderboard: t('nav.leaderboard'),
    profile: t('nav.profile'),
  };
  return (
    <nav aria-label={t('nav.label')} className="app-bottom-nav absolute left-1/2 z-20 w-[calc(100%-0.75rem)] max-w-[27rem] -translate-x-1/2 px-1.5 sm:w-[calc(100%-1.5rem)] sm:px-3">
      <div
        className="relative grid gap-1 overflow-visible rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_50%_-35%,rgba(163,230,53,0.13),transparent_34%),rgba(17,17,17,0.96)] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        style={{ gridTemplateColumns: items.map((item) => item.key === "forum" ? "1.35fr" : "1fr").join(" ") }}
      >
        {items.map((item) => {
          const isActive = activeTab === item.key;
          const isPrimary = item.key === "forum";
          const label = labels[item.key] ?? item.label;
          return (
            <button
              key={item.key}
              type="button"
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              data-primary-navigation={isPrimary ? "true" : undefined}
              title={label}
              onClick={() => onSelect(item.key)}
              className={`group relative mx-auto flex items-center justify-center transition duration-200 active:scale-90 ${
                isPrimary
                  ? `z-10 h-16 w-16 -translate-y-3.5 justify-self-center rounded-full border-2 ${
                      isActive
                        ? "border-lime-200 bg-[#050505] text-lime-300 shadow-[0_0_0_5px_rgba(10,10,10,0.95),0_0_34px_rgba(163,230,53,0.68)]"
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
import { useLanguage } from "../providers/LanguageProvider";
