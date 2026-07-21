# Key findings: OW coords, Layer1, scoring, and *lvno (2026-07)

**Purpose:** Record mistakes we made while reading SMW / Lunar Magic overworld and level data, and the corrected models. Intended as shared knowledge for future tooling — especially Detect Levels, playlevel patches, and eventually OW / level editors that interoperate with Lunar Magic.

**Companion digest** (export/L1/L2/OW consolidated rules, less “post-mortem”):  
[`lminterop/devdocs/2026-07-21_LM_OVERWORLD_LAYER1_FINDINGS.md`](../lminterop/devdocs/2026-07-21_LM_OVERWORLD_LAYER1_FINDINGS.md)

**Operational docs:** [`JIT_LEVELS1.md`](JIT_LEVELS1.md), [`SMW_3LVNO_OVERWORLD_RELOCATION.md`](SMW_3LVNO_OVERWORLD_RELOCATION.md), [`SMW_4LVNO_EARLY_OW_RELOCATION.md`](SMW_4LVNO_EARLY_OW_RELOCATION.md), [`SMW_5LVNO_CREDITS_ON_CLEAR.md`](SMW_5LVNO_CREDITS_ON_CLEAR.md)

Confidence tags: **C** confirmed · **P** probable · **H** heuristic / incomplete

---

## 1. Mental model: three different “Layer1”s

| Context | What “Layer1” means | Typical address / artifact |
|---------|---------------------|----------------------------|
| **Overworld map tiles** | 8-bit (low) + optional high-byte map for OW Map16-ish tiles in RAM | Low: `$0CF7DF` → `$7EC800`; LM high: compressed → `$7FC800` |
| **Overworld level numbers** | Translevel id per OW tile (not gfx) | `$7ED000` from LM `LevelNumberMap` (LZ2/LZ3) |
| **Level editor Layer1** | Expanded Map16 grid for a *level* (objects → tiles) | In-memory `0x3800` cells; fingerprints / `level_visual` |

Mistake pattern: treating OW `$0CF7DF` like level Map16, or treating LevelNumberMap indexes like a simple 2D array. They share *names* and *tile X/Y units*, not storage layout or meaning.

For OW placement of playable stages, **LevelNumberMap is authoritative** for “which translevel sits at (submap, x, y)”. OW Layer1 `$56–$80` answers “is this cell a *level tile* visually?”, useful as a preference filter — not as a substitute for LNM on LM hacks.

---

## 2. Overworld coordinates — mistakes and fixes

### 2.1 Silent vanilla fallback when LM map failed (**C**)

**Mistake:** JS LZ2 helper returned `.bytes`, but the reader used `.data`. Decompress always looked empty → code fell back to scanning vanilla `$0CF7DF` for gfx tiles `$56–$80`.

**Symptoms:** Wrong X/Y, invented `tile_value`, almost never submap > 1; Invictus “THE BRIDGE” looked like `(24,3)` / tile `87` instead of real OW tile.

**Rule:** If an LM OW decompress stub / LevelNumberMap hijack is present, **never** fall back to the vanilla Layer1 scan. Fail loudly (`trans_source: unavailable`) instead of inventing coords.

### 2.2 Hijack layouts are not one pattern (**C**)

**Mistake:** Assuming every LM ROM used the modern `OverworldTables` shape (`$04D807 == $A9`).

**Reality:**

| Layout | Signature | Example |
|--------|-----------|---------|
| Modern A9 | bank/addr at `$04D803` / `$04D808` | QuickieWorld, AGSMWH |
| Bank-before-LDX | `LDA #bank / STA $8C / LDX #imm / STX $8A` | Invictus |
| XOR trampoline | `$00B8DE` → `LDA $8A / EOR #imm16 / STA $8A` | Invictus `$158E` → effective `$DDB538` |

Detect in pure JS (no asar spawn for detection). Try LZ2 then LZ3.

### 2.3 Classic LNM blob is levels + exit paths (**C**)

**Mistake:** Treating a 0x1000 decompress as “all level numbers” (or as 4 full submaps of levels only).

**Reality:** Classic LM fill is **`0x800` level bytes (`$7ED000`) + `0x800` exit-path bytes (`$7ED800`)**. Parsing the second half as translevels invents garbage placements. Expanded OW can be larger (up to 7 × 0x400 level regions); still separate path halves.

Also skip translevel byte **0** (empty filler), not a real stage.

