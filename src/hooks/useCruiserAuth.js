import { useEffect, useRef, useState } from "react";
import {
  createAuthenticatedUser,
  createSignedUpUser,
  getQuickProfileByCredentials,
  isFirebaseAuthRepositoryEnabled,
  listQuickProfiles,
  loadFirebaseAuthenticatedProfile,
  registerFirebaseAccount,
  signInFirebaseAccount,
  signOutFirebaseAccount,
  subscribeFirebaseAuthState,
} from "../repositories/cruiserRepository";
import { clearCruiserSession, loadCruiserSession, saveCruiserSession } from "../services/storage";
import { createFuelForm, createSignUpState } from "../utils/garage";
import { validateSignUpForm } from "../utils/validation";

function getAuthErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "Bu e-posta adresi zaten kullaniliyor.",
    "auth/invalid-credential": "E-posta veya sifre hatali.",
    "auth/invalid-email": "Gecerli bir e-posta adresi gir.",
    "auth/network-request-failed": "Firebase baglantisi kurulamadi. Internet baglantisini kontrol et.",
    "auth/operation-not-allowed": "Firebase Console'da Email/Password giris yontemini etkinlestir.",
    "auth/too-many-requests": "Cok fazla deneme yapildi. Biraz bekleyip tekrar dene.",
    "auth/weak-password": "Sifre en az 6 karakter olmali.",
    "cruiser/firebase-unavailable": "Firebase su anda kullanilamiyor.",
    "cruiser/plate-already-in-use": "Bu plaka baska bir CRUISER hesabinda kayitli.",
    "cruiser/profile-not-found": "Firebase hesabi bulundu fakat CRUISER profili eksik.",
    "cruiser/vehicle-not-found": "Hesabin aktif arac kaydi bulunamadi.",
    "cruiser/vehicle-owner-mismatch": "Arac sahipligi bu Firebase hesabi ile eslesmiyor.",
    "cruiser/vehicle-passport-not-found": "Vehicle Passport kaydi yuklenemedi.",
    "permission-denied": "Firebase guvenlik kurallari bu hesap islemini reddetti.",
  };

  return messages[error?.code] ?? (error instanceof Error ? error.message : "Kimlik dogrulama islemi tamamlanamadi.");
}

