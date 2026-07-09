import { useMemo, useState } from "react";
import { MapCard } from "../components/MapCard";
import { MapComposerPanel } from "../components/MapComposerPanel";
import { PinPanel } from "../components/PinPanel";

const sheetTabs = [
  { key: "details", label: "Detaylar" },
  { key: "create", label: "Olustur" },
];

const sheetModes = [
  { key: "compact", label: "Mini" },
  { key: "medium", label: "Orta" },
  { key: "expanded", label: "Tam" },
];

const sheetModeClasses = {
  compact: "h-[25vh]",
  medium: "h-[48vh]",
  expanded: "h-[74vh]",
};

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
  const [sheetTab, setSheetTab] = useState("details");
  const [sheetMode, setSheetMode] = useState("medium");

  const summaryText = useMemo(() => {
    if (!selectedPin) {
      return "No selection";
    }

    if (selectedPin.type === "meet") {
      return `${selectedPin.attendees.length} convoy member`;
    }

    if (selectedPin.type === "spot") {
      return `${selectedPin.gallery.length} gallery shot`;
    }

    return `${selectedPin.reviews.length} live review`;
  }, [selectedPin]);

  return (
    <section className="-mx-4 -my-4 flex min-h-[calc(95vh-9.25rem)] flex-col overflow-hidden">
      <div className="relative flex-1 overflow-hidden bg-[#050505]">
        <MapCard
          pins={mapPins}
          selectedPinId={selectedPinId}
          onSelect={onSelectPin}
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
            <p className="mt-1 text-xs text-neutral-400">Etkinlikler, photo spotlar ve wash node'lari tek ekranda.</p>
          </div>
          <div className="rounded-[1.6rem] border border-white/10 bg-black/55 px-4 py-3 text-right backdrop-blur">
            <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Nodes</p>
            <p className="mt-1 text-lg font-black text-lime-300">{mapPins.length}</p>
            <p className="text-xs text-neutral-400">{selectedPin?.name ?? "No selection"}</p>
          </div>
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 z-20 rounded-t-[2rem] border-t border-white/10 bg-[#0c0c0c]/96 px-4 pb-6 pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.55)] backdrop-blur transition-[height] duration-300 ${sheetModeClasses[sheetMode]}`}
        >
          <div className="mx-auto h-1.5 w-16 rounded-full bg-white/10" />

          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Bottom Sheet</p>
              <p className="mt-1 text-sm font-semibold text-neutral-100">{selectedPin?.name ?? "Map Controls"}</p>
              <p className="text-xs text-neutral-500">{summaryText}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/8 bg-black/20 p-1.5">
              {sheetModes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setSheetMode(mode.key)}
                  className={`min-h-10 rounded-xl px-3 text-[11px] font-bold transition ${
                    sheetMode === mode.key ? "bg-lime-400 text-black" : "text-neutral-400"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 rounded-3xl border border-white/8 bg-black/20 p-2">
            {sheetTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSheetTab(tab.key)}
                className={`min-h-12 rounded-2xl px-3 text-sm font-bold transition ${
                  sheetTab === tab.key ? "bg-lime-400 text-black" : "text-neutral-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={`mt-4 overflow-y-auto pr-1 ${sheetMode === "compact" ? "max-h-[10vh]" : sheetMode === "medium" ? "max-h-[31vh]" : "max-h-[57vh]"}`}>
            {sheetTab === "details" ? (
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
            ) : null}

            {sheetTab === "create" ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
