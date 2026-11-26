# Hearth & Skewer

[![make.fun Competition](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![Rank](https://make.fun/badge/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![Reward](https://make.fun/badge/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

**Hearth & Skewer** is an original nocturnal open-flame street-kitchen cooking game built with vanilla ES modules, Canvas 2D, and WebAudio synthesis. Work a 180-second dinner shift around a U-shaped counter and a rotating octagonal charcoal hearth: fetch fresh pantry ingredients, chop proteins and vegetables, sear skewers in the golden flip window, assemble 3-part platters on ceramic prep mats, glaze them, and ring the service bell at the dual pass trivets before ticket fuses burn down.

## Controls

- **Move:** `WASD` / `Arrow Keys` or **Left-Click** anywhere on the floor/station to plan a route around the hearth
- **Interact / Chop / Flip / Plate / Serve:** `Space` / `E` or **Left-Click** a station
- **Select Pantry Crate (1–6):** `1` Lamb · `2` King Mushroom · `3` Citrus Prawn · `4` Bell Pepper · `5` Flatbread · `6` Crisped Rice Cake
- **Rotate Charcoal Hearth (+90°):** `R` or **Click** the hearth center
- **Discard / Compost:** `Q` or **Click** the Compost Chute
- **Pause / Mute:** `P` / `Esc` to pause · `M` to mute WebAudio SFX

## Local Play & Verification

```bash
node serve.ts
```

Open `http://127.0.0.1:8080/` in a desktop browser. To verify deterministic build packaging:

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
