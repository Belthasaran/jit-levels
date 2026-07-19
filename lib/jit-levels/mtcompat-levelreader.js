'use strict';

/**
 * MT-compat level name reader for JIT detection.
 */

const fs = require('node:fs');

const LEVEL_POINTER_TABLE_ROM_OFFSET = 188928;
const LEVEL_POINTER_TABLE_BYTE_LENGTH = 1536;

const LEGACY_NAME_MARKER = Buffer.from([0x53, 0x54, 0x41, 0x52, 0x1f, 0x07, 0xe0, 0xf8]);
const STARW_MARKER = Buffer.from('STARW', 'ascii');
const STAR_MARKER = Buffer.from('STAR', 'ascii');

const LM_EXTENDED_SLOT_BYTES = 56;
const LM_EXTENDED_SLOT_COUNT = 96;
const LM_EXTENDED_BLOCK_BYTES = LM_EXTENDED_SLOT_BYTES * LM_EXTENDED_SLOT_COUNT;
const LM_EXTENDED_PADDING_CHECKS = 5;

/** 96 vanilla catalog slots: index 0 unused, 1..36 = $01..$24, 37..95 → $101+ */
const LEVEL_CATALOG = [
  {
    "levelId": 0,
    "levelName": ""
  },
  {
    "levelId": 1,
    "levelName": "VANILLA SECRET 2"
  },
  {
    "levelId": 2,
    "levelName": "VANILLA SECRET 3"
  },
  {
    "levelId": 3,
    "levelName": "TOP SECRET AREA"
  },
  {
    "levelId": 4,
    "levelName": "DONUT GHOST HOUSE"
  },
  {
    "levelId": 5,
    "levelName": "DONUT PLAINS 3"
  },
  {
    "levelId": 6,
    "levelName": "DONUT PLAINS 4"
  },
  {
    "levelId": 7,
    "levelName": "#2 MORTON'S CASTLE"
  },
  {
    "levelId": 8,
    "levelName": "GREEN SWITCH PALACE"
  },
  {
    "levelId": 9,
    "levelName": "DONUT PLAINS 2"
  },
  {
    "levelId": 10,
    "levelName": "DONUT SECRET 1"
  },
  {
    "levelId": 11,
    "levelName": "VANILLA FORTRESS"
  },
  {
    "levelId": 12,
    "levelName": "BUTTER BRIDGE 1"
  },
  {
    "levelId": 13,
    "levelName": "BUTTER BRIDGE 2"
  },
  {
    "levelId": 14,
    "levelName": "#4 LUDWIG'S CASTLE"
  },
  {
    "levelId": 15,
    "levelName": "CHEESE BRIDGE AREA"
  },
  {
    "levelId": 16,
    "levelName": "COOKIE MOUNTAIN"
  },
  {
    "levelId": 17,
    "levelName": "SODA LAKE"
  },
  {
    "levelId": 18,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 19,
    "levelName": "DONUT SECRET HOUSE"
  },
  {
    "levelId": 20,
    "levelName": "YELLOW SWITCH PALACE"
  },
  {
    "levelId": 21,
    "levelName": "DONUT PLAINS 1"
  },
  {
    "levelId": 22,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 23,
    "levelName": "#2 MORTON'S PLAINS"
  },
  {
    "levelId": 24,
    "levelName": "SUNKEN GHOST SHIP"
  },
  {
    "levelId": 25,
    "levelName": "#2 MORTON'S PLAINS"
  },
  {
    "levelId": 26,
    "levelName": "#6 WENDY'S CASTLE"
  },
  {
    "levelId": 27,
    "levelName": "CHOCOLATE FORTRESS"
  },
  {
    "levelId": 28,
    "levelName": "CHOCOLATE ISLAND 5"
  },
  {
    "levelId": 29,
    "levelName": "CHOCOLATE ISLAND 4"
  },
  {
    "levelId": 30,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 31,
    "levelName": "FOREST FORTRESS"
  },
  {
    "levelId": 32,
    "levelName": "#5 ROY'S CASTLE"
  },
  {
    "levelId": 33,
    "levelName": "CHOCO-GHOST HOUSE"
  },
  {
    "levelId": 34,
    "levelName": "CHOCOLATE ISLAND 1"
  },
  {
    "levelId": 35,
    "levelName": "CHOCOLATE ISLAND 3"
  },
  {
    "levelId": 36,
    "levelName": "CHOCOLATE ISLAND 2"
  },
  {
    "levelId": 257,
    "levelName": "#1 IGGY'S CASTLE"
  },
  {
    "levelId": 258,
    "levelName": "YOSHI'S ISLAND 4"
  },
  {
    "levelId": 259,
    "levelName": "YOSHI'S ISLAND 3"
  },
  {
    "levelId": 260,
    "levelName": "YOSHI'S HOUSE"
  },
  {
    "levelId": 261,
    "levelName": "YOSHI'S ISLAND 1"
  },
  {
    "levelId": 262,
    "levelName": "YOSHI'S ISLAND 2"
  },
  {
    "levelId": 263,
    "levelName": "VANILLA GHOST HOUSE"
  },
  {
    "levelId": 264,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 265,
    "levelName": "VANILLA SECRET 1"
  },
  {
    "levelId": 266,
    "levelName": "VANILLA DOME 3"
  },
  {
    "levelId": 267,
    "levelName": "DONUT SECRET 2"
  },
  {
    "levelId": 268,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 269,
    "levelName": "FRONT DOOR"
  },
  {
    "levelId": 270,
    "levelName": "BACK DOOR"
  },
  {
    "levelId": 271,
    "levelName": "VALLEY OF BOWSER 4"
  },
  {
    "levelId": 272,
    "levelName": "#7 LARRY'S CASTLE"
  },
  {
    "levelId": 273,
    "levelName": "VALLEY FORTRESS"
  },
  {
    "levelId": 274,
    "levelName": ""
  },
  {
    "levelId": 275,
    "levelName": "VALLEY OF BOWSER 3"
  },
  {
    "levelId": 276,
    "levelName": "VALLEY GHOST HOUSE"
  },
  {
    "levelId": 277,
    "levelName": "VALLEY OF BOWSER 2"
  },
  {
    "levelId": 278,
    "levelName": "VALLEY OF BOWSER 1"
  },
  {
    "levelId": 279,
    "levelName": "CHOCOLATE SECRET"
  },
  {
    "levelId": 280,
    "levelName": "VANILLA DOME 2"
  },
  {
    "levelId": 281,
    "levelName": "VANILLA DOME 4"
  },
  {
    "levelId": 282,
    "levelName": "VANILLA DOME 1"
  },
  {
    "levelId": 283,
    "levelName": "RED SWITCH PALACE"
  },
  {
    "levelId": 284,
    "levelName": "#3 LEMMY'S CASTLE"
  },
  {
    "levelId": 285,
    "levelName": "FOREST GHOST HOUSE"
  },
  {
    "levelId": 286,
    "levelName": "FOREST OF ILLUSION 1"
  },
  {
    "levelId": 287,
    "levelName": "FOREST OF ILLUSION 4"
  },
  {
    "levelId": 288,
    "levelName": "FOREST OF ILLUSION 2"
  },
  {
    "levelId": 289,
    "levelName": "BLUE SWITCH PALACE"
  },
  {
    "levelId": 290,
    "levelName": "FOREST SECRET AREA"
  },
  {
    "levelId": 291,
    "levelName": "FOREST OF ILLUSION 3"
  },
  {
    "levelId": 292,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 293,
    "levelName": "FUNKY"
  },
  {
    "levelId": 294,
    "levelName": "OUTRAGEOUS"
  },
  {
    "levelId": 295,
    "levelName": "MONDO"
  },
  {
    "levelId": 296,
    "levelName": "GROOVY"
  },
  {
    "levelId": 297,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 298,
    "levelName": "GNARLY"
  },
  {
    "levelId": 299,
    "levelName": "TUBULAR"
  },
  {
    "levelId": 300,
    "levelName": "WAY COOL"
  },
  {
    "levelId": 301,
    "levelName": "AWESOME"
  },
  {
    "levelId": 302,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 303,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 304,
    "levelName": "STAR WORLD 2"
  },
  {
    "levelId": 305,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 306,
    "levelName": "STAR WORLD 3"
  },
  {
    "levelId": 307,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 308,
    "levelName": "STAR WORLD 1"
  },
  {
    "levelId": 309,
    "levelName": "STAR WORLD 4"
  },
  {
    "levelId": 310,
    "levelName": "STAR WORLD 5"
  },
  {
    "levelId": 311,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 312,
    "levelName": "STAR ROAD"
  },
  {
    "levelId": 313,
    "levelName": ""
  },
  {
    "levelId": 314,
    "levelName": ""
  },
  {
    "levelId": 315,
    "levelName": ""
  }
];

