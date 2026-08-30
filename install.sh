#!/bin/sh
# Copyright (C) 1993-2026 Abhishek Choudhary
# SPDX-License-Identifier: GPL-3.0-or-later
#
# PANINI toolchain installer.
# Copies named ELF binaries (panc, panpy, panmake, …) onto PREFIX/bin
# and the extract runtime onto PREFIX/lib/panini.
#
# Usage:
#   ./install.sh                 # $HOME/.local
#   ./install.sh /usr/local
#   PREFIX=/opt/panini ./install.sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
PREFIX="${PREFIX:-${1:-$HOME/.local}}"
BIN="$PREFIX/bin"
LIB="$PREFIX/lib/panini"

if [ ! -d "$ROOT/bin" ]; then
  echo "install.sh: no bin/ next to this script" >&2
  exit 2
fi

mkdir -p "$BIN" "$LIB/scripts" "$LIB/src/lib"

if [ -d "$ROOT/scripts" ]; then
  cp -R "$ROOT/scripts/." "$LIB/scripts/"
fi
if [ -d "$ROOT/src/lib/panini" ]; then
  rm -rf "$LIB/src/lib/panini"
  mkdir -p "$LIB/src/lib"
  cp -R "$ROOT/src/lib/panini" "$LIB/src/lib/panini"
fi

n=0
for f in "$ROOT/bin"/pan*; do
  [ -e "$f" ] || continue
  [ -d "$f" ] && continue
  name=$(basename "$f")
  # real file, never a symlink in the destination
  rm -f "$BIN/$name"
  cp -f "$f" "$BIN/$name"
  chmod 755 "$BIN/$name"
  n=$((n + 1))
done

if [ "$n" -lt 1 ]; then
  echo "install.sh: no pan* binaries in $ROOT/bin" >&2
  exit 2
fi

if [ -f "$ROOT/MANUAL.md" ]; then
  cp -f "$ROOT/MANUAL.md" "$LIB/MANUAL.md"
fi

echo "PANINI toolchain → $PREFIX"
echo "installed $n binaries in $BIN"
if [ -f "$LIB/MANUAL.md" ]; then
  echo "manual: $LIB/MANUAL.md"
fi
echo
echo "Add to PATH if it is not already:"
echo "  export PATH=\"$BIN:\$PATH\""
echo
echo "Try:"
echo "  panc --help"
echo "  panc --example factorial"
echo "  panpy --example gcd"
echo "  panc a.c b.c -o out.wasm"
echo "  panc --native a.c b.c -o prog"
echo
echo "These are named extracts. panc is not gcc. panpy is not CPython."
