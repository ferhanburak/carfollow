const DIRECT_MESSAGE_SCHEMA_VERSION = 1;
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

function buildDirectMessage({ messageId, senderProfile, body, timestamp }) {
  const sender = projectChatProfile(senderProfile);
  return {
    id: messageId,
    senderUid: sender.userId,
    authorPlate: sender.plate,
    authorName: sender.fullName,
    body: sanitizeMessageBody(body),
    createdAt: timestamp,
    schemaVersion: DIRECT_MESSAGE_SCHEMA_VERSION,
  };
}

module.exports = {
  DIRECT_MESSAGE_SCHEMA_VERSION,
  buildDirectMessage,
  buildDirectMessageThreadId,
  buildThreadMetadata,
  projectChatProfile,
  sanitizeMessageBody,
};
