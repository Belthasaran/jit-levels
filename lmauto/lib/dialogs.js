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
    if (win32.getCheck(ctrl) !== want) {
      win32.clickButton(ctrl);
      if (win32.getCheck(ctrl) !== want) {
        win32.clickButton(ctrl);
      }
    }
  }
}

/**
 * Click Dialog 1027 "Select Directory && File Name" via parent WM_COMMAND.
 */
async function clickSelectDirFile(dlg) {
  const selectBtn = win32.getDlgItem(dlg, DLG_EXPORT_IMAGES.SELECT_DIR_FILE);
  if (!selectBtn) throw new Error('Dialog 1027: Select Directory && File Name button missing');

  console.log('lmauto: clicking Select Directory && File Name (WM_COMMAND BN_CLICKED)');
  win32.clickDialogButton(dlg, DLG_EXPORT_IMAGES.SELECT_DIR_FILE, selectBtn);

  // If save dialog does not appear, retry with PostMessage + BM_CLICK.
  await win32.sleep(400);
  if (!win32.findCommonFileDialog()) {
    console.log('lmauto: save dialog not yet visible; PostMessage + BM_CLICK fallback');
    win32.postMessage(dlg, WIN.WM_COMMAND, DLG_EXPORT_IMAGES.SELECT_DIR_FILE, 0);
    win32.clickButton(selectBtn);
    await win32.sleep(400);
  }
}

/**
 * Open Export Multiple Levels to Images and complete the save dialog.
 *
 * @param {any} lmHwnd LMFrame
 * @param {object} opts
 * @param {string} opts.savePath  Full path (Windows) for filename prefix
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
  if (/\.(png|bmp)$/i.test(savePath)) {
    savePath = savePath.replace(/\.(png|bmp)$/i, '');
  }

  win32.setForeground(lmHwnd);
  // PostMessage: SendMessage(9148) blocks inside LM's modal dialog forever.
  console.log('lmauto: posting Export Multiple Levels to Images (9148)');
  win32.postMessage(lmHwnd, WIN.WM_COMMAND, WM.EXPORT_MULTIPLE_LEVELS_IMAGES, 0);

  const dlg = await win32.waitFor(() => win32.findDialogByCaption(DLG_EXPORT_IMAGES.CAPTION), {
    timeoutMs: Math.min(timeoutMs, 30000),
    pollMs,
    label: DLG_EXPORT_IMAGES.CAPTION,
  });
  console.log('lmauto: opened Dialog 1027 (Export Levels to Images)');

  setDlgCheckbox(dlg, DLG_EXPORT_IMAGES.ONLY_MODIFIED, onlyModified);
  setDlgCheckbox(dlg, DLG_EXPORT_IMAGES.AUTO_SET_SCREENS, autoSetScreens);
  await win32.sleep(100);

  await clickSelectDirFile(dlg);

  const fileDlg = await win32.waitFor(() => win32.findCommonFileDialog(), {
    timeoutMs,
    pollMs,
    label: 'common save file dialog',
  });
  console.log(`lmauto: got save dialog title=${JSON.stringify(fileDlg.title || '')}`);

  const edit =
    fileDlg.edit ||
    win32.getDlgItem(fileDlg.hwnd, WIN.CDN_FILENAME_EDIT) ||
    win32.findWindowEx(fileDlg.hwnd, null, 'Edit', null);
  if (!edit) throw new Error('Save dialog: filename Edit control not found');

  const winPath = savePath.replace(/\//g, '\\');
  win32.setWindowText(edit, winPath);
  console.log(`lmauto: set save path ${JSON.stringify(winPath)}`);
  await win32.sleep(100);

  const okBtn =
    win32.getDlgItem(fileDlg.hwnd, WIN.IDOK) ||
    win32.findWindowEx(fileDlg.hwnd, null, 'Button', 'Save') ||
    win32.findWindowEx(fileDlg.hwnd, null, 'Button', '&Save');
  if (okBtn) {
    win32.clickDialogButton(fileDlg.hwnd, WIN.IDOK, okBtn);
    win32.clickButton(okBtn);
  } else {
    win32.sendMessage(fileDlg.hwnd, WIN.WM_COMMAND, WIN.IDOK, 0);
  }
  console.log('lmauto: confirmed save dialog');

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
  console.log('lmauto: export dialog closed');
}

/**
 * @param {string} stagingDir
 * @param {string} filePrefix
 */
function stagingPrefixPath(stagingDir, filePrefix) {
  const base = filePrefix.replace(/\s+$/, '');
  return path.win32.join(stagingDir.replace(/\//g, '\\'), base + ' ');
}

module.exports = {
  setDlgCheckbox,
  runExportMultipleImages,
  stagingPrefixPath,
  clickSelectDirFile,
};
