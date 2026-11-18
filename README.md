# SOLMARIS BAY — Open World Crime

![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game that runs entirely in your browser: a sun-soaked
bayside city, cars you can steal and drive, cops who chase, PIT you and call
in a helicopter, and six jobs that chain into one story. No install, no
network at runtime — everything is vendored under `game/`.

## The story

Raka is a courier who owes the Bay Street crew $50,000. The crew does not
want the money in one payment — they want it in six jobs, and they want it
tonight. A stolen coupe, a sealed package, a three-star chase, one last
getaway across the whole bay, a yacht heist at the marina, and a flight
manifest at the airport. The city is open. The cops are not patient.

## The city

Solmaris Bay is a 600×600 metre coastal town on a 7×7 road grid: a downtown
of towers and neon (HOTEL, 24H TACOS, BAR, CINEMA, PIZZA, GYM, CASINO,
NIGHTCLUB), a park with benches, trees and a fountain, a harbor and marina
on the east edge, a beach and sea to the south, and three newer districts —
**Old Town** in the north-west corner (narrow streets, arched facades, a
stone plaza with a statue), a **second beach with a long pier and a
ferris wheel** on the harbor, and an **airport** on the west margin (a
runway with centreline dashes and edge lights, a control tower, two
hangars and two parked planes). Traffic drives the grid, a bus loops the
outer ring, pedestrians walk the sidewalks and sometimes jaywalk at the
crosswalks, palms and lamps line the streets, and rooftop billboards spell
out CASINO, HOTEL and SOLMARIS BAY over the tallest roofs. Press **U** for
rain (the roads go dark and glossy) or **I** for dusk (the sun drops and
the streetlamps glow).

## Systems

- **On foot** — WASD movement, sprint with Shift or a double-tap of W
  (stamina drains while sprinting, recovers when you walk or rest; press
  Shift again mid-sprint for a 1.5 s sprint burst at ~2× speed). Jump
  with Space (landing kicks up a small dust puff). **C** crouches — slow,
  but the heat cools twice as fast while you hide out of sight. **V**
  shoves the nearest pedestrian back. At the beach you can walk into the
  sea and swim — slow paddle, and you cannot drown. **G** is a dive roll:
  a 0.6 s tucked roll at ~11 u/s that costs 15 stamina and slips under
  traffic — cars cannot hit you mid-roll, so it is the way through a
  moving lane without waiting for a gap. Camera orbit with the mouse.
- **Driving** — five stealable vehicles (yellow coupe downtown, red sports car
  east, white van by the park, pink convertible by the beach, teal
  motorcycle downtown — the fastest launch in the game), each with
  its own speed and handling, plus a **speedboat** moored in the harbor:
  board it with E from the pier and drive the whole inlet, wake and all.
  E to get in and out, Space as a handbrake
  for drifts (tyre screech follows drift intensity, skid marks stay on
  the asphalt), H to honk — nearby pedestrians step aside. **Shift** is
  nitro while driving (limited by the nitro meter, which refills off the
  throttle). **B** folds the convertible's roof down and back up.
  Headlights light the road ahead. The damage model shows smoke under 40
  HP, fire under 25 HP, and an explosion + $200 repair bill at 0 HP, after
  which the car respawns at its parking spot. Every vehicle has its own
  engine note — the bike whines high, the van growls low, the boat
  rumbles.
- **Wanted / heat** — 0 to 5 stars. The cops see a crime and the stars
  rise; cruisers spawn, chase and ram you. At 2+ stars a cruiser can **PIT
  maneuver** you — steer into your rear quarter and spin the car. Break
  line of sight and the HEAT COOLING bar fills until a star drops (the
  minimap's red heat arc fills with the wanted level, and a blue inner
  arc shows the cooling progress). At 3 stars the cops throw up
  roadblocks — blast through one at speed for a **+$100 "Broke the
  line"** bonus. At 4 stars they call backup (up to four cruisers at
  once) and a **police helicopter** circles overhead, its searchlight
  tracking you — and they drop **spike strips** across the road ahead:
  driving over one shreds your tyres (top speed halves for 6 s) and
  costs 5 HP. At 5 stars the **SWAT van** rolls: a black box truck that
  rams for 14 damage and never backs off. Get boxed in slow at 2+ stars
  and you are BUSTED: the cops take $150 and drop you downtown.
