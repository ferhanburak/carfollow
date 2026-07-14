import { useEffect, useMemo, useRef, useState } from "react";
import {
  blockFirebaseDriver,
  cancelFirebaseFriendshipRequest,
  isFirebaseSocialRepositoryEnabled,
  removeFirebaseFriendship,
  requestFirebaseFriendship,
  respondFirebaseFriendship,
  subscribeFirebaseSocialState,
  unblockFirebaseDriver,
} from "../repositories/cruiserRepository";
import {
  acceptFriendRequest,
  blockCommunityMember,
  cancelOutgoingFriendRequest,
  normalizeSocialState,
  rejectFriendRequest,
  removeFriend,
  searchCommunityMembers,
  sendFriendRequest,
  unblockCommunityMember,
} from "../utils/socialGraph";

function getSocialErrorMessage(error) {
  const messages = {
    "functions/already-exists": "Bu surucuyle zaten aktif bir arkadaslik akisi var.",
    "functions/failed-precondition": "Bu sosyal islem mevcut durumda yapilamaz.",
    "functions/not-found": "Sosyal kayit bulunamadi veya daha once degisti.",
    "functions/permission-denied": "Bu surucuyle sosyal etkilesime izin verilmiyor.",
    "functions/unauthenticated": "Bu islem icin tekrar giris yapmalisin.",
  };
  return messages[error?.code] ?? (error instanceof Error ? error.message : "Sosyal islem tamamlanamadi.");
}

function socialEntrySignature(entry) {
  return [
    entry?.userId ?? entry?.id ?? "",
    entry?.plate ?? "",
    entry?.fullName ?? "",
    entry?.model ?? "",
    entry?.region ?? "",
    entry?.avatar ?? "",
    entry?.clan ?? "",
    entry?.driverScore ?? "",
    entry?.monthlyKm ?? "",
    entry?.friendshipId ?? "",
    entry?.status ?? "",
    entry?.createdAt ?? "",
    entry?.blockedAt ?? "",
  ].join("|");
}

function socialCollectionsSignature(collections) {
  return [
    ...(collections?.friends ?? []).map((entry) => `friend:${socialEntrySignature(entry)}`),
    ...(collections?.incomingRequests ?? []).map((entry) => `incoming:${socialEntrySignature(entry)}`),
    ...(collections?.outgoingRequests ?? []).map((entry) => `outgoing:${socialEntrySignature(entry)}`),
    ...(collections?.blockedDrivers ?? []).map((entry) => `blocked:${socialEntrySignature(entry)}`),
  ].join("~");
}

