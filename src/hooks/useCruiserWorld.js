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

  const { driveHud, isDriving, resetDriveSession, toggleDrive: toggleDriveSession } = useDriveSession({
    user,
    setUser,
    setClans,
    setDrivers,
    setMapPins,
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
    activeConversation,
    activeConversationId,
    activeTypingUsers,
    activeTab,
    acceptIncomingClanInvite,
    approveFriendRequest,
    chatFeedback,
    clanFeedback,
    clanForm,
    clans,
    clearDraftRoute,
    convoyFeedback,
    conversationList,
    createNewClan,
    currentClan,
    declineFriendRequest,
    declineIncomingClanInvite,
    declineCruiseJoinRequest,
    driveHud,
    drivers,
    firebaseStatus,
    fuelErrors,
    fuelInsights,
    friendSearchQuery,
    friendSearchResults,
    isDriving,
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
    setActiveTab,
    setAttendeeTripStatus,
    setClanForm,
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
