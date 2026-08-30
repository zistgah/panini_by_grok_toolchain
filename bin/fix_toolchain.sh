#!/usr/bin/env bash
set -euo pipefail

HERE="$(pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

echo "============================================================"
echo " PANINI v127 — Node TypeScript compatibility repair"
echo "============================================================"
echo
echo "bin : $HERE"
echo "root: $ROOT"
echo

# ------------------------------------------------------------------
# Safety: this script is intended to be run from THIS bin directory.
# ------------------------------------------------------------------

if [ "$(basename "$HERE")" != "bin" ]; then
    echo "ERROR: Run this script from the toolchain bin/ directory."
    exit 1
fi

if [ ! -f "$ROOT/scripts/pan-tool.mjs" ]; then
    echo "ERROR: Cannot find:"
    echo "  $ROOT/scripts/pan-tool.mjs"
    exit 1
fi

# ------------------------------------------------------------------
# Locate Debian npm without relying on npm being on PATH.
# ------------------------------------------------------------------

echo "== Locate Debian npm =="

NPM_JS="$(dpkg -L npm 2>/dev/null \
    | grep '/npm-cli\.js$' \
    | head -1 || true)"

if [ -z "$NPM_JS" ]; then
    echo "ERROR: npm-cli.js was not found in the installed npm package."
    exit 1
fi

echo "npm-cli.js: $NPM_JS"

npm_cmd() {
    node "$NPM_JS" "$@"
}

echo
echo "npm version:"
npm_cmd --version

# ------------------------------------------------------------------
# Install tsx LOCALLY in bin/.
# ------------------------------------------------------------------

echo
echo "== Install local TypeScript runtime =="

if [ ! -f "$HERE/package.json" ]; then
    npm_cmd init -y >/dev/null
fi

npm_cmd install --save-dev tsx

TSX="$HERE/node_modules/.bin/tsx"

if [ ! -x "$TSX" ]; then
    echo "ERROR: tsx installation failed."
    exit 1
fi

echo "tsx:"
"$TSX" --version

# ------------------------------------------------------------------
# Preserve original pan-tool.mjs exactly once.
# ------------------------------------------------------------------

echo
echo "== Preserve original pan-tool.mjs =="

ORIGINAL="$ROOT/scripts/pan-tool.mjs.native-ts"

if [ ! -f "$ORIGINAL" ]; then
    cp -a "$ROOT/scripts/pan-tool.mjs" "$ORIGINAL"
    echo "Saved:"
    echo "  $ORIGINAL"
else
    echo "Existing backup preserved:"
    echo "  $ORIGINAL"
fi

# ------------------------------------------------------------------
# Patch pan-tool.mjs.
#
# v127 tries to re-exec itself with:
#
#   --experimental-strip-types
#
# That is the operation producing ERR_NO_TYPESCRIPT on this Node
# installation. tsx is now the outer TypeScript runtime, so the
# re-exec is unnecessary.
# ------------------------------------------------------------------

echo
echo "== Patch pan-tool.mjs =="

python3 - "$ROOT/scripts/pan-tool.mjs" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

marker = 'if (!process.execArgv.includes("--experimental-strip-types")) {'

if marker not in s:
    print("Native TypeScript re-exec block already absent.")
    raise SystemExit(0)

start = s.index(marker)

else_marker = "\n} else {"
else_pos = s.index(else_marker, start)

# Find the closing brace belonging to the outer if/else block.
depth = 1
i = else_pos + len(else_marker)

while i < len(s):
    if s[i] == "{":
        depth += 1
    elif s[i] == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
else:
    raise RuntimeError("Could not find end of TypeScript re-exec block.")

replacement = '''{
  const { runCli } = await import(pathToFileUrl(cliTs));
  const { runHostCc } = await import(
    pathToFileUrl(
      path.join(here, "../src/lib/panini/host-cc-run.server.ts")
    )
  );

  const name = toolName();
  const rest = process.argv.slice(2);
  const argv =
    name && rest[0] !== name
      ? [name, ...rest]
      : rest.length
        ? rest
        : name
          ? [name, "--help"]
          : ["help"];

  const code = await runCli(argv, undefined, {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, d) => fs.writeFileSync(p, d),
    nativeCc: runHostCc,
  });

  process.exit(code);
}'''

p.write_text(s[:start] + replacement + s[end:])
print("Removed native Node TypeScript re-exec.")
PY

# ------------------------------------------------------------------
# Also patch panini.mjs if present.
# ------------------------------------------------------------------

if [ -f "$ROOT/scripts/panini.mjs" ]; then

    echo
    echo "== Patch panini.mjs =="

    if [ ! -f "$ROOT/scripts/panini.mjs.native-ts" ]; then
        cp -a "$ROOT/scripts/panini.mjs" \
              "$ROOT/scripts/panini.mjs.native-ts"
        echo "Saved panini.mjs.native-ts"
    else
        echo "Existing panini.mjs.native-ts preserved."
    fi

    python3 - "$ROOT/scripts/panini.mjs" <<'PY'
from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()

marker = 'if (!process.execArgv.includes("--experimental-strip-types")) {'

if marker not in s:
    print("Native TypeScript re-exec block already absent.")
    raise SystemExit(0)

start = s.index(marker)
else_marker = "\n} else {"
else_pos = s.index(else_marker, start)

