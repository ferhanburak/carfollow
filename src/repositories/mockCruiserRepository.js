import { initialClans, initialDrivers, initialMapPins, quickProfiles } from "../data/mockData";
import { normalizeClanState } from "../utils/clanGraph";
import { applyPartServiceToUser } from "../utils/vehiclePassport";
import { createDefaultParts, inferVehicleType, normalizeVehicleParts } from "../utils/vehicleParts";
import { normalizeSocialState } from "../utils/socialGraph";
import { normalizeConversations } from "../utils/socialChat";

const ambientNodes = ["Eskisehir Yolu", "TEM North", "Mogan Ring", "FSM Koprusu", "Anadolu Otoyolu"];
const routeNodes = ["Tunel Cikisi", "Sehir Disi Hat", "Viraj Koridoru", "Kuzey Dugumu", "Rolling Spot"];

function clone(value) {
  return structuredClone(value);
}

function getDriverStanding(score, harmonyVotes, alertVotes) {
  if (alertVotes >= harmonyVotes + 2 || score < 60) {
    return "Watchlist";
  }

  if (harmonyVotes >= alertVotes + 3 || score >= 88) {
    return "Uyumlu";
  }

  return "Convoy Ready";
}

function normalizeAttendee(attendee) {
  if (typeof attendee === "string") {
    return {
      plate: attendee,
      fullName: attendee,
      model: "Unknown Setup",
      region: "Unknown Region",
      score: 70,
      harmonyVotes: 0,
      alertVotes: 0,
      status: "Convoy Ready",
    };
  }

  const score = attendee.score ?? 70;
  const harmonyVotes = attendee.harmonyVotes ?? 0;
  const alertVotes = attendee.alertVotes ?? 0;

  return {
    ...attendee,
    score,
    harmonyVotes,
    alertVotes,
    status: attendee.status ?? getDriverStanding(score, harmonyVotes, alertVotes),
  };
}

function normalizeInvitee(invitee) {
  if (!invitee) {
    return null;
  }

  return {
    plate: invitee.plate,
    fullName: invitee.fullName,
    model: invitee.model,
    region: invitee.region,
  };
}

export function createAttendeeRecord(user) {
  const score = user.driverScore ?? 82;
  const harmonyVotes = user.harmonyVotes ?? 0;
  const alertVotes = user.alertVotes ?? 0;

  return {
    plate: user.plate,
    fullName: user.fullName,
    model: user.model,
    region: user.region,
    score,
    harmonyVotes,
    alertVotes,
    status: getDriverStanding(score, harmonyVotes, alertVotes),
  };
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
  const vehicleType = inferVehicleType(signUpForm.model);
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
    clanRole: "member",
    region: "Ankara Merkez",
    avatar:
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
    vehicleType,
    parts: createDefaultParts(vehicleType, 12000, "2026-07-11"),
    serviceLogs: [],
    fuelLogs: [],
    monthlyKm: 0,
    driverScore: 80,
    harmonyVotes: 1,
    alertVotes: 0,
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    clanInvites: [],
    sentClanInvites: [],
  };
}

export function createAuthenticatedUser(profile) {
  const vehicleType = profile.vehicleType ?? inferVehicleType(profile.model);
  return {
    ...normalizeClanState(normalizeSocialState(clone(profile))),
    vehicleType,
    badges: [...(profile.badges ?? [])],
    parts: normalizeVehicleParts(profile.parts ?? [], vehicleType),
    serviceLogs: (profile.serviceLogs ?? []).map((log) => ({ ...log })),
    fuelLogs: (profile.fuelLogs ?? []).map((log) => ({ ...log })),
    monthlyKm: Number(profile.monthlyKm ?? 0),
    driverScore: Number(profile.driverScore ?? 80),
    harmonyVotes: Number(profile.harmonyVotes ?? 0),
    alertVotes: Number(profile.alertVotes ?? 0),
    conversations: normalizeConversations(profile),
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
    monthlyKm: Number(((user.monthlyKm ?? 0) + 0.4).toFixed(1)),
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
          gallery: pin.gallery.map((entry) => (entry.id === galleryId ? { ...entry, likes: (entry.likes ?? 0) + 1 } : entry)),
        }
      : pin,
  );
}

export function appendMapPin(mapPins, pin) {
  const withoutDuplicate = mapPins.filter((entry) => entry.id !== pin.id);
  return [pin, ...withoutDuplicate];
}

