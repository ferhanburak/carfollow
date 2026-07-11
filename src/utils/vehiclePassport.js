const DAY_IN_MS = 24 * 60 * 60 * 1000;

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getDaysSince(dateValue, now = Date.now()) {
  if (!dateValue) {
    return 0;
  }

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((now - timestamp) / DAY_IN_MS));
}

export function getPartKmProgress(part, odometer) {
  if (!part?.lifeExpectancyKm) {
    return 0;
  }

  return Math.max(0, (Number(odometer) - Number(part.replacedKm ?? 0)) / Number(part.lifeExpectancyKm));
}

export function getPartTimeProgress(part, now = Date.now()) {
  if (!part?.lifeExpectancyMonths || !part?.replacedAt) {
    return 0;
  }

  const daysSince = getDaysSince(part.replacedAt, now);
  const lifeDays = Number(part.lifeExpectancyMonths) * 30;
  if (!lifeDays) {
    return 0;
  }

  return Math.max(0, daysSince / lifeDays);
}

export function getPartHealthSnapshot(part, odometer, now = Date.now()) {
  const kmProgress = getPartKmProgress(part, odometer);
  const timeProgress = getPartTimeProgress(part, now);
  const effectiveProgress = Math.max(kmProgress, timeProgress);
  const health = clampPercent(100 - effectiveProgress * 100);
  const kmRemaining = Math.max(0, Number(part.lifeExpectancyKm ?? 0) - (Number(odometer) - Number(part.replacedKm ?? 0)));
  const daysRemaining = part.lifeExpectancyMonths
    ? Math.max(0, Number(part.lifeExpectancyMonths) * 30 - getDaysSince(part.replacedAt, now))
    : null;

  return {
    health,
    kmProgress,
    timeProgress,
    effectiveProgress,
    kmRemaining,
    daysRemaining,
    status: health <= 20 ? "critical" : health <= 45 ? "warning" : "healthy",
  };
}

export function getUpcomingMaintenance(parts, odometer, now = Date.now()) {
  return parts
    .map((part) => ({
      ...part,
      snapshot: getPartHealthSnapshot(part, odometer, now),
    }))
    .filter((part) => part.snapshot.health <= 45 || part.snapshot.kmRemaining <= 1000 || (part.snapshot.daysRemaining ?? 9999) <= 30)
    .sort((left, right) => left.snapshot.health - right.snapshot.health);
}

export function buildVehiclePassportSummary(user, now = Date.now()) {
  const serviceLogs = user.serviceLogs ?? [];
  const parts = user.parts ?? [];
  const partSnapshots = parts.map((part) => ({
    ...part,
    snapshot: getPartHealthSnapshot(part, user.odometer, now),
  }));
  const healthyParts = partSnapshots.filter((part) => part.snapshot.status === "healthy").length;
  const warningParts = partSnapshots.filter((part) => part.snapshot.status === "warning").length;
  const criticalParts = partSnapshots.filter((part) => part.snapshot.status === "critical").length;
  const totalServiceSpend = serviceLogs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
  const lastServiceLog = [...serviceLogs].sort((left, right) => new Date(right.serviceDate) - new Date(left.serviceDate))[0] ?? null;

  return {
    totalServiceLogs: serviceLogs.length,
    totalServiceSpend,
    lastServiceLog,
    healthyParts,
    warningParts,
    criticalParts,
    maintenanceScore: clampPercent(
      partSnapshots.length
        ? (partSnapshots.reduce((sum, part) => sum + part.snapshot.health, 0) / partSnapshots.length)
        : 100,
    ),
  };
}

export function appendServiceLogToUser(user, serviceLog) {
  return {
    ...user,
    odometer: Math.max(Number(user.odometer ?? 0), Number(serviceLog.serviceKm ?? 0)),
    serviceLogs: [serviceLog, ...(user.serviceLogs ?? [])],
  };
}

export function applyPartServiceToUser(user, serviceLog) {
  if (!serviceLog?.partKey) {
    return user;
  }

  return {
    ...user,
    odometer: Math.max(Number(user.odometer ?? 0), Number(serviceLog.serviceKm ?? 0)),
    parts: (user.parts ?? []).map((part) =>
      part.key === serviceLog.partKey
        ? {
            ...part,
            replacedKm: Number(serviceLog.serviceKm),
            replacedAt: serviceLog.serviceDate,
            lastServiceCost: Number(serviceLog.cost ?? 0),
            lastServiceShop: serviceLog.serviceShop,
            notes: serviceLog.notes || part.notes || "",
          }
        : part,
    ),
    serviceLogs: [serviceLog, ...(user.serviceLogs ?? [])],
  };
}

export function formatServiceDate(dateValue) {
  if (!dateValue) {
    return "--";
  }

  return new Date(dateValue).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
