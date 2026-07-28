const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

function evaluateRateLimit(current, { limit, windowSeconds, nowMs }) {
  const state = current && typeof current === "object" ? current : {};
  const windowEndMs = Number(state.windowEndMs ?? 0);
  const isCurrentWindow = windowEndMs > nowMs;
  const nextCount = isCurrentWindow ? Number(state.count ?? 0) + 1 : 1;

  if (isCurrentWindow && nextCount > limit) {
    return { allowed: false, state };
  }

  const nextWindowEndMs = isCurrentWindow ? windowEndMs : nowMs + windowSeconds * 1000;
  return {
    allowed: true,
    state: {
      count: nextCount,
      windowStartMs: isCurrentWindow ? Number(state.windowStartMs ?? nowMs) : nowMs,
      windowEndMs: nextWindowEndMs,
      expiresAtMs: nextWindowEndMs + RATE_LIMIT_RETENTION_MS,
      updatedAtMs: nowMs,
    },
  };
}

module.exports = {
  RATE_LIMIT_RETENTION_MS,
  evaluateRateLimit,
};
