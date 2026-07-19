/**
 * Level header/object/sprite parsing — port of lmlevelinfo/level_parse.c + level_parse.h
 */

const { read8Snes, read16Snes, read24Snes, snesLoromToPc } = require('../smw-rom');
const { objectLenForStandard, objectLenForExtended, layer1BlobLooksValid } = require('./layer1-validate');

const OBJ_STANDARD = 1;
const OBJ_EXTENDED = 2;
const OBJ_SCREEN_EXIT = 3;

const OBJ_DEC_NONE = 0;
const OBJ_DEC_LM_22_MAP16_PAGE0 = 1;
const OBJ_DEC_LM_23_MAP16_PAGE1 = 2;
const OBJ_DEC_LM_24_OLD_FGBGSP_BYPASS = 3;
const OBJ_DEC_LM_25_OLD_AN2_BYPASS = 4;
const OBJ_DEC_LM_26_MUSIC_BYPASS = 5;
const OBJ_DEC_LM_27_DIRECT_MAP16_P00_3F = 6;
const OBJ_DEC_LM_28_TIME_BYPASS = 7;
const OBJ_DEC_LM_29_DIRECT_MAP16_P40_7F = 8;
const OBJ_DEC_LM_2D_USER_DEFINED = 9;
const OBJ_DEC_LM_EXT03_SCREEN_JUMP = 10;

const DECODED_KIND_NAMES = {
  [OBJ_DEC_LM_22_MAP16_PAGE0]: 'lm_obj22_map16_page0',
  [OBJ_DEC_LM_23_MAP16_PAGE1]: 'lm_obj23_map16_page1',
  [OBJ_DEC_LM_24_OLD_FGBGSP_BYPASS]: 'lm_obj24_old_fgbgsp_bypass',
  [OBJ_DEC_LM_25_OLD_AN2_BYPASS]: 'lm_obj25_old_an2_bypass',
  [OBJ_DEC_LM_26_MUSIC_BYPASS]: 'lm_obj26_music_bypass',
  [OBJ_DEC_LM_27_DIRECT_MAP16_P00_3F]: 'lm_obj27_direct_map16_p00_3f',
  [OBJ_DEC_LM_28_TIME_BYPASS]: 'lm_obj28_time_bypass',
  [OBJ_DEC_LM_29_DIRECT_MAP16_P40_7F]: 'lm_obj29_direct_map16_p40_7f',
  [OBJ_DEC_LM_2D_USER_DEFINED]: 'lm_obj2d_user_defined',
  [OBJ_DEC_LM_EXT03_SCREEN_JUMP]: 'lm_ext03_screen_jump',
};

function decodePrimary(raw) {
  const l = raw[0] & 0x1f;
  return {
    raw: raw.slice(0, 5),
    bg_palette: (raw[0] >> 5) & 0x7,
    length_in_screens: l === 0x1f ? -1 : l,
    back_area_color: (raw[1] >> 5) & 0x7,
    level_mode: raw[1] & 0x1f,
    layer3_priority: (raw[2] >> 7) & 0x1,
    music_mmm: (raw[2] >> 4) & 0x7,
    sprite_gfx: raw[2] & 0xf,
    timer_setting: (raw[3] >> 6) & 0x3,
    sprite_palette: (raw[3] >> 3) & 0x7,
    fg_palette: raw[3] & 0x7,
    item_memory_set: (raw[4] >> 6) & 0x3,
    vertical_scroll_set: (raw[4] >> 4) & 0x3,
    fgbg_gfx_setting: raw[4] & 0xf,
  };
}

function decodeSecondary(h) {
  const d = { present: !!h.present };
  if (!h.present) return d;
  d.l2_scroll_h = (h.b1 >> 4) & 0xf;
  d.main_y_low4 = h.b1 & 0xf;
  d.layer3_setting_2b = (h.b2 >> 6) & 0x3;
  d.main_action_3b = (h.b2 >> 3) & 0x7;
  d.main_x_3b = h.b2 & 0x7;
  d.midway_screen_4b = (h.b3 >> 4) & 0xf;
  d.fg_initial_2b = (h.b3 >> 2) & 0x3;
  d.bg_initial_2b = h.b3 & 0x3;
  d.no_yoshi_intro = (h.b4 >> 7) & 0x1;
  d.vpos_unknown_u = (h.b4 >> 6) & 0x1;
  d.vpos_flag_v = (h.b4 >> 5) & 0x1;
  d.main_screen_5b = h.b4 & 0x1f;
  if (h.b5) {
    d.slippery_i = (h.b5 >> 7) & 0x1;
    d.water_w = (h.b5 >> 6) & 0x1;
    d.xy2_p = (h.b5 >> 5) & 0x1;
    d.smartspawn_t = (h.b5 >> 2) & 0x1;
    d.sprite_spawn_tt = h.b5 & 0x3;
  }
  if (h.b6) {
    d.shc_s = (h.b6 >> 7) & 0x1;
    d.shc_h = (h.b6 >> 6) & 0x1;
    d.shc_c = (h.b6 >> 5) & 0x1;
    d.l2_vertical_vvvvv = h.b6 & 0x1f;
  }
  if (h.b7) {
    d.bg_relative_o = (h.b7 >> 7) & 0x1;
    d.main_y_high6 = h.b7 & 0x3f;
  }
  if (h.b8) {
    d.relative_to_player_r = (h.b8 >> 7) & 0x1;
    d.face_left_l = (h.b8 >> 6) & 0x1;
    d.bg_height_or_offset_ooooo = h.b8 & 0x1f;
  }
  return d;
}

