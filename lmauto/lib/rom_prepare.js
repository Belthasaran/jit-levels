/**
 * Prepare a ROM for Lunar Magic GUI/CLI: copy to dest and ensure a 512-byte
 * copier (SMC) header so LM does not prompt to add one.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SMC_HEADER_SIZE = 512;

/**
 * True when file size mod 0x10000 equals 0x200 (standard headered SMW ROM heuristic).
 * @param {number} byteLength
 */
function hasSmcHeaderSize(byteLength) {
  return (byteLength & 0xffff) === 0x200;
}

/**
 * @param {Buffer} data
 * @returns {Buffer} data with a 512-byte zero header prepended if missing
 */
function ensureSmcHeader(data) {
  if (!Buffer.isBuffer(data)) data = Buffer.from(data);
  if (hasSmcHeaderSize(data.length)) return data;
  const out = Buffer.alloc(SMC_HEADER_SIZE + data.length);
  // zeros already; copy body after header
  data.copy(out, SMC_HEADER_SIZE);
  return out;
}

/**
 * Copy srcRom to destPath, adding a 512-byte zero header when the source is
 * unheadered. Never double-prefixes an already-headered ROM.
 *
 * @param {string} srcRom
 * @param {string} destPath
 * @returns {{ destPath: string, addedHeader: boolean, bytesWritten: number }}
 */
function prepareRomCopy(srcRom, destPath) {
  const absSrc = path.resolve(srcRom);
  const absDest = path.resolve(destPath);
  if (!fs.existsSync(absSrc)) {
    throw new Error(`ROM not found: ${absSrc}`);
  }
  fs.mkdirSync(path.dirname(absDest), { recursive: true });
  const raw = fs.readFileSync(absSrc);
  const had = hasSmcHeaderSize(raw.length);
  const out = ensureSmcHeader(raw);
  fs.writeFileSync(absDest, out);
  return {
    destPath: absDest,
    addedHeader: !had,
    bytesWritten: out.length,
  };
}

module.exports = {
  SMC_HEADER_SIZE,
  hasSmcHeaderSize,
  ensureSmcHeader,
  prepareRomCopy,
};
