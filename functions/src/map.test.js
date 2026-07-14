const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMapPinDocument, buildWashRating, buildWashReviewDocument } = require("./map");

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

test("wash rating replaces a driver's previous review instead of inflating totals", () => {
  const oldReview = buildWashReviewDocument({ pinId: "wash-1", userId: "driver-1", profile, timestamp: "then", review: { foam: 3, water: 4, allowsBuckets: false } });
  const nextReview = buildWashReviewDocument({ pinId: "wash-1", userId: "driver-1", profile, timestamp: "now", review: { foam: 5, water: 2, allowsBuckets: true } });
  const rating = buildWashRating({ foam: 3, water: 4, reviews: 1, allowsBuckets: 0, shadowDrying: 0 }, oldReview, nextReview);
  assert.deepEqual(rating, { foam: 5, water: 2, reviews: 1, allowsBuckets: 1, shadowDrying: 0 });
});
