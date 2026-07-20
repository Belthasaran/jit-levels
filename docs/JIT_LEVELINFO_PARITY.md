# JIT.LevelInfo parity policy

When modifying `lmlevelinfo/` or `lib/jit-levels/levelinfo/`:

1. Run `npm run test:jit-levelinfo-parity`
2. Fix JS port until akogare `0x109` JSON matches C output (excluding `derived` / `gfx_route` JS extensions)
3. Optional thorough suite: set `LEVELINFO_PARITY_THOROUGH=1` (future)

Reference command:

```bash
./lmlevelinfo/level_info1 test/akogare/orig_Ako.sfc 0x109 --json -o /tmp/c109.json
node -e "const {parseLevelInfo}=require('./lib/jit-levels/levelinfo'); console.log(JSON.stringify(parseLevelInfo(require('fs').readFileSync('lmlevelinfo/test/akogare/orig_Ako.sfc'),'0x109'),null,2));"
```
