# Lunar Magic / Overworld / Layer1–Layer2 Key Findings

**Date:** 2026-07-21  
**Scope:** Consolidated discoveries from `lmlevelinfo/` export-parity work, regarding LM, and JIT.Trans overworld coordinate detection.  
**Ground truth for level images:** Lunar Magic **File → Export Level as Image**, not in-game SNES PPU output.

Cross-links:

- [`LM_EXPORT_LEVEL_IMAGE_SPEC.md`](LM_EXPORT_LEVEL_IMAGE_SPEC.md) — authoritative Export Level as Image contract  
- [`LM_ROM_LEVEL_GRAPHICS_ANALYSIS.md`](LM_ROM_LEVEL_GRAPHICS_ANALYSIS.md) — address anchors  
- [`lmlevelinfo/test/README.md`](../../lmlevelinfo/test/README.md) — fixture gates (akogare / quickieworld / Acidtapes)  
- `lib/jit-levels/jit-trans.js` — overworld LevelNumberMap → tile coords  
- [`devdocs/KEY_FINDINGS_OW_COORDS_L1_SCORING_LVNO_2026-07.md`](../../devdocs/KEY_FINDINGS_OW_COORDS_L1_SCORING_LVNO_2026-07.md) — post-mortem: mistakes, AGSMWH/Invictus coord lessons, scoring, *lvno 

Confidence: **C** confirmed (dump / gate / decompilation); **P** probable; **H** heuristic / incomplete.

---

## 1. How Lunar Magic thinks about levels (vs SNES)

### 1.1 Export is the editor compositor (**C**)

LM export does **not** run a separate SNES render path. It:

1. Opens the level (`OpenLevel@00474c50` → GFX + Map16 expand).  
2. Forces 1:1 zoom and suppresses interactive viewport side-effects.  
3. Strip-renders the editor viewport in **16px** bands into an RGB DIB, then writes BMP/PNG.

Implication for `level_visual`: match **editor Map16 expand → GFX slots → compose**, not gameplay scroll/priority quirks unless LM export itself shows them.

### 1.2 Stage contract (prove each stage before full-image compare) (**C**)

| Stage | Artifact |
|-------|----------|
| Pointers | L1 / L2 / sprite SNES24 + headerless PC |
| Object stream | Primary header + objects through `0xFF` |
| Map16 grid | `0x3800` cells (u16 id + attrs); empty fill `0x0025` |
| GFX slots | 8 FG/BG × `0x1000` (+ SP / Layer3 as loaded) |
| Bypass | 16×u16 Super GFX bypass |
| Palette | Back color + 256 SNES15→RGB |
| Tiles / image | Exact 16×16 then full PPM vs LM export |

Tooling: `lm_pipeline_dump`, `level_visual --lm-tile-ref=…`.

### 1.3 Geometry rules that repeatedly bit us (**C**)

- Canvas screens = `length_low5 + 1` (or 32). **Do not** widen from secondary `LMExp_Horizontal` / `shc_c`.  
- Horizontal export height is always **27** tile rows (432px) even when `Vertical_Scroll_Set=1`.  
- Vertical levels transpose axes; per-screen rows may be 32 when VScroll is set.  
- Cell capacity **`0x3800`**; horizontal cell index uses LM stride `16 * tiles_h`.  
- Acidtapes **vertical** LM refs are often **side-by-side** strips; export remaps stacked strips to match.

---

## 2. Layer1 findings

### 2.1 Object → Map16 expand (**C**)

LM path:

```text
InitializeTileMappingSystem → clear 0x3800 / fill 0x0025
  → ParseObjectDataBuffer → ProcessTileMappingData (obj_id → SetTileMapping*)
```

Our parity path: `lm_level_expand` then `lm_export_compose` (not emit-on-the-fly as correctness).

### 2.2 Direct Map16 objects `0x27` / `0x29` (**C**)

| Variant | Meaning | Emit rule (shared) |
|---------|---------|---------------------|
| 0 | Single / axis repeat | H=0 or W=0 → repeat same Map16 along that axis (nibble = length−1) |
| 1 | Unstretched multi | Page layout: +1 X, +0x10 Y from base |
| 2 | Stretched | `(W+1)×(H+1)` grid; Map16 ids advance **row-major** `base+xx+yy*(W+1)` |
| 3 / 4 | Multi-screen / conditional | Fill rect with one id; conditional true-branch may `base+1` for static export |

Stale comments that said “mode 2 places the same Map16” are wrong; gates expect advancing ids (e.g. `03BC..03C9`).

### 2.3 FG Map16 resolution (**C** / **P**)

- Prefer Callisto/LM **`FG_pages`** text oracle when present (`map16_load_fg_oracles`).  
- File `AllMap16.map16` and ROM vanilla pages remain fallbacks; several correctness bugs were “oracle vs raw” mismatches.  
- **Brown brick / GFX07 hole:** locals `0x12–0x15` → **GFX15** when GFX15 exists and bypass ≠ GFX07 (scoped; not a full-page GFX07→15 swap).  
- **Berry:** do not force GFX33 for bare `0x0106`; Convert-Berry `0x0045` uses GFX17 plane promotion / cement-oracle rules.  
- **Lava FG `04C–04F`:** route to **GFX25** locals (not GFX33) on the FG/oracle path.  
- **Pipes:** export uses normal-pipe tile sets by screen; FG “viewing pipe” tint must not override. Stretched shaft mid-tiles draw as first body pair art.  
- **Muncher / coin / midway / note / ?-block:** GFX33 export-frame freeze; muncher phase is **opposite** coin/midway at some ticks (`(T>>2)&1` bases `0x13C` / `0x138`).

