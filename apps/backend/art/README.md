# Avatar wearable art

Wearables for the Skia room engine are drawn against the `humanoid-v1` rig and packed into one atlas per catalog variant. Animations belong to the rig, so new clothing is art only.

## Making an item

1. Open the template in `rig-template/`: `humanoid-v1-front.svg` (facing SE) and `humanoid-v1-back.svg` (facing NE). Red dots are joints: every piece rotates about its bone's joint.
2. Draw the item one piece per bone, in both views. Jeans are `hip`, both `thigh`s and both `shin`s.
3. Export every piece as its own PNG or SVG **at the full frame size (192×288)**, frame-aligned, with the rest transparent. Don't crop: the packer finds each pivot from where the piece sits in the frame.
4. Name each file `<bone>.<layer>`, for example `shin.L.bottoms.png` or `head.hair.svg`. Layers: `skin bottoms tops footwear wristwear` on body bones, plus `neckwear` on `neck` and `chest`; `skin face eye nose mouth facialHair hair headwear facewear` on `head`; `bottoms tops` on `skirt.L`/`skirt.R`; `hair` on `hairBack`. Add a band for pieces that stack against the whole body (see below): `hairBack.hair.behind.svg`, `chest.neckwear.front.svg`.
5. Put them in `wearables/<id>/front/` and `wearables/<id>/back/`, add `wearables/<id>/asset.json`, then run `pnpm art:pack <id>` from `apps/backend`.
6. Point the catalog variant at it: `wearable: '<id>'` in `src/catalog/avatar-items.catalog.ts`. The server attaches it as `rigAsset` on its next start.
7. Check it with `pnpm art:preview out.png body face-normal <id>`. It renders all four facings in the bind pose.

`asset.json`:

```json
{ "mirrorable": true, "tintable": false }
```

- `mirrorable` (default `true`): the west facings (SW, NW) are flipped copies. Set it to `false` for one-sided items (a logo on one side, side-parted hair) and add your own `front-west/` and `back-west/` pieces, drawn on `humanoid-v1-front-west.svg` and `humanoid-v1-back-west.svg`.
- `tintable`: draw the pieces in white and greys and they're tinted at runtime. Pieces on the `skin` and `face` layers take the avatar's skin tone; others take the variant's `color`.

## Drawing rules

- Overlap at the joints: run pieces past the knee, elbow and hip, so a bent limb leaves no gap.
- Long or loose garments (skirts, dresses, long coats): draw the waist on `hip` and the hanging part as two overlapping panels on `skirt.L` and `skirt.R`. Those follower bones swing half as far as the thighs, so the hem moves with the legs and never splits at the hip. Overlap the panels in the middle.
- Long hair: keep the cap on `head` and draw the length on `hairBack`, which turns half as far as the head. Followers are dashed purple on the template.
- Draw bands. Every piece normally stacks with its own bone (far limbs, legs, skirt panels, torso, head, near arm). A `.behind` piece draws behind the whole body and a `.front` piece in front of it, per view: long hair is `hairBack.hair.behind` in `front/` (it hangs behind the shoulders) but plain `hairBack.hair` in `back/` (it covers the back). Capes and backpacks are `behind` from the front; a scarf end that should stay over the near arm is `front`.
- Keep the nearer limb (`.L` in front, `.R` in back) the more detailed one; the far limb is mostly hidden.

## Scripts (run in `apps/backend`)

| Command | What it does |
|---|---|
| `pnpm art:template` | Regenerates `rig-template/` from the rig in `packages/shared-types/src/humanoid-v1.ts` |
| `pnpm art:pack [id...]` | Packs `wearables/<id>/` into `public/wearables/<id>.png` and `src/catalog/wearables.generated.json` |
| `pnpm art:preview out.png <id...>` | Renders a dressed avatar from the packed atlases |
| `pnpm art:starter` | Regenerates the placeholder art for today's catalog (overwrites those folders) |
| `pnpm art:items` | Writes placeholder room item images to `apps/mobile/assets/items/` for catalog items with no image yet (never overwrites) |

The current catalog art is generated placeholder art (`scripts/starter-art.ts`). Replace a folder with real exports and re-pack; nothing else changes. Most new wearables are `tintable` so one folder serves every colour variant; real art can keep that (draw in white and greys) or set `tintable: false` and give each colour its own wearable id. Once a folder holds real art, remove its id from `STARTER` in `starter-art.ts`, or the next `art:starter` run will overwrite it.

Room items work the same way: replace the PNG at the item's `assetUrl` under `apps/mobile/assets/` (keep the canvas framing: a floor item's image is fitted into its isometric footprint box).