- **Traffic & pedestrians** — traffic cars obey traffic lights, stop (and
  honk) when you block them, brake for jaywalkers, and **change lanes to
  overtake** slow cars — and they **pull over and stop** when an
  ambulance or fire truck bears down behind them with its lights on.
  An **ambulance** (white, red stripe) and a **fire truck** (red, ladder
  on the roof) loop the city with flashing light bars. A yellow **taxi**
  cruises the grid — press **T**
  near it to hail a ride to the current mission marker for $20. Twelve
  pedestrians walk the sidewalks, flee gunfire and cars, jaywalk at
  crosswalks, and can be knocked down (which costs you a star and a $20
  hospital fine if you run one over). The bus stops longer at the park
  corner — five seconds instead of three.
- **Combat** — a pistol pickup downtown (12 rounds, click to shoot, R to
  reload when no mission is waiting for a retry), a shotgun pickup with
  ammo boxes, and a **sniper rifle** in the old-town plaza (5 rounds,
  one high-damage shot with a long cooldown — press **X** to scope in
  for a 2.5x zoom). Ammo boxes restock all three weapons. Q cycles
  through every weapon you own. Every shot has recoil that kicks the camera and the
  crosshair, and the crosshair sways with your movement. A hit marker
  flashes on a solid hit. Shooting a cop car adds a star. When your
  health drops to 10, **last stand** kicks in: time slows to half speed
  for 3 seconds.
- **Missions** — six jobs that chain automatically. Timed legs pay a
  **+$150 fast-finish bonus** when you beat them with 30+ seconds to
  spare, and a clean getaway at full health pays **+$50**. Fail a job and
  the retry pays **half**. A thin timer bar under the countdown shows
  the time left at a glance.
- **HUD & minimap** — money (with a rolling cash ticker on payouts),
  health, stamina, wanted stars, heat-cooling bar, speedometer, mission
  timer (with a draining timer bar), objective line, a **damage-direction arrow** that points at
  whatever just hurt you, a **radio station chip** while the car radio
  is on, an **FPS counter**, and a live minimap with mission, police,
  roadblock, helicopter, pickup, bus, taxi, boat and sniper blips plus the heat arc
  (a one-line legend under the map says what each colour means).
  N cycles the minimap zoom (whole city → ×2 → ×4 around you). Below 30
  health a red vignette pulses at the edges of the screen.
- **Photo mode** — press **P** to freeze time and orbit the camera freely
  around the scene. Press P again to resume. Press **O** for the **drone
  camera** instead: a high bird's-eye orbit while the world keeps
  running — press O again to drop back behind the player.
- **Audio** — synthesized, no audio files: engine hum, two-tone siren,
  gunshots, mission jingle, cash-register cha-ching on payout, radio
  blips, ambient music (M toggles it), footsteps, and the drift screech.
  The **car radio (Y)** cycles three procedural stations — synthwave,
  late jazz, and news — and a dissonant **wanted sting** plays whenever
  the stars go up. A low **ambient city layer** (looped street rumble
  plus a distant siren or car horn every 18–30 s) keeps the city alive
  even when nothing is happening on screen, and every vehicle has its
  own engine note.
- **Settings** — pause (Esc) for a settings panel: volume slider, mute-all
  checkbox, ambient-music toggle, camera framing selector (close / normal
  / far / cinematic / topdown), invert-mouse-Y, mouse sensitivity
  (0.5×–2×), rain toggle, dusk toggle, minimap size, and a Restart
  Mission button. Key bindings are remappable and persist in localStorage.
