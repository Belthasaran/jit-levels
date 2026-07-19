/**
 * GFX route resolution — port of lmlevelinfo/gfx_route.c
 */

const GFX_SLOT_AN2 = 0;
const GFX_SLOT_LT3 = 1;
const GFX_SLOT_BG3 = 2;
const GFX_SLOT_BG2 = 3;
const GFX_SLOT_FG3 = 4;
const GFX_SLOT_BG1 = 5;
const GFX_SLOT_FG2 = 6;
const GFX_SLOT_FG1 = 7;
const GFX_SLOT_SP4 = 8;
const GFX_SLOT_SP3 = 9;
const GFX_SLOT_SP2 = 10;
const GFX_SLOT_SP1 = 11;
const GFX_SLOT_LG4 = 12;
const GFX_SLOT_LG3 = 13;
const GFX_SLOT_LG2 = 14;
const GFX_SLOT_LG1 = 15;
const GFX_SLOT_COUNT = 16;

const GFX_ROUTE_MODE_BYPASS = 0;
const GFX_ROUTE_MODE_VANILLA = 1;
const GFX_ROUTE_MODE_TRY_BOTH = 2;

const K_FG_AND_BG_GFX_LIST = new Uint8Array([
  0x14, 0x17, 0x19, 0x15, 0x14, 0x17, 0x1b, 0x18, 0x14, 0x17, 0x1b, 0x16, 0x14, 0x17, 0x0c, 0x1a,
  0x14, 0x17, 0x1b, 0x08, 0x14, 0x17, 0x0c, 0x07, 0x14, 0x17, 0x0c, 0x16, 0x14, 0x17, 0x1b, 0x15,
  0x14, 0x17, 0x19, 0x16, 0x14, 0x17, 0x0d, 0x1a, 0x14, 0x17, 0x1b, 0x08, 0x14, 0x17, 0x1b, 0x18,
  0x14, 0x17, 0x19, 0x1f, 0x14, 0x17, 0x0d, 0x07, 0x14, 0x17, 0x19, 0x1a, 0x14, 0x17, 0x14, 0x14,
  0x0e, 0x0f, 0x17, 0x17, 0x1c, 0x1d, 0x08, 0x1e, 0x1c, 0x1d, 0x08, 0x1e, 0x1c, 0x1d, 0x08, 0x1e,
  0x1c, 0x1d, 0x08, 0x1e, 0x1c, 0x1d, 0x08, 0x1e, 0x1c, 0x1d, 0x08, 0x1e, 0x1c, 0x1d, 0x08, 0x1e,
  0x14, 0x17, 0x19, 0x2c, 0x19, 0x17, 0x1b, 0x18,
]);

const K_MAP16_PAGE_TO_SLOT = [
  GFX_SLOT_SP1,
  GFX_SLOT_SP2,
  GFX_SLOT_FG1,
  GFX_SLOT_FG2,
];

const K_SLOT_NAMES = [
  'AN2', 'LT3', 'BG3', 'BG2', 'FG3', 'BG1', 'FG2', 'FG1',
  'SP4', 'SP3', 'SP2', 'SP1', 'LG4', 'LG3', 'LG2', 'LG1',
];

function gfxRouteSlotName(slotIndex) {
  if (slotIndex < 0 || slotIndex >= GFX_SLOT_COUNT) return '?';
  return K_SLOT_NAMES[slotIndex];
}

function vanillaFileForPage(tileset, page) {
  const ts = tileset >= 26 ? 0 : tileset;
  const idx = ts * 4 + page;
  return K_FG_AND_BG_GFX_LIST[idx < 104 ? idx : 0];
}

function fileIdFromSlotU16(raw, tileset, map16Page) {
  const low12 = raw & 0x0fff;
  if (low12 === 0 || low12 === 0x7f) return 0;
  if (low12 < 0x10 && map16Page >= 0 && map16Page < 4) {
    return vanillaFileForPage(tileset, map16Page);
  }
  const fid = raw & 0xff;
  if (fid === 0 || fid === 0x7f) return 0;
  return fid;
}

function gfxRouteBuild(primary, exgfxBytes) {
  const route = {
    file_id_for_page: [0, 0, 0, 0],
    slot_file_id: new Array(GFX_SLOT_COUNT).fill(0),
    slot_raw_u16: new Array(GFX_SLOT_COUNT).fill(0),
    tileset: primary ? (primary.fgbg_gfx_setting & 0x0f) : 0,
    has_bypass_table: false,
    valid: true,
  };

  for (let p = 0; p < 4; p++) {
    route.file_id_for_page[p] = vanillaFileForPage(route.tileset, p);
  }

  if (exgfxBytes && exgfxBytes.length >= 32) {
    route.has_bypass_table = true;
    for (let s = 0; s < GFX_SLOT_COUNT; s++) {
      const raw = exgfxBytes[s * 2] | (exgfxBytes[s * 2 + 1] << 8);
      let page = -1;
      for (let p = 0; p < 4; p++) {
        if (K_MAP16_PAGE_TO_SLOT[p] === s) page = p;
      }
      route.slot_file_id[s] = fileIdFromSlotU16(raw, route.tileset, page);
      route.slot_raw_u16[s] = raw;
    }
    for (let p = 0; p < 4; p++) {
      const slot = K_MAP16_PAGE_TO_SLOT[p];
      if (route.slot_file_id[slot] !== 0) {
        route.file_id_for_page[p] = route.slot_file_id[slot];
      }
    }
  }

  return route;
}

function gfxRouteFileForTileMode(route, tile8, routeMode = GFX_ROUTE_MODE_BYPASS) {
  const page = (tile8 >> 8) & 0x03;
  if (!route || !route.valid) return page;
  if (routeMode === GFX_ROUTE_MODE_VANILLA) {
    const van = vanillaFileForPage(route.tileset, page);
    return van || route.file_id_for_page[page];
  }
  return route.file_id_for_page[page];
}

function gfxRouteToJson(route) {
  return {
    tileset: route.tileset,
    has_bypass: !!route.has_bypass_table,
    page_files: route.file_id_for_page.slice(),
  };
}

module.exports = {
  GFX_SLOT_COUNT,
  GFX_ROUTE_MODE_BYPASS,
  GFX_ROUTE_MODE_VANILLA,
  GFX_ROUTE_MODE_TRY_BOTH,
  gfxRouteSlotName,
  gfxRouteBuild,
  gfxRouteFileForTileMode,
  gfxRouteToJson,
  vanillaFileForPage,
};
