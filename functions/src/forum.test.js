const test = require("node:test");
const assert = require("node:assert/strict");
const { buildForumReplyDocument, buildForumThreadDocument, supportsPinnedSolution } = require("./forum");

const profile = { userId: "user-1", fullName: "Test Driver", plate: "06 TEST 01", model: "Golf GTI" };

test("buildForumThreadDocument keeps only category-specific metadata", () => {
  const thread = buildForumThreadDocument({
    id: "thread-1",
    input: {
      category: "places",
      body: "Gün batımında güzel bir sürüş rotası.",
      location: { lat: 39.7654321, lng: 32.8123456, accuracy: 14.6, label: "Gölbaşı / Ankara" },
      setup: "ignored",
      imageUrl: "https://firebasestorage.googleapis.com/forum.jpg",
      storagePath: "artifacts/cruiser-app-prod/forumThreads/user-1/forum.jpg",
    },
    profile,
    timestamp: 123,
  });
  assert.deepEqual(thread.location, {
    lat: 39.765432,
    lng: 32.812346,
    accuracy: 15,
    label: "Gölbaşı / Ankara",
  });
  assert.equal("setup" in thread, false);
  assert.equal("vehicleKm" in thread, false);
  assert.equal(thread.imageUrl, "https://firebasestorage.googleapis.com/forum.jpg");
  assert.equal(thread.storagePath, "artifacts/cruiser-app-prod/forumThreads/user-1/forum.jpg");
  assert.equal("title" in thread, false);
  assert.equal(thread.likeCount, 0);
  assert.equal(thread.pinnedReplyId, null);
});

test("buildForumReplyDocument rejects empty replies", () => {
  assert.throws(() => buildForumReplyDocument({ id: "reply-1", threadId: "thread-1", body: " ", profile, timestamp: 123 }));
});

test("forum replies initialize like metadata and keep the vehicle model", () => {
  const reply = buildForumReplyDocument({
    id: "reply-1",
    threadId: "thread-1",
    body: "Check the oil pressure sensor too.",
    profile,
    timestamp: 123,
  });
  assert.equal(reply.authorModel, "Golf GTI");
  assert.equal(reply.likeCount, 0);
});

test("only technical and build threads support pinned solutions", () => {
  assert.equal(supportsPinnedSolution("technical"), true);
  assert.equal(supportsPinnedSolution("builds"), true);
  assert.equal(supportsPinnedSolution("places"), false);
  assert.equal(supportsPinnedSolution("roadlife"), false);
});
