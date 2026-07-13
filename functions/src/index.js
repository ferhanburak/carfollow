const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const {
  DRIVE_KM_PER_SECOND,
  applyCompletedDriveToStats,
  buildDriverStatsDocument,
  buildLeaderboardEntry,
  calculateAcceptedDriveKm,
  isNightTime,
  roundKm,
} = require("./driverStats");
const {
  buildVehiclePassportExportDocument,
} = require("./vehiclePassportExport");

admin.initializeApp();

const db = admin.firestore();
const APP_ID = process.env.CRUISER_APP_ID || "cruiser-app-prod";

function publicCollection(collectionName) {
  return db.collection(`artifacts/${APP_ID}/public/data/${collectionName}`);
}

function privateUserDocument(userId, collectionName, documentId) {
  return db.doc(`artifacts/${APP_ID}/users/${userId}/${collectionName}/${documentId}`);
}

function privateUserCollection(userId, collectionName) {
  return db.collection(`artifacts/${APP_ID}/users/${userId}/${collectionName}`);
}

function publicDocument(collectionName, documentId) {
  return publicCollection(collectionName).doc(documentId);
}

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  return request.auth.uid;
}

async function getUserProfile(userId) {
  const snapshot = await privateUserDocument(userId, "profile", "current").get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  return {
    id: userId,
    ...snapshot.data(),
  };
}

function buildPairId(leftId, rightId) {
  return [leftId, rightId].sort((left, right) => left.localeCompare(right)).join("__");
}

function buildScopedMemberId(scopeId, userId) {
  return `${scopeId}__${userId}`;
}

function requireSnapshot(snapshot, code, message) {
  if (!snapshot.exists) {
    throw new HttpsError(code, message);
  }
  return snapshot.data();
}

function assertDriveSessionId(sessionId) {
  if (
    typeof sessionId !== "string" ||
    sessionId.length < 12 ||
    sessionId.length > 180 ||
    !/^[0-9A-Za-z_-]+$/.test(sessionId)
  ) {
    throw new HttpsError("invalid-argument", "A valid idempotent sessionId is required.");
  }
}

function driverAggregateRefs(userId, vehicleId) {
  return {
    profileRef: privateUserDocument(userId, "profile", "current"),
    publicProfileRef: publicDocument("publicProfiles", userId),
    statsRef: privateUserDocument(userId, "driverStats", "current"),
    vehicleRef: privateUserDocument(userId, "vehicles", vehicleId),
    passportRef: privateUserDocument(userId, "vehiclePassports", vehicleId),
  };
}

function writeDriverAggregate(transaction, {
  userId,
  profile,
  stats,
  statsExists,
  timestamp,
  profileExtras = {},
  statsExtras = {},
}) {
  const refs = driverAggregateRefs(userId, profile.primaryVehicleId);
  const leaderboardEntry = buildLeaderboardEntry({ userId, profile, stats });
  const profileStats = {
    monthlyKm: stats.monthlyKm,
    monthlyKmPeriod: stats.periodKey,
    achievementBadges: stats.achievementBadges,
    badges: [...new Set([...(profile.badges ?? []), ...(stats.achievementBadges ?? [])])],
    driverStatsUpdatedAt: timestamp,
  };

  transaction.set(refs.statsRef, {
    ...stats,
    ...statsExtras,
    ...(statsExists ? {} : { createdAt: timestamp }),
    updatedAt: timestamp,
  }, { merge: true });
  transaction.set(refs.profileRef, {
    ...profileStats,
    ...profileExtras,
    updatedAt: timestamp,
  }, { merge: true });
  transaction.set(refs.publicProfileRef, {
    ...profileStats,
    updatedAt: timestamp,
  }, { merge: true });
  transaction.set(publicDocument("individualLeaderboard", leaderboardEntry.id), {
    ...leaderboardEntry,
    updatedAt: timestamp,
  }, { merge: true });

  return leaderboardEntry;
}

function assertConvoyTrust(convoy, requester) {
  const score = Number(requester.driverScore ?? 0);
  const harmonyVotes = Number(requester.harmonyVotes ?? 0);
  const alertVotes = Number(requester.alertVotes ?? 0);

  if (score < Number(convoy.minDriverScore ?? 0)) {
    throw new HttpsError("permission-denied", "Driver score is below the convoy requirement.");
  }
  if (harmonyVotes < Number(convoy.minHarmonyVotes ?? 0)) {
    throw new HttpsError("permission-denied", "Harmony vote requirement is not met.");
  }
  if (alertVotes > Number(convoy.maxAlertVotes ?? Number.MAX_SAFE_INTEGER)) {
    throw new HttpsError("permission-denied", "Alert vote limit is exceeded.");
  }
}

