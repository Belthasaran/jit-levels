/**
 * Layer1 blob plausibility checks — port of lmlevelinfo/layer1_validate + helpers from level_parse.c
 */

function objectLenForStandard(objId, buf, offset, avail) {
  if (objId === 0x22 || objId === 0x23) return 4;
  if (objId === 0x2d) return 5;
  if (objId === 0x27 || objId === 0x29) {
    if (!buf || avail < 5) return 5;
    const b2 = buf[offset + 2];
    const b3 = buf[offset + 3];
    const mode = (b3 >> 6) & 0x3;
    if (mode === 0x0 || mode === 0x1) return 5;
    if (mode === 0x2) return 6;
    return (b2 & 0x80) ? 8 : 7;
  }
  return 3;
}

function objectLenForExtended(extId) {
  if (extId === 0x00) return 4;
  if (extId === 0x02) return 5;
  return 3;
}

function layer1BlobLooksValid(p, offset, len) {
  if (!p || len < 6) return false;
  const base = offset || 0;
  const max = base + (len > 0x20000 ? 0x20000 : len);
  if (p[base] === 0xff && p[base + 1] === 0xff && p[base + 2] === 0xff &&
      p[base + 3] === 0xff && p[base + 4] === 0xff) {
    return false;
  }

  let i = base + 5;
  let objs = 0;
  while (i < max) {
    const b0 = p[i];
    if (b0 === 0xff) return true;
    if (i + 3 > max) return false;

    const bb = (b0 >> 5) & 0x3;
    const b1 = p[i + 1];
    const b2 = p[i + 2];
    const bbbb = (b1 >> 4) & 0xf;
    const standardId = (bb << 4) | bbbb;

    let olen;
    if (standardId === 0x00) {
      olen = objectLenForExtended(b2);
    } else {
      olen = objectLenForStandard(standardId, p, i, max - i);
    }
    if (olen === 0 || i + olen > max) return false;
    i += olen;
    objs++;
    if (objs > 200000) return false;
  }
  return false;
}

module.exports = {
  objectLenForStandard,
  objectLenForExtended,
  layer1BlobLooksValid,
};