function decodeSpriteHeader(b) {
  return {
    present: true,
    raw: b,
    buoyancy_s: (b >> 7) & 0x1,
    buoyancy_b: (b >> 6) & 0x1,
    new_sprite_system: (b >> 5) & 0x1,
    sprite_memory: b & 0x1f,
  };
}

function decodeMidway(info) {
  const t1 = info.midway_b1;
  const t2 = info.midway_b2;
  const t3 = info.midway_b3;
  info.midway_slippery_i = (t1 >> 7) & 0x1;
  info.midway_water_w = (t1 >> 6) & 0x1;
  info.midway_separate_h = (t1 >> 5) & 0x1;
  info.midway_screen_bit4_m = (t1 >> 4) & 0x1;
  info.midway_action_aaa = t1 & 0x7;
  info.midway_y = (t2 >> 4) & 0x0f;
  info.midway_x = t2 & 0x0f;
  info.midway_relative_r = (t3 >> 5) & 0x1;
  info.midway_face_left_l = (t3 >> 4) & 0x1;
  info.midway_redirect_e = (t3 >> 3) & 0x1;
  info.midway_fg_ff = (t3 >> 2) & 0x3;
  info.midway_bg_bb = t3 & 0x3;
  info.midway_fg_bg_offset_f = (info.midway_b4 >> 6) & 0x1;
  if (info.midway_redirect_e) {
    info.midway_redirect_target_level = t2 | ((t3 & 0x1) << 8);
  }
}

function decodeLmObject(obj) {
  const dec = { present: false, kind: OBJ_DEC_NONE };
  if (obj.kind === OBJ_EXTENDED && obj.object_number === 0x03 && obj.raw_len >= 3) {
    dec.present = true;
    dec.kind = OBJ_DEC_LM_EXT03_SCREEN_JUMP;
    dec.half_vert_subscreen_5b = obj.raw[0] & 0x1f;
    dec.horiz_screen_5b = obj.raw[1] & 0x1f;
    return dec;
  }
  if (obj.kind !== OBJ_STANDARD) return dec;
  const id = obj.object_number;
  if (id === 0x22 || id === 0x23) {
    if (obj.raw_len >= 4) {
      dec.present = true;
      dec.kind = id === 0x22 ? OBJ_DEC_LM_22_MAP16_PAGE0 : OBJ_DEC_LM_23_MAP16_PAGE1;
      /* LM 22/23: N10YYYYY | 001BXXXX | HHHHWWWW | bbbbbbbb (SMW wiki / level_parse.c). */
      dec.map16_tile_9b = obj.raw[3] | (((obj.raw[1] >> 4) & 0x01) << 8);
      dec.height_4b = (obj.raw[2] >> 4) & 0x0f;
      dec.width_4b = obj.raw[2] & 0x0f;
    }
    return dec;
  }
  if (id === 0x24 && obj.raw_len >= 3) {
    dec.present = true;
    dec.kind = OBJ_DEC_LM_24_OLD_FGBGSP_BYPASS;
    dec.sprite_gfx_list_plus1 = ((obj.raw[0] & 0x0f) << 4) | (obj.raw[1] & 0x0f);
    dec.fgbg_gfx_list_plus1 = obj.raw[2];
    return dec;
  }
  if (id === 0x25 && obj.raw_len >= 3) {
    dec.present = true;
    dec.kind = OBJ_DEC_LM_25_OLD_AN2_BYPASS;
    dec.unused_u = ((obj.raw[0] & 0x0f) << 4) | (obj.raw[1] & 0x0f);
    dec.an2_file_plus1 = obj.raw[2];
    return dec;
  }
  if (id === 0x26 && obj.raw_len >= 3) {
    dec.present = true;
    dec.kind = OBJ_DEC_LM_26_MUSIC_BYPASS;
    dec.unused_u = ((obj.raw[0] & 0x0f) << 4) | (obj.raw[1] & 0x0f);
    dec.song_plus1 = obj.raw[2];
    return dec;
  }
  if (id === 0x28 && obj.raw_len >= 3) {
    dec.present = true;
    dec.kind = OBJ_DEC_LM_28_TIME_BYPASS;
    dec.tens_4b = obj.raw[0] & 0x0f;
    dec.ones_4b = obj.raw[1] & 0x0f;
    dec.force_reset_r = (obj.raw[2] >> 4) & 0x01;
    dec.hundreds_4b = obj.raw[2] & 0x0f;
    return dec;
  }
  if (id === 0x2d && obj.raw_len >= 5) {
    dec.present = true;
    dec.kind = OBJ_DEC_LM_2D_USER_DEFINED;
    dec.ext_a = obj.raw[3];
    dec.ext_b = obj.raw[4];
    return dec;
  }
  if ((id === 0x27 || id === 0x29) && obj.raw_len >= 5) {
    dec.present = true;
    dec.kind = id === 0x27 ? OBJ_DEC_LM_27_DIRECT_MAP16_P00_3F : OBJ_DEC_LM_29_DIRECT_MAP16_P40_7F;
    const b2v = obj.raw[2];
    const b3v = obj.raw[3];
    const mode = (b3v >> 6) & 0x3;
    dec.base_map16 = ((b3v & 0x3f) << 8) | obj.raw[4];
    dec.conditional_add_a = 0;
    dec.conditional_flag_7b = 0;
    dec.sel_w_4b = 0;
    dec.sel_h_4b = 0;
    if (mode === 0) {
      dec.variant = 0;
      dec.height = (b2v >> 4) & 0x0f;
      dec.width = b2v & 0x0f;
    } else if (mode === 1) {
      dec.variant = 1;
      dec.sel_h_4b = (b2v >> 4) & 0x0f;
      dec.sel_w_4b = b2v & 0x0f;
    } else if (mode === 2) {
      dec.variant = 2;
      dec.height = (b2v >> 4) & 0x0f;
      dec.width = b2v & 0x0f;
      if (obj.raw_len >= 6) {
        dec.sel_h_4b = (obj.raw[5] >> 4) & 0x0f;
        dec.sel_w_4b = obj.raw[5] & 0x0f;
      }
    } else {
      const conditional = (b2v & 0x80) ? 1 : 0;
      dec.variant = conditional ? 4 : 3;
      dec.width = b2v & 0x7f;
      if (obj.raw_len >= 7) {
        dec.sel_h_4b = (obj.raw[5] >> 4) & 0x0f;
        dec.sel_w_4b = obj.raw[5] & 0x0f;
        dec.height = obj.raw[6];
      }
      if (conditional && obj.raw_len >= 8) {
        const acc = obj.raw[7];
        dec.conditional_add_a = (acc >> 7) & 0x1;
        dec.conditional_flag_7b = acc & 0x7f;
      }
    }
    return dec;
  }
  return dec;
}

