#!/usr/bin/env bash
set -euo pipefail

HERE="$(pwd)"

echo "== Panini panc repair =="
echo "Current folder: $HERE"
echo

if [ "$(basename "$HERE")" != "bin" ]; then
    echo "ERROR: Run this from the Panini toolchain bin/ directory."
    exit 1
fi

if [ ! -x ./panc ]; then
    echo "ERROR: ./panc not found or not executable."
    exit 1
fi

echo "== Identify embedded Panini root =="
strings ./panc | grep -E 'PANINI_ROOT|pan-tool\.mjs' | head -20 || true
echo

echo "== Locate pan-tool.mjs without leaving current tree =="
PAN_TOOL=""
for candidate in \
    ./../scripts/pan-tool.mjs \
    ./../src/pan-tool.mjs \
    ./../lib/panini/scripts/pan-tool.mjs
do
    if [ -f "$candidate" ]; then
        PAN_TOOL="$candidate"
        break
    fi
done

if [ -z "$PAN_TOOL" ]; then
    echo "ERROR: Could not locate pan-tool.mjs from:"
    echo "$HERE"
    echo
    echo "Candidates checked:"
    echo "  ../scripts/pan-tool.mjs"
    echo "  ../src/pan-tool.mjs"
    echo "  ../lib/panini/scripts/pan-tool.mjs"
    exit 1
fi

PAN_TOOL="$(readlink -f "$PAN_TOOL")"

echo "Found:"
echo "$PAN_TOOL"
echo

echo "== Backup original ELF =="
if [ ! -e ./panc.elf ]; then
    cp -a ./panc ./panc.elf
    echo "Saved ./panc.elf"
else
    echo "./panc.elf already exists; leaving it unchanged."
fi

echo
echo "== Remove accidental npm artifacts created in bin/ =="

rm -rf ./node_modules

if [ -f ./package.json ]; then
    rm -f ./package.json
fi

if [ -f ./package-lock.json ]; then
    rm -f ./package-lock.json
fi

echo "Removed local npm artifacts."
echo

echo "== Create panc replacement =="
cat > ./panc.new <<LAUNCHER
#!/usr/bin/env bash
set -euo pipefail

PANINI_ROOT="\$(cd "\$(dirname "\$0")/.." && pwd)"
PAN_TOOL="\$PANINI_ROOT/scripts/pan-tool.mjs"

if [ ! -f "\$PAN_TOOL" ]; then
    echo "panc: cannot find \$PAN_TOOL" >&2
    echo "panc: run ./install.sh or set PANINI_ROOT" >&2
    exit 1
fi

exec node "\$PAN_TOOL" "\$@"
LAUNCHER

chmod +x ./panc.new

echo "Created ./panc.new"
echo

echo "== Replace panc =="
mv ./panc.new ./panc

echo
echo "== Test launcher =="
./panc --help || true

echo
echo "============================================================"
echo " panc repaired"
echo "============================================================"
echo
echo "Original ELF:"
echo "  ./panc.elf"
echo
echo "Replacement launcher:"
echo "  ./panc"
echo
