import { useState } from "react";
import { MapCard } from "../components/MapCard";
import { MapComposerPanel } from "../components/MapComposerPanel";
import { PinPanel } from "../components/PinPanel";

function OverlayCard({ children, title, onClose }) {
  return (
    <div className="absolute inset-x-4 top-24 bottom-24 z-30 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d0d0d]/96 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur">
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
  clearDraftRoute,
  draftLocation,
  joinCruise,
  likeGalleryImage,
  likePin,
  loadSpotPhotoFile,
  mapPickMode,
  mapPinErrors,
  mapPinFeedback,
  mapPinForm,
  mapPins,
  onPickLocation,
  onSelectPin,
  onSetMapPickMode,
  onSetMapPinForm,
  onSetSpotPhotoForm,
  onSetWashForm,
  onSubmitMapPin,
  onSubmitSpotPhoto,
  onSubmitWashReview,
  onUseSelectedCoordinates,
  pickRouteBack,
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
    <section className="-mx-4 -my-4 flex min-h-[calc(95vh-9.25rem)] flex-col overflow-hidden">
      <div className="relative flex-1 overflow-hidden bg-[#050505]">
        <MapCard
          pins={mapPins}
          selectedPinId={selectedPinId}
          onSelect={(pinId) => {
            onSelectPin(pinId);
            setActiveOverlay("details");
          }}
          draftLocation={draftLocation}
          draftRoutePath={mapPinForm.routePoints}
          mapPickMode={mapPickMode}
          onPickLocation={onPickLocation}
          fullScreen
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-[linear-gradient(180deg,rgba(5,5,5,0.95),rgba(5,5,5,0.45),transparent)]" />

        <div className="absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-4">
          <div className="rounded-[1.6rem] border border-white/10 bg-black/55 px-4 py-3 backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.3em] text-lime-400">CRUISER MAP</p>
            <h3 className="mt-2 text-lg font-black text-white">Live Social Grid</h3>
            <p className="mt-1 text-xs text-neutral-400">Sadece harita. Tum etkileşimler popup uzerinden acilir.</p>
          </div>
          <div className="rounded-[1.6rem] border border-white/10 bg-black/55 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Nodes</p>
            <p className="mt-1 text-lg font-black text-lime-300">{mapPins.length}</p>
            <p className="text-xs text-neutral-400">{selectedPin?.name ?? "No selection"}</p>
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-6 z-20 flex items-end justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveOverlay("create")}
            className="min-h-12 rounded-[1.4rem] bg-lime-400 px-5 text-sm font-black text-black shadow-[0_0_24px_rgba(163,230,53,0.35)]"
          >
            Node Ekle
          </button>
          <div className="rounded-[1.4rem] border border-white/10 bg-black/55 px-4 py-3 text-right backdrop-blur">
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

        {activeOverlay === "create" ? (
          <OverlayCard title="Yeni Node Olustur" onClose={() => setActiveOverlay(null)}>
            <MapComposerPanel
              alwaysOpen
              draftLocation={draftLocation}
              feedback={mapPinFeedback}
              form={mapPinForm}
              errors={mapPinErrors}
              mapPickMode={mapPickMode}
              onClearRouteDraft={clearDraftRoute}
              onFormChange={onSetMapPinForm}
              onRemoveLastRoutePoint={pickRouteBack}
              onSetMapPickMode={onSetMapPickMode}
              onSubmit={onSubmitMapPin}
              onUseSelectedCoordinates={onUseSelectedCoordinates}
            />
          </OverlayCard>
        ) : null}
      </div>
    </section>
  );
}