function decodedToJson(dec) {
  const out = { present: !!dec.present };
  if (!dec.present) return out;
  out.kind = DECODED_KIND_NAMES[dec.kind] || 'none';
  switch (dec.kind) {
    case OBJ_DEC_LM_22_MAP16_PAGE0:
    case OBJ_DEC_LM_23_MAP16_PAGE1:
      out.map16_tile_9b = dec.map16_tile_9b;
      out.height_4b = dec.height_4b;
      out.width_4b = dec.width_4b;
      break;
    case OBJ_DEC_LM_24_OLD_FGBGSP_BYPASS:
      out.sprite_gfx_list_plus1 = dec.sprite_gfx_list_plus1;
      out.fgbg_gfx_list_plus1 = dec.fgbg_gfx_list_plus1;
      break;
    case OBJ_DEC_LM_25_OLD_AN2_BYPASS:
      out.unused_u = dec.unused_u;
      out.an2_file_plus1 = dec.an2_file_plus1;
      break;
    case OBJ_DEC_LM_26_MUSIC_BYPASS:
      out.unused_u = dec.unused_u;
      out.song_plus1 = dec.song_plus1;
      break;
    case OBJ_DEC_LM_27_DIRECT_MAP16_P00_3F:
    case OBJ_DEC_LM_29_DIRECT_MAP16_P40_7F:
      out.variant = dec.variant;
      out.base_map16 = dec.base_map16;
      out.width = dec.width ?? 0;
      out.height = dec.height ?? 0;
      out.sel_w_4b = dec.sel_w_4b;
      out.sel_h_4b = dec.sel_h_4b;
      out.conditional_flag_7b = dec.conditional_flag_7b;
      out.conditional_add_a = dec.conditional_add_a;
      break;
    case OBJ_DEC_LM_28_TIME_BYPASS:
      out.ones_4b = dec.ones_4b;
      out.tens_4b = dec.tens_4b;
      out.hundreds_4b = dec.hundreds_4b;
      out.force_reset_r = dec.force_reset_r;
      break;
    case OBJ_DEC_LM_2D_USER_DEFINED:
      out.ext_a = dec.ext_a;
      out.ext_b = dec.ext_b;
      break;
    case OBJ_DEC_LM_EXT03_SCREEN_JUMP:
      out.horiz_screen_5b = dec.horiz_screen_5b;
      out.half_vert_subscreen_5b = dec.half_vert_subscreen_5b;
      break;
    default:
      break;
  }
  return out;
}

function levelAssignObjectScreens(objects) {
  let screen = 0;
  for (const o of objects) {
    if (o.kind === OBJ_EXTENDED && o.object_number === 0x01 && o.raw_len >= 3) {
      screen = o.raw[0] & 0x1f;
      continue;
    }
    if (o.kind === OBJ_EXTENDED && o.object_number === 0x03 && o.raw_len >= 3) {
      screen = o.raw[0] & 0x1f;
      continue;
    }
    if (o.kind === OBJ_SCREEN_EXIT) continue;
    if (o.new_screen) {
      screen++;
      if (screen > 31) screen = 31;
    }
    o.screen_number = screen & 0x1f;
  }
}

