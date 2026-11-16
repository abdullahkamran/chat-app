---
name: avatar-rendering
description: Check and fix how avatars are drawn in motion - which limb, hair or clothing piece is in front, what a pose hides, flickering layers. Use when changing the humanoid rig, its draw order, animation clips, limb ordering, or the avatar draw code; when adding or packing avatar art (hair, coats, skirts, hats, anything that overlaps the body); and when someone reports an arm, hand, hair or garment showing through, hidden, or flickering.
---

# Avatar rendering

An avatar is flat pieces stacked in an order. Every layering bug is the same bug: a piece is on the wrong side
of another piece **in some pose, from some side, in some outfit** that nobody looked at. Typechecks and a
bind-pose preview can't catch it. The only check that works is looking at every clip from the front and from
behind, so this skill is mostly a procedure for doing that, and a rule that you don't call the work done until
you have.

How the order is decided is in `apps/mobile/lib/room-engine/engines/skia/skeleton/limbOrder.ts` (read its header
first) and the rig in `packages/shared-types/src/humanoid-v1.ts`. Clips are in `skeleton/clips.ts`.

## The model, in short

- **Two views.** `front` (facing the viewer) and `back` (facing away). Both face screen right; the west facings
  are mirrors. The near arm is `.L` from the front and `.R` from the back.
- **Forward is +x in both views**, but it means opposite things for depth: towards the viewer from the front,
  away from the viewer from the back. Anything that reaches forward is in front of the body in one view and
  hidden by the body in the other. Most bugs come from getting one view right and not looking at the other.
- **Arms sit on the side the avatar faces**: in front of the whole body from the front, behind the whole body
  (torso, legs, skirt) from the back. Only an arm swung well back changes sides.
- **"Behind the body" means behind all of it.** A piece put behind the torso but in front of the legs shows over
  the trousers.
- **Nothing may change order during idle or walk.** Pieces overlap where they join (a sleeve over the shirt at
  the shoulder), so swapping which is on top every stride flickers their shading. Order changes are for emotes,
  once on the way in and once on the way out.
- **The shoulders are a body's width apart on screen.** Two arms with the same angles stay that far apart, so
  clips where hands meet or spread give each arm its own angles, and `sidesSwapped` flips them for the back view.
- **Bands** (`behind` / `body` / `front`) are per view and never reordered: long hair is `behind` from the front
  and `body` from the back. A new piece that must clear a moving limb usually needs the right band, not a new rule.

## Procedure

Run from `apps/backend`. The tool poses the source SVGs with the app's own sampler, solver and limb order.

1. **Render every clip, both views, in batches of four or five clips** (more and the cells are too small):
   ```sh
   pnpm art:poses <scratch>/a.png --clips=idle,walk,sit,clap,laugh
   pnpm art:poses <scratch>/b.png --clips=wave,dance,thumbsUp,shrug,facepalm
   # ... until every clip in CLIPS (skeleton/clips.ts) is covered. No --clips renders them all in one tall sheet.
   ```
   Each run writes `-front.png` and `-back.png`. Open both. Don't skip the back sheet.
2. **Repeat for the outfits that overlap the most**, at least for idle, walk, sit and two or three big emotes
   (arms up, hands to face, a bow):
   ```sh
   # long hair, long coat, skirt
   pnpm art:poses <scratch>/c.png --clips=walk,sit,cheer,facepalm,bow body face-normal eyes-2 nose-normal mouth-happy hair-long top-long-coat bottoms-skirt shoes-boots
   # hat, glasses, scarf, puffy top, wrist wear
   pnpm art:poses <scratch>/d.png --clips=walk,sit,cheer,facepalm,bow body face-normal eyes-2 nose-normal mouth-happy hair-ponytail headwear-cowboy facewear-sunglasses neck-scarf top-puffer jeans wrist-watch shoes-sneakers
   ```
   When the change is about one piece (new hair, a new coat), put that piece in the outfit.
3. **Look at each row against the checklist below**, cell by cell. Zoom in where pieces cross.
4. **Read the order report** the tool prints: `arm changes / all changes` per clip and view. Idle and walk must
   show `0` arm changes (the tool fails otherwise). A one-shot emote showing more than about 4 changes is
   flipping back and forth: look at why.
5. **Fix, re-render the affected clips in both views, and look again.** A fix for one view routinely breaks the other.
6. **Say what you checked and what you couldn't.** Stills don't show motion: timing, pops between frames, and
   anything only visible at room scale need the app. Tell the user to check those, and name them.

## Checklist (per cell)

- Both arms are where a person's would be: visible from the front; from behind, never drawn across the back or
  over the trousers.
- Hands that should touch something (each other, the face, the thighs) reach it, and aren't a body-width apart.
- Nothing shows through: no skin sliver under hair or a sleeve, no far limb poking out of the torso, no hand
  through a coat or skirt.
- Hair: long hair stays behind the shoulders and arms from the front, covers the neck and back from behind, and
  doesn't swallow a raised arm or a hat.
- Skirts and long coats follow the legs when walking and sitting without splitting at the hip or floating.
- Head pieces (hat, glasses, facial hair) stay on the head when it tilts (bow, laugh, facepalm).
- The same clip reads as the same gesture from both sides. From behind, a gesture in front of the body is hidden
  by the body; a one-armed gesture uses the near arm so it shows beside it.
- Feet stay on the ground line (the green line) in idle, walk and sit.

## Changing things

- **New order rule:** add it in `limbOrder.ts` as another variant bit, keep it off for idle and walk, and keep
  the header comment true. Then run the whole procedure: every rule here was added to fix one pose and broke another.
- **New or changed clip:** write it for the front view's near and far arms, wrap it in `sidesSwapped` unless it
  loops while moving (idle, walk), and render it in both views before wiring it up.
- **Rig or resting order change** (`humanoid-v1.ts`): also re-pack and preview art (`art:pack`, `art:preview`),
  update `apps/mobile/lib/room-engine/ROOM_ENGINE.md`, and check whether the designer's art spec needs the same
  change (see the avatar art spec memory).
- **New art that overlaps the body:** pick its band per view, then steps 2 to 4 with that piece worn.

Keep sheets in the scratchpad, not the repo. Record anything left unfixed in `docs/known-issues.md`.