export function useSocialGraph({ socialDirectory, user, setUser }) {
  const firebaseEnabled = isFirebaseSocialRepositoryEnabled();
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [liveDirectory, setLiveDirectory] = useState(socialDirectory ?? []);
  const [socialFeedback, setSocialFeedback] = useState("");
  const [socialPendingKey, setSocialPendingKey] = useState("");
  const socialPendingRef = useRef("");
  const directorySignatureRef = useRef("");
  const socialStateSignatureRef = useRef("");
  const currentUserId = user?.firebaseUid ?? user?.id ?? "";

  const safeUser = useMemo(() => (user ? normalizeSocialState(user) : null), [user]);
  const friendSearchResults = useMemo(
    () => searchCommunityMembers(friendSearchQuery, liveDirectory, safeUser),
    [friendSearchQuery, liveDirectory, safeUser],
  );
  const resolveSocialTarget = (profile) =>
    liveDirectory.find((entry) =>
      (profile?.userId && entry.userId === profile.userId) || entry.plate === profile?.plate,
    ) ?? profile;

  useEffect(() => {
    if (!firebaseEnabled || !currentUserId) {
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = () => {};
    directorySignatureRef.current = "";
    socialStateSignatureRef.current = "";
    void subscribeFirebaseSocialState(
      (socialState) => {
        if (cancelled) {
          return;
        }
        const directorySignature = (socialState.directory ?? [])
          .map(socialEntrySignature)
          .join("~");
        if (directorySignatureRef.current !== directorySignature) {
          directorySignatureRef.current = directorySignature;
          setLiveDirectory(socialState.directory);
        }

        const nextSocialSignature = socialCollectionsSignature(socialState);
        if (socialStateSignatureRef.current !== nextSocialSignature) {
          socialStateSignatureRef.current = nextSocialSignature;
          setUser((current) => {
            if (!current || socialCollectionsSignature(current) === nextSocialSignature) {
              return current;
            }
            return {
              ...current,
              blockedDrivers: socialState.blockedDrivers,
              friends: socialState.friends,
              incomingRequests: socialState.incomingRequests,
              outgoingRequests: socialState.outgoingRequests,
            };
          });
        }
      },
      (error) => {
        if (!cancelled) {
          setSocialFeedback(`Social sync: ${getSocialErrorMessage(error)}`);
        }
      },
    ).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe();
      } else {
        unsubscribe = nextUnsubscribe;
      }
    }).catch((error) => {
      if (!cancelled) {
        setSocialFeedback(`Social sync: ${getSocialErrorMessage(error)}`);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUserId, firebaseEnabled, setUser]);

  const runFirebaseAction = async (pendingKey, action, successMessage) => {
    if (socialPendingRef.current) {
      return false;
    }
    socialPendingRef.current = pendingKey;
    setSocialPendingKey(pendingKey);
    setSocialFeedback("Islem Firebase uzerinde dogrulaniyor...");
    try {
      await action();
      setSocialFeedback(successMessage);
      return true;
    } catch (error) {
      setSocialFeedback(getSocialErrorMessage(error));
      return false;
    } finally {
      socialPendingRef.current = "";
      setSocialPendingKey("");
    }
  };

  const requestFriend = (profile) => {
    const target = resolveSocialTarget(profile);
    if (firebaseEnabled) {
      if (!target?.userId) {
        setSocialFeedback("Bu surucunun Firebase Public Profile kaydi bulunamadi.");
        return false;
      }
      return runFirebaseAction(
        `request:${target.userId}`,
        () => requestFirebaseFriendship(target.userId),
        `${target.fullName} icin arkadaslik istegi gonderildi.`,
      );
    }
    setUser((current) => sendFriendRequest(current, target));
    setSocialFeedback(`${target.fullName} icin arkadaslik istegi gonderildi.`);
    return true;
  };

  const approveFriendRequest = (plate) => {
    const request = safeUser?.incomingRequests?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && request) {
      return runFirebaseAction(
        `accept:${request.userId}`,
        () => respondFirebaseFriendship(request.userId, "accepted"),
        `${request.fullName ?? plate} arkadas listene eklendi.`,
      );
    }
    setUser((current) => acceptFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} arkadas listene eklendi.`);
    return true;
  };

  const declineFriendRequest = (plate) => {
    const request = safeUser?.incomingRequests?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && request) {
      return runFirebaseAction(
        `decline:${request.userId}`,
        () => respondFirebaseFriendship(request.userId, "declined"),
        `${request.fullName ?? plate} istegi reddedildi.`,
      );
    }
    setUser((current) => rejectFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} istegi reddedildi.`);
    return true;
  };

  const withdrawFriendRequest = (plate) => {
    const request = safeUser?.outgoingRequests?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && request) {
      return runFirebaseAction(
        `cancel:${request.userId}`,
        () => cancelFirebaseFriendshipRequest(request.userId),
        `${request.fullName ?? plate} icin giden istek geri cekildi.`,
      );
    }
    setUser((current) => cancelOutgoingFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} icin giden istek geri cekildi.`);
    return true;
  };

  const removeFriendship = (plate) => {
    const friend = safeUser?.friends?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && friend) {
      return runFirebaseAction(
        `remove:${friend.userId}`,
        () => removeFirebaseFriendship(friend.userId),
        `${friend.fullName ?? plate} arkadas listesinden cikarildi.`,
      );
    }
    setUser((current) => removeFriend(current, plate));
    setSocialFeedback(`${friend?.fullName ?? plate} arkadas listesinden cikarildi.`);
    return true;
  };

  const blockDriver = (profile) => {
    const target = resolveSocialTarget(profile);
    if (firebaseEnabled) {
      if (!target?.userId) {
        setSocialFeedback("Bu surucunun Firebase Public Profile kaydi bulunamadi.");
        return false;
      }
      return runFirebaseAction(
        `block:${target.userId}`,
        () => blockFirebaseDriver(target.userId),
        `${target.fullName ?? target.plate} engellendi.`,
      );
    }
    setUser((current) => blockCommunityMember(current, target));
    setSocialFeedback(`${target.fullName ?? target.plate} engellendi.`);
    return true;
  };

  const unblockDriver = (profile) => {
    if (firebaseEnabled) {
      return runFirebaseAction(
        `unblock:${profile.userId}`,
        () => unblockFirebaseDriver(profile.userId),
        `${profile.fullName ?? profile.plate} engeli kaldirildi.`,
      );
    }
    setUser((current) => unblockCommunityMember(current, profile.plate));
    setSocialFeedback(`${profile.fullName ?? profile.plate} engeli kaldirildi.`);
    return true;
  };

  return {
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
    unblockDriver,
    withdrawFriendRequest,
  };
}
