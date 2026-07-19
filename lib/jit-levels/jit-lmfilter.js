/**
 * JIT.LMFilter — resolve level ID list from DB, catalog, or Calisto export.
 */

const fs = require('fs');
const path = require('path');
const { normalizeLevelId } = require('./smw-rom');

function levelsFromHexList(hexList) {
  if (!Array.isArray(hexList)) return [];
  return hexList.map((h) => {
    const levelnumber = normalizeLevelId(h);
    if (!levelnumber) return null;
    return {
      levelnumber,
      levelname: null,
      sources: ['jitlmfilter'],
    };
  }).filter(Boolean);
}

function resolveFromGameVersion(db, gameid, version) {
  const row = db.prepare(`
    SELECT lmlevels FROM gameversions
    WHERE gameid = ? AND (version = ? OR ? IS NULL)
    ORDER BY version DESC LIMIT 1
  `).get(gameid, version || null, version || null);

  if (!row?.lmlevels) return [];
  try {
    const parsed = JSON.parse(row.lmlevels);
    return levelsFromHexList(parsed);
  } catch {
    return [];
  }
}

function parseCatalogLmfilterJson(json) {
  if (Array.isArray(json.lmfilter)) {
    return levelsFromHexList(json.lmfilter);
  }
  if (json.lmfilter && typeof json.lmfilter === 'object') {
    return levelsFromHexList(Object.keys(json.lmfilter));
  }
  return [];
}

function resolveFromCatalog(catalogIndexDir, lookup = {}) {
  if (!catalogIndexDir) return [];

  const patchedRomSha1 = lookup.patchedRomSha1 || lookup.patchSha256 || null;
  const patchBpsSha256 = lookup.patchBpsSha256 || null;
  const gameid = lookup.gameid != null ? String(lookup.gameid) : null;

  if (patchedRomSha1 && patchedRomSha1.length === 40) {
    const indexPath = path.join(catalogIndexDir, `${patchedRomSha1.toLowerCase()}.json`);
    if (fs.existsSync(indexPath)) {
      try {
        return parseCatalogLmfilterJson(JSON.parse(fs.readFileSync(indexPath, 'utf8')));
      } catch {
        return [];
      }
    }
  }

  if (!patchBpsSha256 && !gameid) return [];

  let entries;
  try {
    entries = fs.readdirSync(catalogIndexDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  for (const file of entries) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(catalogIndexDir, file), 'utf8'));
      if (patchBpsSha256 && json.bps_sha256_hash === patchBpsSha256) {
        const levels = parseCatalogLmfilterJson(json);
        if (levels.length > 0) return levels;
      }
      if (gameid) {
        const smwcId = json.smwc_waiting?.gameid || json.smwc?.gameid || json.gameid;
        if (smwcId != null && String(smwcId) === gameid) {
          const levels = parseCatalogLmfilterJson(json);
          if (levels.length > 0) return levels;
        }
      }
    } catch {
      /* ignore malformed catalog entries */
    }
  }

  return [];
}

function parseMwlLevelIdsFromDirectory(levelsDir) {
  const levels = [];
  if (!fs.existsSync(levelsDir)) return levels;

  const entries = fs.readdirSync(levelsDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.mwl')) continue;
    const base = ent.name.replace(/\.mwl$/i, '');
    const match = base.match(/([0-9A-Fa-f]{1,3})$/);
    if (!match) continue;
    const levelnumber = normalizeLevelId(match[1]);
    if (levelnumber) {
      levels.push({ levelnumber, levelname: null, sources: ['jitlmfilter'] });
    }
  }
  return levels;
}

function parseCalistoMwlExports(jitlevelsWorkDir) {
  const candidates = [
    path.join(jitlevelsWorkDir, 'resources', 'levels'),
    path.join(jitlevelsWorkDir, 'temp', 'resources', 'levels'),
    jitlevelsWorkDir,
  ];
  for (const dir of candidates) {
    const found = parseMwlLevelIdsFromDirectory(dir);
    if (found.length > 0) return found;
  }
  return [];
}

module.exports = {
  levelsFromHexList,
  resolveFromGameVersion,
  resolveFromCatalog,
  parseCatalogLmfilterJson,
  parseMwlLevelIdsFromDirectory,
  parseCalistoMwlExports,
};
