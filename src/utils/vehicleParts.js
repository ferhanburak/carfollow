import maintenanceLimits from "../../functions/src/maintenanceLimits.json";

function applyStandardLimit(part) {
  const standard = maintenanceLimits[part.key];
  if (!standard) return part;
  return {
    ...part,
    lifeExpectancyKm: standard.maxKm,
    lifeExpectancyDays: standard.maxDays,
    lifeExpectancyMonths: (standard.maxDays / 365) * 12,
  };
}

const CAR_PART_CATALOG = [
  { key: "oil", name: "Engine Oil", shortLabel: "Oil", zone: "engine", lifeExpectancyKm: 8000, lifeExpectancyMonths: 12 },
  { key: "oilFilter", name: "Oil Filter", shortLabel: "Oil Filter", zone: "engine", lifeExpectancyKm: 8000, lifeExpectancyMonths: 12 },
  { key: "airFilter", name: "Air Filter", shortLabel: "Air", zone: "engine", lifeExpectancyKm: 12000, lifeExpectancyMonths: 12 },
  { key: "cabinFilter", name: "Cabin Filter", shortLabel: "Cabin", zone: "cockpit", lifeExpectancyKm: 12000, lifeExpectancyMonths: 12 },
  { key: "spark", name: "Spark Plugs", shortLabel: "Spark", zone: "engine", lifeExpectancyKm: 30000, lifeExpectancyMonths: 24 },
  { key: "coolant", name: "Coolant", shortLabel: "Coolant", zone: "engine", lifeExpectancyKm: 40000, lifeExpectancyMonths: 24 },
  { key: "battery", name: "Battery", shortLabel: "Battery", zone: "engine", lifeExpectancyKm: 50000, lifeExpectancyMonths: 36 },
  { key: "transmissionFluid", name: "Transmission Fluid", shortLabel: "Gearbox", zone: "drivetrain", lifeExpectancyKm: 60000, lifeExpectancyMonths: 36 },
  { key: "frontBrakes", name: "Front Brake Pads", shortLabel: "F Brakes", zone: "frontAxle", lifeExpectancyKm: 18000, lifeExpectancyMonths: 18 },
  { key: "rearBrakes", name: "Rear Brake Pads", shortLabel: "R Brakes", zone: "rearAxle", lifeExpectancyKm: 24000, lifeExpectancyMonths: 18 },
  { key: "frontTires", name: "Front Tires", shortLabel: "F Tires", zone: "frontAxle", lifeExpectancyKm: 30000, lifeExpectancyMonths: 30 },
  { key: "rearTires", name: "Rear Tires", shortLabel: "R Tires", zone: "rearAxle", lifeExpectancyKm: 26000, lifeExpectancyMonths: 24 },
].map(applyStandardLimit);

const MOTORCYCLE_PART_CATALOG = [
  { key: "oil", name: "Engine Oil", shortLabel: "Oil", zone: "engine", lifeExpectancyKm: 5000, lifeExpectancyMonths: 8 },
  { key: "oilFilter", name: "Oil Filter", shortLabel: "Oil Filter", zone: "engine", lifeExpectancyKm: 5000, lifeExpectancyMonths: 8 },
  { key: "airFilter", name: "Air Filter", shortLabel: "Air", zone: "engine", lifeExpectancyKm: 9000, lifeExpectancyMonths: 12 },
  { key: "spark", name: "Spark Plugs", shortLabel: "Spark", zone: "engine", lifeExpectancyKm: 20000, lifeExpectancyMonths: 18 },
  { key: "coolant", name: "Coolant", shortLabel: "Coolant", zone: "engine", lifeExpectancyKm: 24000, lifeExpectancyMonths: 24 },
  { key: "battery", name: "Battery", shortLabel: "Battery", zone: "tail", lifeExpectancyKm: 30000, lifeExpectancyMonths: 24 },
  { key: "chain", name: "Drive Chain", shortLabel: "Chain", zone: "drivetrain", lifeExpectancyKm: 18000, lifeExpectancyMonths: 18 },
  { key: "clutch", name: "Clutch Set", shortLabel: "Clutch", zone: "drivetrain", lifeExpectancyKm: 25000, lifeExpectancyMonths: 24 },
  { key: "frontBrakes", name: "Front Brake Pads", shortLabel: "F Brakes", zone: "frontWheel", lifeExpectancyKm: 14000, lifeExpectancyMonths: 18 },
  { key: "rearBrakes", name: "Rear Brake Pads", shortLabel: "R Brakes", zone: "rearWheel", lifeExpectancyKm: 16000, lifeExpectancyMonths: 18 },
  { key: "frontTires", name: "Front Tire", shortLabel: "F Tire", zone: "frontWheel", lifeExpectancyKm: 18000, lifeExpectancyMonths: 18 },
  { key: "rearTires", name: "Rear Tire", shortLabel: "R Tire", zone: "rearWheel", lifeExpectancyKm: 12000, lifeExpectancyMonths: 12 },
].map(applyStandardLimit);

