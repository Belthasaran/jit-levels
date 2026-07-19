/**
 * object → Map16 tile emit — port of lmlevelinfo/obj_to_map16.c
 */
'use strict';

const OBJ_STANDARD = 1;
const OBJ_EXTENDED = 2;
const OBJ_SCREEN_EXIT = 3;
const OBJ_DEC_LM_22_MAP16_PAGE0 = 1;
const OBJ_DEC_LM_23_MAP16_PAGE1 = 2;
const OBJ_DEC_LM_27_DIRECT_MAP16_P00_3F = 6;
const OBJ_DEC_LM_29_DIRECT_MAP16_P40_7F = 8;
const OBJMAP_UNKNOWN = 0;
const OBJMAP_HANDLED = 1;
const OBJMAP_NONVISUAL = 2;



// snesrev smw_0d.c kStdObjXX_Generic1RepeatedTileObject_Tiles (grassland/castle/underground share StdObj05).
const kGenericRepeatedTiles = [
    0x02, 0x21, 0x23, 0x2a, 0x2b, 0x3f, 0x03, 0x13, 0x1e, 0x24, 0x2e, 0x2f, 0x30, 0x32, 0x65,
];

// Tileset-specific 0x2E-0x3F fallback low bytes (page 0 unless noted).
const kTilesetSpecLow = [
    0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f, 0x3f,
    0x1e, 0x1e, 0x1e, 0x1e, 0x1e, 0x1e,
];
const kTilesetSpecPage = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
];

const kVertPipeTopL = [ 0x33, 0x37, 0x39, 0x00, 0x00 ];
const kVertPipeTopR = [ 0x34, 0x38, 0x3a, 0x00, 0x00 ];
const kVertPipeBotL = [ 0x00, 0x00, 0x39, 0x33, 0x37 ];
const kVertPipeBotR = [ 0x00, 0x00, 0x3a, 0x34, 0x38 ];

/* Horizontal pipe is 2 tiles tall (LM: "top tile" / "bottom tile"). Style nibble picks end cap. */
const kHorizPipeTopEnd = [0x3b, 0x3b, 0x3b, 0x3b];
const kHorizPipeBotEnd = [0x3c, 0x3f, 0x3c, 0x3f];
const kHorizPipeTopShaft = 0x3d;
const kHorizPipeBotShaft = 0x3e;

// snesrev smw_0d.c kExtObjXX_Generic1TileObject_Tiles
const kExtGenericTiles = [
    0x1f, 0x22, 0x24, 0x42, 0x43, 0x27, 0x29, 0x25, 0x6e, 0x6f, 0x70, 0x71, 0x72, 0x45, 0x46,
    0x47, 0x48, 0x36, 0x37, 0x11, 0x12, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c,
    0x29, 0x1d, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x25, 0x26, 0x27, 0x28, 0x2a, 0xde, 0xe0, 0xe2, 0xe4,
    0xec, 0xed, 0x2c, 0x25, 0x2d,
];

const kWaterTopTiles = [ 0x00, 0x01, 0x04, 0x08 ];
const kWaterBottomTiles = [ 0x02, 0x03, 0x05, 0x0b ];

// snesrev smw_0d.c cloud fringe / grass tileset objects (page 0).
const kExtObj68CloudFringeTiles = [ 0x91, 0x92, 0x96, 0x97, 0x9a, 0x9b, 0x9f, 0xa0 ];
const kGrassObj3DTopCloudTiles = [ 0x93, 0x9c ];
const kGrassObj3ESideCloudTop = [ 0x94, 0x8f, 0x9d, 0x98, 0x95, 0x90, 0x9e, 0x99 ];
const kGrassObj3ESideCloudBot = [ 0x8f, 0x8f, 0x98, 0x98, 0x90, 0x90, 0x99, 0x99 ];

/* snesrev ExtObjXX_LargeBush — page 0 lows; 0x25 skips (air). Big=9x5, Small=6x4. */
const kExtLargeBushBigTiles = [
    0x25, 0x25, 0x25, 0x4b, 0x4d, 0x4e, 0x25, 0x25, 0x25, 0x25, 0x25, 0x54, 0x49, 0x49, 0x5f,
    0x63, 0x25, 0x25, 0x25, 0x25, 0x57, 0x49, 0x49, 0x52, 0x4a, 0x5d, 0x25, 0x25, 0x5a, 0x49,
    0x49, 0x50, 0x51, 0x4a, 0x60, 0x25, 0x5a, 0x49, 0x49, 0x49, 0x53, 0x4a, 0x4a, 0x4a, 0x63,
];
const kExtLargeBushSmallTiles = [
    0x25, 0x25, 0x4b, 0x4c, 0x25, 0x25, 0x25, 0x54, 0x49, 0x5f, 0x63, 0x25,
    0x25, 0x57, 0x49, 0x52, 0x4a, 0x5d, 0x5a, 0x49, 0x49, 0x49, 0x4f, 0x60,
];
const kGrassObj3F_SmallBushes_Left = [ 0x73, 0x7a, 0x85, 0x88, 0xc3 ];
const kGrassObj3F_SmallBushes_Mid = [ 0x74, 0x7b, 0x86, 0x89, 0xc3 ];
const kGrassObj3F_SmallBushes_Right = [ 0x79, 0x80, 0x87, 0x8e, 0xc3 ];
/* snesrev GrassObj39_RightFacingDiagonalPipe — page 1 lows; final 0xEB after rows. */
const kGrassObj39_DiagonalPipeTiles = [
    0xc4, 0xc5, 0xc7, 0xec, 0xed, 0xc6, 0xc7, 0xee, 0x59, 0x5a, 0xef, 0xc7, 0xee, 0x59, 0x5b, 0x5c,
];

/* snesrev ExtObj66/67 GhostHouse diagonal beam: 4x4 page0 lows; 0x25 = air skip.
 * Two variants via (id - 0x66) * 16 byte offset into this table. */
const kExtObj66_GhostHouseBeamTiles = [
    0x25, 0x25, 0x7a, 0x7b, 0x25, 0x7c, 0x7d, 0x25, 0x7c, 0x7d, 0x25, 0x25, 0x7d, 0x25, 0x25, 0x25,
    0x7e, 0x7f, 0x25, 0x25, 0x25, 0x80, 0x81, 0x25, 0x25, 0x25, 0x80, 0x81, 0x25, 0x25, 0x25, 0x80,
];