export function useCruiserAuth() {
  const firebaseAuthEnabled = isFirebaseAuthRepositoryEnabled();
  const allQuickProfiles = listQuickProfiles();
  const quickProfiles = firebaseAuthEnabled ? [] : allQuickProfiles;
  const persistedSession = firebaseAuthEnabled ? null : loadCruiserSession();
  const hydratedPersistedUser = persistedSession?.user ? createAuthenticatedUser(persistedSession.user) : null;
  const authActionRef = useRef(false);
  const [authTab, setAuthTab] = useState("login");
  const [authMode, setAuthMode] = useState(
    firebaseAuthEnabled ? "loading" : hydratedPersistedUser ? "authenticated" : "locked",
  );
  const [authError, setAuthError] = useState("");
  const [loginForm, setLoginForm] = useState({
    email: "",
    plate: allQuickProfiles[0]?.plate ?? "",
    password: allQuickProfiles[0]?.password ?? "",
  });
  const [signUpForm, setSignUpForm] = useState(createSignUpState);
  const [signUpErrors, setSignUpErrors] = useState({});
  const [user, setUser] = useState(hydratedPersistedUser);
  const [fuelForm, setFuelForm] = useState(
    createFuelForm(hydratedPersistedUser?.odometer ?? allQuickProfiles[0]?.odometer ?? 0),
  );

  useEffect(() => {
    if (!firebaseAuthEnabled) {
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = () => {};

    async function bindFirebaseSession() {
      try {
        unsubscribe = await subscribeFirebaseAuthState(async (firebaseUser) => {
          if (cancelled || authActionRef.current) {
            return;
          }

          if (!firebaseUser) {
            setUser(null);
            setAuthMode("locked");
            setAuthError("");
            return;
          }

          if (firebaseUser.isAnonymous) {
            authActionRef.current = true;
            try {
              await signOutFirebaseAccount();
            } finally {
              authActionRef.current = false;
            }
            setUser(null);
            setAuthMode("locked");
            setAuthError("");
            return;
          }

          setAuthMode("loading");
          try {
            const remoteProfile = await loadFirebaseAuthenticatedProfile(firebaseUser);
            if (cancelled) {
              return;
            }
            const authenticatedUser = createAuthenticatedUser(remoteProfile);
            setUser(authenticatedUser);
            setFuelForm(createFuelForm(authenticatedUser.odometer));
            setAuthError("");
            setAuthMode("authenticated");
          } catch (error) {
            if (!cancelled) {
              setUser(null);
              setAuthError(getAuthErrorMessage(error));
              setAuthMode("error");
            }
          }
        });
      } catch (error) {
        if (!cancelled) {
          setAuthError(getAuthErrorMessage(error));
          setAuthMode("error");
        }
      }
    }

    void bindFirebaseSession();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [firebaseAuthEnabled]);

  useEffect(() => {
    if (firebaseAuthEnabled) {
      return;
    }

    if (!user) {
      clearCruiserSession();
      return;
    }

    saveCruiserSession({ user });
  }, [firebaseAuthEnabled, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFuelForm((current) => ({
      ...current,
      currentKm: Math.round(user.odometer),
    }));
  }, [user?.odometer]);

  const finishAuthentication = (profile, options = {}) => {
    const authenticatedUser = createAuthenticatedUser(profile);
    setUser(authenticatedUser);
    setAuthMode("authenticated");
    setAuthError("");
    setFuelForm(createFuelForm(authenticatedUser.odometer));
    options.onAuthenticated?.();
    return authenticatedUser;
  };

  const handleQuickLogin = (profile, options = {}) => {
    if (firebaseAuthEnabled) {
      return null;
    }

    return finishAuthentication(profile, options);
  };

  const handleLogin = async (event, options = {}) => {
    event.preventDefault();
    setAuthError("");

    if (!firebaseAuthEnabled) {
      const match = getQuickProfileByCredentials(loginForm.plate, loginForm.password);
      if (match) {
        finishAuthentication(match, options);
        return true;
      }
      setAuthError("Profil bulunamadi. Asagidaki test profillerinden biriyle hizli giris yapabilirsin.");
      setAuthMode("error");
      return false;
    }

    if (!loginForm.email.trim() || !loginForm.password) {
      setAuthError("E-posta ve sifre gerekli.");
      setAuthMode("error");
      return false;
    }

    authActionRef.current = true;
    setAuthMode("authenticating");
    try {
      const remoteProfile = await signInFirebaseAccount(loginForm.email, loginForm.password);
      finishAuthentication(remoteProfile, options);
      return true;
    } catch (error) {
      try {
        await signOutFirebaseAccount();
      } catch {
        // Keep the original authentication error as the user-facing reason.
      }
      setUser(null);
      setAuthError(getAuthErrorMessage(error));
      setAuthMode("error");
      return false;
    } finally {
      authActionRef.current = false;
    }
  };

  const handleSignUp = async (event, options = {}) => {
    event.preventDefault();
    const validationErrors = validateSignUpForm(signUpForm, { requireEmail: firebaseAuthEnabled });
    setSignUpErrors(validationErrors);
    setAuthError("");
    if (Object.keys(validationErrors).length > 0) {
      return null;
    }

    const baseUser = createSignedUpUser(signUpForm);
    if (!firebaseAuthEnabled) {
      const createdUser = finishAuthentication(baseUser, options);
      setSignUpForm(createSignUpState());
      setSignUpErrors({});
      return createdUser;
    }

    authActionRef.current = true;
    setAuthMode("authenticating");
    try {
      const remoteProfile = await registerFirebaseAccount({
        email: signUpForm.email,
        password: signUpForm.password,
        user: baseUser,
      });
      const createdUser = finishAuthentication(remoteProfile, options);
      setSignUpForm(createSignUpState());
      setSignUpErrors({});
      return createdUser;
    } catch (error) {
      setUser(null);
      setAuthError(getAuthErrorMessage(error));
      setAuthMode("error");
      return null;
    } finally {
      authActionRef.current = false;
    }
  };

  const handleLogout = async () => {
    authActionRef.current = true;
    try {
      if (firebaseAuthEnabled) {
        await signOutFirebaseAccount();
      } else {
        clearCruiserSession();
      }
    } finally {
      setUser(null);
      setAuthError("");
      setAuthMode("locked");
      setAuthTab("login");
      authActionRef.current = false;
    }
  };

  return {
    authError,
    authMode,
    authTab,
    fuelForm,
    handleLogin,
    handleLogout,
    handleQuickLogin,
    handleSignUp,
    isFirebaseAuth: firebaseAuthEnabled,
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
  };
}