### 2.4 Special-tile transparency (**C**)

Palette-0 (and some CGRAM-black) holes in special tiles must **reveal Layer2**, not prefilled back color — required for L1+L2 parity.

### 2.5 Locked L1 exact gates (regression locks, not per-hack branches) (**C**)

| Suite | Levels / notes |
|-------|----------------|
| Akogare | `0x109` L1+gridlines, `--export-anim-frame=5` → **0** mism |
| QuickieWorld | `0x103`/`105`/`107`/`108` L1 gates → **0** |
| Acidtapes | `0x018`, `0x094`, `0x115`, `0x119` → **0** |

Full Acidtapes L1 suite (90 levels) still has large residuals outside those locks.

### 2.6 Fingerprints / “empty” levels (**C**, product)

Level originality fingerprints use expanded Layer1 Map16 (`v2:` 16-bit tiles, 16×27 screens). Empty levels score as `0`, not fake `100`.

---

## 3. Layer2 findings (editor export)

### 3.1 Two Layer2 data kinds (**C**)

`$0EF310` flags `bbBBVFCT`:

- BG tilemap when **`V` (bit 3)** or **`C` (bit 1)** is set.  
- Bit **`T` (bit 0)** is **not** a BG-tilemap signal (legacy; treating it as one caused wrong type detection).

Otherwise Layer2 is an **object stream** (same Direct Map16 family as Layer1).

### 3.2 Filler / empty Layer2 pointers (**C**)

Some levels (Acidtapes `0x094` / `0x106`) point at ROM padding that LC-RLE1-decompresses to **0 bytes** (`FF 00 FF 00…` signature). Re-parsing that as objects produced a spurious 1-object seam. Correct rule: treat Layer2 as **fully empty**.

### 3.3 BG tilemap Map16 bank (**C**)

| Rule | Detail |
|------|--------|
| Id space | BG cells are **`0x8000+n`**; ROM words store only low `n`; expand ORs `0x8000` |
| Source grid | Independent **`32 × h2`** (h2 = 27 or 32 from low-byte stream length 864 / 1024) |
| Lookup | Prefer `resources/all_map16/global_pages/BG_pages`; else flat file with **`+21`** BG offset |
| Palette | Absolute CGRAM rows (`sub.pal & 7`); **no** `bg_palette_row` remap |
| Wrap | Horizontal wrap every **32** tiles for BG-tilemap L2 only (object L2 does not) |
| Half layout | LC-RLE1 low (and optional high) bytes: left 16 columns then right 16 |

### 3.4 BG CHR routing (**C** / **P**)

- CHR `≥ 0x100`: page into BG1/BG2/BG3 via `(chr-0x100)>>7`.  
- Fixed low-CHR shared mappings (examples): `070–073` / `04C`/`04E` → GFX33; `0FA` → GFX11; `0FD` → GFX04; `0FF` → GFX10 (page `0x81+` / non–editor-pool).  
- **Vanilla BG page `0x80` (`0x8000..0x80FF`):** `BG_pages` CHRs are **editor-pool tokens**, not direct SNES buffer indices. Remap into level **BG1** (typically GFX0C) as 2×2 locals `base` / `+1` / `+0x10` / `+0x11`, **without** FG corner-swap. Token table still incomplete (**P** / open).  
- Pages `0x81+`: FG-style corner swap on `BG_pages` words; do **not** re-derive local via `gfx_local_tile_index`.  
- ExAnim CHR lookup can override before fixed maps (`lm_exanim_lookup_chr`).

### 3.5 32-row (`bg_h=32`) BG levels (**P** / open)

`low_len==1024` → 32×32 BG. LM export canvas for horizontal levels stays 27 rows tall; we blit the top 27 of 32. Acidtapes `0x013` / `027` / `023` / `105` / `112` remain mostly wrong (~11k mism) after partial page-`0x80` remap (~2.5k exact on `0x013`). Likely still missing: fuller editor-pool table and/or half-screen addressing / ExAnim / Conditional Direct Map16 interaction — **no per-hack branches**.

### 3.6 Locked L2 / L1+L2 gates (**C**)

**L2 exact:** `00E`, `019`, `01A`, `01C`, `020`, `094`, `106`, `110`, `111`, `114`, `115`.  
**L1+L2 exact:** `094`, `115`.

Near-miss: object L2 `0x001` ~80 mism (middle row of stretched Direct Map16 `09C0` block — FG oracle vs LM art still under investigation). Shared ~365-object L2 streams (`002`–`005` / `12F`) still large.

---

## 4. Overworld findings

### 4.1 LM overworld editor vs level editor (**C**)

