import { useEffect, useMemo, useRef, useState } from "react";
import {
  blockFirebaseDriver,
  cancelFirebaseFriendshipRequest,
  isFirebaseSocialRepositoryEnabled,
  removeFirebaseFriendship,
  requestFirebaseFriendship,
  respondFirebaseFriendship,
  searchFirebaseDriverByPlate,
  subscribeFirebaseSocialState,
  unblockFirebaseDriver,
  updateFirebasePrivacySettings,
} from "../repositories/cruiserRepository";
import { normalizePlateForSearch, normalizePrivacySettings } from "../utils/privacy";
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
    "functions/already-exists": "Bu sürücüyle zaten aktif bir arkadaşlık akışı var.",
    "functions/failed-precondition": "Bu sosyal işlem mevcut durumda yapilamaz.",
    "functions/not-found": "Sosyal kayıt bulunamadı veya daha önce değişti.",
    "functions/permission-denied": "Bu sürücüyle sosyal etkileşime izin verilmiyor.",
    "functions/unauthenticated": "Bu işlem için tekrar giriş yapmalisin.",
  };
  return messages[error?.code] ?? (error instanceof Error ? error.message : "Sosyal işlem tamamlanamadi.");
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

function getFriendshipStatusByUserId(user, targetUserId) {
  if (!user || !targetUserId) return "none";
  if ((user.firebaseUid ?? user.id) === targetUserId) return "self";
  if ((user.blockedDrivers ?? []).some((entry) => entry.userId === targetUserId)) return "blocked";
  if ((user.friends ?? []).some((entry) => entry.userId === targetUserId)) return "friend";
  if ((user.outgoingRequests ?? []).some((entry) => entry.userId === targetUserId)) return "outgoing";
  if ((user.incomingRequests ?? []).some((entry) => entry.userId === targetUserId)) return "incoming";
  return "none";
}

