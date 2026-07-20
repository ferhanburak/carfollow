function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function serviceTime(log) {
  const dateTime = new Date(log?.serviceDate ?? 0).getTime();
  if (Number.isFinite(dateTime)) return dateTime;
  return numeric(log?.createdAt?.toMillis?.() ?? log?.createdAt?.seconds) * 1000;
}

function newestServiceLog(logs) {
  return [...logs].sort((left, right) =>
    serviceTime(right) - serviceTime(left) || numeric(right.serviceKm) - numeric(left.serviceKm),
  )[0] ?? null;
}

function replacementPartPatch(source) {
  if (!source) return null;
  return {
    replacedKm: numeric(source.serviceKm ?? source.replacedKm),
    replacedAt: String(source.serviceDate ?? source.replacedAt ?? ""),
    lastServiceLogId: source.id ?? source.lastServiceLogId ?? null,
    lastServiceCost: numeric(source.cost ?? source.lastServiceCost),
    lastServiceShop: String(source.serviceShop ?? source.lastServiceShop ?? ""),
    notes: String(source.notes ?? ""),
  };
}

function buildServiceLogDeletionPlan({ targetLog, serviceLogs = [], passport = {}, part = null }) {
  const remainingLogs = serviceLogs.filter((log) => log.id !== targetLog.id);
  const latestService = newestServiceLog(remainingLogs);
  const totalServiceSpend = remainingLogs.reduce((sum, log) => sum + numeric(log.cost), 0);
  let partPatch = null;
  let rollbackMode = "not-required";

  if (targetLog.type === "replacement" && part?.lastServiceLogId === targetLog.id) {
    const previousReplacement = newestServiceLog(
      remainingLogs.filter((log) => log.type === "replacement" && log.partKey === targetLog.partKey),
    );
    if (previousReplacement) {
      partPatch = replacementPartPatch(previousReplacement);
      rollbackMode = "previous-replacement";
    } else if (targetLog.previousPartState) {
      partPatch = replacementPartPatch(targetLog.previousPartState);
      rollbackMode = "captured-baseline";
    } else {
      partPatch = {
        replacedKm: numeric(part.replacedKm),
        replacedAt: String(part.replacedAt ?? ""),
        lastServiceLogId: null,
        lastServiceCost: null,
        lastServiceShop: null,
        notes: part.notes ?? null,
      };
      rollbackMode = "preserved-baseline";
    }
  }

  return {
    latestService,
    partPatch,
    passportPatch: {
      serviceLogCount: remainingLogs.length,
      totalServiceSpend,
      lastServiceDate: latestService?.serviceDate ?? null,
      lastMutationId: `service-delete-${targetLog.id}`,
      lastMutationType: "service-delete",
    },
    remainingLogs,
    rollbackMode,
  };
}

module.exports = {
  buildServiceLogDeletionPlan,
};