- OW window open (`OpenOverworldEditorWindow@00527880`) ≠ ROM tilemap loader.  
- Reload path clears buffers, grid **`0xA8 × 0xA0`**, then ROM init / mapping / sprites.  
- OW tile blit uses Map16-like words (pal `>>10&7`, flips `0x4000`/`0x8000`), CHR buffer, color 0 → back.  
- Layer3 OW GFX is a separate load path (`0x3900–0x39FF` region notes).  
- **Do not** assume level FG/BG slot tables apply unchanged to overworld.

### 4.2 LevelNumberMap / JIT.Trans (**C**)

Purpose: map **translevel → (submap, tile_x, tile_y)** for Detected Levels and playlevel patches (`3lvno` / `4lvno` / `5lvno`).

Critical rules:

1. **Detect LM hijack in pure JS** (`$04D807` / `$04D803` / `$04D808`, plus older bank-before-LDX and optional `$8A` XOR trampoline). Do **not** spawn asar for detection.  
2. When a hijack/stub is present, **never** fall back to the vanilla `$0CF7DF` Layer1 tilemap scan — that invents wrong coords (e.g. Invictus THE BRIDGE).  
3. Decompress LevelNumberMap (LZ2 then LZ3). Classic blob: **`0x800` levels + `0x800` exit paths** at `$7ED000` / `$7ED800`; larger sizes encode up to **7** submaps.  
4. Parse **only the level-number half**; skip byte 0 of each entry as appropriate.  
5. Index tiles with SMW **`OW_TilePos_Calc` ($049885)** — four 16×16 screen quadrants inside each 0x400 submap block — **not** linear `y*32+x`.  
   - Example: AGSMWH level 015 → `(6,1)`; Invictus 006 → `(6,2)`.  
6. Primary tile among duplicates: min `(submap, y, x)`, preferring positions whose Layer1 OW tile is in **`$56–$80`** (level tiles) when Layer1 is available.  
7. True vanilla ROMs still use the `$0CF7DF` scan.

### 4.3 Playlevel / OW relocation patches (**C**, product)

| Patch | Behavior |
|-------|----------|
| `2lvno` | Force target level entry |
| `3lvno` | + relocate OW player onto detected tile at `$05DCDD` entry hook |
| `4lvno` | + early relocate at OW load `$00A126` before instant-retry snapshots; auto-enter |
| `5lvno` | `4lvno` + warp to vanilla end credits when clear `$0DD5` is 1–4 on OW load |

Coords come from `gamestages.submapid/tile_x/tile_y` via `ow_have/ow_submap/ow_x/ow_y` (must be computed for extrapatch build, including Level Patch Test paths).

---

## 5. Map16 / GFX infrastructure lessons

1. **Shared LM rules only** — fixtures are regression locks; no Acidtapes-/akogare-only correctness branches.  
2. **FG_pages / BG_pages oracles** next to `AllMap16.map16` are first-class inputs for export parity.  
3. Linking: any binary that includes `gfx_route.c` must also link **`lm_exanim.c`** (`map16-parity`, `gfx_chr_probe` fixed 2026-07-19).  
4. Prefer sequential `make -j1` / one `level_visual` at a time for batch scoring (avoid process storms).  
5. Heuristic kill-list (must not remain as long-term correctness): silent vanilla GFX fallback, “try both” routes, per-hack tile remaps, speculative page-80 tables without a general rule.

---

## 6. Open work (as of 2026-07-21)

| Area | Status |
|------|--------|
| Acidtapes full 90× L1 exact | Incomplete (4 hard gates) |
| Acidtapes full 90× L2 exact | Incomplete (11 hard gates); page-`0x80` / 32-row BG dominant |
| Acidtapes 90× L1+L2 | Incomplete (2 hard gates) |
| Page-`0x80` editor-pool token table | Partial (~2.5k tiles recovered on `0x013`) |
| Object L2 `0x001` ~80 mism | Open |
| Shared object L2 streams | Open |
| Layer3 / full ExAnim timeline / sprite overlay exact | Deferred beyond export-frame freeze |
| OW `InitializeTileFromROM_000` source address dump | Still on RE backlog |

---

## 7. Practical commands

```bash
# Level image parity (always enode.sh for project node scripts; C tools use make)
cd lmlevelinfo && make -j1 level_visual levelinfo_tests

./level_visual ROM LEVEL --map16=… --graphics-dir=… --layers=layer1|layer2|layer1+layer2 \
  --export-gridlines --export-anim-frame=N --no-map16-synth-vanilla \
  --export-ppm=out.ppm --lm-tile-ref=lm_ref.ppm

./lm_pipeline_dump ROM LEVEL --stage=map16-grid --layers=layer2 --out=/tmp/dump

# Overworld coords
./enode.sh tests/test_jit_trans.js
```

---

## 8. Document history

| Date | Note |
|------|------|
| 2026-07-21 | Initial consolidation: OW LevelNumberMap/`OW_TilePos`, Layer1 Direct Map16 + GFX33/oracle rules, Layer2 BG bank/`0EF310`/page-80 editor pool, locked Acidtapes/ako/qw gates |
