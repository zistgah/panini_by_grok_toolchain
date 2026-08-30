// @ts-nocheck
/**
 * GNU Smalltalk Eval-subset for tests/intmath.st (STANDARD GREEN extract).
 * Copyright (C) 1993-2026 Abhishek Choudhary | GPL-3.0-or-later
 *
 * Named extract: Eval[] before the "LargeIntegers" section. factorial /
 * raisedTo / SmallInteger / printString are GAP.
 */
function floorDiv(a, b) { return Math.floor(a / b); }
function rem(a, b) { return a - floorDiv(a, b) * b; }

export function stEval(expr) {
  const s = String(expr).trim();
  let i = 0;
  function peek() { return s[i] || ""; }
  function skip() { while (/\s/.test(peek())) i++; }
  function num() {
    skip();
    const m = s.slice(i).match(/^(\d+)r([0-9A-Fa-f]+)/);
    if (m) { i += m[0].length; return parseInt(m[2], +m[1]); }
    const n = s.slice(i).match(/^\d+/);
    if (n) { i += n[0].length; return parseInt(n[0], 10); }
    return null;
  }
  function unary() {
    skip();
    if (peek() === "-") { i++; return -unary(); }
    if (peek() === "(") { i++; const v = parseCmp(); skip(); if (peek() === ")") i++; return v; }
    const n = num();
    if (n != null) return n;
    return 0;
  }
  function mul() {
    let l = unary();
    for (;;) {
      skip();
      if (s.slice(i, i + 2) === "//") { i += 2; l = floorDiv(l, unary()); }
      else if (s.slice(i, i + 2) === "\\\\") { i += 2; l = rem(l, unary()); }
      else if (peek() === "*") { i++; l = l * unary(); }
      else if (peek() === "/" && s[i + 1] !== "/") { i++; l = l / unary(); }
      else break;
    }
    return l;
  }
  function add() {
    let l = mul();
    for (;;) {
      skip();
      if (peek() === "+" && s[i + 1] !== "+") { i++; l = l + mul(); }
      else if (peek() === "-" && s[i + 1] !== "-") { i++; l = l - mul(); }
      else break;
    }
    return l;
  }
  function parseCmp() {
    let l = add();
    skip();
    const ops = [["<=", 2], [">=", 2], ["~=", 2], ["<", 1], [">", 1], ["=", 1]];
    for (const [op, n] of ops) {
      if (s.slice(i, i + n) === op) {
        i += n;
        const r = add();
        if (op === "<") return l < r;
        if (op === ">") return l > r;
        if (op === "<=") return l <= r;
        if (op === ">=") return l >= r;
        if (op === "=") return l === r;
        if (op === "~=") return l !== r;
      }
    }
    return l;
  }
  return parseCmp();
}

export function stRunFile(src) {
  const prints = [];
  const text = String(src).split(/"LargeIntegers"/)[0];
  const re = /Eval\s*\[\s*([^]+?)\s*\]/g;
  let m;
  while ((m = re.exec(text))) {
    const body = m[1].replace(/"[^"]*"/g, " ").trim();
    if (/factorial|raisedTo|SmallInteger|printString/.test(body)) continue;
    if (/[A-Za-z]/.test(body.replace(/r[0-9A-Fa-f]+/g, ""))) continue;
    try {
      const v = stEval(body);
      prints.push(v);
    } catch (e) {
      return { ok: false, error: String(e.message || e), prints };
    }
  }
  return { ok: true, prints, frontend: "PANINI.Frontend.Smalltalk" };
}

export function stFormat(v) {
  if (v === true) return "true";
  if (v === false) return "false";
  return String(v);
}
