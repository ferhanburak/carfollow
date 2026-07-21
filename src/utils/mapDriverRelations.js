function normalizePlate(value) {
  return String(value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function getUserId(value) {
  return value?.firebaseUid ?? value?.userId ?? value?.id ?? "";
}

function matchesDriver(entry, driver) {
  const entryId = getUserId(entry);
  const driverId = getUserId(driver);
  if (entryId && driverId) return entryId === driverId;
  const entryPlate = normalizePlate(entry?.plate);
  const driverPlate = normalizePlate(driver?.plate);
  return Boolean(entryPlate && driverPlate && entryPlate === driverPlate);
}

export function getMapDriverRelation(driver, user, clanMembers = []) {
  if (matchesDriver(user, driver)) return "self";
  if ((user?.blockedDrivers ?? []).some((entry) => matchesDriver(entry, driver))) return "blocked";
  if ((user?.friends ?? []).some((entry) => matchesDriver(entry, driver))) return "friend";
  if ((clanMembers ?? []).some((entry) => matchesDriver(entry, driver))) return "clan";
  return "stranger";
}

export function buildVisibleMapDrivers(drivers = [], user, clanMembers = []) {
  return drivers
    .map((driver) => ({ ...driver, mapRelation: getMapDriverRelation(driver, user, clanMembers) }))
    .filter((driver) => !["self", "blocked"].includes(driver.mapRelation));
}
