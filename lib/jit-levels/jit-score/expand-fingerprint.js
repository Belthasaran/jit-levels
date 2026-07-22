/**
 * Layer1 Map16 fingerprint expand — in-process JS (no native binary).
 */

const { expandLayer1Map16Fingerprints } = require('../levelinfo/lm-level-expand');

/**
 * Expand Layer1 and return fingerprints for one level.
 * Locked ROMs are virtual-unlocked first (stub-driven).
 * @returns {{ fingerprints: string[], screens: Array<{screen:number, fingerprint:string}>, rom_lock?: string, unlock?: string }}
 */
function fingerprintLevelViaExpand(romBuffer, levelId) {
  const result = expandLayer1Map16Fingerprints(romBuffer, levelId, { unlock: true });
  return {
    fingerprints: result.fingerprints,
    screens: result.screens,
    rom_lock: result.rom_lock,
    unlock: result.unlock,
  };
}

module.exports = {
  fingerprintLevelViaExpand,
  expandLayer1Map16Fingerprints,
};
