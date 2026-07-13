const MEET_VISIBILITY = ["public", "friends", "clan"];
const MEET_ACCESS_POLICIES = ["open", "request", "trusted"];
const MEET_DETAIL_VISIBILITY = ["public", "trusted"];

export function getMeetVisibilityOptions() {
  return MEET_VISIBILITY;
}

export function getMeetAccessPolicyOptions() {
  return MEET_ACCESS_POLICIES;
}

export function getMeetDetailVisibilityOptions() {
  return MEET_DETAIL_VISIBILITY;
}

export function getMeetVisibilityLabel(value) {
  if (value === "friends") {
    return "Friends Only";
  }

  if (value === "clan") {
    return "Clan Only";
  }

  return "Public";
}

export function getMeetAccessPolicyLabel(value) {
  if (value === "request") {
    return "Request";
  }

  if (value === "trusted") {
    return "Trusted";
  }

  return "Open";
}

export function getMeetDetailVisibilityLabel(value) {
  if (value === "trusted") {
    return "Trusted Only";
  }

  return "Public";
}

export function isMeetVisibleToUser(pin, user) {
  if (!pin || pin.type !== "meet") {
    return true;
  }

  const visibility = pin.visibility ?? "public";
  if (visibility === "public") {
    return true;
  }

  if (!user) {
    return false;
  }

  if (pin.createdByPlate === user.plate) {
    return true;
  }

  if (visibility === "friends") {
    return (user.friends ?? []).some((friend) => friend.plate === pin.createdByPlate);
  }

  if (visibility === "clan") {
    return Boolean(user.clan) && Boolean(pin.createdByClan) && user.clan === pin.createdByClan;
  }

  return true;
}

function hasBaseVisibilityAccess(pin, user) {
  return isMeetVisibleToUser(pin, user);
}

function isTrustedForConvoy(pin, user) {
  const score = Number(user?.driverScore ?? 0);
  const harmonyVotes = Number(user?.harmonyVotes ?? 0);
  const alertVotes = Number(user?.alertVotes ?? 0);
  const minDriverScore = Number(pin?.minDriverScore ?? 0);
  const minHarmonyVotes = Number(pin?.minHarmonyVotes ?? 0);
  const maxAlertVotes = Number(pin?.maxAlertVotes ?? 999);

  return score >= minDriverScore && harmonyVotes >= minHarmonyVotes && alertVotes <= maxAlertVotes;
}

export function getConvoyAccessState(pin, user) {
  if (!pin || pin.type !== "meet") {
    return {
      canViewCard: true,
      canViewDetails: true,
      canJoin: true,
      isLocked: false,
      reason: "",
      isTrusted: true,
    };
  }

  const canViewBase = hasBaseVisibilityAccess(pin, user);
  const isHost = Boolean(user?.plate) && pin.createdByPlate === user.plate;
  const attendees = pin.attendees ?? [];
  const pendingRequests = pin.pendingRequests ?? [];
  const invitedGuests = pin.invitedGuests ?? [];
  const isAttendee = Boolean(user?.plate) && attendees.some((entry) => entry.plate === user.plate);
  const isPending = Boolean(user?.plate) && pendingRequests.some((entry) => entry.plate === user.plate);
  const isInvited = Boolean(user?.plate) && invitedGuests.some((entry) => entry.plate === user.plate);
  const privileged = isHost || isAttendee || isPending || isInvited;
  const detailVisibility = pin.detailVisibility ?? "public";
  const accessPolicy = pin.accessPolicy ?? "open";
  const isTrusted = user ? isTrustedForConvoy(pin, user) : false;
  const canViewDetails = canViewBase && (detailVisibility === "public" || privileged || isTrusted);

  if (!canViewBase) {
    return {
      canViewCard: false,
      canViewDetails: false,
      canJoin: false,
      isLocked: true,
      reason: "Bu konvoyun taban gorunurluk kurali sana acik degil.",
      isTrusted,
    };
  }

  if (!user) {
    return {
      canViewCard: true,
      canViewDetails: detailVisibility === "public",
      canJoin: false,
      isLocked: detailVisibility !== "public",
      reason: detailVisibility === "public" ? "Katilmak icin giris yap." : "Detaylari gormek icin uygun profil gerekir.",
      isTrusted: false,
    };
  }

  if (!canViewDetails) {
    return {
      canViewCard: true,
      canViewDetails: false,
      canJoin: false,
      isLocked: true,
      reason: "Bu konvoyun saat, rota ve lokasyon detaylari sadece guvenilir suruculere acik.",
      isTrusted,
    };
  }

  if (privileged) {
    return {
      canViewCard: true,
      canViewDetails: true,
      canJoin: !isAttendee && !isPending,
      isLocked: false,
      reason: "",
      isTrusted,
    };
  }

  if (!isTrusted) {
    return {
      canViewCard: true,
      canViewDetails: false,
      canJoin: false,
      isLocked: true,
      reason: "Driver score veya uyum metriklerin bu konvoyun minimum guven kurallarini saglamiyor.",
      isTrusted,
    };
  }

  return {
    canViewCard: true,
    canViewDetails: true,
    canJoin: accessPolicy !== "trusted" || isTrusted,
    isLocked: false,
    reason:
      accessPolicy === "request"
        ? "Detaylari goruyorsun, katilim host onayi ile ilerler."
        : "",
    isTrusted,
  };
}

export function filterVisibleMapPins(pins, user) {
  return (pins ?? []).filter((pin) => isMeetVisibleToUser(pin, user));
}
