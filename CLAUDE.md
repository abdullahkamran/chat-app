# Chat App — Claude Instructions

## Project Overview

Monorepo chat app with a Snapchat-inspired design: **black backgrounds, yellow (`#FFFC00`) accents**.

Structure:
- `apps/mobile` — React Native / Expo mobile app
- `apps/backend` — Node.js backend
- `packages/shared-types` — shared TypeScript types

---

## Theming — ALWAYS use the centralized theme

**Never hardcode color values.** All colors must come from the centralized theme file:

```
apps/mobile/constants/theme.ts
```

### Imports

```ts
import { theme } from '@/constants/theme';
// or if you need raw values:
import { palette } from '@/constants/theme';
```

### Use semantic tokens from `theme.colors` in components

```ts
// backgrounds
theme.colors.background        // #000000 — main screen background
theme.colors.surface           // #111111 — cards, bottom sheets
theme.colors.surfaceElevated   // #1a1a1a — dialogs, modals
theme.colors.border            // #222222 — dividers, input borders
theme.colors.borderSubtle      // #333333 — lighter borders

// text
theme.colors.text              // #FFFFFF — primary text
theme.colors.textSecondary     // #888888 — subtitles, labels
theme.colors.textMuted         // #555555 — disabled-ish text
theme.colors.placeholder       // #aaaaaa — input placeholders

// brand / interactive
theme.colors.primary           // #FFFC00 — buttons, active states, loaders
theme.colors.primaryText       // #000000 — text rendered ON a yellow element

// status
theme.colors.error             // #ff4d4d — error messages, destructive actions

// misc
theme.colors.overlay           // rgba(0,0,0,0.75) — modal backdrops
theme.colors.icon              // #888888 — icon tint
theme.colors.tabBar            // #000000 — tab bar background
theme.colors.tabIconDefault    // #888888 — unselected tab icon
theme.colors.tabIconSelected   // #FFFC00 — selected tab icon
```

### Avatar accent colors

Use the ordered array — never redefine these colors inline:

```ts
const bg = theme.avatarPalette[index % theme.avatarPalette.length];
```

### Raw palette — only when semantic tokens don't fit

Only reach for `palette.*` when no semantic token covers the case (e.g. a one-off illustration color). Even then, prefer adding a new semantic token to `theme.colors` instead.

```ts
palette.yellow      // #FFFC00
palette.black       // #000000
palette.white       // #FFFFFF
palette.surface100  // #111111
palette.surface200  // #1a1a1a
// ... etc. (see theme.ts for full list)
```

### Adding new colors

1. Add the raw value to `palette` in `theme.ts`.
2. Add a semantic token to `theme.colors` that references it.
3. Use the semantic token in the component.

Do **not** skip straight to adding a hex code in a component stylesheet.

---

## General Rules

- Use `pnpm` for package management (monorepo uses pnpm workspaces).
- Shared TypeScript types live in `packages/shared-types` — use them instead of redefining locally.
- Backend is TypeScript (`apps/backend/src`).
- Keep components in `apps/mobile/components/`, screens in `apps/mobile/app/`.
