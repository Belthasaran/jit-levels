# Stage Auto Test — Mk2 Verification & Completion Plan

**Date**: June 2026  
**Status**: 🚧 **In progress** (Milestone 1 scaffold shipped; end-to-end PASS not yet proven on real ROMs)  
**User doc**: [`docs/STAGE_AUTOTEST.md`](../docs/STAGE_AUTOTEST.md)  
**Original design**: `.cursor/plans/stage_auto_test_system_dfe4f959.plan.md` (reference only; do not edit)

---

## Overview

Milestone 1 added a **RetroArch + SNI/USB2SNES + Network RetroPad** automated stage test framework: build patched ROM, launch emulator, drive inputs, read RAM, compare level ID and flags, death/retry stability, structured logs. CLI and Edit Stages UI entry points exist.

**Mk2 goal**: systematically **verify** each layer on real hardware, fix integration bugs found in manual runs, and reach **reliable PASS/FAIL** on a defined test matrix — without expanding scope to BizHawk or Python headless yet.

---

## What Milestone 1 Delivered

### Core library (`lib/stage-autotest/`)

| Module | Purpose | Status |
|--------|---------|--------|
| `config.js` | Auto-create `{userData}/stage-autotest/tester_config.json`, merge overrides | ✅ |
| `runner.js` | Monolithic 7-phase state machine (build → launch → boot → navigate → verify → flags → retry → log) | ✅ scaffold |
| `log-writer.js` | `.log` + companion `.json` summary | ✅ |
| `build-stage-rom.js` | `buildPlusPatchedGame` + playlevel/requisites/`glevelnum` | ✅ |
| `utils.js` | Translevel resolve, `buildUsb2snesConnectOptions()` (app Settings first) | ✅ |
| `smw-ram-snapshot.js` | Batch RAM read: mode, `$13BF`, `$19D8`, flags, Mario XY, `run_game`, frame counter | ✅ |
| `expected-flags.js` | gamestages columns + JIT `parseLevelInfo` fallback | ✅ |
| `retroarch-nci.js` | UDP NCI client (55355): QUIT, etc. | ✅ |
| `retroarch-retropad.js` | UDP RetroPad client (55400), hold workaround (#12611) | ✅ |
| `append-config-merge.js` | Merge network retropad + headless keys into autotest overlay | ✅ |
| `backends/retroarch.js` | RetroArch launch, SNI connect-after-launch retry, RAM R/W | ✅ (recent fixes) |
| `backends/bizhawk.js` | Stub — throws `not implemented` | ⏸ deferred |

**Note**: Original plan listed `phases/*.js` per phase; implementation uses a single `runner.js`. Mk2 may extract phases only if it aids testing — not required for PASS.

### Electron integration

| Piece | Status |
|-------|--------|
| `electron/stage-autotest-service.js` | ✅ Wires runner to DB, SNI, launch sessions |
| IPC `stage-autotest:run\|cancel\|get-config\|save-config` | ✅ |
| `electron/preload.js` + progress events | ✅ |
| `StageAutoTestDialog.vue` | ✅ Progress + result; shows JSON summary tail (not live `.log` file tail) |
| `GameStagesDialog.vue` 🤖 Auto Test button | ✅ |
| `electron/append.cfg.template` | ✅ NCI + network retropad keys |
| `SMWAddresses.js` | ✅ `TranslevelLo`, `LevelHighFlags`, `RunGame`, etc. |

### CLI & tests

| Piece | Status |
|-------|--------|
| `jstools/stage_autotest.js` | ✅ `--gameid`, `--levelnumber`, `--headless`, `--help` |
| `npm run test:stage-autotest` (unit tests) | ✅ Config, NCI format, RAM snapshot, mock runner |
| Wired into `test:ci` | ✅ |

### Docs

| Doc | Status |
|-----|--------|
| `docs/STAGE_AUTOTEST.md` | ✅ |
| `docs/PROGRAMS.MD` | ✅ CLI entry |
| `docs/CHANGELOG.md` | ✅ Brief entry |

---

## Architecture (RetroArch backend)

```
Entry (UI / CLI)
  → stage-autotest-service
    → runner.js
      → RetroArchBackend
          ├─ build-stage-rom → game-stager.buildPlusPatchedGame
          ├─ sniManager.start (optional)
          ├─ launchProgram (RetroArch + append-autotest.cfg overlay)
          ├─ SNESWrapper.fullConnect AFTER launch (retry, timeoutsSec.sniConnect)
          ├─ retroarch-retropad UDP → navigation / retry A presses
          ├─ retroarch-nci UDP → QUIT on shutdown
          └─ smw-ram-snapshot → GetAddresses batch read / PutAddress Mario Y
```

### Control-plane split (critical)

| Mechanism | Port | Role |
|-----------|------|------|
| **NCI** | 55355 | Process control only (QUIT). **Cannot** send gamepad buttons. |
| **Network RetroPad** | 55400+ | Start / A / d-pad for title, OW, retry |
| **SNI → USB2SNES** | 23074 (typical) | RAM read/write; device appears **after** core loads ROM |

---

## Manual Testing Findings (June 2026)

Two integration bugs were found running:

```bash
enode.sh jstools/stage_autotest.js --gameid 5988 --levelnumber 111
```

| Issue | Symptom | Fix applied |
|-------|---------|-------------|
| Wrong USB2SNES library | `Implementation 'qusb2snes' is not yet implemented` | `buildUsb2snesConnectOptions()` reads app `usb2snesLibrary`; config `sni.library` ignored when `retroarch.useAppSettings` (default) |
| Connect before emulator | `No devices found` — SNI DeviceList empty | Launch RetroArch first; `_connectSniAfterLaunch()` retries up to `timeoutsSec.sniConnect` (30s) |

**Still unverified on real ROMs after fixes**: full PASS through boot → navigate → verify → retry; RetroPad actually reaching the game; navigation on non-standard title/OW flows.

---

## Gap Analysis — Config vs Implementation

| Planned / configured | Implemented? | Mk2 action |
|---------------------|--------------|------------|
| 7-phase runner | ✅ All phases in `runner.js` | Verify each phase on real ROM |
| `timeoutsSec.sniConnect` | ✅ Used in `retroarch.js` | Tune default if 30s insufficient |
| `timeoutsSec.freezeDetect` | ❌ **Not used** | Implement freeze detection (`run_game` + frame counter stall) |
| `timeoutsSec.retryObserve` | ❌ Runner uses `inputPlan.retryPressWindowMs` only | Align or document; optionally wire `retryObserve` |
| Freeze / crash detect in boot/nav/retry | ❌ Partial (emulator exit only) | Add stall detector helper |
| `$19D8` level high bit in verify | ⚠️ Read in snapshot, not compared | Optional hard-fail if full level ID needed |
| `onPassUpdateTestStatus` | ❌ Config only | Wire to `saveStageFeedback` + `saveGameStage` on PASS (UI path) |
| Headless RetroArch | ⚠️ Overlay merge only | Manual verify Linux AppImage; document failures |
| Per-phase modules `phases/*.js` | ❌ Skipped | Keep monolithic unless refactor helps tests |
| Live log tail in UI | ❌ Shows JSON summary only | Optional: IPC tail or read log file |
| BizHawk backend | ❌ Stub | Out of mk2 scope |
| Input event timestamp logging | ⚠️ Phase counts only | Optional: log each retropad send |
| `skipOverworldNavigation` | ✅ Config + runner | Test on playlevel-only hacks |
| Emulator reconnect hook reuse | ⚠️ Custom connect-after-launch | Compare with `emulator-launch-hooks.ts` parity |

---

## Mk2 Phase A — Verification Checklist

Run these **in order**. Do not skip layers; failures at an early layer block later steps.

### A1. Environment preflight

- [ ] RetroArch path + bsnes-mercury core resolve (`Settings` → same as Quick Launch)
- [ ] `{userData}/append.cfg` contains `network_cmd_enable`, `network_remote_enable`, `network_remote_base_port=55400`
- [ ] SNI binary present under program data; port 23074 reachable
- [ ] App Settings: `usb2snesLibrary=usb2snes_a`, `usb2snesHostingMethod=sni`, address port 23074
- [ ] `tester_config.json` exists; confirm stale `sni.library: qusb2snes` does **not** override app settings
- [ ] Unit tests green: `npm run test:stage-autotest`

**Commands**

```bash
npm run test:stage-autotest
node tests/test_retroarch_append_config.js
```

### A2. Build-only smoke

- [ ] CLI builds ROM without launching (temporary: add `--build-only` flag **or** inspect log after failed launch for `build` phase PASS)
- [ ] Built ROM matches manual 🧪 Stage Test output path / patch identity hashes

### A3. Launch + SNI attach

- [ ] RetroArch window opens with correct patched ROM
- [ ] Log shows `launch` phase PASS
- [ ] Console shows `usb2snes_a` (not `qusb2snes`)
- [ ] `DeviceList` non-empty **after** core load; attach succeeds within `sniConnect` timeout
- [ ] Manual RAM read in app (USB2SNES panel) matches autotest snapshot addresses

**Failure modes to record**

| Symptom | Likely cause |
|---------|----------------|
| Launch PASS, then immediate FAIL | `sniConnect` too short; core slow; SNI not attached to RA core |
| RetroArch opens wrong core | `retroarch_core_path` / detection |
| Attach OK but RAM read fails | Wrong address map; core not exposing WRAM |

### A4. RetroPad input verification

- [ ] With RetroArch focused, send test inputs (temporary debug script or lengthen navigate window)
- [ ] Title screen advances on Start; A reaches file select / game
- [ ] Confirm overlay `append-autotest.cfg` includes retropad keys (not just base append.cfg)
- [ ] If inputs ignored: verify UDP 55400 not blocked; verify `network_remote_enable_user_p1`

**Optional debug helper (mk2 deliverable)**

Small script `jstools/stage_autotest_retropad_ping.js` — sends Start/A burst for 5s so operator can watch RetroArch react without full test.

### A5. RAM phase verification

For a **known-good** stage (playlevel enters level quickly, e.g. game 5988 level 111):

- [ ] Boot phase: `game_mode` leaves title (`0x00`–`0x03`)
- [ ] Verify phase: `game_mode=0x14`, `translevel_13bf` matches `gamestages.translevel_13bf`
- [ ] Flags section populated (warnings OK)
- [ ] Retry phase: Mario Y write → death → A presses → same `$13BF`

Capture log path from CLI output; attach to verification notes.

### A6. UI path parity

- [ ] Edit Stages 🤖 Auto Test on same stage as CLI
- [ ] Progress phases update in dialog
- [ ] Cancel mid-run stops emulator / does not leave orphan RetroArch
- [ ] PASS/FAIL matches CLI for same stage

### A7. Negative cases

- [ ] Wrong `levelnumber` / translevel → verify FAIL (mock runner already covers; confirm live)
- [ ] Kill RetroArch mid-test → fail with emulator exit message
- [ ] Stale `tester_config.json` with `backend: bizhawk` → clear error

---

## Mk2 Phase B — Completion Work Items

Prioritized to reach **working autotest** on RetroArch backend.

### B1. Critical fixes (blockers)

| ID | Task | Rationale |
|----|------|-----------|
| B1.1 | **Prove end-to-end PASS** on reference stage(s) after A3–A5 | Definition of done |
| B1.2 | **RetroPad verification** — confirm inputs affect game; fix overlay/port if not | Navigation cannot work without this |
| B1.3 | **Navigation tuning** for reference game(s) | Generic Start/A/OW sweep may be insufficient |
| B1.4 | **Playlevel-fast-path**: if `$13BF` + mode `0x14` before navigate window ends, skip redundant OW inputs | Plan risk mitigation; many stages force level |
| B1.5 | Align `docs/STAGE_AUTOTEST.md` config sample with `sniConnect` in `config.js` | Doc drift |

### B2. Robustness

| ID | Task | Details |
|----|------|---------|
| B2.1 | Implement **freeze detection** | Poll `run_game` + `frameCounter`; if unchanged for `freezeDetectSec`, fail with log note |
| B2.2 | Use **`retryObserve` timeout** or remove from config | Avoid dead config keys |
| B2.3 | **Death/retry logic**: wait for leave-level before expecting re-entry; detect game over (`0x16`) — partially present | Reduce false PASS/FAIL |
| B2.4 | **Shutdown cleanup**: NCI QUIT + `stopProgram`; verify no zombie RetroArch after FAIL | |
| B2.5 | **SNI reconnect** if attach lost mid-test | Rare; log and fail gracefully |

### B3. Operator experience

| ID | Task | Details |
|----|------|---------|
| B3.1 | CLI **`--build-only`** and **`--dry-run-connect`** flags | Faster iteration |
| B3.2 | Log **retropad events** with timestamps (debug level / config flag) | Diagnose navigation |
| B3.3 | UI: show last N lines of `.log` file or stream progress into `logTail` | Better than JSON-only |
| B3.4 | **`onPassUpdateTestStatus`**: on PASS + edit permission, set `test_status: accept` via existing IPC | Plan phase 7 optional feature |

### B4. Test matrix automation

| ID | Task | Details |
|----|------|---------|
| B4.1 | Document **reference stages** table (below) with expected result | Manual QA script |
| B4.2 | Optional **`jstools/stage_autotest_matrix.js`** — run list of gameid/level, collect pass rate | Not CI-blocking initially |
| B4.3 | Integration test with **recorded SNESWrapper mock** capturing connect order (launch before connect) | Prevent regressions |

---

## Reference Test Matrix (initial)

Fill in expected results as mk2 verification proceeds.

| Game ID | Level | Notes | Expected | Verified |
|---------|-------|-------|----------|----------|
| 5988 | 111 | User repro case; playlevel patch | PASS | ☐ |
| *(vanilla test ROM)* | 106 | Known translevel `0x06` if available in DB | PASS | ☐ |
| *(no-OW hack)* | *TBD* | `skipOverworldNavigation: true` | PASS | ☐ |
| *(wrong stage row)* | *TBD* | Negative: bad translevel | FAIL verify | ☐ |

Add rows for: castle level, water level, multi-screen, game with nonstandard title flow.

---

## Success Criteria (Mk2 complete)

Mk2 is **done** when all of the following hold:

1. **Reference matrix**: at least **two** distinct games/stages achieve CLI **PASS** with logs showing boot, verify, and retry phases PASS.
2. **UI parity**: same stages PASS via Edit Stages 🤖 Auto Test.
3. **No regressions**: `npm run test:stage-autotest` + append config test pass.
4. **Documented** known limitations (headless, flag warnings, hacks needing custom input) in `docs/STAGE_AUTOTEST.md`.
5. **Operator guide** in this doc (Section A) validated by a second run on a clean machine or fresh userData.

---

## Implementation Order (recommended)

```
A1 preflight → A3 launch/SNI → A4 RetroPad → A5 RAM phases → B1 fixes
  → A6 UI → A7 negatives → B2 robustness → B3 UX → B4 matrix tool
```

Do **not** start BizHawk or headless CI until RetroArch interactive path is green.

---

## Out of Scope (Mk3+)

- **BizHawk backend** wrapping `pytools/smw_headless_test.py`
- **Headless CI** on Linux builders (RetroArch null video driver)
- **Per-game input scripts** (Lua / external JSON plans)
- **Screenshot capture** at verify point
- **Hard-fail on flag mismatch** (currently warnings only)
- Splitting `runner.js` into `phases/*.js` unless maintenance requires it

---

## Key Files (quick index)

| Path | Role |
|------|------|
| `lib/stage-autotest/runner.js` | Phase orchestration |
| `lib/stage-autotest/backends/retroarch.js` | Launch order, SNI retry, backend API |
| `lib/stage-autotest/utils.js` | `buildUsb2snesConnectOptions` |
| `lib/stage-autotest/config.js` | Defaults including `sniConnect`, `freezeDetect` |
| `electron/stage-autotest-service.js` | Main-process deps |
| `jstools/stage_autotest.js` | CLI |
| `electron/renderer/src/components/StageAutoTestDialog.vue` | UI |
| `electron/renderer/src/utils/stage-test-launch.ts` | Manual test parity reference |
| `electron/renderer/src/utils/emulator-launch-hooks.ts` | SNI reconnect reference |
| `docs/STAGE_AUTOTEST.md` | User-facing doc |
| `devdocs/SMW_HEADLESS_TESTING.md` | Future BizHawk comparison |

---

## Open Questions

1. **Navigation strategy**: Is generic timed Start/A sufficient for most catalog stages, or do we need hack-class presets (instant playlevel, no title, custom intro)?
2. **Verify strictness**: Is `$13BF` alone enough, or should `$19D8` bit 0 be required for full level ID match?
3. **Headless**: Required for mk2, or defer until interactive PASS is stable?
4. **test_status update**: Enable by default for editors, or stay opt-in via config?

---

## Changelog (this document)

| Date | Change |
|------|--------|
| 2026-06-21 | Initial mk2 plan: milestone 1 recap, manual findings, verification checklist, completion backlog |
