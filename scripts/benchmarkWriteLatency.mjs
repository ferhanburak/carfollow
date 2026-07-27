import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "carfollow-75750";
const APP_ID = "cruiser-app-prod";
const FUNCTIONS_BASE = `https://us-central1-${PROJECT_ID}.cloudfunctions.net`;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runId = Date.now().toString();
const suffix = runId.slice(-6);

async function readApiKey() {
  const contents = await readFile(path.join(rootDir, ".env"), "utf8").catch(() => "");
  const apiKey = contents.match(/^VITE_FIREBASE_API_KEY=(.+)$/m)?.[1]?.trim() ?? "";
  if (!apiKey) throw new Error("VITE_FIREBASE_API_KEY is missing from .env.");
  return apiKey;
}

async function parseResponse(response, label) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON (${response.status}).`);
  }
  if (!response.ok || payload.error) {
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(payload.error ?? payload)}`);
  }
  return payload;
}

async function createAccount(apiKey, label) {
  const password = `Latency!${runId}`;
  const email = `cruiser.latency.${label.toLowerCase()}.${runId}@example.com`;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = await parseResponse(response, `Create ${label}`);
  return { idToken: payload.idToken, uid: payload.localId, email };
}

async function callFunction(name, account, data = {}) {
  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${account.idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const payload = await parseResponse(response, name);
  return payload.result;
}

async function measure(label, action, results) {
  const startedAt = performance.now();
  const value = await action();
  const durationMs = Math.round(performance.now() - startedAt);
  results.push({ label, durationMs });
  console.log(`${label}: ${durationMs} ms`);
  return value;
}

function registrationProfile(account, label, index) {
  return {
    id: account.uid,
    firebaseUid: account.uid,
    primaryVehicleId: `vehicle-${account.uid}`,
    fullName: `Latency Driver ${label}`,
    plate: `99 LT ${index}${suffix}`,
    model: label === "A" ? "Latency Coupe" : "Latency Roadster",
    garage: "",
    region: "Ankara",
    tuningStage: "Stock",
    vehicleType: "car",
    horsepower: 100,
    odometer: 10000,
    avatar: "",
    parts: [],
  };
}

function getFirebaseCliAccessToken() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is required for Firebase CLI authentication.");
  const cliAuth = require(path.join(appData, "npm", "node_modules", "firebase-tools", "lib", "auth.js"));
  const account = cliAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error("Run firebase login --reauth before benchmarking.");
  return cliAuth.getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ]);
}

async function deleteForumFixtures(threadIds) {
  if (!threadIds.length) return;
  const token = await getFirebaseCliAccessToken();
  const accessToken = token?.access_token;
  if (!accessToken) throw new Error("Firebase CLI did not return an access token.");
  const names = threadIds.map((threadId) => (
    `projects/${PROJECT_ID}/databases/(default)/documents/artifacts/${APP_ID}/public/data/forumThreads/${threadId}`
  ));
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ writes: names.map((name) => ({ delete: name })) }),
    },
  );
  await parseResponse(response, "Delete forum benchmark fixtures");
}

function summarize(results) {
  const values = results.map((item) => item.durationMs).sort((left, right) => left - right);
  const median = values[Math.floor(values.length / 2)] ?? 0;
  return {
    samples: results.length,
    minMs: values[0] ?? 0,
    medianMs: median,
    maxMs: values.at(-1) ?? 0,
  };
}

