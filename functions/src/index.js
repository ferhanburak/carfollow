const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

admin.initializeApp();

const db = admin.firestore();

function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  return request.auth.uid;
}

async function getUserProfile(userId) {
  const snapshot = await db.collection("users").doc(userId).get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function buildFriendshipId(leftUserId, rightUserId) {
  return [leftUserId, rightUserId].sort((left, right) => left.localeCompare(right)).join("__");
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

  const requester = await getUserProfile(requesterUserId);
  const target = await getUserProfile(targetUserId);
  const friendshipId = buildFriendshipId(requesterUserId, targetUserId);
  const friendshipRef = db.collection("friendships").doc(friendshipId);

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
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    ok: true,
    friendshipId,
  };
});

exports.requestConvoyJoin = onCall(async (request) => {
  const requesterUserId = requireAuth(request);
  const { convoyId } = request.data ?? {};

  if (!convoyId || typeof convoyId !== "string") {
    throw new HttpsError("invalid-argument", "convoyId is required.");
  }

  const requester = await getUserProfile(requesterUserId);
  const convoyRef = db.collection("convoys").doc(convoyId);
  const memberRef = convoyRef.collection("members").doc(requesterUserId);

  await db.runTransaction(async (transaction) => {
    const convoySnapshot = await transaction.get(convoyRef);
    if (!convoySnapshot.exists) {
      throw new HttpsError("not-found", "Convoy not found.");
    }

    const convoy = convoySnapshot.data();
    const existingMember = await transaction.get(memberRef);
    if (existingMember.exists) {
      throw new HttpsError("already-exists", "User is already part of this convoy flow.");
    }

    // TODO: Move current client-side trust rules here and make this the source of truth.
    transaction.set(memberRef, {
      userId: requesterUserId,
      plate: requester.plate ?? "",
      fullName: requester.fullName ?? "",
      status: convoy?.accessPolicy === "open" ? "approved" : "pending",
      tripStatus: "ready",
      scoreSnapshot: requester.driverScore ?? 0,
      harmonyVotesSnapshot: requester.harmonyVotes ?? 0,
      alertVotesSnapshot: requester.alertVotes ?? 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    ok: true,
    convoyId,
  };
});

exports.respondConvoyJoinRequest = onCall(async (request) => {
  const actorUserId = requireAuth(request);
  const { convoyId, memberUserId, decision } = request.data ?? {};

  if (!convoyId || !memberUserId || !["approved", "declined"].includes(decision)) {
    throw new HttpsError("invalid-argument", "convoyId, memberUserId and valid decision are required.");
  }

  const convoyRef = db.collection("convoys").doc(convoyId);
  const memberRef = convoyRef.collection("members").doc(memberUserId);

  await db.runTransaction(async (transaction) => {
    const convoySnapshot = await transaction.get(convoyRef);
    if (!convoySnapshot.exists) {
      throw new HttpsError("not-found", "Convoy not found.");
    }

    const convoy = convoySnapshot.data();
    if (convoy?.hostUserId !== actorUserId) {
      throw new HttpsError("permission-denied", "Only the convoy host can moderate requests.");
    }

    const memberSnapshot = await transaction.get(memberRef);
    if (!memberSnapshot.exists) {
      throw new HttpsError("not-found", "Member request not found.");
    }

    transaction.update(memberRef, {
      status: decision,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return {
    ok: true,
    convoyId,
    memberUserId,
    decision,
  };
});

exports.inviteClanMember = onCall(async (request) => {
  const actorUserId = requireAuth(request);
  const { clanId, targetUserId } = request.data ?? {};

  if (!clanId || !targetUserId) {
    throw new HttpsError("invalid-argument", "clanId and targetUserId are required.");
  }

  const actor = await getUserProfile(actorUserId);
  const target = await getUserProfile(targetUserId);
  const inviteRef = db.collection("clans").doc(clanId).collection("invites").doc(`${targetUserId}`);

  await db.runTransaction(async (transaction) => {
    const existingInvite = await transaction.get(inviteRef);
    if (existingInvite.exists) {
      throw new HttpsError("already-exists", "Invite already exists.");
    }

    // TODO: Validate clan role/permissions against clan membership records.
    transaction.set(inviteRef, {
      clanId,
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

  return {
    ok: true,
    clanId,
    targetUserId,
  };
});
