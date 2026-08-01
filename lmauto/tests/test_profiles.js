'use strict';

const assert = require('assert');
const { WM } = require('../lib/wm_commands');
const { PROFILES, getProfile, listProfiles, profileWantsChecked } = require('../lib/profiles');

function testListAndGet() {
  const ids = listProfiles();
  assert.ok(ids.includes('l1only_nogrid'));
  assert.ok(ids.includes('l1only_gridlines'));
  assert.ok(ids.includes('l2only_gridlines'));
  assert.ok(ids.includes('l3only_gridlines'));
  assert.ok(ids.includes('spritesonly_gridlines'));
  assert.ok(ids.includes('l1l2only_gridlines'));
  assert.strictEqual(ids.length, Object.keys(PROFILES).length);
  assert.throws(() => getProfile('nope'), /Unknown profile/);
}

function expectLayer(profileId, onLayerCmds, gridOn) {
  const onSet = new Set(Array.isArray(onLayerCmds) ? onLayerCmds : [onLayerCmds]);
  const p = getProfile(profileId);
  assert.ok(p.filePrefix.endsWith(' '), `${profileId} prefix should end with space`);
  for (const id of onSet) {
    assert.strictEqual(profileWantsChecked(p, id), true, `${profileId} ${id} on`);
  }
  for (const id of [WM.VIEW_LAYER1, WM.VIEW_LAYER2, WM.VIEW_LAYER3, WM.VIEW_SPRITES]) {
    if (onSet.has(id)) continue;
    assert.strictEqual(profileWantsChecked(p, id), false, `${profileId} ${id} off`);
  }
  assert.strictEqual(profileWantsChecked(p, WM.VIEW_TILE_GRID), gridOn);
  assert.strictEqual(profileWantsChecked(p, WM.VIEW_ANIMATION), false);
  assert.strictEqual(profileWantsChecked(p, WM.VIEW_LEVEL_ENTRANCES), false);
  assert.strictEqual(p.resetAnimation, true);
  assert.strictEqual(p.zoom100, true);
}

function testLayerProfiles() {
  expectLayer('l1only_nogrid', WM.VIEW_LAYER1, false);
  expectLayer('l1only_gridlines', WM.VIEW_LAYER1, true);
  expectLayer('l2only_gridlines', WM.VIEW_LAYER2, true);
  expectLayer('l3only_gridlines', WM.VIEW_LAYER3, true);
  expectLayer('spritesonly_gridlines', WM.VIEW_SPRITES, true);
  expectLayer('l1l2only_gridlines', [WM.VIEW_LAYER1, WM.VIEW_LAYER2], true);

  assert.strictEqual(getProfile('l1only_nogrid').filePrefix, 'lmlevel_l1only_nogrid ');
  assert.strictEqual(getProfile('spritesonly_gridlines').filePrefix, 'lmlevel_spritesonly_gridlines ');
  assert.strictEqual(getProfile('l1l2only_gridlines').filePrefix, 'lmlevel_l1l2only_gridlines ');
}

function main() {
  testListAndGet();
  testLayerProfiles();
  console.log('PASS: test_profiles');
}

main();
