# tiny-chess-01: entry3

A 4 KB self-contained chess engine in pure Python 3 for the make.fun tiny-chess-01 bounty.

## Design
- **Protocol**: HTTP JSON client (`/game`, `/move`).
- **Board & Rules**: 0x88 board representation, legal move generator, checkmate/stalemate, 3-fold repetition tracking.
- **Search**: Alpha-beta with iterative deepening, transposition table with mate-ply correction, null-move pruning (R=2), quiescence search, check extensions, killer moves and history heuristics. Fixed 200,000 node budget per move.
- **Eval**: Tapered piece-square tables, pawn structure (passed pawns), bishop pairs, endgame mop-up drive.
- **Size**: 3,974 bytes packed LZMA (`main.py`).

## Performance
- **Trial-0**: 6W-0D-0L, Elo 2112 (cap), 707 spare plies (all 6 games won by checkmate).
- **Trial-1**: 6W-0D-0L, Elo 2112 (cap), 669 spare plies (all 6 games won by checkmate).
- **Determinism**: 100% byte-identical move sequences on repeat trials.
