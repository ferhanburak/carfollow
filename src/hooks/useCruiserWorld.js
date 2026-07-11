import { startTransition, useEffect, useRef, useState } from "react";
import {
  appendFuelLog,
  getInitialWorldState,
  tickAmbientDrivers,
} from "../repositories/cruiserRepository";
import { useDriveSession } from "./useDriveSession";
import { useFirebaseSync } from "./useFirebaseSync";
import { useMapPins } from "./useMapPins";
import {
  createFuelForm,
  computeFuelInsights,
} from "../utils/garage";
import { validateFuelForm } from "../utils/validation";

export function useCruiserWorld(user, setUser, setFuelForm) {
  const initialWorld = getInitialWorldState();
  const [activeTab, setActiveTab] = useState("map");
  const [fuelErrors, setFuelErrors] = useState({});
  const [clans, setClans] = useState(initialWorld.clans);
  const [drivers, setDrivers] = useState(initialWorld.drivers);
  const tickerRef = useRef(0);
  const {
    clearDraftRoute,
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
    pickMapLocation,
    rateAttendee,
    removeLastDraftRoutePoint,
    resetMapInteractions,
    selectedPin,
    selectedPinId,
    setMapPickMode,
    setMapPinForm,
    setMapPins,
    setSelectedPinId,
    setSpotPhotoForm,
    setWashForm,
    spotPhotoErrors,
    spotPhotoFeedback,
    spotPhotoForm,
    submitMapPin,
    submitSpotPhoto,
    submitWashReview,
    useSelectedPinCoordinates,
    washForm,
    washErrors,
    washFeedback,
  } = useMapPins({
    initialWorld,
    user,
  });
  const { firebaseStatus, syncFuelLog, syncTelemetry } = useFirebaseSync({
    initialWorld,
    user,
    setMapPins,
    setSelectedPinId,
    setClans,
    setDrivers,
  });
  const { driveHud, isDriving, resetDriveSession, toggleDrive: toggleDriveSession } = useDriveSession({
    user,
    setUser,
    setClans,
    setDrivers,
    onTelemetrySync: syncTelemetry,
  });

  useEffect(() => {
    const shuffleTimer = window.setInterval(() => {
      startTransition(() => {
        setDrivers((current) => tickAmbientDrivers(current, tickerRef.current));
        tickerRef.current += 1;
      });
    }, 2200);

    return () => window.clearInterval(shuffleTimer);
  }, []);

  const fuelInsights = user ? computeFuelInsights(user.fuelLogs) : { average: 0, costPerFill: 0, totalSpend: 0 };

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
    syncFuelLog(nextLog);
  };

  const toggleDrive = () => {
    toggleDriveSession();
    setActiveTab("drive");
  };

  const resetSessionView = () => {
    setActiveTab("map");
    resetDriveSession();
    resetMapInteractions();
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
    mapPickMode,
    pickMapLocation,
    rateAttendee,
    resetSessionView,
    selectedPin,
    selectedPinId,
    setActiveTab,
    setMapPinForm,
    setMapPickMode,
    setSelectedPinId,
    setSpotPhotoForm,
    setWashForm,
    clearDraftRoute,
    removeLastDraftRoutePoint,
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