const VEHICLE_KEYWORDS = {
  motorcycle: ["yamaha", "honda cbr", "r6", "ducati", "kawasaki", "s1000rr", "mt-07", "mt-09", "gsx", "ninja"],
};

export function inferVehicleType(model = "") {
  const normalized = model.toLowerCase();
  if (VEHICLE_KEYWORDS.motorcycle.some((keyword) => normalized.includes(keyword))) {
    return "motorcycle";
  }

  return "car";
}

export function getVehiclePartCatalog(vehicleType) {
  return vehicleType === "motorcycle" ? MOTORCYCLE_PART_CATALOG : CAR_PART_CATALOG;
}

export function createDefaultParts(vehicleType, baseKm = 0, replacedAt = new Date().toISOString().slice(0, 10)) {
  return getVehiclePartCatalog(vehicleType).map((part, index) => ({
    ...part,
    replacedKm: Math.max(0, Number(baseKm) - index * 120),
    replacedAt,
  }));
}

export function normalizeVehiclePart(part, vehicleType) {
  const catalogEntry = getVehiclePartCatalog(vehicleType).find((entry) => entry.key === part.key);
  const fallbackCatalogEntry = CAR_PART_CATALOG.find((entry) => entry.key === part.key) ?? MOTORCYCLE_PART_CATALOG.find((entry) => entry.key === part.key);
  const reference = catalogEntry ?? fallbackCatalogEntry ?? {
    key: part.key,
    name: part.name ?? part.key,
    shortLabel: part.name ?? part.key,
    zone: "engine",
    lifeExpectancyKm: Number(part.lifeExpectancyKm ?? part.lifeExpectancy ?? 0),
    lifeExpectancyDays: Number(part.lifeExpectancyDays ?? 0),
    lifeExpectancyMonths: Number(part.lifeExpectancyMonths ?? 12),
  };
  const standard = maintenanceLimits[part.key];

  return {
    ...reference,
    ...part,
    name: part.name ?? reference.name,
    shortLabel: part.shortLabel ?? reference.shortLabel,
    zone: part.zone ?? reference.zone,
    lifeExpectancyKm: Number(standard?.maxKm ?? part.lifeExpectancyKm ?? part.lifeExpectancy ?? reference.lifeExpectancyKm),
    lifeExpectancyDays: Number(standard?.maxDays ?? part.lifeExpectancyDays ?? reference.lifeExpectancyDays ?? Number(reference.lifeExpectancyMonths) * 30),
    lifeExpectancyMonths: Number(standard ? (standard.maxDays / 365) * 12 : part.lifeExpectancyMonths ?? reference.lifeExpectancyMonths),
    replacedKm: Number(part.replacedKm ?? 0),
    replacedAt: part.replacedAt ?? new Date().toISOString().slice(0, 10),
  };
}

export function normalizeVehicleParts(parts, vehicleType) {
  const sourceParts = parts?.length ? parts : createDefaultParts(vehicleType);
  const normalizedByKey = new Map(sourceParts.map((part) => [part.key, normalizeVehiclePart(part, vehicleType)]));

  return getVehiclePartCatalog(vehicleType).map((catalogPart) =>
    normalizedByKey.get(catalogPart.key) ?? normalizeVehiclePart(catalogPart, vehicleType),
  );
}

export function getVehicleDiagramSlots(vehicleType) {
  if (vehicleType === "motorcycle") {
    return {
      oil: { x: 49, y: 49 },
      oilFilter: { x: 41, y: 48 },
      airFilter: { x: 47, y: 38 },
      spark: { x: 56, y: 39 },
      coolant: { x: 59, y: 46 },
      battery: { x: 62, y: 56 },
      chain: { x: 63, y: 64 },
      clutch: { x: 39, y: 56 },
      frontBrakes: { x: 24, y: 37 },
      rearBrakes: { x: 78, y: 66 },
      frontTires: { x: 17, y: 36 },
      rearTires: { x: 83, y: 67 },
    };
  }

  return {
    oil: { x: 50, y: 26 },
    oilFilter: { x: 42, y: 26 },
    airFilter: { x: 58, y: 27 },
    cabinFilter: { x: 50, y: 42 },
    spark: { x: 50, y: 21 },
    coolant: { x: 61, y: 19 },
    battery: { x: 38, y: 19 },
    transmissionFluid: { x: 50, y: 58 },
    frontBrakes: { x: 24, y: 29 },
    rearBrakes: { x: 24, y: 74 },
    frontTires: { x: 16, y: 29 },
    rearTires: { x: 16, y: 74 },
  };
}
