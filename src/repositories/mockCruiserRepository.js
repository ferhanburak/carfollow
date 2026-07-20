import { initialClans, initialMapPins, quickProfiles } from "../data/mockData";
import { normalizeClanState } from "../utils/clanGraph";
import { getConvoyAccessState } from "../utils/meetVisibility";
import { applyPartServiceToUser } from "../utils/vehiclePassport";
import { createDefaultParts, inferVehicleType, normalizeVehicleParts } from "../utils/vehicleParts";
import { normalizeSocialState } from "../utils/socialGraph";
import { normalizeConversations } from "../utils/socialChat";
import {
  buildVehiclePassportDocument,
  resolvePrimaryVehicleId,
} from "../domain/vehicleDocuments";

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
      tripStatus: "ready",
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
    tripStatus: attendee.tripStatus ?? "ready",
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
    tripStatus: "ready",
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

export function createSignedUpUser(signUpForm, identity = {}) {
  const vehicleType = inferVehicleType(signUpForm.model);
  const odometer = Number(signUpForm.odometer);
  const id = identity.id ?? `signup-${Date.now()}`;
  const primaryVehicleId = resolvePrimaryVehicleId(
    { primaryVehicleId: identity.primaryVehicleId, id },
    identity.firebaseUid ?? id,
  );
  const user = {
    id,
    ...(identity.firebaseUid ? { firebaseUid: identity.firebaseUid } : {}),
    ...((identity.email ?? signUpForm.email) ? { email: identity.email ?? signUpForm.email } : {}),
    fullName: signUpForm.fullName,
    plate: signUpForm.plate.toUpperCase(),
    model: signUpForm.model,
    tuningStage: signUpForm.tuningStage,
    horsepower: Number(signUpForm.horsepower || 0),
    garage: signUpForm.garage,
    privacy: {
      plateSearchEnabled: true,
      showModelInSearch: true,
      showRegionInSearch: false,
      locationPrecision: "approximate",
      safeZoneEnabled: true,
      kvkkConsentVersion: "2026-07",
    },
    privacyConsent: {
      version: "2026-07",
      kvkkAcceptedAt: Date.now(),
      plateSearchConsent: true,
    },
    odometer,
    badges: ["Yeni Uye", "Garajda Aktif"],
    clan: "Lowline Union",
    clanRole: "member",
    region: "Ankara Merkez",
    avatar: signUpForm.avatarPreview || "",
    vehicleType,
    primaryVehicleId,
    parts: createDefaultParts(vehicleType, odometer, new Date().toISOString().slice(0, 10)),
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

  return {
    ...user,
    vehiclePassport: buildVehiclePassportDocument(user, identity.firebaseUid ?? id),
  };
}

export function createAuthenticatedUser(profile) {
  const { password: _password, ...safeProfile } = clone(profile);
  const vehicleType = safeProfile.vehicleType ?? inferVehicleType(safeProfile.model);
  const ownerId = safeProfile.firebaseUid ?? safeProfile.id;
  const primaryVehicleId = resolvePrimaryVehicleId(safeProfile, ownerId);
  const parts = normalizeVehicleParts(safeProfile.parts ?? [], vehicleType).map((part) => ({
    ...part,
    userId: part.userId ?? ownerId,
    vehicleId: part.vehicleId ?? primaryVehicleId,
  }));
  const serviceLogs = (safeProfile.serviceLogs ?? []).map((log) => ({
    ...log,
    vehicleId: log.vehicleId ?? primaryVehicleId,
  }));
  const fuelLogs = (safeProfile.fuelLogs ?? []).map((log) => ({
    ...log,
    vehicleId: log.vehicleId ?? primaryVehicleId,
  }));
  const normalizedProfile = {
    ...safeProfile,
    vehicleType,
    primaryVehicleId,
    parts,
    serviceLogs,
    fuelLogs,
  };

  return {
    ...normalizeClanState(normalizeSocialState(normalizedProfile)),
    vehicleType,
    primaryVehicleId,
    badges: [...(safeProfile.badges ?? [])],
    parts,
    serviceLogs,
    fuelLogs,
    vehiclePassport: {
      ...buildVehiclePassportDocument(normalizedProfile, ownerId),
      ...(safeProfile.vehiclePassport ?? {}),
    },
    monthlyKm: Number(safeProfile.monthlyKm ?? 0),
    driverScore: Number(safeProfile.driverScore ?? 80),
    harmonyVotes: Number(safeProfile.harmonyVotes ?? 0),
    alertVotes: Number(safeProfile.alertVotes ?? 0),
    conversations: normalizeConversations(safeProfile),
  };
}

export function getInitialWorldState() {
  return {
    mapPins: clone(initialMapPins),
    clans: clone(initialClans),
    drivers: [],
    ambientNodes,
    routeNodes,
  };
}

export function buildDriveTickState(driveHud) {
  const nextSessionKm = Number((driveHud.sessionKm + 0.4).toFixed(1));
  return {
    speed: 85 + Math.floor(Math.random() * 31),
    sessionKm: nextSessionKm,
    etaNode: routeNodes[Math.floor(nextSessionKm) % routeNodes.length],
  };
}

function getRouteDistanceKm(routePath = []) {
  if (!Array.isArray(routePath) || routePath.length < 2) {
    return 0;
  }

  let totalKm = 0;
  for (let index = 1; index < routePath.length; index += 1) {
    const start = routePath[index - 1];
    const end = routePath[index];
    const latKm = (end.lat - start.lat) * 111.32;
    const avgLatRadians = ((start.lat + end.lat) / 2) * (Math.PI / 180);
    const lngKm = (end.lng - start.lng) * (111.32 * Math.cos(avgLatRadians));
    totalKm += Math.sqrt(latKm ** 2 + lngKm ** 2);
  }

  return Number(totalKm.toFixed(1));
}

function resolveLifecycleStatus(progressRatio) {
  if (progressRatio >= 0.98) {
    return "completed";
  }
  if (progressRatio >= 0.45) {
    return "rolling";
  }
  if (progressRatio >= 0.2) {
    return "delayed";
  }

  return "planning";
}

function resolveTripStatus(attendee, progressRatio, index, hostPlate) {
  const normalizedAttendee = normalizeAttendee(attendee);
  if (normalizedAttendee.tripStatus === "cancelled") {
    return "cancelled";
  }

  const isHost = normalizedAttendee.plate === hostPlate;
  const offset = index * 0.08;

  if (progressRatio >= Math.max(0.82, 0.72 + offset)) {
    return "arrived";
  }
  if (progressRatio >= Math.max(0.2, 0.08 + offset) || isHost) {
    return "enroute";
  }

  return "ready";
}

export function incrementUserOdometer(user, { distanceKm = 0.4, incrementMonthlyKm = true } = {}) {
  const safeDistanceKm = Math.max(0, Number(distanceKm) || 0);
  return {
    ...user,
    odometer: Number((Number(user.odometer ?? 0) + safeDistanceKm).toFixed(3)),
    monthlyKm: incrementMonthlyKm
      ? Number((Number(user.monthlyKm ?? 0) + safeDistanceKm).toFixed(3))
      : Number(user.monthlyKm ?? 0),
  };
}

export function advanceConvoySimulation(mapPins, driveHud, user) {
  if (!user) {
    return mapPins;
  }

  return mapPins.map((pin) => {
    if (pin.type !== "meet") {
      return pin;
    }

    const attendees = (pin.attendees ?? []).map(normalizeAttendee);
    const involvesUser =
      pin.createdByPlate === user.plate || attendees.some((attendee) => attendee.plate === user.plate);

    if (!involvesUser) {
      return pin;
    }

    const totalKm = Math.max(1, getRouteDistanceKm(pin.routePath));
    const progressRatio = Math.min(1, (driveHud.sessionKm ?? 0) / totalKm);
    const lifecycleStatus = resolveLifecycleStatus(progressRatio);

    return {
      ...pin,
      lifecycleStatus,
      attendees: attendees.map((attendee, index) => ({
        ...attendee,
        tripStatus:
          attendee.plate === user.plate
            ? progressRatio >= 0.98
              ? "arrived"
              : progressRatio >= 0.08
                ? "enroute"
                : "ready"
            : resolveTripStatus(attendee, progressRatio, index, pin.createdByPlate),
      })),
    };
  });
}

export function incrementClanKm(clans, clanName, distanceKm = 0.4) {
  const safeDistanceKm = Math.max(0, Number(distanceKm) || 0);
  return clans.map((clan) => (
    clan.name === clanName
      ? { ...clan, km: Number((Number(clan.km ?? 0) + safeDistanceKm).toFixed(3)) }
      : clan
  ));
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
    const accessState = getConvoyAccessState(pin, {
      plate: attendee.plate,
      driverScore: attendee.score,
      harmonyVotes: attendee.harmonyVotes,
      alertVotes: attendee.alertVotes,
      friends: [],
      clan: attendee.clan,
    });

    if (isFull) {
      return {
        ...pin,
        attendees: currentAttendees,
        pendingRequests,
        convoyStatus: "full",
      };
    }

    if (!accessState.canJoin) {
      return {
        ...pin,
        attendees: currentAttendees,
        pendingRequests,
        convoyStatus: "restricted",
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

export function updateConvoyLifecycleStatus(mapPins, pinId, lifecycleStatus) {
  return mapPins.map((pin) => {
    if (pin.id !== pinId) {
      return pin;
    }

    return {
      ...pin,
      lifecycleStatus,
    };
  });
}

export function updateConvoyAttendeeTripStatus(mapPins, pinId, plate, tripStatus) {
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

        return {
          ...attendee,
          tripStatus,
        };
      }),
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

export function inviteCruiseGuest(mapPins, pinId, profile) {
  return mapPins.map((pin) => {
    if (pin.id !== pinId) {
      return pin;
    }

    const invitedGuests = (pin.invitedGuests ?? []).map(normalizeInvitee).filter(Boolean);
    const attendees = (pin.attendees ?? []).map(normalizeAttendee);
    const pendingRequests = (pin.pendingRequests ?? []).map(normalizeAttendee);

    if (
      invitedGuests.some((entry) => entry.plate === profile.plate) ||
      attendees.some((entry) => entry.plate === profile.plate) ||
      pendingRequests.some((entry) => entry.plate === profile.plate)
    ) {
      return {
        ...pin,
        invitedGuests,
        attendees,
        pendingRequests,
      };
    }

    return {
      ...pin,
      invitedGuests: [
        ...invitedGuests,
        normalizeInvitee(profile),
      ],
      attendees,
      pendingRequests,
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
  const vehicleId = nextLog.vehicleId ?? user.primaryVehicleId;
  return {
    ...user,
    odometer: Math.max(user.odometer, nextLog.currentKm),
    fuelLogs: [{ ...nextLog, vehicleId }, ...user.fuelLogs],
    vehiclePassport: {
      ...(user.vehiclePassport ?? {}),
      fuelLogCount: Number(user.vehiclePassport?.fuelLogCount ?? user.fuelLogs.length) + 1,
      lastFuelKm: Number(nextLog.currentKm),
      lastMutationId: nextLog.id,
      lastMutationType: "fuel",
    },
  };
}

export function appendServiceLog(user, serviceLog) {
  return applyPartServiceToUser(user, serviceLog);
}
