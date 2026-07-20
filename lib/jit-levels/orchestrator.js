/**
 * JITLevels1 orchestrator — build ROM and run all JIT analyzers.
 */

const fs = require('fs');
const path = require('path');
const { createRomFromBuffer, addSmcHeader, normalizeLevelId } = require('./smw-rom');
const { extractJitNames } = require('./jit-names');
const { extractJitNames2 } = require('./jit-names2');
const { extractJitMt } = require('./jit-mt');
const { extractJitOw } = require('./jit-ow');
const { extractJitTrans } = require('./jit-trans');
const {
  resolveFromGameVersion,
  resolveFromCatalog,
} = require('./jit-lmfilter');
const { runCalistoLmFilter, prepareJitlevelsWorkspace, wineAvailable } = require('./calisto-runner');
const { parseLevelInfo, mapLevelInfoToStageDefaults, deriveTagsFromLevelInfo } = require('./levelinfo');
const { scoreLevels } = require('./jit-score');
const { mergeDetectedLevels } = require('./merge-levels');

function getDbDetectedLevels(db, gameid, version) {
  const detectedLevelsMap = new Map();

  const gameInfo = db.prepare(`
    SELECT gvuuid, name, lmlevels, detectedlevels
    FROM gameversions
    WHERE gameid = ? AND (version = ? OR ? IS NULL)
    ORDER BY version DESC LIMIT 1
  `).get(gameid, version || null, version || null);

  if (!gameInfo) return { levels: [], gameName: null };

  const push = (normalized, source, patch = {}) => {
    if (!detectedLevelsMap.has(normalized)) {
      detectedLevelsMap.set(normalized, {
        levelnumber: normalized,
        levelname: null,
        translevel: null,
        submapid: null,
        tile_x: null,
        tile_y: null,
        tile_value: null,
        sources: [],
        sourceCount: 0,
      });
    }
    const level = detectedLevelsMap.get(normalized);
    if (!level.sources.includes(source)) {
      level.sources.push(source);
      level.sourceCount++;
    }
    Object.assign(level, { ...patch, levelnumber: normalized });
  };

  if (gameInfo.lmlevels) {
    try {
      for (const h of JSON.parse(gameInfo.lmlevels)) {
        const n = normalizeLevelId(h);
        if (n) push(n, 'lmlevels');
      }
    } catch { /* ignore */ }
  }

  if (gameInfo.detectedlevels) {
    try {
      for (const h of JSON.parse(gameInfo.detectedlevels)) {
        const n = normalizeLevelId(h);
        if (n) push(n, 'detect');
      }
    } catch { /* ignore */ }
  }

  const translevels = db.prepare(`
    SELECT DISTINCT t.translevel, t.level_number, t.locations
    FROM gameversions_translevels t
    JOIN gameversions gv ON t.gvuuid = gv.gvuuid
    WHERE gv.gameid = ? AND (gv.version = ? OR ? IS NULL)
  `).all(gameid, version || null, version || null);

  for (const trans of translevels) {
    if (!trans.level_number) continue;
    const n = normalizeLevelId(trans.level_number);
    if (!n) continue;
    let loc = null;
    try { loc = trans.locations ? JSON.parse(trans.locations)[0] : null; } catch { /* ignore */ }
    push(n, 'trans', {
      translevel: trans.translevel || null,
      submapid: loc?.submap != null ? String(loc.submap) : null,
      tile_x: loc?.tile_x != null ? String(loc.tile_x) : null,
      tile_y: loc?.tile_y != null ? String(loc.tile_y) : null,
    });
  }

  const levelnames = db.prepare(`
    SELECT ln.levelid, ln.levelname
    FROM levelnames ln
    JOIN gameversion_levelnames gvn ON ln.lvluuid = gvn.lvluuid
    JOIN gameversions gv ON gvn.gvuuid = gv.gvuuid
    WHERE gv.gameid = ? AND (gv.version = ? OR ? IS NULL)
  `).all(gameid, version || null, version || null);

  for (const row of levelnames) {
    const n = normalizeLevelId(row.levelid);
    if (n) push(n, 'levelnames', { levelname: row.levelname });
  }

  return {
    gameName: gameInfo.name,
    levels: [...detectedLevelsMap.values()],
  };
}

