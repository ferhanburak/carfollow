import { useEffect, useMemo, useRef, useState } from "react";
import {
  cancelFirebaseClanInvite,
  createFirebaseClan,
  inviteFirebaseClanMember,
  isFirebaseClanRepositoryEnabled,
  leaveFirebaseClan,
  removeFirebaseClanMember,
  respondFirebaseClanInvite,
  subscribeFirebaseClanState,
  transferFirebaseClanOwnership,
  updateFirebaseClanMemberRole,
} from "../repositories/cruiserRepository";
import {
  acceptClanInvite,
  cancelClanInvite,
  createClan,
  declineClanInvite,
  normalizeClanState,
  sendClanInvite,
} from "../utils/clanGraph";

const initialClanForm = { name: "", tag: "", description: "" };

function getClanErrorMessage(error) {
  const messages = {
    "functions/already-exists": "Bu klan adi, tag veya davet zaten kullaniliyor.",
    "functions/failed-precondition": "Bu klan islemi mevcut durumda yapilamaz.",
    "functions/not-found": "Klan veya davet kaydi bulunamadi.",
    "functions/permission-denied": "Bu klan islemi icin gerekli yetkin yok.",
    "functions/unauthenticated": "Bu islem icin tekrar giris yapmalisin.",
  };
  return messages[error?.code] ?? (error instanceof Error ? error.message : "Klan islemi tamamlanamadi.");
}

function inviteSignature(invites = []) {
  return invites.map((invite) => `${invite.id}|${invite.clanId}|${invite.targetUserId}|${invite.createdAt ?? ""}`).join("~");
}

