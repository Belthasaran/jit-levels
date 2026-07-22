/**
 * Stub-driven Lunar Magic virtual unlock (PASS_08).
 * Keys from per-ROM decrypt stubs — never hardcoded classic/fixture immediates.
 *
 * @see lminterop/lm_rom_study/docs/atlas/VIRTUAL_UNLOCK_DESIGN.md
 * @see refmaterial/rlm/rlm.c
 */
'use strict';

const SNES = {
  CRYPTFUNC_OP: 0x00b8df, // JSL operand at $00B8DE+1
  CRYPTPTRS: 0x00b992,
  CRYPTUNK0: 0x00b88b,
  CRYPTUNK1: 0x00b8d8,
  UNKNOWN: 0x03bb1f,
  OWPTR: 0x04d801,
  OVERWORLD: 0x04d807,
  STAGEPTRS: 0x05e000,
  USTAGEPTRS: 0x05e600,
  STAGEFUNC_OP: 0x058606,
  EXGFXPTRS: 0x0ff600,
  SEXGFXPTRS: 0x0ff873,
  STUB_PTR: 0x0df1a0,
  STUB_LEVEL: 0x0df100,
  HIJACK_PTR: 0x00b8de,
  HIJACK_STAGE: 0x058605,
};

const ORG_CRYPT = Buffer.from([0xc2, 0x10, 0xa0, 0x00, 0x00]);
const ORG_STAGE = Buffer.from([0x85, 0x0a, 0xc8, 0xb7, 0x65]);

function isHeadered(size) {
  return size % 0x8000 === 512;
}

function snesToPc(snes, headered) {
  const bank = (snes >>> 16) & 0xff;
  const addr = snes & 0xffff;
  let pc = ((bank & 0x7f) << 15) | (addr & 0x7fff);
  if (headered) pc += 0x200;
  return pc;
}

function u8(buf, pc) {
  return pc >= 0 && pc < buf.length ? buf[pc] : null;
}

function read24le(buf, pc) {
  if (pc < 0 || pc + 2 >= buf.length) return null;
  return buf[pc] | (buf[pc + 1] << 8) | (buf[pc + 2] << 16);
}

function lockSignals(buf, headered) {
  const unknownByte = u8(buf, snesToPc(SNES.UNKNOWN, headered));
  const b8de = u8(buf, snesToPc(SNES.HIJACK_PTR, headered));
  const stage = u8(buf, snesToPc(SNES.HIJACK_STAGE, headered));
  const lev0 = u8(buf, snesToPc(SNES.STUB_LEVEL, headered));
  const ptr0 = u8(buf, snesToPc(SNES.STUB_PTR, headered));
  return {
    ptr_unknown_03BB1F: unknownByte,
    protect_flag_03BB1F_ne_FF: unknownByte !== null && unknownByte !== 0xff,
    hijack_00B8DE_JSL: b8de === 0x22,
    hijack_058605_JSL: stage === 0x22,
    stub_0DF1A0_present: ptr0 === 0x08,
    stub_0DF100_present: lev0 === 0xa6,
  };
}

function classifyLock(headered, byte1ff, signals) {
  const stubHits =
    (signals.hijack_00B8DE_JSL ? 1 : 0) +
    (signals.hijack_058605_JSL ? 1 : 0) +
    (signals.stub_0DF1A0_present ? 1 : 0) +
    (signals.stub_0DF100_present ? 1 : 0) +
    (signals.protect_flag_03BB1F_ne_FF ? 1 : 0);

  if (headered && byte1ff === 1) return 'locked';
  if (stubHits >= 2) return 'locked';
  if (headered && byte1ff === 0 && stubHits === 0) return 'none';
  if (!headered && stubHits >= 2) return 'locked';
  if (!headered) return 'unknown';
  return stubHits > 0 ? 'locked' : 'unknown';
}

/**
 * @param {Buffer|Uint8Array} romBuffer
 */
function detectLock(romBuffer) {
  const buf = Buffer.isBuffer(romBuffer) ? romBuffer : Buffer.from(romBuffer);
  const headered = isHeadered(buf.length);
  const byte1ff = buf.length > 0x1ff ? buf[0x1ff] : null;
  const signals = lockSignals(buf, headered);
  const rom_lock = classifyLock(headered, byte1ff, signals);
  return {
    rom_lock,
    headered,
    byte_0x1ff: byte1ff,
    signals,
    snesToPc: (snes) => snesToPc(snes, headered),
  };
}

/**
 * Extract per-ROM XOR keys from decrypt stubs at $0DF1A0 / $0DF100.
 * @param {Buffer|Uint8Array} romBuffer
 */
