# lmauto — Lunar Magic GUI export automation

Automate Lunar Magic under Wine to produce **Export Multiple Levels to Image Files**
fixtures (and later other GUI-only exports). Image export has no stock LM CLI; this
driver uses Win32 `WM_COMMAND` IDs from LM_INTEROP notes.

## Layout

| Path | Role |
|------|------|
| `lm361.exe` / `lm363.exe` | Staged Lunar Magic binaries |
| `node-win-x64/node.exe` | Windows Node for Win32 automation under Wine |
| `host/run_lmauto.sh` | Linux entry: headered temp ROM → Wine LM → Wine Node |
| `bin/lmauto_export.js` | Guest CLI (must run as win32 Node) |
| `lib/` | WM catalog, profiles, rom prepare, koffi Win32, dialogs |
| `tests/` | Unit tests (no Wine); optional integration smoke |

## Prerequisites

- `wine`, X display (`DISPLAY=:99` + Xvfb is typical)
- Wine prefix (default `$HOME/.wine_lm_auto`)
- `node-win-x64/node.exe` present under this directory
- `npm install` in `lmauto/` once (installs `koffi` with win32 prebuilds)

## Usage

```bash
# From repo root or lmauto/
./lmlevelinfo/lmauto/host/run_lmauto.sh \
  --rom=lmlevelinfo/test/akogare/orig_Ako.sfc \
  --profile=l1only_nogrid \
  --out=/tmp/ako_l1_nogrid

./lmlevelinfo/lmauto/host/run_lmauto.sh --help
```

Profiles (View menu → then File → Levels → Export Multiple Levels to Image Files):

| Profile | Layers on | Tile grid | Filename prefix |
|---------|-----------|-----------|-----------------|
| `l1only_nogrid` | L1 | off | `lmlevel_l1only_nogrid ` |
| `l1only_gridlines` | L1 | on | `lmlevel_l1only_gridlines ` |
| `l2only_gridlines` | L2 | on | `lmlevel_l2only_gridlines ` |
| `l3only_gridlines` | L3 | on | `lmlevel_l3only_gridlines ` |
| `spritesonly_gridlines` | Sprites | on | `lmlevel_spritesonly_gridlines ` |
| `l1l2only_gridlines` | L1+L2 | on | `lmlevel_l1l2only_gridlines ` |

Suite harvest (BPS→SFC→Map16/GFX→all profiles): [`../test/get_hack.sh`](../test/get_hack.sh).

Always: Animation **off** + **Reset**, Zoom **100%**, Level Entrances and other
overlays **off**. Dialog 1027 defaults: **Only modified levels** ON (use
`--all-levels` to export all 0x200), Auto-Set Screens OFF.

LM appends the level hex id after the prefix (space preserved), matching
`lmlevelinfo/test/` fixture names.

## Environment

| Variable | Default |
|----------|---------|
| `LMAUTO_LM` | `lmauto/lm363.exe` |
| `LMAUTO_WINEPREFIX` | `$HOME/.wine_lm_auto` |
| `LMAUTO_NODE` | `lmauto/node-win-x64/node.exe` |
| `WINE` | `wine` |
| `DISPLAY` | `:99` |
| `LMAUTO_KEEP_WORKDIR` | unset (delete temp workdir) |

## Tests

```bash
./lmlevelinfo/lmauto/tests/run_all.sh
# or: ./enode.sh lmlevelinfo/lmauto/tests/run_all.js

# Opt-in Wine smoke (needs ROM + display):
LMAUTO_INTEGRATION=1 LMAUTO_SMOKE_ROM=lmlevelinfo/test/akogare/orig_Ako.sfc \
  ./lmlevelinfo/lmauto/tests/run_all.sh
```

## Docs

- WM IDs: `lminterop/artifacts_in/lunarnotes2.md`
- Export pixel contract: `lminterop/devdocs/LM_EXPORT_LEVEL_IMAGE_SPEC.md`
- Automation notes: `lminterop/devdocs/LM_GUI_AUTO_EXPORT.md`
