/**
 * JITOW — overworld placed level IDs (MT-compat OW scan).
 */

const { normalizeLevelId } = require('./smw-rom');
const { extractJitOwPlaced } = require('./mtcompat-levelreader');

/**
 * @param {Buffer} romBuffer
 * @returns {{ levels: Array<{levelnumber, sources}> }}
 */
function extractJitOw(romBuffer) {
  const placedIds = extractJitOwPlaced(romBuffer);
  const levels = [];

  for (const levelId of placedIds) {
    const levelnumber = normalizeLevelId(levelId);
    if (!levelnumber) continue;
    levels.push({
      levelnumber,
      sources: ['jitow'],
    });
  }

  return { levels };
}

module.exports = {
  extractJitOw,
};
