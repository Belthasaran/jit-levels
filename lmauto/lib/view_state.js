/**
 * Absolute View-menu state for Lunar Magic.
 * Menu checkmarks are read in-process via injected lmauto_menuread.dll
 * (cross-process HMENU is invalid under Wine).
 */
'use strict';

const { WM } = require('./wm_commands');
const win32 = require('./win32');
const { readMenuChecksInProcess, getCheckedFromSnapshot } = require('./menu_inject');

/** Layer commands that must be readable when the profile wants them ON. */
const REQUIRED_ON_IDS = new Set([
  WM.VIEW_LAYER1,
  WM.VIEW_LAYER2,
  WM.VIEW_LAYER3,
  WM.VIEW_SPRITES,
]);

/**
 * Snapshot View checkmarks via DLL inject. Fails fast — no long polling.
 * @returns {Record<string, boolean>}
 */
function snapshotViewChecks(hwnd, opts = {}) {
  const snap = readMenuChecksInProcess(hwnd, { timeoutMs: 5000 });
  const layer1 = getCheckedFromSnapshot(snap, WM.VIEW_LAYER1);
  const layer2 = getCheckedFromSnapshot(snap, WM.VIEW_LAYER2);
  if (layer1 === null && layer2 === null) {
    throw new Error(
      `in-process menu snapshot missing Layer1/Layer2 checks: ${JSON.stringify(snap)}`
    );
  }
  if (opts.log) {
    console.log(
      `lmauto: menu snapshot 9200=${layer1 ? 'on' : 'off'} 9201=${layer2 ? 'on' : 'off'} ` +
        `9224=${getCheckedFromSnapshot(snap, WM.VIEW_TILE_GRID) ? 'on' : 'off'} ` +
        `9220=${getCheckedFromSnapshot(snap, WM.VIEW_ANIMATION) ? 'on' : 'off'}`
    );
  }
  return snap;
}

function dumpSnapshot(snap, ids) {
  return ids
    .map((id) => {
      const v = getCheckedFromSnapshot(snap, id);
      return `${id}=${v === null ? 'null' : v ? 'on' : 'off'}`;
    })
    .join(' ');
}

/**
 * Toggle until snapshot matches. Returns updated snapshot.
 */
async function setMenuChecked(hwnd, commandId, wantChecked, snap) {
  let curSnap = snap || snapshotViewChecks(hwnd);
  for (let attempt = 0; attempt < 4; attempt++) {
    const cur = getCheckedFromSnapshot(curSnap, commandId);
    if (cur === null) {
      if (wantChecked && REQUIRED_ON_IDS.has(commandId)) {
        throw new Error(
          `View command ${commandId}: menu state missing from snapshot; cannot ensure ON`
        );
      }
      console.warn(
        `lmauto: View ${commandId} not in snapshot; leaving alone (want ${
          wantChecked ? 'on' : 'off'
        })`
      );
      return curSnap;
    }
    if (cur === wantChecked) return curSnap;
    win32.sendCommand(hwnd, commandId);
    await win32.sleep(80);
    curSnap = snapshotViewChecks(hwnd);
  }
  const lastCur = getCheckedFromSnapshot(curSnap, commandId);
  if (lastCur !== wantChecked) {
    throw new Error(
      `Failed to set View command ${commandId} checked=${wantChecked} (got ${lastCur})`
    );
  }
  return curSnap;
}

/**
 * Apply an export profile's View settings to LMFrame.
 * @param {any} hwnd
 * @param {import('./profiles').ExportProfile} profile
 */
async function applyProfileView(hwnd, profile) {
  win32.setForeground(hwnd);
  await win32.sleep(50);

  if (process.arch !== 'ia32') {
    throw new Error(
      `lmauto guest must be ia32 Node for in-process menu reads (got ${process.arch}; use node-win-x86)`
    );
  }

  let snap = snapshotViewChecks(hwnd, { log: true });

  if (profile.zoom100) {
    win32.sendCommand(hwnd, WM.VIEW_ZOOM_100);
    await win32.sleep(50);
  }

  const entries = Object.entries(profile.view || {}).map(([k, v]) => [Number(k), !!v]);
  entries.sort((a, b) => Number(a[1]) - Number(b[1]));

  const ids = entries.map(([id]) => id);
  console.log(`lmauto: view before: ${dumpSnapshot(snap, ids)}`);

  for (const [id, want] of entries) {
    snap = await setMenuChecked(hwnd, id, want, snap);
  }

  if (profile.resetAnimation) {
    snap = await setMenuChecked(hwnd, WM.VIEW_ANIMATION, false, snap);
    win32.sendCommand(hwnd, WM.VIEW_RESET_ANIMATIONS);
    await win32.sleep(80);
  }

  snap = snapshotViewChecks(hwnd, { log: true });
  console.log(`lmauto: view after:  ${dumpSnapshot(snap, ids)}`);
}

module.exports = {
  setMenuChecked,
  applyProfileView,
  snapshotViewChecks,
  REQUIRED_ON_IDS,
};
