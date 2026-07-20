import { MapCard } from "../components/MapCard";
import { MapComposerPanel } from "../components/MapComposerPanel";
import { PinPanel } from "../components/PinPanel";

export function MapHubScreen({
  convoyFeedback,
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
  onApproveCruiseJoinRequest,
  onDeclineCruiseJoinRequest,
  onDeleteSpotPhoto,
  onReportSpotPhoto,
  onRemoveConvoyMember,
  onPickLocation,
  onSelectPin,
  onSetAttendeeTripStatus,
  onSetConvoyLifecycleStatus,
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
  return (
    <section className="space-y-4">
      <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,#171717,#101010)] px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.32em] text-lime-400">CRUISER MAP</p>
        <h3 className="mt-2 text-xl font-black text-white">Node Management Hub</h3>
      </div>
      <MapCard
        pins={mapPins}
        selectedPinId={selectedPinId}
        onSelect={onSelectPin}
        user={user}
        draftLocation={draftLocation}
        draftRoutePath={mapPinForm.routePoints}
        mapPickMode={mapPickMode}
        onPickLocation={onPickLocation}
      />
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
      <MapComposerPanel
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
        user={user}
      />
    </section>
  );
}
