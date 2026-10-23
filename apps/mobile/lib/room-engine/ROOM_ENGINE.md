# Room Engine

> **Authoritative reference for all room engine behaviour, visual dimensions, and architecture.**
> Scale constants live in `apps/mobile/constants/grid.ts`.
> When this doc changes, update `grid.ts` to match (and vice-versa).
>
> **Roadmap and progress:** the Skia skeletal engine plan, phase status and "resume here" checklist live in the
> [Room Engine Plan doc](https://claude.ai/code/artifact/cdf82cb3-27c4-48cb-a835-0e85e0fb48d1).
> Read its *Status and how to resume* section before starting room-engine work, and update it when you finish.

---

## Source constants (`constants/grid.ts`)

| Constant      | Current value | What it controls                                    |
|---------------|---------------|-----------------------------------------------------|
| `TILE_W`      | `80` px       | Screen width of one grid cell at zoom 1.0           |
| `TILE_H`      | `40` px       | Screen height of one grid cell at zoom 1.0          |
| `WALL_HEIGHT` | `200` px      | Pixel height of the wall area above the floor       |

`TILE_H = TILE_W / 2` → **classic 2:1 isometric** (YoWorld-style oblique camera).
The camera looks down at roughly 30° so tiles appear as flat diamonds twice as wide as they are tall.
To switch to 45-degree top-down, set `TILE_H = TILE_W`.

---

## Projection model

The room uses a **2:1 isometric** projection (YoWorld / classic isometric games).
Tiles render as wide, flat diamonds. The camera angle is fixed; there is no perspective foreshortening.

### Grid axes

```
         origin (0,0)
            ╱╲
 gx →   ╱    ╲   ← gy
       ╱  cell ╲
      ╲  (0,0)  ╱
       ╲        ╱
```

- **gx** increases right-forward (right wall direction)
- **gy** increases left-forward (left wall direction)
- **gz** increases upward (used for wall-mounted items and character height)

### `gridToScreen(gx, gy, gz, origin)` formula

```
screenX = origin.x + (gx - gy) * (TILE_W / 2)
screenY = origin.y + (gx + gy) * (TILE_H / 2) - gz * TILE_H
```

Moving **+1 in gx**: screen shifts right `TILE_W/2` and down `TILE_H/2` → **(40 px right, 20 px down)**
Moving **+1 in gy**: screen shifts left `TILE_W/2` and down `TILE_H/2` → **(40 px left, 20 px down)**
Moving **+1 in gz**: screen shifts up `TILE_H` → **(40 px up)**

### `screenToGrid(sx, sy, origin)` formula (inverse)

```
dx = sx - origin.x
dy = sy - origin.y
gx = dx / TILE_W + dy / TILE_H
gy = dy / TILE_H - dx / TILE_W
```

---

## Cell dimensions at different zoom levels

The pan/pinch camera in `engines/skia/useCamera.ts` zooms the canvas.

| Zoom level | Cell appears as (px) | TILE_W step (px) | TILE_H step (px) |
|------------|----------------------|------------------|------------------|
| `0.5×`     | 40 × 20              | 20               | 10               |
| `1.0×`     | 80 × 40              | 40               | 20               |
| `1.5×`     | 120 × 60             | 60               | 30               |

Zoom range: `MIN_ZOOM = 0.5`, `MAX_ZOOM = 1.5`, starting at `1.0` (set in `useCamera.ts`).

---

## Item dimension units

Item `dimensions` in the DB are in **grid cells**:

| Field          | Unit       | Meaning                                          |
|----------------|------------|--------------------------------------------------|
| `dimensions.x` | grid cells | Footprint width (along gx axis)                  |
| `dimensions.y` | grid cells | Footprint depth (along gy axis)                  |
| `dimensions.z` | grid cells | Height above floor (wall-mounted items use this) |

### Pixel footprint of a 1×1 item at zoom 1.0

A 1×1 floor item occupies exactly one cell:
- Bounding rectangle: `TILE_W × TILE_H` = **80 × 40 px**
- Visual diamond: `TILE_W` wide, `TILE_H/2` tall = **80 × 20 px** (the flat 2:1 isometric diamond)

A 2×1 item (2 cells wide, 1 deep) spans:
- Screen width: `(2 + 1) * TILE_W/2` = 120 px
- Screen height: `(2 + 1) * TILE_H/2` = 60 px

General formula for an `(nx × ny)` footprint:
```
spanX = (nx + ny) * TILE_W / 2
spanY = (nx + ny) * TILE_H / 2
```

### Wall-mounted items (`gz > 0`)

Each `gz` unit lifts the item `TILE_H` px upward on screen = **40 px per unit** at zoom 1.0.

---

## Floor area

For the default room (`dimensions.x = 8`, `dimensions.y = 6`):

| Measurement            | Formula                             | Value (zoom 1.0) |
|------------------------|-------------------------------------|------------------|
| Floor diamond width    | `(roomX + roomY) * TILE_W / 2`      | 560 px           |
| Floor diamond height   | `(roomX + roomY) * TILE_H / 2`      | 280 px           |
| Total canvas height    | `WALL_HEIGHT + floor diamond height`| 480 px           |

Origin placement:
```
origin.x = canvasWidth / 2 - ((roomX - roomY) * TILE_W) / 4
origin.y = WALL_HEIGHT
```
For a 390 px wide canvas: `origin.x = 195 - 20 = 175`, `origin.y = 200`.

---

## Wall area

The walls are drawn in `engines/skia/Backdrop.tsx` above the floor as **sheared parallelograms**, recorded once into the backdrop `SkPicture`.

| Wall         | Width formula               | Value (8×6 room) | Height              |
|--------------|-----------------------------|------------------|---------------------|
| Left wall    | `roomY * TILE_W / 2`        | 240 px           | `WALL_HEIGHT` = 200 px |
| Right wall   | `roomX * TILE_W / 2`        | 320 px           | `WALL_HEIGHT` = 200 px |
| Combined     | `(roomX + roomY) * TILE_W/2`| 560 px           | 200 px              |

Each wall image is a flat rectangle sheared vertically so its edges follow the isometric grid lines:

```
shear = TILE_H / TILE_W = 0.5      (tan of the axis angle, ≈ 26.565°)

Right wall: +0.5   — leans right-down, matching the gx axis
Left wall:  −0.5   — leans left-down, matching the gy axis
```

Both walls meet at the back-top corner over the grid origin. The floor tiles are drawn after the walls, so they cover the parts of the walls that reach below the floor line.

---

## How to change the scale

To resize everything uniformly (bigger/smaller cells), change only `TILE_W` and `TILE_H` in `grid.ts`. All coordinates, item placements, and character positions derive from these constants automatically.

To change the projection angle:
- **Classic 2:1 isometric / YoWorld-style** (current): `TILE_H = TILE_W / 2`
- **Square / 45° top-down**: `TILE_H = TILE_W`
- **Flat top-down**: change `gridToScreen` and `screenToGrid` to `x = origin.x + gx * TILE_W`, `y = origin.y + gy * TILE_H`

When changing `WALL_HEIGHT`, verify that `WALL_HEIGHT + (roomX + roomY) * TILE_H / 2` fits within the typical device canvas height (~600–750 px after safe areas and UI chrome are subtracted).

---

## Avatar size & anchor

| Constant        | Value   | File                                              |
|-----------------|---------|---------------------------------------------------|
| `AVATAR_HEIGHT` | `80` px | `lib/room-engine/engines/skia/skeleton/humanoidV1.ts` |

`AVATAR_HEIGHT = 2 × TILE_H` gives the YoWorld proportion (an avatar is about 2 tile heights tall). The humanoid-v1 rig's root is the ground point between the feet.

**Anchor rule:** the rig root (the feet) is drawn at `gridToScreen(gx, gy, gz, origin)`, where `gz` is the seat height while sitting and 0 otherwise.

**Depth sort:** avatars use `depth = gx + gy + 0.5` so they render in front of floor items placed at the same tile; seated avatars use their seat item's depth + 0.01 (see Skia engine notes).

---

## 2D avatar previews

### Skia preview (`components/AvatarPreview.tsx`)

The avatar editor (`components/AvatarEditorScreen.tsx`) previews the rigged Skia avatar exactly as rooms draw it, playing the `idle` clip. `<AvatarPreview avatar size rotatable />` takes an `AvatarOutfit` (see `wearables/useAvatarArts.ts`: per part, the selected variant first in `variants`, of which only `rigAsset` and `color` are read; a saved `Avatar` fits as is).

- **Outfit:** the editor keeps each part's chosen variant (`previewVariants`), seeded from the avatar being edited, or in create mode from `GET /api/v1/avatar/defaults` (which returns each default's `rigAsset`), and replaced as the user picks variants from the catalog. Unsaved picks show as soon as they compose.
- **Art:** `useOutfitArts({ preview: outfit })`, the same hook and caches rooms use (`useAvatarArts` wraps it, mapping actors to outfits), so an outfit composed in the editor is ready in the room and vice versa. The programmer-art placeholder shows until the outfit composes; a failed compose keeps the placeholder.
- **Drawing:** `engines/skia/useAvatarPreviewPicture.ts` runs a frame callback that records one `SkPicture` per frame calling the room's `drawAvatar` (`engines/skia/drawAvatar.ts`, shared with `useWorldPicture`) with the canvas translated to the feet and scaled by `size / 100` (100 rig px fill the height: the 80 px avatar plus headroom). The canvas is `0.75 × size` wide; the editor uses `size = 220`.
- **Facing:** `rotatable` adds a small button that cycles SE → SW → NW → NE (front right, front left, back left, back right).