async function runJitLevelDetection(params) {
  const {
    db,
    gameid,
    version,
    patchedRomPath,
    patchedRomBuffer,
    tempBase,
    projectRoot,
    includeDbSources = true,
    runCalisto = false,
    jitlevelsZipPath,
    vanillaRomPath,
    catalogIndexDir,
    patchedRomSha1,
    patchBpsSha256,
    fingerprintCorpusPath,
    onProgress,
  } = params;

  const report = (phase, message) => {
    if (onProgress) onProgress({ phase, message });
  };

  report('rom', 'Loading patched ROM…');
  const romBuffer = patchedRomBuffer || fs.readFileSync(patchedRomPath);
  const rom = createRomFromBuffer(romBuffer);
  const headeredPath = patchedRomPath || path.join(tempBase, 'patched.smc');
  if (!patchedRomPath) {
    fs.mkdirSync(tempBase, { recursive: true });
    fs.writeFileSync(headeredPath, addSmcHeader(romBuffer));
  }

  report('jitnames', 'Reading level names…');
  const namesResult = extractJitNames(rom);

  report('jitnames2', 'Reading MT-compat level names…');
  const names2Result = extractJitNames2(romBuffer);

  report('jitmt', 'Applying MT-compat level inclusion…');
  const mtResult = extractJitMt(romBuffer, { vanillaRomPath });

  report('jitow', 'Scanning overworld placements…');
  const owResult = extractJitOw(romBuffer);

  report('jittrans', 'Scanning translevels…');
  const transResult = extractJitTrans(rom, headeredPath, projectRoot);
  const transWarnings = Array.isArray(transResult.warnings) ? transResult.warnings : [];

  report('jitlmfilter', 'Resolving LMFilter data…');
  let lmfilterLevels = resolveFromGameVersion(db, gameid, version);
  if (lmfilterLevels.length === 0 && catalogIndexDir) {
    lmfilterLevels = resolveFromCatalog(catalogIndexDir, {
      patchedRomSha1,
      patchBpsSha256,
      gameid,
    });
  }

  let calistoNeeded = lmfilterLevels.length === 0;
  if (calistoNeeded && runCalisto && jitlevelsZipPath && vanillaRomPath) {
    report('jitlmfilter', 'Running Calisto/LM363 export…');
    const prep = prepareJitlevelsWorkspace({
      tempBase,
      vanillaRomPath,
      patchedRomPath: headeredPath,
      jitlevelsZipPath,
    });
    if (prep.success) {
      const calisto = runCalistoLmFilter({
        workDir: prep.workDir,
        jitlevelsDir: prep.jitlevelsDir,
        patchedRomPath: headeredPath,
        vanillaRomPath,
        onProgress: (msg) => report('jitlmfilter', msg),
      });
      if (calisto.success) {
        lmfilterLevels = calisto.levels;
      }
    }
  }

  const unionIds = new Set();
  const dbResult = includeDbSources ? getDbDetectedLevels(db, gameid, version) : { levels: [], gameName: null };
  for (const list of [
    namesResult.levels,
    names2Result.levels,
    mtResult.levels,
    owResult.levels,
    transResult.levels,
    lmfilterLevels,
    dbResult.levels,
  ]) {
    for (const e of list) unionIds.add(e.levelnumber);
  }

  report('jitlevelinfo', 'Analyzing level metadata…');
  const levelInfoEntries = [];
  for (const levelnumber of unionIds) {
    try {
      const info = parseLevelInfo(romBuffer, levelnumber);
      const defaults = mapLevelInfoToStageDefaults(info);
      const tags = deriveTagsFromLevelInfo(info);
      levelInfoEntries.push({
        levelnumber,
        sources: ['jitlevelinfo'],
        levelInfo: info,
        suggestedTags: tags,
        ...defaults,
      });
    } catch (err) {
      report('jitlevelinfo', `Level ${levelnumber}: ${err.message}`);
    }
  }

  report('jitscore', 'Computing scores…');
  const corpusPath = fingerprintCorpusPath || path.join(projectRoot, 'electron', 'data', 'level_fingerprints.txt');
  const scoreEntries = scoreLevels(romBuffer, [...unionIds], corpusPath, fs);

  const dbLevels = dbResult.levels;
  const merged = mergeDetectedLevels([
    dbLevels,
    namesResult.levels,
    names2Result.levels,
    mtResult.levels,
    owResult.levels,
    transResult.levels,
    lmfilterLevels,
    levelInfoEntries,
    scoreEntries,
  ]);

  return {
    success: true,
    levels: merged,
    calistoNeeded: calistoNeeded && !runCalisto,
    wineAvailable: wineAvailable(),
    warnings: [namesResult.error, ...transWarnings].filter(Boolean),
  };
}

module.exports = {
  runJitLevelDetection,
  getDbDetectedLevels,
};
