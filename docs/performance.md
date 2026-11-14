# Mobile performance

Rules for keeping the mobile app smooth, and an audit of where each one stands. Read it before
building a list, a screen with live drawing (Skia, Reanimated frame callbacks), or anything that
runs every frame. Update the audit when you add or change a list.

Backend scaling concerns live in [known-issues.md](known-issues.md), not here.

---

## Lists

### Anything that can grow is virtualized

Use `FlatList` (or `SectionList`) for any list whose length depends on data: rooms, friends,
inventory, shop items, messages, members, search results. Never `ScrollView` with `.map()` for
those: a ScrollView mounts every row up front, so a long list costs memory and startup time
for rows nobody sees.

`ScrollView` + `.map()` is fine only when the count is small and fixed by the app, not the
user's data: category chips, an outfit's colour variants, the avatar strip (`MAX_AVATARS` = 4).

- **Don't nest a vertical `FlatList` in a vertical `ScrollView`.** The inner list measures its
  full height and renders every row, so virtualization is lost. Put the rest of the screen in
  the list's `ListHeaderComponent` / `ListFooterComponent` instead.
- **Page long server lists** with `useInfiniteQuery` and `onEndReached` (see `ShopScreen`,
  `RoomListScreen`). Virtualization only saves rendering. The whole response is still
  downloaded and kept in memory.
- **Cap lists that grow while you watch**, like the room transcript (`TRANSCRIPT_MAX` = 50 in
  `useRoomSession.ts`).
- **Grids** use `numColumns` on a `FlatList` (avatar editor, inventory drawer), not wrapped rows.

### Rows stay cheap

- Give rows a stable `keyExtractor` (the `_id`), never the index.
- Keep heavy work out of `renderItem`. Work out sets and lookups (owned ids, counts) once per
  render of the screen, not once per row.
- When a screen re-renders often (a pending buy, a timer, a socket update), wrap the row
  component in `React.memo` and pass it stable props, so visible rows don't all re-render.

---

## Live drawing (Skia, frame callbacks)

Each animated Skia preview runs its own frame loop and records a picture every frame. A few
are fine, but a whole list of them slows the app.

- **Animate only what's on screen.** List rows with an animated preview take
  `animated={visible}` from `useVisibleIds(active)` in `components/AnimationRow.tsx`, which
  tracks the FlatList's viewable rows. Off-screen rows draw one still pose.
- **Stop when the screen isn't showing.** Tab screens stay mounted after you switch tabs, so
  anything animating must also check focus (`useIsFocused`) and which segment is open.
  `useVisibleIds` does both.
- **Clean up.** A frame callback must stop and unregister when its component unmounts or stops
  showing. Reanimated's `useFrameCallback` only reads its `autostart` argument on mount, so
  start and stop it with `setActive` in an effect (see `useAvatarPreviewPicture.ts`).
- **Still lists draw once.** Cards that never animate (Profile's avatar tiles, the avatar
  drawer) pass `animated={false}` and redraw only when their inputs change.
- **Share expensive art.** Outfits that look the same share one composed atlas through
  `useOutfitArts`' cache. Don't compose per row.

---

## Audit (2026-11-15)

Every list that can grow is virtualized. None are nested inside a ScrollView.

| Screen / component | List | How | Notes |
|---|---|---|---|
| `RoomListScreen` | Rooms | FlatList, paged | |
| `ShopScreen` | Items, outfits, animations | FlatList, paged | Animation previews animate only when visible |
| `InventoryScreen` | Items, outfits, animations | FlatList | Whole inventory in one request, filtered on the device |
| `EditMode/InventoryDrawer` | Placeable items | FlatList | |
| `AvatarEditorScreen` | Wearable grid | FlatList, 3 columns | Category tabs and colour row are ScrollViews (fixed, small) |
| `AvatarDrawer` | Your avatars | FlatList | Still previews |
| `EmoteDrawer` | Your emotes | FlatList | |
| `ChatTranscript` | Messages since entering | Inverted FlatList | Capped at 50. The peek shows the last few with `.map` |
| `MailboxModal` | Mail | FlatList | One request, not paged |
| `add-friends` | Requests, suggestions, search | SectionList / FlatList | One request each |
| `room-members`, `UserPicker` | Members, friends | FlatList | One request, not paged |
| `ProfileScreen` | Avatar strip | ScrollView `.map` | Fine: at most `MAX_AVATARS` (4) |
| `AvatarShopItemCard` | Colour variants | ScrollView `.map` | Fine: a handful per item |

### Gaps to watch

- **No list row is memoized.** Each screen re-render (a buy starting or finishing, a refetch)
  re-renders every visible row. It's cheap today. Memo the row first if a list starts to stutter.
- **Unpaged lists.** Inventory, friends, mailbox and room members come back whole. That's fine at
  today's sizes. Page them (backend `page`/`limit` plus `useInfiniteQuery`) before any of them
  can reach hundreds of entries.
