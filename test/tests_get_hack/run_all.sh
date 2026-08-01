#!/usr/bin/env bash
# Unit tests for get_hack (no network / no Wine GUI).
set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "${SCRIPT_DIR}/../../.." && pwd)
cd "${ROOT}"
./enode.sh "${SCRIPT_DIR}/test_get_hack_meta.js"
./enode.sh "${SCRIPT_DIR}/test_rom_lock_probe.js"
# get_hack --help
"${ROOT}/lmlevelinfo/test/get_hack.sh" --help >/dev/null
# png_refs_to_ppm --help
"${ROOT}/lmlevelinfo/test/png_refs_to_ppm.sh" --help >/dev/null
echo "PASS: tests_get_hack/run_all.sh"
