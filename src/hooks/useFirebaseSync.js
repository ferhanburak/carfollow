import { useEffect, useRef, useState } from "react";
import {
  isFirebaseRepositoryEnabled,
  loadFirebaseWorldState,
  saveFirebaseActiveDriver,
  saveFirebaseFuelLog,
  saveFirebaseUserProfile,
} from "../repositories/cruiserRepository";
import {
  getFirebaseModeDiagnostics,
  getFirebaseServices,
  getLastFirebaseServicesError,
} from "../services/firebaseClient";

function sortByReferenceOrder(items, referenceItems, keySelector) {
  const referenceOrder = new Map(referenceItems.map((item, index) => [keySelector(item), index]));

  return [...items].sort((left, right) => {
    const leftIndex = referenceOrder.get(keySelector(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = referenceOrder.get(keySelector(right)) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

function mergeReferenceItems(referenceItems, remoteItems, keySelector) {
  const remoteById = new Map(remoteItems.map((item) => [keySelector(item), item]));
  const mergedReferenceItems = referenceItems.map((item) => ({
    ...item,
    ...(remoteById.get(keySelector(item)) ?? {}),
  }));
  const extraRemoteItems = remoteItems.filter((item) => !referenceItems.some((entry) => keySelector(entry) === keySelector(item)));

  return [...mergedReferenceItems, ...extraRemoteItems];
}

export function useFirebaseSync({
  initialWorld,
  user,
  setMapPins,
  setSelectedPinId,
  setClans,
  setDrivers,
}) {
  const firebaseDiagnostics = getFirebaseModeDiagnostics();
  const [firebaseStatus, setFirebaseStatus] = useState({
    mode: firebaseDiagnostics.mode,
    connection: firebaseDiagnostics.connection,
    authUid: null,
    profile: "idle",
    fuel: "idle",
    telemetry: "idle",
    lastProfileSyncAt: null,
    lastFuelSyncAt: null,
    lastTelemetrySyncAt: null,
    error: firebaseDiagnostics.enabled ? null : firebaseDiagnostics.message,
  });
  const lastRemoteUserSyncRef = useRef(0);

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
  }, [firebaseDiagnostics.connection, firebaseDiagnostics.enabled, firebaseDiagnostics.message, firebaseDiagnostics.mode]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromFirebase() {
      if (!isFirebaseRepositoryEnabled()) {
        return;
      }

      const remoteWorld = await loadFirebaseWorldState();
      if (!remoteWorld || cancelled) {
        return;
      }

      if (remoteWorld.mapPins?.length) {
        const mergedMapPins = mergeReferenceItems(initialWorld.mapPins, remoteWorld.mapPins, (pin) => pin.id);
        const orderedMapPins = sortByReferenceOrder(mergedMapPins, initialWorld.mapPins, (pin) => pin.id);
        setMapPins(orderedMapPins);
        setSelectedPinId((current) =>
          orderedMapPins.some((pin) => pin.id === current) ? current : orderedMapPins[0].id,
        );
      }
      if (remoteWorld.clans?.length) {
        setClans(
          sortByReferenceOrder(
            mergeReferenceItems(initialWorld.clans, remoteWorld.clans, (clan) => clan.id),
            initialWorld.clans,
            (clan) => clan.id,
          ),
        );
      }
      if (remoteWorld.drivers?.length) {
        setDrivers(
          sortByReferenceOrder(
            mergeReferenceItems(initialWorld.drivers, remoteWorld.drivers, (driver) => driver.plate),
            initialWorld.drivers,
            (driver) => driver.plate,
          ),
        );
      }
    }

    void hydrateFromFirebase();

    return () => {
      cancelled = true;
    };
  }, [initialWorld.clans, initialWorld.drivers, initialWorld.mapPins, setClans, setDrivers, setMapPins, setSelectedPinId]);

  useEffect(() => {
    if (!user || !isFirebaseRepositoryEnabled()) {
      return;
    }

    const now = Date.now();
    if (now - lastRemoteUserSyncRef.current < 15000) {
      return;
    }

    lastRemoteUserSyncRef.current = now;
    setFirebaseStatus((current) => ({ ...current, profile: "syncing", error: null }));
    void saveFirebaseUserProfile(user)
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
  }, [user]);

  const syncFuelLog = (nextLog) => {
    setFirebaseStatus((current) => ({ ...current, fuel: "syncing", error: null }));
    void saveFirebaseFuelLog(nextLog)
      .then((result) => {
        if (!result) {
          setFirebaseStatus((current) => ({
            ...current,
            fuel: "error",
            error: getLastFirebaseServicesError() || "Fuel log sync was skipped because Firebase is unavailable.",
          }));
          return;
        }

        setFirebaseStatus((current) => ({
          ...current,
          authUid: result.authUid,
          fuel: "synced",
          lastFuelSyncAt: result.syncedAt,
        }));
      })
      .catch((error) => {
        setFirebaseStatus((current) => ({
          ...current,
          fuel: "error",
          error: error instanceof Error ? error.message : "Fuel log sync failed.",
        }));
      });
  };

  const syncTelemetry = (driver) => {
    setFirebaseStatus((current) => ({ ...current, telemetry: "syncing", error: null }));
    void saveFirebaseActiveDriver(driver)
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
      });
  };

  return {
    firebaseStatus,
    syncFuelLog,
    syncTelemetry,
  };
}
