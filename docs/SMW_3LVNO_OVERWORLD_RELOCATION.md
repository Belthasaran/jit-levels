# 3lvno - Overworld Relocation Playlevel Patch

## Summary

`3lvno` is a playlevel asar patch that does everything `2lvno` does (force entry
into a specific level no matter where the player stands on the overworld) **and**,
when the stage's overworld tile coordinates are known, relocates the overworld
player onto that level's tile and submap.

This fixes the `2lvno` shortcoming where the player is left on whatever tile they
were standing on: after a forced level the player would exit to the wrong tile and
midways/checkpoints behaved oddly. With `3lvno`, exiting returns Mario to the
correct tile and re-entry after a midway resumes naturally through vanilla logic
(no faked `$1EA2`/`$13CF` flags).

When coordinates are absent or invalid the patch assembles **identically to
`2lvno`** (the relocation code is compiled out), so it is always a safe drop-in.

## Architecture

The overworld coordinates are already detected and stored by the host - no new ROM
decoding happens at patch time. The flow is:

1. **Source of truth**: `gamestages.submapid`, `gamestages.tile_x`, `gamestages.tile_y`
   (TEXT integer columns; see `electron/sql/migrations/038_rhdata_gamestages_tile_coords.sql`).
   These are populated by the level-detection tooling / "Detected Levels" workflow.
2. **Derivation**: `lib/ow-stage-params.js` `buildOverworldParams(stage)` converts a
   gamestages row into patch params:
   - valid coords -> `{ ow_have:'1', ow_submap, ow_x, ow_y }` (decimal strings)
   - missing/out-of-range -> `{ ow_have:'0', ow_submap:'0', ow_x:'0', ow_y:'0' }`
   Validity: submap 0-6, tile_x 0-31, tile_y 0-31.
3. **Threading into the build**: `ow_*` are build-time **computed** inputs (like
   `mtdispatch_*`), so they are filled into `globalParams` rather than entered on the
   Apply tab. They reach every build path:
   - **Central (authoritative)**: `electron/game-stager.js` `buildPlusPatchedGame()`
     detects when a selected patch references `ow_*` (`patchObjectsNeedOverworldParams`)
     and, when the caller didn't already provide `ow_have`, looks up the stage by
     `gameId` + (hex) level number (`findStageCoordsForLevel`, version-aware) and
     merges `buildOverworldParams(stage)`. This covers the **level-test button**
     (`stage-test-launch.ts` → `extra-patches:build-plus`), which only passes
     `glevelnum`, as well as run staging and autotest.
   - The run-staging `isStageEntry` path and `lib/stage-autotest/build-stage-rom.js`
     also pass the params explicitly (the central fill is a no-op when `ow_have` is
     already present).

   > Historical bug (fixed): the level-test path passed only `glevelnum`, so the
   > placeholders were never substituted and asar failed with
   > `(Einvalid_number) ... [if {ow_have}]`. The central fill above resolves this.
4. **Substitution**: game-stager's asar apply replaces `{ow_have}` / `{ow_submap}` /
   `{ow_x}` / `{ow_y}` / `{level_number}` placeholders in `template_text` using the
   patch's `parameter_mappings` (resolved from `globalParams`), then runs asar. The
   `ow_*` inputs are whitelisted as computed inputs in `AdvancedPatchModal.vue`
   (`VALID_INPUT_PARAMS` + `COMPUTED_INPUT_PARAMS`) so the Parameter Mappings editor
   accepts them, and are skipped by the patch-code-string (cache key) builder.
5. **DB registration**: `jstools/register_3lvno_patch.js` upserts the `extrapatches`
   row (`patch_code='3lvno'`, `patch_type='asar'`, `template_text` = `extrapatches/3lvno.asm`,
   `parameter_mappings` below). Select per stage with
   `gamestages.playlevel_patch_code='3lvno'` (stager defaults to `2lvno`).

## Parameter mapping

```json
{
  "level_number": { "input": "glevelnum_s" },
  "ow_have":      { "input": "ow_have" },
  "ow_submap":    { "input": "ow_submap" },
  "ow_x":         { "input": "ow_x" },
  "ow_y":         { "input": "ow_y" }
}
```

`level_number` mirrors `2lvno`: the template writes `!val = ${level_number}` so the
substituted result is a hex literal (e.g. `$106`). The `ow_*` values are injected as
**decimal** literals (no `$`).

## Coordinate semantics

- `submapid`: 0=main, 1=Yoshi's Island, 2=Vanilla Dome, 3=Forest of Illusion,
  4=Valley of Bowser, 5=Special, 6=Star. Matches `$1F11`.
- `tile_x` / `tile_y`: tile units 0-31, matching runtime `$1F1F` / `$1F21` **with no
  offset**. The SMW overworld position format derives directly from `$1F11`, `$1F1F`,
  `$1F21` (or `$1F17`/`$1F19`), so values read from the LevelNumberMap / `$7ED000`
  index map 1:1 to these addresses.

## ASM design (`extrapatches/3lvno.asm`)

Kept from `2lvno`:
- Intro/timer skip pokes (`$9CB1`, `$00A09C`), SA-1 detection (`sa1rom` + `!addr`).
- `GetTargetLevel` hook at `$05D89B` and `OverrideLevel` hook at `$05DCDD` which force
  `$13BF` (and `$0F` for extended levels). These guarantee the correct level loads and
  serve as the not-found fallback.

