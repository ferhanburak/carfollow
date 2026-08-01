const MAP_SCHEMA_VERSION = 1;

function safeText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function safeTags(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : String(value ?? "").split(/[\s,]+/))
      .map((tag) => safeText(tag, 36).replace(/[^#\w-]/g, ""))
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
  )).slice(0, 8);
}

function projectDriver(profile, userId) {
  return {
    userId,
    plate: safeText(profile?.plate, 24),
    fullName: safeText(profile?.fullName, 80) || "TrackSnap Driver",
    model: safeText(profile?.model, 100),
  };
}

function buildMapPinDocument({ pinId, pin, profile, userId, timestamp }) {
  const type = safeText(pin?.type, 12);
  if (!["spot", "wash"].includes(type)) {
    throw new Error("Only spot and wash map nodes are supported.");
  }
  const lat = Number(pin?.lat);
  const lng = Number(pin?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error("A valid map location is required.");
  }
  const driver = projectDriver(profile, userId);
  const base = {
    id: pinId,
    type,
    name: safeText(pin?.name, 100),
    lat,
    lng,
    createdByUid: userId,
    createdByPlate: driver.plate,
    createdByName: driver.fullName,
    schemaVersion: MAP_SCHEMA_VERSION,
    likes: 0,
    galleryLikes: 0,
    photoCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  if (!base.name) throw new Error("A node name is required.");
  if (type === "spot") {
    return { ...base, description: safeText(pin?.description, 500), tags: safeTags(pin?.tags) };
  }
  return {
    ...base,
    rating: { foam: 0, water: 0, reviews: 0, allowsBuckets: 0, shadowDrying: 0 },
    ratingTotals: { foam: 0, water: 0, allowsBuckets: 0, shadowDrying: 0 },
  };
}

const COMMUNITY_CONTRIBUTION_WEIGHTS = Object.freeze({
  communityEventLikesReceived: 1,
  communityPhotoLikesReceived: 1,
  communityHelpfulVotesReceived: 2,
});

function buildCommunityContributionPatch(profile = {}, metric, delta) {
  if (!Object.prototype.hasOwnProperty.call(COMMUNITY_CONTRIBUTION_WEIGHTS, metric)) {
    throw new Error("Unsupported community contribution metric.");
  }
  const next = {};
  for (const key of Object.keys(COMMUNITY_CONTRIBUTION_WEIGHTS)) {
    next[key] = Math.max(0, Number(profile?.[key] ?? 0) + (key === metric ? Number(delta) : 0));
  }
  next.communityKudos = Object.entries(COMMUNITY_CONTRIBUTION_WEIGHTS)
    .reduce((total, [key, weight]) => total + next[key] * weight, 0);
  return next;
}

function buildWashReviewDocument({ pinId, userId, profile, review, helpfulCount = 0, timestamp }) {
  const foam = Number(review?.foam);
  const water = Number(review?.water);
  if (![foam, water].every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) {
    throw new Error("Wash scores must be between 1 and 5.");
  }
  return {
    id: `${pinId}__${userId}`,
    pinId,
    userId,
    author: safeText(profile?.plate, 24),
    foam,
    water,
    allowsBuckets: Boolean(review?.allowsBuckets),
    shadowDrying: Boolean(review?.shadowDrying),
    note: safeText(review?.note, 280),
    helpfulCount: Math.max(0, Number(helpfulCount ?? 0)),
    schemaVersion: MAP_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildWashRating(previousRating = {}, previousReview, nextReview) {
  const count = Math.max(0, Number(previousRating.reviews ?? 0) - (previousReview ? 1 : 0)) + 1;
  const previous = previousReview ?? { foam: 0, water: 0, allowsBuckets: false, shadowDrying: false };
  const totals = {
    foam: Number(previousRating.foam ?? 0) * Number(previousRating.reviews ?? 0) - previous.foam + nextReview.foam,
    water: Number(previousRating.water ?? 0) * Number(previousRating.reviews ?? 0) - previous.water + nextReview.water,
    allowsBuckets: Number(previousRating.allowsBuckets ?? 0) - (previous.allowsBuckets ? 1 : 0) + (nextReview.allowsBuckets ? 1 : 0),
    shadowDrying: Number(previousRating.shadowDrying ?? 0) - (previous.shadowDrying ? 1 : 0) + (nextReview.shadowDrying ? 1 : 0),
  };
  return {
    foam: Number((totals.foam / count).toFixed(1)), water: Number((totals.water / count).toFixed(1)), reviews: count,
    allowsBuckets: totals.allowsBuckets, shadowDrying: totals.shadowDrying,
  };
}

function buildSpotPhotoDocument({ photoId, pinId, userId, profile, title, imageUrl, storagePath, timestamp }) {
  return {
    id: photoId, pinId, userId, author: safeText(profile?.plate, 24), title: safeText(title, 100) || "Spot photo",
    imageUrl: safeText(imageUrl, 2048), storagePath: safeText(storagePath, 512), likes: 0,
    schemaVersion: MAP_SCHEMA_VERSION, createdAt: timestamp, updatedAt: timestamp,
  };
}

module.exports = {
  COMMUNITY_CONTRIBUTION_WEIGHTS,
  buildCommunityContributionPatch,
  buildMapPinDocument,
  buildSpotPhotoDocument,
  buildWashRating,
  buildWashReviewDocument,
  safeTags,
  safeText,
};
