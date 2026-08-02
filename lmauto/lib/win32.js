/**
 * Minimal Win32 bindings via koffi (Windows Node / Wine only).
 * Lunar Magic is PE32. Cross-process GetMenu/HMENU is invalid under Wine —
 * View checkmarks use lib/menu_inject.js (ia32 Node + native DLL).
 */
'use strict';

const { WIN, WINDOW_CLASS, DLG_EXPORT_IMAGES } = require('./wm_commands');

let koffi;
let user32;
let ready = false;
/** Cached EnumWindows callback prototypes (koffi.proto names are global). */
let enumProcPtr;
let enumProcDumpPtr;
let enumProcFileDlgPtr;

function ensureLoaded() {
  if (ready) return;
  if (process.platform !== 'win32') {
    throw new Error('win32.js requires Windows Node (run under Wine node-win-x86)');
  }
  koffi = require('koffi');
  user32 = koffi.load('user32.dll');

  user32.FindWindowW = koffi.load('user32.dll').func('FindWindowW', 'void *', ['str16', 'str16']);
  user32.FindWindowExW = koffi.load('user32.dll').func('FindWindowExW', 'void *', [
    'void *',
    'void *',
    'str16',
    'str16',
  ]);
  user32.IsWindow = koffi.load('user32.dll').func('IsWindow', 'int', ['void *']);
  user32.IsWindowVisible = koffi.load('user32.dll').func('IsWindowVisible', 'int', ['void *']);
  user32.GetMenu = koffi.load('user32.dll').func('GetMenu', 'void *', ['void *']);
  user32.GetSubMenu = koffi.load('user32.dll').func('GetSubMenu', 'void *', ['void *', 'int']);
  user32.GetMenuItemCount = koffi.load('user32.dll').func('GetMenuItemCount', 'int', ['void *']);
  user32.GetMenuState = koffi.load('user32.dll').func('GetMenuState', 'uint32', [
    'void *',
    'uint32',
    'uint32',
  ]);
  user32.GetDlgItem = koffi.load('user32.dll').func('GetDlgItem', 'void *', ['void *', 'int']);
  user32.SetForegroundWindow = koffi.load('user32.dll').func('SetForegroundWindow', 'int', [
    'void *',
  ]);
  user32.SendMessageW = koffi.load('user32.dll').func('SendMessageW', 'intptr', [
    'void *',
    'uint32',
    'uintptr',
    'intptr',
  ]);
  user32.PostMessageW = koffi.load('user32.dll').func('PostMessageW', 'int', [
    'void *',
    'uint32',
    'uintptr',
    'intptr',
  ]);
  user32.EnumWindows = koffi.load('user32.dll').func('EnumWindows', 'int', ['void *', 'intptr']);
  user32.SetWindowTextW = koffi.load('user32.dll').func('SetWindowTextW', 'int', [
    'void *',
    'str16',
  ]);
  user32.GetClassNameW = koffi.load('user32.dll').func('GetClassNameW', 'int', [
    'void *',
    'void *',
    'int',
  ]);
  user32.GetWindowTextW = koffi.load('user32.dll').func('GetWindowTextW', 'int', [
    'void *',
    'void *',
    'int',
  ]);

  enumProcPtr = koffi.pointer(
    koffi.proto('int __stdcall LmautoEnumWindowsProc(void *hwnd, intptr lParam)')
  );
  enumProcDumpPtr = koffi.pointer(
    koffi.proto('int __stdcall LmautoEnumWindowsProcDump(void *hwnd, intptr lParam)')
  );
  enumProcFileDlgPtr = koffi.pointer(
    koffi.proto('int __stdcall LmautoEnumWindowsProcFileDlg(void *hwnd, intptr lParam)')
  );

  ready = true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findWindow(className, windowName) {
  ensureLoaded();
  return user32.FindWindowW(className || null, windowName || null);
}

function findWindowEx(parent, after, className, windowName) {
  ensureLoaded();
  return user32.FindWindowExW(parent || null, after || null, className || null, windowName || null);
}

function isWindow(hwnd) {
  ensureLoaded();
  return !!user32.IsWindow(hwnd);
}

function getClassName(hwnd) {
  ensureLoaded();
  const wbuf = Buffer.alloc(512);
  const n = user32.GetClassNameW(hwnd, wbuf, 256);
  if (n <= 0) return '';
  return wbuf.toString('utf16le', 0, n * 2).replace(/\0+$/, '');
}

function getWindowText(hwnd) {
  ensureLoaded();
  const wbuf = Buffer.alloc(1024);
  const n = user32.GetWindowTextW(hwnd, wbuf, 512);
  if (n <= 0) return '';
  return wbuf.toString('utf16le', 0, n * 2).replace(/\0+$/, '');
}

function sendMessage(hwnd, msg, wParam, lParam) {
  ensureLoaded();
  return user32.SendMessageW(hwnd, msg, BigInt(wParam || 0), BigInt(lParam || 0));
}

function postMessage(hwnd, msg, wParam, lParam) {
  ensureLoaded();
  return user32.PostMessageW(hwnd, msg, BigInt(wParam || 0), BigInt(lParam || 0));
}

function sendCommand(hwnd, commandId) {
  return sendMessage(hwnd, WIN.WM_COMMAND, commandId, 0);
}

/**
 * Dialog button activation: WM_COMMAND with BN_CLICKED to parent dialog.
 * MAKEWPARAM(id, BN_CLICKED) with BN_CLICKED=0 → wParam = id.
 */
function clickDialogButton(hwndDlg, ctrlId, ctrlHwnd) {
  ensureLoaded();
  const btn = ctrlHwnd || getDlgItem(hwndDlg, ctrlId);
  const wParam = ctrlId & 0xffff; // BN_CLICKED = 0 in high word
  let lParam = 0;
  if (btn) {
    try {
      lParam = Number(koffi.address(btn));
    } catch (_) {
      lParam = 0;
    }
  }
  sendMessage(hwndDlg, WIN.WM_COMMAND, wParam, lParam);
  return btn;
}

function getMenu(hwnd) {
  ensureLoaded();
  return user32.GetMenu(hwnd);
}

function getMenuItemCount(hMenu) {
  ensureLoaded();
  if (!hMenu) return -1;
  return user32.GetMenuItemCount(hMenu);
}

/**
 * GetMenuState on one menu handle (no submenu walk).
 * @returns {boolean|null} checked, or null if item not in this menu
 */
function getMenuStateCheckedHere(hMenu, commandId) {
  ensureLoaded();
  if (!hMenu) return null;
  const state = user32.GetMenuState(hMenu, commandId, WIN.MF_BYCOMMAND) >>> 0;
  if (state === 0xffffffff) return null;
  return (state & WIN.MF_CHECKED) !== 0;
}

/**
 * Recursively find checked state by command id via GetMenuState + GetSubMenu.
 * Does not use GetMenuItemInfo (fails under Wine wow64 for PE32 LM).
 * @returns {{ hMenu: any, checked: boolean, wID: number }|null}
 */
function findMenuItemByCommand(hMenu, commandId) {
  ensureLoaded();
  if (!hMenu) return null;

  const here = getMenuStateCheckedHere(hMenu, commandId);
  if (here !== null) {
    return { hMenu, checked: here, wID: commandId };
  }

  const count = user32.GetMenuItemCount(hMenu);
  if (count < 0) return null;
  for (let i = 0; i < count; i++) {
    const sub = user32.GetSubMenu(hMenu, i);
    if (!sub) continue;
    const found = findMenuItemByCommand(sub, commandId);
    if (found) return found;
  }
  return null;
}

/**
 * @returns {boolean|null} checked state, or null if item not found / unreadable
 */
function getMenuItemChecked(hMenu, commandId) {
  const found = findMenuItemByCommand(hMenu, commandId);
  if (!found) return null;
  return found.checked;
}

/**
 * Diagnostic dump when menu checks fail.
 * @param {any} hwnd
 */
function dumpMenuDiagnostics(hwnd) {
  ensureLoaded();
  const hMenu = getMenu(hwnd);
  let menuAddr = 'null';
  try {
    if (hMenu) menuAddr = `0x${koffi.address(hMenu).toString(16)}`;
  } catch (_) {
    menuAddr = String(hMenu);
  }
  const count = getMenuItemCount(hMenu);
  const lines = [`GetMenu=${menuAddr} topCount=${count}`];
  if (hMenu && count > 0) {
    for (let i = 0; i < count; i++) {
      const sub = user32.GetSubMenu(hMenu, i);
      const st9200 = sub
        ? user32.GetMenuState(sub, 9200, WIN.MF_BYCOMMAND) >>> 0
        : 0xffffffff;
      lines.push(
        `  submenu[${i}]=${sub ? 'yes' : 'no'} GetMenuState(9200)=0x${st9200.toString(16)}`
      );
    }
  }
  return lines.join('\n');
}

/**
 * True when LM main menu looks populated and Layer1 (9200) is readable.
 * @param {any} hwnd
 */
function isMenuReady(hwnd) {
  const hMenu = getMenu(hwnd);
  if (!hMenu) return false;
  const count = getMenuItemCount(hMenu);
  if (count < 5) return false;
  // Prefer a View layer command becoming readable.
  return (
    getMenuItemChecked(hMenu, 9200) !== null ||
    getMenuItemChecked(hMenu, 9201) !== null
  );
}

/**
 * @param {any} hwnd LMFrame
 * @param {number[]} ids
 * @returns {string} e.g. "9200=on 9224=off 9206=null"
 */
function dumpViewChecks(hwnd, ids) {
  const hMenu = getMenu(hwnd);
  const parts = [];
  for (const id of ids) {
    const cur = getMenuItemChecked(hMenu, id);
    const label = cur === null ? 'null' : cur ? 'on' : 'off';
    parts.push(`${id}=${label}`);
  }
  return parts.join(' ');
}

function getDlgItem(hwnd, id) {
  ensureLoaded();
  return user32.GetDlgItem(hwnd, id);
}

function setForeground(hwnd) {
  ensureLoaded();
  return user32.SetForegroundWindow(hwnd);
}

function setWindowText(hwnd, text) {
  ensureLoaded();
  return user32.SetWindowTextW(hwnd, text);
}

function getCheck(hwnd) {
  return Number(sendMessage(hwnd, WIN.BM_GETCHECK, 0, 0));
}

function setCheck(hwnd, checked) {
  return sendMessage(hwnd, WIN.BM_SETCHECK, checked ? WIN.BST_CHECKED : WIN.BST_UNCHECKED, 0);
}

function clickButton(hwnd) {
  return sendMessage(hwnd, WIN.BM_CLICK, 0, 0);
}

/**
 * @param {{ className?: string, titleIncludes?: string, titleEquals?: string }} opts
 */
function findTopLevelWindow(opts) {
  ensureLoaded();
  const matches = [];
  const proc = koffi.register((hwnd) => {
    if (!user32.IsWindowVisible(hwnd)) return 1;
    const cls = getClassName(hwnd);
    const title = getWindowText(hwnd);
    if (opts.className && cls !== opts.className) return 1;
    if (opts.titleEquals && title !== opts.titleEquals) return 1;
    if (opts.titleIncludes && !title.includes(opts.titleIncludes)) return 1;
    matches.push(hwnd);
    return 1;
  }, enumProcPtr);
  try {
    user32.EnumWindows(proc, 0);
  } finally {
    koffi.unregister(proc);
  }
  return matches[0] || null;
}

/**
 * List visible top-level dialogs for diagnostics.
 * @returns {{ hwnd: any, className: string, title: string }[]}
 */
function listVisibleDialogs() {
  ensureLoaded();
  const out = [];
  const proc = koffi.register((hwnd) => {
    if (!user32.IsWindowVisible(hwnd)) return 1;
    const cls = getClassName(hwnd);
    if (cls !== WINDOW_CLASS.DIALOG) return 1;
    out.push({ hwnd, className: cls, title: getWindowText(hwnd) });
    return 1;
  }, enumProcDumpPtr);
  try {
    user32.EnumWindows(proc, 0);
  } finally {
    koffi.unregister(proc);
  }
  return out;
}

/**
 * @template T
 * @param {() => T} fn
 * @param {{ timeoutMs?: number, pollMs?: number, label?: string }} opts
 * @returns {Promise<T>}
 */
async function waitFor(fn, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60000;
  const pollMs = opts.pollMs ?? 250;
  const label = opts.label || 'condition';
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) {
      const dlgDump = listVisibleDialogs()
        .map((d) => `"${d.title}"`)
        .join(', ');
      throw new Error(
        `Timeout waiting for ${label} (${timeoutMs}ms)` +
          (dlgDump ? `; visible #32770: ${dlgDump}` : '')
      );
    }
    await sleep(pollMs);
  }
}

