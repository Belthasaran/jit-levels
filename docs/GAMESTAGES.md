GAMESTAGES
  Database records of the gamestages table in the rhdata.db
  Manually created records (sometimes with the help of tools) used
  to record details about the stages in a game

VERSION 1   .CSV Format Columns  (For Data Interchange)

stage_uuid,gameid,levelnumber,levelname,versions,submapid,translevel_13bf,tile_x,tile_y,tile_value,requisites,playable,rando,difficulty,mainexit,keyhole,credits,ghouse,spalace,castle,water,boss,secret,troll,final,lock,playlevel_patch_code,excluded_patchcodes,stagetags,rhpakuuid,extradescription

EXAMPLE:

``
"stage_uuid","gameid","levelnumber","levelname","versions","submapid","translevel_13bf","tile_x","tile_y","tile_value","requisites","playable","rando","difficulty","mainexit","keyhole","credits","ghouse","spalace","castle","water","boss","secret","troll","final","lock","playlevel_patch_code","excluded_patchcodes","stagetags","rhpakuuid","extradescription"

"8c813c4a5e71c6a3a0a36497ae13bd1e","16059","001","Mystery Stage","*","","01","","","","infliv","0","0","10","0","0","0","0","0","0","0","0","0","0","0","0","1lvno","","","",""
"e19982aa50a3d374d64da4caf2dcfdad","16059","002","The River Dyx","*","","02","","","","pall,infliv","1","1","5","1","0","0","0","0","0","0","0","0","0","0","0","1lvno","","","",""
"c11fcea676c6d35109b86e82757d8cd5","16059","003","Extra Special Stage","*","","03","","","","infliv","1","0","0","1","0","0","1","0","0","0","0","0","0","0","0","1lvno","","","",""
"f31692a3d3e85c45ea1499a526690d1d","16059","004","Aneha's House","*","","04","","","","infliv","1","1","5","1","0","0","1","0","0","0","0","0","0","0","0","1lvno","","","",""
"998de6b0d13a7dc23ed3a6d981980fbc","16059","007","#2 MORTON'S CASTLE","*","","07","","","","infliv","1","1","6","1","0","0","0","0","1","0","0","0","0","0","0","1lvno","","","",""
"4d4101e6d07973675f3e2232d77e6659","16059","009","Cerulean Cave","*","","09","","","","infliv","1","1","5","1","0","0","0","0","0","0","0","0","0","0","0","1lvno","","","",""
"c7bce2490bd1a179686fe8fdf1faaa43","16059","011","Dead Sea","*","","11","","","","infliv","1","1","5","1","0","0","0","0","0","1","0","0","0","0","0","1lvno","","","",""
"792b9aa78a5d948865344f880e3b8c57","16059","013","DONUT SECRET HOUSE","*","","13","","","","infliv","1","1","5","1","0","0","1","0","0","0","0","0","0","0","0","1lvno","","","",""

``


CSV Rules:
- Values of type 1 or 0; Must be 1 or 0 and must not be blank.
- stage_uuid may be blank (empty string) if a UUID is not yet assigned.
- playlevel_patch_code should be set to 2lvno in generl.  Older entries used 1lvno.  New level selectors may be introduced later; for example, Storks Apes and Crocodiles already uses a custom level selector named storkslv.
- Gameid must have a string value; it cannot be blank.
- Levelname MUST have a string value it cannot be blank.  Unknown levels start with a levelname of "-", and may have a comment after the.   Levelname should be less than 19 characters.
- rhpakuuid should generally be blank (empty string).

