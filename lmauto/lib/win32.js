/**
 * Minimal Win32 bindings via koffi (Windows Node / Wine only).
 */
'use strict';

const { WIN, WINDOW_CLASS } = require('./wm_commands');

let koffi;
let user32;
let ready = false;
/** @type {any} */
let MENUITEMINFOW;

function ensureLoaded() {
  if (ready) return;
  if (process.platform !== 'win32') {
    throw new Error('win32.js requires Windows Node (run under Wine node-win-x64)');
  }
  koffi = require('koffi');
  user32 = koffi.load('user32.dll');

  MENUITEMINFOW = koffi.struct('MENUITEMINFOW', {
    cbSize: 'uint32',
    fMask: 'uint32',
    fType: 'uint32',
    fState: 'uint32',
    wID: 'uint32',
    hSubMenu: 'void *',
    hbmpChecked: 'void *',
    hbmpUnchecked: 'void *',
    dwItemData: 'uintptr',
    dwTypeData: 'void *',
    cch: 'uint32',
    hbmpItem: 'void *',
  });

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
  user32.GetMenuItemInfoW = koffi.load('user32.dll').func('GetMenuItemInfoW', 'int', [
    'void *',
    'uint32',
    'int',
    koffi.out(koffi.pointer(MENUITEMINFOW)),
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

function getMenu(hwnd) {
  ensureLoaded();
  return user32.GetMenu(hwnd);
}

function _emptyMenuInfo(mask) {
  return {
    cbSize: koffi.sizeof(MENUITEMINFOW),
    fMask: mask,
    fType: 0,
    fState: 0,
    wID: 0,
    hSubMenu: null,
    hbmpChecked: null,
    hbmpUnchecked: null,
    dwItemData: 0,
    dwTypeData: null,
    cch: 0,
    hbmpItem: null,
  };
}

/**
 * Recursively find a menu item by command id (View items live in submenus).
 * @returns {{ hMenu: any, checked: boolean }|null}
 */
function findMenuItemByCommand(hMenu, commandId) {
  ensureLoaded();
  if (!hMenu) return null;

  const byCmd = _emptyMenuInfo(WIN.MIIM_STATE);
  if (user32.GetMenuItemInfoW(hMenu, commandId, 0, byCmd)) {
    return { hMenu, checked: (byCmd.fState & WIN.MFS_CHECKED) !== 0 };
  }

  const count = user32.GetMenuItemCount(hMenu);
  const mask = WIN.MIIM_STATE | WIN.MIIM_SUBMENU | WIN.MIIM_ID;
  for (let i = 0; i < count; i++) {
    const infoPos = _emptyMenuInfo(mask);
    if (!user32.GetMenuItemInfoW(hMenu, i, 1, infoPos)) continue;
    if (infoPos.wID === commandId) {
      return { hMenu, checked: (infoPos.fState & WIN.MFS_CHECKED) !== 0 };
    }
    if (infoPos.hSubMenu) {
      const found = findMenuItemByCommand(infoPos.hSubMenu, commandId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @returns {boolean|null} checked state, or null if item not found
 */
function getMenuItemChecked(hMenu, commandId) {
  const found = findMenuItemByCommand(hMenu, commandId);
  if (!found) return null;
  return found.checked;
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
  const cb = koffi.protocol('EnumWindowsProc', 'int', ['void *', 'intptr']);
  const proc = koffi.register((hwnd) => {
    if (!user32.IsWindowVisible(hwnd)) return 1;
    const cls = getClassName(hwnd);
    const title = getWindowText(hwnd);
    if (opts.className && cls !== opts.className) return 1;
    if (opts.titleEquals && title !== opts.titleEquals) return 1;
    if (opts.titleIncludes && !title.includes(opts.titleIncludes)) return 1;
    matches.push(hwnd);
    return 1;
  }, cb);
  try {
    user32.EnumWindows(proc, 0);
  } finally {
    koffi.unregister(proc);
  }
  return matches[0] || null;
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
      throw new Error(`Timeout waiting for ${label} (${timeoutMs}ms)`);
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
  const cb = koffi.protocol('EnumWindowsProcFileDlg', 'int', ['void *', 'intptr']);
  const proc = koffi.register((hwnd) => {
    if (!user32.IsWindowVisible(hwnd)) return 1;
    if (getClassName(hwnd) !== WINDOW_CLASS.DIALOG) return 1;
    const edit =
      getDlgItem(hwnd, WIN.CDN_FILENAME_EDIT) || findWindowEx(hwnd, null, 'Edit', null);
    if (edit) matches.push({ hwnd, edit });
    return 1;
  }, cb);
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
  getMenu,
  findMenuItemByCommand,
  getMenuItemChecked,
  getDlgItem,
  setForeground,
  setWindowText,
  getCheck,
  setCheck,
  clickButton,
  findTopLevelWindow,
  waitFor,
  findLmFrame,
  findDialogByCaption,
  findCommonFileDialog,
  WINDOW_CLASS,
  WIN,
};
