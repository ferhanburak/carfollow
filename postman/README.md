# CRUISER Two-Account Map E2E

This Postman collection verifies that Account A can create shared map content and Account B can discover and interact with it.

## Setup

1. Run `npm run postman:generate` after changing the generator.
2. Import `CRUISER-Two-Account-Map-E2E.postman_collection.json` and `CarFollow-Two-Account.postman_environment.json` into Postman.
3. Select the `CarFollow Two Account E2E` environment.
4. Fill `apiKey`, `emailA`, `passwordA`, `emailB`, and `passwordB` using Current Value only. Never commit credentials.
5. Set the Postman working directory to the repository root so `postman/fixtures/test-spot.svg` can be uploaded.
6. Run the collection in its defined order.

For an automated CLI run, set `CARFOLLOW_E2E_EMAIL_A`, `CARFOLLOW_E2E_PASSWORD_A`, `CARFOLLOW_E2E_EMAIL_B`, and `CARFOLLOW_E2E_PASSWORD_B` in the current terminal, then run `npm run postman:test`. The dependency-free runner reads the API key from `.env`, executes the same two-account flow with Node's built-in HTTP client, never writes credentials to disk, and prints the generated `runId`.

The friends-convoy folder requires Accounts A and B to already have an accepted friendship. All other folders work independently of clan membership.

## Coverage

- Both Firebase Authentication sessions and distinct UIDs
- Photo spot creation, cross-account visibility, pin likes, Storage upload, photo registration, and photo likes
- Car-wash creation, cross-account visibility, review submission, and aggregate rating
- Public convoy creation, discovery, join request, host approval, exact route visibility, trip state, lifecycle, and mutual rating
- Friends-only convoy creation, invitation, discovery, and immediate invited-member approval

## Production Data Warning

This collection writes to production and uses `POSTMAN E2E {runId}` names. Preview the exact cleanup scope with `npm run postman:cleanup -- --run-id=RUN_ID`. Execute only after reviewing the report:

```powershell
npm run postman:cleanup -- --run-id=RUN_ID --execute --confirm=DELETE-POSTMAN-E2E-RUN_ID
```

The cleanup is an administrator-only local script. It removes the run's map nodes, photos, likes, wash reviews, convoys, members, ratings, related notifications and Storage objects. Rating deltas are rolled back before deletion. No public cleanup endpoint is deployed.

Ratings temporarily change both test users' reputation by `+3`; the guarded cleanup reverses the recorded deltas. Use test accounts only and clean each completed run.