function parseObjectsFromBuf(buf, offset, max, isVertical) {
  if (!buf || max < 6) return { ok: false, error: 'Layer1 buffer too small' };
  const p = buf;
  const start = offset || 0;
  const info = {
    primary: decodePrimary(p.subarray(start, start + 5)),
    objects: [],
  };

  if (!isVertical) {
    switch (info.primary.level_mode) {
      case 0x08:
      case 0x09:
      case 0x0a:
      case 0x0b:
      case 0x0c:
      case 0x0d:
      case 0x1a:
      case 0x1b:
        isVertical = true;
        break;
      default:
        break;
    }
  }

  let i = start + 5;
  const end = start + max;
  let objIndex = 0;

  while (i < end) {
    const b0 = p[i];
    if (b0 === 0xff) {
      i += 1;
      break;
    }
    if (i + 3 > end) break;

    const newScreen = (b0 >> 7) & 0x1;
    const bb = (b0 >> 5) & 0x3;
    const y = b0 & 0x1f;
    const b1 = p[i + 1];
    const b2 = p[i + 2];
    const bbbb = (b1 >> 4) & 0xf;
    const x = b1 & 0x0f;
    const settings = b2;
    const standardId = (bb << 4) | bbbb;

    const obj = {
      kind: OBJ_STANDARD,
      index: objIndex,
      byte_offset: i - start,
      new_screen: newScreen,
      x_position: x,
      y_position: y,
      settings,
      xy_swapped: isVertical ? 1 : 0,
      raw: Buffer.alloc(8),
      raw_len: 0,
      object_number: standardId,
      screen_number: 0,
      lm_midway_water: 0,
      lm_modified: 0,
      secondary_exit_flag: 0,
      secondary_exit_id_or_dest: 0,
    };

    if (standardId === 0x00) {
      const extId = b2;
      const olen = objectLenForExtended(extId);
      if (i + olen > end) return { ok: false, error: 'Truncated extended object' };
      obj.kind = extId === 0x00 ? OBJ_SCREEN_EXIT : OBJ_EXTENDED;
      obj.object_number = extId;
      obj.raw_len = olen;
      p.copy(obj.raw, 0, i, i + olen);
      if (extId === 0x00 && olen >= 4) {
        obj.screen_number = p[i] & 0x1f;
        obj.lm_midway_water = (p[i + 1] >> 3) & 0x1;
        obj.lm_modified = (p[i + 1] >> 2) & 0x1;
        obj.secondary_exit_flag = (p[i + 1] >> 1) & 0x1;
        obj.secondary_exit_id_or_dest = ((p[i + 1] & 0x1) << 8) | p[i + 3];
      } else if (extId === 0x02 && olen >= 5) {
        obj.screen_number = p[i] & 0x1f;
        obj.lm_midway_water = (p[i + 4] >> 2) & 0x1;
        obj.secondary_exit_flag = 1;
        obj.secondary_exit_id_or_dest = ((p[i + 4] & 0x1) << 8) | p[i + 3];
      }
      i += olen;
    } else {
      const olen = objectLenForStandard(standardId, p, i, end - i);
      if (i + olen > end) return { ok: false, error: 'Truncated standard object' };
      obj.kind = OBJ_STANDARD;
      obj.object_number = standardId;
      obj.raw_len = olen;
      p.copy(obj.raw, 0, i, i + olen);
      i += olen;
    }

    obj.decoded = decodeLmObject(obj);
    info.objects.push(obj);
    objIndex++;
    if (objIndex > 200000) return { ok: false, error: 'Object parse runaway' };
  }

  info.layer1_blob_len = i - start;
  levelAssignObjectScreens(info.objects);
  return { ok: true, info, consumed: i - start };
}

function spriteExtTableEnabled(rom) {
  const b = read8Snes(rom, (0x0e << 16) | 0xf30f);
  if (b !== 0x42) return 0;
  const p = read24Snes(rom, (0x0e << 16) | 0xf30c);
  return p || 0;
}

function spriteExtLenLookup(rom, sizeTableSnes, extraBits, spriteId) {
  if (!sizeTableSnes) return 0;
  const idx = extraBits * 0x100 + spriteId;
  const v = read8Snes(rom, sizeTableSnes + idx);
  if (v == null) return null;
  return v <= 3 ? 0 : v - 3;
}

