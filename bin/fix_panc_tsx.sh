#!/usr/bin/env bash
set -euo pipefail

HERE="$(pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

echo "== PANINI panc / TypeScript runtime repair =="
echo "bin : $HERE"
echo "root: $ROOT"
echo

if [ "$(basename "$HERE")" != "bin" ]; then
    echo "ERROR: Run this from the toolchain bin/ directory."
    exit 1
fi

if [ ! -f "$ROOT/scripts/pan-tool.mjs" ]; then
    echo "ERROR: $ROOT/scripts/pan-tool.mjs not found."
    exit 1
fi

echo "== Locate Debian npm =="
NPM_JS="$(dpkg -L npm 2>/dev/null | grep '/npm-cli\.js$' | head -1 || true)"

if [ -z "$NPM_JS" ]; then
    echo "ERROR: Debian npm-cli.js not found."
    exit 1
fi

echo "npm: $NPM_JS"

npm_cmd() {
    node "$NPM_JS" "$@"
}

echo
echo "== Install tsx locally in CURRENT bin/ =="

if [ ! -f ./package.json ]; then
    npm_cmd init -y >/dev/null
fi

npm_cmd install --save-dev tsx

echo
echo "tsx:"
./node_modules/.bin/tsx --version

echo
echo "== Backup pan-tool.mjs =="

if [ ! -f "$ROOT/scripts/pan-tool.mjs.native-ts" ]; then
    cp -a "$ROOT/scripts/pan-tool.mjs" \
          "$ROOT/scripts/pan-tool.mjs.native-ts"
    echo "Saved:"
    echo "$ROOT/scripts/pan-tool.mjs.native-ts"
else
    echo "Backup already exists; leaving it unchanged."
fi

echo
echo "== Replace panc launcher =="
cat > ./panc <<'LAUNCHER'
#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

export PAN_TOOL="${PAN_TOOL:-panc}"

exec "$HERE/node_modules/.bin/tsx" \
    "$ROOT/scripts/pan-tool.mjs" \
    "$@"
LAUNCHER

chmod +x ./panc

echo "Created:"
echo "$HERE/panc"

echo
echo "== Patch pan-tool.mjs =="
python3 - "$ROOT/scripts/pan-tool.mjs" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

start = s.index('if (!process.execArgv.includes("--experimental-strip-types")) {')
else_pos = s.index('\n} else {', start)
end = s.index('\n}', else_pos + len('\n} else {')) + 2

replacement = '''{
  const { runCli } = await import(pathToFileUrl(cliTs));
  const { runHostCc } = await import(pathToFileUrl(path.join(here, "../src/lib/panini/host-cc-run.server.ts")));
  const name = toolName();
  const rest = process.argv.slice(2);
  const argv = name && rest[0] !== name ? [name, ...rest] : rest.length ? rest : name ? [name, "--help"] : ["help"];
  const code = await runCli(argv, undefined, {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, d) => fs.writeFileSync(p, d),
    nativeCc: runHostCc,
  });
  process.exit(code);
}'''

p.write_text(s[:start] + replacement + s[end:])
PY

echo "Native Node TypeScript re-exec removed."
echo

echo "== Verify patched launcher source =="
grep -n -E 'experimental-strip-types|runCli|host-cc-run' \
    "$ROOT/scripts/pan-tool.mjs" || true

echo
echo "== Test panc --help =="
./panc --help

echo
echo "== Test factorial example if available =="
if [ -f "$ROOT/../panini_by_grok/examples/factorial.pni" ]; then
    ./panc binary "$ROOT/../panini_by_grok/examples/factorial.pni" --out factorial
elif [ -f "$ROOT/examples/factorial.pni" ]; then
    ./panc binary "$ROOT/examples/factorial.pni" --out factorial
else
    echo "factorial.pni not found in the adjacent source tree; skipping."
fi

echo
echo "============================================================"
echo "PANC REPAIR COMPLETE"
echo "============================================================"
echo
echo "Current launcher:"
echo "  $HERE/panc"
echo
echo "Original ELF:"
echo "  $HERE/panc.elf"
echo
echo "Original pan-tool:"
echo "  $ROOT/scripts/pan-tool.mjs.native-ts"
echo
echo "tsx installation:"
echo "  $HERE/node_modules/"
echo
