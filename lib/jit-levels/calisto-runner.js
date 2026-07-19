/**
 * Calisto/LM363 runner for JIT.LMFilter fallback (Wine on Linux).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sevenZip = require('7zip-min');
const { addSmcHeader } = require('./smw-rom');
const { parseCalistoMwlExports } = require('./jit-lmfilter');

function wineAvailable() {
  if (process.platform === 'win32') return true;
  const result = spawnSync('wine', ['--version'], { encoding: 'utf8', timeout: 5000 });
  return result.status === 0;
}

function ensureJitlevelsExtracted(jitlevelsZipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const marker = path.join(destDir, '.extracted');
  if (fs.existsSync(marker)) return { success: true, dir: destDir };

  if (!fs.existsSync(jitlevelsZipPath)) {
    return { success: false, error: `jitlevels.zip not found at ${jitlevelsZipPath}` };
  }

  try {
    sevenZip.unpack(jitlevelsZipPath, destDir);
    fs.writeFileSync(marker, new Date().toISOString());
    return { success: true, dir: destDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function runWineCommand(cwd, exeRel, args, timeoutMs = 60000) {
  const winePrefix = process.platform === 'win32' ? '' : 'wine ';
  const cmd = process.platform === 'win32'
    ? `"${exeRel}" ${args.join(' ')}`
    : `wine "${exeRel}" ${args.join(' ')}`;

  const result = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * Run LM363 transfer/export sequence (simplified from try_lmfilter.py).
 */
function runCalistoLmFilter({ workDir, jitlevelsDir, patchedRomPath, vanillaRomPath, onProgress }) {
  const report = (msg) => { if (onProgress) onProgress(msg); };

  if (!wineAvailable() && process.platform !== 'win32') {
    return { success: false, error: 'Wine is required on Linux to run Lunar Magic / Calisto' };
  }

  const lmExe = path.join(jitlevelsDir, 'lm363.exe');
  if (!fs.existsSync(lmExe)) {
    return { success: false, error: `lm363.exe not found in ${jitlevelsDir}` };
  }

  fs.mkdirSync(workDir, { recursive: true });
  const tempDir = path.join(workDir, 'temp');
  fs.mkdirSync(tempDir, { recursive: true });

  const origLm = path.join(jitlevelsDir, 'orig_lm363_noedits.sfc');
  const origSource = fs.existsSync(origLm) ? origLm : vanillaRomPath;
  if (!fs.existsSync(origSource)) {
    return { success: false, error: 'No orig_lm363_noedits.sfc or vanilla ROM for LM base' };
  }

  const tempLm = path.join(tempDir, 'temp_lm363.sfc');
  const tempAnalyze = path.join(tempDir, 'temp_analyze.sfc');
  const tempSfc = path.join(tempDir, 'temp.sfc');

  fs.copyFileSync(origSource, tempLm);
  fs.copyFileSync(patchedRomPath, tempAnalyze);

  const relLm = path.relative(tempDir, lmExe).replace(/\\/g, '/');
  const steps = [
    { msg: 'LM: DeleteLevels', args: [relLm, '-DeleteLevels', 'temp_lm363.sfc', '-AllLevels', '-ClearOrigLevelArea'] },
    { msg: 'LM: ExpandROM', args: [relLm, '-ExpandROM', 'temp_lm363.sfc', '4MB'] },
    { msg: 'LM: ExportGFX', args: [relLm, '-ExportGFX', 'temp_analyze.sfc'] },
    { msg: 'LM: ExportExGFX', args: [relLm, '-ExportExGFX', 'temp_analyze.sfc'] },
    { msg: 'LM: ExportAllMap16', args: [relLm, '-ExportAllMap16', 'temp_analyze.sfc', 'temp.map16'] },
    { msg: 'LM: ImportAllMap16', args: [relLm, '-ImportAllMap16', 'temp.sfc', 'temp.map16'] },
    { msg: 'LM: TransferOverworld', args: [relLm, '-TransferOverworld', 'temp_lm363.sfc', 'temp_analyze.sfc'] },
    { msg: 'LM: ExportMultLevels', args: [relLm, '-ExportMultLevels', 'temp_analyze.sfc', 'MWL', '1'] },
    { msg: 'LM: ImportMultLevels', args: [relLm, '-ImportMultLevels', 'temp_lm363.sfc', './'] },
  ];

  for (const step of steps) {
    report(step.msg);
    const result = runWineCommand(tempDir, step.args[0], step.args.slice(1), 120000);
    if (!result.ok && step.msg.includes('ExpandROM')) {
      // ExpandROM may return non-zero but still succeed
    } else if (!result.ok && !step.msg.includes('ImportAllMap16')) {
      return {
        success: false,
        error: `${step.msg} failed (exit ${result.status}): ${result.stderr || result.stdout}`,
      };
    }
  }

  const levels = parseCalistoMwlExports(tempDir);
  return { success: true, levels, workDir: tempDir };
}

function prepareJitlevelsWorkspace({ tempBase, vanillaRomPath, patchedRomPath, jitlevelsZipPath }) {
  const workDir = path.join(tempBase, 'jitlevels-run');
  const jitlevelsDir = path.join(tempBase, 'jitlevels');
  const extract = ensureJitlevelsExtracted(jitlevelsZipPath, jitlevelsDir);
  if (!extract.success) return extract;

  const cleanSmc = path.join(jitlevelsDir, 'clean.smc');
  const xSmc = path.join(jitlevelsDir, 'x.smc');
  fs.copyFileSync(vanillaRomPath, cleanSmc);
  const patchedBuf = fs.readFileSync(patchedRomPath);
  fs.writeFileSync(xSmc, addSmcHeader(patchedBuf));

  return { success: true, workDir, jitlevelsDir, cleanSmc, xSmc };
}

module.exports = {
  wineAvailable,
  ensureJitlevelsExtracted,
  runCalistoLmFilter,
  prepareJitlevelsWorkspace,
};
