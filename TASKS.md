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

## M10 Feel and UI refinement
- [x] Play tiers 1-5 on desktop and phone sizes (`scripts/uitour.mjs`) and list the friction
- [x] Touch stick: a real walk plateau before the run zone, run ring shows stamina
- [x] Thumb-sized touch targets; a near-miss tap goes to the nearest button
- [x] Safe-area insets (notch, status bar, home indicator) for HUD, controls and menus
- [x] Haptics on bark, nip, gate and tier-up (phones that support it)
- [x] Whole-pixel camera kick on bark and nip, hit-pause on a nip that lands
- [x] Stronger "that'll do": stamp, ring, bump, buzz; coins fly to a purse that ticks up
- [x] Tier-up card with what the tier brings, confetti; it waits for "that'll do" to finish
- [x] Dithered plum fades between day, summary, build, title; summary dims the field
- [x] Summary: rows arrive one by one, earnings count up, next goal shown, input waits 0.6s
- [x] Pause menu as a list of rows; screen shake, flight zones, vibration settings
- [x] Onboarding: "HERE" marker for the drive spot, pen-gate arrow, key caps and
      pulsing buttons, one-time tips for standing in front, rattled and split flocks
- [x] Typecheck, build, shot (desktop + phone), commit

## M11 Sound and music
- [x] Mixer: music, sound and stinger buses, ducking under stingers, a limiter at the end
- [x] Music and sound volumes in the pause menu (rows in the feel/UI menu), remembered; M still mutes everything
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

Round two:
- [x] Show Ground: a pipe-band march for trial runs, the judge's whistle at the start and finish, a cue for each gate cleared, a sour note for a bolt or a grip, applause scaled by score and placing
- [x] Orders: a "sold" stinger and the buyer's cart rolling off; a sigh for an order missed
- [x] Resting: a music-box lullaby while the day flies by, birdsong quicker; all back on the next note when the dog gets up
- [x] Weather: rain and wind from `game.weather`, thunder in storms (published as `game.audio.lightning` for a flash), fog muffles far sounds and adds a damp reverb, the music shades with the sky
- [x] audiotest: trial, lullaby, orders, weather, sfx levels, sky, live round-two checks

## M12 Day one pacing (from playtesting the merged branch)
- [x] Resting: lie down on the ranch with no loose stock near and the day
      (and the pens' goods) runs up to x12; getting up ends it at once
- [x] Day one: when the kennel is out of reach, the hint says goods sell at
      day's end and how to rest; the DOWN button / key cap pulses for it
- [x] One-time tip about resting for players past the tutorial
- [x] `scripts/resttest.mjs`

## M13 Graphics round two: Show Ground, weather, resting
- [x] Show Ground: judge's marquee, benches of onlookers (they cheer each
      cleared part), flags on poles in the wind, bunting that lifts, worn
      ground at the post, the release and the pen gate; the next gate has
      big buttercup flags, chevrons through it and a bobbing marker
- [x] Buyers' yards: shaded carts with spoked wheels, name boards under a
      little roof, the miller's sacks, the drover's camp fire (smoke, and a
      light at night), the sale yard's auction stand and bell
- [x] Rain: slanting streaks, splashes, puddles that grow on paths and dry
      out after, the ground darker when wet
- [x] Fog: a dithered veil, thin round the dog and lamps, thick at the
      edges, drifting; never buries the ground at night
- [x] Wind strength drives the gusts: grass flutters, reeds stay bent,
      smoke, flags and washing stream out
- [x] Storm: heavy rain, a darker sky, lightning (a dither flash and a bolt)
- [x] Cloud shadows drift over the ground on fair days
- [x] Resting: the dog curls up asleep with drifting z's; clouds, smoke,
      grass and water run as a time-lapse and moving shadows swing with
      the sun; it all stops the moment the dog gets up
- [x] More detail everywhere (playtest): wheel ruts and grass down the
      tracks, worn shoulders, tonal speckle, clover, stones, molehill runs
      and bare patches on open ground; boulders, roots and fallen logs at
      the forest edge; stones on the banks and ripple rings by the reeds;
      a sunlit rim on the dog and every coat; moss on the eaves, damp
      footings, board knots and mud, gate hinges and latches, hay wisps
- [x] Screenshot + console check, commit

## M14 Townsfolk
- [x] People sprites (`src/art/people.ts`): plum-outlined 3/4 figures, recoloured per person; stand, walk, carry, hammer, crouch, sit and wave
- [x] The rancher (`src/entities/folk.ts`): out of the farmhouse each morning with a word, chores between jobs (eggs and wool, hay to the troughs, the garden, the woodpile, the well), the bench at dusk and while the dog rests, a lantern round the yard at night
- [x] Herding: when you drive a flock to an open pen, the rancher stands beside the gate on the far side from the dog, a mild pressure the flock turns from into the gateway
- [x] Building: whatever you buy goes up with a scaffold and hammering (the rancher, or a carpenter for the big jobs from tier 3); it works at once and anything left is finished by morning
- [x] The valley fills: the miller, the drover and the auctioneer at their yards (paying for orders, shrugging at missed ones), the judge at the Show Ground, a shepherd in the High Range
- [x] Speech bubbles in the pixel font (`src/ui/speech.ts`) reacting to calm and rattled pens, tier-ups, losses, orders, trial results; morning requests
- [x] Voices as pitched blips per person, footsteps, hammering and chopping
- [x] `scripts/folktest.mjs`; tune.mjs before and after for every species

## M15 Feel and UI, round two (trials, orders, weather, replay pass)
- [x] Orders and trials card in the HUD's left column, under the goal; a run
      shows class, clock, the six parts as pips and the score
- [x] Coach markers: HERE at the crook, "E HOLDS THE GATE OPEN" at a pen a
      buyer wants (until you have done it once), the next gate / post / pen
      during a run, the yard gate while driving a buyer's stock
- [x] Judge's card: rows arrive, the total counts up, the placing stamps in,
      prize coins fly to the purse, input waits 0.7s, touch-sized button
- [x] Ledger: two columns when wide; trials, orders, today's and tomorrow's
      sky; buyers' yards and the crook marked on the map
- [x] Sky icon by the clock; tomorrow's forecast on the summary and in the Ledger
- [x] Replay pass from a new save (`scripts/playthrough.mjs`) on phone and
      desktop; UI friction fixed, pacing reported to the gameplay side
- [x] Typecheck, build, shot, uitour, commit

## M16 Customization
- [x] The dog: a name (typed with the device's own keyboard, or a dice of
      cozy names), coat flecks, face mask, saddle patch, tail tip, and a
      bandana, neckerchief or collar, always in Bandana red
- [x] The ranch: a name for the sign ("COME BY WILLOW CREEK"), the
      farmhouse roof (slate, teal, moss, thatch) and trim
- [x] Decor in a DECOR tab: flower bed, hay bale, dog bed, bench, signpost,
      birdbath, scarecrow, ribbon board, trophy; opened by tier, the kennel
      and trial ribbons and wins
- [x] Offered at a new game (MEET YOUR HEELER), at the kennel (DOG tab),
      in the pause menu, and in build mode (DECOR and RANCH tabs)
- [x] The name in "THAT'LL DO, BLUE!", the kennel and the trial table; the
      title screen shows your own dog
- [x] Saved additively; old saves load with the defaults (`savetest.mjs`)
- [x] Typecheck, build, shot, uitour, commit

## M17 Pacing pass (gameplay, round two)
- [x] `scripts/pacetest.mjs` + `src/pacebot.ts`: a decent-player bot plays
      from day one until the valley thrives (drives each tier's flocks home
      along A* routes, builds what the goals ask for, fills orders, runs
      trials, rests on the ranch, defends the night) and logs every tier
- [x] Found and smoothed the waits and the money flood (table below)
- [x] Before/after table, 5 seeds each

Same bot, 5 seeds, before = the merged round-one branch, after = this
pass. Days are bot days (a person takes longer); "play min" is time at the
controls, resting included.

| tier | days | play min | earned $/day | spent $ | purse at tier end $ | where it stalled before |
|---|---|---|---|---|---|---|
| 1 | 2.0 → 2.0 | 3.0 → 3.7 | 137 → 114 | 190 → 134 | 84 → 94 | kennel waits on day one's eggs (resting covers it); "pen 6 ducks" with 5 out |
| 2 | 1.0 → 1.0 | 6.3 → 6.0 | 578 → 341 | 528 → 317 | 133 → 118 | none |
| 3 | 1.0 → 1.0 | 5.3 → 5.1 | 787 → 462 | 101 → 474 | 819 → 106 | money outruns the shop; calm strays block resting |
| 4 | 1.4 → 1.2 | 9.3 → 6.0 | 1129 → 735 | 191 → 474 | 2281 → 459 | waits for a trial day; land runs short; wild flocks lost at night spoil the no-loss night (one seed: 10 days) |
| 5 | 15.4 → 3.2 | 99.5 → 19.6 | 2763 → 952 | 90 → 80 | 54797 → 3251 | six ponies need 24 pen space with no land left |
| done | 2 of 5 by day 8, 3 still at tier 5 on day 31 → all 5 on days 7-11 (mean 9.4) | | | | | |

"After" is the final code: pacing, weather (from tier 2) and the drove
road (M15), which keeps about a quarter of the clearing free, so tier 5's
"50 animals penned" now takes upgrading pens or choosing what to keep
(about 3 bot days) instead of finishing the day it opens.

Income after the pass, per day: tier 1 stock 126 / goods 102; tier 2
stock 74 / goods 181 / orders 56 / trials 30; tier 3 stock 135 / goods
269 / orders 58; tier 4 stock 185 / goods 512 / orders 111; tier 5 stock
541 / goods 1719 / orders 334 / trials 50. Through tier 4 the purse runs
low most evenings, so the day-end choice is a real one. Past tier 5 money
piles up again: see Decisions.

## M18 Weather (gameplay, round two)
- [x] Skies by tier (tier 1 clear; from tier 2 about half clear, the rest
      wind, rain, fog; storms from tier 4, never two days running)
- [x] `forecast` is always tomorrow's sky, rolled as today's arrives; saved
- [x] Wind: grazing flocks drift downwind, a lightly driven flock leans
      with it, a bark carries further downwind
- [x] Rain: flocks huddle and head for tree cover; stock left out frets
- [x] Fog: flocks huddle, a slightly shorter but jumpier flight zone;
      `weather.sight` for the UI to hide far groups
- [x] Storm: wind and rain, and an extra, bolder coyote at night
- [x] First-time tip per sky; the morning banner names the sky
- [x] `scripts/weathertest.mjs`; tune.mjs `--weather` and `--seed`
- [x] tune.mjs for every species in clear (before = after, exact, until
      the drove-road steering in M15) and in each sky (table below)

Seeded (`--seed=1`), 3 runs each: runs home / mean seconds / peak stress.
Final code (drove-road steering included). The steady style for each species
(calm walk; nip heels for goats and cattle, which need it in any sky) gets
home calmly in every sky; barking every 2s gets worse in wind, rain and storm.

| species | sky | calm walk | nip heels | bark every 2s | chase (sprint) |
|---|---|---|---|---|---|
| duck | clear | 3/3 17s 0.00 | 3/3 11s 0.29 | 3/3 11s 0.67 | 0/3 20s 1.00 |
| duck | wind | 3/3 18s 0.00 | 3/3 12s 0.28 | 3/3 10s 0.81 | 0/3 20s 1.00 |
| duck | rain | 3/3 15s 0.07 | 3/3 11s 0.33 | 3/3 9s 0.98 | 0/3 20s 1.00 |
| duck | fog | 3/3 24s 0.00 | 3/3 14s 0.60 | 3/3 12s 0.78 | 0/3 20s 1.00 |
| duck | storm | 3/3 15s 0.09 | 3/3 16s 0.76 | 2/3 45s 1.00 | 0/3 20s 1.00 |
| sheep | clear | 3/3 12s 0.00 | 3/3 9s 0.03 | 3/3 7s 0.71 | 0/3 20s 1.00 |
| sheep | wind | 3/3 13s 0.00 | 3/3 9s 0.02 | 2/3 44s 0.91 | 0/3 20s 1.00 |
| sheep | rain | 3/3 10s 0.07 | 3/3 8s 0.15 | 3/3 6s 0.97 | 0/3 20s 1.00 |
| sheep | fog | 3/3 14s 0.01 | 3/3 9s 0.03 | 3/3 7s 0.81 | 0/3 20s 1.00 |
| sheep | storm | 3/3 11s 0.07 | 3/3 8s 0.21 | 3/3 5s 1.00 | 0/3 20s 1.00 |
| goat | clear | 0/3 120s 0.00 | 3/3 14s 0.01 | 2/3 54s 0.46 | 0/3 20s 1.00 |
| goat | wind | 0/3 120s 0.01 | 3/3 13s 0.01 | 2/3 54s 0.63 | 0/3 20s 1.00 |
| goat | rain | 3/3 56s 0.07 | 3/3 10s 0.07 | 2/3 47s 0.87 | 0/3 20s 1.00 |
| goat | fog | 1/3 111s 0.01 | 3/3 12s 0.02 | 3/3 15s 0.52 | 0/3 20s 1.00 |
| goat | storm | 1/3 91s 0.12 | 3/3 10s 0.07 | 0/3 120s 1.00 | 0/3 20s 1.00 |
| cow | clear | 0/3 120s 0.00 | 3/3 116s 0.18 | 0/3 120s 0.11 | 0/3 20s 1.00 |
| cow | wind | 0/3 120s 0.00 | 3/3 69s 0.21 | 2/3 102s 0.15 | 0/3 20s 1.00 |
| cow | rain | 0/3 120s 0.07 | 0/3 120s 0.32 | 0/3 120s 0.16 | 0/3 20s 1.00 |
| cow | fog | 0/3 120s 0.00 | 2/3 95s 0.20 | 1/3 114s 0.10 | 0/3 20s 1.00 |
| cow | storm | 0/3 120s 0.12 | 1/3 103s 0.46 | 2/3 62s 0.56 | 0/3 20s 1.00 |
| pony | clear | 3/3 7s 0.00 | 3/3 6s 0.08 | 3/3 6s 0.33 | 0/3 20s 1.00 |
| pony | wind | 3/3 7s 0.00 | 3/3 6s 0.06 | 3/3 5s 0.61 | 1/3 17s 1.00 |
| pony | rain | 3/3 6s 0.04 | 3/3 6s 0.19 | 3/3 5s 0.49 | 0/3 20s 1.00 |
| pony | fog | 3/3 7s 0.02 | 3/3 6s 0.14 | 3/3 6s 0.49 | 0/3 20s 1.00 |
| pony | storm | 3/3 6s 0.05 | 3/3 5s 0.30 | 2/3 43s 0.65 | 1/3 15s 1.00 |

Cattle are slowest in rain: between nips they huddle and drift for the
trees, so a nip drive runs past the scenario's 120s cap.

## M19 Drove road (gameplay, round two, from playtesting)
- [x] The ranch's dirt roads are a drove road (2 tiles either side of the
      track): no pens, buildings or fences on it, a field gate is fine;
      build mode draws its edges while placing and says "KEEP THE DROVE
      ROAD CLEAR". Saves keep what they already have
- [x] A new pen's gate must open onto open ground (not trees or a wall);
      an arrow shows the gate side while placing
- [x] Open pen gates only draw in animals already heading in, so a flock
      walked past a row of pens no longer peels off into them
- [x] Driven animals feel either side of a wall, building corner or fence
      end and slide round it
- [x] `scripts/transittest.mjs`: six sheep let out of a pen and driven to
      each yard across a dense ranch, before and after

Five seeds each; "delivered" = all four the buyer wanted arrived.

| yard | old code, cramped ranch | new code, same cramped ranch (an old save) | new code, ranch built off the road |
|---|---|---|---|
| mill (east) | 0/5 (sheep peel into pens, snag) | 5/5, 42s | 5/5, 31s |
| drover (north) | 5/5, 21s | 5/5, 21s | 5/5, 21s |
| sale yard (east, south) | 0/5 | 5/5, 36s | 5/5, 35s |

A save whose east road is walled off completely (`--layout=blocked`)
still cannot get a flock out east: that needs rebuilding.

Herding tune in clear weather (seeded) before and after the two herd
changes: calm drives are the same or a touch quicker (sheep 12.0s to
11.6s, ponies 7.1s to 6.8s, ducks 16.5s to 16.6s; goats and cattle as
before, nip heels for cattle 2/3 to 3/3). Barking scenarios now reach the
goal more often, because panicked animals no longer jam against walls,
but they still arrive frantic (peak stress 1.0, panics), so calm still
pays best. Goat keyboard-crowding drives got slower (16s to 25-41s).
Seeded ordertest (pen to the drover, four seeds): 17-19s each; the
novice trial with a calm handler scores 99-100 with or without the change.

## M20 Hidden places (world expansion)
- [x] Twelve hidden places, one to three per region, each a small clearing off
      its region through a narrow gap in the trees or up a stream, marked by a
      little waymarker cairn (a flower on top once found): Willow Pool and the
      Old Orchard (Home Meadow), the Stone Circle, Lookout Knoll and the Drove
      Trail (Rolling Hills), the Shepherd's Hut and the Hidden Valley (Rocky
      Rise), the Waterfall Pool and the Water Meadow (River Ford), the Hanging
      Valley and the Old Cairn (High Range), the Showman's Wagon (Show Ground)
- [x] Every place gives a reason to move stock: sweet grass that settles a
      rattled flock (Willow Pool, the Stone Circle), strays to bring home for a
      bonus (the black sheep, the lost heifer across the stream), wild flocks
      that pay double (goats, ponies), a lookout that maps the valley, and a
      latched shortcut home from the hills
