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
const {
  buildBlockedDriverDocument,
  buildFriendshipDocument,
  buildFriendshipMigrationDocument,
  buildPairId,
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

exports.requestFriendship = onCall(async (request) => {
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
      return "migrated";
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(friendshipRef, buildFriendshipDocument({ requester, target, timestamp }));
    return "created";
  });

  return { ok: true, friendshipId, migrated: outcome === "migrated" };
});

exports.respondFriendship = onCall(async (request) => {
  const actorUserId = requireAuth(request);
  const requesterUserId = requireTargetUserId(request, actorUserId);
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

    if (decision === "declined") {
      transaction.delete(friendshipRef);
      return;
    }
    if (actorBlock.exists || requesterBlock.exists) {
      throw new HttpsError("permission-denied", "A blocked friendship request cannot be accepted.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.update(friendshipRef, {
      status: "accepted",
      acceptedAt: timestamp,
      updatedAt: timestamp,
    });
  });

  return { ok: true, friendshipId: friendshipRef.id, decision };
});

exports.cancelFriendshipRequest = onCall(async (request) => {
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

exports.removeFriendship = onCall(async (request) => {
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

exports.blockDriver = onCall(async (request) => {
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

exports.unblockDriver = onCall(async (request) => {
  const actorUserId = requireAuth(request);
  const targetUserId = requireTargetUserId(request, actorUserId);
  await blockedDriverDocument(actorUserId, targetUserId).delete();
  return { ok: true, targetUserId };
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

exports.createClan = onCall(async (request) => {
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
    const clan = buildClanDocument({ clanId: clanRef.id, owner, ...identity, description, timestamp });
    transaction.set(clanRef, clan);
    transaction.set(memberRef, buildClanMemberDocument({ clanId: clanRef.id, profile: owner, role: "owner", timestamp }));
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

exports.inviteClanMember = onCall(async (request) => {
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
      throw new HttpsError("already-exists", "An active invite already exists for this driver.");
    }
    if (!isAcceptedFriendship(friendship.data(), actorUserId, targetUserId) || actorBlock.exists || targetBlock.exists) {
      throw new HttpsError("permission-denied", "Clan invites can only be sent to unblocked friends.");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    transaction.set(inviteRef, {
      ...buildClanInviteDocument({ clan, inviter: actor, target, timestamp }),
      invitedByRole: actorRole,
    });
  });

  return { ok: true, clanId, targetUserId };
});

exports.respondClanInvite = onCall(async (request) => {
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
    const memberCount = Number(clan.memberCount ?? clan.members ?? 0) + 1;
    transaction.set(memberRef, buildClanMemberDocument({ clanId, profile: target, role: "member", timestamp }));
    transaction.update(clanRef, { memberCount, members: memberCount, updatedAt: timestamp });
    transaction.delete(inviteRef);
    setProfileClanState(transaction, targetUserId, { clan: clan.name, clanId, clanRole: "member", timestamp });
  });

  return { ok: true, clanId, decision };
});

exports.cancelClanInvite = onCall(async (request) => {
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

exports.updateClanMemberRole = onCall(async (request) => {
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

exports.removeClanMember = onCall(async (request) => {
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

exports.transferClanOwnership = onCall(async (request) => {
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

exports.leaveClan = onCall(async (request) => {
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
