/**
 * JIT.LevelInfo — port of lmlevelinfo/level_info1 JSON output + GameStage mapping helpers.
 */

const { createRomFromBuffer, parseLevelIdToInt } = require('../smw-rom');
const { lmResolveTables } = require('./lm-tables');
const { parseLevelInfoRaw, levelInfoToJson } = require('./level-parse');
const { gfxRouteBuild, gfxRouteToJson } = require('./gfx-route');

/** SMW/LM level_mode → type flags (vanilla mode IDs). */
const LEVEL_MODE_TABLE = [
  /* 0x00 */ { name: 'horizontal', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x01 */ { name: 'horizontal_layer2', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x02 */ { name: 'vertical', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x03 */ { name: 'vertical_layer2', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x04 */ { name: 'vertical_rope', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x05 */ { name: 'vertical_castle', vertical: true, water: false, ghouse: false, spalace: false, castle: true, boss: true },
  /* 0x06 */ { name: 'vertical_underground', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x07 */ { name: 'vertical_underground_layer2', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x08 */ { name: 'horizontal_layer2_top', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x09 */ { name: 'underwater', vertical: false, water: true, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x0A */ { name: 'horizontal_autoscroll', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x0B */ { name: 'ghost_house', vertical: false, water: false, ghouse: true, spalace: false, castle: false, boss: false },
  /* 0x0C */ { name: 'ghost_house_layer2', vertical: false, water: false, ghouse: true, spalace: false, castle: false, boss: false },
  /* 0x0D */ { name: 'switch_palace', vertical: false, water: false, ghouse: false, spalace: true, castle: false, boss: false },
  /* 0x0E */ { name: 'underground', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x0F */ { name: 'underground_layer2', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x10 */ { name: 'underwater_vertical', vertical: true, water: true, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x11 */ { name: 'vertical_ghost_house', vertical: true, water: false, ghouse: true, spalace: false, castle: false, boss: false },
  /* 0x12 */ { name: 'cave', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x13 */ { name: 'cave_layer2', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x14 */ { name: 'vertical_switch_palace', vertical: true, water: false, ghouse: false, spalace: true, castle: false, boss: false },
  /* 0x15 */ { name: 'horizontal_mode_15', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x16 */ { name: 'horizontal_mode_16', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x17 */ { name: 'horizontal_mode_17', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x18 */ { name: 'boss_battle', vertical: false, water: false, ghouse: false, spalace: false, castle: true, boss: true },
  /* 0x19 */ { name: 'horizontal_mode_19', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x1A */ { name: 'vertical_mode_1a', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x1B */ { name: 'vertical_mode_1b', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x1C */ { name: 'horizontal_extended_screens', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x1D */ { name: 'horizontal_mode_1d', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x1E */ { name: 'horizontal_mode_1e', vertical: false, water: false, ghouse: false, spalace: false, castle: false, boss: false },
  /* 0x1F */ { name: 'vertical_mode_1f', vertical: true, water: false, ghouse: false, spalace: false, castle: false, boss: false },
];

const CASTLE_TILESETS = new Set([1]);
const GHOST_TILESETS = new Set([4, 5, 13]);
const SWITCH_TILESETS = new Set([5]);

function parseLevelId(levelId) {
  return parseLevelIdToInt(levelId);
}

function lookupLevelMode(mode) {
  const m = mode & 0x1f;
  return LEVEL_MODE_TABLE[m] || {
    name: `mode_${m.toString(16)}`,
    vertical: false,
    water: false,
    ghouse: false,
    spalace: false,
    castle: false,
    boss: false,
  };
}

function deriveLevelModeFlags(levelInfo) {
  const primary = levelInfo.layer1?.primary_level_header || {};
  const sec = levelInfo.layer1?.secondary_level_header?.decoded || {};
  const mode = primary.level_mode ?? 0;
  const modeFlags = lookupLevelMode(mode);
  const tileset = primary.fgbg_gfx_setting & 0x0f;

  const water = !!(modeFlags.water || sec.water_w);
  const ghouse = !!(modeFlags.ghouse || GHOST_TILESETS.has(tileset));
  const spalace = !!(modeFlags.spalace || SWITCH_TILESETS.has(tileset));
  const castle = !!(modeFlags.castle || CASTLE_TILESETS.has(tileset));
  const boss = !!(modeFlags.boss || castle);

  const screenExits = levelInfo.layer1?.objects?.screen_exits || [];
  const hasSecondaryExit = screenExits.some((e) => e.secondary_exit_flag);
  const hasKeyholeExit = screenExits.some((e) => e.lm_midway_water);

  let credits = false;
  if (primary.music_mmm === 0x7 || primary.level_mode === 0x1e) {
    credits = true;
  }

  const screens = primary.length_in_screens > 0 ? primary.length_in_screens : (primary.length_in_screens === -1 ? 32 : 1);
  let difficultyHint = 0;
  if (screens >= 10) difficultyHint = Math.min(10, 4 + Math.floor(screens / 4));
  else if (screens >= 5) difficultyHint = 2;

  return {
    level_mode: mode,
    level_mode_name: modeFlags.name,
    vertical: modeFlags.vertical,
    water,
    ghouse,
    spalace,
    castle,
    boss,
    mainexit: screenExits.length > 0 || true,
    keyhole: hasKeyholeExit || hasSecondaryExit,
    credits,
    tileset,
    screens,
    difficulty_hint: difficultyHint,
    slippery: !!(sec.slippery_i),
    autoscroll: mode === 0x0a,
  };
}

/**
 * Parse level info from ROM buffer; returns JSON matching level_info1 --json plus derived JIT fields.
 * @param {Buffer|Uint8Array} romBuffer
 * @param {number|string} levelId - e.g. 0x109 or '109'
 * @param {{ includeObjects?: boolean }} [opts]
 */
function parseLevelInfo(romBuffer, levelId, opts = {}) {
  const id = parseLevelId(levelId);
  if (id == null) {
    throw new Error(`Invalid LEVEL_ID: ${levelId}`);
  }

  const rom = createRomFromBuffer(romBuffer);
  const tablesRes = lmResolveTables(rom);
  if (!tablesRes.ok) {
    throw new Error(tablesRes.error || 'Table resolve failed');
  }

  const parseRes = parseLevelInfoRaw(rom, tablesRes.tables, id);
  if (!parseRes.ok) {
    throw new Error(parseRes.error || 'Parse failed');
  }

  const includeObjects = opts.includeObjects !== false;
  const json = levelInfoToJson(parseRes.info, tablesRes.tables, includeObjects);

  const route = gfxRouteBuild(parseRes.info.primary, parseRes.info.exgfx_bytes);
  json.gfx_route = gfxRouteToJson(route);

  json.derived = deriveLevelModeFlags(json);
  const secDec = parseRes.info.secondary_decoded || {};
  if (secDec.water_w) json.derived.water = true;
  if (secDec.slippery_i) json.derived.slippery = true;
  return json;
}

/**
 * Map parsed level info to gamestages default field values.
 * @param {object} levelInfo - output of parseLevelInfo
 */
function buildExtraDescription(levelInfo) {
  const d = levelInfo.derived || deriveLevelModeFlags(levelInfo);
  const primary = levelInfo.layer1?.primary_level_header || {};
  const parts = [];
  if (d.level_mode_name) parts.push(`Mode: ${d.level_mode_name}`);
  if (d.screens) parts.push(`${d.screens} screen(s)`);
  const objCount = countLevelObjects(levelInfo).length;
  const spriteCount = (levelInfo.sprite_data?.sprites || []).length;
  if (objCount) parts.push(`${objCount} objects`);
  if (spriteCount) parts.push(`${spriteCount} sprites`);
  if (primary.timer_setting) parts.push(`timer ${primary.timer_setting}`);
  return parts.length ? parts.join('; ') : null;
}

function countLevelObjects(levelInfo) {
  const objs = levelInfo?.layer1?.objects;
  if (Array.isArray(objs)) return objs;
  if (objs && typeof objs === 'object') {
    return [
      ...(objs.standard || []),
      ...(objs.extended || []),
      ...(objs.screen_exits || []),
    ];
  }
  return [];
}

function mapLevelInfoToStageDefaults(levelInfo) {
  const d = levelInfo.derived || deriveLevelModeFlags(levelInfo);
  const tags = deriveTagsFromLevelInfo(levelInfo);
  return {
    water: d.water ? 1 : 0,
    ghouse: d.ghouse ? 1 : 0,
    spalace: d.spalace ? 1 : 0,
    castle: d.castle ? 1 : 0,
    boss: d.boss ? 1 : 0,
    mainexit: d.mainexit ? 1 : 0,
    keyhole: d.keyhole ? 1 : 0,
    credits: d.credits ? 1 : 0,
    stagetags: tags.length ? tags.join(',') : null,
    extradescription: buildExtraDescription(levelInfo),
    difficulty: d.difficulty_hint || 0,
  };
}

/**
 * Derive comma-separated stage tags from level info.
 * @param {object} levelInfo
 * @returns {string[]}
 */
function deriveTagsFromLevelInfo(levelInfo) {
  const d = levelInfo.derived || deriveLevelModeFlags(levelInfo);
  const primary = levelInfo.layer1?.primary_level_header || {};
  const tags = new Set();

  if (d.vertical) tags.add('vertical');
  if (d.water) tags.add('water');
  if (d.ghouse) tags.add('ghosthouse');
  if (d.spalace) tags.add('switchpalace');
  if (d.castle) tags.add('castle');
  if (d.boss) tags.add('boss');
  if (d.slippery) tags.add('slippery');
  if (d.autoscroll) tags.add('autoscroller');
  if (d.credits) tags.add('credits');
  if (primary.length_in_screens === -1 || (primary.length_in_screens && primary.length_in_screens >= 20)) {
    tags.add('long');
  }
  if (levelInfo.gfx_route?.has_bypass) tags.add('exgfx');

  const spriteCount = levelInfo.sprite_data?.sprites?.length || 0;
  if (spriteCount >= 30) tags.add('sprite-heavy');

  const stdCount = levelInfo.layer1?.objects?.standard?.length || 0;
  if (stdCount >= 200) tags.add('object-heavy');

  return Array.from(tags);
}

module.exports = {
  LEVEL_MODE_TABLE,
  lookupLevelMode,
  deriveLevelModeFlags,
  parseLevelInfo,
  mapLevelInfoToStageDefaults,
  deriveTagsFromLevelInfo,
  expandLayer1Map16Fingerprints: require('./lm-level-expand').expandLayer1Map16Fingerprints,
};
