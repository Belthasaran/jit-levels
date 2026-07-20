/**
 * JIT.Score — fingerprint v2 (expanded Layer1 Map16) and scoring metrics.
 */

const { parseLevelInfo } = require('../levelinfo');
const { fingerprintLevelViaExpand } = require('./expand-fingerprint');

/** Match lm_level_expand horizontal/vertical screen tile height (default 27). */
const SCREEN_SHAPES = {
  horizontal: { cols: 16, rows: 27 },
  vertical: { cols: 16, rows: 27 },
};

/** Vertical level modes from lm_level_expand.c */
const VERTICAL_MODES = new Set([0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1a, 0x1b]);

/** Screens below this nonzero-tile density do not affect Orig/Int. */
const MIN_SCREEN_DENSITY = 0.05;

/** Unique-tile count at which uniqueNorm saturates. */
const UNIQUE_TILE_NORM = 32;

function countLevelObjects(levelInfo) {
  const objs = levelInfo?.layer1?.objects;
  if (Array.isArray(objs)) return objs;
  if (objs && typeof objs === 'object') {
    return [
      ...(objs.standard || []),
      ...(objs.extended || []),
      ...(objs.screen_exits || []),
    ];
  }
  return [];
}

function countContentObjects(levelInfo) {
  const objs = levelInfo?.layer1?.objects;
  if (Array.isArray(objs)) {
    return objs.filter((o) => o.kind !== 'screen_exit' && o.kind !== 3).length;
  }
  if (objs && typeof objs === 'object') {
    return (objs.standard || []).length + (objs.extended || []).length;
  }
  return 0;
}

function countSprites(levelInfo) {
  return levelInfo?.sprite_data?.sprites || levelInfo?.layer1?.sprites || [];
}

function countScreenExits(levelInfo) {
  const objs = levelInfo?.layer1?.objects;
  if (Array.isArray(objs)) {
    return objs.filter(
      (o) =>
        o.kind === 'screen_exit' ||
        o.kind === 3 ||
        o.object_number === 0x3f ||
        o.std_id === 0x3f
    ).length;
  }
  if (objs && typeof objs === 'object') {
    return (objs.screen_exits || []).length;
  }
  return 0;
}

function isLevelEmpty(levelInfo) {
  return countContentObjects(levelInfo) === 0 && countSprites(levelInfo).length === 0;
}

function screenShapeForMode(levelMode) {
  const mode = levelMode & 0x1f;
  if (VERTICAL_MODES.has(mode)) {
    return SCREEN_SHAPES.vertical;
  }
  return SCREEN_SHAPES.horizontal;
}

/** @deprecated keep for tests / corpus that still has v1 rows */
function fingerprintScreenV1(tiles, maxTiles) {
  const slice = tiles.slice(0, maxTiles);
  if (slice.every((t) => t === 0)) return null;
  const hex = slice.map((t) => (t & 0xff).toString(16).padStart(2, '0')).join('');
  return `v1:${hex}`;
}

function fingerprintScreenV2(tiles, maxTiles) {
  const slice = tiles.slice(0, maxTiles);
  if (slice.every((t) => (t & 0xffff) === 0)) return null;
  const hex = slice.map((t) => (t & 0xffff).toString(16).padStart(4, '0')).join('');
  return `v2:${hex}`;
}

function parseFingerprintTiles(fp) {
  if (!fp || typeof fp !== 'string') return null;
  if (fp === 'empty') return { version: 'empty', tiles: [] };
  if (fp.startsWith('v2:')) {
    const hex = fp.slice(3);
    const tiles = [];
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      tiles.push(parseInt(hex.substr(i, 4), 16));
    }
    return { version: 'v2', tiles };
  }
  if (fp.startsWith('v1:')) {
    const hex = fp.slice(3);
    const tiles = [];
    for (let i = 0; i + 2 <= hex.length; i += 2) {
      tiles.push(parseInt(hex.substr(i, 2), 16));
    }
    return { version: 'v1', tiles };
  }
  return null;
}

/**
 * Parse fingerprint hex once into Uint16Array tiles.
 * @returns {{ version: string, tiles: Uint16Array } | null}
 */
function parseFingerprintUint16(fp) {
  if (!fp || typeof fp !== 'string') return null;
  if (fp === 'empty') return { version: 'empty', tiles: new Uint16Array(0) };
  if (fp.startsWith('v2:')) {
    const hex = fp.slice(3);
    const n = (hex.length / 4) | 0;
    const tiles = new Uint16Array(n);
    for (let i = 0, t = 0; t < n; i += 4, t++) {
      tiles[t] = parseInt(hex.substr(i, 4), 16);
    }
    return { version: 'v2', tiles };
  }
  if (fp.startsWith('v1:')) {
    const hex = fp.slice(3);
    const n = (hex.length / 2) | 0;
    const tiles = new Uint16Array(n);
    for (let i = 0, t = 0; t < n; i += 2, t++) {
      tiles[t] = parseInt(hex.substr(i, 2), 16);
    }
    return { version: 'v1', tiles };
  }
  return null;
}

