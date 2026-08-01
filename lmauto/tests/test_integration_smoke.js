/**
 * Opt-in Wine+LM smoke: requires LMAUTO_INTEGRATION=1, wine, DISPLAY, LM, node-win-x64,
 * and LMAUTO_SMOKE_ROM (path to a hack ROM with at least one modified level).
 *
 * Example:
 *   LMAUTO_INTEGRATION=1 LMAUTO_SMOKE_ROM=lmlevelinfo/test/akogare/orig_Ako.sfc \
 *     ./tests/run_all.sh
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LMAUTO = path.resolve(__dirname, '..');
const HOST = path.join(LMAUTO, 'host', 'run_lmauto.sh');

function main() {
  if (process.env.LMAUTO_INTEGRATION !== '1') {
    console.log('SKIP: integration (LMAUTO_INTEGRATION!=1)');
    return;
  }
  const rom = process.env.LMAUTO_SMOKE_ROM;
  if (!rom || !fs.existsSync(rom)) {
    console.error('LMAUTO_SMOKE_ROM missing or not found');
    process.exit(1);
  }
  const out = fs.mkdtempSync(path.join(LMAUTO, 'work', 'smoke.out.'));
  const r = spawnSync(
    HOST,
    [`--rom=${path.resolve(rom)}`, '--profile=l1only_nogrid', `--out=${out}`, '--timeout-ms=300000'],
    { encoding: 'utf8', cwd: LMAUTO }
  );
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    console.error('integration smoke failed');
    process.exit(r.status || 1);
  }
  const pngs = fs.readdirSync(out).filter((f) => f.endsWith('.png'));
  if (pngs.length < 1) {
    console.error('expected >=1 PNG in', out);
    process.exit(1);
  }
  console.log(`PASS: test_integration_smoke (${pngs.length} pngs)`);
}

main();