const VANILLA_LEVEL_NAMES = new Map([[0,""],[1,"VANILLA SECRET 2"],[2,"VANILLA SECRET 3"],[3,"TOP SECRET AREA"],[4,"DONUT GHOST HOUSE"],[5,"DONUT PLAINS 3"],[6,"DONUT PLAINS 4"],[7,"#2 MORTON'S CASTLE"],[8,"GREEN SWITCH PALACE"],[9,"DONUT PLAINS 2"],[10,"DONUT SECRET 1"],[11,"VANILLA FORTRESS"],[12,"BUTTER BRIDGE 1"],[13,"BUTTER BRIDGE 2"],[14,"#4 LUDWIG'S CASTLE"],[15,"CHEESE BRIDGE AREA"],[16,"COOKIE MOUNTAIN"],[17,"SODA LAKE"],[18,"STAR ROAD"],[19,"DONUT SECRET HOUSE"],[20,"YELLOW SWITCH PALACE"],[21,"DONUT PLAINS 1"],[22,"STAR ROAD"],[23,"#2 MORTON'S PLAINS"],[24,"SUNKEN GHOST SHIP"],[25,"#2 MORTON'S PLAINS"],[26,"#6 WENDY'S CASTLE"],[27,"CHOCOLATE FORTRESS"],[28,"CHOCOLATE ISLAND 5"],[29,"CHOCOLATE ISLAND 4"],[30,"STAR ROAD"],[31,"FOREST FORTRESS"],[32,"#5 ROY'S CASTLE"],[33,"CHOCO-GHOST HOUSE"],[34,"CHOCOLATE ISLAND 1"],[35,"CHOCOLATE ISLAND 3"],[36,"CHOCOLATE ISLAND 2"],[257,"#1 IGGY'S CASTLE"],[258,"YOSHI'S ISLAND 4"],[259,"YOSHI'S ISLAND 3"],[260,"YOSHI'S HOUSE"],[261,"YOSHI'S ISLAND 1"],[262,"YOSHI'S ISLAND 2"],[263,"VANILLA GHOST HOUSE"],[264,"STAR ROAD"],[265,"VANILLA SECRET 1"],[266,"VANILLA DOME 3"],[267,"DONUT SECRET 2"],[268,"STAR ROAD"],[269,"FRONT DOOR"],[270,"BACK DOOR"],[271,"VALLEY OF BOWSER 4"],[272,"#7 LARRY'S CASTLE"],[273,"VALLEY FORTRESS"],[274,""],[275,"VALLEY OF BOWSER 3"],[276,"VALLEY GHOST HOUSE"],[277,"VALLEY OF BOWSER 2"],[278,"VALLEY OF BOWSER 1"],[279,"CHOCOLATE SECRET"],[280,"VANILLA DOME 2"],[281,"VANILLA DOME 4"],[282,"VANILLA DOME 1"],[283,"RED SWITCH PALACE"],[284,"#3 LEMMY'S CASTLE"],[285,"FOREST GHOST HOUSE"],[286,"FOREST OF ILLUSION 1"],[287,"FOREST OF ILLUSION 4"],[288,"FOREST OF ILLUSION 2"],[289,"BLUE SWITCH PALACE"],[290,"FOREST SECRET AREA"],[291,"FOREST OF ILLUSION 3"],[292,"STAR ROAD"],[293,"FUNKY"],[294,"OUTRAGEOUS"],[295,"MONDO"],[296,"GROOVY"],[297,"STAR ROAD"],[298,"GNARLY"],[299,"TUBULAR"],[300,"WAY COOL"],[301,"AWESOME"],[302,"STAR ROAD"],[303,"STAR ROAD"],[304,"STAR WORLD 2"],[305,"STAR ROAD"],[306,"STAR WORLD 3"],[307,"STAR ROAD"],[308,"STAR WORLD 1"],[309,"STAR WORLD 4"],[310,"STAR WORLD 5"],[311,"STAR ROAD"],[312,"STAR ROAD"],[313,""],[314,""],[315,""]]);

