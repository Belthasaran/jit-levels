/**
 * LC_LZ3 decompression — Pokemon Gold/Silver / Lunar Compress format.
 * Differs from LC_LZ2: cmd 3 is zero-fill; cmds 4/5/6 are lookback variants.
 * Spec: https://sneslab.net/wiki/LZ3
 */

function bitReverse(v) {
  let o = 0;
  for (let i = 0; i < 8; i++) {
    if (v & (1 << i)) o |= 1 << (7 - i);
  }
  return o;
}

function lcLz3Decompress(src, maxOut = 0x10000) {
  if (!src || src.length === 0) {
    return { ok: false, error: 'lc_lz3_decompress: empty input' };
  }

  const out = Buffer.alloc(maxOut);
  let ip = 0;
  let op = 0;

  while (ip < src.length) {
    const h0 = src[ip++];
    if (h0 === 0xff) break;

    let cmd = (h0 >> 5) & 0x7;
    let len = h0 & 0x1f;
    if (cmd === 0x7) {
      if (ip >= src.length) {
        return { ok: false, error: 'lc_lz3_decompress: truncated long header' };
      }
      const h1 = src[ip++];
      cmd = (h0 >> 2) & 0x7;
      len = ((h0 & 0x3) << 8) | h1;
    }
    const count = len + 1;
    if (op + count > maxOut) {
      return { ok: false, error: 'lc_lz3_decompress: output too large' };
    }

    switch (cmd) {
      case 0x0: {
        if (ip + count > src.length) {
          return { ok: false, error: 'lc_lz3_decompress: truncated direct copy' };
        }
        src.copy(out, op, ip, ip + count);
        ip += count;
        op += count;
        break;
      }
      case 0x1: {
        if (ip >= src.length) {
          return { ok: false, error: 'lc_lz3_decompress: truncated byte fill' };
        }
        const v = src[ip++];
        out.fill(v, op, op + count);
        op += count;
        break;
      }
      case 0x2: {
        if (ip + 2 > src.length) {
          return { ok: false, error: 'lc_lz3_decompress: truncated word fill' };
        }
        const a = src[ip++];
        const b = src[ip++];
        for (let i = 0; i < count; i++) {
          out[op++] = (i & 1) ? b : a;
        }
        break;
      }
      case 0x3: {
        // Zero fill (LZ3; LZ2 uses increment fill here)
        out.fill(0, op, op + count);
        op += count;
        break;
      }
      case 0x4:
      case 0x5:
      case 0x6: {
        if (ip >= src.length) {
          return { ok: false, error: 'lc_lz3_decompress: truncated lookback' };
        }
        const a = src[ip++];
        let addr;
        if (a & 0x80) {
          addr = op - ((a & 0x7f) + 1);
        } else {
          if (ip >= src.length) {
            return { ok: false, error: 'lc_lz3_decompress: truncated abs lookback' };
          }
          const z = src[ip++];
          addr = ((a & 0x7f) << 8) | z;
        }
        if (addr < 0 || addr >= op) {
          return { ok: false, error: 'lc_lz3_decompress: lookback addr beyond output' };
        }
        if (cmd === 0x4) {
          for (let i = 0; i < count; i++) {
            out[op++] = out[addr + i];
          }
        } else if (cmd === 0x5) {
          for (let i = 0; i < count; i++) {
            out[op++] = bitReverse(out[addr + i]);
          }
        } else {
          // Backwards: address is first byte; decrement as each byte is copied
          if (addr - (count - 1) < 0) {
            return { ok: false, error: 'lc_lz3_decompress: backwards lookback OOB' };
          }
          for (let i = 0; i < count; i++) {
            out[op++] = out[addr - i];
          }
        }
        break;
      }
      default:
        return { ok: false, error: 'lc_lz3_decompress: unsupported command' };
    }
  }

  return { ok: true, bytes: out.subarray(0, op), consumed: ip };
}

module.exports = {
  lcLz3Decompress,
  bitReverse,
};