Every outfit composed in the editor is cached for the app's lifetime (like rooms), so trying many combinations holds one atlas each.

### SVG preview (`UserCharacter.tsx`)

The profile screen and the room's Avatars drawer still draw avatars as stacked SVG layers by `components/ui/UserCharacter.tsx`.


All avatar parts are rendered inside a single character container of size `(w × size)` where `w = Math.round(size * 2/3)`. Default `size = 200` → **133 × 200 px**.

Rendering happens in four ordered passes:

```
Pass 1 — body       skin, face, bottoms, tops, footwear, wristwear
Pass 2 — face feats facialHair, nose, eye, mouth   ← nested in face container
Pass 3 — hair       hair, headwear
Pass 4 — top overlay facewear (glasses/masks — above hair)
```

### Body layers (`LAYER_LAYOUT`) — % of character container

| Part        | top  | left | width | height |
|-------------|------|------|-------|--------|
| `skin`      | 4%   | 20%  | 60%   | 38%    |
| `face`      | 2%   | 10%  | 80%   | 46%    |
| `hair`      | 0%   | 10%  | 80%   | 48%    |
| `headwear`  | 0%   | 6%   | 88%   | 40%    |
| `tops`      | 38%  | 2%   | 96%   | 42%    |
| `wristwear` | 52%  | 2%   | 36%   | 20%    |
| `bottoms`   | 62%  | 4%   | 92%   | 36%    |
| `footwear`  | 86%  | 8%   | 84%   | 14%    |
| `facewear`  | 12%  | 6%   | 88%   | 18%    |