function parseSpritesFromBuf(buf, offset, len, rom) {
  if (!buf || len < 1) return { ok: false, error: 'parse_sprites_from_buf: invalid args' };
  const start = offset || 0;
  const spriteHeader = decodeSpriteHeader(buf[start]);
  const sizeTableSnes = rom ? spriteExtTableEnabled(rom) : 0;
  const sprites = [];
  let i = start + 1;
  const end = start + len;
  let yJumpHigh7 = 0;
  let spriteIndex = 0;

  while (i < end) {
    if (spriteIndex > 100000) return { ok: false, error: 'Sprite parse runaway' };
    let b0 = buf[i];

    if (!spriteHeader.new_sprite_system) {
      if (b0 === 0xff) break;
      if (i + 3 > end) return { ok: false, error: 'Truncated sprite record' };
      const b1 = buf[i + 1];
      const b2 = buf[i + 2];
      const recOff = i;
      i += 3;
      const yLow5 = (((b0 >> 4) & 0xf) << 1) | (b0 & 0x1);
      const extraBits = (b0 >> 2) & 0x3;
      const screen = (((b0 >> 1) & 0x1) << 4) | (b1 & 0xf);
      const x = (b1 >> 4) & 0xf;
      const spriteId = b2;
      let extLen = spriteExtLenLookup(rom, sizeTableSnes, extraBits, spriteId);
      if (extLen == null) return { ok: false, error: 'Failed reading sprite extension length' };
      if (extLen > 12) return { ok: false, error: 'Sprite extension length too large' };
      if (i + extLen > end) return { ok: false, error: 'Truncated sprite extension bytes' };
      const extBytes = extLen ? Array.from(buf.subarray(i, i + extLen)) : [];
      i += extLen;
      sprites.push({
        index: spriteIndex++,
        byte_offset: recOff - start,
        y: yLow5,
        x,
        screen,
        extra_bits: extraBits,
        sprite_id: spriteId,
        xy_swapped: 0,
        ext_len: extLen,
        ext_bytes: extBytes,
      });
      continue;
    }

    if (b0 === 0xff) {
      if (i + 2 > end) return { ok: false, error: 'Truncated sprite command' };
      const cmd = buf[i + 1];
      i += 2;
      if (cmd <= 0x7f) {
        yJumpHigh7 = cmd;
        continue;
      }
      if (cmd === 0xfe) break;
      if (cmd !== 0xff) continue;
      b0 = 0xff;
    } else {
      i += 1;
    }

    if (i + 2 > end) return { ok: false, error: 'Truncated sprite record' };
    const b1 = buf[i];
    const b2 = buf[i + 1];
    const recOff = i - 1;
    i += 2;
    const yLow5 = (((b0 >> 4) & 0xf) << 1) | (b0 & 0x1);
    const extraBits = (b0 >> 2) & 0x3;
    const screen = (((b0 >> 1) & 0x1) << 4) | (b1 & 0xf);
    const x = (b1 >> 4) & 0xf;
    const spriteId = b2;
    const y = (yJumpHigh7 << 5) | yLow5;
    let extLen = spriteExtLenLookup(rom, sizeTableSnes, extraBits, spriteId);
    if (extLen == null) return { ok: false, error: 'Failed reading sprite extension length' };
    if (extLen > 12) return { ok: false, error: 'Sprite extension length too large' };
    if (i + extLen > end) return { ok: false, error: 'Truncated sprite extension bytes' };
    const extBytes = extLen ? Array.from(buf.subarray(i, i + extLen)) : [];
    i += extLen;
    sprites.push({
      index: spriteIndex++,
      byte_offset: recOff - start,
      y,
      x,
      screen,
      extra_bits: extraBits,
      sprite_id: spriteId,
      xy_swapped: 0,
      ext_len: extLen,
      ext_bytes: extBytes,
    });
  }

  return { ok: true, spriteHeader, sprites, consumed: i - start };
}

function lcRle1Decompress(buf, offset, srclen) {
  const src = buf;
  const cap = 1024;
  let dst = Buffer.alloc(cap);
  let i = offset || 0;
  const end = i + srclen;
  let j = 0;
  while (i < end) {
    const lenb = src[i++];
    if (lenb === 0xff) break;
    const rle = (lenb >> 7) & 0x1;
    const len = (lenb & 0x7f) + 1;
    if (!rle) {
      if (i + len > end) return { ok: false, error: 'lc_rle1_decompress: truncated literal' };
      while (j + len > dst.length) dst = Buffer.concat([dst, Buffer.alloc(dst.length)]);
      src.copy(dst, j, i, i + len);
      i += len;
      j += len;
    } else {
      if (i >= end) return { ok: false, error: 'lc_rle1_decompress: truncated run byte' };
      const v = src[i++];
      while (j + len > dst.length) dst = Buffer.concat([dst, Buffer.alloc(dst.length)]);
      dst.fill(v, j, j + len);
      j += len;
    }
    if (j > 0x200000) return { ok: false, error: 'lc_rle1_decompress: output too large' };
  }
  return { ok: true, bytes: dst.subarray(0, j), consumed: i - (offset || 0) };
}

function readLayerPtr24(rom, tableSnes, levelId) {
  const entry = tableSnes + levelId * 3;
  return read24Snes(rom, entry);
}

function readTableByte(rom, baseSnes, levelId) {
  if (!baseSnes) return null;
  return read8Snes(rom, baseSnes + levelId);
}

function readSpritePtr(rom, tables, levelId) {
  const entry = tables.sprite_ptr_table + levelId * 2;
  const off = read16Snes(rom, entry);
  if (off == null) return null;
  let bank = 0x07;
  if (tables.sprite_bank_table) {
    const b = read8Snes(rom, tables.sprite_bank_table + levelId);
    if (b != null) bank = b;
  }
  return (bank << 16) | off;
}

function readMidwayByte(rom, tables, levelId) {
  if (!tables.has_midway_hijack || !tables.midway_byte1 || !tables.midway_byte2 || !tables.midway_byte3) {
    return null;
  }
  const b1 = read8Snes(rom, tables.midway_byte1 + levelId);
  const b2 = read8Snes(rom, tables.midway_byte2 + levelId);
  const b3 = read8Snes(rom, tables.midway_byte3 + levelId);
  if (b1 == null || b2 == null || b3 == null) return null;
  let b4 = 0;
  if (tables.has_midway_table4 && tables.midway_byte4) {
    b4 = read8Snes(rom, tables.midway_byte4 + levelId) || 0;
  }
  return { b1, b2, b3, b4 };
}

function readLevelExgfxBypass(rom, levelId) {
  const base = read24Snes(rom, 0x0ff7ff);
  if (!base) return null;
  const pc = snesLoromToPc(rom, base + levelId * 32);
  if (pc == null || pc + 32 > rom.size) return null;
  return rom.data.subarray(pc, pc + 32);
}

