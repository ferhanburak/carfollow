const EXPORT_SCHEMA_VERSION = 1;

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function toMillis(value) {
  if (!value) {
    return 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getDaysSince(dateValue, now = Date.now()) {
  const timestamp = toMillis(dateValue);
  if (!timestamp) {
    return 0;
  }

  return Math.max(0, Math.floor((now - timestamp) / (24 * 60 * 60 * 1000)));
}

function toIsoDate(value) {
  const timestamp = toMillis(value);
  return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "";
}

function getPartHealthSnapshot(part, odometer, now = Date.now()) {
  const lifeExpectancyKm = Number(part.lifeExpectancyKm ?? 0);
  const lifeExpectancyMonths = Number(part.lifeExpectancyMonths ?? 0);
  const kmProgress = lifeExpectancyKm
    ? Math.max(0, (Number(odometer ?? 0) - Number(part.replacedKm ?? 0)) / lifeExpectancyKm)
    : 0;
  const timeProgress = lifeExpectancyMonths && part.replacedAt
    ? Math.max(0, getDaysSince(part.replacedAt, now) / (lifeExpectancyMonths * 30))
    : 0;
  const health = clampPercent(100 - Math.max(kmProgress, timeProgress) * 100);

  return {
    health,
    status: health <= 20 ? "critical" : health <= 45 ? "warning" : "healthy",
  };
}

function buildMaintenanceSummary({ profile = {}, passport = {}, parts = [], serviceLogs = [], fuelLogs = [], now = Date.now() }) {
  const odometer = Number(profile.odometer ?? 0);
  const partSnapshots = parts.map((part) => ({
    ...part,
    snapshot: getPartHealthSnapshot(part, odometer, now),
  }));
  const totalServiceSpend = serviceLogs.reduce((sum, log) => sum + Number(log.cost ?? 0), 0);
  const persistedServiceCount = Number(passport.serviceLogCount ?? serviceLogs.length);
  const persistedFuelCount = Number(passport.fuelLogCount ?? fuelLogs.length);

  return {
    totalServiceLogs: serviceLogs.length,
    totalServiceSpend,
    fuelLogCount: fuelLogs.length,
    healthyParts: partSnapshots.filter((part) => part.snapshot.status === "healthy").length,
    warningParts: partSnapshots.filter((part) => part.snapshot.status === "warning").length,
    criticalParts: partSnapshots.filter((part) => part.snapshot.status === "critical").length,
    maintenanceScore: clampPercent(
      partSnapshots.length
        ? partSnapshots.reduce((sum, part) => sum + part.snapshot.health, 0) / partSnapshots.length
        : 100,
    ),
    recordIntegrity: persistedServiceCount === serviceLogs.length && persistedFuelCount === fuelLogs.length,
    transferState: passport.transferState ?? "unknown",
    passportStatus: passport.status ?? "unknown",
  };
}

function buildResaleReport({ profile = {}, passport = {}, vehicle = {}, parts = [], serviceLogs = [], fuelLogs = [], now = Date.now() }) {
  const summary = buildMaintenanceSummary({ profile, passport, parts, serviceLogs, fuelLogs, now });
  const odometer = Number(vehicle.odometer ?? profile.odometer ?? 0);
  const latestServiceKm = serviceLogs.reduce((latestKm, log) => Math.max(latestKm, Number(log.serviceKm ?? 0)), 0);
  const latestFuelKm = fuelLogs.reduce((latestKm, log) => Math.max(latestKm, Number(log.currentKm ?? 0)), 0);
  const verifiedKm = Math.max(latestServiceKm, latestFuelKm);
  const documentedKmCoverage = odometer > 0 ? clampPercent((verifiedKm / odometer) * 100) : 0;
  const recentServiceLogs = [...serviceLogs]
    .sort((left, right) => toMillis(right.serviceDate) - toMillis(left.serviceDate))
    .slice(0, 3)
    .map((log) => ({
      id: String(log.id ?? ""),
      partKey: String(log.partKey ?? ""),
      type: String(log.type ?? ""),
      serviceDate: toIsoDate(log.serviceDate),
      serviceKm: Number(log.serviceKm ?? 0),
      serviceShop: String(log.serviceShop ?? ""),
      cost: Number(log.cost ?? 0),
    }));
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
    readinessScore,
    documentedKmCoverage,
    documentedParts,
    recentServiceLogs,
    riskFlags,
    summary,
    schemaVersion: EXPORT_SCHEMA_VERSION,
  };
}

function buildVehiclePassportExportDocument({
  exportId,
  userId,
  profile,
  passport,
  vehicle,
  parts,
  serviceLogs,
  fuelLogs,
  generatedAt,
}) {
  const report = buildResaleReport({ profile, passport, vehicle, parts, serviceLogs, fuelLogs });

  return {
    id: exportId,
    userId,
    vehicleId: vehicle.vehicleId ?? profile.primaryVehicleId,
    plate: String(profile.plate ?? vehicle.plate ?? ""),
    model: String(vehicle.model ?? profile.model ?? ""),
    odometer: Number(vehicle.odometer ?? profile.odometer ?? 0),
    generatedAt,
    transferState: passport.transferState ?? "unknown",
    passportStatus: passport.status ?? "unknown",
    serviceLogCount: serviceLogs.length,
    fuelLogCount: fuelLogs.length,
    partCount: parts.length,
    totalServiceSpend: report.summary.totalServiceSpend,
    maintenanceScore: report.summary.maintenanceScore,
    recordIntegrity: report.summary.recordIntegrity,
    readinessScore: report.readinessScore,
    documentedKmCoverage: report.documentedKmCoverage,
    documentedParts: report.documentedParts,
    riskFlags: report.riskFlags,
    recentServiceLogs: report.recentServiceLogs,
    schemaVersion: EXPORT_SCHEMA_VERSION,
  };
}

module.exports = {
  EXPORT_SCHEMA_VERSION,
  buildMaintenanceSummary,
  buildResaleReport,
  buildVehiclePassportExportDocument,
};
