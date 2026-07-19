/**
 * LC_LZ2 decompression — port of lmlevelinfo/lc_lz2.c
 */

function lcLz2Decompress(src, maxOut = 0x10000) {
  if (!src || src.length === 0) {
    return { ok: false, error: 'lc_lz2_decompress: empty input' };
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
        return { ok: false, error: 'lc_lz2_decompress: truncated long header' };
      }
      const h1 = src[ip++];
      cmd = (h0 >> 2) & 0x7;
      len = ((h0 & 0x3) << 8) | h1;
    }
    const count = len + 1;
    if (op + count > maxOut) {
      return { ok: false, error: 'lc_lz2_decompress: output too large' };
    }

    switch (cmd) {
      case 0x0: {
        if (ip + count > src.length) {
          return { ok: false, error: 'lc_lz2_decompress: truncated direct copy' };
        }
        src.copy(out, op, ip, ip + count);
        ip += count;
        op += count;
        break;
      }
      case 0x1: {
        if (ip >= src.length) {
          return { ok: false, error: 'lc_lz2_decompress: truncated byte fill' };
        }
        const v = src[ip++];
        out.fill(v, op, op + count);
        op += count;
        break;
      }
      case 0x2: {
        if (ip + 2 > src.length) {
          return { ok: false, error: 'lc_lz2_decompress: truncated word fill' };
        }
        const a = src[ip++];
        const b = src[ip++];
        for (let i = 0; i < count; i++) {
          out[op++] = (i & 1) ? b : a;
        }
        break;
      }
      case 0x3: {
        if (ip >= src.length) {
          return { ok: false, error: 'lc_lz2_decompress: truncated inc fill' };
        }
        const v = src[ip++];
        for (let i = 0; i < count; i++) {
          out[op++] = (v + i) & 0xff;
        }
        break;
      }
      case 0x4: {
        if (ip + 2 > src.length) {
          return { ok: false, error: 'lc_lz2_decompress: truncated repeat addr' };
        }
        const addr = (src[ip] << 8) | src[ip + 1];
        ip += 2;
        if (addr >= op) {
          return { ok: false, error: 'lc_lz2_decompress: repeat addr beyond output' };
        }
        for (let i = 0; i < count; i++) {
          out[op++] = out[addr + i];
        }
        break;
      }
      default:
        return { ok: false, error: 'lc_lz2_decompress: unsupported command' };
    }
  }

  return { ok: true, bytes: out.subarray(0, op), consumed: ip };
}

module.exports = {
  lcLz2Decompress,
};
