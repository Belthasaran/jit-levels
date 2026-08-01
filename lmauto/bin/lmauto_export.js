#!/usr/bin/env node
/**
 * Guest CLI: run under Windows Node (Wine node-win-x64/node.exe).
 * Attaches to LMFrame, applies a View profile, completes Export Multiple Levels to Images.
 *
 * Usage:
 *   node bin/lmauto_export.js --profile=l1only_nogrid --staging=Z:\...\out [--all-levels]
 *   node bin/lmauto_export.js --help
 */
'use strict';

const path = require('path');
const { printHelp, parseArgs } = require('../lib/cli_args');
const { exportImagesWithProfile, listExportedPngs } = require('../lib/export_images');
const { getProfile } = require('../lib/profiles');

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    printHelp('lmauto_export.js');
    process.exit(2);
  }
  if (args.help) {
    printHelp('lmauto_export.js');
    process.exit(0);
  }
  if (!args.profile) {
    console.error('--profile= is required');
    printHelp('lmauto_export.js');
    process.exit(2);
  }

  // Guest uses --workdir/out as staging; host passes --workdir with an out/ subdir.
  const staging =
    args.out ||
    (args.workdir ? path.join(args.workdir, 'out') : null);
  if (!staging) {
    console.error('--out= or --workdir= required (staging directory for PNGs)');
    process.exit(2);
  }

  if (process.platform !== 'win32') {
    console.error(
      'lmauto_export.js must run under Windows Node (use host/run_lmauto.sh)'
    );
    process.exit(2);
  }

  const profile = getProfile(args.profile);
  const result = await exportImagesWithProfile({
    profile: args.profile,
    stagingDir: staging,
    onlyModified: !args.allLevels,
    autoSetScreens: args.autoSetScreens,
    timeoutMs: args.timeoutMs,
    pollMs: args.pollMs,
  });

  const pngs = listExportedPngs(staging, profile.filePrefix);
  console.log(`lmauto: found ${pngs.length} PNG(s) matching ${JSON.stringify(profile.filePrefix)}`);
  for (const p of pngs.slice(0, 20)) console.log('  ', p);
  if (pngs.length > 20) console.log(`  ... +${pngs.length - 20} more`);

  if (pngs.length === 0) {
    console.warn('lmauto: warning: no PNGs found yet (export may still be writing)');
  }
  return result;
}

main().catch((err) => {
  console.error('lmauto_export failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});