function readLayer2Flags(rom, levelId) {
  return read8Snes(rom, (0x0e << 16) | (0xf310 + levelId));
}

function layer2IsBgTilemapFromFlags(flags) {
  const v = (flags >> 3) & 0x1;
  const t = flags & 0x1;
  return !!(v || t);
}

function parseLayer2BgTilemap(rom, layer2PtrSnes, flags) {
  const bank = (layer2PtrSnes >> 16) & 0xff;
  if (bank === 0xff) return { ok: true, isBg: true };
  const pc = snesLoromToPc(rom, layer2PtrSnes);
  if (pc == null) return { ok: false, error: 'Layer2 BG pointer unmappable' };
  let srclen = rom.size - pc;
  if (srclen > 0x20000) srclen = 0x20000;
  const lowRes = lcRle1Decompress(rom.data, pc, srclen);
  if (!lowRes.ok) return lowRes;
  if (!lowRes.bytes.length || !(lowRes.bytes.length === 864 || lowRes.bytes.length === 1024)) {
    return { ok: false, error: 'Layer2 BG tilemap unexpected low-byte size' };
  }
  let high = null;
  if (pc + lowRes.consumed < rom.size) {
    let rem = rom.size - (pc + lowRes.consumed);
    if (rem > 0x20000) rem = 0x20000;
    const highRes = lcRle1Decompress(rom.data, pc + lowRes.consumed, rem);
    if (highRes.ok && highRes.bytes.length === lowRes.bytes.length) high = highRes.bytes;
  }
  const w = 32;
  const h = lowRes.bytes.length / 32;
  const tiles = new Array(w * h);
  const half = 16 * h;
  const constHigh = (flags >> 4) & 0xf;
  const f = (flags >> 2) & 0x1;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const srcI = xx < 16 ? yy * 16 + xx : half + yy * 16 + (xx - 16);
      const lo = lowRes.bytes[srcI];
      let hi = 0;
      if (high) hi = high[srcI];
      else if (!f) hi = constHigh;
      tiles[yy * w + xx] = lo | (hi << 8);
    }
  }
  return { ok: true, isBg: true, width: w, height: h, tiles };
}