export function useClanGraph({ clans, setClans, user, setUser }) {
  const firebaseEnabled = isFirebaseClanRepositoryEnabled();
  const [clanForm, setClanForm] = useState(initialClanForm);
  const [clanFeedback, setClanFeedback] = useState("");
  const [clanPendingKey, setClanPendingKey] = useState("");
  const [firebaseClanState, setFirebaseClanState] = useState(null);
  const pendingRef = useRef("");
  const currentUserId = user?.firebaseUid ?? user?.id ?? "";
  const safeUser = useMemo(() => (user ? normalizeClanState(user) : null), [user]);
  const currentClan = firebaseEnabled
    ? firebaseClanState?.currentClan ?? null
    : clans.find((entry) => entry.name === safeUser?.clan) ?? null;
  const currentClanMembers = firebaseEnabled ? firebaseClanState?.currentClanMembers ?? [] : [];

  useEffect(() => {
    if (!firebaseEnabled || !currentUserId) {
      setFirebaseClanState(null);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = () => {};
    void subscribeFirebaseClanState(
      (state) => {
        if (cancelled) {
          return;
        }
        setFirebaseClanState(state);
        setClans((current) => {
          const nextSignature = state.clans
            .map((clan) => `${clan.id}|${clan.monthlyKmPeriod}|${clan.monthlyKm}|${clan.memberCount}`)
            .join("~");
          const currentSignature = current
            .map((clan) => `${clan.id}|${clan.monthlyKmPeriod ?? ""}|${clan.monthlyKm ?? clan.km}|${clan.memberCount ?? clan.members}`)
            .join("~");
          return nextSignature === currentSignature ? current : state.clans;
        });
        setUser((current) => {
          if (!current) {
            return current;
          }
          const membership = state.membership;
          const nextClan = state.currentClan?.name ?? null;
          const nextRole = membership?.role ?? null;
          if (
            current.clanId === (membership?.clanId ?? null) &&
            current.clan === nextClan &&
            current.clanRole === nextRole &&
            inviteSignature(current.clanInvites) === inviteSignature(state.clanInvites) &&
            inviteSignature(current.sentClanInvites) === inviteSignature(state.sentClanInvites)
          ) {
            return current;
          }
          return {
            ...current,
            clan: nextClan,
            clanId: membership?.clanId ?? null,
            clanRole: nextRole,
            clanInvites: state.clanInvites,
            sentClanInvites: state.sentClanInvites,
          };
        });
      },
      (error) => !cancelled && setClanFeedback(`Klan senkronizasyonu: ${getClanErrorMessage(error)}`),
    ).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe();
      } else {
        unsubscribe = nextUnsubscribe;
      }
    }).catch((error) => !cancelled && setClanFeedback(`Klan senkronizasyonu: ${getClanErrorMessage(error)}`));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUserId, firebaseEnabled, setClans, setUser]);

  const runFirebaseAction = async (pendingKey, action, successMessage) => {
    if (pendingRef.current) {
      return false;
    }
    pendingRef.current = pendingKey;
    setClanPendingKey(pendingKey);
    setClanFeedback("Klan islemi Firebase uzerinde dogrulaniyor...");
    try {
      await action();
      setClanFeedback(successMessage);
      return true;
    } catch (error) {
      setClanFeedback(getClanErrorMessage(error));
      return false;
    } finally {
      pendingRef.current = "";
      setClanPendingKey("");
    }
  };

  const createNewClan = () => {
    if (firebaseEnabled) {
      return runFirebaseAction("create", () => createFirebaseClan(clanForm), "Klan kuruldu. Artik klan sahibisin.").then((completed) => {
        if (completed) {
          setClanForm(initialClanForm);
        }
        return completed;
      });
    }
    const result = createClan(safeUser, clans, clanForm);
    setUser(result.nextUser);
    setClans(result.nextClans);
    setClanFeedback(result.feedback);
    if (result.nextUser?.clan === clanForm.name.trim().replace(/\s+/g, " ")) {
      setClanForm(initialClanForm);
    }
    return true;
  };

  const inviteFriendToClan = (friend) => {
    if (firebaseEnabled) {
      if (!currentClan?.id || !friend?.userId) {
        setClanFeedback("Davet icin aktif bir klan ve Firebase profili gerekli.");
        return false;
      }
      return runFirebaseAction(
        `invite:${friend.userId}`,
        () => inviteFirebaseClanMember(currentClan.id, friend.userId),
        `${friend.fullName ?? friend.plate} icin klan daveti gonderildi.`,
      );
    }
    const result = sendClanInvite(safeUser, friend, clans);
    setUser(result.nextUser);
    setClanFeedback(result.feedback);
    return true;
  };

  const revokeClanInvite = (inviteId) => {
    const invite = safeUser?.sentClanInvites?.find((entry) => entry.id === inviteId);
    if (firebaseEnabled && invite) {
      return runFirebaseAction(
        `cancel:${inviteId}`,
        () => cancelFirebaseClanInvite(invite.clanId, invite.targetUserId),
        "Klan daveti iptal edildi.",
      );
    }
    const result = cancelClanInvite(safeUser, inviteId);
    setUser(result.nextUser);
    setClanFeedback(result.feedback);
    return true;
  };

  const respondIncomingClanInvite = (inviteId, decision) => {
    const invite = safeUser?.clanInvites?.find((entry) => entry.id === inviteId);
    if (firebaseEnabled && invite) {
      return runFirebaseAction(
        `${decision}:${inviteId}`,
        () => respondFirebaseClanInvite(invite.clanId, decision),
        decision === "accepted" ? `${invite.clanName} daveti kabul edildi.` : "Klan daveti reddedildi.",
      );
    }
    const result = decision === "accepted"
      ? acceptClanInvite(safeUser, clans, inviteId)
      : declineClanInvite(safeUser, inviteId);
    setUser(result.nextUser);
    if (result.nextClans) {
      setClans(result.nextClans);
    }
    setClanFeedback(result.feedback);
    return true;
  };

  const leaveCurrentClan = () => {
    if (!firebaseEnabled || !currentClan?.id) {
      setClanFeedback("Bu islem Firebase klanlari icin kullanilabilir.");
      return false;
    }
    return runFirebaseAction("leave", () => leaveFirebaseClan(currentClan.id), "Klandan ayrildin.");
  };

  const updateClanMemberRole = (member, role) => runFirebaseAction(
    `role:${member.userId}`,
    () => updateFirebaseClanMemberRole(currentClan.id, member.userId, role),
    `${member.fullName} icin rol guncellendi.`,
  );
  const removeClanMember = (member) => runFirebaseAction(
    `remove:${member.userId}`,
    () => removeFirebaseClanMember(currentClan.id, member.userId),
    `${member.fullName} klandan cikarildi.`,
  );
  const transferClanOwnership = (member) => runFirebaseAction(
    `transfer:${member.userId}`,
    () => transferFirebaseClanOwnership(currentClan.id, member.userId),
    `Klan sahipligi ${member.fullName} kullanicisina devredildi.`,
  );

  return {
    acceptIncomingClanInvite: (inviteId) => respondIncomingClanInvite(inviteId, "accepted"),
    clanFeedback,
    clanForm,
    clanPendingKey,
    createNewClan,
    currentClan,
    currentClanMembers,
    declineIncomingClanInvite: (inviteId) => respondIncomingClanInvite(inviteId, "declined"),
    inviteFriendToClan,
    leaveCurrentClan,
    removeClanMember,
    revokeClanInvite,
    safeUser,
    setClanForm,
    transferClanOwnership,
    updateClanMemberRole,
  };
}
