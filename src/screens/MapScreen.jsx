import { useState } from "react";
import { MapCard } from "../components/MapCard";
import { PinPanel } from "../components/PinPanel";

function buildNavigationSummary(selectedPin, driveHud, isDriving) {
  if (selectedPin?.type !== "meet") {
    return {
      instruction: "Yakindaki node'lari incele",
      nextLeg: "Serbest surus",
      eta: isDriving ? "Canli takip acik" : "Takip hazir",
      distance: `${driveHud.sessionKm.toFixed(1)} km`,
      arrow: "↑",
    };
  }

  const routeStops = selectedPin.route
    .split("->")
    .map((stop) => stop.trim())
    .filter(Boolean);
  const nextLeg = routeStops[1] ?? routeStops[0] ?? "Cruise route";
  const instruction = routeStops.length > 1 ? `${nextLeg} yonune devam et` : "Cruise noktasina ilerle";
  const distance = `${Math.max(1, routeStops.length * 2)}.${routeStops.length} km`;
  const etaMinutes = Math.max(4, routeStops.length * 3 + Math.round(driveHud.sessionKm));

  return {
    instruction,
    nextLeg,
    eta: `${etaMinutes} dk`,
    distance,
    arrow: "↗",
  };
}

function OverlayCard({ children, title, onClose }) {
  return (
    <div className="absolute inset-x-3 top-20 bottom-20 z-30 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d0d0d]/96 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur md:inset-x-4 md:top-24 md:bottom-24">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.26em] text-lime-400">Popup</p>
          <h3 className="mt-1 text-lg font-black text-white">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-semibold text-neutral-300"
        >
          Kapat
        </button>
      </div>
      <div className="h-[calc(100%-5.25rem)] overflow-y-auto px-4 py-4">{children}</div>
    </div>
  );
}

export function MapScreen({
  driveHud,
  isDriving,
  joinCruise,
  likeGalleryImage,
  likePin,
  loadSpotPhotoFile,
  mapPins,
  onSelectPin,
  onSetSpotPhotoForm,
  onSetWashForm,
  onSubmitSpotPhoto,
  onSubmitWashReview,
  rateAttendee,
  selectedPin,
  selectedPinId,
  spotPhotoErrors,
  spotPhotoFeedback,
  spotPhotoForm,
  submitWashReview,
  user,
  washForm,
  washErrors,
  washFeedback,
}) {
  const [activeOverlay, setActiveOverlay] = useState(null);
  const navigationSummary = buildNavigationSummary(selectedPin, driveHud, isDriving);

  return (
    <section
      className="relative flex flex-col overflow-hidden bg-[#050505]"
      style={{ height: "calc(95vh - 18rem)", minHeight: "calc(95vh - 18rem)" }}
    >
      <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-[#050505]">
        <MapCard
          pins={mapPins}
          selectedPinId={selectedPinId}
          onSelect={(pinId) => {
            onSelectPin(pinId);
            setActiveOverlay("details");
          }}
          draftRoutePath={[]}
          fullScreen
          navigationMode
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-[linear-gradient(180deg,rgba(5,5,5,0.95),rgba(5,5,5,0.45),transparent)]" />

        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-3">
          <div className="max-w-[68%] rounded-[1.4rem] border border-white/10 bg-black/45 px-3 py-2.5 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.3em] text-lime-400">CRUISER DRIVE MAP</p>
            <h3 className="mt-1.5 text-base font-black text-white">CarPlay Style Live View</h3>
            <p className="mt-1 text-[11px] text-neutral-400">Canli konum, rota ve mevcut node popup akisi.</p>
          </div>
          <div className="min-w-[5.5rem] rounded-[1.4rem] border border-white/10 bg-black/45 px-3 py-2.5 text-right backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Nodes</p>
            <p className="mt-1 text-base font-black text-lime-300">{mapPins.length}</p>
            <p className="text-[11px] text-neutral-400">{selectedPin?.type ?? "tracking"}</p>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-4 bottom-24 z-20 flex items-end justify-between gap-3">
          <div className="min-w-[8rem] rounded-[1.3rem] border border-lime-400/20 bg-black/50 px-3 py-2.5 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.26em] text-neutral-500">Drive HUD</p>
            <p className="mt-1 text-base font-black text-lime-300">{driveHud.speed} KM/H</p>
            <p className="text-[11px] text-neutral-400">
              {isDriving ? `${driveHud.sessionKm.toFixed(1)} km session` : "Tracking ready"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectedPin && setActiveOverlay("details")}
            className="pointer-events-auto rounded-[1.3rem] border border-white/10 bg-black/50 px-3 py-2.5 text-right backdrop-blur"
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Selected</p>
            <p className="mt-1 text-sm font-semibold text-white">{selectedPin?.name ?? "Marker sec"}</p>
            <p className="text-[11px] text-neutral-400">
              {selectedPin?.type === "meet"
                ? "Event popup"
                : selectedPin?.type === "wash"
                  ? "Wash popup"
                  : selectedPin?.type === "spot"
                    ? "Spot popup"
                    : "Popup hazir"}
            </p>
          </button>
        </div>

        <div className="pointer-events-none absolute inset-x-4 bottom-3 z-20">
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-[1.6rem] border border-white/10 bg-[#0b0b0b]/82 px-3 py-3 backdrop-blur">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-lime-400 text-2xl font-black text-black shadow-[0_0_22px_rgba(163,230,53,0.3)]">
              {navigationSummary.arrow}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Navigation</p>
              <p className="mt-1 truncate text-sm font-bold text-white">{navigationSummary.instruction}</p>
              <p className="mt-1 truncate text-[11px] text-neutral-400">
                {navigationSummary.nextLeg} · {navigationSummary.distance}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">ETA</p>
              <p className="mt-1 text-base font-black text-lime-300">{navigationSummary.eta}</p>
              <p className="text-[11px] text-neutral-400">{isDriving ? "Surus aktif" : "Rota hazir"}</p>
            </div>
          </div>
        </div>

        {activeOverlay === "details" && selectedPin ? (
          <OverlayCard title={selectedPin.name} onClose={() => setActiveOverlay(null)}>
            <PinPanel
              pin={selectedPin}
              user={user}
              spotPhotoErrors={spotPhotoErrors}
              spotPhotoFeedback={spotPhotoFeedback}
              spotPhotoForm={spotPhotoForm}
              washForm={washForm}
              washErrors={washErrors}
              washFeedback={washFeedback}
              onJoinCruise={joinCruise}
              onLikeGallery={likeGalleryImage}
              onLikePin={likePin}
              onRateAttendee={rateAttendee}
              onSpotPhotoFileChange={loadSpotPhotoFile}
              onSpotPhotoFormChange={onSetSpotPhotoForm}
              onSubmitSpotPhoto={onSubmitSpotPhoto}
              onSubmitWashReview={submitWashReview ?? onSubmitWashReview}
              onWashFormChange={onSetWashForm}
            />
          </OverlayCard>
        ) : null}
      </div>
    </section>
  );
}