function parseLevelInfoRaw(rom, tables, levelId) {
  const info = {
    level_id: levelId,
    layer1_data_ptr_snes: 0,
    layer2_data_ptr_snes: 0,
    sprite_data_ptr_snes: 0,
    midway_present: false,
    midway_b1: 0,
    midway_b2: 0,
    midway_b3: 0,
    midway_b4: 0,
    primary: null,
    secondary: { present: true, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0 },
    secondary_decoded: { present: false },
    sprite_header: { present: false },
    objects: [],
    layer2_objects: [],
    layer2_objects_count: 0,
    layer2_is_bg_tilemap: false,
    layer2_bg_flags_0ef310: 0,
    layer2_bg_width: 0,
    layer2_bg_height: 0,
    layer2_bg_tiles: null,
    exgfx_bytes: null,
    exgfx_len: 0,
    exgfx_present: false,
    sprites: [],
    sprites_count: 0,
  };

  const layer1Ptr = readLayerPtr24(rom, tables.layer1_ptr_table, levelId);
  if (layer1Ptr == null) return { ok: false, error: 'Failed to read Layer1 pointer table entry' };
  info.layer1_data_ptr_snes = layer1Ptr;

  const layer2Ptr = readLayerPtr24(rom, tables.layer2_ptr_table, levelId);
  if (layer2Ptr != null) {
    info.layer2_data_ptr_snes = layer2Ptr;
    const l2flags = readLayer2Flags(rom, levelId);
    if (l2flags != null) {
      info.layer2_bg_flags_0ef310 = l2flags;
      info.layer2_is_bg_tilemap = layer2IsBgTilemapFromFlags(l2flags);
    } else {
      const bank = (layer2Ptr >> 16) & 0xff;
      info.layer2_is_bg_tilemap = bank === 0xff;
    }
  }

  const b1 = readTableByte(rom, tables.sec_byte1, levelId);
  const b2 = readTableByte(rom, tables.sec_byte2, levelId);
  const b3 = readTableByte(rom, tables.sec_byte3, levelId);
  const b4 = readTableByte(rom, tables.sec_byte4, levelId);
  if (b1 == null || b2 == null || b3 == null || b4 == null) {
    return { ok: false, error: 'Failed reading secondary header tables' };
  }
  info.secondary.b1 = b1;
  info.secondary.b2 = b2;
  info.secondary.b3 = b3;
  info.secondary.b4 = b4;
  if (tables.sec_byte5) info.secondary.b5 = readTableByte(rom, tables.sec_byte5, levelId) || 0;
  if (tables.sec_byte6) info.secondary.b6 = readTableByte(rom, tables.sec_byte6, levelId) || 0;
  if (tables.sec_byte7) info.secondary.b7 = readTableByte(rom, tables.sec_byte7, levelId) || 0;
  if (tables.sec_byte8) info.secondary.b8 = readTableByte(rom, tables.sec_byte8, levelId) || 0;
  info.secondary_decoded = decodeSecondary(info.secondary);
  info.secondary_decoded.present = true;

  const midway = readMidwayByte(rom, tables, levelId);
  if (midway) {
    info.midway_present = true;
    info.midway_b1 = midway.b1;
    info.midway_b2 = midway.b2;
    info.midway_b3 = midway.b3;
    info.midway_b4 = midway.b4;
    decodeMidway(info);
  }

  const spritePtr = readSpritePtr(rom, tables, levelId);
  if (spritePtr != null) {
    info.sprite_data_ptr_snes = spritePtr;
    const spPc = snesLoromToPc(rom, spritePtr);
    if (spPc != null) {
      const HARD_CAP = 0x20000;
      let avail = rom.size - spPc;
      if (avail > HARD_CAP) avail = HARD_CAP;
      const spRes = parseSpritesFromBuf(rom.data, spPc, avail, rom);
      if (spRes.ok) {
        info.sprite_header = spRes.spriteHeader;
        info.sprites = spRes.sprites;
        info.sprites_count = spRes.sprites.length;
      }
    }
  }

  const l1Pc = snesLoromToPc(rom, layer1Ptr);
  if (l1Pc == null) return { ok: false, error: 'Layer1 pointer unmappable' };
  const HARD_CAP = 0x20000;
  let max = rom.size - l1Pc;
  if (max > HARD_CAP) max = HARD_CAP;
  if (max < 6) return { ok: false, error: 'Layer1 data too small' };
  const objRes = parseObjectsFromBuf(rom.data, l1Pc, max, 0);
  if (!objRes.ok) return objRes;
  info.primary = objRes.info.primary;
  info.objects = objRes.info.objects;

  const exgfx = readLevelExgfxBypass(rom, levelId);
  if (exgfx) {
    info.exgfx_present = true;
    info.exgfx_bytes = exgfx;
    info.exgfx_len = exgfx.length;
  }

  if (info.layer2_data_ptr_snes) {
    const bank = (info.layer2_data_ptr_snes >> 16) & 0xff;
    const tryBg = info.layer2_is_bg_tilemap || bank === 0xff;
    if (tryBg) {
      const bgRes = parseLayer2BgTilemap(rom, info.layer2_data_ptr_snes, info.layer2_bg_flags_0ef310);
      if (bgRes.ok && bgRes.tiles && bgRes.width && bgRes.height) {
        info.layer2_is_bg_tilemap = true;
        info.layer2_bg_width = bgRes.width;
        info.layer2_bg_height = bgRes.height;
        info.layer2_bg_tiles = bgRes.tiles;
        info.layer2_objects_count = 0;
      } else {
        const l2Pc = snesLoromToPc(rom, info.layer2_data_ptr_snes);
        if (l2Pc != null) {
          let l2max = rom.size - l2Pc;
          if (l2max > HARD_CAP) l2max = HARD_CAP;
          const l2Res = parseObjectsFromBuf(rom.data, l2Pc, l2max, 0);
          if (l2Res.ok) {
            info.layer2_objects = l2Res.info.objects;
            info.layer2_objects_count = l2Res.info.objects.length;
            info.layer2_is_bg_tilemap = false;
          }
        }
      }
    } else {
      const l2Pc = snesLoromToPc(rom, info.layer2_data_ptr_snes);
      if (l2Pc != null) {
        let l2max = rom.size - l2Pc;
        if (l2max > HARD_CAP) l2max = HARD_CAP;
        const l2Res = parseObjectsFromBuf(rom.data, l2Pc, l2max, 0);
        if (l2Res.ok) {
          info.layer2_objects = l2Res.info.objects;
          info.layer2_objects_count = l2Res.info.objects.length;
        }
      }
    }
  }

  return { ok: true, info };
}

function objectToJson(o, extendedField) {
  const base = {
    new_screen: o.new_screen,
    y_position: o.y_position,
    x_position: o.x_position,
    xy_swapped: o.xy_swapped,
    decoded: decodedToJson(o.decoded || { present: false }),
  };
  if (o.kind === OBJ_STANDARD) {
    return {
      ...base,
      object_number: o.object_number,
      settings: o.settings,
    };
  }
  if (o.kind === OBJ_EXTENDED) {
    return {
      ...base,
      [extendedField || 'ext_object_number']: o.object_number,
    };
  }
  if (o.kind === OBJ_SCREEN_EXIT) {
    return {
      screen_number: o.screen_number,
      lm_midway_water: o.lm_midway_water,
      lm_modified: o.lm_modified,
      secondary_exit_flag: o.secondary_exit_flag,
      secondary_exit_id_or_dest: o.secondary_exit_id_or_dest,
      decoded: decodedToJson(o.decoded || { present: false }),
    };
  }
  return base;
}

