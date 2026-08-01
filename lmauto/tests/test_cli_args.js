'use strict';

const assert = require('assert');
const { parseArgs } = require('../lib/cli_args');

function testParse() {
  const a = parseArgs([
    '--rom=/tmp/a.sfc',
    '--profile=l1only_nogrid',
    '--out=/tmp/out',
    '--all-levels',
    '--auto-set-screens',
    '--timeout-ms=1000',
  ]);
  assert.strictEqual(a.rom, '/tmp/a.sfc');
  assert.strictEqual(a.profile, 'l1only_nogrid');
  assert.strictEqual(a.out, '/tmp/out');
  assert.strictEqual(a.allLevels, true);
  assert.strictEqual(a.autoSetScreens, true);
  assert.strictEqual(a.timeoutMs, 1000);
  assert.strictEqual(a.help, false);
}

function testHelp() {
  const a = parseArgs(['--help']);
  assert.strictEqual(a.help, true);
}

function testUnknown() {
  assert.throws(() => parseArgs(['--nope']), /Unknown argument/);
}

function main() {
  testParse();
  testHelp();
  testUnknown();
  console.log('PASS: test_cli_args');
}

main();
