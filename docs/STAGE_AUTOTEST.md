# Stage Automated Testing (RetroArch + SNI)

Automated stage verification launches a patched ROM in RetroArch, drives inputs over the network RetroPad interface, reads SMW RAM through SNI/USB2SNES, and writes structured pass/fail logs.

## Entry points

| Entry | Location |
|-------|----------|
| **Edit Stages UI** | Per-row **Auto Test** button (🤖) in `GameStagesDialog` → `StageAutoTestDialog` |
| **CLI** | `./enode.sh jstools/stage_autotest.js --gameid ID --levelnumber HEX` |
| **IPC** | `stage-autotest:run`, `stage-autotest:cancel`, `stage-autotest:get-config`, `stage-autotest:save-config` |

## Architecture

```
UI / CLI
  → stage-autotest-service (Electron main)
    → lib/stage-autotest/runner.js (7 phases)
      → RetroArchBackend (default) or BizHawkBackend (stub)
        → game-stager buildPlusPatchedGame
        → launchProgram (RetroArch + append.cfg)
        → SNI RAM read/write (SNESWrapper)
        → UDP NCI (55355) — QUIT, lifecycle
        → UDP RetroPad (55400) — A/B/Start/d-pad
```

### RetroArch control split

| Mechanism | Port | Purpose |
|-----------|------|---------|
| Network Control Interface (NCI) | 55355 | QUIT, PAUSE, FRAMEADVANCE — **not** gamepad buttons |
| Network RetroPad | 55400+ | Timed button presses for navigation |
| SNI / USB2SNES | 23074 | RAM: game mode, `$13BF`, Mario Y, level flags |

`electron/append.cfg.template` enables both NCI and network RetroPad. The runner merges retropad keys into a test overlay at `{userData}/stage-autotest/append-autotest.cfg` without overwriting the user's main append.cfg.

## Test phases

1. **Build** — `buildPlusPatchedGame` with playlevel patch, requisites, and `glevelnum`.
2. **Launch** — Start SNI (if configured), launch RetroArch with bsnes-mercury core, then connect USB2SNES/SNI (retries until a device appears — the emulator must load the ROM first).
3. **Boot** — Poll `$7E0100` until title screen is cleared or overworld/level reached.
4. **Navigate** — ~30s of Start/A/d-pad via RetroPad UDP.
5. **Verify level** — `$7E13BF` translevel and game mode `0x14` (in level).
6. **Flags** — Compare live RAM flags to `gamestages` columns; JIT `parseLevelInfo` fallback when stage flags are empty (warnings only).
7. **Fail/retry** — Write Mario Y below ground, press A ~15s, confirm same `$13BF` after death/retry.
8. **Log** — Structured `.log` + companion `.json` under `{userData}/stage-autotest/logs/`.

Hard failures: wrong level, boot timeout, emulator exit, retry instability. Flag mismatches are logged as warnings.

## Configuration

Auto-created on first use:

`{userData}/stage-autotest/tester_config.json`

```json
{
  "backend": "retroarch",
  "headless": false,
  "retroarch": {
    "useAppSettings": true,
    "nciPort": 55355,
    "retropadPort": 55400,
    "appendNetworkRetropad": true
  },
  "sni": {
    "autoStart": true,
    "wsAddress": "ws://localhost:23074"
  },
  "timeoutsSec": {
    "boot": 60,
    "navigate": 45,
    "retryObserve": 20,
    "freezeDetect": 8
  },
  "inputPlan": {
    "titleSkipStartMs": [2000, 4000],
    "enterGameStartMs": [6000, 8000],
    "navigateWindowMs": 30000,
    "retryPressWindowMs": 15000,
    "buttonIntervalMs": 500
  },
  "logging": {
    "logDir": "{userData}/stage-autotest/logs"
  },
  "onPassUpdateTestStatus": false
}
```

RetroArch paths resolve from app settings when `retroarch.useAppSettings` is true (`launchProgram`, bsnes-mercury core discovery via `lib/emulator-paths.js`).

USB2SNES library, address, proxy, and SSH options resolve from app **Settings** (`usb2snesLibrary`, `usb2snesAddress`, etc.) and take precedence over `tester_config.json` `sni.library`. The config `sni.library` is only a fallback when app settings are unset.

### Headless mode

Set `headless: true` or pass `--headless` on the CLI. The runner merges null video/audio drivers into the autotest append overlay. Headless RetroArch is best-effort on Linux AppImage; prefer interactive mode when debugging navigation.

### Optional flags

- `skipOverworldNavigation` — Skip overworld d-pad sweeps (for hacks that force level entry via playlevel).
- `onPassUpdateTestStatus` — Reserved; when enabled in a future release, will set `gamestages.test_status` to `accept` on PASS (requires edit permission).

## RAM addresses

| Field | SNES addr | Notes |
|-------|-----------|-------|
| Game mode | `$7E0100` | `0x14` = in level |
| Translevel | `$7E13BF` | Compared to `stage.translevel_13bf` |
| Level high bit | `$7E19D8` bit 0 | Full level ID |
| Water | `$7E0085` | |
| Slippery | `$7E0086` | |
| In normal level | `$7E0D9B` | |
| Mario X/Y | `$7E0094`–`97` | Death test Y write |
| Run game | `$7E0010` | Freeze detection helper |

## Logs

Example log path:

`{userData}/stage-autotest/logs/{gameid}_v{version}_{levelnumber}_{timestamp}.log`

Sections include phase status, estimated flags from RAM, expected flags from gamestages/JIT, and a failures block.

## CLI

```bash
export RHDATA_DB_PATH=/path/to/rhdata.db
export CLIENTDATA_DB_PATH=/path/to/clientdata.db
./enode.sh jstools/stage_autotest.js --gameid 12345 --levelnumber 106 [--headless] [--help]
```

Exit code 0 on PASS, 1 on FAIL.

## BizHawk backend

`lib/stage-autotest/backends/bizhawk.js` is a stub (`not implemented`). Future work will wrap `pytools/smw_headless_test.py`.

## Module layout

| Path | Role |
|------|------|
| `lib/stage-autotest/config.js` | Load/merge defaults; auto-create config |
| `lib/stage-autotest/runner.js` | Phase state machine |
| `lib/stage-autotest/log-writer.js` | Structured log + JSON summary |
| `lib/stage-autotest/backends/retroarch.js` | RetroArch + SNI + NCI + RetroPad |
| `lib/stage-autotest/smw-ram-snapshot.js` | Batch RAM read |
| `lib/stage-autotest/expected-flags.js` | gamestages + JIT expectations |
| `electron/stage-autotest-service.js` | Main-process wiring |

## Tests

```bash
npm run test:stage-autotest
```

Individual suites: `test:stage-autotest-config`, `test:stage-autotest-runner`, `test:retroarch-nci`, `test:smw-ram-snapshot`.

## Known limitations

- Network RetroPad may require repeated UDP packets while a button is held (RetroArch #12611); the client sends on each interval.
- Playlevel patch may enter the level before navigation completes; early `$13BF` match with mode `0x14` is treated as success.
- SNI attachment to RetroArch can lag after launch; the runner connects **after** RetroArch starts and retries `fullConnect` for up to `timeoutsSec.sniConnect` (default 30s).
