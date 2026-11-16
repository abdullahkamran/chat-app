# Chat App — Claude Instructions

## Project Overview

Monorepo social hangout app (rooms, avatars, shop). Its look is **"Tide"**: cozy, playful, fun. Mint green and sky blue on deep navy, gold for rewards, rounded type (Fredoka + Nunito), and chunky "sticker" UI with thick edges, generous radii and hard drop shadows that buttons sink into when pressed. Dark-first; the theme system is built so a light theme can be added later.

Structure:
- `apps/mobile` — React Native / Expo mobile app
- `apps/backend` — Node.js backend
- `packages/shared-types` — shared TypeScript types

---

## Theming: ALWAYS use the design system

The full reference (look, every token and color, components, dialogs, accessibility) is [docs/design-system.md](docs/design-system.md). Read it before building or restyling UI, and update it when you add a token, color or primitive. The rules below are the short version.

**Never hardcode colors, font sizes, font families, radii or spacing in components.** Everything comes from `apps/mobile/constants/theme/`:

| File | Holds |
|------|-------|
| `palette.ts` | Raw hex values (`palette`), plus `artPalette` for avatar and pet art colours, which stays the same in every theme |
| `tokens.ts` | Theme-independent tokens: `space`, `radius`, `borderWidth`, `controlHeight`, `fontFamily`, `type`, `motion`, `pressDepth` |
| `themes.ts` | The `Theme` type, `ThemeColors` (semantic colors), and each theme (`darkTheme` today). The `themes` registry lists them all |
| `ThemeProvider.tsx` | `ThemeProvider` (mounted in `app/_layout.tsx`), `useTheme()`, `makeStyles()`, `useThemeName()` |

### Styling a component

Themes can switch at runtime, so **never read the theme at module level** (no `StyleSheet.create` with theme values, no `import { theme }`). Use `makeStyles` for stylesheets and `useTheme()` for values used in JSX:

```tsx
import { makeStyles, useTheme } from '@/constants/theme';

const useStyles = makeStyles(t => ({
  card: {
    padding: t.space.lg,
    borderRadius: t.radius.lg,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    ...t.shadows.sticker,
  },
  title: { ...t.type.heading, color: t.colors.text },
}));

function Card() {
  const t = useTheme();
  const styles = useStyles();
  return <Ionicons name="star" color={t.colors.reward} />;
}
```

Non-component code that draws (e.g. Skia) gets colors passed in from a hook or component. It must not import a theme directly.

### Semantic colors (`t.colors`)

Name by purpose, never by look. Highlights (see `ThemeColors` in `themes.ts` for all of them):

- **Surfaces:** `background`, `surface`, `surfaceElevated`, `surfaceSunken` (inputs), `border`, `borderStrong`, `outline` (the ink edge and drop of sticker elements)
- **Text:** `text`, `textSecondary`, `textSubtle`, `textMuted`, `textDisabled`, `placeholder`
- **Accents:** each comes as a set of base, `…Deep` (the drop under a filled button), `…Soft` (tinted background) and `on…` (text on top):
  - `primary`: mint green, the main action
  - `secondary`: sky blue, edit mode and highlights
  - `reward`: gold, coins and prices
  - `error`: red, destructive actions
- **Room:** `bubble*`, `transcriptBackground`, `roomDoor*`, `roomEditGrid`, `roomLocalActor`, `roomShadow`, `avatarLoading*` (the ghost avatar shown while an outfit loads)
- **Letter avatars and sender names:** `t.avatarPalette[i % t.avatarPalette.length]`. Use `avatarColor(t, name)` from `components/UserAvatar.tsx`.

### Text

Use `t.type.*` (`display`, `title`, `heading`, `button`, `body`, `bodyStrong`, `label`, `caption`, `overline`) or the `<AppText variant color>` component. Custom fonts carry their weight in the family name, so **never set `fontWeight`**. Switch `fontFamily` instead.

### UI primitives: use these before hand-rolling

