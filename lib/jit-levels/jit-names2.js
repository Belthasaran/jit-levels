/**
 * JITNames2 — MT-compat multi-detector level names (ref: main1-levelnames.js).
 */

const { normalizeLevelId } = require('./smw-rom');
const {
  MTlevelreader,
  VANILLA_LEVEL_NAMES,
  namesMatchFuzzy,
} = require('./mtcompat-levelreader');

/**
 * @param {Buffer} romBuffer
 * @returns {{ levels: Array<{levelnumber, levelname, levelnameJitnames2, sources}> }}
 */
function extractJitNames2(romBuffer) {
  const { names } = MTlevelreader(romBuffer);
  const levels = [];

  for (const [levelId, name] of names.entries()) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) continue;
    const vanillaName = VANILLA_LEVEL_NAMES.get(levelId);
    if (vanillaName !== undefined && namesMatchFuzzy(trimmed, vanillaName)) continue;

    const levelnumber = normalizeLevelId(levelId);
    if (!levelnumber) continue;

    levels.push({
      levelnumber,
      levelname: trimmed,
      levelnameJitnames2: trimmed,
      sources: ['jitnames2'],
    });
  }

  return { levels };
}

module.exports = {
  extractJitNames2,
};
