/**
 * JIT.Trans — overworld translevel → tile coordinates.
 *
 * Lunar Magic hacks: read LevelNumberMap via pure-JS hijack detection.
 * Supports modern OverworldTables layout ($04D807==$A9) and older
 * bank-before-LDX stubs, plus optional $8A XOR trampoline at $00B8DE.
 * Never fall back to the vanilla tilemap scan when an LM hijack/stub is
 * present (wrong coords). True vanilla ROMs still use the $0CF7DF scan.
 */

const {
  snesToRomOffset,
  translevelToLevel,
  normalizeLevelId,
  read1,
} = require('./smw-rom');
const { lcLz2Decompress } = require('./levelinfo/lc-lz2');
const { lcLz3Decompress } = require('./levelinfo/lc-lz3');

const OW_WIDTH = 32;
const TILES_PER_SUBMAP = OW_WIDTH * OW_WIDTH; // 32x32 = 1024 tiles per submap (0x400)
const OW_SUBMAP_COUNT = 7; // main + Yoshi + Vanilla + Forest + Valley + Special + Star
const LEVELNUMBERMAP_MAX = TILES_PER_SUBMAP * OW_SUBMAP_COUNT; // 7168

/**
 * SMW OW_TilePos_Calc ($049885): each 0x400-byte submap is four 16×16 screens,
 * not linear row-major 32×32. Matches $1F1F/$1F21 tile coords.
 *
 * index = (x & 0x0F) + ((x & 0x10) << 4) + ((y << 4) & 0xFF) + ((y & 0x10) ? 0x200 : 0)
 */
function owTileToIndex(tileX, tileY) {
  const x = tileX & 0x1f;
  const y = tileY & 0x1f;
  let pos = (x & 0x0f) + ((x & 0x10) << 4);
  pos += (y << 4) & 0xff;
  if (y & 0x10) pos += 0x200;
  return pos;
}

/** Inverse of owTileToIndex for an index within one 0x400 submap block. */
function owIndexToTile(tileInSubmap) {
  let p = tileInSubmap & 0x3ff;
  let x = 0;
  let y = 0;
  if (p >= 0x200) {
    y += 16;
    p -= 0x200;
  }
  if (p >= 0x100) {
    x += 16;
    p -= 0x100;
  }
  y += (p >> 4) & 0x0f;
  x += p & 0x0f;
  return { tile_x: x, tile_y: y };
}

/** OverworldTables.asm: if read1($04D807) == $A9 → modern LM LevelNumberMap. */
const SNES_TRANS_HIJACK_CHECK = 0x04d807;
const SNES_TRANS_PTR_LOW = 0x04d803; // 16-bit LE address (modern)
const SNES_TRANS_PTR_BANK = 0x04d808; // bank byte (modern)

/** Bank-before-LDX layout (Invictus-style): LDA #bank / STA $8C / LDX #imm / STX $8A */
const SNES_BANK_BEFORE_LDA = 0x04d802; // A9
const SNES_BANK_BEFORE_BANK = 0x04d803; // bank imm
const SNES_BANK_BEFORE_STA = 0x04d804; // 85 8C
const SNES_BANK_BEFORE_LDX = 0x04d806; // A2
const SNES_BANK_BEFORE_PTR = 0x04d807; // LDX imm16 LE
const SNES_BANK_BEFORE_STX = 0x04d809; // 86 8A

const SNES_DECOMP_ENTRY = 0x00b8de; // LM decompress entry (often JSL trampoline)
const SNES_OW_STUB = 0x04d7f9;

/**
 * Read 24-bit little-endian SNES address from ROM.
 * @returns {number|null}
 */
function read3(rom, snesAddr) {
  const b0 = read1(rom, snesAddr);
  const b1 = read1(rom, snesAddr + 1);
  const b2 = read1(rom, snesAddr + 2);
  if (b0 == null || b1 == null || b2 == null) return null;
  return (b2 << 16) | (b1 << 8) | b0;
}

/**
 * Detect LM OW decompress glue near the LevelNumberMap load stub
 * (PHP / PHK / PER $0006 / PEA $804C / JML $00B8DE).
 */
function hasLmOwDecompressStub(rom) {
  // Scan a short window after the common dest setup for the JML $00B8DE sequence.
  for (let snes = SNES_OW_STUB; snes < SNES_OW_STUB + 0x40; snes++) {
    if (read1(rom, snes) !== 0x5c) continue;
    const dest = read3(rom, snes + 1);
    if (dest === SNES_DECOMP_ENTRY) return true;
  }
  return false;
}

