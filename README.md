# SOLMARIS BAY — Open World Crime

![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game that runs entirely in your browser: a sun-soaked
bayside city, cars you can steal and drive, cops who chase, PIT you and call
in a helicopter, and five jobs that chain into one story. No install, no
network at runtime — everything is vendored under `game/`.

## The story

Raka is a courier who owes the Bay Street crew $50,000. The crew does not
want the money in one payment — they want it in five jobs, and they want it
tonight. A stolen coupe, a sealed package, a three-star chase, one last
getaway across the whole bay, and a yacht heist at the marina. The city is
open. The cops are not patient.

## The city

Solmaris Bay is a 600×600 metre coastal town on a 7×7 road grid: a downtown
of towers and neon (HOTEL, 24H TACOS, BAR, CINEMA, PIZZA, GYM, CASINO,
NIGHTCLUB), a park with benches, trees and a fountain, a harbor and marina
on the east edge, a beach and sea to the south, and two newer districts —
**Old Town** in the north-west corner (narrow streets, arched facades, a
stone plaza with a statue) and a **second beach with a long pier and a
ferris wheel** on the harbor. Traffic drives the grid, a bus loops the
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
  sea and swim — slow paddle, and you cannot drown. Camera orbit with the
  mouse.
- **Driving** — four stealable cars (yellow coupe downtown, red sports car
  east, white van by the park, pink convertible by the beach), each with
  its own speed and handling. E to get in and out, Space as a handbrake
  for drifts (tyre screech follows drift intensity, skid marks stay on
  the asphalt), H to honk — nearby pedestrians step aside. **Shift** is
  nitro while driving (limited by the nitro meter, which refills off the
  throttle). **B** folds the convertible's roof down and back up.
  Headlights light the road ahead. The damage model shows smoke under 40
  HP, fire under 25 HP, and an explosion + $200 repair bill at 0 HP, after
  which the car respawns at its parking spot.
- **Wanted / heat** — 0 to 5 stars. The cops see a crime and the stars
  rise; cruisers spawn, chase and ram you. At 2+ stars a cruiser can **PIT
  maneuver** you — steer into your rear quarter and spin the car. Break
  line of sight and the HEAT COOLING bar fills until a star drops (the
  minimap's red heat arc fills with the wanted level, and a blue inner
  arc shows the cooling progress). At 3 stars the cops throw up
  roadblocks — blast through one at speed for a **+$100 "Broke the
  line"** bonus. At 4 stars they call backup (up to four cruisers at
  once) and a **police helicopter** circles overhead, its searchlight
  tracking you. Get boxed in slow at 2+ stars and you are BUSTED: the
  cops take $150 and drop you downtown.
- **Traffic & pedestrians** — traffic cars obey traffic lights, stop (and
  honk) when you block them, brake for jaywalkers, and **change lanes to
  overtake** slow cars. A yellow **taxi** cruises the grid — press **T**
  near it to hail a ride to the current mission marker for $20. Twelve
  pedestrians walk the sidewalks, flee gunfire and cars, jaywalk at
  crosswalks, and can be knocked down (which costs you a star and a $20
  hospital fine if you run one over). The bus stops longer at the park
  corner — five seconds instead of three.
- **Combat** — a pistol pickup downtown (12 rounds, click to shoot, R to
  reload when no mission is waiting for a retry) and a shotgun pickup with
  ammo boxes. Every shot has recoil that kicks the camera and the
  crosshair, and the crosshair sways with your movement. A hit marker
  flashes on a solid hit. Shooting a cop car adds a star. When your
  health drops to 10, **last stand** kicks in: time slows to half speed
  for 3 seconds.
- **Missions** — five jobs that chain automatically. Timed legs pay a
  **+$150 fast-finish bonus** when you beat them with 30+ seconds to
  spare, and a clean getaway at full health pays **+$50**. Fail a job and
  the retry pays **half**.
- **HUD & minimap** — money (with a rolling cash ticker on payouts),
  health, stamina, wanted stars, heat-cooling bar, speedometer, mission
  timer, objective line, a **damage-direction arrow** that points at
  whatever just hurt you, and a live minimap with mission, police,
  roadblock, helicopter, pickup, bus and taxi blips plus the heat arc.
  N cycles the minimap zoom (whole city → ×2 → ×4 around you). Below 30
  health a red vignette pulses at the edges of the screen.
- **Photo mode** — press **P** to freeze time and orbit the camera freely
  around the scene. Press P again to resume.
- **Audio** — synthesized, no audio files: engine hum, two-tone siren,
  gunshots, mission jingle, cash-register cha-ching on payout, radio
  blips, ambient music (M toggles it), footsteps, and the drift screech.
  The **car radio (Y)** cycles three procedural stations — synthwave,
  late jazz, and news — and a dissonant **wanted sting** plays whenever
  the stars go up.
- **Settings** — pause (Esc) for a settings panel: volume slider, rain
  toggle, dusk toggle, minimap size, and a Restart Mission button.

## The five missions

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
| Q | Switch weapon |
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
screenshots exist and are each at most 256 KiB, then prints a build
summary (files + bytes copied, dossier size).

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
    main.js              boot, game loop, minimap, demo modes, photo/radio/taxi
    world.js             city, roads, buildings, park, harbor, neon,
                         Old Town, pier + ferris wheel, dusk + rain
    player.js            Raka: movement, sprint, burst, jump, crouch, swim
    vehicle.js           cars, physics, drift, damage model, nitro, roof
    camera.js            chase / orbit camera, lamp-post dodge, photo mode
    traffic.js           traffic cars, lane-changing AI, taxi, bus,
                         pedestrians, jaywalkers
    police.js            wanted level, cruisers, PIT, helicopter, roadblocks
    missions.js          five jobs, timers, fast bonus, half-pay retry
    combat.js            pistol / shotgun, recoil, shove, last-stand slow-mo
    hud.js               money ticker / health / stars / heat arc /
                         damage arrow / minimap blips
    audio.js             synth: engine, siren, screech, cha-ching, radio
    input.js             keyboard / mouse / gamepad, remappable keys table
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
