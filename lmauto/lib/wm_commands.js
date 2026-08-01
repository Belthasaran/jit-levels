/**
 * Lunar Magic WM_COMMAND identifiers (decimal).
 * Source: lminterop/artifacts_in/lunarnotes2.md (+ lmMainMenuItems0.txt).
 * Main window class: LMFrame. Level editor pane: SMWLevelEditor.
 */
'use strict';

const WM = Object.freeze({
  /** File > Open ROM */
  OPEN_ROM: 9100,
  /** File > Open Level Number (Ctrl+D) */
  OPEN_LEVEL_NUMBER: 9102,
  /** File > Levels > Export Multiple Levels to Files (MWL) */
  EXPORT_MULTIPLE_LEVELS_MWL: 9123,
  /** File > Levels > Export Multiple Levels to Image Files */
  EXPORT_MULTIPLE_LEVELS_IMAGES: 9148,
  /** File > Levels > Export Level to Image File */
  EXPORT_LEVEL_IMAGE: 9149,

  /** View > Layer 1 (Level) */
  VIEW_LAYER1: 9200,
  /** View > Layer 2 (Level/Image) */
  VIEW_LAYER2: 9201,
  /** View > Sprites */
  VIEW_SPRITES: 9203,
  /** View > Sprite Data (Hex Code) */
  VIEW_SPRITE_DATA_HEX: 9204,
  /** View > Screen Exits */
  VIEW_SCREEN_EXITS: 9205,
  /** View > Sub-Screen Boundaries */
  VIEW_SUBSCREEN_BOUNDS: 9206,
  /** View > Game View Screen */
  VIEW_GAME_VIEW: 9207,
  /** View > Next Animated Frame (Ctrl+6) */
  VIEW_NEXT_ANIM_FRAME: 9219,
  /** View > Animation (toggle) */
  VIEW_ANIMATION: 9220,
  /** View > Tile Grid (F8) */
  VIEW_TILE_GRID: 9224,
  /** View > Reset Animations (Shift+6) */
  VIEW_RESET_ANIMATIONS: 9230,
  /** View > Layer 3 (Image) */
  VIEW_LAYER3: 9231,
  /** View > Tile Surface Outlines */
  VIEW_TILE_SURFACE_OUTLINES: 9232,
  /** View > Line Guide Outlines */
  VIEW_LINE_GUIDE_OUTLINES: 9233,
  /** View > Exit Enabled Tiles */
  VIEW_EXIT_ENABLED_TILES: 9234,
  /** View > Block Contents */
  VIEW_BLOCK_CONTENTS: 9235,
  /** View > Level Entrances (F5) */
  VIEW_LEVEL_ENTRANCES: 9236,
  /** View > Zoom > 100% */
  VIEW_ZOOM_100: 9290,
});

/** Dialog 1027 "Export Levels to Images" control IDs (Dialog.rc). */
const DLG_EXPORT_IMAGES = Object.freeze({
  CAPTION: 'Export Levels to Images',
  /** Select Directory && File Name */
  SELECT_DIR_FILE: 1,
  CANCEL: 2,
  /** Only export modified levels from the ROM */
  ONLY_MODIFIED: 149,
  /** Auto-Set Number of Screens */
  AUTO_SET_SCREENS: 8867,
});

/** Common control / Win32 constants used by the automator. */
const WIN = Object.freeze({
  WM_COMMAND: 0x0111,
  WM_SETTEXT: 0x000c,
  WM_GETTEXT: 0x000d,
  WM_GETTEXTLENGTH: 0x000e,
  WM_CLOSE: 0x0010,
  WM_KEYDOWN: 0x0100,
  WM_KEYUP: 0x0101,
  BM_GETCHECK: 0x00f0,
  BM_SETCHECK: 0x00f1,
  BM_CLICK: 0x00f5,
  BST_UNCHECKED: 0,
  BST_CHECKED: 1,
  MF_BYCOMMAND: 0x00000000,
  MFS_CHECKED: 0x00000008,
  MIIM_STATE: 0x00000001,
  MIIM_ID: 0x00000002,
  MIIM_SUBMENU: 0x00000004,
  VK_ESCAPE: 0x1b,
  VK_RETURN: 0x0d,
  /** Common file dialog filename edit (GetSaveFileName) */
  CDN_FILENAME_EDIT: 0x047c,
  IDOK: 1,
  IDCANCEL: 2,
});

const WINDOW_CLASS = Object.freeze({
  LM_FRAME: 'LMFrame',
  LEVEL_EDITOR: 'SMWLevelEditor',
  DIALOG: '#32770',
});

/** Overlay View items normally forced OFF for clean layer exports. */
const DEFAULT_OVERLAYS_OFF = Object.freeze([
  WM.VIEW_SPRITE_DATA_HEX,
  WM.VIEW_SCREEN_EXITS,
  WM.VIEW_SUBSCREEN_BOUNDS,
  WM.VIEW_GAME_VIEW,
  WM.VIEW_TILE_SURFACE_OUTLINES,
  WM.VIEW_LINE_GUIDE_OUTLINES,
  WM.VIEW_EXIT_ENABLED_TILES,
  WM.VIEW_BLOCK_CONTENTS,
  WM.VIEW_LEVEL_ENTRANCES,
]);

module.exports = {
  WM,
  DLG_EXPORT_IMAGES,
  WIN,
  WINDOW_CLASS,
  DEFAULT_OVERLAYS_OFF,
};
