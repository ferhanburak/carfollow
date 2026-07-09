import { startTransition, useEffect, useRef, useState } from "react";
import {
  appendFuelLog,
  appendWashReview,
  buildDriveTickState,
  getInitialWorldState,
  incrementClanKm,
  incrementGalleryLike,
  incrementPinLike,
  incrementUserOdometer,
  isFirebaseRepositoryEnabled,
  joinCruiseAttendee,
  loadFirebaseWorldState,
  saveFirebaseActiveDriver,
  saveFirebaseCruiseJoin,
  saveFirebaseFuelLog,
  saveFirebaseUserProfile,
  saveFirebaseWashReview,
  syncActiveDriver,
  tickAmbientDrivers,
} from "../repositories/cruiserRepository";
import { getFirebaseServices } from "../services/firebaseClient";
import { createFuelForm, createWashForm, computeFuelInsights } from "../utils/garage";
import { validateFuelForm, validateWashForm } from "../utils/validation";

function sortByReferenceOrder(items, referenceItems, keySelector) {
  const referenceOrder = new Map(referenceItems.map((item, index) => [keySelector(item), index]));

  return [...items].sort((left, right) => {
    const leftIndex = referenceOrder.get(keySelector(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = referenceOrder.get(keySelector(right)) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

export function useCruiserWorld(user, setUser, setFuelForm) {
  const initialWorld = getInitialWorldState();
  const firebaseMode = isFirebaseRepositoryEnabled() ? "firebase" : "mock";
  const [activeTab, setActiveTab] = useState("map");
  const [isDriving, setIsDriving] = useState(false);
  const [driveHud, setDriveHud] = useState({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
  const [mapPins, setMapPins] = useState(initialWorld.mapPins);
  const [selectedPinId, setSelectedPinId] = useState(initialWorld.mapPins[0].id);
  const [washForm, setWashForm] = useState(createWashForm);
  const [washErrors, setWashErrors] = useState({});
  const [washFeedback, setWashFeedback] = useState("");
  const [fuelErrors, setFuelErrors] = useState({});
  const [clans, setClans] = useState(initialWorld.clans);
  const [drivers, setDrivers] = useState(initialWorld.drivers);
  const [firebaseStatus, setFirebaseStatus] = useState({
    mode: firebaseMode,
    authUid: null,
    profile: "idle",
    fuel: "idle",
    telemetry: "idle",
    lastProfileSyncAt: null,
    lastFuelSyncAt: null,
    lastTelemetrySyncAt: null,
    error: null,
  });
  const tickerRef = useRef(0);
  const lastRemoteUserSyncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFirebaseSession() {
      if (!isFirebaseRepositoryEnabled()) {
        setFirebaseStatus((current) => ({ ...current, mode: "mock" }));
        return;
      }

      try {
        const services = await getFirebaseServices();
        if (!services || cancelled) {
          return;
        }

        setFirebaseStatus((current) => ({
          ...current,
          mode: "firebase",
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
          error: error instanceof Error ? error.message : "Firebase session could not be initialized.",
        }));
      }
    }

    void hydrateFirebaseSession();

    return () => {
      cancelled = true;
    };
  }, []);

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
        const mergedMapPins = remoteWorld.mapPins.map((pin) => ({
          ...(initialWorld.mapPins.find((item) => item.id === pin.id) ?? {}),
          ...pin,
        }));
        const orderedMapPins = sortByReferenceOrder(mergedMapPins, initialWorld.mapPins, (pin) => pin.id);
        setMapPins(orderedMapPins);
        setSelectedPinId((current) =>
          orderedMapPins.some((pin) => pin.id === current) ? current : orderedMapPins[0].id,
        );
      }
      if (remoteWorld.clans?.length) {
        setClans(sortByReferenceOrder(remoteWorld.clans, initialWorld.clans, (clan) => clan.id));
      }
      if (remoteWorld.drivers?.length) {
        setDrivers(sortByReferenceOrder(remoteWorld.drivers, initialWorld.drivers, (driver) => driver.plate));
      }
    }

    void hydrateFromFirebase();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const shuffleTimer = window.setInterval(() => {
      startTransition(() => {
        setDrivers((current) => tickAmbientDrivers(current, tickerRef.current));
        tickerRef.current += 1;
      });
    }, 2200);

    return () => window.clearInterval(shuffleTimer);
  }, []);

  useEffect(() => {
    if (!isDriving || !user) {
      return undefined;
    }

    const driveTimer = window.setInterval(() => {
      startTransition(() => {
        setDriveHud((current) => buildDriveTickState(current));

        setUser((current) => {
          if (!current) {
            return current;
          }

          return incrementUserOdometer(current);
        });

        setClans((current) => incrementClanKm(current, user.clan));
        setDrivers((current) => syncActiveDriver(current, user));
      });
    }, 1000);

    return () => window.clearInterval(driveTimer);
  }, [isDriving, setUser, user]);

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

  const selectedPin = mapPins.find((pin) => pin.id === selectedPinId) ?? mapPins[0];
  const fuelInsights = user ? computeFuelInsights(user.fuelLogs) : { average: 0, costPerFill: 0, totalSpend: 0 };

  const likePin = () => {
    setMapPins((current) => incrementPinLike(current, selectedPin.id));
  };

  const likeGalleryImage = (galleryId) => {
    setMapPins((current) => incrementGalleryLike(current, selectedPin.id, galleryId));
  };

  const submitWashReview = (event) => {
    event.preventDefault();
    if (!user || selectedPin.type !== "wash") {
      return;
    }
    const validationErrors = validateWashForm(washForm);
    setWashErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const review = {
      id: `review-${Date.now()}`,
      author: user.plate,
      foam: Number(washForm.foam),
      water: Number(washForm.water),
      allowsBuckets: washForm.allowsBuckets,
      shadowDrying: washForm.shadowDrying,
      note: washForm.note,
    };

    setMapPins((current) => appendWashReview(current, selectedPin.id, review));
    setWashForm(createWashForm());
    setWashErrors({});
    setWashFeedback("Review added successfully.");
    void saveFirebaseWashReview(selectedPin.id, review);
  };

  const joinCruise = () => {
    if (!user || selectedPin.type !== "meet") {
      return;
    }

    setMapPins((current) => joinCruiseAttendee(current, selectedPin.id, user.plate));
    void saveFirebaseCruiseJoin(selectedPin.id, user.plate);
  };

  const submitFuelLog = (event, fuelForm) => {
    event.preventDefault();
    if (!user) {
      return;
    }
    const validationErrors = validateFuelForm(fuelForm, user.odometer);
    setFuelErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const nextLog = {
      id: `fuel-${Date.now()}`,
      liters: Number(fuelForm.liters),
      price: Number(fuelForm.price),
      currentKm: Number(fuelForm.currentKm),
      station: fuelForm.station,
    };

    setUser((current) => appendFuelLog(current, nextLog));
    setFuelForm(createFuelForm(Number(fuelForm.currentKm)));
    setFuelErrors({});
    setFirebaseStatus((current) => ({ ...current, fuel: "syncing", error: null }));
    void saveFirebaseFuelLog(nextLog)
      .then((result) => {
        if (!result) {
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

  const toggleDrive = () => {
    setIsDriving((current) => !current);
    setActiveTab("drive");
    if (user) {
      setFirebaseStatus((current) => ({ ...current, telemetry: "syncing", error: null }));
      void saveFirebaseActiveDriver({
        plate: user.plate,
        vehicle: user.model,
        node: driveHud.etaNode,
        speed: driveHud.speed,
      })
        .then((result) => {
          if (!result) {
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
    }
  };

  const resetSessionView = () => {
    setActiveTab("map");
    setDriveHud({ speed: 0, sessionKm: 0, etaNode: "Hazir" });
    setWashFeedback("");
  };

  return {
    activeTab,
    clans,
    driveHud,
    drivers,
    fuelInsights,
    fuelErrors,
    isDriving,
    joinCruise,
    likeGalleryImage,
    likePin,
    mapPins,
    resetSessionView,
    selectedPin,
    selectedPinId,
    setActiveTab,
    setSelectedPinId,
    setWashForm,
    submitFuelLog,
    submitWashReview,
    toggleDrive,
    firebaseStatus,
    washForm,
    washErrors,
    washFeedback,
  };
}