/**
 * If $00B8DE is JSL to a routine that does LDA $8A / EOR #imm16 / STA $8A,
 * return the imm16 XOR key; otherwise null.
 *
 * Prefers the canonical LM lock stub at $0DF1A0 (same source as virtual-unlock
 * extractLockKeys) when present; falls back to scanning the JSL target.
 */
function readPointerXorKey(rom) {
  // Canonical protect stub: PHP / REP #$30 / LDA $8A / EOR #imm16 …
  if (read1(rom, 0x0df1a0) === 0x08 && read1(rom, 0x0df1a0 + 5) === 0x49) {
    const lo = read1(rom, 0x0df1a0 + 6);
    const hi = read1(rom, 0x0df1a0 + 7);
    if (lo != null && hi != null) return (hi << 8) | lo;
  }

  if (read1(rom, SNES_DECOMP_ENTRY) !== 0x22) return null; // JSL long
  const dest = read3(rom, SNES_DECOMP_ENTRY + 1);
  if (dest == null) return null;

  // Scan trampoline for LDA $8A … EOR #imm16 … STA $8A
  for (let off = 0; off < 48; off++) {
    const a = dest + off;
    if (read1(rom, a) !== 0xa5 || read1(rom, a + 1) !== 0x8a) continue;
    for (let j = 2; j <= 8; j++) {
      if (read1(rom, a + j) !== 0x49) continue;
      const lo = read1(rom, a + j + 1);
      const hi = read1(rom, a + j + 2);
      if (lo == null || hi == null) return null;
      // Confirm STA $8A soon after
      for (let k = j + 3; k <= j + 8; k++) {
        if (read1(rom, a + k) === 0x85 && read1(rom, a + k + 1) === 0x8a) {
          return (hi << 8) | lo;
        }
      }
    }
  }
  return null;
}

/**
 * Apply optional $8A XOR trampoline to a stored LevelNumberMap pointer.
 */
function applyPointerXor(rom, snesAddr) {
  if (snesAddr == null) return snesAddr;
  const key = readPointerXorKey(rom);
  if (key == null) return snesAddr;
  const bank = (snesAddr >> 16) & 0xff;
  const low = (snesAddr ^ key) & 0xffff;
  return (bank << 16) | low;
}

/**
 * Modern OverworldTables layout: LDA #bank at $04D807.
 * @returns {{ snesAddr: number, layout: string }|null}
 */
function detectModernPointer(rom) {
  if (read1(rom, SNES_TRANS_HIJACK_CHECK) !== 0xa9) return null;
  const lo = read1(rom, SNES_TRANS_PTR_LOW);
  const hi = read1(rom, SNES_TRANS_PTR_LOW + 1);
  const bank = read1(rom, SNES_TRANS_PTR_BANK);
  if (lo == null || hi == null || bank == null) return null;
  return {
    snesAddr: (bank << 16) | (hi << 8) | lo,
    layout: 'modern-a9',
  };
}

/**
 * Bank-before-LDX layout (Invictus): LDA #bank / STA $8C / LDX #ptr / STX $8A.
 * @returns {{ snesAddr: number, layout: string }|null}
 */
function detectBankBeforeLdxPointer(rom) {
  if (read1(rom, SNES_BANK_BEFORE_LDA) !== 0xa9) return null;
  if (read1(rom, SNES_BANK_BEFORE_STA) !== 0x85) return null;
  if (read1(rom, SNES_BANK_BEFORE_STA + 1) !== 0x8c) return null;
  if (read1(rom, SNES_BANK_BEFORE_LDX) !== 0xa2) return null;
  if (read1(rom, SNES_BANK_BEFORE_STX) !== 0x86) return null;
  if (read1(rom, SNES_BANK_BEFORE_STX + 1) !== 0x8a) return null;

  const bank = read1(rom, SNES_BANK_BEFORE_BANK);
  const lo = read1(rom, SNES_BANK_BEFORE_PTR);
  const hi = read1(rom, SNES_BANK_BEFORE_PTR + 1);
  if (lo == null || hi == null || bank == null) return null;
  return {
    snesAddr: (bank << 16) | (hi << 8) | lo,
    layout: 'bank-before-ldx',
  };
}

/**
 * Detect Lunar Magic translevel (LevelNumberMap) hijack from ROM bytes.
 * Does not spawn asar.
 *
 * @param {object} rom - from createRomFromBuffer
 * @returns {{ hijacked: boolean, snesAddr?: number, compressed?: boolean, layout?: string, xorKey?: number|null }}
 */
