# my-make-fun — best entries

Best version of every make.fun bounty entry built in the pipeline (Nov 2026).
Each folder is the exact submitted commit — or, where noted, the best verified
build. Transcripts and bundles are not included.

| Bounty | Prize | Folder | Version | Score / result | Submission |
|---|---|---|---|---|---|
| gta6-01 | — | gta6-01 | V5.2 @ `701cafe` | **Rank 48 / 10,665**, judge win rate 0.993343 | `01a1fdd7-956b-777f-ada3-a03ef105b3d7` |
| token-radar-01 | $1,325 | token-radar-01 | v4 @ `c39ce3f` | Best verified build: LOO 2.924, WF 2.532, check 16/0 — **not submitted**; live entry v3 scored 0.942846 | v3 `01a20953-5292-7192-8627-6336812af9e8` |
| tiny-chess-01 | $500 | tiny-chess-01 | entry3 @ `13621bf` | Best measured: Elo 2112, 6W-0D-0L, spare 707 (trial, reproduced 3×) — **not submitted** (missed deadline); live entry2: Elo 2112, spare 585 | entry2 `01a20b39-ff4e-77f2-8b28-4edb1b52ff28` |
| hidden-spec-cli-01 | $100 | hidden-spec-cli-01 | @ `b36c1b3` | **1000, 100/100** | `01a20b39-90cc-71ee-8947-66181fe1fd05` |
| tiny-stack-vm-01 | $100 | tiny-stack-vm-01 | @ `30be5b0` | **1,000,000 on all 40 instances** | `01a20b39-117f-73d6-a418-190904f61fe0` |
| site-generator-speed-01 | $100 | site-generator-speed-01 | @ `c60403c` | **243.0 ms vs 560.1 ms baseline (0.434×)** | `01a20bc0-f51e-756c-9fe0-ad949aa34dc7` |
| news-image-20261124 | $100 | news-image-20261124 | @ `9e7ad7e` | Broadsheet 1024×1024, blind rounds | `01a20bfd-faec-7189-b4e6-9efa1a51afc0` |
| news-image-20261125 | $100 | news-image-20261125 | @ `f9e5361` | Broadsheet 1024×1024, 35 stories, blind rounds | `01a210c3-4614-76c8-8546-ee9b1b05621a` |
| news-image-20261126 | $100 | news-image-20261126 | @ `08bb022` | Broadsheet 1024×1024, 33 stories, blind rounds | `01a215b1-7754-723f-a646-083fda698368` |
| best-cooking-game-20261125-0137 | $250 | best-cooking-game-20261125-0137 | @ `610ac6f` | "Hearth & Skewer", blind rounds | `01a21153-5248-7071-8242-5409269818c2` |
| best-flight-game-20261126-0057 | $500 | best-flight-game-20261126-0057 | @ `f25a65f` | "Ridgeline Patrol", 4 screenshots, check 15/0, blind rounds | `01a21689-c57e-7471-94b9-791fd472e1b3` |

## Notes

- Games (`gta6-01`, `best-cooking-game-*`, `best-flight-game-*`) are vanilla
  JS + Canvas; open `game/index.html` (or `serve.ts`) to play.
- `token-radar-01` v4 is the strongest build by every local gate (LOO/WF pass
  the top-50 bars); v3 is the version the judge actually scored (0.942846).
- `tiny-chess-01` entry3 beats the live entry2 on spare plies (707 vs 585)
  in the trial harness, but entry2 is the one the judge saw.
- All entries were built and submitted from the Altare sandbox; this repo is
  the public archive of the best versions.