/**
 * Hamming distance as 0–100 percent of differing tile positions.
 * If `maxPercent` is set, abort early when the result cannot beat it (returns >= maxPercent).
 * @param {Uint16Array} tilesA
 * @param {Uint16Array} tilesB
 * @param {number} [maxPercent]
 */
function hammingPercent(tilesA, tilesB, maxPercent) {
  if (tilesA === tilesB) return 0;
  const nA = tilesA.length;
  const nB = tilesB.length;
  const n = Math.max(nA, nB, 1);
  const shared = Math.min(nA, nB);
  let diff = 0;

  if (maxPercent != null) {
    // Stop when 100*diff/n >= maxPercent (cannot improve on current best).
    const abortAt = maxPercent * n;
    for (let i = 0; i < shared; i++) {
      if (tilesA[i] !== tilesB[i]) {
        diff++;
        if (diff * 100 >= abortAt) return maxPercent;
      }
    }
    diff += Math.abs(nA - nB);
    if (diff * 100 >= abortAt) return maxPercent;
  } else {
    for (let i = 0; i < shared; i++) {
      if (tilesA[i] !== tilesB[i]) diff++;
    }
    diff += Math.abs(nA - nB);
  }
  return Math.round((diff / n) * 100);
}

function compareFingerprints(fpA, fpB) {
  const a = parseFingerprintUint16(fpA);
  const b = parseFingerprintUint16(fpB);
  if (!a || !b || a.version === 'empty' || b.version === 'empty') return 100;
  if (a.version !== b.version) return 100;
  return hammingPercent(a.tiles, b.tiles);
}

/** Alias used by older tests */
function compareFingerprintsV1(fpA, fpB) {
  return compareFingerprints(fpA, fpB);
}

function isContentFingerprint(fp) {
  return !!(fp && fp !== 'empty' && (fp.startsWith('v1:') || fp.startsWith('v2:')));
}

