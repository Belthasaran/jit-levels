#!/usr/bin/env bash
# Host launcher: prepare headered ROM, start Lunar Magic under Wine, run Windows-Node automator.
#
# Usage:
#   ./host/run_lmauto.sh --rom=/path/to/hack.sfc --profile=l1only_nogrid --out=/path/to/fixtures
#   ./host/run_lmauto.sh --help
#
# Env:
#   LMAUTO_LM            Lunar Magic exe (default: ../lm363.exe beside this tree)
#   LMAUTO_WINEPREFIX    Wine prefix (default: $HOME/.wine_lm_auto)
#   LMAUTO_NODE          Windows node.exe (default: ../node-win-x86/node.exe — PE32 required)
#   WINE                 wine binary (default: wine)
#   DISPLAY              X display (default: :99)
#   LMAUTO_KEEP_WORKDIR  if 1, do not delete workdir on exit
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
LMAUTO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
WINE_BIN="${WINE:-wine}"
export WINEPREFIX="${LMAUTO_WINEPREFIX:-${HOME}/.wine_lm_auto}"
export DISPLAY="${DISPLAY:-:99}"
export WINEDEBUG="${WINEDEBUG:--all}"
export WINEDLLOVERRIDES="${WINEDLLOVERRIDES:-mscoree,mshtml=}"

LM_DEFAULT="${LMAUTO_ROOT}/lm363.exe"
NODE_X86_DEFAULT="${LMAUTO_ROOT}/node-win-x86/node.exe"
NODE_X64_DEFAULT="${LMAUTO_ROOT}/node-win-x64/node.exe"
LM="${LMAUTO_LM:-$LM_DEFAULT}"
if [[ -n "${LMAUTO_NODE:-}" ]]; then
  NODE_WIN="${LMAUTO_NODE}"
elif [[ -f "$NODE_X86_DEFAULT" ]]; then
  NODE_WIN="$NODE_X86_DEFAULT"
else
  NODE_WIN="$NODE_X64_DEFAULT"
fi

ROM=""
PROFILE=""
OUT=""
WORKDIR=""
ALL_LEVELS=0
AUTO_SET_SCREENS=0
TIMEOUT_MS=600000
POLL_MS=250
HELP=0

usage() {
  cat <<EOF
Usage: $0 --rom=<path> --profile=<id> --out=<dir> [options]

Prepare a 512-byte headered temp ROM, open it in Lunar Magic under Wine, then
drive Export Multiple Levels to Images via Windows Node (koffi/user32).

Options:
  --help
  --rom=<path>           Source ROM
  --lm=<path>            Lunar Magic exe (default: LMAUTO_LM or lmauto/lm363.exe)
  --profile=<id>         l1only_nogrid | l1only_gridlines | l2only_gridlines |
                         l3only_gridlines | spritesonly_gridlines
  --out=<dir>            Destination for exported PNGs
  --workdir=<dir>        Working directory (default: mktemp under lmauto/work)
  --all-levels           Export all 0x200 levels (uncheck "modified only")
  --auto-set-screens     Check Dialog 1027 Auto-Set Number of Screens
  --timeout-ms=<n>       Overall timeout (default 600000)
  --poll-ms=<n>          Poll interval (default 250)

Environment: LMAUTO_LM, LMAUTO_WINEPREFIX, LMAUTO_NODE (prefer node-win-x86), WINE, DISPLAY

Note: Guest Node must be PE32 (ia32). Menu checkmarks are read by injecting
native/lmauto_menuread.dll into LM — cross-process GetMenu fails under Wine.
EOF
}

for a in "$@"; do
  case "$a" in
    --help|-h) HELP=1 ;;
    --rom=*) ROM="${a#--rom=}" ;;
    --lm=*) LM="${a#--lm=}" ;;
    --profile=*) PROFILE="${a#--profile=}" ;;
    --out=*) OUT="${a#--out=}" ;;
    --workdir=*) WORKDIR="${a#--workdir=}" ;;
    --all-levels) ALL_LEVELS=1 ;;
    --auto-set-screens) AUTO_SET_SCREENS=1 ;;
    --timeout-ms=*) TIMEOUT_MS="${a#--timeout-ms=}" ;;
    --poll-ms=*) POLL_MS="${a#--poll-ms=}" ;;
    *)
      echo "Unknown argument: $a" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$HELP" -eq 1 ]]; then
  usage
  exit 0
fi

if [[ -z "$ROM" || -z "$PROFILE" || -z "$OUT" ]]; then
  echo "error: --rom, --profile, and --out are required" >&2
  usage >&2
  exit 2
fi
if [[ ! -f "$ROM" ]]; then
  echo "error: ROM not found: $ROM" >&2
  exit 1
fi
if [[ ! -f "$LM" ]]; then
  echo "error: Lunar Magic not found: $LM" >&2
  exit 1
fi
if [[ ! -f "$NODE_WIN" ]]; then
  echo "error: Windows node.exe not found: $NODE_WIN" >&2
  echo "  Expected lmauto/node-win-x86/node.exe (PE32; or set LMAUTO_NODE)" >&2
  exit 1
fi
if ! command -v "$WINE_BIN" >/dev/null 2>&1; then
  echo "error: wine not found (WINE=$WINE_BIN)" >&2
  exit 1
fi

MENUREAD_DLL="${LMAUTO_ROOT}/native/lmauto_menuread.dll"
if [[ ! -f "$MENUREAD_DLL" ]]; then
  echo "lmauto: building native/lmauto_menuread.dll..."
  bash "${LMAUTO_ROOT}/native/build_menuread.sh"