async function main() {
  const apiKey = await readApiKey();
  const results = [];
  const forumThreadIds = [];
  const accountA = await createAccount(apiKey, "A");
  const accountB = await createAccount(apiKey, "B");
  let clanId = "";
  let accountsDeleted = false;
  console.log(`Temporary benchmark users: ${accountA.uid}, ${accountB.uid}`);

  try {
    await callFunction("finalizeRegistration", accountA, {
      profile: registrationProfile(accountA, "A", 1),
      acceptTerms: true,
      acceptPlateSearch: true,
    });
    await callFunction("finalizeRegistration", accountB, {
      profile: registrationProfile(accountB, "B", 2),
      acceptTerms: true,
      acceptPlateSearch: true,
    });

    for (let index = 1; index <= 3; index += 1) {
      await measure(`profile_open_${index}`, () => callFunction(
        "getPublicDriverProfile",
        accountA,
        { targetUserId: accountB.uid },
      ), results);
    }

    await measure("friend_request_1", () => callFunction(
      "requestFriendship",
      accountA,
      { targetUserId: accountB.uid },
    ), results);
    await callFunction("cancelFriendshipRequest", accountA, { targetUserId: accountB.uid });
    await measure("friend_request_2", () => callFunction(
      "requestFriendship",
      accountA,
      { targetUserId: accountB.uid },
    ), results);
    await callFunction("respondFriendship", accountB, {
      targetUserId: accountA.uid,
      decision: "accepted",
    });

    const clan = await measure("clan_create", () => callFunction("createClan", accountA, {
      name: `Latency Clan ${suffix}`,
      tag: `L${suffix.slice(-5)}`,
      description: "Disposable production latency benchmark.",
    }), results);
    clanId = clan.clanId;
    await measure("clan_invite_1", () => callFunction("inviteClanMember", accountA, {
      clanId: clan.clanId,
      targetUserId: accountB.uid,
    }), results);
    await callFunction("respondClanInvite", accountB, {
      clanId: clan.clanId,
      decision: "declined",
    });
    await measure("clan_invite_2", () => callFunction("inviteClanMember", accountA, {
      clanId: clan.clanId,
      targetUserId: accountB.uid,
    }), results);
    await callFunction("respondClanInvite", accountB, {
      clanId: clan.clanId,
      decision: "accepted",
    });

    for (let index = 1; index <= 3; index += 1) {
      await measure(`dm_send_${index}`, () => callFunction("sendDirectMessage", accountA, {
        targetUserId: accountB.uid,
        body: `Production latency benchmark message ${index}.`,
      }), results);
    }

    for (let index = 1; index <= 3; index += 1) {
      const thread = await measure(`forum_post_${index}`, () => callFunction("createForumThread", accountA, {
        thread: {
          category: "roadlife",
          body: `Production latency benchmark forum message ${index}.`,
          imageUrl: "",
          storagePath: "",
          location: null,
        },
      }), results);
      forumThreadIds.push(thread.threadId);
    }

    await callFunction("leaveClan", accountB, { clanId: clan.clanId });
    await callFunction("leaveClan", accountA, { clanId: clan.clanId });
    await callFunction("removeFriendship", accountA, { targetUserId: accountB.uid });
    await deleteForumFixtures(forumThreadIds);
    forumThreadIds.length = 0;
    await callFunction("deleteMyAccount", accountA, { confirmation: "DELETE MY CRUISER ACCOUNT" });
    await callFunction("deleteMyAccount", accountB, { confirmation: "DELETE MY CRUISER ACCOUNT" });
    accountsDeleted = true;

    const groups = {
      profile: results.filter((item) => item.label.startsWith("profile_open")),
      friendship: results.filter((item) => item.label.startsWith("friend_request")),
      clanInvite: results.filter((item) => item.label.startsWith("clan_invite")),
      directMessage: results.filter((item) => item.label.startsWith("dm_send")),
      forumPost: results.filter((item) => item.label.startsWith("forum_post")),
    };
    console.log(JSON.stringify({
      runId,
      results,
      summary: Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, summarize(values)])),
      cleanup: "complete",
    }, null, 2));
  } finally {
    await deleteForumFixtures(forumThreadIds).catch((error) => {
      console.error(`Forum fixture cleanup failed: ${error.message}`);
    });
    if (!accountsDeleted) {
      if (clanId) {
        await callFunction("leaveClan", accountB, { clanId }).catch(() => {});
        await callFunction("leaveClan", accountA, { clanId }).catch(() => {});
      }
      await callFunction("removeFriendship", accountA, { targetUserId: accountB.uid }).catch(() => {});
      await callFunction("deleteMyAccount", accountA, {
        confirmation: "DELETE MY CRUISER ACCOUNT",
      }).catch((error) => console.error(`Account A cleanup failed: ${error.message}`));
      await callFunction("deleteMyAccount", accountB, {
        confirmation: "DELETE MY CRUISER ACCOUNT",
      }).catch((error) => console.error(`Account B cleanup failed: ${error.message}`));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
