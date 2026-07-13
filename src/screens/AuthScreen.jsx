import { Field } from "../components/ui";

const inputClassName =
  "h-12 w-full rounded-2xl border border-white/10 bg-[#171717] px-4 text-white outline-none transition focus:border-lime-400";

function FieldError({ children }) {
  return children ? <p className="text-xs text-rose-300">{children}</p> : null;
}

export function AuthScreen({
  authError,
  authMode,
  authTab,
  isFirebaseAuth,
  loginForm,
  onAuthTabChange,
  onLogin,
  onLoginFormChange,
  onQuickLogin,
  onSignUp,
  onSignUpFormChange,
  quickProfiles,
  signUpErrors,
  signUpForm,
  tuningOptions,
}) {
  const isBusy = authMode === "authenticating" || authMode === "loading";

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-10 text-neutral-100">
      <div className="mx-auto flex min-h-[92vh] max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-[0_0_80px_rgba(163,230,53,0.08)]">
        <div className="relative overflow-hidden border-b border-white/10 px-6 py-6">
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

        <div className="flex-1 space-y-5 px-5 py-6">
          {isFirebaseAuth ? (
            <div className="rounded-2xl border border-lime-400/20 bg-lime-400/8 px-4 py-3 text-sm text-neutral-300">
              <p className="font-semibold text-lime-200">Firebase Secure Account</p>
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
            </form>
          ) : (
            <form className="space-y-4" onSubmit={onSignUp}>
              <div className="grid grid-cols-1 gap-4">
                {isFirebaseAuth ? (
                  <Field label="E-mail">
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

                <Field label="Full Name">
                  <input
                    value={signUpForm.fullName}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, fullName: event.target.value }))
                    }
                    className={inputClassName}
                  />
                  <FieldError>{signUpErrors.fullName}</FieldError>
                </Field>

                <Field label="Plate">
                  <input
                    value={signUpForm.plate}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, plate: event.target.value.toUpperCase() }))
                    }
                    className={`${inputClassName} font-mono tracking-[0.25em]`}
                  />
                  <FieldError>{signUpErrors.plate}</FieldError>
                </Field>

                <Field label="Password">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={signUpForm.password}
                    onChange={(event) =>
                      onSignUpFormChange((current) => ({ ...current, password: event.target.value }))
                    }
                    className={inputClassName}
                  />
                  <FieldError>{signUpErrors.password}</FieldError>
                </Field>

                <Field label="Car/Bike Model">
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
