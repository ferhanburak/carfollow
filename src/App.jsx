import { lazy, Suspense, useEffect, useState } from "react";
import { navItems, tuningOptions } from "./data/mockData";
import { BottomNavigation } from "./components/BottomNavigation";
import { PublicDriverProfileOverlay } from "./components/PublicDriverProfileOverlay";
import { NotificationCenter } from "./components/NotificationCenter";
import { DirectMessageButton, DirectMessageCenter } from "./components/DirectMessageCenter";
import { SettingsButton, SettingsCenter } from "./components/SettingsCenter";
import { useCruiserAuth } from "./hooks/useCruiserAuth";
import { useCruiserWorld } from "./hooks/useCruiserWorld";
import { useForum } from "./hooks/useForum";
import { AuthScreen } from "./screens/AuthScreen";
import { getFirebasePublicDriverProfile } from "./repositories/cruiserRepository";

const DriveScreen = lazy(() => import("./screens/DriveScreen").then((module) => ({ default: module.DriveScreen })));
const GarageScreen = lazy(() => import("./screens/GarageScreen").then((module) => ({ default: module.GarageScreen })));
const MapHubScreen = lazy(() => import("./screens/MapHubScreen").then((module) => ({ default: module.MapHubScreen })));
const MapScreen = lazy(() => import("./screens/MapScreen").then((module) => ({ default: module.MapScreen })));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen").then((module) => ({ default: module.ProfileScreen })));
const StatsScreen = lazy(() => import("./screens/StatsScreen").then((module) => ({ default: module.StatsScreen })));
const ForumScreen = lazy(() => import("./screens/ForumScreen").then((module) => ({ default: module.ForumScreen })));