- [x] Five keepsakes to keep: an old bell, crook, drover's horn, carved
      whistle and a faded rosette, glinting where they lie
- [x] Landmarks drawn in code (`src/art/landmarks.ts`): standing stones,
      cairns, fruit trees, a willow, the ruined hut and its fold, the wagon,
      the falls, the hurdle; the black sheep's coat
- [x] Fog of war on the Ledger map (walked, glimpsed from the lookout,
      unknown), a star on each place found, found/total on each open region,
      HIDDEN PLACES and KEEPSAKES lines; banner, reward and tip on discovery
- [x] Saves keep places, keepsakes, the fog, strays brought home, wild flocks
      and the hurdle; old saves load with their open regions mapped
- [x] `scripts/discoverytest.mjs` (reachability per tier, finding, keepsakes,
      hurdle, sweet grass, bonuses, save, old save) and `scripts/places.mjs`
      (every place and its way in at real scale); tune.mjs before/after
- [x] Typecheck, build, shot, mapshot, savetest and the loop tests, commit

## M21 Co-op (real time, a friend's dog on your ranch)
- [x] Relay in `server/`: a Cloudflare Worker, one Durable Object per room
      code (WebSocket hibernation, so a quiet room costs nothing); 4-letter
      codes, a host token, slots for up to three guests, a 30s grace for a
      host whose line drops, guests keep their slot for 90s
- [x] Host-authoritative world, guest-authoritative dog: guests send their
      dog at 20Hz and their barks and nips; the host adds their dogs to the
      herd as pressure (and to gates, predators, resting, catching thieves)
- [x] Snapshots at 15Hz: animals as changes (a full one on joining), dogs,
      helpers, townsfolk and their building sites, predators, every gate,
      the clock, the sky; banners, speech, sounds and effects ride along.
      Guests draw them 100ms behind; the ranch itself (the save, as data)
      on joining and whenever it changes; the ranch's numbers as JSON
- [x] Red is you: friends' dogs wear buttercup with their own markings and
      a name tag; an arrow with their name when they are off screen
- [x] INVITE A FRIEND (pause menu): the code big, COPY LINK / SHARE LINK,
      who is here, CLOSE RANCH. JOIN A FRIEND (title) or a `?join=CODE`
      link: type the code, walk over
- [x] The ranch is the host's: pay, building, Ledger goals, the save.
      Guests wait on a card while the host is at the summary, building or
      at the judge's card; a guest's own save is never written. The host's
      menus do not stop the world while friends are there
- [x] Drops: a guest who drops waits 12s, then trots home; a host who drops
      has guests wait (and carry on when they are back); a host who leaves
      sends everyone home with "the ranch closed"; a host whose phone
      sleeps shows guests a waiting card
- [x] `scripts/cooptest.mjs`: relay + two browsers; the guest drives a flock
      into the pen, bark, nip, summary, new morning, build, drops,
      reconnects, leaving, closing, snapshot size and rate, a drive with
      150ms each way; tune.mjs before/after; the existing loop tests
- [ ] BRACE class at the Show Ground for two dogs (optional, not started)

## M22 Seasons: lambing, the shearer, the fair, winter (gameplay, round three)
- [x] A calendar: four days a season from the first day of spring, a year
      counter; autumn days run a little quicker and winter's quicker still,
      with an earlier dusk (`src/systems/season.ts`)
- [x] Spring: ewes in your pens lamb over the first two mornings (from
      tier 2), wild ewes on the hills come with lambs at foot. A lamb keeps
      to its mother and keeps her pace; a ewe cut off from her lamb turns
      back for it and both fret, so a flock with lambs is driven as pairs.
      Lambs take one place in a pen, make no goods, are a fox's first
      choice, and grow up when autumn comes
- [x] Summer: the shearer waits at the drover's (or the mill's) yard on the
      first morning; each sheep brought pays a wool bonus (calm ones more,
      rare ones half again) and comes back out shorn to be walked home
- [x] Autumn fair on the second day at the Show Ground: a show ring (gate
      to the north) judges one animal of each kind against three of the
      valley's, calm counting for most; ribbons pay 40/20/10$. The sale yard
      is a breeders' pen that day: stand by a breed at the fence, E buys it
- [x] Rare breeds (new coats, drawn in `src/art/young.ts`): call duck 30$,
      black sheep 70$, pygmy goat 90$, Highland cow 180$. Worth double at
      sale and to buyers, goods half again, a boost at the fair
- [x] Winter: snow slows loose stock and the dog a little, one wild flock
      fewer per region, short days, and every night each pen eats a bale
      for every four places of stock: the farmhouse loft first (10 bales,
      filled each autumn), then haystacks (a new building: 20 bales, 40$,
      80$ in winter). A stack out of a barn's ring loses 2 bales a night to
      the snow. A pen that goes hungry makes no goods next day and is
      restless (nobody starves)
- [x] Legacy: raise 10 lambs, a winter with no pen hungry, best in class at
      the fair, buy a rare breed
