const test = require("node:test");
const assert = require("node:assert/strict");
const { buildForumReplyDocument, buildForumThreadDocument } = require("./forum");

const profile = { userId: "user-1", fullName: "Test Driver", plate: "06 TEST 01", model: "Golf GTI" };

test("buildForumThreadDocument keeps only category-specific metadata", () => {
  const thread = buildForumThreadDocument({
    id: "thread-1",
    input: { category: "places", title: "Mogan rotasi", body: "Gun batiminda guzel bir surus rotasi.", location: "Mogan Golu", setup: "ignored" },
    profile,
    timestamp: 123,
  });
  assert.equal(thread.location, "Mogan Golu");
  assert.equal(thread.setup, "");
  assert.equal(thread.likeCount, 0);
});

test("buildForumReplyDocument rejects empty replies", () => {
  assert.throws(() => buildForumReplyDocument({ id: "reply-1", threadId: "thread-1", body: " ", profile, timestamp: 123 }));
});