function object_emit_classify(o) {
  if (!o) return OBJMAP_UNKNOWN;
  if (o.kind == OBJ_SCREEN_EXIT) return OBJMAP_NONVISUAL;
  if (o.kind == OBJ_EXTENDED) {
    if (o.object_number == 0x01 || o.object_number == 0x02 || o.object_number == 0x03) return OBJMAP_NONVISUAL;
    if (o.object_number >= 0x55 && o.object_number <= 0x5A) return OBJMAP_NONVISUAL;
    if (o.object_number == 0x84 || o.object_number == 0x8B) return OBJMAP_NONVISUAL;
    return OBJMAP_UNKNOWN;
  }
  if (o.kind == OBJ_STANDARD) {
    if (o.object_number == 0x24 || o.object_number == 0x25 || o.object_number == 0x26 ||
        o.object_number == 0x28 || o.object_number == 0x2D) {
      return OBJMAP_NONVISUAL;
    }
  }
  return OBJMAP_UNKNOWN;
}

function emit_one_attr(emit, user_ctx, map16_id, x, y,
                         attr) {
  if (!emit) return 1;
  const t = {};
  t.map16_tile = map16_id;
  t.x_tile = x;
  t.y_tile = y;
  t.attr = attr;
  t.empty_only = 0;
  return emit(t, user_ctx) ? 1 : 0;
}

function emit_one(emit, user_ctx, map16_id, x, y) {
  return emit_one_attr(emit, user_ctx, map16_id, x, y, 0);
}

function map16_from_page_low(page, low) {
  return (page * 0x100 + low);
}

/* SMW/LM rectangular object size nibbles are length-minus-one (0 → 1 tile). */
function obj_nibble_size(nibble4) {
  return ((nibble4 & 0x0F) + 1);
}

function emit_rect_fill(emit, user_ctx, base_x, base_y,
                          w, h, page, low_tile) {
  let tid = map16_from_page_low(page, low_tile);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (!emit_one(emit, user_ctx, tid, (base_x + xx), (base_y + yy))) return 0;
    }
  }
  return 1;
}

function uses_generic_fill_table(id) {
  /* StdObj05_Coins covers 0x01-0x0E (tile from kGenericRepeatedTiles[id-1]).
   * 0x10/0x12/0x16+ have dedicated emitters — do not treat as generic fill. */
  if (id >= 0x01 && id <= 0x0E) return 1;
  return 0;
}

function emit_generic_fill(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD) return 0;
  let id = o.object_number;
  if (!uses_generic_fill_table(id)) return 0;
  let k = id - 1;
  if (k < 0 || k >= 15) return 0;

  let low = kGenericRepeatedTiles[k];
  let page = (k >= 7) ? 1 : 0;
  let settings = o.settings;
  let w = obj_nibble_size((settings & 0x0F));
  let h = obj_nibble_size((settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_rect_fill(emit, user_ctx, bx, by, w, h, page, low);
}

/* snesrev StdObj21_WideScaleGroundLedge_0DB1E3 — top row page1 0x00, body rows page0 0x3F.
 * Obj 0x14 (StandardLedgeEntry): W/H nibbles are length-minus-one.
 * Obj 0x21: settings byte is width-minus-one; height fixed at 2 body rows after top. */
function emit_wide_scale_ground_ledge(emit, user_ctx, bx, by,
                                       width, height) {
  if (width == 0 || height == 0) return 1;
  for (let xx = 0; xx < width; xx++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0x00), (bx + xx), by)) return 0;
  }
  for (let row = 1; row < height; row++) {
    for (let xx = 0; xx < width; xx++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, 0x3F), (bx + xx), (by + row)))
        return 0;
    }
  }
  return 1;
}

function emit_ground_ledge(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x14) return 0;
  let w = ((o.settings & 0x0F) + 1);
  let h = ((o.settings >> 4) + 1);
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_wide_scale_ground_ledge(emit, user_ctx, bx, by, w, h);
}

/* snesrev StdObj13_GroundEdgesAndVine — vertical column; low nibble selects edge/vine type. */
function emit_ground_edges(o, emit, user_ctx) {
  const kTop = [0x40, 0x41, 0x06, 0x45, 0x4b, 0x48, 0x4c, 0x01, 0x03, 0xb6,
                                   0xb7, 0x45, 0x4b, 0x48, 0x4c];
  const kMid = [0x40, 0x41, 0x06, 0x4b, 0x4b, 0x4c, 0x4c, 0x40, 0x41, 0x4b,
                                   0x4c, 0x4b, 0x4b, 0x4c, 0x4c];
  const kBot = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                                   0xff, 0xe2, 0xe2, 0xe4, 0xe4];
  if (o.kind != OBJ_STANDARD || o.object_number != 0x13) return 0;
  let typ = (o.settings & 0x0F);
  if (typ > 14) typ = 14;
  let h = ((o.settings >> 4) + 1); /* length-minus-one */
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let row = 0; row < h; row++) {
    let low;
    let page;
    if (row == 0) {
      low = kTop[typ];
      page = (typ >= 3) ? 1 : 0;
    } else if (row + 1 == h && typ >= 11) {
      low = kBot[typ];
      page = 1;
    } else {
      low = kMid[typ];
      page = (typ >= 9 || (typ < 7 && typ >= 3)) ? 1 : 0;
    }
    if (low == 0xFF) continue;
    if (!emit_one(emit, user_ctx, map16_from_page_low(page, low), bx, (by + row))) return 0;
  }
  return 1;
}

function emit_wide_ledge(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x21) return 0;
  /* snesrev StdObj21_WideScaleGroundLedge: settings = width-1, height body = 2 after top. */
  let w = (o.settings + 1);
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_wide_scale_ground_ledge(emit, user_ctx, bx, by, w, 3);
}

function ext_generic_low_byte(id) {
  /* snesrev kExtObjXX_Generic1TileObject_Tiles is indexed by (ext_id - 0x10) for the
   * moon/generic range; ids 0x51+ are dedicated handlers (beams, cobwebs, etc.). */
  if (id >= 0x10 && id < 0x10 + 51) return kExtGenericTiles[id - 0x10];
  if (id < 51) return kExtGenericTiles[id];
  return 0x3f;
}

function emit_ext_ghost_house_beam(o, emit, user_ctx) {
  /* snesrev ExtObj66_GhostHouseTopRightToBottomLeftBeam2 — 4x4, page 0; skip 0x25 air. */
  if (!o || o.kind != OBJ_EXTENDED) return 0;
  if (o.object_number != 0x66 && o.object_number != 0x67) return 0;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  let off = (o.object_number - 0x66) * 16;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let low = kExtObj66_GhostHouseBeamTiles[off + row * 4 + col];
      if (low == 0x25) continue;
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, low), (bx + col),
                    (by + row)))
        return 0;
    }
  }
  return 1;
}

function emit_purple_coins(o, emit, user_ctx) {
  /* snesrev StdObj16_PurpleCoins — page0 tile 0x2C rectangle. */
  if (!o || o.kind != OBJ_STANDARD || o.object_number != 0x16) return 0;
  let w = obj_nibble_size((o.settings & 0x0F));
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_rect_fill(emit, user_ctx, bx, by, w, h, 0, 0x2C);
}

