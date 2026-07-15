# CRUISER

CRUISER is a React + Vite + Tailwind CSS single page application for car and motorcycle enthusiasts. The current build includes:

- Authentication flow with quick test profiles
- Interactive map with photo spots, wash stations, and cruise meet pins
- Live driving HUD simulation
- Clan leaderboard and active driver feed
- Digital garage, maintenance tracking, and fuel log
- Firebase-ready data layer with mock/fallback mode
- Lazy-loaded screens and optimized Firebase bundle loading

## Tech Stack

- React
- Vite
- Tailwind CSS v4

## Project Structure

```text
src/
  App.jsx
  main.jsx
  index.css
  components/
    MapCard.jsx
    PinPanel.jsx
    pin-panels/
      MeetPinPanel.jsx
      SpotPinPanel.jsx
      WashPinPanel.jsx
    ui.jsx
  constants/
    pins.js
  data/
    mockData.js
  hooks/
    useCruiserAuth.js
    useDriveSession.js
    useFirebaseSync.js
    useMapPins.js
    useCruiserWorld.js
  repositories/
    cruiserRepository.js
    firebaseCruiserRepository.js
    mockCruiserRepository.js
  screens/
    AuthScreen.jsx
    ClansScreen.jsx
    DriveScreen.jsx
    GarageScreen.jsx
  services/
    firebaseClient.js
    firebaseClient.test.js
    firebasePaths.js
    storage.js
  test/
    App.test.jsx
    firebasePaths.test.js
    garage.test.js
    setup.js
  utils/
    garage.js
    validation.js
```

## Requirements

- Node.js
- npm

Recommended Node version:

- `22.12.0+`
- or `20.19.0+`

Note:
The project currently builds on Node `22.11.0`, but Vite shows a version warning. Upgrading Node will remove that warning.

If you do not want to update Node system-wide right away, this repo now includes a portable Node `22.23.1` setup under [D:\carfollow\tools](/D:/carfollow/tools). You can run project commands with it using:

```powershell
cd D:\carfollow
.\use-node22.ps1 npm run build
.\use-node22.ps1 npm run dev
.\use-node22.ps1 npm run test:run
```

## Install

```powershell
cd D:\carfollow
npm install
```

## Firebase Setup

1. Create a local environment file:

```powershell
cd D:\carfollow
Copy-Item .env.example .env
```

2. Fill these values from your Firebase project:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_APPCHECK_SITE_KEY` after registering the web app in Firebase App Check

3. Switch the data source mode:

```text
VITE_CRUISER_DATA_SOURCE=firebase
```

4. Open Firebase Authentication -> `Sign-in method`, enable `Email/Password`, and keep `Anonymous` disabled.

CRUISER uses Firebase `uid` as the permanent account identity. E-mail/password is used for secure sign-in, while the vehicle plate remains the public and searchable driver identity. Quick test profiles are available only in mock/test mode and their passwords are never persisted to Firestore or `localStorage`.

5. Initialize Firebase Storage before enabling photo uploads or deploying `storage.rules`.

If this stays `mock`, the app keeps using the local mock-backed repository.

## Start Development Server

```powershell
cd D:\carfollow
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173/
```

Open that URL in your browser.

## Preview Production Build

First build:

```powershell
cd D:\carfollow
npm run build
```

Then preview:

```powershell
cd D:\carfollow
npm run preview
```

Vite will print a preview URL, usually:

```text
http://localhost:4173/
```

## Available Scripts

- `npm run dev` starts the development server
- `npm run build` creates the production build in `dist/`
- `npm run preview` serves the production build locally
- `npm run emulators` starts the configured Firebase Local Emulator Suite
- `npm run setup:java` installs a project-local Temurin 21 JRE on Windows
- `npm run rules:check` validates Firestore and Realtime Database rules without publishing them
- `npm run seed:firebase` is a legacy prototype migration command and must not be used against production
- `npm run test` starts Vitest in watch mode
- `npm run test:run` runs the test suite once
- `npm run test:emulators` runs Auth, Firestore, RTDB, and Storage identity/authorization tests against `demo-cruiser`
- `npm run lint:functions` validates callable Function syntax
- `npm run test:functions` runs the backend domain tests
- `npm run backup:schedules` shows the active Firestore backup schedule
- `npm run backup:list` lists available Firestore backups

## Local Firebase Emulators

On Windows, install the project-local Java 21 runtime without changing the system Java configuration:

```powershell
cd D:\carfollow
.\use-node22.ps1 npm run setup:java
```

The downloaded runtime stays under the ignored `tools/` directory. On Linux/macOS, configure a Java 21 `JAVA_HOME` instead.

Then set:

```text
VITE_CRUISER_DATA_SOURCE=firebase
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
```

Start the backend emulators and Vite in separate terminals:

```powershell
cd D:\carfollow
npm run emulators
npm run dev
```

The Emulator UI is available at `http://127.0.0.1:4000`.

