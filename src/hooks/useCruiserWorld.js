import { startTransition, useEffect, useRef, useState } from "react";
import {
  appendFuelLog,
  getInitialWorldState,
  tickAmbientDrivers,
} from "../repositories/cruiserRepository";
import { useDriveSession } from "./useDriveSession";
import { useFirebaseSync } from "./useFirebaseSync";
import { useMapPins } from "./useMapPins";
import { useSocialGraph } from "./useSocialGraph";
import { useVehiclePassport } from "./useVehiclePassport";
import { socialDirectorySeed } from "../data/mockData";
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
  const { firebaseStatus, syncFuelLog, syncServiceLog, syncTelemetry } = useFirebaseSync({
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
  const {
    passportSummary,
    primeServiceLogForm,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    setServiceLogForm,
    submitServiceLog,
    upcomingMaintenance,
  } = useVehiclePassport({
    user,
    setUser,
    syncServiceLog,
  });
  const {
    approveFriendRequest,
    declineFriendRequest,
    friendSearchQuery,
    friendSearchResults,
    requestFriend,
    safeUser,
    setFriendSearchQuery,
    socialFeedback,
    withdrawFriendRequest,
  } = useSocialGraph({
    socialDirectory: socialDirectorySeed,
    user,
    setUser,
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
    friendSearchQuery,
    friendSearchResults,
    isDriving,
    joinCruise,
    likeGalleryImage,
    likePin,
    loadSpotPhotoFile,
    mapPinErrors,
    mapPinFeedback,
    mapPinForm,
    passportSummary,
    primeServiceLogForm,
    requestFriend,
    mapDraftLocation,
    mapPins,
    mapPickMode,
    pickMapLocation,
    approveFriendRequest,
    declineFriendRequest,
    rateAttendee,
    resetSessionView,
    safeUser,
    selectedPin,
    selectedPinId,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    setActiveTab,
    setFriendSearchQuery,
    setMapPinForm,
    setMapPickMode,
    setServiceLogForm,
    setSelectedPinId,
    setSpotPhotoForm,
    setWashForm,
    clearDraftRoute,
    removeLastDraftRoutePoint,
    socialFeedback,
    spotPhotoErrors,
    spotPhotoFeedback,
    spotPhotoForm,
    submitFuelLog,
    submitServiceLog,
    submitMapPin,
    submitSpotPhoto,
    submitWashReview,
    toggleDrive,
    upcomingMaintenance,
    useSelectedPinCoordinates,
    withdrawFriendRequest,
    washForm,
    washErrors,
    washFeedback,
  };
}