- **Payout streaks** — finish jobs at full health and the streak chip
  counts them up (🔥 N clean jobs in a row); a bust or a failed job resets
  it. A payout flashes the screen green, a hard hit flashes it red, and
  the wanted stars pop larger the moment the heat changes — so the
  consequences of a job read on screen, not just in the numbers.

### Stage 9 systems

- **Fuel + reserve tank** — every car has a 100-unit main tank and an
  8-unit reserve. The throttle drinks fuel (nitro twice as fast); under
  20 the low-fuel warning fires once. When the main tank runs dry the
  car switches to reserve — limp mode gets slower (12% top speed) and
  the reserve sips at 60% burn, so you get one last crawl to the pump.
  Run the reserve dry too and the car stalls dead: no forward, no
  reverse, get out and walk. Refuel at the gas station lot ($1 per 5
  units, main tank first then the reserve). `Vehicle.fuelState()` reads
  the state for the HUD fuel chip: `ok` / `low` / `reserve` / `empty`.
- **Pursuit state machine + K9** — every cruiser runs an explicit
  per-cruiser state machine (pursue → search → leave → disabled) instead
  of one chase rule for all cars. Heat is a data table per star: max
  cruisers, top speed, spawn interval, and which toys are allowed
  (PIT, roadblock, helicopter, SWAT, spike strips, backup). A cruiser
  that loses sight searches your last-seen spot instead of beelining
  forever. At 2+ stars a **K9 unit** joins on foot — it chases you
  down the sidewalk and gives up the moment you get in a car.
- **Data-driven districts** — the city is a `DISTRICTS` registry: nine
  districts (old-town, pier, airport, stadium, campus, two construction
  sites with spinning cranes, two multi-storey car parks) plus a gas
  station district with canopy, pumps, kiosk and price board. Adding a
  district is one registry row, not a new code path.
- **HUD panel pipeline** — the HUD is fifteen panels, one `_panel*`
  function per element, each wrapped so one bad panel cannot kill the
  whole HUD. Panels are data where they can be: blips come from a
  `BLIP_DEFS` table (mission, four weapon pickups, boat, bus, taxi).
- **Synth radio stations** — the car radio is data: three `STATIONS`
  (synthwave, jazz, news) with bpm, root, scale, patterns and waveforms
  driving one step sequencer, and every vehicle has an `ENGINE_PROFILES`
  entry (bike, van, pickup, sports, coupe, convertible, boat). The
  one-shot library covers explosion, splash, tyre burst, pickup,
  reload, door slam, heli wash and mission fail.
- **Camera director** — five framing presets (close, normal, far,
  cinematic, topdown) with their own fov, blend and shake tolerance,
  run through one update pipeline: solver → sweep → pull-out-of-
  buildings → lamp dodge → trauma shake (amplitude is trauma²) →
  damp → lookAt → roll. Photo mode and the drone camera are one owner
  (`setMode`), and nitro kicks the FOV for a rush of speed.
- **Vehicle physics as data** — handling is a spec table per vehicle
  (mass, grip, brake, drift, steer rate) driving a velocity-vector
  drift/slip model: drifting feeds lateral slip, grip bleeds it off,
  and steering bites less while sliding. Damage runs in four stages
  (speed caps + stage-3 steering wobble), spike strips shred tyres
  for 6 seconds, and sand drags top speed to 60%.

## The six missions

The jobs chain automatically — each starts when the last one ends, and a
failed job can be retried with R (at half pay).

1. **First Wheels** — $250. Steal the yellow coupe downtown and drive it
   to the marker.
2. **Package Run** — $500. Pick up the sealed package on foot and deliver
   it while the heat is forced to 2 stars.
3. **Heat Escape** — $750. Lose a 3-star wanted level.
4. **Getaway Driver** — $1,000. Pick up a passenger, then 90 seconds to
   the harbor. Beat the clock with 30+ seconds to spare for +$150.
