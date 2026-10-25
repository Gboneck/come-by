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
- [x] Penned animals produce goods (eggs, wool, milk) scaled by stress
- [x] Selling goods for coin (end of day; market stall improves price)
- [x] Build mode: place/upgrade pens, fences, gates, trough, barn, kennel, market stall
- [x] Kennel dog upgrades: stamina, speed, bark range, nip strength
- [x] Screenshot + console check, commit

## M5 Progression
- [x] Ranch Ledger panel: current tier, goals, what next tier unlocks
- [x] Tier 1 Homestead: ducks, Home Meadow (tutorial)
- [x] Tier 2 Smallholding: sheep, Rolling Hills
- [x] Tier 3 Farmstead: goats, Rocky Rise (climb rocks, split up)
- [x] Tier 4 Ranch: cattle, River Ford (nips, balk at water)
- [x] Tier 5 Valley Estate: wild ponies, High Range (endgame)
- [x] Regions open on the map; ranch visibly grows (farmhouse, lanterns, decor)
- [x] Screenshot + console check, commit

## M6 Night
- [x] Night phase with dither darkness and lanterns
- [x] Coyotes (later wolves) hunt strays and unprotected pens
- [x] Barn protects nearby pens; losses tracked in summary
- [x] Screenshot + console check, commit

## M7 Helpers and polish
- [x] Helper dogs: hold a flank by day, guard pens at night
- [x] Web Audio sound effects
- [x] Save/load in localStorage
- [x] Title screen
- [x] Screenshot + console check, commit

## M8 Graphics detail
- [x] Regions with their own look: rolling mounds in the Hills, faceted
      outcrops with a front face and scree in Rocky Rise, banks, reeds and
      stepping stones at the Ford, pines and alpine flowers in the High
      Range, lily pads on the Home Meadow pond, ferns under the trees
- [x] Tree crowns along forest edges and as the small groves
- [x] Animated water (river flow, foam, ripples round the stones, glints)
- [x] Grass, flowers and reeds sway as wind gusts cross the valley
- [x] Butterflies and birds with shadows by day, fireflies at night,
      chimney smoke, bees at the hives
- [x] Animals: run, graze, idle look, alert and lying poses per species;
      stress shows on the sprite; wading legs go under water
- [x] Buildings: hipped roofs, clapboard, shutters; the farmhouse grows a
      door hood, a storey with dormers, a porch, lamps and a weathervane;
      barn hayloft, lean-to and weathervane when upgraded; worn and sturdy
      fences; trodden pen floors
- [x] Ranch decor grows with the tiers (woodpile, garden, cart, barrels,
      washing line, beehives, stepping stones)
- [x] Night: flickering elliptical lantern pools, lamp glow, a dawn from the
      east, dusk gathering in the east
- [x] Effects: footprints in soft ground (and on grass at a run), ripples
      and splashes at the ford, dust that suits each species
- [x] Screenshot + console check, commit

## M9 Trials, orders and the legacy (gameplay expansion)
- [x] Show Ground: a new clearing south of the Home Meadow (tier 2, behind a
      region gate), with bunting over the way in
- [x] Trial course: fetch gate, handler's post (a planted crook), drive gate,
      cross-drive gate and a small trial pen; the next gate's flags flap
- [x] Trial runs: E at the post; outrun + lift, fetch, round the post, drive,
      cross-drive, pen; scored on gates and calm, bolts and grips are faults
- [x] Classes: NOVICE (5 ducks), OPEN (5 sheep), CATTLE (4 cows), VALLEY CUP
      (7 sheep); win one to open the next. Every 3rd day is a trial day
      against three rival handlers for prizes and ribbons; other runs are
      practice
- [x] Buyers' yards with carts and name boards: the mill (Home Meadow), the
      drover (a nook off the crossroads road), the sale yard (Show Ground)
- [x] Orders each morning from tier 2 (two from tier 4): a species, a head
      count and a time; paid per head, scaled by how calm each one arrives
- [x] Letting stock out: E at a pen gate holds it open so you can drive the
      stock out; your own stock coming home pays nothing
