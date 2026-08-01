'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const {
  hasSmcHeaderSize,
  ensureSmcHeader,
  prepareRomCopy,
  SMC_HEADER_SIZE,
} = require('../lib/rom_prepare');

function testHasSmcHeaderSize() {
  assert.strictEqual(hasSmcHeaderSize(0x80200), true);
  assert.strictEqual(hasSmcHeaderSize(0x80000), false);
  assert.strictEqual(hasSmcHeaderSize(512), true);
  assert.strictEqual(hasSmcHeaderSize(0), false);
}

function testEnsureSmcHeaderAddsOnce() {
  const body = Buffer.alloc(0x80000, 0xab);
  const once = ensureSmcHeader(body);
  assert.strictEqual(once.length, SMC_HEADER_SIZE + body.length);
  assert.ok(hasSmcHeaderSize(once.length));
  assert.strictEqual(once.readUInt8(SMC_HEADER_SIZE), 0xab);

  const twice = ensureSmcHeader(once);
  assert.strictEqual(twice.length, once.length, 'must not double-prefix');
  assert.ok(twice.equals(once));
}

function testPrepareRomCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmauto-rom-'));
  try {
    const src = path.join(dir, 'in.sfc');
    const dest = path.join(dir, 'out.sfc');
    fs.writeFileSync(src, Buffer.alloc(0x80000, 1));
    const r = prepareRomCopy(src, dest);
    assert.strictEqual(r.addedHeader, true);
    assert.strictEqual(r.bytesWritten, SMC_HEADER_SIZE + 0x80000);
    assert.ok(fs.existsSync(dest));

    const dest2 = path.join(dir, 'out2.sfc');
    const r2 = prepareRomCopy(dest, dest2);
    assert.strictEqual(r2.addedHeader, false);
    assert.strictEqual(r2.bytesWritten, r.bytesWritten);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  testHasSmcHeaderSize();
  testEnsureSmcHeaderAddsOnce();
  testPrepareRomCopy();
  console.log('PASS: test_rom_prepare');
}

main();
