const FORUM_CATEGORIES = new Set(["places", "builds", "technical", "roadlife"]);
const FORUM_POLL_DURATIONS_HOURS = new Set([24, 72, 168]);

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

function normalizeForumPoll(value, nowMs = Date.now()) {
  if (!value || typeof value !== "object") return null;
  const labels = (Array.isArray(value.options) ? value.options : [])
    .map((option) => cleanText(typeof option === "string" ? option : option?.text, 80))
    .filter(Boolean);
  const uniqueLabels = [...new Set(labels.map((label) => label.toLocaleLowerCase("tr-TR")))];
  if (labels.length < 2 || labels.length > 4 || uniqueLabels.length !== labels.length) {
    throw new Error("Anket icin 2-4 benzersiz secenek girin.");
  }
  const durationHours = Number(value.durationHours);
  if (!FORUM_POLL_DURATIONS_HOURS.has(durationHours)) {
    throw new Error("Gecerli bir anket suresi secin.");
  }
  return {
    options: labels.map((text, index) => ({ id: `option-${index + 1}`, text, voteCount: 0 })),
    totalVotes: 0,
    durationHours,
    expiresAtMs: Math.round(nowMs + durationHours * 60 * 60 * 1000),
  };
}

function normalizeForumMentions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((mention) => ({
    userId: cleanText(mention?.userId, 180),
    fullName: cleanText(mention?.fullName, 100),
    model: cleanText(mention?.model, 120),
  })).filter((mention) => mention.userId && mention.fullName);
}

function normalizeForumEventReference(value) {
  if (!value || typeof value !== "object") return null;
  const eventId = cleanText(value.eventId, 180);
  const name = cleanText(value.name, 120);
  if (!eventId || eventId.includes("/") || !name) return null;
  return {
    eventId,
    name,
    eventMode: value.eventMode === "convoy" ? "convoy" : "meetup",
    scheduledStartAtMs: Math.max(0, Math.round(Number(value.scheduledStartAtMs) || 0)),
  };
}

function buildForumThreadDocument({ id, input, profile, timestamp, nowMs = Date.now() }) {
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
    poll: normalizeForumPoll(input?.poll, nowMs),
    mentions: normalizeForumMentions(input?.mentions),
    eventReference: normalizeForumEventReference(input?.eventReference),
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
  FORUM_POLL_DURATIONS_HOURS,
  buildForumReplyDocument,
  buildForumThreadDocument,
  normalizeForumEventReference,
  normalizeForumLocation,
  normalizeForumMentions,
  normalizeForumPoll,
  supportsPinnedSolution,
};