### Face feature container (Pass 2)

The face feature container is a `position: 'absolute'` View placed at the `face` layer bounds (`top: 2%, left: 10%, width: 80%, height: 46%`). `overflow: 'visible'` allows features to extend slightly beyond its edges.

### Face feature layers (`FACE_FEATURE_LAYOUT`) — % of face container

Derived from body-relative values via:
```
new_top%  = (char_top%  − 2)  / 46 × 100
new_left% = (char_left% − 10) / 80 × 100
new_w%    = char_w%  / 80 × 100
new_h%    = char_h%  / 46 × 100
```

| Part         | top  | left | width | height | Notes                       |
|--------------|------|------|-------|--------|-----------------------------|
| `eye`        | 28%  | -8%  | 115%  | 30%    | Extends beyond face sides   |
| `nose`       | 46%  | 23%  | 55%   | 39%    |                             |
| `mouth`      | 63%  | -5%  | 110%  | 24%    | Slightly wider than face    |
| `facialHair` | 59%  | 10%  | 80%   | 30%    |                             |

To tune feature positions, edit `FACE_FEATURE_LAYOUT` in [UserCharacter.tsx](../../../components/ui/UserCharacter.tsx). If the face shape changes, update `FACE_BOUNDS` (and `LAYER_LAYOUT['face']`) to match — they must stay in sync.

