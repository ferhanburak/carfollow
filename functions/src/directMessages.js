const DIRECT_MESSAGE_SCHEMA_VERSION = 2;
const { createHash } = require("node:crypto");

function buildDirectMessageThreadId(leftUserId, rightUserId) {
  const identity = [String(leftUserId), String(rightUserId)]
    .sort((left, right) => left.localeCompare(right))
    .join("\u0000");
  return `dm_${createHash("sha256").update(identity).digest("hex")}`;
}

function sanitizeMessageBody(value) {
  const body = String(value ?? "").trim().replace(/\r\n/g, "\n");
  if (!body || body.length > 2000) {
    throw new Error("Message must be between 1 and 2000 characters.");
  }
  return body;
}

function sanitizeSharedContent(value) {
  if (value == null) return null;
  if (!value || typeof value !== "object" || !["forum", "event"].includes(value.type)) {
    throw new Error("A valid shared item is required.");
  }
  const targetId = String(value.targetId ?? "").trim();
  if (!targetId || targetId.includes("/") || targetId.length > 160) {
    throw new Error("A valid shared item target is required.");
  }
  return {
    type: value.type,
    targetId,
    title: String(value.title ?? "").trim().slice(0, 120),
    preview: String(value.preview ?? "").trim().slice(0, 320),
    imageUrl: String(value.imageUrl ?? "").trim().slice(0, 2048),
  };
}

function projectChatProfile(profile, fallbackUserId = "") {
  const userId = String(profile?.userId ?? profile?.firebaseUid ?? profile?.id ?? fallbackUserId);
  return {
    userId,
    plate: String(profile?.plate ?? "").slice(0, 24),
    fullName: String(profile?.fullName ?? profile?.plate ?? "CRUISER Driver").slice(0, 80),
    model: String(profile?.model ?? "").slice(0, 100),
    avatar: String(profile?.avatar ?? "").slice(0, 2048),
  };
}

function buildThreadMetadata({ threadId, leftProfile, rightProfile, timestamp }) {
  const left = projectChatProfile(leftProfile);
  const right = projectChatProfile(rightProfile);
  return {
    id: threadId,
    participantUids: { [left.userId]: true, [right.userId]: true },
    participantProfiles: { [left.userId]: left, [right.userId]: right },
    schemaVersion: DIRECT_MESSAGE_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildThreadSetupUpdates({ threadId, leftProfile, rightProfile, timestamp }) {
  const metadata = buildThreadMetadata({ threadId, leftProfile, rightProfile, timestamp });
  const leftUserId = String(leftProfile?.userId ?? leftProfile?.firebaseUid ?? leftProfile?.id ?? "");
  const rightUserId = String(rightProfile?.userId ?? rightProfile?.firebaseUid ?? rightProfile?.id ?? "");
  return {
    [`threads/${threadId}/id`]: threadId,
    [`threads/${threadId}/participantUids`]: metadata.participantUids,
    [`threads/${threadId}/participantProfiles`]: metadata.participantProfiles,
    [`threads/${threadId}/schemaVersion`]: metadata.schemaVersion,
    [`threads/${threadId}/createdAt`]: timestamp,
    [`threads/${threadId}/updatedAt`]: timestamp,
    [`userThreads/${leftUserId}/${threadId}/threadId`]: threadId,
    [`userThreads/${leftUserId}/${threadId}/counterpartUid`]: rightUserId,
    [`userThreads/${leftUserId}/${threadId}/updatedAt`]: timestamp,
    [`userThreads/${rightUserId}/${threadId}/threadId`]: threadId,
    [`userThreads/${rightUserId}/${threadId}/counterpartUid`]: leftUserId,
    [`userThreads/${rightUserId}/${threadId}/updatedAt`]: timestamp,
  };
}

function buildDirectMessage({ messageId, senderProfile, body, share = null, timestamp }) {
  const sender = projectChatProfile(senderProfile);
  const message = {
    id: messageId,
    senderUid: sender.userId,
    authorPlate: sender.plate,
    authorName: sender.fullName,
    body: sanitizeMessageBody(body),
    createdAt: timestamp,
    schemaVersion: DIRECT_MESSAGE_SCHEMA_VERSION,
  };
  const sharedContent = sanitizeSharedContent(share);
  if (sharedContent) message.share = sharedContent;
  return message;
}

module.exports = {
  DIRECT_MESSAGE_SCHEMA_VERSION,
  buildDirectMessage,
  buildDirectMessageThreadId,
  buildThreadMetadata,
  buildThreadSetupUpdates,
  projectChatProfile,
  sanitizeMessageBody,
  sanitizeSharedContent,
};
