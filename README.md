# CRUISER

CRUISER is a React + Vite + Tailwind CSS single page application for car and motorcycle enthusiasts. The current build includes:

- Authentication flow with quick test profiles
- Interactive map with photo spots, wash stations, and cruise meet pins
- Live driving HUD simulation
- Clan leaderboard and active driver feed
- Digital garage, maintenance tracking, and fuel log

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
    ui.jsx
  data/
    mockData.js
  hooks/
    useCruiserAuth.js
    useCruiserWorld.js
  repositories/
    cruiserRepository.js
    mockCruiserRepository.js
  screens/
    AuthScreen.jsx
    ClansScreen.jsx
    DriveScreen.jsx
    GarageScreen.jsx
  services/
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

## Install

```powershell
cd D:\carfollow
npm install
```

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
- `npm run test` starts Vitest in watch mode
- `npm run test:run` runs the test suite once

## What Was Tested

The following checks were run successfully:

- `npm install`
- `npm run build`
- `npm run test:run`
- local HTTP response from the dev server

Known limitation during testing:

- In-app browser automation could not reliably open the localhost page in this environment, so runtime verification was completed using build output and direct local HTTP checks instead.

## Current State

The project now includes:

- screen-level components separated from orchestration logic
- custom hooks for auth/session state and world simulation state
- repository abstraction between hooks and the mock data source
- local mocked session persistence with `localStorage`
- Firebase path helper functions for future production binding
- automated tests for app render, garage utilities, and Firebase path helpers
- form validation for sign up, fuel log, and wash review flows

## Data Architecture

The current data flow is intentionally prepared for Firebase migration:

- UI screens render props only
- hooks orchestrate user interaction and local state transitions
- repositories encapsulate read/update behavior for app data
- the active repository is currently mock-backed

This means the next Firebase step can replace repository internals without rewriting the screens.

## Next Steps

Suggested improvements for the next iteration:

- introduce a Firebase-backed repository implementation alongside the mock one
- switch repository selection by environment/config
- add persistence for map reviews, clan movement, and fuel history beyond the active session
- add more repository-level tests for update functions
- persist more of the mock app world, not only the active user session
- add route-level architecture only if the SPA grows beyond the current shell
