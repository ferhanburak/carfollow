import { Field } from "../components/ui";

const inputClassName =
  "h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 text-base text-white outline-none transition focus:border-lime-400";

function FieldError({ children }) {
  return children ? <p className="text-xs text-rose-300">{children}</p> : null;
}

export function AuthScreen({
  authError,
  authFeedback,
  authMode,
  authTab,
  isFirebaseAuth,
  loginForm,
  onAuthTabChange,
  onLogin,
  onPasswordReset,
  onLoginFormChange,
  onQuickLogin,
  onSignUp,
  onSignUpAvatarChange,
  onSignUpFormChange,
  quickProfiles,
  signUpErrors,
  signUpForm,
  tuningOptions,
}) {
  const isBusy = authMode === "authenticating" || authMode === "loading";

  return (
    <main className="min-h-[100dvh] bg-[#050505] text-neutral-100 sm:px-4 sm:py-10">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col overflow-hidden bg-[#0a0a0a] shadow-[0_0_80px_rgba(163,230,53,0.08)] sm:min-h-[92vh] sm:rounded-[2rem] sm:border sm:border-white/10">
        <div className="app-safe-top relative overflow-hidden border-b border-white/10 px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(163,230,53,0.18),_transparent_42%),linear-gradient(135deg,rgba(23,23,23,0.96),rgba(10,10,10,1))]" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.4em] text-lime-400">CRUISER // ACCESS</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Car Culture. Live Utility. Night Logic.</h1>
            <p className="mt-3 max-w-sm text-sm text-neutral-400">
              Premium surus agina baglan, haritada spot kesfet, servis omrunu canli takip et.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-[#111111] p-3">
          {["login", "signup"].map((tab) => (
            <button
              key={tab}
              type="button"
              disabled={isBusy}
              onClick={() => onAuthTabChange(tab)}
              className={`min-h-12 rounded-2xl text-sm font-semibold transition disabled:opacity-60 ${
                authTab === tab
                  ? "bg-lime-400 text-black shadow-[0_0_24px_rgba(163,230,53,0.55)]"
                  : "bg-white/5 text-neutral-300"
              }`}
            >
              {tab === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 px-5 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {isFirebaseAuth ? (
            <div className="rounded-2xl border border-lime-400/20 bg-lime-400/8 px-4 py-3 text-sm text-neutral-300">
              <p className="font-semibold text-lime-200">Guvenli Hesap</p>
              <p className="mt-1 text-xs text-neutral-500">
                E-posta hesap anahtarin, plaka ise CRUISER icindeki aranabilir surucu kimligindir.
              </p>
            </div>
          ) : null}

          {authTab === "login" ? (
            <form className="space-y-4" onSubmit={onLogin}>
              <Field label={isFirebaseAuth ? "E-mail" : "Vehicle Plate"}>
                <input
                  type={isFirebaseAuth ? "email" : "text"}
                  autoComplete={isFirebaseAuth ? "email" : "username"}
                  value={isFirebaseAuth ? loginForm.email : loginForm.plate}
                  onChange={(event) =>
                    onLoginFormChange((current) =>
                      isFirebaseAuth
                        ? { ...current, email: event.target.value }
                        : { ...current, plate: event.target.value.toUpperCase() },
                    )
                  }
                  className={`${inputClassName} ${isFirebaseAuth ? "" : "font-mono tracking-[0.3em]"}`}
                  placeholder={isFirebaseAuth ? "driver@example.com" : "34 ABC 123"}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(event) =>
                    onLoginFormChange((current) => ({ ...current, password: event.target.value }))
                  }
                  className={inputClassName}
                  placeholder="6+ characters"
                />
              </Field>
              {isFirebaseAuth ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onPasswordReset}
                  className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-neutral-300 disabled:opacity-50"
                >
                  Sifremi Unuttum
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isBusy}
                className="min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_24px_rgba(163,230,53,0.4)] transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-60"
              >
                {isBusy ? "Baglaniyor..." : "Enter CRUISER"}
              </button>
              {authMode === "error" ? (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {authError || "Kimlik dogrulama islemi tamamlanamadi."}
                </div>
              ) : null}
              {authFeedback ? (
                <div className="rounded-2xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
                  {authFeedback}
                </div>
              ) : null}
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onSignUp}>
              <p className="text-xs text-neutral-500">
                <span className="font-bold text-rose-400">*</span> Zorunlu alan
              </p>
              <div className="grid grid-cols-1 gap-4">
                {isFirebaseAuth ? (
                  <Field label="E-mail" required>
                    <input
                      type="email"
                      autoComplete="email"
                      value={signUpForm.email}
                      onChange={(event) =>
                        onSignUpFormChange((current) => ({ ...current, email: event.target.value }))
                      }
                      className={inputClassName}
                    />
                    <FieldError>{signUpErrors.email}</FieldError>
                  </Field>
                ) : null}

                <Field label="Gorunen Ad" required>
                  <input
                    value={signUpForm.fullName}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, fullName: event.target.value }))
                    }
                    className={inputClassName}
                  />
                  <FieldError>{signUpErrors.fullName}</FieldError>
                </Field>

                <Field label="Plate" required>
                  <input
                    value={signUpForm.plate}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, plate: event.target.value.toUpperCase() }))
                    }
                    className={`${inputClassName} font-mono tracking-[0.25em]`}
                  />
                  <FieldError>{signUpErrors.plate}</FieldError>
                </Field>

                <Field label="Password" required>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={signUpForm.password}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, password: event.target.value }))
                    }
                    className={inputClassName}
                    placeholder="En az 8 karakter"
                  />
                  <FieldError>{signUpErrors.password}</FieldError>
                </Field>

                <Field label="Arac Turu" required>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
                    {[
                      ["car", "Otomobil"],
                      ["motorcycle", "Motosiklet"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${label} sec`}
                        onClick={() => onSignUpFormChange((current) => ({ ...current, vehicleType: value }))}
                        className={`min-h-12 rounded-xl text-sm font-semibold transition ${
                          signUpForm.vehicleType === value
                            ? "bg-lime-400 text-black"
                            : "bg-white/[0.04] text-neutral-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <FieldError>{signUpErrors.vehicleType}</FieldError>
                </Field>

                <Field label="Car/Bike Model" required>
                  <input
                    value={signUpForm.model}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, model: event.target.value }))
                    }
                    className={inputClassName}
                  />
                  <FieldError>{signUpErrors.model}</FieldError>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tuning Stage">
                    <select
                      value={signUpForm.tuningStage}
                      onChange={(event) =>
                        onSignUpFormChange((current) => ({ ...current, tuningStage: event.target.value }))
                      }
                      className={inputClassName}
                    >
                      {tuningOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Horsepower">
                    <input
                      type="number"
                      value={signUpForm.horsepower}
                      onChange={(event) =>
                        onSignUpFormChange((current) => ({ ...current, horsepower: event.target.value }))
                      }
                      className={inputClassName}
                    />
                    <FieldError>{signUpErrors.horsepower}</FieldError>
                  </Field>
                </div>

                <Field label="Mevcut KM" required>
                  <input
                    type="number"
                    min="0"
                    max="5000000"
                    inputMode="numeric"
                    value={signUpForm.odometer}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, odometer: event.target.value }))
                    }
                    className={`${inputClassName} font-mono`}
                    placeholder="Orn. 68420"
                  />
                  <FieldError>{signUpErrors.odometer}</FieldError>
                </Field>

                <Field label="Profil Fotografi">
                  <input
                    aria-label="Profil Fotografi"
                    type="file"
                    accept="image/*"
                    onChange={(event) => onSignUpAvatarChange?.(event.target.files?.[0] ?? null)}
                    className="block min-h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-3 py-2 text-sm text-neutral-300 file:mr-3 file:rounded-xl file:border-0 file:bg-lime-400 file:px-3 file:py-2 file:font-semibold file:text-black"
                  />
                  <FieldError>{signUpErrors.avatar}</FieldError>
                  {signUpForm.avatarPreview ? (
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <img src={signUpForm.avatarPreview} alt="Profil fotografi onizleme" className="h-16 w-16 rounded-2xl object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-neutral-200">{signUpForm.avatarFileName}</p>
                        <p className="mt-1 text-xs text-neutral-500">En fazla 5 MB</p>
                      </div>
                    </div>
                  ) : null}
                </Field>

                <Field label="Primary Garage/Tuning Shop">
                  <input
                    value={signUpForm.garage}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, garage: event.target.value }))
                    }
                    className={inputClassName}
                  />
                  <FieldError>{signUpErrors.garage}</FieldError>
                </Field>

                <details className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-neutral-400">
                  <summary className="cursor-pointer font-semibold text-neutral-200">KVKK Aydinlatma Metni</summary>
                  <div className="mt-3 space-y-2 leading-5">
                    <p>Hesap, arac, plaka, profil ve servis verileri CRUISER hesabini olusturmak, topluluk ozelliklerini sunmak ve guvenligi saglamak icin islenir.</p>
                    <p>Arkadaslik ozelligi icin hesabini bilen giris yapmis kullanicilar tam plakanla seni bulabilir. Toplu plaka listesi sunulmaz ve arama istekleri sinirlandirilir.</p>
                    <p>Konum hassasiyeti, Live Map plaka gorunurlugu ve diger sosyal profil alanlarini daha sonra Profil &gt; Gizlilik alanindan degistirebilirsin.</p>
                  </div>
                </details>

                <details className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-neutral-400">
                  <summary className="cursor-pointer font-semibold text-neutral-200">Kullanim Kosullari</summary>
                  <div className="mt-3 space-y-2 leading-5">
                    <p>CRUISER topluluk, surus ve arac kaydi ozellikleri guvenli ve hukuka uygun bicimde kullanilmalidir.</p>
                    <p>Yaniltici arac bilgisi, taciz, tehlikeli surus organizasyonu ve diger kullanicilarin guvenligini riske atan davranislar hesap kisitlamasina neden olabilir.</p>
                  </div>
                </details>

                <label className="flex gap-3 rounded-2xl border border-lime-400/20 bg-lime-400/[0.06] p-4 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={signUpForm.termsAccepted}
                    onChange={(event) => onSignUpFormChange((current) => ({ ...current, termsAccepted: event.target.checked }))}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-lime-400"
                  />
                  <span><span className="mr-1 font-bold text-rose-400">*</span>Kullanim Kosullarini kabul ediyorum.</span>
                </label>
                <FieldError>{signUpErrors.termsAccepted}</FieldError>

                <label className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={signUpForm.plateSearchEnabled}
                    onChange={(event) => onSignUpFormChange((current) => ({ ...current, plateSearchEnabled: event.target.checked }))}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-lime-400"
                  />
                  <span>Tam plakam yazildiginda diger kullanicilarin beni bulabilmesini istiyorum. <span className="text-neutral-500">Istege bagli</span></span>
                </label>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-neutral-400">
                  KVKK Aydinlatma Metni kayit sirasinda sunulur ve metin surumu sistemde kaydedilir. Istege bagli plaka aramasi daha sonra Gizlilik ayarlarindan degistirilebilir.
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="min-h-12 w-full rounded-2xl bg-lime-400 font-bold text-black shadow-[0_0_24px_rgba(163,230,53,0.4)] transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-60"
              >
                {isBusy ? "Hesap Olusturuluyor..." : "Build My Garage"}
              </button>
              {authMode === "error" && authError ? (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {authError}
                </div>
              ) : null}
            </form>
          )}

          {quickProfiles.length ? (
            <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-[#111111] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Quick Test Profiles</p>
                <span className="text-xs uppercase tracking-[0.3em] text-neutral-500">BYPASS</span>
              </div>
              {quickProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => onQuickLogin(profile)}
                  className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-lime-400/50 hover:bg-lime-400/10"
                >
                  <div>
                    <p className="font-mono text-sm tracking-[0.18em] text-lime-300">{profile.plate}</p>
                    <p className="text-xs text-neutral-400">{profile.model}</p>
                  </div>
                  <span className="rounded-full border border-lime-400/30 px-3 py-1 text-xs text-lime-300">
                    {profile.tuningStage}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
