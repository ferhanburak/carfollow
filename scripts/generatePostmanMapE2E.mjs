import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postmanDir = path.join(rootDir, "postman");

const jsonBody = (value) => ({
  mode: "raw",
  raw: JSON.stringify(value, null, 2),
  options: { raw: { language: "json" } },
});

const script = (...lines) => ({
  listen: "test",
  script: { type: "text/javascript", exec: lines },
});

const callable = ({ name, functionName, account = "A", data = {}, tests = [] }) => ({
  name,
  event: [script(
    `pm.test("${name}: HTTP 200", () => pm.response.to.have.status(200));`,
    "const payload = pm.response.json();",
    "pm.test(\"Callable result is successful\", () => pm.expect(payload.result?.ok).to.eql(true));",
    ...tests,
  )],
  request: {
    method: "POST",
    header: [
      { key: "Content-Type", value: "application/json" },
      { key: "Authorization", value: `Bearer {{idToken${account}}}`, type: "text" },
    ],
    body: jsonBody({ data }),
    url: { raw: `{{functionsBase}}/${functionName}`, host: ["{{functionsBase}}"], path: [functionName] },
  },
});

const firestoreGet = ({ name, documentVariable, account = "B", tests = [] }) => ({
  name,
  event: [script(
    `pm.test("${name}: document is visible", () => pm.response.to.have.status(200));`,
    "const document = pm.response.json();",
    ...tests,
  )],
  request: {
    method: "GET",
    header: [{ key: "Authorization", value: `Bearer {{idToken${account}}}`, type: "text" }],
    url: {
      raw: `{{firestoreBase}}/mapPins/{{${documentVariable}}}`,
      host: ["{{firestoreBase}}"],
      path: ["mapPins", `{{${documentVariable}}}`],
    },
  },
});

const signIn = (account) => ({
  name: `Sign In Account ${account}`,
  event: [script(
    `pm.test("Account ${account} signed in", () => pm.response.to.have.status(200));`,
    "const auth = pm.response.json();",
    `pm.environment.set("idToken${account}", auth.idToken);`,
    `pm.environment.set("refreshToken${account}", auth.refreshToken);`,
    `pm.environment.set("uid${account}", auth.localId);`,
    ...(account === "A" ? ["pm.collectionVariables.set(\"runId\", Date.now().toString());"] : [
      "pm.test(\"Accounts are different\", () => pm.expect(auth.localId).to.not.eql(pm.environment.get(\"uidA\")));",
    ]),
  )],
  request: {
    method: "POST",
    header: [{ key: "Content-Type", value: "application/json" }],
    body: jsonBody({ email: `{{email${account}}}`, password: `{{password${account}}}`, returnSecureToken: true }),
    url: {
      raw: "{{authBase}}/accounts:signInWithPassword?key={{apiKey}}",
      host: ["{{authBase}}"],
      path: ["accounts:signInWithPassword"],
      query: [{ key: "key", value: "{{apiKey}}" }],
    },
  },
});