Added relocation, inside `OverrideLevel`, guarded by assembly-time `if !ow_have`:
- `$1F11`, `$1F12`, `$13C3` <- submap (8-bit).
- `$1F1F`/`$1F23` (Mario/Luigi X tile) and `$1F21`/`$1F25` (Y tile), 16-bit.
- `$1F17`/`$1F1B` (Mario/Luigi X pixel) and `$1F19`/`$1F1D` (Y pixel) = tile*`$10`+`$08` (tile center), 16-bit.

### Why hook `$05DCDD` (level entry) rather than the overworld load

`$05DCDD` fires on **every** overworld->level entry. Setting the overworld position
there is robust and avoids fragile OW-load timing:

- **First entry**: the player may enter from the "wrong" tile, but `2lvno` forcing
  still loads the correct level. The relocation writes the target position during this
  entry.
- **Exit / death**: the vanilla overworld load (game mode `$0C`) reads the now-correct
  `$1F11`/`$1F1F`/`$1F21`, brings up the right submap, and places Mario on the target
  tile. From here everything self-corrects.
- **Re-entry after a midway**: the player is now on the correct tile in the correct
  submap, so `$7ED000` indexes the right translevel and the midway flag (`$1EA2`,
  written for the forced translevel) resumes the checkpoint naturally.

Because the values only need to be in place before the next overworld load, the exact
moment of writing is not timing-critical, which is why no new overworld-load hijack is
required.

## Tests

`tests/test_3lvno_ow_relocation.js` (npm `test:3lvno-ow`, in `test:ci`):
- `buildOverworldParams` present/zero/invalid cases.
- asar assembly of the rendered template for present / absent / low-level coords
  (asserts the present-coords ROM differs from the absent-coords ROM).
- `register_3lvno_patch.js` upsert (flag inheritance from `2lvno`, idempotency,
  parameter_mappings).

Manual emulator verification (not unit-tested) is still recommended: placement per
submap, exit position, and checkpoint re-entry after touching a midway.

## Coordinate detection: fixes and verification

`3lvno` consumes the coordinates stored in `gamestages` (produced by the JIT.Trans
detector, `lib/jit-levels/jit-trans.js`, and its Python sibling
`lmlevelnames/findtranslevels/find_translevels.py`). Verifying detection against
real Lunar-Magic-edited fixtures (`lmlevelinfo/test/<hack>/`, which ship Callisto
`.mwl` exports as ground truth) surfaced and fixed several issues:

1. **LevelNumberMap never decoded (critical).** `readLevelNumberMap` read
   `lcLz2Decompress(...).data`, but the decompressor returns `.bytes`. The compressed
   LM map therefore always came back `undefined`, so detection silently fell back to
   the vanilla sequential tilemap scan and produced wrong positions (and never any
   submap > 1). Fixed to use `.bytes`.
2. **Submap scan cap.** The LevelNumberMap loop was bounded at `TILES_PER_SUBMAP * 2`
   (2048 = submaps 0-1). Extended to all 7 submaps (`LEVELNUMBERMAP_MAX = 1024 * 7`),
   bounded by the decompressed length. Within each 0x400 block, X/Y use SMW
   `OW_TilePos_Calc` (16×16 quadrants), **not** linear `y*32+x` — see
   `devdocs/KEY_FINDINGS_OW_COORDS_L1_SCORING_LVNO_2026-07.md`.
3. **asar resolution.** `runOverworldTablesAsm` invoked bare `asar`, which may be
   missing or the wrong tool (e.g. the electron-builder `asar`) - another silent
   vanilla fallback. Now resolved via `lib/binary-finder.findAsar()` with a PATH
   fallback.

Verification (e.g. QuickieWorld `lmlevelinfo/test/quickieworld/QuickieWorld_v1.12.sfc`):
the decompressed map is 4096 bytes (4 submaps), and the level cluster `0x101-0x110`
is correctly located on submap 1 (level `0x101` at tile 23,11), matching the `.mwl`
ground truth. Regression coverage: synthetic all-7-submap decode plus the
fixture-guarded test in `tests/test_jit_trans.js` (skips when the ROM/asar are absent).

`mwl` files exist for every level in a hack (including sublevels/secondary exits that
are not overworld tiles), so the `.mwl` set is a superset of overworld-placed levels;
levels with no OW tile (e.g. high secondary-entrance IDs) are correctly absent from
detection. The Python decompressor returns bytes directly, so it did not share the
JS `.data`/`.bytes` bug.

Remaining minor accuracy notes (low impact, not blocking): translevel `0` (empty-tile
filler) is reported as level `000`, and a few sparse entries in higher submap blocks
may correspond to vanilla (unexported) tiles. These do not affect `gamestages` stages,
and the "Detected Levels" admin review is the final gate.

The "Detected Levels" merge (`lib/jit-levels/merge-levels.js` -> `orchestrator.js` ->
IPC INSERT/UPDATE in `electron/ipc-handlers.js`) carries `submapid`/`tile_x`/`tile_y`
into `gamestages`, and admin edits round-trip. Stages without populated/valid
coordinates simply fall back to `2lvno` behavior (`ow_have=0`).