- [x] Seasons and lambs in the save (lambs find their mothers again, hay,
      hungry pens, the fair's results); old saves load as spring, year 1
- [x] The pace bot stocks hay before winter (in a barn's ring), takes its
      sheep to the shearer and home, and buys and shows a breed at the fair;
      `pacetest.mjs --year`
- [x] `scripts/seasontest.mjs`, `scripts/lambtest.mjs`; tune.mjs
      `--season=winter`; tune before = after for every species in clear

Herding, seeded (`--seed=1`), 3 runs each. Clear weather is identical
before and after for all five species (the lamb and snow code only acts
on lambs, their mothers and snow). In snow, everything gets home as often
as in clear weather, a little slower, and calm still beats barking:

| species | style | clear: home, time, peak stress | snow |
|---|---|---|---|
| duck | calm walk | 3/3 25s 0.00 | 3/3 20s 0.00 |
| duck | bark every 0.8s | 3/3 7s 1.00, 6 panics | 3/3 15s 1.00, 5 panics |
| sheep | calm walk | 3/3 11s 0.00 | 3/3 16s 0.00 |
| sheep | bark every 0.8s | 3/3 22s 1.00, 5 panics | 3/3 6s 1.00, 6 panics |
| goat | nip heels | 3/3 13s 0.00 | 3/3 16s 0.00 |
| goat | bark every 0.8s | 3/3 5s 0.99 | 2/3 49s 0.85, 4 panics |
| cow | nip heels | 1/3 116s 0.17 | 1/3 119s 0.26 |
| pony | calm walk | 3/3 7s 0.01 | 3/3 9s 0.00 |
| pony | bark every 0.8s | 3/3 6s 0.37 | 3/3 8s 0.50 |

Lambs (`scripts/lambtest.mjs`, eight ewes, five with a lamb, seed 1):

| style | home | time | mean stress | pairs together at the end | seconds lambs spent cut off |
|---|---|---|---|---|---|
| calm walk | 3/3 | 11s (11s with no lambs) | 0.00 | 5/5 | 0 |
| keyboard, close | 3/3 | 8s | 0.01 | 5/5 | 0 |
| bark every 2s | 3/3 | 7s | 0.18 | 5/5 | 0 |
| bark every 0.8s | 1/3 | 82s | 0.23, 17 panics | 4.7/5 | 10 |
| chase (sprint) | 0/3 | - | 0.50, 17 panics | 3.7/5 | 12 |

The first lamb code made calm drives stall (0-1 of 3 home): a lamb tucked
inside its mother's personal space, she stepped away, it followed, and each
pair wandered off on its own. Ewes now neither flock with nor step away
from lambs (bodies still never overlap), and lambs aim where their mother
is going and keep her pace. The herding bot (and so the helper dogs) reads
a flock by its grown animals.

Pacing to the valley thriving (`pacetest.mjs`, seeds 1-3) is unchanged:
days 7, 8, 7 (before: 9, 8, 7), the same per-tier days, minutes and
purse within a little (tier 4 earns 696$/day against 765$, tier 5 975$
against 1020$: the shearer's morning and autumn's shorter days).

Across a year (`pacetest.mjs --year --days=22`, seeds 1-3, averages):

| season | earned $ | spent $ | haystacks bought | hungry pen-nights | wild stock out (morning) | what happened |
|---|---|---|---|---|---|---|
| year 1 spring | 1142 | 1065 | 0 | 0 | 27 | tiers 1-2; no sheep penned yet, so no lambs |
| year 1 summer | 3537 | 430 | 0 | 0 | 97 | shearer: 8/8 at the drover's; at the mill 0/8 and 4/8 missed |
| year 1 autumn | 4175 | 587 | 13.7 | 0 | 120 | fair day: no breed bought (pens full, no land) |
| year 1 winter | 3680 | 120 | 1.3 (at 80$) | 0 | 92 | winter sends a quarter of the wild stock away |
| year 2 spring | 5074 | 27 | 0 | 0 | 127 | 32 lambs born in the pens |
| year 2 summer | 2545 | 0 | 0 | 0 | 138 | shearer: 8/8, 8/8, 2/8 |

Hay comes to about 600$ a winter for a tier-5 ranch of ~130 head, an
eighth of a season's income; nobody went hungry. An earlier run, before
the bot waited for autumn, bought hay in summer, and lambs were logged on
the day before the morning they arrived (fixed in pacetest). In an earlier
run one seed bought the Highland cow at the fair and won first with it.
Land, not coin, is what runs out late ("no room for a pen" is the top
stall at tier 5), so the purse still grows (about 18,000$ by day 23): see
Decisions on land.

## M23 Co-op, round three: pings, brace, travels, phones
- [x] Pings: F (or the PING button by the thumb buttons, only with friends
      here): a tap says OVER HERE with a flag where your dog stands; hold
      it and pick HOLD, COME BY or AWAY (a direction, or slide the thumb),
      said over your dog. Every screen sees it and hears its whistle
      (`ping-here`, `ping-hold`, `ping-come`, `ping-away`, with `who`, the
      player's slot, so each dog whistles and barks at its own pitch; the
      Sound session makes them and chimes on its own when `game.net.players`
      changes); off screen, an arrow with the name
- [x] BRACE class at the Show Ground: a friend's dog at the post with
      yours makes the run a brace, ten sheep for two dogs, scored as one;
      either dog leaving the field retires it; prizes on trial days
- [x] Guests keep what they find: hidden places (with the usual reward,
      paid into their own ranch), keepsakes, the map their dog walks, a
      stamp for each ranch visited and brace ribbons; folded into their
      own save the next time they load or start a ranch; RANCHES VISITED
      in the Ledger
- [x] Seasons reach guests (season, progress, bloom, leaves, snow); two
      hooks for the rest of round three: `src/net/shared.ts` (JSON ranch
      state) and `animalExtra` / `applyAnimalExtra` in snapshot.ts (a byte
      per animal, e.g. a lamb)
- [x] Phones: quiet lines pinged every 3s, a line silent for 9s (or 3s
      after a change of network) dialled again; a screen going off tells
      the others (a guest's dog naps, a host's guests wait on a card);
      a dropped host's room waits 4 minutes, a guest's slot 5; guests keep
      trying for 2 minutes on screen
- [x] First-time hints for host and guest (what a friend's dog does, how
      to ping, whose pay it is, that finds are theirs); a guest's Show
      Ground tip
- [x] cooptest: pings both ways (API and keys), seasons and shared state,
      the brace and its ribbon, a place and a keepsake for the guest (and
      in their own save afterwards), screens off on both sides, a dead line
      after a network change, the drive with lag, jitter and 5% loss
## M24 Graphics round three: seasons, character, the title
- [x] Spring: blossom on the broadleaf trees (some in full flower), fresh
      flowers in the grass, petals drifting
- [x] Autumn: crowns turn buttercup, plum and sage (pines stay green),
      leaf litter, dry grass, leaves falling and blowing on the wind
- [x] Winter: snow on the ground with sage shade under the trees, trodden
      paths, ice along the banks, snow on treetops and pine tiers, roofs,
      chimneys, fences and decor, icicles, snowfall instead of rain, breath
      puffs, prints everywhere, grass buried, sage outlines on pale animals
- [x] The dog: sniffs, sits for a scratch, shakes off after the ford or rain
- [x] Animals: cattle flick their tails, ducks stretch a wing, goats lower
      their horns, ponies stamp
- [x] Townsfolk shaded and rim-lit
- [x] Title screen: the heeler sitting up on a knoll over the valley,
      following the season
- [x] Screenshot + console check per season, commit
## M25 Sound, round three (seasons, lambs, the fair, co-op, long sessions)
- [x] Seasons in the soundscape: a dawn chorus and a cuckoo in spring, lighter showers; insects all summer day and crickets from dusk; dry leaves rattling and rooks in autumn; the winter hush, a robin, a howling wind, snow underfoot, ice on the river and wolves far off
- [x] The music shades with the season: spring a little quicker and brighter (more whistle, more ornaments); autumn leans on the fiddle and minor openings; winter slower and darker, tunes on a music box, the harp thinned, no bodhran, more drone and reverb
- [x] Lambs: a lamb cut off from its ewe calls and she answers from where she is, both carrying further than other calls; the longer apart, the more urgent; a soft word from each when they are together again
- [x] The fair: the crowd's babble near it, the auctioneer's chant in bursts, the gavel and a smattering of applause for each sale
- [x] Co-op: a chime when a friend arrives or heads home; each player's bark and whistle at their own pitch; whistle pings for "over here", "hold", "come by" and "away to me"
- [x] Long sessions: stinger variants (never the same twice running), a little life in the handler's whistle, the main theme rarer, and a rest every five to nine minutes where the music stops and the valley carries on
- [x] audiotest: spring, summer, autumn, winter, lambs, fair, coop, hour (an hour scheduled), hourlevels (an hour rendered), live3
## M26 Platform: an installable app, phone performance, game pads, moving a save
- [x] Installable (PWA): `manifest.webmanifest` (Come By, plum theme,
      standalone with full screen preferred, any rotation), icons drawn by
      the game's own sprite code at build time (`src/pwa/icon.ts`: the heeler
      and a sheep on a patch of meadow; `scripts/pwa.mjs` runs it under Node
      with a tiny stand-in canvas and writes PNGs; no image files in the
      repo), apple-touch-icon and the iOS meta tags
- [x] Service worker (`sw.js`, generated per build): keeps every file of the
      build under a cache named for its contents; index.html network first,
      so a new deploy shows on the next launch; the page asks for a new
      worker on every launch; anything on another origin (the co-op relay)
      goes straight to the network
- [x] "Add to home screen" card on the title, phones only: INSTALL (Chrome's
      own dialog) or Safari's Share steps on an iPhone; X hides it for good
- [x] Phone performance, measured first (`scripts/perftest.mjs`, a real
      tier-5 ranch the pace bot built: `scripts/fixtures/tier5.json`), then
      the hot spots fixed (table below)
- [x] GRAPHICS in the pause menu: AUTO (steps down when frames run long and
      back up when there is time to spare), HIGH, MEDIUM, LOW. Lower levels
      thin only mood: rain, splashes, butterflies and fireflies, cloud
      shadows and the wet-ground dither, grass bending in gusts
- [x] Less work when idle: a quiet menu or build mode draws 30 frames a
      second, a 120Hz screen draws every other frame; a hidden tab already
      gets no frames and its sound suspends
- [x] Game pads (Gamepad API): play, every menu, build mode, the Ledger,
      the look screen and its name, the co-op screens and the join code;
      prompts switch to pad buttons while a pad is in use
      (`scripts/padtest.mjs`, a simulated pad)
- [x] Moving a save: MOVE A RANCH (title) / MOVE THIS RANCH (pause): copy a
      save code, save a file (the share sheet on phones), paste a code or
      load a file; checked before anything is touched, and replacing a ranch
      asks first with NO picked (`scripts/transfertest.mjs`)
- [x] Checks: `pwatest` (installable, offline, a new deploy), `installtest`,
      `padtest`, `transfertest`, `picturetest`; typecheck, build, shot and
      the existing loop tests including cooptest

Performance: work per frame (update and render, every frame's drawing
finished), best of 9 batches of 60 stepped frames, seeded, at 390x844@3
(234x507 internal) in headless Chromium, which draws canvas in software:

| scene | CPU | before | after (HIGH) | after (LOW) |
|---|---|---|---|---|
| title (attract mode) | 1x | 2.6 ms | 0.9 ms | |
| day: tier-5 ranch, clear summer | 1x | 4.0 ms | 1.7 ms | |
| worst: same ranch, winter storm night, predators, 2 helpers | 1x | 7.1 ms | 4.0 ms | |
| title | 4x | 11.6 ms | 4.1 ms | 2.7 ms |
| day | 4x | 17.7 ms | 7.5 ms | 6.1 ms |
| worst | 4x | 29.5 ms | 10.8 ms | 9.0 ms |
| title | 6x | 17.2 ms | 6.2 ms | 4.2 ms |
| day | 6x | 25.1 ms | 12.2 ms | 9.6 ms |
| worst | 6x | 43.8 ms | 16.7 ms | 13.7 ms |

At 60fps a frame has 16.7 ms. Live (the page's own loop, AUTO): 4x day
holds 60fps on HIGH; at 6x AUTO steps down to LOW and the worst case runs
52 fps (from 16 fps before).

Where the time went, and what changed:
- The copy up to the screen: every frame the 234x507 buffer was drawn at
  3x onto a 1170x2535 canvas, about 6 ms at 4x. Now the game draws straight
  into a canvas of its own size and CSS (`image-rendering: pixelated`)
  scales it by the same whole number on the GPU (`src/gfx/screen.ts`; the
  old copy stays for browsers without `pixelated`).
- The night overlay (27% of the worst case): every pixel was tested against
  every light. Each light's hole is now stamped over its own box only;
  the output is identical (`src/render/night.ts`, surgical).
- Buildings, fences and props drawn a pixel at a time, ~5,000 fillRect calls
  a frame on a built-up ranch: a recorder keeps each one's drawing as a
  bitmap and redraws it only when the art asks for something different
  (`src/gfx/picture.ts`, hooked in `src/render/world.ts`); ~4 ms at 6x,
  pixel for pixel the same (`scripts/picturetest.mjs`).
- Rain streaks: one rect per straight run instead of per pixel
  (`src/render/weather.ts`).
- Not hot after all: grass sway (~500 pixels a frame, under 1%), the herd's
  neighbour loops (~3%), music scheduling (not in the top 15). Left alone.

PWA checks (`scripts/pwatest.mjs`, against two real builds served by
`vite preview`): Chrome reports no installability errors; with the server
switched off after one visit the game starts from the kept build; a new
deploy's bundle is running after one relaunch, its files are kept and the
old build's cache is deleted, and it then plays offline too; requests to
another origin are never answered from the cache.

## M27 Day one always affords the kennel (from playtesting)
- [x] A new ranch starts with 10$ in the tin; the kennel costs 15$
- [x] Hints, the BUILD pulse and the rancher's remark read the kennel's
      real price instead of a hard-coded 20
- [x] `scripts/daytest.mjs`: calm, rough, late and frantic-at-dusk first
      drives all afford the kennel by the end of day one

## M28 UI and effects, round four (visible quality)
- [x] Font: the body face proportional (I and the stops are 1px) with
      automatic kerning; a bold 7px heading face for titles, banners, the
      logo and plaques; a two-tone coin that keeps a plum rim on paper
- [x] Frames: every panel bevelled (plum outline, light top and left,
      shade bottom and right), gilt when it wants attention, rivets on big
      ones; wool paper with ruled lines for the journal and the Ledger
- [x] HUD: a sun-and-moon dial clock (season icon on a clear day), a coin
      that glints in the purse, a bone-shaped stamina gauge by the dog (with
      a bead of sweat when spent), the flock's own likeness on its card,
      icons on BUILD, HELP and the goal; the place name on a teal plaque;
      bevelled thumb buttons with tiny pictures
- [x] Screens: the end of day as a journal page (taped, ruled, a CALM
      stamp); the Ledger as a cloth-bound book with a ribbon, ticked goals
      and an ink-on-paper map with uncharted hatching and a compass; panel
      titles in the heading face; build mode's corner brackets (a cross where
      it cannot go) and headings on the info card; transitions close as an
      iris on the dog
- [x] Effects: the bark ring as a dithered shockwave, sparks as streaks
      and an impact star on a nip, dust two-tone, mud on wet ground and
      snow in winter, ripples under splashes, notes and hearts over a
      content flock and stress lines over a nervous one, "THAT'LL DO" as a
      rubber stamp with a dust puff, fireworks on a tier-up, coins trailing
      a glint; thinned by `quality.fx`
- [x] Title: the logo in the heading face, its letters dropping in with a
      bounce, a glint running along it
- [x] Photo mode (pause menu, TAKE A PHOTO): no HUD, pan to frame the shot,
      a postcard frame with the ranch's name, the date, a stamp with your
      dog on it and a postmark; SNAP saves a crisp PNG (the share sheet on
      a phone, a download elsewhere)
- [x] Checks: typecheck, build, shot, uitour at every size, padtest,
      cooptest, perftest before and after
- [x] The Ledger's pages: cloth tabs on the cover (RANCH first), Q/E,
      [ ], LB/RB or a tap to turn; other features add pages to
      `LEDGER_PAGES` (src/ui/ledger.ts) and draw in the book's ink
- [x] `sharePng()` (src/ui/photo.ts): any canvas as a crisp PNG, the share
      sheet on a phone, a download elsewhere; photo mode uses it
- [x] Paddocks in build mode (src/ui/paddockbuild.ts): drag out a field
      (or SPACE / MARK OUT drops one at the cursor), then size it by its
      side handles, slide the gate round the fence, move it whole; live
      price, "HOLDS 12 SHEEP / 24 DUCKS" and the reason a spot is refused,
      the refused tiles in plum. Phones get W, H and GATE steppers and
      BUILD / CANCEL, so no drag has to be precise; keys and pads cycle the
      handle the arrows move (R / Y). A built paddock reopens (tap it, U /
      Y, EXTEND) with sides that only go outward, priced at the
      difference; troughs and the like snap inside it; its card shows the
      mix, a bar of spaces and its fixtures. Waits on the ranch's paddock
      rules (`setPaddockRules`); `src/ui/paddockdev.ts` is a stand-in for
      trying it (debug and tests only)
## M29 Paddocks you size yourself, and the valley grows (gameplay, round four)
- [x] Paddocks instead of fixed pens (`src/ranch/paddock.ts`, the rules for
      build mode): any size from 6x6 to 28 across, the gate on any side at
      any point along it. Room grows with the area (an 8x7 still holds
      16), the price with the fence (an 8x7 still costs 25$), so one big
      paddock costs about half as much a head as small ones. EXTEND drags
      a side out and pays only for the new fence; the gate moves for free.
      Build mode's drag handles are the UI session's
- [x] Mixed flocks that get along: ducks with anyone, sheep with goats,
      cattle with ponies; others are refused at the gate (and put back out
      if they slip in). Goods are kept by kind; a mixed paddock's sign
      counts room
- [x] Fixtures inside instead of whole-pen upgrades: the trough (now
      placed where you put it), a field shelter (safe at night, as in a
      barn's ring) and a hay rack (a third less hay). A barn's ring shelters
      a big paddock if it reaches its middle or its gate. Old upgraded pens
      keep their half again
- [x] Fields past the clearing: two plots off the ranch's south side to buy
      at their signs (200$, 300$). Bought, they take paddocks and fences at
      once; stock grazing on them, penned or loose, eats the scrub down,
      and then anything can be built there
- [x] Old saves: every pen becomes an 8x7 paddock with its gate, stock,
      goods, trough and upgrade as they were
- [x] A village at the crossroads (`src/ranch/village.ts`,
      `src/systems/valley.ts`) on a new green south-west of the junction:
      a well at first, then a cottage (fill an order), the market square
      (4 orders), a second cottage (graze a field clear), the smithy (pen 4
      cattle), the hall (a trial or fair ribbon) and a third cottage (40
      penned). One step a morning, the morning after the deed, in order; a
      banner says what came and the Ledger what is next
- [x] Market day, the third of each season once the square stands: the
      drover always has an order and pays half again; goods sell for a
      quarter more. Festivals, the last day of each season once the hall
      stands: the season's decorations on the green, and five of a kind
      driven through the arch make a parade
- [x] The old bridge at the ford: with a smith to forge the yoke, a cow
      driven through the woodpile picks up a log (and walks a little
      slower); six logs mend it, and cattle cross dry-shod, without balking
- [x] New ranch buildings (`src/systems/farmwork.ts`): the shearing shed
      (summer: sheep walked along its chute, funnelled in by its wings, are
      shorn for a wool bonus), the dairy (mornings: cows walked into its
      yard are milked, paid by how calm they came, and let back out) and
      the agility yard (a clean run under par counts once a day, three to
      a free level of speed or stamina)
- [x] First-pass art (`src/art/village.ts`, `valley.ts`, `farm2.ts`),
      village lights at night, legacy goals, saves, co-op shared state
      (paddocks, the valley), the Ledger's village lines
- [x] The village's people (`src/entities/villagers.ts`, on Characters'
      Person): each step brings its folk, walking in up the road the
      morning it is built: the first family; the baker and the grocer, in
      from up the road each day to their stalls; the smith at the anvil;
      two more families with a child each; the warden and the weaver. They
      draw water, garden, sit on the green's bench (it seats two), shop and
      stop for a word; on market day they crowd the stalls (the weaver
      minds the third), on festival day they line the green and cheer a
      parade; at dusk they go home and the warden walks the green with a
      lantern. The first family says what the village waits on next. They
      roll their own dice, so seeded runs play the same
- [x] The pace bot extends paddocks (and buys a field) before building
      new ones and hauls timber; it has routines for the shed, dairy and
      agility yard but in practice never gets to them, as it keeps its land
      for stock while short (they are checked in valleytest instead);
      `scripts/paddocktest.mjs`, `scripts/valleytest.mjs`

**Herding is unchanged** (`node scripts/tune.mjs <species>`, all five).
Paddocks alone change nothing (identical to the village-only build). The
village and field carves move the ground near tune's goal a little, which
nudges single runs both ways:

| species | calm walk s | reached (of 33) | mean stress | panics |
|---|---|---|---|---|
| duck | 15.9 → 16.1 | 26 → 26 | 0.06 → 0.06 | 21 → 14 |
| sheep | 12.2 → 11.2 | 27 → 27 | 0.10 → 0.09 | 21 → 15 |
| goat | 120 → 120 | 20 → 18 | 0.06 → 0.05 | 10 → 10 |
| cow | 120 → 120 | 1 → 2 | 0.02 → 0.02 | 9 → 7 |
| pony | 6.93 → 6.87 | 29 → 28 | 0.09 → 0.11 | 14 → 17 |

**Pace** (`node scripts/pacetest.mjs --seeds=1,2,3`), before (round three
plus the village) and after (paddocks). The valley thrives on days 8, 7, 7
before and 8, 7, 10 after. The first paddock build was much slower (10,
38, 11): the old upgrade's half again was gone and the bot packed the
ranch with small pens. Big paddocks now pack more a tile (up to the old
upgraded density at four times the old pen's area), and the bot keeps its
land for stock while short. Seed 3 still loses three days at tier 4:
"no room for a paddock", selling stock to make room for cattle.

| tier | days before | days after | enclosures at tier end, before | after | penned at tier end, before | after |
|---|---|---|---|---|---|---|
| 1 | 2.0 | 2.0 | 3.3 | 3.0 | 21 | 26 |
| 2 | 1.0 | 1.0 | 4.0 | 3.0 | 33 | 35 |
| 3 | 1.0 | 1.0 | 5.7 | 4.3 | 41 | 37 |
| 4 | 1.7 | 2.3 | 6.0 | 5.0 | 48 | 53 |

(Enclosures before: the starter pen plus every pen built, counted from the
day logs; 16 pens were also upgraded. Tier 5 is left out: the before run
played on to day 23.)

**A year** (`--year --days=22`): seasons before and after are alike in
earnings, hay and lambs. The valley, after:

| season | earned $ | spent $ | hay stacks | lambs | village built (of 6) | fields clear (of 2) | bridge logs (of 6) |
|---|---|---|---|---|---|---|---|
| y1 spring | 1097 | 938 | 0 | 0 | 1.0 | 0 | 0 |
| y1 summer | 3452 | 533 | 0 | 0 | 3.7 | 0 | 2.3 |
| y1 autumn | 3287 | 403 | 9.3 | 0 | 4.3 | 0.3 | 2.7 |
| y1 winter | 2915 | 27 | 0.3 | 0 | 4.3 | 0.3 | 3.0 |
| y2 spring | 3766 | 108 | 0 | 24.7 | 4.3 | 0.3 | 4.0 |
| y2 summer | 1706 | 0 | 0 | 0 | 4.3 | 0.3 | 4.0 |

The bot has a cottage, the square and the hall by day 8 (the smithy too
in two seeds of three; seed 1 has all six by day 12); a player who herds
for the deeds gets there sooner. Grazing a field clear and mending the bridge are slow for the bot,
which only does them in passing.
## M30 Characters (graphics round four)
Before: the dog snapped between four facings with a four-frame trot and
gallop; animals had two or three walk frames, the same rhythm for every
kind, and no fright beyond the head coming up; ducks stood in the pond
with their legs clipped off. After:
- [x] The dog, eight ways round: three-quarter views between side on and
      towards/away (face turned to you heading down, back and nape knot
      heading up). It turns through the in-betweens instead of snapping, a
      reversal at speed swinging round by the side that shows its face.
- [x] Six-frame trot and six-frame double-suspension gallop on every view,
      built from parts (torso, head, tail, legs, the bandana's loose ends):
      ears flop on the passing frames and pin back at a gallop, the tail
      swings, streams or wags on its own beat, the bandana's ends lift off
      the nape at a trot and stream at a gallop (none on a collar)
- [x] Skid: digging in from a run or turning tail at speed, forefeet out
- [x] Watching the stock: standing, it turns up to 90 degrees towards the
      nearest animal it could be working, ears pricked tall; trotting round
      a flock it turns a three-quarter view their way
- [x] Panting (mouth open, flanks heaving) when its wind is low, sooner in
      summer; friends' and helpers' dogs pant after a long gallop
- [x] Proud stance at "THAT'LL DO": head up, chest out, tail wagging high
- [x] Soaked after the ford or a long shower: flecks go dark, drips fall
      from its belly until it shakes off; wading, the legs go under water
- [x] The same for helpers and co-op friends' dogs (and their idles), all
      from state that was already synced; the customization layers apply
      to every new frame through template letters (dogstyle.ts)
- [x] Animals: a sheep's bouncy trot, a goat's stiff-legged pronk, a duck's
      waddle (rolling foot to foot seen end on) and wing-beating run,
      cattle nodding along and landing heavy, ponies' manes flying at a
      gallop and lifting with the tail when a gust comes through
- [x] A clear startle (a jump on the spot: sheep and lambs splay, goats
      bounce, cattle buck, ponies rear, ducks throw up their wings) at the
      first fright or a bark, then the flight; wide eyes whenever stressed
      hard (wool on dark faces, a dark ring on pale ones)
- [x] Grazing: three nibbling frames and spells of chewing with the head up
      (a duck preens); cattle chew the cud
- [x] Ducks afloat: sitting low and bobbing, water lapping at their sides,
      a wake opening behind them as they paddle
- [x] Lambs skip as they go; a ewe with her lamb close turns and noses it
- [x] Townsfolk: an eight-frame side stride with arms swinging (near and
      far legs shaded apart), arm swing towards and away; a gesture loop
      while talking (hand up, palm out, a point, a nod), blinks and hands on
      hips standing about; hammer and axe in four frames (wind-up, the
      strike on the blow's sound, the bounce); bales and sacks held in both
      arms; crouching to a basket, kneeling side on; sitting with a foot
      swung; waving in every facing; the lantern and crook in the hand
- [x] Clothes with the season: shirt sleeves and the rancher's straw hat in
      summer, scarves in autumn, scarves, mittens, longer coats and bobble
      hats in winter; the cast told apart (a tall drover, the auctioneer's
      boater and waistcoat, the judge's bowler and white beard, the
      shepherd's hood, the miller stout and bearded, the carpenter's apron)
- [x] `villager(spec)` in people.ts makes a new villager (coat, legs, hat,
      build, apron, beard, skirt, scarf...); the village's people (smith,
      baker, grocer, weaver, six cottagers, the warden) are in folk.ts'
      CAST, appended to FOLK_IDS so guests see them; every lantern lights
- [x] Coyotes and wolves: a six-frame stalking creep (shoulders high, head
      low, tail down), the rush into a flat gallop, carrying off head high,
      fleeing with the tail clamped, digging rump up, and a howl (head
      thrown back) as each dig begins; down and up facings too
- [x] Eye glints at night: a pair of buttercup glints set in dark sockets
      that ride with the head, blink on each animal's own rhythm and flash
      when it looks your way
- [x] Animals with a load (`a.load`) lean into it, head down at every step
- [x] Sprite sheet rows for the new dog views and animal poses (`?sprites`)
- [x] Checks: typecheck, build, shot, regions; `tune.mjs <species>
      --seed=7` identical to before for all five; every sprite scanned:
      all in the palette, red only on the player's dog; cooptest 48/48
      (with --shots); folktest, lambtest, nighttest; perftest at 6x
      throttle run alternately against the base on a busy machine, best of
      three: day 14.0 ms before / 15.0 ms after, worst (winter storm night,
      predators, helpers) 19.7 / 18.5 ms, medians overlapping: no
      measurable cost
## M31 World and light, round four
Before → after, in plain words:
- [x] Shadows: trees' shadows were baked in one place all day; now they
      move with the sun, long to the west at sunrise, short at noon, long to
      the east by evening, and buildings' shadows swing with them. Animals'
      shadows shift the same way. No shadows at night.
- [x] Golden hour: the late afternoon light warms the sunlit grass with a
      light buttercup speckle (the shade stays cool); low sun slants in
      shafts through the treetops in the golden hour.
- [x] Blue hour: dusk and dawn come in teal before the plum of night.
- [x] Night: lantern and camp-fire pools end in a dithered buttercup ring;
      the farmhouse windows glow out into the dark.
- [x] Morning mist drifts on fair mornings and burns off by mid-morning.
- [x] Depth: trunks and flaring roots show under the crowns and along the
      forest's lower edge; the big outcrops stand as taller cliffs with a
      pale band of strata; the far bank of the river shows its earth face;
      contact shadows hug building feet.
- [x] Each region more its own: willows trailing strands by the water,
      flowering gorse among the rocks, sheep tracks over the hills.
- [x] Water: trees reflected below the far bank; fish jump now and then;
      wet paths glint after rain.
- [x] Wildlife: rabbits at the forest edge morning and evening, deer at
      dawn and dusk, crows on the fences, frogs on the banks; all flee the
      dog (hops, bounds into the trees, lifting off, a leap into the water).
- [x] Checks: typecheck, build, shot, regions in every season, weather and
      time of day, perftest, picturetest, tune --seed=7 (sheep, and cattle
      in a winter storm: identical to `test/round-4`). perftest, run back to
      back with an untouched `test/round-4` (best batch, phone size):
      title 5.6 vs 6.3 ms, day 9.8 vs 10.6, worst 13.1 vs 13.3 at 4x;
      title 9.0 vs 9.8, day 15.4 vs 16.2, worst 19.0 vs 20.0 at 6x, i.e. the
      same within the machine's noise.

- [x] Paddocks of any size (for Gameplay's paddocks, `src/art/paddock.ts`):
      pens were drawn for one 8x7 shape with the gate in the middle of a
      side. The paddock is now drawn as any rectangle:
      - The gate can be anywhere along any side, and a wide gate gets two
        leaves meeting in the middle.
      - Posts are spaced evenly along each side at about 8px (10px on a big
        field), with stouter corner and gate posts. The rails are worn: a
        knot, a grey weathered streak, the odd sag.
      - A small pen is trodden all over and strewn with straw. A big one
        reads as a field: grass inside, a trodden lane just inside the fence,
        a worn track from the gate to the trough, longer grass in the
        corners, flowers in spring and summer.
      - The ground is trodden outside the gate too.
      - Fixtures: a trough, a hay rack, and a small field shelter in the
        ranch's roofing with straw bedding.
      - An inner hurdle with its own gate.
      - In snow the lanes and tracks show as trodden paths, and every fence's
        rails (old fences too) turn dark and wet instead of vanishing
        against the white.
      - Checks: typecheck, build, shot, picturetest (ok), regions (ranch,
        show, sale, drover), tune --seed=7 for sheep (identical to before).
        perftest run back to back with the commit before, best batch at 4x:
        day 9.5 vs 10.3–10.9 ms, worst 12.1–13.1 vs 14.0–14.4. At 6x: day
        14.3–15.0 vs 16.3–17.1, worst 20.4 vs 19.7–21.4. Cheaper, because a
        pen's floor is one image now and no longer redrawn pixel by pixel
        into the picture cache every frame.
## M32 Valley projects (world, round four)
- [x] Herding work out in the valley that changes a place for good and opens
      something new, alongside Gameplay's village, paddocks and old bridge:
      - CLEAR THE REED BED (Willow Pool, tier 2, spring or summer): ducks
        paddle the reeds down; a hay meadow: 8 more bales in the loft each autumn
      - GRAZE THE ORCHARD CLEAR (the Old Orchard, tier 2, not winter): any
        flock; good pasture, a sheep flock there every morning but in winter
      - BROWSE BACK THE SCRUB (the Hidden Valley, tier 3, not winter): any
        flock, goats quickest; its wild goats come back every day, seven of them
      - MEND THE SHEPHERD'S HUT (tier 3): goats carry five slates from the
        quarry under the outcrop on Rocky Rise; a waystation (lie down by the
        hut to rest as at home) and the fold with a gate E shuts on a flock
      - PUDDLE THE MILL POND (the Waterfall Pool, tier 4, not winter): cattle
        held standing in the pool; a waterwheel, goods sell for a quarter more
      - RAISE THE STONE CIRCLE (tier 5): ponies drag the four fallen stones
        back from the Rolling Hills; midsummer on summer's second day, when
        flocks walked through the ring pay double
- [x] Grazing at the paddocks' per-species rates; hauling picks a load up at
      a pile, and an animal that panics drops it back there
- [x] Before and after drawn in code (`src/art/projects.ts`): reeds, brambles,
      scrub, the hayrick and lilies, wildflowers, the mended hut with a slate
      roof and smoke, the fold gate, the slate pile, fallen stones, the mill
      pool's mud and broken wheel pit, the turning waterwheel; signboards with
      progress; slate panniers and stone travois on the animals; bunting and
      folk the day one is done; the midsummer bonfire and gathering
- [x] The Ledger lists the valley (projects done, those under way with what
      they need and bring, the next one) and flags each workable site on the
      map; first-sight tips, progress in the place name while you work there,
      a morning tip when one comes within reach, a banner, confetti and the
      tier-up stinger when one is done
- [x] Saved (old saves start with nothing); co-op: shared state, loads and
      blessings ride in animalExtra bits 2 and 3, guests' dogs herd for them
      and work the fold's gate
- [x] `scripts/projecttest.mjs`; `places.mjs --half/--done`; tune.mjs before
      and after; discoverytest, savetest and the loop tests
## M33 Buyers' favour and achievements (round four)
- [x] Buyers' favour (`src/systems/favour.ts`, `src/art/favour.ts`): the
      miller, the drover, the sale yard (4 levels each) and the summer
      shearer (3). Filled orders +3, all calm +2, two hours early +1, a
      special order +1; a missed order -2 (short -1), never losing a level
- [x] Each level brings something: pay 10/15/20/30% over (shown as its own
      "+N$ @" float); special orders from level 2 (the miller's RUSH at
      double pay, the sale yard's SHOW STOCK for calm stock only at double,
      the drover's BIG DROVE at 1.5x); gifts at 3 (millstone, show bell and
      fleece bale decor, free in build mode; the drover walks a rare breed
      to his gate); at the top, FRIEND OF THE VALLEY (your ranch's name on
      their yard, the miller's meal for the loft each winter, the drover's
      old dog trains yours, the valley rosette; the shearer comes twice)
- [x] The yards dress up: bunting, a striped stall over the cart, flower
      tubs at the gate, the name board on the front fence, the special
      order's word by the cart's pennant
- [x] A buyer's card when they take to you (their line, the new perk,
      hearts filling), and their line said aloud at the yard
- [x] Achievements (`src/systems/achievements.ts`): 37 across herding,
      trials, the ranch, the valley, the seasons and co-op, three secret
      with hints; most read from the lifetime record, some caught as they
      happen (a day without a bark, ten home at once all calm, a coyote
      made to drop its prey, the cattle class won without a nip, calm in a
      storm, resting to dusk, a friend on your ranch)
- [x] Badges drawn in code (`src/art/badges.ts`): a frame per kind worked
      out per pixel (medal, rosette, shield, octagon, wreath, tag) and a
      pixel icon; locked ones in outline, secret ones a question mark
- [x] The unlock card slides in with a stamp, confetti (scaled by
      GRAPHICS), the `thatlldo` / `tierup` stingers and a buzz; one at a
      time, waiting behind the tier card and the judge's card; tap it for
      the Ledger at that badge
- [x] The Ledger gets pages (`src/ui/achievements.ts`): RANCH LEDGER,
      BUYERS (a favour bar each and what the next level brings) and BADGES
      (the grid, progress on locked ones, hints for secret ones, a badge
      opened large with SHARE). Q/E (LB/RB) turn the pages, tabs on touch
- [x] SHARE makes a postcard of the badge (the dog on the stamp, the
      ranch and the day) as a crisp PNG: the share sheet on a phone, a
      download elsewhere
- [x] The board by the farmhouse door (`src/art/trophies.ts`): rosettes,
      class cups and the Valley Cup, a pin for every badge; a second board
      once the first is full
- [x] Saved additively; an older save is credited with what its totals
      show (quietly, with one card saying how many). A co-op guest earns
      only the co-op badges while visiting, kept with their travels and
      folded into their own save at home; the host's favour and badge pins
      reach guests through `src/net/shared.ts`
- [x] `scripts/favourtest.mjs` (31 checks) and `scripts/achievetest.mjs`
      (34 checks); padtest and cooptest gained checks for the Ledger pages,
      guest badges and shared favour; savetest, ordertest, daytest pass;
      `tune.mjs --seed=7` is identical to main for all five species

## M34 More animals: herds that grow (gameplay, round five)
- [x] Every kind breeds in its season (`BREED` in `src/systems/seasonal.ts`):
      ducks, sheep, goats and cattle on spring's first two mornings, ponies
      in summer's, from tier 2. Only calm (at the day's end and in the
      morning), fed stock with another of its kind in the paddock, and only
      as many as the paddock has room for once they are grown: a full
      paddock breeds nothing (a tip says so, once). Ducks hatch 2-3, goats
      often twins, cattle and ponies one. Floats over each paddock say what
      came; the young grow up in autumn and the herd is that much bigger
- [x] Ducklings, kids, calves and foals at their mothers' sides, as lambs
      are (the same bond: a mother turns back for her young, both fret
      apart), with their own calls (the audio's young-and-mother calls now
      key on the young, in each kind's voice, pitched up). Characters draws
      them at 2x (`youngSprites`, characters-r5); on this branch alone they
      draw as lambs
- [x] Wild flocks grow as the valley does: a sixth bigger for each tier a
      region has been open (up to two-thirds again), a fourth flock after
      three tiers, and wild young at foot in each kind's season (from tier
      2: day one's ducks come alone)
- [x] Big droves (`src/systems/herds.ts`): from tier 3, now and then (not
      in winter, not on fair day, never two mornings running) one flock
      two and a half times the size comes into an older region, with a
      banner saying where
- [x] Buying stock: the sale yard has a lot each morning from tier 2 (one
      kind in turn, a few head at four times what one pays delivered):
      stand by one and NIP at the fence, then walk it home. The fair sets
      out pairs of the smaller rare breeds (a pair breeds rare young)
- [x] Goods that can be seen are UI's (piles per kind along the back fence,
      a "+1" particle, the sale's cart, ui-r5); for them each paddock's
      `goodsBy` now reaches co-op guests (shared.ts 'goodsBy'), so a mixed
      paddock's piles show on a guest's screen too
- [x] Paddock density: big paddocks now pack up to three-quarters again a
      tile at four times the old pen's area (was half again); an 8x7 still
      holds 16. A 16x12 holds 44 sheep and looks like a herd with room to
      move. More land in use was what slowed the bot most
- [x] `scripts/breedtest.mjs` (27 checks, 28 once the young's sprites are
      merged); seasontest updated (room for
      lambs, the new flock sizes, the fair's pairs); the pace bot buys the
      lot when it has coin and room, and pacetest's year table counts the
      young, stock bought and the herd

**Herding is unchanged**: `node scripts/tune.mjs <species> --seed=1` gives
identical results before and after for all five species. (Wild young start
at tier 2 partly so day one's ducks, and the tune, stay exactly as they
were.)

**Pace** (`node scripts/pacetest.mjs`, six seeds; before is test/round-5):
the valley thrives on days 8, 7, 12, 17, 6, 6 before (mean 9.3) and 7, 11,
11, 7, 11, 8 after (mean 9.2): the same on average, and the worst seed
went from 17 days to 11. Tier 4 takes longer (cattle in bigger groups, a
big drove to bring in, more to house) and tier 5 is quicker (more stock
about for the 50 penned):

| tier | days before | days after | penned at tier end, before | after | enclosures, before | after | earned per day $, before | after |
|---|---|---|---|---|---|---|---|---|
| 1 | 2.0 | 2.0 | 27 | 27 | 3.3 | 3.5 | 126 | 125 |
| 2 | 1.0 | 1.0 | 36 | 35 | 3.5 | 3.5 | 403 | 394 |
| 3 | 1.0 | 1.0 | 43 | 42 | 4.9 | 4.7 | 551 | 466 |
| 4 | 2.0 | 3.3 | 52 | 60 | 5.5 | 5.5 | 631 | 648 |
| 5 | 3.4 | 1.8 | 61 | 64 | 5.7 | 5.8 | 981 | 1278 |

The first pass was slower (mean 10.8, one seed 17 days): the bot spent
whole drives on droves it had no room for and ran out of land at tier 5.
Big paddocks now pack more a tile, and the bot leaves a drove far bigger
than its room for another day.

**A year** (`--year --days=22`, three seeds), after:

| season | earned $ | spent $ | young born | stock bought | penned at end | wild stock about |
|---|---|---|---|---|---|---|
| y1 spring | 1138 | 984 | 0 | 1.3 | 41 | 35 |
| y1 summer | 3115 | 432 | 0 | 2.7 | 60 | 135 |
| y1 autumn | 4359 | 547 | 0 | 0 | 61 | 190 |
| y1 winter | 3665 | 80 | 0 | 0 | 66 | 158 |
| y2 spring | 4860 | 6 | 3.0 | 0 | 75 | 232 |
| y2 summer | 2605 | 0 | 0 | 0 | 79 | 265 |

Before, the same seeds saw 103 to 150 wild stock about by year two (now
135 to 265) and 22 lambs in year two's spring. Those lambs came with no
rule about room; now the bot keeps every paddock full, so its herds rarely
breed (3 young). A player who leaves room in a paddock sees it grow; a full
paddock gets the tip. The bot ends the year with 79 penned (89 before):
land, not stock, is what limits it.

**Phone frame work** (`node scripts/perftest.mjs --only=day,worst`, the
tier-5 fixture with today's bigger wild flocks): day 11.2 to 13.0ms and
worst 14.9 to 15.7ms at 4x CPU throttle; 17.8 to 20.8 and 22.4 to 24.6ms
at 6x. The cost is the simulation of the extra wild animals; I left it
alone rather than risk changing how they herd.
## M34 Characters at double density (round five)
Before: every living thing was drawn at world scale, a pixel to a world
pixel, so faces were a dot or two, flecks were single scattered pixels
(noise at a glance), and legs were one pixel thick. After, on the
double-density pipeline (PX = 2, `spr(..., { density: 2 })` through
`spr2` in src/art/hd.ts), at the same size in the world:
- [x] The dog, hand-drawn in fine pixels in all five views and every pose
      from round four (trot, gallop, skid, bark, pant, proud, watching,
      lying, settling, the idles): pointed ears, the mask round each eye
      with a glint, the pale muzzle and nose, an open mouth for the bark
      and the pant, the bandana with its fold and its point at the chest,
      flecks in small clusters, a saddle over the shoulders, jointed legs
      two fine pixels wide with paws, far legs drawn behind the near ones
- [x] Customization in letters (dressFine): mask both/one/none, flecks
      light/classic/heavy, saddle, tail tip, bandana/neckerchief/collar
      reach every fine frame; the soaked twin darkens the flecks
- [x] Sniffing and digging for the treasure hunt: `dog.sniff` (0..1) and
      `dog.dig` (seconds left) drawn as a nose-down trot and stand, and a
      dig (forepaws scraping in turn, rump up, a look into the hole) that
      ends in a shake-off
- [x] The sleeping curl in fine pixels with the player's own markings;
      the z's, drips, wading line, ripples and wakes in fine pixels;
      shadows as smooth fine ellipses that swing with the sun
- [x] The herd hand-drawn at 2x: sheep in a curled fleece with dark faces
      and topknots, ducks with a wing line and nostrilled bill, goats with
      curved horns and a beard, cattle with a blaze, muzzle and tufted
      tail (piebald and Highland coats drawn, not swapped), ponies with a
      stranded mane, forelock and hocks; every coat, the scared twin with
      the white of the eye showing, startles, gaits and chewing kept
- [x] New young for every species (Gameplay's breeding): a duckling that
      swims, a goat kid with horn buds, a stocky calf and a leggy foal,
      `youngSprites(id, coat, scared)` next to the lamb
- [x] Townsfolk at 2x: faces with eyes, nose and mouth, hats with crowns,
      bands and brims, collars, buttons, belts, aprons with ties, skirts
      with a fold, scarves with tails, boots with a shine, tools and loads
      in the hand; every pose and season kept; folk placed to the fine
      pixel so they walk smoothly
- [x] Coyotes and wolves at 2x: tall ears with an inner ear, long muzzles,
      teeth in the rush, the wolf's ruff and saddle tufts, a brush tail,
      legs jointed at hock and wrist through every step; eye glints in
      fine pixels on the eyes in every pose
- [x] Checks: typecheck, build, shot, regions; `tune.mjs <species>
      --seed=7` identical for all five; every sprite scanned (about
      3,500): all in the palette, red only on the player's dog, nothing
      half transparent; cooptest 51/52 (the brace's guest flock count
      fails on platform-r5 alone too); perftest against platform-r5 (see
      Decisions)
## M35 UI round five: goods you can see, what to do, readable text
- [x] Goods you can see: the good's icon and "+1" over the animal that made
      it (friends see it too); goods wait in the paddock as things, a pile
      of each kind along the back fence (a nest box of eggs, wool bales,
      cheese wheels on a board, milk churns; `src/art/goods.ts`); today's
      goods and what they fetch by the purse ("6 3 2 = 24$ AT DUSK")
- [x] The day's sale as a moment: before the journal, the buyer's pony cart
      rolls in, each paddock's goods arc into it, coins fly to the purse as
      it counts up, the cart rolls on (`src/ui/sale.ts`; a tap skips it)
- [x] One objective, always (`src/ui/objective.ts`): the goal card says the
      one thing to do now (the night, a trial, the flock you are driving, the
      first day, a buyer's order, the tier's goal), an arrow by the dog
      slides towards it with its name, a marker bobs over it in view, BUILD
      pulses when building is the answer
- [x] What's this (`src/ui/whatsthis.ts`): the first time something new is
      near (a paddock, each kind of building, a buyer's yard, the trial
      crook, a locked gate, the first goods) a card points at it with what
      it is for; once each, remembered in the save's tips; others can add
      things to `THINGS`
- [x] The first day: a welcome card as a new ranch opens (who you are, what
      to do, how to move), and the first day's hints are gilt with their
      step ("FIRST DAY 2/7")
- [x] Build mode for co-op guests: every change is a `BuildAction` done by
      `applyBuild`; a guest sets `build.remote` to ask the host and hears
      back through `build.answer`
- [x] Readable text on Platform's 2x font (merged platform-r5): prose in
      sentence case where it is drawn (`src/ui/case.ts`: `sentence()`,
      `prose()`, `sentenceLines()`; names, keys and pad buttons keep their
      capitals), headings, buttons and signs still capitals; the journal's
      header reflowed (the CALM stamp no longer covers the figures); the
      build and decor bars go to two rows when cells would be too narrow
      to tap; dense sprites sized in world pixels (sprW/sprH); the goods
      icons in fine pixels with a plum outline
- [x] Pad prompts match whatever the case and answer in the case they find
## M34 Double density: fine pixels and a readable font (platform, round five)
- [x] Two grids: world pixels (the sim, the map, layout, the old art) and
      fine pixels, PX = 2 to a world pixel. The screen canvas is fine pixels
      (about 432 on the short side, a whole number of device pixels each);
      every frame is drawn under scale(PX), so the old art is exact 2x2
      blocks (`scripts/densitytest.mjs`: the world layer is pixel-for-pixel
      round four at 2x)
- [x] Fine drawing: `fine(g, fn)`, `toFine`/`snapFine`, dense sprites
      (`spr(..., { density: 2 })`, placed on the fine grid), `sprW/sprH/
      drawSprAt`, fine offscreen canvases (`makeCanvas(w, h, PX)`); the
      picture cache keeps fine pixels and follows fine() inside cached art
- [x] A new font in fine pixels with lower case, proportional and kerned:
      body (capitals 9, a line every 6 world px, a drop-in for the old
      face), small (capitals 7), heading (Scale2x of the body: capitals 18);
      the pad prompts hook kept and now case-insensitive
- [x] Night, fog, flash and lamp rings, and the ground's cloud, wet and
      golden-hour dither, laid in fine pixels (world pixels at MEDIUM and
      LOW); ditherRect and the dim/fade covers as fine dither patterns
- [x] `FineLayer` (src/gfx/chunks.ts): world-sized pictures in fine pixels,
      painted in chunks around the camera with a world-pixel fallback, for
      2x terrain; terrain and canopy stay world pixels until then
- [x] Checks: densitytest, picturetest (FineLayer too), padtest (sentence
      case prompts), perftest before and after, the other scripts

Performance (perftest at 390x844@3, stepped seeded frames with every
pixel drawn, best of two interleaved runs of 7 batches; other sessions
were loading the machine, so treat differences under ~2 ms as noise).
Round four: 234 x 507 world pixels drawn 1:1. Now: 195 x 422 world, 390 x
844 fine pixels, 2.8x as many pixels filled, in software here:

| scene | CPU | round four (HIGH) | now, HIGH | now, LOW |
|---|---|---|---|---|
| title | 4x | 5.9 ms | 9.3 ms | 6.9 ms |
| day: tier-5 ranch | 4x | 13.1 ms | 15.3 ms | 11.2 ms |
| worst: winter storm night | 4x | 16.6 ms | 16.4 ms | 14.5 ms |
| title | 6x | 11.4 ms | 8.1 ms | 11.5 ms |
| day | 6x | 19.0 ms | 20.7 ms | 17.8 ms |
| worst | 6x | 25.5 ms | 26.9 ms | 22.5 ms |

## M35 Co-op, round five: both players do everything
- [x] Build mode for guests: the host's build screen (paddocks dragged,
      extended and gated, fixtures, buildings, decor, the ranch's paint,
      kennel training, helpers, selling), each change sent to the host and
      played there through build mode's own methods; what it says comes
      back; the ranch comes back at once. One builder at a time ("ZIGGY IS
      BUILDING" on the other screen and on their name tag)
- [x] E for guests does all E does: start a trial at the post (their run:
      the judge's eye is on their dog), pen gates and letting stock out,
      buying at the sale yard or the fair, the agility course, buying fields
- [x] Helper commands (H) and closing the judge's card from either screen
- [x] The day's end: the same summary card on both screens (READY on the
      guest's), who is ready shown over it; either may build from it; the
      next day starts when everyone is ready, or on the host's second press
- [x] Busy screens: the host's build mode and the judge's card no longer
      stop the world while friends are there; a guest in build mode or a
      menu still sees the ranch go on
- [x] The same goals, hints, coach tips and arrows for the guest; the
      tutorial step comes from the host; no more "it's the host's" lines
- [x] cooptest: the guest builds a paddock, extends it and puts a trough in
      it; the lock both ways; the host's build mode does not stop the
      guest; the guest lets stock out for an order, starts and closes a
      trial; both say ready for the next day

## M34 Sniff and dig: loot (world, round five)
- [x] Scent (`src/systems/loot.ts`, drawn in `src/art/loot.ts`): walking
      slowly or standing still near something buried, curls of scent drift
      from it to the dog's nose (faint on the move, bright when it stands to
      sniff; further in rain; none at night or lying down); close up the
      ground is turned and glints, and the dog puts its nose down
- [x] NIP digs on a scent (E: DIG over the dog; the phone's NIP button
      reads DIG with a paw), never with an animal at the nose or a fox at
      its heels, never lying down; a bot's nip stays a nip. The dog digs
      nearly a second, earth flying, and leaves a hole until morning; the
      find hops out with a sparkle and a FOUND IT! banner (rare: a stinger;
      the hoard: the tier-up stinger and confetti)
- [x] Dig spots, new each morning, the same on every screen (seeded by the
      day): two or three in the meadows round the ranch, three out in the
      pastures, two in hidden places (which places by season); one more of
      each after rain, one fewer in winter; regions open by tier
- [x] 29 things to find in four rarities: coins (1-3$), old coins (6-10$), a
      purse (20-30$); bones to bury on the ranch and dig up aged another day
      (full wind); curios (button, horseshoe, marble, pipe, thimble,
      arrowhead, fossil); seeds (sunflowers, herbs, roses, a pippin) and the
      fossil open free decor; things to wear (brass, bone-shaped and golden
      collar tags, a spotted kerchief, white socks, a blaze) join the dog's
      look; relics: the shepherd's whistle (bark +10% reach) and the
      bellwether's bell (the flock near the dog settles quicker)
- [x] The old shepherd's map, four pages, each where the last says: a lost
      ewe in the Old Orchard, a way to a hidden place, a lost billy goat in
      the Hidden Valley, and X marks the spot by the cairn on Lookout Knoll:
      the hoard (100$ and the golden tag). Lost animals wait each morning
      until penned (a bonus, by calm); the next page is an X on the Ledger map
- [x] The Ledger's FINDS page (`src/ui/loot.ts`): every find in a grid, "?"
      for what is still in the ground, framed by rarity, the one picked
      written up (or where to look), bones, the map and how to dig
- [x] Saved (old saves start with nothing); co-op: the day's holes are
      shared, a guest's finds go to their travels and home with them, and
      every dog's sniff and dig travel as two flag bits so friends see the
      poses (dust at the paws, earth flying)
- [x] `scripts/loottest.mjs`; seeded tune.mjs identical for all five
      species; discoverytest, projecttest, savetest, seasontest, cooptest
## M36 Balance pass: everything together (gameplay, round six)
Many sources of coin and stock landed in parallel in rounds four and five
(buyer favour, loot, breeding, valley projects, market days, fields, the
shed, dairy and agility yard). Played together by the pace bot, two things
stood out: goods made by stock sitting at home came to two-thirds to
three-quarters of all income from tier 3 on (a penned animal earned its
own delivery price again every day), so herding mattered less and less;
and the purse outran everything worth buying by about day 8 (1,760$ of
one-off buildings, training and land against 1,556$ in hand at the end of
tier 4, 4,394$ at the end of tier 5, 25,000$ by year three). The tier-5
goals then stalled on land, not coin.
- [x] A packed paddock makes less (`crowding` in `src/systems/economy.ts`):
      full rate up to three-fifths of its room, half when full. A roomy
      paddock makes as much as a crowded one, and has room for young, so
      there is no reason to pack one; a tip says so the first time
- [x] A calm drove pays a bonus at the gate (game.ts): six head or more
      brought in calm, a twentieth more a head past five, up to half again
      at fifteen (the banner shows it). Bigger flocks and droves are worth
      herding well
- [x] Late prices rise so tiers 4 and 5 still end with a choice: the
      windmill (a tier-5 goal) 260$ to 500$, the dairy 110$ to 180$, the
      fields 200$/300$ to 250$/450$, the top level of each training
      100-120$ to 140-160$. Day one is untouched (the kennel is still 15$;
      daytest passes)
- [x] The valley holds at most 260 wild animals (`WILD_CAP` in
      `src/systems/spawner.ts`): no new flocks or droves past it. Breeding
      at home needed no cap: young are born only into room they can grow
      into, so a paddock never overruns, and a packed one breeds nothing
- [x] The pace bot buys a field when land is short (it had walked into its
      own fences to reach the sign, or never tried) and leaves a drove far
      bigger than its room; pacetest now tags every coin by the system that
      paid it, and logs what is still worth buying and how many animals
      the world holds; perftest `--animals=N` measures a herd-heavy year
- [x] breedtest gained the drove bonus, the wild cap and crowding (31 checks)

**Herding is unchanged**: `node scripts/tune.mjs <species> --seed=1` is
identical before and after for all five species.

**Pace** (six seeds; before is test/round-5 with the same pace bot): the
valley thrives on days 8, 10, 9, 10, 6, 7 before (mean 8.3) and 8, 10, 8,
8, 9, 6 after (mean 8.2). With the old bot the same build took 8, 10, 16,
15, 8, 7 (mean 10.7): the stalls were the bot's, at tier 5, short of land.

| tier | days, before | after | earned a day $, before | after | goods' share, before | after | herding's share (stock, orders, favour, trials), before | after | purse at tier end $, before | after | worth buying left at tier end $ (and how much of it affordable), before | after |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2.0 | 2.0 | 133 | 125 | 42% | 33% | 58% | 67% | 89 | 75 | 1261 (10 of 16) | 1621 (9 of 16) |
| 2 | 1.0 | 1.0 | 406 | 342 | 51% | 42% | 45% | 54% | 85 | 75 | 853 (3 of 6) | 1288 (2 of 7) |
| 3 | 1.0 | 1.0 | 470 | 421 | 63% | 47% | 34% | 45% | 180 | 60 | 702 (3 of 5) | 1145 (1 of 6) |
| 4 | 2.2 | 1.5 | 575 | 472 | 73% | 46% | 26% | 46% | 697 | 304 | 365 (3 of 4) | 1220 (3 of 5) |
| 5 | 2.2 | 2.7 | 1036 | 729 | 64% | 42% | 26% | 43% | 2570 | 1260 | 265 (3 of 3) | 402 (3 of 3) |

(The rest of the income is legacy prizes, places found and stock sold to
make room. The bot never digs, does no valley projects and passes up the
shed, dairy and agility yard while land is short, so a player who does
them earns a little more; those pay for herding work too, but for the
loot.)

**Two years** (`--year --days=34`, three seeds):

| season | purse at end $, before | after | goods' share, before | after | animals in the world, before | after | young | penned, before | after |
|---|---|---|---|---|---|---|---|---|---|
| y1 spring | 190 | 57 | 53% | 41% | 144 | 160 | 19 | 39 | 37 |
| y1 summer | 2181 | 1126 | 72% | 44% | 257 | 252 | 0 | 65 | 59 |
| y1 autumn | 5503 | 2957 | 74% | 57% | 255 | 224 | 0 | 74 | 79 |
| y1 winter | 9056 | 4949 | 78% | 70% | 311 | 266 | 15 | 80 | 80 |
| y2 spring | 13823 | 8065 | 81% | 62% | 358 | 336 | 32 | 88 | 87 |
| y2 summer | 19062 | 10807 | 76% | 77% | 395 | 355 | 0 | 88 | 99 |
| y2 winter | 27153 | 15603 | 91% | 71% | 372 | 328 | 11 | 98 | 105 |
| y3 spring | 29875 | 17232 | 82% | 69% | 392 | 339 | 16 | 101 | 110 |

After the valley thrives, coin still piles up (700-850$ a day) with little
left to buy, and goods are most of it again (the bot's herds are home and
it has no room for more). That is a design question beyond a balance pass:
late-game things to buy (more land, a second holding, things for the
village) would give it somewhere to go.

**Frame work** (perftest at 4x CPU throttle, the tier-5 fixture, best
batches of repeated runs; the two builds measure the same at the same
count): about 13ms a day frame and 17-18.6ms in the worst scene (a storm
night with predators) at 340 animals. The cap keeps year two's world at
about 340 animals instead of about 390. The worst scene is over 16.7ms even
at the fixture's 170 animals, on the base as on this branch.

Known, not from this branch (they fail on test/round-5 too): achievetest
"a tapped card opens the Ledger at its badge", picturetest "day".

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
- Feel and UI pass, from playing every screen at seven window sizes. The
  biggest friction on phones: the touch stick hit full walking pace and
  sprint almost together (92% vs 94% of the rim), so pushing to walk often
  sprinted and spooked the flock. Now full walk comes at 80% of the inner
  ring (20px) and running needs the thumb past 26px, with 3px of hysteresis;
  the base only follows the thumb beyond 30px. The outer ring is the run
  gauge (stamina), so it sits right under the thumb.
- Touch buttons: BARK r16, NIP and DOWN r13, and any fresh touch within 9px
  of a button's rim goes to the nearest one. HUD buttons on touch are 13px
  tall with a 3px invisible margin. BARK shows its cooldown (dim label).
- Safe areas: `src/ui/safe.ts` reads `env(safe-area-inset-*)` through a
  probe element and converts to internal pixels. `?safe=t,r,b,l` (CSS px)
  fakes them; `uitour.mjs` has `notch` and `landnotch` sizes that use it.
- Camera kicks are whole pixels and decay to zero: bark 1px in the facing
  direction, nip 2px (longer if it lands), the gate shutting 2px down. Tier
  up shakes 1px for 0.35s. All off with SCREEN SHAKE in the pause menu.
- Hit-pause is 60ms and only for a nip that lands; presses during it are
  kept. It never runs under `input.override`, so bots and tuning are
  unaffected. A bark or nip pressed up to 0.2s before the dog is ready is
  buffered rather than dropped.
- Coins: each penned animal's value flies from the animal to the purse and
  the purse ticks up as coins land; spending rolls it down quickly.
- Day transitions are a dither fade (0.22s out, 0.32s in) with the game
  frozen while covering. The summary, ledger and pause dim the field with a
  50% plum dither, never alpha. The summary ignores input for 0.6s so a
  bark held through dusk cannot skip the day's choice.
- The flock card shows the pay the flock is on (CALM X1.5 ... FRANTIC
  X0.35, from its peak stress) next to live stress pips, so "calm pays" is
  on screen while you herd.
- Onboarding stays in the moment: step 1 marks where to stand ("HERE",
  behind the flock opposite the pen) and its hint switches to "now walk in
  slowly" once the dog is there; step 3 arrows into the open gate. One-time
  tips fire when you stand in front of a flock you are driving, rattle one
  past 0.55 stress, or split one. Key caps by the dog on desktop and pulsing
  buttons on touch show the move a hint asks for.
- The place name moved to the top centre so it never covers the banners;
  in landscape on touch the hint sits on the bottom edge between the thumbs.
- Build mode no longer chases the cursor: the view pans only when the
  cursor nears an edge, so a tap or a mouse pointer stays where it is.
- Pause menu rows are data (`PAUSE_ITEMS` in `src/ui/title.ts`); a level
  row (volume) is one entry with `level()`. Settings are saved under
  `comeby-settings`.
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
- Day one was slow: after penning the ducks (about 18$) the kennel (20$)
  waited on the eggs, which sell at the end of the day, with nothing to do
  meanwhile. Resting fixes the waiting: lying down on the ranch with no
  loose animal within 110px eases the clock up to x12 after a second (an
  hour of daylight in under 2s). Only the clock and goods production speed
  up, not the sim, so it costs nothing on phones and orders still expire
  on time. No resting at night, during a trial run or under the bot.
  Measured: from 08:00 a rest reaches the end of day one in ~20s, with
  47$ in hand.
- Sound, round two. The trial theme is a pipe-band march: A mixolydian
  (the chanter's scale) in 4/4 at 96, the whistle as chanter over a full
  drone, harp on the beats, bass drum and side drum always on. It plays
  from the judge's whistle to the closed result card. The trial code
  already whistles when a run starts, so the audio steps in there: the
  judge's pea whistle first, then the handler's. Each gate or post judged
  with points gets a rising cue (fuller when the whole flock went
  through); the trial's own coin and deny sounds stay underneath (coin
  pitches sit in A mixolydian). Bolts and grips get a sour, sagging
  semitone, at most one a second. All in the pen: the judge's double
  whistle. The crowd claps by score: a few polite claps, warm applause, or
  applause and whistles for a win or 85 points and up.
- Orders: filled gets the "sold" stinger after the gate and the whistle,
  and the buyer's cart (wheels, axle, hooves, fading) when the stock is led
  away; missed gets a sigh down to the tonic; partly filled a harp roll.
- Resting (game.rest above 1.3) plays a music-box lullaby in G 6/8 at 40,
  sometimes the main theme, harp rocking on every beat. Birdsong and
  crickets run up to three times faster. Getting up switches back on the
  next eighth note.
- Weather: wind strength scales each region's windiness (clear skies are
  a little calmer than before); rain comes from the sky or the old hook,
  whichever is wetter. Storm: a strike every 7-21 s, mostly far off; the
  thunder follows the (unseen) flash by up to 5 s, near ones crack first
  and are brighter. `game.audio.lightning = { at, near }` is there for a
  flash. Fog closes a filter on the ambience, muffles positional sounds by
  distance and sends them to a small three-line reverb built only when fog
  first comes. The music: rain and fog darken the pad, slow the tempo a
  few percent and favour phrases that open on a minor chord (twice as often
  in rain); fog hushes the tune and wets the reverb; wind lifts the drone; a
  storm adds a little tension.
- Weather is drawn render-side only (`src/render/weather.ts`, reading
  `game.weather`). The one dither pass in `render/night.ts` now carries the
  night, a storm's darker sky, fog and lightning. Rain does not dim the
  whole screen (a plum grid read as a screen door): a wet day darkens only
  the ground, meadow to moss and paths to sage by dither, so the flock
  stays bright. Cloud shadows work the same way.
- Fog under ~25% is not drawn, so rain and storms do not carry a veil.
  Night plus fog is capped at about two thirds of the pixels so the ground
  still reads in the dark.
- Wind gusts move with their own phase (`stepWind`, advanced by
  `render/life.ts`) instead of the game clock, so a change of wind strength
  never makes the fronts jump, and resting can speed them up.
- Resting is a time-lapse of the valley's own clock (`life.vt`, up to x12
  with `game.rest`); butterflies and birds cap at x3. The "Z" float is
  gone: the dog curls up asleep (`drawSleepingDog` in `src/art/dog.ts`)
  with pixel z's, drawn by `render/world.ts` while `game.rest` > 1.3.
- Moving things' shadows (animals, dog, helpers) shift from 2px west in the
  morning to 2px east at dusk. Tree and building shadows are baked and stay.
- The Show Ground is not striped: mower stripes read as rain. It is mown
  short (few tufts) with worn patches baked at the post, the release and
  the pen gate. Onlookers and the tent are decoration: nothing collides.
- Ground detail is placed by kind of ground (open meadow, path, forest
  edge, bank), never by coordinates, so new areas get it too. Wheel ruts
  are the path pixels exactly 2px in from its edge (a distance field), so
  they follow any track. Molehills keep off the ranch and the Show Ground.
- Palette colours (`U32` in `src/palette.ts`) are now packed unsigned. They
  were negative int32s, so comparing them with pixels read back from a
  Uint32Array never matched: the wet ground, cloud shadows, soil types and
  a few bake checks had silently done nothing.
- Rim light is a pass over the sprite grids (`rimLight` in
  `src/art/animals.ts`): coat pixels on the top edge, on the sunny right
  two thirds and above the legs, become buttercup (sparse, white coats),
  teal (plum coats), moss (sage coats) or sage (the dog's teal).
- Townsfolk. The people only read game state and change nothing in the sim
  except one thing: when the dog drives a flock to an open pen, the rancher
  walks to the gate and stands beside it, on the far side from the dog, as
  a mild pressure source (helper kind, strength 0.4, 0.55 of the flock's
  flight zone). How far along the fence they stand scales with the flock's
  flight zone, so their pressure ends at the edge of the gateway: it guards
  the side the flock would slip past without blocking the way in. Ponies,
  who spook from far off, get a wide berth.
- Building is cosmetic: a bought building works at once. A scaffold (big
  buildings) or a timber pile (pens, fences, gates, troughs) stands while
  the builder hammers for 1-14 s of work; anything bought from the summary,
  or left at nightfall, is done by morning. From tier 3 a carpenter walks
  in from the east road for the big jobs and walks off again after.
- The cast grows with the ranch: the rancher from day one; at tier 2 the
  buyers at their yards (miller, drover, auctioneer, once their region is
  open) and the judge at the Show Ground; at tier 5 a shepherd in the High
  Range. Buyers walk to their yard gate to pay for a filled order and shrug
  at a missed one; the judge speaks at the start and the end of a run; the
  rancher stands at the handler's post during trials (no pressure there).
- Speech bubbles only appear for someone on screen, at most one every 2.5 s
  and one per person every 9 s; important lines (the morning word, a
  tier-up) wait until the speaker comes into view. Voices are a babble of
  blips in each person's register.
- Measured with a seeded A/B (same build, the live loop stubbed, 5 seeds,
  rancher pressure on and off): ducks and sheep identical (sheep penned in
  14.1 s against 14.2 s); goats helped (driven and penned in 1 of 5 runs
  against 0, 2.6 penned against 0.2); cattle unchanged; ponies neutral
  (8.0 penned against 8.2, mean stress 0.001 both, no panics) once the
  rancher stands back and eases off for wide flight zones (strength
  0.4 x 44 / flight, at most 0.4). The first version stood 18 px from every
  gate: it covered the gateway for ponies and penned fewer of them.
  With the bot barking every 2 s the rancher helps more: sheep driven and
  penned in 4 of 5 runs against 1 of 5 (26 s against 79 s, a third of the
  panics); goats reach the tune goal in 25 s against 49 s. Plain tune.mjs
  before and after (unseeded, 3 runs) moves within its usual noise.
- Round two of feel and UI. The jobs card moved from the top centre into
  the HUD's left column (goal, then jobs, then the flock card): what you are
  doing on the left, money and buttons on the right, passing messages in
  the middle. At the top centre it collided with the clock and a long goal
  on phones, and with the place name.
- The replay pass (`scripts/playthrough.mjs`: the bot plays from a new save
  and every hint, tip, banner and card is logged against the clock) found:
  tutorial hints that flashed past (the "walk in slowly" line was up for a
  second, the calm-pay and Ledger lines for none, because the first penned
  animal did not restart the step clock); the rest tip firing at 6:00 with
  stock waiting; a frame of RESTING at dawn; the tier-up card hiding "that'll
  do" (the 6th duck tiers up before the gate shuts) and hiding the TRIAL
  DAY banner on the same morning; the stress tip blaming the player for
  stock rattled overnight; no word on why a new kind could not be penned;
  markers and arrows under the hint line and the thumbs; and the Show
  Ground's crook and trial pen sitting under the thumbs on a phone, because
  the region is at the world's bottom edge.
- Fixes: a hint stays up for 1.2-3.5s (by length) before another replaces
  it, though a fresh tip or resting cuts in. Tutorial step 1 needs four
  seconds of actually pushing the flock. The tier-up waits for any pen gate
  about to shut; a banner waits behind the tier card, which replaces the
  tier banner. The stress tip needs the dog close by. A one-time tip says a
  pen holds one kind and what another costs. Markers only draw in the field
  left clear above the hint line and thumbs; a target below that gets an
  edge arrow. On a phone held upright the camera frames the dog above the
  thumbs and may run past the world's bottom edge by their height (teal,
  more forest), so nothing is ever stuck under a thumb.
- Menu dims are anchored to the world's 4x4 grid like the night dither, so
  a night summary stays at the night's 50% instead of filling in solid.
- Sky icons are 7x7 UI glyphs in `src/ui/icons.ts`, alongside the font,
  rather than sprites in `src/art/`.
- Build mode opens with the building a "BUILD A ..." goal asks for already
  picked, and its slot blinks in the bar.
- Customization. The dog's markings are rewrites of the pose grids (in
  `src/art/dogstyle.ts`; `makeDogSprites` takes the look), so every frame
  of the trot, gallop, bark and lie picks them up: few or heavy flecks,
  one eye patch or a pale face, a plum saddle, a wool tail tip. The neck
  piece is always red: a collar is the one-pixel band, a neckerchief adds
  a point at the chest (a knot at the nape from behind).
- The farmhouse paint is read by the farmhouse drawing from
  `src/art/ranchstyle.ts`; the ranch name replaces the tier name on the
  sign by the road, so it reads "COME BY <NAME>". Left empty, the sign
  names the tier as before.
- Names are typed with the device's own keyboard through a hidden input
  (`src/ui/textfield.ts`), focused from inside the tap so phones show it;
  game keys are ignored while it has focus. Upper case, the font's letters
  only, 10 for the dog and 12 for the ranch.
- Decor is for looks only: it never blocks the stock or the dog, so it
  cannot spoil a drive or trap a flock. It cannot overlap buildings, other
  decor or the ranch's own touches; building over it clears it and gives
  the money back, and picking it up refunds it in full.
- A new game opens the dog's look screen before day one; Esc or LET'S GO
  takes it as it is.
- Pacing (M13) is measured with a bot that is quicker and surer than a
  person: it knows where every flock is, never misreads a flock, and walks
  goat and cattle drives it cannot do through at a walking drive's pace
  ("assisted", flagged in its log). So read its days as a floor; a person
  takes longer. What it shows well is where the curve stalls and where the
  money stops meaning anything.
- What the bot found on the merged branch: (1) day one waited on the
  kennel (fixed by resting); (2) "pen 6 ducks" when only 5 spawned;
  (3) a newly opened region could have only one flock out, short of its
  pen goal; (4) tier 4 waited for a trial day; (5) tier 5's six ponies
  need 24 pen space when land had run out (3 of 5 seeds never finished);
  (6) money flooded from tier 2: by tier 4 the bot earned ~1100$ a day,
  three quarters of it goods from pens, against items that cost 2-180$;
  (7) calm strays grazing near the house stopped you resting.
- Fixes: tier 1 pens 5 ducks; a region that has just opened always has two
  flocks out; tier 4 wants a trial score of 60 (practice counts); tier 5
  pens 4 ponies (one plain pen); wool, cheese and milk come about 2.5
  times less often and eggs a little less (eggs 80s, wool 230s, cheese
  220s, milk 190s, from 55/90/85/75), so a
  penned animal earns about its own delivery value a day and driving
  stock matters as much as owning pens; pens get dearer as the ranch fills
  (25, 25, then +15 each); helpers 70/130, top dog training 100-120, pen
  upgrade 40, barn upgrade 70, mill 260; buyers do not ask for the kind
  a tier's pen goal still needs; resting is stopped by anything loose
  within 40px, but further off only by stock that is moving or upset.
- Still true after the pass: past tier 5 money piles up (nothing left to
  buy). Grazing rotation (penned stock eats its pen down and needs driving
  out to pasture, or hay) would be the natural sink and more herding
  work; left for the next round because it needs the pen floor drawn and
  shown in the UI to read at a glance.
- Weather (M14) only touches stock out of pens. The wind that moves things
  (`pushX/Y`) is zero for a breeze, so clear days herd exactly as before
  (seeded tune: 55 of 55 lines identical). Wind leans on a lightly driven
  flock but a firm, steady push beats it; first tries at full strength
  stopped calm drives dead, and fog's smaller flight zone plus a twice-as-
  jumpy startle together tripled calm drives and split flocks, so wind was
  softened twice and fog now also huddles the flock (as rain does) with
  only an 8% shorter flight zone and a modestly jumpier startle.
- `forecast` is rolled each morning for tomorrow (not at day's end) so it
  means the same thing all day for the HUD, the summary and audio.
- Drove road (M15): the rule is in `src/ranch/road.ts` and asked by build
  mode's ghost; `build.ts` (Feel and UI's file) only gained that one check
  and two draw calls (`src/art/road.ts`). The road is the existing worn
  track widened two tiles each side, inside the ranch only; the ranch
  already has three ways out (north, west, east), so no new exit. The
  user's "hard to transit" turned out to be two things besides layout:
  every open pen gate pulled a passing flock in (pens stand open by day),
  and driven animals pushed straight into building corners and fence
  ends. Both are fixed in the herd model and help old saves too.
- Tier 4's night goal counts only your own stock (taken from a pen, or
  let out of one); wild flocks in the far pastures do not spoil it.
- Hidden places (M14) are carved into forest that was already there: the map
  stays 192x168 and no existing coordinate moves. The carving draws no random
  numbers, so every grove, rock and spawn point elsewhere comes out as it was.
  Pockets have region index 0, so their animals never count against a
  region's morning spawns, and each is reached only from inside its own
  region, behind that region's gate (`discoverytest.mjs` flood-fills the map
  at every tier to prove there is no way round a gate).
- Place data lives in `src/world/places.ts` (pockets, ways, props, finds);
  the game side in `src/systems/discovery.ts`; art in `src/art/landmarks.ts`;
  the Ledger's fog in `src/ui/discovery.ts`. Hooks: three lines in
  `game.ts` (update, morning, drawables), a few in `save.ts`, three in
  `ledger.ts`, one recoat case in `art/animals.ts`.
- Finding a place pays 5$ x its region's tier, shows its name as a banner
  with the count, and a tip saying what it is for. Waymarker cairns stand by
  every way in; the first one you pass gets a one-time tip (not during the
  first-day lessons).
- Sweet grass (Willow Pool, the Stone Circle): an unpressured animal inside
  loses 0.1 stress/s and its peak stress (which sets the calm pay) falls
  0.07/s, so a RATTLED flock rested there for ~6s is back to CALM. Measured:
  a sheep at 0.7 peak is at 0.08 after 8s in the ring, 0.6 outside it.
- Strays: the black sheep (Stone Circle, tier 2) is sheep coat 1, plum
  fleece with a pale face and socks, never spawned anywhere else; the lost
  heifer (Waterfall Pool, tier 4) waits across a stream she will not wade
  unless nipped. Penned, they pay their value plus 20$ / 30$ x the calm
  multiplier. They turn up each morning until brought home (one taken by a
  coyote comes back). A lone sheep frets (isolation stress), so the black
  sheep is best walked to a hill flock and brought home with it.
- Wild flocks: five sage goats in the Hidden Valley (tier 3), four bay
  ponies in the Hanging Valley (tier 5). Penned (not let-out stock), each
  pays its delivery value again. A flock comes back 3 days after it last
  turned up, once none of it is left out. Orders take them at the normal rate.
- Strays and wild flock members are tracked by the discovery system and
  saved in `discovery.out`, not in `wild`, so they come back as themselves.
- The Drove Trail runs from the hills' south edge to the ranch's north-east
  corner: ~30 tiles against ~70 by the crossroads. Its hurdle sits at the
  lowest point where the trail is still walled in (found by the map, so no
  dead end is left below it), latched on the trail side: from the ranch it
  will not open ("latched from the far side"), walking up to it from the
  hills opens it for good. The trail's foot is kept east of the starter pen:
  an earlier route beside the pen left a dead-end spur that slowed the
  ordertest drive (25s on the base, 148s with the spur, 18s now).
- Landmark solids (stones, walls, trunks, the wagon, the hurdle) are stamped
  into the map's terrain flags, not the structure flags, because
  `ranch.restamp()` clears those.
- The lookout glimpses everything within 96 tiles of the knoll: the Ledger
  shows that ground through a plum veil, so unwalked clearings stand out.
- Fog cells are two tiles (one Ledger-map pixel); walking clears a radius of
  9 cells. Saved as runs (`<value><count base 36>,`), about 1-2 KB. A new game
  knows the ranch; an old save knows its open regions and roads but no
  hidden place. The Ledger hides flock dots under the fog; the HUD's edge
  arrows still point to the nearest flocks, hidden ones included, as a nudge.
- Keepsakes are only kept for now (Ledger line, `game.discovery.keepsakes`,
  `KEEPSAKES` in `places.ts`), ready for the customization screen.
- tune.mjs before/after: unseeded runs are within the usual noise. Seeded
  (fixed Math.random, a fresh page per run), sheep match the base in 8 of 11
  scenarios (calm walk 13.13s vs 13.03s, the chase runs wobble) and cattle in
  9 of 11; goats scatter far enough to meet the trail's new forest edge and
  the decorative layer shares the random stream, so their runs differ, equal
  or better. The herding code is untouched and calm still beats barking and
  chasing everywhere.
- Co-op is host-authoritative for the world and guest-authoritative for
  each guest's own dog. Lockstep was ruled out: the sim uses Math.random
  everywhere and variable substeps. Friends, so no anti-cheat.
- The relay never reads game data. Binary frames are routed by byte 0 (from
  the host: the guest slot, 0 = all; from a guest the relay writes in the
  sender's slot); text frames are the relay's own JSON (welcome, join,
  leave, host-away, host-back). Close codes: 4000 closed on purpose, 4001
  replaced by a newer socket, 4403 bad host token, 4404 no room, 4409 full.
- Room codes are four letters from 20 consonants (160,000 codes, never a
  word), made by the Worker with crypto and checked free by the room.
- Animals travel as changes against the last snapshot: a WebSocket never
  drops or reorders, so a change list is safe; a guest arriving (or coming
  back) gets one full snapshot of the same moment. 6 sheep and a quiet
  ranch: ~3 KB/s; a tier-2 morning with ~20 animals ~6 KB/s, the largest
  snapshot ~800 B.
- Guests' clock: the offset to the host's clock follows the fastest packet
  (and creeps up 1% a sample if the line slows); the world is drawn 100ms
  behind that, so jitter under 100ms never shows.
- The host eases each guest dog towards where it was sent, a step ahead
  along its velocity (up to 0.25s), so its pressure on the herd is close
  to "now". A guest's nip names the animal it saw at its nose; the host
  takes it if that animal is still within its radius + 22px of the nose
  (the guest's view is a little old), else nips whatever is there.
- Kennel training is the ranch's: guest dogs run, bark and nip with the
  host's upgrades.
- Sounds and effects reach guests through taps on `Sound` and `Particles`:
  what the game asks to play, not what the mixer plays by itself while it
  ticks (menus, gate creaks, trial cues) — guests make those from their own
  synced state. Each carries who caused it, so a guest never hears or sees
  its own bark twice. Lightning, birds and butterflies are each screen's own.
- "That'll do" goes to the dog nearest the gate when the pen shuts: "THAT'LL
  DO, ZIGGY!" on every screen when the guest drove them.
- Resting needs every dog lying down on the ranch, or a guest's afternoon
  would fly past at x12.
- Guests do not find hidden places or clear the Ledger's fog (discovery
  follows the host's dog), and trials are the host's to run (a guest's E at
  the post does nothing), though a guest's dog does push a trial flock.
  A BRACE class for two dogs would be the place to change that.
- Two dogs called BLUE would be one too many: a guest with the host's name
  is "BLUE 2", and a guest with no save of their own gets a random name.
- Single player is untouched: seeded tune.mjs runs (`--seed=7`) are
  byte-identical to main for all five species, and the other loop tests,
  savetest included, pass as before.
- In headless Chromium a second Tab press never reaches the page, so
  cooptest opens and closes the Ledger with G.
- The relay is deployed to the user's Cloudflare account as `come-by-relay`
  (https://come-by-relay.gboneck.workers.dev); the Pages workflow reads it
  from the repository variable `RELAY_URL`. cooptest passes through it.
- On Cloudflare a quick reconnect can reach the room before the old
  socket's close is handled, so the relay checks for a newer socket for the
  same player after its storage read, not before, and says nothing about a
  drop that was already mended. A host who is back before the relay notices
  never shows guests the waiting card; guests just get a fresh world.
- Pings are whistles, not a chat: four words a handler would use. COME BY
  is clockwise round the flock and AWAY anticlockwise, as on a trial field.
  A tap is OVER HERE because that is the one you need in a hurry.
- The brace is not a rung on the class ladder: it runs whenever a friend's
  dog stands at the post with the host's (`braceReady`), so it never gets
  in the way of single player. Ten sheep, 240s, prizes 70/40/20.
- A guest's finds go to `comeby-travels-v1`, not straight into their save:
  their own game is not running while they visit (and they may not have a
  ranch yet). `mergeTravels` folds them in on the next load or new game;
  the found-place rewards are paid once and zeroed.
- On a friend's ranch the Ledger shows what both of you know: the host's
  places, fog and keepsakes with the guest's own laid over them.
- A dead socket is noticed by silence, not by a close (phones often send
  none): the relay answers pings without waking the room, so asking every
  3s costs nothing. Hidden pages never give up a line (their timers lie).
- `&loss=0.05` models packet loss as TCP does: the lost message and all
  behind it arrive 200-500ms late, never out of order.
- Relay change waiting to deploy: grace times (host 4 min, guest slot 5
  min, were 30s / 90s). The live relay still has the old ones.
- Seasons (gameplay, round three): four days a season, so a year is 16
  days and a decent player sees the first winter around tier 4-5. Day 1 is
  the first of spring, year 1; the calendar follows from the day number, so
  old saves load as spring, year 1 (with a full loft) without a new field.
  Autumn days run at 1.1x with dusk at 0.76, winter's at 1.25x with dusk at
  0.7 (`DAY_PACE` in season.ts). No season banner on a new game's first
  morning (it would talk about lambing to someone with five ducks).
- Lambing only in ranch pens and only from tier 2 (sheep arrive at tier 2;
  in year one spring has passed by then, so the first pen lambs come in
  year two). Half the ewes lamb on spring's first morning, nearly all the
  rest on the second, 15% twins. Wild ewes: 40% have a lamb in spring's
  morning spawns, never in a region's opening spawn (the first sheep a
  player meets are plain). Lambs are worth 2$, take one pen place, make no
  goods, cannot go to buyers, the shearer or the fair, and a fox would
  rather take a lamb. Lambing ignores pen room: a pen can end up over full, which
  shows on its sign and is a reason to build or upgrade.
- A ewe feels a lamb only by touch (no flocking, no personal space) and a
  lamb aims 0.4s ahead of its mother and keeps her pace; any looser and
  each pair drifts off on its own. Ewes turn back past 36px apart, lambs
  run to her past 6px; parted ewes fret at 0.2/s, lambs 0.26/s.
- The shearer comes on summer's first morning (tier 2+, three or more
  grown unshorn sheep penned) at the drover's, or the mill's if the drover
  already has an order; up to eight; 6$ a head times the calm multiplier,
  1.5x for a rare breed; once a year per sheep. They come back out of the
  yard's gate (not led away) and are yours to walk home.
- The fair is on autumn's second day from tier 2, in a 6x5 show ring (gate
  north, towards the Home Meadow) east of the trial course. Score = a base
  per kind + 34 x calm + 14 for a rare breed, +-4; three seeded rivals that
  get 3 better each year (to +12). Ribbons pay 40/20/10$. Entries go home at
  the day's end by themselves (to a pen of their kind with room, else by
  the farmhouse door): the drive there is the work. The sale yard takes no
  order that day; its breeders' pen holds each rare breed your tier allows,
  and you buy the one you stand by at the fence (E), not the one nearest
  the gate (you could not choose). Unsold breeds leave at the day's end.