function levelInfoToJson(info, tables, includeObjects = true) {
  const out = {
    level_id: info.level_id,
    layer1_data_ptr_snes: info.layer1_data_ptr_snes,
    layer2_data_ptr_snes: info.layer2_data_ptr_snes,
    sprite_data_ptr_snes: info.sprite_data_ptr_snes,
    layer1: {
      primary_level_header: {
        bg_palette: info.primary.bg_palette,
        length_in_screens: info.primary.length_in_screens,
        back_area_color: info.primary.back_area_color,
        level_mode: info.primary.level_mode,
        layer3_priority: info.primary.layer3_priority,
        music_mmm: info.primary.music_mmm,
        sprite_gfx: info.primary.sprite_gfx,
        timer_setting: info.primary.timer_setting,
        sprite_palette: info.primary.sprite_palette,
        fg_palette: info.primary.fg_palette,
        item_memory_set: info.primary.item_memory_set,
        vertical_scroll_set: info.primary.vertical_scroll_set,
        fgbg_gfx_setting: info.primary.fgbg_gfx_setting,
      },
      secondary_level_header: {
        present: info.secondary.present,
        byte1_05f000: info.secondary.b1,
        byte2_05f200: info.secondary.b2,
        byte3_05f400: info.secondary.b3,
        byte4_05f600: info.secondary.b4,
        decoded: {
          l2_scroll_h: info.secondary_decoded.l2_scroll_h,
          main_y_low4: info.secondary_decoded.main_y_low4,
          main_x: info.secondary_decoded.main_x_3b,
          main_action: info.secondary_decoded.main_action_3b,
          main_screen_num: info.secondary_decoded.main_screen_5b,
          midway_screen_nibble: info.secondary_decoded.midway_screen_4b,
          no_yoshi_intro: info.secondary_decoded.no_yoshi_intro,
          vpos_flag: info.secondary_decoded.vpos_flag_v,
        },
      },
    },
    midway_entrance: {
      present: info.midway_present,
    },
    layer2: {
      present: info.layer2_data_ptr_snes !== 0,
    },
    sprite_header: {
      present: info.sprite_header.present,
    },
    sprite_data: {
      sprites: [],
    },
  };

  if (tables.sec_byte5) out.layer1.secondary_level_header.byte5_lm = info.secondary.b5;
  if (tables.sec_byte6) {
    out.layer1.secondary_level_header.byte6_06fa00 = info.secondary.b6;
    out.layer1.secondary_level_header.decoded.expanded_format_header = {
      lmexp_l2orl3: info.secondary_decoded.shc_s,
      lmexp_bottom_row: info.secondary_decoded.shc_h,
      lmexp_horizontal: info.secondary_decoded.shc_c,
      l2_vertical_scroll: info.secondary_decoded.l2_vertical_vvvvv,
    };
  }
  if (tables.sec_byte7) out.layer1.secondary_level_header.byte7_06fc00 = info.secondary.b7;
  if (tables.sec_byte8) out.layer1.secondary_level_header.byte8_06fe00 = info.secondary.b8;

  if (includeObjects) {
    out.layer1.objects = {
      standard: [],
      extended: [],
      screen_exits: [],
    };
    for (const o of info.objects) {
      if (o.kind === OBJ_STANDARD) out.layer1.objects.standard.push(objectToJson(o));
      else if (o.kind === OBJ_EXTENDED) out.layer1.objects.extended.push(objectToJson(o));
      else if (o.kind === OBJ_SCREEN_EXIT) out.layer1.objects.screen_exits.push(objectToJson(o));
    }
  }

  if (info.midway_present) {
    out.midway_entrance.b1 = info.midway_b1;
    out.midway_entrance.b2 = info.midway_b2;
    out.midway_entrance.b3 = info.midway_b3;
    out.midway_entrance.b4 = info.midway_b4;
    out.midway_entrance.decoded = {
      slippery_i: info.midway_slippery_i,
      water_w: info.midway_water_w,
      separate_h: info.midway_separate_h,
      screen_bit4_m: info.midway_screen_bit4_m,
      action_aaa: info.midway_action_aaa,
      x_low4: info.midway_x,
      y_low4: info.midway_y,
      relative_r: info.midway_relative_r,
      fg_ff: info.midway_fg_ff,
      bg_bb: info.midway_bg_bb,
      face_left_l: info.midway_face_left_l,
      redirect_e: info.midway_redirect_e,
    };
    if (info.midway_redirect_e) {
      out.midway_entrance.decoded.redirect_target_level = info.midway_redirect_target_level;
    }
  }

  if (info.layer2_data_ptr_snes) {
    out.layer2.is_bg_tilemap = !!info.layer2_is_bg_tilemap;
    out.layer2.bg_flags_0ef310 = info.layer2_bg_flags_0ef310;
    if (info.layer2_is_bg_tilemap) {
      out.layer2.kind = 'bg_tilemap';
      out.layer2.width = info.layer2_bg_width;
      out.layer2.height = info.layer2_bg_height;
    } else {
      out.layer2.kind = 'objects';
      out.layer2.objects_count = info.layer2_objects_count;
    }
  }

  if (info.sprite_header.present) {
    out.sprite_header.sprite_buoyancy_s = info.sprite_header.buoyancy_s;
    out.sprite_header.sprite_buoyancy_b = info.sprite_header.buoyancy_b;
    out.sprite_header.new_sprite_system = info.sprite_header.new_sprite_system;
    out.sprite_header.sprite_memory = info.sprite_header.sprite_memory;
  }

  out.sprite_data.sprites = info.sprites.map((s) => ({
    y: s.y,
    extra_bits: s.extra_bits,
    x: s.x,
    screen: s.screen,
    sprite_id: s.sprite_id,
    xy_swapped: s.xy_swapped,
    ext_bytes: s.ext_bytes,
  }));

  return out;
}

module.exports = {
  OBJ_STANDARD,
  OBJ_EXTENDED,
  OBJ_SCREEN_EXIT,
  layer1BlobLooksValid,
  levelAssignObjectScreens,
  parseLevelInfoRaw,
  levelInfoToJson,
  decodedToJson,
  decodePrimary,
};
