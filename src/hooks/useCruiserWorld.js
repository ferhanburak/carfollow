import { useState } from "react";
import { socialDirectorySeed } from "../data/mockData";
import {
  appendFuelLog,
  getInitialWorldState,
  isFirebaseRepositoryEnabled,
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
import { useConvoyTracking } from "./useConvoyTracking";
import { useMapPins } from "./useMapPins";
import { useModeration } from "./useModeration";
import { useNotifications } from "./useNotifications";
import { useProfileEditor } from "./useProfileEditor";
import { useSocialGraph } from "./useSocialGraph";
import { useVehiclePassport } from "./useVehiclePassport";

export function useCruiserWorld(user, setUser, setFuelForm) {
  const [initialWorld] = useState(() => {
    const world = getInitialWorldState();
    // Firebase mode has one shared world; demo fixtures must never leak into it.
    return isFirebaseRepositoryEnabled()
      ? { ...world, mapPins: [], clans: [], drivers: [] }
      : world;
  });
  const [activeTab, setActiveTab] = useState("map");
  const [fuelErrors, setFuelErrors] = useState({});
  const [fuelFeedback, setFuelFeedback] = useState("");
  const [fuelPending, setFuelPending] = useState(false);
  const [clans, setClans] = useState(initialWorld.clans);
  const [drivers, setDrivers] = useState([]);

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
    deleteSpotPhoto,
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
    refreshFirebaseConvoys,
    reportSpotPhoto,
    removeConvoyMember,
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

  const convoyTracking = useConvoyTracking({
    mapPins,
    user,
    onRefreshConvoys: refreshFirebaseConvoys,
  });

  const { firebaseStatus, syncFuelLog, syncServiceLog, syncTelemetry } = useFirebaseSync({
    user,
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
    onTelemetrySync: syncTelemetry,
    onSessionStart: startDriveSession,
    onSessionFinish: finishDriveSession,
    serverOwnedDriverStats,
  });

  const {
    createPassportExport,
    passportSummary,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    primeServiceLogForm,
    serviceLogErrors,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setServiceLogForm,
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
    clanPendingKey,
    createNewClan,
    currentClan,
    currentClanMembers,
    declineIncomingClanInvite,
    inviteFriendToClan,
    leaveCurrentClan,
    removeClanMember,
    revokeClanInvite,
    safeUser: safeClanUser,
    setClanForm,
    transferClanOwnership,
    updateClanMemberRole,
  } = useClanGraph({
    clans,
    setClans,
    user,
    setUser,
  });

  const {
    approveFriendRequest,
    blockDriver,
    declineFriendRequest,
    friendSearchQuery,
    friendSearchResults,
    requestFriend,
    removeFriendship,
    safeUser,
    setFriendSearchQuery,
    socialFeedback,
    socialPendingKey,
    savePrivacySettings,
    unblockDriver,
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

  const {
    markAllNotificationsRead,
    markNotificationRead,
    notificationFeedback,
    notifications,
    unreadNotificationCount,
  } = useNotifications(resolvedSafeUser);
  const { moderationFeedback, moderationPending, reportDriver } = useModeration(resolvedSafeUser);

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
    blockDriver,
    chatFeedback,
    clanFeedback,
    clanForm,
    clanPendingKey,
    clans,
    clearDraftRoute,
    convoyFeedback,
    convoyTracking,
    conversationList,
    createPassportExport,
    createNewClan,
    currentClan,
    currentClanMembers,
    declineFriendRequest,
    declineIncomingClanInvite,
    declineCruiseJoinRequest,
    deleteSpotPhoto,
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
    markAllNotificationsRead,
    markNotificationRead,
    moderationFeedback,
    moderationPending,
    notificationFeedback,
    notifications,
    openConversation,
    passportSummary,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    pickMapLocation,
    profileCompletion,
    profileErrors,
    profileFeedback,
    profileForm,
    presenceMap,
    primeServiceLogForm,
    approveCruiseJoinRequest,
    rateAttendee,
    reportSpotPhoto,
    removeConvoyMember,
    removeLastDraftRoutePoint,
    requestFriend,
    reportDriver,
    removeFriendship,
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
    transferClanOwnership,
    updateClanMemberRole,
    setConvoyLifecycleStatus,
    setFriendSearchQuery,
    setMapPickMode,
    setMapPinForm,
    setMessageDraft,
    setProfileForm,
    setSelectedPinId,
    setServiceLogForm,
    setSpotPhotoForm,
    setWashForm,
    socialFeedback,
    socialPendingKey,
    savePrivacySettings,
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
    unreadNotificationCount,
    upcomingMaintenance,
    useSelectedPinCoordinates,
    washErrors,
    washFeedback,
    washForm,
    hostableConvoys,
    inviteFriendToClan,
    leaveCurrentClan,
    removeClanMember,
    inviteDriverToMeet,
    unblockDriver,
    withdrawFriendRequest,
  };
}
