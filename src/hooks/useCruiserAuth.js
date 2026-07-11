import { useEffect, useState } from "react";
import {
  createAuthenticatedUser,
  createSignedUpUser,
  getQuickProfileByCredentials,
  listQuickProfiles,
} from "../repositories/cruiserRepository";
import { clearCruiserSession, loadCruiserSession, saveCruiserSession } from "../services/storage";
import { createFuelForm, createSignUpState } from "../utils/garage";
import { validateSignUpForm } from "../utils/validation";

export function useCruiserAuth() {
  const quickProfiles = listQuickProfiles();
  const persistedSession = loadCruiserSession();
  const hydratedPersistedUser = persistedSession?.user ? createAuthenticatedUser(persistedSession.user) : null;
  const [authTab, setAuthTab] = useState("login");
  const [authMode, setAuthMode] = useState(hydratedPersistedUser ? "authenticated" : "locked");
  const [loginForm, setLoginForm] = useState({
    plate: quickProfiles[0].plate,
    password: quickProfiles[0].password,
  });
  const [signUpForm, setSignUpForm] = useState(createSignUpState);
  const [signUpErrors, setSignUpErrors] = useState({});
  const [user, setUser] = useState(hydratedPersistedUser);
  const [fuelForm, setFuelForm] = useState(
    createFuelForm(hydratedPersistedUser?.odometer ?? quickProfiles[0].odometer),
  );

  useEffect(() => {
    if (!user) {
      clearCruiserSession();
      return;
    }

    saveCruiserSession({ user });
    setFuelForm((current) => ({
      ...current,
      currentKm: Math.round(user.odometer),
    }));
  }, [user]);

  const handleQuickLogin = (profile, options = {}) => {
    const authenticatedUser = createAuthenticatedUser(profile);
    setUser(authenticatedUser);
    setAuthMode("authenticated");
    setFuelForm(createFuelForm(profile.odometer));
    options.onAuthenticated?.();
  };

  const handleLogin = (event, options = {}) => {
    event.preventDefault();
    const match = getQuickProfileByCredentials(loginForm.plate, loginForm.password);

    if (match) {
      handleQuickLogin(match, options);
      return true;
    }

    setAuthMode("error");
    return false;
  };

  const handleSignUp = (event, options = {}) => {
    event.preventDefault();
    const validationErrors = validateSignUpForm(signUpForm);
    setSignUpErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return null;
    }
    const createdUser = createSignedUpUser(signUpForm);
    setUser(createdUser);
    setAuthMode("authenticated");
    setSignUpForm(createSignUpState());
    setSignUpErrors({});
    setFuelForm(createFuelForm(createdUser.odometer));
    options.onAuthenticated?.();
    return createdUser;
  };

  return {
    authMode,
    authTab,
    fuelForm,
    loginForm,
    setAuthTab,
    setFuelForm,
    setLoginForm,
    setSignUpForm,
    signUpErrors,
    setUser,
    signUpForm,
    user,
    handleLogin,
    handleQuickLogin,
    handleSignUp,
    quickProfiles,
  };
}
