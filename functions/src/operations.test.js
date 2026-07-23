const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildModerationAuditDocument,
  buildModerationReportDocument,
  buildNotificationDocument,
  getCommunityRoleLabel,
  hasModeratorClaim,
  isUserNotificationType,
} = require("./operations");

test("notification documents expose a bounded action projection", () => {
  const timestamp = { server: true };
  const notification = buildNotificationDocument({
    id: "friend-request-1",
    userId: "target-user",
    type: "friend-request",
    title: "Yeni arkadaslik istegi",
    body: "  Poyraz   seni eklemek istiyor. ",
    actor: { id: "actor-user", fullName: "Poyraz", plate: "06 PWA 101" },
    action: { type: "social", targetId: "actor-user" },
    timestamp,
  });

  assert.equal(notification.body, "Poyraz seni eklemek istiyor.");
  assert.equal(notification.actor.userId, "actor-user");
  assert.equal(notification.readAt, null);
});

test("user inbox accepts the approved social and convoy activity matrix", () => {
  assert.equal(isUserNotificationType("friend-request"), true);
  assert.equal(isUserNotificationType("convoy-invite"), true);
  assert.equal(isUserNotificationType("clan-role"), true);
  assert.equal(isUserNotificationType("convoy-response"), true);
  assert.equal(isUserNotificationType("convoy-cancelled"), true);
  assert.equal(isUserNotificationType("direct-message"), false);
  assert.equal(isUserNotificationType("convoy-started"), false);
  assert.equal(isUserNotificationType("maintenance-critical"), false);
});

test("community role labels are explicit for role-change notifications", () => {
  assert.equal(getCommunityRoleLabel("captain"), "Kaptan");
  assert.equal(getCommunityRoleLabel("manager"), "Konvoy yoneticisi");
  assert.equal(getCommunityRoleLabel("participant"), "Katilimci");
});

test("moderation reports reject unknown reasons and sanitize details", () => {
  const timestamp = { server: true };
  const report = buildModerationReportDocument({
    reportId: "report-1",
    reporter: { id: "reporter", plate: "06 TEST 01" },
    targetType: "driver",
    targetId: "target-user",
    reason: "dangerous-driving",
    details: "  Konvoyda   tehlikeli surus. ",
    timestamp,
  });

  assert.equal(report.details, "Konvoyda tehlikeli surus.");
  assert.equal(report.status, "open");
  assert.throws(() => buildModerationReportDocument({
    reportId: "bad",
    reporter: { id: "reporter" },
    targetType: "driver",
    targetId: "target-user",
    reason: "invented",
    timestamp,
  }));
});

test("moderation reports support public map photos", () => {
  const report = buildModerationReportDocument({
    reportId: "report-photo",
    reporter: { id: "driver-1", plate: "06 TEST 01" },
    targetType: "mapPhoto",
    targetId: "photo-1",
    reason: "inappropriate-content",
    details: "Unsafe image",
    timestamp: 123,
  });
  assert.equal(report.targetType, "mapPhoto");
  assert.equal(report.targetId, "photo-1");
});

test("moderation claims and audit decisions remain explicit", () => {
  assert.equal(hasModeratorClaim({ moderator: true }), true);
  assert.equal(hasModeratorClaim({ admin: true }), true);
  assert.equal(hasModeratorClaim({}), false);
  assert.equal(buildModerationAuditDocument({
    report: { id: "report-1", targetType: "driver", targetId: "target-user" },
    moderatorUserId: "moderator",
    decision: "warn",
    note: "First warning",
    timestamp: { server: true },
  }).decision, "warn");
});
