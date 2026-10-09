# Room Engine

> **Authoritative reference for all room engine behaviour, visual dimensions, and architecture.**
> Scale constants live in `apps/mobile/constants/grid.ts`.
> When this doc changes, update `grid.ts` to match (and vice-versa).

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

The `ReactNativeZoomableView` in `engines/legacy/LegacyRoomRenderer.tsx` zooms the canvas.

| Zoom level | Cell appears as (px) | TILE_W step (px) | TILE_H step (px) |
|------------|----------------------|------------------|------------------|
| `0.5×`     | 40 × 20              | 20               | 10               |
| `1.0×`     | 80 × 40              | 40               | 20               |
| `1.5×`     | 120 × 60             | 60               | 30               |

Zoom range: `minZoom = 0.5`, `maxZoom = 1.5`, `initialZoom = 1.0` (set in `LegacyRoomRenderer.tsx`).

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

The walls are rendered in `engines/legacy/RoomBackdrop.tsx` above the floor as **skewed parallelograms**.

| Wall         | Width formula               | Value (8×6 room) | Height              |
|--------------|-----------------------------|------------------|---------------------|
| Left wall    | `roomY * TILE_W / 2`        | 240 px           | `WALL_HEIGHT` = 200 px |
| Right wall   | `roomX * TILE_W / 2`        | 320 px           | `WALL_HEIGHT` = 200 px |
| Combined     | `(roomX + roomY) * TILE_W/2`| 560 px           | 200 px              |

### Wall skew transform

Each wall image is a flat rectangle that is sheared via `skewY` so its edges follow the isometric grid lines.

```
skewAngle = arctan(TILE_H / TILE_W) = arctan(0.5) ≈ 26.565°

Right wall: skewY(+26.565°)   — leans right-down, matching the gx axis
Left wall:  skewY(−26.565°)   — leans left-down, matching the gy axis
```

React Native applies `skewY` around the element's center, so `top` must be offset to keep the back-top corner (where both walls meet) at `y = 0`:

```
top = wallWidth * TILE_H / (2 * TILE_W)

Right wall top = (roomX * TILE_W/2) * TILE_H / (2 * TILE_W) = roomX * TILE_H / 4  →  80 px
Left wall top  = (roomY * TILE_W/2) * TILE_H / (2 * TILE_W) = roomY * TILE_H / 4  →  60 px
```

The skewed walls extend below the floor line (`y > WALL_HEIGHT`). Floor tiles are rendered **on top** (later in JSX order), naturally masking the lower portions. No explicit clipping is needed for the walls-above-floor area.

---

## How to change the scale

To resize everything uniformly (bigger/smaller cells), change only `TILE_W` and `TILE_H` in `grid.ts`. All coordinates, item placements, and character positions derive from these constants automatically.

To change the projection angle:
- **Classic 2:1 isometric / YoWorld-style** (current): `TILE_H = TILE_W / 2`
- **Square / 45° top-down**: `TILE_H = TILE_W`
- **Flat top-down**: change `gridToScreen` and `screenToGrid` to `x = origin.x + gx * TILE_W`, `y = origin.y + gy * TILE_H`

When changing `WALL_HEIGHT`, verify that `WALL_HEIGHT + (roomX + roomY) * TILE_H / 2` fits within the typical device canvas height (~600–750 px after safe areas and UI chrome are subtracted).

---

## Character size & anchor

| Constant      | Value    | File                                        |
|---------------|----------|---------------------------------------------|
| `CHAR_HEIGHT` | `80` dp  | `lib/room-engine/engines/legacy/Character.tsx`  |
| `CHAR_WIDTH`  | `53` dp  | derived: `Math.round(CHAR_HEIGHT * 2/3)`    |

`CHAR_HEIGHT = 2 × TILE_H` gives the correct YoWorld proportion (character ≈ 2 tile-heights tall).

**Anchor rule:** the character's *feet* (bottom-center of the sprite) are placed at the screen point returned by `gridToScreen(gx, gy, 0, origin)`. The animation ValueXY stores the already-offset position:
```
animation.x = screen.x - CHAR_WIDTH  / 2   (center horizontally)
animation.y = screen.y - CHAR_HEIGHT        (feet at floor tile)
```

**Depth sort:** characters use `depth = gx + gy + 0.5` so they always render in front of floor items placed at the same tile.

---

## Avatar layer layout (`UserCharacter.tsx`)

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

Rendering is pluggable. Everything that is not drawing lives in a shared session; engines only draw and report taps.

```
Room.tsx                      glue: session + shell + selected engine
core/contract.ts              RoomEngine, RoomRendererProps, RoomScene, ActorState
core/registry.ts              getRoomEngine() — reads EXPO_PUBLIC_ROOM_ENGINE
core/facing.ts                facingFromDelta, facingToDirection
core/useWalkabilityGrid.ts    blocked cells from placed items
core/usePathfinding.ts        A* (not wired into movement yet)
session/useRoomSession.ts     socket events, actors, chat, edit mode, intents
session/RoomShell.tsx         header / edit toolbar, chat input / inventory drawer, loading + error
engines/legacy/               View-based renderer (this document's projection + avatar layout)
```

Contract rules:

- Engines receive `scene`, `actors`, `mode` and `edit` as props and report `onFloorTap`, `onItemTap`, `onCellTap`, `onActionComplete`, always in **grid coordinates**.
- Engines never touch the socket, REST API or React Query.
- The session owns logical state (`position`, `facing`, `action`); engines own projection, camera, interpolation and hit-testing.
- Facings are isometric (`NE`, `NW`, `SE`, `SW`, from `@chat-app/shared-types`). The legacy engine collapses them to a mirrored left/right sprite.

### Selecting an engine

```bash
# apps/mobile/.env.local
EXPO_PUBLIC_ROOM_ENGINE=legacy   # default when unset or unknown
```

Restart Metro with a cleared cache (`pnpm expo start -c`) after changing it.

### Adding an engine

1. Create `engines/<id>/index.ts` exporting a `RoomEngine` (`id`, `capabilities`, `Renderer`).
2. Register it in `ENGINES` in `core/registry.ts`.
3. Set `EXPO_PUBLIC_ROOM_ENGINE=<id>`.

---

## Key files

| File | Role |
|------|------|
| `apps/mobile/constants/grid.ts` | All scale constants + projection math |
| `apps/mobile/lib/room-engine/core/contract.ts` | Engine contract |
| `apps/mobile/lib/room-engine/session/useRoomSession.ts` | Engine-agnostic room state and intents |
| `apps/mobile/lib/room-engine/engines/legacy/LegacyRoomRenderer.tsx` | Zoom config (`minZoom`, `maxZoom`, `initialZoom`), tap-to-grid, depth sort |
| `apps/mobile/lib/room-engine/engines/legacy/GridOverlay.tsx` | Cell hit-targets (uses `TILE_W`, `TILE_H`) |
| `apps/mobile/lib/room-engine/engines/legacy/RoomBackdrop.tsx` | Wall + floor tile rendering |
| `apps/mobile/lib/room-engine/engines/legacy/Character.tsx` | Character positioning via `gridToScreen` |
| `apps/mobile/lib/room-engine/engines/legacy/RoomItemView.tsx` | Item positioning via `gridToScreen` |
