const projectId = process.env.FIREBASE_PROJECT_ID || "carfollow-75750";
const region = process.env.FIREBASE_FUNCTIONS_REGION || "europe-west1";
const functionNames = [
  "getPublicDriverProfile",
  "requestFriendship",
  "ensureDirectMessageThread",
  "sendDirectMessage",
  "inviteClanMember",
  "createForumThread",
];

async function warmFunction(functionName) {
  const startedAt = performance.now();
  const url = `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cruiser-warmup": "deployment",
    },
    body: JSON.stringify({ data: {} }),
  });
  const durationMs = Math.round(performance.now() - startedAt);

  // These callables require a signed-in user. An unauthenticated response is
  // expected after the instance and its Firebase connections have initialized.
  if (![200, 400, 401, 403].includes(response.status)) {
    throw new Error(`${functionName} warm-up returned HTTP ${response.status}.`);
  }

  return {
    functionName,
    durationMs,
    status: response.status,
  };
}

const results = await Promise.all(functionNames.map(warmFunction));

for (const result of results) {
  console.log(
    `${result.functionName}: ready in ${result.durationMs} ms (HTTP ${result.status}, expected unauthenticated probe)`,
  );
}
