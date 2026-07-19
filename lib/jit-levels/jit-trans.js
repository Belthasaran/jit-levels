/**
 * JIT.Trans — port of findtranslevels/find_translevels.py (vanilla + LM hijack paths)
 */

const { spawnSync } = require('child_process');
const path = require('path');
const {
  snesToRomOffset,
  translevelToLevel,
  normalizeLevelId,
  readBytes,
} = require('./smw-rom');
const { lcLz2Decompress } = require('./levelinfo/lc-lz2');

const OW_WIDTH = 32;
const TILES_PER_SUBMAP = OW_WIDTH * OW_WIDTH; // 32x32 = 1024 tiles per submap
const OW_SUBMAP_COUNT = 7; // main + Yoshi + Vanilla + Forest + Valley + Special + Star
const LEVELNUMBERMAP_MAX = TILES_PER_SUBMAP * OW_SUBMAP_COUNT; // 7168

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

function runOverworldTablesAsm(romPath, projectRoot) {
  const asmCandidates = [
    path.join(projectRoot, 'lmlevelnames', 'findtranslevels', 'OverworldTables.asm'),
    path.join(projectRoot, 'OverworldTables.asm'),
  ];
  const asmPath = asmCandidates.find((p) => require('fs').existsSync(p));
  if (!asmPath) return {};

  // Resolve a real asar binary; bare 'asar' on PATH may be missing or the wrong
  // tool (e.g. the electron-builder asar), which would make this silently fail
  // and fall back to the vanilla tilemap scan. findAsar validates the binary.
  let asarCmd = process.platform === 'win32' ? 'asar.exe' : 'asar';
  try {
    const { findAsar } = require('../binary-finder');
    const resolved = findAsar({ projectRoot });
    if (resolved) asarCmd = resolved;
  } catch (_e) { /* keep PATH fallback */ }

  const result = spawnSync(asarCmd, ['--no-title-check', asmPath, romPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  return parseOverworldTablesOutput((result.stdout || '') + (result.stderr || ''));
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

function readLevelNumberMap(rom, tables) {
  if (!tables.translevels) return null;
  const snesAddr = parseInt(tables.translevels, 16);
  const romOffset = snesToRomOffset(snesAddr, rom.hasSmcHeader);
  if (romOffset == null || romOffset >= rom.data.length) return null;

  if (tables.translevels_compressed) {
    const compressed = rom.data.subarray(romOffset);
    const result = lcLz2Decompress(compressed, 0x10000);
    return result.ok ? result.bytes : null;
  }

  const maxSize = LEVELNUMBERMAP_MAX;
  return rom.data.subarray(romOffset, Math.min(romOffset + maxSize, rom.data.length));
}

function translevelsToDetectedLevels(translevelPositions) {
  const levels = [];
  for (const [transStr, locations] of Object.entries(translevelPositions)) {
    const translevel = parseInt(transStr, 10);
    if (Number.isNaN(translevel)) continue;
    const levelNum = translevelToLevel(translevel);
    const levelnumber = normalizeLevelId(levelNum);
    const loc = locations[0] || {};
    levels.push({
      levelnumber,
      levelname: null,
      translevel: translevel.toString(16).toUpperCase().padStart(2, '0'),
      submapid: loc.submap != null ? String(loc.submap) : null,
      tile_x: loc.tile_x != null ? String(loc.tile_x) : null,
      tile_y: loc.tile_y != null ? String(loc.tile_y) : null,
      tile_value: loc.tile_value != null ? String(loc.tile_value) : null,
      sources: ['jittrans'],
    });
  }
  return levels;
}

/**
 * @param {object} rom - from createRomFromBuffer
 * @param {string} [romFilePath] - optional path for asar
 * @param {string} [projectRoot]
 */
function extractJitTrans(rom, romFilePath, projectRoot) {
  let translevelPositions = {};

  if (romFilePath && projectRoot) {
    const tables = runOverworldTablesAsm(romFilePath, projectRoot);
    const mapData = readLevelNumberMap(rom, tables);
    if (mapData) {
      translevelPositions = parseLevelNumberMap(mapData);
    }
  }

  if (Object.keys(translevelPositions).length === 0) {
    const tilemap = readLayer1TilemapVanilla(rom);
    const exitPaths = readExitPathTable(rom);
    if (tilemap) {
      translevelPositions = scanVanillaTilemap(tilemap, exitPaths);
    }
  }

  return { levels: translevelsToDetectedLevels(translevelPositions) };
}

module.exports = {
  extractJitTrans,
  scanVanillaTilemap,
  parseLevelNumberMap,
  translevelToLevel,
  parseOverworldTablesOutput,
  OW_WIDTH,
  TILES_PER_SUBMAP,
  OW_SUBMAP_COUNT,
  LEVELNUMBERMAP_MAX,
};
