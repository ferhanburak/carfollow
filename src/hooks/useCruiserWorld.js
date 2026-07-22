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
import { useLiveLocation } from "./useLiveLocation";
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
  const liveLocation = useLiveLocation({
    enabled: Boolean(user) && ["map", "liveMap", "drive"].includes(activeTab),
  });

  const {
    profileCompletion,
    profileErrors,
    profileFeedback,
    profileForm,
    profilePending,
    loadProfileAvatarFile,
    setProfileForm,
    submitProfile,
  } = useProfileEditor({
    user,
    setUser,
  });

  const {
    approveCruiseJoinRequest,
    clanEventFeedback,
    clanEventPendingId,
    clearDraftRoute,
    convoyFeedback,
    declineCruiseJoinRequest,
    deleteClanEvent,
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
    setConvoyMemberRole,
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
    updateConvoyDetails,
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
    liveLocation,
  });

  const {
    createPassportExport,
    deleteServiceLog,
    passportSummary,
    passportExportFeedback,
    passportExportPending,
    passportExports,
    primeServiceLogForm,
    serviceLogErrors,
    serviceLogDeletePendingId,
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
  const hostableConvoys = mapPins.filter((pin) => {
    if (pin.type !== "meet" || (pin.lifecycleStatus ?? "planning") !== "planning") return false;

    const selfMembership = (pin.attendees ?? []).find((attendee) =>
      attendee.userId === resolvedSafeUser?.firebaseUid || attendee.plate === resolvedSafeUser?.plate
    );
    return pin.createdByPlate === resolvedSafeUser?.plate ||
      pin.viewerManagementRole === "manager" ||
      selfMembership?.managementRole === "manager";
  });

  const {
    activeConversation,
    activeConversationId,
    activeTypingUsers,
    chatFeedback,
    conversationList,
    markConversationAsRead,
    messageDraft,
    openConversation,
    presenceMap,
    sendMessage,
    setMessageDraft,
    unreadConversationCount,
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
        setFuelFeedback("Yakit kaydi su anda tamamlanamadi. Lutfen tekrar dene.");
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
    clanEventFeedback,
    clanEventPendingId,
    clanFeedback,
    clanForm,
    clanPendingKey,
    clans,
    clearDraftRoute,
    convoyFeedback,
    convoyTracking,
    conversationList,
    createPassportExport,
    deleteServiceLog,
    createNewClan,
    currentClan,
    currentClanMembers,
    declineFriendRequest,
    declineIncomingClanInvite,
    declineCruiseJoinRequest,
    deleteClanEvent,
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
    liveLocation,
    mapDraftLocation,
    mapPickMode,
    mapPinErrors,
    mapPinFeedback,
    mapPinForm,
    mapPins,
    markConversationAsRead,
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
    profilePending,
    loadProfileAvatarFile,
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
    serviceLogDeletePendingId,
    serviceLogFeedback,
    serviceLogForm,
    serviceLogPending,
    setActiveTab,
    setAttendeeTripStatus,
    setConvoyMemberRole,
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
    updateConvoyDetails,
    toggleDrive,
    unreadConversationCount,
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
