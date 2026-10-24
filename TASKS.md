# Come By — Tasks

## Step 0: project setup
- [x] Vite + TypeScript + Canvas 2D, no engine, no external art
- [x] CLAUDE.md (vision, design laws, palette, controls)
- [x] TASKS.md (milestones as checklists)
- [x] git init, GitHub Pages workflow

## M1 Pasture
- [ ] Integer-scaled low-res canvas (~240px short side), nearest-neighbour
- [ ] Palette module; pixel font; sprite-from-string system
- [ ] World tile map with regions, forest masses, grass tufts, buttercups
- [ ] Baked terrain + canopy layers (dithered teal/plum trees, sage shadows)
- [ ] Dog: movement, sprint + stamina, 4-direction walk cycle, dust puffs
- [ ] Camera following the dog with look-ahead, clamped to the world
- [ ] Desktop controls (WASD/arrows) and touch controls (virtual stick, buttons)
- [ ] Screenshot + console check, commit

## M2 Flock
- [ ] Sheep sprites (distinct silhouette, walk cycle, graze frame)
- [ ] Boids: cohesion, separation, alignment, per-species weights
- [ ] Flight zone + point of balance steering
- [ ] Bark (ring, impulse, scatter, stress), nip, lie down (hold)
- [ ] Stress meter: bunching when nervous, panic + splitting when high
- [ ] Strays that wander off
- [ ] Obstacle avoidance and collision against the tile map
- [ ] Tune until pushing a flock around is fun on its own
- [ ] Screenshot + console check, commit

## M3 Home
- [ ] Ranch area with farmhouse, yard fence and openings
- [ ] Pen with gate; gate swings shut when the last one is in ("That'll do!")
- [ ] Day timer (~5 min), dusk dither, clock HUD
- [ ] Group spawning in pastures each morning
- [ ] End-of-day summary (delivered, lost, earned, what you can build)
- [ ] Screenshot + console check, commit

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