function emit_ext_cloud_fringe(o, emit, user_ctx) {
  if (o.kind != OBJ_EXTENDED) return 0;
  let id = o.object_number;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;

  if (id == 0x6B) {
    let idx = (o.settings & 7);
    if (idx > 7) idx = 7;
    return emit_one(emit, user_ctx, map16_from_page_low(0, kExtObj68CloudFringeTiles[idx]), bx, by);
  }

  if (id == 0x68) {
    let w = obj_nibble_size((o.settings & 0x0F));
    let variant = ((o.settings >> 4) & 7);
    for (let xx = 0; xx < w; xx++) {
      let low = kExtObj68CloudFringeTiles[(variant + xx) & 7];
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, low), (bx + xx), by)) return 0;
    }
    return 1;
  }
  return 0;
}

function emit_large_bush_ext(o, emit, user_ctx) {
  if (!o || o.kind != OBJ_EXTENDED) return 0;
  let tiles;
  let cols; let rows;
  if (o.object_number == 0x82) {
    tiles = kExtLargeBushBigTiles;
    cols = 9;
    rows = 5;
  } else if (o.object_number == 0x83) {
    tiles = kExtLargeBushSmallTiles;
    cols = 6;
    rows = 4;
  } else {
    return 0;
  }
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  let i = 0;
  for (let yy = 0; yy < rows; yy++) {
    for (let xx = 0; xx < cols; xx++, i++) {
      let low = tiles[i];
      if (low == 0x25) continue; /* air — do not overwrite */
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, low), (bx + xx), (by + yy)))
        return 0;
    }
  }
  return 1;
}

/* snesrev GrassObj39: high nibble = size; each row writes (r1+1) page-1 tiles, then GoDownLeft. */
function emit_grass_diagonal_pipe(o, ctx, emit,
                                    user_ctx) {
  if (!ctx || !o || o.kind != OBJ_STANDARD || o.object_number != 0x39) return 0;
  if (!tileset_is_grassland(ctx.level_tileset)) return 0;
  let r0 = ((o.settings >> 4) & 0x0F);
  let r1 = 1;
  let v2 = 0;
  let x = (o.x_position + o.screen_number * 16);
  let y = o.y_position;
  const page = 1;

  while (1) {
    let r2 = r1;
    let cx = x;
    do {
      if (x < 0 || y < 0 || cx < 0) return 0;
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, kGrassObj39_DiagonalPipeTiles[v2++]), cx,
                    y))
        return 0;
      cx++;
      r2--;
    } while ((r2 & 0x80) == 0);
    x -= 1;
    y += 1;
    r1 = (r1 + 2);
    r0--;
    if ((r0 & 0x80) != 0) break;
    if (v2 == 6) {
      r1--;
      do {
        r2 = r1;
        cx = x;
        do {
          if (x < 0 || y < 0 || cx < 0) return 0;
          if (!emit_one(emit, user_ctx, map16_from_page_low(page, kGrassObj39_DiagonalPipeTiles[v2++]), cx,
                        y))
            return 0;
          cx++;
          r2--;
        } while ((r2 & 0x80) == 0);
        x -= 1;
        y += 1;
        if (v2 == 16) v2 = 11;
        r0--;
      } while ((r0 & 0x80) == 0);
      break;
    }
  }
  if (x < 0 || y < 0) return 0;
  return emit_one(emit, user_ctx, map16_from_page_low(page, 0xEB), x, y);
}

function tileset_is_grassland(tileset) {
  /* snesrev kProcessStandardAndTilesetSpecificObjects_TilesetPtrs → ProcessGrasslandObjects */
  return tileset == 0 || tileset == 7 || tileset == 12;
}

function emit_grass_cloud_std(o, ctx, emit,
                                user_ctx) {
  if (!ctx || o.kind != OBJ_STANDARD) return 0;
  if (!tileset_is_grassland(ctx.level_tileset)) return 0;
  let id = o.object_number;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;

  if (emit_grass_diagonal_pipe(o, ctx, emit, user_ctx)) return 1;

  if (id == 0x3D) {
    let w = obj_nibble_size((o.settings & 0x0F));
    let variant = ((o.settings >> 4) & 1);
    for (let xx = 0; xx < w; xx++) {
      let low = kGrassObj3DTopCloudTiles[variant];
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, low), (bx + xx), by)) return 0;
    }
    return 1;
  }

  if (id == 0x3E) {
    let h = obj_nibble_size((o.settings >> 4));
    let variant = (o.settings & 7);
    if (variant > 7) variant = 7;
    for (let yy = 0; yy < h; yy++) {
      let low = (yy == 0) ? kGrassObj3ESideCloudTop[variant] : kGrassObj3ESideCloudBot[variant];
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, low), bx, (by + yy))) return 0;
    }
    return 1;
  }

  /* snesrev GrassObj3F_SmallBushes: r0=low nibble writes Left, then (r0-1) Mid, then Right at +r0
   * (total r0+1 tiles). variant=high nibble (0..4). */
  if (id == 0x3F) {
    let r0 = (o.settings & 0x0F);
    let variant = ((o.settings >> 4) & 0x0F);
    if (variant > 4) variant = 4;
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, kGrassObj3F_SmallBushes_Left[variant]), bx, by))
      return 0;
    for (let xx = 1; xx < r0; xx++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, kGrassObj3F_SmallBushes_Mid[variant]),
                    (bx + xx), by))
        return 0;
    }
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, kGrassObj3F_SmallBushes_Right[variant]),
                  (bx + r0), by))
      return 0;
    return 1;
  }
  return 0;
}

function emit_ext_generic_tileset7_special(o, emit, user_ctx) {
  if (!o || o.kind != OBJ_EXTENDED) return 0;
  let id = o.object_number;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  let sub = (o.settings & 0x0F);

  if (id == 0x27 && (sub == 1 || sub == 4 || sub == 7 || sub == 10 || sub == 13)) {
    return emit_one(emit, user_ctx, map16_from_page_low(1, 0x32), bx, by);
  }
  if (id == 0x07) {
    return emit_one(emit, user_ctx, map16_from_page_low(1, 0x32), bx, by);
  }
  return 0;
}

function emit_extended_generic(o, ctx, emit,
                                user_ctx) {
  if (o.kind != OBJ_EXTENDED) return 0;
  let id = o.object_number;
  if (id == 0x41 || id == 0x46) return 0;
  if (id == 0x66 || id == 0x67) return 0; /* ghost-house beam — dedicated */
  if (id == 0x68 || id == 0x6B) return 0;
  if (id == 0x82 || id == 0x83) return 0; /* large bush — dedicated emitter */
  /* 0x51+ are line guides / clocks / cobwebs / beams — not Generic1Tile. */
  if (id >= 0x51) return 0;
  if (ctx && ctx.level_tileset == 7 && emit_ext_generic_tileset7_special(o, emit, user_ctx)) return 1;
  let low = ext_generic_low_byte(id);
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  /* snesrev ExtObjXX_Generic1TileObject — always one Map16 cell; settings unused. */
  let page = (id >= 0x23) ? 1 : 0; /* rough: index>=19 uses page1 in snesrev */
  if (id >= 0x10 && id < 0x10 + 51) {
    let idx = (id - 0x10);
    page = (idx >= 19) ? 1 : 0;
    if (low == 0x25) return 1; /* air */
    return emit_one(emit, user_ctx, map16_from_page_low(page, low), bx, by);
  }
  let w = obj_nibble_size((o.settings & 0x0F));
  let h = obj_nibble_size((o.settings >> 4));
  return emit_rect_fill(emit, user_ctx, bx, by, w, h, page, low);
}

