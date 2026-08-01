/**
 * Shared CLI argument parsing for lmauto host/guest entry points.
 */
'use strict';

const { listProfiles } = require('./profiles');

function printHelp(scriptName) {
  const profiles = listProfiles().join(', ');
  console.log(`Usage: ${scriptName} [options]

Automate Lunar Magic GUI to Export Multiple Levels as Images (and later other
exports that have no LM CLI).

Options:
  --help                 Show this help
  --rom=<path>           Source ROM (host prepares headered copy)
  --lm=<path>            Lunar Magic exe (default: LMAUTO_LM or lmauto/lm363.exe)
  --profile=<id>         Export profile: ${profiles}
  --out=<dir>            Destination directory for PNGs
  --workdir=<dir>        Working directory (temp ROM, LM copy, export staging)
  --all-levels           Dialog 1027: uncheck "Only export modified levels"
  --auto-set-screens     Dialog 1027: check "Auto-Set Number of Screens"
  --attach               Do not launch LM; attach to existing LMFrame (guest)
  --timeout-ms=<n>       Overall timeout (default 600000)
  --poll-ms=<n>          Window poll interval (default 250)

Environment:
  LMAUTO_LM              Default Lunar Magic exe
  LMAUTO_WINEPREFIX      Wine prefix (host; default $HOME/.wine_lm_auto)
  LMAUTO_NODE            Windows node.exe (host; default node-win-x64/node.exe)
  WINE                   Wine binary (default wine)
  DISPLAY                X display for Wine GUI (often :99 with Xvfb)
`);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const args = {
    help: false,
    rom: null,
    lm: process.env.LMAUTO_LM || null,
    profile: null,
    out: null,
    workdir: null,
    allLevels: false,
    autoSetScreens: false,
    attach: false,
    timeoutMs: 600000,
    pollMs: 250,
  };
  for (const a of argv) {
    if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--rom=')) args.rom = a.slice(6);
    else if (a.startsWith('--lm=')) args.lm = a.slice(5);
    else if (a.startsWith('--profile=')) args.profile = a.slice(10);
    else if (a.startsWith('--out=')) args.out = a.slice(6);
    else if (a.startsWith('--workdir=')) args.workdir = a.slice(10);
    else if (a === '--all-levels') args.allLevels = true;
    else if (a === '--auto-set-screens') args.autoSetScreens = true;
    else if (a === '--attach') args.attach = true;
    else if (a.startsWith('--timeout-ms=')) args.timeoutMs = parseInt(a.slice(13), 10);
    else if (a.startsWith('--poll-ms=')) args.pollMs = parseInt(a.slice(10), 10);
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

module.exports = { printHelp, parseArgs };
