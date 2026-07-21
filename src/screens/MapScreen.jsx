import { useMemo, useState } from "react";
import { MapCard } from "../components/MapCard";
import { PinPanel } from "../components/PinPanel";
import { getConvoyAccessState } from "../utils/meetVisibility";

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getRouteDistanceKm(routePath = []) {
  if (!Array.isArray(routePath) || routePath.length < 2) {
    return 0;
  }

  let totalKm = 0;

  for (let index = 1; index < routePath.length; index += 1) {
    const start = routePath[index - 1];
    const end = routePath[index];
    const latDelta = toRadians(end.lat - start.lat);
    const lngDelta = toRadians(end.lng - start.lng);
    const startLat = toRadians(start.lat);
    const endLat = toRadians(end.lat);
    const haversine =
      Math.sin(latDelta / 2) ** 2 +
      Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
    const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    totalKm += 6371 * arc;
  }

  return Number(totalKm.toFixed(1));
}

function getLiveRouteMetrics(selectedPin, driveHud, isDriving) {
  const totalKm = getRouteDistanceKm(selectedPin?.routePath ?? []);
  const traveledKm = isDriving ? Math.min(totalKm || driveHud.sessionKm, driveHud.sessionKm) : 0;
  const remainingKm = totalKm > 0 ? Math.max(0, Number((totalKm - traveledKm).toFixed(1))) : 0;
  const liveSpeed = Math.max(0, Number(driveHud.speed || 0));
  const etaMinutes = remainingKm > 0 && liveSpeed >= 1
    ? Math.max(1, Math.round((remainingKm / liveSpeed) * 60))
    : null;
  const progress = totalKm > 0 ? Math.min(100, Math.round((traveledKm / totalKm) * 100)) : 0;

  return {
    etaMinutes,
    progress,
    remainingKm,
    totalKm,
    traveledKm: Number(traveledKm.toFixed(1)),
  };
}

function buildNavigationSummary(selectedPin, driveHud, isDriving, user) {
  if (selectedPin?.type !== "meet") {
    return {
      title: selectedPin?.name ?? "Serbest surus",
      subtitle: selectedPin ? "Popup icin marker'a dokun" : "Yakindaki markerlari incele",
      eta: isDriving ? "Canli" : "Hazir",
    };
  }

  const accessState = getConvoyAccessState(selectedPin, user);
  if (!accessState.canViewDetails) {
    return {
      title: "Restricted convoy",
      subtitle: "Detaylar guven kurallari nedeniyle gizli",
      eta: "Locked",
    };
  }

  const stops = selectedPin.route
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean);
  const routeMetrics = getLiveRouteMetrics(selectedPin, driveHud, isDriving);

  return {
    title: isDriving
      ? stops[1]
        ? `${stops[1]} yonune devam et`
        : "Cruise rotasi aktif"
      : selectedPin.name,
    subtitle: isDriving
      ? `${driveHud.etaNode} · ${routeMetrics.remainingKm.toFixed(1)} km kaldi`
      : `${selectedPin.time} · ${selectedPin.attendees.length} katilimci`,
    eta: isDriving
      ? routeMetrics.etaMinutes ? `${routeMetrics.etaMinutes} dk` : "GPS bekleniyor"
      : `${Math.max(4, stops.length * 3)} dk`,
  };
}

function getLifecycleLabel(value) {
  if (value === "rolling") {
    return "Basladi";
  }
  if (value === "delayed") {
    return "Gecikiyor";
  }
  if (value === "completed") {
    return "Tamamlandi";
  }
  if (value === "cancelled") {
    return "Iptal Edildi";
  }

  return "Hazirlaniyor";
}

function summarizeTripStatuses(attendees = []) {
  return attendees.reduce(
    (summary, attendee) => {
      const tripStatus = attendee.tripStatus ?? "ready";

      if (tripStatus === "enroute") {
        summary.enroute += 1;
      } else if (tripStatus === "arrived") {
        summary.arrived += 1;
      } else if (tripStatus === "cancelled") {
        summary.cancelled += 1;
      } else {
        summary.ready += 1;
      }

      return summary;
    },
    { ready: 0, enroute: 0, arrived: 0, cancelled: 0 },
  );
}

