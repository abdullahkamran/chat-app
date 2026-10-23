# Signup Defaults

Everything assigned to a new user automatically on signup.

Config: [`signup-defaults.config.ts`](./signup-defaults.config.ts)
Service: [`../services/signup-defaults.service.ts`](../services/signup-defaults.service.ts)

---

## Wallet

| Currency   | Amount |
|------------|--------|
| Coins      | 500    |
| Cash       | 0      |
| Real Money | 0      |

A `Welcome bonus` transaction is logged to the transaction history.

---

## Animations

| Name | Category |
|------|----------|
| walk | WALK     |
| wave | EMOTE    |

On every server start, existing users are also given any of these they lack (`grantDefaultAnimationsToAll`), so a default added later reaches everyone. Other emotes are sold in the shop.

---

## Avatar Items (avatarInventory)

Every new user receives one variant for each mandatory avatar part plus a default top and bottom. This ensures avatar creation can succeed immediately after signup.

| Item         | Variant  | Category | Mandatory |
|--------------|----------|----------|-----------|
| Default Skin | Default  | skin     | ✓         |
| Normal Face  | Default  | face     | ✓         |
| Test Eyes 1  | Default  | eye      | ✓         |
| Normal Nose  | Default  | nose     | ✓         |
| Happy Mouth  | Default  | mouth    | ✓         |
| T-Shirt      | Default  | tops     | ✓         |
| Jeans        | Default  | bottoms  | ✓         |

> **Mandatory avatar parts:** skin, face, eye, nose, mouth, tops, bottoms
> **Optional parts** (not granted on signup): hair, facialHair, headwear, facewear, wristwear, footwear
> ⚠️ `Default Skin` uses a placeholder `sourceUrl` (`avatar/skin/default.svg`) — replace once skin SVG assets are added.

---

## Room Inventory

None assigned by default (`inventoryItemNames` is empty).

---

## Personal Room

Every user has exactly one personal room ([`personal-room.service.ts`](../services/personal-room.service.ts)),
added to `ownedRooms`. Unlike the other defaults it is **required**: if it can't be created, the signup is undone
(the user is deleted) and returns 500. A unique partial index on personal rooms' `ownerId` stops a second one,
and `deleteByID` won't delete one. Users from before this rule have no personal room: reset the DB
(`POST /api/v1/dev/reset`).

A personal room has no members. It's open to its owner and their friends, like a DM.

| Field       | Value                   |
|-------------|-------------------------|
| Name        | `{username}'s Room`     |
| Description | Welcome to my room!     |
| Category    | personal                |
| Person Limit| 10                      |
| Dimensions  | 10 × 10 × 0            |

---

## Notes

- Items are referenced by **name**, not ObjectId, so the config survives DB reseeds.
- If a named item is missing from the DB at signup time, a warning is logged but signup still succeeds. (The
  personal room is the exception: see above.)
- To change what new users receive, edit [`signup-defaults.config.ts`](./signup-defaults.config.ts) only — no service changes needed.