Run the complete rules integration suite with one command:

```powershell
.\use-node22.ps1 npm run test:emulators
```

This command always uses the isolated `demo-cruiser` project and never reads or writes production Firebase data. The same command runs in GitHub Actions on every push to `main` and every pull request.

## Legacy Seed Script

The original prototype seed script remains in the repository for migration reference. It writes through REST and is not the production provisioning path for the authenticated schema. Do not run it against production after strict rules are enabled; a dedicated emulator/Admin seed will replace it in the next backend phase.

## Firebase Rules

This repo now includes deploy-ready Firebase rule files:

- `firestore.rules`
- `database.rules.json`
- `firebase.json`
- `.firebaserc`

Validate Firestore and Realtime Database rules first:

```powershell
cd D:\carfollow
npm run rules:check
```

To publish the currently configured database and Storage rules:

```powershell
cd D:\carfollow
firebase deploy --only firestore:rules,firestore:indexes,database,storage --project carfollow-75750
```

If Firebase CLI returns `401 invalid authentication credentials`, refresh the CLI session first:

```powershell
firebase login --reauth
```

## What Was Tested

The following checks were run successfully:

- `npm install`
- `npm run build`
- `npm run test:run` (`76/76` frontend tests)
- `npm run test:functions` (`32/32` backend domain tests)
- `npm run test:emulators` (`33/33` Auth, Firestore, RTDB, and Storage identity/authorization tests)
- `npm run rules:check`
- local HTTP response from the dev server

Known limitation during testing:

- In-app browser automation could not reliably open the localhost page in this environment, so runtime verification was completed using build output and direct local HTTP checks instead.

## Current State

The project now includes:

- screen-level components separated from orchestration logic
- custom hooks for auth/session state and world simulation state
- repository abstraction between hooks and the mock data source
- Firebase Email/Password Auth linked to a private CRUISER profile
- emulator-backed account bootstrap coverage for private/public profiles, vehicle docs, passport metadata, parts, and duplicate plates
- defense-in-depth rule checks that reject anonymous Auth tokens across Firestore, RTDB, and Storage
- immutable normalized plate claims and public driver profiles
- stable private vehicle identities and Vehicle Passport metadata
- Vehicle History Report scoring for documented KM coverage, recent proof, part evidence, and risk flags
- backend-created immutable Vehicle Passport export snapshots for personal vehicle history records
- idempotent, append-only service and fuel records
- atomic updates for odometer, passport counters, and replacement-part state
- emulator-backed Garage hardening for fuel, service, passport, and replacement-part edge cases
- Firebase-backed repository hooks for hydration and persistence
- local mocked session persistence with `localStorage`
- centralized Firebase path and document contracts
- automated unit, backend-domain, and Firebase authorization integration tests
- GitHub Actions quality gates for tests, Functions checks, production build, and emulator rules
- form validation for sign up, fuel log, and wash review flows

## Data Architecture

