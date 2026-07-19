/**
 * JITNames - port of lmlevelnames/level_reader.c
 */

const { read1, read3, jToLevelId, normalizeLevelId } = require('./smw-rom');
const { smwCharacterLookup } = require('./default-tile-map');
const { isVanillaLevelName } = require('./vanilla-level-names');

const LM_NAMES_HIJACK_SNES = 0x049549;
const LM_NAMES_PTR_SNES = 0x03BB57;

function readLevelName(rom, levelnamesAddr, slotJ) {
  const chars = [];
  for (let i = 0; i < 18; i++) {
    const z = read1(rom, levelnamesAddr + 19 * slotJ + i);
    if (z == null) break;
    chars.push(smwCharacterLookup(z));
  }
  let name = chars.join('');
  while (name.length > 0 && name[name.length - 1] === ' ') {
    name = name.slice(0, -1);
  }
  return name;
}

/**
 * Extract non-vanilla level names from ROM.
 * @returns {{ levels: Array<{levelnumber, levelname}>, error?: string }}
 */
function extractJitNames(rom) {
  if (read1(rom, LM_NAMES_HIJACK_SNES) !== 0x22) {
    return { levels: [], error: 'Lunar Magic level names hijack not found' };
  }

  const levelnamesAddr = read3(rom, LM_NAMES_PTR_SNES);
  if (levelnamesAddr == null) {
    return { levels: [], error: 'Could not read level names pointer' };
  }

  const levels = [];
  for (let j = 1; j < 96; j++) {
    const levelId = jToLevelId(j);
    if (levelId == null) continue;
    const name = readLevelName(rom, levelnamesAddr, j);
    if (!name) continue;
    if (isVanillaLevelName(levelId, name)) continue;

    levels.push({
      levelnumber: normalizeLevelId(levelId),
      levelname: name,
      levelnameJitnames: name,
      sources: ['jitnames'],
    });
  }

  return { levels };
}

module.exports = {
  extractJitNames,
  readLevelName,
};