export function appendSpotPhoto(mapPins, pinId, photo) {
  return mapPins.map((pin) =>
    pin.id === pinId
      ? {
          ...pin,
          gallery: [photo, ...(pin.gallery ?? [])],
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

export function joinCruiseAttendee(mapPins, pinId, attendee) {
  return mapPins.map((pin) => {
    if (pin.id !== pinId) {
      return pin;
    }

    const currentAttendees = (pin.attendees ?? []).map(normalizeAttendee);
    const pendingRequests = (pin.pendingRequests ?? []).map(normalizeAttendee);
    if (currentAttendees.some((entry) => entry.plate === attendee.plate)) {
      return {
        ...pin,
        attendees: currentAttendees,
        pendingRequests,
      };
    }

    const capacity = Number(pin.capacity ?? 999);
    const invitedGuests = (pin.invitedGuests ?? []).map(normalizeInvitee).filter(Boolean);
    const isInvited = invitedGuests.some((entry) => entry.plate === attendee.plate);
    const requiresApproval = pin.visibility !== "public" && !isInvited && pin.createdByPlate !== attendee.plate;
    const isFull = currentAttendees.length >= capacity;

    if (isFull) {
      return {
        ...pin,
        attendees: currentAttendees,
        pendingRequests,
        convoyStatus: "full",
      };
    }

    if (requiresApproval) {
      if (pendingRequests.some((entry) => entry.plate === attendee.plate)) {
        return {
          ...pin,
          attendees: currentAttendees,
          pendingRequests,
        };
      }

      return {
        ...pin,
        attendees: currentAttendees,
        pendingRequests: [
          ...pendingRequests,
          {
            ...normalizeAttendee(attendee),
            status: "Pending Review",
          },
        ],
      };
    }

    return {
      ...pin,
      attendees: [...currentAttendees, normalizeAttendee(attendee)],
      pendingRequests: pendingRequests.filter((entry) => entry.plate !== attendee.plate),
    };
  });
}

export function approveCruiseRequest(mapPins, pinId, plate) {
  return mapPins.map((pin) => {
    if (pin.id !== pinId) {
      return pin;
    }

    const currentAttendees = (pin.attendees ?? []).map(normalizeAttendee);
    const pendingRequests = (pin.pendingRequests ?? []).map(normalizeAttendee);
    const request = pendingRequests.find((entry) => entry.plate === plate);
    if (!request) {
      return {
        ...pin,
        attendees: currentAttendees,
        pendingRequests,
      };
    }

    const capacity = Number(pin.capacity ?? 999);
    if (currentAttendees.length >= capacity) {
      return {
        ...pin,
        attendees: currentAttendees,
        pendingRequests,
        convoyStatus: "full",
      };
    }

    return {
      ...pin,
      attendees: [...currentAttendees, { ...request, status: request.status === "Pending Review" ? "Convoy Ready" : request.status }],
      pendingRequests: pendingRequests.filter((entry) => entry.plate !== plate),
    };
  });
}

export function declineCruiseRequest(mapPins, pinId, plate) {
  return mapPins.map((pin) => {
    if (pin.id !== pinId) {
      return pin;
    }

    return {
      ...pin,
      pendingRequests: (pin.pendingRequests ?? []).filter((entry) => entry.plate !== plate),
    };
  });
}

export function rateCruiseAttendee(mapPins, pinId, plate, signal) {
  return mapPins.map((pin) => {
    if (pin.id !== pinId) {
      return pin;
    }

    return {
      ...pin,
      attendees: (pin.attendees ?? []).map((entry) => {
        const attendee = normalizeAttendee(entry);
        if (attendee.plate !== plate) {
          return attendee;
        }

        const harmonyVotes = signal === "harmony" ? attendee.harmonyVotes + 1 : attendee.harmonyVotes;
        const alertVotes = signal === "alert" ? attendee.alertVotes + 1 : attendee.alertVotes;
        const score = signal === "harmony" ? Math.min(99, attendee.score + 3) : Math.max(5, attendee.score - 8);

        return {
          ...attendee,
          score,
          harmonyVotes,
          alertVotes,
          status: getDriverStanding(score, harmonyVotes, alertVotes),
        };
      }),
    };
  });
}

export function appendFuelLog(user, nextLog) {
  return {
    ...user,
    odometer: Math.max(user.odometer, nextLog.currentKm),
    fuelLogs: [nextLog, ...user.fuelLogs],
  };
}

export function appendServiceLog(user, serviceLog) {
  return applyPartServiceToUser(user, serviceLog);
}