exports.requestFriendship = onCall(async (request) => {
  const requesterUserId = requireAuth(request);
  const { targetUserId } = request.data ?? {};

  if (!targetUserId || typeof targetUserId !== "string") {
    throw new HttpsError("invalid-argument", "targetUserId is required.");
  }
  if (requesterUserId === targetUserId) {
    throw new HttpsError("failed-precondition", "You cannot request yourself.");
  }

  const [requester, target] = await Promise.all([
    getUserProfile(requesterUserId),
    getUserProfile(targetUserId),
  ]);
  const friendshipId = buildPairId(requesterUserId, targetUserId);
  const friendshipRef = publicCollection("friendships").doc(friendshipId);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(friendshipRef);
    if (existing.exists) {
      throw new HttpsError("already-exists", "Friendship request already exists.");
    }

    transaction.set(friendshipRef, {
      requesterUserId,
      requesterPlate: requester.plate ?? "",
      requesterName: requester.fullName ?? "",
      targetUserId,
      targetPlate: target.plate ?? "",
      targetName: target.fullName ?? "",
      participants: {
        [requesterUserId]: true,
        [targetUserId]: true,
      },
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, friendshipId };
});

exports.requestConvoyJoin = onCall(async (request) => {
  const requesterUserId = requireAuth(request);
  const { convoyId } = request.data ?? {};

  if (!convoyId || typeof convoyId !== "string") {
    throw new HttpsError("invalid-argument", "convoyId is required.");
  }

  const requester = await getUserProfile(requesterUserId);
  const convoyRef = publicCollection("convoys").doc(convoyId);
  const memberRef = publicCollection("convoyMembers").doc(buildScopedMemberId(convoyId, requesterUserId));

  await db.runTransaction(async (transaction) => {
    const [convoySnapshot, existingMember] = await Promise.all([
      transaction.get(convoyRef),
      transaction.get(memberRef),
    ]);
    if (!convoySnapshot.exists) {
      throw new HttpsError("not-found", "Convoy not found.");
    }
    if (existingMember.exists) {
      throw new HttpsError("already-exists", "User is already part of this convoy flow.");
    }

    const convoy = convoySnapshot.data();
    assertConvoyTrust(convoy, requester);
    transaction.set(memberRef, {
      convoyId,
      userId: requesterUserId,
      plate: requester.plate ?? "",
      fullName: requester.fullName ?? "",
      status: convoy.accessPolicy === "open" ? "approved" : "pending",
      tripStatus: "ready",
      scoreSnapshot: Number(requester.driverScore ?? 0),
      harmonyVotesSnapshot: Number(requester.harmonyVotes ?? 0),
      alertVotesSnapshot: Number(requester.alertVotes ?? 0),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, convoyId };
});

exports.respondConvoyJoinRequest = onCall(async (request) => {
  const actorUserId = requireAuth(request);
  const { convoyId, memberUserId, decision } = request.data ?? {};

  if (!convoyId || !memberUserId || !["approved", "declined"].includes(decision)) {
    throw new HttpsError("invalid-argument", "convoyId, memberUserId and valid decision are required.");
  }

  const convoyRef = publicCollection("convoys").doc(convoyId);
  const memberRef = publicCollection("convoyMembers").doc(buildScopedMemberId(convoyId, memberUserId));

  await db.runTransaction(async (transaction) => {
    const [convoySnapshot, memberSnapshot] = await Promise.all([
      transaction.get(convoyRef),
      transaction.get(memberRef),
    ]);
    if (!convoySnapshot.exists) {
      throw new HttpsError("not-found", "Convoy not found.");
    }
    if (convoySnapshot.data().hostUserId !== actorUserId) {
      throw new HttpsError("permission-denied", "Only the convoy host can moderate requests.");
    }
    if (!memberSnapshot.exists) {
      throw new HttpsError("not-found", "Member request not found.");
    }

    transaction.update(memberRef, {
      status: decision,
      reviewedByUserId: actorUserId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, convoyId, memberUserId, decision };
});

exports.inviteClanMember = onCall(async (request) => {
  const actorUserId = requireAuth(request);
  const { clanId, targetUserId } = request.data ?? {};

  if (!clanId || !targetUserId) {
    throw new HttpsError("invalid-argument", "clanId and targetUserId are required.");
  }

  const [actor, target, clanSnapshot] = await Promise.all([
    getUserProfile(actorUserId),
    getUserProfile(targetUserId),
    publicCollection("clans").doc(clanId).get(),
  ]);
  if (!clanSnapshot.exists) {
    throw new HttpsError("not-found", "Clan not found.");
  }

  const clan = clanSnapshot.data();
  if (![clan.ownerUserId, clan.createdByUserId].includes(actorUserId)) {
    throw new HttpsError("permission-denied", "Only the clan owner can invite members in this phase.");
  }

  const inviteRef = publicCollection("clanInvites").doc(buildScopedMemberId(clanId, targetUserId));
  await db.runTransaction(async (transaction) => {
    const existingInvite = await transaction.get(inviteRef);
    if (existingInvite.exists) {
      throw new HttpsError("already-exists", "Invite already exists.");
    }

    transaction.set(inviteRef, {
      clanId,
      clanName: clan.name ?? "",
      targetUserId,
      targetPlate: target.plate ?? "",
      targetName: target.fullName ?? "",
      invitedByUserId: actorUserId,
      invitedByPlate: actor.plate ?? "",
      invitedByName: actor.fullName ?? "",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, clanId, targetUserId };
});

exports.refreshDriverStats = onCall(async (request) => {
  const userId = requireAuth(request);
  let response;

  await db.runTransaction(async (transaction) => {
    const profileRef = privateUserDocument(userId, "profile", "current");
    const profileSnapshot = await transaction.get(profileRef);
    const profile = requireSnapshot(profileSnapshot, "not-found", "User profile not found.");
    const vehicleId = profile.primaryVehicleId;
    if (!vehicleId) {
      throw new HttpsError("failed-precondition", "Primary vehicle identity is missing.");
    }

    const refs = driverAggregateRefs(userId, vehicleId);
    const [vehicleSnapshot, passportSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(refs.vehicleRef),
      transaction.get(refs.passportRef),
      transaction.get(refs.statsRef),
    ]);
    const vehicle = requireSnapshot(vehicleSnapshot, "not-found", "Primary vehicle not found.");
    const passport = requireSnapshot(passportSnapshot, "not-found", "Vehicle Passport not found.");
    const stats = buildDriverStatsDocument({
      existingStats: statsSnapshot.exists ? statsSnapshot.data() : {},
      profile: { ...profile, id: userId, firebaseUid: userId },
      passport,
      vehicle,
      now: new Date(),
    });
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const leaderboardEntry = writeDriverAggregate(transaction, {
      userId,
      profile,
      stats,
      statsExists: statsSnapshot.exists,
      timestamp,
    });

    response = { ok: true, stats, leaderboardEntry };
  });

  return response;
});

exports.createVehiclePassportExport = onCall(async (request) => {
  const userId = requireAuth(request);
  const exportId = `passport-export-${Date.now()}`;
  let response;

  await db.runTransaction(async (transaction) => {
    const profileRef = privateUserDocument(userId, "profile", "current");
    const profileSnapshot = await transaction.get(profileRef);
    const profile = requireSnapshot(profileSnapshot, "not-found", "User profile not found.");
    const vehicleId = profile.primaryVehicleId;
    if (!vehicleId) {
      throw new HttpsError("failed-precondition", "Primary vehicle identity is missing.");
    }

    const vehicleRef = privateUserDocument(userId, "vehicles", vehicleId);
    const passportRef = privateUserDocument(userId, "vehiclePassports", vehicleId);
    const exportRef = privateUserDocument(userId, "vehiclePassportExports", exportId);
    const [vehicleSnapshot, passportSnapshot, partsSnapshot, serviceLogsSnapshot, fuelLogsSnapshot] = await Promise.all([
      transaction.get(vehicleRef),
      transaction.get(passportRef),
      transaction.get(privateUserCollection(userId, "parts")),
      transaction.get(privateUserCollection(userId, "serviceLogs")),
      transaction.get(privateUserCollection(userId, "fuelLogs")),
    ]);
    const vehicle = requireSnapshot(vehicleSnapshot, "not-found", "Primary vehicle not found.");
    const passport = requireSnapshot(passportSnapshot, "not-found", "Vehicle Passport not found.");
    if (vehicle.ownerId !== userId || passport.ownerId !== userId || vehicle.vehicleId !== vehicleId) {
      throw new HttpsError("permission-denied", "Vehicle ownership validation failed.");
    }

    const scopedParts = partsSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.vehicleId === vehicleId);
    const scopedServiceLogs = serviceLogsSnapshot.docs
      .map((item) => ({ id: item.data().id ?? item.id, ...item.data() }))
      .filter((item) => item.vehicleId === vehicleId);
    const scopedFuelLogs = fuelLogsSnapshot.docs
      .map((item) => ({ id: item.data().id ?? item.id, ...item.data() }))
      .filter((item) => item.vehicleId === vehicleId);
    const generatedAt = admin.firestore.Timestamp.now();
    const exportDocument = buildVehiclePassportExportDocument({
      exportId,
      userId,
      profile,
      passport,
      vehicle,
      parts: scopedParts,
      serviceLogs: scopedServiceLogs,
      fuelLogs: scopedFuelLogs,
      generatedAt,
    });

    transaction.set(exportRef, exportDocument);
    response = {
      ok: true,
      exportId,
      export: exportDocument,
    };
  });

  return response;
});

exports.startDriveSession = onCall(async (request) => {
  const userId = requireAuth(request);
  const { sessionId } = request.data ?? {};
  assertDriveSessionId(sessionId);
  let response;

  await db.runTransaction(async (transaction) => {
    const profileRef = privateUserDocument(userId, "profile", "current");
    const profileSnapshot = await transaction.get(profileRef);
    const profile = requireSnapshot(profileSnapshot, "not-found", "User profile not found.");
    const vehicleId = profile.primaryVehicleId;
    if (!vehicleId) {
      throw new HttpsError("failed-precondition", "Primary vehicle identity is missing.");
    }

    const refs = driverAggregateRefs(userId, vehicleId);
    const requestedSessionRef = privateUserDocument(userId, "driveSessions", sessionId);
    const [vehicleSnapshot, passportSnapshot, statsSnapshot, requestedSessionSnapshot] = await Promise.all([
      transaction.get(refs.vehicleRef),
      transaction.get(refs.passportRef),
      transaction.get(refs.statsRef),
      transaction.get(requestedSessionRef),
    ]);
    const vehicle = requireSnapshot(vehicleSnapshot, "not-found", "Primary vehicle not found.");
    const passport = requireSnapshot(passportSnapshot, "not-found", "Vehicle Passport not found.");
    const existingStats = statsSnapshot.exists ? statsSnapshot.data() : {};

    if (requestedSessionSnapshot.exists) {
      const existingSession = requestedSessionSnapshot.data();
      if (existingSession.userId !== userId || existingSession.vehicleId !== vehicleId) {
        throw new HttpsError("permission-denied", "Drive session ownership does not match.");
      }
      response = {
        ok: true,
        resumed: existingSession.status === "active",
        sessionId,
        status: existingSession.status,
        stats: existingStats,
      };
      return;
    }

    if (existingStats.activeSessionId && existingStats.activeSessionId !== sessionId) {
      const activeSessionRef = privateUserDocument(userId, "driveSessions", existingStats.activeSessionId);
      const activeSessionSnapshot = await transaction.get(activeSessionRef);
      if (activeSessionSnapshot.exists && activeSessionSnapshot.data().status === "active") {
        response = {
          ok: true,
          resumed: true,
          sessionId: existingStats.activeSessionId,
          status: "active",
          stats: existingStats,
        };
        return;
      }
    }

    const now = new Date();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const stats = {
      ...buildDriverStatsDocument({
        existingStats,
        profile: { ...profile, id: userId, firebaseUid: userId },
        passport,
        vehicle,
        now,
      }),
      activeSessionId: sessionId,
    };

    transaction.set(requestedSessionRef, {
      id: sessionId,
      userId,
      vehicleId,
      status: "active",
      startOdometer: roundKm(vehicle.odometer),
      acceptedKm: 0,
      reportedKm: 0,
      serverKmRate: DRIVE_KM_PER_SECOND,
      periodKey: stats.periodKey,
      startedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const leaderboardEntry = writeDriverAggregate(transaction, {
      userId,
      profile,
      stats,
      statsExists: statsSnapshot.exists,
      timestamp,
      statsExtras: { activeSessionStartedAt: timestamp },
    });

    response = {
      ok: true,
      resumed: false,
      sessionId,
      status: "active",
      stats,
      leaderboardEntry,
    };
  });

  return response;
});

exports.finishDriveSession = onCall(async (request) => {
  const userId = requireAuth(request);
  const { sessionId, reportedKm } = request.data ?? {};
  assertDriveSessionId(sessionId);
  if (!Number.isFinite(Number(reportedKm)) || Number(reportedKm) < 0) {
    throw new HttpsError("invalid-argument", "reportedKm must be a positive number or zero.");
  }
  let response;

  await db.runTransaction(async (transaction) => {
    const sessionRef = privateUserDocument(userId, "driveSessions", sessionId);
    const profileRef = privateUserDocument(userId, "profile", "current");
    const [sessionSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(profileRef),
    ]);
    const session = requireSnapshot(sessionSnapshot, "not-found", "Drive session not found.");
    const profile = requireSnapshot(profileSnapshot, "not-found", "User profile not found.");
    if (session.userId !== userId || session.vehicleId !== profile.primaryVehicleId) {
      throw new HttpsError("permission-denied", "Drive session ownership does not match.");
    }

    const refs = driverAggregateRefs(userId, session.vehicleId);
    const [vehicleSnapshot, passportSnapshot, statsSnapshot] = await Promise.all([
      transaction.get(refs.vehicleRef),
      transaction.get(refs.passportRef),
      transaction.get(refs.statsRef),
    ]);
    const vehicle = requireSnapshot(vehicleSnapshot, "not-found", "Primary vehicle not found.");
    const passport = requireSnapshot(passportSnapshot, "not-found", "Vehicle Passport not found.");
    const existingStats = statsSnapshot.exists ? statsSnapshot.data() : {};

    if (session.status === "completed") {
      response = {
        ok: true,
        duplicate: true,
        sessionId,
        acceptedKm: Number(session.acceptedKm ?? 0),
        rejectedKm: Number(session.rejectedKm ?? 0),
        odometer: Number(session.endOdometer ?? vehicle.odometer ?? 0),
        stats: existingStats,
        leaderboardEntry: buildLeaderboardEntry({ userId, profile, stats: existingStats }),
      };
      return;
    }
    if (session.status !== "active") {
      throw new HttpsError("failed-precondition", "Drive session is not active.");
    }

    const finishedAt = new Date();
    const distance = calculateAcceptedDriveKm({
      reportedKm: Number(reportedKm),
      startedAt: session.startedAt,
      finishedAt,
    });
    const nextOdometer = roundKm(Math.max(
      Number(vehicle.odometer ?? 0),
      Number(session.startOdometer ?? vehicle.odometer ?? 0) + distance.acceptedKm,
    ));
    const stats = applyCompletedDriveToStats({
      existingStats,
      profile: { ...profile, id: userId, firebaseUid: userId, odometer: nextOdometer },
      passport,
      vehicle: { ...vehicle, odometer: nextOdometer },
      acceptedKm: distance.acceptedKm,
      isNight: isNightTime(session.startedAt),
      now: finishedAt,
    });
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    transaction.update(sessionRef, {
      status: "completed",
      reportedKm: roundKm(reportedKm),
      acceptedKm: distance.acceptedKm,
      rejectedKm: distance.rejectedKm,
      elapsedSeconds: distance.elapsedSeconds,
      endOdometer: nextOdometer,
      completedAt: timestamp,
      updatedAt: timestamp,
    });
    transaction.update(refs.vehicleRef, {
      odometer: nextOdometer,
      lastOdometerSource: "drive",
      lastDriveSessionId: sessionId,
      updatedAt: timestamp,
    });
    const leaderboardEntry = writeDriverAggregate(transaction, {
      userId,
      profile,
      stats,
      statsExists: statsSnapshot.exists,
      timestamp,
      profileExtras: { odometer: nextOdometer },
      statsExtras: {
        activeSessionId: null,
        activeSessionStartedAt: null,
        lastCompletedSessionId: sessionId,
      },
    });

    response = {
      ok: true,
      duplicate: false,
      sessionId,
      acceptedKm: distance.acceptedKm,
      rejectedKm: distance.rejectedKm,
      odometer: nextOdometer,
      stats,
      leaderboardEntry,
    };
  });

  return response;
});
