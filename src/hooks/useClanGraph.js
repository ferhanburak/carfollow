import { useMemo, useState } from "react";
import {
  acceptClanInvite,
  cancelClanInvite,
  createClan,
  declineClanInvite,
  normalizeClanState,
  sendClanInvite,
} from "../utils/clanGraph";

const initialClanForm = {
  name: "",
  tag: "",
  description: "",
};

export function useClanGraph({ clans, setClans, user, setUser }) {
  const [clanForm, setClanForm] = useState(initialClanForm);
  const [clanFeedback, setClanFeedback] = useState("");

  const safeUser = useMemo(() => (user ? normalizeClanState(user) : null), [user]);
  const currentClan = useMemo(
    () => clans.find((entry) => entry.name === safeUser?.clan) ?? null,
    [clans, safeUser?.clan],
  );

  const createNewClan = () => {
    const result = createClan(safeUser, clans, clanForm);
    setUser(result.nextUser);
    setClans(result.nextClans);
    setClanFeedback(result.feedback);

    if (result.nextUser?.clan === clanForm.name.trim().replace(/\s+/g, " ")) {
      setClanForm(initialClanForm);
    }
  };

  const inviteFriendToClan = (friend) => {
    const result = sendClanInvite(safeUser, friend, clans);
    setUser(result.nextUser);
    setClanFeedback(result.feedback);
  };

  const revokeClanInvite = (inviteId) => {
    const result = cancelClanInvite(safeUser, inviteId);
    setUser(result.nextUser);
    setClanFeedback(result.feedback);
  };

  const acceptIncomingClanInvite = (inviteId) => {
    const result = acceptClanInvite(safeUser, clans, inviteId);
    setUser(result.nextUser);
    setClans(result.nextClans);
    setClanFeedback(result.feedback);
  };

  const declineIncomingClanInvite = (inviteId) => {
    const result = declineClanInvite(safeUser, inviteId);
    setUser(result.nextUser);
    setClanFeedback(result.feedback);
  };

  return {
    acceptIncomingClanInvite,
    clanFeedback,
    clanForm,
    createNewClan,
    currentClan,
    declineIncomingClanInvite,
    inviteFriendToClan,
    revokeClanInvite,
    safeUser,
    setClanForm,
  };
}
