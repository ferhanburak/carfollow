import { appId, navItems, tuningOptions } from "./data/mockData";
import { MapCard } from "./components/MapCard";
import { MapComposerPanel } from "./components/MapComposerPanel";
import { PinPanel } from "./components/PinPanel";
import { AuthScreen } from "./screens/AuthScreen";
import { ClansScreen } from "./screens/ClansScreen";
import { DriveScreen } from "./screens/DriveScreen";
import { GarageScreen } from "./screens/GarageScreen";
import { useCruiserAuth } from "./hooks/useCruiserAuth";
import { useCruiserWorld } from "./hooks/useCruiserWorld";

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
    activeTab,
    clans,
    driveHud,
    drivers,
    fuelInsights,
    fuelErrors,
    firebaseStatus,
    isDriving,
    joinCruise,
    likeGalleryImage,
    likePin,
    loadSpotPhotoFile,
    mapPinErrors,
    mapPinFeedback,
    mapPinForm,
    mapDraftLocation,
    mapPins,
    pickMapLocation,
    rateAttendee,
    resetSessionView,
    selectedPin,
    selectedPinId,
    setActiveTab,
    setMapPinForm,
    setSelectedPinId,
    setSpotPhotoForm,
    setWashForm,
    spotPhotoErrors,
    spotPhotoFeedback,
    spotPhotoForm,
    submitFuelLog,
    submitMapPin,
    submitSpotPhoto,
    submitWashReview,
    toggleDrive,
    useSelectedPinCoordinates,
    washForm,
    washErrors,
    washFeedback,
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
      <div className="mx-auto flex min-h-[95vh] max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-[0_0_90px_rgba(163,230,53,0.08)]">
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

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
          {activeTab === "map" ? (
            <section className="space-y-4">
              <MapCard
                pins={mapPins}
                selectedPinId={selectedPinId}
                onSelect={setSelectedPinId}
                draftLocation={mapDraftLocation}
                onPickLocation={pickMapLocation}
              />
              <MapComposerPanel
                draftLocation={mapDraftLocation}
                feedback={mapPinFeedback}
                form={mapPinForm}
                errors={mapPinErrors}
                onFormChange={setMapPinForm}
                onSubmit={submitMapPin}
                onUseSelectedCoordinates={useSelectedPinCoordinates}
              />
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
                onSpotPhotoFormChange={setSpotPhotoForm}
                onSubmitSpotPhoto={submitSpotPhoto}
                onSubmitWashReview={submitWashReview}
                onWashFormChange={setWashForm}
              />
            </section>
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
          {activeTab === "clans" ? <ClansScreen clans={clans} drivers={drivers} user={user} /> : null}
          {activeTab === "garage" ? (
            <GarageScreen
              appId={appId}
              firebaseStatus={firebaseStatus}
              fuelErrors={fuelErrors}
              fuelForm={fuelForm}
              fuelInsights={fuelInsights}
              onFuelFormChange={setFuelForm}
              onSubmitFuelLog={(event) => submitFuelLog(event, fuelForm)}
              user={user}
            />
          ) : null}
        </div>

        <nav className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 px-3">
          <div className="grid grid-cols-4 gap-2 rounded-[1.8rem] border border-white/10 bg-[#111111]/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`min-h-12 rounded-2xl px-2 py-2 text-center text-xs font-semibold transition ${
                  activeTab === item.key
                    ? "bg-lime-400 text-black shadow-[0_0_18px_rgba(163,230,53,0.45)]"
                    : "text-neutral-400"
                }`}
              >
                <span className="block text-[11px] uppercase tracking-[0.18em]">{item.icon}</span>
                <span className="mt-1 block">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </main>
  );
}

export default App;