- Rare breeds are new coats of existing species (call duck = duck coat 1,
  black sheep = sheep 1, pygmy goat = goat 2, Highland cow = cow 2), so
  they travel in co-op and saves as they are. The black sheep found at the
  stone circle is the same coat and now counts as rare too. No pony breed.
  Rare: double value at the market and to buyers, goods 1.5x.
- Winter feed: a bale a night per four pen places (rounded up per pen),
  from the farmhouse loft (10 bales, refilled each autumn), then stacks in
  a barn's ring, then the rest; stacks outside a barn's ring lose 2 bales a
  night; empty stacks are cleared away. Haystack: 2x2, tier 2, 20 bales,
  40$ (80$ in winter). A pen without hay makes no goods the next day and
  its stock starts the day at +0.25 stress. Nothing dies of hunger: calm
  beats chaos, and a hungry pen is warning enough.
- Snow slows loose animals by 12% and the dog by 8% at full cover.
  Winter keeps one wild flock fewer per region (never under one, and a
  region that has just opened still gets its two): wild stock above that
  goes down the valley on a winter morning, smallest flocks first, a big
  flock only thinned; never your own strays or a hidden place's flock.
- Not done: more land to buy. The year run shows land, not coin, is what
  runs out at tier 5 ("no room for a pen" is the commonest stall), so a
  land deed would be the late game's best sink; it needs build.ts (Feel and
  UI) to let bought parcels count as ranch.