function extractLockKeys(romBuffer) {
  const buf = Buffer.isBuffer(romBuffer) ? romBuffer : Buffer.from(romBuffer);
  const headered = isHeadered(buf.length);
  const pcPtr = snesToPc(SNES.STUB_PTR, headered);
  const pcLev = snesToPc(SNES.STUB_LEVEL, headered);
  const errors = [];

  if (u8(buf, pcPtr) !== 0x08) {
    errors.push(`ptr stub @$0DF1A0 expected PHP($08), got ${fmtByte(u8(buf, pcPtr))}`);
  }
  if (u8(buf, pcLev) !== 0xa6) {
    errors.push(`level stub @$0DF100 expected LDX($A6), got ${fmtByte(u8(buf, pcLev))}`);
  }
  if (u8(buf, pcPtr + 5) !== 0x49) {
    errors.push(`ptr stub+5 expected EOR imm($49), got ${fmtByte(u8(buf, pcPtr + 5))}`);
  }

  const ptr_lo = u8(buf, pcPtr + 6);
  const ptr_mid = u8(buf, pcPtr + 7);
  const obj_xor0 = u8(buf, pcLev + 7);
  const obj_xor1 = u8(buf, pcLev + 18);
  const ok =
    errors.length === 0 &&
    ptr_lo !== null &&
    ptr_mid !== null &&
    obj_xor0 !== null &&
    obj_xor1 !== null;

  return {
    ok,
    errors,
    headered,
    stub_pc_ptr: pcPtr,
    stub_pc_level: pcLev,
    ptr_lo,
    ptr_mid,
    ptr_eor16: ok ? ptr_lo | (ptr_mid << 8) : null,
    obj_xor0,
    obj_xor1,
  };
}

function fmtByte(b) {
  return b === null ? 'OOB' : '0x' + b.toString(16);
}

/**
 * Count objects in a Layer1 stream until $FF (optionally decrypting as we walk).
 * Does not mutate buffer when decrypt=false uses a scratch of first 2 bytes per step.
 */
function countStreamObjects(buf, streamPc, objXor0, objXor1, opts = {}) {
  const decrypt = opts.decrypt !== false;
  const maxObjs = opts.maxObjs || 20000;
  const maxBytes = opts.maxBytes || 0x100000;
  let dst = streamPc;
  let count = 0;
  let bytes = 0;
  while (count < maxObjs && bytes < maxBytes) {
    if (dst < 0 || dst >= buf.length) {
      return { count, terminated: false, reason: 'oob', bytes };
    }
    if (buf[dst] === 0xff) {
      return { count, terminated: true, reason: 'ff', bytes };
    }
    let b0 = buf[dst];
    let b1 = dst + 1 < buf.length ? buf[dst + 1] : 0;
    if (decrypt) {
      b0 ^= objXor0;
      b1 ^= objXor1;
    }
    let size = 3;
    const sw = ((b0 >> 1) & 0x30) | (b1 >> 4);
    if (sw === 0x00) {
      const b2 = dst + 2 < buf.length ? buf[dst + 2] : 0;
      if (b2 === 0x00) size = 4;
    } else if (sw === 0x22 || sw === 0x23) {
      size = 4;
    } else if (sw === 0x27) {
      size = 5;
    }
    dst += size;
    bytes += size;
    count++;
  }
  return { count, terminated: false, reason: 'cap', bytes };
}

function decryptLunar(buf, dst, objXor0, objXor1, opts = {}) {
  const maxObjs = opts.maxObjs || 20000;
  let n = 0;
  while (n < maxObjs) {
    if (dst < 0 || dst >= buf.length) return { ok: false, objects: n, error: 'oob' };
    if (buf[dst] === 0xff) return { ok: true, objects: n };
    buf[dst] ^= objXor0;
    if (dst + 1 < buf.length) buf[dst + 1] ^= objXor1;
    let size = 3;
    const sw = ((buf[dst] >> 1) & 0x30) | (buf[dst + 1] >> 4);
    if (sw === 0x00) {
      if (dst + 2 < buf.length && buf[dst + 2] === 0x00) size = 4;
    } else if (sw === 0x22 || sw === 0x23) {
      size = 4;
    } else if (sw === 0x27) {
      size = 5;
    }
    dst += size;
    n++;
  }
  return { ok: false, objects: n, error: 'cap' };
}

function xorPtrLoMid(buf, pc, ptr_lo, ptr_mid) {
  if (pc < 0 || pc + 1 >= buf.length) return;
  buf[pc] ^= ptr_lo;
  buf[pc + 1] ^= ptr_mid;
}

