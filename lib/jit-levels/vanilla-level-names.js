/**
 * Vanilla SMW level name exclusion list for JITNames.
 * Merged from level_reader.c vanilla_name() and levelname_extractor3.py VANILLA_LEVEL_NAMES.
 */

const VANILLA_NAMES_BY_LEVEL = {
  0x001: ['MY SECRET 1', 'VANILLA SECRET 3'],
  0x002: ['my secret 2', 'VANILLA SECRET 4'],
  0x003: ['really cool secret', 'TOP SECRET AREA'],
  0x004: ['not donut mansion', 'DONUT GHOST HOUSE'],
  0x005: ['plains de donut 3', 'DONUT PLAINS 4'],
  0x006: ['plain donut 3', 'DONUT PLAINS 5'],
  0x007: ['Morton place', "#3 MORTON'S CASTLE"],
  0x008: ['green house', 'GREEN SWITCH PALACE'],
  0x009: ['plain donut 2', 'DONUT PLAINS 3'],
  0x00A: ['secret donut 1', 'DONUT SECRET 2'],
  0x00B: ['fortress de vanill', 'VANILLA FORTRESS'],
  0x00C: ['bridge de beur 1', 'BUTTER BRIDGE 2'],
  0x00D: ['bridge de beur 2', 'BUTTER BRIDGE 3'],
  0x00E: ['ludwig hidoeut', "#5 LUDWIG'S CASTLE"],
  0x00F: ['cheesy bridge', 'CHEESE BRIDGE AREA'],
  0x010: ['mountain of cookie', 'COOKIE MOUNTAIN'],
  0x011: ['pepsi lake', 'SODA LAKE'],
  0x012: ['yellow star rod', 'STAR ROAD'],
  0x013: ['super secret donut', 'DONUT SECRET HOUSE'],
  0x014: ['Yellow custom pala', 'YELOW SWITCH PALACE'],
  0x015: ['DONUT PLAINS 1'],
  0x016: ['STAR ROAD'],
  0x017: ["#2 MORTON'S PLAINS", "#3 MORTON'S PLAINS"],
  0x018: ['SUNKEN GHOST SHIP'],
  0x019: ["#2 MORTON'S PLAINS", "#3 MORTON'S PLAINS"],
  0x01A: ["#6 WENDY'S CASTLE", "#7 WENDY'S CASTLE"],
  0x01B: ['CHOCOLATE FORTRESS'],
  0x01C: ['CHOCOLATE ISLAND 5', 'CHOCOLATE ISLAND 6'],
  0x01D: ['CHOCOLATE ISLAND 4', 'CHOCOLATE ISLAND 5'],
  0x01E: ['STAR ROAD'],
  0x01F: ['FOREST FORTRESS'],
  0x020: ["#5 ROY'S CASTLE", "#6 ROY'S CASTLE"],
  0x021: ['CHOCO-GHOST HOUSE'],
  0x022: ['CHOCOLATE ISLAND 1', 'CHOCOLATE ISLAND 2'],
  0x023: ['CHOCOLATE ISLAND 3', 'CHOCOLATE ISLAND 4'],
  0x024: ['CHOCOLATE ISLAND 2', 'CHOCOLATE ISLAND 3'],
  0x101: ["#1 IGGY'S CASTLE", "#2 IGGY'S CASTLE"],
  0x102: ["YOSHI'S ISLAND 4", "YOSHI'S ISLAND 5"],
  0x103: ["YOSHI'S ISLAND 3", "YOSHI'S ISLAND 4"],
  0x104: ["YOSHI'S HOUSE"],
  0x105: ["YOSHI'S ISLAND 1", "YOSHI'S ISLAND 2"],
  0x106: ["YOSHI'S ISLAND 2", "YOSHI'S ISLAND 3"],
  0x107: ['VANILLA GHOST HOUS', 'VANILLA GHOST HOUSE'],
  0x108: ['STAR ROAD'],
  0x109: ['VANILLA SECRET 1'],
  0x10A: ['VANILLA DOME 3'],
  0x10B: ['DONUT SECRET 2'],
  0x10C: ['STAR ROAD'],
  0x10D: ['FRONT DOOR'],
  0x10E: ['BACK DOOR'],
  0x10F: ['VALLEY OF BOWSER 4', 'VALLEY OF BOWSER 5'],
  0x110: ["#7 LARRY'S CASTLE", "#8 LARRY'S CASTLE"],
  0x111: ['VALLEY FORTRESS'],
  0x112: [''],
  0x113: ['VALLEY OF BOWSER 3'],
  0x114: ['VALLEY GHOST HOUSE'],
  0x115: ['VALLEY OF BOWSER 2', 'VALLEY OF BOWSER 1'],
  0x116: ['VALLEY OF BOWSER 1'],
  0x117: ['CHOCOLATE SECRET'],
  0x118: ['VANILLA DOME 2'],
  0x119: ['VANILLA DOME 4', 'VANILLA DOME 5'],
  0x11A: ['VANILLA DOME 1'],
  0x11B: ['RED SWITCH PALACE'],
  0x11C: ["#3 LEMMY'S CASTLE", "#4 LEMMY'S CASTLE"],
  0x11D: ['FOREST GHOST HOUSE'],
  0x11E: ['FOREST OFILLUSION', 'FOREST OFILLUSION 2'],
  0x11F: ['FOREST OFILLUSION', 'FOREST OFILLUSION 5'],
  0x120: ['FOREST OFILLUSION', 'FOREST OFILLUSION 3'],
  0x121: ['BLUE SWITCH PALACE'],
  0x122: ['FOREST SECRET AREA'],
  0x123: ['FOREST OFILLUSION', 'FOREST OFILLUSION 4'],
  0x124: ['STAR ROAD'],
  0x125: ['FUNKY'],
  0x126: ['OUTRAGEOUS'],
  0x127: ['MONDO'],
  0x128: ['GROOVY'],
  0x129: ['STAR ROAD'],
  0x12A: ['GNARLY'],
  0x12B: ['TUBULAR'],
  0x12C: ['WAY COOL'],
  0x12D: ['AWESOME'],
  0x12E: ['STAR ROAD'],
  0x12F: ['STAR ROAD'],
  0x130: ['STAR WORLD 2', 'STAR WORLD 3'],
  0x131: ['STAR ROAD'],
  0x132: ['STAR WORLD 3'],
  0x133: ['STAR ROAD'],
  0x134: ['STAR WORLD 1', 'STAR WORLD 4'],
  0x135: ['STAR WORLD 4', 'STAR WORLD 5'],
  0x136: ['STAR WORLD 5', 'STAR WORLD 6'],
  0x137: ['STAR ROAD'],
  0x138: ['STAR ROAD'],
};

const ALL_VANILLA_STRINGS = new Set();
for (const names of Object.values(VANILLA_NAMES_BY_LEVEL)) {
  for (const name of names) {
    if (name && name.trim()) {
      ALL_VANILLA_STRINGS.add(name.trim().toLowerCase());
    }
  }
}

function isVanillaLevelName(levelId, name) {
  if (!name || !String(name).trim()) return true;
  const trimmed = String(name).trim();
  const lower = trimmed.toLowerCase();
  if (lower === '-' || lower === 'none') return true;

  const id = typeof levelId === 'number'
    ? levelId
    : parseInt(String(levelId).replace(/^0x/i, ''), 16);
  const levelNames = VANILLA_NAMES_BY_LEVEL[id];
  if (levelNames) {
    for (const vanilla of levelNames) {
      if (vanilla && vanilla.toLowerCase() === lower) return true;
    }
  }
  return ALL_VANILLA_STRINGS.has(lower);
}

module.exports = {
  VANILLA_NAMES_BY_LEVEL,
  ALL_VANILLA_STRINGS,
  isVanillaLevelName,
};
