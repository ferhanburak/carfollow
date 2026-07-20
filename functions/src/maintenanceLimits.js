const maintenanceLimits = require("./maintenanceLimits.json");

function resolveMaintenanceLimit(part = {}) {
  const standard = maintenanceLimits[part.key];
  if (standard) {
    return {
      lifeExpectancyKm: standard.maxKm,
      lifeExpectancyDays: standard.maxDays,
      lifeExpectancyMonths: (standard.maxDays / 365) * 12,
    };
  }

  const lifeExpectancyMonths = Math.max(0, Number(part.lifeExpectancyMonths) || 0);
  return {
    lifeExpectancyKm: Math.max(0, Number(part.lifeExpectancyKm ?? part.lifeExpectancy) || 0),
    lifeExpectancyDays: Math.max(0, Number(part.lifeExpectancyDays) || 0),
    lifeExpectancyMonths,
  };
}

module.exports = {
  maintenanceLimits,
  resolveMaintenanceLimit,
};
