const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const {
  DRIVE_KM_PER_SECOND,
  applyCompletedDriveToClan,
  applyCompletedDriveToStats,
  buildDriverStatsDocument,
  buildLeaderboardEntry,
  buildPartLifeSnapshot,
  calculateAcceptedDriveKm,
  getMonthKey,
  isNightTime,
  roundKm,
} = require("./driverStats");
const {
  buildVehiclePassportExportDocument,
} = require("./vehiclePassportExport");
const {
  buildBlockedDriverDocument,
  buildFriendshipDocument,
  buildFriendshipMigrationDocument,
  buildPairId,
  normalizePlate,
  normalizePrivacySettings,
  PROFILE_RELATIONS,
  projectPlateSearchResult,
  projectPublicProfileForViewer,
} = require("./social");
const {
  buildClanDocument,
  buildClanInviteDocument,
  buildClanMemberDocument,
  canInviteClanMember,
  canManageClanMember,
  isClanRole,
  normalizeClanName,
  normalizeClanTag,
  sanitizeClanText,
} = require("./clan");
const {
  buildMapPinDocument,
  buildSpotPhotoDocument,
  buildWashRating,
  buildWashReviewDocument,
} = require("./map");
const {
  LIFECYCLE_STATUSES,
  buildConvoyDocument,
  buildConvoyMemberDocument,
  buildPublicMapSummary,
  canSeeConvoy,
  meetsTrust,
  presentConvoy,
  projectDriver,
  resolveConvoyLocationUpdate,
} = require("./convoy");
const {
  buildDirectMessage,
  buildDirectMessageThreadId,
  buildThreadMetadata,
  sanitizeMessageBody,
} = require("./directMessages");
const {
  buildModerationAuditDocument,
  buildModerationReportDocument,
  buildNotificationDocument,
  hasModeratorClaim,
  sanitizeOperationalText,
} = require("./operations");
const {
  RegistrationError,
  buildRegistrationBundle,
} = require("./registration");
const {
  ACCOUNT_DELETE_CONFIRMATION,
  buildAccountExport,
  buildWithdrawnPrivacySettings,
  hasRecentAuthentication,
  requireDeletionConfirmation,
} = require("./accountLifecycle");

setGlobalOptions({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60,
  concurrency: 40,
  maxInstances: 5,
});

admin.initializeApp();

const db = admin.firestore();
const realtimeDb = admin.database();
const APP_ID = process.env.CRUISER_APP_ID || "cruiser-app-prod";
const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK === "true";

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

