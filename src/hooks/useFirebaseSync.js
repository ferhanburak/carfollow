import { useEffect, useRef, useState } from "react";
import {
  isFirebaseRepositoryEnabled,
  saveFirebaseActiveDriver,
  saveFirebaseFuelLog,
  saveFirebaseServiceLog,
  saveFirebaseUserProfile,
  subscribeFirebaseActiveDrivers,
} from "../repositories/cruiserRepository";
import {
  getFirebaseModeDiagnostics,
  getFirebaseServices,
  getLastFirebaseServicesError,
} from "../services/firebaseClient";

export function useFirebaseSync({
  user,
  setDrivers,
}) {
  const firebaseDiagnostics = getFirebaseModeDiagnostics();
  const [firebaseStatus, setFirebaseStatus] = useState({
    mode: firebaseDiagnostics.mode,
    connection: firebaseDiagnostics.connection,
    authUid: null,
    profile: "idle",
    fuel: "idle",
    service: "idle",
    telemetry: "idle",
    lastProfileSyncAt: null,
    lastFuelSyncAt: null,
    lastServiceSyncAt: null,
    lastTelemetrySyncAt: null,
    error: firebaseDiagnostics.enabled ? null : firebaseDiagnostics.message,
  });
  const lastRemoteUserSyncRef = useRef(0);
  const profileSyncTimerRef = useRef(null);
  const telemetryWriteQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    lastRemoteUserSyncRef.current = 0;
    if (profileSyncTimerRef.current) {
      globalThis.clearTimeout(profileSyncTimerRef.current);
      profileSyncTimerRef.current = null;
    }
  }, [user?.firebaseUid]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFirebaseSession() {
      if (!firebaseDiagnostics.enabled) {
        setFirebaseStatus((current) => ({
          ...current,
          mode: firebaseDiagnostics.mode,
          connection: firebaseDiagnostics.connection,
          error: firebaseDiagnostics.message,
        }));
        return;
      }

      if (!user) {
        setFirebaseStatus((current) => ({
          ...current,
          mode: "firebase",
          connection: "awaiting-auth",
          authUid: null,
          error: null,
        }));
        return;
      }

      try {
        const services = await getFirebaseServices();
        if (cancelled) {
          return;
        }

        if (!services) {
          setFirebaseStatus((current) => ({
            ...current,
            mode: "firebase",
            connection: "error",
            error: getLastFirebaseServicesError() || "Firebase session could not be initialized.",
          }));
          return;
        }

        setFirebaseStatus((current) => ({
          ...current,
          mode: "firebase",
          connection: services.database ? "online" : "degraded",
          authUid: services.authUser.uid,
          error: null,
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFirebaseStatus((current) => ({
          ...current,
          mode: "firebase",
          connection: "error",
          error: error instanceof Error ? error.message : "Firebase session could not be initialized.",
        }));
      }
    }

    void hydrateFirebaseSession();

    return () => {
      cancelled = true;
    };
  }, [
    firebaseDiagnostics.connection,
    firebaseDiagnostics.enabled,
    firebaseDiagnostics.message,
    firebaseDiagnostics.mode,
    user?.firebaseUid,
  ]);

  useEffect(() => {
    let cancelled = false;

    let unsubscribe = () => {};

    async function subscribeToFirebaseDrivers() {
      if (!user || !isFirebaseRepositoryEnabled()) {
        setDrivers([]);
        return;
      }

      setDrivers([]);
      const cleanup = await subscribeFirebaseActiveDrivers((activeDrivers) => {
        if (!cancelled) {
          setDrivers(activeDrivers);
        }
      });
      if (cancelled) {
        cleanup();
      } else {
        unsubscribe = cleanup;
      }
    }

    void subscribeToFirebaseDrivers().catch((error) => {
      if (!cancelled) {
        setDrivers([]);
        setFirebaseStatus((current) => ({
          ...current,
          telemetry: "error",
          error: error instanceof Error ? error.message : "Active driver subscription failed.",
        }));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setDrivers, user?.firebaseUid]);

  useEffect(() => {
    if (!user || !isFirebaseRepositoryEnabled()) {
      return undefined;
    }

    if (profileSyncTimerRef.current) {
      globalThis.clearTimeout(profileSyncTimerRef.current);
    }

    const elapsed = Date.now() - lastRemoteUserSyncRef.current;
    const delay = Math.max(0, 15000 - elapsed);
    const userSnapshot = user;
    profileSyncTimerRef.current = globalThis.setTimeout(() => {
      profileSyncTimerRef.current = null;
      lastRemoteUserSyncRef.current = Date.now();
      setFirebaseStatus((current) => ({ ...current, profile: "syncing", error: null }));
      void saveFirebaseUserProfile(userSnapshot)
        .then((result) => {
          if (!result) {
            setFirebaseStatus((current) => ({
              ...current,
              profile: "error",
              error: getLastFirebaseServicesError() || "Profile sync was skipped because Firebase is unavailable.",
            }));
            return;
          }

          setFirebaseStatus((current) => ({
            ...current,
            authUid: result.authUid,
            profile: "synced",
            lastProfileSyncAt: result.syncedAt,
          }));
        })
        .catch((error) => {
          setFirebaseStatus((current) => ({
            ...current,
            profile: "error",
            error: error instanceof Error ? error.message : "Profile sync failed.",
          }));
        });
    }, delay);

    return () => {
      if (profileSyncTimerRef.current) {
        globalThis.clearTimeout(profileSyncTimerRef.current);
        profileSyncTimerRef.current = null;
      }
    };
  }, [user]);

  const syncFuelLog = async (nextLog) => {
    if (!isFirebaseRepositoryEnabled()) {
      return { ok: true, mode: "mock", syncedAt: Date.now() };
    }

    setFirebaseStatus((current) => ({ ...current, fuel: "syncing", error: null }));
    try {
      const result = await saveFirebaseFuelLog(nextLog);
      if (!result) {
        const error = getLastFirebaseServicesError() || "Fuel log sync was skipped because Firebase is unavailable.";
        setFirebaseStatus((current) => ({ ...current, fuel: "error", error }));
        return { ok: false, error };
      }

      setFirebaseStatus((current) => ({
        ...current,
        authUid: result.authUid,
        fuel: "synced",
        lastFuelSyncAt: result.syncedAt,
      }));
      return { ok: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fuel log sync failed.";
      setFirebaseStatus((current) => ({ ...current, fuel: "error", error: message }));
      return { ok: false, error: message };
    }
  };

  const syncTelemetry = (driver) => {
    if (!isFirebaseRepositoryEnabled()) {
      return Promise.resolve(null);
    }

    setFirebaseStatus((current) => ({ ...current, telemetry: "syncing", error: null }));
    const operation = telemetryWriteQueueRef.current
      .then(() => saveFirebaseActiveDriver(driver));
    const handledOperation = operation
      .then((result) => {
        if (!result) {
          setFirebaseStatus((current) => ({
            ...current,
            telemetry: "error",
            error: getLastFirebaseServicesError() || "Telemetry sync was skipped because Firebase is unavailable.",
          }));
          return;
        }

        setFirebaseStatus((current) => ({
          ...current,
          authUid: result.authUid,
          telemetry: "synced",
          lastTelemetrySyncAt: result.syncedAt,
        }));
      })
      .catch((error) => {
        setFirebaseStatus((current) => ({
          ...current,
          telemetry: "error",
          error: error instanceof Error ? error.message : "Telemetry sync failed.",
        }));
        return null;
      });
    telemetryWriteQueueRef.current = handledOperation;
    return handledOperation;
  };

  const syncServiceLog = async (serviceLog, part) => {
    if (!isFirebaseRepositoryEnabled()) {
      return { ok: true, mode: "mock", syncedAt: Date.now() };
    }

    setFirebaseStatus((current) => ({ ...current, service: "syncing", error: null }));
    try {
      const result = await saveFirebaseServiceLog(serviceLog, part);
      if (!result) {
        const error = getLastFirebaseServicesError() || "Service sync was skipped because Firebase is unavailable.";
        setFirebaseStatus((current) => ({ ...current, service: "error", error }));
        return { ok: false, error };
      }

      setFirebaseStatus((current) => ({
        ...current,
        authUid: result.authUid,
        service: "synced",
        lastServiceSyncAt: result.syncedAt,
      }));
      return { ok: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Service sync failed.";
      setFirebaseStatus((current) => ({ ...current, service: "error", error: message }));
      return { ok: false, error: message };
    }
  };

  return {
    firebaseStatus,
    syncFuelLog,
    syncServiceLog,
    syncTelemetry,
  };
}
