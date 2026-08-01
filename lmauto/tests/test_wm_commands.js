'use strict';

const assert = require('assert');
const { WM, DLG_EXPORT_IMAGES, DEFAULT_OVERLAYS_OFF } = require('../lib/wm_commands');

function testRequiredIds() {
  assert.strictEqual(WM.EXPORT_MULTIPLE_LEVELS_IMAGES, 9148);
  assert.strictEqual(WM.EXPORT_LEVEL_IMAGE, 9149);
  assert.strictEqual(WM.VIEW_LAYER1, 9200);
  assert.strictEqual(WM.VIEW_LAYER2, 9201);
  assert.strictEqual(WM.VIEW_SPRITES, 9203);
  assert.strictEqual(WM.VIEW_ANIMATION, 9220);
  assert.strictEqual(WM.VIEW_TILE_GRID, 9224);
  assert.strictEqual(WM.VIEW_RESET_ANIMATIONS, 9230);
  assert.strictEqual(WM.VIEW_LAYER3, 9231);
  assert.strictEqual(WM.VIEW_LEVEL_ENTRANCES, 9236);
  assert.strictEqual(WM.VIEW_ZOOM_100, 9290);
  assert.strictEqual(WM.OPEN_ROM, 9100);
}

function testDialog1027() {
  assert.strictEqual(DLG_EXPORT_IMAGES.CAPTION, 'Export Levels to Images');
  assert.strictEqual(DLG_EXPORT_IMAGES.SELECT_DIR_FILE, 1);
  assert.strictEqual(DLG_EXPORT_IMAGES.ONLY_MODIFIED, 149);
  assert.strictEqual(DLG_EXPORT_IMAGES.AUTO_SET_SCREENS, 8867);
}

function testOverlays() {
  assert.ok(DEFAULT_OVERLAYS_OFF.includes(WM.VIEW_LEVEL_ENTRANCES));
  assert.ok(DEFAULT_OVERLAYS_OFF.includes(WM.VIEW_SCREEN_EXITS));
}

function main() {
  testRequiredIds();
  testDialog1027();
  testOverlays();
  console.log('PASS: test_wm_commands');
}

main();
