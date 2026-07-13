import { startTransition, useEffect, useRef, useState } from "react";
import { socialDirectorySeed } from "../data/mockData";
import {
  appendFuelLog,
  getInitialWorldState,
  tickAmbientDrivers,
} from "../repositories/cruiserRepository";
import {
  computeFuelInsights,
  createFuelForm,
} from "../utils/garage";
import { validateFuelForm } from "../utils/validation";
import { useDirectMessages } from "./useDirectMessages";
import { useDriveSession } from "./useDriveSession";
import { useDriverStats } from "./useDriverStats";
import { useFirebaseSync } from "./useFirebaseSync";
import { useClanGraph } from "./useClanGraph";
import { useMapPins } from "./useMapPins";
import { useProfileEditor } from "./useProfileEditor";
import { useSocialGraph } from "./useSocialGraph";
import { useVehiclePassport } from "./useVehiclePassport";

export function useCruiserWorld(user, setUser, setFuelForm) {
  const [initialWorld] = useState(getInitialWorldState);
  const [activeTab, setActiveTab] = useState("map");
  const [fuelErrors, setFuelErrors] = useState({});
  const [fuelFeedback, setFuelFeedback] = useState("");
  const [fuelPending, setFuelPending] = useState(false);
  const [clans, setClans] = useState(initialWorld.clans);
  const [drivers, setDrivers] = useState(initialWorld.drivers);
  const tickerRef = useRef(0);

  const {
    profileCompletion,
    profileErrors,
    profileFeedback,
    profileForm,
    setProfileForm,
    submitProfile,
  } = useProfileEditor({
    user,
    setUser,
  });

  const {
    approveCruiseJoinRequest,
    clearDraftRoute,
    convoyFeedback,
    declineCruiseJoinRequest,
    inviteDriverToMeet,
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
    setAttendeeTripStatus,
    setConvoyLifecycleStatus,
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

  const {
    driverStatsStatus,
    finishDriveSession,
    individualLeaderboard,
    serverOwnedDriverStats,
    startDriveSession,
  } = useDriverStats({ user, setUser });

  const {
    driveHud,
    driveSessionFeedback,
    driveSessionId,
    driveSessionPending,
    driveSessionStatus,
    isDriving,
    resetDriveSession,
    toggleDrive: toggleDriveSession,
  } = useDriveSession({
    user,
    setUser,
    setClans,
    setDrivers,
    setMapPins,
    onTelemetrySync: syncTelemetry,
    onSessionStart: startDriveSession,
    onSessionFinish: finishDriveSession,
    serverOwnedDriverStats,
  });

  const {
    cancelPassportTransfer,
    createPassportExport,
    passportSummary,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    passportTransferAuditEvents,
    passportTransferFeedback,
    passportTransferPending,
    passportTransferTargetPlate,
    passportTransfers,
    primeServiceLogForm,
    requestPassportTransfer,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setServiceLogForm,
    setPassportTransferTargetPlate,
    submitServiceLog,
    upcomingMaintenance,
  } = useVehiclePassport({
    user,
    setUser,
    syncServiceLog,
  });

  const {
    acceptIncomingClanInvite,
    clanFeedback,
    clanForm,
    createNewClan,
    currentClan,
    declineIncomingClanInvite,
    inviteFriendToClan,
    revokeClanInvite,
    safeUser: safeClanUser,
    setClanForm,
  } = useClanGraph({
    clans,
    setClans,
    user,
    setUser,
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

  const resolvedSafeUser = safeClanUser ?? safeUser ?? user;
  const hostableConvoys = mapPins.filter((pin) => pin.type === "meet" && pin.createdByPlate === resolvedSafeUser?.plate);

  const {
    activeConversation,
    activeConversationId,
    activeTypingUsers,
    chatFeedback,
    conversationList,
    messageDraft,
    openConversation,
    presenceMap,
    sendMessage,
    setMessageDraft,
    totalUnreadCount,
  } = useDirectMessages({
    user: resolvedSafeUser,
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

  const submitFuelLog = async (event, nextFuelForm) => {
    event.preventDefault();
    if (!user || fuelPending) {
      return null;
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
      station: nextFuelForm.station.trim(),
      vehicleId: user.primaryVehicleId,
    };

    setFuelPending(true);
    setFuelFeedback("Yakit kaydi Vehicle Passport'a isleniyor...");
    try {
      const syncResult = await syncFuelLog(nextLog);
      if (syncResult?.ok === false) {
        setFuelFeedback(`Kayit tamamlanamadi: ${syncResult.error}`);
        return null;
      }

      setUser((current) => {
        if (!current || current.fuelLogs?.some((log) => log.id === nextLog.id)) {
          return current;
        }
        return appendFuelLog(current, nextLog);
      });
      setFuelForm(createFuelForm(Number(nextFuelForm.currentKm)));
      setFuelErrors({});
      setFuelFeedback("Yakit kaydi guvenli olarak kaydedildi.");
      return nextLog;
    } finally {
      setFuelPending(false);
    }
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
    activeConversation,
    activeConversationId,
    activeTypingUsers,
    activeTab,
    acceptIncomingClanInvite,
    approveFriendRequest,
    chatFeedback,
    cancelPassportTransfer,
    clanFeedback,
    clanForm,
    clans,
    clearDraftRoute,
    convoyFeedback,
    conversationList,
    createPassportExport,
    createNewClan,
    currentClan,
    declineFriendRequest,
    declineIncomingClanInvite,
    declineCruiseJoinRequest,
    driveHud,
    driveSessionFeedback,
    driveSessionId,
    driveSessionPending,
    driveSessionStatus,
    drivers,
    driverStatsStatus,
    firebaseStatus,
    fuelErrors,
    fuelFeedback,
    fuelInsights,
    fuelPending,
    friendSearchQuery,
    friendSearchResults,
    isDriving,
    individualLeaderboard,
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
    messageDraft,
    openConversation,
    passportSummary,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    passportTransferAuditEvents,
    passportTransferFeedback,
    passportTransferPending,
    passportTransferTargetPlate,
    passportTransfers,
    pickMapLocation,
    profileCompletion,
    profileErrors,
    profileFeedback,
    profileForm,
    presenceMap,
    primeServiceLogForm,
    approveCruiseJoinRequest,
    rateAttendee,
    removeLastDraftRoutePoint,
    requestPassportTransfer,
    requestFriend,
    resetSessionView,
    revokeClanInvite,
    safeUser: resolvedSafeUser,
    selectedPin,
    selectedPinId,
    sendMessage,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setActiveTab,
    setAttendeeTripStatus,
    setClanForm,
    setConvoyLifecycleStatus,
    setFriendSearchQuery,
    setMapPickMode,
    setMapPinForm,
    setMessageDraft,
    setProfileForm,
    setPassportTransferTargetPlate,
    setSelectedPinId,
    setServiceLogForm,
    setSpotPhotoForm,
    setWashForm,
    socialFeedback,
    spotPhotoErrors,
    spotPhotoFeedback,
    spotPhotoForm,
    submitFuelLog,
    submitMapPin,
    submitProfile,
    submitServiceLog,
    submitSpotPhoto,
    submitWashReview,
    toggleDrive,
    totalUnreadCount,
    upcomingMaintenance,
    useSelectedPinCoordinates,
    washErrors,
    washFeedback,
    washForm,
    hostableConvoys,
    inviteFriendToClan,
    inviteDriverToMeet,
    withdrawFriendRequest,
  };
}
