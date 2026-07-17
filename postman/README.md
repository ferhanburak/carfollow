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
- Public convoy creation, cross-account map marker discovery, exact selected route coordinate preservation, join request, host approval, route visibility, trip state, lifecycle, and mutual rating
- Friends-only convoy creation, invitation, discovery, and immediate invited-member approval

The frontend test suite also verifies that an authorized convoy projection renders one Google Maps marker and one route polyline, while a restricted projection keeps only the coarse marker and hides the route.

## Manual Route Check

1. Sign in as Account A and open `GRID / Harita`.
2. Open the node editor, keep `Event` selected, then select the main event location on the map.
3. Switch `Route Builder` to `Rota Noktasi` and click at least three points in driving order. Confirm the red draft line and `S`/`F` waypoint badges.
4. Complete the event fields and select `Event Ekle`. Confirm the new convoy marker remains on the Grid map.
5. Open a private/incognito window, sign in as Account B, and open `MAP / Live Map`. Confirm the convoy marker appears and opens its popup.
6. Request to join from Account B, approve from Account A, then refresh Account B. Confirm the exact lime route line and route node count appear.

For deterministic verification without manual clicking, run `npm run test:run` followed by the two-account `npm run postman:test` flow above. The first command proves marker/polyline rendering; the second proves production persistence and cross-account visibility.

## Production Data Warning

This collection writes to production and uses `POSTMAN E2E {runId}` names. Preview the exact cleanup scope with `npm run postman:cleanup -- --run-id=RUN_ID`. Execute only after reviewing the report:

```powershell
npm run postman:cleanup -- --run-id=RUN_ID --execute --confirm=DELETE-POSTMAN-E2E-RUN_ID
```

The cleanup is an administrator-only local script. It removes the run's map nodes, photos, likes, wash reviews, convoys, members, ratings, related notifications and Storage objects. Rating deltas are rolled back before deletion. No public cleanup endpoint is deployed.

Ratings temporarily change both test users' reputation by `+3`; the guarded cleanup reverses the recorded deltas. Use test accounts only and clean each completed run.
