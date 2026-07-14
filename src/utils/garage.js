export const createSignUpState = () => ({
  email: "",
  fullName: "",
  plate: "",
  password: "",
  model: "",
  tuningStage: "Stock",
  horsepower: "",
  garage: "",
});

export const createWashForm = () => ({
  foam: 5,
  water: 5,
  allowsBuckets: false,
  shadowDrying: false,
  note: "",
});

export const createMapPinForm = (seedPin) => ({
  type: "meet",
  name: "",
  lat: seedPin?.lat ?? 39.8687,
  lng: seedPin?.lng ?? 32.7766,
  description: "",
  tags: "#NightRun #CrewApproved",
  time: "22:30",
  route: "",
  foam: 5,
  water: 5,
  allowsBuckets: true,
  shadowDrying: false,
  note: "",
  routePoints: seedPin?.routePath ?? [],
  visibility: seedPin?.visibility ?? "friends",
  capacity: seedPin?.capacity ?? 12,
  invitedPlates: seedPin?.invitedGuests?.map((guest) => guest.plate) ?? [],
  accessPolicy: seedPin?.accessPolicy ?? "request",
  detailVisibility: seedPin?.detailVisibility ?? "trusted",
  minDriverScore: seedPin?.minDriverScore ?? 75,
  minHarmonyVotes: seedPin?.minHarmonyVotes ?? 5,
  maxAlertVotes: seedPin?.maxAlertVotes ?? 3,
});

export const createSpotPhotoForm = () => ({
  title: "",
  imageUrl: "",
  fileName: "",
  file: null,
});

export const createFuelForm = (odometer) => ({
  liters: "",
  price: "",
  currentKm: odometer,
  station: "",
});

export const createServiceLogForm = (user) => ({
  partKey: user?.parts?.[0]?.key ?? "oil",
  type: "replacement",
  serviceDate: new Date().toISOString().slice(0, 10),
  serviceKm: Math.round(user?.odometer ?? 0),
  serviceShop: user?.garage ?? "",
  cost: "",
  notes: "",
  receiptImageUrl: "",
});

export function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(Math.round(value * 10) / 10);
}

export function getPartHealth(part, odometer, now = new Date()) {
  if (
    Number.isFinite(Number(part.healthPercent)) &&
    Math.abs(Number(part.healthOdometer ?? -1) - Number(odometer)) < 0.05
  ) {
    return Math.max(0, Math.min(100, Math.round(Number(part.healthPercent))));
  }

  const used = Math.max(odometer - part.replacedKm, 0);
  const lifeExpectancy = Number(part.lifeExpectancyKm ?? part.lifeExpectancy ?? 0);
  const kmPercent = lifeExpectancy
    ? Math.max(0, 100 - (used / lifeExpectancy) * 100)
    : 100;
  const replacedAt = new Date(`${String(part.replacedAt ?? "").slice(0, 10)}T00:00:00.000Z`);
  const lifeExpectancyMonths = Math.max(0, Number(part.lifeExpectancyMonths ?? 0));
  let timePercent = 100;

  if (lifeExpectancyMonths && Number.isFinite(replacedAt.getTime())) {
    const dueAt = new Date(replacedAt);
    dueAt.setUTCMonth(dueAt.getUTCMonth() + lifeExpectancyMonths);
    const totalLife = Math.max(1, dueAt.getTime() - replacedAt.getTime());
    const remainingLife = Math.max(0, dueAt.getTime() - new Date(now).getTime());
    timePercent = (remainingLife / totalLife) * 100;
  }

  return Math.round(Math.max(0, Math.min(100, kmPercent, timePercent)));
}

export function computeFuelInsights(logs) {
  if (logs.length < 2) {
    return {
      average: 0,
      costPerFill: 0,
      totalSpend: logs.reduce((sum, log) => sum + log.price, 0),
    };
  }

  const ordered = [...logs].sort((a, b) => b.currentKm - a.currentKm);
  let liters = 0;
  let km = 0;

  for (let index = 0; index < ordered.length - 1; index += 1) {
    liters += Number(ordered[index].liters);
    km += Math.max(ordered[index].currentKm - ordered[index + 1].currentKm, 0);
  }

  return {
    average: km ? (liters / km) * 100 : 0,
    costPerFill: logs.reduce((sum, log) => sum + log.price, 0) / logs.length,
    totalSpend: logs.reduce((sum, log) => sum + log.price, 0),
  };
}