function metricsFromTiles(tiles) {
  const total = tiles.length;
  if (!total) {
    return { density: 0, invDom: 0, uniqueNorm: 0, unique: 0, weight: 0 };
  }
  const counts = new Map();
  let nonzero = 0;
  for (let i = 0; i < total; i++) {
    const t = tiles[i];
    if (t === 0) continue;
    nonzero++;
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const density = nonzero / total;
  if (!nonzero) {
    return { density: 0, invDom: 0, uniqueNorm: 0, unique: 0, weight: 0 };
  }
  let mode = 0;
  for (const c of counts.values()) mode = Math.max(mode, c);
  const unique = counts.size;
  const invDom = 1 - mode / nonzero;
  const uniqueNorm = Math.min(1, unique / UNIQUE_TILE_NORM);
  const weight = density >= MIN_SCREEN_DENSITY ? density * invDom * uniqueNorm : 0;
  return { density, invDom, uniqueNorm, unique, weight };
}

/**
 * Pre-parse a fingerprint string into a scoring screen record (or null if unqualified).
 * @returns {{ version: string, tiles: Uint16Array, density: number, weight: number } | null}
 */
function prepareScreen(fp) {
  if (!isContentFingerprint(fp)) return null;
  const parsed = parseFingerprintUint16(fp);
  if (!parsed || parsed.version === 'empty' || !parsed.tiles.length) return null;
  const m = metricsFromTiles(parsed.tiles);
  if (m.density < MIN_SCREEN_DENSITY) return null;
  return {
    version: parsed.version,
    tiles: parsed.tiles,
    density: m.density,
    weight: m.weight,
  };
}

function prepareScreens(fingerprints) {
  const out = [];
  for (const fp of fingerprints || []) {
    const s = prepareScreen(fp);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Nonzero tile fraction (0–1). Empty / unparseable → 0.
 */
function fingerprintDensity(fp) {
  const parsed = parseFingerprintUint16(fp);
  if (!parsed || parsed.version === 'empty' || !parsed.tiles.length) return 0;
  return metricsFromTiles(parsed.tiles).density;
}

/**
 * Tile diversity among nonzero cells:
 *   invDom = 1 - (modeCount / nonzero)
 *   uniqueNorm = min(1, uniqueCount / UNIQUE_TILE_NORM)
 */
function fingerprintDiversity(fp) {
  const parsed = parseFingerprintUint16(fp);
  if (!parsed || parsed.version === 'empty' || !parsed.tiles.length) {
    return { invDom: 0, uniqueNorm: 0, unique: 0 };
  }
  const m = metricsFromTiles(parsed.tiles);
  return { invDom: m.invDom, uniqueNorm: m.uniqueNorm, unique: m.unique };
}

/**
 * Interest weight for Orig/Int aggregation: density × invDom × uniqueNorm.
 * Sparse screens should be filtered with MIN_SCREEN_DENSITY before using this.
 */
function screenInterestWeight(fp) {
  const parsed = parseFingerprintUint16(fp);
  if (!parsed || parsed.version === 'empty' || !parsed.tiles.length) return 0;
  return metricsFromTiles(parsed.tiles).weight;
}

function densityQualifiedFingerprints(fingerprints) {
  return (fingerprints || []).filter(
    (fp) => isContentFingerprint(fp) && fingerprintDensity(fp) >= MIN_SCREEN_DENSITY
  );
}

/**
 * Weighted average of per-screen scores. If all interest weights are 0 but
 * screens remain (mono-tile pads), fall back to unweighted mean so Completeness
 * stays the emptiness signal rather than Orig collapsing to 0.
 */
function weightedAverageScores(entries) {
  if (!entries.length) return 0;
  let wSum = 0;
  let wDen = 0;
  let plainSum = 0;
  for (const { score, weight } of entries) {
    plainSum += score;
    if (weight > 0) {
      wSum += score * weight;
      wDen += weight;
    }
  }
  if (wDen > 0) return Math.round(wSum / wDen);
  return Math.round(plainSum / entries.length);
}

function bestDistanceVsPrepared(screen, corpusScreens) {
  let best = 100;
  for (const other of corpusScreens) {
    if (other.version !== screen.version) continue;
    const d = hammingPercent(screen.tiles, other.tiles, best);
    if (d < best) {
      best = d;
      if (best === 0) return 0;
    }
  }
  return best;
}

function scoreOriginalityPrepared(screens, corpusScreens) {
  if (!screens.length) return 0;
  if (!corpusScreens || !corpusScreens.length) return null;
  const entries = screens.map((s) => ({
    score: bestDistanceVsPrepared(s, corpusScreens),
    weight: s.weight,
  }));
  return weightedAverageScores(entries);
}

/**
 * Load corpus. Accepts:
 *   gameid,levelid,fingerprint
 *   gameid,levelid,screen,fingerprint
 * Skips comments, headers, and `empty` fingerprints.
 */
function loadFingerprintCorpus(filePath, fsModule) {
  const corpus = [];
  if (!fsModule.existsSync(filePath)) return corpus;
  const lines = fsModule.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(',');
    if (parts.length < 3) continue;

    const gameid = parts[0].trim();
    const levelid = parts[1].trim().toUpperCase().padStart(3, '0');
    let fingerprint;

    if (parts.length >= 4) {
      const maybeScreen = parts[2].trim();
      const rest = parts.slice(3).join(',').trim();
      if (/^\d+$/.test(maybeScreen) && (rest.startsWith('v1:') || rest.startsWith('v2:') || rest === 'empty')) {
        fingerprint = rest;
      } else {
        fingerprint = parts.slice(2).join(',').trim();
      }
    } else {
      fingerprint = parts[2].trim();
    }

    if (!fingerprint || fingerprint === 'empty') continue;
    if (fingerprint === 'fingerprint' || levelid === 'LEVELID') continue;
    if (!fingerprint.startsWith('v1:') && !fingerprint.startsWith('v2:')) continue;

    corpus.push({ gameid, levelid, fingerprint });
  }
  return corpus;
}

/**
 * Originality vs external corpus.
 * Density-gated screens only; interest-weighted average of per-screen best Hamming
 * (0 = identical to a known screen). Empty / no qualifying screens → 0.
 * Missing corpus → null (unscored). Completeness owns overall emptiness.
 */
function scoreOriginality(fingerprints, corpus) {
  const screens = prepareScreens(fingerprints);
  if (!screens.length) return 0;
  if (!corpus || !corpus.length) return null;
  const corpusScreens = prepareScreens(corpus.map((e) => e.fingerprint));
  return scoreOriginalityPrepared(screens, corpusScreens);
}

/**
 * Internal similarity for one level vs all others (string fingerprint API).
 * Prefer scoreAllInternalPrepared from scoreLevels for bulk work.
 */
function scoreInternalSimilarity(allLevelFps, levelIndex) {
  const prepared = (allLevelFps || []).map((fps) => prepareScreens(fps));
  return scoreInternalPrepared(prepared, levelIndex);
}

function scoreInternalPrepared(allPrepared, levelIndex) {
  const mine = allPrepared[levelIndex] || [];
  if (mine.length === 0) return 0;

  const entries = [];
  let anyOther = false;
  for (let j = 0; j < allPrepared.length; j++) {
    if (j !== levelIndex && (allPrepared[j] || []).length) {
      anyOther = true;
      break;
    }
  }
  if (!anyOther) return 100;

  for (const screen of mine) {
    let best = 100;
    for (let j = 0; j < allPrepared.length; j++) {
      if (j === levelIndex) continue;
      const other = allPrepared[j] || [];
      for (const o of other) {
        if (o.version !== screen.version) continue;
        const d = hammingPercent(screen.tiles, o.tiles, best);
        if (d < best) {
          best = d;
          if (best === 0) break;
        }
      }
      if (best === 0) break;
    }
    entries.push({ score: best, weight: screen.weight });
  }
  return weightedAverageScores(entries);
}

/**
 * One-pass internal similarity for every level (avoids N redundant all-vs-all scans).
 * @param {Array<Array<{tiles:Uint16Array,version:string,weight:number}>>} allPrepared
 * @returns {number[]}
 */
function scoreAllInternalPrepared(allPrepared) {
  const n = allPrepared.length;
  const scores = new Array(n);

  // Flat list of (levelIndex, screen) for cross-level compares once per pair of levels.
  for (let i = 0; i < n; i++) {
    const mine = allPrepared[i] || [];
    if (!mine.length) {
      scores[i] = 0;
      continue;
    }
    const entries = [];
    let compared = false;
    for (const screen of mine) {
      let best = 100;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const other = allPrepared[j] || [];
        for (const o of other) {
          if (o.version !== screen.version) continue;
          compared = true;
          const d = hammingPercent(screen.tiles, o.tiles, best);
          if (d < best) {
            best = d;
            if (best === 0) break;
          }
        }
        if (best === 0) break;
      }
      entries.push({ score: best, weight: screen.weight });
    }
    scores[i] = compared ? weightedAverageScores(entries) : 100;
  }
  return scores;
}

function scoreCompleteness(levelInfo) {
  if (isLevelEmpty(levelInfo)) return 0;

  const primary = levelInfo?.layer1?.primary_level_header || {};
  const objects = countLevelObjects(levelInfo);
  const sprites = countSprites(levelInfo);
  const exitCount = countScreenExits(levelInfo);

  let screens = primary.length_in_screens;
  if (screens === -1) screens = 32;
  else if (screens != null && screens >= 0) screens = screens + 1;
  if (screens == null || screens <= 0) screens = 1;

  let score = 0;
  score += (Math.min(screens, 8) / 8) * 40;
  score += (Math.min(objects.length, 80) / 80) * 30;
  score += (Math.min(sprites.length, 40) / 40) * 15;
  if (exitCount > 0) score += 15;
  return Math.round(Math.min(100, score));
}

/**
 * @param {Buffer} romBuffer
 * @param {string|number} levelId
 * @param {{ romPath?: string }} [options]  ignored; expand is in-process JS
 */
function buildLevelFingerprints(romBuffer, levelId, options = {}) {
  void options;
  const info = parseLevelInfo(romBuffer, levelId);
  const empty = isLevelEmpty(info);
  const expandResult = fingerprintLevelViaExpand(romBuffer, levelId);

  return {
    fingerprints: expandResult.fingerprints,
    screenRows: expandResult.screens,
    levelInfo: info,
    empty: empty || expandResult.fingerprints.length === 0,
    source: 'expand',
  };
}

function scoreLevels(romBuffer, levelIds, corpusPath, fsModule) {
  const corpus = loadFingerprintCorpus(corpusPath, fsModule);
  const corpusScreens = prepareScreens(corpus.map((e) => e.fingerprint));
  const allPrepared = [];
  const infos = [];

  for (const levelId of levelIds) {
    const built = buildLevelFingerprints(romBuffer, levelId);
    allPrepared.push(prepareScreens(built.fingerprints));
    infos.push(built.levelInfo);
  }

  const internalScores = scoreAllInternalPrepared(allPrepared);

  return levelIds.map((levelId, idx) => ({
    levelnumber: String(levelId).replace(/^0x/i, '').toUpperCase().padStart(3, '0'),
    scores: {
      originality: scoreOriginalityPrepared(allPrepared[idx], corpusScreens),
      internalSimilarity: internalScores[idx],
      completeness: scoreCompleteness(infos[idx]),
    },
    sources: ['jitscore'],
  }));
}

module.exports = {
  MIN_SCREEN_DENSITY,
  fingerprintScreenV1,
  fingerprintScreenV2,
  compareFingerprintsV1,
  compareFingerprints,
  hammingPercent,
  parseFingerprintUint16,
  prepareScreen,
  prepareScreens,
  fingerprintDensity,
  fingerprintDiversity,
  screenInterestWeight,
  loadFingerprintCorpus,
  scoreOriginality,
  scoreInternalSimilarity,
  scoreCompleteness,
  buildLevelFingerprints,
  scoreLevels,
  screenShapeForMode,
  isLevelEmpty,
  parseFingerprintTiles,
};