const collection = {
  info: {
    _postman_id: "47ae4abe-6808-4adf-98a7-11d68b1fda01",
    name: "CRUISER - Two Account Map & Convoy E2E",
    description: "Production E2E flow. Account A creates map content; Account B discovers and interacts with it. Run folders in order.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "runId", value: "" },
    { key: "spotPinId", value: "" },
    { key: "washPinId", value: "" },
    { key: "photoId", value: "" },
    { key: "storagePath", value: "" },
    { key: "photoUrl", value: "" },
    { key: "convoyId", value: "" },
    { key: "invitedConvoyId", value: "" },
  ],
  item: [
    {
      name: "00 - Authentication",
      item: [signIn("A"), signIn("B")],
    },
    {
      name: "01 - Photo Spot",
      item: [
        callable({
          name: "A Creates Photo Spot",
          functionName: "createMapNode",
          data: { pin: { type: "spot", name: "POSTMAN E2E SPOT {{runId}}", lat: 39.9208, lng: 32.8541, description: "Two-account Postman visibility test.", tags: ["#PostmanE2E", "#NightRun"] } },
          tests: ["pm.collectionVariables.set(\"spotPinId\", payload.result.pinId);"],
        }),
        firestoreGet({
          name: "B Reads A's Photo Spot",
          documentVariable: "spotPinId",
          tests: [
            "pm.test(\"Creator is Account A\", () => pm.expect(document.fields.createdByUid.stringValue).to.eql(pm.environment.get(\"uidA\")));",
            "pm.test(\"Spot type is preserved\", () => pm.expect(document.fields.type.stringValue).to.eql(\"spot\"));",
          ],
        }),
        callable({
          name: "B Likes A's Photo Spot",
          functionName: "toggleMapLike",
          account: "B",
          data: { pinId: "{{spotPinId}}", targetType: "pin" },
          tests: ["pm.test(\"Like was added\", () => pm.expect(payload.result.liked).to.eql(true));"],
        }),
        {
          name: "B Uploads Spot Photo",
          event: [script(
            "pm.test(\"Photo uploaded\", () => pm.response.to.have.status(200));",
            "const uploaded = pm.response.json();",
            "pm.collectionVariables.set(\"storagePath\", uploaded.name);",
            "const token = String(uploaded.downloadTokens || \"\").split(\",\")[0];",
            "const url = `https://firebasestorage.googleapis.com/v0/b/${pm.environment.get(\"storageBucket\")}/o/${encodeURIComponent(uploaded.name)}?alt=media${token ? `&token=${token}` : \"\"}`;",
            "pm.collectionVariables.set(\"photoUrl\", url);",
          )],
          request: {
            method: "POST",
            header: [
              { key: "Authorization", value: "Bearer {{idTokenB}}", type: "text" },
              { key: "Content-Type", value: "image/svg+xml" },
            ],
            body: { mode: "file", file: { src: "postman/fixtures/test-spot.svg" } },
            url: {
              raw: "https://firebasestorage.googleapis.com/v0/b/{{storageBucket}}/o?uploadType=media&name=artifacts%2Fcruiser-app-prod%2FmapNodes%2F{{spotPinId}}%2Fphotos%2F{{uidB}}%2Fpostman-{{runId}}.svg",
              protocol: "https",
              host: ["firebasestorage", "googleapis", "com"],
              path: ["v0", "b", "{{storageBucket}}", "o"],
              query: [
                { key: "uploadType", value: "media" },
                { key: "name", value: "artifacts/cruiser-app-prod/mapNodes/{{spotPinId}}/photos/{{uidB}}/postman-{{runId}}.svg" },
              ],
            },
          },
        },
        callable({
          name: "B Registers Uploaded Photo",
          functionName: "addMapSpotPhoto",
          account: "B",
          data: { pinId: "{{spotPinId}}", title: "POSTMAN E2E PHOTO {{runId}}", imageUrl: "{{photoUrl}}", storagePath: "{{storagePath}}" },
          tests: ["pm.collectionVariables.set(\"photoId\", payload.result.photoId);"],
        }),
        callable({
          name: "A Likes B's Spot Photo",
          functionName: "toggleMapLike",
          account: "A",
          data: { pinId: "{{spotPinId}}", targetType: "photo", photoId: "{{photoId}}" },
          tests: ["pm.test(\"Photo like was added\", () => pm.expect(payload.result.liked).to.eql(true));"],
        }),
      ],
    },
    {
      name: "02 - Car Wash",
      item: [
        callable({
          name: "A Creates Wash Node",
          functionName: "createMapNode",
          data: { pin: { type: "wash", name: "POSTMAN E2E WASH {{runId}}", lat: 39.9135, lng: 32.8421, foam: 4, water: 4, allowsBuckets: true, shadowDrying: true, note: "Initial Account A review." } },
          tests: ["pm.collectionVariables.set(\"washPinId\", payload.result.pinId);"],
        }),
        firestoreGet({
          name: "B Reads A's Wash Node",
          documentVariable: "washPinId",
          tests: ["pm.test(\"Wash type is preserved\", () => pm.expect(document.fields.type.stringValue).to.eql(\"wash\"));"],
        }),
        callable({
          name: "B Reviews A's Wash Node",
          functionName: "submitWashReview",
          account: "B",
          data: { pinId: "{{washPinId}}", foam: 5, water: 4, allowsBuckets: true, shadowDrying: false, note: "Account B Postman review." },
          tests: ["pm.test(\"Aggregate has two reviews\", () => pm.expect(payload.result.rating.reviews).to.eql(2));"],
        }),
        firestoreGet({
          name: "A Reads Updated Wash Aggregate",
          documentVariable: "washPinId",
          account: "A",
          tests: ["pm.test(\"Review aggregate is visible\", () => pm.expect(Number(document.fields.rating.mapValue.fields.reviews.integerValue)).to.eql(2));"],
        }),
      ],
    },
    {
      name: "03 - Public Convoy Request Flow",
      item: [
        callable({
          name: "A Creates Public Convoy",
          functionName: "createConvoy",
          data: { pin: { name: "POSTMAN E2E PUBLIC CONVOY {{runId}}", lat: 39.9208, lng: 32.8541, route: "Kizilay - Cankaya - Umitkoy", routePath: [{ lat: 39.9208, lng: 32.8541 }, { lat: 39.9004, lng: 32.8093 }, { lat: 39.9021, lng: 32.7029 }], time: "2026-07-18 22:30", capacity: 12, visibility: "public", accessPolicy: "request", detailVisibility: "trusted", minDriverScore: 0, minHarmonyVotes: 0, maxAlertVotes: 99, invitedGuests: [] } },
          tests: ["pm.collectionVariables.set(\"convoyId\", payload.result.convoyId);"],
        }),
        callable({
          name: "B Lists and Sees A's Convoy",
          functionName: "listAccessibleConvoys",
          account: "B",
          tests: ["pm.test(\"Created convoy is visible to B\", () => pm.expect(payload.result.convoys.some((item) => item.id === pm.collectionVariables.get(\"convoyId\"))).to.eql(true));"],
        }),
        callable({
          name: "B Requests Convoy Join",
          functionName: "requestConvoyJoin",
          account: "B",
          data: { convoyId: "{{convoyId}}" },
        }),
        callable({
          name: "A Sees B's Pending Request",
          functionName: "listAccessibleConvoys",
          account: "A",
          tests: ["const convoy = payload.result.convoys.find((item) => item.id === pm.collectionVariables.get(\"convoyId\"));", "pm.test(\"B is pending\", () => pm.expect(convoy.pendingRequests.some((item) => item.userId === pm.environment.get(\"uidB\"))).to.eql(true));"],
        }),
        callable({
          name: "A Approves B's Join Request",
          functionName: "respondConvoyJoinRequest",
          account: "A",
          data: { convoyId: "{{convoyId}}", memberUserId: "{{uidB}}", decision: "approved" },
        }),
        callable({
          name: "B Sees Approved Membership and Route",
          functionName: "listAccessibleConvoys",
          account: "B",
          tests: [
            "const convoy = payload.result.convoys.find((item) => item.id === pm.collectionVariables.get(\"convoyId\"));",
            "pm.test(\"B is approved\", () => pm.expect(convoy.attendees.some((item) => item.userId === pm.environment.get(\"uidB\"))).to.eql(true));",
            "pm.test(\"Exact route is visible\", () => pm.expect(convoy.routePath.length).to.be.above(1));",
          ],
        }),
        callable({ name: "B Marks Trip Enroute", functionName: "updateConvoyTripStatus", account: "B", data: { convoyId: "{{convoyId}}", tripStatus: "enroute" } }),
        callable({ name: "A Starts Convoy", functionName: "updateConvoyLifecycle", account: "A", data: { convoyId: "{{convoyId}}", lifecycleStatus: "rolling" } }),
        callable({ name: "A Completes Convoy", functionName: "updateConvoyLifecycle", account: "A", data: { convoyId: "{{convoyId}}", lifecycleStatus: "completed" } }),
        callable({ name: "B Rates A Harmony", functionName: "rateConvoyMember", account: "B", data: { convoyId: "{{convoyId}}", targetUserId: "{{uidA}}", signal: "harmony" } }),
        callable({ name: "A Rates B Harmony", functionName: "rateConvoyMember", account: "A", data: { convoyId: "{{convoyId}}", targetUserId: "{{uidB}}", signal: "harmony" } }),
      ],
    },
    {
      name: "04 - Friends Convoy Invite Flow",
      item: [
        callable({
          name: "A Creates Friends Convoy",
          functionName: "createConvoy",
          data: { pin: { name: "POSTMAN E2E FRIENDS CONVOY {{runId}}", lat: 39.925, lng: 32.84, route: "Ankara Friends Test Route", routePath: [{ lat: 39.925, lng: 32.84 }, { lat: 39.91, lng: 32.79 }], time: "2026-07-19 21:30", capacity: 8, visibility: "friends", accessPolicy: "request", detailVisibility: "trusted", minDriverScore: 0, minHarmonyVotes: 0, maxAlertVotes: 99, invitedGuests: [] } },
          tests: ["pm.collectionVariables.set(\"invitedConvoyId\", payload.result.convoyId);"],
        }),
        callable({ name: "A Invites Friend B", functionName: "inviteConvoyMember", account: "A", data: { convoyId: "{{invitedConvoyId}}", targetUserId: "{{uidB}}" } }),
        callable({
          name: "B Lists Invited Friends Convoy",
          functionName: "listAccessibleConvoys",
          account: "B",
          tests: ["pm.test(\"Invited convoy is visible\", () => pm.expect(payload.result.convoys.some((item) => item.id === pm.collectionVariables.get(\"invitedConvoyId\"))).to.eql(true));"],
        }),
        callable({ name: "B Joins Invited Convoy", functionName: "requestConvoyJoin", account: "B", data: { convoyId: "{{invitedConvoyId}}" } }),
        callable({
          name: "B Verifies Immediate Approval",
          functionName: "listAccessibleConvoys",
          account: "B",
          tests: ["const convoy = payload.result.convoys.find((item) => item.id === pm.collectionVariables.get(\"invitedConvoyId\"));", "pm.test(\"Invited B joined without pending approval\", () => pm.expect(convoy.attendees.some((item) => item.userId === pm.environment.get(\"uidB\"))).to.eql(true));"],
        }),
      ],
    },
  ],
};