- Co-op: `src/net` is left to Co-op. Their hooks (`animalExtra` in
  snapshot.ts, `SHARED` in shared.ts) carry lambs (bit 0), the loft, hungry
  nights and the fair (`seasonal`), and haystack bales (`hay`); the show
  ring joins `allPens`, and the guest sets the calendar's year and day,
  winter's dusk and the snow's drag on its own dog. The patch (tested on a
  merge with coop-r3: cooptest passes, with a new check) is in the shared
  notes as `gameplay-r3-coop-hooks.patch`.
- Seasons are drawn by recolouring the baked ground and canopy into
  seasonal copies (`src/render/seasons.ts`). The levels are stepped in
  quarters and a copy is rebuilt only when a step changes (~45ms on a
  desktop, a few times while a season turns), so a frame costs no more than
  in summer. Summer draws the original bake. Everything drawn each frame
  (roofs, fences, decor, sway) reads `seasonLook` (`src/art/seasonlook.ts`),
  set once a frame from `game.season`.
- Winter snow lets old grass poke through in small 2x2 tufts (~7%), so the
  snow has texture and pale things standing on it still read; pale coats
  get a sage outline on snow. Shade under trees stays sage: the snow has
  shadows. Paths keep only a thin dusting: they look trodden.
- Rain falls as snow when there is snow on the ground; puddles, splashes,
  the wet ground and cloud shadows are off in the snow.