---

## Engine architecture

Rendering sits behind an engine contract. Everything that is not drawing lives in a shared session; the engine only draws and reports taps. Skia is the only engine; the original View-based engine was deleted on 2026-10-22 (recover it from git history before that date if ever needed).

```
Room.tsx                      glue: session + shell + the Skia engine
core/contract.ts              RoomEngine, RoomRendererProps, RoomScene, ActorState
core/facing.ts                facingFromDelta, facingToView (rig view + mirror)
core/seats.ts                 findSeat, seatPosition, seatApproach for sit actions
core/useWalkabilityGrid.ts    blocked cells from placed items
core/usePathfinding.ts        A* + string-pulling; the session routes every walk through it
session/useRoomSession.ts     socket events, actors, chat, edit mode, intents
session/RoomShell.tsx         header / edit toolbar, chat input / avatar, emote or inventory drawer, loading + error
engines/skia/                 Skia + Reanimated renderer, skeletal avatars
engines/skia/skeleton/        humanoid-v1 rig, hand-written clips, sampler/solver worklets, programmer-art atlas
```

Contract rules:

- Engines receive `scene`, `actors`, `mode` and `edit` as props and report `onFloorTap`, `onItemTap`, `onCellTap`, `onActionComplete`, always in **grid coordinates**.
- Engines never touch the socket, REST API or React Query.
- The session owns logical state (`position`, `facing`, `action`); engines own projection, camera, interpolation and hit-testing.
- The session owns every actor's `avatar`: the local one from auth, remote ones fetched from `GET /api/v1/users/:id/avatar` when the actor first appears, on every `RECEIVE_ENTER` and on `RECEIVE_AVATAR_CHANGED`. Saving or switching the selected avatar sends `SEND_AVATAR_CHANGED` (`announceAvatarChanged()` in `utils/socketUtils.ts`); the server relays it to the rooms that socket stands in. Engines draw a placeholder while `avatar` is undefined.
- Edit mode (`editCell`, helpers in `core/editLayout.ts`): `onCellTap` carries the tapped floor cell and the item whose art was hit. With nothing chosen, a tap picks up that item (tinted, with Remove in the toolbar); the next floor tap moves it if its footprint fits, and tapping it again puts it down. With an inventory card chosen (tap it again to unchoose), a tap places a copy on free floor. Taken floor is never overwritten: tapping it picks up the item there. Overlappable items (rugs) neither block nor are blocked.
- The shell's shirt button opens `components/AvatarDrawer.tsx` in place of the chat input: tap an avatar to wear it (`useWearAvatar` in `hooks/useMyAvatars.ts`); Edit and New push the editor over the room. The room screen stays mounted under the editor, so the user never exits and the room sees the change live.
- **Emotes:** owned `EMOTE` animations (`GET /api/v1/inventory/animations`) are listed in `components/EmoteDrawer.tsx`, opened from the header's smiley button. Tapping one sends `SEND_ACTION { roomId, action: { kind: 'emote', animation } }`; the server relays it only if the user owns that emote. The session plays an emote at once when the actor stands still, after its walk when walking, and never while seated; the engine reports `onActionComplete(id, 'emote')` when the clip ends and the session returns to `idle`. Late joiners see an emote in progress through the presence snapshot, started partway through (`elapsedMs`). The session reads the engine's `capabilities.actions` and skips emotes on an engine without `emote`; the shell then hides the button. Every user owns `wave` (signup default, back-filled on server start); `clap`, `laugh` and `dance` are sold in the Shop's Animations tab. A new emote needs a catalog entry in `apps/backend/src/catalog/animations.catalog.ts` and a clip of the same name in `engines/skia/skeleton/clips.ts` (`EMOTE_CLIPS`); clients without the clip finish it at once.
- Facings are isometric (`NE`, `NW`, `SE`, `SW`, from `@chat-app/shared-types`).
- **Sitting:** seatable items (`action: SIT`) carry `seats` (`ItemSeat`: footprint `cell`, `facing`, cushion `offset` in grid units with `z` the seat height), set in `apps/backend/src/catalog/items.catalog.ts` and rewritten on every backend start. Tapping one picks the nearest free seat, sends `SEND_ACTION { roomId, action: { kind: 'sit', itemId, at, seatIndex } }` (`at` is the placed item's position, which tells copies apart) and walks to the cell in front of the seat; when that walk completes the session sets the `sit` action, the cushion position and the seat's facing. Receivers of `RECEIVE_ACTION` run the same walk. Walking away steps to the front cell first. The server arbitrates seats: a sit for a seat someone else holds (sitting on it or walking to it) isn't relayed, and only the sender gets `RECEIVE_SIT_REFUSED`; its session drops the sit (or stands up if the walk already ended) and sends its standing spot as a point.
- **Presence:** the backend keeps who is in each room in memory (`apps/backend/src/sockets/roomPresence.ts`): each user's last point, seat, last emote while standing, and up to five chat messages from the last 10 s, updated on `SEND_MESSAGE`, `SEND_ENTER`, `SEND_POINT`, `SEND_ACTION`, `SEND_EXIT` and disconnect. On `SEND_ENTER` the newcomer alone gets `RECEIVE_ROOM_PRESENCE { roomId, occupants: RoomOccupant[] }`, sent in the same step as the join so no event falls between the two. Occupants are placed directly: seated, at their point, partway through an emote, or at the door if they haven't moved. Their bubbles still on screen show for the time left: each `ChatBubble` carries `sentAt`, and a bubble closes `bubbleDuration` after it was sent, not after it appeared. Only a fresh `RECEIVE_ENTER` (no state) spawns someone at the door, and a point or sit from an actor not yet on screen also places it directly. A reconnect re-sends `SEND_ENTER` with the user's position and seat, so others place them there; entries remember their socket, so the dead socket's late disconnect doesn't remove them. A walking occupant appears at their destination. The session enters only once room details have loaded, so doors and seats are known. This only works with one backend instance; what several would need (Redis) is in `docs/known-issues.md`.

### Dev settings

For performance checks, `EXPO_PUBLIC_ROOM_STRESS_ACTORS=30` (in `apps/mobile/.env.local`) adds 30 wandering avatars to the Skia engine in dev builds. They are engine-local and never reach the session or socket. Restart Metro with a cleared cache (`pnpm expo start -c`) after changing it. The Skia engine runs on iOS and Android; web is not set up.

### Adding an engine

1. Create `engines/<id>/index.ts` exporting a `RoomEngine` (`id`, `capabilities`, `Renderer`).
2. Use it in place of `skiaEngine` in `Room.tsx` (or bring back a registry if two must coexist).

---

## Key files

| File | Role |
|------|------|
| `apps/mobile/constants/grid.ts` | All scale constants + projection math |
| `apps/mobile/lib/room-engine/core/contract.ts` | Engine contract |
| `apps/mobile/lib/room-engine/session/useRoomSession.ts` | Engine-agnostic room state and intents |
| `apps/mobile/lib/room-engine/engines/skia/SkiaRoomRenderer.tsx` | Skia canvas layers, tap routing, bubble overlay |
| `apps/mobile/lib/room-engine/engines/skia/useWorldPicture.ts` | Per-frame UI-thread loop: clip playback, crossfade, facing, depth sort, world picture |
| `apps/mobile/lib/room-engine/engines/skia/drawAvatar.ts` | `drawAvatar` worklet (sample, blend, solve, one `drawAtlas`) and placeholder tints; shared by rooms and the editor preview |
| `apps/mobile/lib/room-engine/engines/skia/useAvatarPreviewPicture.ts` | One idling avatar redrawn per frame, for `components/AvatarPreview.tsx` (the avatar editor's preview) |
| `apps/mobile/lib/room-engine/engines/skia/skeleton/` | `humanoidV1.ts` (solver arrays; the rig itself is `packages/shared-types/src/humanoid-v1.ts`), `clips.ts` (idle, walk, sit, emotes), `sampler.ts` (worklets), `avatarArt.ts` (draw-list format), `programmerArt.ts` (fallback atlas) |
| `apps/mobile/lib/room-engine/engines/skia/wearables/` | `useAvatarArts.ts` (composed art for each actor's session-supplied avatar; `useOutfitArts` for any outfit, used by the editor preview), `atlasCache.ts` (download + disk cache by `atlasVersion`), `composeAvatar.ts` (bakes an outfit into one tinted atlas) |
| `apps/backend/art/` | Wearable source art, rig template and the art workflow (`art/README.md`); `scripts/pack-wearables.ts` packs it |
| `apps/mobile/lib/room-engine/engines/skia/useCamera.ts` | Pan/pinch camera (0.5x–1.5x) as shared values; taps mapped to content coords |
| `apps/mobile/lib/room-engine/engines/skia/actorMotion.ts` | Per-actor shared positions; walks animated on the UI thread |

### Skia engine notes

- `gridToScreen` and `screenToGrid` are worklets, so actor positions are projected on the UI thread.
- Items sit bottom-centre on their grid position; edit-mode cells are centred on grid vertices (taps round, not floor).
- The backdrop (walls, floor, doors) is recorded into one `SkPicture` and re-recorded only when the theme, doors or canvas origin change.
- Chat bubbles are RN views over the canvas, positioned from the actor's shared values through the camera; they don't scale with zoom.
- Items and avatars are drawn into one world `SkPicture` every frame on the UI thread, depth-sorted by live position (`gx + gy`, +0.5 for avatars), so walking past furniture sorts correctly mid-walk.
- Avatars use the shared `humanoid-v1` rig (types in `packages/shared-types/src/rig.types.ts`). Each frame: advance the clip (walk rate scales with the user's speed), crossfade 150 ms on clip changes, sample, solve bones, then one `drawAtlas` per avatar.
- **Sit (Phase 4):** the `sit` clip levels the thighs, hangs the shins and drops the hip 14 px. Actors slide onto the seat over 350 ms with a `gz` motion value for the seat height, keep the seat's facing, and sort just in front of their seat item (`+0.01`), and keep that depth for up to 1.5 s while standing up so they don't pop behind it. An item's optional `frontAssetUrl` (same framing as `assetUrl`) is drawn at `+0.02`, over seated actors and under anyone standing in front.
- Facing comes from the direction of travel each frame while moving, otherwise from the session. SE/SW draw the `front` view, NE/NW `back`; the west pair is mirrored with pre-flipped atlas sprites, because RSXform can't reflect.
- Clip angles are clockwise degrees and both views face screen right before mirroring, so a forward swing is negative. The back view mirrors the bind x offsets (left/right sides swap), not the rotations.
- `GestureHandlerRootView` wraps the app in `app/_layout.tsx` for the camera gestures.
- **Dressed avatars (Phase 3):** catalog variants carry a `rigAsset` (`WearableAsset`: atlas URL, version, per-view attachments with east and west sprites). `useAvatarArts` takes the actor's `avatar` from the session, downloads each atlas once per `atlasVersion` and bakes the outfit into one tinted atlas, cached by outfit. Each avatar is still one `drawAtlas` per frame. Until its outfit is ready an actor draws the tinted programmer-art placeholder; stress avatars always do.
- Art reaches the frame loop through its own shared value, keyed by outfit, and only changes when an outfit finishes composing. Actors carry just the key, so movement never re-copies sprite data to the UI runtime.
- **React Compiler vs worklets:** the compiler (on in `app.json`) hoists capture-free inline lambdas out of components and hooks into plain module functions (`_temp`, `_temp2`, …). If such a lambda sits inside a worklet, for example a `sort` comparator, the UI thread then fails with *"Tried to synchronously call a remote function _tempN on the UI runtime"*. Give any function a worklet calls a name and a `'worklet'` directive at module scope (see `byDepth` in `useWorldPicture.ts`).
