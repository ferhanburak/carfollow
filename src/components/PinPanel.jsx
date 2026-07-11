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
    <div className="rounded-[1.75rem] border border-white/10 bg-[#111111] p-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">Node Loading</p>
      <p className="mt-2 text-sm text-neutral-300">Pin detaylari hazirlaniyor...</p>
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