depth = 1
i = else_pos + len(else_marker)

while i < len(s):
    if s[i] == "{":
        depth += 1
    elif s[i] == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
else:
    raise RuntimeError("Could not find end of TypeScript re-exec block.")

replacement = '''{
  const { runCli } = await import(pathToFileUrl(cliTs));
  const { runHostCc } = await import(
    pathToFileUrl(
      path.join(here, "../src/lib/panini/host-cc-run.server.ts")
    )
  );

  const code = await runCli(process.argv.slice(2), undefined, {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, d) => fs.writeFileSync(p, d),
    nativeCc: runHostCc,
  });

  process.exit(code);
}'''

p.write_text(s[:start] + replacement + s[end:])
print("Removed native Node TypeScript re-exec.")
PY

fi

# ------------------------------------------------------------------
# Back up ALL original ELF tool binaries.
# ------------------------------------------------------------------

echo
echo "== Preserve original ELF binaries =="

ELF_COUNT=0

for f in "$HERE"/*; do
    [ -f "$f" ] || continue

    case "$(basename "$f")" in
        *.elf|*.sh|package.json|package-lock.json)
            continue
            ;;
    esac

    if file "$f" 2>/dev/null | grep -q 'ELF 64-bit'; then
        backup="${f}.elf"

        if [ ! -e "$backup" ]; then
            cp -a "$f" "$backup"
            echo "Backed up $(basename "$f")"
        fi

        ELF_COUNT=$((ELF_COUNT + 1))
    fi
done

echo
echo "ELF launchers found: $ELF_COUNT"

# ------------------------------------------------------------------
# Replace every Panini ELF frontend with a local tsx wrapper.
#
# Each wrapper preserves its original command name. pan-tool.mjs
# determines the tool from argv[0]/the invoked name.
# ------------------------------------------------------------------

echo
echo "== Replace Panini ELF frontends =="

for f in "$HERE"/*; do
    [ -f "$f" ] || continue

    case "$(basename "$f")" in
        *.elf|*.sh|package.json|package-lock.json)
            continue
            ;;
    esac

    if ! file "$f" 2>/dev/null | grep -q 'ELF 64-bit'; then
        continue
    fi

    NAME="$(basename "$f")"

    cat > "$f.new" <<LAUNCHER
#!/usr/bin/env bash
set -euo pipefail

HERE="\$(cd "\$(dirname "\$0")" && pwd)"
ROOT="\$(cd "\$HERE/.." && pwd)"

export PAN_TOOL="$NAME"

exec "\$HERE/node_modules/.bin/tsx" \
    "\$ROOT/scripts/pan-tool.mjs" \
    "\$@"
LAUNCHER

    chmod +x "$f.new"
    mv "$f.new" "$f"

    echo "fixed: $NAME"
done

# ------------------------------------------------------------------
# Remove accidental package metadata ONLY after tsx is installed.
# Keep node_modules because the repaired launchers need it.
# ------------------------------------------------------------------

echo
echo "== Verify package/runtime =="

echo "tsx:"
"$TSX" --version

echo
echo "package:"
cat "$HERE/package.json"

# ------------------------------------------------------------------
# Test the central compiler and several language frontends.
# ------------------------------------------------------------------

echo
echo "============================================================"
echo " SMOKE TESTS"
echo "============================================================"

echo
echo "--- panc --help ---"
"$HERE/panc" --help >/dev/null
echo "PASS: panc"

echo
echo "--- panini --help ---"
"$HERE/panini" --help >/dev/null
echo "PASS: panini"

echo
echo "--- panpy --help ---"
"$HERE/panpy" --help >/dev/null
echo "PASS: panpy"

echo
echo "--- panc --keywords ---"
"$HERE/panc" --keywords >/dev/null
echo "PASS: panc keywords"

# ------------------------------------------------------------------
# Check every repaired frontend for the old native-TS invocation.
# ------------------------------------------------------------------

echo
echo "============================================================"
echo " VERIFY NO REPAIRED FRONTEND IS ELF"
echo "============================================================"

BAD=0

for f in "$HERE"/*; do
    [ -f "$f" ] || continue

    case "$(basename "$f")" in
        *.elf|*.sh|package.json|package-lock.json)
            continue
            ;;
    esac

    if file "$f" 2>/dev/null | grep -q 'ELF 64-bit'; then
        echo "WARNING: still ELF: $(basename "$f")"
        BAD=$((BAD + 1))
    fi
done

if [ "$BAD" -ne 0 ]; then
    echo
    echo "ERROR: $BAD launcher(s) remain unrepaired."
    exit 1
fi

# ------------------------------------------------------------------
# Final status.
# ------------------------------------------------------------------

echo
echo "============================================================"
echo " PANINI TOOLCHAIN REPAIR COMPLETE"
echo "============================================================"
echo
echo "Current directory:"
echo "  $HERE"
echo
echo "TypeScript runtime:"
echo "  $HERE/node_modules/.bin/tsx"
echo
echo "Original ELF launchers:"
echo "  $HERE/*.elf"
echo
echo "Original TypeScript launchers:"
echo "  $ROOT/scripts/pan-tool.mjs.native-ts"
echo "  $ROOT/scripts/panini.mjs.native-ts"
echo
echo "All Panini frontends now use local tsx."
echo
