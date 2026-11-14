# Chat App — Turborepo Monorepo

A social chat application with real-time Socket.io features, interactive rooms, and avatar customization.

## Monorepo Structure

```
chat-app/
├── apps/
│   ├── mobile/           # Expo React Native app
│   └── backend/          # Express + Socket.io backend
└── packages/
    ├── shared-types/     # Shared TypeScript types
    ├── socket-constants/ # Socket.io event constants
    └── typescript-config/# Shared TypeScript configurations
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
pnpm install
```

### Environment setup

Copy the example env file and fill in your values:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Required variables:

```env
PORT=1017
ATLAS_DB_URL=mongodb+srv://...
JWT_ACCESS_SECRET=<random 32+ char string>
JWT_REFRESH_SECRET=<different random 32+ char string>
```

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Running the app

**Open two separate terminals:**

**Terminal 1 — Backend**
```bash
pnpm backend
```
Starts the Express + Socket.io server at `http://localhost:1017`.

**Terminal 2 — Mobile**
```bash
pnpm mobile
```
Starts the Expo dev server. Scan the QR code with Expo Go, or press `a` for Android emulator / `i` for iOS simulator.

---

## Available Scripts

From the root directory:

| Command | Description |
|---------|-------------|
| `pnpm backend` | Run backend only |
| `pnpm mobile` | Run mobile app only |
| `pnpm dev` | Run both in parallel (single terminal) |
| `pnpm build` | Build all packages and apps |
| `pnpm type-check` | Type check all packages |
| `pnpm lint` | Lint all packages |

---

## Tech Stack

### Mobile
- React Native / Expo 54
- Expo Router (file-based routing)
- Socket.io Client
- React Query
- expo-secure-store (auth token storage)
- TypeScript

### Backend
- Express
- Socket.io
- Mongoose / MongoDB
- JWT (access + refresh tokens)
- bcryptjs
- Firebase Admin (push notifications)
- TypeScript

### Shared
- `@chat-app/shared-types` — TypeScript types for User, Room, Avatar, etc.
- `@chat-app/socket-constants` — Socket.io event name constants

---

## Authentication

The app uses short-lived JWT access tokens (15 min) + long-lived refresh tokens (30 days).
See [docs/auth.md](docs/auth.md) for the full breakdown.

---

## Project Structure

### Mobile (`apps/mobile/`)
- `app/` — Expo Router screens
- `components/` — React Native components
- `context/` — React Context providers (auth, user, active room)
- `lib/` — API client, auth helpers, room engine
- `hooks/` — Custom React hooks
- `utils/` — Utility functions

### Backend (`apps/backend/src/`)
- `index.ts` — Server entry point
- `routes/` — Express routers
- `controllers/` — Request handlers
- `models/` — Mongoose models
- `services/` — Auth, notifications
- `middleware/` — Auth middleware
- `sockets/` — Socket.io event handlers
- `db/` — MongoDB connection

---

## Android dev build (local)

Needed for anything with native code Expo Go doesn't have, such as push notifications. Windows can only build
Android; iOS needs a Mac with Xcode.

One-time setup on this machine (done 2026-11-14):

- Android Studio, whose bundled Java (`C:\Program Files\Android\Android Studio\jbr`) is `JAVA_HOME`
- Android SDK at `C:\Android\Sdk` (`ANDROID_HOME`). Keep it on a path with no spaces; the native build tools
  break on them. `platform-tools` and `cmdline-tools\latest\bin` are on `Path`
- On the phone: Developer options → USB debugging, plugged in, and `adb devices` lists it as `device`

Then `pnpm build:android` from the repo root. It sets the API URL to this machine's LAN IP, generates
`apps/mobile/android/` (gitignored) from `app.json`, builds, installs on the phone and starts Metro. The first
build takes a while. After that `pnpm mobile` is enough; rebuild only after a native change (a new native
library, or plugins in `app.json`).

If the install step fails with `Shell does not have permission to access user 10`, the phone has a work
profile or app cloning, and Expo tries to install for every profile. The build itself succeeded: run
`pnpm install:android` to install it for the main profile only, then `pnpm mobile`.

Builds fail on Windows with `ninja: manifest 'build.ninja' still dirty after 100 tries` when a native
library's paths pass 260 characters (pnpm's folder names are long), because the `ninja` 1.10.2 bundled with
the SDK's CMake 3.22.1 can't read long paths. Fixed on this machine by replacing
`C:\Android\Sdk\cmake\3.22.1\bin\ninja.exe` with ninja 1.12.1 from github.com/ninja-build/ninja/releases
(the old one is kept as `ninja-1.10.2.exe.bak`). Redo it if the SDK's CMake is reinstalled.

## Push Notifications

Firebase Cloud Messaging on both platforms (`@react-native-firebase/messaging` in the app, Firebase Admin on
the backend). How it works, what's sent and the setup checklist are in
[docs/notifications.md](docs/notifications.md).

1. `apps/mobile/google-services.json` (Android) and `apps/mobile/GoogleService-Info.plist` (iOS), from the
   Firebase project. Both gitignored.
2. iOS only: an APNs key (.p8) uploaded to the Firebase project.
3. The Firebase Admin service account JSON at `apps/backend/firebase-service-account.json`, with
   `FIREBASE_SERVICE_ACCOUNT_KEY=./firebase-service-account.json` in `apps/backend/.env`.
4. A dev build on a physical device (`npx expo run:android` / `npx expo run:ios`, or EAS). Pushes don't work
   in Expo Go or on simulators.

---

## Adding Dependencies

```bash
# Mobile
cd apps/mobile && pnpm add <package>

# Backend
cd apps/backend && pnpm add <package>

# Shared packages
cd packages/shared-types && pnpm add <package>
```
