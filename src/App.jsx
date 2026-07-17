import { lazy, Suspense, useEffect, useState } from "react";
import { appId, navItems, tuningOptions } from "./data/mockData";
import { PublicDriverProfileOverlay } from "./components/PublicDriverProfileOverlay";
import { NotificationCenter } from "./components/NotificationCenter";
import { useCruiserAuth } from "./hooks/useCruiserAuth";
import { useCruiserWorld } from "./hooks/useCruiserWorld";
import { AuthScreen } from "./screens/AuthScreen";
import { getFirebasePublicDriverProfile } from "./repositories/cruiserRepository";

const DriveScreen = lazy(() => import("./screens/DriveScreen").then((module) => ({ default: module.DriveScreen })));
const GarageScreen = lazy(() => import("./screens/GarageScreen").then((module) => ({ default: module.GarageScreen })));
const MapHubScreen = lazy(() => import("./screens/MapHubScreen").then((module) => ({ default: module.MapHubScreen })));
const MapScreen = lazy(() => import("./screens/MapScreen").then((module) => ({ default: module.MapScreen })));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen").then((module) => ({ default: module.ProfileScreen })));
const StatsScreen = lazy(() => import("./screens/StatsScreen").then((module) => ({ default: module.StatsScreen })));

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

function App() {
  const [publicProfile, setPublicProfile] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const {
    authError,
    authFeedback,
    authMode,
    authTab,
    fuelForm,
    accountFeedback,
    accountPending,
    handleAccountDeletion,
    handleAccountExport,
    handleConsentWithdrawal,
    handleEmailVerification,
    handleLogin,
    handleLogout,
    handleQuickLogin,
    handlePasswordReset,
    handleSignUp,
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
  }, [user?.firebaseUid]);

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
    clanForm,
    clanPendingKey,
    clans,
    clearDraftRoute,
    convoyFeedback,
    convoyTracking,
    conversationList,
    createNewClan,
    createPassportExport,
    currentClan,
    currentClanMembers,
    declineCruiseJoinRequest,
    deleteSpotPhoto,
    declineFriendRequest,
    declineIncomingClanInvite,
    driveHud,
    driveSessionFeedback,
    driveSessionPending,
    driveSessionStatus,
    drivers,
    driverStatsStatus,
    firebaseStatus,
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
    mapDraftLocation,
    mapPickMode,
    mapPinErrors,
    mapPinFeedback,
    mapPinForm,
    mapPins,
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
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setActiveTab,
    setAttendeeTripStatus,
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
    toggleDrive,
    totalUnreadCount,
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

  if (authMode !== "authenticated" || !user) {
    return (
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
        onSignUpFormChange={setSignUpForm}
        quickProfiles={quickProfiles}
        signUpErrors={signUpErrors}
        signUpForm={signUpForm}
        tuningOptions={tuningOptions}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-3 py-6 text-neutral-100">
      <div className="relative mx-auto flex min-h-[95vh] max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-[0_0_90px_rgba(163,230,53,0.08)]">
        {activeTab !== "liveMap" ? (
          <header className="relative overflow-hidden border-b border-white/10 px-5 py-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(163,230,53,0.18),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(244,63,94,0.14),_transparent_28%),linear-gradient(180deg,#171717,#0a0a0a)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.35em] text-lime-400">CRUISER // {user.region}</p>
                <h2 className="mt-2 truncate text-2xl font-black">{user.plate}</h2>
                <p className="truncate text-sm text-neutral-400">
                  {user.model} / {user.horsepower} HP / {user.tuningStage}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <NotificationCenter
                  feedback={notificationFeedback}
                  notifications={notifications}
                  onMarkAllRead={markAllNotificationsRead}
                  onMarkRead={markNotificationRead}
                  onNavigate={(action) => {
                    const targetTabs = {
                      clan: "social",
                      conversation: "social",
                      convoy: "map",
                      garage: "garage",
                      profile: "profile",
                      social: "social",
                    };
                    setActiveTab(targetTabs[action?.type] ?? "profile");
                  }}
                  unreadCount={unreadNotificationCount}
                />
                <button
                  type="button"
                  onClick={toggleDrive}
                  disabled={driveSessionPending}
                  className={`min-h-12 min-w-12 rounded-2xl px-4 text-sm font-bold transition ${
                    isDriving
                      ? "bg-rose-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.5)]"
                      : "bg-lime-400 text-black shadow-[0_0_24px_rgba(163,230,53,0.38)]"
                  } disabled:cursor-wait disabled:opacity-60`}
                >
                  {driveSessionPending ? "Isleniyor..." : isDriving ? "Surusu Durdur" : "Suruse Basla"}
                </button>
                <button
                  type="button"
                  aria-label="Oturumu kapat"
                  title="Oturumu kapat"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10 text-lg text-rose-200 transition hover:bg-rose-500/20"
                >
                  ↪
                </button>
              </div>
            </div>
            <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
              <img src={user.avatar} alt={user.model} className="h-14 w-14 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.fullName}</p>
                <p className="text-xs text-neutral-400">Primary garage: {user.garage}</p>
              </div>
              <div className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">Odometer</p>
                <p className="text-sm font-bold text-lime-300">{user.odometer.toLocaleString("tr-TR")} KM</p>
              </div>
            </div>
          </header>
        ) : null}

        {activeTab === "liveMap" ? (
          <button
            type="button"
            aria-label="Oturumu kapat"
            onClick={() => setShowLogoutConfirm(true)}
            className="absolute right-4 top-4 z-30 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/30 bg-black/75 text-lg text-rose-200 backdrop-blur"
          >
            ↪
          </button>
        ) : null}

        <div
          className={`flex-1 min-h-0 ${
            activeTab === "liveMap"
              ? "relative overflow-hidden px-0 py-0 pb-16"
              : "overflow-y-auto px-4 py-4 pb-28"
          }`}
        >
          <Suspense fallback={<ScreenLoader />}>
            {activeTab === "map" ? (
              <MapHubScreen
                clearDraftRoute={clearDraftRoute}
                convoyFeedback={convoyFeedback}
                draftLocation={mapDraftLocation}
                joinCruise={joinCruise}
                likeGalleryImage={likeGalleryImage}
                likePin={likePin}
                loadSpotPhotoFile={loadSpotPhotoFile}
                mapPickMode={mapPickMode}
                mapPinErrors={mapPinErrors}
                mapPinFeedback={mapPinFeedback}
                mapPinForm={mapPinForm}
                mapPins={mapPins}
                onPickLocation={pickMapLocation}
                onApproveCruiseJoinRequest={approveCruiseJoinRequest}
                onDeclineCruiseJoinRequest={declineCruiseJoinRequest}
                onDeleteSpotPhoto={deleteSpotPhoto}
                onReportSpotPhoto={reportSpotPhoto}
                onRemoveConvoyMember={removeConvoyMember}
                onSelectPin={setSelectedPinId}
                onSetAttendeeTripStatus={setAttendeeTripStatus}
                onSetConvoyLifecycleStatus={setConvoyLifecycleStatus}
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
                driveHud={driveHud}
                driveSessionPending={driveSessionPending}
                driveSessionStatus={driveSessionStatus}
                isDriving={isDriving}
                joinCruise={joinCruise}
                likeGalleryImage={likeGalleryImage}
                likePin={likePin}
                loadSpotPhotoFile={loadSpotPhotoFile}
                mapPins={mapPins}
                onGhostOpenConversation={(profile) => {
                  openConversation(profile);
                  setActiveTab("social");
                }}
                onGhostOpenProfile={(profile) => void openPublicProfile({ ...profile, source: "live-map" })}
                onGhostRequestFriend={(profile) => requestFriend(profile)}
                onSelectPin={setSelectedPinId}
                onApproveCruiseJoinRequest={approveCruiseJoinRequest}
                onDeclineCruiseJoinRequest={declineCruiseJoinRequest}
                onDeleteSpotPhoto={deleteSpotPhoto}
                onReportSpotPhoto={reportSpotPhoto}
                onRemoveConvoyMember={removeConvoyMember}
                onSetSpotPhotoForm={setSpotPhotoForm}
                onSetAttendeeTripStatus={setAttendeeTripStatus}
                onSetConvoyLifecycleStatus={setConvoyLifecycleStatus}
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
                toggleDrive={toggleDrive}
                user={user}
                washErrors={washErrors}
                washFeedback={washFeedback}
                washForm={washForm}
              />
            ) : null}

            {activeTab === "drive" ? (
              <DriveScreen
                driveHud={driveHud}
                driveSessionFeedback={driveSessionFeedback}
                driveSessionPending={driveSessionPending}
                driveSessionStatus={driveSessionStatus}
                drivers={drivers}
                firebaseStatus={firebaseStatus}
                isDriving={isDriving}
                user={user}
              />
            ) : null}

            {activeTab === "social" || activeTab === "leaderboard" ? (
              <StatsScreen
                activeConversation={activeConversation}
                activeConversationId={activeConversationId}
                activeTypingUsers={activeTypingUsers}
                acceptIncomingClanInvite={acceptIncomingClanInvite}
                approveFriendRequest={approveFriendRequest}
                blockDriver={blockDriver}
                chatFeedback={chatFeedback}
                clanFeedback={clanFeedback}
                clanForm={clanForm}
                clanPendingKey={clanPendingKey}
                clans={clans}
                conversationList={conversationList}
                createNewClan={createNewClan}
                currentClan={currentClan}
                currentClanMembers={currentClanMembers}
                declineFriendRequest={declineFriendRequest}
                declineIncomingClanInvite={declineIncomingClanInvite}
                friendSearchQuery={friendSearchQuery}
                friendSearchResults={friendSearchResults}
                hostableConvoys={hostableConvoys}
                inviteDriverToMeet={inviteDriverToMeet}
                leaveCurrentClan={leaveCurrentClan}
                messageDraft={messageDraft}
                onClanFormChange={setClanForm}
                onFriendSearchChange={setFriendSearchQuery}
                onMessageDraftChange={setMessageDraft}
                onOpenPublicProfile={(profile) => void openPublicProfile(profile, { convoyId: profile.convoyId })}
                openConversation={openConversation}
                presenceMap={presenceMap}
                inviteFriendToClan={inviteFriendToClan}
                individualLeaderboardEntries={individualLeaderboard}
                driverStatsStatus={driverStatsStatus}
                requestFriend={requestFriend}
                removeFriendship={removeFriendship}
                removeClanMember={removeClanMember}
                revokeClanInvite={revokeClanInvite}
                sendMessage={sendMessage}
                socialFeedback={socialFeedback}
                socialPendingKey={socialPendingKey}
                totalUnreadCount={totalUnreadCount}
                transferClanOwnership={transferClanOwnership}
                user={safeUser ?? user}
                unblockDriver={unblockDriver}
                updateClanMemberRole={updateClanMemberRole}
                withdrawFriendRequest={withdrawFriendRequest}
                mode={activeTab === "leaderboard" ? "leaderboard" : "social"}
              />
            ) : null}

            {activeTab === "garage" ? (
              <GarageScreen
                appId={appId}
                firebaseStatus={firebaseStatus}
                fuelErrors={fuelErrors}
                fuelFeedback={fuelFeedback}
                fuelForm={fuelForm}
                fuelInsights={fuelInsights}
                fuelPending={fuelPending}
                onCreatePassportExport={createPassportExport}
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
                serviceLogFeedback={serviceLogFeedback}
                serviceLogForm={serviceLogForm}
                serviceLogPending={serviceLogPending}
                upcomingMaintenance={upcomingMaintenance}
                user={user}
              />
            ) : null}

            {activeTab === "profile" ? (
              <ProfileScreen
                accountFeedback={accountFeedback}
                accountPending={accountPending}
                isFirebaseAuth={isFirebaseAuth}
                onDeleteAccount={handleAccountDeletion}
                onExportAccount={handleAccountExport}
                onSendEmailVerification={handleEmailVerification}
                onWithdrawConsent={handleConsentWithdrawal}
                onLogout={() => setShowLogoutConfirm(true)}
                onProfileFormChange={setProfileForm}
                onSavePrivacySettings={savePrivacySettings}
                onOpenService={() => setActiveTab("garage")}
                onOpenStats={() => setActiveTab("leaderboard")}
                onSubmitProfile={submitProfile}
                passportSummary={passportSummary}
                profileCompletion={profileCompletion}
                profileErrors={profileErrors}
                profileFeedback={profileFeedback}
                profileForm={profileForm}
                tuningOptions={tuningOptions}
                user={user}
                driverStatsStatus={driverStatsStatus}
              />
            ) : null}
          </Suspense>
        </div>

        <nav
          className={`left-1/2 z-20 -translate-x-1/2 ${
            activeTab === "liveMap"
              ? "absolute bottom-2 w-[calc(100%-1rem)] max-w-[23rem] px-2"
              : "fixed bottom-4 w-[calc(100%-1.5rem)] max-w-md px-3"
          }`}
        >
          <div
            className={`grid grid-cols-7 gap-2 border border-white/10 bg-[#111111]/95 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur ${
              activeTab === "liveMap" ? "rounded-[1.35rem] p-1.5" : "rounded-[1.8rem] p-2"
            }`}
          >
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`rounded-2xl px-2 text-center font-semibold transition ${
                  activeTab === "liveMap" ? "min-h-10 py-1 text-[11px]" : "min-h-12 py-2 text-xs"
                } ${
                  activeTab === item.key
                    ? "bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.45)]"
                    : "text-neutral-400"
                }`}
              >
                <span
                  className={`block uppercase tracking-[0.18em] ${
                    activeTab === "liveMap" ? "text-[10px]" : "text-[11px]"
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`block ${activeTab === "liveMap" ? "mt-0.5 text-[10px]" : "mt-1"}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
      <PublicDriverProfileOverlay
        hostableConvoy={hostableConvoys?.[0] ?? null}
        onClose={() => setPublicProfile(null)}
        onBlockDriver={async (profile) => {
          const completed = await blockDriver(profile);
          if (completed) {
            setPublicProfile(null);
          }
        }}
        onInviteFriendToClan={inviteFriendToClan}
        onInviteToConvoy={inviteDriverToMeet}
        onOpenConversation={(profile) => {
          openConversation(profile);
          setActiveTab("social");
          setPublicProfile(null);
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-[1.75rem] border border-white/10 bg-[#171717] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
            <p className="text-xs uppercase tracking-[0.28em] text-rose-300">Account Session</p>
            <h3 className="mt-2 text-xl font-black">Oturumu kapat?</h3>
            <p className="mt-2 text-sm text-neutral-400">Bu cihazdaki CRUISER oturumun kapanacak. Daha sonra e-posta ve sifrenle tekrar giris yapabilirsin.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="min-h-12 rounded-2xl border border-white/10 bg-white/5 font-semibold text-neutral-200">Vazgec</button>
              <button type="button" onClick={() => void handleLogout()} className="min-h-12 rounded-2xl bg-rose-500 font-bold text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]">Oturumu Kapat</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
