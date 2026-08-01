const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildDirectMessagePush,
  buildPushOutboxDocument,
  chunkPushMessages,
  hashPushToken,
  normalizeExpoPushToken,
} = require("./pushNotifications");

const TOKEN = "ExponentPushToken[track-snap-device-1]";

test("Expo push tokens are validated and hashed deterministically", () => {
  assert.equal(normalizeExpoPushToken(` ${TOKEN} `), TOKEN);
  assert.equal(hashPushToken(TOKEN), hashPushToken(TOKEN));
  assert.throws(() => normalizeExpoPushToken("not-a-token"));
});

test("direct message pushes omit message content", () => {
  const push = buildDirectMessagePush({
    messageId: "message-1",
    recipientUserId: "user-b",
    senderName: "Eylül",
    senderUserId: "user-a",
    threadId: "thread-1",
    timestamp: 123,
  });
  assert.equal(push.body, "Eylül'den yeni bir mesajınız var.");
  assert.equal(push.type, "direct-message");
  assert.equal("message" in push.data, false);
});

test("outbox payloads keep bounded primitive navigation data", () => {
  const push = buildPushOutboxDocument({
    id: "forum-like-1",
    userId: "user-b",
    title: "Yeni beğeni",
    body: "Eylül gönderini beğendi.",
    type: "forum-like",
    targetId: "thread-1",
    data: { threadId: "thread-1", nested: { unsafe: true } },
    timestamp: 123,
  });
  assert.deepEqual(push.data, { threadId: "thread-1" });
  assert.equal(push.status, "pending");
});

test("push messages are split into Expo-sized batches", () => {
  assert.deepEqual(chunkPushMessages([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
