/**
 * JIT.Trans — overworld translevel → tile coordinates.
 *
 * Lunar Magic hacks: read LevelNumberMap via pure-JS hijack detection
 * (SNES $04D807/$04D803/$04D808 — same as OverworldTables.asm). Never fall
 * back to the vanilla tilemap scan when the hijack is present (wrong coords).
 * True vanilla ROMs (hijack absent) still use the sequential $0CF7DF scan.
 */

const {
  snesToRomOffset,
  translevelToLevel,
  normalizeLevelId,
  read1,
} = require('./smw-rom');
const { lcLz2Decompress } = require('./levelinfo/lc-lz2');

const OW_WIDTH = 32;
const TILES_PER_SUBMAP = OW_WIDTH * OW_WIDTH; // 32x32 = 1024 tiles per submap
const OW_SUBMAP_COUNT = 7; // main + Yoshi + Vanilla + Forest + Valley + Special + Star
const LEVELNUMBERMAP_MAX = TILES_PER_SUBMAP * OW_SUBMAP_COUNT; // 7168

/** OverworldTables.asm: if read1($04D807) == $A9 → LM LevelNumberMap (LC_LZ2/3). */
const SNES_TRANS_HIJACK_CHECK = 0x04d807;
const SNES_TRANS_PTR_LOW = 0x04d803; // 16-bit LE address
const SNES_TRANS_PTR_BANK = 0x04d808; // bank byte

/**
 * Detect Lunar Magic translevel (LevelNumberMap) hijack from ROM bytes.
 * Does not spawn asar.
 *
 * @param {object} rom - from createRomFromBuffer
 * @returns {{ hijacked: boolean, snesAddr?: number, compressed?: boolean }}
 */
function detectTranslevelHijack(rom) {
  const check = read1(rom, SNES_TRANS_HIJACK_CHECK);
  if (check !== 0xa9) {
    return { hijacked: false };
  }
  const lo = read1(rom, SNES_TRANS_PTR_LOW);
  const hi = read1(rom, SNES_TRANS_PTR_LOW + 1);
  const bank = read1(rom, SNES_TRANS_PTR_BANK);
  if (lo == null || hi == null || bank == null) {
    return { hijacked: false };
  }
  const snesAddr = (bank << 16) | (hi << 8) | lo;
  return {
    hijacked: true,
    snesAddr,
    compressed: true, // LM hijack path is always LC_LZ2/3 per OverworldTables.asm
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
    const tileX = tileInSubmap % OW_WIDTH;
    const tileY = Math.floor(tileInSubmap / OW_WIDTH);
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

function parseLevelNumberMap(data) {
  const translevelPositions = {};
  if (!data || data.length < 2) return translevelPositions;

  // Scan all 7 overworld submaps (main + 6). The decompressed LM LevelNumberMap
  // is laid out as consecutive 1024-tile (32x32) submap blocks, so
  // submap = idx / 1024, tile_x = (idx % 1024) % 32, tile_y = (idx % 1024) / 32.
  for (let tileIdx = 0; tileIdx < Math.min(data.length, LEVELNUMBERMAP_MAX); tileIdx++) {
    const translevel = data[tileIdx];
    if (translevel > 0x5f) continue;

    const submap = Math.floor(tileIdx / TILES_PER_SUBMAP);
    const tileInSubmap = tileIdx % TILES_PER_SUBMAP;
    const tileX = tileInSubmap % OW_WIDTH;
    const tileY = Math.floor(tileInSubmap / OW_WIDTH);

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
 * Stable across hacks; matches first canonical entrance on typical LM layouts.
 */
function pickPrimaryLocation(locations) {
  if (!locations || !locations.length) return null;
  let best = locations[0];
  for (let i = 1; i < locations.length; i++) {
    const loc = locations[i];
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
 * Read and decompress LevelNumberMap at a SNES address.
 * @returns {Buffer|Uint8Array|null}
 */
function readLevelNumberMapAt(rom, snesAddr, compressed) {
  if (snesAddr == null) return null;
  const romOffset = snesToRomOffset(snesAddr, rom.hasSmcHeader);
  if (romOffset == null || romOffset < 0 || romOffset >= rom.data.length) return null;

  if (compressed) {
    const compressedBytes = rom.data.subarray(romOffset);
    const result = lcLz2Decompress(compressedBytes, 0x10000);
    return result.ok ? result.bytes : null;
  }

  return rom.data.subarray(romOffset, Math.min(romOffset + LEVELNUMBERMAP_MAX, rom.data.length));
}

/** @deprecated prefer readLevelNumberMapAt + detectTranslevelHijack */
function readLevelNumberMap(rom, tables) {
  if (!tables.translevels) return null;
  const snesAddr = parseInt(tables.translevels, 16);
  return readLevelNumberMapAt(rom, snesAddr, !!tables.translevels_compressed);
}

function translevelsToDetectedLevels(translevelPositions, transSource) {
  const levels = [];
  for (const [transStr, locations] of Object.entries(translevelPositions)) {
    const translevel = parseInt(transStr, 10);
    if (Number.isNaN(translevel)) continue;
    const levelNum = translevelToLevel(translevel);
    const levelnumber = normalizeLevelId(levelNum);
    const loc = pickPrimaryLocation(locations) || {};
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
    return {
      levels: translevelsToDetectedLevels(positions, 'levelnumbermap'),
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
  scanVanillaTilemap,
  parseLevelNumberMap,
  pickPrimaryLocation,
  readLevelNumberMapAt,
  readLevelNumberMap,
  translevelToLevel,
  parseOverworldTablesOutput,
  OW_WIDTH,
  TILES_PER_SUBMAP,
  OW_SUBMAP_COUNT,
  LEVELNUMBERMAP_MAX,
  SNES_TRANS_HIJACK_CHECK,
  SNES_TRANS_PTR_LOW,
  SNES_TRANS_PTR_BANK,
};