### 2.4 Indexing is `OW_TilePos_Calc`, not `y*32+x` (**C**) — the AGSMWH lesson

**Mistake:** Decoding each 0x400 submap block as linear row-major:

```text
tile_x = idx % 32
tile_y = floor(idx / 32)
```

**Reality:** SMW `OW_TilePos_Calc` (`$049885`) packs **four 16×16 screens** per submap:

```text
index = (x & 0x0F) + ((x & 0x10) << 4) + ((y << 4) & 0xFF) + ((y & 0x10) ? 0x200 : 0)
```

| Byte index | Linear decode (wrong) | SMW / LM tile (correct) |
|------------|----------------------|-------------------------|
| 22 | `(22, 0)` — looks like mid-ocean past useful land | **`(6, 1)`** |
| 38 | `(6, 1)` | **`(6, 2)`** |

**Case study — AGSMWH (game 10059) level 015 “Mole Domain”:**

- ROM LNM already had `$15` at index **22**; OW Layer1 low at the same index was `$66` (level tile).
- Linear decode reported `(22, 0)`. Operators correctly objected: main map X is `0x00–0x1F`, `0x16` is empty ocean, and `(6,1)` is a normal always-visible LM level tile (not event-revealed).
- We briefly hypothesized “event reveal.” That was wrong — the bug was **only** coordinate packing.
- Same packing applies to OW Layer1 low bytes at `$0CF7DF` when correlating “level tile” cells.

**Case study — Invictus 006:** Index 38 → correct **`(6, 2)`**. An earlier “`(6, 1)` verified” claim matched the *buggy* decoder, not LM/runtime. Changelog / older notes that say Invictus `$1F1F/$1F21 = 6,2` were already pointing at the truth.

**UI note:** Lunar Magic’s overworld editor shows tile X/Y in **0–31** (same units as `$1F1F` / `$1F21`). The *storage* index into `$7ED000` is the quadrant formula; do not confuse “screen is 16 tiles wide” with “the map is only 16 wide.”

### 2.5 Primary location among duplicates (**C**)

When a translevel appears more than once: prefer min `(submap, tile_y, tile_x)`, and when OW Layer1 is available prefer cells whose tile is in **`$56–$80`**. Merge Detected Levels should prefer `trans_source: levelnumbermap` over stale DB / vanilla-scan rows.

### 2.6 What we still do not fully model (**H**)

- Silent / Layer1 **event** tile reveals after beats (true event-only tiles) — separate from the AGSMWH false alarm.
- Full OW editor Map16 / Layer2 event tilemaps (`Overworld Tilemaps.asm` tables).
- Expanded OW edge cases beyond classic 2-submap 0x1000 blobs (covered in tests for 7×0x400 layout, less field diversity).

Code: `lib/jit-levels/jit-trans.js` (`owTileToIndex` / `owIndexToTile`). Tests: `./enode.sh tests/test_jit_trans.js`.

---

## 3. Level Layer1 / export — lessons that transfer to editors

These are level-editor Layer1 rules (not OW), but they dominate “interoperate with Lunar Magic” work and scoring inputs.

### 3.1 Ground truth is Export Level as Image (**C**)

Match LM’s **editor compositor** (Map16 expand → GFX slots → strip compose), not a separate SNES PPU path, unless the question is specifically in-game.

### 3.2 Geometry traps (**C**)

- Screens = `length_low5 + 1` (do not invent width from secondary flags).
- Horizontal export height is **27** tile rows (432px) even with some scroll settings.
- Direct Map16 objects `0x27` / `0x29` mode 2 advances Map16 ids **row-major** — stale “same tile” comments were wrong.

### 3.3 Oracles and GFX holes (**C**)

- Prefer Callisto/LM `FG_pages` / `BG_pages` when present.
- Scoped GFX07 “brown brick” locals → GFX15; lava FG → GFX25; muncher/coin/midway GFX33 phase quirks.
- Layer2: `$0EF310` bit **T** is not a BG-tilemap signal; treating it as one misclassified streams.

Detail and gates: companion digest §2–3; `lmlevelinfo/test/README.md`.

---

## 4. JIT.Score — mistakes and product rules

Fingerprints are built from **expanded level Layer1 Map16** (`v2:` 16-bit tiles, 16×27 screens), not OW tiles.