/**
 * In-memory virtual unlock (copy). Does not write disk.
 *
 * @param {Buffer|Uint8Array} romBuffer
 * @param {{ cosmetic?: boolean, stages?: boolean, sexgfx?: boolean }} [opts]
 * @returns {{ ok: boolean, buffer?: Buffer, keys?: object, detect?: object, steps: string[], stats?: object, error?: string }}
 */
function virtualUnlock(romBuffer, opts = {}) {
  const steps = [];
  const detect = detectLock(romBuffer);
  const src = Buffer.isBuffer(romBuffer) ? romBuffer : Buffer.from(romBuffer);

  if (detect.rom_lock === 'none') {
    steps.push('no-op: rom_lock=none');
    return {
      ok: true,
      buffer: Buffer.from(src),
      keys: null,
      detect,
      steps,
      stats: { stages: 0, exgfx: 0, sexgfx: 0 },
      unlock: 'noop',
    };
  }

  const keys = extractLockKeys(src);
  if (!keys.ok) {
    return {
      ok: false,
      detect,
      keys,
      steps: ['FAIL: key extract', ...keys.errors],
      error: 'lock_keys_unavailable',
      unlock: 'failed',
    };
  }

  const buf = Buffer.from(src);
  const h = keys.headered;
  const { ptr_lo, ptr_mid, obj_xor0, obj_xor1 } = keys;
  const stats = { stages: 0, exgfx: 0, sexgfx: 0, stage_errors: 0 };

  // A — misc encrypted ptrs (0x32 lo + 0x32 mid; hi untouched)
  {
    const pc = snesToPc(SNES.CRYPTPTRS, h);
    for (let i = 0; i < 0x32; i++) {
      if (pc + i < buf.length) buf[pc + i] ^= ptr_lo;
      if (pc + i + 0x32 < buf.length) buf[pc + i + 0x32] ^= ptr_mid;
    }
    steps.push(`A1 XOR @$00B992 lo/mid (0x32)`);
  }

  {
    const pc0 = snesToPc(SNES.CRYPTUNK0, h);
    const pc1 = snesToPc(SNES.CRYPTUNK1, h);
    xorPtrLoMid(buf, pc0, ptr_lo, ptr_mid);
    xorPtrLoMid(buf, pc1, ptr_lo, ptr_mid);
    steps.push('A2 XOR CRYPTUNK0/1');
  }

  // ExGFX 128 × 3 — modern LM XORs empty slots too (hi 0/$FF); RLM hi-filter is era-stale (**C** 3.61)
  {
    const pc = snesToPc(SNES.EXGFXPTRS, h);
    for (let i = 0; i < 128 * 3; i += 3) {
      if (pc + i + 1 >= buf.length) break;
      buf[pc + i] ^= ptr_lo;
      buf[pc + i + 1] ^= ptr_mid;
      stats.exgfx++;
    }
    steps.push(`A3 XOR ExGFX @$0FF600 all (${stats.exgfx})`);
  }

  // Super ExGFX — modern LM XORs empty slots too (**C** 3.61: all 3840 differ with hi 0/$FF)
  if (opts.sexgfx !== false) {
    const metaPc = snesToPc(SNES.SEXGFXPTRS, h);
    const snesPtr = read24le(buf, metaPc);
    if (snesPtr !== null && snesPtr !== 0xffffff) {
      const pc = snesToPc(snesPtr, h);
      for (let i = 0; i < 3840 * 3; i += 3) {
        if (pc + i + 1 >= buf.length) break;
        buf[pc + i] ^= ptr_lo;
        buf[pc + i + 1] ^= ptr_mid;
        stats.sexgfx++;
      }
      steps.push(`A4 XOR SEXGFX @$${snesPtr.toString(16)} all (${stats.sexgfx})`);
    } else {
      steps.push('A4 SEXGFX skipped (null/$FFFFFF)');
    }
  }

  // Hard-coded OW pointer
  {
    const pc = snesToPc(SNES.OVERWORLD, h);
    xorPtrLoMid(buf, pc, ptr_lo, ptr_mid);
    steps.push('A5 XOR OW ptr @$04D807');
  }

  // B — OW enhancement rotation (unlock = inverse of protect)
  {
    const pc = snesToPc(SNES.OWPTR, h);
    if (u8(buf, pc) === 0x02 && pc + 9 < buf.length) {
      const mini = Buffer.from(buf.subarray(pc + 1, pc + 10));
      mini.copy(buf, pc + 1 + 5, 0, 4);
      mini.copy(buf, pc + 1, 4, 9);
      steps.push('B OW rotate inverse @$04D801');
    } else {
      steps.push('B OW rotate skipped');
    }
  }

  // C — stage object streams
  if (opts.stages !== false) {
    const pcL1 = snesToPc(SNES.STAGEPTRS, h);
    const pcL2 = snesToPc(SNES.USTAGEPTRS, h);
    for (let i = 0; i < 512 * 3; i += 3) {
      const hi = u8(buf, pcL1 + i + 2);
      if (hi === null || hi < 0x10) continue;
      const snesPtr = read24le(buf, pcL1 + i);
      const dst = snesToPc(snesPtr, h);
      const r = decryptLunar(buf, dst + 5, obj_xor0, obj_xor1);
      if (!r.ok) stats.stage_errors++;
      // Secondary stream (RLM switch on primary header byte1)
      const hdr1 = u8(buf, dst + 1);
      const mode = hdr1 !== null ? hdr1 & 0x1f : 0;
      const skipSecondary =
        mode === 0x00 ||
        mode === 0x0a ||
        mode === 0x0c ||
        mode === 0x0d ||
        mode === 0x0e ||
        mode === 0x11 ||
        mode === 0x1e;
      if (!skipSecondary) {
        const hi2 = u8(buf, pcL2 + i + 2);
        if (hi2 !== null && hi2 >= 0x10 && hi2 !== 0xff) {
          const snes2 = read24le(buf, pcL2 + i);
          const dst2 = snesToPc(snes2, h);
          const r2 = decryptLunar(buf, dst2 + 5, obj_xor0, obj_xor1);
          if (!r2.ok) stats.stage_errors++;
        }
      }
      stats.stages++;
    }
    steps.push(`C decryptLunar stages (${stats.stages}; errors=${stats.stage_errors})`);
  }

  // D — cosmetic (optional)
  if (opts.cosmetic) {
    if (h && buf.length > 0x1ff) buf[0x1ff] = 0;
    const unk = snesToPc(SNES.UNKNOWN, h);
    if (unk < buf.length) buf[unk] = 0xff;
    const hijPtr = snesToPc(SNES.HIJACK_PTR, h);
    const hijSt = snesToPc(SNES.HIJACK_STAGE, h);
    ORG_CRYPT.copy(buf, hijPtr);
    ORG_STAGE.copy(buf, hijSt);
    steps.push('D cosmetic: clear flag + restore JSLs');
  }

  return {
    ok: true,
    buffer: buf,
    keys,
    detect,
    steps,
    stats,
    unlock: 'applied',
  };
}