LEVEL DESCRIPTION RECORDS
-----------------------------
- stage_uuid=stage uuid
- levelnumber=Lunar magic level number
- levelname
- versions (Set to * or string with comma-separated list of match conditions)
- submapid=Optional Submap ID  or empty string
- translevel_13bf=Translevel number (Calculated from levelnumber)
- tile_x=overworld tile X coordinate  (or empty string)
- tile_y=overworld tile Y coordinate  (or empty string)
- tile_value=overworld tile value  (or empty string)
- requisites=Requisite patches to pick level  (String cmma separated - for example "pall,infliv" or empty string)
- playable=1 or 0 (Yes or no)  cannot be blank
- rando=1 or 0 (Yes or no: Level suitable to be picked for random runs) cannot be blank
- difficulty=Difficulty 0 to 10. Integers only. Below 1 is non-playable.  Above 7 is non-playable.
Kaizo beginner is 3, w/simple tutorial levels at 2. 5 is Master; 6 is Grandmaster; 7 is TAS-Only.
- mainexit=1 or 0 (Yes or no: Level has a main exit or goal)
- keyhole=1 or 0 (Has a keyhole exit or 2nd goal)
- credits=1 or 0 (Credits-onyl level)
- ghouse=1 or 0 (Ghost-house level)
- spalace=1 or 0 (Switch palace)
- castle=1 or 0 (Castle level)
- boss=1 or 0 (Boss level)
- secret=1 or 0 (Secret: Hide level name)
- troll=1 or 0 (Troll level)
- final=1 or 0 (Final or end game level of a hack)
- lock=1 or 0 (Lock: Prevent manually choosing the level)
- playlevel_patch_code=text (String name of the patchcode used for level selection)
- excluded_patchcodes=text (Patchcodes or tags incompatible with this level; String comma-separated list)
- rhpakuuid=uuid (text UUID of a loaded RHPAK file that imported this stage record)
- extradescription=Text Human-readable extra notes about the level
- water=1 or 0 (Is a water level)

TEST STATUS (Stage Test dialog, Edit mode)
-------------------------------------------
- test_status=`accept`, `reject`, or `hard_reject` when a level passes or fails stage testing; NULL if untested or "No Action"
- test_status_at=Unix timestamp when test_status was last set
- test_verified_levelnumber, test_verified_playlevel_patch_code, test_verified_requisites=snapshots of patch config at test time; used to invalidate status when levelnumber, playlevel patch, or requisites change

In the Game Stages table, the Lev# column shows a green checkmark when `test_status=accept` and snapshots still match the current row, a red X for `reject`, or a double-X for `hard_reject` under the same conditions (Edit, select, and view modes).

Stage feedback (`clientdata.stage_feedback`) also records `feedback_source` (`prepare_run` or `stage_test`), optional `test_result` (`accept`, `reject`, `hard_reject`, `no_action`), `tag_feedback` JSON, and `stage_uuid`. Rows are unique per `(gameid, levelnumber, playlevel_patchcode)` triplet; newer feedback supersedes older rows for the same triplet. User `test_result` in `stage_feedback` overrides `gamestages.test_status` for random-stage filtering on that triplet. Each feedback save appends a JSON line to `{userData}/stage_feedback.txt`.

Random stage selection (Prepare Run → Stage Limits):
- **Include untested stages** (default off): post-2026-06-13 stages without test status may appear when checked.
- **Untested stages only**: restrict pool to untested stages.
- Stages with `test_status=reject` or `hard_reject`, or user feedback `reject`/`hard_reject` on the triplet, are always excluded.
- Pre-2026-06-13 stages with `playable=1` and difficulty 2–7 are treated as passed without explicit test status.

Stage feedback approval (RHServer)
----------------------------------
Approved feedback can produce a `gamestages_patch_v1` file (Accept / no_action / Reject field matrix). Apply with `jstools/apply_gamestages_patch.js`, or merge into a Draft IUPDATE. The server must already know the game (`result_sha224`); Accept may create a stage that was only on the client. See `devdocs/STAGE_FEEDBACK_SYNC.md`.

Interim updates / RHPAK import
------------------------------
`gamestages` are first-class update payload on `game_upsert` skeletons. Empty `gamestages: []` in updategames-authored packages only means stages were not authored yet—not that stages are unsupported.

On interim apply (`applyInterimGameUpsert` / `upsertGamestages`):

- All stage columns round-trip, including `stagetags`, `tile_value`, and official `test_status` / `test_status_at` / `test_verified_*` (central “Tested” for Prepare Run filters).
- Upsert is **per `stage_uuid` merge** (additive). Local rows with a strictly newer `updated_at` (or `test_status_at`) than the package are **not** overwritten.
- Stages absent from the package are **not** deleted.

Export stages from a provisioned client DB for packaging into iupdates:

```bash
RHDATA_DB_PATH=/path/to/rhdata.db ./enode.sh jstools/export_gamestages.js --gameid 12345 --out stages.json
# or: --out-dir ./stages_export
```

Attach the resulting array as `gamestages` on `contents/<gameid>.json` before finalize.


