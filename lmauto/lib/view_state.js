/**
 * Absolute View-menu state for Lunar Magic (toggle-safe via GetMenuItemInfo).
 */
'use strict';

const { WM } = require('./wm_commands');
const win32 = require('./win32');

/**
 * Ensure a menu command's checked state matches `wantChecked`.
 * @param {any} hwnd LMFrame
 * @param {number} commandId
 * @param {boolean} wantChecked
 * @param {{ retries?: number }} [opts]
 */
async function setMenuChecked(hwnd, commandId, wantChecked, opts = {}) {
  const retries = opts.retries ?? 2;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const hMenu = win32.getMenu(hwnd);
    const cur = win32.getMenuItemChecked(hMenu, commandId);
    if (cur === null) {
      // Item missing from menu (e.g. OW vs level context) — send once on last try.
      if (attempt === retries) {
        win32.sendCommand(hwnd, commandId);
        await win32.sleep(80);
      }
      continue;
    }
    if (cur === wantChecked) return true;
    win32.sendCommand(hwnd, commandId);
    await win32.sleep(120);
  }
  const final = win32.getMenuItemChecked(win32.getMenu(hwnd), commandId);
  if (final !== null && final !== wantChecked) {
    throw new Error(
      `Failed to set View command ${commandId} checked=${wantChecked} (got ${final})`
    );
  }
  return true;
}

/**
 * Apply an export profile's View settings to LMFrame.
 * @param {any} hwnd
 * @param {import('./profiles').ExportProfile} profile
 */
async function applyProfileView(hwnd, profile) {
  win32.setForeground(hwnd);
  await win32.sleep(100);

  if (profile.zoom100) {
    win32.sendCommand(hwnd, WM.VIEW_ZOOM_100);
    await win32.sleep(80);
  }

  // Layers / grid / animation / overlays from profile.view
  const entries = Object.entries(profile.view || {}).map(([k, v]) => [Number(k), !!v]);
  // Apply "off" first, then "on", so mutually exclusive feel is stable.
  entries.sort((a, b) => Number(a[1]) - Number(b[1]));

  for (const [id, want] of entries) {
    await setMenuChecked(hwnd, id, want);
  }

  // Animation off already in profile; always Reset after freezing.
  if (profile.resetAnimation) {
    await setMenuChecked(hwnd, WM.VIEW_ANIMATION, false);
    win32.sendCommand(hwnd, WM.VIEW_RESET_ANIMATIONS);
    await win32.sleep(100);
  }
}

module.exports = {
  setMenuChecked,
  applyProfileView,
};
