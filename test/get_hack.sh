#!/usr/bin/env bash
# Fetch a test hack suite: BPS → unheadered SFC, lock check, AllMap16, LM GFX,
# lmauto image exports, PNG→PPM.
#
# Modes:
#   ./test/get_hack.sh jumphalf
#   ./test/get_hack.sh --hack=jumphalf
#   ./test/get_hack.sh --gameid=19720 --hack=jumphalf
#
# Env: SMW_SFC_PATH, WINE, LMAUTO_LM, DISPLAY, LMAUTO_WINEPREFIX
set -euo pipefail

SCRIPT_FOLDER=$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "${SCRIPT_FOLDER}/../.." && pwd)
LMAUTO_ROOT="${ROOT}/lmlevelinfo/lmauto"
META_JS="${SCRIPT_FOLDER}/get_hack_meta.js"
LOCK_PROBE="${ROOT}/lminterop/lm_rom_study/tools/rom_lock_probe.cjs"
ASSET_EXPORT="${ROOT}/lminterop/lm_rom_study/tools/asset_export.cjs"
LMAUTO_RUN="${LMAUTO_ROOT}/host/run_lmauto.sh"
PNG_TO_PPM="${SCRIPT_FOLDER}/png_refs_to_ppm.sh"
WINE_BIN="${WINE:-wine}"

HACK=""
GAMEID=""
POSITIONAL=""
SKIP_IMAGES=0
SKIP_GFX=0
IMAGES_ONLY=0
PROFILES=""
HELP=0

usage() {
  cat <<EOF
Usage:
  $0 <shortname> [options]
  $0 --hack=<shortname> [options]
  $0 --gameid=<id> --hack=<shortname> [options]

Fetch BPS, build unheadered <shortname>/<shortname>.sfc, refuse locked ROMs,
export AllMap16 + LM Graphics/ExGraphics, then lmauto image fixtures + PPM.

Options:
  --help
  --hack=<name>          Suite shortname (^[a-z0-9]+$)
  --gameid=<id>          SMW Central / RHPLAY gameid (with --hack=)
  --skip-images          Stop after Map16/GFX (no Wine GUI)
  --skip-gfx             Skip LM -ExportGFX/-ExportExGFX
  --images-only          Only lock-check + lmauto + PPM (ROM must exist)
  --profiles=a,b,…       Subset of lmauto profiles (default: all six)

Known shortnames (Mode A):
  $(cd "${ROOT}" && ./enode.sh "${META_JS}" known 2>/dev/null | tr '\n' ' ')

Env: SMW_SFC_PATH, WINE, LMAUTO_LM, DISPLAY, LMAUTO_WINEPREFIX
EOF
}

for a in "$@"; do
  case "$a" in
    --help|-h) HELP=1 ;;
    --hack=*) HACK="${a#--hack=}" ;;
    --gameid=*) GAMEID="${a#--gameid=}" ;;
    --skip-images) SKIP_IMAGES=1 ;;
    --skip-gfx) SKIP_GFX=1 ;;
    --images-only) IMAGES_ONLY=1 ;;
    --profiles=*) PROFILES="${a#--profiles=}" ;;
    -*)
      echo "Unknown argument: $a" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$POSITIONAL" ]]; then
        echo "error: too many positional arguments" >&2
        usage >&2
        exit 2
      fi
      POSITIONAL="$a"
      ;;
  esac
done

if [[ "$HELP" -eq 1 ]]; then
  usage
  exit 0
fi

RESOLVE_ARGS=()
if [[ -n "$POSITIONAL" ]]; then
  RESOLVE_ARGS+=("$POSITIONAL")
fi
if [[ -n "$HACK" ]]; then
  RESOLVE_ARGS+=("--hack=${HACK}")
fi
if [[ -n "$GAMEID" ]]; then
  RESOLVE_ARGS+=("--gameid=${GAMEID}")
fi

RESOLVE_OUT=$(cd "${ROOT}" && ./enode.sh "${META_JS}" resolve "${RESOLVE_ARGS[@]}")
HACK=$(echo "${RESOLVE_OUT}" | sed -n 's/^hack=//p')
GAMEID=$(echo "${RESOLVE_OUT}" | sed -n 's/^gameid=//p')
if [[ -z "$HACK" || -z "$GAMEID" ]]; then
  echo "error: failed to resolve hack/gameid" >&2
  echo "${RESOLVE_OUT}" >&2
  exit 1
fi

SUITE="${SCRIPT_FOLDER}/${HACK}"
BPS="${SUITE}/${HACK}.bps"
SFC="${SUITE}/${HACK}.sfc"
mkdir -p "${SUITE}"

if [[ -z "$PROFILES" ]]; then
  PROFILES=$(cd "${ROOT}" && ./enode.sh "${META_JS}" profiles | paste -sd, -)
fi

