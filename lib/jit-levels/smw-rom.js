/**
 * SMW ROM utilities for JIT level analysis (LoROM, header detection, reads).
 * Ported from lmlevelinfo/romutil.c and lmlevelnames/level_reader.c
 */

const BV_SMCHEADER = 0x1;
const BV_LOROM = 0x2;

function loromToOffset(addr) {
  const bankN = addr >> 16;
  const bankA = addr & 0xffff;
  if (addr < 0x8000) {
    return (bankN * 0x8000) + (bankA & 0x7fff);
  }
  return ((bankN & 0x7f) << 15) | (bankA & 0x7fff);
}

function snesToRomOffset(snesAddr, hasHeader) {
  // hasHeader ignored when working with headerless rom.data buffers
  return loromToOffset(snesAddr);
}

function createRomFromBuffer(buffer) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let romData = data;
  let hasSmcHeader = false;

  if ((data.length & 0xffff) === 0x200) {
    hasSmcHeader = true;
    romData = data.subarray(0x200);
  }

  const mapMode = guessMapMode(romData);
  const isLoRom = mapMode === 0x20 || mapMode === 0x30;

  return {
    data: romData,
    size: romData.length,
    has_smc_header: hasSmcHeader,
    hasSmcHeader,
    map_mode: mapMode,
    mapMode,
    isLoRom,
    modes: (hasSmcHeader ? BV_SMCHEADER : 0) | (isLoRom ? BV_LOROM : 0),
    adj: hasSmcHeader ? 0x200 : 0,
  };
}

function loadRomFromFile(fs, filePath) {
  const raw = fs.readFileSync(filePath);
  return createRomFromBuffer(raw);
}

function guessMapMode(romData) {
  const sane = [0x20, 0x21, 0x23, 0x30, 0x31, 0x32, 0x35];
  const cands = [];
  if (romData.length > 0x7fd5) cands.push(romData[0x7fd5]);
  if (romData.length > 0xffd5) cands.push(romData[0xffd5]);
  if (romData.length > 0x40ffd5) cands.push(romData[0x40ffd5]);
  for (const c of cands) {
    if (sane.includes(c)) return c;
  }
  return cands[0] || cands[1] || 0x20;
}

function resolveReadOffset(rom, snesAddr, direct = false) {
  if (direct) return snesAddr;
  let addr = snesAddr;
  if (rom.isLoRom || (rom.modes & BV_LOROM)) {
    addr = loromToOffset(addr);
  }
  // rom.data is headerless; do not add 0x200 again
  return addr;
}

function snesLoromToPc(rom, snes24) {
  if (!rom || !rom.data || rom.size === 0) return null;
  const bank = (snes24 >> 16) & 0xff;
  const addr = snes24 & 0xffff;
  const mapMode = rom.map_mode ?? rom.mapMode ?? 0x20;

  if (mapMode === 0x23) {
    if (addr >= 0x8000 && ((bank <= 0x3f) || (bank >= 0x80 && bank <= 0xbf))) {
      let pc = (bank & 0x3f) * 0x8000 + (addr & 0x7fff);
      if (bank >= 0x80 && bank <= 0xbf) pc += 0x200000;
      if (pc < rom.size) return pc;
      return null;
    }
    if (bank >= 0xc0) {
      let pc = (bank & 0x3f) * 0x10000 + addr;
      if (rom.size > 0x400000) {
        const pc2 = pc + 0x400000;
        if (pc2 < rom.size) return pc2;
      }
      if (pc < rom.size) return pc;
      return null;
    }
    return null;
  }

  if (addr >= 0x8000) {
    const bank7 = bank & 0x7f;
    let pc;
    if (rom.size > 0x400000) {
      pc = (bank7 & 0x3f) * 0x8000 + (addr & 0x7fff);
      if (bank7 >= 0x40) pc += 0x400000;
    } else {
      pc = bank7 * 0x8000 + (addr & 0x7fff);
    }
    if (pc >= rom.size) return null;
    return pc;
  }

  if (bank >= 0xc0) {
    let pc = (bank & 0x3f) * 0x10000 + addr;
    if (rom.size > 0x400000) {
      const pc2 = pc + 0x400000;
      if (pc2 < rom.size) return pc2;
    }
    if (pc < rom.size) return pc;
  }
  return null;
}