- The dog's idles (`src/render/dogidle.ts`) are render-only: standing still
  a few seconds it sniffs or scratches, leaving the ford (or after a while
  in the rain) it shakes off with spray. Any move ends them at once.
- The title illustration (`src/art/title.ts`) is painted once per size and
  season into a canvas; only the tail, the falling things, butterflies and
  breath draw each frame. It replaces the small trotting dog by the logo.
- Sound, round three. The soundscape reads `game.season` (bloom, leaves,
  snow, eased) and first light (the first 12% of the day). Birds: a dawn
  chorus up to four times as busy in spring, half as busy in summer; six
  songbirds, a cuckoo now and then in spring, a lone robin in the snow.
  Insects are a looped bed by day in summer; crickets from dusk in summer
  and fewer in spring and autumn, none in snow. Autumn adds a dry-leaf
  rattle that follows the wind and rooks (more at dusk). Winter narrows
  the wind's upper band into a moan, closes the top of the ambience (a
  hush), swaps every footstep for a crunch, adds ice pings and groans near
  the river and a wolf chorus far off at night (not the predators).
- Music by season: phrases opening on a minor chord are favoured with
  autumn and (more) winter as with rain; the lead's voice leans to the
  whistle in spring, the fiddle in autumn and a music box in snow (never
  for the trial march or the title theme); tempo +3% spring, -3% autumn,
  -8% winter; in snow the harp thins and a music box sparkles over it.