- [x] Job card at the top centre, arrows to the yard / next gate / trial,
      the judge's result card, Ledger lines, contextual hints and tips
- [x] Goals: tier 3 "fill an order", tier 4 "place in a trial"; past tier 5 a
      legacy ladder of eight goals (40$ each) in the tracker and Ledger
- [x] Helper dogs wait by the post during a run
- [x] Saves keep orders, the trial record and let-out stock; old saves load
- [x] Bot drives the course (`trialGoal`, `runTrial`); `scripts/trialtest.mjs`
      and `scripts/ordertest.mjs`; savetest covers the new state and an old
      save; tune.mjs before/after for every species
- [x] Screenshot + console check, commit

## Decisions
- The reference image arrived as `IMG_2749.PNG`; renamed to `reference.png`.
  It is gitignored and was removed from history before the first push: it
  is a phone screenshot of another game, not ours to publish.
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
  `src/art/dog.ts`, `src/art/fx.ts`, `src/systems/particles.ts` and
  `src/entities/dog.ts` in this same checkout. Milestone commits leave those
  files to that session.
- Dog animation: every frame is a whole grid, grouped per facing
  (`DogPoses` in `src/art/dog.ts`), so tail, ears and spine move with the
  legs. Trot: tail wags up/back/down, ears flop back on the passing frames.
  Sprint: double-suspension gallop, ears pinned, back arched when gathered.
  Lie down sinks through in-between poses (70ms each), then breathes and
  thumps its tail every few seconds; getting up plays them in reverse.
- Bark has no wind-up: the mouth opens on the key press so it never lags the
  input, and the head dips afterwards as follow-through. The burst (three
  sound lines, buttercup flash on the first frame) is drawn facing right and
  quarter-turned for up/down, which is exact on a pixel grid.
- Effects are sprite strips in `src/art/fx.ts`, played once by an `anim`
  particle; puffs fade by thinning pixels, never alpha. Puffs sit on the
  ground layer under entities; the bark burst is in the effects layer,
  pinned to the dog's mouth while it plays.
- Dust: each gallop landing kicks a puff (synced to the frames, not a
  timer); letting go at a gallop or reversing at speed throws a big skid
  puff; lying down puffs a little each side. Trotting raises no dust, so calm
  movement looks calm.
- Build mode pauses the clock (cozy, and it keeps building a deliberate
  choice). It opens with B on the ranch, from the HUD button, or from the
  end-of-day summary, whose BUILD / NEXT DAY buttons make every day end with
  that choice. Leaving build mode entered from the summary starts the day.
- Ranch land you can build on grows with tier (72% of the clearing at tier 1
  up to all of it at tier 4). A lot around the farmhouse stays free so the
  house can grow.
- The trough is a pen add-on (aim it at a pen), not a free-standing object:
  +40% goods and calmer animals in that pen.
- Goods are made only by day, scaled by (1 - 0.75 x stress), and sold at
  dusk. A market stall pays x1.5 and lets you sell livestock to free pen
  space. Dog upgrades are bought in the DOG tab once a kennel is built.
- Tier gates (first pass): T1 pen, fence, trough, kennel; T2 market, barn;
  T3 field gate, pen and barn upgrades; T5 windmill.
- Tier goals (`src/systems/progression.ts`): T1 pen 6 ducks, a calm drive,
  build a kennel. T2 pen 8 sheep, earn 150$, build a market. T3 pen 8 goats,
  build a barn, train the dog 3x. T4 pen 6 cattle, a night with no losses,
  hire a helper. T5 pen 6 ponies, 50 animals penned, build the windmill.
  Tier-ups happen the moment the goals are met: the region gate swings
  open, its animals arrive, the farmhouse grows, new decor appears.
- "Ranch visibly grows" is done with the farmhouse (cabin, flower boxes,
  two storeys at T3, a flag at T4), lanterns that light the night, a well,
  hay, flowers, a bench and a ranch sign that names the tier. Auto-placed
  yard fencing was dropped: it fought with the player's own layout.
