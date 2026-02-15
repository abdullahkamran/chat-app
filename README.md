# Chat App v2 - Turborepo Monorepo

A social chat application with real-time Socket.io features, interactive rooms, and avatar customization.

## Monorepo Structure

This project uses [Turborepo](https://turbo.build/repo) to manage a monorepo containing:

```
chat-app-v2/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── backend/         # Express backend server (placeholder)
└── packages/
    ├── shared-types/    # Shared TypeScript types
    ├── socket-constants/# Socket.io event constants
    └── typescript-config/# Shared TypeScript configurations
```

### Apps

- **mobile** - Expo React Native application with file-based routing (Expo Router)
- **backend** - Minimal Express server (placeholder for existing backend migration)

### Shared Packages

- **@chat-app/shared-types** - TypeScript types used by both mobile and backend (Room, User, Item, Avatar, etc.)
- **@chat-app/socket-constants** - Socket.io event names shared across the stack
- **@chat-app/typescript-config** - Shared TypeScript configuration presets

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+ (recommended) or npm/yarn

### Installation

1. Install dependencies for all packages:

   ```bash
   pnpm install
   ```

### Development

Run both mobile and backend in parallel:

```bash
pnpm dev
```

Or run them individually:

```bash
# Mobile app only
pnpm mobile

# Backend only
pnpm backend
```

### Mobile App

The mobile app is an Expo project located in `apps/mobile/`.

```bash
cd apps/mobile
pnpm start
```

In the output, you'll find options to open the app in:
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go)

The app uses [Expo Router](https://docs.expo.dev/router/introduction) for file-based routing.

### Backend

The backend is a minimal Express server placeholder located in `apps/backend/`.

```bash
cd apps/backend
pnpm dev
```

The server runs on `http://localhost:1017` by default.

**Note:** This is a placeholder. The existing backend will be migrated here later.

## Available Scripts

From the root directory:

- `pnpm dev` - Run all apps in development mode
- `pnpm build` - Build all packages and apps
- `pnpm lint` - Lint all packages
- `pnpm type-check` - Type check all packages
- `pnpm mobile` - Run mobile app only
- `pnpm backend` - Run backend only

## Features

- **Real-time Chat** - Socket.io integration for instant messaging
- **Interactive Rooms** - Users can join rooms and see other users
- **Avatar System** - Customizable user avatars
- **Character Positioning** - Real-time character position tracking
- **Typing Indicators** - See when users are typing
- **Tab Navigation** - Home, Conversations, Explore tabs

## Tech Stack

### Mobile
- React Native / Expo 54
- Expo Router (file-based routing)
- Socket.io Client
- React Query (data fetching)
- TypeScript

### Backend (Placeholder)
- Express
- TypeScript

### Shared
- TypeScript (strict mode)
- Shared types for type safety across stack

## Project Structure

### Mobile App (`apps/mobile/`)
- `app/` - Expo Router screens (file-based routing)
- `components/` - React Native components
- `hooks/` - Custom React hooks
- `context/` - React Context providers
- `utils/` - Utility functions
- `assets/` - Images, fonts, etc.
- `mock/` - Mock data for development

### Backend (`apps/backend/`)
- `src/index.ts` - Express server entry point
- Ready for existing backend migration

## Development Workflow

### Adding Dependencies

```bash
# For mobile
cd apps/mobile && pnpm add <package>

# For backend
cd apps/backend && pnpm add <package>

# For shared packages
cd packages/shared-types && pnpm add <package>
```

### Making Changes to Shared Types

1. Edit files in `packages/shared-types/src/`
2. Both mobile and backend automatically pick up changes (TypeScript project references)
3. No build step needed during development

### Migrating Existing Backend

When ready to migrate your existing backend:

1. Copy backend code to `apps/backend/src/`
2. Update imports to use `@chat-app/shared-types` and `@chat-app/socket-constants`
3. Update `apps/backend/package.json` with additional dependencies
4. Ensure backend uses shared types for API responses and Socket.io events
5. Test integration between mobile and backend

## Learn More

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Socket.io Documentation](https://socket.io/docs/v4/)
