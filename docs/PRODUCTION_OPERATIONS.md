# CRUISER Production Operations

## Active safeguards

- Callable Functions run in `us-central1` with `256MiB`, concurrency `40`, and a maximum of `5` instances.
- High-volume mutations use per-user Firestore rate limits. Rate-limit documents are backend-only.
- Expired rate-limit documents are automatically removed through the `rateLimits.expiresAt` TTL policy.
- Callable logs contain operation name, request correlation ID, duration, Auth state, App Check state, and error code. Payloads and private profile values are never logged.
- Notifications, moderation reports, moderation audit records, and aggregate data are backend-owned.
- Firestore has a weekly Sunday backup schedule with 14-day retention:
  `projects/carfollow-75750/databases/(default)/backupSchedules/d44e7edd-8e39-43ec-8038-2440523e4493`

Check backup state:

```powershell
firebase firestore:backups:schedules:list --project carfollow-75750
firebase firestore:backups:list --project carfollow-75750
```

Check and deploy the TTL field policy:

```powershell
firebase firestore:indexes --project carfollow-75750
firebase deploy --only firestore:indexes --project carfollow-75750
```

Firestore TTL deletion is asynchronous and may occur after the expiration time. It is a storage cleanup mechanism, not part of request authorization.

Do not delete a backup schedule during an incident. A restore must first be tested against a separate recovery database or project.

## App Check rollout

App Check code is installed but enforcement intentionally defaults to `false`. Enabling enforcement before a valid web provider is registered rejects legitimate callable requests.

1. Open Firebase Console -> App Check and register the CRUISER web app.
2. Configure a reCAPTCHA v3 site and restrict it to the production and preview domains.
3. Add its public site key to the web build environment:

```text
VITE_FIREBASE_APPCHECK_SITE_KEY=your-public-site-key
```

4. Deploy the client and monitor App Check metrics until verified traffic is healthy.
5. Create `functions/.env.carfollow-75750` from `functions/.env.example`, set `ENFORCE_APP_CHECK=true`, and redeploy Functions.
6. Enable enforcement for Firestore, Realtime Database, and Storage from the App Check console only after their verified-request metrics are healthy.

Local emulator builds can use `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`. Never commit the generated debug token.

## Moderator access

Moderation queue and resolution callables require either a Firebase custom claim of `moderator: true` or `admin: true`. Claims must be assigned only through a trusted Admin SDK script or Firebase-managed administrative environment. A normal client must never be able to assign claims.

Available callable operations:

- `submitModerationReport`
- `listModerationQueue`
- `resolveModerationReport`
- `markNotificationRead`
- `markAllNotificationsRead`

Every moderation decision creates an immutable backend audit document. Driver warnings/restrictions are projected to the private moderation record and a limited public status field.

## Billing and quota controls

Cloud Billing budgets send alerts but do not impose a hard spending cap. Configure a project-scoped monthly budget in Google Cloud Billing with at least 50%, 80%, and 100% actual-spend alerts. Route alerts to an email address that is checked regularly.

Also configure:

- Google Maps Platform daily request quotas for Maps JavaScript API and every enabled Places/Routes API.
- Cloud Functions alerts for invocation count, error rate, and p95 latency.
- Firestore alerts for document reads/writes and backup growth.
- Realtime Database alerts for downloaded bytes and concurrent connections.
- Storage lifecycle rules for user-deleted or abandoned uploads when retention policy is finalized.

The weekly Firestore backup reads every backed-up document and has storage cost. Review backup growth monthly before increasing retention.

## Incident checklist

1. Disable the affected callable or lower its quota if abuse is active.
2. Review `callable.failure`, `moderation.report.created`, and `moderation.report.resolved` structured logs by request ID.
3. Preserve moderation audit and relevant notification IDs.
4. Verify the latest Firestore backup before any destructive repair.
5. Test recovery outside the production database.
6. Rotate exposed API credentials and revoke App Check debug tokens.
