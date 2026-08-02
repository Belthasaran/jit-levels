/**
 * High-level: attach to LMFrame, apply profile, run multi-image export.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { getProfile } = require('./profiles');
const { applyProfileView } = require('./view_state');
const { runExportMultipleImages, stagingPrefixPath } = require('./dialogs');
const win32 = require('./win32');

/**
 * @param {object} opts
 * @param {string} opts.profile
 * @param {string} opts.stagingDir  directory where LM writes PNGs (Windows path OK)
 * @param {boolean} [opts.onlyModified]
 * @param {boolean} [opts.autoSetScreens]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.pollMs]
 */
async function exportImagesWithProfile(opts) {
  const profile = getProfile(opts.profile);
  const stagingDir = opts.stagingDir;
  if (!stagingDir) throw new Error('stagingDir required');

  // Ensure staging exists (guest may see Wine path)
  try {
    fs.mkdirSync(stagingDir, { recursive: true });
  } catch (_) {
    /* path may be Wine-only; LM creates on save */
  }

  const lm = await win32.waitFor(() => win32.findLmFrame(), {
    timeoutMs: opts.timeoutMs ?? 120000,
    pollMs: opts.pollMs ?? 250,
    label: 'LMFrame',
  });
  console.log('lmauto: attached LMFrame');

  await applyProfileView(lm, profile);
  console.log(`lmauto: applied profile ${profile.id}`);

  const savePath = stagingPrefixPath(stagingDir, profile.filePrefix);
  console.log(`lmauto: export prefix ${JSON.stringify(savePath)}`);

  await runExportMultipleImages(lm, {
    savePath,
    onlyModified: opts.onlyModified !== false,
    autoSetScreens: !!opts.autoSetScreens,
    timeoutMs: opts.timeoutMs,
    pollMs: opts.pollMs,
    exportTimeoutMs: opts.timeoutMs,
  });

  return { profile, savePath, stagingDir };
}

/**
 * List PNGs in staging that match a profile prefix (space or underscore forms).
 * @param {string} stagingDir
 * @param {string} filePrefix
 */
function listExportedPngs(stagingDir, filePrefix) {
  if (!fs.existsSync(stagingDir)) return [];
  const stem = filePrefix.replace(/\s+$/, '');
  return fs
    .readdirSync(stagingDir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .filter((f) => f.startsWith(stem) || f.startsWith(stem.replace(/ /g, '_')))
    .map((f) => path.join(stagingDir, f))
    .sort();
}

module.exports = {
  exportImagesWithProfile,
  listExportedPngs,
};
