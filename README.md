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

## Push Notifications

1. Create a Firebase project and enable Cloud Messaging
2. Place `google-services.json` in `apps/mobile/` (Android)
3. Place `GoogleService-Info.plist` in `apps/mobile/` (iOS)
4. Place your Firebase Admin SDK service account JSON in `apps/backend/` and set `FIREBASE_SERVICE_ACCOUNT_KEY` in `.env`
5. Build a dev client (`npx expo run:android` / `npx expo run:ios`) — push notifications don't work in Expo Go

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