function buildSmwTileToCharMap() {
  const map = new Map();
  const set = (code, ch) => {
    if (!map.has(code)) map.set(code, ch);
  };
  for (let i = 0; i < 26; i++) set(i, String.fromCharCode(65 + i));
  set(26, '!');
  set(27, '.');
  set(28, '-');
  set(29, ',');
  set(30, '?');
  set(31, ' ');
  set(32, ',');
  set(33, 'z');
  for (let i = 0; i < 10; i++) set(34 + i, String(i));
  set(44, 'B');
  set(45, 'C');
  set(46, '>');
  set(47, 'T');
  set(48, 'N');
  set(49, 'S');
  set(50, ' I');
  set(51, 'L');
  set(52, 'L');
  set(53, 'U');
  set(54, 'S');
  set(55, 'I');
  set(56, 'Y');
  set(57, 'E');
  set(58, 'LL');
  set(59, 'O');
  set(60, 'W');
  set(61, '?');
  set(62, '0');
  set(63, '!');
  for (let i = 0; i < 26; i++) set(64 + i, String.fromCharCode(97 + i));
  set(90, '#');
  set(91, '(');
  set(92, ')');
  set(93, "'");
  set(94, '.');
  set(95, 'F');
  for (let i = 96; i <= 99; i++) set(i, '_');
  set(100, '1');
  set(101, '2');
  set(102, '3');
  set(103, '4');
  set(104, '5');
  set(105, '6');
  set(106, '7');
  set(107, '0');
  set(108, 'N');
  set(109, '1');
  set(110, '2');
  set(111, 'P');
  return map;
}

