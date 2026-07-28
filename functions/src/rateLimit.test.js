const test = require("node:test");
const assert = require("node:assert/strict");
const { RATE_LIMIT_RETENTION_MS, evaluateRateLimit } = require("./rateLimit");

test("starts a new fixed rate-limit window", () => {
  const nowMs = 1_000;
  const result = evaluateRateLimit(null, { limit: 2, windowSeconds: 60, nowMs });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.state, {
    count: 1,
    windowStartMs: nowMs,
    windowEndMs: nowMs + 60_000,
    expiresAtMs: nowMs + 60_000 + RATE_LIMIT_RETENTION_MS,
    updatedAtMs: nowMs,
  });
});

test("increments an active window and rejects requests over the limit", () => {
  const current = { count: 1, windowStartMs: 1_000, windowEndMs: 61_000 };
  const accepted = evaluateRateLimit(current, { limit: 2, windowSeconds: 60, nowMs: 2_000 });
  const rejected = evaluateRateLimit(accepted.state, { limit: 2, windowSeconds: 60, nowMs: 3_000 });

  assert.equal(accepted.allowed, true);
  assert.equal(accepted.state.count, 2);
  assert.equal(rejected.allowed, false);
  assert.deepEqual(rejected.state, accepted.state);
});

test("resets an expired rate-limit window", () => {
  const result = evaluateRateLimit(
    { count: 99, windowStartMs: 1_000, windowEndMs: 2_000 },
    { limit: 2, windowSeconds: 30, nowMs: 2_000 },
  );

  assert.equal(result.allowed, true);
  assert.equal(result.state.count, 1);
  assert.equal(result.state.windowStartMs, 2_000);
  assert.equal(result.state.windowEndMs, 32_000);
});
