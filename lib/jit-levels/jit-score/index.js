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

function compareFingerprints(fpA, fpB) {
  const a = parseFingerprintTiles(fpA);
  const b = parseFingerprintTiles(fpB);
  if (!a || !b || a.version === 'empty' || b.version === 'empty') return 100;
  if (a.version !== b.version) return 100;
  const pairs = Math.max(a.tiles.length, b.tiles.length, 1);
  let diff = 0;
  for (let i = 0; i < pairs; i++) {
    const ta = a.tiles[i] ?? 0;
    const tb = b.tiles[i] ?? 0;
    if (ta !== tb) diff++;
  }
  return Math.round((diff / pairs) * 100);
}

/** Alias used by older tests */
function compareFingerprintsV1(fpA, fpB) {
  return compareFingerprints(fpA, fpB);
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
 * Originality: min Hamming distance vs corpus (0 = identical to a known level).
 * Empty levels → 0. Missing corpus → null (unscored).
 */
function scoreOriginality(fingerprints, corpus) {
  const content = (fingerprints || []).filter(
    (fp) => fp && fp !== 'empty' && (fp.startsWith('v1:') || fp.startsWith('v2:'))
  );
  if (!content.length) return 0;
  if (!corpus || !corpus.length) return null;

  let minDiff = 100;
  for (const fp of content) {
    for (const entry of corpus) {
      const diff = compareFingerprints(fp, entry.fingerprint);
      minDiff = Math.min(minDiff, diff);
    }
  }
  return minDiff;
}

function scoreInternalSimilarity(allLevelFps, levelIndex) {
  const mine = (allLevelFps[levelIndex] || []).filter(
    (fp) => fp && fp !== 'empty' && (fp.startsWith('v1:') || fp.startsWith('v2:'))
  );
  if (mine.length === 0) return 0;
  let minDiff = 100;
  let compared = false;
  for (let j = 0; j < allLevelFps.length; j++) {
    if (j === levelIndex) continue;
    const other = (allLevelFps[j] || []).filter(
      (fp) => fp && fp !== 'empty' && (fp.startsWith('v1:') || fp.startsWith('v2:'))
    );
    for (const fpA of mine) {
      for (const fpB of other) {
        compared = true;
        minDiff = Math.min(minDiff, compareFingerprints(fpA, fpB));
      }
    }
  }
  return compared ? minDiff : 100;
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
  const allFps = [];
  const infos = [];

  for (const levelId of levelIds) {
    const built = buildLevelFingerprints(romBuffer, levelId);
    allFps.push(built.fingerprints);
    infos.push(built.levelInfo);
  }

  return levelIds.map((levelId, idx) => ({
    levelnumber: String(levelId).replace(/^0x/i, '').toUpperCase().padStart(3, '0'),
    scores: {
      originality: scoreOriginality(allFps[idx], corpus),
      internalSimilarity: scoreInternalSimilarity(allFps, idx),
      completeness: scoreCompleteness(infos[idx]),
    },
    sources: ['jitscore'],
  }));
}

module.exports = {
  fingerprintScreenV1,
  fingerprintScreenV2,
  compareFingerprintsV1,
  compareFingerprints,
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