/* snesrev ExtObj86_GoalSign: 2×2 page0 tiles 66/67/68/69. */
function emit_goal_sign(o, emit, user_ctx) {
  if (!o || o.kind != OBJ_EXTENDED || o.object_number != 0x86) return 0;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  const kTiles = [0x66, 0x67, 0x68, 0x69];
  for (let i = 0; i < 4; i++) {
    let x = (bx + (i & 1));
    let y = (by + (i >> 1));
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, kTiles[i]), x, y)) return 0;
  }
  return 1;
}

function emit_yoshi_coin(o, emit, user_ctx) {
  if (o.kind != OBJ_EXTENDED || o.object_number != 0x41) return 0;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  if (!emit_one(emit, user_ctx, map16_from_page_low(0, 0x2D), bx, by)) return 0;
  return emit_one(emit, user_ctx, map16_from_page_low(0, 0x2E), bx, (by + 1));
}

function emit_midway_bar_ext(o, emit, user_ctx) {
  /* snesrev ExtObj46_MidwayBar: 0x35 at X-1, 0x38 at X. Place 0x36 tape-end at X+1 when the
   * cell is empty or donut 0x26 (expand refuses pole 0x34). */
  if (o.kind != OBJ_EXTENDED || o.object_number != 0x46) return 0;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  if (bx > 0) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, 0x35), (bx - 1), by)) return 0;
  }
  if (!emit_one(emit, user_ctx, map16_from_page_low(0, 0x38), bx, by)) return 0;
  /* Optional tape-end at X+1; expand_emit_fn keeps this from overwriting non-empty cells. */
  return emit_one(emit, user_ctx, map16_from_page_low(0, 0x36), (bx + 1), by);
}

function emit_water_surface(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x18) return 0;
  let variant = (o.settings & 0x03);
  if (variant > 3) variant = 0;
  let w = obj_nibble_size((o.settings & 0x0F));
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  let top = kWaterTopTiles[variant];
  let bot = kWaterBottomTiles[variant];
  for (let xx = 0; xx < w; xx++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, top), (bx + xx), by)) return 0;
  }
  for (let yy = 1; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, bot), (bx + xx), (by + yy)))
        return 0;
    }
  }
  return 1;
}

/* snesrev StdObj15_MidwayAndGoalPoint: 3 columns (L, empty 0x25, R), page 0.
 * Settings: high nibble = height, low nibble = type (0=midway, nonzero=goal). */
function emit_midway_point(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x15) return 0;
  const k_top_mid = [ 0x2f, 0x25, 0x32 ];
  const k_mid_mid = [ 0x30, 0x25, 0x33 ];
  const k_bot_mid = [ 0x31, 0x25, 0x34 ];
  const k_top_goal = [ 0x39, 0x25, 0x3c ];
  const k_mid_goal = [ 0x3a, 0x25, 0x3d ];
  const k_bot_goal = [ 0x3b, 0x25, 0x3e ];
  let typ = (o.settings & 0x0F);
  let height = ((o.settings >> 4) & 0x0F);
  if (height == 0) height = 1;
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  let top = typ ? k_top_goal : k_top_mid;
  let mid = typ ? k_mid_goal : k_mid_mid;
  let bot = typ ? k_bot_goal : k_bot_mid;
  for (let col = 0; col < 3; col++) {
    let x = (bx + col);
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, top[col]), x, by)) return 0;
    if (height == 1) continue;
    for (let row = 1; row + 1 < height; row++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(0, mid[col]), x, (by + row))) return 0;
    }
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, bot[col]), x, (by + height - 1))) return 0;
  }
  return 1;
}

/* snesrev kProcessStandardAndTilesetSpecificObjects_TilesetPtrs object-set class. */
function tileset_is_ghost_house(tileset) {
  return tileset == 4 || tileset == 5 || tileset == 13;
}

function tileset_is_underground(tileset) {
  return tileset == 3 || tileset == 9 || tileset == 10 || tileset == 11 || tileset == 14;
}

/* snesrev UndergroundObj36_4SidedGround — page 1 frame with size nibbles length-minus-one. */
function emit_underground_obj36_4sided(o, emit, user_ctx) {
  const kLeft = [0x45, 0x50, 0x4d];
  const kMid = [0x00, 0xf0, 0x4e];
  const kRight = [0x48, 0x51, 0x4f];
  let wn = (o.settings & 0x0F);
  let hn = (o.settings >> 4);
  let w = obj_nibble_size(wn);
  let h = obj_nibble_size(hn);
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let row = 0; row < h; row++) {
    let band = (row == 0) ? 0 : ((row + 1 == h) ? 2 : 1);
    for (let col = 0; col < w; col++) {
      let low = (col == 0) ? kLeft[band] : ((col + 1 == w) ? kRight[band] : kMid[band]);
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, low), (bx + col), (by + row)))
        return 0;
    }
  }
  return 1;
}

/* snesrev UndergroundObj3B_CaveLava — also used for object 0x3A (k==57).
 * Obj 0x3A: top row page1 0x59, body rows page1 0xFF.
 * Obj 0x3B: all rows page1 0xFF. Size nibbles are length-minus-one. */
function emit_underground_obj3a_3b_cave_lava(o, emit, user_ctx) {
  if (!o || o.kind != OBJ_STANDARD) return 0;
  if (o.object_number != 0x3A && o.object_number != 0x3B) return 0;
  let w = obj_nibble_size((o.settings & 0x0F));
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  let is_3a = (o.object_number == 0x3A);
  for (let row = 0; row < h; row++) {
    let low = (is_3a && row == 0) ? 0x59 : 0xFF;
    for (let col = 0; col < w; col++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, low), (bx + col), (by + row)))
        return 0;
    }
  }
  return 1;
}

/* snesrev UndergroundObj3F_SolidDirt — page1 0x65 rectangle. */
function emit_underground_obj3f_solid_dirt(o, emit, user_ctx) {
  if (!o || o.kind != OBJ_STANDARD || o.object_number != 0x3F) return 0;
  let w = obj_nibble_size((o.settings & 0x0F));
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_rect_fill(emit, user_ctx, bx, by, w, h, 1, 0x65);
}

