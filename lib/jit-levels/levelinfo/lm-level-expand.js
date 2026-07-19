/**
 * Layer1 Map16 grid expand — port of lmlevelinfo/lm_level_expand.c (L1 fingerprint path).
 */

'use strict';

const { createRomFromBuffer, parseLevelIdToInt } = require('../smw-rom');
const { lmResolveTables } = require('./lm-tables');
const { parseLevelInfoRaw } = require('./level-parse');
const { object_emit_map16_tiles, OBJMAP_HANDLED, OBJMAP_NONVISUAL } = require('./obj-to-map16');

const LM_MAP16_GRID_CAP = 0x3800;
const LM_MAP16_EMPTY_TILE = 0x0025;

function levelModeIsVertical(mode) {
  switch (mode & 0xff) {
    case 0x08:
    case 0x09:
    case 0x0a:
    case 0x0b:
    case 0x0c:
    case 0x0d:
    case 0x1a:
    case 0x1b:
      return 1;
    default:
      return 0;
  }
}

function computeScreens(info) {
  if (!info) return 1;
  if (info.primary.length_in_screens === -1) return 32;
  if (info.primary.length_in_screens < 0) return 1;
  const screens = (info.primary.length_in_screens >>> 0) + 1;
  return screens || 1;
}

function lmCanvasGeomFromLevel(info) {
  const out = {
    screens: 1,
    tiles_w: 16,
    tiles_h: 27,
    pixel_w: 256,
    pixel_h: 432,
    vertical_mode: 0,
  };
  if (!info) return out;
  out.vertical_mode = levelModeIsVertical(info.primary.level_mode);
  out.screens = computeScreens(info);
  let tiles_h = 27;
  if (out.vertical_mode && info.primary.vertical_scroll_set) tiles_h = 32;
  if (out.vertical_mode) {
    out.tiles_w = 16;
    out.tiles_h = out.screens * tiles_h;
  } else {
    out.tiles_w = out.screens * 16;
    out.tiles_h = tiles_h;
  }
  out.pixel_w = out.tiles_w * 16;
  out.pixel_h = out.tiles_h * 16;
  return out;
}

function lmMap16CellIndex(g, x_tile, y_tile) {
  if (!g) return LM_MAP16_GRID_CAP;
  if (g.vertical_mode) {
    let screen_h = Math.floor(g.tiles_h / (g.screens || 1));
    if (screen_h === 0) screen_h = 27;
    const screen = Math.floor(y_tile / screen_h);
    const y_local = y_tile % screen_h;
    if (x_tile >= 16) return LM_MAP16_GRID_CAP;
    const stride = g.screen_stride || 16 * screen_h;
    const idx = screen * stride + y_local * 16 + x_tile;
    return idx < LM_MAP16_GRID_CAP ? idx : LM_MAP16_GRID_CAP;
  }
  const screen = x_tile >> 4;
  const stride = g.screen_stride || 16 * (g.tiles_h || 27);
  const idx = screen * stride + y_tile * 16 + (x_tile & 15);
  return idx < LM_MAP16_GRID_CAP ? idx : LM_MAP16_GRID_CAP;
}

function lmMap16GridClear(g) {
  for (let i = 0; i < LM_MAP16_GRID_CAP; i++) {
    g.tiles[i] = LM_MAP16_EMPTY_TILE;
    g.attrs[i] = 0;
  }
  g.cells_written = 0;
  g.cells_unique = 0;
}

function lmMap16GridInit(g, geom) {
  g.tiles = new Uint16Array(LM_MAP16_GRID_CAP);
  g.attrs = new Uint8Array(LM_MAP16_GRID_CAP);
  if (geom) {
    g.screens = geom.screens || 1;
    g.tiles_w = geom.tiles_w;
    g.tiles_h = geom.tiles_h;
    g.vertical_mode = geom.vertical_mode;
  } else {
    g.screens = 1;
    g.tiles_w = 16;
    g.tiles_h = 27;
    g.vertical_mode = 0;
  }
  let row_h = g.vertical_mode ? Math.floor(g.tiles_h / (g.screens || 1)) : g.tiles_h;
  if (row_h === 0) row_h = 27;
  g.screen_stride = 16 * row_h;
  lmMap16GridClear(g);
}

function lmMap16GridGet(g, x_tile, y_tile) {
  if (!g) return LM_MAP16_EMPTY_TILE;
  const idx = lmMap16CellIndex(g, x_tile, y_tile);
  if (idx >= LM_MAP16_GRID_CAP) return LM_MAP16_EMPTY_TILE;
  return g.tiles[idx];
}

function lmMap16GridSet(g, x_tile, y_tile, map16_id, attr) {
  if (!g) return 0;
  const idx = lmMap16CellIndex(g, x_tile, y_tile);
  if (idx >= LM_MAP16_GRID_CAP) return 0;
  const was_empty = g.tiles[idx] === LM_MAP16_EMPTY_TILE;
  g.tiles[idx] = map16_id & 0xffff;
  g.attrs[idx] = attr & 0xff;
  g.cells_written++;
  if (was_empty && map16_id !== LM_MAP16_EMPTY_TILE) g.cells_unique++;
  else if (!was_empty && map16_id === LM_MAP16_EMPTY_TILE && g.cells_unique) g.cells_unique--;
  return 1;
}