function findLmFrame() {
  return findWindow(WINDOW_CLASS.LM_FRAME, null) || findTopLevelWindow({ className: WINDOW_CLASS.LM_FRAME });
}

function findDialogByCaption(caption) {
  return (
    findWindow(WINDOW_CLASS.DIALOG, caption) ||
    findTopLevelWindow({ className: WINDOW_CLASS.DIALOG, titleEquals: caption })
  );
}

function findCommonFileDialog() {
  ensureLoaded();
  const matches = [];
  const exportCaption = DLG_EXPORT_IMAGES.CAPTION;
  const proc = koffi.register((hwnd) => {
    if (!user32.IsWindowVisible(hwnd)) return 1;
    if (getClassName(hwnd) !== WINDOW_CLASS.DIALOG) return 1;
    const title = getWindowText(hwnd);
    // Do not mistake Dialog 1027 for the common save dialog.
    if (title === exportCaption) return 1;
    const edit =
      getDlgItem(hwnd, WIN.CDN_FILENAME_EDIT) || findWindowEx(hwnd, null, 'Edit', null);
    if (edit) matches.push({ hwnd, edit, title });
    return 1;
  }, enumProcFileDlgPtr);
  try {
    user32.EnumWindows(proc, 0);
  } finally {
    koffi.unregister(proc);
  }
  return matches[0] || null;
}

module.exports = {
  ensureLoaded,
  sleep,
  findWindow,
  findWindowEx,
  isWindow,
  getClassName,
  getWindowText,
  sendMessage,
  postMessage,
  sendCommand,
  clickDialogButton,
  getMenu,
  getMenuItemCount,
  findMenuItemByCommand,
  getMenuItemChecked,
  dumpViewChecks,
  dumpMenuDiagnostics,
  isMenuReady,
  getDlgItem,
  setForeground,
  setWindowText,
  getCheck,
  setCheck,
  clickButton,
  findTopLevelWindow,
  listVisibleDialogs,
  waitFor,
  findLmFrame,
  findDialogByCaption,
  findCommonFileDialog,
  WINDOW_CLASS,
  WIN,
};
