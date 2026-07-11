import { useMemo, useState } from "react";
import {
  acceptFriendRequest,
  cancelOutgoingFriendRequest,
  normalizeSocialState,
  rejectFriendRequest,
  searchCommunityMembers,
  sendFriendRequest,
} from "../utils/socialGraph";

export function useSocialGraph({ socialDirectory, user, setUser }) {
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [socialFeedback, setSocialFeedback] = useState("");

  const safeUser = useMemo(() => (user ? normalizeSocialState(user) : null), [user]);
  const friendSearchResults = useMemo(
    () => searchCommunityMembers(friendSearchQuery, socialDirectory, safeUser),
    [friendSearchQuery, safeUser, socialDirectory],
  );

  const requestFriend = (profile) => {
    setUser((current) => sendFriendRequest(current, profile));
    setSocialFeedback(`${profile.fullName} icin arkadaslik istegi gonderildi.`);
  };

  const approveFriendRequest = (plate) => {
    const request = safeUser?.incomingRequests?.find((entry) => entry.plate === plate);
    setUser((current) => acceptFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} arkadas listene eklendi.`);
  };

  const declineFriendRequest = (plate) => {
    const request = safeUser?.incomingRequests?.find((entry) => entry.plate === plate);
    setUser((current) => rejectFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} istegi reddedildi.`);
  };

  const withdrawFriendRequest = (plate) => {
    const request = safeUser?.outgoingRequests?.find((entry) => entry.plate === plate);
    setUser((current) => cancelOutgoingFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} icin giden istek geri cekildi.`);
  };

  return {
    approveFriendRequest,
    declineFriendRequest,
    friendSearchQuery,
    friendSearchResults,
    requestFriend,
    safeUser,
    setFriendSearchQuery,
    socialFeedback,
    withdrawFriendRequest,
  };
}
