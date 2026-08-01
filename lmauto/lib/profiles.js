/**
 * Named View/export profiles for Lunar Magic image fixture generation.
 * Filename prefixes match lmlevelinfo/test fixtures (space before hex level id;
 * LM appends the level number).
 */
'use strict';

const { WM, DEFAULT_OVERLAYS_OFF } = require('./wm_commands');

/**
 * @typedef {object} ExportProfile
 * @property {string} id
 * @property {string} description
 * @property {string} filePrefix  basename prefix ending with space (LM appends level hex)
 * @property {Record<number, boolean>} view  WM_COMMAND id → desired checked state
 * @property {boolean} [resetAnimation]
 * @property {boolean} [zoom100]
 */

/** @type {Record<string, ExportProfile>} */
const PROFILES = {
  l1only_nogrid: {
    id: 'l1only_nogrid',
    description: 'Layer 1 only, tile grid off, overlays/animation off',
    filePrefix: 'lmlevel_l1only_nogrid ',
    resetAnimation: true,
    zoom100: true,
    view: {
      [WM.VIEW_LAYER1]: true,
      [WM.VIEW_LAYER2]: false,
      [WM.VIEW_LAYER3]: false,
      [WM.VIEW_SPRITES]: false,
      [WM.VIEW_TILE_GRID]: false,
      [WM.VIEW_ANIMATION]: false,
      ...Object.fromEntries(DEFAULT_OVERLAYS_OFF.map((id) => [id, false])),
    },
  },
  l1only_gridlines: {
    id: 'l1only_gridlines',
    description: 'Layer 1 only, tile grid on, overlays/animation off',
    filePrefix: 'lmlevel_l1only_gridlines ',
    resetAnimation: true,
    zoom100: true,
    view: {
      [WM.VIEW_LAYER1]: true,
      [WM.VIEW_LAYER2]: false,
      [WM.VIEW_LAYER3]: false,
      [WM.VIEW_SPRITES]: false,
      [WM.VIEW_TILE_GRID]: true,
      [WM.VIEW_ANIMATION]: false,
      ...Object.fromEntries(DEFAULT_OVERLAYS_OFF.map((id) => [id, false])),
    },
  },
  l2only_gridlines: {
    id: 'l2only_gridlines',
    description: 'Layer 2 only, tile grid on, overlays/animation off',
    filePrefix: 'lmlevel_l2only_gridlines ',
    resetAnimation: true,
    zoom100: true,
    view: {
      [WM.VIEW_LAYER1]: false,
      [WM.VIEW_LAYER2]: true,
      [WM.VIEW_LAYER3]: false,
      [WM.VIEW_SPRITES]: false,
      [WM.VIEW_TILE_GRID]: true,
      [WM.VIEW_ANIMATION]: false,
      ...Object.fromEntries(DEFAULT_OVERLAYS_OFF.map((id) => [id, false])),
    },
  },
  l3only_gridlines: {
    id: 'l3only_gridlines',
    description: 'Layer 3 only, tile grid on, overlays/animation off',
    filePrefix: 'lmlevel_l3only_gridlines ',
    resetAnimation: true,
    zoom100: true,
    view: {
      [WM.VIEW_LAYER1]: false,
      [WM.VIEW_LAYER2]: false,
      [WM.VIEW_LAYER3]: true,
      [WM.VIEW_SPRITES]: false,
      [WM.VIEW_TILE_GRID]: true,
      [WM.VIEW_ANIMATION]: false,
      ...Object.fromEntries(DEFAULT_OVERLAYS_OFF.map((id) => [id, false])),
    },
  },
  spritesonly_gridlines: {
    id: 'spritesonly_gridlines',
    description: 'Sprites only, tile grid on, overlays/animation off',
    filePrefix: 'lmlevel_spritesonly_gridlines ',
    resetAnimation: true,
    zoom100: true,
    view: {
      [WM.VIEW_LAYER1]: false,
      [WM.VIEW_LAYER2]: false,
      [WM.VIEW_LAYER3]: false,
      [WM.VIEW_SPRITES]: true,
      [WM.VIEW_TILE_GRID]: true,
      [WM.VIEW_ANIMATION]: false,
      ...Object.fromEntries(DEFAULT_OVERLAYS_OFF.map((id) => [id, false])),
    },
  },
  l1l2only_gridlines: {
    id: 'l1l2only_gridlines',
    description: 'Layer 1+2 only, tile grid on, overlays/animation off',
    filePrefix: 'lmlevel_l1l2only_gridlines ',
    resetAnimation: true,
    zoom100: true,
    view: {
      [WM.VIEW_LAYER1]: true,
      [WM.VIEW_LAYER2]: true,
      [WM.VIEW_LAYER3]: false,
      [WM.VIEW_SPRITES]: false,
      [WM.VIEW_TILE_GRID]: true,
      [WM.VIEW_ANIMATION]: false,
      ...Object.fromEntries(DEFAULT_OVERLAYS_OFF.map((id) => [id, false])),
    },
  },
};

function listProfiles() {
  return Object.keys(PROFILES).sort();
}

/**
 * @param {string} id
 * @returns {ExportProfile}
 */
function getProfile(id) {
  const p = PROFILES[id];
  if (!p) {
    throw new Error(
      `Unknown profile "${id}". Available: ${listProfiles().join(', ')}`
    );
  }
  return p;
}

/**
 * Desired checked state for a WM View command under a profile.
 * @param {ExportProfile} profile
 * @param {number} wmId
 * @returns {boolean|undefined}
 */
function profileWantsChecked(profile, wmId) {
  if (!profile.view || !Object.prototype.hasOwnProperty.call(profile.view, wmId)) {
    return undefined;
  }
  return !!profile.view[wmId];
}

module.exports = {
  PROFILES,
  listProfiles,
  getProfile,
  profileWantsChecked,
};