- Lambs and the fair are read loosely until the gameplay side lands
  them: a lamb is an animal with `lamb: true` and `mother`; the fair is
  `game.fair` with `on`, optionally `x`/`y` (default the Show Ground) and a
  `sold` counter. A separated lamb (more than 60 px from its mother, or a
  fence between them) calls every 1.8-4 s, answered 0.5-0.8 s later; at
  most three pairs call at once; lost-lamb calls carry 480 px instead of
  320.
- Co-op sounds, agreed with the co-op session: `play('bark', { who })`
  (who = player slot, 0 the host) and four whistle pings, each under half a
  second and pitched per player: `ping-here` (two quick notes up),
  `ping-hold` (one level note: stop), `ping-come` (rising: go round
  clockwise), `ping-away` (falling: anticlockwise). Join and leave chimes
  come from the audio diffing `game.net.players` itself, on each side.
- Long sessions, measured: an hour of varied play (ten days, the seasons
  turning) scheduled in about a second: 250-260 sections, 95% of tunes
  open differently, the main theme 5-8 times (it was 11 before the ranch
  quoted it less), the same chords twice running 1-4 times. Rendered at
  8 kHz: every minute between -32 and -27 dBFS, peaks under -9, no drift
  from the first ten minutes to the last. The "that'll do" stinger has
  three variants, "steady", the end of day and "sold" two each.
- The screen scale-up moved to CSS (`image-rendering: pixelated`): the
  canvas is the internal size and its CSS size is a whole multiple of it in
  device pixels, so it stays crisp and nearest-neighbour; browsers without
  `pixelated` keep the old drawImage copy.
- Icons are drawn at build time by the game's own sprite code under Node,
  with a stand-in canvas that does only fillRect and drawImage (all the
  sprite code needs), rather than Playwright: the Pages build needs no
  browser, and the icons match the sprites exactly.
- The service worker keeps everything the build made and nothing else
  (the relay is a WebSocket, which workers never see). It skips waiting:
  the build is one hashed bundle loaded at start, so a page running the old
  build never asks for an old file after the new worker clears its cache.
- Performance is measured with stepped, seeded frames and the best of
  several batches: five sessions share this machine, and live frame rates
  swung 3x between identical runs. Each stepped frame reads one pixel back,
  so the new direct-to-screen drawing pays for its raster like the old copy.
- Quality levels never touch the night, the herd or anything you play with;
  the dither overlay is gameplay (darkness, lamps). AUTO judges our own work
  per frame (12 ms budget, 6 ms to step up), not the frame rate, so a
  30fps power-saving mode does not look like a slow phone.
- Pad mapping follows the brief (A bark, B nip, X hold lie down, Y helpers,
  START pause, SELECT Ledger, triggers or RB sprint) plus LB for build mode;
  in build mode LB/RB pick, LT/RT change tab, X removes, Y upgrades the
  building under the cursor or turns the one being placed.
- Pad prompts are one table of keyboard phrases (`src/ui/pad.ts` PROMPTS)
  applied to drawn text while a pad is in use, through a hook in the font,
  rather than edits to the fifteen screens that write prompts. A new
  keyboard prompt needs a line there to read right on a pad.
- Pad typing (names, the join code): up/down turn the last letter, right
  adds one, left deletes. B on the join screen leaves it, since that screen
  takes the keyboard back to its code field every frame.
- A save code is the save's JSON deflated (CompressionStream) in URL-safe
  base64 behind `COMEBY1.`; a tier-5 ranch is about 3,100 letters, which
  is fine to copy and paste but not to type, so a file is offered too.
  Codes may arrive broken over lines; plain save JSON also loads.
- Day one still stalled for some players: 5 ducks (the fewest that spawn)
  pay 15$ driven calm but 10$ steady and 5$ rattled or frantic, and a pen
  filled at midday lays only about 7$ of eggs by nightfall, so anything
  short of a calm drive missed the 20$ kennel. A new ranch now starts with
  10$ and the kennel costs 15$: a calm or steady drive pays for it at once,
  and the worst possible one (frantic, penned at dusk) has 15$ on penning
  and 18$ at day's end. 10$ is below the trough (12$), so the tin cannot be
  spent on anything that would leave the kennel out of reach.
- Characters, round four: the dog's eight ways round are a drawing matter
  only. The sim keeps its four facings (bark lines, co-op face bits, the
  bot); render/dogpose.ts picks a view 0..7 from the heading with some
  hysteresis and turns through the in-betweens 35ms a step (60ms
  standing). Standing, it turns at most two eighths towards the stock,
  so a bark (drawn from the sim's facing) never jumps more than that;
  during a bark it faces its heading. Lying down and getting up happen in
  the side, front or back views only. The trot and gallop are six frames
  over the same stride length as the old four (phase x 1.5).
- Dog frames are put together from parts with template letters (k f n e E
  h a) that dressRows resolves per look, so every customization reaches
  every frame without touching the pose grids again. The soaked look is a
  second set built the first time the dog gets wet (flecks go sage); it
  lasts until the shake-off, or 40s without rain.
- Panting: your own dog pants from its real stamina (below 55%, 80% in
  summer); friends' dogs and helpers have no stamina on screen, so they
  pant after a couple of seconds of galloping.
- Animals' wide eyes are a second sprite set per species and coat, built on
  first fright. The startle is a render-only jump (panic setting in, or
  stress jumping 0.16 in a frame), so guests see it from synced stress.
- Bandana red stays on the player's own dog: every animal, predator,
  person and helper sprite was scanned in the page (2,500 sprites): no red,
  nothing off the palette, no half-transparent pixels.
- The village's people (smith, stallholders, cottagers, warden) are
  drawn and dressed here, ready to spawn; their days are the village's to
  run (gameplay), through Person.go(steps).
- Paddocks (round four): 6x6 at least (48 squares), 28 across at most.
  Price 0.8$ a tile of fence plus 1$ for the gate, so 8x7 is 25$ as
  before; extending pays only the fence added; moving the gate is free;
  removing an empty paddock gives half back. Room is 16 per 8x7 scaled
  by area, plus up to half again as it grows to four times that (so big
  paddocks reach the old upgraded density). The whole-pen upgrade is gone
  for new paddocks; old saves keep theirs.
- Mixed flocks: ducks get on with anyone, sheep with goats, cattle with
  ponies. A refused animal is turned back at the gate, and one that slips
  in is put back out when the gate shuts.
- Fixtures: the trough as before (12$), a field shelter (45$, 3x2, open to
  the south; a paddock with one is safe at night, as is one whose middle
  or gate is in a barn's ring) and a hay rack (20$, a third less winter
  hay). One of each per paddock, clear of the gateway.
- Fields: the south-west (200$) and the south-east (300$) plots past the
  clearing, bought at their signs with NIP. They take paddocks and fences
  at once (the scrub is no obstacle to them) and anything else once grazed
  clear; penned stock grazes too (sheep 1/22 a second, goats 1/11, cattle
  1/15, ponies 1/22; ducks not at all).
- Until build mode's drag handles land (UI's), U extends the paddock side
  nearest the cursor by two.
- Village steps go one a morning, in order, the morning after the deed:
  cottage (1 order), square (4 orders), second cottage (graze a field
  clear), smithy (pen 4 cattle), hall (a ribbon), third cottage (40
  penned). The favour session turns the square's deed into drover favour 2.
- Market day is the third day of each season (once the square stands):
  the drover always has an order at half again, goods sell for a quarter
  more. The festival is the last day of each season (once the hall
  stands): five of a kind through the arch within a minute make a parade.
- The bridge takes six logs; the agility yard's par is 5.5s with three
  clean days to a free training level; the shed pays 4$ a fleece and the
  dairy 7$ a cow (scaled by calm).
- Villagers roll their own dice (not Math.random), so they cannot change
  a seeded tune or pace run; they are not pressure sources, so a parade
  walks past them. Nights without visitors end after 2.5s, so the
  warden's lantern round is mostly a dusk thing.
- Merging with the other round-four branches without double work: the
  third cottage becomes THE SHEPHERD'S COTTAGE (mend the shepherd's hut)
  when the Map session's `src/systems/projects.ts` is there, and the
  valley's own shelter and rack art steps aside when Graphics'
  `src/art/paddock.ts` is there (lazy `import.meta.glob`s that only ask
  whether the file exists), so each branch works alone and merged.
- With mixed flocks a fair entry goes home to any paddock it can share
  (the fair's goat to the sheep's), as everywhere else.
- Balance (round six): herding stays the best way to earn by cutting the
  passive side, not by paying herding more across the board. Goods stay
  a reward for calm herds (stress still cuts them) but a packed paddock
  makes half, and the one new bonus is for the hardest herding: a big
  drove brought in calm. Crowding is a production factor only, not
  stress, so it does not spill into order pay, the fair or breeding's calm
  test (breeding has its own room rule).
- Prices raised are the late ones only, so the early game (and day one's
  kennel) plays as before and tiers 4-5 still end with a choice.
- The wild cap (260) counts animals that are not yours (not penned, not
  home, not entries or for sale), checked each morning before a new flock
  or a drove.
- Breeding (round five): once a year, on the first two mornings of the
  kind's season (spring; ponies summer), from tier 2. Chances a season:
  ducks 0.5 (2-3 ducklings), sheep 0.93 (15% twins), goats 0.8 (40% twins),
  cattle 0.65, ponies 0.55. Calm means stress at most 0.4 at the last day's
  end and in the morning (the night takes most stress off, so the morning
  alone tells nothing). Room is for the young once grown, so a paddock
  never ends up over-full when they grow up in autumn. No sexes: any grown
  one with another of its kind in the paddock can bear.
- Young take a place (a calf or foal two) and are worth two-fifths of a
  grown one; they make nothing; buyers never take them.
- Wild flocks: a sixth bigger for each tier the region has been open, up to
  two-thirds again; a fourth flock once open three tiers; 40% of wild
  mothers with young in season, from tier 2.