function buildConvoyTimeline(pin, user, driveHud, isDriving) {
  if (pin?.type !== "meet") {
    return null;
  }

  const accessState = getConvoyAccessState(pin, user);
  if (!accessState.canViewDetails) {
    return {
      locked: true,
      title: "Restricted convoy",
      subtitle: accessState.reason,
      progress: 0,
      segments: [
        { label: "Hazir", value: 0 },
        { label: "Yolda", value: 0 },
        { label: "Vardi", value: 0 },
      ],
    };
  }

  const attendees = pin.attendees ?? [];
  const summary = summarizeTripStatuses(attendees);
  const routeMetrics = getLiveRouteMetrics(pin, driveHud, isDriving);
  const activeCrew = attendees.length - summary.cancelled;
  const statusProgress =
    activeCrew > 0
      ? Math.min(
          100,
          Math.round(((summary.arrived + summary.enroute * 0.55 + summary.ready * 0.2) / activeCrew) * 100),
        )
      : 0;
  const progress = isDriving && routeMetrics.totalKm > 0 ? routeMetrics.progress : statusProgress;

  return {
    locked: false,
    title: `${getLifecycleLabel(pin.lifecycleStatus)} · ${attendees.length} surucu`,
    subtitle: isDriving
      ? `${driveHud.etaNode} · ${routeMetrics.remainingKm.toFixed(1)} km kaldi · ${
        routeMetrics.etaMinutes ? `ETA ${routeMetrics.etaMinutes} dk` : "ETA icin hareket bekleniyor"
      }`
      : `${pin.route} · ${pin.time}`,
    progress,
    metrics: routeMetrics,
    segments: [
      { label: "Hazir", value: summary.ready },
      { label: "Yolda", value: summary.enroute },
      { label: "Vardi", value: summary.arrived },
      { label: "Iptal", value: summary.cancelled },
    ],
  };
}

