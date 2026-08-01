const crypto = require("node:crypto");

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TOKEN_PATTERN = /^(Expo(nent)?PushToken)\[[A-Za-z0-9_-]+\]$/;
const PUSH_BATCH_SIZE = 100;

function cleanPushText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeExpoPushToken(value) {
  const token = cleanPushText(value, 240);
  if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) {
    throw new Error("A valid Expo push token is required.");
  }
  return token;
}

function hashPushToken(token) {
  return crypto.createHash("sha256").update(normalizeExpoPushToken(token)).digest("hex");
}

function normalizePushData(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .map(([key, item]) => [cleanPushText(key, 64), item]));
}

function buildPushOutboxDocument({ id, userId, title, body, type, targetId, data, timestamp }) {
  return {
    id: cleanPushText(id, 180),
    userId: cleanPushText(userId, 128),
    title: cleanPushText(title, 80),
    body: cleanPushText(body, 240),
    type: cleanPushText(type, 48),
    targetId: cleanPushText(targetId, 180),
    data: normalizePushData(data),
    status: "pending",
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildDirectMessagePush({ messageId, recipientUserId, senderName, senderUserId, threadId, timestamp }) {
  const safeSenderName = cleanPushText(senderName, 80) || "Bir sürücü";
  return buildPushOutboxDocument({
    id: `direct-message-${cleanPushText(messageId, 128)}`,
    userId: recipientUserId,
    title: "Yeni mesaj",
    body: `${safeSenderName}'den yeni bir mesajınız var.`,
    type: "direct-message",
    targetId: threadId,
    data: {
      senderUserId: cleanPushText(senderUserId, 128),
      threadId: cleanPushText(threadId, 180),
    },
    timestamp,
  });
}

function chunkPushMessages(values, size = PUSH_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function sendExpoPushMessages(tokens, payload, fetchImpl = globalThis.fetch) {
  const uniqueTokens = [...new Set(tokens.map(normalizeExpoPushToken))];
  if (!uniqueTokens.length) return { sent: 0, invalidTokens: [] };
  if (typeof fetchImpl !== "function") throw new Error("Push transport is unavailable.");

  const invalidTokens = [];
  let sent = 0;
  for (const tokenBatch of chunkPushMessages(uniqueTokens)) {
    const messages = tokenBatch.map((to) => ({
      to,
      title: cleanPushText(payload.title, 80),
      body: cleanPushText(payload.body, 240),
      data: {
        type: cleanPushText(payload.type, 48),
        targetId: cleanPushText(payload.targetId, 180),
        ...normalizePushData(payload.data),
      },
      sound: "default",
      priority: "high",
      channelId: "cruiser-alerts",
    }));
    const response = await fetchImpl(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      throw new Error(`Expo push request failed with ${response.status}.`);
    }
    const responseBody = await response.json();
    const tickets = Array.isArray(responseBody?.data) ? responseBody.data : [];
    tickets.forEach((ticket, index) => {
      if (ticket?.status === "ok") {
        sent += 1;
        return;
      }
      if (ticket?.details?.error === "DeviceNotRegistered") {
        invalidTokens.push(tokenBatch[index]);
      }
    });
  }
  return { sent, invalidTokens };
}

module.exports = {
  buildDirectMessagePush,
  buildPushOutboxDocument,
  chunkPushMessages,
  hashPushToken,
  normalizeExpoPushToken,
  sendExpoPushMessages,
};
