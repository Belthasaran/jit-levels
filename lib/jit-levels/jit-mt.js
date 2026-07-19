/**
 * JitMT — MT-compat getRomLevelNames-style inclusion filter.
 */

const { normalizeLevelId } = require('./smw-rom');
const { extractJitMtIncluded } = require('./mtcompat-levelreader');

/**
 * @param {Buffer} romBuffer
 * @param {{ vanillaRomPath?: string }} [options]
 * @returns {{ levels: Array<object> }}
 */
function extractJitMt(romBuffer, options = {}) {
  const result = extractJitMtIncluded(romBuffer, options);
  const levels = [];

  for (const entry of result.levels) {
    const levelnumber = normalizeLevelId(entry.code);
    if (!levelnumber) continue;

    levels.push({
      levelnumber,
      levelname: entry.name || null,
      sources: ['jitmt'],
      mtIncluded: true,
      mtIsPipe: entry.isPipe === true,
      mtIsVanillaName: entry.isVanillaName === true,
      mtWater: entry.water === true,
      mtSlippery: entry.slippery === true,
      mtLength: entry.length ?? 0,
    });
  }

  return { levels, meta: { source: result.source, sourceLabel: result.sourceLabel } };
}

module.exports = {
  extractJitMt,
};
