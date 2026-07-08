import { initialClans, initialDrivers, initialMapPins, quickProfiles } from "../data/mockData";

const ambientNodes = ["Eskisehir Yolu", "TEM North", "Mogan Ring", "FSM Koprusu", "Anadolu Otoyolu"];
const routeNodes = ["Tunel Cikisi", "Sehir Disi Hat", "Viraj Koridoru", "Kuzey Dugumu", "Rolling Spot"];

function clone(value) {
  return structuredClone(value);
}

export function listQuickProfiles() {
  return clone(quickProfiles);
}

export function getQuickProfileByCredentials(plate, password) {
  return quickProfiles.find(
    (profile) => profile.plate.toUpperCase() === plate.toUpperCase() && profile.password === password,
  );
}

export function createSignedUpUser(signUpForm) {
  return {
    id: `signup-${Date.now()}`,
    fullName: signUpForm.fullName,
    plate: signUpForm.plate.toUpperCase(),
    password: signUpForm.password,
    model: signUpForm.model,
    tuningStage: signUpForm.tuningStage,
    horsepower: Number(signUpForm.horsepower || 0),
    garage: signUpForm.garage,
    odometer: 12000,
    badges: ["Yeni Uye", "Garajda Aktif"],
    clan: "Lowline Union",
    region: "Ankara Merkez",
    avatar:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
    parts: [
      { key: "oil", name: "Engine Oil", replacedKm: 12000, lifeExpectancy: 8000 },
      { key: "brakes", name: "Brake Pads", replacedKm: 12000, lifeExpectancy: 18000 },
      { key: "spark", name: "Spark Plugs", replacedKm: 12000, lifeExpectancy: 24000 },
    ],
    fuelLogs: [],
  };
}

export function createAuthenticatedUser(profile) {
  return {
    ...clone(profile),
    parts: profile.parts.map((part) => ({ ...part })),
  };
}

export function getInitialWorldState() {
  return {
    mapPins: clone(initialMapPins),
    clans: clone(initialClans),
    drivers: clone(initialDrivers),
    ambientNodes,
    routeNodes,
  };
}

export function tickAmbientDrivers(drivers, ticker) {
  return drivers.map((driver, index) => ({
    ...driver,
    speed: Math.max(86, Math.min(118, driver.speed + ((index % 2 === 0 ? 1 : -1) * ((ticker % 5) + 1)) / 2)),
    node: ambientNodes[(ticker + index) % ambientNodes.length],
  }));
}

export function buildDriveTickState(driveHud) {
  const nextSessionKm = Number((driveHud.sessionKm + 0.4).toFixed(1));
  return {
    speed: 85 + Math.floor(Math.random() * 31),
    sessionKm: nextSessionKm,
    etaNode: routeNodes[Math.floor(nextSessionKm) % routeNodes.length],
  };
}

export function incrementUserOdometer(user) {
  return {
    ...user,
    odometer: Number((user.odometer + 0.4).toFixed(1)),
  };
}

export function incrementClanKm(clans, clanName) {
  return clans.map((clan) => (clan.name === clanName ? { ...clan, km: Number((clan.km + 0.4).toFixed(1)) } : clan));
}

export function syncActiveDriver(drivers, user) {
  const others = drivers.filter((driver) => driver.plate !== user.plate);
  return [
    {
      plate: user.plate,
      vehicle: user.model,
      node: routeNodes[Math.floor(Math.random() * routeNodes.length)],
      speed: 85 + Math.floor(Math.random() * 31),
    },
    ...others,
  ];
}

export function incrementPinLike(mapPins, pinId) {
  return mapPins.map((pin) => (pin.id === pinId ? { ...pin, likes: (pin.likes ?? 0) + 1 } : pin));
}

export function incrementGalleryLike(mapPins, pinId, galleryId) {
  return mapPins.map((pin) =>
    pin.id === pinId
      ? {
          ...pin,
          galleryLikes: (pin.galleryLikes ?? 0) + 1,
          gallery: pin.gallery.map((entry) => (entry.id === galleryId ? { ...entry, likes: entry.likes + 1 } : entry)),
        }
      : pin,
  );
}

export function appendWashReview(mapPins, pinId, review) {
  return mapPins.map((pin) => {
    if (pin.id !== pinId) {
      return pin;
    }

    const reviews = [review, ...pin.reviews];
    const foamAvg = reviews.reduce((sum, item) => sum + item.foam, 0) / reviews.length;
    const waterAvg = reviews.reduce((sum, item) => sum + item.water, 0) / reviews.length;

    return {
      ...pin,
      reviews,
      rating: {
        foam: foamAvg,
        water: waterAvg,
        reviews: reviews.length,
        allowsBuckets: reviews.filter((item) => item.allowsBuckets).length,
        shadowDrying: reviews.filter((item) => item.shadowDrying).length,
      },
    };
  });
}

export function joinCruiseAttendee(mapPins, pinId, plate) {
  return mapPins.map((pin) =>
    pin.id === pinId
      ? {
          ...pin,
          attendees: pin.attendees.includes(plate) ? pin.attendees : [...pin.attendees, plate],
        }
      : pin,
  );
}

export function appendFuelLog(user, nextLog) {
  return {
    ...user,
    odometer: Math.max(user.odometer, nextLog.currentKm),
    fuelLogs: [nextLog, ...user.fuelLogs],
  };
}
