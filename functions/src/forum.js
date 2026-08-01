const FORUM_CATEGORIES = new Set(["places", "builds", "technical", "roadlife"]);

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeForumLocation(value) {
  if (!value || typeof value !== "object") return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    throw new Error("Geçerli bir konum seçin.");
  }
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    accuracy: Math.max(0, Math.min(5000, Math.round(Number(value.accuracy) || 0))),
    label: cleanText(value.label, 120) || "Paylaşılan konum",
  };
}

function buildForumThreadDocument({ id, input, profile, timestamp }) {
  const category = String(input?.category ?? "");
  const body = cleanText(input?.body, 2400);
  if (!FORUM_CATEGORIES.has(category)) throw new Error("Geçerli bir forum kategorisi secin.");
  if (body.length < 8) throw new Error("Paylaşım metni çok kısa.");

  return {
    id,
    category,
    body,
    imageUrl: cleanText(input?.imageUrl, 2048),
    storagePath: cleanText(input?.storagePath, 512),
    location: normalizeForumLocation(input?.location),
    authorUserId: profile.userId,
    authorName: cleanText(profile.fullName, 100),
    authorPlate: cleanText(profile.plate, 20),
    authorModel: cleanText(profile.model, 120),
    likeCount: 0,
    replyCount: 0,
    pinnedReplyId: null,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildForumReplyDocument({ id, threadId, body, profile, timestamp }) {
  const cleanBody = cleanText(body, 1200);
  if (cleanBody.length < 2) throw new Error("Yanıt metni çok kısa.");
  return {
    id,
    threadId,
    body: cleanBody,
    authorUserId: profile.userId,
    authorName: cleanText(profile.fullName, 100),
    authorPlate: cleanText(profile.plate, 20),
    authorModel: cleanText(profile.model, 120),
    likeCount: 0,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function supportsPinnedSolution(category) {
  return category === "technical" || category === "builds";
}

module.exports = {
  FORUM_CATEGORIES,
  buildForumReplyDocument,
  buildForumThreadDocument,
  normalizeForumLocation,
  supportsPinnedSolution,
};