function detectTranslevelHijack(rom) {
  const modern = detectModernPointer(rom);
  const bankBefore = !modern ? detectBankBeforeLdxPointer(rom) : null;
  const found = modern || bankBefore;

  if (!found) {
    // LM decompress stub without a recognizable pointer → still hijacked
    // (do not vanilla-scan), but no usable address.
    if (hasLmOwDecompressStub(rom)) {
      return { hijacked: true, compressed: true, layout: 'stub-only' };
    }
    return { hijacked: false };
  }

  const xorKey = readPointerXorKey(rom);
  const snesAddr = applyPointerXor(rom, found.snesAddr);
  return {
    hijacked: true,
    snesAddr,
    compressed: true,
    layout: found.layout,
    xorKey,
  };
}

/** @deprecated kept for tests that parse asar OverworldTables output */
function parseOverworldTablesOutput(stdout) {
  const tables = {};
  if (stdout.includes('Translevel hijack is not applied')) {
    tables.translevel_hijacked = false;
  } else if (stdout.includes('Translevels: ')) {
    for (const line of stdout.split('\n')) {
      if (line.includes('Translevels: ')) {
        const addrPart = line.split('Translevels: ')[1].split(/\s+/)[0];
        tables.translevels = addrPart;
        tables.translevel_hijacked = true;
        if (line.includes('(LC_LZ2/3)')) {
          tables.translevels_compressed = true;
        }
        break;
      }
    }
  }
  return tables;
}

function readLayer1TilemapVanilla(rom) {
  const offset = snesToRomOffset(0x0cf7df, rom.hasSmcHeader);
  if (offset + 0x800 > rom.data.length) return null;
  return rom.data.subarray(offset, offset + 0x800);
}

function readExitPathTable(rom) {
  const offset = snesToRomOffset(0x04d678, rom.hasSmcHeader);
  if (offset + 96 > rom.data.length) return null;
  return rom.data.subarray(offset, offset + 96);
}

function scanVanillaTilemap(tilemapData, exitPathData) {
  const translevelPositions = {};
  let translevelCounter = 1;

  for (let tileIdx = 0; tileIdx < Math.min(tilemapData.length, 0x800); tileIdx++) {
    const tileValue = tilemapData[tileIdx];
    if (tileValue < 0x56 || tileValue > 0x80) continue;

    const submap = Math.floor(tileIdx / TILES_PER_SUBMAP);
    const tileInSubmap = tileIdx % TILES_PER_SUBMAP;
    const { tile_x: tileX, tile_y: tileY } = owIndexToTile(tileInSubmap);
    const translevel = translevelCounter;

    if (!translevelPositions[translevel]) {
      translevelPositions[translevel] = [];
    }

    const posInfo = {
      submap,
      tile_x: tileX,
      tile_y: tileY,
      source: 'tilemap',
      tile_value: tileValue,
    };
    if (exitPathData && translevel < exitPathData.length) {
      posInfo.exit_path = exitPathData[translevel];
    }
    translevelPositions[translevel].push(posInfo);

    translevelCounter += 1;
    if (translevelCounter > 96) break;
  }

  return translevelPositions;
}

/** Vanilla / non-expanded: $7ED000 levels (0x800) then $7ED800 paths (0x800). */
const LNM_LEVELS_2_SUBMAPS = 0x800;
/** Expanded OW: 7 × 1024 level tiles. */
const LNM_LEVELS_7_SUBMAPS = LEVELNUMBERMAP_MAX;

/**
 * LM LevelNumberMap LC blob decompresses to $7ED000 as:
 *   [level numbers for N submaps][exit path bytes for N submaps]
 * Classic size 0x1000 → 0x800 levels + 0x800 paths (2 submaps).
 * Only the level-number half must be scanned for translevels.
 *
 * @param {Buffer|Uint8Array} data
 * @returns {number} byte length of the level-number region
 */
function levelNumberMapLevelBytes(data) {
  if (!data || data.length < 2) return 0;
  if (data.length === 0x1000) return LNM_LEVELS_2_SUBMAPS;
  if (data.length === 0x3800) return LNM_LEVELS_7_SUBMAPS; // 7 submaps × 2
  // Heuristic: if the second half is mostly high-bit exit-path bytes, use first half.
  const half = data.length >> 1;
  let nz = 0;
  let high = 0;
  for (let i = half; i < data.length; i++) {
    if (data[i]) nz++;
    if (data[i] >= 0x80) high++;
  }
  if (nz > 0 && high * 2 >= nz) return half;
  return Math.min(data.length, LEVELNUMBERMAP_MAX);
}

