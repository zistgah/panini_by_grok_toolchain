// @ts-nocheck
/**
 * C four-pass lowering. WASM and run_c stay frozen.
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 *
 * 1. Macro/CPP-lite (see gnuc.js for GNU).
 * 2. void* → T* explicit casts at `T *p = expr` when expr is void*.
 * 3. Designated initializer flattening.
 * 4. Tentative definition merge (int x; int x; → one).
 */
import { gnuc } from "./gnuc.js";

export function clower(src) {
  let s = gnuc(String(src));
  s = flattenDesignated(s);
  s = mergeTentative(s);
  s = voidStarCasts(s);
  return s;
}

/** struct S s = {.y = 2, .x = 1}; → struct S s; s.y = 2; s.x = 1; */
function flattenDesignated(s) {
  return s.replace(
    /\b(?:struct\s+(\w+)\s+)?(\w+)\s*=\s*\{([^}]*)\}\s*;/g,
    (m, st, name, body) => {
      if (!/\.[A-Za-z_]/.test(body) && !/\[[^\]]+\]\s*=/.test(body)) return m;
      const type = st ? "struct " + st + " " : "int ";
      const stmts = [type + name + ";"];
      body.split(",").forEach((part) => {
        const p = part.trim();
        if (!p) return;
        const des = p.match(/^\.(\w+)\s*=\s*(.+)$/);
        const arr = p.match(/^\[(\d+)\]\s*=\s*(.+)$/);
        if (des) stmts.push(name + "." + des[1] + " = " + des[2] + ";");
        else if (arr) stmts.push(name + "[" + arr[1] + "] = " + arr[2] + ";");
      });
      return stmts.join(" ");
    },
  );
}

/** Consecutive `int x;` at file scope collapsed. */
function mergeTentative(s) {
  const seen = new Set();
  return s.replace(/^int[ \t]+([A-Za-z_]\w*)[ \t]*;[ \t]*$/gm, (m, n) => {
    if (seen.has(n)) return "/* tentative merged " + n + " */";
    seen.add(n);
    return m;
  });
}

function voidStarCasts(s) {
  return s.replace(
    /\b(int|char|long|short|void|struct\s+\w+)\s*\*\s*(\w+)\s*=\s*([^;]+);/g,
    (m, t, n, e) => {
      if (/\([^)]+\*\)/.test(e)) return m;
      return t + " *" + n + " = (" + t + " *)(" + e + ");";
    },
  );
}