/* snesrev UndergroundObj38_RightLavaEdge — vertical column, page1. */
function emit_underground_obj38_right_lava_edge(o, emit, user_ctx) {
  const kTop = [0x5a, 0x5b];
  const kMid = [0x5b, 0x5b];
  if (!o || o.kind != OBJ_STANDARD || o.object_number != 0x38) return 0;
  let variant = (o.settings & 0x0F);
  if (variant > 1) variant = 1;
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let row = 0; row < h; row++) {
    let low = (row == 0) ? kTop[variant] : kMid[variant];
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, low), bx, (by + row))) return 0;
  }
  return 1;
}

/* snesrev UndergroundObj3D_CeilingLedge — body page1 0x65, bottom row page1 0x4E. */
function emit_underground_obj3d_ceiling_ledge(o, emit, user_ctx) {
  if (!o || o.kind != OBJ_STANDARD || o.object_number != 0x3D) return 0;
  let w = obj_nibble_size((o.settings & 0x0F));
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0x65), (bx + col), (by + row)))
        return 0;
    }
  }
  for (let col = 0; col < w; col++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0x4E), (bx + col), (by + h)))
      return 0;
  }
  return 1;
}

/* snesrev UndergroundObj3E_CeilingEdges — vertical stack then bottom tile; low nibble selects. */
function emit_underground_obj3e_ceiling_edges(o, emit, user_ctx) {
  const kTop = [0x50, 0x50, 0x51, 0x51];
  const kBot = [0x4d, 0x50, 0x4f, 0x51];
  if (!o || o.kind != OBJ_STANDARD || o.object_number != 0x3E) return 0;
  let variant = (o.settings & 0x0F);
  if (variant > 3) variant = 3;
  let h = (o.settings >> 4); /* body rows before bottom; 0 → bottom only */
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let row = 0; row < h; row++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, kTop[variant]), bx, (by + row))) return 0;
  }
  return emit_one(emit, user_ctx, map16_from_page_low(1, kBot[variant]), bx, (by + h));
}

/* snesrev UndergroundObj39_SlopedCaveLava — low 2 bits select slope; high nibble length-minus-one.
 * Steep left (1): edge 0xD6 then 0xFD + 0xFF fill, stepping left each row.
 * Steep right (3): edge 0xD7 then 0xFF fill + 0xFE, stepping via vertical then horizontal. */
function emit_underground_obj39_sloped_cave_lava(o, emit, user_ctx) {
  if (!o || o.kind != OBJ_STANDARD || o.object_number != 0x39) return 0;
  let slope = (o.settings & 3);
  let rows = ((o.settings >> 4) + 1);
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  if (slope == 1) {
    /* SteepLeftSlope (0DDBA4): each row starts one tile left; width grows to bx.
     * Row r: D6 at bx-r, then if r>0 FD at bx-r+1 and (r-1) times FF — never past bx. */
    for (let row = 0; row < rows; row++) {
      let x0 = bx - row;
      if (x0 < 0) x0 = 0;
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xD6), x0, (by + row))) return 0;
      if (row > 0) {
        if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xFD), (x0 + 1), (by + row)))
          return 0;
        for (let xx = 2; xx <= row; xx++) {
          if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xFF), (x0 + xx), (by + row)))
            return 0;
        }
      }
    }
    /* Join pool on the row below the last edge, still capped at bx (not bx+1). */
    if (rows > 0) {
      let x0 = bx - (rows - 1);
      if (x0 < 0) x0 = 0;
      let fill_y = (by + rows);
      for (let xx = 0; xx < rows; xx++) {
        if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xFF), (x0 + xx), fill_y)) return 0;
      }
    }
    return 1;
  }
  if (slope == 3) {
    /* SteepRightSlope (0DDC61): fill the next row even after the last D7 (--r0→0 still fills). */
    for (let row = 0; row < rows; row++) {
      let x = (bx + row);
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xD7), x, (by + row))) return 0;
      let fill_y = (by + row + 1);
      for (let k = 0; k < row + 1; k++) {
        if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xFF), (bx + k), fill_y)) return 0;
      }
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xFE), (bx + row + 1), fill_y)) return 0;
    }
    return 1;
  }
  if (slope == 0) {
    /* LeftSlope: 0xD2/0xD3 edge pair, then 0xFB/0xFF body (simplified). */
    for (let row = 0; row < rows; row++) {
      let x0 = bx - (row * 2);
      if (x0 < 0) x0 = 0;
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xD2), x0, (by + row))) return 0;
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xD3), (x0 + 1), (by + row)))
        return 0;
      for (let xx = 2; xx < (row * 2 + 2); xx++) {
        let low = (xx == 2) ? 0xFB : 0xFF;
        if (!emit_one(emit, user_ctx, map16_from_page_low(1, low), (x0 + xx), (by + row)))
          return 0;
      }
    }
    return 1;
  }
  /* RightSlope (2): 0xD4/0xD5 then 0xFF/0xFC. */
  for (let row = 0; row < rows; row++) {
    let x = (bx + row * 2);
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xD4), x, (by + row))) return 0;
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xD5), (x + 1), (by + row)))
      return 0;
    if (row + 1 < rows) {
      let fill_y = (by + row + 1);
      for (let k = 0; k < row * 2 + 2; k++) {
        if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xFF), (bx + k), fill_y)) return 0;
      }
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0xFC), (bx + row * 2 + 2), fill_y))
        return 0;
    }
  }
  return 1;
}

/* snesrev GhostHouseObj35/36 wooden / brick background fill. */
function emit_ghost_house_obj35_36(o, emit, user_ctx) {
  /* LM Mode4 SetTileMappingWithDataTableIndex: obj35→page0 table[0]=0x82,
   * obj36→page1 table[1]+0x100 → 0x15E (grey brick BG). */
  let page = (o.object_number == 0x36) ? 1 : 0;
  let low = (o.object_number == 0x36) ? 0x5E : 0x82;
  let w = obj_nibble_size((o.settings & 0x0F));
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_rect_fill(emit, user_ctx, bx, by, w, h, page, low);
}

/* snesrev GhostHouseObj2E_HorizontalLineOfSpikes — page 1. */
function emit_ghost_house_obj2e(o, emit, user_ctx) {
  const kTiles = [0x59];
  let variant = (o.settings >> 4);
  if (variant > 0) variant = 0; /* table has one entry; high nibble selects in SMW via pointer */
  let w = obj_nibble_size((o.settings & 0x0F));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  // unused
  for (let xx = 0; xx < w; xx++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, kTiles[0]), (bx + xx), by)) return 0;
  }
  return 1;
}

/* snesrev GhostHouseObj38_WoodenLedge — page 1: 0x0A, then 0x0B..., end 0x0C. */
function emit_ghost_house_obj38(o, emit, user_ctx) {
  let w = obj_nibble_size((o.settings & 0x0F));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let xx = 0; xx < w; xx++) {
    let low = (w == 1 || xx + 1 == w) ? 0x0C : ((xx == 0) ? 0x0A : 0x0B);
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, low), (bx + xx), by)) return 0;
  }
  return 1;
}

