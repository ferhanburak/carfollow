import { startTransition, useEffect, useRef, useState } from "react";
import {
  appendFuelLog,
  appendMapPin,
  appendSpotPhoto,
  appendWashReview,
  buildDriveTickState,
  createAttendeeRecord,
  getInitialWorldState,
  incrementClanKm,
  incrementGalleryLike,
  incrementPinLike,
  incrementUserOdometer,
  isFirebaseRepositoryEnabled,
  joinCruiseAttendee,
  loadFirebaseWorldState,
  rateCruiseAttendee,
  saveFirebaseActiveDriver,
  saveFirebaseCruiseJoin,
  saveFirebaseFuelLog,
  saveFirebaseMapPin,
  saveFirebaseUserProfile,
  saveFirebaseWashReview,
  syncActiveDriver,
  tickAmbientDrivers,
} from "../repositories/cruiserRepository";
import { getFirebaseServices } from "../services/firebaseClient";
import {
  createFuelForm,
  createMapPinForm,
  createSpotPhotoForm,
  createWashForm,
  computeFuelInsights,
} from "../utils/garage";
import {
  validateFuelForm,
  validateMapPinForm,
  validateSpotPhotoForm,
  validateWashForm,
} from "../utils/validation";

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

function parseTags(rawTags) {
  return rawTags
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

function buildFallbackGridPosition(lat, lng, pins) {
  const latitudes = [...pins.map((pin) => pin.lat).filter((value) => typeof value === "number"), lat];
  const longitudes = [...pins.map((pin) => pin.lng).filter((value) => typeof value === "number"), lng];
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const normalizedX = 15 + ((lng - minLng) / lngRange) * 70;
  const normalizedY = 85 - ((lat - minLat) / latRange) * 70;

  return {
    x: `${normalizedX.toFixed(0)}%`,
    y: `${normalizedY.toFixed(0)}%`,
  };
}

function buildMeetRoutePath(lat, lng) {
  return [
    { lat: Number((lat + 0.028).toFixed(4)), lng: Number((lng - 0.051).toFixed(4)) },
    { lat: Number((lat + 0.013).toFixed(4)), lng: Number((lng - 0.021).toFixed(4)) },
    { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) },
  ];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Photo file could not be read."));
    reader.readAsDataURL(file);
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
  const [mapPinForm, setMapPinForm] = useState(() => createMapPinForm(initialWorld.mapPins[0]));
  const [mapPinErrors, setMapPinErrors] = useState({});
  const [mapPinFeedback, setMapPinFeedback] = useState("");
  const [mapDraftLocation, setMapDraftLocation] = useState(null);
  const [spotPhotoForm, setSpotPhotoForm] = useState(createSpotPhotoForm);
  const [spotPhotoErrors, setSpotPhotoErrors] = useState({});
  const [spotPhotoFeedback, setSpotPhotoFeedback] = useState("");
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
        const mergedMapPins = mergeReferenceItems(initialWorld.mapPins, remoteWorld.mapPins, (pin) => pin.id);
        const orderedMapPins = sortByReferenceOrder(mergedMapPins, initialWorld.mapPins, (pin) => pin.id);
        setMapPins(orderedMapPins);
        setSelectedPinId((current) =>
          orderedMapPins.some((pin) => pin.id === current) ? current : orderedMapPins[0].id,
        );
      }
      if (remoteWorld.clans?.length) {
        setClans(sortByReferenceOrder(mergeReferenceItems(initialWorld.clans, remoteWorld.clans, (clan) => clan.id), initialWorld.clans, (clan) => clan.id));
      }
      if (remoteWorld.drivers?.length) {
        setDrivers(sortByReferenceOrder(mergeReferenceItems(initialWorld.drivers, remoteWorld.drivers, (driver) => driver.plate), initialWorld.drivers, (driver) => driver.plate));
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

    let nextPin = null;
    setMapPins((current) => {
      const nextPins = appendWashReview(current, selectedPin.id, review);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });
    setWashForm(createWashForm());
    setWashErrors({});
    setWashFeedback("Review added successfully.");
    void saveFirebaseWashReview(selectedPin.id, review);
    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const joinCruise = () => {
    if (!user || selectedPin.type !== "meet") {
      return;
    }

    const attendee = createAttendeeRecord(user);
    let nextPin = null;
    setMapPins((current) => {
      const nextPins = joinCruiseAttendee(current, selectedPin.id, attendee);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });
    void saveFirebaseCruiseJoin(selectedPin.id, user.plate);
    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const rateAttendee = (plate, signal) => {
    if (selectedPin.type !== "meet") {
      return;
    }

    let nextPin = null;
    setMapPins((current) => {
      const nextPins = rateCruiseAttendee(current, selectedPin.id, plate, signal);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });

    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const submitFuelLog = (event, nextFuelForm) => {
    event.preventDefault();
    if (!user) {
      return;
    }
    const validationErrors = validateFuelForm(nextFuelForm, user.odometer);
    setFuelErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const nextLog = {
      id: `fuel-${Date.now()}`,
      liters: Number(nextFuelForm.liters),
      price: Number(nextFuelForm.price),
      currentKm: Number(nextFuelForm.currentKm),
      station: nextFuelForm.station,
    };

    setUser((current) => appendFuelLog(current, nextLog));
    setFuelForm(createFuelForm(Number(nextFuelForm.currentKm)));
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

  const useSelectedPinCoordinates = () => {
    if (!selectedPin) {
      return;
    }

    setMapPinForm((current) => ({
      ...current,
      lat: selectedPin.lat ?? current.lat,
      lng: selectedPin.lng ?? current.lng,
    }));
    setMapDraftLocation({
      lat: selectedPin.lat ?? mapPinForm.lat,
      lng: selectedPin.lng ?? mapPinForm.lng,
      source: "selected",
    });
  };

  const pickMapLocation = (coords) => {
    if (!coords) {
      return;
    }

    setMapPinForm((current) => ({
      ...current,
      lat: Number(coords.lat.toFixed(4)),
      lng: Number(coords.lng.toFixed(4)),
    }));
    setMapDraftLocation({
      lat: Number(coords.lat.toFixed(4)),
      lng: Number(coords.lng.toFixed(4)),
      source: "map",
    });
    setMapPinFeedback("Map uzerinden yeni lokasyon secildi.");
    setMapPinErrors((current) => ({
      ...current,
      lat: undefined,
      lng: undefined,
    }));
  };

  const submitMapPin = (event) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    const validationErrors = validateMapPinForm(mapPinForm);
    setMapPinErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const lat = Number(mapPinForm.lat);
    const lng = Number(mapPinForm.lng);
    const fallbackPosition = buildFallbackGridPosition(lat, lng, mapPins);
    const basePin = {
      id: `${mapPinForm.type}-${Date.now()}`,
      type: mapPinForm.type,
      icon: mapPinForm.type === "spot" ? "📸" : mapPinForm.type === "wash" ? "🧼" : "🏍️",
      name: mapPinForm.name.trim(),
      lat,
      lng,
      ...fallbackPosition,
    };

    let newPin;
    if (mapPinForm.type === "spot") {
      newPin = {
        ...basePin,
        likes: 0,
        galleryLikes: 0,
        tags: parseTags(mapPinForm.tags),
        description: mapPinForm.description.trim(),
        gallery: [],
      };
    } else if (mapPinForm.type === "meet") {
      newPin = {
        ...basePin,
        time: mapPinForm.time,
        route: mapPinForm.route.trim(),
        routePath: buildMeetRoutePath(lat, lng),
        attendees: [createAttendeeRecord(user)],
      };
    } else {
      const initialReview = {
        id: `wash-review-${Date.now()}`,
        author: user.plate,
        foam: Number(mapPinForm.foam),
        water: Number(mapPinForm.water),
        allowsBuckets: mapPinForm.allowsBuckets,
        shadowDrying: mapPinForm.shadowDrying,
        note: mapPinForm.note.trim(),
      };

      newPin = {
        ...basePin,
        rating: {
          foam: initialReview.foam,
          water: initialReview.water,
          reviews: 1,
          allowsBuckets: initialReview.allowsBuckets ? 1 : 0,
          shadowDrying: initialReview.shadowDrying ? 1 : 0,
        },
        reviews: [initialReview],
      };
    }

    setMapPins((current) => appendMapPin(current, newPin));
    setSelectedPinId(newPin.id);
    setMapPinForm({
      ...createMapPinForm(newPin),
      type: mapPinForm.type,
      lat: newPin.lat,
      lng: newPin.lng,
    });
    setMapDraftLocation({
      lat: newPin.lat,
      lng: newPin.lng,
      source: "created",
    });
    setMapPinErrors({});
    setMapPinFeedback(`${newPin.name} added to the live map.`);
    void saveFirebaseMapPin(newPin);
  };

  const submitSpotPhoto = (event) => {
    event.preventDefault();
    if (!user || selectedPin.type !== "spot") {
      return;
    }

    const validationErrors = validateSpotPhotoForm(spotPhotoForm);
    setSpotPhotoErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const photo = {
      id: `gallery-${Date.now()}`,
      title: spotPhotoForm.title.trim(),
      likes: 0,
      author: user.plate,
      imageUrl: spotPhotoForm.imageUrl,
      uploadedAt: Date.now(),
    };

    let nextPin = null;
    setMapPins((current) => {
      const nextPins = appendSpotPhoto(current, selectedPin.id, photo);
      nextPin = nextPins.find((pin) => pin.id === selectedPin.id) ?? null;
      return nextPins;
    });
    setSpotPhotoForm(createSpotPhotoForm());
    setSpotPhotoErrors({});
    setSpotPhotoFeedback("Photo dropped into the spot gallery.");
    if (nextPin) {
      void saveFirebaseMapPin(nextPin);
    }
  };

  const loadSpotPhotoFile = async (file) => {
    if (!file) {
      setSpotPhotoForm((current) => ({
        ...current,
        imageUrl: "",
        fileName: "",
      }));
      return;
    }

    try {
      const imageUrl = await readFileAsDataUrl(file);
      setSpotPhotoForm((current) => ({
        ...current,
        imageUrl,
        fileName: file.name,
        title: current.title || file.name.replace(/\.[^.]+$/, ""),
      }));
      setSpotPhotoErrors((current) => ({ ...current, imageUrl: undefined }));
    } catch (error) {
      setSpotPhotoErrors((current) => ({
        ...current,
        imageUrl: error instanceof Error ? error.message : "Photo file could not be read.",
      }));
    }
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
    setMapPinFeedback("");
    setSpotPhotoFeedback("");
  };

  return {
    activeTab,
    clans,
    driveHud,
    drivers,
    firebaseStatus,
    fuelInsights,
    fuelErrors,
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
  };
}
