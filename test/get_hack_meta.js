/**
 * Shared metadata for get_hack.sh (known shortnames, default image profiles, arg resolve).
 * Usable as library or CLI:
 *   enode.sh lmlevelinfo/test/get_hack_meta.js resolve jumphalf
 *   enode.sh lmlevelinfo/test/get_hack_meta.js resolve --gameid=19720 --hack=jumphalf
 *   enode.sh lmlevelinfo/test/get_hack_meta.js --help
 */
'use strict';

/** @type {Record<string, number>} */
const KNOWN_HACKS = Object.freeze({
  babykaizo: 19145,
  jumphalf: 19720,
  mooworld: 23075,
  dram3: 41022,
  sicarir: 25665,
});

/** Default lmauto profiles for a full suite harvest. */
const DEFAULT_PROFILES = Object.freeze([
  'l1only_nogrid',
  'l1only_gridlines',
  'l2only_gridlines',
  'l3only_gridlines',
  'spritesonly_gridlines',
  'l1l2only_gridlines',
]);

const SHORTNAME_RE = /^[a-z0-9]+$/;

function listKnownHacks() {
  return Object.keys(KNOWN_HACKS).sort();
}

/**
 * @param {string} name
 */
function isValidShortname(name) {
  return typeof name === 'string' && SHORTNAME_RE.test(name);
}

/**
 * @param {object} opts
 * @param {string|null} [opts.hack]
 * @param {string|number|null} [opts.gameid]
 * @returns {{ hack: string, gameid: number }}
 */
function resolveHack(opts) {
  const hack = opts.hack != null ? String(opts.hack) : null;
  const gameidRaw = opts.gameid != null ? String(opts.gameid) : null;

  if (hack && gameidRaw) {
    if (!isValidShortname(hack)) {
      throw new Error(`Invalid shortname "${hack}" (expected ^[a-z0-9]+$)`);
    }
    const gameid = parseInt(gameidRaw, 10);
    if (!Number.isFinite(gameid) || gameid <= 0) {
      throw new Error(`Invalid gameid "${gameidRaw}"`);
    }
    return { hack, gameid };
  }

  if (hack && !gameidRaw) {
    if (!isValidShortname(hack)) {
      throw new Error(`Invalid shortname "${hack}" (expected ^[a-z0-9]+$)`);
    }
    if (!Object.prototype.hasOwnProperty.call(KNOWN_HACKS, hack)) {
      throw new Error(
        `Unknown shortname "${hack}". Known: ${listKnownHacks().join(', ')} ` +
          `(or pass --gameid= with --hack=)`
      );
    }
    return { hack, gameid: KNOWN_HACKS[hack] };
  }

  if (!hack && gameidRaw) {
    throw new Error('Mode B requires both --gameid= and --hack=');
  }

  throw new Error('Provide a shortname, or --hack=NAME, or --gameid=ID --hack=NAME');
}

/**
 * @param {string[]} argv
 */
function parseResolveArgs(argv) {
  /** @type {{ hack: string|null, gameid: string|null }} */
  const opts = { hack: null, gameid: null };
  const positionals = [];
  for (const a of argv) {
    if (a.startsWith('--hack=')) opts.hack = a.slice(7);
    else if (a.startsWith('--gameid=')) opts.gameid = a.slice(9);
    else if (a.startsWith('-')) throw new Error(`Unknown argument: ${a}`);
    else positionals.push(a);
  }
  if (positionals.length === 1 && !opts.hack) opts.hack = positionals[0];
  else if (positionals.length > 1) {
    throw new Error('Too many positional arguments (use shortname or --hack= / --gameid=)');
  } else if (positionals.length === 1 && opts.hack) {
    throw new Error('Do not mix positional shortname with --hack=');
  }
  return opts;
}

function printHelp() {
  console.log(`get_hack_meta.js — resolve hack shortname / gameid for get_hack.sh

Commands:
  resolve <shortname>
  resolve --hack=<name>
  resolve --gameid=<id> --hack=<name>
  profiles          Print default image profile list (one per line)
  known             Print known shortname=gameid lines
  --help

Known shortnames: ${listKnownHacks().join(', ')}
`);
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
    printHelp();
    return 0;
  }
  const cmd = argv[0];
  if (cmd === 'profiles') {
    for (const p of DEFAULT_PROFILES) console.log(p);
    return 0;
  }
  if (cmd === 'known') {
    for (const k of listKnownHacks()) console.log(`${k}=${KNOWN_HACKS[k]}`);
    return 0;
  }
  if (cmd === 'resolve') {
    const resolved = resolveHack(parseResolveArgs(argv.slice(1)));
    console.log(`hack=${resolved.hack}`);
    console.log(`gameid=${resolved.gameid}`);
    return 0;
  }
  throw new Error(`Unknown command: ${cmd}`);
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(e.message || e);
    process.exit(2);
  }
}

module.exports = {
  KNOWN_HACKS,
  DEFAULT_PROFILES,
  SHORTNAME_RE,
  listKnownHacks,
  isValidShortname,
  resolveHack,
  parseResolveArgs,
};