const environment = {
  id: "3af22a9f-09ee-4697-a154-a760539a3768",
  name: "CarFollow Two Account E2E",
  values: [
    { key: "apiKey", value: "", type: "secret", enabled: true },
    { key: "emailA", value: "", type: "default", enabled: true },
    { key: "passwordA", value: "", type: "secret", enabled: true },
    { key: "emailB", value: "", type: "default", enabled: true },
    { key: "passwordB", value: "", type: "secret", enabled: true },
    { key: "idTokenA", value: "", type: "secret", enabled: true },
    { key: "refreshTokenA", value: "", type: "secret", enabled: true },
    { key: "uidA", value: "", type: "default", enabled: true },
    { key: "idTokenB", value: "", type: "secret", enabled: true },
    { key: "refreshTokenB", value: "", type: "secret", enabled: true },
    { key: "uidB", value: "", type: "default", enabled: true },
    { key: "authBase", value: "https://identitytoolkit.googleapis.com/v1", type: "default", enabled: true },
    { key: "functionsBase", value: "https://us-central1-carfollow-75750.cloudfunctions.net", type: "default", enabled: true },
    { key: "firestoreBase", value: "https://firestore.googleapis.com/v1/projects/carfollow-75750/databases/(default)/documents/artifacts/cruiser-app-prod/public/data", type: "default", enabled: true },
    { key: "storageBucket", value: "carfollow-75750.firebasestorage.app", type: "default", enabled: true },
  ],
  _postman_variable_scope: "environment",
  _postman_exported_using: "CRUISER generator",
};

await mkdir(path.join(postmanDir, "fixtures"), { recursive: true });
await writeFile(path.join(postmanDir, "CRUISER-Two-Account-Map-E2E.postman_collection.json"), `${JSON.stringify(collection, null, 2)}\n`);
await writeFile(path.join(postmanDir, "CarFollow-Two-Account.postman_environment.json"), `${JSON.stringify(environment, null, 2)}\n`);

console.log(`Postman assets generated in ${postmanDir}`);
