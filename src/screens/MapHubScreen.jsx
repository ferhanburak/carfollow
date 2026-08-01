import { useState } from "react";
import { MapCard } from "../components/MapCard";
import { MapComposerPanel } from "../components/MapComposerPanel";
import { PinPanel } from "../components/PinPanel";

export function MapHubScreen({
  convoyFeedback,
  driverSearchResults,
  clearDraftRoute,
  draftLocation,
  joinCruise,
  likeGalleryImage,
  likePin,
  onHelpfulReview,
  loadSpotPhotoFile,
  liveLocation,
  mapPickMode,
  mapPinErrors,
  mapPinFeedback,
  mapPinForm,
  mapPins,
  onApproveCruiseJoinRequest,
  onDeclineCruiseJoinRequest,
  onDeleteSpotPhoto,
  onDriverSearchChange,
  onInviteDriver,
  onReportSpotPhoto,
  onRemoveConvoyMember,
  onPickLocation,
  onSelectPin,
  onSetAttendeeTripStatus,
  onSetConvoyMemberRole,
  onSetConvoyLifecycleStatus,
  onUpdateConvoyDetails,
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
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <section className="space-y-4">
      <MapCard
        pins={mapPins}
        selectedPinId={selectedPinId}
        onSelect={onSelectPin}
        user={user}
        liveLocation={liveLocation}
        draftLocation={draftLocation}
        draftRoutePath={mapPinForm.routePoints}
        showDraftRoute={composerOpen && mapPinForm.eventMode === "convoy"}
        mapPickMode={mapPickMode}
        onPickLocation={onPickLocation}
        mapHeight="clamp(24rem, 58vh, 34rem)"
      />
      <PinPanel
        pin={selectedPin}
        user={user}
        convoyFeedback={convoyFeedback}
        driverSearchResults={driverSearchResults}
        spotPhotoErrors={spotPhotoErrors}
        spotPhotoFeedback={spotPhotoFeedback}
        spotPhotoForm={spotPhotoForm}
        washForm={washForm}
        washErrors={washErrors}
        washFeedback={washFeedback}
        onApproveCruiseJoinRequest={onApproveCruiseJoinRequest}
        onDeclineCruiseJoinRequest={onDeclineCruiseJoinRequest}
        onDeleteSpotPhoto={onDeleteSpotPhoto}
        onDriverSearchChange={onDriverSearchChange}
        onInviteDriver={onInviteDriver}
        onReportSpotPhoto={onReportSpotPhoto}
        onRemoveConvoyMember={onRemoveConvoyMember}
        onJoinCruise={joinCruise}
        onLikeGallery={likeGalleryImage}
        onLikePin={likePin}
        onHelpfulReview={onHelpfulReview}
        onRateAttendee={rateAttendee}
        onSetAttendeeTripStatus={onSetAttendeeTripStatus}
        onSetConvoyMemberRole={onSetConvoyMemberRole}
        onSetConvoyLifecycleStatus={onSetConvoyLifecycleStatus}
        onUpdateConvoyDetails={onUpdateConvoyDetails}
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
        onOpenChange={setComposerOpen}
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