/* snesrev GhostHouseObj39_VerticalBackgroundLog — page 0. */
function emit_ghost_house_obj39(o, emit, user_ctx) {
  const kTop = [0x83, 0x78, 0x79];
  const kBot = [0x83, 0x79, 0x79];
  let variant = (o.settings & 0x0F);
  if (variant > 2) variant = 2;
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let yy = 0; yy < h; yy++) {
    let low = (yy == 0) ? kTop[variant] : kBot[variant];
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, low), bx, (by + yy))) return 0;
  }
  return 1;
}

/* snesrev GhostHouseObj3A_SolidBrickWallAndVerticalLineOfSpikes — page 1 column. */
function emit_ghost_house_obj3a(o, emit, user_ctx) {
  const kTiles = [0x5f, 0x60, 0x5a, 0x5b];
  let variant = (o.settings & 0x0F);
  if (variant > 3) variant = 3;
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let yy = 0; yy < h; yy++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, kTiles[variant]), bx, (by + yy))) return 0;
  }
  return 1;
}

/* snesrev GhostHouseObj31_WoodCrate — simplified: page1 top 0x61..0x62, body edges/mids, bottom 0x6B..0x6D. */
function emit_ghost_house_obj31(o, emit, user_ctx) {
  const kLeft = [0x63, 0x65];
  const kMid = [0xc7, 0xc8];
  const kRight = [0x64, 0x6a];
  let wn = (o.settings & 0x0F);
  let hn = (o.settings >> 4);
  let w = obj_nibble_size(wn);
  let h = obj_nibble_size(hn);
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  /* Top row page1: 0x61, then 0x0D..., end 0x62 */
  for (let xx = 0; xx < w; xx++) {
    let low = (xx + 1 == w) ? 0x62 : ((xx == 0) ? 0x61 : 0x0D);
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, low), (bx + xx), by)) return 0;
  }
  /* Middle rows alternate edge set; middles on page 0 */
  for (let row = 1; row + 1 < h; row++) {
    let j = ((row - 1) & 1);
    for (let xx = 0; xx < w; xx++) {
      let page = 1;
      let low;
      if (xx == 0) {
        low = kLeft[j];
        page = 1;
      } else if (xx + 1 == w) {
        low = kRight[j];
        page = 1;
      } else {
        low = kMid[j];
        page = 0;
      }
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, low), (bx + xx), (by + row)))
        return 0;
    }
  }
  /* Bottom row page1: 0x6B, 0x6C..., end 0x6D */
  if (h > 1) {
    let bot = (by + h - 1);
    for (let xx = 0; xx < w; xx++) {
      let low = (xx + 1 == w) ? 0x6D : ((xx == 0) ? 0x6B : 0x6C);
      if (!emit_one(emit, user_ctx, map16_from_page_low(1, low), (bx + xx), bot)) return 0;
    }
  }
  return 1;
}

function emit_ghost_house_tileset_specific(o, emit, user_ctx) {
  switch (o.object_number) {
    case 0x2E:
      return emit_ghost_house_obj2e(o, emit, user_ctx);
    case 0x31:
      return emit_ghost_house_obj31(o, emit, user_ctx);
    case 0x35:
    case 0x36:
      return emit_ghost_house_obj35_36(o, emit, user_ctx);
    case 0x38:
      return emit_ghost_house_obj38(o, emit, user_ctx);
    case 0x39:
      return emit_ghost_house_obj39(o, emit, user_ctx);
    case 0x3A:
      return emit_ghost_house_obj3a(o, emit, user_ctx);
    default:
      return 0;
  }
}

function emit_tileset_specific(o, ctx, emit,
                                user_ctx) {
  if (o.kind != OBJ_STANDARD) return 0;
  let id = o.object_number;
  if (emit_grass_cloud_std(o, ctx, emit, user_ctx)) return 1;
  if (id < 0x2E || id > 0x3F) return 0;
  let tileset = ctx ? ctx.level_tileset : 0;
  if (tileset_is_ghost_house(tileset) && emit_ghost_house_tileset_specific(o, emit, user_ctx)) return 1;
  if (tileset_is_underground(tileset)) {
    if (id == 0x36) return emit_underground_obj36_4sided(o, emit, user_ctx);
    if (id == 0x38) return emit_underground_obj38_right_lava_edge(o, emit, user_ctx);
    if (id == 0x39) return emit_underground_obj39_sloped_cave_lava(o, emit, user_ctx);
    if (id == 0x3A || id == 0x3B) return emit_underground_obj3a_3b_cave_lava(o, emit, user_ctx);
    if (id == 0x3D) return emit_underground_obj3d_ceiling_ledge(o, emit, user_ctx);
    if (id == 0x3E) return emit_underground_obj3e_ceiling_edges(o, emit, user_ctx);
    if (id == 0x3F) return emit_underground_obj3f_solid_dirt(o, emit, user_ctx);
  }
  /* Fallback: historical generic page0/1 fill for unimplemented tileset objects. */
  let idx = id - 0x2E;
  let low = kTilesetSpecLow[idx];
  let page = kTilesetSpecPage[idx];
  let settings = o.settings;
  let w = obj_nibble_size((settings & 0x0F));
  let h = obj_nibble_size((settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_rect_fill(emit, user_ctx, bx, by, w, h, page, low);
}

function emit_skinny_vertical_pipe(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x1F) return 0;
  let height = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  const page = 1;
  if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x53), bx, by)) return 0;
  for (let row = 1; row + 1 < height; row++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x54), bx, (by + row))) return 0;
  }
  if (height > 1) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x55), bx, (by + height - 1))) return 0;
  }
  return 1;
}

/* snesrev StdObj20_SkinnyHorizontalPipeBoneLog — page1 0x56 / 0x57... / 0x58. */
function emit_skinny_horizontal_pipe(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x20) return 0;
  let width = obj_nibble_size((o.settings & 0x0F));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  const page = 1;
  if (width == 1) {
    return emit_one(emit, user_ctx, map16_from_page_low(page, 0x56), bx, by);
  }
  if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x56), bx, by)) return 0;
  for (let col = 1; col + 1 < width; col++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x57), (bx + col), by)) return 0;
  }
  return emit_one(emit, user_ctx, map16_from_page_low(page, 0x58), (bx + width - 1), by);
}

/* snesrev StdObj1C_DonutBridge — row0 page0 0x26, row1 page1 0x44. */
function emit_donut_bridge(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x1C) return 0;
  let width = obj_nibble_size((o.settings & 0x0F));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  for (let col = 0; col < width; col++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(0, 0x26), (bx + col), by)) return 0;
  }
  for (let col = 0; col < width; col++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(1, 0x44), (bx + col), (by + 1)))
      return 0;
  }
  return 1;
}