function OverlayCard({ children, title, onClose }) {
  return (
    <div data-testid="live-map-node-overlay" onClick={onClose} className="absolute inset-0 z-40 flex items-end bg-black/60 p-3 pt-12 backdrop-blur-[3px]">
      <div onClick={(event) => event.stopPropagation()} className="flex max-h-full w-full flex-col overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#0d0d0d]/98 shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
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
        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function MapScreen({
  convoyFeedback,
  convoyTracking,
  currentClanMembers,
  drivers,
  driveHud,
  driveSessionStatus,
  headerActions,
  isDriving,
  joinCruise,
  likeGalleryImage,
  likePin,
  loadSpotPhotoFile,
  liveLocation,
  mapPins,
  onGhostOpenConversation,
  onGhostOpenProfile,
  onGhostRequestFriend,
  onApproveCruiseJoinRequest,
  onDeclineCruiseJoinRequest,
  onDeleteSpotPhoto,
  onReportSpotPhoto,
  onRemoveConvoyMember,
  onSelectPin,
  onSetAttendeeTripStatus,
  onSetConvoyLifecycleStatus,
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
  const navigation = useMemo(
    () => buildNavigationSummary(selectedPin, driveHud, isDriving, user),
    [selectedPin, driveHud, isDriving, user],
  );
  const convoyTimeline = useMemo(
    () => buildConvoyTimeline(selectedPin, user, driveHud, isDriving),
    [selectedPin, user, driveHud, isDriving],
  );
  const overlayTitle =
    selectedPin?.type === "meet" && !getConvoyAccessState(selectedPin, user).canViewDetails
      ? "Restricted Convoy"
      : selectedPin?.name;
  const liveStatusLabel = isDriving ? "Canli rota acik" : "Harita izleme";
  const selectedLabel = selectedPin ? selectedPin.name : "Marker secilmedi";
  const accessLabel =
    selectedPin?.type === "meet"
      ? getConvoyAccessState(selectedPin, user).canViewDetails
        ? "Convoy acik"
        : "Convoy kilitli"
      : selectedPin
        ? "Node secili"
        : "Serbest mod";

  return (
    <section data-testid="live-map-screen" className="live-map-screen relative flex h-full min-h-0 flex-col overflow-hidden bg-[#050505] px-3 pb-3">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex h-12 min-w-0 flex-col justify-center rounded-[1rem] border border-white/10 bg-black/35 px-3 backdrop-blur">
          <p className="truncate text-xs font-black text-white">{user.fullName}</p>
          <p className="mt-0.5 truncate text-[10px] text-neutral-400">{user.model}</p>
        </div>
        {headerActions}
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">Durum</p>
          <p className="mt-1 truncate text-xs font-bold text-white">
            {convoyTracking?.status === "tracking"
              ? "Konvoy GPS aktif"
              : convoyTracking?.status === "verifying"
                ? "Varis dogrulaniyor"
                : convoyTracking?.status === "low-accuracy"
                  ? "GPS hassasiyeti dusuk"
              : convoyTracking?.status === "arrived"
                ? "Hedefe varildi"
                : convoyTracking?.status === "completed"
                  ? "Konvoy tamamlandi"
                  : driveSessionStatus === "error" ? "Baglanti sorunu" : liveStatusLabel}
          </p>
        </div>
        <div className="rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">Secili</p>
          <p className="mt-1 truncate text-xs font-bold text-white">{selectedLabel}</p>
        </div>
        <div className="rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">Erisim</p>
          <p className="mt-1 truncate text-xs font-bold text-white">{accessLabel}</p>
        </div>
      </div>

      {convoyTracking?.status && !["idle", "tracking"].includes(convoyTracking.status) ? (
        <div className={`mb-3 rounded-[0.95rem] border px-3 py-2 text-xs ${convoyTracking.error ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-lime-400/25 bg-lime-400/10 text-lime-100"}`}>
          {convoyTracking.error || (convoyTracking.status === "requesting"
            ? "Konvoy saati geldi. GPS izni bekleniyor..."
            : convoyTracking.status === "verifying"
              ? `Varis dogrulaniyor (${convoyTracking.arrivalConfirmationCount ?? 1}/${convoyTracking.arrivalConfirmationRequired ?? 2}). Hedef alaninda kal.`
              : convoyTracking.status === "low-accuracy"
                ? "Hedef alanindasin ancak GPS hassasiyeti dusuk. Acik alanda konum dogrulamasi bekleniyor."
            : convoyTracking.status === "arrived"
              ? "Rota sonuna ulastin. Diger suruculer bekleniyor."
              : "Konvoy tamamlandi. Surucu oylamasi acildi.")}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.35rem] border border-white/10">
        <MapCard
          drivers={drivers}
          currentClanMembers={currentClanMembers}
          pins={mapPins}
          selectedPinId={selectedPinId}
          onSelect={(pinId) => {
            onSelectPin(pinId);
            setActiveOverlay(pinId ? "details" : null);
          }}
          onOpenDriverConversation={onGhostOpenConversation}
          onOpenDriverProfile={onGhostOpenProfile}
          onRequestFriend={onGhostRequestFriend}
          user={user}
          liveLocation={liveLocation}
          driveHud={driveHud}
          draftRoutePath={[]}
          fullScreen
          isDriving={isDriving}
          navigationMode
        />
      </div>

      {isDriving ? <div className="mt-3 rounded-[1rem] border border-white/10 bg-[#0b0b0b]/66 px-3 py-2 backdrop-blur">
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
      </div> : null}

      {isDriving && convoyTimeline ? (
        <div className="mt-3 rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.94),rgba(10,10,10,0.94))] px-3 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.26em] text-lime-400">Convoy Timeline</p>
              <p className="mt-1 truncate text-sm font-bold text-white">{convoyTimeline.title}</p>
              <p className="truncate text-[10px] text-neutral-400">{convoyTimeline.subtitle}</p>
            </div>
            <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Progress</p>
              <p className="text-sm font-black text-lime-300">%{convoyTimeline.progress}</p>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className={`h-full rounded-full transition-all ${
                convoyTimeline.locked ? "bg-rose-500/70" : "bg-[linear-gradient(90deg,#a3e635,#84cc16)]"
              }`}
              style={{ width: `${convoyTimeline.progress}%` }}
            />
          </div>

          {!convoyTimeline.locked && convoyTimeline.metrics?.totalKm > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">Toplam</p>
                <p className="mt-1 text-sm font-black text-white">{convoyTimeline.metrics.totalKm.toFixed(1)} km</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">Gidilen</p>
                <p className="mt-1 text-sm font-black text-white">{convoyTimeline.metrics.traveledKm.toFixed(1)} km</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">Kalan</p>
                <p className="mt-1 text-sm font-black text-white">{convoyTimeline.metrics.remainingKm.toFixed(1)} km</p>
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-4 gap-2">
            {convoyTimeline.segments.map((segment) => (
              <div key={segment.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-2 py-2 text-center">
                <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">{segment.label}</p>
                <p className="mt-1 text-sm font-black text-white">{segment.value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeOverlay === "details" && selectedPin ? (
        <OverlayCard
          title={overlayTitle}
          onClose={() => {
            setActiveOverlay(null);
            onSelectPin(null);
          }}
        >
          <PinPanel
            pin={selectedPin}
            user={user}
            convoyFeedback={convoyFeedback}
            spotPhotoErrors={spotPhotoErrors}
            spotPhotoFeedback={spotPhotoFeedback}
            spotPhotoForm={spotPhotoForm}
            washForm={washForm}
            washErrors={washErrors}
            washFeedback={washFeedback}
            onApproveCruiseJoinRequest={onApproveCruiseJoinRequest}
            onDeclineCruiseJoinRequest={onDeclineCruiseJoinRequest}
            onDeleteSpotPhoto={onDeleteSpotPhoto}
            onReportSpotPhoto={onReportSpotPhoto}
            onRemoveConvoyMember={onRemoveConvoyMember}
            onJoinCruise={joinCruise}
            onLikeGallery={likeGalleryImage}
            onLikePin={likePin}
            onRateAttendee={rateAttendee}
            onSetAttendeeTripStatus={onSetAttendeeTripStatus}
            onSetConvoyLifecycleStatus={onSetConvoyLifecycleStatus}
            onSpotPhotoFileChange={loadSpotPhotoFile}
            onSpotPhotoFormChange={onSetSpotPhotoForm}
            onSubmitSpotPhoto={onSubmitSpotPhoto}
            onSubmitWashReview={submitWashReview ?? onSubmitWashReview}
            onWashFormChange={onSetWashForm}
          />
        </OverlayCard>
      ) : null}
    </section>
  );
}