| Mistake | Correction |
|---------|------------|
| Empty / missing levels scoring like “perfect originality” | Empty → **0**; missing corpus → unscored `null` |
| Sparse / mono pad screens tanking Orig | Ignore screens &lt;5% nonzero; weight by density × diversity |
| Fingerprints requiring native expand on AppImage | Port `obj_to_map16` / `lm_level_expand` to JS under `lib/jit-levels/levelinfo/` |
| Slow Detect Levels (“Computing scores…” ~tens of seconds) | Pre-parse to `Uint16Array`, early-exit Hamming, one-pass internal similarity |

Completeness remains the emptiness metric; Orig/internal similarity are similarity-to-corpus metrics. UI excludes LowCompleteness / LowOriginality by default floors (Comp 10 / Orig 15).

Tests: `./enode.sh tests/test_level_fingerprint.js`, `tests/test_jit_map16_expand_parity.js`.

---

## 5. Playlevel *lvno family — coordinate pipeline

| Patch | Role |
|-------|------|
| `2lvno` | Force target level only |
| `3lvno` | + relocate OW player at level-entry hook `$05DCDD` |
| `4lvno` | + ROM start `$009EF0`, relocate at OW load `$00A126`, one-shot auto-enter |
| `5lvno` | `4lvno` + credits on clear |

### 5.1 Host must feed real tile coords (**C**)

Patches do **not** re-decode LevelNumberMap. They consume `gamestages.submapid/tile_x/tile_y` → `ow_have/ow_submap/ow_x/ow_y` (`lib/ow-stage-params.js`). Wrong JIT.Trans coords become wrong Mario placement (e.g. ocean / warp pipe).

### 5.2 Pixel vs tile (**C**)

- `$1F1F` / `$1F21` = tile X/Y (0–31), same as LM / LNM decode.
- `$1F17` / `$1F19` = pixels. Vanilla standing position is **tile×16+8** (center). Writing **tile×16** alone leaves Mario 8px short on each axis (manual AGSMWH check: `$60`/`$10` vs expected `$68`/`$18`).

### 5.3 Build-path gotcha (**C**)

`ow_*` are **computed** extrapatch inputs. Level Patch Test / `extra-patches:build-plus` must fill them centrally (`game-stager.js`); passing only `glevelnum` left `{ow_have}` unsubstituted and broke asar.

### 5.4 When to use which patch (**P**)

- `3lvno`: exit / midway return to correct tile after forced entry.
- `4lvno`+: hacks that snapshot OW position at load / entry (instant-retry) need earlier relocate + optional start-table rewrite.

---

## 6. Working rules for future OW / level editors

1. **Separate pipelines:** OW LevelNumberMap + OW Layer1/high vs level object→Map16 expand. Share only coordinate *units* and Map16 *concepts*.
2. **Always verify indexes with `OW_TilePos_Calc`** against LM status bar X/Y and, when possible, runtime `$1F1F`/`$1F21`.
3. **Never silent-fallback** across LM vs vanilla data sources; record `trans_source` (or equivalent).
4. **Decompress field names matter** (`.bytes` vs `.data`); add a fixture regression when a decompress path is “present but unused.”
5. **Do not invent “event” explanations** until storage index math and hijack pointer are verified against the same ROM the editor has open.
6. **Fingerprints and export parity** consume level Layer1 grids; keep OW detection out of that path.
7. **Playlevel patches are consumers** of stored coords — detection bugs show up as wrong Mario standing spots, not asar syntax errors.

---

## 7. Fixture anchors

| Hack | Check |
|------|--------|
| QuickieWorld | Modern LNM; e.g. level `101` on submap 1 |
| Invictus 1.1 | Bank-before-LDX + XOR; level `006` → `(6,2)` |
| AGSMWH catalog SFC / `JIT_TRANS_AGSMWH_ROM` | Level `015` → `(6,1)` |
| Optional | `JIT_TRANS_FIXTURE_ROM=… ./enode.sh tests/test_jit_trans.js` |

Reference disassembly: `refmaterial/SMWDisC_oldversion.txt` (`OW_TilePos_Calc`), `refmaterial/LMDIS/Overworld Tilemaps.asm`.

---

## 8. Document history

| Date | Note |
|------|------|
| 2026-07-21 | Initial post-mortem: linear vs `OW_TilePos`, LNM halves/hijacks, L1 naming split, score empties/weighting, 3/4/5lvno pixel + param threading |
