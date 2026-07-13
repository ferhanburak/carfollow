const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

admin.initializeApp();

const db = admin.firestore();
const APP_ID = process.env.CRUISER_APP_ID || "cruiser-app-prod";

function publicCollection(collectionName) {
  return db.collection(`artifacts/${APP_ID}/public/data/${collectionName}`);
}

function privateUserDocument(userId, collectionName, documentId) {
  return db.doc(`artifacts/${APP_ID}/users/${userId}/${collectionName}/${documentId}`);
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