require_unlocked_rom() {
  local rom="$1"
  if [[ ! -f "$rom" ]]; then
    echo "error: ROM not found: $rom" >&2
    exit 1
  fi
  # Unheadered unlocked hacks often report rom_lock=unknown (detectLock header heuristic).
  # Probe with a temporary 512-byte header so unlocked suites classify as none when safe.
  local line lock
  line=$(cd "${ROOT}" && ./enode.sh "${LOCK_PROBE}" --rom="${rom}" --for-export)
  lock="${line#rom_lock=}"
  echo "get_hack: ${rom} → ${line}"
  if [[ "$lock" == "locked" ]]; then
    echo "error: ROM is Lunar Magic locked/edit-protected." >&2
    echo "  get_hack LM CLI GFX and lmauto image export do not support locked ROMs yet." >&2
    echo "  BPS/SFC left in place; locked-ROM artifact automation is out of scope." >&2
    exit 1
  fi
  if [[ "$lock" != "none" ]]; then
    echo "error: ROM lock status is '${lock}' after export probe (expected none)." >&2
    echo "  Inspect with: enode.sh lminterop/lm_rom_study/tools/rom_lock_probe.cjs --rom=… --json" >&2
    exit 1
  fi
}

export_lm_gfx() {
  local lm=""
  if [[ -n "${LMAUTO_LM:-}" && -f "${LMAUTO_LM}" ]]; then
    lm="${LMAUTO_LM}"
  elif [[ -f "${LMAUTO_ROOT}/lm363.exe" ]]; then
    lm="${LMAUTO_ROOT}/lm363.exe"
  elif [[ -f "${SUITE}/lm361.exe" ]]; then
    lm="${SUITE}/lm361.exe"
  elif [[ -f "${LMAUTO_ROOT}/lm361.exe" ]]; then
    lm="${LMAUTO_ROOT}/lm361.exe"
  fi
  if [[ -z "$lm" ]]; then
    echo "warn: Lunar Magic exe not found; skipping -ExportGFX/-ExportExGFX" >&2
    return 0
  fi
  if ! command -v "${WINE_BIN}" >/dev/null 2>&1; then
    echo "warn: wine not found; skipping -ExportGFX/-ExportExGFX" >&2
    return 0
  fi

  local work
  work=$(mktemp -d)
  cp "${SFC}" "${work}/rom.body"
  cp "${lm}" "${work}/lm.exe"
  local rom_size
  rom_size=$(wc -c <"${work}/rom.body")
  if (( rom_size % 65536 == 512 )); then
    cp "${work}/rom.body" "${work}/rom.sfc"
  else
    printf '\x00%.0s' {1..512} >"${work}/rom.sfc"
    cat "${work}/rom.body" >>"${work}/rom.sfc"
  fi
  (
    cd "${work}"
    WINEDEBUG=-all "${WINE_BIN}" lm.exe -ExportGFX rom.sfc
    WINEDEBUG=-all "${WINE_BIN}" lm.exe -ExportExGFX rom.sfc
  )
  rm -rf "${SUITE}/Graphics" "${SUITE}/ExGraphics"
  cp -a "${work}/Graphics" "${SUITE}/"
  cp -a "${work}/ExGraphics" "${SUITE}/"
  echo "get_hack: LM ExportGFX/ExGFX → ${SUITE}/Graphics ($(ls "${SUITE}/Graphics" | wc -l) bins), ExGraphics ($(ls "${SUITE}/ExGraphics" | wc -l) bins)"
  rm -rf "${work}"
}

run_lmauto_profiles() {
  if [[ ! -x "${LMAUTO_RUN}" ]]; then
    echo "error: lmauto runner missing: ${LMAUTO_RUN}" >&2
    exit 1
  fi
  local IFS=,
  local p
  for p in ${PROFILES}; do
    p=$(echo "$p" | tr -d '[:space:]')
    [[ -z "$p" ]] && continue
    echo "get_hack: lmauto profile ${p}"
    "${LMAUTO_RUN}" --rom="${SFC}" --profile="${p}" --out="${SUITE}"
  done
  "${PNG_TO_PPM}" --dir="${SUITE}" --kinds="${PROFILES}"
}

echo "get_hack: hack=${HACK} gameid=${GAMEID} suite=${SUITE}"

if [[ "$IMAGES_ONLY" -eq 1 ]]; then
  require_unlocked_rom "${SFC}"
  run_lmauto_profiles
  echo "get_hack: images-only done → ${SUITE}"
  exit 0
fi

echo "get_hack: fetching BPS gameid=${GAMEID}"
cd "${ROOT}"
./enode.sh "${ROOT}/jstools/fetchpatches.js" mode3 -b gameid "${GAMEID}" --query=patch --output="${BPS}"

echo "get_hack: flips → ${SFC}"
flips --apply "${BPS}" "${SMW_SFC_PATH:-/usr/local/share/smw.sfc}" "${SFC}"

require_unlocked_rom "${SFC}"

echo "get_hack: AllMap16 via asset_export"
./enode.sh "${ASSET_EXPORT}" --rom="${SFC}" --out="${SUITE}" --skip-gfx

if [[ "$SKIP_GFX" -eq 0 ]]; then
  export_lm_gfx
else
  echo "get_hack: --skip-gfx"
fi

if [[ "$SKIP_IMAGES" -eq 1 ]]; then
  echo "get_hack: --skip-images; done (ROM/Map16/GFX only) → ${SUITE}"
  exit 0
fi

run_lmauto_profiles
echo "get_hack: complete → ${SUITE}"