const SMW_TILE_TO_CHAR = buildSmwTileToCharMap();

const PIPE_NAME_REGEX = /\b(pipe|tube|warp|portal|teleport|gateway|transport)\b/i;

function normalizeDisplayName(name) {
  return name.toLowerCase().replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
}

function namesMatchFuzzy(candidate, vanillaName) {
  const a = normalizeDisplayName(candidate);
  const b = normalizeDisplayName(vanillaName);
  if (a === b) return true;
  if (!a.includes('?')) return false;
  const pattern = a.replace(/[.*+^$\{}()|[\]\\]/g, '\\$&').replace(/\?+/g, '.+?');
  return new RegExp('^' + pattern + '$').test(b);
}

function catalogIndexToLevelId(index) {
  return index <= 36 ? index : 257 + (index - 37);
}

function snesToRomOffset(snesAddr) {
  if (
    snesAddr < 0 ||
    snesAddr >= 0xffffff ||
    (snesAddr & 0xfe0000) === 0x7e0000 ||
    !(snesAddr & 0x408000) ||
    (snesAddr & 0x708000) === 0x700000
  ) {
    return 512;
  }
  return (((snesAddr & 0x7f0000) >> 1) | (snesAddr & 0x7fff)) + 512;
}

function decodeLmExtendedSlotName(rom, offset) {
  let raw = '';
  for (let i = 0; i < LM_EXTENDED_SLOT_BYTES; i++) {
    raw += SMW_TILE_TO_CHAR.get(rom[offset + i] ?? 0) ?? '?';
  }
  return raw.trim();
}

function detectLegacyLevelNames(rom) {
  const markerPos = rom.indexOf(LEGACY_NAME_MARKER);
  if (markerPos === -1) return null;

  const dataStart = markerPos + LEGACY_NAME_MARKER.length;
  const scanLength = 96 * 19;
  const names = new Map();
  let slotIndex = 0;
  let charIndex = 0;
  let current = '';

  for (let pos = dataStart; pos < dataStart + scanLength && pos < rom.length && slotIndex < LEVEL_CATALOG.length; pos++) {
    if (rom[pos] === 0x53 && rom[pos + 1] === 0x54 && rom[pos + 2] === 0x41 && rom[pos + 3] === 0x52) {
      break;
    }
    current += SMW_TILE_TO_CHAR.get(rom[pos] ?? 0) ?? '?';
    charIndex++;
    if (charIndex > 18) {
      const trimmed = current.trim();
      if (trimmed !== '') {
        const entry = LEVEL_CATALOG[slotIndex];
        if (entry) names.set(entry.levelId, trimmed);
      }
      slotIndex++;
      charIndex = 0;
      current = '';
    }
  }

  return names.size > 0 ? names : null;
}

