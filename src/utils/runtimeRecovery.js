const STALE_ASSET_PATTERNS = [
  "chunkloaderror",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "expected a javascript-or-wasm module script",
];

const RELOAD_TIMESTAMP_KEY = "cruiser:last-stale-deploy-reload";
const RELOAD_COOLDOWN_MS = 60_000;
let reloadRequested = false;

export function isStaleAssetError(error) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return STALE_ASSET_PATTERNS.some((pattern) => message.includes(pattern));
}

export function requestFreshDeploymentReload(error) {
  if (!isStaleAssetError(error) || reloadRequested || typeof window === "undefined") {
    return false;
  }

  const now = Date.now();
  let lastReloadAt = 0;

  try {
    lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_TIMESTAMP_KEY)) || 0;
  } catch {
    // A blocked storage API must not prevent recovery from a stale deployment.
  }

  if (now - lastReloadAt < RELOAD_COOLDOWN_MS) {
    return false;
  }

  reloadRequested = true;
  try {
    window.sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, String(now));
  } catch {
    // The in-memory guard still prevents a reload loop for this page instance.
  }
  window.location.reload();
  return true;
}

export function clearDeploymentReloadGuard() {
  reloadRequested = false;
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(RELOAD_TIMESTAMP_KEY);
  } catch {
    // Storage can be unavailable in strict privacy modes.
  }
}
