#!/usr/bin/env node
/**
 * Central unit-test runner for lmauto (no Wine required).
 * Opt-in integration: LMAUTO_INTEGRATION=1 runs tests/test_integration_smoke.js
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UNIT = [
  'test_wm_commands.js',
  'test_profiles.js',
  'test_rom_prepare.js',
  'test_cli_args.js',
];

function run(file) {
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    console.error(`FAIL: ${file} (exit ${r.status})`);
    process.exit(r.status || 1);
  }
}

for (const f of UNIT) run(f);

if (process.env.LMAUTO_INTEGRATION === '1') {
  run('test_integration_smoke.js');
} else {
  console.log('SKIP: test_integration_smoke (set LMAUTO_INTEGRATION=1)');
}

console.log('PASS: lmauto tests/run_all.js');