function readAtPc(rom, pc, length = 1) {
  if (pc == null || pc < 0 || pc + length > rom.data.length) return null;
  if (length === 1) return rom.data[pc];
  return rom.data.subarray(pc, pc + length);
}

function read1(rom, snesAddr, direct = false) {
  const offset = resolveReadOffset(rom, snesAddr, direct);
  if (offset < 0 || offset >= rom.data.length) return null;
  return rom.data[offset];
}

function read8Snes(rom, snes24) {
  const pc = snesLoromToPc(rom, snes24);
  if (pc == null) return null;
  return rom.data[pc];
}

function read16Snes(rom, snes24) {
  const pc = snesLoromToPc(rom, snes24);
  if (pc == null || pc + 1 >= rom.size) return null;
  return rom.data[pc] | (rom.data[pc + 1] << 8);
}

function read24Snes(rom, snes24) {
  const pc = snesLoromToPc(rom, snes24);
  if (pc == null || pc + 2 >= rom.size) return null;
  return rom.data[pc] | (rom.data[pc + 1] << 8) | (rom.data[pc + 2] << 16);
}

function read3(rom, snesAddr, direct = false) {
  const offset = resolveReadOffset(rom, snesAddr, direct);
  if (offset < 0 || offset + 2 >= rom.data.length) return null;
  const a = rom.data[offset];
  const b = rom.data[offset + 1];
  const c = rom.data[offset + 2];
  return (c << 16) | (b << 8) | a;
}

function readBytes(rom, snesAddr, length, direct = false) {
  const offset = resolveReadOffset(rom, snesAddr, direct);
  if (offset < 0 || offset + length > rom.data.length) return null;
  return rom.data.subarray(offset, offset + length);
}

function readBytesAtPc(rom, pcOffset, length) {
  if (pcOffset < 0 || pcOffset + length > rom.data.length) return null;
  return rom.data.subarray(pcOffset, pcOffset + length);
}

function addSmcHeader(romBuffer) {
  const data = Buffer.isBuffer(romBuffer) ? romBuffer : Buffer.from(romBuffer);
  if ((data.length & 0xffff) === 0x200) {
    return Buffer.from(data);
  }
  const header = Buffer.alloc(0x200, 0);
  return Buffer.concat([header, data]);
}

function normalizeLevelId(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    return Math.max(0, Math.min(0x1ff, val)).toString(16).toUpperCase().padStart(3, '0');
  }
  const s = String(val).replace(/^0x/i, '').trim().toUpperCase();
  const parsed = parseInt(s, 16);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.min(0x1ff, parsed)).toString(16).toUpperCase().padStart(3, '0');
}

/** Parse level id string/number to int; SMW level ids are always hex (e.g. '130' → 0x130). */
function parseLevelIdToInt(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    if (val < 0 || val > 0x1ff) return null;
    return val;
  }
  const s = String(val).replace(/^0x/i, '').trim();
  if (!s) return null;
  const parsed = parseInt(s, 16);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 0x1ff) return null;
  return parsed;
}

function jToLevelId(j) {
  if (j >= 0x01 && j <= 0x24) return j;
  if (j > 0x24 && j <= 0x5f) return 0x100 + j - 0x24;
  return null;
}

function translevelToLevel(translevel) {
  if (translevel < 0x25) return translevel;
  return (translevel - 0x24) + 0x100;
}

function levelToTranslevel(level) {
  if (level <= 0x24) return level;
  if (level >= 0x101) return level - 0xdc;
  return null;
}

module.exports = {
  BV_SMCHEADER,
  BV_LOROM,
  loromToOffset,
  snesToRomOffset,
  snesLoromToPc,
  createRomFromBuffer,
  loadRomFromFile,
  read1,
  read8Snes,
  read16Snes,
  read24Snes,
  read3,
  readBytes,
  readBytesAtPc,
  readAtPc,
  addSmcHeader,
  normalizeLevelId,
  parseLevelIdToInt,
  jToLevelId,
  translevelToLevel,
  levelToTranslevel,
  resolveReadOffset,
  guessMapMode,
};
