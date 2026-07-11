import { lazy, Suspense, useMemo } from "react";

const SpotPinPanel = lazy(() =>
  import("./pin-panels/SpotPinPanel").then((module) => ({ default: module.SpotPinPanel })),
);
const WashPinPanel = lazy(() =>
  import("./pin-panels/WashPinPanel").then((module) => ({ default: module.WashPinPanel })),
);
const MeetPinPanel = lazy(() =>
  import("./pin-panels/MeetPinPanel").then((module) => ({ default: module.MeetPinPanel })),
);

function PinPanelLoader() {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(163,230,53,0.12),transparent_42%),linear-gradient(180deg,#131313,#0d0d0d)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">Node Loading</p>
          <p className="mt-2 text-sm text-neutral-300">Pin detaylari hazirlaniyor...</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-lime-300/40 border-t-lime-300" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-white/8" />
        <div className="h-16 animate-pulse rounded-[1.15rem] bg-white/[0.04]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-14 animate-pulse rounded-[1rem] bg-white/[0.04]" />
          <div className="h-14 animate-pulse rounded-[1rem] bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

export function PinPanel(props) {
  const { pin } = props;

  const PanelComponent = useMemo(() => {
    if (!pin) {
      return null;
    }

    if (pin.type === "spot") {
      return SpotPinPanel;
    }

    if (pin.type === "wash") {
      return WashPinPanel;
    }

    return MeetPinPanel;
  }, [pin]);

  if (!pin || !PanelComponent) {
    return null;
  }

  return (
    <Suspense fallback={<PinPanelLoader />}>
      <PanelComponent {...props} />
    </Suspense>
  );
}
