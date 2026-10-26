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
- An installable app (PWA), all made by `scripts/pwa.mjs` (a Vite plugin):
  `manifest.webmanifest`, icons drawn by the game's own sprite code at
  build time (`src/pwa/icon.ts`, run under Node with a stand-in canvas; no
  image files), the manifest/icon `<link>` tags, and `sw.js`, which keeps
  every file of the build for offline play under a cache named for the
  build. index.html is network first (a deploy shows on the next launch);
  other origins (the co-op relay) are never touched. Only the build
  registers the worker (`src/pwa/register.ts`), never `npm run dev`.
  Phones get an "add to home screen" card on the title (`src/ui/install.ts`).
- `npm run dev` for the dev server, `npm run typecheck`, `npm run shot` for a
  Playwright screenshot + console-error check (writes to `shots/`).
- URL switches: `?debug` exposes `window.game`, `window.sim` and
  `window.resetFlock` (see `src/debug.ts`) and skips the title (add
  `&title` to keep it), and `&weather=rain|fog|wind|storm` holds a sky
  (`&season=spring|summer|autumn|winter` a season);
  `?play` skips the title; `?join=CODE` opens JOIN A FRIEND with the
  code (a co-op invite link), `?relay=URL` points co-op at another relay,
  `&lag=150` (`&jitter=40`, `&loss=0.05`) holds every co-op message that
  long each way to play as if on a slow, lossy line; `?sprites=N` shows the
  sprite sheet from row N; `?safe=top,right,bottom,left` fakes safe-area
  insets (CSS px) to check notched phones.
