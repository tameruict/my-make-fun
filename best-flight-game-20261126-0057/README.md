# Ridgeline Patrol

A vanilla Canvas 2D flight game for the **best-flight-game-20261126-0057** bounty.
Fly the Kestrel K-7 bush patrol aircraft between volcanic island runways, supply
rings, ridge survey checkpoints and rescue pickups over the Ember Caldera,
Palm Shoal, Ridge Crest and Lagoon Atoll archipelago.

Everything is procedural: no image files, no audio files, no libraries, no network
requests. The sky and terrain render into a 640x360 offscreen canvas and scale up;
the aircraft, rings, runway, particles and HUD draw at full 1280x720 resolution on top.

## Screenshots

| File | Query | Scene |
| --- | --- | --- |
| `1-patrol-flight.jpg` | `?shot=patrol&seed=7` | Mid-sortie cruise over Ember Caldera with the supply ring ahead |
| `2-ridge-survey.jpg` | `?shot=survey&seed=11` | Ridge Survey along Ridge Crest with passed and active rings |
| `3-rescue-approach.jpg` | `?shot=rescue&seed=19` | Rescue final approach to the Lagoon Atoll short runway |
| `4-sortie-end.jpg` | `?shot=end&seed=23` | Sortie complete banner over the parked aircraft on Palm Shoal |

Screenshots are captured at 1280x720 with DPR 1 from real browser renders of the
game's own code. The first file alphabetically is the cover.

## Run locally

```sh
node serve.ts
```

Then open the printed local address in a desktop browser. `serve.ts` is a
development-only static server for `game/`; the game itself is plain static files
and needs no build step.

## Controls

- `W` / `Up` — pitch up
- `S` / `Down` — pitch down
- `A` / `Left` — roll left
- `D` / `Right` — roll right
- `Q` / `E` — rudder left / right
- `Shift` — throttle up
- `Ctrl` — throttle down
- `B` — brakes (ground only)
- `F` — flaps
- `G` — gear indicator (cosmetic)
- `Space` — accept / confirm / start
- `P` / `Esc` — pause
- `M` — mute
- Mouse toward a screen edge — gentle roll / pitch
- Left click — accept / interact

## Missions

1. **Supply Drop** — fly through an orange ring at altitude; reward is fuel.
2. **Ridge Survey** — fly 6 checkpoint rings along a ridge in order before the timer ends.
3. **Rescue Pickup** — land on the short Lagoon Atoll runway, hold for the passenger,
   take off and return to the Palm Shoal base runway.

Missions cycle in three rounds of three with rising difficulty: tighter rings,
shorter timers, stronger crosswind and less starting fuel. A sortie ends after nine
missions, when fuel runs out after a safe landing, or on a crash. Scores earn a
1–3 Star Patrol rating.

## Project layout

```text
game/
  index.html            # canvas, live status region, module entry
  src/
    config.js           # viewport, terrain, speed envelope, HUD layout, palette
    random.js           # seeded mulberry32 and value noise
    terrain.js          # island heightfield, runways, target rings
    aircraft.js         # arcade 3DOF flight model, stall, damage, fuel
    missions.js         # mission types, spawning, objectives, scoring
    camera.js           # chase camera and world-to-screen projection
    hud.js              # pills, gauges, compass, brief, bars, warnings, banner
    audio.js            # WebAudio synthesis
    render.js           # sky, Mode-7 terrain, aircraft, rings, runway, particles
    shots.js            # deterministic staging, autopilot, shot verification
    main.js             # boot, fixed 1/60 s loop, ?shot= dispatcher, input
main.ts                 # hand-in program: copy game/ + screenshots/, verify, dossier
serve.ts                # dev static server on 127.0.0.1:8080
shots.json              # the four screenshot definitions
vendor/makefun-game.ts  # byte-for-byte make.fun dossier library
```

Module imports follow a strict downward dependency order:
`config → random → terrain → aircraft → missions → camera → hud → audio → render → shots → main`.
No module imports a later module, so the dossier load order stays stable.

## Determinism

The simulation runs in fixed 1/60 s steps and takes every random value from the
seeded `createRandom` generator. There is no wall-clock or unseeded randomness in
the simulation or particles, so a seed and a shot reproduce the same frame.
Screenshots are rendered by the real game code through `?shot=<scene>&seed=<seed>`;
the autopilot and final-window staging only issue control inputs, never teleport state.

## Hand-in

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` cleans the destination, copies `game/` and `screenshots/`, runs the
authored `verifyRidgelinePatrolDeliverables` pre-flight check, then writes
`dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## Badges

_This section is left for the coordinator: add the three live make.fun SVG badges
for the repository at submission time. Do not invent a repository URL here._