function detectStarwLevelNames(rom) {
  let searchFrom = 0;
  let best = null;

  while ((searchFrom = rom.indexOf(STARW_MARKER, searchFrom)) !== -1) {
    const firstByte = rom[searchFrom + 8];
    if (firstByte === undefined) {
      searchFrom++;
      continue;
    }
    if (firstByte !== 0 && firstByte !== 10 && (firstByte < 32 || firstByte >= 127)) {
      searchFrom++;
      continue;
    }

    const entries = [];
    let pos = searchFrom + 8;
    let validRows = 0;
    const rowBytes = [];
    let invalid = false;

    while (pos < rom.length && entries.length < 96) {
      const byte = rom[pos] ?? 0;
      if (byte === 0) {
        const text = Buffer.from(rowBytes).toString('latin1');
        entries.push(text);
        if (rowBytes.length > 0 && rowBytes.every((b) => b === 10 || (b >= 32 && b < 127))) {
          validRows++;
        }
        rowBytes.length = 0;
        pos++;
        continue;
      }
      if (byte === 10 || (byte >= 32 && byte < 127)) {
        if (rowBytes.push(byte), pos++, rowBytes.length > 64) {
          invalid = true;
          break;
        }
        continue;
      }
      invalid = true;
      break;
    }

    if (!invalid && validRows >= 20 && (!best || validRows > best.validCount)) {
      best = { offset: searchFrom, entries, validCount: validRows };
    }
    searchFrom++;
  }

  if (!best) return null;

  const names = new Map();
  for (let i = 0; i < best.entries.length; i++) {
    const catalogEntry = LEVEL_CATALOG[i];
    if (!catalogEntry) break;
    const cleaned = (best.entries[i] ?? '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned !== '') names.set(catalogEntry.levelId, cleaned);
  }
  return names;
}

function isLmExtendedSlot(rom, offset) {
  if (offset + LM_EXTENDED_SLOT_BYTES > rom.length) return false;
  for (let i = 0; i < LM_EXTENDED_PADDING_CHECKS; i++) {
    if (rom[offset + i] !== 0x1f) return false;
  }
  const markerByte = rom[offset + LM_EXTENDED_PADDING_CHECKS];
  if (
    markerByte === 0x1f ||
    !(
      (markerByte >= 0 && markerByte <= 25) ||
      (markerByte >= 64 && markerByte <= 89) ||
      (markerByte >= 34 && markerByte <= 43)
    )
  ) {
    return false;
  }
  for (let i = LM_EXTENDED_PADDING_CHECKS; i < LM_EXTENDED_SLOT_BYTES; i++) {
    const b = rom[offset + i];
    if (b !== 0x1f && b > 111) return false;
  }
  return rom[offset + LM_EXTENDED_SLOT_BYTES - 1] === 0x1f;
}

function isLmExtendedBlock(rom, offset) {
  if (offset + LM_EXTENDED_BLOCK_BYTES > rom.length) return false;
  for (let i = 0; i < LM_EXTENDED_SLOT_COUNT; i++) {
    if (rom[offset + i * LM_EXTENDED_SLOT_BYTES + LM_EXTENDED_SLOT_BYTES - 1] !== 0x1f) {
      return false;
    }
  }
  return true;
}

function countValidLmExtendedSlots(rom, blockOffset) {
  let count = 0;
  for (let i = 0; i < LM_EXTENDED_SLOT_COUNT; i++) {
    if (isLmExtendedSlot(rom, blockOffset + i * LM_EXTENDED_SLOT_BYTES)) count++;
  }
  return count;
}

function findLmExtendedNameBlock(rom) {
  let bestOffset = -1;
  let bestScore = 0;
  let searchFrom = 0;

  while ((searchFrom = rom.indexOf(STAR_MARKER, searchFrom)) !== -1) {
    const size = (rom[searchFrom + 4] ?? 0) | ((rom[searchFrom + 5] ?? 0) << 8);
    const checksum = (rom[searchFrom + 6] ?? 0) | ((rom[searchFrom + 7] ?? 0) << 8);
    if (((size + checksum) & 0xffff) !== 0xffff) {
      searchFrom++;
      continue;
    }
    const payloadSize = size + 1;
    if (payloadSize < LM_EXTENDED_BLOCK_BYTES) {
      searchFrom++;
      continue;
    }
    const payloadStart = searchFrom + 8;
    if (payloadStart + payloadSize > rom.length) {
      searchFrom++;
      continue;
    }
    const slack = payloadSize - LM_EXTENDED_BLOCK_BYTES;
    for (let slide = 0; slide <= slack; slide++) {
      const candidate = payloadStart + slide;
      if (!isLmExtendedBlock(rom, candidate)) continue;
      const score = countValidLmExtendedSlots(rom, candidate);
      if (score >= 5 && score > bestScore) {
        bestOffset = candidate;
        bestScore = score;
      }
    }
    searchFrom++;
  }

  return bestOffset >= 0 ? bestOffset : null;
}

function detectLmExtendedLevelNames(rom) {
  const blockOffset = findLmExtendedNameBlock(rom);
  if (blockOffset === null) return null;

  const names = new Map();
  for (let i = 0; i < LM_EXTENDED_SLOT_COUNT; i++) {
    const slotOffset = blockOffset + i * LM_EXTENDED_SLOT_BYTES;
    const decoded = decodeLmExtendedSlotName(rom, slotOffset);
    if (decoded === '') continue;
    const catalogEntry = LEVEL_CATALOG[i];
    if (catalogEntry) names.set(catalogEntry.levelId, decoded);
  }
  return names.size > 0 ? names : null;
}

function detectVanillaDefaultNames() {
  const names = new Map();
  for (const entry of LEVEL_CATALOG) {
    if (entry.levelName !== '') names.set(entry.levelId, entry.levelName);
  }
  return names;
}

function hasLunarMagicSignature(rom) {
  const offsets = rom.length % 32768 === 512 ? [520864] : [520352];
  for (const offset of offsets) {
    if (offset + 12 > rom.length) continue;
    if (rom.slice(offset, offset + 12).toString('ascii').startsWith('Lunar Magic ')) return true;
  }
  return false;
}

const LEVEL_NAME_DETECTORS = [
  {
    id: 'extended',
    label: 'Extended Level Names patch (STARW ASCII table)',
    detect: detectStarwLevelNames,
  },
  {
    id: 'lm-extended-names',
    label: 'Lunar Magic Extended Level Names (56-byte slots)',
    detect: detectLmExtendedLevelNames,
  },
  {
    id: 'legacy',
    label: 'Lunar Magic standard OW name table (STAR + 1F 07 E0 F8)',
    detect: detectLegacyLevelNames,
  },
  {
    id: 'vanilla-default',
    label: 'Vanilla SMW default names (ROM has no custom name data)',
    detect: () => detectVanillaDefaultNames(),
  },
];

/**
 * Parse level names from a ROM buffer (sync core).
 * @param {Buffer} romBuffer
 * @returns {{ source: string, label: string, names: Map<number, string> }}
 */
function parseLevelNamesFromBuffer(romBuffer) {
  const rom = romBuffer;
  const lmDetected = hasLunarMagicSignature(rom);

  for (const detector of LEVEL_NAME_DETECTORS) {
    if (detector.id === 'vanilla-default' && lmDetected) continue;
    const names = detector.detect(rom);
    if (names !== null && names.size > 0) {
      return { source: detector.id, label: detector.label, names };
    }
  }

  return {
    source: 'none',
    label: lmDetected
      ? 'LM-modified ROM with no recognizable name table — falling back to SMWDB / level codes'
      : 'no name data found',
    names: new Map(),
  };
}

/**
 * Parse level names from a ROM file path.
 * @param {string} romPath
 */
function parseLevelNames(romPath) {
  return parseLevelNamesFromBuffer(fs.readFileSync(romPath));
}

function getEditedLevelIds(patchedRomPath, vanillaRomPath) {
  const patched = fs.readFileSync(patchedRomPath);
  const vanilla = fs.readFileSync(vanillaRomPath);
  const edited = new Set();
  const entryCount = LEVEL_POINTER_TABLE_BYTE_LENGTH / 3;

  for (let i = 0; i < entryCount; i++) {
    const offset = LEVEL_POINTER_TABLE_ROM_OFFSET + i * 3;
    if (
      patched[offset] !== vanilla[offset] ||
      patched[offset + 1] !== vanilla[offset + 1] ||
      patched[offset + 2] !== vanilla[offset + 2]
    ) {
      edited.add(i);
    }
  }
  return edited;
}

function parseTranslevelBytes(block) {
  const ids = [];
  let pos = 0;
  while (pos < block.length) {
    const opcode = block[pos];
    if (opcode === undefined) break;
    if (opcode === 0xe4 && pos + 4 < block.length) {
      const id = block[pos + 4];
      if (id > 0 && id <= 95) ids.push(id);
      pos += 5;
    } else if ((opcode === 0x3c || opcode === 0x2b || opcode === 0x24) && pos + 3 < block.length) {
      const id = block[pos + 3];
      if (id > 0 && id <= 95) ids.push(id);
      pos += 4;
    } else {
      pos++;
    }
  }
  return ids;
}

function findOwUncompressedStarBlocks(rom) {
  const blocks = [];
  let searchFrom = 0;
  while (searchFrom < rom.length) {
    const starPos = rom.indexOf(0x53, searchFrom);
    if (starPos === -1) break;
    if (starPos + 3 < rom.length && rom[starPos + 1] === 0x54 && rom[starPos + 2] === 0x41 && rom[starPos + 3] === 0x52) {
      let pos = starPos + 4;
      let sawTranslevel = false;
      let terminator = -1;
      while (pos < rom.length && !(rom[pos] === 0x53 && rom[pos + 1] === 0x54 && rom[pos + 2] === 0x41 && rom[pos + 3] === 0x52)) {
        if (rom[pos] === 0xff && rom[pos + 1] === 0x00 && rom[pos + 2] === 0x00) {
          if (sawTranslevel) terminator = pos;
          break;
        }
        if (rom[pos] === 0xe4 && terminator < 0) sawTranslevel = true;
        pos++;
      }
      if (terminator > 0) {
        blocks.push(rom.subarray(starPos + 4, terminator));
        searchFrom = terminator;
        continue;
      }
    }
    searchFrom = starPos + 1;
  }
  return blocks;
}

function findOwRleStarBlocks(rom) {
  const blocks = [];
  let pos = 0;
  while (pos + 8 < rom.length) {
    if (rom[pos] === 0x53 && rom[pos + 1] === 0x54 && rom[pos + 2] === 0x41 && rom[pos + 3] === 0x52) {
      const size = rom[pos + 4] | (rom[pos + 5] << 8);
      const checksum = rom[pos + 6] | (rom[pos + 7] << 8);
      if (((size + checksum) & 0xffff) === 0xffff && size >= 8 && size <= 16384 && pos + 8 + size <= rom.length) {
        const firstPayloadByte = rom[pos + 8];
        if (firstPayloadByte === 0xe4 || firstPayloadByte === 0xe5) {
          blocks.push(rom.subarray(pos + 8, pos + 8 + size));
        }
        pos += 8 + size;
        continue;
      }
    }
    pos++;
  }
  return blocks;
}

function getOWPlacedLevelIds(romPath) {
  const rom = fs.readFileSync(romPath);
  const levelIds = new Set();
  for (const block of findOwUncompressedStarBlocks(rom)) {
    for (const index of parseTranslevelBytes(block)) levelIds.add(catalogIndexToLevelId(index));
  }
  for (const block of findOwRleStarBlocks(rom)) {
    for (const index of parseTranslevelBytes(block)) levelIds.add(catalogIndexToLevelId(index));
  }
  return levelIds;
}

function getOWPlacedLevelIdsFromBuffer(romBuffer) {
  const levelIds = new Set();
  for (const block of findOwUncompressedStarBlocks(romBuffer)) {
    for (const index of parseTranslevelBytes(block)) levelIds.add(catalogIndexToLevelId(index));
  }
  for (const block of findOwRleStarBlocks(romBuffer)) {
    for (const index of parseTranslevelBytes(block)) levelIds.add(catalogIndexToLevelId(index));
  }
  return levelIds;
}

function detectPipeLevels(nameMap) {
  const pipeIds = new Set();
  for (const [levelId, name] of nameMap) {
    if (PIPE_NAME_REGEX.test(name)) pipeIds.add(levelId);
  }
  return pipeIds;
}

function getLevelMetadata(romBuffer, levelId) {
  if (!Number.isInteger(levelId) || levelId < 0 || levelId >= 512) return null;

  const pointerOffset = snesToRomOffset(0x05e000 + levelId * 3);
  if (pointerOffset + 3 > romBuffer.length) return null;

  const pointer =
    romBuffer[pointerOffset] | (romBuffer[pointerOffset + 1] << 8) | (romBuffer[pointerOffset + 2] << 16);
  const meta = { water: false, slippery: false, length: 0 };
  if (pointer === 0 || (pointer & 0xffffff) === 0xffffff) return meta;

  const headerOffset = snesToRomOffset(pointer);
  if (headerOffset + 5 > romBuffer.length) return meta;
  meta.length = romBuffer[headerOffset] & 0x1f;

  const propertyOffset = snesToRomOffset(0x05dc00 + levelId);
  if (propertyOffset < romBuffer.length) {
    const propertyByte = romBuffer[propertyOffset];
    if (propertyByte !== 0xff) {
      meta.water = (propertyByte & 0x40) !== 0;
      meta.slippery = (propertyByte & 0x80) !== 0;
    }
  }
  return meta;
}

function levelIdToHexCode(levelId) {
  return levelId.toString(16).toUpperCase().padStart(levelId < 256 ? 2 : 3, '0');
}

/**
 * Build filtered/enriched level list from a patched ROM buffer.
 * @param {Buffer} romBuffer
 * @param {{ vanillaRomPath?: string }} [options]
 */
function buildRomLevelNameResult(romBuffer, options = {}) {
  const { source, label, names } = parseLevelNamesFromBuffer(romBuffer);

  let editedPointerIds = new Set();
  const vanillaRomPath = options.vanillaRomPath;
  if (vanillaRomPath && fs.existsSync(vanillaRomPath)) {
    try {
      editedPointerIds = getEditedLevelIdsFromBuffers(romBuffer, fs.readFileSync(vanillaRomPath));
    } catch {
      // non-fatal
    }
  }

  let owPlacedIds;
  try {
    owPlacedIds = getOWPlacedLevelIdsFromBuffer(romBuffer);
  } catch {
    owPlacedIds = new Set();
  }

  const rawEntries = Array.from(names.entries());
  const entries =
    rawEntries.length === 0 && owPlacedIds.size > 0
      ? Array.from(owPlacedIds)
          .sort((a, b) => a - b)
          .map((levelId) => [levelId, ''])
      : rawEntries;

  const filtered = entries.filter(([levelId, name]) => {
    const vanillaName = VANILLA_LEVEL_NAMES.get(levelId);
    if (vanillaName === undefined) return true;
    const renamed = !namesMatchFuzzy(name, vanillaName);
    const onOverworld = owPlacedIds.size === 0 || owPlacedIds.has(levelId);
    return renamed ? true : onOverworld;
  });

  const filteredMap = new Map(filtered);
  const pipeIds = detectPipeLevels(filteredMap);

  const levels = filtered
    .map(([levelId, name]) => {
      const vanillaName = VANILLA_LEVEL_NAMES.get(levelId);
      const isVanillaName = name !== '' && vanillaName !== undefined && namesMatchFuzzy(name, vanillaName);
      const meta = getLevelMetadata(romBuffer, levelId);
      return {
        code: levelIdToHexCode(levelId),
        name,
        isPipe: pipeIds.has(levelId),
        isVanillaName,
        water: meta?.water === true,
        slippery: meta?.slippery === true,
        length: meta?.length ?? 0,
      };
    })
    .sort((a, b) => parseInt(a.code, 16) - parseInt(b.code, 16));

  return {
    source,
    sourceLabel: label,
    vanillaFiltered: true,
    totalRomEntries: entries.length,
    pipeCount: levels.filter((l) => l.isPipe).length,
    vanillaNameCount: levels.filter((l) => l.isVanillaName).length,
    editedPointerCount: editedPointerIds.size,
    owPlacementCount: owPlacedIds.size,
    levels,
  };
}

function getEditedLevelIdsFromBuffers(patchedRom, vanillaRom) {
  const edited = new Set();
  const entryCount = LEVEL_POINTER_TABLE_BYTE_LENGTH / 3;
  for (let i = 0; i < entryCount; i++) {
    const offset = LEVEL_POINTER_TABLE_ROM_OFFSET + i * 3;
    if (
      patchedRom[offset] !== vanillaRom[offset] ||
      patchedRom[offset + 1] !== vanillaRom[offset + 1] ||
      patchedRom[offset + 2] !== vanillaRom[offset + 2]
    ) {
      edited.add(i);
    }
  }
  return edited;
}


const END_KEYWORD_PATTERNS = [
  /\bcredits?\b/i,
  /\bthe\s+end\b/i,
  /\bthanks?\b.*\bplaying\b/i,
  /\bstaff\s*roll\b/i,
  /^\s*ending\s*$/i,
  /^\s*outro\s*$/i,
  /^\s*game\s*over\s*$/i,
];

function isPipeKeywordName(name) {
  const t = (name ?? '').trim();
  return t !== '' && PIPE_NAME_REGEX.test(t);
}

function isEndKeywordName(name) {
  const t = (name ?? '').trim();
  return t !== '' && END_KEYWORD_PATTERNS.some((re) => re.test(t));
}

/** @alias parseLevelNamesFromBuffer */
function MTlevelreader(romBuffer) {
  return parseLevelNamesFromBuffer(romBuffer);
}

/** @alias buildRomLevelNameResult */
function extractJitMtIncluded(romBuffer, options = {}) {
  return buildRomLevelNameResult(romBuffer, options);
}

/** @alias getOWPlacedLevelIdsFromBuffer */
function extractJitOwPlaced(romBuffer) {
  return getOWPlacedLevelIdsFromBuffer(romBuffer);
}

module.exports = {
  LEVEL_POINTER_TABLE_ROM_OFFSET,
  LEVEL_POINTER_TABLE_BYTE_LENGTH,
  LEVEL_CATALOG,
  VANILLA_LEVEL_NAMES,
  PIPE_NAME_REGEX,
  END_KEYWORD_PATTERNS,
  normalizeDisplayName,
  namesMatchFuzzy,
  catalogIndexToLevelId,
  MTlevelreader,
  parseLevelNamesFromBuffer,
  extractJitMtIncluded,
  buildRomLevelNameResult,
  extractJitOwPlaced,
  getOWPlacedLevelIdsFromBuffer,
  isPipeKeywordName,
  isEndKeywordName,
  getLevelMetadata,
};
