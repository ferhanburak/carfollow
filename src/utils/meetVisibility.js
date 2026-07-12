const MEET_VISIBILITY = ["public", "friends", "clan"];

export function getMeetVisibilityOptions() {
  return MEET_VISIBILITY;
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

export function filterVisibleMapPins(pins, user) {
  return (pins ?? []).filter((pin) => isMeetVisibleToUser(pin, user));
}
