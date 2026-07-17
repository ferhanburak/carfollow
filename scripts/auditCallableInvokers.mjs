import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "carfollow-75750";
const REGION = "us-central1";
const execute = process.argv.includes("--execute");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice(10) ?? "";
const expectedConfirmation = "PUBLIC-CALLABLE-INVOKERS";
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function getFirebaseCliAuth() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is required to locate the Firebase CLI session.");
  return require(path.join(appData, "npm", "node_modules", "firebase-tools", "lib", "auth.js"));
}

async function getAccessToken() {
  const cliAuth = getFirebaseCliAuth();
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error("Run firebase login --reauth first.");
  const token = await cliAuth.getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ]);
  if (!token?.access_token) throw new Error("Firebase CLI did not return an access token.");
  return token.access_token;
}

async function requestJson(url, token, options = {}) {
  const method = options.method ?? "POST";
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify(options.body ?? {}) }),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text || "{}");
  } catch {
    throw new Error(`${url} returned non-JSON (${response.status}): ${text.slice(0, 160)}`);
  }
  if (!response.ok) throw new Error(`${url} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

function callableNames(source) {
  return [...source.matchAll(/exports\.([A-Za-z0-9_]+)\s*=\s*secureCall\(/g)].map((match) => match[1]);
}

function serviceUrl(name) {
  return `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${name.toLowerCase()}`;
}

async function main() {
  const source = await readFile(path.join(rootDir, "functions", "src", "index.js"), "utf8");
  const names = callableNames(source);
  const token = await getAccessToken();
  const missing = [];
  for (const name of names) {
    const policy = await requestJson(`${serviceUrl(name)}:getIamPolicy`, token, { method: "GET" });
    const isPublic = (policy.bindings ?? []).some((binding) =>
      binding.role === "roles/run.invoker" && (binding.members ?? []).includes("allUsers"),
    );
    if (!isPublic) missing.push({ name, policy });
  }
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", callableCount: names.length, missing: missing.map(({ name }) => name) }, null, 2));
  if (!execute || !missing.length) return;
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Execution guard failed. Use --confirm=${expectedConfirmation}`);
  }
  for (const { name, policy } of missing) {
    const bindings = [...(policy.bindings ?? [])];
    const invoker = bindings.find((binding) => binding.role === "roles/run.invoker");
    if (invoker) invoker.members = [...new Set([...(invoker.members ?? []), "allUsers"])];
    else bindings.push({ role: "roles/run.invoker", members: ["allUsers"] });
    await requestJson(`${serviceUrl(name)}:setIamPolicy`, token, {
      body: { policy: { ...policy, bindings } },
    });
  }
  console.log(JSON.stringify({ completed: true, updated: missing.map(({ name }) => name) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