5. **Harbor Heist** — $1,500. Grab the yacht papers on the marina pier on
   foot, then 120 seconds to the hideout in the north-west corner while
   the heat is forced to 2 stars.
6. **Airport Getaway** — $2,000. Grab the flight manifest at the control
   tower on the west margin, then 150 seconds across the whole map to the
   buyer waiting on the yacht — while the heat is forced to 2 stars.

**Bonuses:** finish any job at full health for +$50 clean getaway; beat a
timed leg with 30+ seconds left for +$150 fast finish. Both stack and show
as their own line on the mission summary screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive in a car |
| Shift / double-tap W | Sprint (drains stamina) · Shift again mid-sprint: sprint burst |
| Shift (driving) | Nitro boost (limited by the nitro meter) |
| Space | Handbrake (drift) in a car · jump on foot |
| E | Enter / exit car · grab package / passenger / yacht papers |
| F | Take weapon / ammo |
| Q | Switch weapon (cycles pistol → shotgun → sniper → SMG) |
| G | Dive roll (slips under traffic, 15 stamina) |
| X | Sniper scope (2.5x zoom, while holding the rifle) |
| O | Drone camera (high bird's-eye orbit, world keeps running) |
| Click | Shoot |
| R | Reload pistol (when no mission is failed) · retry mission (when one is) |
| H | Help panel on foot · car horn while driving |
| C | Crouch (heat cools 2× faster out of sight) |
| V | Melee shove (knocks a pedestrian back) |
| T | Hail a taxi ($20 ride to the mission marker) |
| Y | Car radio (synthwave → jazz → news) |
| P | Photo mode (freezes time, free-orbit camera) |
| B | Convertible roof up / down |
| U | Rain toggle |
| I | Day / dusk toggle |
| N | Cycle minimap zoom (×1 → ×2 → ×4) |
| M | Toggle music |
| Drag mouse | Look around |
| Esc | Pause (settings + restart mission) |
| Gamepad | Left stick move / drive, A enter, B exit, X weapon, Y radio, Start pause |

## Camera & photo mode

The camera is a director, not a fixed follow-cam. Five framings —
**close, normal, far, cinematic, topdown** — each with its own distance,
pitch, height, field of view and shake tolerance; switch them from the
pause settings (or cycle with the camera control). **P** freezes time and
opens photo mode: drag to orbit the frozen shot, scroll to zoom, P again
to resume. **O** opens the drone camera instead — a slow high orbit while
the world keeps running underneath, press O again to drop back behind
Raka. Impacts feed a trauma-based shake model (amplitude is trauma², so
small bumps whisper and big hits wail), nitro widens the FOV for a rush
of speed, and at speed the camera leans forward along your direction of
travel so the road ahead stays in frame. The camera pulls itself out of
buildings and slides sideways off lamp posts instead of clipping through
them, and drifts lean the horizon into the slide.

## Gamepad

A standard-mapping gamepad works end to end — no setup. Left stick moves
and drives, right stick orbits the camera (also in photo mode), **A**
enters a car and shoots, **B** exits, **X** takes a weapon, **Y** cycles
the radio, **LB / RB** switch weapons, **LT** is the brake, **RT** is
analog nitro, **Start** pauses and **Back** opens help. Sticks are
dead-zoned (0.18) and response-curved (left stick squared, right stick
linear) so a worn pad does not drift, and triggers read analog — half
throttle is half the pull. On a hard hit the pad rumbles (dual-rumble,
when the pad has an actuator). Every binding is a row in one data table,
so the help panel, the settings screen and the binding summary all read
the same source of truth — rebind a key once and every screen agrees.

## Settings

Pause (Esc) for the settings panel: volume slider, mute-all checkbox,
ambient-music toggle, camera framing selector, invert-mouse-Y, mouse
sensitivity (0.5×–2×), rain toggle, dusk toggle, minimap size, and a
Restart Mission button. Key bindings are remappable from the same panel
and persist in localStorage, so a player's layout survives a reload.

## How to run

Open `game/index.html` in a desktop browser (Chrome recommended). That is
it — there is no build step and no server needed.

To build the graded bundle locally:

```bash
node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory
(`$MAKEFUN_OUTPUT_DIR`, default `./output`) and writes
`/output/dossier.json` via the kit's `buildDossier` from
`vendor/makefun-game.ts`. Before copying, it validates that the four
screenshots exist and are each at most 256 KiB, that each one is a real
PNG or JPEG with long side ≤ 1280 and short side ≥ 480, and that every
game file the page needs (`index.html`, the vendored engine, all 13
system modules) exists, is non-empty, and is actually referenced by
`index.html`. After the build it enforces the gate caps outright (game/
≤ 993 files / 48 MiB, dossier ≤ 1.5 MiB), checks the dossier lists the
four screenshots in the validated order, and prints a build summary
(files + bytes copied, dossier size).

## Screenshots

Four renders, all taken from the live game:

1. `shot1-chase.png` — a 3-star chase with police cruisers, roadblock
   warning, and the HEAT COOLING bar.
2. `shot2-drive.png` — cruising the bay in the yellow coupe.
3. `shot3-mission.png` — on foot at the mission beacon.
4. `shot4-menu.jpg` — the title screen.

## Layout

```
main.ts                  entrypoint: validates screenshots, copies game/ +
                         screenshots/ to /output, writes dossier.json
vendor/makefun-game.ts   kit dossier builder (unchanged)
game/
  index.html             title / pause / settings / HUD / help screens
  vendor/three.min.js    Three.js r160 (vendored)
  js/
    main.js              boot, game loop, minimap, demo modes, photo/radio/taxi,
                         drone camera, FPS counter
    world.js             city, roads, buildings, park, harbor, neon,
                         Old Town, pier + ferris wheel, dusk + rain, airport
    player.js            Raka: movement, sprint, burst, jump, crouch, swim,
                         dive roll
    vehicle.js           cars, physics, drift, damage model, nitro, roof,
                         motorcycle, drivable boat, flat tyres, fuel +
                         reserve tank (fuelState for the HUD)
    camera.js            chase / orbit camera, framing presets, trauma shake,
                         FOV kick, look-ahead, lamp-post dodge, photo mode,
                         drone camera, cinematic intro sweep
    traffic.js           traffic cars, lane-changing AI, taxi, bus,
                         pedestrians, jaywalkers, emergency vehicles
    police.js            wanted level, cruisers, PIT, helicopter, roadblocks,
                         spike strips, SWAT van
    missions.js          six jobs, timers, fast bonus, half-pay retry
    combat.js            pistol / shotgun / sniper / SMG, recoil, shove, last-stand slow-mo
    hud.js               panel pipeline: money ticker / health / stars /
                         heat arc / damage arrow / minimap blips / radio chip /
                         timer bar / minimap legend / objective distance /
                         payout streak / screen flash
    audio.js             synth engine: per-vehicle engine notes, siren loop,
                         screech, cha-ching, data-driven radio stations,
                         ambient city noise, wanted sting, one-shot library
    input.js             keyboard / mouse / gamepad, BINDING_DEFS data table,
                         remappable keys, dead zones + response curves,
                         triggers, rumble, double-tap sprint
    utils.js             math + seeded RNG helpers
screenshots/             the four shots the dossier shows
```

## Demos

Append a query to `game/index.html` to jump straight into a scene:

- `?demo=foot` — on foot downtown
- `?demo=drive` — behind the wheel of the coupe
- `?demo=chase` — wanted 3, two cruisers on your tail
- `?demo=mission` — mission 1 active, on foot

## License

MIT. See [LICENSE](LICENSE).
