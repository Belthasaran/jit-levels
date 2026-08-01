#!/usr/bin/env bash
# Run lmauto unit tests. Prefer repo enode.sh when available.
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
LMAUTO=$(cd "${SCRIPT_DIR}/.." && pwd)
ROOT=$(cd "${LMAUTO}/../.." && pwd)
if [[ -x "${ROOT}/enode.sh" ]]; then
  exec "${ROOT}/enode.sh" "${SCRIPT_DIR}/run_all.js" "$@"
fi
exec node "${SCRIPT_DIR}/run_all.js" "$@"