/**
 * Layer1 OW tilemap low bytes (vanilla $0CF7DF → $7EC800).
 * Size 0x800 = 2 submaps; matches classic LevelNumberMap level half.
 * @returns {Buffer|null}
 */
function readLayer1TilemapLow(rom) {
  const offset = snesToRomOffset(0x0cf7df, rom.hasSmcHeader);
  if (offset == null || offset < 0) return null;
  const len = Math.min(0x800, rom.data.length - offset);
  if (len < 0x100) return null;
  return rom.data.subarray(offset, offset + len);
}

function isOwLevelTileValue(tileValue) {
  return tileValue >= 0x56 && tileValue <= 0x80;
}

function layer1TileAt(layer1, submap, tileX, tileY) {
  if (!layer1) return null;
  const idx = submap * TILES_PER_SUBMAP + owTileToIndex(tileX, tileY);
  if (idx < 0 || idx >= layer1.length) return null;
  return layer1[idx];
}

function parseLevelNumberMap(data) {
  const translevelPositions = {};
  if (!data || data.length < 2) return translevelPositions;

  const levelLen = levelNumberMapLevelBytes(data);
  // Consecutive 0x400-byte submap blocks; X/Y via OW_TilePos_Calc packing.
  for (let tileIdx = 0; tileIdx < levelLen; tileIdx++) {
    const translevel = data[tileIdx];
    if (translevel === 0 || translevel > 0x5f) continue;

    const submap = Math.floor(tileIdx / TILES_PER_SUBMAP);
    const tileInSubmap = tileIdx % TILES_PER_SUBMAP;
    const { tile_x: tileX, tile_y: tileY } = owIndexToTile(tileInSubmap);

    if (!translevelPositions[translevel]) {
      translevelPositions[translevel] = [];
    }
    translevelPositions[translevel].push({
      submap,
      tile_x: tileX,
      tile_y: tileY,
      source: 'levelnumbermap',
    });
  }
  return translevelPositions;
}

/**
 * Primary OW tile for a translevel: minimum (submap, tile_y, tile_x).
 * When layer1 is provided, prefer positions whose Layer1 tile is a level tile
 * ($56–$80); if none qualify, fall back to all locations.
 */
function pickPrimaryLocation(locations, layer1 = null) {
  if (!locations || !locations.length) return null;
  let pool = locations;
  if (layer1) {
    const onLevelTile = locations.filter((loc) => {
      const t = layer1TileAt(layer1, loc.submap, loc.tile_x, loc.tile_y);
      return t != null && isOwLevelTileValue(t);
    });
    if (onLevelTile.length) pool = onLevelTile;
  }
  let best = pool[0];
  for (let i = 1; i < pool.length; i++) {
    const loc = pool[i];
    if (loc.submap < best.submap) {
      best = loc;
      continue;
    }
    if (loc.submap > best.submap) continue;
    if (loc.tile_y < best.tile_y) {
      best = loc;
      continue;
    }
    if (loc.tile_y > best.tile_y) continue;
    if (loc.tile_x < best.tile_x) best = loc;
  }
  return best;
}

/**
 * Read and decompress LevelNumberMap at a SNES address (LZ2, then LZ3).
 * @returns {Buffer|Uint8Array|null}
 */
function readLevelNumberMapAt(rom, snesAddr, compressed) {
  if (snesAddr == null) return null;
  const romOffset = snesToRomOffset(snesAddr, rom.hasSmcHeader);
  if (romOffset == null || romOffset < 0 || romOffset >= rom.data.length) return null;

  if (compressed) {
    const compressedBytes = rom.data.subarray(romOffset);
    const lz2 = lcLz2Decompress(compressedBytes, 0x10000);
    if (lz2.ok && lz2.bytes && lz2.bytes.length >= 2) return lz2.bytes;
    const lz3 = lcLz3Decompress(compressedBytes, 0x10000);
    if (lz3.ok && lz3.bytes && lz3.bytes.length >= 2) return lz3.bytes;
    return null;
  }

  return rom.data.subarray(romOffset, Math.min(romOffset + LEVELNUMBERMAP_MAX, rom.data.length));
}

/** @deprecated prefer readLevelNumberMapAt + detectTranslevelHijack */
function readLevelNumberMap(rom, tables) {
  if (!tables.translevels) return null;
  const snesAddr = parseInt(tables.translevels, 16);
  return readLevelNumberMapAt(rom, snesAddr, !!tables.translevels_compressed);
}

