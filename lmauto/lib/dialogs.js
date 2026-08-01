/**
 * Drive Lunar Magic Dialog 1027 and the common Save file dialog.
 */
'use strict';

const path = require('path');
const { DLG_EXPORT_IMAGES, WIN, WM } = require('./wm_commands');
const win32 = require('./win32');

/**
 * @param {any} hwndDlg
 * @param {number} ctrlId
 * @param {boolean} wantChecked
 */
function setDlgCheckbox(hwndDlg, ctrlId, wantChecked) {
  const ctrl = win32.getDlgItem(hwndDlg, ctrlId);
  if (!ctrl) {
    console.warn(`lmauto: dialog control ${ctrlId} not found`);
    return;
  }
  const cur = win32.getCheck(ctrl);
  const want = wantChecked ? WIN.BST_CHECKED : WIN.BST_UNCHECKED;
  if (cur !== want) {
    win32.setCheck(ctrl, wantChecked);
    // Some Wine builds ignore BM_SETCHECK without a click — toggle via BM_CLICK if still wrong.
    if (win32.getCheck(ctrl) !== want) {
      win32.clickButton(ctrl);
      if (win32.getCheck(ctrl) !== want) {
        win32.clickButton(ctrl);
      }
    }
  }
}

/**
 * Open Export Multiple Levels to Images and complete the save dialog.
 *
 * @param {any} lmHwnd LMFrame
 * @param {object} opts
 * @param {string} opts.savePath  Full path (Windows) for filename prefix, e.g. Z:\...\out\lmlevel_l1only_nogrid
 * @param {boolean} [opts.onlyModified=true]
 * @param {boolean} [opts.autoSetScreens=false]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.pollMs]
 */
async function runExportMultipleImages(lmHwnd, opts) {
  const timeoutMs = opts.timeoutMs ?? 120000;
  const pollMs = opts.pollMs ?? 250;
  const onlyModified = opts.onlyModified !== false;
  const autoSetScreens = !!opts.autoSetScreens;
  let savePath = opts.savePath;
  // LM appends level number after the prefix; strip trailing .png if caller passed one.
  if (/\.(png|bmp)$/i.test(savePath)) {
    savePath = savePath.replace(/\.(png|bmp)$/i, '');
  }

  win32.setForeground(lmHwnd);
  win32.sendCommand(lmHwnd, WM.EXPORT_MULTIPLE_LEVELS_IMAGES);

  const dlg = await win32.waitFor(() => win32.findDialogByCaption(DLG_EXPORT_IMAGES.CAPTION), {
    timeoutMs,
    pollMs,
    label: DLG_EXPORT_IMAGES.CAPTION,
  });

  setDlgCheckbox(dlg, DLG_EXPORT_IMAGES.ONLY_MODIFIED, onlyModified);
  setDlgCheckbox(dlg, DLG_EXPORT_IMAGES.AUTO_SET_SCREENS, autoSetScreens);
  await win32.sleep(100);

  const selectBtn = win32.getDlgItem(dlg, DLG_EXPORT_IMAGES.SELECT_DIR_FILE);
  if (!selectBtn) throw new Error('Dialog 1027: Select Directory && File Name button missing');
  win32.clickButton(selectBtn);

  const fileDlg = await win32.waitFor(() => win32.findCommonFileDialog(), {
    timeoutMs,
    pollMs,
    label: 'common save file dialog',
  });

  const edit =
    fileDlg.edit ||
    win32.getDlgItem(fileDlg.hwnd, WIN.CDN_FILENAME_EDIT) ||
    win32.findWindowEx(fileDlg.hwnd, null, 'Edit', null);
  if (!edit) throw new Error('Save dialog: filename Edit control not found');

  // Prefer directory + file prefix; normalize to backslashes for Wine.
  const winPath = savePath.replace(/\//g, '\\');
  win32.setWindowText(edit, winPath);
  await win32.sleep(100);

  const okBtn =
    win32.getDlgItem(fileDlg.hwnd, WIN.IDOK) ||
    win32.findWindowEx(fileDlg.hwnd, null, 'Button', 'Save') ||
    win32.findWindowEx(fileDlg.hwnd, null, 'Button', '&Save');
  if (okBtn) {
    win32.clickButton(okBtn);
  } else {
    // Fallback: press default OK via WM_COMMAND IDOK on dialog
    win32.sendMessage(fileDlg.hwnd, WIN.WM_COMMAND, WIN.IDOK, 0);
  }

  // Wait for export dialog(s) to close.
  await win32.waitFor(
    () => {
      const still = win32.findDialogByCaption(DLG_EXPORT_IMAGES.CAPTION);
      return !still;
    },
    {
      timeoutMs: opts.exportTimeoutMs ?? opts.timeoutMs ?? 600000,
      pollMs: 500,
      label: 'export completion (dialog close)',
    }
  );
}

/**
 * Build a Windows path for the export prefix inside a staging directory.
 * @param {string} stagingDir  Windows or mixed path
 * @param {string} filePrefix  e.g. "lmlevel_l1only_nogrid "
 */
function stagingPrefixPath(stagingDir, filePrefix) {
  const base = filePrefix.replace(/\s+$/, '');
  return path.win32.join(stagingDir.replace(/\//g, '\\'), base + ' ');
}

module.exports = {
  setDlgCheckbox,
  runExportMultipleImages,
  stagingPrefixPath,
};