- Scripts (all Playwright, all start their own Vite server):
  `scripts/shot.mjs` screenshots + console errors (`--hold`, `--press`,
  `--eval` steps), `scripts/zoom.mjs` enlarges part of a PNG,
  `scripts/mapshot.mjs` exports the whole world, `scripts/tune.mjs` runs
  bot herding scenarios per species and prints stress/time/splits
  (`--weather=rain`, `--season=winter` etc.; `--seed=N` makes a run exact
  for before/after),
  `scripts/trace.mjs` screenshots a bot run, `scripts/pentest.mjs`,
  `scripts/econtest.mjs`, `scripts/flowtest.mjs`, `scripts/nighttest.mjs`,
  `scripts/savetest.mjs`, `scripts/trialtest.mjs`, `scripts/ordertest.mjs`,
  `scripts/resttest.mjs`, `scripts/daytest.mjs` (day one affords the kennel
  however the first drive goes), `scripts/weathertest.mjs`, `scripts/transittest.mjs`
  (an order's flock across a built-up ranch to each yard)
  `scripts/discoverytest.mjs` and `scripts/tour.mjs` check the loops end to
  end, `scripts/perftest.mjs` measures each frame's work at a phone size
  under CPU throttling (`--throttle=4,6`, stepped seeded frames on a real
  tier-5 ranch, `scripts/fixtures/tier5.json` from
  `scripts/makefixture.mjs`; `--profile`, `--calls`, `--live`,
  `--quality=low`, `--idle`), `scripts/picturetest.mjs` checks the picture
  cache draws exactly what the art does, `scripts/pwatest.mjs` builds and
  serves the game twice (installable, offline with the server off, a new
  deploy picked up), `scripts/installtest.mjs` the install card,
  `scripts/padtest.mjs` plays every screen with a simulated game pad,
  `scripts/transfertest.mjs` moves a save between two browsers, `scripts/places.mjs` screenshots every hidden place and its way in
  (`--found`, `--only=circle,hut`),
  `scripts/pacetest.mjs` has a decent-player bot (`src/pacebot.ts`) play
  from day one to the valley thriving and logs each tier (days, minutes,
  coin in and out, where it got stuck; `--seeds=1,2,3 --map --verbose`;
  `--year --days=22` plays on through the seasons and prints a table per
  season: hay, hungry nights, lambs, the shearer, the fair),
  `scripts/seasontest.mjs` checks the calendar, winter hay, lambing, the
  shearer, the fair, rare breeds and seasons in the save (old saves load),
  `scripts/lambtest.mjs` drives ewes with lambs calm against barking,
  `scripts/valleytest.mjs` checks the valley growing: the village's steps,
  market day, the festival parade, grazing a paddock clear, timber for the
  old bridge, the shearing shed, the dairy, the agility course, saves,
  `scripts/regions.mjs` screenshots every region at real scale (`--night`,
  `--dusk`, `--tier=N`, `--weather=rain|fog|wind|storm`, `--rest`; spots
  include `show`, `sale`, `drover`, `nap`), `scripts/uitour.mjs` screenshots every screen at
  phone, notched-phone, landscape and desktop sizes onto contact sheets
  (`shots/ui/`), `scripts/playthrough.mjs` plays a new save with the bot
  and logs every hint, tip, banner and card against the clock (for pacing
  and pile-ups; shots in `shots/play/`), `scripts/audiotest.mjs` renders the music, stingers and
  soundscape offline and prints levels, peaks, tuning, theory checks and
  CPU (we cannot listen, so we measure; `AUDIO_PORT` moves its server),
  `scripts/cooptest.mjs` starts the
  relay (`wrangler dev`) and two browsers, a host and a guest, and plays
  co-op end to end (`--shots` into `shots/coop/`, `--lag=150`). `SHOT_PORT=52xx` (or `PORT`) gives `shot.mjs` /
  `regions.mjs` their own port when other checkouts are running servers too.

## Rendering rules

- Render to a small internal canvas (~240px on the short side), then scale up
  by a whole number with nearest-neighbour filtering. The internal size is
  derived from the window so the scale is always an integer. The game draws
  straight into the page's canvas at the internal size and CSS
  (`image-rendering: pixelated`) does the whole-number scale on the GPU
  (`src/gfx/screen.ts`; a drawImage copy where `pixelated` is missing).
- Procedural art that rarely changes (buildings, fences, ranch decor) goes
  through `cached()` in `src/gfx/picture.ts`: drawn into a recorder, shown
  from a bitmap until it asks for different pixels. Art using paths, clips
  or alpha is drawn directly by itself.
- GRAPHICS (pause menu: AUTO, HIGH, MEDIUM, LOW; `src/gfx/quality.ts`) thins
  only mood: read `quality.fx` (share of rain, splashes, critters),
  `quality.shade` (cloud shadows, wet ground), `quality.sway` (grass in
  gusts). Never the night, the herd or anything you play with.
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

| Action          | Keyboard                         | Touch (portrait)              | Game pad                  |
|-----------------|----------------------------------|-------------------------------|---------------------------|
| Move            | WASD / arrow keys                | virtual stick (left thumb)    | left stick / d-pad        |
| Sprint          | Shift (hold, uses stamina)       | push stick to the rim         | RT, LT or RB (hold)       |
| Bark            | Space / K                        | BARK button                   | A                         |
| Nip             | E / J (also: open a pen gate, start a trial at the post) | NIP button  | B          |
| Lie down        | Q / L (hold)                     | DOWN button (hold)            | X (hold)                  |
| Rest            | lie down on the ranch, no stock near (day passes x12) | same | same               |
| Build mode      | B (on the ranch)                 | BUILD button                  | LB (on the ranch)         |
| Ranch Ledger    | Tab / G                          | LEDGER button                 | SELECT                    |
| Helper command  | H                                | HELP button                   | Y                         |
| Pause           | Esc / P                          | pause button                  | START                     |
| Menus           | arrows, Enter, Esc               | tap                           | d-pad / stick, A, B       |
| Build mode keys | arrows, Q/E pick, R turn, X remove, U upgrade, 1-5 tabs | buttons | stick, LB/RB pick, Y turn or upgrade, X remove, LT/RT tabs, B done |
| Typing a name   | the keyboard                     | the phone's keyboard          | up/down letter, right add, left delete, A done |
| Mute            | M                                | sliders to 0 in pause menu    | pause menu                |
| Volume          | pause menu, left/right           | pause menu, - and +           | pause menu, left/right    |
| Graphics        | pause menu, GRAPHICS (AUTO / HIGH / MEDIUM / LOW) | same         | same                      |
| Invite a friend | pause menu, INVITE A FRIEND (code + link) | same, SHARE LINK      | same                      |
| Join a friend   | title, JOIN A FRIEND, type the code (or open the link) | same     | same (B leaves)           |
| Leave a friend's ranch | pause menu, LEAVE ...'S RANCH | same                     | same                      |
| Ping (co-op)    | F: tap = OVER HERE; hold + a direction = HOLD (up), COME BY (right), AWAY (left) | PING button: tap, or hold and slide | not yet               |
| Move a save     | title MOVE A RANCH / pause MOVE THIS RANCH: copy or paste a code, save or load a file | same (share sheet) | same (codes via the browser's box) |

While a pad is in use the prompts read as pad buttons: `src/ui/pad.ts` has
one table (PROMPTS) of keyboard phrases and what they say on a pad, applied
to drawn text through a hook in `src/gfx/font.ts`. A new keyboard prompt
needs a line there.

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
- Lambs (spring) keep to their mothers; a ewe cut off from her lamb turns
  back for it and both fret, so a flock with lambs is driven as pairs.
  Snow (winter) slows everyone a little. The calendar is in
  `src/systems/season.ts`, what each season brings in
  `src/systems/seasonal.ts`.
- Grazing: a calm flock left on an overgrown paddock eats its scrub down
  (goats fastest); a cow driven through the woodpile drags a log, a little
  slower. The valley's projects are in `src/systems/valley.ts`, the ranch
  buildings with work of their own in `src/systems/farmwork.ts`.

## Code map

- `src/main.ts` boot + loop; `src/game.ts` state machine and orchestration.
- `src/gfx/` screen scaling, sprites, font, pixel primitives.
- `src/art/` sprite grids and procedural art (trees, rocks, buildings);
  the player's choices: `dogstyle.ts` (markings, neck piece),
  `ranchstyle.ts` (roof, trim), `decor2.ts` (placeable decor).
- `src/world/` tile map, regions, terrain/canopy baking; `places.ts` the
  hidden places (pockets, ways, landmarks, strays and wild flocks).
- `src/entities/` dog, animals + species, predators, helpers.
- `src/ranch/` buildings, pens, gates, build mode.
- `src/systems/` day cycle, economy, progression, save, audio (mixer and
  sound effects), music (generative score), soundscape, synth (sample bank),
  particles, spawner; `trials.ts` (Show Ground trials), `orders.ts` (buyers'
  orders), `jobs.ts` (where the game hooks into both), `weather.ts` (the
  weather state everything else reads: `game.weather`), `season.ts` (the
  season state everything else reads: `game.season`), `discovery.ts`
  (hidden places found, keepsakes, the Ledger map's fog: `game.discovery`),
  `valley.ts` (the village's steps, the paddocks, the old bridge, market
  day and festivals: `game.valley`, the village itself in
  `game.ranch.village`), `farmwork.ts` (the shearing shed, the dairy, the
  agility yard: `game.farmwork`).
- `src/ui/` HUD, touch controls, ledger, summary, build mode, title/pause;
  `look.ts` + `lookui.ts` the dog's look screen, `decorbuild.ts` the decor
  pieces, `textfield.ts` typed names.
- `src/render/` world drawing and the night dither; `animals.ts` animal
  poses, `life.ts` butterflies/birds/fireflies/smoke/footprints, `sway.ts`
  wind-blown grass and water loops, `wind.ts` gusts, `sky.ts` dawn and dusk.
- `src/bot.ts` the herding bot used for tuning, the attract mode and as
  the model for helper dogs.
- Platform: `src/input.ts` (keys, touch, and game pads via the Gamepad API),
  `src/ui/pad.ts` (pad buttons per screen, pad typing, pad prompts),
  `src/gfx/quality.ts` (GRAPHICS and AUTO), `src/gfx/picture.ts` (cached
  pictures of procedural art), `src/pwa/` (icon, worker registration),
  `src/ui/install.ts` (install card), `src/ui/transfer.ts` (moving a save:
  the code, the file, the checks; mode `transfer`). `src/main.ts` polls the
  pad, draws a quiet menu or build mode at 30fps and a 120Hz screen at 60,
  and feeds AUTO each frame's work time.
- `src/net/` co-op: `protocol.ts` (wire format), `link.ts` (the socket,
  relay URL, lag switch), `host.ts` (hosting: guests' dogs, snapshots),
  `guest.ts` (playing on a friend's ranch), `snapshot.ts` (encode/decode),
  `ping.ts` (pings), `travels.ts` (a guest's own finds), `shared.ts`
  (extra ranch state for guests);
  `src/ui/coop.ts` the invite and join screens, name tags, guests' cards.
- `server/` the co-op relay: a Cloudflare Worker with one Durable Object
  per room code (own `package.json` and `wrangler.toml`).

## Co-op (real time, up to four dogs)

- **The host's browser runs the world** exactly as in single player; each
  guest's browser runs only its own dog (same `Dog.update`, so it never
  lags for them) and draws the rest from the host's snapshots, 100ms
  behind. Guests send their dog at 20Hz plus barks and nips; the host adds
  guest dogs as pressure sources and plays their barks and nips at their
  dog. Not lockstep: the sim is not deterministic, and must not need to be.
- **Red is you.** On every screen your own dog wears the red bandana;
  everyone else's wears buttercup with a name tag, in their own markings.
- **The ranch is the host's.** Pay, building, the Ledger's goals and the
  save are the host's; a guest's own save is never written. When the host
  is at the summary, building, or at the judge's card, guests wait on a
  read-only card. Menus (pause, Ledger, looks, invite) do not stop the
  world while friends are there; resting needs every dog lying down at home.
- New shared-world features: JSON ranch state goes in `src/net/shared.ts`
  (one line each), a byte of per-animal state in `animalExtra` /
  `applyAnimalExtra` (snapshot.ts); keep anything that only the host's dog
  triggers working for guest dogs too (`game.coop` lists the other dogs).
- What a guest finds (places, keepsakes, their map, stamps, brace ribbons)
  is theirs: `src/net/travels.ts`, folded into their own save on its next
  load. Pings: `src/net/ping.ts`. The BRACE class: `braceReady` in trials.ts.
- **Run it locally:** `cd server && npm install && npm run dev` (relay on
  :8787), then `npm run dev`; under `npm run dev` the game finds the relay
  on the page's own host at :8787. Same Wi-Fi: `npm run dev:lan` in
  `server/` and open the Vite network address on both phones.
- **Online:** the relay is live at https://come-by-relay.gboneck.workers.dev
  and the repository variable `RELAY_URL` points the Pages build at it.
  Redeploy the relay after changing `server/`: `cd server && npm run deploy`
  (wrangler is logged in on the user's Mac; ask before deploying). With no
  `RELAY_URL`, the game builds with co-op switched off.
- Before shipping co-op changes: `node scripts/cooptest.mjs`, and after a
  relay deploy `node scripts/cooptest.mjs --relay=https://come-by-relay.gboneck.workers.dev`.

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
