import { useMemo, useState } from "react";
import { MapCard } from "../components/MapCard";
import { PinPanel } from "../components/PinPanel";

function buildNavigationSummary(selectedPin, driveHud, isDriving) {
  if (selectedPin?.type !== "meet") {
    return {
      title: selectedPin?.name ?? "Serbest surus",
      subtitle: selectedPin ? "Popup icin marker'a dokun" : "Yakindaki markerlari incele",
      eta: isDriving ? "Canli" : "Hazir",
    };
  }

  const stops = selectedPin.route
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    title: stops[1] ? `${stops[1]} yonune devam et` : "Cruise rotasi aktif",
    subtitle: `${selectedPin.time} · ${selectedPin.attendees.length} katilimci`,
    eta: `${Math.max(4, Math.round(driveHud.sessionKm) + stops.length * 3)} dk`,
  };
}

function OverlayCard({ children, title, onClose }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/45 px-3 pb-3 pt-14 backdrop-blur-[2px]">
      <div className="w-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#0d0d0d]/96 shadow-[0_24px_80px_rgba(0,0,0,0.58)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-lime-400">Popup</p>
            <h3 className="mt-1 text-base font-black text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl border border-white/10 bg-black/25 px-3 text-xs font-semibold text-neutral-300 transition hover:border-lime-400/30 hover:text-white"
          >
            Kapat
          </button>
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-4 py-4">{children}</div>
      </div>
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
  toggleDrive,
  user,
  washForm,
  washErrors,
  washFeedback,
}) {
  const [activeOverlay, setActiveOverlay] = useState(null);
  const navigation = useMemo(
    () => buildNavigationSummary(selectedPin, driveHud, isDriving),
    [selectedPin, driveHud, isDriving],
  );

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#050505] px-3 py-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 rounded-[1rem] border border-white/10 bg-black/35 px-3 py-2 backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.28em] text-lime-400">CRUISER LIVE MAP</p>
          <p className="mt-1 truncate text-sm font-black text-white">{user.plate}</p>
          <p className="text-[10px] text-neutral-400">{user.region}</p>
        </div>
        <button
          type="button"
          onClick={toggleDrive}
          className={`min-h-9 rounded-[0.95rem] px-3 text-[11px] font-bold transition ${
            isDriving
              ? "bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.36)]"
              : "bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.3)]"
          }`}
        >
          {isDriving ? "Durdur" : "Baslat"}
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <MapCard
          pins={mapPins}
          selectedPinId={selectedPinId}
          onSelect={(pinId) => {
            onSelectPin(pinId);
            setActiveOverlay("details");
          }}
          draftRoutePath={[]}
          navigationMode
          mapHeight="calc(95vh - 14.5rem)"
        />

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

      <div className="mt-3 rounded-[1rem] border border-white/10 bg-[#0b0b0b]/66 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{navigation.title}</p>
            <p className="truncate text-[10px] text-neutral-400">{navigation.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">ETA</p>
            <p className="mt-0.5 text-sm font-black text-lime-300">{navigation.eta}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
