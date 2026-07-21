'use strict';

/**
 * Shared Detected Levels / stagemaker filter helpers (CJS for Node/CLI).
 * Vue renderer uses ESM copy: electron/renderer/src/utils/detected-level-filters.js
 * (Vite cannot default-import this module.exports object). Keep both in sync.
 */

const PIPE_KEYWORD_RE = /\b(pipe|tube|warp|portal|teleport|gateway|transport)\b/i;
const END_KEYWORD_PATTERNS = [
  /\bcredits?\b/i,
  /\bthe\s+end\b/i,
  /\bthanks?\b.*\bplaying\b/i,
  /\bstaff\s*roll\b/i,
  /^\s*ending\s*$/i,
  /^\s*outro\s*$/i,
  /^\s*game\s*over\s*$/i,
];

/** Default completeness floor (LowCompleteness exclude). */
const DEFAULT_MIN_COMPLETENESS = 10;
/** Default originality floor (LowOriginality exclude). */
const DEFAULT_MIN_ORIGINALITY = 15;

/** Clamp a score threshold to 0–99; invalid → fallback. */
function clampScoreThreshold(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(99, Math.floor(n)));
}

function isPipeKeywordName(name) {
  const t = (name == null ? '' : String(name)).trim();
  return t !== '' && PIPE_KEYWORD_RE.test(t);
}

function isEndKeywordName(name) {
  const t = (name == null ? '' : String(name)).trim();
  return t !== '' && END_KEYWORD_PATTERNS.some((re) => re.test(t));
}

function isBlankCoord(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  return s === '';
}

/**
 * True when JIT.Trans populated Submap, X, and Y (usable OW placement).
 * Prefers LevelNumberMap; also accepts any non-blank triad of coords.
 * DB Trans alone without coords does not count.
 */
function hasJitTransCoords(level) {
  if (!level) return false;
  if (level.trans_source === 'levelnumbermap') {
    return !isBlankCoord(level.submapid)
      && !isBlankCoord(level.tile_x)
      && !isBlankCoord(level.tile_y);
  }
  const sources = Array.isArray(level.sources) ? level.sources : [];
  if (!sources.includes('jittrans')) return false;
  return !isBlankCoord(level.submapid)
    && !isBlankCoord(level.tile_x)
    && !isBlankCoord(level.tile_y);
}

/**
 * Normalize CLI/UI source keys to orchestrator source tags.
 * Accepts JITNames2, JIT.Trans, jittrans, etc.
 */
function normalizeSourceKey(key) {
  const k = String(key || '').trim().toLowerCase().replace(/\./g, '');
  const map = {
    lmlevels: 'lmlevels',
    detect: 'detect',
    trans: 'trans',
    levelnames: 'levelnames',
    jitnames: 'jitnames',
    jitnames2: 'jitnames2',
    jittrans: 'jittrans',
    jitlmfilter: 'jitlmfilter',
    jitlevelinfo: 'jitlevelinfo',
    jitscore: 'jitscore',
    jitmt: 'jitmt',
    jitow: 'jitow',
  };
  return map[k] || null;
}

/**
 * @param {object} level - detected level row
 * @param {object} opts
 * @param {Record<string, boolean>} opts.enabledSources - source tag → visible
 * @param {number} opts.minSourceCount
 * @param {string} [opts.displayName] - name used for pipe/end filters
 * @param {boolean} [opts.excludePipeKeywords]
 * @param {boolean} [opts.excludeEndKeywords]
 * @param {boolean} [opts.excludeMt]
 * @param {boolean} [opts.excludeNonLm]
 * @param {boolean} [opts.hasLmSourceData] - required for excludeNonLm to activate
 * @param {boolean} [opts.excludeLowCompleteness]
 * @param {boolean} [opts.excludeLowOriginality]
 * @param {boolean} [opts.excludeNoJitTrans]
 * @param {number} [opts.minCompleteness]
 * @param {number} [opts.minOriginality]
 * @returns {boolean} true if level should be kept
 */
function passesDetectedLevelFilters(level, opts = {}) {
  const enabled = opts.enabledSources || {};
  const sources = Array.isArray(level.sources) ? level.sources : [];
  const visibleSources = sources.filter((s) => enabled[s] === true);

  if (visibleSources.length === 0) return false;
  const minSources = Number(opts.minSourceCount);
  if (Number.isFinite(minSources) && visibleSources.length < minSources) return false;

  if (opts.excludeMt && !level.mtIncluded) return false;

  const name = opts.displayName != null
    ? opts.displayName
    : (level.levelnameJitnames2 || level.levelnameJitnames || level.levelname || '');
  if (opts.excludePipeKeywords && (isPipeKeywordName(name) || level.mtIsPipe === true)) return false;
  if (opts.excludeEndKeywords && isEndKeywordName(name)) return false;

  if (opts.excludeNonLm && opts.hasLmSourceData) {
    const inLm = sources.includes('lmlevels') || sources.includes('jitlmfilter');
    if (!inLm) return false;
  }

  const minComp = clampScoreThreshold(opts.minCompleteness, DEFAULT_MIN_COMPLETENESS);
  const minOrig = clampScoreThreshold(opts.minOriginality, DEFAULT_MIN_ORIGINALITY);

  if (opts.excludeLowCompleteness) {
    const c = level.scores && level.scores.completeness;
    if (c == null || c < minComp) return false;
  }
  if (opts.excludeLowOriginality) {
    const o = level.scores && level.scores.originality;
    if (o != null && o < minOrig) return false;
  }

  if (opts.excludeNoJitTrans && !hasJitTransCoords(level)) return false;

  return true;
}

/** Default UI source checkbox map (Detected Levels dialog startup). */
function defaultShowSources() {
  return {
    lmlevels: false,
    detect: false,
    trans: false,
    levelnames: false,
    jitnames: false,
    jitnames2: true,
    jittrans: true,
    jitlmfilter: false,
    jitlevelinfo: true,
    jitscore: true,
    jitmt: false,
    jitow: false,
  };
}

module.exports = {
  PIPE_KEYWORD_RE,
  END_KEYWORD_PATTERNS,
  DEFAULT_MIN_COMPLETENESS,
  DEFAULT_MIN_ORIGINALITY,
  clampScoreThreshold,
  isPipeKeywordName,
  isEndKeywordName,
  isBlankCoord,
  hasJitTransCoords,
  normalizeSourceKey,
  passesDetectedLevelFilters,
  defaultShowSources,
};