- Species personalities, tuned with the bot harness:
  ducks forgive everything; sheep are the classic flock; goats split up
  under stress (`splitter`) and run for rocks they can climb, where they
  feel safe (flight zone x0.55) until they get bored and come down; cattle
  ignore all but close pressure (`stubborn` 0.45), keep plodding once
  pushed (`momentum`), balk at water unless nipped (nip commits them for
  3s) — heel nips get 5 cattle across the ford in ~25s; ponies spook from
  78px but drive calmly down the north corridor in ~20s, while chasing
  them panics and shatters the herd.
- The goal tracker under the clock always shows the next open goal and
  opens the Ledger (Tab / tap). First-day hints walk through finding,
  circling, lying down, penning, the calm bonus, the ledger and the kennel;
  each region shows a one-time tip on first visit.
- Nights start at tier 2 (tier 1 nights are skipped, so the tutorial days
  stay gentle). Coyotes: 1 + (day + tier) / 5, up to 4; wolves from tier 4.
  They arrive one by one from a tree line near their quarry, sneak in,
  rush the last 50px, and either grab a loose animal or dig under an
  unsheltered pen fence (8s coyote, 6s wolf, doubled for an upgraded pen),
  then drag their catch back to the trees. Reaching a thief makes it drop
  the animal ("SAVED!").
- A bark sends a coyote running; wolves need two (or a nip) and come back
  once. A dog close by unnerves them, a lying dog much less. The night ends
  early once every visitor has gone, so a well-defended night is short.
- A barn shelters pens inside its ring (84px, 120px upgraded); it does not
  protect animals left out in the pastures. Any night with no losses counts
  for the tier 4 goal, including a quiet one behind a barn.
- Night is a 50% checkerboard of plum with pools of light (dog, farmhouse,
  lanterns, barn); predator eyes and the flock's "!" marks are drawn above
  the dark so the action reads.
- Collision fix found while testing nights: a body squeezed into a solid
  cell used to be pushed out through the far face, ratcheting it deep into
  the forest. It now always rescues to the nearest open cell.
- Predators path-find with A* over the tile grid (`src/world/path.ts`);
  helper dogs will reuse it.
- Helper dogs (tier 4, hired in the kennel's DOG tab: 50$ then 90$, two at
  most) wear a buttercup bandana. By day they hold the far flank of the
  flock you are working, a little behind its shoulder at the edge of its
  flight zone, and lie down when you do; H (or HELP) cycles FLANK / STAY /
  HOME. At night each guards the most crowded unsheltered pen, which
  predators then leave alone, and chases off anything that comes close.
  Measured: a helper halves the time to nip cattle home and makes calm goat
  drives far more reliable, without getting in the way of sheep.
- Sound is all Web Audio synthesis (`src/systems/audio.ts`): bark, nip,
  gate clack plus a two-note shepherd's whistle for "that'll do", coin,
  build, tier fanfare, dusk bell, a call for each species (barked-at or
  frightened flocks answer), coyote yips and howls, birds by day and
  crickets by night. Distance falloff and stereo pan from the camera.
  M mutes (remembered).
- Saves (`src/systems/save.ts`, localStorage) are "the morning of day N":
  written each morning, after building, on Save and Quit, and when the
  page is hidden. Continue restores the ranch, herds, goods, upgrades,
  helpers, tier and lifetime record; it never re-spawns the pastures.
- The title screen runs the game in attract mode (the heeler driving a
  flock round the ranch). `?debug` skips the title unless `&title` is
  added; `?play` skips it too.
- Graphics detail comes from shape, dither, animation and variety only: the
  palette is unchanged. Everything added is decoration; collision, the map
  layout and the herding sim are untouched (tune.mjs sheep matches main).
- The world bake is cached per map (the map is seeded), so going from the
  title screen into a game no longer bakes twice. A full bake is ~0.3s on a
  desktop.
- Pines stand up a little (three tiers, 3/4 view) like the buildings,
  instead of being drawn flat from above: flat star shapes read as noise at
  this size. They fill the forest north of a line ~37 tiles down, with a
  ragged edge, so going north the woods turn to conifers. Broadleaf crowns
  are round, drawn like the reference's bushes.
- Rolling Hills are overlapping mounds whose shaded rims are moss crescents
  (back to front, each hides the ones behind). A shaded height field read
  as camouflage blotches.
