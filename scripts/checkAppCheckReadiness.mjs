import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readEnv(filePath) {
  const contents = await readFile(filePath, "utf8").catch(() => "");
  return Object.fromEntries(contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
}

const [webEnv, functionsEnv] = await Promise.all([
  readEnv(path.join(rootDir, ".env")),
  readEnv(path.join(rootDir, "functions", ".env.carfollow-75750")),
]);
const siteKey = process.env.VITE_FIREBASE_APPCHECK_SITE_KEY || webEnv.VITE_FIREBASE_APPCHECK_SITE_KEY || "";
const domains = (process.env.CARFOLLOW_APP_CHECK_DOMAINS || webEnv.CARFOLLOW_APP_CHECK_DOMAINS || "")
  .split(",")
  .map((domain) => domain.trim())
  .filter(Boolean);
const enforcementEnabled = functionsEnv.ENFORCE_APP_CHECK === "true";
const blockers = [];
if (!siteKey) blockers.push("VITE_FIREBASE_APPCHECK_SITE_KEY is missing from the production web environment.");
if (!domains.length) blockers.push("CARFOLLOW_APP_CHECK_DOMAINS must list the production and preview domains.");
if (!functionsEnv.ENFORCE_APP_CHECK) blockers.push("functions/.env.carfollow-75750 has not been created from functions/.env.example.");

const status = {
  projectId: "carfollow-75750",
  provider: "reCAPTCHA v3",
  siteKeyConfigured: Boolean(siteKey),
  registeredDomains: domains,
  functionEnforcement: enforcementEnabled ? "enabled" : "monitoring",
  readyForMetrics: Boolean(siteKey && domains.length),
  readyForEnforcement: Boolean(siteKey && domains.length && functionsEnv.ENFORCE_APP_CHECK),
  blockers,
};
console.log(JSON.stringify(status, null, 2));

if (enforcementEnabled && blockers.length) {
  throw new Error("App Check enforcement is enabled with an incomplete client configuration. Disable it or fix every blocker before deployment.");
}