- Big droves: 30% a morning from tier 3 (not winter, not fair day, not two
  mornings running), 2.5 flocks' worth in an older region, at the spawn
  point farthest from its flocks.
- The sale yard's lot: one kind a day in turn (of the kinds whose region is
  open), at four times its delivered value (duck 8$, sheep 20$, goat 32$,
  cow 56$, pony 120$). The lot makes way for the fair's breeders.
- Goods as items lying where they were laid were built and then dropped:
  UI shows each paddock's goods as piles by kind, which read better (a
  churn of milk where a cow stood would look odd) and need no save change.
- The audio's mother-and-young calls keyed on the mother's `lamb` link, so
  ewes called as if lost; they now key on `young`.
- The unseeded ordertest is flaky on this branch and on the base (the bot
  sometimes walks the order's flock into the empty open pen); seeded runs
  pass.
- Round four of UI and effects. The body face stays 5px tall and no glyph
  got wider, so every layout that measured with textWidth() still fits;
  only I (and the stops) got narrower, and pairs whose facing columns are
  two rows apart are kerned a pixel closer. The heading face is new and
  separate (heading(), headingWidth()).
- One panel() for all screens (src/ui/frame.ts, the same call as the old
  one in gfx/draw.ts), so every screen picked up the bevel at once. Paper is
  its own frame: plum ink on wool, teal for what matters; texts written for
  dark panels map wool to plum and buttercup to teal on paper.
- The stamina gauge moved from render/world.ts into the HUD layer, so it
  reads over the night's dither too.
- Emotes and the nip's impact star are local 'anim' particles (a co-op
  host does not send them; every screen makes its own). The ripple and the
  clods of mud are ordinary particles and do travel to friends.
- Fireworks and the stamp's dust are screen space (src/ui/feel.ts), drawn
  over the HUD with the coins in flight.
- The iris follows the dog while the next scene opens; in a menu it is the
  middle of the screen.
- Photo mode freezes the world as the pause menu does (it runs on with
  friends here). The card is saved at the largest whole-number scale that
  keeps it near 1200px on its long side; the data URL is turned into a file
  at once so the share sheet opens while the tap still counts.
- Perf (perftest, 4x CPU, phone size, best batch): title 5.5 to 5.6 ms,
  day 10.1 to 9.7 ms, worst 11.7 to 12.2 ms: within the noise of a machine
  shared with other sessions. After the Ledger tabs and the paddock editor
  (neither runs in play): 5.7, 10.2 and 12.4 ms, under a load average of
  13 to 20.
- Paddock rules come from Gameplay's src/ranch/paddock.ts through
  src/ui/paddockrules.ts, found by `import.meta.glob` so this branch still
  builds without them. The merge with valley-r4 (branch ui-r4-valley)
  drops valley's stopgap "U extends the nearest side by two" and its
  paddock info lines, which the editor replaces.
- Paddock build UI: the rules (price, capacity, where it may go, building,
  extending, gates, fixtures) belong to the ranch and come in through one
  interface, `PaddockRules` in src/ui/paddockbuild.ts; build mode only
  asks. The editor works on a draft (a rectangle and a gate) that stays
  open until BUILD, so a rough first drag is fine: every handle can be
  nudged after, by drag, stepper or key. Extending reuses the editor with
  the old fence as a floor. Fixtures are charged their catalog price by
  build mode, as every catalog item is; paddocks and extensions are paid
  by the rules, since only they know the price.
- The Ledger keeps its open page between visits (a book stays open where
  you left it); confirm closes it only when the page does not use it.
- Tree shadows are no longer baked into the ground: the canopy's
  silhouette is baked once in sage (`canopyShadow`) and laid over the
  ground shifted by the sun's vector (`sunShadow` in `src/render/sky.ts`)
  into a world-sized lit-ground picture (`LitGround`, `src/render/light.ts`).
  When the sun moves a pixel it is redone 32 rows a frame, so a frame still
  draws the ground as one image. (Drawing the shadow as its own layer every
  frame cost 2-3 ms on a throttled phone; compositing plum onto water cost
  more, so shadows on water are sage.) The shadow
  mask the bake still keeps (where the shade usually lies) only places
  ferns and such.
- Building shadows read `lightLook` (`src/art/seasonlook.ts`), so the
  picture cache redraws a building only when the sun has moved a whole
  pixel.
- The golden hour is a sparse random speckle (~5%), not a Bayer grid: a
  regular grid over the whole meadow read as a filter. Blue hour mixes teal
  into the dusk dither (up to 70% of its pixels); warm rings are on lamps
  and the camp fire only (the farmhouse's big pool ringed its own roof).
- Morning mist reuses the fog pass, up to 0.28, fair mornings only, off at
  GRAPHICS LOW. Light shafts visit only the pixels inside their bands and
  draw at GRAPHICS HIGH only. Wildlife counts scale with `quality.fx`.
- The wildlife and the fish use their own seeded random numbers, never
  `Math.random`, so a seeded `tune.mjs` run is unchanged by them.
- Morning mist is light (up to 0.18, gone by 07:40): at the strength of fog
  it laid a grid over every morning.
- Paddock floors are one cached bitmap per paddock, painted from ImageData
  and keyed on the size, the gate, the fixtures and the season, so a big
  field costs one image a frame. A repaint always makes a new canvas,
  because the picture cache knows an image by its object. A paddock reads
  as a field gradually, as its smaller interior side grows from 6 to 10
  tiles.
- `penDrawables` lives in `src/art/paddock.ts` and is re-exported from
  `art/buildings.ts`, so older imports (farm2.ts on valley-r4) keep working.
  A trial merge of valley-r4 typechecks and draws Gameplay's real paddocks.
  To merge, take this side of `penDrawables` in buildings.ts, keep
  `export function shadowRect` with its `groundShadow` body, and drop
  `fixtureDrawables` from valleyDrawables: the paddock draws its own
  fixtures, and with both they would be drawn twice.
- The paddock data the art reads: `rot` + `gateSpan()` for the gate,
  `fixtures?: { kind, tx, ty }[]` and `hurdle?: { vertical, at, gate, swing }`
  (types in `src/art/paddock.ts`). If there is `hasTrough` and no list, a
  trough goes by the back fence, as before.
- Valley projects (M28) were planned with the ford bridge among them; the
  Gameplay session was already mending the old bridge (valley.ts), so tier 4
  got the mill pond at the Waterfall Pool instead: puddling is cattle work
  (they balk at water, so it takes nips and then a hold in the shallows).
- Grazing uses valley.ts's GRAZE rates (duck 0, sheep 1/60, goat 2/60, cow
  1.5/60, pony 1/60 a second; lambs half) and its rule: an animal counts
  while its stress is 0.45 or less, it is not panicking and it moves slower
  than 0.7x its walk. Work needed: the orchard and the scrub 12 each (any
  kind with a rate), the reed bed 6 (ducks only, paddling at 1/60), the mill
  pond 6 (cattle only, and only while standing in water). Measured
  (projecttest, seeded): six ducks driven in by the bot and held clear the
  reeds in ~66s; eight sheep graze the orchard in 90s; five goats browse the
  scrub in 72s; four cattle held in the pool puddle it in ~95s (they step out
  between nips, so holding them is the work).
- Hauling: an animal of the right kind (not a lamb, stress under 0.6) that
  passes within 20px of a pile with a load left takes one; at stress over
  0.8 or in a panic it drops it, and the load is back on its pile; within
  the site's radius it is counted. Loads in transit go back overnight and on
  a load. They are tracked in projects.ts and also set `Animal.load` (as
  Gameplay's log does), so once both branches are in a loaded animal leans
  into it (Characters' pose) and walks at 0.85 (Gameplay's drag).
- What each brings: the reed bed, 8 more bales in the loft each autumn
  (through Gameplay's `seasonal.loftBonus`: the autumn refill is LOFT_MAX
  plus the bonus; until that field is merged in, projects.ts adds the 8 on
  autumn's first morning itself); the orchard, 5-7
  sheep each morning but in winter when fewer than 3 are there (plain wild
  stock); the scrub, the valley's wild goats every day (7) instead of every
  3 days (5); the hut, a waystation (lying within 34px of its door rests the
  dog as at home, friends' dogs too) and the fold's gate (E; solid when
  shut; the open fold draws driven stock in like a pen gate), and the crook
  if it was never picked up; the mill, a quarter more on each evening's
  goods; the circle, midsummer (summer's second day): animals within 28px
  of the ring's middle are blessed, and a blessed animal penned (not your
  own let-out stock) pays its delivery value again.
- Projects open by tier, once their hidden place is found, and by season
  (the reed bed in spring or summer; the orchard, the scrub and the mill pond
  not in winter); progress keeps out of season. The Ledger lists them as
  their own THE VALLEY n/6 under HIDDEN PLACES in the first column (the
  village is Gameplay's list above it; the second column overflowed a
  landscape screen once an order was up): the ones under way (the one in
  hand with what it needs), NEXT (and what it brings when nothing is under
  way); a plum flag on the map at each workable site (teal while it waits
  for its season), the place's star once done.
- Project props are `WORKS` in places.ts, and the hut's walls and the ring's
  stones carry `project`/`when`/`ring`. `map.setProjects` restamps only the
  project props' cells, so the hurdle and Gameplay's bridge deck keep theirs.
- The stone circle now starts with four stones missing: they lie fallen in
  the Rolling Hills from the first day (a tip calls them out), so a
  returning player sees four gaps in the ring until ponies bring them back.
- The Shepherd's Hut's way stays narrow (goats carry slate through it in
  single file). Widening it turned a few Rocky Rise tiles to grass, and since
  each region's spawn points come from one seeded stream walking candidate
  tiles, every flock from Rocky Rise on started somewhere else: pacetest
  (seeded, deterministic) went from days 8/7/7 to 9/9/8 on that new layout.
  Narrow again, the runs match test/round-4 exactly.
- Co-op: the projects' state is one SHARED line; carried loads and
  midsummer blessings are animalExtra bits 2 and 3 (Gameplay's log is bit
  1); a guest's first copy changes the map without a ceremony.
- The Waterfall Pool keeps its size: a bigger pocket and pool (room for
  more cattle) shifted the seeded random stream through the decorative
  layer, enough to change the two duck chase runs in tune.mjs. Four cattle
  fit in its shallows and stream as it is.
- Checks, before (test/round-4) and after: tune.mjs `--seed=1` identical
  line for line for all five species; pacetest seeds 1-3 identical (the
  valley thrives on days 8, 7, 7); cooptest 47/47 (one run had the brace
  check catch the guest a frame early, a timing flake that passes on a rerun
  and on the base); savetest, discoverytest and the loop tests (econtest,
  flowtest, nighttest, pentest, trialtest, ordertest, resttest, daytest,
  weathertest, transittest, seasontest, lambtest) pass as on the base.

- Favour levels are never lost: a missed order takes points back only down
  to the level's start. Pay over the price is paid as a separate float so
  the order code's price line (which gameplay also edits) stays as it was.
- One special order a day at most, and the miller's rush only for a kind
  you have penned at home (a rush from the far pastures would be cruel).
  A show order does not refuse rattled stock for good: it waits in the
  yard until it settles (peak stress drifts down), which is calm-beats-chaos.
- The shearer's track is shorter (3 levels: 4, 9, 15 points) because he
  comes once a summer; his level 2 brings a second clip, which makes the
  top reachable in a second summer.
- Achievement badges are earned once and kept; the lifetime record works
  out most of them, so an older save loses nothing. Moments that cannot be
  worked out from totals (a quiet day, a perfect drive) are not guessed.
- A card's confetti uses Math.random, so cards make no fanfare under the
  bots (`input.override`): seeded tune runs stay identical to main.
- Valley projects and the village (other sessions this round) are read
  through an optional view (`projects.done`, `ranch.village.built`), so
  this branch builds without them and the badges light up once merged.
- Agreed with the other sessions this round: favour owns the village's
  market square (its deed is the drover's trust, favour 2; the first
  cottage stays "fill an order"), and a friend's name goes up over their
  stall there; the Ledger's extra pages use Feel and UI's page shape
  (`LEDGER_PAGES`, drawn in the ink they are given); the badge card takes
  the tier card's slot and waits behind banners; the ribbon board stands
  just past the farmhouse's front right corner (World and light). The
  merge steps are in the session notes (favour-achievements.md).
- Characters at double density are drawn by hand in fine pixels, not
  upscaled: Scale2x (up2 in src/art/hd.ts) only smooths the old look and
  adds no detail, so it is kept as a tool and nothing ships through it.
  The dog is still built from parts (torso, head variants, tails, a fine
  leg generator), so every view and gait stays consistent and the look's
  letters reach every frame. Bobs are half a world pixel (one fine pixel)
  at a trot.
- The dog's sniff and dig are two plain fields on Dog that the treasure
  hunt writes each frame; the drawing only reads them. Digging is shown
  side on, whichever way the dog was heading.
- Round five's perftest (6x throttle, phone size, three rounds alternating
  with platform-r5 on a machine busy with other sessions): medians day
  24.9 ms before / 23.1 ms after, worst 26.6 / 27.3 ms; within the noise.
  Dense sprites cost the same pixels as the old ones drawn under scale(2);
  fine shadows, ripples and drips are filled at half-pixel steps in world
  space rather than switching transforms per call.
- Goods are drawn from each paddock's `goodsBy` (counts per kind): piles,
  not single items, so a paddock with 40 eggs still reads (a count goes on
  a pile past a handful). The +1 is a particle ('good', the kind in its
  text) so the co-op host's tap forwards it to guests unchanged.
- The sale plays inside the summary (the mode stays 'summary'): friends
  wait on their card as before, and `summaryHold` gives a press during the
  sale to skipping it, then the journal's usual beat before it takes keys.
- The objective is worked out each frame from the game, never stored, so
  it can never go stale or disagree with the world; the tier goals stay in
  the Ledger and on the card when nothing more pressing is on.
- What's-this cards wait for the day's banner and the first steps of day
  one (until the first flock is penned), so a new player sees one thing at
  a time.
- Sentence case is applied where prose is drawn, not in the strings
  themselves: other features keep writing capitals (no sweep across a dozen
  files mid-round), and a line drawn in capitals still works. Headings,
  buttons, tabs, signs over the world and short status words stay capitals.
- Pad prompts match case-insensitively and answer in the case they find,
  so a sentence-case hint still turns "Hold Q" into "Hold (X)".
- The screen aims for 432 fine pixels on the short side, not 480: the scale
  must be a whole number of device pixels per fine pixel, and on an upright
  iPhone (1170 device px) that is 3 (195 world px wide) or 2 (292 wide with
  everything a fifth smaller and fine text too small to read). Bigger
  pixels won; the world shown is a little less than round four's 234.
- The old art is drawn under scale(PX) rather than redrawn: it is exact
  2x2 blocks, so day one looks as before and the art sessions move each
  piece to fine pixels when they redraw it.
- The night and ground dithers work out their light per world pixel and
  dither per fine pixel: a finer dither for about 1.5x the work, not 4x.
  MEDIUM and LOW keep the world-pixel dither, so AUTO can win the cost
  back on a slow phone.
- The heading size is the body face scaled by Scale2x (it rounds diagonals
  as it doubles strokes) rather than a third hand-drawn alphabet: it keeps
  the body's letterforms and costs nothing to maintain.
- perftest's numbers are software rasterising (headless Chromium without a
  GPU): the new pipeline fills 2.8x as many pixels, which a phone's GPU
  does off the main thread. The JavaScript parts that grew were optimised
  (the night pass, the ground dither), and LOW is cheaper than round
  four's HIGH.

- Co-op, everyone does everything: the guest's build mode is the real one,
  run on their copy of the ranch; each change is the UI's `BuildAction`,
  sent to the host (`build.remote`) and done there by `applyBuild`, the
  same code a local build runs, so no rule or price is copied; the answer
  comes back through `build.answer`. The guest's screen checks first for a
  quick "NEED 40$", the host's check is the one that counts. Buildings go
  over the wire by corner tile and kind (`src/net/buildwire.ts`): each
  browser numbers its own buildings, so ids would not match.
- One builder at a time: two editors would each be looking at a ranch the
  other is changing. The other player keeps herding meanwhile.
- Kennel training is the ranch's: every dog on the ranch, guests' included,
  runs with the ranch's upgrades, and a guest training at the kennel trains
  them all from the shared purse. A guest's own save keeps its own
  training at home. (Simpler than carrying two sets of stats, and it makes
  the kennel a shared project.)
- A guest's E is played as if their dog were the ranch's dog for that
  moment (`game.dog` swapped, `game.actor` = their slot), so every E rule
  in jobs, orders, trials, the sale yard, farmwork and the valley applies
  unchanged; a trial or agility run remembers whose dog it is
  (`runner` / `who`) and follows that dog.
- The next day waits for everyone (napping or dropped friends do not
  count); the host's second press goes without them, so nobody is stuck.
  Building from the day's card counts as ready when you leave it.
- Loot (round five): every roll is seeded by the day and the spot, so a
  spot holds the same thing for anyone who digs it and seeded runs match;
  things found once (seeds, wear, relics, pages) are not found twice, and
  a roll that lands on one falls back to coins. Coins stay modest (about
  15$ for a whole day dug, the hoard once) so herding stays the living.
- Digging is NIP on a spot rather than a new button: nothing to learn on a
  phone, and an animal at the nose always gets the nip, so it never gets in
  the way of herding. Lying down stays lying down (no digging, no scent).
- Things to wear are drawn by the look's template rewrite (dogstyle.ts):
  the spotted kerchief stays Bandana red with wool spots, tags hang where a
  neckerchief's point would, socks and a blaze are wool. The poses read
  `dog.sniff` (0..1) and `dog.dig` (seconds left), which loot sets; until
  Characters' fine-pixel poses merge, both use the side sniff pose.