- Grass, flowers and reeds are no longer baked: they sit in a grid and are
  drawn each frame so a gust (`src/render/wind.ts`) can lean their tips one
  pixel downwind. Smoke, flags, washing and butterflies use the same wind.
- Water is a baked base plus a 16-frame loop of wool highlights per body of
  water (`src/art/water.ts`), cropped to its bounding box.
- Animal drawing moved to `src/render/animals.ts`; the old draw functions in
  `src/entities/animal.ts` are left in place for now (unused). Poses are
  read from public sim state only. "Lying down" is a pose: calm, still
  animals settle after a while (penned ones quickly at night) and get up the
  moment anything moves them. A goat on a rock is drawn 2px up, on its top.
- `src/render/life.ts` is the living-world layer (butterflies, birds,
  fireflies, smoke, footprints, ripples, species dust). It has its own
  particle list and never touches the sim; hooked into `game.ts` with one
  update call per mode.
- Building ground shadows are their own drawables sorted before everything,
  so a shadow never lands on an animal standing in front of the building.
- Dawn is render-only (`src/render/sky.ts`): the first 14s of every morning
  after a night, darkest in the west. Day 1 starts in full light so a new
  game (and `npm run shot`) never opens in the dark.
- `scripts/shot.mjs` reuses any server already on its port, which with
  several worktrees running can screenshot another checkout: `SHOT_PORT`
  picks a different port. `scripts/regions.mjs` screenshots every region
  (and a built-up ranch) at real scale.
- Trials and orders (M9) were built in a parallel session; graphics, sound
  and UI sessions own the other files. New UI is in `src/ui/jobs.ts`, new
  art in `src/art/course.ts`; the hooks into `render/world.ts` and
  `ui/ledger.ts` are one line each.
- The Show Ground is reached through the Home Meadow, not from the ranch,
  so no player layout can block the way in. `RegionId` gained `show`.
- A trial run pauses the day clock (as build mode does), so a run never
  costs the day, and no goods are made while it is paused. The dog must
  stay on the field: walking off for 2.5s retires the run.
- Trial scoring out of 100: outrun + lift 10 (a quiet lift heading for the
  fetch gate), each gate 15 (share of the flock through it, judged once the
  flock is past its line; skipping a gate scores 0), round the post 10,
  pen 20 (half credit for a pen unfinished at time), calm 15 (mean stress
  over the run). Bolts -2 each (up to -10); a nip on a sheep or duck is a
  grip, -3. Cattle may be heeled.
- Gates are 28px wide. The bot scores: novice calm ~95, bark-every-2s ~39;
  open calm ~99, bark ~23, crowding ~27; cup calm ~100, bark 0 (retired),
  crowding ~62; cattle need close work or nips (crowding ~69, nips ~41,
  a hands-off calm bot ~20), as in the pastures. Rival ranges are set
  below a clean run: novice 44-66, open 54-74, cattle 50-70, cup 64-82,
  the cup's rising 3 a win (to +12).
- One prize run per trial day; it is used up when it starts. Prizes:
  novice 30/18/10, open 50/30/15, cattle 80/45/20, cup 140/70/35.
- Orders pay species value x 2.5 per head x the calm multiplier on arrival
  (x1.5 calm, down to x0.35 frantic), against x3 for selling at the market
  stall. A buyer leaves at the stated hour, paying for what has come.
  Wild animals count too: driving a hill flock straight to the drover is
  allowed and quick.
- Let-out stock feels the full flight zone (penned stock feel half) and is
  drawn towards the gateway when pushed; once out of the pen's footprint it
  is loose and marked as home stock. The gate shuts again once the dog has
  gone and the gateway is clear. Measured: six sheep out of the starter pen
  in ~20s; four of them to the drover in ~30s, all calm (76$). Barking every
  2s on the same drive panics them and misses the order.
- The trial flock only flocks with itself, so stray stock on the Show
  Ground cannot join it. Trial animals cannot be penned on the ranch and
  are never saved.
- tune.mjs before and after: the same within run-to-run noise for every
  species (the wild herding code path is unchanged; the before/after logs
  are in the PR).
