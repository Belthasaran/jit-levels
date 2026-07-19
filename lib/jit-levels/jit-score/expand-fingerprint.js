/**
 * Layer1 Map16 fingerprint expand — in-process JS (no native binary).
 */

const { expandLayer1Map16Fingerprints } = require('../levelinfo/lm-level-expand');

/**
 * Expand Layer1 and return fingerprints for one level.
 * @returns {{ fingerprints: string[], screens: Array<{screen:number, fingerprint:string}> }}
 */
function fingerprintLevelViaExpand(romBuffer, levelId) {
  const result = expandLayer1Map16Fingerprints(romBuffer, levelId);
  return {
    fingerprints: result.fingerprints,
    screens: result.screens,
  };
}

module.exports = {
  fingerprintLevelViaExpand,
  expandLayer1Map16Fingerprints,
};
