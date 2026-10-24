# Come By — Tasks

## Step 0: project setup
- [x] Vite + TypeScript + Canvas 2D, no engine, no external art
- [x] CLAUDE.md (vision, design laws, palette, controls)
- [x] TASKS.md (milestones as checklists)
- [x] git init, GitHub Pages workflow

## M1 Pasture
- [x] Integer-scaled low-res canvas (~240px short side), nearest-neighbour
- [x] Palette module; pixel font; sprite-from-string system
- [x] World tile map with regions, forest masses, grass tufts, buttercups
- [x] Baked terrain + canopy layers (dithered teal/plum trees, sage shadows)
- [x] Dog: movement, sprint + stamina, 4-direction walk cycle, dust puffs
- [x] Camera following the dog with look-ahead, clamped to the world
- [x] Desktop controls (WASD/arrows) and touch controls (virtual stick, buttons)
- [x] Screenshot + console check, commit

## M2 Flock
- [x] Sheep sprites (distinct silhouette, walk cycle, graze frame)
- [x] Boids: cohesion, separation, alignment, per-species weights
- [x] Flight zone + point of balance steering
- [x] Bark (ring, impulse, scatter, stress), nip, lie down (hold)
- [x] Stress meter: bunching when nervous, panic + splitting when high
- [x] Strays that wander off
- [x] Obstacle avoidance and collision against the tile map
- [x] Tune until pushing a flock around is fun on its own
- [x] Screenshot + console check, commit

## M3 Home
- [x] Ranch area with farmhouse (yard fencing moved to M5, where the ranch grows)
- [x] Pen with gate; gate swings shut when the last one is in ("That'll do!")
- [x] Day timer (~5 min), dusk dither, clock HUD
- [x] Group spawning in pastures each morning
- [x] End-of-day summary (delivered, lost, earned, what you can build)
- [x] Screenshot + console check, commit

## M4 Coin and building
- [ ] Penned animals produce goods (eggs, wool, milk) scaled by stress
- [ ] Selling goods for coin (end of day; market stall improves price)
- [ ] Build mode: place/upgrade pens, fences, gates, trough, barn, kennel, market stall
- [ ] Kennel dog upgrades: stamina, speed, bark range, nip strength
- [ ] Screenshot + console check, commit

## M5 Progression
- [ ] Ranch Ledger panel: current tier, goals, what next tier unlocks
- [ ] Tier 1 Homestead: ducks, Home Meadow (tutorial)
- [ ] Tier 2 Smallholding: sheep, Rolling Hills
- [ ] Tier 3 Farmstead: goats, Rocky Rise (climb rocks, split up)
- [ ] Tier 4 Ranch: cattle, River Ford (nips, balk at water)
- [ ] Tier 5 Valley Estate: wild ponies, High Range (endgame)
- [ ] Regions open on the map; ranch visibly grows (farmhouse, fencing)
- [ ] Screenshot + console check, commit

## M6 Night
- [ ] Night phase with dither darkness and lanterns
- [ ] Coyotes (later wolves) hunt strays and unprotected pens
- [ ] Barn protects nearby pens; losses tracked in summary
- [ ] Screenshot + console check, commit

## M7 Helpers and polish
- [ ] Helper dogs: hold a flank by day, guard pens at night
- [ ] Web Audio sound effects
- [ ] Save/load in localStorage
- [ ] Title screen
- [ ] Screenshot + console check, commit

## Decisions
- The reference image arrived as `IMG_2749.PNG`; renamed to `reference.png`.
  Read from it: near top-down view, flat meadow ground, tiny (~7px) sheep
  blobs with dark faces and merged sage shadows, forest as one teal mass with
  heavy irregular plum dithering, sage shadow cast down-left, grass tufts as
  little vertical strokes with the odd buttercup.
- Pure top-down for terrain and trees; animals and buildings get a slight 3/4
  tilt so faces and walls read. Trees are baked into a canopy layer drawn
  above entities, so animals brushing a tree edge pass under the leaves.
- Night/dusk darkness is a Bayer dither of plum pixels instead of alpha, so
  the screen stays inside the palette.
- Sprint on touch = push the virtual stick to its rim (no extra button).
- World is a hub-and-spoke valley: the ranch in the middle, each region a
  clearing in dense forest, joined by corridors with dirt paths. Locked
  regions sit behind a gate in their corridor (`REGIONS[].gate` in
  `src/world/map.ts`). Map is 192x168 tiles of 8px; collision runs on 4px
  cells so fences can be thin.
- Canopy texture copies the reference's technique (mostly teal, plum drawn as
  the lower arcs of leaf clumps, chevrons and specks, denser on the shaded
  lower-left side) rather than random noise.
- `scripts/zoom.mjs` crops and enlarges any PNG for pixel inspection;
  `scripts/mapshot.mjs` exports the whole baked world to `shots/map.png`.
- Herding is tuned with a bot harness (`src/bot.ts`, `scripts/tune.mjs`,
  `scripts/trace.mjs`): a collect-and-drive dog after Strömbom et al. 2014
  plus naive "chase" and "bark spam" players. Target gradient (sheep x12):
  calm walk reaches the goal with ~0 stress; barking every 2s is faster but
  peaks ~0.75 stress; bark spam and chasing split the flock and cause panics.
- Stress comes from crowding (pressure above 0.4), being run flat out,
  being startled (relative approach speed), barks, nips, isolation and
  predators. A dog walking at the flock's pace adds none.
- Lying down shows the nearest flock's flight zone as a faint dashed ring, so
  the "settle" command doubles as a way to read the flock.
- Pens hold 16 "space" (duck 1, sheep/goat 2, cow/pony 4) and take one
  species at a time. The gate stays open while any acceptable animal waits
  within 60px, and swings shut 0.6s after the last arrival with "THAT'LL
  DO!" and the batch's calm rating. Penned animals are always blocked by
  gate cells, so reopening for the next group never lets anyone out.
- Delivery value = species value x calm multiplier from the animal's peak
  stress on the way home: CALM x1.5, STEADY x1, RATTLED x0.6, FRANTIC x0.35.
- Until M6 the night is skipped: nightfall goes straight to the summary.
- A second Claude session ("Hairline skill for game animations") is editing
  `src/art/dog.ts`, `src/art/fx.ts` and `src/systems/particles.ts` in this
  same checkout. Milestone commits leave those files to that session.

