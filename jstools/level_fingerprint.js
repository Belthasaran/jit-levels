#!/usr/bin/env node

/**
 * level_fingerprint.js — dump Layer1 screen fingerprints for a ROM.
 *
 * Usage:
 *   ./enode.sh jstools/level_fingerprint.js --rom path/to.sfc [--gameid ID] [--out file.txt]
 *   ./enode.sh jstools/level_fingerprint.js --help
 */

const fs = require('fs');
const path = require('path');
const { normalizeLevelId } = require('../lib/jit-levels/smw-rom');
const { buildLevelFingerprints } = require('../lib/jit-levels/jit-score');

function printUsage() {
  console.log(`Usage: level_fingerprint.js --rom PATH [options]

Options:
  --rom=PATH       Path to SFC/SMC ROM file (required)
  --gameid=ID      Game id for output (default: 0 = unknown; empty = vanilla)
  --levels=LIST    Comma-separated level ids (hex), default 001-024,101-13B subset
  --out=PATH       Write TSV output to file (default: stdout)
  --help           Show this help

Output rows: gameid,levelid,screen,fingerprint
  fingerprint is v2:<hex> from expanded Layer1 Map16, or "empty" when the screen
  (or entire level) has no non-empty tiles.
`);
}

function parseArgs(argv) {
  const args = { rom: null, gameid: '0', levels: null, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--rom=')) {
      args.rom = arg.slice(6);
    } else if (arg === '--rom') {
      args.rom = argv[++i];
    } else if (arg.startsWith('--gameid=')) {
      args.gameid = arg.slice(9);
    } else if (arg === '--gameid') {
      args.gameid = argv[++i];
    } else if (arg.startsWith('--levels=')) {
      args.levels = arg.slice(9).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg === '--levels') {
      args.levels = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--out=')) {
      args.out = arg.slice(6);
    } else if (arg === '--out') {
      args.out = argv[++i];
    }
  }
  return args;
}

function defaultLevelList() {
  const levels = [];
  for (let i = 1; i <= 0x24; i++) levels.push(i.toString(16).toUpperCase().padStart(3, '0'));
  for (let i = 0x101; i <= 0x13b; i++) levels.push(i.toString(16).toUpperCase().padStart(3, '0'));
  return levels;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.rom) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const romPath = path.resolve(args.rom);
  if (!fs.existsSync(romPath)) {
    console.error(`ROM not found: ${romPath}`);
    process.exit(1);
  }

  const romBuffer = fs.readFileSync(romPath);
  const levels = args.levels || defaultLevelList();
  const lines = ['# gameid,levelid,screen,fingerprint'];

  for (const levelId of levels) {
    const normalized = normalizeLevelId(levelId);
    if (!normalized) {
      console.error(`Skipping invalid level id: ${levelId}`);
      continue;
    }
    try {
      const built = buildLevelFingerprints(romBuffer, normalized);
      const rows = built.screenRows && built.screenRows.length
        ? built.screenRows
        : [{ screen: 0, fingerprint: 'empty' }];

      let wrote = false;
      for (const row of rows) {
        lines.push(`${args.gameid},${normalized},${row.screen},${row.fingerprint}`);
        wrote = true;
      }
      if (!wrote) {
        lines.push(`${args.gameid},${normalized},0,empty`);
      }
    } catch (err) {
      console.error(`Level ${normalized}: ${err.message}`);
    }
  }

  const output = lines.join('\n') + '\n';
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), output);
    console.log(`Wrote ${lines.length - 1} fingerprint rows to ${args.out}`);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, parseArgs };