function translevelsToDetectedLevels(translevelPositions, transSource, layer1 = null) {
  const levels = [];
  for (const [transStr, locations] of Object.entries(translevelPositions)) {
    const translevel = parseInt(transStr, 10);
    if (Number.isNaN(translevel)) continue;
    const levelNum = translevelToLevel(translevel);
    const levelnumber = normalizeLevelId(levelNum);
    const loc = pickPrimaryLocation(locations, layer1) || {};
    const source = loc.source || transSource || null;
    levels.push({
      levelnumber,
      levelname: null,
      translevel: translevel.toString(16).toUpperCase().padStart(2, '0'),
      submapid: loc.submap != null ? String(loc.submap) : null,
      tile_x: loc.tile_x != null ? String(loc.tile_x) : null,
      tile_y: loc.tile_y != null ? String(loc.tile_y) : null,
      tile_value: loc.tile_value != null ? String(loc.tile_value) : null,
      trans_source: source,
      location_count: locations.length,
      sources: ['jittrans'],
    });
  }
  return levels;
}

/**
 * @param {object} rom - from createRomFromBuffer
 * @param {string} [_romFilePath] - unused (kept for API compat); asar not required
 * @param {string} [_projectRoot] - unused
 * @returns {{ levels: object[], warnings: string[], trans_source: string }}
 */
function extractJitTrans(rom, _romFilePath, _projectRoot) {
  const warnings = [];
  const hijack = detectTranslevelHijack(rom);

  if (hijack.hijacked) {
    if (hijack.snesAddr == null) {
      warnings.push(
        'JIT.Trans: Lunar Magic overworld decompress stub is present but LevelNumberMap ' +
          'pointer was not recognized; overworld tile coordinates unavailable ' +
          '(not using vanilla tilemap fallback).'
      );
      return { levels: [], warnings, trans_source: 'unavailable' };
    }
    const mapData = readLevelNumberMapAt(rom, hijack.snesAddr, hijack.compressed);
    if (!mapData || mapData.length < 2) {
      warnings.push(
        'JIT.Trans: Lunar Magic LevelNumberMap hijack is present but decode failed; ' +
          'overworld tile coordinates unavailable (not using vanilla tilemap fallback).'
      );
      return { levels: [], warnings, trans_source: 'unavailable' };
    }
    const positions = parseLevelNumberMap(mapData);
    if (Object.keys(positions).length === 0) {
      warnings.push(
        'JIT.Trans: LevelNumberMap decoded but contained no valid translevels; ' +
          'overworld tile coordinates unavailable.'
      );
      return { levels: [], warnings, trans_source: 'unavailable' };
    }
    const layer1 = readLayer1TilemapLow(rom);
    return {
      levels: translevelsToDetectedLevels(positions, 'levelnumbermap', layer1),
      warnings,
      trans_source: 'levelnumbermap',
    };
  }

  // True vanilla (or non-LM) ROM: sequential Layer1 tilemap scan.
  const tilemap = readLayer1TilemapVanilla(rom);
  const exitPaths = readExitPathTable(rom);
  let positions = {};
  if (tilemap) {
    positions = scanVanillaTilemap(tilemap, exitPaths);
  }
  return {
    levels: translevelsToDetectedLevels(positions, 'tilemap'),
    warnings,
    trans_source: 'tilemap',
  };
}

module.exports = {
  extractJitTrans,
  detectTranslevelHijack,
  detectModernPointer,
  detectBankBeforeLdxPointer,
  readPointerXorKey,
  applyPointerXor,
  hasLmOwDecompressStub,
  scanVanillaTilemap,
  parseLevelNumberMap,
  levelNumberMapLevelBytes,
  pickPrimaryLocation,
  readLayer1TilemapLow,
  isOwLevelTileValue,
  readLevelNumberMapAt,
  readLevelNumberMap,
  translevelToLevel,
  parseOverworldTablesOutput,
  owTileToIndex,
  owIndexToTile,
  OW_WIDTH,
  TILES_PER_SUBMAP,
  OW_SUBMAP_COUNT,
  LEVELNUMBERMAP_MAX,
  LNM_LEVELS_2_SUBMAPS,
  SNES_TRANS_HIJACK_CHECK,
  SNES_TRANS_PTR_LOW,
  SNES_TRANS_PTR_BANK,
  SNES_DECOMP_ENTRY,
};
