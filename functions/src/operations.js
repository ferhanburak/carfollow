const MODERATION_REASONS = Object.freeze([
  "dangerous-driving",
  "harassment",
  "spam",
  "false-information",
  "inappropriate-content",
  "other",
]);

const MODERATION_TARGET_TYPES = Object.freeze(["driver", "mapPin", "mapPhoto", "convoy", "message", "clan"]);
const MODERATION_DECISIONS = Object.freeze(["dismiss", "warn", "restrict"]);
const USER_NOTIFICATION_TYPES = Object.freeze(["friend-request", "convoy-invite"]);

function sanitizeOperationalText(value, maxLength) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function buildNotificationDocument({ id, userId, type, title, body, actor, action, timestamp }) {
  return {
    id: sanitizeOperationalText(id, 180),
    userId: String(userId ?? ""),
    type: sanitizeOperationalText(type, 48),
    title: sanitizeOperationalText(title, 80),
    body: sanitizeOperationalText(body, 240),
    actor: {
      userId: String(actor?.userId ?? actor?.id ?? ""),
      fullName: sanitizeOperationalText(actor?.fullName, 80),
      plate: sanitizeOperationalText(actor?.plate, 24),
    },
    action: {
      type: sanitizeOperationalText(action?.type, 48),
      targetId: sanitizeOperationalText(action?.targetId, 180),
    },
    readAt: null,
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isUserNotificationType(type) {
  return USER_NOTIFICATION_TYPES.includes(String(type ?? ""));
}

function buildModerationReportDocument({ reportId, reporter, targetType, targetId, reason, details, timestamp }) {
  if (!MODERATION_TARGET_TYPES.includes(targetType)) {
    throw new Error("Unsupported moderation target type.");
  }
  if (!MODERATION_REASONS.includes(reason)) {
    throw new Error("Unsupported moderation reason.");
  }

  const safeTargetId = sanitizeOperationalText(targetId, 180);
  if (!safeTargetId || safeTargetId.includes("/")) {
    throw new Error("A valid moderation target is required.");
  }

  return {
    id: reportId,
    reporterUserId: String(reporter?.id ?? reporter?.userId ?? ""),
    reporterPlate: sanitizeOperationalText(reporter?.plate, 24),
    targetType,
    targetId: safeTargetId,
    reason,
    details: sanitizeOperationalText(details, 500),
    status: "open",
    assignedModeratorId: null,
    decision: null,
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildModerationAuditDocument({ report, moderatorUserId, decision, note, timestamp }) {
  if (!MODERATION_DECISIONS.includes(decision)) {
    throw new Error("Unsupported moderation decision.");
  }

  return {
    reportId: String(report?.id ?? ""),
    targetType: String(report?.targetType ?? ""),
    targetId: String(report?.targetId ?? ""),
    moderatorUserId: String(moderatorUserId ?? ""),
    decision,
    note: sanitizeOperationalText(note, 500),
    schemaVersion: 1,
    createdAt: timestamp,
  };
}

function hasModeratorClaim(token = {}) {
  return token.admin === true || token.moderator === true;
}

module.exports = {
  MODERATION_DECISIONS,
  MODERATION_REASONS,
  MODERATION_TARGET_TYPES,
  USER_NOTIFICATION_TYPES,
  buildModerationAuditDocument,
  buildModerationReportDocument,
  buildNotificationDocument,
  hasModeratorClaim,
  isUserNotificationType,
  sanitizeOperationalText,
};