export function useSocialGraph({ socialDirectory, user, setUser }) {
  const firebaseEnabled = isFirebaseSocialRepositoryEnabled();
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [firebaseSearchResults, setFirebaseSearchResults] = useState([]);
  const [liveDirectory, setLiveDirectory] = useState(socialDirectory ?? []);
  const [socialFeedback, setSocialFeedback] = useState("");
  const [socialPendingKey, setSocialPendingKey] = useState("");
  const socialPendingRef = useRef("");
  const directorySignatureRef = useRef("");
  const socialStateSignatureRef = useRef("");
  const currentUserId = user?.firebaseUid ?? user?.id ?? "";

  const safeUser = useMemo(() => (user ? normalizeSocialState(user) : null), [user]);
  const friendSearchResults = useMemo(
    () => firebaseEnabled
      ? firebaseSearchResults.map((entry) => ({
          ...entry,
          plate: entry.plate,
          friendshipStatus: getFriendshipStatusByUserId(safeUser, entry.userId),
        }))
      : searchCommunityMembers(friendSearchQuery, liveDirectory, safeUser),
    [firebaseEnabled, firebaseSearchResults, friendSearchQuery, liveDirectory, safeUser],
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

  useEffect(() => {
    if (!firebaseEnabled) return undefined;
    const normalizedPlate = normalizePlateForSearch(friendSearchQuery);
    if (normalizedPlate.length < 5) {
      setFirebaseSearchResults([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void searchFirebaseDriverByPlate(normalizedPlate)
        .then((result) => {
          if (!cancelled) setFirebaseSearchResults(result?.driver ? [result.driver] : []);
        })
        .catch((error) => {
          if (!cancelled) {
            setFirebaseSearchResults([]);
            setSocialFeedback(getSocialErrorMessage(error));
          }
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [firebaseEnabled, friendSearchQuery]);

  const runFirebaseAction = async (pendingKey, action, successMessage) => {
    if (socialPendingRef.current) {
      return false;
    }
    socialPendingRef.current = pendingKey;
    setSocialPendingKey(pendingKey);
    setSocialFeedback("İşlem Firebase üzerinde doğrulanıyor...");
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
        setSocialFeedback("Bu sürücünün Firebase Public Profile kaydı bulunamadı.");
        return false;
      }
      return runFirebaseAction(
        `request:${target.userId}`,
        () => requestFirebaseFriendship(target.userId),
        `${target.fullName} için arkadaşlık isteği gönderildi.`,
      );
    }
    setUser((current) => sendFriendRequest(current, target));
    setSocialFeedback(`${target.fullName} için arkadaşlık isteği gönderildi.`);
    return true;
  };

  const approveFriendRequest = (plate) => {
    const request = safeUser?.incomingRequests?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && request) {
      return runFirebaseAction(
        `accept:${request.userId}`,
        () => respondFirebaseFriendship(request.userId, "accepted"),
        `${request.fullName ?? plate} ile artik arkadassiniz.`,
      );
    }
    setUser((current) => acceptFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} ile artik arkadassiniz.`);
    return true;
  };

  const declineFriendRequest = (plate) => {
    const request = safeUser?.incomingRequests?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && request) {
      return runFirebaseAction(
        `decline:${request.userId}`,
        () => respondFirebaseFriendship(request.userId, "declined"),
        `${request.fullName ?? plate} isteği reddedildi.`,
      );
    }
    setUser((current) => rejectFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} isteği reddedildi.`);
    return true;
  };

  const withdrawFriendRequest = (plate) => {
    const request = safeUser?.outgoingRequests?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && request) {
      return runFirebaseAction(
        `cancel:${request.userId}`,
        () => cancelFirebaseFriendshipRequest(request.userId),
        `${request.fullName ?? plate} için giden istek geri çekildi.`,
      );
    }
    setUser((current) => cancelOutgoingFriendRequest(current, plate));
    setSocialFeedback(`${request?.fullName ?? plate} için giden istek geri çekildi.`);
    return true;
  };

  const removeFriendship = (plate) => {
    const friend = safeUser?.friends?.find((entry) => entry.plate === plate);
    if (firebaseEnabled && friend) {
      return runFirebaseAction(
        `remove:${friend.userId}`,
        () => removeFirebaseFriendship(friend.userId),
        `${friend.fullName ?? plate} arkadaş listesinden çıkarıldı.`,
      );
    }
    setUser((current) => removeFriend(current, plate));
    setSocialFeedback(`${friend?.fullName ?? plate} arkadaş listesinden çıkarıldı.`);
    return true;
  };

  const blockDriver = (profile) => {
    const target = resolveSocialTarget(profile);
    if (firebaseEnabled) {
      if (!target?.userId) {
        setSocialFeedback("Bu sürücünün Firebase Public Profile kaydı bulunamadı.");
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
        `${profile.fullName ?? profile.plate} engeli kaldırıldı.`,
      );
    }
    setUser((current) => unblockCommunityMember(current, profile.plate));
    setSocialFeedback(`${profile.fullName ?? profile.plate} engeli kaldırıldı.`);
    return true;
  };

  const savePrivacySettings = (privacy, acceptKvkk = false) => {
    const nextPrivacy = normalizePrivacySettings(privacy);
    if (!firebaseEnabled) {
      setUser((current) => ({
        ...current,
        privacy: nextPrivacy,
        privacyConsent: acceptKvkk ? { kvkkAcceptedAt: Date.now(), version: nextPrivacy.kvkkConsentVersion } : current.privacyConsent,
      }));
      setSocialFeedback("Gizlilik tercihleri güncellendi.");
      return Promise.resolve(true);
    }
    return runFirebaseAction(
      "privacy-settings",
      async () => {
        const result = await updateFirebasePrivacySettings(nextPrivacy, acceptKvkk);
        setUser((current) => ({ ...current, privacy: result.privacy, privacyConsent: result.privacyConsent }));
      },
      "Gizlilik tercihleri güncellendi.",
    );
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
    savePrivacySettings,
    setFriendSearchQuery,
    socialFeedback,
    socialPendingKey,
    unblockDriver,
    withdrawFriendRequest,
  };
}
