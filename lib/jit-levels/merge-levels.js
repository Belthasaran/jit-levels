/**
 * Merge detected level entries by levelnumber across sources.
 */

function emptyLevel(levelnumber) {
  return {
    levelnumber,
    levelname: null,
    levelnameJitnames: null,
    levelnameJitnames2: null,
    translevel: null,
    submapid: null,
    tile_x: null,
    tile_y: null,
    tile_value: null,
    trans_source: null,
    location_count: null,
    sources: [],
    sourceCount: 0,
    mtIncluded: false,
    mtIsPipe: false,
    mtIsVanillaName: false,
    levelInfo: null,
    scores: null,
    suggestedTags: null,
  };
}

const STAGE_DEFAULT_FIELDS = [
  'water', 'ghouse', 'spalace', 'castle', 'boss',
  'mainexit', 'keyhole', 'credits', 'stagetags', 'extradescription', 'difficulty',
];

function addSource(level, sourceTag, patch) {
  if (!level.sources.includes(sourceTag)) {
    level.sources.push(sourceTag);
    level.sourceCount++;
  }
  if (patch) {
    if (patch.levelname && !level.levelname) level.levelname = patch.levelname;
    if (patch.levelnameJitnames) level.levelnameJitnames = patch.levelnameJitnames;
    if (patch.levelnameJitnames2) level.levelnameJitnames2 = patch.levelnameJitnames2;
    if (sourceTag === 'jitnames' && patch.levelname) {
      level.levelnameJitnames = patch.levelname;
    }
    if (sourceTag === 'jitnames2' && (patch.levelnameJitnames2 || patch.levelname)) {
      level.levelnameJitnames2 = patch.levelnameJitnames2 || patch.levelname;
    }
    if (patch.mtIncluded === true) level.mtIncluded = true;
    if (patch.mtIsPipe === true) level.mtIsPipe = true;
    if (patch.mtIsVanillaName === true) level.mtIsVanillaName = true;
    if (patch.translevel && !level.translevel) level.translevel = patch.translevel;
    // Prefer Lunar Magic LevelNumberMap coords over stale DB/tilemap values.
    const preferLnm = patch.trans_source === 'levelnumbermap';
    if (preferLnm) {
      if (patch.submapid != null) level.submapid = patch.submapid;
      if (patch.tile_x != null) level.tile_x = patch.tile_x;
      if (patch.tile_y != null) level.tile_y = patch.tile_y;
      level.tile_value = null; // LNM path never carries vanilla gfx tile ids
      level.trans_source = 'levelnumbermap';
      if (patch.location_count != null) level.location_count = patch.location_count;
    } else {
      if (patch.submapid != null && level.submapid == null) level.submapid = patch.submapid;
      if (patch.tile_x != null && level.tile_x == null) level.tile_x = patch.tile_x;
      if (patch.tile_y != null && level.tile_y == null) level.tile_y = patch.tile_y;
      if (patch.tile_value != null && level.tile_value == null) level.tile_value = patch.tile_value;
      if (patch.trans_source && !level.trans_source) level.trans_source = patch.trans_source;
      if (patch.location_count != null && level.location_count == null) {
        level.location_count = patch.location_count;
      }
    }
    if (patch.levelInfo) level.levelInfo = patch.levelInfo;
    if (patch.scores) level.scores = { ...(level.scores || {}), ...patch.scores };
    if (patch.suggestedTags) {
      const existing = new Set(level.suggestedTags || []);
      for (const t of patch.suggestedTags) existing.add(t);
      level.suggestedTags = [...existing];
    }
    for (const key of STAGE_DEFAULT_FIELDS) {
      if (sourceTag === 'jitlevelinfo' && patch[key] !== undefined) {
        level[key] = patch[key];
      } else if (patch[key] != null && level[key] == null) {
        level[key] = patch[key];
      }
    }
  }
}

function mergeDetectedLevels(sourceLists) {
  const map = new Map();

  for (const list of sourceLists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry?.levelnumber) continue;
      const key = entry.levelnumber.toUpperCase().padStart(3, '0');
      if (!map.has(key)) {
        map.set(key, emptyLevel(key));
      }
      const level = map.get(key);
      const tags = entry.sources || [entry.source].filter(Boolean);
      for (const src of tags) {
        addSource(level, src, entry);
      }
    }
  }

  return [...map.values()].sort((a, b) => parseInt(a.levelnumber, 16) - parseInt(b.levelnumber, 16));
}

module.exports = {
  emptyLevel,
  addSource,
  mergeDetectedLevels,
};
