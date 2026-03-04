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

| Name |
|------|
| walk |

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

## Default Room

A personal room is created and added to both `ownedRooms` and `rooms` on the user.

| Field       | Value                   |
|-------------|-------------------------|
| Name        | `{username}'s Room`     |
| Description | Welcome to my room!     |
| Category    | personal                |
| Person Limit| 10                      |
| Dimensions  | 10 × 10 × 5            |

---

## Notes

- Items are referenced by **name**, not ObjectId, so the config survives DB reseeds.
- If a named item is missing from the DB at signup time, a warning is logged but signup still succeeds.
- To change what new users receive, edit [`signup-defaults.config.ts`](./signup-defaults.config.ts) only — no service changes needed.
