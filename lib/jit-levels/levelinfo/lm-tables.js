/**
 * Lunar Magic table resolution — port of lmlevelinfo/lm_tables.c
 */

const { read8Snes, read16Snes, read24Snes, snesLoromToPc } = require('../smw-rom');
const { layer1BlobLooksValid } = require('./layer1-validate');

function snes(bank, addr) {
  return ((bank & 0xff) << 16) | (addr & 0xffff);
}

function pcToSnesLoromGuess(rom, pc) {
  if (pc >= rom.size) return null;
  let bank;
  let addr;
  const mapMode = rom.map_mode ?? rom.mapMode ?? 0x20;
  if (mapMode === 0x23) {
    if (rom.size > 0x400000 && pc >= 0x400000) {
      const pc2 = pc - 0x400000;
      bank = 0xc0 + Math.floor(pc2 / 0x10000);
      addr = pc2 % 0x10000;
    } else {
      bank = Math.floor(pc / 0x8000) & 0x3f;
      addr = 0x8000 + (pc % 0x8000);
    }
    return (bank << 16) | addr;
  }
  if (rom.size > 0x400000 && pc >= 0x400000) {
    const pc2 = pc - 0x400000;
    bank = 0x40 + Math.floor(pc2 / 0x8000);
    addr = 0x8000 + (pc2 % 0x8000);
  } else {
    bank = Math.floor(pc / 0x8000) & 0x7f;
    addr = 0x8000 + (pc % 0x8000);
  }
  if (bank > 0xff || addr > 0xffff) return null;
  return (bank << 16) | addr;
}

function pcToSnesHiromGuess(rom, pc) {
  if (pc >= rom.size) return null;
  const bank = 0xc0 + ((Math.floor(pc / 0x10000)) & 0x3f);
  const addr = pc % 0x10000;
  return (bank << 16) | addr;
}

function looksLikeLayer1BlobAtPtr(rom, ptrSnes24) {
  const pc = snesLoromToPc(rom, ptrSnes24);
  if (pc == null || pc + 6 >= rom.size) return false;
  return layer1BlobLooksValid(rom.data, pc, rom.size - pc);
}

function validateLayer1PtrTableBlock(rom, layer1TableSnes24) {
  let ok = 0;
  let total = 0;
  for (let i = 0; i < 0x200; i += 0x11) {
    const id = i & 0x1ff;
    const entry = layer1TableSnes24 + id * 3;
    const ptr = read24Snes(rom, entry);
    total++;
    if (ptr != null && looksLikeLayer1BlobAtPtr(rom, ptr)) ok++;
    if (total >= 32) break;
  }
  return ok >= 24;
}

function findLayer1PtrTableBlock(rom) {
  const step = 0x20;
  const maxPc = rom.size > 0x600 ? rom.size - 0x600 : 0;
  for (let pc = 0; pc <= maxPc; pc += step) {
    let snes24 = pcToSnesLoromGuess(rom, pc);
    if (snes24 != null && validateLayer1PtrTableBlock(rom, snes24)) return snes24;
    snes24 = pcToSnesHiromGuess(rom, pc);
    if (snes24 != null && validateLayer1PtrTableBlock(rom, snes24)) return snes24;
  }
  return null;
}

function lmResolveTables(rom) {
  if (!rom || !rom.data) {
    return { ok: false, error: 'lm_resolve_tables: invalid args' };
  }

  const tables = {
    layer1_ptr_table: snes(0x05, 0xe000),
    layer2_ptr_table: snes(0x05, 0xe600),
    sprite_ptr_table: snes(0x05, 0xec00),
    sprite_bank_table: 0,
    sec_byte1: snes(0x05, 0xf000),
    sec_byte2: snes(0x05, 0xf200),
    sec_byte3: snes(0x05, 0xf400),
    sec_byte4: snes(0x05, 0xf600),
    sec_byte5: 0,
    sec_byte6: 0,
    sec_byte7: 0,
    sec_byte8: 0,
    midway_byte1: 0,
    midway_byte2: 0,
    midway_byte3: 0,
    midway_byte4: 0,
    has_secondary_expansion: false,
    has_midway_hijack: false,
    has_midway_table4: false,
    has_sprite_bank_table: false,
  };

  if (!validateLayer1PtrTableBlock(rom, tables.layer1_ptr_table)) {
    const layer1Found = findLayer1PtrTableBlock(rom);
    if (layer1Found != null) {
      tables.layer1_ptr_table = layer1Found;
      tables.layer2_ptr_table = layer1Found + 0x600;
      tables.sprite_ptr_table = layer1Found + 0xc00;
      tables.sec_byte1 = layer1Found + 0x1000;
      tables.sec_byte2 = layer1Found + 0x1200;
      tables.sec_byte3 = layer1Found + 0x1400;
      tables.sec_byte4 = layer1Found + 0x1600;
    }
  }

  const spriteBankProbe = read8Snes(rom, snes(0x0e, 0xf100));
  if (spriteBankProbe != null && spriteBankProbe !== 0) {
    tables.sprite_bank_table = snes(0x0e, 0xf100);
    tables.has_sprite_bank_table = true;
  }

  const op = read8Snes(rom, snes(0x05, 0xd97d));
  if (op == null) {
    return { ok: false, error: 'Failed to read secondary header hijack probe' };
  }
  if (op === 0x22) {
    const p = read24Snes(rom, snes(0x05, 0xd97e));
    const off = p != null ? read16Snes(rom, p + 5) : null;
    if (p != null && off != null) {
      tables.sec_byte5 = snes(0x05, off);
      tables.has_secondary_expansion = true;
    }
  }

  const midwayOp = read8Snes(rom, snes(0x05, 0xd9e3));
  if (midwayOp === 0x22) {
    const p1 = read24Snes(rom, snes(0x05, 0xd9e4));
    if (p1 != null) {
      tables.midway_byte1 = read24Snes(rom, p1 + 0x0a) || 0;
      tables.midway_byte2 = read24Snes(rom, p1 + 0x29) || 0;
      tables.midway_byte3 = read24Snes(rom, p1 + 0x39) || 0;
      if (tables.midway_byte1 && tables.midway_byte2 && tables.midway_byte3) {
        tables.has_midway_hijack = true;
      }
    }
  }

  if (tables.has_midway_hijack) {
    let cand = 0;
    if (tables.midway_byte2 === tables.midway_byte1 + 0x200 &&
        tables.midway_byte3 === tables.midway_byte1 + 0x400) {
      cand = tables.midway_byte1 + 0x600;
    } else {
      cand = tables.midway_byte3 + 0x200;
    }
    if (cand && read8Snes(rom, cand) != null) {
      tables.midway_byte4 = cand;
      tables.has_midway_table4 = true;
    }
  }

  if (read8Snes(rom, snes(0x06, 0xfa00)) != null) tables.sec_byte6 = snes(0x06, 0xfa00);
  if (read8Snes(rom, snes(0x06, 0xfc00)) != null) tables.sec_byte7 = snes(0x06, 0xfc00);
  if (read8Snes(rom, snes(0x06, 0xfe00)) != null) tables.sec_byte8 = snes(0x06, 0xfe00);

  return { ok: true, tables };
}

module.exports = {
  lmResolveTables,
};
