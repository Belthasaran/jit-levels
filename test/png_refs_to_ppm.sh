#!/usr/bin/env bash
# Convert LM Export PNG refs (space before level id) to binary P6 PPM
# used by level_visual --lm-tile-ref / batch gates.
#
# Usage:
#   ./test/png_refs_to_ppm.sh --dir=<suite_dir> [--kinds=l1only,l2only,…|all]
#   ./test/png_refs_to_ppm.sh --dir=test/jumphalf --kinds=all
#   ./test/png_refs_to_ppm.sh --help
#
# Default kinds: all standard get_hack profiles (l1only nogrid+gridlines, l2/l3/sprites/l1l2 gridlines).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

DIR=""
KINDS=""
HELP=0

usage() {
  cat <<EOF
Usage: $0 --dir=<suite_dir> [--kinds=CSV|all]

Convert lmlevel_* PNG exports (space before hex id) to underscore PPM names.

Options:
  --help
  --dir=<path>     Suite directory containing PNGs
  --kinds=CSV      Comma-separated kind stems, or "all"
                   Kind stems: l1only_nogrid, l1only_gridlines, l2only_gridlines,
                   l3only_gridlines, spritesonly_gridlines, l1l2only_gridlines
                   Also accepts short forms: l1only, l2only, l1l2only (gridlines only)
EOF
}

for a in "$@"; do
  case "$a" in
    --help|-h) HELP=1 ;;
    --dir=*) DIR="${a#--dir=}" ;;
    --kinds=*) KINDS="${a#--kinds=}" ;;
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
if [[ -z "$DIR" ]]; then
  echo "error: --dir= is required" >&2
  usage >&2
  exit 2
fi
if [[ ! -d "$DIR" ]]; then
  echo "error: directory not found: $DIR" >&2
  exit 1
fi

if [[ -z "$KINDS" || "$KINDS" == "all" ]]; then
  KINDS="l1only_nogrid,l1only_gridlines,l2only_gridlines,l3only_gridlines,spritesonly_gridlines,l1l2only_gridlines"
fi

# Expand short forms used by older suite scripts (l2only → l2only_gridlines).
expand_kinds() {
  local IFS=,
  local -a out=()
  local k
  for k in $1; do
    case "$k" in
      l1only|l2only|l3only|l1l2only|spritesonly) out+=("${k}_gridlines") ;;
      *) out+=("$k") ;;
    esac
  done
  (IFS=,; echo "${out[*]}")
}
KINDS=$(expand_kinds "$KINDS")

python3 - "$DIR" "$KINDS" <<'PY'
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as e:
    raise SystemExit("Pillow required: pip install pillow") from e

root = Path(sys.argv[1])
kinds = [k.strip() for k in sys.argv[2].split(",") if k.strip()]
n = 0
for kind in kinds:
    # Matches: lmlevel_<kind> <ID>.png  (space before hex id)
    pattern = f"lmlevel_{kind} *.png"
    for png in sorted(root.glob(pattern)):
        # stem after last space is "105.png" or "105"
        lid = png.name.split()[-1]
        if lid.lower().endswith(".png"):
            lid = lid[:-4]
        out = root / f"lmlevel_{kind}_{lid}.ppm"
        im = Image.open(png).convert("RGB")
        w, h = im.size
        with open(out, "wb") as f:
            f.write(f"P6\n{w} {h}\n255\n".encode("ascii"))
            f.write(im.tobytes())
        n += 1
        print(f"wrote {out.name} ({w}x{h})")
print(f"converted {n} refs ({len(kinds)} kinds in {root})")
PY