The current data flow is intentionally prepared for Firebase migration:

- UI screens render props only
- hooks orchestrate user interaction and local state transitions
- repositories encapsulate read/update behavior for app data
- the active repository can run in `mock` or `firebase` mode

The Garage and Vehicle Passport screens now use the same repository boundary in both mock and Firebase modes.

Current Firebase integration behavior:

- public world data can hydrate from Firestore after authentication
- account profiles are split into private and public documents
- plates are reserved atomically through immutable claim documents
- fuel logs, service logs, and vehicle parts reload from vehicle-scoped private subcollections
- legacy accounts automatically receive a stable `vehicleId` and Vehicle Passport on their next authenticated load
- only a `replacement` service record can reset a part's tracked lifetime
- Vehicle Passport history exports are generated by Cloud Functions and clients can only read them
- secure drive sessions clamp reported distance against server elapsed time
- monthly individual rankings and achievement progress are written by callable Cloud Functions
- monthly clan rankings and part-health snapshots are backend-owned
- realtime private notifications are generated for social, clan, convoy, message, maintenance, and moderation events
- moderation reports and decisions are callable-only and backed by an audit trail
- callable Functions use structured logs, bounded instances, and per-user rate limits
- expired rate-limit records are removed by a Firestore TTL policy
- App Check client initialization is ready for a monitored enforcement rollout
- Firestore is protected by a weekly backup schedule with 14-day retention
- backend-owned mileage, achievements, and badges are excluded from routine client profile patches
- active driver telemetry and presence use Firebase `uid` paths in Realtime Database
- Firebase services can switch between production and the Local Emulator Suite through environment variables

Private Vehicle Passport paths:

```text
/artifacts/{appId}/users/{userId}/vehicles/{vehicleId}
/artifacts/{appId}/users/{userId}/vehiclePassports/{vehicleId}
/artifacts/{appId}/users/{userId}/parts/{vehicleId}--{partKey}
/artifacts/{appId}/users/{userId}/serviceLogs/{logId}
/artifacts/{appId}/users/{userId}/fuelLogs/{logId}
/artifacts/{appId}/users/{userId}/vehiclePassportExports/{exportId}
/artifacts/{appId}/users/{userId}/driverStats/current
/artifacts/{appId}/users/{userId}/driveSessions/{sessionId}
/artifacts/{appId}/users/{userId}/notifications/{notificationId}
/artifacts/{appId}/users/{userId}/moderation/current
/artifacts/{appId}/public/data/individualLeaderboard/{periodKey}__{userId}
/artifacts/{appId}/public/data/clanLeaderboard/{periodKey}__{clanId}
```

All log sorting and deep filtering stays in client memory. Firestore writes use deterministic document IDs and transactions, avoiding duplicate records and complex index requirements.

Secure driver statistics and Vehicle Passport exports use callable Functions:

```text
refreshDriverStats
createVehiclePassportExport
startDriveSession
finishDriveSession
```

Install and validate the Functions package with:

```powershell
.\use-node22.ps1 npm --prefix functions install
.\use-node22.ps1 npm run lint:functions
.\use-node22.ps1 npm run test:functions
```

The callable backend is deployed to `us-central1` on Node.js 22. Redeploy it with:

```powershell
firebase deploy --only functions --project carfollow-75750
```

Artifact Registry automatically removes Cloud Functions container images older than seven days to limit storage costs.

## Performance Notes

Recent optimizations in the current build:

- non-auth screens are lazy-loaded with `React.lazy`
- pin detail views are split into separate lazy-loaded spot/wash/meet panels
- Firebase repository imports are loaded on demand
- Firebase feature modules are loaded on demand and split into dedicated production chunks

This means first load is lighter, and map/detail code is fetched closer to when the user actually opens those surfaces.

## Production Operations

Stage 10 operations, App Check rollout, moderator claims, backup recovery, and billing controls are documented in `docs/PRODUCTION_OPERATIONS.md`.
