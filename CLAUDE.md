# Come By (working title)

A top-down pixel-art herding game. You play a blue heeler cattle dog who herds
animals home to a ranch, and the ranch grows into a thriving valley as you go.
A herding sim crossed with a cozy kingdom builder, with a clear sense of
progression.

`reference.png` (kept in the project folder but not committed: it is a
screenshot of someone else's work) is a **style reference only**. All art is
original and drawn in code. No external art files, ever.

## Tech

- Vite + TypeScript, HTML Canvas 2D, no game engine, no external art files.
- Static build (`npm run build` → `dist/`) that deploys to GitHub Pages
  (`.github/workflows/deploy.yml`, relative `base: './'`).
- `npm run dev` for the dev server, `npm run typecheck`, `npm run shot` for a
  Playwright screenshot + console-error check (writes to `shots/`).
- URL switches: `?debug` exposes `window.game`, `window.sim` and
  `window.resetFlock` (see `src/debug.ts`) and skips the title (add
  `&title` to keep it), and `&weather=rain|fog|wind|storm` holds a sky;
  `?play` skips the title; `?sprites=N` shows the
  sprite sheet from row N; `?safe=top,right,bottom,left` fakes safe-area
  insets (CSS px) to check notched phones.
- Scripts (all Playwright, all start their own Vite server):
  `scripts/shot.mjs` screenshots + console errors (`--hold`, `--press`,
  `--eval` steps), `scripts/zoom.mjs` enlarges part of a PNG,
  `scripts/mapshot.mjs` exports the whole world, `scripts/tune.mjs` runs
  bot herding scenarios per species and prints stress/time/splits,
  `scripts/trace.mjs` screenshots a bot run, `scripts/pentest.mjs`,
  `scripts/econtest.mjs`, `scripts/flowtest.mjs`, `scripts/nighttest.mjs`,
  `scripts/savetest.mjs`, `scripts/trialtest.mjs`, `scripts/ordertest.mjs`,
  `scripts/resttest.mjs`, `scripts/discoverytest.mjs`
  and `scripts/tour.mjs` check the loops end to end,
  `scripts/places.mjs` screenshots every hidden place and its way in
  (`--found`, `--only=circle,hut`),
  `scripts/regions.mjs` screenshots every region at real scale (`--night`,
  `--dusk`, `--tier=N`), `scripts/uitour.mjs` screenshots every screen at
  phone, notched-phone, landscape and desktop sizes onto contact sheets
  (`shots/ui/`), `scripts/audiotest.mjs` renders the music, stingers and
  soundscape offline and prints levels, peaks, tuning, theory checks and
  CPU (we cannot listen, so we measure). `SHOT_PORT=52xx` (or `PORT`) gives `shot.mjs` /
  `regions.mjs` their own port when other checkouts are running servers too.

## Rendering rules

- Render to a small internal canvas (~240px on the short side), then scale up
  by a whole number with nearest-neighbour filtering. The internal size is
  derived from the window so the scale is always an integer.
- No blurry or sub-pixel drawing: round every draw position to whole pixels,
  never draw rotated/scaled images except by integer factors.
- Sprites are pixel grids defined in code (`src/art/`), one char per pixel.
- Layer order: terrain (baked) → shadows → y-sorted entities → canopy (baked)
  → effects → night dither → UI.
- Night and dusk are a Bayer-dithered plum overlay, not alpha blending, so the
  palette stays pure. Lanterns and the dog cut holes in it.

## Palette

| Name      | Hex       | Use                                              |
|-----------|-----------|--------------------------------------------------|
| Meadow    | `#A3AD6E` | ground                                           |
| Moss      | `#8E9F6C` | grass tufts, light shading, paths                |
| Sage      | `#6F8F7C` | ground shadows under trees and flocks            |
| Teal      | `#487282` | tree canopy, bushes, water                       |
| Plum      | `#42315A` | deep shade, outlines, animal faces, UI panels    |
| Wool      | `#D4D0C6` | sheep, highlights, UI text                       |
| Buttercup | `#E2D27A` | tiny flowers, coins, UI highlights               |
| Bandana   | `#C8483C` | **only** the dog's bandana (the one accent)      |

Nothing else. Helper dogs wear a buttercup bandana so the player's red one
stays unique.

## Controls

| Action          | Keyboard                         | Touch (portrait)              |
|-----------------|----------------------------------|-------------------------------|
| Move            | WASD / arrow keys                | virtual stick (left thumb)    |
| Sprint          | Shift (hold, uses stamina)       | push stick to the rim         |
| Bark            | Space / K                        | BARK button                   |
| Nip             | E / J (also: open a pen gate, start a trial at the post) | NIP button  |
| Lie down        | Q / L (hold)                     | DOWN button (hold)            |
| Rest            | lie down on the ranch, no stock near (day passes x12) | same |
| Build mode      | B (on the ranch)                 | BUILD button                  |
| Ranch Ledger    | Tab / G                          | LEDGER button                 |
| Helper command  | H                                | HELP button                   |
| Pause           | Esc / P                          | pause button                  |
| Mute            | M                                | sliders to 0 in pause menu    |
| Volume          | pause menu, left/right           | pause menu, - and +           |

## Design laws

1. **Herding is the game.** Every feature gives you a new reason to move
   animals or a new way to move them.
2. **Calm beats chaos.** Gentle, skillful herding is always rewarded over
   brute force.
3. **Read at a glance.** Palette and silhouettes do the work; the UI stays
   small.
4. **Every day ends with a choice** about what to build or upgrade.
5. **The next goal is always visible.**

## Herding model (the heart of the game)

- Boids per species (cohesion, separation, alignment) with species weights.
- Flight zone per animal; pressure ramps from 0 at the edge to 1 at the body.
- Point of balance: pressure from behind the shoulder drives the animal
  forward along its heading; pressure from in front turns it away.
- Dog pressure scales with approach speed; lying down sets it to zero.
- Bark = hard radial impulse + scatter + stress. Nip = strong single-animal
  shove; the only thing stubborn cattle really respect.
- Stress: rises with pressure, barks, nips and isolation; decays with calm.
  Moderate stress bunches the flock, high stress causes panic and splitting.
  Delivery value and produce are scaled down by stress — calm always pays.

## Code map

- `src/main.ts` boot + loop; `src/game.ts` state machine and orchestration.
- `src/gfx/` screen scaling, sprites, font, pixel primitives.
- `src/art/` sprite grids and procedural art (trees, rocks, buildings).
- `src/world/` tile map, regions, terrain/canopy baking; `places.ts` the
  hidden places (pockets, ways, landmarks, strays and wild flocks).
- `src/entities/` dog, animals + species, predators, helpers.
- `src/ranch/` buildings, pens, gates, build mode.
- `src/systems/` day cycle, economy, progression, save, audio (mixer and
  sound effects), music (generative score), soundscape, synth (sample bank),
  particles, spawner; `trials.ts` (Show Ground trials), `orders.ts` (buyers'
  orders), `jobs.ts` (where the game hooks into both), `weather.ts` (the
  weather state everything else reads: `game.weather`), `discovery.ts`
  (hidden places found, keepsakes, the Ledger map's fog: `game.discovery`).
- `src/ui/` HUD, touch controls, ledger, summary, build mode, title/pause.
- `src/render/` world drawing and the night dither; `animals.ts` animal
  poses, `life.ts` butterflies/birds/fireflies/smoke/footprints, `sway.ts`
  wind-blown grass and water loops, `wind.ts` gusts, `sky.ts` dawn and dusk.
- `src/bot.ts` the herding bot used for tuning, the attract mode and as
  the model for helper dogs.

## Working from a cloud session (often from a phone)

The game is live at https://gboneck.github.io/come-by/ and deploys from
`main` of `Gboneck/come-by` through `.github/workflows/deploy.yml`.

- On startup `scripts/cloud-setup.sh` installs packages and Playwright's
  headless Chromium (it prints whether that worked).
- Work on a branch. Before shipping: `npm run typecheck`, `npm run build`,
  and `npm run shot` (desktop + phone screenshots in `shots/`, fails on
  console errors). Look at the screenshots. For anything touching herding,
  run `node scripts/tune.mjs <species>` before and after and compare. For
  anything touching sound, run `node scripts/audiotest.mjs` (fails on
  clipping, detuning or console errors).
- Ship by opening a pull request into `main`; merging it redeploys the
  site in about a minute. When the user says to ship or merge, merge it
  yourself (`gh pr merge --squash --delete-branch`) and say when the
  deploy is done (`gh run watch`).
- The user is usually on a phone: keep replies short, say what changed in
  the game in plain words, and give the live link to try it.

## Working rules

- Work milestone by milestone (see `TASKS.md`). After each: run the game,
  take a Playwright screenshot (`npm run shot`), check for console errors,
  tick it off in `TASKS.md`, and commit.
- When a call has to be made, make the reasonable one and note it in
  `TASKS.md` under "Decisions".
