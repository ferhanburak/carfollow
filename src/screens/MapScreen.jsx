import { useState } from "react";
import { MapCard } from "../components/MapCard";
import { PinPanel } from "../components/PinPanel";

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

        <div className="absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-4">
          <div className="max-w-[72%] rounded-[1.6rem] border border-white/10 bg-black/55 px-4 py-3 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.3em] text-lime-400">CRUISER DRIVE MAP</p>
            <h3 className="mt-2 text-lg font-black text-white">CarPlay Style Live View</h3>
            <p className="mt-1 text-xs text-neutral-400">
              Node ekleme kapali. Bu ekran sadece canli konum, rota ve mevcut node popup akisi icin.
            </p>
          </div>
          <div className="min-w-[6.5rem] rounded-[1.6rem] border border-white/10 bg-black/55 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Nodes</p>
            <p className="mt-1 text-lg font-black text-lime-300">{mapPins.length}</p>
            <p className="text-xs text-neutral-400">{selectedPin?.type ?? "tracking"}</p>
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-24 z-20 flex items-end justify-between gap-3">
          <div className="min-w-[9rem] rounded-[1.5rem] border border-lime-400/20 bg-black/60 px-4 py-3 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.26em] text-neutral-500">Drive HUD</p>
            <p className="mt-1 text-lg font-black text-lime-300">{driveHud.speed} KM/H</p>
            <p className="text-xs text-neutral-400">
              {isDriving ? `${driveHud.sessionKm.toFixed(1)} km session` : "Tracking ready"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectedPin && setActiveOverlay("details")}
            className="rounded-[1.5rem] border border-white/10 bg-black/60 px-4 py-3 text-right backdrop-blur"
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Selected</p>
            <p className="mt-1 text-sm font-semibold text-white">{selectedPin?.name ?? "Marker sec"}</p>
            <p className="text-xs text-neutral-400">
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
