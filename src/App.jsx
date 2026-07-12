import { lazy, Suspense } from "react";
import { appId, navItems, tuningOptions } from "./data/mockData";
import { useCruiserAuth } from "./hooks/useCruiserAuth";
import { useCruiserWorld } from "./hooks/useCruiserWorld";
import { AuthScreen } from "./screens/AuthScreen";

const DriveScreen = lazy(() => import("./screens/DriveScreen").then((module) => ({ default: module.DriveScreen })));
const GarageScreen = lazy(() => import("./screens/GarageScreen").then((module) => ({ default: module.GarageScreen })));
const MapHubScreen = lazy(() => import("./screens/MapHubScreen").then((module) => ({ default: module.MapHubScreen })));
const MapScreen = lazy(() => import("./screens/MapScreen").then((module) => ({ default: module.MapScreen })));
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
  const {
    authMode,
    authTab,
    fuelForm,
    handleLogin,
    handleQuickLogin,
    handleSignUp,
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

  const {
    activeConversation,
    activeConversationId,
    activeTab,
    acceptIncomingClanInvite,
    approveFriendRequest,
    chatFeedback,
    clanFeedback,
    clanForm,
    clans,
    clearDraftRoute,
    conversationList,
    createNewClan,
    currentClan,
    declineFriendRequest,
    declineIncomingClanInvite,
    driveHud,
    drivers,
    firebaseStatus,
    fuelErrors,
    fuelInsights,
    friendSearchQuery,
    friendSearchResults,
    isDriving,
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
    openConversation,
    passportSummary,
    pickMapLocation,
    primeServiceLogForm,
    rateAttendee,
    removeLastDraftRoutePoint,
    requestFriend,
    resetSessionView,
    revokeClanInvite,
    safeUser,
    selectedPin,
    selectedPinId,
    sendMessage,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    setActiveTab,
    setClanForm,
    setFriendSearchQuery,
    setMapPickMode,
    setMapPinForm,
    setMessageDraft,
    setSelectedPinId,
    setServiceLogForm,
    setSpotPhotoForm,
    setWashForm,
    socialFeedback,
    spotPhotoErrors,
    spotPhotoFeedback,
    spotPhotoForm,
    submitFuelLog,
    submitMapPin,
    submitServiceLog,
    submitSpotPhoto,
    submitWashReview,
    toggleDrive,
    upcomingMaintenance,
    useSelectedPinCoordinates,
    washErrors,
    washFeedback,
    washForm,
    inviteFriendToClan,
    withdrawFriendRequest,
  } = useCruiserWorld(user, setUser, setFuelForm);

  if (authMode !== "authenticated" || !user) {
    return (
      <AuthScreen
        authMode={authMode}
        authTab={authTab}
        loginForm={loginForm}
        onAuthTabChange={setAuthTab}
        onLogin={(event) => handleLogin(event, { onAuthenticated: resetSessionView })}
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
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-lime-400">CRUISER // {user.region}</p>
                <h2 className="mt-2 text-2xl font-black">{user.plate}</h2>
                <p className="text-sm text-neutral-400">
                  {user.model} / {user.horsepower} HP / {user.tuningStage}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleDrive}
                className={`min-h-12 min-w-12 rounded-2xl px-4 text-sm font-bold transition ${
                  isDriving
                    ? "bg-rose-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.5)]"
                    : "bg-lime-400 text-black shadow-[0_0_24px_rgba(163,230,53,0.38)]"
                }`}
              >
                {isDriving ? "Surusu Durdur" : "Suruse Basla"}
              </button>
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
                onSelectPin={setSelectedPinId}
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
                driveHud={driveHud}
                isDriving={isDriving}
                joinCruise={joinCruise}
                likeGalleryImage={likeGalleryImage}
                likePin={likePin}
                loadSpotPhotoFile={loadSpotPhotoFile}
                mapPins={mapPins}
                onSelectPin={setSelectedPinId}
                onSetSpotPhotoForm={setSpotPhotoForm}
                onSetWashForm={setWashForm}
                onSubmitSpotPhoto={submitSpotPhoto}
                onSubmitWashReview={submitWashReview}
                rateAttendee={rateAttendee}
                selectedPin={selectedPin}
                selectedPinId={selectedPinId}
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
                drivers={drivers}
                firebaseStatus={firebaseStatus}
                isDriving={isDriving}
                user={user}
              />
            ) : null}

            {activeTab === "clans" ? (
              <StatsScreen
                activeConversation={activeConversation}
                activeConversationId={activeConversationId}
                acceptIncomingClanInvite={acceptIncomingClanInvite}
                approveFriendRequest={approveFriendRequest}
                chatFeedback={chatFeedback}
                clanFeedback={clanFeedback}
                clanForm={clanForm}
                clans={clans}
                conversationList={conversationList}
                createNewClan={createNewClan}
                currentClan={currentClan}
                declineFriendRequest={declineFriendRequest}
                declineIncomingClanInvite={declineIncomingClanInvite}
                drivers={drivers}
                friendSearchQuery={friendSearchQuery}
                friendSearchResults={friendSearchResults}
                messageDraft={messageDraft}
                onClanFormChange={setClanForm}
                onFriendSearchChange={setFriendSearchQuery}
                onMessageDraftChange={setMessageDraft}
                openConversation={openConversation}
                inviteFriendToClan={inviteFriendToClan}
                requestFriend={requestFriend}
                revokeClanInvite={revokeClanInvite}
                sendMessage={sendMessage}
                socialFeedback={socialFeedback}
                user={safeUser ?? user}
                withdrawFriendRequest={withdrawFriendRequest}
              />
            ) : null}

            {activeTab === "garage" ? (
              <GarageScreen
                appId={appId}
                firebaseStatus={firebaseStatus}
                fuelErrors={fuelErrors}
                fuelForm={fuelForm}
                fuelInsights={fuelInsights}
                onFuelFormChange={setFuelForm}
                onPrimeServiceLogForm={primeServiceLogForm}
                onServiceLogFormChange={setServiceLogForm}
                onSubmitFuelLog={(event) => submitFuelLog(event, fuelForm)}
                onSubmitServiceLog={submitServiceLog}
                passportSummary={passportSummary}
                serviceLogErrors={serviceLogErrors}
                serviceLogFeedback={serviceLogFeedback}
                serviceLogForm={serviceLogForm}
                upcomingMaintenance={upcomingMaintenance}
                user={user}
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
            className={`grid grid-cols-5 gap-2 border border-white/10 bg-[#111111]/95 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur ${
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
    </main>
  );
}

export default App;
