const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDirectMessage,
  buildDirectMessageThreadId,
  buildThreadMetadata,
  sanitizeMessageBody,
} = require("./directMessages");

const left = { id: "driver-b", plate: "06 LEFT 06", fullName: "Left Driver", model: "Seat Ibiza" };
const right = { id: "driver-a", plate: "34 RIGHT 34", fullName: "Right Driver", model: "Yamaha R6" };

test("direct message thread ids are stable by Firebase uid", () => {
  const first = buildDirectMessageThreadId("driver-b", "driver-a");
  assert.equal(first, buildDirectMessageThreadId("driver-a", "driver-b"));
  assert.match(first, /^dm_[a-f0-9]{64}$/);
});

test("thread metadata maps immutable participants by uid", () => {
  const metadata = buildThreadMetadata({ threadId: "thread-1", leftProfile: left, rightProfile: right, timestamp: 10 });
  assert.deepEqual(metadata.participantUids, { "driver-b": true, "driver-a": true });
  assert.equal(metadata.participantProfiles["driver-a"].plate, "34 RIGHT 34");
});

test("messages use server-owned sender identity and sanitized body", () => {
  const message = buildDirectMessage({ messageId: "message-1", senderProfile: left, body: "  Merhaba  ", timestamp: 20 });
  assert.equal(message.senderUid, "driver-b");
  assert.equal(message.body, "Merhaba");
  assert.throws(() => sanitizeMessageBody(" "));
  assert.throws(() => sanitizeMessageBody("x".repeat(2001)));
});