async function enforceCallableRateLimit(userId, action, { limit, windowSeconds }) {
  const safeAction = String(action).replace(/[^0-9A-Za-z_-]/g, "-").slice(0, 100);
  const rateLimitRef = privateUserDocument(userId, "rateLimits", safeAction);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const current = snapshot.exists ? snapshot.data() : {};
    const currentWindowEnd = Number(current.windowEndMs ?? 0);
    const isCurrentWindow = currentWindowEnd > now;
    const nextCount = isCurrentWindow ? Number(current.count ?? 0) + 1 : 1;
    if (isCurrentWindow && nextCount > limit) {
      throw new HttpsError("resource-exhausted", "Too many requests. Please wait and try again.");
    }

    const windowEndMs = isCurrentWindow ? currentWindowEnd : now + windowSeconds * 1000;
    transaction.set(rateLimitRef, {
      action: safeAction,
      count: nextCount,
      windowStartMs: isCurrentWindow ? Number(current.windowStartMs ?? now) : now,
      windowEndMs,
      expiresAt: admin.firestore.Timestamp.fromMillis(windowEndMs + 24 * 60 * 60 * 1000),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

function secureCall(name, optionsOrHandler, maybeHandler) {
  const options = typeof optionsOrHandler === "function" ? {} : optionsOrHandler;
  const handler = typeof optionsOrHandler === "function" ? optionsOrHandler : maybeHandler;

  return onCall({ cors: true, enforceAppCheck: APP_CHECK_ENFORCED, invoker: "public" }, async (request) => {
    const startedAt = Date.now();
    const requestId = String(request.rawRequest?.headers?.["x-cloud-trace-context"] ?? `${name}-${startedAt}`)
      .split("/")[0]
      .slice(0, 128);
    const logContext = {
      callable: name,
      requestId,
      authenticated: Boolean(request.auth?.uid),
      appCheck: Boolean(request.app),
    };
    logger.info("callable.start", logContext);

    try {
      if (options.rateLimit && request.auth?.uid) {
        await enforceCallableRateLimit(request.auth.uid, name, options.rateLimit);
      }
      const result = await handler(request);
      logger.info("callable.success", { ...logContext, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      const severity = error instanceof HttpsError && ["invalid-argument", "failed-precondition"].includes(error.code)
        ? "warn"
        : "error";
      logger[severity]("callable.failure", {
        ...logContext,
        durationMs: Date.now() - startedAt,
        errorCode: error?.code ?? "internal",
      });
      throw error;
    }
  });
}

function writeNotification(transaction, userId, notificationId, payload, timestamp) {
  const notification = buildNotificationDocument({
    id: notificationId,
    userId,
    ...payload,
    timestamp,
  });
  transaction.set(privateUserDocument(userId, "notifications", notification.id), notification, { merge: true });
  return notification;
}

function requireModerator(request) {
  const userId = requireAuth(request);
  if (!hasModeratorClaim(request.auth?.token)) {
    throw new HttpsError("permission-denied", "Moderator privileges are required.");
  }
  return userId;
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

function buildScopedMemberId(scopeId, userId) {
  return `${scopeId}__${userId}`;
}

function requireTargetUserId(request, actorUserId) {
  const targetUserId = request.data?.targetUserId;
  if (
    typeof targetUserId !== "string" ||
    targetUserId.length < 1 ||
    targetUserId.length > 128 ||
    targetUserId.includes("/")
  ) {
    throw new HttpsError("invalid-argument", "A valid targetUserId is required.");
  }
  if (actorUserId === targetUserId) {
    throw new HttpsError("failed-precondition", "You cannot perform this action on yourself.");
  }
  return targetUserId;
}

function friendshipDocument(leftUserId, rightUserId) {
  return publicDocument("friendships", buildPairId(leftUserId, rightUserId));
}

function blockedDriverDocument(ownerUserId, targetUserId) {
  return privateUserDocument(ownerUserId, "blockedUsers", targetUserId);
}

function clanMemberDocument(clanId, userId) {
  return publicDocument("clanMembers", buildScopedMemberId(clanId, userId));
}

function clanInviteDocument(clanId, userId) {
  return publicDocument("clanInvites", buildScopedMemberId(clanId, userId));
}

function setProfileClanState(transaction, userId, { clan, clanId, clanRole, timestamp }) {
  const patch = { clan: clan ?? null, clanId: clanId ?? null, clanRole: clanRole ?? null, updatedAt: timestamp };
  transaction.set(privateUserDocument(userId, "profile", "current"), patch, { merge: true });
  transaction.set(publicDocument("publicProfiles", userId), patch, { merge: true });
}

exports.finalizeRegistration = secureCall("finalizeRegistration", { rateLimit: { limit: 5, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  let bundle;
  try {
    bundle = buildRegistrationBundle({
      uid: userId,
      email: request.auth?.token?.email,
      profile: request.data?.profile,
      acceptKvkk: request.data?.acceptKvkk,
      timestamp,
    });
  } catch (error) {
    if (error instanceof RegistrationError) {
      throw new HttpsError(error.code, error.message);
    }
    throw error;
  }

  const claimRef = publicDocument("plateClaims", bundle.claim.plateNormalized);
  const publicProfileRef = publicDocument("publicProfiles", userId);
  const privateProfileRef = privateUserDocument(userId, "profile", "current");
  const vehicleRef = privateUserDocument(userId, "vehicles", bundle.vehicle.vehicleId);
  const passportRef = privateUserDocument(userId, "vehiclePassports", bundle.passport.vehicleId);
  let created = false;

  await db.runTransaction(async (transaction) => {
    const [claimSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(claimRef),
      transaction.get(privateProfileRef),
    ]);
    const existingClaim = claimSnapshot.exists ? claimSnapshot.data() : null;
    if (existingClaim?.uid && existingClaim.uid !== userId) {
      throw new HttpsError("already-exists", "This vehicle plate is already registered.");
    }
    if (profileSnapshot.exists) {
      if (
        profileSnapshot.data().plateNormalized !== bundle.claim.plateNormalized ||
        (existingClaim?.uid && existingClaim.uid !== userId)
      ) {
        throw new HttpsError("failed-precondition", "This account already has a different CRUISER identity.");
      }
      return;
    }

    if (!claimSnapshot.exists) {
      transaction.create(claimRef, bundle.claim);
    }
    transaction.set(publicProfileRef, bundle.publicProfile);
    transaction.set(privateProfileRef, bundle.privateProfile);
    transaction.set(vehicleRef, bundle.vehicle);
    transaction.set(passportRef, bundle.passport);
    for (const part of bundle.parts) {
      transaction.set(privateUserDocument(userId, "parts", part.id), part.data);
    }
    created = true;
  });

  return {
    ok: true,
    created,
    plateNormalized: bundle.claim.plateNormalized,
    vehicleId: bundle.vehicle.vehicleId,
  };
});

function assertClanId(clanId) {
  if (typeof clanId !== "string" || clanId.length < 1 || clanId.length > 160 || clanId.includes("/")) {
    throw new HttpsError("invalid-argument", "A valid clanId is required.");
  }
}

function assertClanIdentity(name, tag) {
  const safeName = sanitizeClanText(name, 48);
  const safeTag = normalizeClanTag(tag);
  if (safeName.length < 3 || safeName.length > 48 || safeName.includes("/")) {
    throw new HttpsError("invalid-argument", "Clan name must contain 3-48 valid characters.");
  }
  if (!/^[A-Z0-9]{2,6}$/.test(safeTag)) {
    throw new HttpsError("invalid-argument", "Clan tag must contain 2-6 letters or numbers.");
  }
  return { name: safeName, tag: safeTag };
}

function assertClanRole(role) {
  if (!isClanRole(role) || role === "owner") {
    throw new HttpsError("invalid-argument", "Role must be captain or member.");
  }
  return role;
}

function getClanMemberRole(snapshot, userId) {
  const member = requireSnapshot(snapshot, "permission-denied", "Clan membership is required.");
  if (member.userId !== userId || !isClanRole(member.role)) {
    throw new HttpsError("permission-denied", "Clan membership could not be verified.");
  }
  return member.role;
}

function isAcceptedFriendship(friendship, leftUserId, rightUserId) {
  return friendship?.status === "accepted" &&
    (friendship.participantIds ?? []).includes(leftUserId) &&
    (friendship.participantIds ?? []).includes(rightUserId);
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

async function requireMessagingConnection(actorUserId, targetUserId) {
  const [actor, target, friendship, actorBlock, targetBlock] = await Promise.all([
    getUserProfile(actorUserId),
    getUserProfile(targetUserId),
    friendshipDocument(actorUserId, targetUserId).get(),
    blockedDriverDocument(actorUserId, targetUserId).get(),
    blockedDriverDocument(targetUserId, actorUserId).get(),
  ]);
  if (!friendship.exists || friendship.data().status !== "accepted") {
    throw new HttpsError("permission-denied", "Direct messages require an active friendship.");
  }
  if (actorBlock.exists || targetBlock.exists) {
    throw new HttpsError("permission-denied", "Direct messages are unavailable for this driver.");
  }
  return { actor, target };
}

async function ensureDirectMessageThreadState(actorUserId, targetUserId) {
  const { actor, target } = await requireMessagingConnection(actorUserId, targetUserId);
  const threadId = buildDirectMessageThreadId(actorUserId, targetUserId);
  const rootPath = `artifacts/${APP_ID}/realtime/directMessages`;
  const threadRef = realtimeDb.ref(`${rootPath}/threads/${threadId}`);
  const existing = await threadRef.get();
  const timestamp = Date.now();
  const metadata = buildThreadMetadata({ threadId, leftProfile: actor, rightProfile: target, timestamp });
  const createdAt = existing.exists() ? Number(existing.child("createdAt").val() ?? timestamp) : timestamp;
  const updates = {
    [`threads/${threadId}/id`]: threadId,
    [`threads/${threadId}/participantUids`]: metadata.participantUids,
    [`threads/${threadId}/participantProfiles`]: metadata.participantProfiles,
    [`threads/${threadId}/schemaVersion`]: metadata.schemaVersion,
    [`threads/${threadId}/createdAt`]: createdAt,
    [`threads/${threadId}/updatedAt`]: timestamp,
    [`userThreads/${actorUserId}/${threadId}`]: { threadId, counterpartUid: targetUserId, updatedAt: timestamp },
    [`userThreads/${targetUserId}/${threadId}`]: { threadId, counterpartUid: actorUserId, updatedAt: timestamp },
  };
  await realtimeDb.ref(rootPath).update(updates);
  return { actor, target, threadId, rootPath, timestamp };
}

async function migrateLegacyConvoyPins() {
  const legacySnapshot = await publicCollection("mapPins").where("type", "==", "meet").get();
  for (const item of legacySnapshot.docs.slice(0, 50)) {
    const legacy = { id: item.id, ...item.data() };
    const convoyRef = publicDocument("convoys", item.id);
    const existing = await convoyRef.get();
    if (existing.exists) {
      if (typeof legacy.backendCanViewDetails === "boolean") continue;
      if (existing.data().visibility === "public") await item.ref.set(buildPublicMapSummary(existing.data()));
      else await item.ref.delete();
      continue;
    }
    if (!legacy.createdByUid) {
      await item.ref.delete();
      continue;
    }
    try {
      const host = await getUserProfile(legacy.createdByUid);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      const convoy = buildConvoyDocument({ convoyId: item.id, pin: legacy, host, invitedProfiles: [], timestamp });
      const batch = db.batch();
      batch.set(convoyRef, convoy);
      batch.set(publicDocument("convoyMembers", buildScopedMemberId(convoy.id, legacy.createdByUid)), buildConvoyMemberDocument({ convoy, profile: host, timestamp }));
      if (convoy.visibility === "public") batch.set(item.ref, buildPublicMapSummary(convoy));
      else batch.delete(item.ref);
      await batch.commit();
    } catch (_error) {
      // Malformed legacy events are removed so they cannot leak route details.
      await item.ref.delete();
    }
  }
}

exports.requestFriendship = secureCall("requestFriendship", { rateLimit: { limit: 20, windowSeconds: 600 } }, async (request) => {
  const requesterUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, requesterUserId);

  const [requester, target] = await Promise.all([
    getUserProfile(requesterUserId),
    getUserProfile(targetUserId),
  ]);
  const friendshipId = buildPairId(requesterUserId, targetUserId);
  const friendshipRef = friendshipDocument(requesterUserId, targetUserId);
  const requesterBlockRef = blockedDriverDocument(requesterUserId, targetUserId);
  const targetBlockRef = blockedDriverDocument(targetUserId, requesterUserId);

  const outcome = await db.runTransaction(async (transaction) => {
    const [existing, requesterBlock, targetBlock] = await Promise.all([
      transaction.get(friendshipRef),
      transaction.get(requesterBlockRef),
      transaction.get(targetBlockRef),
    ]);
    if (requesterBlock.exists || targetBlock.exists) {
      throw new HttpsError("permission-denied", "A friendship request cannot be created for this driver.");
    }
    if (existing.exists) {
      const friendship = existing.data();
      if (Array.isArray(friendship.participantIds)) {
        throw new HttpsError("already-exists", "Friendship request already exists.");
      }

      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      const migration = buildFriendshipMigrationDocument({
        friendship,
        leftProfile: requester,
        rightProfile: target,
        timestamp,
      });
      if (!migration) {
        throw new HttpsError("failed-precondition", "Legacy friendship data could not be upgraded safely.");
      }
      transaction.set(friendshipRef, migration, { merge: true });
      writeNotification(transaction, targetUserId, `friend-request-${friendshipId}`, {
        type: "friend-request",
        title: "Yeni arkadaslik istegi",
        body: `${requester.fullName ?? requester.plate} seni arkadas olarak eklemek istiyor.`,
        actor: requester,
        action: { type: "social", targetId: requesterUserId },
      }, timestamp);
      return "migrated";
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(friendshipRef, buildFriendshipDocument({ requester, target, timestamp }));
    writeNotification(transaction, targetUserId, `friend-request-${friendshipId}`, {
      type: "friend-request",
      title: "Yeni arkadaslik istegi",
      body: `${requester.fullName ?? requester.plate} seni arkadas olarak eklemek istiyor.`,
      actor: requester,
      action: { type: "social", targetId: requesterUserId },
    }, timestamp);
    return "created";
  });

  return { ok: true, friendshipId, migrated: outcome === "migrated" };
});

exports.searchDriverByPlate = secureCall("searchDriverByPlate", { rateLimit: { limit: 12, windowSeconds: 600 } }, async (request) => {
  const actorUserId = requireAuth(request);
  const plateNormalized = normalizePlate(request.data?.plate);
  if (plateNormalized.length < 5 || plateNormalized.length > 12) {
    throw new HttpsError("invalid-argument", "Enter a complete vehicle plate.");
  }

  const claimSnapshot = await publicDocument("plateClaims", plateNormalized).get();
  if (!claimSnapshot.exists) return { ok: true, driver: null };
  const targetUserId = claimSnapshot.data().uid;
  if (!targetUserId || targetUserId === actorUserId) return { ok: true, driver: null };

  const [targetSnapshot, actorBlockSnapshot, targetBlockSnapshot] = await Promise.all([
    privateUserDocument(targetUserId, "profile", "current").get(),
    blockedDriverDocument(actorUserId, targetUserId).get(),
    blockedDriverDocument(targetUserId, actorUserId).get(),
  ]);
  if (!targetSnapshot.exists || actorBlockSnapshot.exists || targetBlockSnapshot.exists) {
    return { ok: true, driver: null };
  }
  const target = targetSnapshot.data();
  const privacy = normalizePrivacySettings(target.privacy);
  if (!privacy.plateSearchEnabled) return { ok: true, driver: null };

  return { ok: true, driver: projectPlateSearchResult(target, targetUserId) };
});

exports.getPublicDriverProfile = secureCall("getPublicDriverProfile", { rateLimit: { limit: 60, windowSeconds: 600 } }, async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = String(request.data?.targetUserId ?? "");
  if (!targetUserId || targetUserId.length > 128 || targetUserId.includes("/")) {
    throw new HttpsError("invalid-argument", "A valid targetUserId is required.");
  }

  const [actorSnapshot, targetSnapshot, actorBlockSnapshot, targetBlockSnapshot] = await Promise.all([
    privateUserDocument(actorUserId, "profile", "current").get(),
    privateUserDocument(targetUserId, "profile", "current").get(),
    blockedDriverDocument(actorUserId, targetUserId).get(),
    blockedDriverDocument(targetUserId, actorUserId).get(),
  ]);
  if (!targetSnapshot.exists || actorBlockSnapshot.exists || targetBlockSnapshot.exists) {
    return { ok: true, driver: null };
  }

  const actor = actorSnapshot.exists ? actorSnapshot.data() : {};
  const target = targetSnapshot.data();
  let relation = actorUserId === targetUserId ? PROFILE_RELATIONS.SELF : PROFILE_RELATIONS.STRANGER;

  if (relation === PROFILE_RELATIONS.STRANGER) {
    const friendshipSnapshot = await friendshipDocument(actorUserId, targetUserId).get();
    if (friendshipSnapshot.exists && friendshipSnapshot.data().status === "accepted") {
      relation = PROFILE_RELATIONS.FRIEND;
    } else if (actor.clanId && actor.clanId === target.clanId) {
      relation = PROFILE_RELATIONS.CLAN;
    }
  }

  const convoyId = String(request.data?.context?.convoyId ?? "");
  if (relation === PROFILE_RELATIONS.STRANGER && convoyId && convoyId.length <= 128 && !convoyId.includes("/")) {
    const [actorMember, targetMember] = await Promise.all([
      publicDocument("convoyMembers", buildScopedMemberId(convoyId, actorUserId)).get(),
      publicDocument("convoyMembers", buildScopedMemberId(convoyId, targetUserId)).get(),
    ]);
    if (
      actorMember.exists && actorMember.data().membershipStatus === "approved" &&
      targetMember.exists && targetMember.data().membershipStatus === "approved"
    ) {
      relation = PROFILE_RELATIONS.CONVOY;
    }
  }

  return {
    ok: true,
    driver: projectPublicProfileForViewer(target, relation, targetUserId),
  };
});

exports.updatePrivacySettings = secureCall("updatePrivacySettings", async (request) => {
  const userId = requireAuth(request);
  const privacy = normalizePrivacySettings(request.data?.privacy);
  const profileRef = privateUserDocument(userId, "profile", "current");
  const existingProfile = await profileRef.get();
  requireSnapshot(existingProfile, "not-found", "User profile not found.");
  const existingConsent = existingProfile.data().privacyConsent ?? null;
  const consentIsActive = Boolean(existingConsent?.kvkkAcceptedAt && !existingConsent?.withdrawnAt);
  const needsConsent = privacy.plateSearchEnabled ||
    privacy.showPlateOnLiveMap ||
    privacy.locationPrecision !== "hidden" ||
    privacy.safeZoneEnabled;
  if (needsConsent && request.data?.acceptKvkk !== true && !consentIsActive) {
    throw new HttpsError("failed-precondition", "Accept the privacy notice before enabling discovery or location features.");
  }
  const privacyConsent = request.data?.acceptKvkk === true
    ? { version: privacy.kvkkConsentVersion, kvkkAcceptedAt: admin.firestore.FieldValue.serverTimestamp() }
    : null;
  const patch = { privacy, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (privacyConsent) patch.privacyConsent = privacyConsent;
  await profileRef.set(patch, { merge: true });
  return {
    ok: true,
    privacy,
    privacyConsent: privacyConsent
      ? { version: privacy.kvkkConsentVersion, kvkkAcceptedAt: Date.now() }
      : existingConsent,
  };
});

const ACCOUNT_EXPORT_COLLECTIONS = Object.freeze([
  "profile",
  "vehicles",
  "vehiclePassports",
  "vehiclePassportExports",
  "serviceLogs",
  "fuelLogs",
  "parts",
  "driverStats",
  "driveSessions",
  "notifications",
  "blockedUsers",
  "moderation",
]);

async function exportPrivateCollection(userId, collectionName) {
  const snapshot = await privateUserCollection(userId, collectionName).limit(500).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

exports.exportMyData = secureCall("exportMyData", { rateLimit: { limit: 3, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  const [privateCollections, friendships, clanMemberships, convoyMemberships] = await Promise.all([
    Promise.all(ACCOUNT_EXPORT_COLLECTIONS.map(async (name) => [name, await exportPrivateCollection(userId, name)])),
    publicCollection("friendships").where("participantIds", "array-contains", userId).limit(500).get(),
    publicCollection("clanMembers").where("userId", "==", userId).limit(100).get(),
    publicCollection("convoyMembers").where("userId", "==", userId).limit(500).get(),
  ]);
  const collections = Object.fromEntries(privateCollections);
  const profile = collections.profile?.find((item) => item.id === "current") ?? null;
  delete collections.profile;
  return buildAccountExport({
    userId,
    profile,
    collections,
    social: {
      friendships: friendships.docs.map((document) => ({ id: document.id, ...document.data() })),
      clanMemberships: clanMemberships.docs.map((document) => ({ id: document.id, ...document.data() })),
      convoyMemberships: convoyMemberships.docs.map((document) => ({ id: document.id, ...document.data() })),
    },
    exportedAt: new Date().toISOString(),
  });
});

exports.withdrawPrivacyConsent = secureCall("withdrawPrivacyConsent", async (request) => {
  const userId = requireAuth(request);
  const profileRef = privateUserDocument(userId, "profile", "current");
  const snapshot = await profileRef.get();
  const profile = requireSnapshot(snapshot, "not-found", "User profile not found.");
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const privacy = buildWithdrawnPrivacySettings(normalizePrivacySettings(profile.privacy));
  await profileRef.set({
    privacy,
    privacyConsent: {
      version: profile.privacyConsent?.version ?? privacy.kvkkConsentVersion,
      kvkkAcceptedAt: profile.privacyConsent?.kvkkAcceptedAt ?? null,
      withdrawnAt: timestamp,
    },
    updatedAt: timestamp,
  }, { merge: true });
  await realtimeDb.ref(`artifacts/${APP_ID}/realtime/telemetry/${userId}`).remove();
  return { ok: true, privacy, withdrawnAt: Date.now() };
});

async function queryDocuments(collectionName, field, operator, value) {
  const snapshot = await publicCollection(collectionName).where(field, operator, value).limit(500).get();
  return snapshot.docs;
}

exports.deleteMyAccount = secureCall("deleteMyAccount", { rateLimit: { limit: 3, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  try {
    requireDeletionConfirmation(request.data?.confirmation);
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  if (!hasRecentAuthentication(request.auth?.token?.auth_time)) {
    throw new HttpsError("failed-precondition", "Sign in again before deleting your account.");
  }

  const profileSnapshot = await privateUserDocument(userId, "profile", "current").get();
  const profile = requireSnapshot(profileSnapshot, "not-found", "User profile not found.");
  if (profile.clanRole === "owner") {
    throw new HttpsError("failed-precondition", "Transfer or close your clan before deleting your account.");
  }
  const hostedConvoys = await publicCollection("convoys").where("hostUserId", "==", userId).limit(100).get();
  if (hostedConvoys.docs.some((document) => !["completed", "cancelled"].includes(document.data().lifecycleStatus))) {
    throw new HttpsError("failed-precondition", "Complete or cancel your active convoys before deleting your account.");
  }

  const querySpecs = [
    ["friendships", "participantIds", "array-contains", userId],
    ["clanInvites", "targetUserId", "==", userId],
    ["clanInvites", "invitedByUserId", "==", userId],
    ["clanMembers", "userId", "==", userId],
    ["convoyMembers", "userId", "==", userId],
    ["convoyRatings", "actorUserId", "==", userId],
    ["convoyRatings", "targetUserId", "==", userId],
    ["mapLikes", "userId", "==", userId],
    ["mapSpotPhotos", "userId", "==", userId],
    ["moderationReports", "reporterUserId", "==", userId],
    ["individualLeaderboard", "userId", "==", userId],
  ];
  const queryResults = await Promise.all(querySpecs.map((spec) => queryDocuments(...spec)));
  const documentsToDelete = new Map();
  queryResults.flat().forEach((document) => documentsToDelete.set(document.ref.path, document));
  const spotPhotos = queryResults[8];

  const [authoredPins, authoredConvoys] = await Promise.all([
    queryDocuments("mapPins", "createdByUid", "==", userId),
    queryDocuments("convoys", "hostUserId", "==", userId),
  ]);
  const bulkWriter = db.bulkWriter();
  documentsToDelete.forEach((document) => bulkWriter.delete(document.ref));
  authoredPins.forEach((document) => bulkWriter.update(document.ref, {
    createdByUid: "deleted",
    createdByPlate: "",
    createdByName: "Deleted Driver",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }));
  authoredConvoys.forEach((document) => bulkWriter.update(document.ref, {
    hostUserId: "deleted",
    createdByUid: "deleted",
    createdByPlate: "",
    createdByName: "Deleted Driver",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }));
  bulkWriter.delete(publicDocument("publicProfiles", userId));
  if (profile.plateNormalized) {
    const claimRef = publicDocument("plateClaims", profile.plateNormalized);
    const claim = await claimRef.get();
    if (claim.exists && claim.data().uid === userId) bulkWriter.delete(claimRef);
  }
  await bulkWriter.close();

  const directMessageRoot = realtimeDb.ref(`artifacts/${APP_ID}/realtime/directMessages`);
  const userThreadsSnapshot = await directMessageRoot.child(`userThreads/${userId}`).get();
  const realtimeUpdates = {
    [`artifacts/${APP_ID}/realtime/presence/${userId}`]: null,
    [`artifacts/${APP_ID}/realtime/telemetry/${userId}`]: null,
    [`artifacts/${APP_ID}/realtime/directMessages/userThreads/${userId}`]: null,
  };
  for (const threadId of Object.keys(userThreadsSnapshot.val() ?? {})) {
    const threadSnapshot = await directMessageRoot.child(`threads/${threadId}`).get();
    const participantIds = Object.keys(threadSnapshot.child("participantUids").val() ?? {});
    realtimeUpdates[`artifacts/${APP_ID}/realtime/directMessages/threads/${threadId}`] = null;
    participantIds.forEach((participantId) => {
      realtimeUpdates[`artifacts/${APP_ID}/realtime/directMessages/userThreads/${participantId}/${threadId}`] = null;
    });
  }
  await realtimeDb.ref().update(realtimeUpdates);

  const bucket = admin.storage().bucket();
  await Promise.allSettled([
    bucket.deleteFiles({ prefix: `artifacts/${APP_ID}/users/${userId}/avatars/` }),
    ...spotPhotos.map((document) => {
      const storagePath = document.data().storagePath;
      return storagePath ? bucket.file(storagePath).delete({ ignoreNotFound: true }) : Promise.resolve();
    }),
  ]);
  await db.recursiveDelete(db.doc(`artifacts/${APP_ID}/users/${userId}`));
  await admin.auth().deleteUser(userId);
  logger.info("account.deleted", { userId, sharedRecordsRemoved: documentsToDelete.size });
  return { ok: true, deleted: true };
});

exports.ensureDirectMessageThread = secureCall("ensureDirectMessageThread", async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  const state = await ensureDirectMessageThreadState(actorUserId, targetUserId);
  return { ok: true, threadId: state.threadId };
});

exports.sendDirectMessage = secureCall("sendDirectMessage", { rateLimit: { limit: 60, windowSeconds: 60 } }, async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  let body;
  try {
    body = sanitizeMessageBody(request.data?.body);
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  const state = await ensureDirectMessageThreadState(actorUserId, targetUserId);
  const messageRef = realtimeDb.ref(`${state.rootPath}/threads/${state.threadId}/messages`).push();
  const timestamp = Date.now();
  const message = buildDirectMessage({ messageId: messageRef.key, senderProfile: state.actor, body, timestamp });
  await realtimeDb.ref(state.rootPath).update({
    [`threads/${state.threadId}/messages/${message.id}`]: message,
    [`threads/${state.threadId}/lastMessage`]: message,
    [`threads/${state.threadId}/updatedAt`]: timestamp,
    [`threads/${state.threadId}/readBy/${actorUserId}`]: timestamp,
    [`userThreads/${actorUserId}/${state.threadId}/updatedAt`]: timestamp,
    [`userThreads/${targetUserId}/${state.threadId}/updatedAt`]: timestamp,
  });
  const notificationTimestamp = admin.firestore.FieldValue.serverTimestamp();
  await privateUserDocument(targetUserId, "notifications", `message-${message.id}`).set(
    buildNotificationDocument({
      id: `message-${message.id}`,
      userId: targetUserId,
      type: "direct-message",
      title: "Yeni mesaj",
      body: `${state.actor.fullName ?? state.actor.plate} sana bir mesaj gonderdi.`,
      actor: state.actor,
      action: { type: "conversation", targetId: actorUserId },
      timestamp: notificationTimestamp,
    }),
  );
  return { ok: true, threadId: state.threadId, messageId: message.id, createdAt: timestamp };
});

exports.respondFriendship = secureCall("respondFriendship", async (request) => {
  const actorUserId = requireAuth(request);
  const requesterUserId = requireTargetUserId(request, actorUserId);
  const actor = await getUserProfile(actorUserId);
  const decision = request.data?.decision;
  if (!["accepted", "declined"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Decision must be accepted or declined.");
  }

  const friendshipRef = friendshipDocument(actorUserId, requesterUserId);
  const actorBlockRef = blockedDriverDocument(actorUserId, requesterUserId);
  const requesterBlockRef = blockedDriverDocument(requesterUserId, actorUserId);

  await db.runTransaction(async (transaction) => {
    const [friendshipSnapshot, actorBlock, requesterBlock] = await Promise.all([
      transaction.get(friendshipRef),
      transaction.get(actorBlockRef),
      transaction.get(requesterBlockRef),
    ]);
    const friendship = requireSnapshot(friendshipSnapshot, "not-found", "Friendship request not found.");
    if (
      friendship.status !== "pending" ||
      friendship.targetUserId !== actorUserId ||
      friendship.requesterUserId !== requesterUserId
    ) {
      throw new HttpsError("permission-denied", "Only the request recipient can respond.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    writeNotification(transaction, requesterUserId, `friend-response-${friendshipRef.id}`, {
      type: "friend-response",
      title: decision === "accepted" ? "Arkadaslik istegi kabul edildi" : "Arkadaslik istegi reddedildi",
      body: `${actor.fullName ?? actor.plate} arkadaslik istegine yanit verdi.`,
      actor,
      action: { type: "social", targetId: actorUserId },
    }, timestamp);
    if (decision === "declined") {
      transaction.delete(friendshipRef);
      return;
    }
    if (actorBlock.exists || requesterBlock.exists) {
      throw new HttpsError("permission-denied", "A blocked friendship request cannot be accepted.");
    }

    transaction.update(friendshipRef, {
      status: "accepted",
      acceptedAt: timestamp,
      updatedAt: timestamp,
    });
  });

  return { ok: true, friendshipId: friendshipRef.id, decision };
});

exports.cancelFriendshipRequest = secureCall("cancelFriendshipRequest", async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  const friendshipRef = friendshipDocument(actorUserId, targetUserId);

  await db.runTransaction(async (transaction) => {
    const friendshipSnapshot = await transaction.get(friendshipRef);
    const friendship = requireSnapshot(friendshipSnapshot, "not-found", "Friendship request not found.");
    if (friendship.status !== "pending" || friendship.requesterUserId !== actorUserId) {
      throw new HttpsError("permission-denied", "Only the requester can cancel this request.");
    }
    transaction.delete(friendshipRef);
  });

  return { ok: true, friendshipId: friendshipRef.id };
});

exports.removeFriendship = secureCall("removeFriendship", async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  const friendshipRef = friendshipDocument(actorUserId, targetUserId);

  await db.runTransaction(async (transaction) => {
    const friendshipSnapshot = await transaction.get(friendshipRef);
    const friendship = requireSnapshot(friendshipSnapshot, "not-found", "Friendship not found.");
    if (
      friendship.status !== "accepted" ||
      !(friendship.participantIds ?? []).includes(actorUserId)
    ) {
      throw new HttpsError("permission-denied", "Only friendship participants can remove this connection.");
    }
    transaction.delete(friendshipRef);
  });

  return { ok: true, friendshipId: friendshipRef.id };
});

exports.blockDriver = secureCall("blockDriver", async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  const target = await getUserProfile(targetUserId);
  const blockRef = blockedDriverDocument(actorUserId, targetUserId);
  const friendshipRef = friendshipDocument(actorUserId, targetUserId);

  await db.runTransaction(async (transaction) => {
    const friendshipSnapshot = await transaction.get(friendshipRef);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(
      blockRef,
      buildBlockedDriverDocument({ ownerUserId: actorUserId, target, timestamp }),
      { merge: true },
    );
    if (friendshipSnapshot.exists) {
      transaction.delete(friendshipRef);
    }
  });

  return { ok: true, targetUserId };
});

exports.unblockDriver = secureCall("unblockDriver", async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  await blockedDriverDocument(actorUserId, targetUserId).delete();
  return { ok: true, targetUserId };
});

exports.createConvoy = secureCall("createConvoy", { rateLimit: { limit: 10, windowSeconds: 3600 } }, async (request) => {
  const hostUserId = requireAuth(request);
  const host = await getUserProfile(hostUserId);
  const pin = request.data?.pin ?? request.data;
  const inviteUserIds = Array.from(new Set((pin?.invitedGuests ?? []).map((guest) => String(guest?.userId ?? "")).filter(Boolean))).slice(0, 20);
  const inviteProfiles = [];
  for (const targetUserId of inviteUserIds) {
    const friendship = await friendshipDocument(hostUserId, targetUserId).get();
    if (friendship.exists && friendship.data().status === "accepted") inviteProfiles.push(await getUserProfile(targetUserId));
  }
  const convoyRef = publicCollection("convoys").doc();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  let convoy;
  try {
    convoy = buildConvoyDocument({ convoyId: convoyRef.id, pin, host, invitedProfiles: inviteProfiles, timestamp });
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  const batch = db.batch();
  batch.set(convoyRef, convoy);
  batch.set(publicDocument("convoyMembers", buildScopedMemberId(convoy.id, hostUserId)), buildConvoyMemberDocument({ convoy, profile: host, timestamp }));
  if (convoy.visibility === "public") batch.set(publicDocument("mapPins", convoy.id), buildPublicMapSummary(convoy));
  await batch.commit();
  return { ok: true, convoyId: convoy.id };
});

exports.listAccessibleConvoys = secureCall("listAccessibleConvoys", async (request) => {
  const userId = requireAuth(request);
  await migrateLegacyConvoyPins();
  const profile = await getUserProfile(userId);
  const [convoysSnapshot, membersSnapshot, friendshipsSnapshot] = await Promise.all([
    publicCollection("convoys").get(),
    publicCollection("convoyMembers").get(),
    publicCollection("friendships").where("participantIds", "array-contains", userId).get(),
  ]);
  const friendUserIds = new Set(friendshipsSnapshot.docs
    .filter((item) => item.data().status === "accepted")
    .flatMap((item) => item.data().participantIds ?? [])
    .filter((id) => id !== userId));
  const membersByConvoy = new Map();
  membersSnapshot.docs.forEach((item) => {
    const member = item.data();
    membersByConvoy.set(member.convoyId, [...(membersByConvoy.get(member.convoyId) ?? []), member]);
  });
  const convoys = convoysSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })).flatMap((convoy) => {
    const members = membersByConvoy.get(convoy.id) ?? [];
    const membership = members.find((member) => member.userId === userId) ?? null;
    return canSeeConvoy(convoy, profile, friendUserIds, membership)
      ? [presentConvoy(convoy, profile, membership, members)]
      : [];
  });
  return { ok: true, convoys };
});

exports.advanceScheduledConvoys = onSchedule({ schedule: "every 1 minutes", timeZone: "Europe/Istanbul" }, async () => {
  const nowMs = Date.now();
  const snapshot = await publicCollection("convoys").where("lifecycleStatus", "==", "planning").limit(400).get();
  const dueConvoys = snapshot.docs
    .map((document) => ({ id: document.id, ref: document.ref, ...document.data() }))
    .filter((convoy) => Number(convoy.scheduledStartAtMs ?? 0) > 0 && Number(convoy.scheduledStartAtMs) <= nowMs);
  if (!dueConvoys.length) return;

  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  dueConvoys.forEach((convoy) => {
    const updated = { ...convoy, lifecycleStatus: "rolling", startedAt: timestamp, updatedAt: timestamp };
    batch.update(convoy.ref, { lifecycleStatus: "rolling", startedAt: timestamp, updatedAt: timestamp });
    if (convoy.visibility === "public") {
      batch.set(publicDocument("mapPins", convoy.id), buildPublicMapSummary(updated), { merge: true });
    }
  });
  await batch.commit();
  await Promise.all(dueConvoys.map(async (convoy) => {
    const members = await publicCollection("convoyMembers").where("convoyId", "==", convoy.id).get();
    const notificationBatch = db.batch();
    members.docs
      .map((document) => document.data())
      .filter((member) => member.membershipStatus === "approved" && member.tripStatus !== "cancelled")
      .forEach((member) => writeNotification(notificationBatch, member.userId, `convoy-started-${convoy.id}`, {
        type: "convoy-started",
        title: "Konvoy basladi",
        body: `${convoy.name} icin GPS konvoy takibi aktif.`,
        actor: { userId: convoy.hostUserId, fullName: convoy.createdByName, plate: convoy.createdByPlate },
        action: { type: "convoy", targetId: convoy.id },
      }, timestamp));
    if (!members.empty) await notificationBatch.commit();
  }));
  logger.info("Scheduled convoys advanced", { count: dueConvoys.length });
});

exports.syncConvoyLocation = secureCall("syncConvoyLocation", { rateLimit: { limit: 600, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  const { convoyId } = request.data ?? {};
  const lat = Number(request.data?.lat);
  const lng = Number(request.data?.lng);
  const reportedAccuracy = Number(request.data?.accuracy ?? 0);
  const accuracy = Number.isFinite(reportedAccuracy) ? Math.max(0, Math.min(500, reportedAccuracy)) : 0;
  if (!convoyId || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    throw new HttpsError("invalid-argument", "A valid convoy and GPS location are required.");
  }

  const convoyRef = publicDocument("convoys", convoyId);
  const memberRef = publicDocument("convoyMembers", buildScopedMemberId(convoyId, userId));
  const membersQuery = publicCollection("convoyMembers").where("convoyId", "==", convoyId);
  const nowMs = Date.now();
  const result = await db.runTransaction(async (transaction) => {
    const [convoySnapshot, memberSnapshot, membersSnapshot] = await Promise.all([
      transaction.get(convoyRef),
      transaction.get(memberRef),
      transaction.get(membersQuery),
    ]);
    const convoy = requireSnapshot(convoySnapshot, "not-found", "Convoy not found.");
    const member = requireSnapshot(memberSnapshot, "not-found", "Convoy membership not found.");
    if (member.membershipStatus !== "approved" || member.tripStatus === "cancelled") {
      throw new HttpsError("permission-denied", "Only active approved convoy members can share convoy GPS.");
    }

    let locationUpdate;
    try {
      locationUpdate = resolveConvoyLocationUpdate(convoy, { lat, lng, accuracy }, nowMs, member);
    } catch (error) {
      throw new HttpsError("failed-precondition", error.message);
    }
    if (locationUpdate.lifecycleStatus === "planning") return { ...locationUpdate, convoyId };

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const memberPatch = {
      tripStatus: locationUpdate.tripStatus,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      accuracy,
      distanceToDestinationM: locationUpdate.distanceToDestinationM,
      arrivalConfirmationCount: locationUpdate.arrivalConfirmationCount,
      arrivalVerificationStatus: locationUpdate.tripStatus === "arrived"
        ? "confirmed"
        : locationUpdate.awaitingAccuracy
          ? "low-accuracy"
          : locationUpdate.arrivalConfirmationCount > 0
            ? "verifying"
            : "tracking",
      trackingStatus: "active",
      lastLocationAt: timestamp,
      updatedAt: timestamp,
    };
    transaction.update(memberRef, memberPatch);

    const activeMembers = membersSnapshot.docs
      .map((document) => document.id === memberRef.id ? { ...document.data(), ...memberPatch } : document.data())
      .filter((entry) => entry.membershipStatus === "approved" && entry.tripStatus !== "cancelled");
    const allArrived = activeMembers.length > 0 && activeMembers.every((entry) => entry.tripStatus === "arrived");
    const lifecycleStatus = allArrived ? "completed" : locationUpdate.lifecycleStatus;
    const convoyPatch = {
      lifecycleStatus,
      ...(convoy.lifecycleStatus === "planning" ? { startedAt: timestamp } : {}),
      ...(allArrived ? { completedAt: timestamp } : {}),
      updatedAt: timestamp,
    };
    transaction.update(convoyRef, convoyPatch);
    if (convoy.visibility === "public") {
      transaction.set(publicDocument("mapPins", convoyId), buildPublicMapSummary({ ...convoy, ...convoyPatch }), { merge: true });
    }
    if (convoy.lifecycleStatus === "planning") {
      activeMembers.forEach((entry) => writeNotification(transaction, entry.userId, `convoy-started-${convoyId}`, {
        type: "convoy-started",
        title: "Konvoy basladi",
        body: `${convoy.name} icin GPS konvoy takibi aktif.`,
        actor: { userId: convoy.hostUserId, fullName: convoy.createdByName, plate: convoy.createdByPlate },
        action: { type: "convoy", targetId: convoyId },
      }, timestamp));
    }
    if (allArrived) {
      activeMembers.forEach((entry) => writeNotification(transaction, entry.userId, `convoy-completed-${convoyId}`, {
        type: "convoy-completed",
        title: "Konvoy tamamlandi",
        body: `${convoy.name} tamamlandi. Surucu oylamasi acildi.`,
        actor: { userId: convoy.hostUserId, fullName: convoy.createdByName, plate: convoy.createdByPlate },
        action: { type: "convoy", targetId: convoyId },
      }, timestamp));
    }
    return {
      ok: true,
      convoyId,
      lifecycleStatus,
      tripStatus: locationUpdate.tripStatus,
      distanceToDestinationM: locationUpdate.distanceToDestinationM,
      arrivalRadiusM: locationUpdate.arrivalRadiusM,
      arrivalConfirmationCount: locationUpdate.arrivalConfirmationCount,
      arrivalConfirmationRequired: locationUpdate.arrivalConfirmationRequired,
      awaitingAccuracy: locationUpdate.awaitingAccuracy,
      completed: allArrived,
    };
  });

  return { ok: true, ...result };
});

exports.requestConvoyJoin = secureCall("requestConvoyJoin", { rateLimit: { limit: 30, windowSeconds: 3600 } }, async (request) => {
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
    if (existingMember.exists && ["approved", "pending"].includes(existingMember.data().membershipStatus)) {
      throw new HttpsError("already-exists", "User is already part of this convoy flow.");
    }

    const convoy = convoySnapshot.data();
    if (convoy.lifecycleStatus !== "planning") throw new HttpsError("failed-precondition", "This convoy no longer accepts drivers.");
    if (Number(convoy.approvedCount ?? 0) >= Number(convoy.capacity ?? 0)) throw new HttpsError("resource-exhausted", "Convoy capacity is full.");
    const friendSnapshot = await transaction.get(friendshipDocument(requesterUserId, convoy.hostUserId));
    const friendIds = new Set(friendSnapshot.exists && friendSnapshot.data().status === "accepted" ? [convoy.hostUserId] : []);
    if (!canSeeConvoy(convoy, requester, friendIds, null)) throw new HttpsError("permission-denied", "This convoy is not visible to your account.");
    assertConvoyTrust(convoy, requester);
    const invited = (convoy.invitedUserIds ?? []).includes(requesterUserId);
    const status = invited || convoy.accessPolicy === "open" ? "approved" : "pending";
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(memberRef, buildConvoyMemberDocument({ convoy, profile: requester, status, timestamp }));
    transaction.update(convoyRef, {
      [status === "approved" ? "approvedCount" : "pendingCount"]: admin.firestore.FieldValue.increment(1),
      updatedAt: timestamp,
    });
    writeNotification(transaction, convoy.hostUserId, `convoy-join-${convoyId}-${requesterUserId}`, {
      type: "convoy-join",
      title: status === "pending" ? "Yeni konvoy katilim istegi" : "Konvoya yeni katilim",
      body: `${requester.fullName ?? requester.plate} konvoyuna katilmak istiyor.`,
      actor: requester,
      action: { type: "convoy", targetId: convoyId },
    }, timestamp);
  });

  return { ok: true, convoyId };
});

exports.respondConvoyJoinRequest = secureCall("respondConvoyJoinRequest", async (request) => {
  const actorUserId = requireAuth(request);
  const actor = await getUserProfile(actorUserId);
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
    if (!memberSnapshot.exists || memberSnapshot.data().membershipStatus !== "pending") {
      throw new HttpsError("not-found", "Member request not found.");
    }
    const convoy = convoySnapshot.data();
    if (decision === "approved" && Number(convoy.approvedCount ?? 0) >= Number(convoy.capacity ?? 0)) {
      throw new HttpsError("resource-exhausted", "Convoy capacity is full.");
    }
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    if (decision === "declined") transaction.delete(memberRef);
    else transaction.update(memberRef, { membershipStatus: "approved", reviewedByUserId: actorUserId, updatedAt: timestamp });
    transaction.update(convoyRef, {
      pendingCount: admin.firestore.FieldValue.increment(-1),
      ...(decision === "approved" ? { approvedCount: admin.firestore.FieldValue.increment(1) } : {}),
      updatedAt: timestamp,
    });
    writeNotification(transaction, memberUserId, `convoy-response-${convoyId}-${memberUserId}`, {
      type: "convoy-response",
      title: decision === "approved" ? "Konvoy istegin kabul edildi" : "Konvoy istegin reddedildi",
      body: `${actor.fullName ?? actor.plate} konvoy katilim istegine yanit verdi.`,
      actor,
      action: { type: "convoy", targetId: convoyId },
    }, timestamp);
  });

  return { ok: true, convoyId, memberUserId, decision };
});

exports.removeConvoyMember = secureCall("removeConvoyMember", { rateLimit: { limit: 50, windowSeconds: 3600 } }, async (request) => {
  const actorUserId = requireAuth(request);
  const { convoyId, memberUserId } = request.data ?? {};
  if (!convoyId || !memberUserId || memberUserId === actorUserId) {
    throw new HttpsError("invalid-argument", "A valid removable convoy member is required.");
  }
  const actor = await getUserProfile(actorUserId);
  const convoyRef = publicDocument("convoys", convoyId);
  const memberRef = publicDocument("convoyMembers", buildScopedMemberId(convoyId, memberUserId));
  await db.runTransaction(async (transaction) => {
    const [convoySnapshot, memberSnapshot] = await Promise.all([
      transaction.get(convoyRef),
      transaction.get(memberRef),
    ]);
    const convoy = requireSnapshot(convoySnapshot, "not-found", "Convoy not found.");
    const member = requireSnapshot(memberSnapshot, "not-found", "Convoy member not found.");
    if (convoy.hostUserId !== actorUserId) throw new HttpsError("permission-denied", "Only the host can remove convoy members.");
    if (["completed", "cancelled"].includes(convoy.lifecycleStatus)) throw new HttpsError("failed-precondition", "Closed convoys cannot change members.");
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.delete(memberRef);
    transaction.update(convoyRef, {
      [member.membershipStatus === "pending" ? "pendingCount" : "approvedCount"]: admin.firestore.FieldValue.increment(-1),
      invitedUserIds: admin.firestore.FieldValue.arrayRemove(memberUserId),
      invitedGuests: (convoy.invitedGuests ?? []).filter((guest) => guest.userId !== memberUserId),
      updatedAt: timestamp,
    });
    writeNotification(transaction, memberUserId, `convoy-removed-${convoyId}-${memberUserId}`, {
      type: "convoy-removed",
      title: "Konvoy katilimi sonlandirildi",
      body: `${convoy.name} hostu seni katilim listesinden cikardi.`,
      actor,
      action: { type: "convoy", targetId: convoyId },
    }, timestamp);
  });
  return { ok: true, convoyId, memberUserId };
});

exports.inviteConvoyMember = secureCall("inviteConvoyMember", { rateLimit: { limit: 30, windowSeconds: 3600 } }, async (request) => {
  const actorUserId = requireAuth(request);
  const { convoyId, targetUserId } = request.data ?? {};
  if (!convoyId || !targetUserId || targetUserId === actorUserId) throw new HttpsError("invalid-argument", "A valid convoy and driver are required.");
  const [actor, target, friendship] = await Promise.all([
    getUserProfile(actorUserId),
    getUserProfile(targetUserId),
    friendshipDocument(actorUserId, targetUserId).get(),
  ]);
  if (!friendship.exists || friendship.data().status !== "accepted") throw new HttpsError("permission-denied", "Only friends can be invited to a convoy.");
  const convoyRef = publicDocument("convoys", convoyId);
  await db.runTransaction(async (transaction) => {
    const convoySnapshot = await transaction.get(convoyRef);
    const convoy = requireSnapshot(convoySnapshot, "not-found", "Convoy not found.");
    if (convoy.hostUserId !== actorUserId) throw new HttpsError("permission-denied", "Only the host can invite drivers.");
    if (convoy.lifecycleStatus !== "planning") throw new HttpsError("failed-precondition", "Invites are closed for this convoy.");
    if ((convoy.invitedUserIds ?? []).includes(targetUserId)) return;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.update(convoyRef, {
      invitedUserIds: admin.firestore.FieldValue.arrayUnion(targetUserId),
      invitedGuests: [...(convoy.invitedGuests ?? []), projectDriver(target)],
      updatedAt: timestamp,
    });
    writeNotification(transaction, targetUserId, `convoy-invite-${convoyId}-${targetUserId}`, {
      type: "convoy-invite",
      title: "Konvoy daveti",
      body: `${actor.fullName ?? actor.plate} seni konvoyuna davet etti.`,
      actor,
      action: { type: "convoy", targetId: convoyId },
    }, timestamp);
  });
  return { ok: true, convoyId, targetUserId };
});

exports.updateConvoyLifecycle = secureCall("updateConvoyLifecycle", async (request) => {
  const actorUserId = requireAuth(request);
  const { convoyId, lifecycleStatus } = request.data ?? {};
  if (!convoyId || !LIFECYCLE_STATUSES.includes(lifecycleStatus)) throw new HttpsError("invalid-argument", "A valid convoy status is required.");
  const convoyRef = publicDocument("convoys", convoyId);
  await db.runTransaction(async (transaction) => {
    const [snapshot, membersSnapshot] = await Promise.all([
      transaction.get(convoyRef),
      transaction.get(publicCollection("convoyMembers").where("convoyId", "==", convoyId)),
    ]);
    const convoy = requireSnapshot(snapshot, "not-found", "Convoy not found.");
    if (convoy.hostUserId !== actorUserId) throw new HttpsError("permission-denied", "Only the host can update convoy status.");
    if (["completed", "cancelled"].includes(convoy.lifecycleStatus)) throw new HttpsError("failed-precondition", "Closed convoys cannot be reopened.");
    const allowedTransitions = {
      planning: new Set(["planning", "delayed", "cancelled"]),
      delayed: new Set(["planning", "delayed", "cancelled"]),
      rolling: new Set(["rolling", "delayed", "cancelled"]),
    };
    if (!allowedTransitions[convoy.lifecycleStatus]?.has(lifecycleStatus)) {
      throw new HttpsError("failed-precondition", "This convoy status transition is managed automatically.");
    }
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.update(convoyRef, { lifecycleStatus, updatedAt: timestamp });
    if (convoy.visibility === "public") transaction.set(publicDocument("mapPins", convoyId), buildPublicMapSummary({ ...convoy, lifecycleStatus, updatedAt: timestamp }), { merge: true });
    if (lifecycleStatus === "cancelled") {
      membersSnapshot.docs
        .map((document) => document.data())
        .filter((member) => member.membershipStatus === "approved")
        .forEach((member) => writeNotification(transaction, member.userId, `convoy-cancelled-${convoyId}`, {
          type: "convoy-cancelled",
          title: "Konvoy iptal edildi",
          body: `${convoy.name} host tarafindan iptal edildi.`,
          actor: { userId: convoy.hostUserId, fullName: convoy.createdByName, plate: convoy.createdByPlate },
          action: { type: "convoy", targetId: convoyId },
        }, timestamp));
    }
  });
  return { ok: true, convoyId, lifecycleStatus };
});

exports.updateConvoyTripStatus = secureCall("updateConvoyTripStatus", async (request) => {
  const userId = requireAuth(request);
  const { convoyId, tripStatus } = request.data ?? {};
  if (!convoyId || tripStatus !== "cancelled") {
    throw new HttpsError("invalid-argument", "Manual arrival updates are disabled; only convoy cancellation is allowed.");
  }
  const memberRef = publicDocument("convoyMembers", buildScopedMemberId(convoyId, userId));
  const member = requireSnapshot(await memberRef.get(), "not-found", "Convoy membership not found.");
  if (member.membershipStatus !== "approved") throw new HttpsError("permission-denied", "Only approved convoy members can update trip status.");
  await memberRef.update({ tripStatus, arrivalConfirmationCount: 0, trackingStatus: "inactive", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { ok: true, convoyId, tripStatus };
});

exports.rateConvoyMember = secureCall("rateConvoyMember", { rateLimit: { limit: 40, windowSeconds: 3600 } }, async (request) => {
  const actorUserId = requireAuth(request);
  const { convoyId, targetUserId, signal } = request.data ?? {};
  if (!convoyId || !targetUserId || targetUserId === actorUserId || !["harmony", "alert"].includes(signal)) {
    throw new HttpsError("invalid-argument", "A valid convoy rating is required.");
  }
  const convoyRef = publicDocument("convoys", convoyId);
  const actorMemberRef = publicDocument("convoyMembers", buildScopedMemberId(convoyId, actorUserId));
  const targetMemberRef = publicDocument("convoyMembers", buildScopedMemberId(convoyId, targetUserId));
  const ratingRef = publicDocument("convoyRatings", `${convoyId}__${actorUserId}__${targetUserId}`);
  const targetPrivateRef = privateUserDocument(targetUserId, "profile", "current");
  const targetPublicRef = publicDocument("publicProfiles", targetUserId);
  await db.runTransaction(async (transaction) => {
    const [convoySnapshot, actorMember, targetMember, existingRating, targetProfileSnapshot] = await Promise.all([
      transaction.get(convoyRef), transaction.get(actorMemberRef), transaction.get(targetMemberRef), transaction.get(ratingRef), transaction.get(targetPrivateRef),
    ]);
    const convoy = requireSnapshot(convoySnapshot, "not-found", "Convoy not found.");
    if (convoy.lifecycleStatus !== "completed") throw new HttpsError("failed-precondition", "Ratings open after the convoy is completed.");
    if (!actorMember.exists || actorMember.data().membershipStatus !== "approved" || !targetMember.exists || targetMember.data().membershipStatus !== "approved") {
      throw new HttpsError("permission-denied", "Only approved participants can rate each other.");
    }
    if (existingRating.exists) throw new HttpsError("already-exists", "You already rated this driver for this convoy.");
    const profile = requireSnapshot(targetProfileSnapshot, "not-found", "Driver profile not found.");
    const scoreDelta = signal === "harmony" ? 3 : -8;
    const nextScore = Math.min(100, Math.max(0, Number(profile.driverScore ?? 0) + scoreDelta));
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const reputationPatch = {
      driverScore: nextScore,
      harmonyVotes: Number(profile.harmonyVotes ?? 0) + (signal === "harmony" ? 1 : 0),
      alertVotes: Number(profile.alertVotes ?? 0) + (signal === "alert" ? 1 : 0),
      updatedAt: timestamp,
    };
    const standing = reputationPatch.alertVotes > 2 || nextScore < 55
      ? "Watchlist"
      : reputationPatch.harmonyVotes >= 5 || nextScore >= 85 ? "Uyumlu" : "Convoy Ready";
    transaction.set(ratingRef, {
      id: ratingRef.id,
      convoyId,
      actorUserId,
      targetUserId,
      signal,
      scoreDeltaApplied: nextScore - Number(profile.driverScore ?? 0),
      harmonyDelta: signal === "harmony" ? 1 : 0,
      alertDelta: signal === "alert" ? 1 : 0,
      createdAt: timestamp,
    });
    transaction.set(targetPrivateRef, reputationPatch, { merge: true });
    transaction.set(targetPublicRef, reputationPatch, { merge: true });
    transaction.update(targetMemberRef, { score: nextScore, status: standing, ...reputationPatch });
  });
  return { ok: true, convoyId, targetUserId, signal };
});

exports.createClan = secureCall("createClan", { rateLimit: { limit: 3, windowSeconds: 86400 } }, async (request) => {
  const ownerUserId = requireAuth(request);
  const { name, tag, description } = request.data ?? {};
  const identity = assertClanIdentity(name, tag);
  const owner = await getUserProfile(ownerUserId);
  if (owner.clanId) {
    throw new HttpsError("failed-precondition", "Leave your current clan before creating a new one.");
  }

  const clanRef = publicCollection("clans").doc();
  const nameClaimRef = publicDocument("clanNameClaims", normalizeClanName(identity.name));
  const tagClaimRef = publicDocument("clanTagClaims", identity.tag.toLowerCase());
  const memberRef = clanMemberDocument(clanRef.id, ownerUserId);

  await db.runTransaction(async (transaction) => {
    const [nameClaim, tagClaim] = await Promise.all([transaction.get(nameClaimRef), transaction.get(tagClaimRef)]);
    if (nameClaim.exists || tagClaim.exists) {
      throw new HttpsError("already-exists", "Clan name or tag is already in use.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const periodKey = getMonthKey(new Date());
    const clan = buildClanDocument({ clanId: clanRef.id, owner, ...identity, description, periodKey, timestamp });
    transaction.set(clanRef, clan);
    transaction.set(memberRef, buildClanMemberDocument({
      clanId: clanRef.id,
      profile: owner,
      role: "owner",
      periodKey,
      timestamp,
    }));
    transaction.set(nameClaimRef, { clanId: clanRef.id, createdAt: timestamp });
    transaction.set(tagClaimRef, { clanId: clanRef.id, createdAt: timestamp });
    setProfileClanState(transaction, ownerUserId, {
      clan: clan.name,
      clanId: clanRef.id,
      clanRole: "owner",
      timestamp,
    });
  });

  return { ok: true, clanId: clanRef.id };
});

exports.inviteClanMember = secureCall("inviteClanMember", { rateLimit: { limit: 30, windowSeconds: 3600 } }, async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  const { clanId } = request.data ?? {};
  assertClanId(clanId);

  const [actor, target] = await Promise.all([getUserProfile(actorUserId), getUserProfile(targetUserId)]);
  const clanRef = publicCollection("clans").doc(clanId);
  const actorMemberRef = clanMemberDocument(clanId, actorUserId);
  const targetMemberRef = clanMemberDocument(clanId, targetUserId);
  const inviteRef = clanInviteDocument(clanId, targetUserId);
  const friendshipRef = friendshipDocument(actorUserId, targetUserId);
  const actorBlockRef = blockedDriverDocument(actorUserId, targetUserId);
  const targetBlockRef = blockedDriverDocument(targetUserId, actorUserId);

  let duplicateInvite = false;

  await db.runTransaction(async (transaction) => {
    const [clanSnapshot, actorMember, targetMember, invite, friendship, actorBlock, targetBlock] = await Promise.all([
      transaction.get(clanRef),
      transaction.get(actorMemberRef),
      transaction.get(targetMemberRef),
      transaction.get(inviteRef),
      transaction.get(friendshipRef),
      transaction.get(actorBlockRef),
      transaction.get(targetBlockRef),
    ]);
    const clan = requireSnapshot(clanSnapshot, "not-found", "Clan not found.");
    const actorRole = getClanMemberRole(actorMember, actorUserId);
    if (!canInviteClanMember(actorRole)) {
      throw new HttpsError("permission-denied", "Only an owner or captain can invite members.");
    }
    if (target.clanId || targetMember.exists) {
      throw new HttpsError("failed-precondition", "This driver already belongs to a clan.");
    }
    if (invite.exists) {
      duplicateInvite = true;
      return;
    }
    if (!isAcceptedFriendship(friendship.data(), actorUserId, targetUserId) || actorBlock.exists || targetBlock.exists) {
      throw new HttpsError("permission-denied", "Clan invites can only be sent to unblocked friends.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(inviteRef, {
      ...buildClanInviteDocument({ clan, inviter: actor, target, timestamp }),
      invitedByRole: actorRole,
    });
    writeNotification(transaction, targetUserId, `clan-invite-${clanId}-${targetUserId}`, {
      type: "clan-invite",
      title: "Klan daveti",
      body: `${actor.fullName ?? actor.plate} seni ${clan.name} klanina davet etti.`,
      actor,
      action: { type: "clan", targetId: clanId },
    }, timestamp);
  });

  return { ok: true, clanId, targetUserId, duplicate: duplicateInvite };
});

exports.respondClanInvite = secureCall("respondClanInvite", async (request) => {
  const targetUserId = requireAuth(request);
  const { clanId, decision } = request.data ?? {};
  assertClanId(clanId);
  if (!["accepted", "declined"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Decision must be accepted or declined.");
  }

  const target = await getUserProfile(targetUserId);
  const clanRef = publicCollection("clans").doc(clanId);
  const inviteRef = clanInviteDocument(clanId, targetUserId);
  const memberRef = clanMemberDocument(clanId, targetUserId);

  await db.runTransaction(async (transaction) => {
    const [clanSnapshot, inviteSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(clanRef),
      transaction.get(inviteRef),
      transaction.get(memberRef),
    ]);
    const clan = requireSnapshot(clanSnapshot, "not-found", "Clan not found.");
    const invite = requireSnapshot(inviteSnapshot, "not-found", "Clan invite not found.");
    if (invite.targetUserId !== targetUserId || invite.status !== "pending") {
      throw new HttpsError("permission-denied", "Only the invite recipient can respond.");
    }
    if (decision === "declined") {
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      writeNotification(transaction, invite.invitedByUserId, `clan-response-${clanId}-${targetUserId}`, {
        type: "clan-response",
        title: "Klan daveti reddedildi",
        body: `${target.fullName ?? target.plate} klan davetine yanit verdi.`,
        actor: target,
        action: { type: "clan", targetId: clanId },
      }, timestamp);
      transaction.delete(inviteRef);
      return;
    }
    if (target.clanId || memberSnapshot.exists) {
      throw new HttpsError("failed-precondition", "Leave your current clan before accepting this invite.");
    }

    const inviterMemberRef = clanMemberDocument(clanId, invite.invitedByUserId);
    const friendshipRef = friendshipDocument(invite.invitedByUserId, targetUserId);
    const targetBlockRef = blockedDriverDocument(targetUserId, invite.invitedByUserId);
    const inviterBlockRef = blockedDriverDocument(invite.invitedByUserId, targetUserId);
    const [inviterMember, friendship, targetBlock, inviterBlock] = await Promise.all([
      transaction.get(inviterMemberRef),
      transaction.get(friendshipRef),
      transaction.get(targetBlockRef),
      transaction.get(inviterBlockRef),
    ]);
    if (!canInviteClanMember(getClanMemberRole(inviterMember, invite.invitedByUserId))) {
      throw new HttpsError("failed-precondition", "The inviter no longer has clan invite permission.");
    }
    if (!isAcceptedFriendship(friendship.data(), invite.invitedByUserId, targetUserId) || targetBlock.exists || inviterBlock.exists) {
      throw new HttpsError("permission-denied", "This clan invite is no longer eligible.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    writeNotification(transaction, invite.invitedByUserId, `clan-response-${clanId}-${targetUserId}`, {
      type: "clan-response",
      title: decision === "accepted" ? "Klan daveti kabul edildi" : "Klan daveti reddedildi",
      body: `${target.fullName ?? target.plate} klan davetine yanit verdi.`,
      actor: target,
      action: { type: "clan", targetId: clanId },
    }, timestamp);
    const memberCount = Number(clan.memberCount ?? clan.members ?? 0) + 1;
    transaction.set(memberRef, buildClanMemberDocument({
      clanId,
      profile: target,
      role: "member",
      periodKey: getMonthKey(new Date()),
      timestamp,
    }));
    transaction.update(clanRef, { memberCount, members: memberCount, updatedAt: timestamp });
    transaction.delete(inviteRef);
    setProfileClanState(transaction, targetUserId, { clan: clan.name, clanId, clanRole: "member", timestamp });
  });

  return { ok: true, clanId, decision };
});

exports.cancelClanInvite = secureCall("cancelClanInvite", async (request) => {
  const actorUserId = requireAuth(request);
  const { clanId, targetUserId } = request.data ?? {};
  assertClanId(clanId);
  requireTargetUserId({ data: { targetUserId } }, actorUserId);

  const actorMemberRef = clanMemberDocument(clanId, actorUserId);
  const inviteRef = clanInviteDocument(clanId, targetUserId);
  await db.runTransaction(async (transaction) => {
    const [actorMember, invite] = await Promise.all([transaction.get(actorMemberRef), transaction.get(inviteRef)]);
    if (!canInviteClanMember(getClanMemberRole(actorMember, actorUserId))) {
      throw new HttpsError("permission-denied", "Only an owner or captain can cancel an invite.");
    }
    requireSnapshot(invite, "not-found", "Clan invite not found.");
    transaction.delete(inviteRef);
  });

  return { ok: true, clanId, targetUserId };
});

exports.updateClanMemberRole = secureCall("updateClanMemberRole", async (request) => {
  const actorUserId = requireAuth(request);
  const { clanId, targetUserId, role } = request.data ?? {};
  assertClanId(clanId);
  requireTargetUserId({ data: { targetUserId } }, actorUserId);
  const nextRole = assertClanRole(role);
  const clanRef = publicCollection("clans").doc(clanId);
  const actorMemberRef = clanMemberDocument(clanId, actorUserId);
  const targetMemberRef = clanMemberDocument(clanId, targetUserId);

  await db.runTransaction(async (transaction) => {
    const [clanSnapshot, actorMember, targetMember] = await Promise.all([
      transaction.get(clanRef), transaction.get(actorMemberRef), transaction.get(targetMemberRef),
    ]);
    const clan = requireSnapshot(clanSnapshot, "not-found", "Clan not found.");
    const actorRole = getClanMemberRole(actorMember, actorUserId);
    const targetRole = getClanMemberRole(targetMember, targetUserId);
    if (actorRole !== "owner" || targetRole === "owner") {
      throw new HttpsError("permission-denied", "Only the owner can update member roles.");
    }
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.update(targetMemberRef, { role: nextRole, updatedAt: timestamp });
    setProfileClanState(transaction, targetUserId, {
      clan: clan.name,
      clanId,
      clanRole: nextRole,
      timestamp,
    });
  });

  return { ok: true, clanId, targetUserId, role: nextRole };
});

exports.removeClanMember = secureCall("removeClanMember", async (request) => {
  const actorUserId = requireAuth(request);
  const { clanId, targetUserId } = request.data ?? {};
  assertClanId(clanId);
  requireTargetUserId({ data: { targetUserId } }, actorUserId);
  const clanRef = publicCollection("clans").doc(clanId);
  const actorMemberRef = clanMemberDocument(clanId, actorUserId);
  const targetMemberRef = clanMemberDocument(clanId, targetUserId);

  await db.runTransaction(async (transaction) => {
    const [clanSnapshot, actorMember, targetMember] = await Promise.all([
      transaction.get(clanRef), transaction.get(actorMemberRef), transaction.get(targetMemberRef),
    ]);
    const clan = requireSnapshot(clanSnapshot, "not-found", "Clan not found.");
    const actorRole = getClanMemberRole(actorMember, actorUserId);
    const targetRole = getClanMemberRole(targetMember, targetUserId);
    if (!canManageClanMember(actorRole, targetRole)) {
      throw new HttpsError("permission-denied", "Your role cannot remove this member.");
    }
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const memberCount = Math.max(1, Number(clan.memberCount ?? clan.members ?? 1) - 1);
    transaction.delete(targetMemberRef);
    transaction.update(clanRef, { memberCount, members: memberCount, updatedAt: timestamp });
    setProfileClanState(transaction, targetUserId, { clan: null, clanId: null, clanRole: null, timestamp });
  });

  return { ok: true, clanId, targetUserId };
});

exports.transferClanOwnership = secureCall("transferClanOwnership", async (request) => {
  const ownerUserId = requireAuth(request);
  const { clanId, targetUserId } = request.data ?? {};
  assertClanId(clanId);
  requireTargetUserId({ data: { targetUserId } }, ownerUserId);
  const clanRef = publicCollection("clans").doc(clanId);
  const ownerMemberRef = clanMemberDocument(clanId, ownerUserId);
  const targetMemberRef = clanMemberDocument(clanId, targetUserId);

  await db.runTransaction(async (transaction) => {
    const [clanSnapshot, ownerMember, targetMember] = await Promise.all([
      transaction.get(clanRef), transaction.get(ownerMemberRef), transaction.get(targetMemberRef),
    ]);
    const clan = requireSnapshot(clanSnapshot, "not-found", "Clan not found.");
    if (getClanMemberRole(ownerMember, ownerUserId) !== "owner" || clan.ownerUserId !== ownerUserId) {
      throw new HttpsError("permission-denied", "Only the clan owner can transfer ownership.");
    }
    const targetRole = getClanMemberRole(targetMember, targetUserId);
    if (targetRole === "owner") {
      throw new HttpsError("failed-precondition", "This driver already owns the clan.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const nextOwner = targetMember.data();
    transaction.update(ownerMemberRef, { role: "captain", updatedAt: timestamp });
    transaction.update(targetMemberRef, { role: "owner", updatedAt: timestamp });
    transaction.update(clanRef, {
      ownerUserId: targetUserId,
      ownerPlate: nextOwner.plate,
      ownerName: nextOwner.fullName,
      captainPlate: nextOwner.plate,
      updatedAt: timestamp,
    });
    setProfileClanState(transaction, ownerUserId, { clan: clan.name, clanId, clanRole: "captain", timestamp });
    setProfileClanState(transaction, targetUserId, { clan: clan.name, clanId, clanRole: "owner", timestamp });
  });

  return { ok: true, clanId, ownerUserId: targetUserId };
});

exports.leaveClan = secureCall("leaveClan", async (request) => {
  const userId = requireAuth(request);
  const { clanId } = request.data ?? {};
  assertClanId(clanId);
  const clanRef = publicCollection("clans").doc(clanId);
  const memberRef = clanMemberDocument(clanId, userId);

  await db.runTransaction(async (transaction) => {
    const [clanSnapshot, memberSnapshot] = await Promise.all([transaction.get(clanRef), transaction.get(memberRef)]);
    const clan = requireSnapshot(clanSnapshot, "not-found", "Clan not found.");
    const role = getClanMemberRole(memberSnapshot, userId);
    const memberCount = Number(clan.memberCount ?? clan.members ?? 1);
    if (role === "owner" && memberCount > 1) {
      throw new HttpsError("failed-precondition", "Transfer ownership before leaving a clan with other members.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.delete(memberRef);
    if (role === "owner") {
      transaction.delete(clanRef);
      transaction.delete(publicDocument("clanNameClaims", clan.nameNormalized));
      transaction.delete(publicDocument("clanTagClaims", clan.tagNormalized));
    } else {
      const nextCount = Math.max(1, memberCount - 1);
      transaction.update(clanRef, { memberCount: nextCount, members: nextCount, updatedAt: timestamp });
    }
    setProfileClanState(transaction, userId, { clan: null, clanId: null, clanRole: null, timestamp });
  });

  return { ok: true, clanId };
});

exports.refreshDriverStats = secureCall("refreshDriverStats", async (request) => {
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
    const partsQuery = privateUserCollection(userId, "parts").where("vehicleId", "==", vehicleId);
    const [vehicleSnapshot, passportSnapshot, statsSnapshot, partsSnapshot] = await Promise.all([
      transaction.get(refs.vehicleRef),
      transaction.get(refs.passportRef),
      transaction.get(refs.statsRef),
      transaction.get(partsQuery),
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
    const partHealth = partsSnapshot.docs.map((partDocument) => {
      const health = buildPartLifeSnapshot(partDocument.data(), vehicle.odometer, new Date());
      transaction.set(partDocument.ref, { ...health, healthCalculatedAt: timestamp, updatedAt: timestamp }, { merge: true });
      return { id: partDocument.id, key: partDocument.data().key, ...health };
    });
    const leaderboardEntry = writeDriverAggregate(transaction, {
      userId,
      profile,
      stats,
      statsExists: statsSnapshot.exists,
      timestamp,
    });

    response = { ok: true, stats, leaderboardEntry, partHealth };
  });

  return response;
});

exports.createVehiclePassportExport = secureCall("createVehiclePassportExport", { rateLimit: { limit: 10, windowSeconds: 3600 } }, async (request) => {
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

exports.startDriveSession = secureCall("startDriveSession", { rateLimit: { limit: 20, windowSeconds: 600 } }, async (request) => {
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

exports.finishDriveSession = secureCall("finishDriveSession", { rateLimit: { limit: 20, windowSeconds: 600 } }, async (request) => {
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
    const partsQuery = privateUserCollection(userId, "parts").where("vehicleId", "==", session.vehicleId);
    const [vehicleSnapshot, passportSnapshot, statsSnapshot, partsSnapshot] = await Promise.all([
      transaction.get(refs.vehicleRef),
      transaction.get(refs.passportRef),
      transaction.get(refs.statsRef),
      transaction.get(partsQuery),
    ]);
    const vehicle = requireSnapshot(vehicleSnapshot, "not-found", "Primary vehicle not found.");
    const passport = requireSnapshot(passportSnapshot, "not-found", "Vehicle Passport not found.");
    const existingStats = statsSnapshot.exists ? statsSnapshot.data() : {};

    if (session.status === "completed") {
      const partHealth = partsSnapshot.docs.map((partDocument) => ({
        id: partDocument.id,
        key: partDocument.data().key,
        ...buildPartLifeSnapshot(partDocument.data(), vehicle.odometer, new Date()),
      }));
      response = {
        ok: true,
        duplicate: true,
        sessionId,
        acceptedKm: Number(session.acceptedKm ?? 0),
        rejectedKm: Number(session.rejectedKm ?? 0),
        odometer: Number(session.endOdometer ?? vehicle.odometer ?? 0),
        stats: existingStats,
        leaderboardEntry: buildLeaderboardEntry({ userId, profile, stats: existingStats }),
        partHealth,
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
    let clanContext = null;
    if (profile.clanId) {
      const clanRef = publicDocument("clans", profile.clanId);
      const memberRef = clanMemberDocument(profile.clanId, userId);
      const [clanSnapshot, memberSnapshot] = await Promise.all([
        transaction.get(clanRef),
        transaction.get(memberRef),
      ]);
      if (
        clanSnapshot.exists &&
        memberSnapshot.exists &&
        memberSnapshot.data().userId === userId &&
        memberSnapshot.data().clanId === profile.clanId
      ) {
        clanContext = {
          clanRef,
          clan: clanSnapshot.data(),
          memberRef,
          member: memberSnapshot.data(),
        };
      }
    }
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const partHealth = partsSnapshot.docs.map((partDocument) => {
      const part = partDocument.data();
      const health = buildPartLifeSnapshot(part, nextOdometer, finishedAt);
      transaction.set(partDocument.ref, {
        ...health,
        healthCalculatedAt: timestamp,
        lastDriveSessionId: sessionId,
        updatedAt: timestamp,
      }, { merge: true });
      if (Number(part.healthPercent ?? 100) >= 20 && health.healthPercent < 20) {
        writeNotification(transaction, userId, `maintenance-critical-${partDocument.id}-${health.healthPeriodKey}`, {
          type: "maintenance-critical",
          title: "Kritik bakim uyarisi",
          body: `${part.name ?? part.key} omru %${health.healthPercent} seviyesine dustu.`,
          actor: { userId, fullName: "CRUISER Garage", plate: profile.plate },
          action: { type: "garage", targetId: partDocument.id },
        }, timestamp);
      }
      return { id: partDocument.id, key: part.key, ...health };
    });
    let clanLeaderboardEntry = null;

    if (clanContext) {
      const clanAggregate = applyCompletedDriveToClan({
        clan: { id: clanContext.clanRef.id, ...clanContext.clan },
        member: clanContext.member,
        acceptedKm: distance.acceptedKm,
        periodKey: stats.periodKey,
      });
      transaction.update(clanContext.clanRef, { ...clanAggregate.clanPatch, updatedAt: timestamp });
      transaction.update(clanContext.memberRef, { ...clanAggregate.memberPatch, updatedAt: timestamp });
      transaction.set(
        publicDocument("clanLeaderboard", clanAggregate.leaderboardEntry.id),
        { ...clanAggregate.leaderboardEntry, updatedAt: timestamp },
        { merge: true },
      );
      clanLeaderboardEntry = clanAggregate.leaderboardEntry;
    }

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
    transaction.update(refs.passportRef, {
      odometerSnapshot: nextOdometer,
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
      clanLeaderboardEntry,
      partHealth,
    };
  });

  return response;
});

// Stage 6: Spot and wash writes are intentionally callable-only. Event/convoy
// mutations remain a Stage 7 concern and are not handled by these endpoints.
exports.createMapNode = secureCall("createMapNode", { rateLimit: { limit: 12, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  const pin = request.data?.pin ?? request.data;
  const profile = await getUserProfile(userId);
  const pinRef = publicCollection("mapPins").doc();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  let document;
  try {
    document = buildMapPinDocument({ pinId: pinRef.id, pin, profile, userId, timestamp });
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  if (document.type === "wash" && (pin?.foam || pin?.water)) {
    let review;
    try {
      review = buildWashReviewDocument({ pinId: pinRef.id, userId, profile, review: pin, timestamp });
    } catch (error) {
      throw new HttpsError("invalid-argument", error.message);
    }
    document.rating = buildWashRating({}, null, review);
    const batch = db.batch();
    batch.set(pinRef, document);
    batch.set(publicDocument("washReviews", review.id), review);
    await batch.commit();
  } else {
    await pinRef.set(document);
  }
  return { ok: true, pinId: pinRef.id };
});

exports.submitWashReview = secureCall("submitWashReview", { rateLimit: { limit: 30, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  const pinId = String(request.data?.pinId ?? "");
  if (!pinId || pinId.includes("/")) throw new HttpsError("invalid-argument", "A valid wash node is required.");
  const profile = await getUserProfile(userId);
  const pinRef = publicDocument("mapPins", pinId);
  const reviewRef = publicDocument("washReviews", `${pinId}__${userId}`);
  let rating;
  await db.runTransaction(async (transaction) => {
    const [pinSnapshot, previousReviewSnapshot] = await Promise.all([transaction.get(pinRef), transaction.get(reviewRef)]);
    if (!pinSnapshot.exists || pinSnapshot.data().type !== "wash") throw new HttpsError("not-found", "Wash node not found.");
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    let review;
    try {
      review = buildWashReviewDocument({ pinId, userId, profile, review: request.data, timestamp });
    } catch (error) {
      throw new HttpsError("invalid-argument", error.message);
    }
    rating = buildWashRating(pinSnapshot.data().rating, previousReviewSnapshot.exists ? previousReviewSnapshot.data() : null, review);
    transaction.set(reviewRef, review, { merge: true });
    transaction.update(pinRef, { rating, updatedAt: timestamp });
  });
  return { ok: true, rating };
});

exports.toggleMapLike = secureCall("toggleMapLike", { rateLimit: { limit: 120, windowSeconds: 60 } }, async (request) => {
  const userId = requireAuth(request);
  const pinId = String(request.data?.pinId ?? "");
  const targetType = request.data?.targetType;
  const photoId = targetType === "photo" ? String(request.data?.photoId ?? "") : "";
  if (!pinId || pinId.includes("/") || !["pin", "photo"].includes(targetType) || (targetType === "photo" && (!photoId || photoId.includes("/")))) {
    throw new HttpsError("invalid-argument", "A valid like target is required.");
  }
  const pinRef = publicDocument("mapPins", pinId);
  const photoRef = targetType === "photo" ? publicDocument("mapSpotPhotos", photoId) : null;
  const likeId = `${pinId}__${photoId || "pin"}__${userId}`;
  const likeRef = publicDocument("mapLikes", likeId);
  let liked = false;
  await db.runTransaction(async (transaction) => {
    const reads = [transaction.get(pinRef), transaction.get(likeRef)];
    if (photoRef) reads.push(transaction.get(photoRef));
    const [pinSnapshot, likeSnapshot, photoSnapshot] = await Promise.all(reads);
    if (!pinSnapshot.exists || (photoRef && (!photoSnapshot.exists || photoSnapshot.data().pinId !== pinId))) throw new HttpsError("not-found", "Map target not found.");
    const field = targetType === "photo" ? "galleryLikes" : "likes";
    const current = Number(pinSnapshot.data()[field] ?? 0);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    liked = !likeSnapshot.exists;
    if (liked) {
      transaction.set(likeRef, { id: likeId, pinId, photoId: photoId || null, targetType, userId, createdAt: timestamp });
    } else {
      transaction.delete(likeRef);
    }
    transaction.update(pinRef, { [field]: Math.max(0, current + (liked ? 1 : -1)), updatedAt: timestamp });
    if (photoRef) transaction.update(photoRef, { likes: Math.max(0, Number(photoSnapshot.data().likes ?? 0) + (liked ? 1 : -1)), updatedAt: timestamp });
  });
  return { ok: true, liked };
});

exports.addMapSpotPhoto = secureCall("addMapSpotPhoto", { rateLimit: { limit: 20, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  const pinId = String(request.data?.pinId ?? "");
  const storagePath = String(request.data?.storagePath ?? "");
  const expectedPrefix = `artifacts/${APP_ID}/mapNodes/${pinId}/photos/${userId}/`;
  if (!pinId || pinId.includes("/") || !storagePath.startsWith(expectedPrefix) || storagePath.includes("..")) {
    throw new HttpsError("invalid-argument", "Photo must be uploaded to the approved map path.");
  }
  const profile = await getUserProfile(userId);
  const pinRef = publicDocument("mapPins", pinId);
  const photoRef = publicCollection("mapSpotPhotos").doc();
  await db.runTransaction(async (transaction) => {
    const pinSnapshot = await transaction.get(pinRef);
    if (!pinSnapshot.exists || pinSnapshot.data().type !== "spot") throw new HttpsError("not-found", "Photo spot not found.");
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const photo = buildSpotPhotoDocument({ photoId: photoRef.id, pinId, userId, profile, title: request.data?.title, imageUrl: request.data?.imageUrl, storagePath, timestamp });
    if (!photo.imageUrl) throw new HttpsError("invalid-argument", "A photo URL is required.");
    transaction.set(photoRef, photo);
    transaction.update(pinRef, { photoCount: Number(pinSnapshot.data().photoCount ?? 0) + 1, updatedAt: timestamp });
  });
  return { ok: true, photoId: photoRef.id };
});

exports.deleteMapSpotPhoto = secureCall("deleteMapSpotPhoto", { rateLimit: { limit: 20, windowSeconds: 3600 } }, async (request) => {
  const userId = requireAuth(request);
  const photoId = String(request.data?.photoId ?? "");
  if (!photoId || photoId.includes("/") || photoId.length > 180) {
    throw new HttpsError("invalid-argument", "A valid photoId is required.");
  }
  const photoRef = publicDocument("mapSpotPhotos", photoId);
  const snapshot = await photoRef.get();
  const photo = requireSnapshot(snapshot, "not-found", "Photo not found.");
  if (photo.userId !== userId) {
    throw new HttpsError("permission-denied", "Only the uploader can delete this photo.");
  }
  const pinRef = publicDocument("mapPins", photo.pinId);
  const likes = await publicCollection("mapLikes").where("photoId", "==", photoId).limit(450).get();
  await db.runTransaction(async (transaction) => {
    const [livePhoto, pinSnapshot] = await Promise.all([
      transaction.get(photoRef),
      transaction.get(pinRef),
    ]);
    if (!livePhoto.exists || livePhoto.data().userId !== userId) {
      throw new HttpsError("permission-denied", "Photo ownership changed or the photo was removed.");
    }
    transaction.delete(photoRef);
    likes.docs.forEach((document) => transaction.delete(document.ref));
    if (pinSnapshot.exists) {
      transaction.update(pinRef, {
        photoCount: Math.max(0, Number(pinSnapshot.data().photoCount ?? 0) - 1),
        galleryLikes: Math.max(0, Number(pinSnapshot.data().galleryLikes ?? 0) - Number(livePhoto.data().likes ?? 0)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
  if (photo.storagePath) {
    await admin.storage().bucket().file(photo.storagePath).delete({ ignoreNotFound: true }).catch((error) => {
      logger.warn("map.photo.storage-delete-failed", { photoId, errorCode: error?.code ?? "unknown" });
    });
  }
  return { ok: true, photoId };
});

exports.markNotificationRead = secureCall("markNotificationRead", { rateLimit: { limit: 120, windowSeconds: 60 } }, async (request) => {
  const userId = requireAuth(request);
  const notificationId = sanitizeOperationalText(request.data?.notificationId, 180);
  if (!notificationId || notificationId.includes("/")) {
    throw new HttpsError("invalid-argument", "A valid notificationId is required.");
  }

  const notificationRef = privateUserDocument(userId, "notifications", notificationId);
  const snapshot = await notificationRef.get();
  if (!snapshot.exists || snapshot.data().userId !== userId) {
    throw new HttpsError("not-found", "Notification not found.");
  }
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  await notificationRef.update({ readAt: timestamp, updatedAt: timestamp });
  return { ok: true, notificationId };
});

exports.markAllNotificationsRead = secureCall("markAllNotificationsRead", { rateLimit: { limit: 10, windowSeconds: 60 } }, async (request) => {
  const userId = requireAuth(request);
  const snapshot = await privateUserCollection(userId, "notifications").limit(100).get();
  const unread = snapshot.docs.filter((document) => !document.data().readAt);
  if (unread.length) {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    unread.forEach((document) => batch.update(document.ref, { readAt: timestamp, updatedAt: timestamp }));
    await batch.commit();
  }
  return { ok: true, updatedCount: unread.length, hasMore: snapshot.size === 100 };
});

exports.submitModerationReport = secureCall("submitModerationReport", { rateLimit: { limit: 10, windowSeconds: 86400 } }, async (request) => {
  const reporterUserId = requireAuth(request);
  const reporter = await getUserProfile(reporterUserId);
  const targetType = String(request.data?.targetType ?? "");
  const targetId = sanitizeOperationalText(request.data?.targetId, 180);
  const reason = String(request.data?.reason ?? "");
  if (targetType === "driver" && targetId === reporterUserId) {
    throw new HttpsError("failed-precondition", "You cannot report your own profile.");
  }

  const targetCollections = {
    driver: "publicProfiles",
    mapPin: "mapPins",
    mapPhoto: "mapSpotPhotos",
    convoy: "convoys",
    clan: "clans",
  };
  if (targetCollections[targetType]) {
    const targetSnapshot = await publicDocument(targetCollections[targetType], targetId).get();
    if (!targetSnapshot.exists) {
      throw new HttpsError("not-found", "The reported target no longer exists.");
    }
    if (targetType === "mapPhoto" && targetSnapshot.data().userId === reporterUserId) {
      throw new HttpsError("failed-precondition", "You cannot report your own photo.");
    }
  }

  const reportRef = publicCollection("moderationReports").doc();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  let report;
  try {
    report = buildModerationReportDocument({
      reportId: reportRef.id,
      reporter,
      targetType,
      targetId,
      reason,
      details: request.data?.details,
      timestamp,
    });
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  await reportRef.set(report);
  logger.warn("moderation.report.created", {
    reportId: reportRef.id,
    targetType,
    reason,
  });
  return { ok: true, reportId: reportRef.id, status: "open" };
});

exports.listModerationQueue = secureCall("listModerationQueue", async (request) => {
  requireModerator(request);
  const snapshot = await publicCollection("moderationReports").limit(100).get();
  const reports = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((report) => report.status === "open")
    .sort((left, right) => Number(right.createdAt?.toMillis?.() ?? 0) - Number(left.createdAt?.toMillis?.() ?? 0));
  return { ok: true, reports };
});

exports.resolveModerationReport = secureCall("resolveModerationReport", { rateLimit: { limit: 60, windowSeconds: 3600 } }, async (request) => {
  const moderatorUserId = requireModerator(request);
  const reportId = sanitizeOperationalText(request.data?.reportId, 180);
  const decision = String(request.data?.decision ?? "");
  if (!reportId || reportId.includes("/")) {
    throw new HttpsError("invalid-argument", "A valid reportId is required.");
  }

  const reportRef = publicDocument("moderationReports", reportId);
  const auditRef = publicCollection("moderationAudit").doc();
  let resolvedTargetType = "";
  await db.runTransaction(async (transaction) => {
    const reportSnapshot = await transaction.get(reportRef);
    const report = requireSnapshot(reportSnapshot, "not-found", "Moderation report not found.");
    if (report.status !== "open") {
      throw new HttpsError("failed-precondition", "This moderation report is already resolved.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    let audit;
    try {
      audit = buildModerationAuditDocument({
        report: { id: reportId, ...report },
        moderatorUserId,
        decision,
        note: request.data?.note,
        timestamp,
      });
    } catch (error) {
      throw new HttpsError("invalid-argument", error.message);
    }
    transaction.set(auditRef, { id: auditRef.id, ...audit });
    transaction.update(reportRef, {
      status: decision === "dismiss" ? "dismissed" : "actioned",
      assignedModeratorId: moderatorUserId,
      decision,
      resolutionNote: audit.note,
      resolvedAt: timestamp,
      updatedAt: timestamp,
    });
    resolvedTargetType = report.targetType;

    const recipientUserId = decision === "dismiss" ? report.reporterUserId : report.targetType === "driver" ? report.targetId : "";
    if (recipientUserId) {
      writeNotification(transaction, recipientUserId, `moderation-${reportId}-${decision}`, {
        type: "moderation",
        title: decision === "dismiss" ? "Rapor incelendi" : decision === "warn" ? "Topluluk kurallari uyarisi" : "Hesap kisitlamasi",
        body: decision === "dismiss"
          ? "Gonderdigin rapor incelendi ve islem gerektirmedigi belirlendi."
          : decision === "warn"
            ? "Topluluk kurallarina uygun davranman icin hesabina uyari verildi."
            : "Hesabin topluluk guvenligi nedeniyle gecici olarak kisitlandi.",
        actor: { userId: moderatorUserId, fullName: "CRUISER Safety" },
        action: { type: "profile", targetId: recipientUserId },
      }, timestamp);
    }

    if (report.targetType === "driver" && decision !== "dismiss") {
      const restrictedUntil = decision === "restrict"
        ? admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : null;
      const moderationPatch = {
        status: decision === "restrict" ? "restricted" : "warned",
        lastDecision: decision,
        lastReportId: reportId,
        restrictedUntil,
        updatedAt: timestamp,
      };
      transaction.set(privateUserDocument(report.targetId, "moderation", "current"), moderationPatch, { merge: true });
      transaction.set(publicDocument("publicProfiles", report.targetId), {
        moderationStatus: moderationPatch.status,
        restrictedUntil,
        updatedAt: timestamp,
      }, { merge: true });
    }
  });

  logger.warn("moderation.report.resolved", { reportId, decision, targetType: resolvedTargetType });
  return { ok: true, reportId, decision };
});
