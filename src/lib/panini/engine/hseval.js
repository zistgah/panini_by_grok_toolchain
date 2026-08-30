// @ts-nocheck
/**
 * GHC codeGen should_run subset (cgrun001/002/005).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 */
function stripHs(src) {
  let s = String(src).replace(/\r\n/g, "\n");
  s = s.replace(/--.*$/gm, "");
  s = s.replace(/^[ \t]*[A-Za-z_][\w']*\s*::[^\n]+\n/gm, "");
  s = s.replace(/\bwhere\b/g, "\n");
  return s;
}

function parseBinds(s) {
  const binds = [];
  const re = /^[ \t]*([A-Za-z_][\w']*)(?:\s+([A-Za-z_][\w']*))?\s*=\s*([^\n]+)/gm;
  let m;
  while ((m = re.exec(s))) {
    binds.push({ name: m[1], arg: m[2] || null, rhs: m[3].trim() });
  }
  return binds;
}

function evalExpr(str, env) {
  const s = String(str).trim();
  let i = 0;
  function peek() { return s[i] || ""; }
  function skip() { while (/\s/.test(peek())) i++; }
  function ident() {
    skip();
    const m = s.slice(i).match(/^[A-Za-z_][\w']*/);
    if (!m) return null;
    i += m[0].length;
    return m[0];
  }
  function num() {
    skip();
    const m = s.slice(i).match(/^\d+/);
    if (!m) return null;
    i += m[0].length;
    return parseInt(m[0], 10);
  }
  function atom() {
    skip();
    if (peek() === "(") {
      i++;
      if (peek() === ")") { i++; return null; }
      const v = parseAdd();
      skip();
      if (peek() === ")") i++;
      return v;
    }
    if (peek() === "-") { i++; return -atom(); }
    const n = num();
    if (n != null) return n;
    const id = ident();
    if (id == null) return 0;
    if (id === "print") {
      /* applied in apply() */
    }
    return env[id];
  }
  function apply() {
    skip();
    let f = atom();
    for (;;) {
      skip();
      if (!peek() || /[)+\-*/]/.test(peek())) break;
      const a = atom();
      if (typeof f === "function") f = f(a);
      else break;
    }
    return f;
  }
  function parseMul() {
    let l = apply();
    for (;;) {
      skip();
      if (peek() === "*") { i++; l = l * apply(); }
      else if (peek() === "/") { i++; l = l / apply(); }
      else break;
    }
    return l;
  }
  function parseAdd() {
    let l = parseMul();
    for (;;) {
      skip();
      if (peek() === "+" && s[i + 1] !== "+") { i++; l = l + parseMul(); }
      else if (peek() === "-" && s[i + 1] !== "-") { i++; l = l - parseMul(); }
      else break;
    }
    return l;
  }
  return parseAdd();
}

export function haskellRun(source) {
  const s = stripHs(source);
  const binds = parseBinds(s);
  const env = Object.create(null);
  function lookup(name) { return env[name]; }
  for (const b of binds) {
    if (b.arg) {
      const rhs = b.rhs;
      env[b.name] = (x) => {
        const local = Object.create(env);
        local[b.arg] = x;
        return evalExpr(rhs, local);
      };
    } else {
      Object.defineProperty(env, b.name, {
        configurable: true,
        enumerable: true,
        get() { return evalExpr(b.rhs, env); },
      });
    }
  }
  env.print = (x) => x;
  try {
    const v = evalExpr("main", env);
    return { ok: true, value: v, print: String(v), frontend: "PANINI.Frontend.Haskell" };
  } catch (e) {
    return { ok: false, error: String(e.message || e), frontend: "PANINI.Frontend.Haskell" };
  }
}