fi
if [[ ! -f "$MENUREAD_DLL" ]]; then
  echo "error: missing $MENUREAD_DLL (in-process menu reader)" >&2
  exit 1
fi

# Refuse PE32+ guest — CreateRemoteThread into PE32 LM needs ia32 Node.
NODE_FILE_INFO=$(file -b "$NODE_WIN" 2>/dev/null || true)
if echo "$NODE_FILE_INFO" | grep -q 'PE32+'; then
  echo "error: LMAUTO_NODE is PE32+ (x64): $NODE_WIN" >&2
  echo "  Menu reads require PE32 Node (node-win-x86). Node 20 win-x86 zip works." >&2
  exit 1
fi
echo "lmauto: guest Node ${NODE_WIN}"

# Ensure koffi is installed for the guest (npm under Wine node).
if [[ ! -d "${LMAUTO_ROOT}/node_modules/koffi" ]]; then
  echo "lmauto: installing npm deps (koffi) via host npm..."
  (
    cd "${LMAUTO_ROOT}"
    if command -v npm >/dev/null 2>&1; then
      npm install --no-fund --no-audit
    else
      echo "error: npm not found; run npm install in ${LMAUTO_ROOT}" >&2
      exit 1
    fi
  )
fi

mkdir -p "${LMAUTO_ROOT}/work" "$OUT"
if [[ -z "$WORKDIR" ]]; then
  WORKDIR=$(mktemp -d "${LMAUTO_ROOT}/work/run.XXXXXX")
fi
mkdir -p "${WORKDIR}/out"

cleanup() {
  if [[ -n "${LM_PID:-}" ]] && kill -0 "$LM_PID" 2>/dev/null; then
    kill "$LM_PID" 2>/dev/null || true
    wait "$LM_PID" 2>/dev/null || true
  fi
  if [[ "${LMAUTO_KEEP_WORKDIR:-0}" != "1" ]]; then
    rm -rf "${WORKDIR}"
  else
    echo "lmauto: kept workdir ${WORKDIR}"
  fi
}
trap cleanup EXIT

# Copy LM + prepare headered ROM (same heuristic as test/get_jumphalf.sh).
cp "$LM" "${WORKDIR}/lm.exe"
cp "$ROM" "${WORKDIR}/rom.body"
# Detect existing 512-byte header: size mod 65536 == 512
ROM_SIZE=$(wc -c <"${WORKDIR}/rom.body")
if (( ROM_SIZE % 65536 == 512 )); then
  cp "${WORKDIR}/rom.body" "${WORKDIR}/rom.sfc"
  echo "lmauto: ROM already headered (${ROM_SIZE} bytes)"
else
  printf '\x00%.0s' {1..512} >"${WORKDIR}/rom.sfc"
  cat "${WORKDIR}/rom.body" >>"${WORKDIR}/rom.sfc"
  echo "lmauto: prepended 512-byte SMC header (${ROM_SIZE} -> $(wc -c <"${WORKDIR}/rom.sfc") bytes)"
fi

echo "lmauto: WINEPREFIX=${WINEPREFIX} DISPLAY=${DISPLAY}"
echo "lmauto: starting LM ${WORKDIR}/lm.exe rom.sfc"

(
  cd "${WORKDIR}"
  "${WINE_BIN}" lm.exe rom.sfc
) &
LM_PID=$!

# Brief pause for LMFrame (menu reads are in-process; no long menu poll).
sleep 1.5

# Map Linux paths to Wine Z: paths for the guest script.
to_wine_path() {
  local p
  p=$(readlink -f "$1")
  echo "Z:${p}"
}

GUEST_SCRIPT=$(to_wine_path "${LMAUTO_ROOT}/bin/lmauto_export.js")
GUEST_STAGING=$(to_wine_path "${WORKDIR}/out")
GUEST_ARGS=(
  "${GUEST_SCRIPT}"
  "--attach"
  "--profile=${PROFILE}"
  "--out=${GUEST_STAGING}"
  "--timeout-ms=${TIMEOUT_MS}"
  "--poll-ms=${POLL_MS}"
)
if [[ "$ALL_LEVELS" -eq 1 ]]; then
  GUEST_ARGS+=(--all-levels)
fi
if [[ "$AUTO_SET_SCREENS" -eq 1 ]]; then
  GUEST_ARGS+=(--auto-set-screens)
fi

echo "lmauto: running guest automator..."
# PE32 Node under Wine breaks on piped stdio (EBADF); log to a file instead.
GUEST_LOG="${WORKDIR}/guest.log"
set +e
(
  cd "${WORKDIR}"
  "${WINE_BIN}" "${NODE_WIN}" "${GUEST_ARGS[@]}" >"${GUEST_LOG}" 2>&1
)
GUEST_RC=$?
set -e
if [[ -f "${GUEST_LOG}" ]]; then
  cat "${GUEST_LOG}"
fi
if [[ "$GUEST_RC" -ne 0 ]]; then
  echo "error: guest automator exited ${GUEST_RC}" >&2
  exit "$GUEST_RC"
fi

# Copy PNGs to destination.
shopt -s nullglob
PNGS=("${WORKDIR}/out"/*.png)
COUNT=${#PNGS[@]}
if [[ "$COUNT" -eq 0 ]]; then
  echo "error: no PNGs produced in ${WORKDIR}/out" >&2
  exit 1
fi
cp -f "${PNGS[@]}" "$OUT"/
echo "lmauto: copied ${COUNT} PNG(s) -> ${OUT}"