function expandEmitFn(t, ec) {
  if (!t || !ec) return 0;
  if (t.map16_tile === 0x0036) {
    const cur = lmMap16GridGet(ec.g, t.x_tile, t.y_tile);
    if (cur !== LM_MAP16_EMPTY_TILE && cur !== 0x0026) return 1;
  }
  if (t.empty_only && lmMap16GridGet(ec.g, t.x_tile, t.y_tile) !== LM_MAP16_EMPTY_TILE) {
    return 1;
  }
  if (!lmMap16GridSet(ec.g, t.x_tile, t.y_tile, t.map16_tile, t.attr || 0)) return 0;
  return 1;
}

function lmLevelExpandObjects(g, objects, emitCtx, stats) {
  if (!g || !emitCtx) return 0;
  const ec = { g, stats };
  const list = objects || [];
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (stats) {
      stats.total_objects++;
      if (o.decoded && o.decoded.present) stats.decoded_present++;
    }
    const r = object_emit_map16_tiles(o, emitCtx, expandEmitFn, ec);
    if (stats) {
      if (r === OBJMAP_NONVISUAL) stats.skipped_nonvisual++;
      else if (r === OBJMAP_HANDLED) stats.handled++;
      else stats.unknown++;
    }
  }
  return 1;
}

/**
 * Expand Layer1 (and optionally Layer2) into a Map16 grid — matches C lm_level_expand_from_info.
 */
function lmLevelExpandFromInfo(info, includeLayer1, includeLayer2, stats) {
  const g = {};
  const geom = lmCanvasGeomFromLevel(info);
  lmMap16GridInit(g, geom);

  const emitCtx = {
    level_tileset: (info.primary.fgbg_gfx_setting || 0) & 0x0f,
    vertical_scroll: info.primary.vertical_scroll_set || 0,
    screens_in_level: geom.screens || 1,
  };

  if (includeLayer2 && info.layer2_data_ptr_snes) {
    if (info.layer2_is_bg_tilemap && info.layer2_bg_tiles && info.layer2_bg_width && info.layer2_bg_height) {
      const w2 = info.layer2_bg_width;
      const h2 = info.layer2_bg_height;
      g.vertical_mode = 0;
      g.screens = Math.floor((w2 + 15) / 16);
      g.tiles_w = w2;
      g.tiles_h = h2;
      g.screen_stride = 16 * h2;
      for (let yy = 0; yy < h2; yy++) {
        for (let xx = 0; xx < w2; xx++) {
          const tid = info.layer2_bg_tiles[yy * w2 + xx];
          lmMap16GridSet(g, xx, yy, 0x8000 | (tid & 0x7fff), 0);
        }
      }
    } else if (info.layer2_objects && info.layer2_objects_count) {
      lmLevelExpandObjects(g, info.layer2_objects, emitCtx, stats);
    }
  }
  if (includeLayer1 && info.objects && info.objects.length) {
    lmLevelExpandObjects(g, info.objects, emitCtx, stats);
  }
  return g;
}

/**
 * Print-compatible fingerprint lines matching lm_pipeline_dump --fingerprint.
 * @returns {{ fingerprints: string[], screens: Array<{screen:number, fingerprint:string}>, grid: object }}
 */
function fingerprintFromGrid(grid) {
  const screens = grid.screens || 1;
  const stride = grid.screen_stride || 16 * 27;
  let screen_h = Math.floor(stride / 16);
  if (screen_h === 0) screen_h = 27;

  const screenRows = [];
  const fingerprints = [];

  for (let s = 0; s < screens; s++) {
    const base = s * stride;
    let ntiles = 16 * screen_h;
    if (base >= LM_MAP16_GRID_CAP) {
      screenRows.push({ screen: s, fingerprint: 'empty' });
      continue;
    }
    if (base + ntiles > LM_MAP16_GRID_CAP) ntiles = LM_MAP16_GRID_CAP - base;

    let any = false;
    for (let i = 0; i < ntiles; i++) {
      if (grid.tiles[base + i] !== LM_MAP16_EMPTY_TILE) {
        any = true;
        break;
      }
    }
    if (!any) {
      screenRows.push({ screen: s, fingerprint: 'empty' });
      continue;
    }
    let hex = 'v2:';
    for (let i = 0; i < ntiles; i++) {
      let t = grid.tiles[base + i];
      if (t === LM_MAP16_EMPTY_TILE) t = 0;
      hex += (t & 0xffff).toString(16).padStart(4, '0');
    }
    screenRows.push({ screen: s, fingerprint: hex });
    fingerprints.push(hex);
  }
  return { fingerprints, screens: screenRows, grid };
}

/**
 * Expand Layer1 Map16 from a ROM buffer and return v2 fingerprints.
 */
function expandLayer1Map16Fingerprints(romBuffer, levelId) {
  const rom = createRomFromBuffer(romBuffer);
  const tablesRes = lmResolveTables(rom);
  if (!tablesRes.ok) throw new Error(tablesRes.error || 'Table resolve failed');
  const id = parseLevelIdToInt(levelId);
  if (id == null) throw new Error(`Invalid LEVEL_ID: ${levelId}`);
  const parseRes = parseLevelInfoRaw(rom, tablesRes.tables, id);
  if (!parseRes.ok) throw new Error(parseRes.error || 'Parse failed');
  const grid = lmLevelExpandFromInfo(parseRes.info, 1, 0, null);
  return fingerprintFromGrid(grid);
}

module.exports = {
  LM_MAP16_GRID_CAP,
  LM_MAP16_EMPTY_TILE,
  lmCanvasGeomFromLevel,
  lmMap16CellIndex,
  lmMap16GridInit,
  lmMap16GridGet,
  lmMap16GridSet,
  lmLevelExpandFromInfo,
  fingerprintFromGrid,
  expandLayer1Map16Fingerprints,
};
