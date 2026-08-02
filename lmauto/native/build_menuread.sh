#!/usr/bin/env bash
# Build PE32 lmauto_menuread.dll for in-process LM menu reads.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="${ROOT}/native/lmauto_menuread.dll"
CC="${MINGW_CC:-i686-w64-mingw32-gcc}"
if ! command -v "$CC" >/dev/null 2>&1; then
  echo "error: $CC not found (install g++-mingw-w64-i686 / gcc-mingw-w64-i686)" >&2
  exit 1
fi
"$CC" -shared -m32 -O2 -Wall -Wextra \
  -o "$OUT" \
  "${ROOT}/native/lmauto_menuread.c" \
  -Wl,--kill-at -static-libgcc
echo "built $OUT ($("$CC" -dumpmachine))"
file "$OUT"
