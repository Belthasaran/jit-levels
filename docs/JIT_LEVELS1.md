# JITLevels1 — Just-In-Time Level Detection

## Overview

When the **Detected Levels** dialog opens in Game Stages edit mode, the app builds a patched SFC and runs on-demand analyzers in `lib/jit-levels/`, merging results with existing DB sources (`lmlevels`, `detect`, `trans`, `levelnames`).

## Source tags

| Tag | Module | Description |
|-----|--------|-------------|
| `jitnames` | `jit-names.js` | Level names from LM hijack table; vanilla names excluded |
| `jitnames2` | `jit-names2.js` | MT-compat level name reader (`mtcompat-levelreader.js`); vanilla names excluded |
| `jitmt` | `jit-mt.js` | MT-compat inclusion set (pipe/vanilla-name rules); sets `mtIncluded`, `mtIsPipe`, `mtIsVanillaName` |
| `jitow` | `jit-ow.js` | Overworld placement scan (STAR RLE + translevel opcodes) |
| `jittrans` | `jit-trans.js` | Overworld tile coords from LM LevelNumberMap (preferred) or vanilla Layer1 tilemap scan |

## Overworld coordinates (`jittrans`)

Tile columns in Detected Levels / `gamestages` match runtime RAM:

| Field | Meaning | RAM |
|-------|---------|-----|
| `submapid` | Submap 0–6 | `$1F11` |
| `tile_x` / `tile_y` | Tile units 0–31 | `$1F1F` / `$1F21` |
| (pixels) | tile × 16 | `$1F17` / `$1F19` — **not** stored; 3lvno derives them |

**LM hacks (3000+):** detect hijack in pure JS (`read1($04D807)==$A9`, pointer from `$04D803`/`$04D808`), decompress LevelNumberMap (`lcLz2Decompress`), parse all 7 submaps. **Never** fall back to the vanilla sequential tilemap scan when the hijack is present (that produces wrong X/Y and a `tile_value`). If decode fails → warning + blank coords (`trans_source: unavailable`).

**True vanilla ROMs** (hijack absent): scan Layer1 at `$0CF7DF` for gfx tiles `$56–$80` (`trans_source: tilemap`, sets `tile_value`).

Primary tile when a translevel appears multiple times: minimum `(submap, tile_y, tile_x)`. Each level exports `trans_source` (`levelnumbermap` \| `tilemap` \| `unavailable`).

Optional local check: `JIT_TRANS_FIXTURE_ROM=/path/to/any.sfc ./enode.sh tests/test_jit_trans.js`

| `jitlmfilter` | `jit-lmfilter.js` | Level IDs from `gameversions.lmlevels`, catalog `lmfilter`, or Calisto/LM363 export |
| `jitlevelinfo` | `levelinfo/` | Full `level_info1` parse — headers, objects, sprites, gfx route |
| `jitscore` | `jit-score/` | Originality, internal similarity, completeness scores |

## Detected Levels UI

`DetectedLevelsDialog.vue` filters and display options:

- **Name reader toggle** — `JITNames` (default) vs `JITNames2` (MT-compat reader). Red ★ when `levelnameJitnames` and `levelnameJitnames2` disagree.
- **Show Sources** — checkboxes per tag; `jitnames2`, `jitmt`, `jitow` default **off**; others default **on**. Preset menu: All / None / DB Only / JIT Only / MT Only.
- **Exclude filters** (default off): PipeKeywords, EndKeywords, MTExclude (hide rows where `mtIncluded !== true`), Exclude-NonLM (active when any row has `lmlevels` or `jitlmfilter`), LowCompleteness (`completeness < 10`), LowOriginality (`originality < 15`; unscored kept).

Merged level fields from MT-compat sources: `levelnameJitnames`, `levelnameJitnames2`, `mtIncluded`, `mtIsPipe`, `mtIsVanillaName`.

## IPC

- `gamestages:run-jit-detection` — build ROM + run pipeline
- Progress events: `gamestages:jit-detection-progress`

## Calisto / LM363 fallback

If LMFilter data is missing, the UI prompts to run Calisto via Wine (Linux). Requires:

- `refmaterial/jitlevels.zip` extracted to temp (`jitlevels/lm363.exe`, Calisto)
- Valid vanilla `smw.sfc` in program data
- Wine installed on Linux

## Fingerprints

- Format: `v2:{hex}` per screen — expanded Layer1 Map16 tile IDs (16-bit), 16×27 tiles per horizontal screen (matches `lm_level_expand`)
- Empty screens/levels emit `empty` (CLI always writes a row; no silent header-only output)
- Corpus: `electron/data/level_fingerprints.txt` (vanilla SMW screens; empty `gameid` column)
- CLI: `./enode.sh jstools/level_fingerprint.js --rom file.sfc [--levels=105,133] [--out fingerprints.txt]`
- Expand path: **in-process JS** (`lib/jit-levels/levelinfo/obj-to-map16.js` + `lm-level-expand.js`). No native binary required for AppImage/portable EXE.
- Parity vs C: `./enode.sh tests/test_jit_map16_expand_parity.js` (spawns `lm_pipeline_dump --fingerprint` when built)

### Scores

| Score | Meaning |
|-------|---------|
| `completeness` | 0 for empty (no standard/extended objects and no sprites); otherwise screens/objects/sprites/exits heuristic. Owns overall emptiness/sparseness. |
| `originality` | Distance vs corpus (`electron/data/level_fingerprints.txt`). Screens with tile density < 5% are ignored. Remaining screens use an interest-weighted average of per-screen best Hamming (`weight = density × invDom × uniqueNorm`), so bare/mono pads cannot dominate. Empty / no qualifying screens → `0`. No corpus → `null` (UI shows `-`). |
| `internalSimilarity` | Same density gate + interest-weighted average vs other levels in the same ROM |

Interest weight: `invDom = 1 − (mostCommonNonzero / nonzero)`; `uniqueNorm = min(1, uniqueNonzero / 32)`. If all weights are 0 after the density gate (mono-tile pads only), falls back to an unweighted mean of those screens.

**Perf:** `scoreLevels` pre-parses fingerprints to `Uint16Array` once, uses early-exit Hamming vs the corpus, and computes all Int scores in one pass (not N full all-vs-all loops). Expand remains cheap; compares no longer re-decode hex on every pair.

### Exclude filters (Detected Levels)

- **LowCompleteness** — hide when `completeness < 10` (empty/stub levels)
- **LowOriginality** — hide when `originality < 15` (near-matches to vanilla/corpus; unscored `null` is kept)

## Parity tests

When `level_info1` or Map16 expand changes, run:

```bash
npm run test:jit-names2
npm run test:jit-mt
npm run test:jit-ow
npm run test:jit-levelinfo-parity
npm run test:jit-map16-expand-parity
```

Compares JS `parseLevelInfo` vs C `level_info1 --json` on akogare `0x109`, and JS Layer1 fingerprints vs `lm_pipeline_dump --fingerprint`.

## Related files

- `lib/jit-levels/mtcompat-levelreader.js` — MT-compat name/inclusion/OW helpers
- `lib/jit-levels/orchestrator.js` — pipeline entry
- `electron/ipc-handlers.js` — IPC handler
- `electron/renderer/src/components/DetectedLevelsDialog.vue` — UI
