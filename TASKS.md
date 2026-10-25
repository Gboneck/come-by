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

(Pacing across a year: see below, filled in from `pacetest.mjs --year`.)

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
