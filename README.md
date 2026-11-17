# SOLMARIS BAY — Open World Crime

![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game that runs entirely in your browser: a sun-soaked
bayside city, cars you can steal and drive, cops who chase and set up
roadblocks, and four jobs that chain into one story. No install, no network
at runtime — everything is vendored under `game/`.

## The story

Raka is a courier who owes the Bay Street crew $50,000. The crew does not
want the money in one payment — they want it in four jobs, and they want it
tonight. A stolen coupe, a sealed package, a three-star chase, and one last
getaway across the whole bay. The city is open. The cops are not patient.

## The city

Solmaris Bay is a 600×600 metre coastal town on a 7×7 road grid: a downtown
of towers and neon (HOTEL, 24H TACOS, BAR, CINEMA, PIZZA, GYM, CASINO,
NIGHTCLUB), a park with benches, trees and a fountain, a harbor and marina
on the east edge, and a beach and sea to the south. Traffic drives the grid,
a bus loops the outer ring, pedestrians walk the sidewalks, palms and lamps
line the streets, and rooftop billboards spell out CASINO, HOTEL and
SOLMARIS BAY over the tallest roofs.

## Systems

- **On foot** — WASD movement, sprint with Shift or a double-tap of W
  (stamina drains while sprinting, recovers when you walk or rest), jump
  with Space (landing kicks up a small dust puff), camera orbit with the
  mouse.
- **Driving** — three stealable cars (yellow coupe downtown, red sports car
  east, white van by the park), each with its own speed and handling. E to
  get in and out, Space as a handbrake for drifts (tyre screech follows
  drift intensity, skid marks stay on the asphalt), H to honk — nearby
  pedestrians step aside. Headlights light the road ahead. Damage smoke
  appears as the car takes hits.
- **Wanted / heat** — 0 to 5 stars. The cops see a crime and the stars rise;
  cruisers spawn, chase and ram you. Break line of sight and the HEAT
  COOLING bar fills until a star drops. At 3 stars the cops throw up
  roadblocks. At 4 stars they call backup — two more cruisers at once, up
  to four on the road. Get boxed in slow at 2+ stars and you are BUSTED:
  the cops take $150 and drop you downtown.
- **Traffic & pedestrians** — ten traffic cars obey traffic lights and stop
  (and honk) when you block them; twelve pedestrians walk the sidewalks,
  flee gunfire and cars, and can be knocked down (which costs you a star).
  The bus stops longer at the park corner — five seconds instead of three.
- **Combat** — a pistol pickup downtown (12 rounds, click to shoot, R to
  reload when no mission is waiting for a retry) and a shotgun pickup with
  ammo boxes. A hit marker flashes on a solid hit. Shooting a cop car
  adds a star.
- **HUD & minimap** — money, health, stamina, wanted stars, heat-cooling
  bar, speedometer, mission timer, objective line, and a live minimap with
  mission, police, roadblock, pickup and bus blips. N cycles the minimap
  zoom (whole city → ×2 → ×4 around you). Below 30 health a red vignette
  pulses at the edges of the screen.
- **Audio** — synthesized, no audio files: engine hum, two-tone siren,
  gunshots, mission jingle, cash-register cha-ching on payout, radio
  blips, ambient music (M toggles it), footsteps, and the drift screech.

## The four missions

The jobs chain automatically — each starts when the last one ends, and a
failed job can be retried with R.

1. **First Wheels** — $250. Steal the yellow coupe downtown and drive it
   to the marker.
2. **Package Run** — $500. Pick up the sealed package on foot and deliver
   it while the heat is forced to 2 stars.
3. **Heat Escape** — $750. Lose a 3-star wanted level.
4. **Getaway Driver** — $1,000. Drive the whole bay, outrun the chase, and
   finish clean.

**Clean getaway:** finish any job at full health and the crew pays a
+$50 bonus, shown as its own line on the mission summary screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive in a car |
| Shift / double-tap W | Sprint (drains stamina) |
| Space | Handbrake (drift) in a car · jump on foot |
| E | Enter / exit car · grab package / passenger |
| F | Take weapon / ammo |
| Q | Switch weapon |
| Click | Shoot |
| R | Reload pistol (when no mission is failed) · retry mission (when one is) |
| H | Help panel on foot · car horn while driving |
| N | Cycle minimap zoom (×1 → ×2 → ×4) |
| M | Toggle music |
| Drag mouse | Look around |
| Esc | Pause |

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
`vendor/makefun-game.ts`.

## Screenshots

Four renders, all taken from the live game:

1. `shot1-chase.png` — a 3-star chase with police cruisers, roadblock
   warning, and the HEAT COOLING bar.
2. `shot2-drive.png` — cruising the bay in the yellow coupe.
3. `shot3-mission.png` — on foot at the mission beacon.
4. `shot4-menu.jpg` — the title screen.

## Layout

```
main.ts                  entrypoint: copies game/ + screenshots/ to /output
vendor/makefun-game.ts   kit dossier builder (unchanged)
game/
  index.html             title / pause / HUD / help screens
  vendor/three.min.js    Three.js r160 (vendored)
  js/
    main.js              boot, game loop, minimap, demo modes
    world.js             city, roads, buildings, park, harbor, neon
    player.js            Raka: movement, sprint, jump, stamina
    vehicle.js           cars, physics, drift, headlights, horn
    camera.js            chase / orbit camera, lamp-post dodge
    traffic.js           traffic cars, bus, pedestrians
    police.js            wanted level, cruisers, roadblocks, backup
    missions.js          four jobs, payout, clean-getaway bonus
    combat.js            pistol / shotgun, reload, hit marker
    hud.js               money / health / stars / minimap blips
    audio.js             synth: engine, siren, screech, cha-ching
    input.js             keyboard / mouse, double-tap sprint
    utils.js             math + random helpers
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
