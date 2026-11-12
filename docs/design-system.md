# Design system: Tide

How the mobile app looks, and the pieces to build it with. Everything here lives in
`apps/mobile/constants/theme/` (values) and `apps/mobile/components/ui/` (components). If this doc and the
code disagree, the code wins: fix the doc.

**The rule:** every pixel on screen comes from the theme and the UI primitives. No hardcoded colors, sizes,
fonts, radii or spacing in components, and no OS-native UI (alerts, action sheets, raw modals) where a
primitive exists. If nothing fits, add a primitive here rather than one-off styling in a screen.

---

## The look

Tide is **cozy, playful and fun**: a hangout, not a productivity tool.

- **Colors:** mint green (main actions) and sky blue (highlights, edit mode) on deep navy. Gold is only
  for coins, prices and rewards. Red is only for errors and destructive actions.
- **Type:** rounded everywhere. Fredoka for headings and buttons, Nunito for everything else.
- **Shape:** chunky "sticker" UI. Thick 2px edges, generous radii, pill buttons, and **hard drop shadows**
  (no blur on the drop itself) that buttons sink into when pressed.
- **Accents:** icon tiles are tilted a few degrees (`rotate: '-6deg'`) for a hand-placed feel.
- **Dark first.** Only a dark theme exists today. The system is built so a light theme is just another
  set of values (see [Adding a theme](#adding-a-theme)).

---

## Using the theme in code

Themes can switch at runtime, so **never read the theme at module level**: no `StyleSheet.create` with
theme values, no `import { darkTheme }` in a component.

```tsx
import { makeStyles, useTheme } from '@/constants/theme';

// Built once per theme and cached.
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
  const t = useTheme();          // for values used straight in JSX, like icon colors
  const styles = useStyles();
  return <Ionicons name="star" color={t.colors.reward} />;
}
```

| API | Use it for |
|---|---|
| `makeStyles(t => ({...}))` | Stylesheets. Call the returned hook inside the component. |
| `useTheme()` | Values in JSX: icon colors, `placeholderTextColor`, Skia paints. |
| `useThemeName()` | The active theme's name and `setThemeName`, for a future theme picker. |
| `<ThemeProvider>` | Mounted once in `app/_layout.tsx`. Don't mount another. |

Code that draws but isn't a component (Skia, the room engine) gets colors passed in from a hook or
component. It never imports a theme.

---

## Color

Components use **semantic colors** (`t.colors.*`), named for what they're for, never for how they look.
The raw hex values in `palette.ts` are only read by `themes.ts`.

### Surfaces

| Key | For | Dark value |
|---|---|---|
| `background` | Screen background | navy950 `#0E1726` |
| `surface` | Cards, drawers, bottom sheets, tab bar | navy900 `#152238` |
| `surfaceElevated` | Dialogs, chips and tiles on a surface | navy800 `#1D2E4A` |
| `surfaceSunken` | Text inputs | ink `#040810` |
| `border` | Dividers, card edges | navy700 `#28395A` |
| `borderStrong` | Input edges, unselected outlines | navy600 `#364C74` |
| `outline` | The ink edge and drop of sticker elements | ink `#040810` |
| `overlay` | Modal backdrops | ink at 72% |

### Text

| Key | For |
|---|---|
| `text` | Body and headings (frost50 `#F3F7FC`) |
| `textSecondary` | Subtitles, labels, dialog messages |
| `textSubtle` | Small light labels, e.g. item names in grids |
| `textMuted` | Hints, empty states, timestamps |
| `textDisabled` | Disabled text |
| `placeholder` | Input placeholders |

### Accents

Each accent is a set of four. Use the whole set together so a light theme can swap them as one.

| Accent | Base | `…Deep` | `…Soft` | `on…` |
|---|---|---|---|---|
| `primary`: mint, the main action | `#3DDC97` | drop under a filled button | tinted background | text/icons on it |
| `secondary`: sky, edit mode and highlights | `#6CB4FF` | 〃 | 〃 | 〃 |
| `reward`: gold, coins and prices **only** | `#FFC94A` | 〃 | 〃 | 〃 |
| `error`: red, errors and destructive actions | `#FF6B6B` | 〃 | 〃 | 〃 |

`success` (lime) is for confirmations that aren't the main action.

### Everything else

- **Controls:** `icon`, `tabBar`, `tabIconDefault`, `tabIconSelected`, `switchTrackOff`, `switchThumb`.
- **Room:** `bubble`, `bubbleText`, `bubbleTyping`, `transcriptBackground`, `roomShadow`,
  `roomLocalActor`, `roomDoor*`, `roomEditGrid`, `roomItemSelected` (edit mode: tint over the picked-up item's own pixels),
  `roomDropTarget` / `roomDropBlocked` (edit mode: the cells
  under a dragged item, where it can and can't be dropped), `roomDebug*` (dev overlays only).
- **Letter avatars and sender names:** `avatarColor(t, name)` from `components/UserAvatar.tsx`, which picks
  from `t.avatarPalette` by a hash of the name, so a person keeps their color.
- **Avatar art:** `artPalette` in `palette.ts`. It's programmer art that looks the same in every theme,
  so it sits outside the themes on purpose.

### Adding a color

1. Add the raw value to `palette` in `palette.ts`.
2. Add a semantic key to `ThemeColors` in `themes.ts`, with a comment saying what it's for, and set it in
   **every** theme.
3. Use `t.colors.<key>`.

Before adding one, check whether an existing key already means the same thing. `surfaceElevated` +
`border` covers most "a slightly different card" cases.

---

## Type

Use a `t.type.*` style or `<AppText variant color align>`. Never set `fontWeight`: the custom fonts carry
their weight in the family name, so a bolder style is a different `fontFamily`. Setting `fontWeight` on
them can make the platform swap in a system font or fake the bold.

| Variant | Font | Size / line | For |
|---|---|---|---|
| `display` | Fredoka Bold | 32 / 38 | Hero numbers, splash titles |
| `title` | Fredoka SemiBold | 24 / 30 | Screen and dialog titles |
| `heading` | Fredoka SemiBold | 18 / 24 | Section and drawer titles |
| `button` | Fredoka SemiBold | 16 / 20 | Button labels (`buttonSmall`: 14 / 18) |
| `body` | Nunito SemiBold | 15 / 21 | Default text |
| `bodyStrong` | Nunito ExtraBold | 15 / 21 | Emphasis inside body text |
| `label` | Nunito Bold | 13 / 18 | Form labels, names, list metadata |
| `caption` | Nunito SemiBold | 12 / 16 | Timestamps, footnotes |
| `overline` | Nunito ExtraBold | 11 / 14, uppercase, +1 tracking | Tags like OWNER, section kickers |

```tsx
<AppText variant="title" align="center">Log out?</AppText>
<AppText color="textSecondary">You'll need to sign in again.</AppText>
```

---

## Spacing, shape and motion

All in `tokens.ts`, the same in every theme.

| Token | Values |
|---|---|
| `space` | `xxs` 2 · `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `xxl` 32 · `xxxl` 48 |
| `radius` | `xs` 6 · `sm` 10 · `md` 14 · `lg` 20 · `xl` 28 · `pill` 999 |
| `borderWidth` | `thin` 1 · `thick` 2 (sticker elements use `thick`) |
| `controlHeight` | `sm` 36 · `md` 48 · `lg` 56 (buttons, inputs) |
| `motion` | `fast` 120ms · `base` 200ms · `slow` 320ms |
| `pressDepth` | 3px, how far a pressed button sinks |

Rough guide: screens pad `xl` horizontally; cards pad `lg`; gaps inside a card are `sm`–`md`; cards and
tiles use `radius.lg`, dialogs and sheets `radius.xl`, buttons and chips `radius.pill`.

### Shadows

| Shadow | Looks like | For |
|---|---|---|
| `t.shadows.sticker` | 3px hard ink drop | Cards and tiles sitting on the page |
| `t.shadows.floating` | 4px hard drop + soft glow | Things over content: dialogs, toasts, floating buttons |

Never use a soft blur on its own as the main shadow. The hard drop is the look.

### The press

Filled buttons sit on a drop of their `…Deep` color. When pressed, the drop disappears and the button moves
down `pressDepth` px, so it looks pushed in. Elements without a drop dim to 0.7 opacity instead. `Button`
and `IconButton` do this for you; copy the pattern only when building a new pressable primitive.

---

## Components

Import from `@/components/ui`. Reach for these before writing any styled `View`.

| Component | Use it for | Key props |
|---|---|---|
| `AppText` | All text | `variant`, `color` (a `ThemeColors` key), `align` |
| `Button` | Actions | `variant`: `primary` (main action) · `secondary` (beside it) · `reward` (buying) · `danger` (destructive) · `ghost` (low-key link); `size` `sm`/`md`/`lg`; `icon`, `loading`, `fullWidth` |
| `IconButton` | Icon-only actions | `variant`: `plain` · `surface` (round tile) · `primary`/`secondary` (filled, floating); `size` (diameter), `active`, `badge`; `accessibilityLabel` is required |
| `TextField` | Text input | `leftIcon`, `right`, `size` `md`/`lg`, plus all `TextInput` props |
| `SegmentedControl` | 2–4 mutually exclusive tabs | `options`, `value`, `onChange` |
| `Chip` | Filters, picked items | `label`, `selected`, `trailingIcon` |
| `ScreenHeader` | Top bar of a screen | `title`, `onBack`, `backIcon` `chevron-back`/`close`, `right`, `large` (tab roots). You add the safe-area inset |
| `Badge` | A count on a corner | `count`, `max`, `tone`, `showZero`, `ringColor` |
| `EmptyState` | An empty list | `icon`, `title`, `body`, `action` |
| `Spinner` | Loading | `color` (a `ThemeColors` key), `size` |
| `CoinPill` | A coin balance | `coins` |
| `Dialog` | Modal dialogs, see below | `visible`, `onClose`, `icon`, `tone`, `title`, `message`, `actions`, `bare` |

Elsewhere:

| Component | Where | For |
|---|---|---|
| `showToast` / `ToastHost` | `components/Toast.tsx` | Short notices at the top of the screen |
| `UserAvatar`, `UserRow`, `UserPicker` | `components/` | People in lists and pickers |
| `Drawer` | `lib/room-engine/components/Drawer.tsx` | The room's bottom drawers (avatars, emotes, inventory) |

**Button choice in one line:** one `primary` per screen or dialog; `secondary` for the alternative;
`danger` for anything that deletes or removes; `reward` only when coins are spent.

---

## Dialogs, sheets and notices

Never use `Alert.alert`, `ActionSheetIOS` or a raw `Modal`. They look like the OS, not like Tide. ESLint
blocks the imports (see [Enforcement](#enforcement)).

| You want | Use |
|---|---|
| A confirm, a choice, an error | `showDialog({...})` / `showErrorDialog(e, title?)` |
| A dialog with custom content | `<Dialog>` |
| "Done!" with no answer needed (purchased, saved, someone left) | `showToast({ text, icon })` |
| A panel in the room | `Drawer` |

### `showDialog`

Callable from anywhere: components, hooks, mutation callbacks. Buttons work like `Alert.alert`'s.

```tsx
import { showDialog, showErrorDialog } from '@/components/ui';

showDialog({
  title: `Remove ${user.username}?`,
  message: 'They will lose access to this room.',
  icon: 'person-remove',
  tone: 'error',
  buttons: [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(user) },
  ],
});

useMutation({ ..., onError: (e) => showErrorDialog(e, "Couldn't save") });
```

- **Button styles:** `default` → primary, `destructive` → danger, `cancel` → secondary (ghost when stacked).
- **Layout:** two short buttons sit side by side with Cancel on the left. Three or more stack, Cancel last,
  and only the first ordinary button is filled. That makes `showDialog` fine for a short action menu.
- **Tap outside / back** runs the `cancel` button. A one-button notice closes on a tap outside too. Pass
  `dismissable: false` only when the user really must choose.
- **Queue:** dialogs show one at a time. A button can open the next dialog (menu → confirm) and it pops
  straight in.
- **Tone and icon:** give confirms an icon. `error` + `trash`/`person-remove`/`exit-outline` for
  destructive ones, `reward` + `star` for promotions, `primary` for neutral ones.

### `<Dialog>`

For dialogs with their own content: an item card, a form, a picker.

```tsx
<Dialog
  visible={open}
  onClose={() => setOpen(false)}
  icon="happy"
  title="Set up your avatar"
  message="You need an avatar before joining conversations."
  actions={<Button title="Create Avatar" fullWidth onPress={create} />}
/>

// Your own layout: no padding or centring.
<Dialog visible={!!item} onClose={close} bare popKey={item?._id}>…</Dialog>
```

### iOS: dialog hosts

`showDialog` renders through a `<DialogHost />`, and the newest mounted host wins. On iOS a Modal can only
present from the screen it's mounted in, so:

- the root host is in `app/_layout.tsx`;
- **every screen with `presentation: 'modal'` that can show a dialog mounts its own `<DialogHost />`**
  (see `app/room-members.tsx`, `app/add-friends.tsx`). Mount it once for the screen, not per branch;
- a `Modal` that shows dialogs mounts one inside it (see `MailboxModal.tsx`).

Forget this and dialogs silently fail to appear on iOS over that screen.

### Tap outside to close

Overlays close on a tap outside, unless the area outside is something the user is meant to keep using.
Dialogs and the Postbox close; the room drawers don't, because tapping the room walks your avatar and edit
mode places items there.

---

## Accessibility

- `IconButton` requires an `accessibilityLabel`. Give `Pressable`s without visible text one too.
- Keep text on accents to the matching `on…` color for contrast. Don't put `text` on `primary`.
- Don't rely on color alone: pair `error` with an icon or words.
- Touch targets: at least `controlHeight.sm` (36px), or add `hitSlop`.

---

## Adding a theme

1. Write another `Theme` in `themes.ts` with every key filled. TypeScript fails if one is missing.
2. Add it to the `themes` registry.
3. Pass its name to `ThemeProvider`'s `initial`, or call `setThemeName` from `useThemeName()`.

The navigation theme and status bar follow `theme.scheme` already. Shadows are part of the theme, so a
light theme can soften the ink drop.

---

## Enforcement

- **ESLint** (`apps/mobile/eslint.config.js`) errors on importing `Alert`, `ActionSheetIOS` or `Modal`
  from `react-native`. Only `components/ui/Dialog.tsx` and `MailboxModal.tsx` may use `Modal`. Run
  `pnpm --filter @chat-app/mobile lint`.
- **TypeScript** catches missing theme keys and unknown `color`/`variant` names.
- **Review:** hex codes, raw numbers for padding/radius/font size, or `fontWeight` in a component are bugs.
  Search for them before calling a screen done.
