const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCommunityContributionPatch,
  buildMapPinEditablePatch,
  buildMapPinDocument,
  buildWashRating,
  buildWashReviewDocument,
} = require("./map");

const profile = { plate: "06 PWA 101", fullName: "Poyraz Alkan", model: "Seat Ibiza" };

test("buildMapPinDocument keeps spot data public-safe and initializes counters", () => {
  const node = buildMapPinDocument({
    pinId: "spot-1", userId: "driver-1", profile, timestamp: "now",
    pin: { type: "spot", name: " Mogan  Sunset ", lat: 39.8, lng: 32.7, tags: "sunset, #smooth-asphalt" },
  });
  assert.equal(node.name, "Mogan Sunset");
  assert.deepEqual(node.tags, ["#sunset", "#smooth-asphalt"]);
  assert.equal(node.likes, 0);
  assert.equal(node.createdByUid, "driver-1");
});

test("map node edits preserve ownership and accept only mutable public fields", () => {
  const patch = buildMapPinEditablePatch(
    { type: "spot", createdByUid: "driver-1" },
    { name: " Yeni Spot ", description: " Gün batımı ", tags: ["ankara", "#sunset"] },
    "later",
  );
  assert.deepEqual(patch, {
    name: "Yeni Spot",
    description: "Gün batımı",
    tags: ["#ankara", "#sunset"],
    updatedAt: "later",
  });
  assert.equal(Object.hasOwn(patch, "createdByUid"), false);
});

test("wash rating replaces a driver's previous review instead of inflating totals", () => {
  const oldReview = buildWashReviewDocument({ pinId: "wash-1", userId: "driver-1", profile, timestamp: "then", review: { foam: 3, water: 4, allowsBuckets: false } });
  const nextReview = buildWashReviewDocument({ pinId: "wash-1", userId: "driver-1", profile, timestamp: "now", review: { foam: 5, water: 2, allowsBuckets: true } });
  const rating = buildWashRating({ foam: 3, water: 4, reviews: 1, allowsBuckets: 0, shadowDrying: 0 }, oldReview, nextReview);
  assert.deepEqual(rating, { foam: 5, water: 2, reviews: 1, allowsBuckets: 1, shadowDrying: 0 });
});

test("wash review helpful count can only be supplied by trusted server state", () => {
  const review = buildWashReviewDocument({
    pinId: "wash-1",
    userId: "driver-1",
    profile,
    review: { foam: 5, water: 5, helpfulCount: 999 },
    helpfulCount: 4,
    timestamp: "now",
  });
  assert.equal(review.helpfulCount, 4);
});

test("wash reviews keep optional image metadata together", () => {
  const review = buildWashReviewDocument({
    pinId: "wash-1",
    userId: "driver-1",
    profile,
    review: {
      foam: 5,
      water: 4,
      imageUrl: "https://example.test/wash.jpg",
      storagePath: "artifacts/cruiser-app-prod/mapNodes/wash-1/reviews/driver-1/wash.jpg",
    },
    timestamp: "now",
  });
  assert.equal(review.imageUrl, "https://example.test/wash.jpg");
  assert.match(review.storagePath, /wash-1\/reviews\/driver-1/);
  assert.throws(() => buildWashReviewDocument({
    pinId: "wash-1",
    userId: "driver-1",
    profile,
    review: { foam: 5, water: 4, imageUrl: "https://example.test/wash.jpg" },
    timestamp: "now",
  }), /metadata is incomplete/);
});

test("community contribution keeps safety score separate and applies weighted kudos", () => {
  const profileState = {
    driverScore: 83,
    communityEventLikesReceived: 3,
    communityPhotoLikesReceived: 2,
    communityHelpfulVotesReceived: 4,
  };
  const patch = buildCommunityContributionPatch(profileState, "communityHelpfulVotesReceived", 1);
  assert.deepEqual(patch, {
    communityEventLikesReceived: 3,
    communityPhotoLikesReceived: 2,
    communityHelpfulVotesReceived: 5,
    communityKudos: 15,
  });
  assert.equal(profileState.driverScore, 83);
});