function ScreenLoader() {
  return (
    <div className="flex h-full min-h-[14rem] items-center justify-center">
      <div className="w-full rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(163,230,53,0.12),transparent_42%),linear-gradient(180deg,#131313,#0d0d0d)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-lime-400">CRUISER LOADING</p>
            <p className="mt-2 text-sm font-semibold text-neutral-200">Ekran hazirlaniyor...</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-lime-300/40 border-t-lime-300" />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/8" />
          <div className="h-20 animate-pulse rounded-[1.25rem] bg-white/[0.04]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 animate-pulse rounded-[1.15rem] bg-white/[0.04]" />
            <div className="h-16 animate-pulse rounded-[1.15rem] bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DriveActionIcon({ pending = false }) {
  return (
    <svg
      aria-hidden="true"
      className={`mx-auto h-6 w-6 ${pending ? "animate-pulse" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5.2 10.2 6.8 6h10.4l1.6 4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 11.5c0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5V17H4v-5.5Z" strokeLinejoin="round" />
      <path d="M6.5 17v1.5M17.5 17v1.5M7.5 13.5h.01M16.5 13.5h.01" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function App() {
  const [publicProfile, setPublicProfile] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [dmCenterOpen, setDmCenterOpen] = useState(false);
  const [dmCenterView, setDmCenterView] = useState("list");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState(null);
  const {
    authError,
    authFeedback,
    authMode,
    authTab,
    fuelForm,
    accountFeedback,
    accountPending,
    handleAccountPasswordReset,
    handleAccountDeletion,
    handleAccountExport,
    handleConsentWithdrawal,
    handleEmailVerification,
    handleLogin,
    handleLogout,
    handleQuickLogin,
    handlePasswordReset,
    handleSignUp,
    handleSignUpAvatarChange,
    isFirebaseAuth,
    loginForm,
    quickProfiles,
    setAuthTab,
    setFuelForm,
    setLoginForm,
    setSignUpForm,
    signUpErrors,
    setUser,
    signUpForm,
    user,
  } = useCruiserAuth();

  const openPublicProfile = async (profile, context = {}) => {
    if (!profile) return;
    const targetUserId = profile.userId ?? profile.firebaseUid ?? profile.id;
    if (!isFirebaseAuth || !targetUserId) {
      setPublicProfile(profile);
      return;
    }

    try {
      const result = await getFirebasePublicDriverProfile(targetUserId, context);
      setPublicProfile(result?.driver ? { ...result.driver, source: profile.source ?? "access-matrix" } : null);
    } catch (error) {
      console.error("Public profile access failed", error);
      setPublicProfile(null);
    }
  };

  useEffect(() => {
    // A sign-out can change the active Firebase user before this component rerenders.
    // Never carry an account-specific confirmation modal into the next session.
    setShowLogoutConfirm(false);
    setDmCenterOpen(false);
    setDmCenterView("list");
    setSettingsOpen(false);
    setSettingsSection(null);
  }, [user?.firebaseUid, user?.id]);

  const {
    activeConversation,
    activeConversationId,
    activeTypingUsers,
    activeTab,
    approveCruiseJoinRequest,
    acceptIncomingClanInvite,
    approveFriendRequest,
    blockDriver,
    chatFeedback,
    clanFeedback,
    clanEventFeedback,
    clanEventPendingId,
    clanForm,
    clanPendingKey,
    clans,
    clearDraftRoute,
    convoyFeedback,
    convoyTracking,
    conversationList,
    createNewClan,
    createPassportExport,
    deleteServiceLog,
    currentClan,
    currentClanMembers,
    declineCruiseJoinRequest,
    deleteClanEvent,
    deleteSpotPhoto,
    declineFriendRequest,
    declineIncomingClanInvite,
    driveHud,
    driveSessionFeedback,
    driveSessionPending,
    driveSessionStatus,
    drivers,
    fuelErrors,
    fuelFeedback,
    fuelInsights,
    fuelPending,
    friendSearchQuery,
    friendSearchResults,
    hostableConvoys,
    isDriving,
    individualLeaderboard,
    inviteDriverToMeet,
    leaveCurrentClan,
    joinCruise,
    likeGalleryImage,
    likePin,
    loadSpotPhotoFile,
    liveLocation,
    mapDraftLocation,
    mapPickMode,
    mapPinErrors,
    mapPinFeedback,
    mapPinForm,
    mapPins,
    markConversationAsRead,
    messageDraft,
    markAllNotificationsRead,
    markNotificationRead,
    moderationFeedback,
    moderationPending,
    notificationFeedback,
    notifications,
    openConversation,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    passportSummary,
    pickMapLocation,
    profileCompletion,
    profileErrors,
    profileFeedback,
    profileForm,
    profilePending,
    loadProfileAvatarFile,
    presenceMap,
    primeServiceLogForm,
    rateAttendee,
    reportSpotPhoto,
    removeConvoyMember,
    removeLastDraftRoutePoint,
    requestFriend,
    reportDriver,
    removeFriendship,
    removeClanMember,
    resetSessionView,
    revokeClanInvite,
    safeUser,
    selectedPin,
    selectedPinId,
    sendMessage,
    serviceLogErrors,
    serviceLogDeletePendingId,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setActiveTab,
    setAttendeeTripStatus,
    setConvoyMemberRole,
    setClanForm,
    setConvoyLifecycleStatus,
    setFriendSearchQuery,
    setMapPickMode,
    setMapPinForm,
    setMessageDraft,
    setProfileForm,
    savePrivacySettings,
    setSelectedPinId,
    setServiceLogForm,
    setSpotPhotoForm,
    setWashForm,
    socialFeedback,
    socialPendingKey,
    spotPhotoErrors,
    spotPhotoFeedback,
    spotPhotoForm,
    submitFuelLog,
    submitMapPin,
    submitProfile,
    submitServiceLog,
    submitSpotPhoto,
    submitWashReview,
    updateConvoyDetails,
    toggleDrive,
    unreadConversationCount,
    unreadNotificationCount,
    upcomingMaintenance,
    useSelectedPinCoordinates,
    washErrors,
    washFeedback,
    washForm,
    inviteFriendToClan,
    transferClanOwnership,
    unblockDriver,
    updateClanMemberRole,
    withdrawFriendRequest,
  } = useCruiserWorld(user, setUser, setFuelForm);
  const forum = useForum(safeUser ?? user, activeTab === "forum");

  const activeClanName = (safeUser ?? user)?.clan;
  const activeClanId = (safeUser ?? user)?.clanId ?? currentClan?.id;
  const clanEvents = mapPins.filter((pin) =>
    pin.type === "meet" && (
      (activeClanId && pin.clanId === activeClanId) ||
      (activeClanName && pin.createdByClan === activeClanName)
    ),
  );

  useEffect(() => {
    if (activeTab === "liveMap") {
      setSelectedPinId(null);
    }
  }, [activeTab, setSelectedPinId]);

  const openDmInbox = () => {
    setSettingsOpen(false);
    setDmCenterView("list");
    setDmCenterOpen(true);
  };

  const openDmConversation = async (profile) => {
    const conversationId = await openConversation(profile);
    if (!conversationId) return false;

    setDmCenterView("chat");
    setDmCenterOpen(true);
    setSettingsOpen(false);
    void markConversationAsRead(conversationId);
    return true;
  };

  const openSettings = () => {
    setDmCenterOpen(false);
    setSettingsSection(null);
    setSettingsOpen(true);
  };

  const navigateFromNotification = (action) => {
    if (action?.type === "conversation") {
      const conversation = conversationList.find((entry) => entry.participantUserId === action.targetId);
      if (conversation) {
        void openDmConversation({
          userId: conversation.participantUserId,
          plate: conversation.participantPlate,
          fullName: conversation.participantName,
          model: conversation.participantModel,
          avatar: conversation.participantAvatar,
        });
      } else {
        openDmInbox();
      }
      return;
    }

    const targetTabs = {
      clan: "social",
      convoy: "map",
      garage: "garage",
      profile: "profile",
      social: "social",
    };
    setActiveTab(targetTabs[action?.type] ?? "profile");
  };

  if (authMode !== "authenticated" || !user) {
    return (
      <>
        <AuthScreen
          authError={authError}
          authFeedback={authFeedback}
          authMode={authMode}
          authTab={authTab}
          isFirebaseAuth={isFirebaseAuth}
          loginForm={loginForm}
          onAuthTabChange={setAuthTab}
          onLogin={(event) => handleLogin(event, { onAuthenticated: resetSessionView })}
          onPasswordReset={handlePasswordReset}
          onLoginFormChange={setLoginForm}
          onQuickLogin={(profile) => handleQuickLogin(profile, { onAuthenticated: resetSessionView })}
          onSignUp={(event) => handleSignUp(event, { onAuthenticated: resetSessionView })}
          onSignUpAvatarChange={handleSignUpAvatarChange}
          onSignUpFormChange={setSignUpForm}
          quickProfiles={quickProfiles}
          signUpErrors={signUpErrors}
          signUpForm={signUpForm}
          tuningOptions={tuningOptions}
        />
      </>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#050505] text-neutral-100 md:px-3 md:py-6">
      <div className="app-shell relative mx-auto flex w-full max-w-md flex-col overflow-hidden bg-[#0a0a0a] shadow-[0_0_90px_rgba(163,230,53,0.08)] md:rounded-[2rem] md:border md:border-white/10">
        {activeTab !== "liveMap" ? (
          <header
            aria-label="Uygulama kontrolleri"
            className="app-safe-top relative overflow-hidden border-b border-white/10 px-3 pb-3 sm:px-4 sm:pb-3"
            data-testid="compact-app-header"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.18),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(244,63,94,0.14),_transparent_28%),linear-gradient(180deg,#171717,#0a0a0a)]" />
            <div className="relative flex items-center gap-1.5">
              <div className="flex h-12 min-w-0 flex-1 flex-col justify-center rounded-2xl border border-white/10 bg-black/30 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="truncate text-xs font-black text-white">{user.fullName}</p>
                <p className="mt-0.5 truncate text-[10px] text-neutral-400">{user.model}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <DirectMessageButton onClick={openDmInbox} unreadCount={unreadConversationCount} />
                <NotificationCenter
                  feedback={notificationFeedback}
                  notifications={notifications}
                  onMarkAllRead={markAllNotificationsRead}
                  onMarkRead={markNotificationRead}
                  onNavigate={navigateFromNotification}
                  unreadCount={unreadNotificationCount}
                />
                <button
                  type="button"
                  aria-label={driveSessionPending ? "Isleniyor..." : isDriving ? "Surusu Durdur" : "Suruse Basla"}
                  onClick={toggleDrive}
                  disabled={driveSessionPending}
                  className={`h-12 w-12 shrink-0 rounded-2xl px-0 text-[10px] font-bold transition ${
                    isDriving
                      ? "bg-rose-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.5)]"
                      : "bg-lime-400 text-black shadow-[0_0_24px_rgba(163,230,53,0.38)]"
                  } disabled:cursor-wait disabled:opacity-60`}
                >
                  <DriveActionIcon pending={driveSessionPending} />
                </button>
                <SettingsButton onClick={openSettings} />
              </div>
            </div>
          </header>
        ) : null}

        <div
          className={`flex-1 min-h-0 ${
            activeTab === "liveMap"
              ? "app-live-content relative overflow-hidden px-0 py-0"
              : "app-scroll-content overflow-y-auto px-3 py-4 sm:px-4"
          }`}
        >
          <Suspense fallback={<ScreenLoader />}>
            {activeTab === "map" ? (
              <MapHubScreen
                clearDraftRoute={clearDraftRoute}
                convoyFeedback={convoyFeedback}
                driverSearchResults={friendSearchResults}
                draftLocation={mapDraftLocation}
                joinCruise={joinCruise}
                likeGalleryImage={likeGalleryImage}
                likePin={likePin}
                loadSpotPhotoFile={loadSpotPhotoFile}
                liveLocation={liveLocation}
                mapPickMode={mapPickMode}
                mapPinErrors={mapPinErrors}
                mapPinFeedback={mapPinFeedback}
                mapPinForm={mapPinForm}
                mapPins={mapPins}
                onPickLocation={pickMapLocation}
                onApproveCruiseJoinRequest={approveCruiseJoinRequest}
                onDeclineCruiseJoinRequest={declineCruiseJoinRequest}
                onDeleteSpotPhoto={deleteSpotPhoto}
                onDriverSearchChange={setFriendSearchQuery}
                onInviteDriver={inviteDriverToMeet}
                onReportSpotPhoto={reportSpotPhoto}
                onRemoveConvoyMember={removeConvoyMember}
                onSelectPin={setSelectedPinId}
                onSetAttendeeTripStatus={setAttendeeTripStatus}
                onSetConvoyMemberRole={setConvoyMemberRole}
                onSetConvoyLifecycleStatus={setConvoyLifecycleStatus}
                onUpdateConvoyDetails={updateConvoyDetails}
                onSetMapPickMode={setMapPickMode}
                onSetMapPinForm={setMapPinForm}
                onSetSpotPhotoForm={setSpotPhotoForm}
                onSetWashForm={setWashForm}
                onSubmitMapPin={submitMapPin}
                onSubmitSpotPhoto={submitSpotPhoto}
                onSubmitWashReview={submitWashReview}
                onUseSelectedCoordinates={useSelectedPinCoordinates}
                pickRouteBack={removeLastDraftRoutePoint}
                rateAttendee={rateAttendee}
                selectedPin={selectedPin}
                selectedPinId={selectedPinId}
                spotPhotoErrors={spotPhotoErrors}
                spotPhotoFeedback={spotPhotoFeedback}
                spotPhotoForm={spotPhotoForm}
                submitWashReview={submitWashReview}
                user={user}
                washErrors={washErrors}
                washFeedback={washFeedback}
                washForm={washForm}
              />
            ) : null}

            {activeTab === "liveMap" ? (
              <MapScreen
                drivers={drivers}
                currentClanMembers={currentClanMembers}
                driveHud={driveHud}
                driveSessionStatus={driveSessionStatus}
                driverSearchResults={friendSearchResults}
                headerActions={(
                  <div className="grid grid-cols-[3rem_3rem_3rem_3rem] gap-1.5">
                    <DirectMessageButton onClick={openDmInbox} tone="map" unreadCount={unreadConversationCount} />
                    <NotificationCenter
                      feedback={notificationFeedback}
                      notifications={notifications}
                      onMarkAllRead={markAllNotificationsRead}
                      onMarkRead={markNotificationRead}
                      onNavigate={navigateFromNotification}
                      unreadCount={unreadNotificationCount}
                    />
                    <button
                      type="button"
                      aria-label={driveSessionPending ? "Isleniyor..." : isDriving ? "Surusu Durdur" : "Suruse Basla"}
                      onClick={toggleDrive}
                      disabled={driveSessionPending}
                      className={`h-12 w-12 rounded-2xl px-0 text-xs font-bold transition ${
                        isDriving
                          ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.42)]"
                          : "bg-lime-400 text-black shadow-[0_0_20px_rgba(163,230,53,0.32)]"
                      } disabled:cursor-wait disabled:opacity-60`}
                    >
                      <DriveActionIcon pending={driveSessionPending} />
                    </button>
                    <SettingsButton onClick={openSettings} tone="map" />
                  </div>
                )}
                isDriving={isDriving}
                joinCruise={joinCruise}
                likeGalleryImage={likeGalleryImage}
                likePin={likePin}
                loadSpotPhotoFile={loadSpotPhotoFile}
                liveLocation={liveLocation}
                mapPins={mapPins}
                onGhostOpenConversation={(profile) => {
                  void openDmConversation(profile);
                }}
                onGhostOpenProfile={(profile) => void openPublicProfile({ ...profile, source: "live-map" })}
                onGhostRequestFriend={(profile) => requestFriend(profile)}
                onSelectPin={setSelectedPinId}
                onApproveCruiseJoinRequest={approveCruiseJoinRequest}
                onDeclineCruiseJoinRequest={declineCruiseJoinRequest}
                onDeleteSpotPhoto={deleteSpotPhoto}
                onDriverSearchChange={setFriendSearchQuery}
                onInviteDriver={inviteDriverToMeet}
                onReportSpotPhoto={reportSpotPhoto}
                onRemoveConvoyMember={removeConvoyMember}
                onSetSpotPhotoForm={setSpotPhotoForm}
                onSetAttendeeTripStatus={setAttendeeTripStatus}
                onSetConvoyMemberRole={setConvoyMemberRole}
                onSetConvoyLifecycleStatus={setConvoyLifecycleStatus}
                onUpdateConvoyDetails={updateConvoyDetails}
                onSetWashForm={setWashForm}
                onSubmitSpotPhoto={submitSpotPhoto}
                onSubmitWashReview={submitWashReview}
                rateAttendee={rateAttendee}
                selectedPin={selectedPin}
                selectedPinId={selectedPinId}
                convoyFeedback={convoyFeedback}
                convoyTracking={convoyTracking}
                spotPhotoErrors={spotPhotoErrors}
                spotPhotoFeedback={spotPhotoFeedback}
                spotPhotoForm={spotPhotoForm}
                submitWashReview={submitWashReview}
                user={user}
                washErrors={washErrors}
                washFeedback={washFeedback}
                washForm={washForm}
              />
            ) : null}

            {activeTab === "drive" ? (
              <DriveScreen
                driveHud={driveHud}
                drivers={drivers}
                isDriving={isDriving}
                user={user}
              />
            ) : null}

            {activeTab === "social" || activeTab === "leaderboard" ? (
              <StatsScreen
                acceptIncomingClanInvite={acceptIncomingClanInvite}
                approveFriendRequest={approveFriendRequest}
                blockDriver={blockDriver}
                clanFeedback={clanFeedback}
                clanEventFeedback={clanEventFeedback}
                clanEventPendingId={clanEventPendingId}
                clanEvents={clanEvents}
                clanForm={clanForm}
                clanPendingKey={clanPendingKey}
                clans={clans}
                createNewClan={createNewClan}
                currentClan={currentClan}
                currentClanMembers={currentClanMembers}
                declineFriendRequest={declineFriendRequest}
                declineIncomingClanInvite={declineIncomingClanInvite}
                deleteClanEvent={deleteClanEvent}
                friendSearchQuery={friendSearchQuery}
                friendSearchResults={friendSearchResults}
                hostableConvoys={hostableConvoys}
                inviteDriverToMeet={inviteDriverToMeet}
                leaveCurrentClan={leaveCurrentClan}
                onClanFormChange={setClanForm}
                onFriendSearchChange={setFriendSearchQuery}
                onOpenPublicProfile={(profile) => void openPublicProfile(profile, { convoyId: profile.convoyId })}
                openConversation={openDmConversation}
                inviteFriendToClan={inviteFriendToClan}
                individualLeaderboardEntries={individualLeaderboard}
                requestFriend={requestFriend}
                removeFriendship={removeFriendship}
                removeClanMember={removeClanMember}
                revokeClanInvite={revokeClanInvite}
                socialFeedback={socialFeedback}
                socialPendingKey={socialPendingKey}
                transferClanOwnership={transferClanOwnership}
                user={safeUser ?? user}
                updateClanMemberRole={updateClanMemberRole}
                withdrawFriendRequest={withdrawFriendRequest}
                mode={activeTab === "leaderboard" ? "leaderboard" : "social"}
              />
            ) : null}

            {activeTab === "forum" ? (
              <ForumScreen
                addReply={forum.addReply}
                createThread={forum.createThread}
                feedback={forum.feedback}
                form={forum.form}
                onFormChange={forum.setForm}
                pendingKey={forum.pendingKey}
                threads={forum.threads}
                toggleLike={forum.toggleLike}
                user={safeUser ?? user}
              />
            ) : null}

            {activeTab === "garage" ? (
              <GarageScreen
                fuelErrors={fuelErrors}
                fuelFeedback={fuelFeedback}
                fuelForm={fuelForm}
                fuelInsights={fuelInsights}
                fuelPending={fuelPending}
                onCreatePassportExport={createPassportExport}
                onDeleteServiceLog={deleteServiceLog}
                onFuelFormChange={setFuelForm}
                onPrimeServiceLogForm={primeServiceLogForm}
                onServiceLogFormChange={setServiceLogForm}
                onSubmitFuelLog={(event) => submitFuelLog(event, fuelForm)}
                onSubmitServiceLog={submitServiceLog}
                passportExportFeedback={passportExportFeedback}
                passportExportPending={passportExportPending}
                passportExports={passportExports}
                passportSummary={passportSummary}
                serviceLogErrors={serviceLogErrors}
                serviceLogDeletePendingId={serviceLogDeletePendingId}
                serviceLogFeedback={serviceLogFeedback}
                serviceLogForm={serviceLogForm}
                serviceLogPending={serviceLogPending}
                upcomingMaintenance={upcomingMaintenance}
                user={user}
              />
            ) : null}

            {activeTab === "profile" ? (
              <ProfileScreen
                onOpenService={() => setActiveTab("garage")}
                onOpenStats={() => setActiveTab("leaderboard")}
                profileCompletion={profileCompletion}
                user={user}
              />
            ) : null}
          </Suspense>
        </div>

        <BottomNavigation activeTab={activeTab === "garage" ? "profile" : activeTab} items={navItems} onSelect={setActiveTab} />
      </div>
      <SettingsCenter
        accountFeedback={accountFeedback}
        accountPending={accountPending}
        isFirebaseAuth={isFirebaseAuth}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={handleAccountDeletion}
        onExportAccount={handleAccountExport}
        onProfileAvatarFileChange={loadProfileAvatarFile}
        onProfileFormChange={setProfileForm}
        onRequestLogout={() => {
          setSettingsOpen(false);
          setShowLogoutConfirm(true);
        }}
        onSavePrivacySettings={savePrivacySettings}
        onSelectSection={setSettingsSection}
        onSendEmailVerification={handleEmailVerification}
        onSendPasswordReset={handleAccountPasswordReset}
        onSubmitProfile={submitProfile}
        onUnblockDriver={unblockDriver}
        onWithdrawConsent={handleConsentWithdrawal}
        profileErrors={profileErrors}
        profileFeedback={profileFeedback}
        profileForm={profileForm}
        profilePending={profilePending}
        section={settingsSection}
        socialFeedback={socialFeedback}
        socialPendingKey={socialPendingKey}
        tuningOptions={tuningOptions}
        user={safeUser ?? user}
      />
      <DirectMessageCenter
        activeConversation={activeConversation}
        activeConversationId={activeConversationId}
        activeTypingUsers={activeTypingUsers}
        chatFeedback={chatFeedback}
        conversationList={conversationList}
        isOpen={dmCenterOpen}
        messageDraft={messageDraft}
        onClose={() => setDmCenterOpen(false)}
        onMarkConversationRead={markConversationAsRead}
        onMessageDraftChange={setMessageDraft}
        onSelectConversation={openDmConversation}
        onSendMessage={sendMessage}
        onShowInbox={() => setDmCenterView("list")}
        presenceMap={presenceMap}
        unreadConversationCount={unreadConversationCount}
        user={safeUser ?? user}
        view={dmCenterView}
      />
      <PublicDriverProfileOverlay
        hostableConvoys={hostableConvoys}
        onClose={() => setPublicProfile(null)}
        onBlockDriver={async (profile) => {
          const completed = await blockDriver(profile);
          if (completed) {
            setPublicProfile(null);
          }
        }}
        onInviteFriendToClan={inviteFriendToClan}
        onInviteToConvoy={inviteDriverToMeet}
        onOpenConversation={async (profile) => {
          const opened = await openDmConversation(profile);
          if (opened) setPublicProfile(null);
        }}
        onRequestFriend={(profile) => requestFriend(profile)}
        onReportDriver={reportDriver}
        onRemoveFriendship={removeFriendship}
        onUnblockDriver={unblockDriver}
        presence={publicProfile ? presenceMap?.[publicProfile.plate] : null}
        profile={publicProfile}
        moderationFeedback={moderationFeedback}
        moderationPending={moderationPending}
        socialPendingKey={socialPendingKey}
        user={safeUser ?? user}
      />
      {showLogoutConfirm ? (
        <div className="app-bottom-sheet fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-[#171717] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
            <p className="text-xs uppercase tracking-[0.28em] text-rose-300">Account Session</p>
            <h3 className="mt-2 text-xl font-black">Oturumu kapat?</h3>
            <p className="mt-2 text-sm text-neutral-400">Bu cihazdaki CRUISER oturumun kapanacak. Daha sonra e-posta ve sifrenle tekrar giris yapabilirsin.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="min-h-12 rounded-2xl border border-white/10 bg-white/5 font-semibold text-neutral-200">Vazgec</button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  void handleLogout();
                }}
                className="min-h-12 rounded-2xl bg-rose-500 font-bold text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]"
              >
                Oturumu Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