/**
 * Error thrown / returned when expand refuses a locked ROM without unlock.
 */
class LockedRomError extends Error {
  constructor(message, extra = {}) {
    super(message);
    this.name = 'LockedRomError';
    this.code = 'LOCKED_ROM';
    this.expand = 'unavailable';
    Object.assign(this, extra);
  }
}

/**
 * Prepare ROM bytes for Layer1 expand: fail loud, unlock, or ignore.
 *
 * @param {Buffer|Uint8Array} romBuffer
 * @param {{ unlock?: boolean, lockPolicy?: 'fail'|'unlock'|'ignore' }} [opts]
 * @returns {{ buffer: Buffer, detect: object, unlockResult?: object }}
 */
function prepareRomForExpand(romBuffer, opts = {}) {
  const detect = detectLock(romBuffer);
  const policy =
    opts.lockPolicy ||
    (opts.unlock === true ? 'unlock' : opts.unlock === false ? 'fail' : 'fail');

  // Unlocked / unknown-weak: pass through
  if (detect.rom_lock !== 'locked') {
    const buf = Buffer.isBuffer(romBuffer) ? Buffer.from(romBuffer) : Buffer.from(romBuffer);
    return { buffer: buf, detect, unlockResult: null };
  }

  if (policy === 'ignore') {
    const buf = Buffer.isBuffer(romBuffer) ? Buffer.from(romBuffer) : Buffer.from(romBuffer);
    return { buffer: buf, detect, unlockResult: { unlock: 'skipped' } };
  }

  if (policy === 'fail' && opts.unlock !== true) {
    throw new LockedRomError(
      'ROM is Lunar Magic locked/edit-protected; expand unavailable without virtual unlock (pass unlock:true)',
      { rom_lock: detect.rom_lock, detect }
    );
  }

  const unlockResult = virtualUnlock(romBuffer, opts);
  if (!unlockResult.ok) {
    throw new LockedRomError(
      `Virtual unlock failed: ${unlockResult.error || 'unknown'}`,
      { rom_lock: detect.rom_lock, detect, unlockResult }
    );
  }
  return { buffer: unlockResult.buffer, detect, unlockResult };
}

module.exports = {
  SNES,
  isHeadered,
  snesToPc,
  detectLock,
  extractLockKeys,
  countStreamObjects,
  decryptLunar,
  virtualUnlock,
  prepareRomForExpand,
  LockedRomError,
};
