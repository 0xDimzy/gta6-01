# Solmaris Bay — Open World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xDimzy/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D open-world crime game in the spirit of GTA 6, playable in a desktop browser from static files with no network request. Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

## The story

Raka is a courier who owes the Bay Street crew **$50,000**. Four jobs stand between him and a clean slate — a stolen coupe, a sealed package, a three-star chase, and one last getaway across the whole bay. The city is open. The cops are not patient.

## The city

Solmaris Bay is a sun-soaked coastal city, 600×600 units, built in Three.js:

- A 7×7 road grid with a coastal road, sidewalks, street lamps and hydrants
- ~60 buildings with procedural window facades, rooftop AC units, antennas and glowing neon signs (HOTEL, 24H TACOS, BAR, CINEMA…)
- A harbor / marina district on the east edge — inlet water, wooden piers, three boats
- A park block with grass, a pond, benches and palm trees, plus a beach and sea to the south
- A city bus looping the outer ring road, stopping at four corners
- Traffic lights at two intersections that the traffic actually obeys

## Systems

- **On foot and by car** — Raka walks, sprints (stamina bar, lean-into-turns animation, footstep sounds) and drives three stealable cars: the yellow coupe downtown, a red sports car in the east, and a slow white van by the park. Each handles differently; handbraking at speed lays skid marks, and a car under 40 HP pours smoke.
- **Traffic and pedestrians** — 8 traffic cars that brake for you and for each other, 12 pedestrians who stroll the sidewalks, flee from gunshots and speeding cars, and get knocked down if you run them over.
- **Wanted level 0–5 stars** — stealing a car, hitting a pedestrian, shooting, or speeding past a cruiser draws heat. Cruisers chase, ram, and bust you on foot or when you are boxed in. At 3 stars the cops throw up roadblocks across the road ahead. Break line of sight and the heat-cooling bar above the stars fills — one star drops when it is full. Hiding on the beach or off-road cools off twice as fast.
- **Missions (4, auto-chaining)** — each with a story line, a 3D beacon pillar, a HUD objective and a minimap blip:
  1. **First Wheels** ($250) — steal a car, drive to the yellow marker.
  2. **Package Run** ($500) — grab the package on foot, deliver it while wanted level 2 is forced on you.
  3. **Heat Escape** ($750) — lose a 3-star wanted level.
  4. **Getaway Driver** ($1,000) — pick up a passenger and drive them across the map in 90 seconds.
  Failed jobs (busted, wrecked, out of time) can be retried with R.
- **Combat** — a pistol downtown (12 rounds) and a shotgun by the park (6 shells, 5-pellet spread). Ammo boxes respawn every 20 seconds. Shooting draws heat and scares pedestrians; tracers, muzzle flash, hit sparks and camera shake included.
- **HUD and minimap** — money, health, stamina, wanted stars with a heat-cooling bar, a speedometer with a needle, a getaway countdown timer, story subtitles, toasts, a mission-complete summary card, a BUSTED screen, and a live minimap with mission, police, roadblock, pickup, ammo and bus blips.
- **Audio (all synthesized, no files)** — engine hum that follows speed, a two-tone siren loop, gunshots and a shotgun boom, an ambient synth-pad music loop (M toggles), tire screech, police radio blips, footsteps and a mission-complete jingle.
- **Camera** — third-person follow with mouse orbit, chase cam behind the car, a cinematic pan over the city on the title screen, and impact shake on collisions and gunshots.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move & drive |
| Shift | Sprint (drains stamina) |
| E | Enter / exit car · grab package / passenger |
| Space | Handbrake (drift) |
| F | Take weapon / ammo |
| Q | Switch weapon |
| Click | Shoot |
| R | Retry a failed mission |
| Drag mouse | Look around |
| H | Help panel |
| M | Music on / off |
| Esc | Pause |

## How to run

Serve it locally with `node serve.ts`, then open http://localhost:8080. No network request is made at runtime — everything (including Three.js) is vendored under `game/`.

## How it is built

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library. The game itself is plain static files under `game/`: `index.html` plus one clear job per file in `game/js/` (`utils`, `input`, `audio`, `world`, `player`, `vehicle`, `camera`, `traffic`, `police`, `missions`, `combat`, `hud`, `main`).

## Screenshots

Four real renders are in `screenshots/` (first by name is the cover): a police chase with three wanted stars, a mission beacon on foot, city driving, and the title screen over the bay.
