'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');
const PROBE = path.join(ROOT, 'lminterop/lm_rom_study/tools/rom_lock_probe.cjs');
const ENODE = path.join(ROOT, 'enode.sh');
const UNLOCKED = path.join(ROOT, 'lmlevelinfo/vanilla/vanilla-lm-a.sfc');
const LOCKED = path.join(ROOT, 'lmlevelinfo/vanilla/vanilla-lm-locked.sfc');
const AKO = path.join(ROOT, 'lmlevelinfo/test/akogare/orig_Ako.sfc');

function runProbe(rom, extraArgs = []) {
  const r = spawnSync(ENODE, [PROBE, `--rom=${rom}`, ...extraArgs], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  if (r.status !== 0) {
    throw new Error(`probe failed: ${r.stderr || r.stdout}`);
  }
  const line = (r.stdout || '').trim().split('\n').filter(Boolean).pop();
  assert.ok(line && line.startsWith('rom_lock='), `bad output: ${r.stdout}`);
  return line.slice('rom_lock='.length);
}

function testHelp() {
  const r = spawnSync(ENODE, [PROBE, '--help'], { encoding: 'utf8', cwd: ROOT });
  assert.strictEqual(r.status, 0);
  assert.ok((r.stdout || '').includes('--rom='));
  assert.ok((r.stdout || '').includes('--for-export'));
}

function testUnlocked() {
  if (fs.existsSync(UNLOCKED)) {
    assert.strictEqual(runProbe(UNLOCKED), 'none');
  } else {
    console.log('SKIP: vanilla-lm-a.sfc missing');
  }
  // Suite ROMs are unheadered → raw unknown; --for-export → none
  if (fs.existsSync(AKO)) {
    assert.strictEqual(runProbe(AKO, ['--for-export']), 'none');
  }
  const jh = path.join(ROOT, 'lmlevelinfo/test/jumphalf/jumphalf.sfc');
  if (fs.existsSync(jh)) {
    assert.strictEqual(runProbe(jh, ['--for-export']), 'none');
  }
}

function testLocked() {
  if (!fs.existsSync(LOCKED)) {
    console.log('SKIP: vanilla-lm-locked.sfc missing');
    return;
  }
  assert.strictEqual(runProbe(LOCKED), 'locked');
  assert.strictEqual(runProbe(LOCKED, ['--for-export']), 'locked');
}

function testGatingRejects() {
  // Mirror get_hack.sh / --for-export policy
  function allowExport(lock) {
    return lock === 'none';
  }
  assert.strictEqual(allowExport('none'), true);
  assert.strictEqual(allowExport('locked'), false);
  assert.strictEqual(allowExport('unknown'), false);
}

function main() {
  testHelp();
  testUnlocked();
  testLocked();
  testGatingRejects();
  console.log('PASS: test_rom_lock_probe');
}

main();
