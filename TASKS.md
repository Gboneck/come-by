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

## M8 Sound and music
- [x] Mixer: music, sound and stinger buses, ducking under stingers, a limiter at the end
- [x] Music and sound volumes in the pause menu, remembered; M still mutes everything
- [x] Audio starts on the first tap or key (iOS unlock), sleeps in a background tab
- [x] Sample bank computed in code (plucked strings, bells, bodhran, hooves, river, murmur, reverb), built a few per frame
- [x] Music engine: whistle and fiddle on persistent voices, harp, bass, string pad, reed drone, scheduled ahead on the audio clock
- [x] Title theme ("Come By", G major 6/8), a day theme per region, dusk, night
- [x] Music reacts: a calm drive fills the band out; a panic thins the tune and brings tremolo and a heartbeat; predators close by at night do the same
- [x] Stingers: that'll do (by calm rating), tier-up, end of day
- [x] Soundscape: wind, river and ford, flock murmur, grazing, hooves per species, the dog's paws, gate creaks, menu sounds, birds, crickets, frogs, an owl
- [x] Rain hook for weather
- [x] `scripts/audiotest.mjs`: offline renders with levels, peaks, tuning, music-theory checks, layer balance and CPU
- [x] Typecheck, build, shot, commit

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
- Music (`src/systems/music.ts`) is generative, never a loop. Each piece is
  a key, mode, meter and tempo: title and ranch G major 6/8 (54/58 bpm),
  Home Meadow D major 6/8, Rolling Hills E dorian 3/4, Rocky Rise A dorian
  4/4 over a strong drone, River Ford C major 4/4 with flowing harp, High
  Range D mixolydian 3/4 with two-bar chords, dusk A minor 3/4 (fiddle
  lead), night D minor 3/4 with a music box. Day is in sharp keys and the
  evening moves flatwards, so the light going sounds like it.
- A section is eight chords: an "open" four-chord phrase and a "close" one,
  from folk-idiomatic templates per mode. The tune is built like a folk air:
  a one-bar motif, an answer, the motif sequenced to the third chord, a
  half cadence; then the opening returns and it closes on the tonic (often
  2 to 1). Chord tones on strong beats (graded: downbeat, mid-bar beat,
  other beats), mostly stepwise, leaps filled in, no ping-pong; whistle
  cuts, rolls, slides and slurs. The lead rotates (whistle, fiddle, harp),
  some sections have no tune at all (room to breathe), a fiddle sometimes
  holds guide tones underneath, the ranch quotes the main theme and other
  regions borrow its opening gesture (5-1-2).
- The music reads the game every frame (`Sound.tick`): energy is working a
  flock (dog moving near the nearest group); tension is that group's stress
  and panics, and at night predators by state and distance from the camera.
  Tension above 0.6 turns to tense progressions at the next bar and only
  turns back below 0.35; the tune fades from 0.45 and stops at 0.7;
  tremolo strings from 0.3, a heartbeat from 0.42; tempo creeps up a few
  percent. Calm play always gets the full, consonant band.
- Walking into another region changes the piece on the bar line; scene
  changes (dusk, night, title, summary) on the next beat. Forest corridors
  keep the last region's tune. Paused music is muffled, not stopped.
- Stingers play in the key the bed is heading for and always end on a major
  chord (a Picardy third in the minor regions); the bed ducks to 30% under
  them. With music at zero they still play, at the sound volume. A shut
  pen plays the shepherd's whistle, then a stinger by the batch's rating:
  CALM a full cadence with the whistle, STEADY a harp roll and bells,
  RATTLED or worse two quiet notes. `play('tierup')` is now the tier-up
  stinger (the build screen also uses it for hiring a helper).
- Levels, measured offline at the default volumes (music 7, sound 8): the
  music bed sits at -25 to -28 dBFS RMS with peaks around -10 to -15,
  barks peak around -5; nothing clips and the limiter only catches bursts.
  Within the band the tune leads, harp and bass about 6 dB under, then pad
  and drum, the drone faintest. Sliders use a (level/10)^2 curve.
- CPU: the persistent voices (two mono leads, a four-voice pad, drone,
  tremolo) are automated, never rebuilt; a pluck or footfall is one buffer
  source and one gain. The reverb is one mono convolver (1.5 s), widened by
  delaying its right side 13 ms: half the cost of a stereo one. The whole
  band renders at about 30-45x real time on a laptop. The sample bank is
  about 60 ms of work in all, at most 7 ms per buffer, spread over the first
  second.
- Audio starts only on input that counts as a gesture (Escape does not),
  checked with `navigator.userActivation`; it suspends in a background tab
  and resumes on return or on the next tap (iOS can interrupt it).
- Weather hook: `game.audio?.setRain(0..1)` (cheap every frame) fades in a
  rain hiss and drips and quiets the birds.
- Footsteps: the dog's paws follow its run cycle (every other trot frame,
  every gallop landing, splashes in the ford). Other animals' hooves are a
  random patter whose rate follows their speed over stride near the camera
  (capped at 16 a second per species), so a running herd drums and a
  grazing flock is near silent except for its munching.