/* snesrev StdObj17_RopeAndCloudLine — page1 tile 0x05 or 0x06 from high nibble. */
function emit_rope_cloud_line(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x17) return 0;
  let typ = ((o.settings >> 4) & 0x0F);
  if (typ > 1) typ = 1;
  let low = (typ == 0) ? 0x05 : 0x06;
  let width = obj_nibble_size((o.settings & 0x0F));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  return emit_rect_fill(emit, user_ctx, bx, by, width, 1, 1, low);
}

/* snesrev table uses 0x00 for open ends. Do not emit Map16 0x0100; continue the shaft
 * (0x35/0x36) so bottom-facing (types 3/4) keep an open top and top-facing keep an open bottom. */
function vert_pipe_end_low(table_low, is_left) {
  if (table_low != 0) return table_low;
  return is_left ? 0x35 : 0x36;
}

function emit_vertical_pipe(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x0F) return 0;
  let pipe_type = (o.settings & 0x0F);
  if (pipe_type > 4) pipe_type = 0;
  let height = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  const page = 1;

  /* Grid attr 1..4 = normal-pipe set+1; default screen column ((x>>4)&3)+1 (LM export). */
  let pipe_attr = (((bx >> 4) & 3) + 1);
  let top_l = vert_pipe_end_low(kVertPipeTopL[pipe_type], 1);
  let top_r = vert_pipe_end_low(kVertPipeTopR[pipe_type], 0);
  if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, top_l), bx, by, pipe_attr)) return 0;
  if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, top_r), (bx + 1), by, pipe_attr))
    return 0;
  for (let row = 1; row + 1 < height; row++) {
    if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, 0x35), bx, (by + row), pipe_attr))
      return 0;
    if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, 0x36), (bx + 1),
                       (by + row), pipe_attr))
      return 0;
  }
  if (height > 1) {
    let bot = (by + height - 1);
    let bot_l = vert_pipe_end_low(kVertPipeBotL[pipe_type], 1);
    let bot_r = vert_pipe_end_low(kVertPipeBotR[pipe_type], 0);
    if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, bot_l), bx, bot, pipe_attr)) return 0;
    if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, bot_r), (bx + 1), bot, pipe_attr))
      return 0;
  }
  return 1;
}

function emit_horizontal_pipe(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x10) return 0;
  let pipe_type = ((o.settings >> 4) & 0x0F);
  if (pipe_type > 3) pipe_type = (pipe_type & 3);
  let width = obj_nibble_size((o.settings & 0x0F));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  const page = 1;

  /* snesrev StdObj10: high nibble 0..1 → exit left (end then shaft); 2..3 → exit right. */
  let end_left = (pipe_type < 2);
  for (let col = 0; col < width; col++) {
    let x = (bx + col);
    let pipe_attr = (((x >> 4) & 3) + 1);
    let is_end = end_left ? (col == 0) : (col + 1 == width);
    let top = is_end ? kHorizPipeTopEnd[pipe_type] : kHorizPipeTopShaft;
    let bot = is_end ? kHorizPipeBotEnd[pipe_type] : kHorizPipeBotShaft;
    if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, top), x, by, pipe_attr)) return 0;
    if (!emit_one_attr(emit, user_ctx, map16_from_page_low(page, bot), x, (by + 1), pipe_attr))
      return 0;
  }
  return 1;
}

/* snesrev StdObj12_Slopes: low nibble selects style (mod 10). Geometry follows
 * Preserve/Restore + vertical blocks_sub_scr_pos advances; Map16 page1 tiles. */
function emit_slope_std12(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x12) return 0;
  let typ = (o.settings & 0x0F);
  while (typ >= 10) typ = (typ - 10);
  let height = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  const page = 1;

  if (typ == 0) {
    /* LeftSlope: 0196/019B edge column; under-fill omitted (LM Export backdrop). */
    for (let row = 0; row < height; row++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x96), bx, (by + row))) return 0;
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x9B), (bx + 1), (by + row)))
        return 0;
    }
    return 1;
  }
  if (typ == 1) {
    /* SteepLeftSlope: top 01AA, body 01E2. */
    for (let row = 0; row < height; row++) {
      let low = (row == 0) ? 0xAA : 0xE2;
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, low), bx, (by + row))) return 0;
    }
    return 1;
  }
  if (typ == 3) {
    /* RightSlope: 01A0/01A5. */
    for (let row = 0; row < height; row++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0xA0), bx, (by + row))) return 0;
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0xA5), (bx + 1), (by + row)))
        return 0;
    }
    return 1;
  }
  if (typ == 4) {
    /* SteepRightSlope: 01AF on the diagonal; 01E4 one row below (snesrev). Compose draws only
     * the tip fringe (Map16 word 186 x-flip → screen TR after FG corner swap). */
    for (let i = 0; i < height; i++) {
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0xAF), (bx + i),
                    (by + i)))
        return 0;
      if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0xE4), (bx + i),
                    (by + i + 1)))
        return 0;
    }
    return 1;
  }
  if (typ == 9) {
    /* UpsideDownSteepRightSlope: shaft 0165 on the diagonal; grass 014E one row below.
     * Tip: leave diagonal (prior coin); emit clear-marker 01C5 below only into empty cells
     * so a longer slope's 014E fringe is not clobbered. */
    for (let i = 0; i < height; i++) {
      let x = (bx + i);
      let y = (by + i);
      if (i + 1 < height) {
        if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x65), x, y)) return 0;
        if (!emit_one(emit, user_ctx, map16_from_page_low(page, 0x4E), x, (y + 1))) return 0;
      } else {
        const tip = { map16_tile: 0, x_tile: 0, y_tile: 0, attr: 0, empty_only: 0 };
        tip.map16_tile = map16_from_page_low(page, 0xC5);
        tip.x_tile = x;
        tip.y_tile = (y + 1);
        tip.attr = 0;
        tip.empty_only = 1;
        if (!emit(tip, user_ctx)) return 0;
      }
    }
    return 1;
  }
  return 0;
}

function emit_bullet_shooter(o, emit, user_ctx) {
  if (o.kind != OBJ_STANDARD || o.object_number != 0x11) return 0;
  let h = obj_nibble_size((o.settings >> 4));
  let bx = (o.x_position + o.screen_number * 16);
  let by = o.y_position;
  const page = 1;
  const tiles = [ 0x41, 0x42, 0x43 ];
  for (let row = 0; row < h && row < 3; row++) {
    if (!emit_one(emit, user_ctx, map16_from_page_low(page, tiles[row < h ? row : 2]), bx, (by + row)))
      return 0;
  }
  return 1;
}

/* LM std 0x27/0x29 variant 0: H=0 or W=0 repeats one Map16 tile along that axis.
 * The W/H nibble is LM "length minus one" (e.g. W=13 places 14 tiles, through column E when base is 1). */
