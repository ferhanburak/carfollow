const DAY_IN_MS = 24 * 60 * 60 * 1000;

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveDate(dateValue) {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue?.toDate === "function") {
    return dateValue.toDate();
  }
  if (Number.isFinite(Number(dateValue?.seconds))) {
    return new Date(Number(dateValue.seconds) * 1000);
  }
  return new Date(dateValue);
}

export function getDaysSince(dateValue, now = Date.now()) {
  if (!dateValue) {
    return 0;
  }

  const timestamp = resolveDate(dateValue).getTime();
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
  const persistedPassport = user.vehiclePassport ?? null;
  const persistedServiceCount = Number(persistedPassport?.serviceLogCount ?? serviceLogs.length);
  const persistedFuelCount = Number(persistedPassport?.fuelLogCount ?? (user.fuelLogs ?? []).length);

  const summary = {
    totalServiceLogs: serviceLogs.length,
    totalServiceSpend,
    lastServiceLog,
    vehicleId: user.primaryVehicleId ?? persistedPassport?.vehicleId ?? "local-primary",
    passportStatus: persistedPassport?.status ?? "local",
    issuedAt: persistedPassport?.issuedAt ?? null,
    fuelLogCount: (user.fuelLogs ?? []).length,
    recordIntegrity:
      persistedServiceCount === serviceLogs.length && persistedFuelCount === (user.fuelLogs ?? []).length,
    healthyParts,
    warningParts,
    criticalParts,
    maintenanceScore: clampPercent(
      partSnapshots.length
        ? (partSnapshots.reduce((sum, part) => sum + part.snapshot.health, 0) / partSnapshots.length)
        : 100,
    ),
  };

  return {
    ...summary,
    historyReport: buildVehicleHistoryReport(user, summary),
  };
}

export function buildVehicleHistoryReport(user, summary = buildVehiclePassportSummary(user)) {
  const serviceLogs = user.serviceLogs ?? [];
  const fuelLogs = user.fuelLogs ?? [];
  const parts = user.parts ?? [];
  const latestServiceKm = serviceLogs.reduce(
    (latestKm, log) => Math.max(latestKm, Number(log.serviceKm ?? 0)),
    0,
  );
  const latestFuelKm = fuelLogs.reduce(
    (latestKm, log) => Math.max(latestKm, Number(log.currentKm ?? 0)),
    0,
  );
  const odometer = Number(user.odometer ?? 0);
  const verifiedKm = Math.max(latestServiceKm, latestFuelKm);
  const documentedKmCoverage = odometer > 0 ? clampPercent((verifiedKm / odometer) * 100) : 0;
  const recentServiceLogs = [...serviceLogs]
    .sort((left, right) => new Date(right.serviceDate) - new Date(left.serviceDate))
    .slice(0, 3);
  const replacedPartKeys = new Set(
    serviceLogs
      .filter((log) => log.type === "replacement")
      .map((log) => log.partKey)
      .filter(Boolean),
  );
  const documentedParts = parts.filter((part) => replacedPartKeys.has(part.key)).length;
  const readinessScore = clampPercent(
    summary.maintenanceScore * 0.45 +
      (summary.recordIntegrity ? 20 : 0) +
      documentedKmCoverage * 0.2 +
      (parts.length ? (documentedParts / parts.length) * 15 : 15),
  );
  const riskFlags = [
    ...(summary.criticalParts > 0 ? [`${summary.criticalParts} critical part${summary.criticalParts > 1 ? "s" : ""}`] : []),
    ...(!summary.recordIntegrity ? ["record count mismatch"] : []),
    ...(documentedKmCoverage < 70 ? ["low documented KM coverage"] : []),
    ...(serviceLogs.length === 0 ? ["no service history"] : []),
  ];

  return {
    historyScore: readinessScore,
    documentedKmCoverage,
    documentedParts,
    recentServiceLogs,
    riskFlags,
    vehicleId: summary.vehicleId,
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

  const isReplacement = serviceLog.type === "replacement";
  const nextServiceLog = {
    ...serviceLog,
    vehicleId: serviceLog.vehicleId ?? user.primaryVehicleId,
  };
  const currentServiceLogs = user.serviceLogs ?? [];

  return {
    ...user,
    odometer: Math.max(Number(user.odometer ?? 0), Number(serviceLog.serviceKm ?? 0)),
    parts: (user.parts ?? []).map((part) =>
      isReplacement && part.key === serviceLog.partKey
        ? {
            ...part,
            replacedKm: Number(serviceLog.serviceKm),
            replacedAt: serviceLog.serviceDate,
            lastServiceCost: Number(serviceLog.cost ?? 0),
            lastServiceLogId: serviceLog.id,
            lastServiceShop: serviceLog.serviceShop,
            notes: serviceLog.notes || part.notes || "",
          }
        : part,
    ),
    serviceLogs: [nextServiceLog, ...currentServiceLogs],
    vehiclePassport: {
      ...(user.vehiclePassport ?? {}),
      serviceLogCount: Number(user.vehiclePassport?.serviceLogCount ?? currentServiceLogs.length) + 1,
      totalServiceSpend:
        Number(user.vehiclePassport?.totalServiceSpend ?? 0) + Number(serviceLog.cost ?? 0),
      lastServiceDate: serviceLog.serviceDate,
      lastMutationId: serviceLog.id,
      lastMutationType: "service",
    },
  };
}

export function formatServiceDate(dateValue) {
  if (!dateValue) {
    return "--";
  }

  const date = resolveDate(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
