'use strict';

const assert = require('assert');
const path = require('path');
const {
  KNOWN_HACKS,
  DEFAULT_PROFILES,
  resolveHack,
  parseResolveArgs,
  isValidShortname,
  listKnownHacks,
} = require('../get_hack_meta');

function testKnownTable() {
  assert.strictEqual(KNOWN_HACKS.jumphalf, 19720);
  assert.strictEqual(KNOWN_HACKS.babykaizo, 19145);
  assert.strictEqual(KNOWN_HACKS.mooworld, 23075);
  assert.strictEqual(KNOWN_HACKS.dram3, 41022);
  assert.strictEqual(KNOWN_HACKS.sicarir, 25665);
  assert.ok(listKnownHacks().includes('jumphalf'));
}

function testDefaultProfiles() {
  const need = [
    'l1only_nogrid',
    'l1only_gridlines',
    'l2only_gridlines',
    'l3only_gridlines',
    'spritesonly_gridlines',
    'l1l2only_gridlines',
  ];
  for (const p of need) assert.ok(DEFAULT_PROFILES.includes(p), p);
  assert.strictEqual(DEFAULT_PROFILES.length, 6);
}

function testResolveModeA() {
  assert.deepStrictEqual(resolveHack({ hack: 'jumphalf' }), {
    hack: 'jumphalf',
    gameid: 19720,
  });
  assert.throws(() => resolveHack({ hack: 'notahack' }), /Unknown shortname/);
  assert.throws(() => resolveHack({ hack: 'Bad_Name' }), /Invalid shortname/);
  assert.ok(isValidShortname('akogare'));
  assert.ok(!isValidShortname('ako gare'));
}

function testResolveModeB() {
  assert.deepStrictEqual(resolveHack({ hack: 'newhack', gameid: '99999' }), {
    hack: 'newhack',
    gameid: 99999,
  });
  assert.throws(() => resolveHack({ gameid: '1' }), /both --gameid/);
}

function testParseResolveArgs() {
  assert.deepStrictEqual(parseResolveArgs(['jumphalf']), {
    hack: 'jumphalf',
    gameid: null,
  });
  assert.deepStrictEqual(parseResolveArgs(['--hack=jumphalf']), {
    hack: 'jumphalf',
    gameid: null,
  });
  assert.deepStrictEqual(parseResolveArgs(['--gameid=19720', '--hack=jumphalf']), {
    hack: 'jumphalf',
    gameid: '19720',
  });
}

function main() {
  testKnownTable();
  testDefaultProfiles();
  testResolveModeA();
  testResolveModeB();
  testParseResolveArgs();
  console.log('PASS: test_get_hack_meta');
}

main();