function emit_lm_direct_repeat_axis(emit, user_ctx, base_tile, w,
                                      h, base_x, base_y) {
  if (w == 0 && h == 0) {
    return emit_one(emit, user_ctx, base_tile, base_x, base_y);
  }
  if (h == 0) {
    let count = (w + 1);
    for (let xx = 0; xx < count; xx++) {
      if (!emit_one(emit, user_ctx, base_tile, (base_x + xx), base_y)) return 0;
    }
    return 1;
  }
  if (w == 0) {
    let count = (h + 1);
    for (let yy = 0; yy < count; yy++) {
      if (!emit_one(emit, user_ctx, base_tile, base_x, (base_y + yy))) return 0;
    }
    return 1;
  }
  return 0;
}

/* LM std 0x27/0x29 variant 2 (stretched): W/H nibbles are length minus one.
 * Anchor (X,Y) is top-left of a (W+1)×(H+1) Map16 block grid; ids advance in row-major order
 * (e.g. 03BC|03BD on row 0, 03BE|03BF on row 1 — the paired tiles for a 2-wide strip). */
function emit_lm_direct_stretched_rect(emit, user_ctx, base_tile, w,
                                         h, base_x, base_y) {
  let cols = (w + 1);
  let rows = (h + 1);
  for (let yy = 0; yy < rows; yy++) {
    for (let xx = 0; xx < cols; xx++) {
      let tid = (base_tile + xx + (yy * cols));
      if (!emit_one(emit, user_ctx, tid, (base_x + xx), (base_y + yy))) return 0;
    }
  }
  return 1;
}

function emit_lm_direct_rect(emit, user_ctx, base_tile, w, h,
                               base_x, base_y, tile_stride_row_major) {
  if (w == 0) w = 1;
  if (h == 0) h = 1;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      let tid;
      if (tile_stride_row_major) {
        tid = (base_tile + xx + (yy * w));
      } else {
        /* Page layout: +1 per column, +0x10 per row (e.g. 05AE/05BE/05CE bush stack). */
        let row_base = (base_tile + (yy * 0x10));
        tid = ((row_base & 0xFF00) | (((row_base & 0xFF) + xx) & 0xFF));
      }
      if (!emit_one(emit, user_ctx, tid, (base_x + xx), (base_y + yy))) return 0;
    }
  }
  return 1;
}

function emit_lm_direct(o, emit, user_ctx) {
  if (!o.decoded.present) return 0;

  let base_x = (o.x_position + o.screen_number * 16);
  let base_y = o.y_position;

  if (o.decoded.kind == OBJ_DEC_LM_22_MAP16_PAGE0 || o.decoded.kind == OBJ_DEC_LM_23_MAP16_PAGE1) {
    /* map16_tile_9b is already the full page0/1 id (0x000-0x1FF). Obj 0x23 selects
     * page1 tiles in-editor; do not add +0x200 (that wrongly targets page2/3 FG). */
    let base_tile = o.decoded.map16_tile_9b;
    /* W/H nibbles are length-minus-one (same as LM obj 0x27 variant 0). */
    let w = (o.decoded.width_4b + 1);
    let h = (o.decoded.height_4b + 1);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (!emit_one(emit, user_ctx, base_tile, (base_x + xx), (base_y + yy))) return 0;
      }
    }
    return 1;
  }

  if (o.decoded.kind != OBJ_DEC_LM_27_DIRECT_MAP16_P00_3F && o.decoded.kind != OBJ_DEC_LM_29_DIRECT_MAP16_P40_7F) {
    return 0;
  }

  const d = o.decoded;
  let base_tile = d.base_map16;

  switch (d.variant) {
    case 0: {
      let w = d.width;
      let h = d.height;
      if (h == 0 || w == 0) {
        return emit_lm_direct_repeat_axis(emit, user_ctx, base_tile, w, h, base_x, base_y);
      }
      /* Both axes set: W/H are length-minus-one; fill with the same Map16 id. */
      let cols = (w + 1);
      let rows = (h + 1);
      for (let yy = 0; yy < rows; yy++) {
        for (let xx = 0; xx < cols; xx++) {
          if (!emit_one(emit, user_ctx, base_tile, (base_x + xx), (base_y + yy))) return 0;
        }
      }
      return 1;
    }
    case 1: {
      let w = (d.sel_w_4b + 1);
      let h = (d.sel_h_4b + 1);
      return emit_lm_direct_rect(emit, user_ctx, base_tile, w, h, base_x, base_y, 0);
    }
    case 2: {
      let w = d.width;
      let h = d.height;
      if (h == 0 || w == 0) {
        return emit_lm_direct_repeat_axis(emit, user_ctx, base_tile, w, h, base_x, base_y);
      }
      return emit_lm_direct_stretched_rect(emit, user_ctx, base_tile, w, h, base_x, base_y);
    }
    case 3:
    case 4: {
      /* Multi-screen (3) / conditional (4): W and H are length-minus-one.
       * Export Level as Image evaluates conditions as true (editor "shown" state).
       * When conditional_add_a is set, LM adds 1 to the Map16 id for the true branch. */
      let tid = base_tile;
      if (d.variant == 4 && d.conditional_add_a) {
        tid = (base_tile + 1);
      }
      // unused /* flag index; true-branch for export */
      let cols = (d.width + 1);
      let rows = (d.height + 1);
      for (let yy = 0; yy < rows; yy++) {
        for (let xx = 0; xx < cols; xx++) {
          if (!emit_one(emit, user_ctx, tid, (base_x + xx), (base_y + yy))) return 0;
        }
      }
      return 1;
    }
    default:
      return 0;
  }
}

function object_emit_map16_tiles(o, ctx,
                                     emit, user_ctx) {
  if (!o) return OBJMAP_UNKNOWN;

  if (object_emit_classify(o) == OBJMAP_NONVISUAL) return OBJMAP_NONVISUAL;

  if (emit_lm_direct(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_yoshi_coin(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_midway_bar_ext(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_large_bush_ext(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_ext_ghost_house_beam(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_ext_cloud_fringe(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_goal_sign(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_extended_generic(o, ctx, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_water_surface(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_purple_coins(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_generic_fill(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_ground_edges(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_ground_ledge(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_wide_ledge(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_midway_point(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_tileset_specific(o, ctx, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_vertical_pipe(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_skinny_vertical_pipe(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_skinny_horizontal_pipe(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_horizontal_pipe(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_donut_bridge(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_rope_cloud_line(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_slope_std12(o, emit, user_ctx)) return OBJMAP_HANDLED;
  if (emit_bullet_shooter(o, emit, user_ctx)) return OBJMAP_HANDLED;

  return OBJMAP_UNKNOWN;
}

module.exports = {
  OBJMAP_UNKNOWN,
  OBJMAP_HANDLED,
  OBJMAP_NONVISUAL,
  object_emit_classify,
  object_emit_map16_tiles,
};
