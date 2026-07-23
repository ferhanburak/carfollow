const FORUM_CATEGORIES = new Set(["places", "builds", "technical", "roadlife"]);

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildForumThreadDocument({ id, input, profile, timestamp }) {
  const category = String(input?.category ?? "");
  const title = cleanText(input?.title, 100);
  const body = cleanText(input?.body, 2400);
  if (!FORUM_CATEGORIES.has(category)) throw new Error("Gecerli bir forum kategorisi secin.");
  if (title.length < 4 || body.length < 8) throw new Error("Baslik ve paylasim metni cok kisa.");

  return {
    id,
    category,
    title,
    body,
    location: category === "places" ? cleanText(input?.location, 160) : "",
    setup: category === "builds" ? cleanText(input?.setup, 300) : "",
    vehicleKm: category === "technical" ? Math.max(0, Math.round(Number(input?.vehicleKm ?? 0))) : 0,
    authorUserId: profile.userId,
    authorName: cleanText(profile.fullName, 100),
    authorPlate: cleanText(profile.plate, 20),
    authorModel: cleanText(profile.model, 120),
    likeCount: 0,
    replyCount: 0,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildForumReplyDocument({ id, threadId, body, profile, timestamp }) {
  const cleanBody = cleanText(body, 1200);
  if (cleanBody.length < 2) throw new Error("Yanit metni cok kisa.");
  return {
    id,
    threadId,
    body: cleanBody,
    authorUserId: profile.userId,
    authorName: cleanText(profile.fullName, 100),
    authorPlate: cleanText(profile.plate, 20),
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

module.exports = {
  FORUM_CATEGORIES,
  buildForumReplyDocument,
  buildForumThreadDocument,
};