`apps/mobile/components/ui/` (import from `@/components/ui`): `AppText`, `Button` (primary / secondary / reward / ghost / danger), `IconButton` (plain / surface / primary / secondary, with `active` and `badge`), `TextField`, `SegmentedControl`, `Chip`, `ScreenHeader`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton` / `SkeletonGroup`, `Spinner`, `CoinPill`, `Dialog`. The room's bottom drawers use `lib/room-engine/components/Drawer.tsx`.

### Dialogs: never `Alert.alert` or a hand-rolled `Modal`

- Quick confirms, notices and errors: `showDialog({ title, message, icon, tone, buttons })` (buttons are shaped like `Alert.alert`'s) or `showErrorDialog(e, title?)`. A tap outside or back runs the `cancel` button; a one-button notice closes on a tap outside too.
- Custom content: `<Dialog visible onClose icon tone title message actions>`, or `bare` to lay out the card yourself.
- Success notices that need no answer ("Purchased!"): `showToast` from `components/Toast.tsx`, not a dialog.
- `showDialog` goes to the newest mounted `<DialogHost />`. On iOS a Modal can only present from the screen it's mounted in, so a screen shown with `presentation: 'modal'`, or a `Modal` that shows dialogs, must mount its own `<DialogHost />` (see `app/room-members.tsx`, `app/add-friends.tsx`, `MailboxModal.tsx`). The root one is in `app/_layout.tsx`.

### Loading states: never leave the user guessing

Every wait shows that something is happening, from the tap until it's done. Full rules in [docs/design-system.md#loading-states](docs/design-system.md#loading-states).

- **Loading data (most GETs: screens, lists, grids, drawers): use a skeleton** shaped like the content, not a centred spinner. Use a full-screen `Spinner` only when the layout can't be known.
- **Button actions: `Button`'s `loading` prop** (spinner in the button, disables it).
- **Actions from icons, menus or `showDialog` buttons:** show the mutation's `isPending` on the row or tile it affects (swap the control for a `Spinner`), and disable it meanwhile.
- Check `isLoading` before showing `EmptyState`; never show "empty", "—", or a wrong "Buy"/"owned" state while data is still loading.
- Every `useQuery` needs a loading state and every `useMutation` needs its `isPending` shown. A failed load (`isError && !data`) shows `ErrorState` with retry, never an endless spinner. If `onSuccess` refetches, return the promise so the pending state lasts until the screen updates.
- Tab lists get pull-to-refresh: `refreshControl={usePullToRefresh(refetch)}`.
- Use the `loading-states` skill (`.claude/skills/loading-states/`) to audit or fix a screen.

### Adding a color

1. Add the raw value to `palette` in `palette.ts`.
2. Add a semantic key to `ThemeColors` and set it in **every** theme in `themes.ts`.
3. Use `t.colors.<key>` in the component.

### Adding a theme (e.g. light)

Write another `Theme` in `themes.ts` with every key filled, add it to `themes`, and pass its name to `ThemeProvider` (or call `setThemeName` from `useThemeName()`). The navigation theme and status bar follow `theme.scheme`.

---

## Performance

Rules and the current list audit are in [docs/performance.md](docs/performance.md). Read it before building a list or anything that animates, and update its audit when you add or change a list. The short version:

- **A list whose length depends on data is a `FlatList` / `SectionList`, never `ScrollView` + `.map()`.** ScrollView is only for small, fixed sets (chips, colour variants, the 4-avatar strip). Never nest a vertical FlatList inside a vertical ScrollView; use `ListHeaderComponent` instead. Page long server lists with `useInfiniteQuery` + `onEndReached`.
- **Animate only what's on screen, and stop when the screen isn't showing.** Animated Skia previews in lists take `animated` from `useVisibleIds(active)` (`components/AnimationRow.tsx`), which also stops them on tab or segment switches. Frame callbacks must stop and unregister on unmount; start and stop `useFrameCallback` with `setActive`, since its `autostart` is only read on mount.

---

## General Rules

- Use `pnpm` for package management (monorepo uses pnpm workspaces).
- Shared TypeScript types live in `packages/shared-types` — use them instead of redefining locally.
- Backend is TypeScript (`apps/backend/src`).
- Keep components in `apps/mobile/components/`, screens in `apps/mobile/app/`.
- When adding or changing a backend feature, check it against running more than one backend instance: in-memory state (`Map`s, caches, timers, counters), socket broadcasts, check-then-write races, work done on every boot, and anything else that breaks or costs more with several instances or more load. Log each problem you find in `docs/known-issues.md` (under "Scaling past one backend instance", or "Backend: affects the single instance we run today" if it hurts now) with what you'd see, why, and the suggested fix, and mention it to the user. We run one instance for now, so log these rather than fixing them unless asked.
- When changing how avatars are drawn (the rig, draw order, animation clips, limb ordering, or art that overlaps the body such as hair, coats and hats), use the `avatar-rendering` skill (`.claude/skills/avatar-rendering/`): render every clip from the front and from behind with `pnpm --filter @chat-app/backend art:poses` and look at the sheets before calling it done.
- After completing every task, ask the user whether to commit and push the changes. Do not commit or push without their confirmation.
